export type VideoResolution = '720p' | '1080p';
export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export interface ResolutionConfig {
  width: number;
  height: number;
  label: string;
}

// アスペクト比ごとの解像度設定
export const RESOLUTIONS: Record<VideoResolution, Record<VideoAspectRatio, ResolutionConfig>> = {
  '720p': {
    '16:9': { width: 1280, height: 720, label: '720p (HD)' },
    '9:16': { width: 720, height: 1280, label: '720p (縦型)' },
    '1:1': { width: 720, height: 720, label: '720p (正方形)' },
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080, label: '1080p (Full HD)' },
    '9:16': { width: 1080, height: 1920, label: '1080p (縦型)' },
    '1:1': { width: 1080, height: 1080, label: '1080p (正方形)' },
  },
};

export interface ProductVideoProps {
  clips: VideoClip[];
  productName?: string;
  productDescription?: string;
  resolution?: VideoResolution;
  aspectRatio?: VideoAspectRatio;
  tempo?: number; // 動画のテンポ（0.5=遅い、1.0=通常、2.0=速い）
  audioEnabled?: boolean;
  subtitles?: Subtitle[]; // 時間ベースの字幕リスト
  bgmUrl?: string | null; // BGMのURL
  bgmVolume?: number; // BGMの音量（0.0〜1.0）
  bgmStartTime?: number; // BGMの開始位置（秒）
  bgmEndTime?: number | null; // BGMの終了位置（秒、nullの場合は最後まで）
  subtitleAudioVolume?: number; // 字幕読み上げの音量（0.0〜1.0）
}

export type TransitionType = 'none' | 'fade' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'wipeLeft' | 'wipeRight' | 'zoomIn' | 'zoomOut' | 'crossfade' | 'slide' | 'zoom' | 'wipe' | 'blur';

export interface VideoClip {
  plotName: string;
  text: string;
  imageUrl: string | null;
  image_url?: string | null; // 後方互換性のため
  audioUrl: string;
  audio_path?: string; // 後方互換性のため
  duration: number; // 秒
  index: number;
  totalClips?: number; // 総クリップ数
  imageEffect?: 'none' | 'kenBurns' | 'zoom' | 'pan' | 'zoomOut' | 'pulse'; // 画像アニメーション効果（デフォルト: 'none'）
  audioStartTime?: number; // 音声の開始位置（秒、カット時に使用）
  transitionType?: TransitionType; // トランジションの種類（デフォルト: 'none'）
  transitionDuration?: number; // トランジションの長さ（秒、デフォルト: 0.5）
  scale?: number; // 画像のスケール（1.0 = 100%, 0.5 = 50%, 2.0 = 200%）
  position?: { x: number; y: number }; // 画像の位置（%で指定、デフォルト: { x: 0, y: 0 }）
}

export interface Subtitle {
  id: string;
  text: string;
  startTime: number; // 開始時間（秒）
  endTime: number; // 終了時間（秒）
  position: 'top' | 'center' | 'bottom'; // 位置（後方互換性のため残す）
  fontSize: number; // フォントサイズ（プレビュー高さに対するパーセンテージ、例：5 = 5%）
  fontSizePercent?: number; // フォントサイズ（プレビュー高さに対するパーセンテージ、優先度: fontSizePercent > fontSize）
  color: string; // 文字色
  backgroundColor?: string; // 背景色（オプション）
  align: 'left' | 'center' | 'right'; // 配置（後方互換性のため残す）
  positionYPercent?: number; // 垂直位置（プレビュー高さに対するパーセンテージ、上から、例：10 = 上から10%）
  positionXPercent?: number; // 水平位置（プレビュー幅に対するパーセンテージ、左から、例：20 = 左から20%）
  fontFamily?: string; // フォントファミリー
  fontWeight?: number; // フォントの太さ (100-900)
  textShadow?: string; // テキストシャドウ
  borderColor?: string; // 文字の縁取り色
  borderWidth?: number; // 文字の縁取り幅
  letterSpacing?: string; // 文字間隔
  lineHeight?: number; // 行の高さ
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // 大文字小文字変換
}

