import { Injectable } from '@nestjs/common';
import { LoggerService } from '@nestjs/common';

enum LogLevel {
  LOG = 'LOG',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG',
  VERBOSE = 'VERBOSE',
}

const ANSI = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m',
} as const;

const LEVEL_COLOR: Record<LogLevel, string> = {
  [LogLevel.LOG]: ANSI.GREEN,
  [LogLevel.ERROR]: ANSI.RED,
  [LogLevel.WARN]: ANSI.YELLOW,
  [LogLevel.DEBUG]: ANSI.WHITE,
  [LogLevel.VERBOSE]: ANSI.WHITE,
};

@Injectable()
export class AppLoggerService implements LoggerService {
  /**
   * Builds a colorized log line in the format `datetime[context]: message`.
   * @param level - Log level used to pick the ANSI color.
   * @param message - Value to print.
   * @param context - Optional service/context label shown in brackets.
   */
  private formatMessage(level: LogLevel, message: unknown, context?: string): string {
    const datetime = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    const color = LEVEL_COLOR[level];
    return `${color}${datetime}${ctx}: ${message}${ANSI.RESET}\n`;
  }

  /**
   * Logs an informational message in green.
   * @param message - Message to log.
   * @param context - Optional context/service name.
   */
  log(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage(LogLevel.LOG, message, context));
  }

  /**
   * Logs an error message in red with optional stack trace.
   * NestJS calls `error(message, stack, context)` internally, so the second
   * argument is treated as a stack trace when a third argument is present,
   * and as a context name otherwise.
   * @param message - Error description.
   * @param traceOrContext - Stack trace, or context name when no trace is provided.
   * @param context - Context name when a stack trace is passed as the second argument.
   */
  error(message: unknown, traceOrContext?: string, context?: string): void {
    const ctx = context ?? traceOrContext;
    const trace = context ? traceOrContext : undefined;

    process.stdout.write(this.formatMessage(LogLevel.ERROR, message, ctx));

    if (trace) {
      process.stdout.write(this.formatMessage(LogLevel.ERROR, trace, ctx));
    }
  }

  /**
   * Logs a warning message in yellow.
   * @param message - Warning message.
   * @param context - Optional context/service name.
   */
  warn(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage(LogLevel.WARN, message, context));
  }

  /**
   * Logs a debug message in white.
   * @param message - Debug message.
   * @param context - Optional context/service name.
   */
  debug(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage(LogLevel.DEBUG, message, context));
  }

  /**
   * Logs a verbose/trace message in white.
   * @param message - Verbose message.
   * @param context - Optional context/service name.
   */
  verbose(message: unknown, context?: string): void {
    process.stdout.write(this.formatMessage(LogLevel.VERBOSE, message, context));
  }
}
