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
    // Debug logging disabled
  }

  info(message: string, data?: any): void {
    // Info logging disabled
  }

  warn(message: string, data?: any): void {
    // Warn logging disabled
  }

  error(message: string, error?: any, extra?: any): void {
    // Error logging disabled
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
