const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { generateDocTitle } = require('../docUtils');

const processDocxFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing DOCX file: ${filePath}`);
  const data = await mammoth.extractRawText({ path: filePath });

  if (!data) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const title = await generateDocTitle(data.value.slice(0, 350), docName)

  const docs = [new Document({
    pageContent: cleanAndNormalizeText(data.value),
    metadata: {
      title: title,
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

module.exports = { processDocxFile };
