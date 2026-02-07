/**
 * Logger Utility
 * Structured logging for the NOISE trading engine
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  public minLevel: LogLevel;
  private category: string;

  constructor(category: string, minLevel: LogLevel = 'INFO') {
    this.category = category;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(entry: LogEntry): string {
    const date = new Date(entry.timestamp);
    const timeStr = date.toISOString();
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `[${timeStr}] [${entry.level}] [${entry.category}] ${entry.message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category: this.category,
      message,
      context,
      error,
    };

    const formatted = this.formatMessage(entry);

    switch (level) {
      case 'DEBUG':
      case 'INFO':
        // eslint-disable-next-line no-console
        console.log(formatted);
        break;
      case 'WARN':
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      case 'ERROR':
      case 'CRITICAL':
        // eslint-disable-next-line no-console
        console.error(formatted);
        if (error?.stack) /* eslint-disable-next-line no-console */ console.error(error.stack);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('ERROR', message, context, error);
  }

  critical(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('CRITICAL', message, context, error);
  }

  static create(category: string, minLevel?: LogLevel): Logger {
    return new Logger(category, minLevel);
  }
}

// =============================================================================
// Pre-configured Loggers
// =============================================================================

export const log = {
  main: Logger.create('MAIN'),
  signal: Logger.create('SIGNAL'),
  risk: Logger.create('RISK'),
  broker: Logger.create('BROKER'),
  tradovate: Logger.create('TRADOVATE'),
  alpaca: Logger.create('ALPACA'),
  database: Logger.create('DATABASE'),
  api: Logger.create('API'),
  scheduler: Logger.create('SCHEDULER'),
};

// =============================================================================
// Utility Functions
// =============================================================================

export function setLogLevel(level: LogLevel): void {
  Object.values(log).forEach((logger) => {
    (logger as Logger).minLevel = level;
  });
}

export function createLogger(category: string, minLevel?: LogLevel): Logger {
  return Logger.create(category, minLevel);
}
