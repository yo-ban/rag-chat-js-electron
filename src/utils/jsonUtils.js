const llmService = require('../services/llmService');

// 生成AIのレスポンスからクエリを抽出する関数
function parseJsonResponse(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    console.warn("Initial JSON parse failed, attempting to fix JSON...");

    // JSON修正を試みる
    const fixedResponse = fixJSON(response);

    try {
      return JSON.parse(fixedResponse);
    } catch (secondError) {
      console.warn("fix JSON failed, attempting to fix JSON with LLM...");
      
      try {
        const fixedResponseWithLLM = fixJSONWithLLM(response);
        return JSON.parse(fixedResponseWithLLM);
      } catch {
        console.error("Failed to parse fixed JSON:", secondError);
        return [];
      }
    }
  }
}

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

async function fixJSONWithLLM(jsonString) {
  const prompt = `以下の文字列は不正な形式の JSON です。これを有効な JSON に修正してください。修正した JSON のみを出力し、説明は不要です。

不正な JSON:
${jsonString}

修正後の JSON:`;

  const systemMessage = "あなたは JSON の専門家です。与えられた不正な形式の JSON を修正し、有効な JSON に変換してください。";
  const messagesToSend = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: prompt }
  ];

  let assistantMessageContent = '';
  try {
    await llmService.sendMessage(messagesToSend, 0.7, 2048, (messageContent) => {
      assistantMessageContent += messageContent;
    });

    return assistantMessageContent;
  } catch (llmError) {
    console.error("LLM-based JSON fixing failed:", llmError);
    throw new Error("Unable to fix JSON string, even with LLM assistance");
  }
}

module.exports = { parseJsonResponse };
