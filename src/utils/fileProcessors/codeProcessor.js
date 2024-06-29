const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocumentsByLanguage } = require('../documentSplitter');
const { readFileWithEncoding } = require('../docUtils');
const { languageMapping } = require('../../constants/constants');

const processCodeFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing code file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const ext = path.extname(filePath).toLowerCase();
  const language = languageMapping[ext];

  if (!language) {
    throw new Error(`Unsupported code file format: ${ext}`);
  }

  const docs = [new Document({
    pageContent: cleanAndNormalizeText(content),
    metadata: {
      title: docName,
      source: filePath,
      timestamp: new Date().toISOString(),
    },
  })];

  const chunks = await splitDocumentsByLanguage(docs, chunkSize, overlapPercentage, language);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for code file: ${filePath}`);
  return chunks;
};

module.exports = { processCodeFile };
