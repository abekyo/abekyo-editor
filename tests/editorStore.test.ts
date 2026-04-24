import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/lib/editorStore';
import type { VideoClip } from '@/src/types';

function clip(label: string): VideoClip {
  return {
    plotName: label,
    text: '',
    imageUrl: null,
    audioUrl: '',
    duration: 3,
    index: 0,
    totalClips: 1,
  };
}

beforeEach(() => {
  useEditorStore.getState().reset();
});

describe('editorStore — basic setters', () => {
  it('updates currentTime / isPlaying', () => {
    useEditorStore.getState().setCurrentTime(12.5);
    useEditorStore.getState().setIsPlaying(true);
    const s = useEditorStore.getState();
    expect(s.currentTime).toBe(12.5);
    expect(s.isPlaying).toBe(true);
  });

  it('updates selection arrays independently', () => {
    useEditorStore.getState().setSelectedClipIndices([0, 2]);
    useEditorStore.getState().setSelectedSubtitleIds(['s1']);
    const s = useEditorStore.getState();
    expect(s.selectedClipIndices).toEqual([0, 2]);
    expect(s.selectedSubtitleIds).toEqual(['s1']);
  });

  it('zoom and onboarding replay update independently', () => {
    useEditorStore.getState().setTimelineZoom(2);
    useEditorStore.getState().bumpOnboardingReplay();
    useEditorStore.getState().bumpOnboardingReplay();
    const s = useEditorStore.getState();
    expect(s.timelineZoom).toBe(2);
    expect(s.onboardingReplayKey).toBe(2);
  });
});

describe('editorStore — undo / redo', () => {
  it('initHistory seeds the stack with one entry at index 0', () => {
    const a = [clip('a')];
    useEditorStore.getState().initHistory(a);
    const s = useEditorStore.getState();
    expect(s.history).toEqual([a]);
    expect(s.historyIndex).toBe(0);
  });

  it('pushHistory appends and advances the index', () => {
    const { initHistory, pushHistory } = useEditorStore.getState();
    initHistory([clip('a')]);
    pushHistory([clip('a'), clip('b')]);
    const s = useEditorStore.getState();
    expect(s.history.length).toBe(2);
    expect(s.historyIndex).toBe(1);
  });

  it('undo moves backward and returns the prior state; redo replays it', () => {
    const { initHistory, pushHistory, undo, redo } = useEditorStore.getState();
    const a = [clip('a')];
    const b = [clip('a'), clip('b')];
    initHistory(a);
    pushHistory(b);

    expect(undo()).toEqual(a);
    expect(useEditorStore.getState().historyIndex).toBe(0);

    expect(redo()).toEqual(b);
    expect(useEditorStore.getState().historyIndex).toBe(1);
  });

  it('undo at the start returns null without moving', () => {
    useEditorStore.getState().initHistory([clip('a')]);
    expect(useEditorStore.getState().undo()).toBeNull();
    expect(useEditorStore.getState().historyIndex).toBe(0);
  });

  it('redo at the end returns null without moving', () => {
    useEditorStore.getState().initHistory([clip('a')]);
    expect(useEditorStore.getState().redo()).toBeNull();
    expect(useEditorStore.getState().historyIndex).toBe(0);
  });

  it('pushHistory after undo truncates the redo tail', () => {
    const { initHistory, pushHistory, undo } = useEditorStore.getState();
    const a = [clip('a')];
    const b = [clip('a'), clip('b')];
    const c = [clip('a'), clip('c')]; // diverges from b
    initHistory(a);
    pushHistory(b);
    undo(); // back at a
    pushHistory(c); // overwrites the b branch
    const s = useEditorStore.getState();
    expect(s.history).toEqual([a, c]);
    expect(s.historyIndex).toBe(1);
  });
});

describe('editorStore — panel toggles', () => {
  it('only one panel is active at a time', () => {
    const { setActivePanel } = useEditorStore.getState();
    setActivePanel('properties');
    expect(useEditorStore.getState().activePanel).toBe('properties');
    setActivePanel('subtitle');
    expect(useEditorStore.getState().activePanel).toBe('subtitle');
  });

  it('togglePanel opens an idle panel', () => {
    useEditorStore.getState().togglePanel('bgm');
    expect(useEditorStore.getState().activePanel).toBe('bgm');
  });

  it('togglePanel on the active panel closes it (back to none)', () => {
    useEditorStore.getState().togglePanel('properties');
    useEditorStore.getState().togglePanel('properties');
    expect(useEditorStore.getState().activePanel).toBe('none');
  });

  it('togglePanel on a different panel switches without leaving "none" in between', () => {
    useEditorStore.getState().togglePanel('properties');
    useEditorStore.getState().togglePanel('bgm');
    expect(useEditorStore.getState().activePanel).toBe('bgm');
  });
});

describe('editorStore — reset', () => {
  it('wipes all fields back to defaults', () => {
    const { setCurrentTime, setIsPlaying, setSelectedClipIndices, initHistory,
            setActivePanel, setShowExportDialog, setTimelineZoom, bumpOnboardingReplay,
            reset } = useEditorStore.getState();
    setCurrentTime(5);
    setIsPlaying(true);
    setSelectedClipIndices([1, 2]);
    initHistory([clip('a')]);
    setActivePanel('properties');
    setShowExportDialog(true);
    setTimelineZoom(3);
    bumpOnboardingReplay();

    reset();

    const s = useEditorStore.getState();
    expect(s.currentTime).toBe(0);
    expect(s.isPlaying).toBe(false);
    expect(s.selectedClipIndices).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.historyIndex).toBe(-1);
    expect(s.activePanel).toBe('none');
    expect(s.showExportDialog).toBe(false);
    expect(s.timelineZoom).toBe(1);
    expect(s.onboardingReplayKey).toBe(0);
  });
});
