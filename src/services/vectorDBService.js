const { FaissIPStore } = require("../utils/faissIP");
const { OpenAIEmbeddings, AzureOpenAIEmbeddings } = require("@langchain/openai");
const fs = require('fs').promises;
const path = require('path');
const fileProcessor = require('../utils/fileProcessor');

const vectorDBService = {
  dataDir: null,
  databasesFile: null,
  baseURL: "",
  deployment: "",
  vender: "openai",
  args: {
    apiKey: "",
    batchSize: 512,
    model: "",
    stripNewLines: false
  },

  initialize: async (savePath, apiKey, vender = "openai", model = "", baseURL = "", deployment = "") => {
    vectorDBService.dataDir = path.join(savePath, 'databases');
    vectorDBService.databasesFile = path.join(vectorDBService.dataDir, 'databases.json');
    vectorDBService.vender = vender;

    try {
      await fs.mkdir(vectorDBService.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }

    try {
      await fs.access(vectorDBService.databasesFile);
    } catch (error) {
      await vectorDBService.saveDatabases({});
    }

    if (vender === "openai") {
      vectorDBService.args = {
        apiKey: apiKey,
        batchSize: 512,
        model: model ? model : "text-embedding-3-large",
        stripNewLines: false
      };
    } else if (vender === "azure") {
      console.log(`deployment: ${deployment}`);
      vectorDBService.args = {
        apiKey: apiKey,
        deploymentName: deployment,
        azureOpenAIBasePath: `${baseURL}openai/deployments`,
        openAIApiVersion: "2024-02-01",
        batchSize: 512,
        stripNewLines: false,
        dimensions: deployment.includes("ada") ? undefined : 3072
      };
    }

    console.log(`Change Embeddings API Key: ${vectorDBService.args.apiKey.slice(0, 10) + "..."}`);
    console.log(`VectorDBService initialized at: ${vectorDBService.dataDir}`);
  },

  loadDatabases: async () => {
    try {
      const data = await fs.readFile(vectorDBService.databasesFile, 'utf-8');
      const parsedData = JSON.parse(data);
      const databases = parsedData.databases || {};
      const descriptions = parsedData.descriptions || {};
      return { databases, descriptions };
    } catch (error) {
      console.error('Error loading databases:', error);
      return { databases: {}, descriptions: {} };
    }
  },

  saveDatabases: async ({ databases, descriptions }) => {
    try {
      const data = JSON.stringify({ databases, descriptions }, null, 2);
      console.log(`Saving databases: ${JSON.stringify(databases)}`);
      console.log(`Saving descriptions: ${JSON.stringify(descriptions)}`);
      console.log(`Writing to: ${vectorDBService.databasesFile}`);
      console.log(`Data: ${data}`);
      await fs.writeFile(vectorDBService.databasesFile, data);
    } catch (error) {
      console.error('Error saving databases:', error);
    }
  },

  getEmbeddingsProvider: () => {
    if (vectorDBService.vender === "azure") {
      return new AzureOpenAIEmbeddings(vectorDBService.args);
    } else {
      return new OpenAIEmbeddings(vectorDBService.args);
    }
  },

  generateDatabaseId: () => {
    return Date.now().toString();
  },

  getDatabaseIdByName: async (dbName) => {
    const { databases } = await vectorDBService.loadDatabases();
    for (const id in databases) {
      if (databases[id] === dbName) {
        return id;
      }
    }
    return null;
  },

  getDatabaseDescriptionByName: async (dbName) => {
    const { databases, descriptions } = await vectorDBService.loadDatabases();
    const id = await vectorDBService.getDatabaseIdByName(dbName);
    if (id in descriptions) {
      return descriptions[id];
    }
    return "";
  },

  createDatabase: async (dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description) => {
    try {
      const existingDbId = await vectorDBService.getDatabaseIdByName(dbName);
      if (existingDbId) {
        throw new Error(`Database "${dbName}" already exists.`);
      }

      const dbId = vectorDBService.generateDatabaseId();
      const { databases, descriptions } = await vectorDBService.loadDatabases();
      databases[dbId] = dbName;
      descriptions[dbId] = description;

      console.log(`Creating database: ${dbName} (ID: ${dbId})`);

      const allChunks = [];
      const filePathToChunkIds = {};
      const filePathToHash = {};

      const vectorStore = new FaissIPStore(vectorDBService.getEmbeddingsProvider(), {});
      const dbPath = vectorDBService.getDbPath(dbId);

      for (const [index, filePath] of filePaths.entries()) {
        sendProgress(`Processing file ${index + 1} of ${filePaths.length}: ${filePath}`);
        const { chunks, fileHash } = await fileProcessor.processFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
        allChunks.push(...chunks);
        if (chunks) {
          const chunkIds = chunks.map(chunk => chunk.metadata.chunkId);
          await vectorStore.addDocuments(chunks, { ids: chunkIds });
          filePathToHash[filePath] = fileHash;
        } else {
          console.info("chunk is null, skip process.", filePath);
        }
      }

      sendProgress(`Saving Database to ${dbPath}`);
      await vectorDBService.saveDatabase(dbPath, vectorStore, filePathToChunkIds, filePathToHash);
      await vectorDBService.saveDatabases({ databases, descriptions });
      console.log(`Database created: ${dbName} (ID: ${dbId})`);

    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
  },

  addDocumentsToDatabase: async (dbName, filePaths, chunkSize, overlapPercentage, sendProgress, description) => {
    try {
      const dbId = await vectorDBService.getDatabaseIdByName(dbName);
      if (!dbId) {
        throw new Error(`Database not found: ${dbName}`);
      }
      const dbPath = vectorDBService.getDbPath(dbId);
      console.log(`Adding documents to database ${dbName} (ID: ${dbId})`);

      const vectorStore = await vectorDBService.loadDatabase(dbName);
      const { filePathToChunkIds, filePathToHash } = await vectorDBService.loadDocMetadata(dbPath);

      const allChunks = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (const [index, filePath] of filePaths.entries()) {
        sendProgress(`Processing file ${index + 1} of ${filePaths.length}: ${filePath}`);
        const { chunks, fileHash } = await fileProcessor.processFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
        
        if (filePathToHash[filePath] === fileHash) {
          console.log(`File ${filePath} has not changed. Skipping...`);
          skippedCount++;
          continue;
        }

        // 既存のドキュメントの場合、古いチャンクを削除
        if (filePathToChunkIds[filePath]) {
          await vectorStore.delete({ ids: filePathToChunkIds[filePath] });
          delete filePathToChunkIds[filePath];
        }

        allChunks.push(...chunks);

        if (chunks) {
          const chunkIds = chunks.map(chunk => chunk.metadata.chunkId);
          await vectorStore.addDocuments(chunks, { ids: chunkIds });  
          filePathToChunkIds[filePath] = chunkIds;
          filePathToHash[filePath] = fileHash;
          processedCount++;
        } else {
          console.info("chunk is null, skip process.", filePath);
        }
      }

      const { databases, descriptions } = await vectorDBService.loadDatabases();      
      if (description) {
        descriptions[dbId] = description;
      }
      
      sendProgress(`Saving Database to ${dbPath}`);
      await vectorDBService.saveDatabase(dbPath, vectorStore, filePathToChunkIds, filePathToHash);
      await vectorDBService.saveDatabases({ databases, descriptions });
      console.log(`Documents added to database ${dbName} (ID: ${dbId}). Processed: ${processedCount}, Skipped: ${skippedCount}`);

    } catch (error) {
      console.error('Error adding documents to database:', error);
      throw error;
    }
  },

  loadDocMetadata: async (dbPath) => {
    const filePathToChunkIds = JSON.parse(await fs.readFile(path.join(dbPath, 'filePathToChunkIds.json'), 'utf-8'));
    const filePathToHash = JSON.parse(await fs.readFile(path.join(dbPath, 'filePathToHash.json'), 'utf-8'));
    return { filePathToChunkIds, filePathToHash };
  },

  loadDatabase: async (dbName) => {
    try {
      const dbId = await vectorDBService.getDatabaseIdByName(dbName);
      if (!dbId) {
        throw new Error(`Database not found: ${dbName}`);
      }
      const dbPath = vectorDBService.getDbPath(dbId);
      console.log(`Loading database: ${dbPath} (Name: ${dbName})`);
      return await FaissIPStore.load(dbPath, vectorDBService.getEmbeddingsProvider());
    } catch (error) {
      console.error('Error loading database:', error);
      throw error;
    }
  },

  getDocumentNames: async (dbName) => {
    try {
      const dbId = await vectorDBService.getDatabaseIdByName(dbName);
      if (!dbId) {
        throw new Error(`Database not found: ${dbName}`);
      }
      const dbPath = vectorDBService.getDbPath(dbId);
      const { filePathToChunkIds } = await vectorDBService.loadDocMetadata(dbPath);
      const docInfo = Object.keys(filePathToChunkIds).map(filePath => ({
        name: path.basename(filePath),
        path: filePath
      }));
      console.log(`Loaded document info for database ${dbName} (ID: ${dbId}):`, docInfo);
      return docInfo;
    } catch (error) {
      console.error('Error getting document names:', error);
      return [];
    }
  },

  deleteDocumentFromDatabase: async (dbName, filePath) => {
    try {
      const dbId = await vectorDBService.getDatabaseIdByName(dbName);
      if (!dbId) {
        throw new Error(`Database not found: ${dbName}`);
      }
      const dbPath = vectorDBService.getDbPath(dbId);
      console.log(`Deleting document from database ${dbName} (ID: ${dbId}): ${filePath}`);
      const vectorStore = await vectorDBService.loadDatabase(dbName);
      const { filePathToChunkIds, filePathToHash } = await vectorDBService.loadDocMetadata(dbPath);

      const chunkIdsToDelete = filePathToChunkIds[filePath];
      if (!chunkIdsToDelete) {
        console.error('Document not found:', filePath);
        return;
      }

      await vectorStore.delete({ ids: chunkIdsToDelete });
      delete filePathToChunkIds[filePath];
      delete filePathToHash[filePath];

      await vectorDBService.saveDatabase(dbPath, vectorStore, filePathToChunkIds, filePathToHash);
      console.log(`Document deleted from database ${dbName} (ID: ${dbId}): ${filePath}`);
    } catch (error) {
      console.error('Error deleting document from database:', error);
      throw error;
    }
  },

  similaritySearch: async (vectorStore, query, k = 10) => {
    try {
      console.log(`Performing similarity search with query: ${query}`);
      return await vectorStore.similaritySearchWithScore(query, k);
    } catch (error) {
      console.error('Error during similarity search:', error);
      throw error;
    }
  },

  getDbPath: (dbId) => {
    return path.join(vectorDBService.dataDir, dbId);
  },

  saveDatabase: async (dbPath, vectorStore, filePathToChunkIds, filePathToHash) => {
    try {
      await fs.mkdir(dbPath, { recursive: true });
      await vectorStore.save(dbPath);
      await fs.writeFile(path.join(dbPath, 'filePathToChunkIds.json'), JSON.stringify(filePathToChunkIds));
      await fs.writeFile(path.join(dbPath, 'filePathToHash.json'), JSON.stringify(filePathToHash));
      console.log(`Database saved at: ${dbPath}`);
    } catch (error) {
      console.error('Error saving database:', error);
      throw error;
    }
  },
};

module.exports = vectorDBService;
