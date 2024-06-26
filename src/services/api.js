// ElectronのIPC通信を抽象化するサービス
const api = {
  sendMessage: (messages, chatId, context, queries, options) => window.electron.sendMessage(messages, chatId, context, queries, options),
  sendMessageFollowup: (messages, chatId, followupReason, options) => window.electron.sendMessageFollowup(messages, chatId, followupReason, options),
  cancelMessage: (messageId) => window.electron.cancelMessage(messageId),
  deleteMessages: (chatId, startIndex) => window.electron.deleteMessages(chatId, startIndex),
  generateChatName: (messages, chatId) => window.electron.generateChatName(messages, chatId),
  loadChats: () => window.electron.loadChats(),
  loadChatHistory: (chatId) => window.electron.loadChatHistory(chatId),
  createNewChat: (dbName, chatConfig) => window.electron.createNewChat(dbName, chatConfig),
  updateChat: (updatedChat) => window.electron.updateChat(updatedChat),
  deleteChat: (chatId) => window.electron.deleteChat(chatId),
  onStreamingMessage: (callback) => window.electron.onStreamingMessage(callback),
  onStreamingMessageEnd: (callback) => window.electron.onStreamingMessageEnd(callback),
  loadDatabases: () => window.electron.loadDatabases(),
  reloadDatabases: () => window.electron.reloadDatabases(),
  openFileDialog: (options) => window.electron.openFileDialog(options),
  onDatabaseProgress: (callback) => window.electron.onDatabaseProgress(callback),
  onMessageProgress: (callback) => window.electron.onMessageProgress(callback),
  generateDbInfo: (fileLists, language) => window.electron.generateDbInfo(fileLists, language),
  createDatabase: (dbName, filePaths, chunkSize, overlapPercentage, description) => window.electron.createDatabase(dbName, filePaths, chunkSize, overlapPercentage, description),
  loadDatabase: (dbName) => window.electron.loadDatabase(dbName),
  deleteDatabase: (dbName) => window.electron.deleteDatabase(dbName),
  getDocumentNames: (dbName) => window.electron.getDocumentNames(dbName),
  addDocumentsToDatabase: (dbName, filePaths, chunkSize, overlapPercentage, description) => window.electron.addDocumentsToDatabase(dbName, filePaths, chunkSize, overlapPercentage, description),
  deleteDocumentFromDatabase: (dbName, filePath) => window.electron.deleteDocumentFromDatabase(dbName, filePath),
  retrievalAugmented: (chatId, chatHistory, activeDbId, k, options) => window.electron.retrievalAugmented(chatId, chatHistory, activeDbId, k, options),
  loadSettings: () => window.electron.loadSettings(),
  saveSettings: (settings) => window.electron.saveSettings(settings),
  openLocalFile: (filePath) => window.electron.openLocalFile(filePath),
  openLink: (url) => window.electron.openLink(url),
  onDocMessage: (callback) => window.electron.onDocMessage(callback),
  removeListener: (name, callback) => window.electron.removeListener(name, callback),
};

export default api;
