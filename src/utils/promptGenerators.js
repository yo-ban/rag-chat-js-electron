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
  const relevantInfoText = `Available document databases:
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


Provide your analysis in the following format:

\`\`\`
### Analysis:

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
\`\`\`

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


## Actual analysis targets

### Relevant information:
${relevantInfoText}

### Conversation history:
${chatHistoryText}

### User's question:
${latestQuestion.content}

---

Please remember that your role is to provide analysis according to the given instructions and format. Only include analysis in your response. 
Begin your analysis by following the specified guidelines and structure.

### Analysis:
`;
};


// 情報判断のプロンプトを生成する関数
function determineInformationSufficientPrompt(chatHistory, topic, dbDescription, analysis) {
  // 最新の質問を取得
  const latestQuestion = chatHistory[chatHistory.length - 1];

  // チャット履歴を必要に応じて制限
  const recentChatHistory = chatHistory.length > 4 ? chatHistory.slice(-4) : chatHistory;
  const chatHistoryText = recentChatHistory
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  // 関連情報の設定
  const relevantInfoText = `Chat topics infromation:
${topic || "Not Provided"}`

return `You are an assistant that determines whether document search is "possible" or "necessary" based on the user's latest question, recent chat history, and provided analysis.

## Context
- Relevant information: 
${relevantInfoText}

- Recent chat history: 
${chatHistoryText}

## User's latest question
${latestQuestion.content}

## Analysis of user's question
${analysis}

## Instructions
Based on the provided context, analyze the user's latest question. Determine whether document search is "possible" or "necessary." Document search should be deemed "possible" or "necessary" if at least two of the following conditions are met:

1. The user's question includes specific keywords or phrases that indicate a need for detailed information or data.
2. The recent chat history provides context or details that could guide a meaningful document search.
3. The provided analysis highlights relevant topics, keywords, or areas of interest that can be used for a document search.
4. There is an indication that available documents might contain information that could help address the user's question.

If at least two of these conditions are met, output the result in JSON format as follows:

{
  "documentSearch": true,
  "reason": "The user's question and provided context contain sufficient information to perform a meaningful document search based on the following conditions: [specific conditions met]."
}

If fewer than two of these conditions are met, output the result in JSON format as follows:

{
  "documentSearch": false,
  "reason": "The user's question and provided context do not contain sufficient information to perform a meaningful document search or the search is not necessary. The reason for this conclusion is: [detailed reason why the search is not possible or necessary]. You should ask the user for more specific information or clarification to proceed."
}

Output only the JSON result and nothing else.
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
  const relevantInfoText = `Available document databases:
${dbDescription}

Chat topics infromation:
${topic}`

return `You are an assistant that converts user questions into effective search prompts for document retrieval.
Generate multiple search prompts that resemble potential answers or information snippets related to the user's question.
Note: Up to the third prompt should be in the same language as the user's question. The fourth prompt is in English.

Consider the following steps when generating the prompts:

1. **Understand the user's intent**: Based on the analysis provided, what is the user trying to achieve or find out? What underlying needs or constraints might they have?
2. **Identify potential background information**: Based on the analysis, what context or additional information might be relevant to the user's question? This could include system limitations, business processes, or user preferences.
3. **Formulate statements**: Create prompts that resemble potential answers or information snippets. These should be declarative statements rather than questions.
4. **Incorporate key elements**: Ensure each prompt includes relevant keywords, entities, and concepts identified in the analysis.
5. **Consider multiple perspectives**: Create prompts that approach the information from different angles or viewpoints relevant to the user's question.
6. **Refine the prompts**: Ensure each prompt is clear, concise, and directly relevant to the user's desired information.
7. **Limit the number of prompts**: Generate a maximum of four prompts to cover different aspects or potential answers.

Each prompt must be output in the following JSON format only:

[
  {
    "perspective": "Explain perspective 1",
    "prompt": "Converted prompt 1"
  },
  {
    "perspective": "Explain perspective 2",
    "prompt": "Converted prompt 2"
  },
  {
    "perspective": "Explain perspective 3",
    "prompt": "Converted prompt 3 in English"
  }
]

By following these guidelines, you can generate effective and comprehensive search prompts that resemble potential answers, improving the likelihood of retrieving relevant document chunks.

## Relevant information
${relevantInfoText}

## Conversation history
${chatHistoryText}

## User's question
${latestQuestion.content}

## Analysis of user's question
${analysis}

## Converted prompts  
`;
};

// 検索結果のフォーマット処理
function formatSearchResults(searchResults, queries, dbInfo) {

  let serachInfo = "## Search Info";
  serachInfo += `\n**Search target database:** ${dbInfo}`

  // serachInfo += "\n**Search Queries:**";
  // queries.forEach(query => {
  //   serachInfo += `\n- ${query}`;
  // });

  const resultsStr = searchResults.map((result, index) => {
    const { pageContent, metadata = {}, combinedScore } = result;
    const source = metadata.source || 'Unknown source';
    const title = metadata.title || 'Unknown title';

    return `### Result ${index + 1}\n**Source:** ${source}\n**Title:** ${title}\n**Content:** ${pageContent}\n**Score:** ${combinedScore}\n`;
  }).join('\n---\n');

  return `${serachInfo}
  
## Search Results
${resultsStr}
`
}

// 回答生成プロンプトを生成する関数
function generateQAPrompt(systemMessage, topic, context, queries, dbInfo) {
  let constructedSystemMessage = systemMessage;
  const documentPlaceholder = "{{DOCUMENTS}}";
  const topicPlaceholder = "{{TOPIC}}";
  if (constructedSystemMessage) {
    if (context.length > 0) {
      const documents = formatSearchResults(context, queries, dbInfo).trim();
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


// フォローアッププロンプトを生成する関数
function generateFollowUpPrompt(systemMessage, topic, followupReason) {
  let constructedSystemMessage = systemMessage;
  const documentPlaceholder = "{{DOCUMENTS}}";
  const topicPlaceholder = "{{TOPIC}}";
  if (constructedSystemMessage) {
    if (followupReason) {
      console.log(`Follow-up Reason:\n${followupReason}`);
      constructedSystemMessage = constructedSystemMessage.includes(documentPlaceholder)
        ? constructedSystemMessage.replace(documentPlaceholder, `${followupReason}`)
        : `${constructedSystemMessage}\n\n<Followup Reason>\n${followupReason}\n</Followup Reason>\n`;
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
  generateAnalysisPrompt,
  determineInformationSufficientPrompt,
  generateTransformationPrompt,
  generateQAPrompt,
  generateFollowUpPrompt
};
