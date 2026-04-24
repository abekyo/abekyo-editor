import { debug, warn } from '@/lib/utils/logger';

/**
 * Remotion Player用のURL変換フック
 *
 * OSS版：
 * - ユーザーがアップロードしたファイルは `/api/upload` 経由で `/uploads/` 配下に保存されている
 * - そのためURL変換は不要で、入力URLをそのまま返す（pass-through）
 * - 外部URL（http(s)://）が渡された場合は警告ログのみ出す
 */

import { useState, useEffect, useRef } from 'react';

interface UrlConverterOptions {
  token?: string | null;
}

function isRemotionCompatibleUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('/uploads/') || url.startsWith('/gold/')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
      const isPublicPath = urlObj.pathname.startsWith('/uploads/') || urlObj.pathname.startsWith('/gold/');
      return isLocalhost && isPublicPath;
    } catch {
      return false;
    }
  }
  return false;
}

function passthrough(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!isRemotionCompatibleUrl(url)) {
    warn('[useUrlConverter] 外部URLはRemotion Playerで直接再生できない可能性があります:', url);
  }
  return url;
}

export function useUrlConverter(
  imageUrls: (string | null | undefined)[],
  bgmUrl: string | null | undefined,
  audioUrls: (string | null | undefined)[],
  _options: UrlConverterOptions = {}
) {
  const [convertedImageUrls, setConvertedImageUrls] = useState<(string | null)[]>([]);
  const [convertedBgmUrl, setConvertedBgmUrl] = useState<string | null>(null);
  const [convertedAudioUrls, setConvertedAudioUrls] = useState<(string | null)[]>([]);
  const isLoading = false;
  const error: string | null = null;

  const imageKey = imageUrls.join(',');
  const audioKey = audioUrls.join(',');
  const firstRun = useRef(true);

  useEffect(() => {
    setConvertedImageUrls(imageUrls.map(passthrough));
    setConvertedBgmUrl(passthrough(bgmUrl));
    setConvertedAudioUrls(audioUrls.map(passthrough));
    if (firstRun.current) {
      debug('[useUrlConverter] pass-throughモードで初期化');
      firstRun.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey, bgmUrl, audioKey]);

  return {
    convertedImageUrls,
    convertedBgmUrl,
    convertedAudioUrls,
    isLoading,
    error,
  };
}
