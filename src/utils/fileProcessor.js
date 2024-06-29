const path = require('path');
const fs = require('fs').promises;
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { Document } = require("@langchain/core/documents");
const { v4: uuidv4 } = require('uuid');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf')
const mammoth = require('mammoth');
const chardet = require('chardet');
const iconvLite = require('iconv-lite');
const { parse: csvParse } = require('csv-parse/sync');
const xlsx = require('xlsx');
const puppeteer = require('puppeteer');
const pdfParse = require('pdf-parse');
const { parseJsonResponse } = require('./ragUtils')
const llmService = require('../services/llmService')
const { countTokens } = require('./tokenizerUtils');

const languageMapping = {
  '.cpp': 'cpp',
  '.go': 'go',
  '.java': 'java',
  '.js': 'js',
  '.php': 'php',
  '.proto': 'proto',
  '.py': 'python',
  '.rst': 'rst',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scala': 'scala',
  '.swift': 'swift',
  '.tex': 'latex',
};

const cleanAndNormalizeText = (text) => {
  if (typeof text !== 'string') {
    console.warn(`Unexpected non-string input in cleanAndNormalizeText: ${typeof text}`);
    text = String(text);
  }

  let cleanedText = text.trim();

  cleanedText = cleanedText.normalize('NFKC'); // Unicode正規化
  cleanedText = cleanedText.replace(/\r/g, ''); // キャリッジリターンを削除
  cleanedText = cleanedText.replace(/\t/g, ' '); // タブをスペースに置換
  cleanedText = cleanedText.toLowerCase() // 小文字に変換

  // 制御文字（非印字文字）を削除（改行は保持）
  cleanedText = cleanedText.replace(/[^\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF\n\t]/g, '');

  // ゼロ幅スペース、ゼロ幅ノーブレークスペース、その他の特殊文字
  cleanedText = cleanedText.replace(/[\u200B\uFEFF]/g, '');

  // 複数の連続する改行を2つの改行に縮小
  cleanedText = cleanedText.replace(/\n{2,}/g, '\n\n');
  
  return cleanedText;
};

const splitDocuments = async (docs, chunkSize, overlapPercentage) => {
  const chunkOverlap = Math.floor(chunkSize * (overlapPercentage / 100));
  
  const splitter = new RecursiveCharacterTextSplitter({
    lengthFunction: countTokens,
    separators: ["\n\n", "\n", "。"],
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,    
  })

  return await splitter.splitDocuments(docs);
};

const splitDocumentsByLanguage = async (docs, chunkSize, overlapPercentage, language) => {
  console.log(`splitDocumentsByLanguage: ${language}`);
  const chunkOverlap = Math.floor(chunkSize * (overlapPercentage / 100));

  const splitter = RecursiveCharacterTextSplitter.fromLanguage(language, {
    lengthFunction: countTokens,
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
  });

  return await splitter.splitDocuments(docs);
};

const readFileWithEncoding = async (filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    const encoding = chardet.detect(buffer);
    return iconvLite.decode(buffer, encoding);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
};

const splitMarkdownByHeadings = (markdown) => {
  const sections = markdown.split(/(?=^# )/gm);
  return sections.map(section => section.trim()).filter(section => section.length > 0);
};


const generateDocTitle = async (content) => {
  console.log("Generating document title via LLM");
  const systemMessageToSend = "You are an AI specialized in generating document titles.";
  const prompt = `Based on the following document content, extract a relevant title if it includes a clear and concise title-like string. If the document does not include a clear title, generate a suitable and relevant title that accurately represents the content. Ensure the title is in the same language as the provided content.

Provide the output in the following JSON format:
{
  "title": "short and clear document title"
}

The output should be the same language as the document content. Do not output anything other than the JSON object. Ensure the title is clear and concise.

Document content:
${content}`;

  const messagesToSend = [
    { role: 'system', content: systemMessageToSend },
    { role: 'user', content: prompt }
  ];

  let assistantMessageContent = '';

  try {

    await llmService.sendMessage(messagesToSend, 0.7, 256, (messageContent) => {
      assistantMessageContent += messageContent;
    });
    
    console.log(`Generated document title:\n${assistantMessageContent}`);

    const title = parseJsonResponse(assistantMessageContent);
    return title.title;

  } catch (e) {
    console.error("Error parsing JSON:", e);
    return "";
  }
}

const processTextFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing text file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const title = await generateDocTitle(content.slice(0, 350))

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

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

const processCodeFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing code file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const ext = path.extname(filePath).toLowerCase();
  const language = languageMapping[ext];
  
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

const processPdfFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing PDF file: ${filePath}`);

  const loader = new PDFLoader(filePath);
  const texts = await loader.load();

  if (!texts || !texts[0]?.pageContent ) return [];

  const title = await generateDocTitle(texts[0].pageContent.slice(0, 350))

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

const processDocxFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing DOCX file: ${filePath}`);
  const data = await mammoth.extractRawText({ path: filePath });

  if (!data ) return [];

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const title = await generateDocTitle(data.value.slice(0, 350))

  const docs = [new Document({
    pageContent: cleanAndNormalizeText(data.value),
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

const processJsonFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing JSON file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  const jsonObject = JSON.parse(content);

  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

  const jsonString = JSON.stringify(jsonObject, null, 2);
  const docs = [new Document({
    pageContent: cleanAndNormalizeText(jsonString),
    metadata: {
      title: docName,
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

const convertHtmlToPdfBuffer = async (htmlContent) => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  return pdfBuffer;
};

const extractTextFromPdfBuffer = async (pdfBuffer) => {
  const data = await pdfParse(pdfBuffer);
  return data.text;
};

const processHtmlFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing HTML file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  // HTMLをPDFバッファに変換
  const pdfBuffer = await convertHtmlToPdfBuffer(content);

  // PDFバッファからテキストを抽出
  const extractedText = await extractTextFromPdfBuffer(pdfBuffer);

  const title = await generateDocTitle(extractedText.slice(0, 350))
  
  const docName = path.basename(filePath);
  filePathToChunkIds[filePath] = [];

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

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

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
