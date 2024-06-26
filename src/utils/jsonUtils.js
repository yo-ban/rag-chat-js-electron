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
      console.error("Failed to parse fixed JSON:", secondError);
      return [];
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

module.exports = { parseJsonResponse };
