const kuromoji = require('kuromoji');
const { app } = require('electron');
const path = require('path');
const { getEncoding } = require('js-tiktoken');

let tokenizer = null;

async function initializeKuromojiTokenizer() {
  if (tokenizer) {
    return tokenizer;
  }

  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(app.getAppPath(), "node_modules/kuromoji/dict") }).build((err, _tokenizer) => {
      if (err) {
        reject(err);
      } else {
        tokenizer = _tokenizer;
        resolve(tokenizer);
      }
    });
  });
}

// 初期化関数を即時実行
initializeKuromojiTokenizer().catch(console.error);

const tiktokenEncode = getEncoding("o200k_base");
const countTokens = (text) => {  
  const input_ids = tiktokenEncode.encode(text, disallowedSpecial = []);
  return input_ids.length;
}


module.exports = {
  countTokens,
  getKuromojiTokenizer: () => tokenizer,
  ensureKuromojiTokenizer: initializeKuromojiTokenizer
};
