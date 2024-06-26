const { getKuromojiTokenizer, ensureKuromojiTokenizer } = require('./tokenizerUtils');

// 検索結果の統合とリランキング処理
async function mergeAndRerankSearchResults(searchResults, queries, k = 6) {
  console.log(`Merge and Rerank Results. k=${k}.`);

  // 1. 各クエリごとに標準化スコアを計算
  const standardizedResults = [];
  const minLength = 80; // 最低文字数の設定
  const penaltyFactor = 0.35; // ペナルティの係数（例: 0.5）

  searchResults.forEach((results, queryIndex) => {
    const penalizedScores = results.map(result => {
      let score = result[1];
      if (result[0].pageContent.length < minLength) {
        score *= penaltyFactor; // ペナルティを適用
      }
      return score;
    });

    const meanScore = penalizedScores.reduce((a, b) => a + b, 0) / penalizedScores.length;
    const stdDevScore = Math.sqrt(penalizedScores.map(score => Math.pow(score - meanScore, 2)).reduce((a, b) => a + b, 0) / penalizedScores.length);

    results.forEach((result, index) => {
      const standardizedScore = (penalizedScores[index] - meanScore) / stdDevScore;
      standardizedResults.push({ pageContent: result[0].pageContent, metadata: result[0].metadata, standardizedScore, queryIndex });
    });
  });

  console.log(`All Standardized Results length: ${standardizedResults.length}`);

  // 2. クエリからキーワードを抽出
  const keywordsSet = new Set();
  await ensureKuromojiTokenizer();
  const tokenizer = getKuromojiTokenizer();

  for (const query of queries) {
    const tokens = tokenizer.tokenize(query);
    const parsedQuery = tokens.filter(token => token.pos === "名詞" && (token.pos_detail_1 === "一般" || token.pos_detail_1 === "固有名詞"))
      .map(token => token.surface_form)
      .filter(keyword => keyword.length > 2);
    parsedQuery.forEach(keyword => keywordsSet.add(keyword));
  }
  const keywords = Array.from(keywordsSet);

  console.log(`Extracted Keywords: ${JSON.stringify(keywords)}`);

  // 3. キーワード一致度を計算
  standardizedResults.forEach(result => {
    result.keywordScore = keywordScore(result.pageContent, keywords);
    if (result.keywordScore === null) {
      result.keywordScore = 0; // キーワードスコアがnullの場合は0を設定
    }
  });

  // 4. 重複のカウント
  const resultCount = {};
  standardizedResults.forEach(result => {
    const content = result.pageContent;
    if (!resultCount[content]) {
      resultCount[content] = { count: 0, standardizedScores: [], keywordScores: [] };
    }
    resultCount[content].count += 1;
    resultCount[content].standardizedScores.push(result.standardizedScore);
    resultCount[content].keywordScores.push(result.keywordScore);
  });

  // 5. 重複カウントとスコアに基づいた総合スコアの計算
  const uniqueResults = Object.keys(resultCount).map(content => {
    const { count, standardizedScores, keywordScores } = resultCount[content];
    const averageStandardizedScore = standardizedScores.reduce((a, b) => a + b, 0) / standardizedScores.length;
    const validKeywordScores = keywordScores.filter(score => score !== null); // nullスコアを除外
    const averageKeywordScore = validKeywordScores.length > 0 ? validKeywordScores.reduce((a, b) => a + b, 0) / validKeywordScores.length : 0;
    const combinedScore = (averageStandardizedScore * 0.8) + (averageKeywordScore * 0.2) * (1 + 0.1 * count); // スコアに重みを付けて加算
    return {
      pageContent: content,
      combinedScore,
      originalResults: standardizedResults.filter(result => result.pageContent === content)
    };
  });

  // 6. リランキング（総合スコアに基づいてソート）
  uniqueResults.sort((a, b) => b.combinedScore - a.combinedScore);

  // 7. 上位k件の結果を返す
  const topResults = uniqueResults.slice(0, k).map(result => ({
    pageContent: result.pageContent,
    metadata: result.originalResults[0].metadata,
    combinedScore: result.combinedScore
  }));

  return topResults;
}

const keywordScore = (content, keywords) => {
  let score = 0;
  if (keywords.length === 0) {
    return null; // キーワードが存在しない場合はnullを返す
  }
  keywords.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 1;
    }
  });
  return score / keywords.length; // キーワード一致度を計算
};


module.exports = { mergeAndRerankSearchResults };
