const kuromoji = require('kuromoji');
const { app } = require('electron');
const path = require('path');

let tokenizer = null;

async function initializeTokenizer() {
  if (tokenizer) return;

  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(app.getAppPath(), "node_modules/kuromoji/dict") }).build((err, _tokenizer) => {
      if (err) {
        reject(err);
      } else {
        tokenizer = _tokenizer;
        resolve();
      }
    });
  });
}

async function countToken(text) {
  if (!tokenizer) {
    await initializeTokenizer();
  }
  const tokens = tokenizer.tokenize(text);
  return tokens.length;
}

module.exports = { countToken };
