const { ipcMain, dialog } = require('electron');
const vectorDBService = require('../services/vectorDBService');
const { v4: uuidv4 } = require('uuid');
const { handleIpcMainEvent } = require('../utils/ipcUtils');
const fileProcessor = require('../utils/fileProcessor');
const fs = require('fs');
const { mergeAndRerankSearchResults } = require('../utils/ragUtils');

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
  return handleIpcMainEvent('load-databases', () => vectorDBService.loadDatabases());
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

ipcMain.handle('add-documents-to-database', async (event, dbName, filePaths, chunkSize, overlapPercentage) => {
  return handleIpcMainEvent('add-documents-to-database', async () => {

    console.log("Database Name:", dbName);
    console.log("File Paths in main process:", filePaths);

    const sendProgress = (message) => {
      event.sender.send('database-progress', message, dbName);
    };

    try {
      await vectorDBService.addDocumentsToDatabase(dbName, filePaths, chunkSize, overlapPercentage, sendProgress);
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
  return handleIpcMainEvent('load-database', () => loadDatabaseByName(dbName));
});

ipcMain.handle('reload-database', async (event, dbName) => {
  return handleIpcMainEvent('reload-database', () => reloadDatabaseByName(dbName));
});

ipcMain.handle('get-document-names', async (event, dbName) => {
  return handleIpcMainEvent('get-document-names', () => vectorDBService.getDocumentNames(dbName));
});

ipcMain.handle('delete-database', async (event, dbName) => {
  return handleIpcMainEvent('delete-database', async () => {
    const dbId = vectorDBService.getDatabaseIdByName(dbName);
    if (!dbId) throw new Error(`Database not found: ${dbName}`);
    const dbPath = vectorDBService.getDbPath(dbId);
    
    fs.rmSync(dbPath, { recursive: true, force: true });
    
    const { databases, descriptions } = vectorDBService.loadDatabases();
    delete databases[dbId];
    delete descriptions[dbId];
    vectorDBService.saveDatabases({ databases, descriptions });
  });
});

ipcMain.handle('similarity-search', async (event, dbId, queries, k = 10) => {
  return handleIpcMainEvent('similarity-search', async () => {
    const db = activeDatabases[dbId].db;
    if (!db) throw new Error(`Database not found: ${dbId}`);

    // 各クエリに対して検索を実行
    const searchResults = await Promise.all(
      queries.map(query => vectorDBService.similaritySearch(db, query, k + 5))
    );

    // 簡易リランク、ソート
    const mergedResults = mergeAndRerankSearchResults(searchResults, queries, k);

    return mergedResults;
  });
});