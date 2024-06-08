const { ipcMain } = require('electron');
const chatService = require('../services/chatService');
const vectorDBService = require('../services/vectorDBService');
const llmService = require('../services/llmService');
const { handleIpcMainEvent } = require('../utils/ipcUtils');
const { parseTransformedQueries, generateAnalysisPrompt, generateTransformationPrompt, generateQAPrompt } = require('../utils/ragUtils');

ipcMain.handle('send-message', async (event, messages, chatId, context = [], context2 = []) => {
  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const { systemMessage, temperature, maxTokens, topic, dbName } = chatData;

    let dbInfo = "";
    if (chatData.dbName){    
      dbInfo = `${dbName}(${vectorDBService.getDatabaseDescriptionByName(chatData.dbName)})`
    }

    const systemMessageToSend = generateQAPrompt(systemMessage, topic, context, context2, dbInfo);

    const filteredMessages = messages.filter(message => message.role !== 'doc');
    const messagesToSend = [{ role: 'system', content: systemMessageToSend }, ...filteredMessages];
    let assistantMessageContent = '';

    // ストリーミングメッセージの完了を待つ
    await new Promise((resolve, reject) => {
      llmService.sendMessage(messagesToSend, parseFloat(temperature), parseInt(maxTokens, 10), (content) => {
        assistantMessageContent += content;
        event.sender.send('streaming-message', content);
      }).then(resolve).catch(reject);
    });

    const updatedMessages = [...messages, { role: 'assistant', content: assistantMessageContent }];
    event.sender.send('streaming-message-end');
    
    // 検索結果のドキュメントリンクを追加
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

      console.log("send doc-message");
      event.sender.send('doc-message', docMessage.results);
    }

    await chatService.saveChatMessage(chatId, updatedMessages);
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

    await llmService.sendMessage(messagesToSend, 0.7, 256, (content) => {
      assistantMessageContent += content;
    });
    
    console.log("Generate chat name: ", assistantMessageContent);

    await chatService.saveChatName(chatId, assistantMessageContent);
    return assistantMessageContent;
  });
});


ipcMain.handle('load-chats', async (event) => {
  return handleIpcMainEvent('load-chats', () => chatService.loadChats());
});

ipcMain.handle('load-chat-history', async (event, chatId) => {
  return handleIpcMainEvent('load-chat-history', () => chatService.loadChatHistory(chatId));
});

ipcMain.handle('create-new-chat', async (event, dbName, chatConfig) => {
  return handleIpcMainEvent('create-new-chat', () => chatService.createNewChat(dbName, chatConfig));
});

ipcMain.handle('update-chat', async (event, updatedChat) => {
  return handleIpcMainEvent('update-chat', () => chatService.updateChat(updatedChat));
});

ipcMain.handle('delete-chat', async (event, chatId) => {
  return handleIpcMainEvent('delete-chat', () => chatService.deleteChat(chatId));
});

ipcMain.handle('transform-query', async (event, chatId, chatHistory, analysis) => {
  return handleIpcMainEvent(event, async () => {

    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);
    
    let dbDescription = "";
    if (chatData.dbName){    
      dbDescription = vectorDBService.getDatabaseDescriptionByName(chatData.dbName)
    }
    // クエリ変換プロンプトを生成
    const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
    const prompt = generateTransformationPrompt(filteredChatHistory, chatData.topic, analysis, dbDescription);

    // クエリ変換実行
    let response = "";
    await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 500, (content) => {
      response += content;
    });

    console.log(`Raw response in query transformation:\n${response}`);

    // レスポンスをパース
    const transformedQueries = parseTransformedQueries(response.trim());
    return transformedQueries;
  });
});


ipcMain.handle('analysis-query', async (event, chatId, chatHistory) => {
  return handleIpcMainEvent(event, async () => {

    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);
    
    let dbDescription = "";
    if (chatData.dbName){    
      dbDescription = vectorDBService.getDatabaseDescriptionByName(chatData.dbName)
    }
    // クエリ分析プロンプトを生成
    const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
    const prompt = generateAnalysisPrompt(filteredChatHistory, chatData.topic, dbDescription);

    // console.log(prompt);

    // クエリ分析実行
    let response = "";
    await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 1024, (content) => {
      response += content;
    });

    console.log(`Raw response in query analyze:\n${response}`);

    return response.trim();
  });
});
