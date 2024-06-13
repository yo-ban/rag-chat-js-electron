const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendMessage: (messages, chatId, context, queries) => ipcRenderer.invoke('send-message', messages, chatId, context, queries),
  sendMessageFollowup: (messages, chatId, followupReason) => ipcRenderer.invoke('send-message-followup', messages, chatId, followupReason),
  deleteMessages: (chatId, startIndex) => ipcRenderer.invoke('delete-messages', chatId, startIndex),
  generateChatName: (messages, chatId) => ipcRenderer.invoke('generate-chat-name', messages, chatId),
  loadChats: () => ipcRenderer.invoke('load-chats'),
  loadChatHistory: (chatId) => ipcRenderer.invoke('load-chat-history', chatId),
  createNewChat: (dbName, chatConfig) => ipcRenderer.invoke('create-new-chat', dbName, chatConfig),
  updateChat: (updatedChat) => ipcRenderer.invoke('update-chat', updatedChat),
  deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),
  onStreamingMessage: (callback) => ipcRenderer.on('streaming-message', (event, content) => callback(content)),
  onStreamingMessageEnd: (callback) => ipcRenderer.on('streaming-message-end', (event) => callback()),
  loadDatabases: () => ipcRenderer.invoke('load-databases'),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  onDatabaseProgress: (callback) => ipcRenderer.on('database-progress', (event, message, dbName) => callback(message, dbName)),
  onMessageProgress: (callback) => ipcRenderer.on('message-progress', (event, message) => callback(message)),
  createDatabase: (dbName, filePaths, chunkSize, overlapPercentage, description) => ipcRenderer.invoke('create-database', dbName, filePaths, chunkSize, overlapPercentage, description),
  loadDatabase: (dbName) => ipcRenderer.invoke('load-database', dbName),
  deleteDatabase: (dbName) => ipcRenderer.invoke('delete-database', dbName),
  reloadDatabase: (dbName) => ipcRenderer.invoke('reload-database', dbName),
  getDocumentNames: (dbName) => ipcRenderer.invoke('get-document-names', dbName),
  addDocumentsToDatabase: (dbName, filePaths, chunkSize, overlapPercentage) => ipcRenderer.invoke('add-documents-to-database', dbName, filePaths, chunkSize, overlapPercentage),
  deleteDocumentFromDatabase: (dbName, documentIndex) => ipcRenderer.invoke('delete-document-from-database', dbName, documentIndex),
  retrievalAugmented: (chatId, chatHistory, activeDbId, k) => ipcRenderer.invoke('retrieval-augmented', chatId, chatHistory, activeDbId, k),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openLocalFile: (filePath) => ipcRenderer.invoke('open-local-file', filePath),
  openLink: (url) => ipcRenderer.invoke('open-link', url),
  onDocMessage: (callback) => ipcRenderer.on('doc-message', (event, content) => callback(content)),
  removeListener: (name, callback) => ipcRenderer.removeListener(name, callback),
});
