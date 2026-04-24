/**
 * 字幕プリセット定義
 * 商用利用可能なGoogle Fontsを使用したモダンな字幕スタイル
 */

import { Subtitle } from '@/src/types';

export interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  style: Partial<Omit<Subtitle, 'id' | 'text' | 'startTime' | 'endTime'>>;
}

// 利用可能なフォント一覧
export const AVAILABLE_FONTS = [
  { value: 'Noto Sans JP', label: 'Noto Sans JP (Japanese support)', variable: 'var(--font-noto-sans-jp)' },
  { value: 'Inter', label: 'Inter (modern, clean)', variable: 'var(--font-inter)' },
  { value: 'Roboto', label: 'Roboto (versatile)', variable: 'var(--font-roboto)' },
  { value: 'Poppins', label: 'Poppins (pop, friendly)', variable: 'var(--font-poppins)' },
  { value: 'system-ui', label: 'System UI (system font)', variable: 'system-ui' },
  { value: 'sans-serif', label: 'Sans Serif (default)', variable: 'sans-serif' },
] as const;

// Six modern subtitle presets (do not affect position/alignment)
export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    description: 'White text on a translucent background — simple style',
    style: {
      fontSize: 32,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      fontFamily: 'Inter',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      borderColor: undefined,
      borderWidth: 0,
      letterSpacing: '0.02em',
      lineHeight: 1.5,
      textTransform: 'none',
    },
  },
  {
    id: 'bold-impact',
    name: 'Bold Impact',
    description: 'White text with black outline — strong presence',
    style: {
      fontSize: 38,
      color: '#FFFFFF',
      backgroundColor: undefined,
      fontFamily: 'Poppins',
      textShadow: '0 0 8px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 0, 0, 0.7)',
      borderColor: '#000000',
      borderWidth: 3,
      letterSpacing: '0.03em',
      lineHeight: 1.4,
      textTransform: 'none',
    },
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    description: 'Eye-catching style with a glowing effect',
    style: {
      fontSize: 36,
      color: '#00FFFF',
      backgroundColor: undefined,
      fontFamily: 'Inter',
      textShadow: '0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5), 0 0 30px rgba(0, 255, 255, 0.3)',
      borderColor: undefined,
      borderWidth: 0,
      letterSpacing: '0.05em',
      lineHeight: 1.3,
      textTransform: 'none',
    },
  },
  {
    id: 'soft-elegant',
    name: 'Soft Elegant',
    description: 'Refined style with soft shadows',
    style: {
      fontSize: 30,
      color: '#F5F5F5',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      fontFamily: 'Noto Sans JP',
      textShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
      borderColor: undefined,
      borderWidth: 0,
      letterSpacing: '0.06em',
      lineHeight: 1.6,
      textTransform: 'none',
    },
  },
  {
    id: 'vibrant-pop',
    name: 'Vibrant Pop',
    description: 'Playful style with bright colors',
    style: {
      fontSize: 34,
      color: '#FFD700',
      backgroundColor: undefined,
      fontFamily: 'Poppins',
      textShadow: '0 0 8px rgba(255, 0, 150, 0.8), 0 4px 8px rgba(0, 0, 0, 0.5)',
      borderColor: '#FF1493',
      borderWidth: 2,
      letterSpacing: '0.04em',
      lineHeight: 1.4,
      textTransform: 'none',
    },
  },
  {
    id: 'clean-pro',
    name: 'Clean Pro',
    description: 'Professional-looking style',
    style: {
      fontSize: 32,
      color: '#FFFFFF',
      backgroundColor: 'rgba(20, 20, 20, 0.85)',
      fontFamily: 'Roboto',
      textShadow: 'none',
      borderColor: undefined,
      borderWidth: 0,
      letterSpacing: '0.01em',
      lineHeight: 1.5,
      textTransform: 'none',
    },
  },
];

/**
 * プリセットを字幕に適用するヘルパー関数
 */
export function applyPresetToSubtitle(
  subtitle: Subtitle,
  preset: SubtitlePreset
): Subtitle {
  return {
    ...subtitle,
    ...preset.style,
  };
}

/**
 * プリセットIDからプリセットを取得
 */
export function getPresetById(presetId: string): SubtitlePreset | undefined {
  return SUBTITLE_PRESETS.find((preset) => preset.id === presetId);
}

/**
 * フォント名からフォント情報を取得
 */
export function getFontByValue(fontValue: string) {
  return AVAILABLE_FONTS.find((font) => font.value === fontValue);
}

