import React from 'react';
import { AbsoluteFill } from 'remotion';

export type LayoutTemplate = 'classic' | 'modern' | 'minimal' | 'card' | 'fullscreen' | 'tiktok';

interface LayoutTemplateProps {
  children: React.ReactNode;
  template: LayoutTemplate;
  productName?: string;
  productDescription?: string;
  clipIndex: number;
  totalClips: number;
  showProductName?: boolean; // 商品名を表示するかどうか（デフォルト: false）
}

/**
 * プロフェッショナルなレイアウトテンプレート
 */
export const LayoutTemplate: React.FC<LayoutTemplateProps> = ({
  children,
  template,
  productName,
  productDescription,
  clipIndex,
  totalClips,
  showProductName = false, // デフォルトでは商品名を表示しない
}) => {
  switch (template) {
    case 'classic':
      return (
        <AbsoluteFill>
          {children}
          {/* 上部ヘッダー */}
          <AbsoluteFill
            style={{
              top: 0,
              height: 200,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
              padding: '40px 60px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
            }}
          >
            {showProductName && productName && (
              <h1
                style={{
                  color: 'white',
                  fontSize: 48,
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: 12,
                  textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {productName}
              </h1>
            )}
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'modern':
      return (
        <AbsoluteFill>
          {children}
          {/* 左右分割レイアウト */}
          <AbsoluteFill
            style={{
              display: 'flex',
              flexDirection: 'row',
              padding: 60,
            }}
          >
            {/* 左側: 商品情報 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                paddingRight: 40,
                zIndex: 10,
              }}
            >
              {showProductName && productName && (
                <h1
                  style={{
                    color: 'white',
                    fontSize: 56,
                    fontWeight: 800,
                    margin: 0,
                    marginBottom: 20,
                    textShadow: '0 4px 30px rgba(0,0,0,0.6)',
                    lineHeight: 1.2,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {productName}
                </h1>
              )}
            </div>
            {/* 右側: 画像エリア（オーバーレイ） */}
            <div
              style={{
                flex: 1,
                position: 'relative',
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'minimal':
      return (
        <AbsoluteFill>
          {children}
          {/* 中央配置のミニマルデザイン */}
          <AbsoluteFill
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 80,
              zIndex: 10,
            }}
          >
            {showProductName && productName && (
              <h1
                style={{
                  color: 'white',
                  fontSize: 64,
                  fontWeight: 300,
                  margin: 0,
                  marginBottom: 30,
                  textAlign: 'center',
                  textShadow: '0 4px 40px rgba(0,0,0,0.7)',
                  letterSpacing: '-0.02em',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {productName}
              </h1>
            )}
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'card':
      return (
        <AbsoluteFill>
          {children}
          {/* カード型レイアウト */}
          <AbsoluteFill
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 60,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: '50px 60px',
                maxWidth: '70%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 10,
              }}
            >
              {showProductName && productName && (
                <h1
                  style={{
                    color: 'white',
                    fontSize: 48,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 20,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {productName}
                </h1>
              )}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'tiktok':
      // 控えめなレイアウト（アニメーションを削減）
      return (
        <AbsoluteFill>
          {children}
          {/* 控えめなテキストオーバーレイ */}
          {showProductName && productName && (
            <AbsoluteFill
              style={{
                top: 60,
                left: 40,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <h1
                  style={{
                    color: 'white',
                    fontSize: 40,
                    fontWeight: 700,
                    margin: 0,
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {productName}
                </h1>
              </div>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      );

    case 'fullscreen':
    default:
      return (
        <AbsoluteFill>
          {children}
        </AbsoluteFill>
      );
  }
};

