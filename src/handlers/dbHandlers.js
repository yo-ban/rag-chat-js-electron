const { ipcMain, dialog } = require('electron');
const vectorDBService = require('../services/vectorDBService');
const chatService = require('../services/chatService');
const llmService = require('../services/llmService');
const { v4: uuidv4 } = require('uuid');
const { handleIpcMainEvent } = require('../utils/ipcUtils');
const fileProcessor = require('../utils/fileProcessor');
const fs = require('fs');
const { mergeAndRerankSearchResults, parseJsonResponse, generateAnalysisPrompt, generateTransformationPrompt, determineInformationSufficientPrompt } = require('../utils/ragUtils');

const activeDatabases = {}; // DB IDとDBインスタンスのマップ

async function loadDatabaseByName(dbName) {
  const existingDbId = Object.keys(activeDatabases).find(
    (id) => activeDatabases[id].name === dbName
  );

  if (existingDbId) {
    console.log(`The database "${dbName}" is already loaded.`);
    return existingDbId;
  }

  console.log(`Loading the database "${dbName}"...`);

  const dbId = uuidv4();
  activeDatabases[dbId] = {
    db: await vectorDBService.loadDatabase(dbName),
    name: dbName,
  };
  return dbId;
}

async function reloadActiveDatabase(dbName) {
  const dbId = Object.keys(activeDatabases).find(
    (id) => activeDatabases[id].name === dbName
  );

  if (dbId) {
    delete activeDatabases[dbId];
    activeDatabases[dbId] = {
      db: await vectorDBService.loadDatabase(dbName),
      name: dbName,
    };
    console.log(`Reload active database: ${dbName} (ID: ${dbId})`);
  }
}

ipcMain.handle('open-file-dialog', async (event, options) => {
  return handleIpcMainEvent('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: options.properties || ['openFile'],
      filters: [
        { name: 'Document Files', extensions: ['pdf', 'docx', 'html', 'htm', 'xlsx'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'markdown', 'yaml', 'yml'] },
        { name: 'Data Files', extensions: ['json', 'csv'] },
        { 
          name: 'Programming Files', 
          extensions: ['cpp', 'go', 'java', 'js', 'php', 'proto', 'py', 'rst', 'rb', 'rs', 'scala', 'swift', 'tex'] 
        },
      ]
    });

    if (!canceled && filePaths.length > 0) {
      const allFiles = [];
      const maxDepth = options.folderDepth || 3;
      filePaths.forEach((filePath) => {
        if (fs.statSync(filePath).isDirectory()) {
          const filesInDir = fileProcessor.getAllFiles(
            filePath,
            [
              'cpp', 'go', 'java', 'js', 'php', 'proto', 'py', 'rst', 'rb', 'rs', 'scala', 'swift', 'tex', 
              'txt', 'md', 'markdown', 'yaml', 'yml', 
              'pdf', 'docx', 'html', 'htm', 'xlsx', 
              'json', 'csv'
            ],
            [],
            0,
            maxDepth
          );
          allFiles.push(...filesInDir);
        } else {
          allFiles.push(filePath);
        }
      });
      console.log(allFiles);
      return allFiles;
    } else {
      return null;
    }
  });
});


ipcMain.handle('load-databases', async () => {
  return handleIpcMainEvent('load-databases', async () => await vectorDBService.loadDatabases());
});

ipcMain.handle('create-database', async (event, dbName, filePaths, chunkSize, overlapPercentage, description) => {
  return handleIpcMainEvent('create-database', async () => {
    console.log("Database Name:", dbName);
    console.log("File Paths in main process:", filePaths);

    const sendProgress = (message) => {
      event.sender.send('database-progress', message, dbName);
    };

    try {
      await vectorDBService.createDatabase(dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description);
    } catch (error) {
      throw error;
    }
  });
});

ipcMain.handle('add-documents-to-database', async (event, dbName, filePaths, chunkSize, overlapPercentage, description) => {
  return handleIpcMainEvent('add-documents-to-database', async () => {

    console.log("Database Name:", dbName);
    console.log("File Paths in main process:", filePaths);

    const sendProgress = (message) => {
      event.sender.send('database-progress', message, dbName);
    };

    try {
      await vectorDBService.addDocumentsToDatabase(dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description);
      await reloadActiveDatabase(dbName); // ドキュメント追加後にアクティブなデータベースを再読み込み
    } catch (error) {
      throw error;
    }
  });
});

ipcMain.handle('delete-document-from-database', async (event, dbName, documentIndex) => {
  return handleIpcMainEvent('delete-document-from-database', async () => {
    await vectorDBService.deleteDocumentFromDatabase(dbName, documentIndex);
    await reloadActiveDatabase(dbName); // ドキュメント削除後にアクティブなデータベースを再読み込み
  });
});

ipcMain.handle('load-database', async (event, dbName) => {
  return handleIpcMainEvent('load-database', async () => await loadDatabaseByName(dbName));
});

ipcMain.handle('reload-database', async (event, dbName) => {
  return handleIpcMainEvent('reload-database', async () => await reloadActiveDatabase(dbName));
});

ipcMain.handle('get-document-names', async (event, dbName) => {
  return handleIpcMainEvent('get-document-names', async () => await vectorDBService.getDocumentNames(dbName));
});

ipcMain.handle('delete-database', async (event, dbName) => {
  return handleIpcMainEvent('delete-database', async () => {
    const dbId = await vectorDBService.getDatabaseIdByName(dbName);
    if (!dbId) throw new Error(`Database not found: ${dbName}`);
    const dbPath = vectorDBService.getDbPath(dbId);
    
    fs.rmSync(dbPath, { recursive: true, force: true });
    
    const { databases, descriptions } = await vectorDBService.loadDatabases();
    delete databases[dbId];
    delete descriptions[dbId];
    await vectorDBService.saveDatabases({ databases, descriptions });
  });
});

async function analysisQuery(chatHistory, chatData, dbDescription) {

  // クエリ分析プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = generateAnalysisPrompt(filteredChatHistory, chatData.topic, dbDescription);

  // クエリ分析実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 1024, (content) => {
    response += content;
  });

  return response.trim();
}

async function determine(chatHistory, chatData, dbDescription, analysis){

  // 検索判断プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = determineInformationSufficientPrompt(filteredChatHistory, chatData.topic, dbDescription, analysis);

  // 判断を実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.3, 500, (content) => {
    response += content;
  });

  // レスポンスをパース
  const determineResult = parseJsonResponse(response.trim());
  return determineResult;
}

async function transformQuery(chatHistory, analysis, chatData, dbDescription) {

  // クエリ変換プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = generateTransformationPrompt(filteredChatHistory, chatData.topic, analysis, dbDescription);

  // クエリ変換実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 500, (content) => {
    response += content;
  });

  // レスポンスをパース
  const transformedQueries = parseJsonResponse(response.trim());
  return transformedQueries;
}

async function similaritySearch(dbId, queries, k = 10) {
  const db = activeDatabases[dbId].db;
  if (!db) throw new Error(`Database not found: ${dbId}`);

  // 各クエリに対して検索を実行
  const searchResults = await Promise.all(
    queries.map(query => vectorDBService.similaritySearch(db, query, k + 5))
  );

  // 簡易リランク、ソート
  const mergedResults = mergeAndRerankSearchResults(searchResults, queries, k);
  return mergedResults;
}

ipcMain.handle('retrieval-augmented', async (event, chatId, chatHistory, activeDbId, k) => {
  return handleIpcMainEvent(event, async () => {

    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);
    
    let dbDescription = "";
    if (chatData.dbName){    
      dbDescription = `${chatData.dbName}: ${await vectorDBService.getDatabaseDescriptionByName(chatData.dbName)}`;
    }
    console.log(dbDescription);
    event.sender.send('message-progress', 'analysisQuery');
    const analysisResult = await analysisQuery(chatHistory, chatData, dbDescription);
    console.log(`Query analysis result:\n${analysisResult}`);

    const determineResult = await determine(chatHistory, chatData, dbDescription, analysisResult);
    console.log(`Determine information sufficient result:\n${JSON.stringify(determineResult)}`);

    const documentSearch = determineResult.documentSearch;
    const reason = determineResult.reason;
    if (!documentSearch) {
      return { documentSearch, reason, queries:[], mergedResults:[] }
    }

    event.sender.send('message-progress', 'transformQuery');
    const transformedQueries = await transformQuery(chatHistory, analysisResult, chatData, dbDescription);
    const queries = transformedQueries.map(transformedQuery => transformedQuery.prompt);
    console.log(`Transformed queries:\n${JSON.stringify(transformedQueries)}`);

    event.sender.send('message-progress', 'searchingInDatabase');
    const mergedResults = await similaritySearch(activeDbId, queries, k);

    return { documentSearch: true, reason: "", queries, mergedResults }
  });
});
