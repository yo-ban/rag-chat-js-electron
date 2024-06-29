const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { readFileWithEncoding } = require('../docUtils');

const processJsonFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing JSON file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  const jsonObject = JSON.parse(content);

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const jsonString = JSON.stringify(jsonObject, null, 2);
  const docs = [new Document({
    pageContent: cleanAndNormalizeText(jsonString),
    metadata: {
      title: docName,
      source: filePath,
      timestamp: new Date().toISOString(),
    },
  })];

  const chunks = await splitDocuments(docs, chunkSize, overlapPercentage);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

module.exports = { processJsonFile };
