const path = require('path');
const fs = require('fs');
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
const TurndownService = require('turndown').default;

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

const readFileWithEncoding = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const encoding = chardet.detect(buffer);
  return iconvLite.decode(buffer, encoding);
};

const splitMarkdownByHeadings = (markdown) => {
  const sections = markdown.split(/(?=^# )/gm);
  return sections.map(section => section.trim()).filter(section => section.length > 0);
};

const processTextFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing text file: ${filePath}`);
  const content = readFileWithEncoding(filePath);

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  let docs = [];
  
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
    const sections = splitMarkdownByHeadings(content);
    docs = sections.map((section, index) => new Document({
      pageContent: cleanAndNormalizeText(section),
      metadata: {
        source: filePath,
        timestamp: new Date().toISOString(),
        sectionIndex: index + 1,
      },
    }));
  } else {
    docs = [new Document({
      pageContent: cleanAndNormalizeText(content),
      metadata: {
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
  const content = readFileWithEncoding(filePath);
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

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const docs = datas.map((data) => {
    return new Document({
      pageContent: cleanAndNormalizeText(data.pageContent),
      metadata: {
        ...data.metadata,
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

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const docs = [new Document({
    pageContent: cleanAndNormalizeText(data.value),
    metadata: {
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
  const content = readFileWithEncoding(filePath);
  const jsonObject = JSON.parse(content);

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const jsonString = JSON.stringify(jsonObject, null, 2);
  const docs = [new Document({
    pageContent: cleanAndNormalizeText(jsonString),
    metadata: {
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
  const content = readFileWithEncoding(filePath);
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

const processHtmlFile = async (filePath, docNameToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing HTML file: ${filePath}`);
  const content = readFileWithEncoding(filePath);
  
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(content);
  const sections = splitMarkdownByHeadings(markdown);

  const docName = path.basename(filePath);
  docNameToChunkIds[docName] = [];

  const docs = sections.map((section, index) => new Document({
    pageContent: cleanAndNormalizeText(section),
    metadata: {
      source: filePath,
      timestamp: new Date().toISOString(),
      sectionIndex: index + 1,
    },
  }));

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
        source: filePath,
        timestamp: new Date().toISOString(),
        sheetName: sheetName,
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
  getAllFiles: (dirPath, extensions, fileList = [], depth = 0, maxDepth = 3) => {
    if (depth > maxDepth) return fileList;
    const files = fs.readdirSync(dirPath);
    console.log("files", files);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        fileProcessor.getAllFiles(filePath, extensions, fileList, depth + 1, maxDepth);
      } else {
        const ext = path.extname(file).toLowerCase(); 
        if (extensions.includes(ext.slice(1))) { // ドットを除去
          fileList.push(filePath);
        }
      }
    });
    return fileList;
  },
  processFile: async (filePath, docNameToChunkIds, chunkSize = 512, overlapPercentage = 25) => {
    const ext = path.extname(filePath).toLowerCase();
    if (languageMapping[ext]) {
      return await processCodeFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
    }
    switch (ext) {
      case '.yaml':
      case '.yml':
      case '.txt':
      case '.md':
      case '.markdown':
        return await processTextFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.pdf':
        return await processPdfFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.docx':
        return await processDocxFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.json':
        return await processJsonFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.csv':
        return await processCsvFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.html':
      case '.htm':
          return await processHtmlFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      case '.xlsx':
        return await processExcelFile(filePath, docNameToChunkIds, chunkSize, overlapPercentage);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }
};

module.exports = fileProcessor;