/**
 * Logger Utility
 * 
 * Centralized logging system for the application
 * Replaces console.log/error/warn with proper logging levels
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Database error', error);
 *   logger.warn('Deprecated API used');
 *   logger.debug('Debug information');
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(colors);

// Define which logs to show based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define log format
const format = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Colorize output for console
  winston.format.colorize({ all: true }),
  // Define format of the message
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports (where logs go)
const transports = [
  // Console transport (always enabled)
  new winston.transports.Console({
    format: format,
  }),
];

// Add file transport in production for error logs
if (process.env.NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, '..', 'logs');
  const fs = require('fs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create a stream object for Morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods for common logging patterns
logger.logRequest = (req, res, responseTime) => {
  logger.http(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
};

logger.logError = (error, context = {}) => {
  // Handle different error types
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorStack = error?.stack || (error instanceof Error ? error.stack : undefined);
  
  logger.error(errorMessage, {
    error: errorMessage,
    stack: errorStack,
    ...context,
  });
};

logger.logDatabase = (operation, details = {}) => {
  logger.debug(`Database ${operation}`, details);
};

logger.logAuth = (action, userId, details = {}) => {
  logger.info(`Auth ${action}`, { userId, ...details });
};

logger.logFileUpload = (filename, size, details = {}) => {
  logger.info(`File uploaded: ${filename}`, { size, ...details });
};

module.exports = logger;

