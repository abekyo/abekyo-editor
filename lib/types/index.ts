// 型定義

export interface ProductData {
  name: string;
  description: string;
  images: string[];
  reviews: Review[];
  category?: string; // 商品カテゴリ（例：化粧水、シャンプーなど）
}

export interface Review {
  text: string;
  rating?: number;
  author?: string;
}

export type TemplateType = 'PAS' | 'FBE' | 'BEFORE_AFTER';

export interface Plot {
  name: string;
  content: string;
  index: number;
  duration?: number;
  imageUrl?: string | null;
  image_url?: string | null; // 後方互換性
  scale?: number;
  position?: { x: number; y: number };
  imageEffect?: string;
  transitionType?: string;
  transitionDuration?: number;
  audioStartTime?: number;
}

export interface Scenario {
  id?: string;
  productId?: string;
  templateType: TemplateType;
  plots: Plot[];
  createdAt?: Date;
}

export interface Video {
  id?: string;
  scenarioId: string;
  videoUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt?: Date;
}

// 動画解像度関連の型定義
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
    '9:16': { width: 720, height: 1280, label: '720p (Vertical)' },
    '1:1': { width: 720, height: 720, label: '720p (Square)' },
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080, label: '1080p (Full HD)' },
    '9:16': { width: 1080, height: 1920, label: '1080p (Vertical)' },
    '1:1': { width: 1080, height: 1080, label: '1080p (Square)' },
  },
};

