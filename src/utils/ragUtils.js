const {
  generateAnalysisPrompt,
  determineInformationSufficientPrompt,
  generateTransformationPrompt,
} = require('./promptGenerators');
const llmService = require('../services/llmService');
const { parseJsonResponse } = require('./jsonUtils');

async function analysisQuery(chatHistory, chatData, dbDescription, signal) {

  // クエリ分析プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = generateAnalysisPrompt(filteredChatHistory, chatData.topic, dbDescription);

  // クエリ分析実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 1024, (content) => {
    response += content;
  }, signal);

  return response.trim();
}

async function determine(chatHistory, chatData, dbDescription, analysis, signal){

  // 検索判断プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = determineInformationSufficientPrompt(filteredChatHistory, chatData.topic, dbDescription, analysis);

  // 判断を実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.3, 500, (content) => {
    response += content;
  }, signal);

  // レスポンスをパース
  const determineResult = await parseJsonResponse(response.trim());
  return determineResult;
}

async function transformQuery(chatHistory, analysis, chatData, dbDescription, signal) {

  // クエリ変換プロンプトを生成
  const filteredChatHistory = chatHistory.filter(message => message.role !== 'doc');
  const prompt = generateTransformationPrompt(filteredChatHistory, chatData.topic, analysis, dbDescription);

  // クエリ変換実行
  let response = "";
  await llmService.sendMessage([{ role: 'user', content: prompt }], 0.7, 500, (content) => {
    response += content;
  }, signal);

  // レスポンスをパース
  const transformedQueries = await parseJsonResponse(response.trim());
  return transformedQueries;
}

module.exports = {
  analysisQuery,
  determine,
  transformQuery,
};
