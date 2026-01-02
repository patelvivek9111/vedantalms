// Logger utility for consistent logging across the application

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, error?: any, extra?: any): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name, ...(extra || {}) }
      : error ? { ...error, ...(extra || {}) } : extra;
    console.error(this.formatMessage('error', message, errorData));
  }

  logApiError(message: string, error: any, extra?: any): void {
    this.error(message, {
      status: error?.response?.status,
      message: error?.message,
      data: error?.response?.data,
      ...(extra || {})
    });
  }
}

const logger = new Logger();

export default logger;
