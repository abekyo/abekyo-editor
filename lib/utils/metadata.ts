/**
 * メタデータ生成用のユーティリティ関数
 */

// ベースURLを取得（NEXT_PUBLIC_BASE_URL未設定時はlocalhostにフォールバック。
// 本番デプロイ時は必ず環境変数でデプロイ先ドメインを指定すること。）
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/**
 * カノニカルURLを生成
 * @param pathname - パス名（例: '/pricing', '/ja/pricing'）
 * @param locale - ロケール（'en' | 'ja'）
 * @returns カノニカルURL
 */
export function generateCanonicalUrl(pathname: string, locale: string = 'en'): string {
  const baseUrl = getBaseUrl();
  
  // パス名を正規化（先頭のスラッシュを保持、末尾のスラッシュを削除）
  let normalizedPath = pathname.trim();
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  // ロケールプレフィックスを処理
  // 日本語の場合は /ja プレフィックスを追加（ルート以外）
  if (locale === 'ja' && normalizedPath !== '/') {
    // 既に /ja プレフィックスがある場合はそのまま
    if (!normalizedPath.startsWith('/ja')) {
      normalizedPath = '/ja' + normalizedPath;
    }
  } else if (locale === 'en') {
    // 英語の場合は /ja プレフィックスを削除
    normalizedPath = normalizedPath.replace(/^\/ja/, '') || '/';
  }
  
  return `${baseUrl}${normalizedPath}`;
}

/**
 * パス名からロケールプレフィックスを削除
 * @param pathname - パス名
 * @returns ロケールプレフィックスを削除したパス名
 */
export function removeLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/ja/, '') || '/';
}

/**
 * パス名にロケールプレフィックスを追加
 * @param pathname - パス名
 * @param locale - ロケール
 * @returns ロケールプレフィックス付きパス名
 */
export function addLocalePrefix(pathname: string, locale: string): string {
  if (locale === 'ja' && pathname !== '/') {
    if (!pathname.startsWith('/ja')) {
      return '/ja' + pathname;
    }
  }
  return pathname;
}

/**
 * hreflangタグ用の言語URLマップを生成
 * @param pathname - パス名（ロケールプレフィックスなし、例: '/pricing'）
 * @returns 言語コードとURLのマップ
 */
export function generateHreflangUrls(pathname: string): Record<string, string> {
  const baseUrl = getBaseUrl();
  
  // パス名を正規化（ロケールプレフィックスを削除）
  let normalizedPath = removeLocalePrefix(pathname);
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  // 英語版と日本語版のURLを生成
  const enUrl = `${baseUrl}${normalizedPath === '/' ? '' : normalizedPath}`;
  const jaUrl = `${baseUrl}${normalizedPath === '/' ? '/ja' : '/ja' + normalizedPath}`;
  
  return {
    'en': enUrl,
    'ja': jaUrl,
    'x-default': enUrl, // デフォルト言語（英語）を指定
  };
}

