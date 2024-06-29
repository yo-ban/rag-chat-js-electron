const cleanAndNormalizeText = (text) => {
  if (typeof text !== 'string') {
    console.warn(`Unexpected non-string input in cleanAndNormalizeText: ${typeof text}`);
    text = String(text);
  }

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

module.exports = { cleanAndNormalizeText };
