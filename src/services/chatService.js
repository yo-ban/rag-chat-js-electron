const fs = require('fs').promises;
const path = require('path');

const chatService = {
  chatDir: null,

  initialize: async (savePath) => {
    chatService.chatDir = path.join(savePath, 'chats');
    try {
      await fs.mkdir(chatService.chatDir, { recursive: true });
    } catch (error) {
      console.error('Error creating chat directory:', error);
    }
  },

  loadChats: async () => {
    try {
      const files = await fs.readdir(chatService.chatDir);
      const chats = await Promise.all(files.map(async (file) => {
        const chatData = JSON.parse(await fs.readFile(path.join(chatService.chatDir, file)));
        const previewMessage = chatData.messages.find(msg => msg.role === 'user');
        return {
          id: path.basename(file, '.json'),
          name: chatData.name || 'Untitled Chat',
          preview: previewMessage ? previewMessage.content : '',
          systemMessage: chatData.systemMessage || 'You are a helpful assistant.',
          temperature: chatData.temperature || 0.5,
          maxTokens: chatData.maxTokens || 1024,
          maxHistoryLength: chatData.maxHistoryLength || 6,
          dbName: chatData.dbName || null,
          updatedAt: chatData.updatedAt || Date.now(),
          searchResultsLimit: chatData.searchResultsLimit || 6,
          topic: chatData.topic || ""
        };
      }));
      return chats.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Error loading chats:', error);
      return [];
    }
  },

  loadChatData: async (chatId) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    try {
      const chatData = await fs.readFile(chatFilePath);
      return JSON.parse(chatData);
    } catch (error) {
      console.error('Error loading chat data:', error);
      return null;
    }
  },

  loadChatHistory: async (chatId) => {
    const chatData = await chatService.loadChatData(chatId);
    return chatData ? chatData.messages : [];
  },

  createNewChat: async (dbName = null, chatConfig = { name: 'New Chat', temperature: 0.5, maxTokens: 1024, vender: 'openai' }) => {
    const newChatId = `chat-${Date.now()}`;
    const newChatData = {
      name: chatConfig.name || 'New Chat',
      systemMessage: chatConfig.systemMessage,
      messages: [],
      temperature: chatConfig.temperature || 0.5,
      maxTokens: chatConfig.maxTokens || 1024,
      maxHistoryLength: chatConfig.maxHistoryLength || 6,
      updatedAt: Date.now(),
      dbName: dbName,
      searchResultsLimit: chatConfig.searchResultsLimit || 6,
      preview: "",
      topic: ""
    };
    const chatFilePath = path.join(chatService.chatDir, `${newChatId}.json`);
    try {
      await fs.writeFile(chatFilePath, JSON.stringify(newChatData, null, 2));
      return chatService.formatChatData(newChatId, newChatData);
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  },

  updateChat: async (updatedChat) => {
    const existingChatData = await chatService.loadChatData(updatedChat.id);
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

    const chatFilePath = path.join(chatService.chatDir, `${updatedChat.id}.json`);
    try {
      await fs.writeFile(chatFilePath, JSON.stringify(updatedData, null, 2));
      return chatService.formatChatData(updatedChat.id, updatedData);
    } catch (error) {
      console.error('Error updating chat:', error);
      return null;
    }
  },

  deleteChat: async (chatId) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    try {
      await fs.unlink(chatFilePath);
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  },

  saveChatMessage: async (chatId, messages) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    const chatData = await chatService.loadChatData(chatId);

    if (chatData) {
      chatData.messages = messages;
      chatData.updatedAt = Date.now();
      try {
        await fs.writeFile(chatFilePath, JSON.stringify(chatData, null, 2));
      } catch (error) {
        console.error('Error saving chat message:', error);
      }
    }
  },

  saveChatName: async (chatId, name) => {
    const chatFilePath = path.join(chatService.chatDir, `${chatId}.json`);
    const chatData = await chatService.loadChatData(chatId);

    if (chatData) {
      chatData.name = name;
      try {
        await fs.writeFile(chatFilePath, JSON.stringify(chatData, null, 2));
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
      maxHistoryLength: chatData.maxHistoryLength,
      searchResultsLimit: chatData.searchResultsLimit,
      topic: chatData.topic
    };
  }
};

module.exports = chatService;
