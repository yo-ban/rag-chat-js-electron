const path = require('path');
const fs = require('fs').promises;
const { getEncoding } = require('js-tiktoken');
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
const crypto = require('crypto');

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

const enc = getEncoding("o200k_base");
const countTokens = (text) => {  
  const input_ids = enc.encode(text, disallowedSpecial = []);
  return input_ids.length;
}

const cleanAndNormalizeText = (text) => {
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

const processTextFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing text file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const title = await generateDocTitle(content.slice(0, 350))

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const processCodeFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing code file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content) return [];

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for code file: ${filePath}`);
  return chunks;
};

const processPdfFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing PDF file: ${filePath}`);

  const loader = new PDFLoader(filePath);
  const datas = await loader.load();

  if (!datas || !datas[0]?.pageContent ) return [];

  const title = await generateDocTitle(datas[0].pageContent.slice(0, 350))

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const docs = datas.map((data) => {
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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const processDocxFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing DOCX file: ${filePath}`);
  const data = await mammoth.extractRawText({ path: filePath });

  if (!data ) return [];

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const processJsonFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing JSON file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  const jsonObject = JSON.parse(content);

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const processCsvFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing CSV file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true
  });

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);

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

const processHtmlFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing HTML file: ${filePath}`);
  const content = await readFileWithEncoding(filePath);

  if (!content ) return [];

  // HTMLをPDFバッファに変換
  const pdfBuffer = await convertHtmlToPdfBuffer(content);

  // PDFバッファからテキストを抽出
  const extractedText = await extractTextFromPdfBuffer(pdfBuffer);

  const title = await generateDocTitle(extractedText.slice(0, 350))
  
  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

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
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const processExcelFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing Excel file: ${filePath}`);
  const workbook = xlsx.readFile(filePath);
  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const docs = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const sheetText = xlsx.utils.sheet_to_csv(sheet);
    return new Document({
      pageContent: cleanAndNormalizeText(sheetText),
      metadata: {
        title: `"${sheetName}" sheet`,
        source: filePath,
        timestamp: new Date().toISOString(),
      },
    });
  });

  const chunks = await splitDocuments(docs, chunkSize, overlapPercentage);
  chunks.forEach((chunk) => {
    const chunkId = uuidv4();
    chunk.metadata.chunkId = chunkId;
    docNameToChunkIds[docName].push(chunkId);
  });

  console.log(`Processed ${chunks.length} chunks for file: ${filePath}`);
  return chunks;
};

const fileProcessor = {
  getAllFiles: async (dirPath, extensions, fileList = [], depth = 0, maxDepth = 3) => {
    if (depth > maxDepth) return fileList;

    const files = await fs.readdir(dirPath); // 非同期でディレクトリの内容を読み取る

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
  processFile: async (filePath, docNameToChunkIds, chunkSize = 512, overlapPercentage = 25) => {
    const ext = path.extname(filePath).toLowerCase();
    const docName = path.basename(filePath);
    const fileContent = await readFileWithEncoding(filePath);
    const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');
    
    let chunks;
    if (languageMapping[ext]) {
      chunks = await processCodeFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
    } else {
      switch (ext) {
        case '.yaml':
        case '.yml':
        case '.txt':
        case '.md':
        case '.markdown':
          chunks = await processTextFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.pdf':
          chunks = await processPdfFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.docx':
          chunks = await processDocxFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.json':
          chunks = await processJsonFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.csv':
          chunks = await processCsvFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.html':
        case '.htm':
          chunks = await processHtmlFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        case '.xlsx':
          chunks = await processExcelFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    }
    
    return { chunks, docName, fileHash };
  }
};

module.exports = fileProcessor;
