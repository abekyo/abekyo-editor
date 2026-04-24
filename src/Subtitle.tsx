import { debug, info, warn, logError } from '../lib/utils/logger.client';

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

interface SubtitleProps {
  text: string;
}

export const Subtitle: React.FC<SubtitleProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // テキストが空の場合は何も表示しない
  if (!text || !text.trim()) {
    return null;
  }
  
  // frameのバリデーション（NaNを防ぐ）
  const safeFrame = frame && !isNaN(frame) && frame >= 0 ? frame : 0;
  
  // durationInFramesのバリデーション（NaNや0を防ぐ）
  const safeDurationInFrames = durationInFrames && !isNaN(durationInFrames) && durationInFrames > 0 ? durationInFrames : 90; // デフォルト3秒（30fps）
  
  // シンプルなフェードイン/アウト（控えめなアニメーション）
  const fadeInFrames = Math.max(1, Math.min(Math.floor(safeDurationInFrames * 0.1), safeDurationInFrames - 1));
  const fadeOutFrames = Math.max(1, Math.min(Math.floor(safeDurationInFrames * 0.1), safeDurationInFrames - fadeInFrames));
  const fadeOutStart = Math.max(fadeInFrames, Math.min(safeDurationInFrames - fadeOutFrames, safeDurationInFrames - 1));
  
  // すべての値が有限数であることを確認
  const inputRange = [0, fadeInFrames, fadeOutStart, safeDurationInFrames];
  const outputRange = [0, 1, 1, 0];
  
  // NaNチェック
  if (inputRange.some(v => !isFinite(v)) || outputRange.some(v => !isFinite(v))) {
    logError('Subtitle: NaN detected in interpolate ranges', { inputRange, outputRange, safeFrame, safeDurationInFrames });
    return null;
  }
  
  const opacity = interpolate(
    safeFrame,
    inputRange,
    outputRange,
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );


  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
        opacity,
      }}
    >
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          padding: '16px 24px',
          borderRadius: '12px',
          maxWidth: '90%',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <p
          style={{
            color: 'white',
            fontSize: 36,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};

