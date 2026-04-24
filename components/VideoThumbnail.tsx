'use client';

import { debug, info, warn, logError } from '@/lib/utils/logger.client';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface VideoThumbnailProps {
  videoUrl: string;
  className?: string;
  alt?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 動画からサムネイル画像を生成して表示するコンポーネント
 */
export function VideoThumbnail({ videoUrl, className = '', alt, onLoad, onError }: VideoThumbnailProps) {
  const t = useTranslations('thumbnail');
  const resolvedAlt = alt ?? t('defaultAlt');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!videoUrl || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const generateThumbnail = () => {
      try {
        // 動画の現在位置を0秒に設定
        video.currentTime = 0;
      } catch (error) {
        logError('Error setting video currentTime:', error);
        setHasError(true);
        setIsLoading(false);
        onError?.();
      }
    };

    const captureFrame = () => {
      try {
        // キャンバスのサイズを動画のサイズに合わせる
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;

        // キャンバスに動画のフレームを描画
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // キャンバスから画像データを取得
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
          onLoad?.();
        }
      } catch (error) {
        logError('Error capturing frame:', error);
        setHasError(true);
        setIsLoading(false);
        onError?.();
      }
    };

    const handleLoadedMetadata = () => {
      generateThumbnail();
    };

    const handleSeeked = () => {
      captureFrame();
    };

    const handleError = () => {
      logError('Video load error');
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };

    // イベントリスナーを追加
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // 動画を読み込む
    video.load();

    // クリーンアップ
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl, onLoad, onError]);

  // エラー状態
  if (hasError) {
    return (
      <div className={`${className} bg-gradient-to-br from-gray-800/30 to-gray-900/30 flex items-center justify-center`}>
        <span className="text-4xl">🎬</span>
      </div>
    );
  }

  // ローディング状態
  if (isLoading || !thumbnailUrl) {
    return (
      <div className={`${className} bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // サムネイル画像を表示
  return (
    <>
      {/* 非表示のvideo要素とcanvas要素 */}
      <video
        ref={videoRef}
        src={videoUrl}
        preload="metadata"
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* サムネイル画像 */}
      <img
        src={thumbnailUrl}
        alt={resolvedAlt}
        className={className}
        style={{ objectFit: 'cover' }}
      />
    </>
  );
}

