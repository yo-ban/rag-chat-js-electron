const fs = require('fs');
const path = require('path');

const chatService = {
  chatDir: null,

  initialize: (savePath) => {
    chatService.chatDir = path.join(savePath, 'chats');
    if (!fs.existsSync(chatService.chatDir)) {
      fs.mkdirSync(chatService.chatDir,  {recursive: true});
    }
  },

  loadChats: () => {
    try {
      return fs.readdirSync(chatService.chatDir).map(file => {
        const chatData = JSON.parse(fs.readFileSync(path.join(chatService.chatDir, file)));
        const previewMessage = chatData.messages.find(msg => msg.role === 'user');
        return {
          id: path.basename(file, '.json'),
          name: chatData.name || 'Untitled Chat',
          preview: previewMessage ? previewMessage.content : '',
          systemMessage: chatData.systemMessage || 'You are a helpful assistant.',
          temperature: chatData.temperature || 0.5,
          maxTokens: chatData.maxTokens || 1024,
          dbName: chatData.dbName || null,
          updatedAt: chatData.updatedAt || Date.now(),
          searchResultsLimit: chatData.searchResultsLimit || 6,
          topic: chatData.topic || ""
        };
      }).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Error loading chats:', error);
      return [];
    }
  },

  loadChatData: (chatId) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    if (fs.existsSync(chatFilePath)) {
      return JSON.parse(fs.readFileSync(chatFilePath));
    }
    return null;
  },

  loadChatHistory: (chatId) => {
    const chatData = chatService.loadChatData(chatId);
    return chatData ? chatData.messages : [];
  },

  createNewChat: (dbName = null, chatConfig = { name: 'New Chat', temperature: 0.5, maxTokens: 1024, vender: 'openai' }) => {
    const newChatId = `chat-${Date.now()}`;
    const newChatData = {
      name: chatConfig.name || 'New Chat',
      systemMessage: chatConfig.systemMessage,
      messages: [],
      temperature: chatConfig.temperature || 0.5,
      maxTokens: chatConfig.maxTokens || 1024,
      updatedAt: Date.now(),
      dbName: dbName,
      searchResultsLimit: chatConfig.searchResultsLimit || 6,
      preview: "",
      topic: ""
    };
    const chatFilePath = path.join(chatService.chatDir, `${newChatId}.json`);
    try {
      fs.writeFileSync(chatFilePath, JSON.stringify(newChatData, null, 2));
      return chatService.formatChatData(newChatId, newChatData);
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  },
  
  updateChat: (updatedChat) => {
    const existingChatData = chatService.loadChatData(updatedChat.id);
    if (!existingChatData) {
      console.error('Chat data not found for chatId:', updatedChat.id);
      return null;
    }

    const updatedData = {
      ...existingChatData,
      ...Object.keys(updatedChat).reduce((acc, key) => {
        if (updatedChat[key] !== undefined) {
          acc[key] = updatedChat[key];
        }
        return acc;
      }, {}),
      preview: updatedChat.preview || existingChatData.preview,
      updatedAt: updatedChat.updatedAt || existingChatData.updatedAt
    };
    
    try {
      const chatFilePath = path.join(chatService.chatDir, `${updatedChat.id}.json`);
      fs.writeFileSync(chatFilePath, JSON.stringify(updatedData, null, 2));
      return chatService.formatChatData(updatedChat.id, updatedData);
    } catch (error) {
      console.error('Error updating chat:', error);
      return null;
    }
  },

  deleteChat: (chatId) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    if (fs.existsSync(chatFilePath)) {
      try {
        fs.unlinkSync(chatFilePath);
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  },

  saveChatMessage: (chatId, messages) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    const chatData = chatService.loadChatData(chatId);

    if (chatData) {
      chatData.messages = messages;
      chatData.updatedAt = Date.now();
      try {
        fs.writeFileSync(chatFilePath, JSON.stringify(chatData, null, 2));
      } catch (error) {
        console.error('Error saving chat message:', error);
      }
    }
  },

  saveChatName: (chatId, name) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    const chatData = chatService.loadChatData(chatId);

    if (chatData) {
      chatData.name = name;
      try {
        fs.writeFileSync(chatFilePath, JSON.stringify(chatData, null, 2));
      } catch (error) {
        console.error('Error saving chat message:', error);
      }
    }
  },

  formatChatData: (chatId, chatData) => {
    const previewMessage = chatData.messages.find(msg => msg.role === 'user');
    return {
      id: chatId,
      name: chatData.name,
      maxTokens: chatData.maxTokens,
      systemMessage: chatData.systemMessage,
      temperature: chatData.temperature,
      dbName: chatData.dbName,
      preview: chatData.preview || previewMessage?.content || "",
      updatedAt: chatData.updatedAt,
      searchResultsLimit: chatData.searchResultsLimit,
      topic: chatData.topic
    };
  }
};

module.exports = chatService;
