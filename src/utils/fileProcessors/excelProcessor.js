const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');
const { Document } = require("@langchain/core/documents");
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const llmService = require('../../services/llmService')
const { parseJsonResponse } = require('../jsonUtils');

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const findFirstNonEmptyRow = (sheetData) => {
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i].some(cell => cell !== '')) {
      return i;
    }
  }
  return -1; // すべての行が空の場合
};

const isSheetLikelyTable = (sheetData) => {
  const firstNonEmptyRowIndex = findFirstNonEmptyRow(sheetData);
  if (firstNonEmptyRowIndex === -1 || sheetData.length - firstNonEmptyRowIndex < 2) return false;

  const sampleRows = sheetData.slice(firstNonEmptyRowIndex, Math.min(firstNonEmptyRowIndex + 10, sheetData.length));
  const nonEmptyCellCounts = sampleRows.map(row => row.filter(cell => cell !== '').length);
  const consistentRows = nonEmptyCellCounts.filter(count => count > sampleRows[0].length * 0.3);
  return consistentRows.length > sampleRows.length * 0.5;
};

const detectTableEndRow = (sheetData, dataStartRowIndex) => {
  const EMPTY_ROW_THRESHOLD = 3;
  let emptyRowCount = 0;
  
  for (let i = dataStartRowIndex; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (row.every(cell => cell === '')) {
      emptyRowCount++;
      if (emptyRowCount >= EMPTY_ROW_THRESHOLD) {
        return i - EMPTY_ROW_THRESHOLD + 1;
      }
    } else {
      emptyRowCount = 0;
    }
  }
  
  return sheetData.length;
};

const analyzeSheetStructure = async (sheetData, retryCount = 0) => {
  try {
    const firstNonEmptyRowIndex = findFirstNonEmptyRow(sheetData);
    if (firstNonEmptyRowIndex === -1) {
      return { isTable: false };
    }

    const sampleRows = sheetData.slice(firstNonEmptyRowIndex, Math.min(firstNonEmptyRowIndex + 10, sheetData.length));
    // console.log("Sample Rows:\n", JSON.stringify(sampleRows));
    const sampleContent = sampleRows.map((row, index) => 
      `Row ${firstNonEmptyRowIndex + index}: ${row.map((cell, colIndex) => `${String.fromCharCode(65 + colIndex)}:${cell}`).join('\t')}`
    ).join('\n');

    // console.log(sampleContent);

    const prompt = `The following is a sample of up to 10 rows from an Excel sheet, starting from the first non-empty row. Each row is prefixed with its actual row number in the sheet. Based on this data, please analyze the structure of the sheet.
Sheets may contain a mixture of tabular and non-tabular content.

Sample data:
${sampleContent}

Please analyze the following points and respond in JSON format:
1. Is this sheet primarily composed of tabular data?
2. If tabular, what is the most appropriate row number for the header?
3. What row number does the actual data start from?
4. Is there any descriptive text or title before the table?
5. If the header spans multiple rows, what is the range (start and end row numbers)?
6. What column is a reasonable end of the table? (Judgments are made based on the number and consistency of data relative to the header, the number of empty columns, etc. and provide column letters such as 'A', 'B', 'C', etc.)

Response format:
{
  "isTable": boolean,
  "bestHeaderRowIndex": number | null,
  "dataStartRowIndex": number | null,
  "hasPreTableContent": boolean,
  "multiRowHeaderRange": { "start": number | null, "end": number | null },
  "endColumnLetter": string | null
}

Notes:
- If the data is not tabular, set bestHeaderRowIndex, dataStartRowIndex, and endColumnLetter to null.
- If the header is a single row, multiRowHeaderRange.start and end should be the same.
- If there is no header, set multiRowHeaderRange.start and end to null.
- All row numbers should be the actual row numbers as shown in the sample data.
- Please respond only with the specified JSON format, without any additional information.`;

    const systemMessage = "You are an expert in analyzing Excel data structures. Please objectively analyze the given data and provide accurate information. Refer to the row numbers and column letters to give precise positional information.";
    const messagesToSend = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ];

    let assistantMessageContent = '';
    await llmService.sendMessage(messagesToSend, 0.7, 1024, (messageContent) => {
      assistantMessageContent += messageContent;
    });

    const result = parseJsonResponse(assistantMessageContent);
    
    // 結果の検証
    if (typeof result.isTable !== 'boolean' ||
        (result.isTable && (
          typeof result.bestHeaderRowIndex !== 'number' ||
          typeof result.dataStartRowIndex !== 'number' ||
          typeof result.endColumnLetter !== 'string' ||
          !/^[A-Z]$/.test(result.endColumnLetter)
        ))) {
      throw new Error('Invalid LLM response structure');
    }

    console.log("LLM Analysis Result:", assistantMessageContent);

    if (result.isTable) {
      // 終了列の文字を数値インデックスに変換
      result.endColumnIndex = result.endColumnLetter.charCodeAt(0) - 65 + 1;
      result.endRowIndex = detectTableEndRow(sheetData, result.dataStartRowIndex);
      result.firstNonEmptyRowIndex = firstNonEmptyRowIndex;
    }

    console.log("AnalyzeSheetStructure Result:", JSON.stringify(result));

    return result;
  } catch (error) {
    console.error(`Error in analyzeSheetStructure (attempt ${retryCount + 1}):`, error);
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying analysis in ${RETRY_DELAY}ms...`);
      await sleep(RETRY_DELAY);
      return analyzeSheetStructure(sheetData, retryCount + 1);
    } else {
      console.warn('Max retries reached. Falling back to non-table processing.');
      return { isTable: false };
    }
  }
};

const processExcelSheet = async (sheetName, sheetData, metadata) => {
  const docs = [];
  const likelyTable = isSheetLikelyTable(sheetData);

  let sheetStructure;
  if (likelyTable) {
    sheetStructure = await analyzeSheetStructure(sheetData);
  } else {
    sheetStructure = { isTable: false };
  }

  console.log(`Sheet "${sheetName}" structure:`, JSON.stringify(sheetStructure));

  if (sheetStructure && sheetStructure.isTable) {
    const { bestHeaderRowIndex, dataStartRowIndex, endRowIndex, endColumnIndex, hasPreTableContent, multiRowHeaderRange } = sheetStructure;

    // 表の前のコンテンツを処理
    if (hasPreTableContent && multiRowHeaderRange.start > 0) {
      const preTableContent = sheetData.slice(0, multiRowHeaderRange.start).map(row => row.join(' ')).join('\n');
      docs.push(new Document({
        pageContent: cleanAndNormalizeText(preTableContent),
        metadata: {
          ...metadata,
          title: `"${sheetName}" sheet`,
          contentType: 'pre-table',
        },
      }));
    }

    // 最適なヘッダー行を選択
    const headerRow = sheetData[bestHeaderRowIndex];

    // 表データの処理（終了行と列を考慮）
    sheetData.slice(dataStartRowIndex, endRowIndex).forEach((row, rowIndex) => {
      const content = row.slice(0, endColumnIndex).map((cell, cellIndex) => {
        const header = headerRow[cellIndex] || `Column ${cellIndex + 1}`;
        return `${header}: ${cell}`;
      }).join('\n');

      docs.push(new Document({
        pageContent: cleanAndNormalizeText(content),
        metadata: {
          ...metadata,
          title: `"${sheetName}" sheet`,
          rowIndex: dataStartRowIndex + rowIndex,
          contentType: 'table-row',
        },
      }));
    });
  } else {
    // 非表形式データの処理
    const content = sheetData.map(row => row.join(' ')).join('\n');
    docs.push(new Document({
      pageContent: cleanAndNormalizeText(content),
      metadata: {
        ...metadata,
        title: `"${sheetName}" sheet`,
        contentType: 'non-table',
      },
    }));
  }

  return docs;
};

const processExcelFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing Excel file: ${filePath}`);
  let workbook;
  try {
    workbook = xlsx.readFile(filePath);
  } catch (error) {
    console.error(`Error reading Excel file: ${filePath}`, error);
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }

  filePathToChunkIds[filePath] = [];

  const metadata = {
    source: filePath,
  };

  let allDocs = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const sheet = workbook.Sheets[sheetName];
      const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const sheetDocs = await processExcelSheet(sheetName, sheetData, metadata);
      allDocs = allDocs.concat(sheetDocs);
    } catch (error) {
      console.error(`Error processing sheet "${sheetName}":`, error);
      // シート処理のエラーをログに記録し、処理を継続
      allDocs.push(new Document({
        pageContent: `Error processing sheet "${sheetName}": ${error.message}`,
        metadata: {
          ...metadata,
          title: `"${sheetName}" sheet`,
          contentType: 'error',
        },
      }));
    }
  }

  // チャンキング戦略の適用
  let chunks = [];
  for (const doc of allDocs) {
    if (doc.metadata.contentType === 'table-row') {
      // 表の各行は個別のチャンクとして扱う
      chunks.push(doc);
    } else {
      // 非表形式データや表の前のコンテンツは通常のチャンキングを適用
      const docChunks = await splitDocuments([doc], chunkSize, overlapPercentage);
      chunks.push(...docChunks);
    }
  }

  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    filePathToChunkIds[filePath].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};


module.exports = { processExcelFile };
