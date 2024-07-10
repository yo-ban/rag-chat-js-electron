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

// マージされたセルを展開
const expandMergedCells = (sheetData, merges) => {
  const expandedData = sheetData.map(row => [...row]);
  
  merges.forEach(merge => {
    const { s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } } = merge;
    const value = expandedData[startRow][startCol];
    
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        expandedData[r][c] = value;
      }
    }
  });
  
  return expandedData;
};

// 最初の非空行を見つける
const findFirstNonEmptyRow = (sheetData) => {
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i].some(cell => cell !== '')) {
      return i;
    }
  }
  return -1; // すべての行が空の場合
};

const trimEmptyRowsFromEnd = (sheetData) => {
  let lastNonEmptyRowIndex = sheetData.length - 1;

  // 最後の非空行を見つける
  while (lastNonEmptyRowIndex >= 0 && sheetData[lastNonEmptyRowIndex].every(cell => cell === '')) {
    lastNonEmptyRowIndex--;
  }

  // 最後の非空行までのデータを返す
  return sheetData.slice(0, lastNonEmptyRowIndex + 1);
};

const isSheetLikelyTable = (sheetData) => {
  // 最初の非空行を見つける
  const firstNonEmptyRowIndex = findFirstNonEmptyRow(sheetData);
  if (firstNonEmptyRowIndex === -1 || sheetData.length - firstNonEmptyRowIndex < 2) return false;

  // 分析対象の行数を定義（最大20行）
  const maxSampleRows = 20;
  const sampleRows = sheetData.slice(firstNonEmptyRowIndex, Math.min(firstNonEmptyRowIndex + maxSampleRows, sheetData.length));

  // 各行の非空セルの数をカウント
  const nonEmptyCellCounts = sampleRows.map(row => row.filter(cell => cell.toString().trim() !== '').length);

  // 最大の非空セル数を持つ行を特定（潜在的なヘッダー行）
  const maxNonEmptyCells = Math.max(...nonEmptyCellCounts);

  // 最小列数の閾値を設定（例：2列以上）
  const minColumnThreshold = 2;
  if (maxNonEmptyCells < minColumnThreshold) {
    console.log(`Not considered a table: max non-empty cells (${maxNonEmptyCells}) is less than the minimum threshold (${minColumnThreshold})`);
    return false;
  }

  const potentialHeaderRowIndex = nonEmptyCellCounts.indexOf(maxNonEmptyCells);

  // 潜在的なヘッダー行の後の行を分析
  const dataRows = sampleRows.slice(potentialHeaderRowIndex + 1);
  const dataRowCounts = nonEmptyCellCounts.slice(potentialHeaderRowIndex + 1);

  // データ行の一貫性をチェック
  const consistencyThreshold = 0.3; // 30%以上のセルが埋まっていれば一貫していると判断
  const consistentRows = dataRowCounts.filter(count => count >= maxNonEmptyCells * consistencyThreshold);

  // テーブルと判断する条件
  const tableThreshold = 0.5; // 50%以上の行が一貫していればテーブルと判断
  const isTable = consistentRows.length >= dataRows.length * tableThreshold;

  console.log(`Table detection result: ${isTable ? 'Is a table' : 'Not a table'}. Consistent rows: ${consistentRows.length}/${dataRows.length}, Max non-empty cells: ${maxNonEmptyCells}`);

  return isTable;
};

const detectTableEndColumn = (expandedSheetData, startRow, endRow) => {
  const columnCounts = [];
  const totalRows = endRow - startRow + 1;
  const minThreshold = Math.max(3, Math.ceil(totalRows * 0.1)); // 最小3行または10%以上

  for (let i = startRow; i <= endRow; i++) {
    let lastNonEmptyColumn = -1;
    for (let j = expandedSheetData[i].length - 1; j >= 0; j--) {
      if (expandedSheetData[i][j] !== '') {
        lastNonEmptyColumn = j;
        break;
      }
    }
    if (lastNonEmptyColumn !== -1) {
      for (let k = 0; k <= lastNonEmptyColumn; k++) {
        columnCounts[k] = (columnCounts[k] || 0) + 1;
      }
    }
  }

  // 列の使用頻度に基づいて終了列を決定
  let endColumn = 0;
  for (let i = columnCounts.length - 1; i >= 0; i--) {
    if ((columnCounts[i] || 0) >= minThreshold) {
      endColumn = i;
      break;
    }
  }

  // ヘッダー行の考慮
  const headerRow = expandedSheetData[startRow];
  const headerEndColumn = headerRow.reduce((max, cell, index) => 
    cell !== '' ? index : max, 0);
  
  return Math.max(endColumn, headerEndColumn);
};

const validateEndColumn = (expandedSheetData, startRow, endRow, llmEndColumnIndex, bestHeaderRowIndex) => {
  const totalRows = endRow - startRow + 1;
  const minThreshold = Math.max(3, Math.ceil(totalRows * 0.1)); // 最小3行または10%以上
  const columnCounts = [];

  console.log("Fill Rate Threshold: ", minThreshold);

  // データの充足率を計算
  for (let i = startRow; i <= endRow; i++) {
    for (let j = 0; j <= llmEndColumnIndex; j++) {
      if (expandedSheetData[i][j] !== '') {
        columnCounts[j] = (columnCounts[j] || 0) + 1;
      }
    }
  }

  const isFillRateAboveThreshold = (columnIndex) => (columnCounts[columnIndex] || 0) >= minThreshold;

  // LLMが判定した終了列から左に向かってチェック
  for (let i = llmEndColumnIndex; i >= 0; i--) {
    const hasValidHeader = expandedSheetData[bestHeaderRowIndex][i] !== '';
    const leftColumnHasValidHeader = i > 0 && expandedSheetData[bestHeaderRowIndex][i - 1] !== '';

    if (isFillRateAboveThreshold(i)) {
      // 現在の列の充足率が閾値以上なら採用
      return i;
    } else if (hasValidHeader && leftColumnHasValidHeader) { //  && isFillRateAboveThreshold(i - 1) 、かつ充足率が閾値を超えている場合
      // 現在の列のヘッダーが有効で、左隣の列も有効なヘッダーがあるなら採用
      return i;
    }
  }

  // 妥当な列が見つからない場合、より広範囲で再検索
  return detectTableEndColumn(expandedSheetData, startRow, endRow);
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

// 表以外のデータ処理
const processNonTableContent = (sheetData, tableRange, multiRowHeaderRange) => {
  const { startRow, endRow, startCol, endCol } = tableRange;
  const nonTableContent = [];

  // テーブルの前のコンテンツ
  if (multiRowHeaderRange && multiRowHeaderRange.start > 0) {
    const beforeTable = sheetData.slice(0, multiRowHeaderRange.start).map(row => row.join(' ')).join('\n');
    if (beforeTable.trim() !== '') {
      nonTableContent.push({ content: beforeTable, position: 'before' });
    }
  } else if (startRow > 0) {
    const beforeTable = sheetData.slice(0, startRow).map(row => row.join(' ')).join('\n');
    if (beforeTable.trim() !== '') {
      nonTableContent.push({ content: beforeTable, position: 'before' });
    }
  }

  // テーブルの後のコンテンツ
  if (endRow < sheetData.length - 1) {
    const afterTable = sheetData.slice(endRow + 1).map(row => row.join(' ')).join('\n');
    if (afterTable.trim() !== '') {
      nonTableContent.push({ content: afterTable, position: 'after' });
    }
  }

  // テーブルの左側のコンテンツ
  if (startCol > 0) {
    const leftOfTable = sheetData.slice(startRow, endRow + 1).map(row => row.slice(0, startCol).join(' ')).join('\n');
    if (leftOfTable.trim() !== '') {
      nonTableContent.push({ content: leftOfTable, position: 'left' });
    }
  }

  // テーブルの右側のコンテンツ
  if (endCol < sheetData[0].length - 1) {
    const rightOfTable = sheetData.slice(startRow, endRow + 1).map(row => row.slice(endCol + 1).join(' ')).join('\n');
    if (rightOfTable.trim() !== '') {
      nonTableContent.push({ content: rightOfTable, position: 'right' });
    }
  }

  return nonTableContent;
};

const getColumnIndex = (columnName) => {
  let index = 0;
  for (let i = 0; i < columnName.length; i++) {
    index = index * 26 + columnName.charCodeAt(i) - 64;
  }
  return index - 1; // 0-based index
};

const getColumnName = (index) => {
  let columnName = '';
  let num = index;
  while (num >= 0) {
    columnName = String.fromCharCode(65 + (num % 26)) + columnName;
    num = Math.floor(num / 26) - 1;
  }
  return columnName;
};

const analyzeSheetStructure = async (expandedSheetData, retryCount = 0) => {
  try {
    const firstNonEmptyRowIndex = findFirstNonEmptyRow(expandedSheetData);
    if (firstNonEmptyRowIndex === -1) {
      return { isTable: false };
    }

    const sampleRows = expandedSheetData.slice(firstNonEmptyRowIndex, Math.min(firstNonEmptyRowIndex + 10, expandedSheetData.length));
    const sampleContent = sampleRows.map((row, index) => 
      `Row ${firstNonEmptyRowIndex + index}: ${row.map((cell, colIndex) => `${getColumnName(colIndex)}:${cell}`).join('\t')}`
    ).join('\n');

    const prompt = `The following is a sample of up to 10 rows from an Excel sheet, starting from the first non-empty row. Each row is prefixed with its actual row number in the sheet. Based on this data, please analyze the structure of the sheet.
Sheets may contain a mixture of tabular and non-tabular content.

Sample data:
${sampleContent}

Please analyze the following points and respond in JSON format:
1. Is this sheet primarily composed of tabular data?
2. What is the most appropriate row number for the header?
3. What row number does the actual data start from?
4. If the header spans multiple rows, what is the range (start and end row numbers)?
5. What column letter does the table start from? (Consider the leftmost column with consistent data or headers)
6. What column letter is a reasonable end of the table?

For determining the start and end columns:
- Look for consistent data patterns or header structures.
- Consider columns with a high percentage of non-empty cells.
- The start column should be the leftmost column that is part of the table structure.
- The end column should be the rightmost column that contains relevant data, ignoring sporadic or inconsistent data in far-right columns.
- Pay attention to changes in data types or formatting that might indicate the table's boundaries.

Response format:
{
  "isTable": boolean,
  "bestHeaderRowIndex": number | null,
  "dataStartRowIndex": number | null,
  "multiRowHeaderRange": { "start": number | null, "end": number | null },
  "startColumnLetter": string | null,
  "endColumnLetter": string | null
}

Notes:
- If the data is not tabular, set bestHeaderRowIndex, dataStartRowIndex, startColumnLetter, and endColumnLetter to null.
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
    await llmService.sendMessage(messagesToSend, 0.3, 1024, (messageContent) => {
      assistantMessageContent += messageContent;
    });

    const result = await parseJsonResponse(assistantMessageContent);
    
    // 結果の検証と後処理
    if (typeof result.isTable !== 'boolean' ||
        (result.isTable && (
          typeof result.bestHeaderRowIndex !== 'number' ||
          typeof result.dataStartRowIndex !== 'number' ||
          typeof result.startColumnLetter !== 'string' ||
          typeof result.endColumnLetter !== 'string' ||
          !/^[A-Z]+$/.test(result.startColumnLetter) ||
          !/^[A-Z]+$/.test(result.endColumnLetter)
        ))) {
      throw new Error('Invalid LLM response structure');
    }

    console.log("LLM Analysis Result:", assistantMessageContent);

    if (result.isTable) {
      result.endRowIndex = Math.min(detectTableEndRow(expandedSheetData, result.dataStartRowIndex), expandedSheetData.length - 1);
      result.firstNonEmptyRowIndex = firstNonEmptyRowIndex;

      // 終了列の文字を数値インデックスに変換
      result.startColumnIndex = getColumnIndex(result.startColumnLetter);
      
      // LLMが判定した終了列の妥当性をチェック
      const llmEndColumnIndex = getColumnIndex(result.endColumnLetter);
      const validatedEndColumnIndex = validateEndColumn(
        expandedSheetData,
        result.dataStartRowIndex,
        result.endRowIndex,
        llmEndColumnIndex,
        result.bestHeaderRowIndex
      );

      result.endColumnIndex = validatedEndColumnIndex;
      result.endColumnLetter = getColumnName(validatedEndColumnIndex);
    }
    
    console.log("AnalyzeSheetStructure Result:", JSON.stringify(result));

    return result;
  } catch (error) {
    console.error(`Error in analyzeSheetStructure (attempt ${retryCount + 1}):`, error);
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying analysis in ${RETRY_DELAY}ms...`);
      await sleep(RETRY_DELAY);
      return analyzeSheetStructure(expandedSheetData, retryCount + 1);
    } else {
      console.warn('Max retries reached. Falling back to non-table processing.');
      return { isTable: false };
    }
  }
};

const processExcelSheet = async (sheetName, sheet, metadata) => {
  console.log(`Process "${sheetName}" sheet`);
  const docs = [];
  const loadedSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const sheetData = trimEmptyRowsFromEnd(loadedSheetData);
  const likelyTable = isSheetLikelyTable(sheetData);

  const merges = sheet['!merges'] || [];
  const expandedSheetData = expandMergedCells(sheetData, merges);
  

  let sheetStructure;
  if (likelyTable) {
    sheetStructure = await analyzeSheetStructure(expandedSheetData);
  } else {
    sheetStructure = { isTable: false };
  }

  console.log(`Sheet "${sheetName}" structure:`, JSON.stringify(sheetStructure));

  if (sheetStructure && sheetStructure.isTable) {
    const { bestHeaderRowIndex, dataStartRowIndex, endRowIndex, startColumnIndex, endColumnIndex, multiRowHeaderRange } = sheetStructure;

    // テーブル範囲外のコンテンツを処理
    const tableRange = {
      startRow: bestHeaderRowIndex,
      endRow: endRowIndex,
      startCol: startColumnIndex,
      endCol: endColumnIndex
    };
    const nonTableContent = processNonTableContent(sheetData, tableRange, multiRowHeaderRange);

    // 非テーブルコンテンツをドキュメントに追加
    nonTableContent.forEach(item => {
      docs.push(new Document({
        pageContent: cleanAndNormalizeText(item.content),
        metadata: {
          ...metadata,
          title: `"${sheetName}" sheet`,
          contentType: `non-table-${item.position}`,
        },
      }));
    });

    // 最適なヘッダー行を選択
    const headerRow = expandedSheetData[bestHeaderRowIndex].slice(startColumnIndex, endColumnIndex + 1);

    // 表データの処理（終了行と列を考慮）
    expandedSheetData.slice(dataStartRowIndex, endRowIndex + 1).forEach((row, rowIndex) => {
      const content = row.slice(startColumnIndex, endColumnIndex + 1).map((cell, cellIndex) => {
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

    console.log(`Processed table data from column ${getColumnName(startColumnIndex)} to ${getColumnName(endColumnIndex)}`);
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
      const sheetDocs = await processExcelSheet(sheetName, sheet, metadata);
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
