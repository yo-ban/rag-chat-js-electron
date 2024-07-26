const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { Document } = require("@langchain/core/documents");
const pdfjsLib = require('pdfjs-dist');
const { Poppler } = require('node-poppler');
const { cleanAndNormalizeText } = require('../textUtils');
const { splitDocuments } = require('../documentSplitter');
const { generateDocTitle } = require('../docUtils');
const llmService = require('../../services/llmService');

// ワーカーファイルのパスを設定
const workerSrc = './pdf.worker.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const processPdfFile = async (filePath, filePathToChunkIds, chunkSize, overlapPercentage) => {
  console.log(`Processing PDF file: ${filePath}`);
  // const loader = new PDFLoader(filePath);
  const structuredTexts = await extractStructuredText(filePath);

  if (!structuredTexts || structuredTexts.length === 0) return [];

  const docName = path.basename(filePath);
  const title = await generateDocTitle(structuredTexts[0].content.slice(0, 350), docName);

  filePathToChunkIds[filePath] = [];
  
  const docs = structuredTexts.map((data) => {
    // console.log(JSON.stringify(data.structure));
    return new Document({
      pageContent: cleanAndNormalizeText(data.content),
      metadata: {
        title: title,
        totalPages: structuredTexts.length,
        pageNumber: data.pageNumber,
        source: filePath,
        // structure: data.structure,
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

// テキストを行ごとにグループ化する補助関数（変更なし）
function groupTextByLines(structuredData) {
  const groupedByY = structuredData.reduce((acc, item) => {
    const key = Math.round(item.y);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return Object.values(groupedByY)
    .map(group => group.sort((a, b) => a.x - b.x).map(item => item.text).join(' '));
}

// PDFの種類を推測する関数（スコアリングシステム採用版）
async function guessPDFType(structuredData, page) {
  // フォントサイズの分析
  const fontSizes = structuredData.map(item => item.fontSize);
  const uniqueFontSizes = [...new Set(fontSizes)].sort((a, b) => b - a);
  const avgFontSize = fontSizes.reduce((sum, size) => sum + size, 0) / fontSizes.length;
  
  // 大きなフォントサイズの割合を計算
  const largeFontThreshold = Math.max(avgFontSize * 1.5, uniqueFontSizes[Math.min(2, uniqueFontSizes.length - 1)]);
  const largeFontRatio = fontSizes.filter(size => size >= largeFontThreshold).length / fontSizes.length;

  // テキスト密度の分析
  const totalChars = structuredData.reduce((sum, item) => sum + item.text.length, 0);
  const textDensity = totalChars / structuredData.length;

  // 行の数と平均長さの分析
  const lines = groupTextByLines(structuredData);
  const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;

  // スコアリングシステム
  let slideScore = 0;

  if (largeFontRatio > 0.15) slideScore += 2;
  if (textDensity < 50) slideScore += 2;
  if (lines.length < 15) slideScore += 1;
  if (avgLineLength < 40) slideScore += 1;
  if (uniqueFontSizes.length < 5) slideScore += -1; // フォントサイズの種類が少ない
  if (structuredData.length < 100) slideScore += 1; // ページ上のテキスト要素が少ない

  // アスペクト比の計算と評価
  const { width, height } = await page.getViewport({ scale: 1.0 });
  const aspectRatio = width / height;

  console.log(`Page aspect ratio: ${aspectRatio}`);

  // 一般的なスライドのアスペクト比（16:9 = 1.78、4:3 = 1.33）に近いかチェック
  if (!(Math.abs(aspectRatio - 1.78) < 0.1 || Math.abs(aspectRatio - 1.33) < 0.1)) {
    slideScore += -3; // アスペクト比がドキュメントに近い場合、スコアを大幅に下げる
  }

  console.log(`スライドスコア: ${slideScore}`); // デバッグ用

  // スコアに基づいて判定
  if (slideScore >= 4) {
    return 'slide';
  } else {
    return 'document';
  }
}

// PDFページを画像に変換してbase64エンコードする関数
async function renderPageToBase64(filePath, pageNumber) {
  try {

    // 2. 新しいPDFドキュメントをPopplerで画像に変換
    const poppler = new Poppler();
    const options = {
      firstPageToConvert: pageNumber,
      lastPageToConvert: pageNumber,
      pngFile: true,
      singleFile: true
    };

    console.log(`ページ ${pageNumber} を画像に変換中...`);
    const pngData = await poppler.pdfToCairo(filePath, undefined, options);
    console.log(`ページ ${pageNumber} の変換が成功しました。`);
    console.log(`pngData type: ${typeof pngData}`);

    if (pngData && typeof pngData === 'string') {
      // バイナリデータを含む文字列をBufferに変換
      const buffer = Buffer.from(pngData, 'binary');
      const base64Image = buffer.toString('base64');
      console.log(`ページ ${pageNumber} をbase64エンコードしました。:`, base64Image.slice(0, 200));
      return base64Image;
    } else {
      console.error(`ページ ${pageNumber} の変換結果が不正な形式です:`, typeof pngData);
      return null;
    }
  } catch (error) {
    console.error(`ページの画像化に失敗しました (ページ ${pageNumber}):`, error);
    return null;
  }
}


// スライドデータを文章化する関数
async function convertSlideToText(structuredData, base64Image) {
  // Y座標でグループ化
  const groupedByY = structuredData.reduce((acc, item) => {
    const key = Math.round(item.y);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // 各グループ内でX座標でソートし、テキストを結合
  const sortedLines = Object.values(groupedByY)
    .map(group => group.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
    .sort((a, b) => b - a); // Y座標の大きい順（ページの上から下）にソート

  const structuredText = sortedLines.join('\n');

  const prompt = `The following is image and text data extracted from a PDF slide page. Please faithfully convert the content displayed in the image into a text format.

  Image data:
  [Image is provided separately]
  
  Supplementary text data (with coordinate information):
  ${structuredData.map(item => `(x:${item.x}, y:${item.y}) ${item.text}`).join('\n')}
  
  When converting, please pay attention to the following points:
  1. Only convert the content displayed in the image of the slide, without including any speculation or additional information.
  2. Reflect the layout and structure of the slide, using appropriate paragraphs and bullet points.
  3. Include descriptions of important information, graphs, and figures contained in the image.
  4. Ignore navigation elements that appear to be common to all pages, such as chapter numbers or section titles typically displayed on the left side or top of slides.
  5. Use the text data as supplementary information, and prioritize the content of the image if there are any discrepancies.
  
  Please output only the converted text.`;
  
  const systemMessage = "You are an expert in accurately converting PDF slide content into document format. Use the provided image as the primary source of information and the text data as supplementary information to faithfully convert the slide content into text. Do not add any information beyond what is displayed on the slide.";
  const messagesToSend = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
    ]}
  ];

  let convertedText = '';
  try {
    await llmService.sendMessage(messagesToSend, 0.0, 4096, (messageContent) => {
      convertedText += messageContent;
    });
    // console.log(convertedText);
    return convertedText.trim();
  } catch (error) {
    console.error('Error in LLM text conversion:', error);
    return structuredText; // エラーが発生した場合、元のテキストを返す
  }
}

// 数値を指定された小数点以下の桁数に丸める関数
function roundToDecimal(num, decimalPlaces) {
  return Number(Math.round(num + "e" + decimalPlaces) + "e-" + decimalPlaces);
}

// 構造化されたテキスト抽出関数（修正版）
const extractStructuredText = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument(data).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageContent = textContent.items
      .filter(item => item.str.trim() !== '')
      .map(item => ({
        text: item.str,
        x: roundToDecimal(item.transform[4], 1),
        y: roundToDecimal(item.transform[5], 1),
        fontSize: item.transform[0]
      }));

    const pdfType = await guessPDFType(pageContent, page);
    let content;
    let base64Image = null;
    console.log("pdfType: " + pdfType);

    if (pdfType === 'slide') {
      base64Image = await renderPageToBase64(filePath, i);
      if (base64Image) {
        console.log(`ページ ${i} の画像をbase64で取得しました`);
      } else {
        console.log(`ページ ${i} の画像化に失敗しました`);
      }
      content = await convertSlideToText(pageContent, base64Image);
    } else {
      content = pageContent.map(item => item.text).join('\n');
    }

    pages.push({
      pageNumber: i,
      content: content,
      structure: pageContent,
      pdfType: pdfType,
      base64Image: base64Image
    });
  }

  return pages;
};

module.exports = { processPdfFile };
