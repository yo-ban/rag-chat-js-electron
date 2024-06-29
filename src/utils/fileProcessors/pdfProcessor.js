const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { generateDocTitle } = require('../docUtils');

const processPdfFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing PDF file: ${filePath}`);

  const loader = new PDFLoader(filePath);
  const texts = await loader.load();

  if (!texts || !texts[0]?.pageContent) return [];

  const docName = path.basename(filePath);

  const title = await generateDocTitle(texts[0].pageContent.slice(0, 350), docName)

  filePathToChunkIds[filePath] = [];

  const docs = texts.map((data) => {
    return new Document({
      pageContent: cleanAndNormalizeText(data.pageContent),
      metadata: {
        title: title,
        totalPages: data.metadata.pdf?.totalPages,
        pageNumber: data.metadata.loc?.pageNumber,
        source: filePath,
      },
    });
  });

  const chunks = await splitDocuments(docs, chunkSize, overlapPercentage);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

module.exports = { processPdfFile };
