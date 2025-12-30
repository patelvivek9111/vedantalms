/**
 * Frontend logging utility
 * Provides consistent logging interface for the frontend application
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.isDevelopment && level === 'debug') {
      return; // Don't log debug messages in production
    }

    const formattedMessage = this.formatMessage(level, message, data);

    switch (level) {
      case 'error':
        console.error(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
    }
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: any, additionalData?: any): void {
    const combinedData = additionalData ? { error, ...additionalData } : error;
    this.log('error', message, combinedData);
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  logApiRequest(method: string, url: string, data?: any): void {
    if (this.isDevelopment) {
      this.debug(`API Request: ${method} ${url}`, data);
    }
  }

  logApiResponse(method: string, url: string, status: number, data?: any): void {
    if (this.isDevelopment) {
      this.debug(`API Response: ${method} ${url} ${status}`, data);
    }
  }

  logApiError(method: string, url: string, error: any): void {
    this.error(`API Error: ${method} ${url}`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
  }
}

const logger = new Logger();
export default logger;

