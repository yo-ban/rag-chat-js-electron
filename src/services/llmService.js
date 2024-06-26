const OpenAI = require('openai');
const { CohereClient } = require('cohere-ai');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { Anthropic } = require('@anthropic-ai/sdk');

const handleOpenAIStream = async (stream, onData) => {
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content !== undefined) {
      onData(content);
    }
  }
};

const handleAzureOpenAIStream = async (stream, onData) => {
  for await (const chunk of stream) {
    for (const choice of chunk.choices) {
      const content = choice.delta?.content;
      if (content !== undefined) {
        onData(content);
      }
    }
  }
};

const handleCohereStream = async (stream, onData) => {
  for await (const chat of stream) {
    if (chat.eventType === 'text-generation') {
      const content = chat.text || '';
      onData(content);
    }
  }
};

const handleClaudeStream = async (stream, onData) => {
  for await (const messageStreamEvent of stream) {
    if (messageStreamEvent.type === 'content_block_delta') {
      const content = messageStreamEvent.delta?.text || '';
      onData(content);
    }
  }
};

const convertMessagesForCohere = (messages) => {
  return messages.map((message) => {
    let role;
    if (message.role === 'user') {
      role = 'USER';
    } else if (message.role === 'assistant') {
      role = 'CHATBOT';
    } else {
      role = 'SYSTEM';
    }
    return { role, message: message.content };
  });
};

function convertMessagesForAnthropic(messages) {
  return messages.map(message => {
    if (message.role === 'system') {
      // システムメッセージは別途処理するため、ここでは null を返す
      return null;
    }

    // content が文字列の場合、オブジェクトの配列に変換
    const content = typeof message.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : message.content.map(item => {
          if (typeof item === 'string') {
            return { type: 'text', text: item };
          }
          // 既にオブジェクトの場合はそのまま返す
          return item;
        });

    return {
      role: message.role,
      content: content
    };
  }).filter(message => message !== null); // null（システムメッセージ）を除外
}

const llmService = {
  apiKey: "",
  vender: "openai",
  model: "",
  baseURL: "",
  deployment: "",

  initialize: (apiKey, vender = "openai", model = "", baseURL = "", deployment = "") => {
    llmService.apiKey = apiKey;
    llmService.vender = vender;
    llmService.model = model;
    llmService.baseURL = baseURL;
    llmService.deployment = deployment;
    console.log(`Change API Key in llmService: ${llmService.apiKey.slice(0, 10) + "..."}`);
    console.log(`Change Vender in llmService: ${llmService.vender}`);
  },

  sendMessage: async (messages, temperature, maxTokens, onData, signal) => {
    console.log(llmService.vender);
    if (llmService.vender === 'openai' || !llmService.vender) {

      const openaiClient = new OpenAI({
        apiKey: llmService.apiKey,
        baseURL: llmService.baseURL ? llmService.baseURL : undefined
      });

      const stream = await openaiClient.chat.completions.create(
        {
          model: llmService.model ? llmService.model : 'gpt-4o',
          messages: messages,
          stream: true,
          temperature: temperature, 
          max_tokens: maxTokens
        },
        {
          signal: signal
        }
      );
      await handleOpenAIStream(stream, onData);
    } else if (llmService.vender === 'azure') {

      const azureClient = new OpenAIClient(
        llmService.baseURL, 
        new AzureKeyCredential(llmService.apiKey)
      );
      
      const stream = await azureClient.streamChatCompletions(
        llmService.deployment, 
        messages, 
        { 
          maxTokens: maxTokens,
          temperature: temperature,
          abortSignal: signal
        }
      );
      await handleAzureOpenAIStream(stream, onData);
    } else if (llmService.vender === 'cohere') {

      const cohereClient = new CohereClient({
        token: llmService.apiKey
      });

      const cohereMessages = convertMessagesForCohere(messages);
      const userMessage = cohereMessages.pop();
      const stream = await cohereClient.chatStream(
        {
          model: llmService.model ? llmService.model : 'c4ai-aya-23',
          message: userMessage.message,
          temperature: temperature,
          chatHistory: cohereMessages,
          promptTruncation: 'AUTO',
        },
        {
          abortSignal: signal
        }
      );
      await handleCohereStream(stream, onData);
    } else if (llmService.vender === 'anthropic') {
      const anthropicClient = new Anthropic({
        apiKey: llmService.apiKey,
      });

      // システムメッセージを抽出
      const systemMessage = messages.find(msg => msg.role === 'system');
      
      // Anthropic用にメッセージを変換
      const convertedMessages = convertMessagesForAnthropic(messages);
      
      const stream = await anthropicClient.messages.create(
        {
          messages: convertedMessages,
          model: llmService.model || 'claude-3-5-sonnet-20240620',
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemMessage ? systemMessage.content : "", 
          stream: true,
        },
        { 
          signal: signal 
        }
      );

      await handleClaudeStream(stream, onData);
    } else {
      throw new Error(`Unsupported model: ${llmService.vender}`);
    }
  }
};

module.exports = llmService;
