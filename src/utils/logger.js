const winston = require('winston');
const path = require('path');
const { baseDir } = require('./constants/constants')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(baseDir, 'logs/', 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(baseDir, 'logs/', 'combined.log') }),
    new winston.transports.Console()
  ]
});

console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));

module.exports = logger;
