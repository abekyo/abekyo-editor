import { debug, info, warn, logError } from '../lib/utils/logger.client';

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { Subtitle } from './types';

interface TimeBasedSubtitleProps {
  subtitles: Subtitle[];
  totalDuration: number; // 動画の総時間（秒）
}

/**
 * 時間ベースの字幕を表示するコンポーネント
 * 現在の時間に応じて適切な字幕を表示します
 */
export const TimeBasedSubtitle: React.FC<TimeBasedSubtitleProps> = ({ subtitles, totalDuration }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  // 現在の時間を計算（秒）
  const currentTime = frame / (fps || 30);
  
  // デバッグログ（最初のフレームと定期的に出力）
  if (frame === 0 || frame % 30 === 0) {
    debug('[TimeBasedSubtitle] Frame:', frame, 'Time:', currentTime.toFixed(2), 's', {
      totalDuration,
      subtitlesCount: subtitles.length,
      subtitles: subtitles.map(s => ({
        id: s.id,
        text: s.text?.substring(0, 20) || '',
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
  }
  
  // 現在の時間に表示すべき字幕を検索
  const activeSubtitle = subtitles.find(
    (subtitle) => currentTime >= subtitle.startTime && currentTime < subtitle.endTime
  );
  
  // デバッグログ（アクティブな字幕が見つかった場合）
  if (activeSubtitle && (frame === 0 || frame % 30 === 0)) {
    debug('[TimeBasedSubtitle] Active subtitle:', {
      id: activeSubtitle.id,
      text: activeSubtitle.text?.substring(0, 30) || '',
      startTime: activeSubtitle.startTime,
      endTime: activeSubtitle.endTime,
      currentTime: currentTime.toFixed(2),
    });
  }
  
  // 字幕が存在しない場合は何も表示しない
  if (!activeSubtitle) {
    return null;
  }
  
  // 字幕の表示時間を計算
  const subtitleDuration = activeSubtitle.endTime - activeSubtitle.startTime;
  const subtitleStartFrame = Math.floor(activeSubtitle.startTime * (fps || 30));
  const subtitleEndFrame = Math.floor(activeSubtitle.endTime * (fps || 30));
  const subtitleDurationInFrames = subtitleEndFrame - subtitleStartFrame;
  
  // 現在のフレームを字幕の開始フレームからの相対位置に変換
  const relativeFrame = frame - subtitleStartFrame;
  
  // フェードイン/アウトの計算
  const fadeInFrames = Math.max(1, Math.min(Math.floor(subtitleDurationInFrames * 0.1), subtitleDurationInFrames - 1));
  const fadeOutFrames = Math.max(1, Math.min(Math.floor(subtitleDurationInFrames * 0.1), subtitleDurationInFrames - fadeInFrames));
  const fadeOutStart = Math.max(fadeInFrames, Math.min(subtitleDurationInFrames - fadeOutFrames, subtitleDurationInFrames - 1));
  
  // 透明度の計算
  const opacity = interpolate(
    relativeFrame,
    [0, fadeInFrames, fadeOutStart, subtitleDurationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );
  
  // 位置の計算（パーセンテージベース）
  // positionYPercent, positionXPercentが指定されている場合はそれを使用
  // それ以外は従来のposition/alignを使用（後方互換性）
  
  let positionY: number;
  let positionX: number;
  
  if (activeSubtitle.positionYPercent !== undefined) {
    // パーセンテージベースの位置指定（上から）
    // 10%の余白を確保（最小10%、最大90%）
    const clampedYPercent = Math.max(10, Math.min(90, activeSubtitle.positionYPercent));
    positionY = (clampedYPercent / 100) * height;
  } else {
    // 従来のposition指定（後方互換性）
    const position = activeSubtitle.position || 'bottom';
    if (position === 'top') {
      positionY = 0.1 * height; // 上から10%
    } else if (position === 'center') {
      positionY = 0.5 * height; // 中央
    } else {
      positionY = 0.9 * height; // 下から10%（上から90%）
    }
  }
  
  if (activeSubtitle.positionXPercent !== undefined) {
    // パーセンテージベースの位置指定（左から）
    // 10%の余白を確保（最小10%、最大90%）
    const clampedXPercent = Math.max(10, Math.min(90, activeSubtitle.positionXPercent));
    positionX = (clampedXPercent / 100) * width;
  } else {
    // 従来のalign指定（後方互換性）
    const align = activeSubtitle.align || 'center';
    if (align === 'left') {
      positionX = 0.1 * width; // 左から10%
    } else if (align === 'center') {
      positionX = 0.5 * width; // 中央
    } else {
      positionX = 0.9 * width; // 右から10%（左から90%）
    }
  }
  
  // 絶対位置指定のため、flexboxではなくabsolute positioningを使用
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${positionY}px`,
    left: `${positionX}px`,
    transform: 'translate(-50%, -50%)', // 中央揃え
  };
  
  // 背景色の解析（undefined、null、空文字列、'transparent'の場合は背景なし）
  const hasBackground = activeSubtitle.backgroundColor 
    && activeSubtitle.backgroundColor.trim() !== ''
    && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent';
  const backgroundColor = hasBackground ? activeSubtitle.backgroundColor : undefined;
  
  // フォントサイズの計算（パーセンテージベース）
  let fontSizePx: number;
  if (activeSubtitle.fontSizePercent !== undefined) {
    // パーセンテージベースのフォントサイズ（プレビュー高さに対する%）
    fontSizePx = (activeSubtitle.fontSizePercent / 100) * height;
  } else {
    // 従来のfontSize（ピクセル値、後方互換性）
    // 既存データとの互換性のため、fontSizeが100以下の場合はパーセンテージとして扱う
    // 100より大きい場合はピクセル値として扱う
    if (activeSubtitle.fontSize <= 100) {
      fontSizePx = (activeSubtitle.fontSize / 100) * height;
    } else {
      fontSizePx = activeSubtitle.fontSize;
    }
  }
  
  // フォント関連のプロパティ（デフォルト値を設定）
  const fontFamily = activeSubtitle.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontWeight = activeSubtitle.fontWeight || 600;
  const textShadow = activeSubtitle.textShadow !== undefined 
    ? activeSubtitle.textShadow 
    : '0 2px 10px rgba(0, 0, 0, 0.8)';
  const borderColor = activeSubtitle.borderColor;
  const borderWidth = activeSubtitle.borderWidth || 0;
  const letterSpacing = activeSubtitle.letterSpacing || 'normal';
  const lineHeight = activeSubtitle.lineHeight || 1.4;
  const textTransform = activeSubtitle.textTransform || 'none';
  
  // フォント変数をCSSカスタムプロパティから取得（Google Fontsの場合）
  const fontFamilyValue = fontFamily.startsWith('var(') 
    ? fontFamily 
    : fontFamily;
  
  // 文字の縁取り（WebKit TextStroke）
  const webkitTextStroke = borderWidth > 0 && borderColor 
    ? `${borderWidth}px ${borderColor}` 
    : undefined;
  
  // alignの取得（後方互換性のため）
  const align = activeSubtitle.align || 'center';
  
  return (
    <AbsoluteFill
      style={{
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...positionStyle,
          // 背景色がない場合は完全に透明（backdropFilterもnone）
          background: hasBackground ? backgroundColor : 'transparent',
          backdropFilter: hasBackground ? 'none' : 'none', // 背景色がない場合はブラー効果もなし
          padding: '16px 24px',
          borderRadius: '12px',
          textAlign: align,
          whiteSpace: 'nowrap', // 改行を防ぐ
          boxShadow: hasBackground ? '0 4px 20px rgba(0, 0, 0, 0.5)' : 'none',
          border: hasBackground ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          display: 'inline-block',
        }}
      >
        <p
          style={{
            color: activeSubtitle.color,
            fontSize: `${fontSizePx}px`,
            fontFamily: fontFamilyValue,
            fontWeight: fontWeight,
            margin: 0,
            lineHeight: lineHeight,
            textShadow: textShadow,
            letterSpacing: letterSpacing,
            textTransform: textTransform,
            ...(webkitTextStroke ? {
              WebkitTextStroke: webkitTextStroke,
              paintOrder: 'stroke fill',
            } : {}),
          }}
        >
          {activeSubtitle.text}
        </p>
      </div>
    </AbsoluteFill>
  );
};

