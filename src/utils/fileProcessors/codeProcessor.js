const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments, splitDocumentsByLanguage, splitMarkdownByHeadings } = require('../documentSplitter');
const { readFileWithEncoding, generateDocTitle } = require('../docUtils');
const { languageMapping } = require('../../constants/constants');

const processCodeFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing code file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.ipynb') {
    return await processJupyterNotebook(filePath, content, filePathToChunkIds, chunkSize, overlapPercentage);
  }

  let language = languageMapping[ext];

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

const processJupyterNotebook = async (filePath, content, filePathToChunkIds, chunkSize, overlapPercentage) => {
  const notebook = JSON.parse(content);
  const cells = notebook.cells;
  let markdownContent = '';

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cellContent = cell.source.join('');

    if (cell.cell_type === 'markdown') {
      markdownContent += cellContent + '\n\n';
    } else if (cell.cell_type === 'code') {
      markdownContent += `\`\`\`python\n${cellContent}\n\`\`\`\n\n`;
    }
  }

  const docName = path.basename(filePath);
  const title = await generateDocTitle(markdownContent.slice(0, 350), docName)

  const sections = splitMarkdownByHeadings(markdownContent);
  docs = sections.map((section, index) => new Document({
    pageContent: cleanAndNormalizeText(section),
    metadata: {
      title: title,
      source: filePath,
      timestamp: new Date().toISOString(),
      sectionIndex: index + 1,
    },
  }));

  const chunks = await splitDocuments(docs, chunkSize, overlapPercentage);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for Jupyter Notebook: ${filePath}`);
  return chunks;
};

module.exports = { processCodeFile };
