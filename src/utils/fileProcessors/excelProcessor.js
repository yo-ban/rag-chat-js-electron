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

const isSheetLikelyTable = (sheetData) => {
  if (sheetData.length < 2) return false;

  const sampleRows = sheetData.slice(0, Math.min(10, sheetData.length));
  const nonEmptyCellCounts = sampleRows.map(row => row.filter(cell => cell !== '').length);
  const consistentRows = nonEmptyCellCounts.filter(count => count > sampleRows[0].length * 0.3);
  return consistentRows.length > sampleRows.length * 0.5;
};

const analyzeSheetStructure = async (sheetData, retryCount = 0) => {
  try {
    const sampleRows = sheetData.slice(0, Math.min(10, sheetData.length));
    const sampleContent = sampleRows.map((row, index) => 
      `Row ${index}: ${row.join('\t')}`
    ).join('\n');

    console.log(sampleContent);

    const prompt = `以下はExcelシートの最初の10行（または全行）のサンプルデータです。各行には行番号が付いています。このデータに基づいて、シートの構造を分析してください。

サンプルデータ:
${sampleContent}

以下の点について分析し、JSON形式で回答してください：
1. このシートは主に表形式のデータで構成されているか
2. 表形式の場合、最も適切なヘッダー行の位置（行番号）
3. データ行の開始位置（行番号）
4. 表の前に説明文やタイトルなどが存在するか
5. ヘッダーが複数行にわたる場合、その範囲（開始行と終了行の行番号）

回答の形式：
{
  "isTable": boolean,
  "bestHeaderRowIndex": number | null,
  "dataStartRowIndex": number | null,
  "hasPreTableContent": boolean,
  "multiRowHeaderRange": { "start": number | null, "end": number | null }
}

注意：
- データが表形式でない場合、bestHeaderRowIndexとdataStartRowIndexはnullとしてください。
- ヘッダーが1行の場合、multiRowHeaderRangeのstartとendは同じ値になります。
- ヘッダーが存在しない場合、multiRowHeaderRangeのstartとendはnullとしてください。
- すべての行番号は、データの先頭を0とする数値で回答してください。
- 指定されたJSON形式のみで回答し、他の情報を記載しないでください。`;

    const systemMessage = "あなたはExcelデータの構造を分析する専門家です。与えられたデータを客観的に分析し、正確な情報を提供してください。行番号を参照して、正確な位置情報を回答してください。";
    const messagesToSend = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ];

    let assistantMessageContent = '';
    await llmService.sendMessage(messagesToSend, 0.7, 1024, (messageContent) => {
      assistantMessageContent += messageContent;
    });

    console.log("LLM Analysis Result:", assistantMessageContent);

    const result = parseJsonResponse(assistantMessageContent);
    
    // 結果の検証
    if (typeof result.isTable !== 'boolean' ||
        (result.isTable && (typeof result.bestHeaderRowIndex !== 'number' || typeof result.dataStartRowIndex !== 'number'))) {
      throw new Error('Invalid LLM response structure');
    }

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

  console.log(`Sheet "${sheetName}" structure:`, sheetStructure);

  if (sheetStructure && sheetStructure.isTable) {
    const { bestHeaderRowIndex, dataStartRowIndex, hasPreTableContent, multiRowHeaderRange } = sheetStructure;

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

    // 表データの処理
    sheetData.slice(dataStartRowIndex).forEach((row, rowIndex) => {
      const content = row.map((cell, cellIndex) => {
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
