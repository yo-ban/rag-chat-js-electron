const { v4: uuidv4 } = require('uuid');
const { parse: csvParse } = require('csv-parse/sync');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { readFileWithEncoding } = require('../docUtils');

const processCsvFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing CSV file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true
  });

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const docs = records.map((record, index) => {
    const formattedContent = Object.entries(record).map(([key, value]) => `${key}: ${value}`).join('\n');
    const doc = new Document({
      pageContent: cleanAndNormalizeText(formattedContent),
      metadata: {
        title: docName,
        source: filePath,
        timestamp: new Date().toISOString(),
        rowIndex: index + 1,
      },
    });

    const chunkId = uuidv4();
    doc.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);

    return doc;
  });

  console.log(`Processed ${docs.length} documents for file: ${filePath}`);
  return docs;
};

module.exports = { processCsvFile };
