import { LogLevel, LogEntry } from '@shared/types';

export class Logger {
  private context: string;
  private static logLevel: LogLevel = 'info';
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000;

  constructor(context: string) {
    this.context = context;
  }

  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  static getLogs(): LogEntry[] {
    return [...Logger.logs];
  }

  static clearLogs(): void {
    Logger.logs = [];
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, undefined, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, undefined, metadata);
  }

  warn(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('warn', message, error, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, error, metadata);
  }

  private log(level: LogLevel, message: string, error?: Error, metadata?: Record<string, any>): void {
    // Vérifier le niveau de log
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      error,
      metadata,
    };

    // Ajouter au buffer interne
    Logger.logs.push(logEntry);
    
    // Maintenir la taille du buffer
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs = Logger.logs.slice(-Logger.maxLogs);
    }

    // Log vers la console
    this.logToConsole(logEntry);

    // En production, on pourrait aussi envoyer vers un service de logging
    if (process.env.NODE_ENV === 'production') {
      this.logToFile(logEntry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[Logger.logLevel];
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.context}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.metadata);
        break;
      case 'info':
        console.info(message, entry.metadata);
        break;
      case 'warn':
        console.warn(message, entry.error, entry.metadata);
        break;
      case 'error':
        console.error(message, entry.error, entry.metadata);
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    // TODO: Implémenter la sauvegarde vers un fichier
    // Pour l'instant, on utilise uniquement la console
  }
}

// Logger par défaut pour l'application
export const defaultLogger = new Logger('App');