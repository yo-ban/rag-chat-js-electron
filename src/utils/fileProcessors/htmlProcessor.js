const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { readFileWithEncoding, generateDocTitle, convertHtmlToPdfBuffer, extractTextFromPdfBuffer } = require('../docUtils');

const processHtmlFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing HTML file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  // HTMLをPDFバッファに変換
  const pdfBuffer = await convertHtmlToPdfBuffer(content);

  // PDFバッファからテキストを抽出
  const extractedText = await extractTextFromPdfBuffer(pdfBuffer);
  
  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const title = await generateDocTitle(extractedText.slice(0, 350), docName)

  const docs = [new Document({
    pageContent: cleanAndNormalizeText(extractedText),
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

module.exports = { processHtmlFile };
