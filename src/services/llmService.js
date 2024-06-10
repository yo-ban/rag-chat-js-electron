const OpenAI = require('openai');
const { CohereClient } = require('cohere-ai');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

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

  sendMessage: async (messages, temperature, maxTokens, onData) => {
    console.log(llmService.vender);
    if (llmService.vender === 'openai' || !llmService.vender) {

      const openaiClient = new OpenAI({
        apiKey: llmService.apiKey,
        baseURL: llmService.baseURL ? llmService.baseURL : undefined
      });

      const stream = await openaiClient.chat.completions.create({
        model: llmService.model ? llmService.model : 'gpt-4o',
        messages: messages,
        stream: true,
        temperature: temperature, 
        max_tokens: maxTokens
      });
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
          temperature: temperature
        }
      );
      await handleAzureOpenAIStream(stream, onData);
    } else if (llmService.vender === 'cohere') {

      const cohereClient = new CohereClient({
        token: llmService.apiKey
      });

      const cohereMessages = convertMessagesForCohere(messages);
      const userMessage = cohereMessages.pop();
      const stream = await cohereClient.chatStream({
        model: llmService.model ? llmService.model : 'c4ai-aya-23',
        message: userMessage.message,
        temperature: temperature,
        chatHistory: cohereMessages,
        promptTruncation: 'AUTO',
      });
      await handleCohereStream(stream, onData);
    } else {
      throw new Error(`Unsupported model: ${llmService.vender}`);
    }
  }
};

module.exports = llmService;
