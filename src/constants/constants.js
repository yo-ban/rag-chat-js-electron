const { app } = require('electron');

const languageMapping = {
  '.cpp': 'cpp',
  '.go': 'go',
  '.java': 'java',
  '.js': 'js',
  '.php': 'php',
  '.proto': 'proto',
  '.py': 'python',
  '.rst': 'rst',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scala': 'scala',
  '.swift': 'swift',
  '.tex': 'latex',
  '.ipynb': 'ipynb'
};

const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath();

module.exports = { languageMapping, baseDir };

