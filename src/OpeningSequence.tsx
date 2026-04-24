import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

interface OpeningSequenceProps {
  productName?: string;
  productDescription?: string;
  tempo?: number;
}

/**
 * オープニングシーケンス（3秒間で商品名またはキャッチコピーを表示）
 */
export const OpeningSequence: React.FC<OpeningSequenceProps> = ({
  productName,
  productDescription,
  tempo = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // キャッチコピーを生成（商品名のみ）
  // 商品名が長い場合は適切に短縮（最大20文字）
  let catchCopy = productName || 'Product showcase';
  if (catchCopy.length > 20) {
    catchCopy = catchCopy.substring(0, 20) + '...';
  }

  // 控えめなフェードインアニメーション
  const fadeIn = interpolate(
    frame,
    [0, Math.floor(durationInFrames * 0.3)],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );

  // 控えめなフェードアウトアニメーション（最後の0.3秒）
  const fadeOut = interpolate(
    frame,
    [Math.floor(durationInFrames * 0.7), durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );

  const opacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a1a',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      {/* メインテキスト */}
      <div
        style={{
          textAlign: 'center',
          padding: '60px 80px',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            color: 'white',
            fontSize: 64,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.2,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
            letterSpacing: '-0.02em',
          }}
        >
          {catchCopy}
        </h1>

      </div>
    </AbsoluteFill>
  );
};

