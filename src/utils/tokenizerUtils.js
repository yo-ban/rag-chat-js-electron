const kuromoji = require('kuromoji');
const { app } = require('electron');
const path = require('path');
const { getEncoding } = require('js-tiktoken');
const natural = require('natural');

let kuromojiTokenizer = null;
let naturalTokenizer = null;

async function initializeKuromojiTokenizer() {
  if (kuromojiTokenizer) {
    return kuromojiTokenizer;
  }

  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(app.getAppPath(), "node_modules/kuromoji/dict") }).build((err, _tokenizer) => {
      if (err) {
        reject(err);
      } else {
        kuromojiTokenizer = _tokenizer;
        resolve(kuromojiTokenizer);
      }
    });
  });
}

function initializeNaturalTokenizer() {
  if (naturalTokenizer) {
    return naturalTokenizer;
  }
  naturalTokenizer = new natural.WordTokenizer();
  return naturalTokenizer;
}

// 両方のトークナイザーを初期化
async function initializeTokenizers() {
  await initializeKuromojiTokenizer().catch(console.error);
  initializeNaturalTokenizer();
}

// 初期化関数を即時実行
initializeTokenizers();

const tiktokenEncode = getEncoding("o200k_base");
const countTokens = (text) => {  
  const input_ids = tiktokenEncode.encode(text, disallowedSpecial = []);
  return input_ids.length;
}

module.exports = {
  countTokens,
  getKuromojiTokenizer: () => kuromojiTokenizer,
  getNaturalTokenizer: () => naturalTokenizer,
  ensureKuromojiTokenizer: initializeKuromojiTokenizer,
  ensureNaturalTokenizer: initializeNaturalTokenizer
};
