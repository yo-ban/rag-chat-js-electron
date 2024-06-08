const kuromoji = require('kuromoji');
const { app } = require('electron');
const path = require('path');


function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(app.getAppPath(), "node_modules/kuromoji/dict") }).build((err, tokenizer) => {
      if (err) {
        reject(err);
      } else {
        resolve(tokenizer);
      }
    });
  });
}

// 検索結果の統合とリランキング処理
async function mergeAndRerankSearchResults(searchResults, queries, k = 6) {
  console.log(`Merge and Rerank Results. k=${k}.`);

  // 1. 各クエリごとに標準化スコアを計算
  const standardizedResults = [];
  const minLength = 80; // 最低文字数の設定
  const penaltyFactor = 0.5; // ペナルティの係数（例: 0.5）

  searchResults.forEach((results, queryIndex) => {
    const scores = results.map(result => result[1]);
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDevScore = Math.sqrt(scores.map(score => Math.pow(score - meanScore, 2)).reduce((a, b) => a + b, 0) / scores.length);

    results.forEach(result => {
      let standardizedScore = (result[1] - meanScore) / stdDevScore;
      
      // ペナルティの適用（標準化後のスコアに対して）
      if (result[0].pageContent.length < minLength) {
        standardizedScore *= penaltyFactor; // ペナルティを適用
      }
      
      standardizedResults.push({ pageContent: result[0].pageContent, metadata: result[0].metadata, standardizedScore, queryIndex });
    });
  });
  
  console.log(`All Standardized Results length: ${standardizedResults.length}`);

  // 2. クエリからキーワードを抽出
  const keywordsSet = new Set();
  const tokenizer = await buildTokenizer();

  for (const query of queries) {
    const tokens = tokenizer.tokenize(query);
    const parsedQuery = tokens.filter(token => token.pos === "名詞" && (token.pos_detail_1 === "一般" || token.pos_detail_1 === "固有名詞"))
    .map(token => token.surface_form)
    .filter(keyword => keyword.length > 1);
    parsedQuery.forEach(keyword => keywordsSet.add(keyword));
  }
  const keywords = Array.from(keywordsSet); 
  
  console.log(`Extracted Keywords: ${JSON.stringify(keywords)}`);

  // 3. キーワード一致度を計算
  const keywordScore = (content, keywords) => {
    let score = 0;
    if (keywords.length === 0) {
      return null; // キーワードが存在しない場合はnullを返す
    }
    keywords.forEach(keyword => {
      if (content.includes(keyword)) { 
        if (content.length > minLength) {
          score += 1;
        } else { 
          score += penaltyFactor; // 短すぎる結果は重視しない
        }
      }
    });
    return score / keywords.length; // キーワード一致度を計算
  };

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

// 生成AIのレスポンスからクエリを抽出する関数
function parseTransformedQueries(response) {
  function fixJSON(jsonString) {
    // JSONの基本的な修正を行う関数
    try {
      // 1. 末尾のカンマを削除
      jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

      // 2. ```json と ``` を削除
      jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '');

      // 3. 不要なバックティックを削除
      jsonString = jsonString.replace(/`/g, '');

      // 4. 一重引用符を二重引用符に変換
      jsonString = jsonString.replace(/'/g, '"');

      // 5. キーが引用符で囲まれていない場合に囲む
      jsonString = jsonString.replace(/([{,])\s*([^"{[]+?)\s*:/g, '$1"$2":');

      return jsonString;
    } catch (e) {
      console.error("Error fixing JSON:", e);
      return jsonString;
    }
  }

  try {
    return JSON.parse(response);
  } catch (error) {
    console.warn("Initial JSON parse failed, attempting to fix JSON...");

    // JSON修正を試みる
    const fixedResponse = fixJSON(response);

    try {
      return JSON.parse(fixedResponse);
    } catch (secondError) {
      console.error("Failed to parse fixed JSON:", secondError);
      return [];
    }
  }
}

// クエリ分析用プロンプトを生成する関数
function generateAnalysisPrompt(chatHistory, topic, dbDescription) {
  // 最新の質問を取得
  const latestQuestion = chatHistory[chatHistory.length - 1];
  
  // チャット履歴を必要に応じて制限
  const recentChatHistory = chatHistory.length > 4 ? chatHistory.slice(-4) : chatHistory;
  const chatHistoryText = recentChatHistory
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  // 関連情報の強化
  const relevantInfoText = `Loaded DB description:
${dbDescription}

Chat topics infromation:
${topic}`

  return `You are an assistant that analyzes user questions to identify their underlying intent and relevant contextual information. Follow these steps to analyze the user's question:

1. **Identify the Core Question**:
  - Extract the main question or request from the user's message.
  - Summarize the core question in a concise statement.

2. **Determine the User's Intent**:
  - Infer the user's ultimate goal or what they are trying to achieve with their question.
  - Consider possible constraints or requirements implied by the question.

3. **Contextual Analysis**:
  - Review the conversation history and any provided relevant information to understand the broader context.
  - Identify any specific details, background information, or constraints that might affect the answer.

4. **Related Topics and Keywords**:
  - Identify key topics and keywords related to the question.
  - Consider synonyms or related terms that might be relevant to the search.

5. **Formulate Searchable Aspects**:
  - Based on the analysis from steps 1-4, identify different aspects or sub-questions that need to be addressed.
  - These aspects should be tailored to the specific context and requirements of the user's question.
  - Ensure that these aspects cover various dimensions relevant to the question.

After completing the analysis, provide a structured summary of your findings in the format below:

## Analysis Format:
1. **Core Question**:
  - [Core question summary]

2. **User's Intent**:
  - [User's ultimate goal]

3. **Contextual Analysis**:
  - [Context and background information]

4. **Related Topics and Keywords**:
  - [Key topics and keywords]

5. **Formulate Searchable Aspects**:
  - [Aspects to be searched]

## Example

### User's question:
システムの再起動処理はいつ行われますか？

### Analysis:

1. **Core Question**:
  - When is the system reboot process scheduled to occur?

2. **User's Intent**:
  - The user wants to know the specific times or conditions under which the system reboot process is scheduled. This could be for planning maintenance, minimizing disruption, or ensuring uptime.

3. **Contextual Analysis**:
  - The system may have a regular maintenance schedule that includes reboot times.
  - Reboot processes might be planned to avoid peak usage times to minimize disruption.
  - There may be specific triggers or conditions that necessitate a system reboot (e.g., software updates, performance issues).

4. **Related Topics and Keywords**:
  - System maintenance schedule, reboot schedule, system uptime, maintenance windows, peak usage times, software updates, system performance, IT policies.

5. **Formulate Searchable Aspects**:
  - Based on the context and intent, identify aspects such as:
    - Regular maintenance schedules that include system reboots.
    - Times of day or week when system reboots are typically performed.
    - Conditions or triggers for initiating a system reboot (e.g., after updates or during low usage periods).
    - Historical data on past reboot times and their impact on system performance.

## Actual analysis target

### Relevant information:
${relevantInfoText}

### Conversation history:
${chatHistoryText}

### User's question:
${latestQuestion.content}

### Analysis:
`;
};

// クエリ変換プロンプトを生成する関数
function generateTransformationPrompt(chatHistory, topic, analysis, dbDescription) {
  // 最新の質問を取得
  const latestQuestion = chatHistory[chatHistory.length - 1];
  
  // チャット履歴を必要に応じて制限
  const recentChatHistory = chatHistory.length > 4 ? chatHistory.slice(-4) : chatHistory;
  const chatHistoryText = recentChatHistory
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  // 関連情報の強化
  const relevantInfoText = `Loaded DB description:
${dbDescription}

Chat topics infromation:
${topic}`

  return `You are an assistant that converts user questions into more effective search queries.
Generate multiple queries to search from different perspectives for the user's question.
Note: The queries should be in the same language as the user's question.

Consider the following steps when generating the queries:

1. **Understand the user's intent**: Based on the analysis provided, what is the user trying to achieve or find out? What underlying needs or constraints might they have?
2. **Identify potential background information**: Based on the analysis, what context or additional information might be relevant to the user's question? This could include system limitations, business processes, or user preferences.
3. **Formulate diverse perspectives**: Create queries that approach the question from different angles. These perspectives should be tailored to the specific context and requirements identified in the analysis.
4. **Refine the queries**: Ensure each query is clear, precise, and relevant to the user's question.
5. **Limit the number of queries**: Generate a maximum of three queries to cover different perspectives.

Each query must be output in the following JSON format only:

[
  {
    "perspective": "Perspective 1",
    "query": "Converted Query 1"
  },
  {
    "perspective": "Perspective 2",
    "query": "Converted Query 2"
  },
  {
    "perspective": "Perspective 3",
    "query": "Converted Query 3"
  }
]

By following these guidelines, you can generate effective and comprehensive search queries that address the user's underlying needs and provide valuable information.

## Relevant information
${relevantInfoText}

## Conversation history
${chatHistoryText}

## User's question
${latestQuestion.content}

## Analysis of user's question
${analysis}

## Converted queries 
`;
};

// 検索結果のフォーマット処理
function formatSearchResults(searchResults, context2, dbInfo) {

  
  let serachInfo = "## Search Info\n";
  serachInfo += `**Search target database:** ${dbInfo}\n`
  
  serachInfo += "**Search Queries:**\n";
  context2.forEach(query => {
    serachInfo += `- ${query.query}\n`;
  });

  const resultsStr = searchResults.map((result, index) => {
    const { pageContent, metadata = {}, combinedScore } = result;
    const source = metadata.source || 'Unknown source';

    return `### Result ${index + 1}\n**Source:** ${source}\n**Content:** ${pageContent}\n**Score:** ${combinedScore}\n`;
  }).join('\n---\n');

  return `${serachInfo}

## Search Results
${resultsStr}`
}

// クエリ変換プロンプトを生成する関数
function generateQAPrompt(systemMessage, topic, context, context2, dbInfo) {
  let constructedSystemMessage = systemMessage;
  const documentPlaceholder = "{{DOCUMENTS}}";
  const topicPlaceholder = "{{TOPIC}}";
  if (constructedSystemMessage) {
    if (context.length > 0) {
      const documents = formatSearchResults(context, context2, dbInfo).trim();
      console.log(`Formatted Search Results:\n${documents}`);
      constructedSystemMessage = constructedSystemMessage.includes(documentPlaceholder)
        ? constructedSystemMessage.replace(documentPlaceholder, `${documents}`)
        : `${constructedSystemMessage}\n\n<Documents>\n${documents}\n</Documents>\n`;
    } else {
      constructedSystemMessage = constructedSystemMessage.replace(documentPlaceholder, "");
    }

    if (topic) {
      constructedSystemMessage = constructedSystemMessage.includes(topicPlaceholder)
        ? constructedSystemMessage.replace(topicPlaceholder, `${topic}`)
        : `${constructedSystemMessage}\n\n<Topic>\n${topic}\n</Topic>\n`;
    } else {
      constructedSystemMessage = constructedSystemMessage.replace(topicPlaceholder, "");
    }
  } else {
    console.error("System Message is blank!")
  }
  return constructedSystemMessage;
}

module.exports = { 
  mergeAndRerankSearchResults, 
  parseTransformedQueries,
  generateAnalysisPrompt,
  generateTransformationPrompt,
  generateQAPrompt
};

