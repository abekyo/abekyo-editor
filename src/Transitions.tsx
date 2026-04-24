import { debug, info, warn, logError } from '../lib/utils/logger.client';

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { TransitionType } from './types';

interface TransitionProps {
  children: React.ReactNode;
  type: TransitionType;
  durationInFrames: number;
  direction?: 'in' | 'out';
}

/**
 * トランジションエフェクトコンポーネント
 */
export const Transition: React.FC<TransitionProps> = ({
  children,
  type,
  durationInFrames,
  direction = 'in',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // frameのバリデーション（NaNを防ぐ）
  const safeFrame = frame && !isNaN(frame) && frame >= 0 ? frame : 0;

  // durationInFramesのバリデーション（NaNや0を防ぐ）
  const safeDurationInFrames = durationInFrames && !isNaN(durationInFrames) && durationInFrames > 0 ? durationInFrames : 1;

  // 入力範囲と出力範囲のバリデーション
  const inputRange = [0, safeDurationInFrames];
  const outputRange = direction === 'in' ? [0, 1] : [1, 0];
  
  // NaNチェック
  if (inputRange.some(v => !isFinite(v)) || outputRange.some(v => !isFinite(v))) {
    logError('Transition: NaN detected in interpolate ranges', { inputRange, outputRange, safeFrame, safeDurationInFrames });
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // トランジションの進行度（0から1）
  const progress = interpolate(
    safeFrame,
    inputRange,
    outputRange,
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );

  let style: React.CSSProperties = {};

  switch (type) {
    case 'none':
      style = {
        opacity: 1,
      };
      break;

    case 'fade':
      style = {
        opacity: progress,
      };
      break;

    case 'crossfade':
      style = {
        opacity: progress,
      };
      break;

    case 'slideLeft':
      style = {
        transform: `translateX(${direction === 'in' ? (progress - 1) * 100 : progress * 100}%)`,
        opacity: progress,
      };
      break;

    case 'slideRight':
      style = {
        transform: `translateX(${direction === 'in' ? (1 - progress) * 100 : progress * -100}%)`,
        opacity: progress,
      };
      break;

    case 'slideUp':
      style = {
        transform: `translateY(${direction === 'in' ? (1 - progress) * 100 : progress * -100}%)`,
        opacity: progress,
      };
      break;

    case 'slideDown':
      style = {
        transform: `translateY(${direction === 'in' ? (progress - 1) * 100 : progress * 100}%)`,
        opacity: progress,
      };
      break;

    case 'slide':
      // 後方互換性のため、slideRightと同じ動作
      style = {
        transform: `translateX(${direction === 'in' ? (1 - progress) * 100 : progress * -100}%)`,
        opacity: progress,
      };
      break;

    case 'zoomIn':
      const scaleIn = direction === 'in' ? 0.5 + progress * 0.5 : 1 - progress * 0.5;
      style = {
        transform: `scale(${scaleIn})`,
        opacity: progress,
      };
      break;

    case 'zoomOut':
      const scaleOut = direction === 'in' ? 1.5 - progress * 0.5 : 1 + progress * 0.5;
      style = {
        transform: `scale(${scaleOut})`,
        opacity: progress,
      };
      break;

    case 'zoom':
      // 後方互換性のため、zoomInと同じ動作
      const scale = direction === 'in' ? 0.8 + progress * 0.2 : 1 - progress * 0.2;
      style = {
        transform: `scale(${scale})`,
        opacity: progress,
      };
      break;

    case 'blur':
      const blur = direction === 'in' ? (1 - progress) * 10 : progress * 10;
      style = {
        filter: `blur(${blur}px)`,
        opacity: progress,
      };
      break;

    case 'wipeLeft':
      style = {
        clipPath: direction === 'in' 
          ? `inset(0 ${(1 - progress) * 100}% 0 0)`
          : `inset(0 0 0 ${progress * 100}%)`,
        opacity: progress,
      };
      break;

    case 'wipeRight':
      style = {
        clipPath: direction === 'in' 
          ? `inset(0 0 0 ${(1 - progress) * 100}%)`
          : `inset(0 ${progress * 100}% 0 0)`,
        opacity: progress,
      };
      break;

    case 'wipe':
      // 後方互換性のため、wipeLeftと同じ動作
      style = {
        clipPath: direction === 'in' 
          ? `inset(0 ${(1 - progress) * 100}% 0 0)`
          : `inset(0 0 0 ${progress * 100}%)`,
        opacity: progress,
      };
      break;
  }

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * クリップ間のトランジション
 * トランジションはシーケンスの頭（開始部分）にのみ適用され、お尻（終了部分）には適用されません
 * トランジション期間が終わった後は完全に表示されます
 */
interface ClipTransitionProps {
  children: React.ReactNode;
  transitionType: TransitionType;
  transitionDuration: number; // 秒
}

export const ClipTransition: React.FC<ClipTransitionProps> = ({
  children,
  transitionType,
  transitionDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // fpsとtransitionDurationのバリデーション
  const safeFps = fps && !isNaN(fps) && fps > 0 ? fps : 30;
  const safeTransitionDuration = transitionDuration && !isNaN(transitionDuration) && transitionDuration > 0 ? transitionDuration : 0.2;
  const transitionFrames = Math.max(1, Math.floor(safeTransitionDuration * safeFps));
  
  // シーンの全期間を取得
  const safeDurationInFrames = durationInFrames && !isNaN(durationInFrames) && durationInFrames > 0 ? durationInFrames : 90;
  
  // frameのバリデーション
  const safeFrame = frame && !isNaN(frame) && frame >= 0 ? frame : 0;
  
  // トランジションの進行度（最初のtransitionFramesの間だけ0から1に変化、その後は1のまま）
  // シーケンスの頭（開始部分）にのみ適用
  const transitionProgress = Math.min(1, safeFrame / transitionFrames);
  
  // トランジションタイプが'none'の場合は何もせずに表示
  if (transitionType === 'none') {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  
  let style: React.CSSProperties = {};

  // トランジション中（シーケンスの頭）のみスタイルを適用
  if (transitionProgress < 1) {
    switch (transitionType) {
      case 'fade':
      case 'crossfade':
        style = {
          opacity: transitionProgress,
        };
        break;

      case 'slideLeft':
        style = {
          transform: `translateX(${(1 - transitionProgress) * -100}%)`,
          opacity: transitionProgress,
        };
        break;

      case 'slideRight':
        style = {
          transform: `translateX(${(1 - transitionProgress) * 100}%)`,
          opacity: transitionProgress,
        };
        break;

      case 'slideUp':
        style = {
          transform: `translateY(${(1 - transitionProgress) * -100}%)`,
          opacity: transitionProgress,
        };
        break;

      case 'slideDown':
        style = {
          transform: `translateY(${(1 - transitionProgress) * 100}%)`,
          opacity: transitionProgress,
        };
        break;

      case 'slide':
        // 後方互換性のため、slideRightと同じ動作
        style = {
          transform: `translateX(${(1 - transitionProgress) * 100}%)`,
          opacity: transitionProgress,
        };
        break;

      case 'zoomIn':
        const scaleIn = 0.5 + transitionProgress * 0.5;
        style = {
          transform: `scale(${scaleIn})`,
          opacity: transitionProgress,
        };
        break;

      case 'zoomOut':
        const scaleOut = 1.5 - transitionProgress * 0.5;
        style = {
          transform: `scale(${scaleOut})`,
          opacity: transitionProgress,
        };
        break;

      case 'zoom':
        // 後方互換性のため、zoomInと同じ動作
        const scale = 0.8 + transitionProgress * 0.2;
        style = {
          transform: `scale(${scale})`,
          opacity: transitionProgress,
        };
        break;

      case 'blur':
        const blur = (1 - transitionProgress) * 10;
        style = {
          filter: `blur(${blur}px)`,
          opacity: transitionProgress,
        };
        break;

      case 'wipeLeft':
        style = {
          clipPath: `inset(0 ${(1 - transitionProgress) * 100}% 0 0)`,
        };
        break;

      case 'wipeRight':
        style = {
          clipPath: `inset(0 0 0 ${(1 - transitionProgress) * 100}%)`,
        };
        break;

      case 'wipe':
        // 後方互換性のため、wipeLeftと同じ動作
        style = {
          clipPath: `inset(0 ${(1 - transitionProgress) * 100}% 0 0)`,
        };
        break;

      default:
        // デフォルトはフェード
        style = {
          opacity: transitionProgress,
        };
        break;
    }
  } else {
    // トランジション後（シーケンスの残り部分）は完全に表示
    // スタイルをリセットして通常表示
    style = {};
  }

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
};

