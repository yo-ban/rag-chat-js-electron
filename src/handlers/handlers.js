const { ipcMain, dialog } = require('electron');
const vectorDBService = require('../services/vectorDBService');
const chatService = require('../services/chatService');
const llmService = require('../services/llmService');
const { handleIpcMainEvent } = require('../utils/ipcUtils');
const fileProcessor = require('../utils/fileProcessor');
const fs = require('fs').promises;
const { 
  analysisQuery, 
  determine,
  transformQuery,
  similaritySearch 
} = require('../utils/ragUtils');
const { 
  generateQAPrompt, 
  generateFollowUpPrompt, 
} = require('../utils/promptGenerators');
const { parseJsonResponse } = require('../utils/jsonUtils');

const activeStreams = new Map();
const activeDatabases = {}; // DB IDとDBインスタンスのマップ

async function loadDatabaseByName(dbName) {
  const existingDbId = Object.keys(activeDatabases).find(
    (id) => activeDatabases[id].name === dbName
  );

  if (existingDbId) {
    console.log(`The database "${dbName}" is already loaded.`);
    return existingDbId;
  }


  const dbId = await vectorDBService.getDatabaseIdByName(dbName);
  console.log(`Loading the database "${dbId}: ${dbName}"...`);

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

      for (const filePath of filePaths) {
        const stats = await fs.stat(filePath); // 非同期でファイルステータスを取得

        if (stats.isDirectory()) {
          const filesInDir = await fileProcessor.getAllFiles( // 非同期に変更
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
      }

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
      const result = await vectorDBService.createDatabase(dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description);
      console.log("Database creation result:", result);
      return result; // 結果オブジェクトをそのまま返す
    } catch (error) {
      console.error("Error creating database:", error);
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
      const result = await vectorDBService.addDocumentsToDatabase(dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description);
      console.log("Document addition result:", JSON.stringify(result));
      if (result.success) {
        await reloadActiveDatabase(dbName); // ドキュメント追加後にアクティブなデータベースを再読み込み
      }
      return result; // 結果オブジェクトをそのまま返す
    } catch (error) {
      console.error("Error adding documents to database:", error);
      return {
        success: false,
        message: `Error adding documents to database: ${error.message}`,
        log: [`Error: ${error.message}`]
      };
    }
  });
});

ipcMain.handle('delete-document-from-database', async (event, dbName, filePath) => {
  return handleIpcMainEvent('delete-document-from-database', async () => {
    await vectorDBService.deleteDocumentFromDatabase(dbName, filePath);
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

    await fs.rm(dbPath, { recursive: true, force: true });

    // activeDatabasesから削除
    delete activeDatabases[dbId];
    console.log(`Removed database ${dbName} from activeDatabases`);

    const { databases, descriptions } = await vectorDBService.loadDatabases();
    delete databases[dbId];
    delete descriptions[dbId];
    await vectorDBService.saveDatabases({ databases, descriptions });
  });
});

ipcMain.handle('retrieval-augmented', async (event, chatId, chatHistory, activeDbId, k, options = {}) => {
  const messageId = options.messageId;

  return handleIpcMainEvent(event, async () => {

    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);
    
    let dbDescription = "";
    if (chatData.dbName){    
      dbDescription = `${chatData.dbName}: ${await vectorDBService.getDatabaseDescriptionByName(chatData.dbName)}`;
    }
    console.log(dbDescription);

    const controller = new AbortController();
    const signal = controller.signal;
    activeStreams.set(messageId, controller);

    event.sender.send('message-progress', 'analysisQuery');
    const analysisResult = await analysisQuery(chatHistory, chatData, dbDescription, signal);
    console.log(`Query analysis result:\n${analysisResult}`);

    const determineResult = await determine(chatHistory, chatData, dbDescription, analysisResult, signal);
    console.log(`Determine information sufficient result:\n${JSON.stringify(determineResult)}`);

    const documentSearch = determineResult.documentSearch;
    const reason = determineResult.reason;
    if (!documentSearch) {
      return { documentSearch, reason, queries:[], mergedResults:[] }
    }

    event.sender.send('message-progress', 'transformQuery');
    const transformedQueries = await transformQuery(chatHistory, analysisResult, chatData, dbDescription, signal);
    const queries = transformedQueries.map(transformedQuery => transformedQuery.prompt);
    console.log(`Transformed queries:\n${JSON.stringify(transformedQueries)}`);

    event.sender.send('message-progress', 'searchingInDatabase');

    const db = activeDatabases[activeDbId].db;
    if (!db) throw new Error(`Database not found: ${activeDbId}`);
    const mergedResults = await similaritySearch(db, queries, k);

    activeStreams.delete(messageId);

    if (signal && signal.aborted) {
      throw new Error('Message sending cancelled');
    }

    return { documentSearch: true, reason: "", queries, mergedResults }
  });
});

ipcMain.handle('send-message', async (event, messages, chatId, context = [], queries = [], options = {}) => {
  const messageId = options.messageId;

  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const { systemMessage, temperature, maxTokens, maxHistoryLength, topic, dbName } = chatData;

    let dbInfo = "";
    if (chatData.dbName) {
      const dbDescription = await vectorDBService.getDatabaseDescriptionByName(chatData.dbName);
      dbInfo = `${dbName}(${dbDescription})`;
    }

    const systemMessageToSend = generateQAPrompt(systemMessage, topic, context, queries, dbInfo);

    let filteredMessages = messages.filter(message => message.role !== 'doc');
    if (maxHistoryLength > 0) {
      filteredMessages = filteredMessages.slice(-maxHistoryLength);
    }

    const messagesToSend = [{ role: 'system', content: systemMessageToSend }, ...filteredMessages];

    let assistantMessageContent = '';

    const controller = new AbortController();
    const signal = controller.signal;
    activeStreams.set(messageId, controller);

    // ストリーミングメッセージの完了を待つ
    await new Promise((resolve, reject) => {
      llmService.sendMessage(messagesToSend, parseFloat(temperature), parseInt(maxTokens, 10), (content) => {
        assistantMessageContent += content;
        event.sender.send('streaming-message', content);
      }, signal).then(resolve).catch(reject);
    });

    activeStreams.delete(messageId);

    if (signal && signal.aborted) {
      throw new Error('Message sending cancelled');
    }

    const updatedMessages = [...messages, { role: 'assistant', content: assistantMessageContent }];
    event.sender.send('streaming-message-end');

    if (context && context.length > 0) {
      const docMessage = {
        role: 'doc',
        results: context.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          combinedScore: doc.combinedScore
        }))
      };
      updatedMessages.push(docMessage);
      event.sender.send('doc-message', docMessage.results);
    }

    await chatService.saveChatMessage(chatId, updatedMessages);
  });
});

ipcMain.handle('cancel-message', (event, messageId) => {
  const controller = activeStreams.get(messageId);
  console.log(`Message ${messageId} cancelled`);
  if (controller) {
    controller.abort();
    activeStreams.delete(messageId);
    console.log(`Message ${messageId} cancelled`);
  }
});

ipcMain.handle('send-message-followup', async (event, messages, chatId, followupReason, options = {}) => {
  const messageId = options.messageId;

  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const { systemMessage, temperature, maxTokens, topic } = chatData;

    const systemMessageToSend = generateFollowUpPrompt(systemMessage, topic, followupReason);

    const filteredMessages = messages.filter(message => message.role !== 'doc');
    const messagesToSend = [{ role: 'system', content: systemMessageToSend }, ...filteredMessages];
    let assistantMessageContent = '';

    const controller = new AbortController();
    const signal = controller.signal;
    activeStreams.set(messageId, controller);
    
    // ストリーミングメッセージの完了を待つ
    await new Promise((resolve, reject) => {
      llmService.sendMessage(messagesToSend, parseFloat(temperature), parseInt(maxTokens, 10), (content) => {
        assistantMessageContent += content;
        event.sender.send('streaming-message', content);
      }, signal).then(resolve).catch(reject);
    });

    activeStreams.delete(messageId);

    if (signal && signal.aborted) {
      throw new Error('Message sending cancelled');
    }

    const updatedMessages = [...messages, { role: 'assistant', content: assistantMessageContent }];
    event.sender.send('streaming-message-end');
    
    await chatService.saveChatMessage(chatId, updatedMessages);
  });
});

ipcMain.handle('delete-messages', async (event, chatId, startIndex) => {
  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const updatedMessages = chatData.messages.slice(0, startIndex);
    await chatService.saveChatMessage(chatId, updatedMessages);
    return updatedMessages;
  });
});

ipcMain.handle('generate-chat-name', async (event, messages, chatId) => {
  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const systemMessageToSend = "You are the AI of generating conversation titles.";
    const prompt = "Based on your conversation history, create a short title, no more than 5~7 words, that is appropriate for this conversation. Titles should be created in the language used by the user. Do not output anything other than the title of the conversation. Avoid including unnecessary characters such as brackets or 'Title:'."
    const filteredMessages = messages.filter(message => message.role !== 'doc');
    const messagesToSend = [{ role: 'system', content: systemMessageToSend }, ...filteredMessages, {role: 'user', content: prompt}];
    let assistantMessageContent = '';

    try {
      await llmService.sendMessage(messagesToSend, 0.7, 256, (content) => {
        assistantMessageContent += content;
      });
      
      console.log("Generate chat name: ", assistantMessageContent);

      await chatService.saveChatName(chatId, assistantMessageContent);
      return assistantMessageContent;
    } catch {
      console.error("Error generate chat name: ", e);
      return ""
    }
  });
});

ipcMain.handle('generate-db-info', async (event, fileLists, language) => {
  return handleIpcMainEvent(event, async () => {
    const systemMessageToSend = "You are an AI specialized in generating database names and descriptions.";
    const documentNames = fileLists.join('\n');
    const prompt = `Based on the following list of document names, infer a useful and relevant short database name (a few characters) and a description (a few sentences) that accurately represent the contents and purpose of the documents. Ensure the database name is concise and the description is clear and informative.

Provide the output in the following JSON format:
{
  "dbName": "short and clear database name (one word if possible)",
  "dbDescription": "detailed description of the database (within 100 characters)"
}

The output should be in the ${language.toUpperCase()} language. Do not output anything other than the JSON object. Ensure the database name is clear and the description does not exceed 50 characters.

Document names:
${documentNames}`;

    const messagesToSend = [
      { role: 'system', content: systemMessageToSend },
      { role: 'user', content: prompt }
    ];

    let assistantMessageContent = '';

    await llmService.sendMessage(messagesToSend, 0.7, 256, (content) => {
      assistantMessageContent += content;
    });
    
    console.log(`Generated DB info:\n${assistantMessageContent}`);

    try {
      const dbInfo = parseJsonResponse(assistantMessageContent);
      return { dbName: dbInfo.dbName, dbDescription: dbInfo.dbDescription };
    } catch {
      console.error("Error generate DB info: ", e);
      return { dbName: "", dbDescription: "" };
    }
  });
});

ipcMain.handle('load-chats', async (event) => {
  return handleIpcMainEvent('load-chats', async () => await chatService.loadChats());
});

ipcMain.handle('load-chat-history', async (event, chatId) => {
  return handleIpcMainEvent('load-chat-history', async () => await chatService.loadChatHistory(chatId));
});

ipcMain.handle('create-new-chat', async (event, dbName, chatConfig) => {
  return handleIpcMainEvent('create-new-chat', async () => await chatService.createNewChat(dbName, chatConfig));
});

ipcMain.handle('update-chat', async (event, updatedChat) => {
  return handleIpcMainEvent('update-chat', async () => await chatService.updateChat(updatedChat));
});

ipcMain.handle('delete-chat', async (event, chatId) => {
  return handleIpcMainEvent('delete-chat', async () => await chatService.deleteChat(chatId));
});
