const { ipcMain } = require('electron');
const chatService = require('../services/chatService');
const vectorDBService = require('../services/vectorDBService');
const llmService = require('../services/llmService');
const { handleIpcMainEvent } = require('../utils/ipcUtils');
const { generateQAPrompt, generateFollowUpPrompt, parseJsonResponse } = require('../utils/ragUtils');

ipcMain.handle('send-message', async (event, messages, chatId, context = [], queries = []) => {
  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const { systemMessage, temperature, maxTokens, topic, dbName } = chatData;

    let dbInfo = "";
    if (chatData.dbName){
      const dbDescription = await vectorDBService.getDatabaseDescriptionByName(chatData.dbName);
      dbInfo = `${dbName}(${dbDescription})`
    }

    const systemMessageToSend = generateQAPrompt(systemMessage, topic, context, queries, dbInfo);

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

ipcMain.handle('send-message-followup', async (event, messages, chatId, followupReason) => {
  return handleIpcMainEvent(event, async () => {
    const chatData = await chatService.loadChatData(chatId);
    if (!chatData) throw new Error(`Chat data not found for chatId: ${chatId}`);

    const { systemMessage, temperature, maxTokens, topic } = chatData;

    const systemMessageToSend = generateFollowUpPrompt(systemMessage, topic, followupReason);

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

    await llmService.sendMessage(messagesToSend, 0.7, 256, (content) => {
      assistantMessageContent += content;
    });
    
    console.log("Generate chat name: ", assistantMessageContent);

    await chatService.saveChatName(chatId, assistantMessageContent);
    return assistantMessageContent;
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
      console.error("Error fixing JSON:", e);
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
