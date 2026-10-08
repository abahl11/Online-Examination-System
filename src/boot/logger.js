const { createLogger, format, transports } = require('winston');
const settings = require('./settings');

const devLine = format.printf(({ level, message, timestamp, stack, ...extra }) => {
  const meta = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  return `${timestamp} ${level}: ${stack || message}${meta}`;
});

const logger = createLogger({
  level: settings.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    settings.isProduction ? format.json() : format.combine(format.colorize(), devLine)
  ),
  transports: [new transports.Console({ silent: settings.isTest })],
});

logger.httpStream = {
  write: (line) => logger.http(line.trim()),
};

module.exports = logger;
