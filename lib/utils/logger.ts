/**
 * ロギングユーティリティ
 * 本番環境ではログを出力せず、開発環境でのみログを出力
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * ログ出力の設定
 */
interface LoggerConfig {
  enableInProduction?: boolean;
  enableInDevelopment?: boolean;
}

const defaultConfig: LoggerConfig = {
  enableInProduction: false,
  enableInDevelopment: true,
};

/**
 * ログを出力するかどうかを判定
 */
function shouldLog(level: LogLevel, config: LoggerConfig = defaultConfig): boolean {
  if (isDevelopment && config.enableInDevelopment !== false) {
    return true;
  }
  if (isProduction && config.enableInProduction === true) {
    // 本番環境ではERRORとWARNのみ出力（設定されている場合）
    return level === LogLevel.ERROR || level === LogLevel.WARN;
  }
  return false;
}

/**
 * ログメッセージをフォーマット
 */
function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return `${prefix} ${message}`;
}

/**
 * デバッグログ（開発環境のみ）
 */
export function debug(message: string, ...args: unknown[]): void {
  if (shouldLog(LogLevel.DEBUG)) {
    console.log(formatMessage(LogLevel.DEBUG, message), ...args);
  }
}

/**
 * 情報ログ（開発環境のみ）
 */
export function info(message: string, ...args: unknown[]): void {
  if (shouldLog(LogLevel.INFO)) {
    console.log(formatMessage(LogLevel.INFO, message), ...args);
  }
}

/**
 * 警告ログ（開発環境のみ、本番環境でも出力可能）
 */
export function warn(message: string, ...args: unknown[]): void {
  if (shouldLog(LogLevel.WARN)) {
    console.warn(formatMessage(LogLevel.WARN, message), ...args);
  }
}

/**
 * エラーログ（開発環境のみ、本番環境でも出力可能）
 */
export function logError(message: string, ...args: unknown[]): void {
  if (shouldLog(LogLevel.ERROR)) {
    console.error(formatMessage(LogLevel.ERROR, message), ...args);
  }
}

/**
 * 条件付きログ（カスタム条件でログを出力）
 */
export function logIf(condition: boolean, level: LogLevel, message: string, ...args: unknown[]): void {
  if (condition && shouldLog(level)) {
    switch (level) {
      case LogLevel.DEBUG:
        debug(message, ...args);
        break;
      case LogLevel.INFO:
        info(message, ...args);
        break;
      case LogLevel.WARN:
        warn(message, ...args);
        break;
      case LogLevel.ERROR:
        logError(message, ...args);
        break;
    }
  }
}

/**
 * ログを完全に無効化（テスト用）
 */
export function disableLogging(): void {
  // 何もしない（ログを無効化）
}

/**
 * ログを有効化（テスト用）
 */
export function enableLogging(): void {
  // 何もしない（デフォルトで有効）
}

