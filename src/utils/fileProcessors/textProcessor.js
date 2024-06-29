const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments, splitMarkdownByHeadings } = require('../documentSplitter');
const { readFileWithEncoding, generateDocTitle } = require('../docUtils');

const processTextFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing text file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const title = await generateDocTitle(content.slice(0, 350), docName)

  let docs = [];

  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
    const sections = splitMarkdownByHeadings(content);
    docs = sections.map((section, index) => new Document({
      pageContent: cleanAndNormalizeText(section),
      metadata: {
        title: title,
        source: filePath,
        timestamp: new Date().toISOString(),
        sectionIndex: index + 1,
      },
    }));
  } else {
    docs = [new Document({
      pageContent: cleanAndNormalizeText(content),
      metadata: {
        title: title,
        source: filePath,
        timestamp: new Date().toISOString(),
      },
    })];
  }

  const chunks = await splitDocuments(docs, chunkSize, overlapPercentage);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

module.exports = { processTextFile };
