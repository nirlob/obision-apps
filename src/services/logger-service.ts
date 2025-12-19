import GLib from "@girs/glib-2.0";

export enum LogLevel {
  DEBUG = GLib.LogLevelFlags.LEVEL_DEBUG,
  INFO = GLib.LogLevelFlags.LEVEL_INFO,
  MESSAGE = GLib.LogLevelFlags.LEVEL_MESSAGE,
  WARNING = GLib.LogLevelFlags.LEVEL_WARNING,
  ERROR = GLib.LogLevelFlags.LEVEL_ERROR,
  CRITICAL = GLib.LogLevelFlags.LEVEL_CRITICAL,
}

export class LoggerService {
  private static _instance: LoggerService;
  private readonly APP_ID = 'com.obision.app.optional-soft';

  private constructor() {}

  static get instance(): LoggerService {
    if (!LoggerService._instance) {
      LoggerService._instance = new LoggerService();
    }
    return LoggerService._instance;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Log to console
    const timestamp = new Date().toISOString();
    const levelName = this.getLevelName(level);
    console.log(`[${timestamp}] [${levelName}] ${message}`);
    if (context) {
      console.log('Context:', context);
    }

    // Log to GLib (journald)
    const fields: Record<string, string> = {
      'MESSAGE': message,
      'SYSLOG_IDENTIFIER': 'obision-app-optional-soft',
      'CODE_FILE': context?.file || '',
      'CODE_FUNC': context?.function || '',
    };

    if (context) {
      Object.keys(context).forEach(key => {
        if (key !== 'file' && key !== 'function') {
          fields[`CONTEXT_${key.toUpperCase()}`] = String(context[key]);
        }
      });
    }

    GLib.log_structured(this.APP_ID, level, fields);
  }

  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'DEBUG';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.MESSAGE: return 'MESSAGE';
      case LogLevel.WARNING: return 'WARNING';
      case LogLevel.ERROR: return 'ERROR';
      case LogLevel.CRITICAL: return 'CRITICAL';
      default: return 'UNKNOWN';
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  message(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.MESSAGE, message, context);
  }

  warning(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARNING, message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  critical(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context);
  }
}
