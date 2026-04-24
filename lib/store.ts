// Zustandストア
import { create } from 'zustand';
import { ProductData, TemplateType, Scenario, Plot, VideoResolution, VideoAspectRatio } from './types';
import type { VideoClip } from '@/src/types';

interface AppState {
  clips: VideoClip[];
  setClips: (clips: VideoClip[]) => void;
  productData: ProductData | null;
  selectedTemplate: TemplateType | null;
  scenario: Scenario | null;
  videoUrl: string | null;
  videoDuration: number; // 動画の尺（秒）
  videoResolution: VideoResolution; // 動画の解像度
  videoAspectRatio: VideoAspectRatio; // 動画のアスペクト比
  videoTempo: number; // 動画のテンポ（0.5=遅い、1.0=通常、2.0=速い）
  audioEnabled: boolean; // 音声の読み上げを有効にするか（デフォルト: true）
  bgmUrl: string | null; // BGMのURL
  bgmVolume: number; // BGMの音量（0.0-1.0）
  setProductData: (data: ProductData) => void;
  setSelectedTemplate: (template: TemplateType) => void;
  setScenario: (scenario: Scenario) => void;
  setVideoUrl: (url: string | null) => void;
  setVideoDuration: (duration: number) => void;
  setVideoResolution: (resolution: VideoResolution) => void;
  setVideoAspectRatio: (aspectRatio: VideoAspectRatio) => void;
  setVideoTempo: (tempo: number) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setBgmUrl: (url: string | null) => void;
  setBgmVolume: (volume: number) => void;
  updatePlot: (plotIndex: number, content: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  clips: [],
  setClips: (clips) => set({ clips }),
  productData: null,
  selectedTemplate: null,
  scenario: null,
  videoUrl: null,
  videoDuration: 15,
  videoResolution: '1080p',
  videoAspectRatio: '16:9',
  videoTempo: 1.0,
  audioEnabled: true,
  bgmUrl: null,
  bgmVolume: 0.3,
  setProductData: (data) => set({ productData: data }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setScenario: (scenario) => set({ scenario }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setVideoDuration: (duration) => {
    const clamped = Math.max(3, Math.min(30, duration));
    const rounded = Math.round(clamped / 3) * 3;
    set({ videoDuration: rounded });
  },
  setVideoResolution: (resolution) => set({ videoResolution: resolution }),
  setVideoAspectRatio: (aspectRatio) => {
    // 一時的に16:9に固定（動画の形の選択を無効化）
    set({ videoAspectRatio: '16:9' });
  },
  setVideoTempo: (tempo) => set({ videoTempo: tempo }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  setBgmUrl: (url) => set({ bgmUrl: url }),
  setBgmVolume: (volume) => set({ bgmVolume: Math.max(0, Math.min(1, volume)) }),
  updatePlot: (plotIndex, content) =>
    set((state) => {
      if (!state.scenario) return state;
      const updatedPlots = [...state.scenario.plots];
      if (!updatedPlots[plotIndex]) {
        updatedPlots[plotIndex] = {
          name: '',
          content: content,
          index: plotIndex,
        };
      } else {
        updatedPlots[plotIndex] = { ...updatedPlots[plotIndex], content };
      }
      return {
        scenario: { ...state.scenario, plots: updatedPlots },
      };
    }),
  reset: () =>
    set({
      clips: [],
      productData: null,
      selectedTemplate: null,
      scenario: null,
      videoUrl: null,
      videoDuration: 15,
      videoResolution: '1080p',
      videoAspectRatio: '16:9',
      videoTempo: 1.0,
      audioEnabled: true,
      bgmUrl: null,
      bgmVolume: 0.3,
    }),
}));

