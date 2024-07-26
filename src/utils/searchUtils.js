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

  // 1. キーワード抽出
  await Promise.all([ensureKuromojiTokenizer(), ensureNaturalTokenizer()]);
  const keywords = await extractKeywords(queries);

  // 2. TF-IDFスコアの計算（重複を排除）
  const uniqueDocuments = removeDuplicates(searchResults);
  console.log(`removeDuplicates`);

  const documents = uniqueDocuments.map(doc => ({
    pageContent: doc[0].pageContent,
    metadata: doc[0].metadata
  }));
  console.log(`documents`);

  const tfidfResults = calculateTFIDFScores(documents, keywords);
  console.log(`calculateTFIDFScores`);

  // 3. キーワードの位置情報に基づくスコアの計算
  // const resultsWithPositional = calculatePositionalScores(documents, keywords);

  // 4. 各ベクトル検索結果のランキングを生成
  const vectorRankings = searchResults.map(results => 
    results.sort((a, b) => b[1] - a[1]).map(result => ({
      pageContent: result[0].pageContent,
      metadata: result[0].metadata,
      score: result[1]
    }))
  );
  console.log(`vectorRankings`);

  // 5. TF-IDFのランキングを生成
  const tfidfRanking = tfidfResults.sort((a, b) => b.tfidfScore - a.tfidfScore);

  // 6. 位置情報によるランキングを生成
  // const positionalRanking = [...resultsWithPositional].sort((a, b) => b.positionalScore - a.positionalScore);

  // 7. RRFを適用
  const rrf = new RRF([...vectorRankings, tfidfRanking]);
  const finalRanking = rrf.getFusedRanking();

  // 8. 上位k件の結果を返却
  return finalRanking.slice(0, k).map(item => ({
    pageContent: item.pageContent,
    metadata: item.metadata,
    combinedScore: item.score
  }));
}

// 重複を排除する関数
function removeDuplicates(searchResults) {
  const uniqueDocuments = new Map();
  searchResults.flat().forEach(result => {
    const content = result[0].pageContent;
    if (!uniqueDocuments.has(content) || uniqueDocuments.get(content)[1] < result[1]) {
      uniqueDocuments.set(content, result);
    }
  });
  return Array.from(uniqueDocuments.values());
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

// TF-IDFスコアを計算する関数
function calculateTFIDFScores(documents, keywords) {
  if (keywords.length === 0) {
    return documents.map(doc => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata,
      tfidfScore: 0
    }));
  }

  const allDocuments = documents.map(doc => doc.pageContent);

  return documents.map(doc => {
    const tfidfScore = keywords.reduce((score, keyword) => {
      return score + calculateTFIDF(keyword, doc.pageContent, allDocuments);
    }, 0) / keywords.length;

    return {
      pageContent: doc.pageContent,
      metadata: doc.metadata,
      tfidfScore: tfidfScore
    };
  });
}

// 単一のキーワードに対するTF-IDFスコアを計算する関数
function calculateTFIDF(keyword, document, allDocuments) {
  const tf = document.split(keyword).length - 1;
  const documentFrequency = allDocuments.filter(doc => doc.includes(keyword)).length;
  const idf = Math.log((allDocuments.length + 1) / (documentFrequency + 1)) + 1;
  return tf * idf;
}

// キーワードの位置情報に基づくスコアを計算する関数
function calculatePositionalScores(documents, keywords) {
  return documents.map(document => ({
    ...document,
    positionalScore: calculatePositionalScore(document.pageContent, keywords)
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

class RRF {
  constructor(rankings, k = 20) {
    this.rankings = rankings;
    this.k = k;
  }

  getFusedRanking() {
    const scores = {};
    this.rankings.forEach(ranking => {
      ranking.forEach((item, index) => {
        if (!scores[item.pageContent]) {
          scores[item.pageContent] = { 
            pageContent: item.pageContent,
            metadata: item.metadata,
            score: 0 
          };
        }
        scores[item.pageContent].score += 1 / (this.k + index + 1);
      });
    });
    return Object.values(scores).sort((a, b) => b.score - a.score);
  }
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
