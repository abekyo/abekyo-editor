// Editor-scoped Zustand store — transient state that the editor shell and
// its sub-panels (timeline, properties, subtitle editor, etc.) all read or
// write. Distinct from `useAppStore` (lib/store.ts), which holds long-lived
// project data (clips, BGM URL, video config) shared with the landing page.
//
// What lives here:
//   - playback (currentTime, isPlaying)
//   - selection (clip indices, subtitle ids)
//   - undo/redo history of clips arrays
//   - panel toggles (Properties / Subtitle editor / BGM) — mutually exclusive
//   - dialog flags (Export, Shortcuts)
//   - timeline zoom + onboarding replay counter
//
// What deliberately stays in VideoEditor.tsx:
//   - DOM refs (playerRef, videoRef, bgmAudioRef) — React refs are
//     per-render, not store-friendly
//   - perf-tracking refs (currentTimeRef, isSeekingRef, timeout IDs) —
//     intentionally not re-rendered on change
//   - BGM playback config (bgmUrl, bgmVolume, …) — already mirrored from
//     useAppStore via props; deferred to Phase 3
//   - preview resize / drag state — purely local UI

import { create } from 'zustand';
import type { VideoClip } from '@/src/types';

export type EditorPanel = 'none' | 'properties' | 'subtitle' | 'bgm';

interface EditorState {
  // --- Playback ---
  currentTime: number;
  isPlaying: boolean;

  // --- Selection ---
  selectedClipIndices: number[];
  selectedSubtitleIds: string[];

  // --- Undo/redo history of clip arrays ---
  history: VideoClip[][];
  historyIndex: number;

  // --- Mutually exclusive side-panel ---
  // Only one of properties / subtitle / bgm can be open at a time. The shell
  // can read this single field to decide which panel JSX to render.
  activePanel: EditorPanel;

  // --- Modal dialogs ---
  showExportDialog: boolean;
  showShortcuts: boolean;

  // --- Misc ---
  timelineZoom: number;
  onboardingReplayKey: number;
}

interface EditorActions {
  // Playback
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Selection
  setSelectedClipIndices: (indices: number[]) => void;
  setSelectedSubtitleIds: (ids: string[]) => void;

  // History
  /** Reset the stack to a single entry (called when clips are first loaded). */
  initHistory: (initial: VideoClip[]) => void;
  /** Append a new state, truncating any "redo" tail beyond the current index. */
  pushHistory: (clips: VideoClip[]) => void;
  /** Move backward; returns the clips to apply, or null if at the start. */
  undo: () => VideoClip[] | null;
  /** Move forward; returns the clips to apply, or null if at the end. */
  redo: () => VideoClip[] | null;

  // Panels
  setActivePanel: (panel: EditorPanel) => void;
  /** Toggle a panel — opens it if closed, closes it if already open. */
  togglePanel: (panel: Exclude<EditorPanel, 'none'>) => void;

  // Dialogs
  setShowExportDialog: (show: boolean) => void;
  setShowShortcuts: (show: boolean) => void;

  // Misc
  setTimelineZoom: (zoom: number) => void;
  bumpOnboardingReplay: () => void;

  /** Wipe back to defaults — call from VideoEditor on mount so reopening the
   * editor does not inherit stale state from a previous session. */
  reset: () => void;
}

const INITIAL_STATE: EditorState = {
  currentTime: 0,
  isPlaying: false,
  selectedClipIndices: [],
  selectedSubtitleIds: [],
  history: [],
  historyIndex: -1,
  activePanel: 'none',
  showExportDialog: false,
  showShortcuts: false,
  timelineZoom: 1,
  onboardingReplayKey: 0,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...INITIAL_STATE,

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setSelectedClipIndices: (indices) => set({ selectedClipIndices: indices }),
  setSelectedSubtitleIds: (ids) => set({ selectedSubtitleIds: ids }),

  initHistory: (initial) => set({ history: [initial], historyIndex: 0 }),

  pushHistory: (clips) => {
    const { history, historyIndex } = get();
    // Drop any existing redo tail before appending; matches the classic
    // text-editor undo stack.
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(clips);
    set({ history: trimmed, historyIndex: trimmed.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return null;
    const next = historyIndex - 1;
    set({ historyIndex: next });
    return history[next];
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return null;
    const next = historyIndex + 1;
    set({ historyIndex: next });
    return history[next];
  },

  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) => {
    const current = get().activePanel;
    set({ activePanel: current === panel ? 'none' : panel });
  },

  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setShowShortcuts: (show) => set({ showShortcuts: show }),

  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
  bumpOnboardingReplay: () => set((s) => ({ onboardingReplayKey: s.onboardingReplayKey + 1 })),

  reset: () => set(INITIAL_STATE),
}));
