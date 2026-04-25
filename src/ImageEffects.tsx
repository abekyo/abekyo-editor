import { debug, info, warn, logError } from '../lib/utils/logger.client';

import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
} from 'remotion';

interface ImageEffectsProps {
  imageUrl: string;
  effect?: 'zoom' | 'pan' | 'kenBurns' | 'zoomOut' | 'pulse' | 'none';
  scale?: number; // 画像のスケール（1.0 = 100%, 0.5 = 50%, 2.0 = 200%）
  position?: { x: number; y: number }; // 画像の位置（%で指定）
}

// Treat a clip's primary visual asset as a video when its URL points at a
// known container extension. VideoClip.imageUrl is name-misleading — it now
// carries either an image or a video path — but renaming it would ripple
// across hundreds of call sites, so we dispatch here.
function isVideoAsset(url: string): boolean {
  const m = url.toLowerCase().split('?')[0].match(/\.([a-z0-9]+)$/);
  if (!m) return false;
  return ['mp4', 'mov', 'm4v', 'webm', 'ogv'].includes(m[1]);
}

// Resolve a clip URL to a Remotion-usable src. Mirrors the image path logic
// below so video and image resolution stay consistent. Returns '' if the URL
// is an external/non-public path that Remotion Player cannot load.
function resolveAssetSrc(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const u = new URL(url);
      const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      const isPublicPath = u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/gold/');
      if (isLocalhost && isPublicPath) {
        return staticFile(u.pathname.replace(/^\//, ''));
      }
      return '';
    } catch {
      return '';
    }
  }
  if (url.startsWith('/')) return staticFile(url.slice(1));
  return staticFile(url);
}

/**
 * Minimal video renderer that matches the scale/position contract of
 * ImageWithEffects. We intentionally skip the Ken Burns / zoom / pan
 * animations here — they were designed for still images, and stacking them
 * on already-moving footage tends to look off. Audio is muted because each
 * clip has its own narration channel; unmuting would fight with it.
 */
const VideoForClip: React.FC<{ url: string; scale: number; position: { x: number; y: number } }> = ({
  url,
  scale,
  position,
}) => {
  const src = resolveAssetSrc(url);
  if (!src) {
    warn('[VideoForClip] 動画URLをRemotionで解決できません:', url);
    return (
      <AbsoluteFill style={{ backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#ff6b6b', fontSize: 14 }}>⚠️ Unable to load video</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <OffthreadVideo
        src={src}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${position.x}%, ${position.y}%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * 画像エフェクトコンポーネント
 */
export const ImageWithEffects: React.FC<ImageEffectsProps> = ({
  imageUrl,
  effect = 'none', // デフォルトはエフェクトなし（控えめに）
  scale = 1.0, // デフォルトは100%
  position = { x: 0, y: 0 }, // デフォルトは中央
}) => {
  // Hooks must run on every render in the same order — call them up-front
  // before any conditional return path. The values are only used by the
  // image animation branch below, but invoking them unconditionally keeps
  // the React Hooks contract intact for the early returns above and below.
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Video clips (MP4 / MOV / WebM / …) go through OffthreadVideo instead of
  // Img. All other scale/position semantics stay identical.
  if (imageUrl && isVideoAsset(imageUrl)) {
    return <VideoForClip url={imageUrl} scale={scale} position={position} />;
  }

  // 画像URLが空の場合は何も表示しない
  if (!imageUrl || imageUrl.trim() === '') {
    warn('[ImageWithEffects] ⚠️ 画像URLが設定されていません:', imageUrl);
    return (
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#666', fontSize: 14 }}>No image set</div>
      </AbsoluteFill>
    );
  }

  // frameのバリデーション（NaNを防ぐ）
  const safeFrame = frame && !isNaN(frame) && frame >= 0 ? frame : 0;

  // durationInFramesのバリデーション（NaNや0を防ぐ）
  const safeDurationInFrames = durationInFrames && !isNaN(durationInFrames) && durationInFrames > 0 ? durationInFrames : 90; // デフォルト3秒（30fps）

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover', // contain → coverに変更（画像が画面全体を覆うように）
    transformOrigin: 'center center', // 変換の基準点を中央に設定
  };

  switch (effect) {
    case 'zoom':
      // 控えめなズームイン
      {
      const inputRangeZoom = [0, safeDurationInFrames];
      const outputRangeZoom = [1, 1.1];
        if (inputRangeZoom.every((v) => isFinite(v)) && outputRangeZoom.every((v) => isFinite(v))) {
          const zoomScale = interpolate(safeFrame, inputRangeZoom, outputRangeZoom, {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.ease,
          });
          if (isFinite(zoomScale)) {
            const finalScale = scale * zoomScale;
            // transform-originを考慮して、translateを先に適用
            style.transform = `translate(${position.x}%, ${position.y}%) scale(${finalScale})`;
        }
        }
      }
      break;

    case 'pan':
      // 控えめなパン
      {
      const inputRangePan = [0, safeDurationInFrames];
      const outputRangePan = [-5, 5];
        if (inputRangePan.every((v) => isFinite(v)) && outputRangePan.every((v) => isFinite(v))) {
          const panX = interpolate(safeFrame, inputRangePan, outputRangePan, {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.ease),
          });
          if (isFinite(panX)) {
            // transform-originを考慮して、translateを先に適用
            style.transform = `translate(${position.x + panX}%, ${position.y}%) scale(${scale})`;
        }
        }
      }
      break;

    case 'kenBurns':
      // 控えめなケンブーンズ効果
      {
      const inputRangeKenBurns = [0, safeDurationInFrames];
        if (inputRangeKenBurns.every((v) => isFinite(v))) {
          const kenBurnsScale = interpolate(safeFrame, inputRangeKenBurns, [1, 1.15], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.ease,
          });
          const kenBurnsX = interpolate(safeFrame, inputRangeKenBurns, [0, -3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.ease,
          });
          const kenBurnsY = interpolate(safeFrame, inputRangeKenBurns, [0, -2], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.ease,
          });
          if (isFinite(kenBurnsScale) && isFinite(kenBurnsX) && isFinite(kenBurnsY)) {
            const finalScale = scale * kenBurnsScale;
            // transform-originを考慮して、translateを先に適用
            style.transform = `translate(${position.x + kenBurnsX}%, ${position.y + kenBurnsY}%) scale(${finalScale})`;
        }
        }
      }
      break;

    case 'zoomOut':
      // 控えめなズームアウト
      {
      const inputRangeZoomOut = [0, safeDurationInFrames];
      const outputRangeZoomOut = [1.1, 1];
        if (inputRangeZoomOut.every((v) => isFinite(v)) && outputRangeZoomOut.every((v) => isFinite(v))) {
          const zoomOutScale = interpolate(safeFrame, inputRangeZoomOut, outputRangeZoomOut, {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.ease,
          });
          if (isFinite(zoomOutScale)) {
            const finalScale = scale * zoomOutScale;
            // transform-originを考慮して、translateを先に適用
            style.transform = `translate(${position.x}%, ${position.y}%) scale(${finalScale})`;
        }
        }
      }
      break;

    case 'pulse':
      // 控えめなパルス効果
      {
      if (isFinite(safeFrame)) {
        const pulseScale = 1 + Math.sin(safeFrame * 0.1) * 0.03;
        if (isFinite(pulseScale)) {
            const finalScale = scale * pulseScale;
            // transform-originを考慮して、translateを先に適用
            style.transform = `translate(${position.x}%, ${position.y}%) scale(${finalScale})`;
          }
        }
      }
      break;

    case 'none':
    default:
      // transform-originを考慮して、translateを先に適用
      style.transform = `translate(${position.x}%, ${position.y}%) scale(${scale})`;
      break;
  }

  // 画像URLの処理（BGMや音声と同様の処理）
  // クライアント側（プレビュー）とサーバー側（レンダリング）で分岐
  let imageSrc: string;
  
  debug('[ImageWithEffects] 画像URL処理 (before):', {
    original: imageUrl,
    isServer: typeof window === 'undefined',
  });
  
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // 絶対URLの場合
    // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
    // 外部URLは直接使用できないため、localhost:3000のURLでpublicディレクトリに存在するパスのみ使用可能
    try {
      const url = new URL(imageUrl);
      const hostname = url.hostname;
      const relativePath = url.pathname; // /uploads/... または /gold/... または /masuyone/...
      
      // localhost:3000のURLで、publicディレクトリに存在するパスの場合のみstaticFile()を使用
      // /uploads/... または /gold/... で始まるパスのみstaticFile()を使用
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isPublicPath = relativePath.startsWith('/uploads/') || relativePath.startsWith('/gold/');
      
      if (isLocalhost && isPublicPath) {
        // staticFileはpublicディレクトリからの相対パスを期待
        // /uploads/... → uploads/... (先頭の/を削除)
        const staticPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        imageSrc = staticFile(staticPath);
        debug('[ImageWithEffects] 画像URL→staticFile (public path):', {
          original: imageUrl,
          pathname: relativePath,
          staticPath: staticPath,
          final: imageSrc,
          isServer: typeof window === 'undefined',
        });
      } else {
        // 外部URLまたはpublicディレクトリに存在しないパスの場合
        // Remotion Playerは外部URLを直接使用できないため、警告を表示
        warn('[ImageWithEffects] ⚠️ 外部URLまたはpublic外のパスはRemotion Playerで使用できません:', {
          original: imageUrl,
          hostname,
          pathname: relativePath,
          isLocalhost,
          isPublicPath,
          message: 'Remotion Playerでは、publicディレクトリ内のファイルのみ使用可能です。外部URLを使用する場合は、Next.jsのAPIルート経由でプロキシするか、publicディレクトリにコピーしてください。',
        });
        // エラー表示用のプレースホルダー
        imageSrc = ''; // 空文字列にして、エラー表示をImageWithEffects内で行う
      }
    } catch (e) {
      // URL解析に失敗した場合はエラーをログに記録
      logError('[ImageWithEffects] 画像URLの解析に失敗:', imageUrl, e);
      // フォールバック: エラー表示
      imageSrc = '';
    }
  } else if (imageUrl.startsWith('/')) {
    // 相対パス（/で始まる）の場合
    // RemotionのImgコンポーネントは、クライアント側でもstaticFile()を使用する必要がある
    // /uploads/... → uploads/... (先頭の/を削除)
    imageSrc = staticFile(imageUrl.slice(1));
    debug('[ImageWithEffects] 画像相対パス→staticFile:', {
      original: imageUrl,
      staticPath: imageUrl.slice(1),
      final: imageSrc,
      isServer: typeof window === 'undefined',
    });
  } else {
    // /で始まらない相対パスの場合はstaticFileを使用
    imageSrc = staticFile(imageUrl);
    debug('[ImageWithEffects] 画像相対パス (先頭/なし):', {
      original: imageUrl,
      final: imageSrc,
    });
  }
  
  debug('[ImageWithEffects] 画像URL処理 (after):', {
    original: imageUrl,
    final: imageSrc,
    isServer: typeof window === 'undefined',
  });
  
  // imageSrcが空の場合はエラーメッセージを表示
  if (!imageSrc || imageSrc.trim() === '') {
    warn('[ImageWithEffects] ⚠️ 画像URLが無効なため、エラーメッセージを表示します:', {
      original: imageUrl,
      processed: imageSrc,
    });
    return (
      <AbsoluteFill style={{ 
        overflow: 'hidden',
        backgroundColor: '#1e1e1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ 
          color: '#ff6b6b', 
          fontSize: 14,
          textAlign: 'center',
          padding: '20px',
          maxWidth: '80%',
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>⚠️ Unable to load image</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Remotion Player can only use files inside the public directory.
            <br />
            To use an external URL, proxy it through a Next.js API route
            <br />
            or copy the file into the public directory.
          </div>
          {imageUrl && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', wordBreak: 'break-all' }}>
              URL: {imageUrl}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }
  
  // 適用されるスタイルをログ出力（デバッグ用）
  debug('[ImageWithEffects] 適用されるスタイル:', {
    effect,
    scale,
    position,
    transform: style.transform,
    objectFit: style.objectFit,
    transformOrigin: style.transformOrigin,
  });

  return (
    <AbsoluteFill style={{ 
      overflow: 'visible', // hidden → visibleに変更（画像が切り取られないように）
      backgroundColor: '#1e1e1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Img
        src={imageSrc}
        style={{
          ...style,
          // 画像が確実に表示されるように、最小サイズを設定
          minWidth: '100%',
          minHeight: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

