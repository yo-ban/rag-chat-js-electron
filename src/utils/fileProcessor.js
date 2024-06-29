const path = require('path');
const fs = require('fs').promises;
const { languageMapping } = require('../constants/constants');
const { processTextFile } = require('./fileProcessors/textProcessor');
const { processCodeFile } = require('./fileProcessors/codeProcessor');
const { processPdfFile } = require('./fileProcessors/pdfProcessor');
const { processDocxFile } = require('./fileProcessors/docxProcessor');
const { processJsonFile } = require('./fileProcessors/jsonProcessor');
const { processCsvFile } = require('./fileProcessors/csvProcessor');
const { processHtmlFile } = require('./fileProcessors/htmlProcessor');
const { processExcelFile } = require('./fileProcessors/excelProcessor');

const fileProcessor = {
  getAllFiles: async (dirPath, extensions, fileList = [], depth = 0, maxDepth = 3) => {
    if (depth > maxDepth) return fileList;

    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        await fileProcessor.getAllFiles(filePath, extensions, fileList, depth + 1, maxDepth);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (extensions.includes(ext.slice(1))) {
          fileList.push(filePath);
        }
      }
    }

    return fileList;
  },
  processFile: async (filePath, filePathToChunkIds, chunkSize = 512, overlapPercentage = 25) => {
    const ext = path.extname(filePath).toLowerCase();
    const docName = path.basename(filePath);
    
    let chunks;
    if (languageMapping[ext]) {
      chunks = await processCodeFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
    } else {
      switch (ext) {
        case '.yaml':
        case '.yml':
        case '.txt':
        case '.md':
        case '.markdown':
          chunks = await processTextFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.pdf':
          chunks = await processPdfFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.docx':
          chunks = await processDocxFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.json':
          chunks = await processJsonFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.csv':
          chunks = await processCsvFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.html':
        case '.htm':
          chunks = await processHtmlFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.xlsx':
          chunks = await processExcelFile(filePath, filePathToChunkIds, chunkSize, overlapPercentage);
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    }
    
    return { chunks, docName };
  }
};

module.exports = fileProcessor;
