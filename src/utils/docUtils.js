const fs = require('fs').promises;
const chardet = require('chardet');
const iconvLite = require('iconv-lite');
const llmService = require('../services/llmService')
const { parseJsonResponse } = require('./jsonUtils');

const readFileWithEncoding = async (filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    const encoding = chardet.detect(buffer);
    return iconvLite.decode(buffer, encoding);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
};

const generateDocTitle = async (content, docName = "") => {
  console.log("Generating document title via LLM");
  const systemMessageToSend = "You are an AI specialized in generating document titles.";
  const prompt = `Based on the following document content, extract a relevant title if it includes a clear and concise title-like string. If the document does not include a clear title, generate a suitable and relevant title that accurately represents the content. Ensure the title is in the same language as the provided content.

Provide the output in the following JSON format:
{
  "title": "short and clear document title"
}

The output should be the same language as the document content. Do not output anything other than the JSON object. Ensure the title is clear and concise.

Document content:
FileName: ${docName}
Content: ${content}`;

  const messagesToSend = [
    { role: 'system', content: systemMessageToSend },
    { role: 'user', content: prompt }
  ];

  let assistantMessageContent = '';

  try {

    await llmService.sendMessage(messagesToSend, 0.7, 256, (messageContent) => {
      assistantMessageContent += messageContent;
    });
    
    console.log(`Generated document title:\n${assistantMessageContent}`);

    const title = parseJsonResponse(assistantMessageContent);
    return title.title;

  } catch (e) {
    console.error("Error parsing JSON:", e);
    return "";
  }
}

module.exports = { 
  readFileWithEncoding, 
  generateDocTitle 
};
