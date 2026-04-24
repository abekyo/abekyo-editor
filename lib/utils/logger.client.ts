/**
 * クライアント側ロギングユーティリティ
 * ブラウザ環境でのログ出力（開発環境でのみ）
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * デバッグログ（開発環境のみ）
 */
export function debug(message: string, ...args: unknown[]): void {
  if (isDevelopment && typeof window !== 'undefined') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * 情報ログ（開発環境のみ）
 */
export function info(message: string, ...args: unknown[]): void {
  if (isDevelopment && typeof window !== 'undefined') {
    console.log(`[INFO] ${message}`, ...args);
  }
}

/**
 * 警告ログ（開発環境のみ）
 */
export function warn(message: string, ...args: unknown[]): void {
  if (isDevelopment && typeof window !== 'undefined') {
    console.warn(`[WARN] ${message}`, ...args);
  }
}

/**
 * エラーログ（常に出力 - エラーは重要）
 */
export function logError(message: string, ...args: unknown[]): void {
  if (typeof window !== 'undefined') {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

