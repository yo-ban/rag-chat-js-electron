const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { countTokens } = require('./tokenizerUtils');

const splitDocuments = async (docs, chunkSize, overlapPercentage) => {
  const chunkOverlap = Math.floor(chunkSize * (overlapPercentage / 100));

  const splitter = new RecursiveCharacterTextSplitter({
    lengthFunction: countTokens,
    separators: ["\n\n", "\n", "。"],
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
  })

  return await splitter.splitDocuments(docs);
};

const splitDocumentsByLanguage = async (docs, chunkSize, overlapPercentage, language) => {
  console.log(`splitDocumentsByLanguage: ${language}`);
  const chunkOverlap = Math.floor(chunkSize * (overlapPercentage / 100));

  const splitter = RecursiveCharacterTextSplitter.fromLanguage(language, {
    lengthFunction: countTokens,
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
  });

  return await splitter.splitDocuments(docs);
};

const splitMarkdownByHeadings = (markdown) => {
  const sections = markdown.split(/(?=^# )/gm);
  return sections.map(section => section.trim()).filter(section => section.length > 0);
};

module.exports = { splitDocuments, splitDocumentsByLanguage, splitMarkdownByHeadings };
