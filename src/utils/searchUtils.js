const { 
  getKuromojiTokenizer, 
  getNaturalTokenizer, 
  ensureKuromojiTokenizer, 
  ensureNaturalTokenizer 
} = require('./tokenizerUtils');
const vectorDBService = require('../services/vectorDBService');
const { franc } = require('franc');
const natural = require('natural');
const nlp = require('compromise');

async function mergeAndRerankSearchResults(searchResults, queries, k = 6) {
  console.log(`Merge and Rerank Results. k=${k}.`);

  // 1. 初期準備: 言語検出とキーワード抽出
  await Promise.all([ensureKuromojiTokenizer(), ensureNaturalTokenizer()]);
  const keywords = await extractKeywords(queries);
  const allDocuments = searchResults.flat().map(result => result[0].pageContent);

  // 2. ベクトル検索結果のスコアを標準化
  const standardizedResults = calculateStandardizedScores(searchResults);

  // 3. TF-IDFスコアの計算
  const resultsWithTFIDF = calculateTFIDFScores(standardizedResults, keywords, allDocuments);

  // 4. キーワードの位置情報に基づくスコアの計算
  const resultsWithPositional = calculatePositionalScores(resultsWithTFIDF, keywords);

  // 5. 各スコアを組み合わせた複合スコアの計算
  const resultsWithCombinedScores = calculateCombinedScores(resultsWithPositional);

  // 6. 重複結果の処理と最終スコアの計算
  const uniqueResults = processduplicates(resultsWithCombinedScores);

  // 7. 最終スコアに基づくリランキング
  uniqueResults.sort((a, b) => b.finalScore - a.finalScore);

  // 8. 上位k件の結果を返却
  return uniqueResults.slice(0, k).map(result => ({
    pageContent: result.pageContent,
    metadata: result.metadata,
    combinedScore: result.finalScore
  }));
}

// 言語を検出し、適切なキーワード抽出を行う関数
async function extractKeywords(queries) {
  const keywordsSet = new Set();
  for (const query of queries) {
    const language = detectLanguage(query);
    const extractedKeywords = await extractKeywordsByLanguage(query, language);
    extractedKeywords.forEach(keyword => keywordsSet.add(keyword));
  }
  return Array.from(keywordsSet);
}

// 言語検出関数
function detectLanguage(text) {
  const detectedLang = franc(text);
  return detectedLang === 'jpn' ? 'japanese' : 'english';
}

// 言語に応じたキーワード抽出関数
async function extractKeywordsByLanguage(text, language) {
  if (language === 'japanese') {
    return extractJapaneseKeywords(text);
  } else {
    return extractEnglishKeywords(text);
  }
}

// 日本語キーワード抽出関数
function extractJapaneseKeywords(text) {
  const tokenizer = getKuromojiTokenizer();
  if (!tokenizer) {
    throw new Error("Kuromoji tokenizer not initialized");
  }
  const tokens = tokenizer.tokenize(text);
  return tokens
    .filter(token => token.pos === "名詞" && (token.pos_detail_1 === "一般" || token.pos_detail_1 === "固有名詞"))
    .map(token => token.surface_form)
    .filter(keyword => keyword.length > 1);
}

// 英語キーワード抽出関数
function extractEnglishKeywords(text) {
  // natural.jsのWordTokenizerを使用
  const tokenizer = getNaturalTokenizer();
  if (!tokenizer) {
    throw new Error("Natural tokenizer not initialized");
  }
  const tokens = tokenizer.tokenize(text);

  // compromiseを使用して品詞タグ付けと固有名詞抽出
  const doc = nlp(text);
  const nouns = doc.nouns().out('array');
  const properNouns = doc.match('#ProperNoun').out('array');

  // ストップワードの除去とキーワードのフィルタリング
  const stopwords = new Set(natural.stopwords);
  return [...new Set([...tokens, ...nouns, ...properNouns])]
  .filter(token => !stopwords.has(token.toLowerCase()) && token.length > 2); // 重複除去
}

// ベクトル検索結果のスコアを標準化する関数
function calculateStandardizedScores(searchResults) {
  const standardizedResults = [];
  const minLength = 80; // 最小文書長
  const penaltyFactor = 0.35; // 短い文書へのペナルティ係数

  searchResults.forEach((results, queryIndex) => {
    // スコアにペナルティを適用
    const penalizedScores = results.map(result => {
      let score = result[1];
      if (result[0].pageContent.length < minLength) {
        score *= penaltyFactor;
      }
      return score;
    });

    // 平均と標準偏差を計算
    const meanScore = penalizedScores.reduce((a, b) => a + b, 0) / penalizedScores.length;
    const stdDevScore = Math.sqrt(penalizedScores.map(score => Math.pow(score - meanScore, 2)).reduce((a, b) => a + b, 0) / penalizedScores.length);

    // スコアを標準化
    results.forEach((result, index) => {
      const standardizedScore = stdDevScore === 0 ? 0 : (penalizedScores[index] - meanScore) / stdDevScore;
      standardizedResults.push({
        pageContent: result[0].pageContent,
        metadata: result[0].metadata,
        standardizedScore,
        queryIndex
      });
    });
  });

  return standardizedResults;
}

// TF-IDFスコアを計算する関数
function calculateTFIDFScores(results, keywords, allDocuments) {
  if (keywords.length === 0) {
    return results.map(result => ({ ...result, tfidfScore: 0 }));
  }
  return results.map(result => ({
    ...result,
    tfidfScore: keywords.reduce((score, keyword) => {
      return score + calculateTFIDF(keyword, result.pageContent, allDocuments);
    }, 0) / keywords.length
  }));
}

// 単一のキーワードに対するTF-IDFスコアを計算する関数
function calculateTFIDF(keyword, document, allDocuments) {
  const tf = document.split(keyword).length - 1; // 単純な出現回数
  const documentFrequency = allDocuments.filter(doc => doc.includes(keyword)).length;
  const idf = Math.log((allDocuments.length + 1) / (documentFrequency + 1)) + 1;
  return tf * (idf || 1);
}

// キーワードの位置情報に基づくスコアを計算する関数
function calculatePositionalScores(results, keywords) {
  return results.map(result => ({
    ...result,
    positionalScore: calculatePositionalScore(result.pageContent, keywords)
  }));
}

// 単一の文書に対する位置情報スコアを計算する関数
function calculatePositionalScore(content, keywords) {
  const positions = keywords.map(keyword => content.indexOf(keyword)).filter(pos => pos !== -1);
  if (positions.length < 2) return 0;
  
  // キーワード間の平均距離を計算
  const avgDistance = positions.slice(1).reduce((sum, pos, i) => sum + Math.abs(pos - positions[i]), 0) / (positions.length - 1);
  const normalizedScore = 1 / (1 + avgDistance);
  
  // 文書の前半に出現するキーワードにボーナスを与える
  const positionBonus = 1 - (Math.min(...positions) / content.length);
  
  return (normalizedScore + positionBonus) / 2;
}

function normalizeScore(score, min, max) {
  return min === max ? 0 : (score - min) / (max - min);
}

// 各スコアを組み合わせた複合スコアを計算する関数
function calculateCombinedScores(results) {
  // 各スコアの重み付け（要調整）
  const weights = { standardized: 0.5, tfidf: 0.3, positional: 0.2 };
  
  // 各スコアの最小値と最大値を見つける
  const minMaxScores = results.reduce((acc, result) => {
    acc.standardized.min = Math.min(acc.standardized.min, result.standardizedScore);
    acc.standardized.max = Math.max(acc.standardized.max, result.standardizedScore);
    acc.tfidf.min = Math.min(acc.tfidf.min, result.tfidfScore);
    acc.tfidf.max = Math.max(acc.tfidf.max, result.tfidfScore);
    return acc;
  }, {
    standardized: { min: Infinity, max: -Infinity },
    tfidf: { min: Infinity, max: -Infinity },
    // positionalScore は既に0-1の範囲なので正規化不要
  });

  return results.map(result => {
    const normalizedStandardizedScore = minMaxScores.standardized.min === minMaxScores.standardized.max 
      ? 0 
      : normalizeScore(result.standardizedScore, minMaxScores.standardized.min, minMaxScores.standardized.max);

    const normalizedTfidfScore = minMaxScores.tfidf.min === minMaxScores.tfidf.max
      ? 0
      : normalizeScore(result.tfidfScore, minMaxScores.tfidf.min, minMaxScores.tfidf.max);

    return {
      ...result,
      combinedScore: (
        normalizedStandardizedScore * weights.standardized +
        normalizedTfidfScore * weights.tfidf +
        result.positionalScore * weights.positional
      )
    };
  });
}

// 重複結果を処理し、最終スコアを計算する関数
function processduplicates(results) {
  const uniqueResults = {};
  results.forEach(result => {
    const content = result.pageContent;
    if (!uniqueResults[content] || uniqueResults[content].combinedScore < result.combinedScore) {
      uniqueResults[content] = {
        ...result,
        duplicateCount: (uniqueResults[content]?.duplicateCount || 0) + 1
      };
    }
  });

  // 重複回数に基づいてスコアを調整
  return Object.values(uniqueResults).map(result => ({
    ...result,
    finalScore: result.combinedScore * (1 + 0.1 * (result.duplicateCount - 1))
  }));
}

async function similaritySearch(db, queries, k = 10) {

  // 各クエリに対して検索を実行
  const searchResults = await Promise.all(
    queries.map(query => vectorDBService.similaritySearch(db, query, k + 10))
  );

  // 簡易リランク、ソート
  const mergedResults = mergeAndRerankSearchResults(searchResults, queries, k);
  return mergedResults;
}

module.exports = { mergeAndRerankSearchResults, similaritySearch };
