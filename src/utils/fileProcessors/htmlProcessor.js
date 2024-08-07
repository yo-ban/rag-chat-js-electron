const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const pdfjsLib = require('pdfjs-dist');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { readFileWithEncoding, generateDocTitle } = require('../docUtils');

// ワーカーファイルのパスを設定
const workerSrc = './pdf.worker.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const convertHtmlToPdfBuffer = async (htmlContent) => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  return pdfBuffer;
};

const extractTextFromPdfBuffer = async (pdfBuffer) => {
  const loadingTask = pdfjsLib.getDocument(pdfBuffer);
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

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

  const title = await generateDocTitle(extractedText.slice(0, 350), docName);

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
