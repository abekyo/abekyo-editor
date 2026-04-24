'use client';

// Clip CRUD handlers extracted from VideoEditor.tsx as a custom hook.
//
// Scope: only the handlers that are pure-data (don't touch the player ref
// and don't cross into subtitle state). Specifically:
//   - delete, reorder, extend, copy, paste
//
// Intentionally NOT included (kept in VideoEditor for now):
//   - handleClipAdd / handleAddSceneFiles (touch a hidden file input ref)
//   - handleClipEdit (cross-cuts into subtitles when text changes)
//   - handleClipCut*  (compound state mutations, deferred to later phase)
//   - handleClipSelect (touches the panel toggle wrapper, ROI low for size)

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useEditorStore } from '@/lib/editorStore';
import type { VideoClip } from '@/src/types';

export interface UseClipHandlersArgs {
  clips: VideoClip[];
  onClipsChange: (clips: VideoClip[] | ((prev: VideoClip[]) => VideoClip[])) => void;
  rippleEditMode: boolean;
  copiedClip: VideoClip | null;
  setCopiedClip: (clip: VideoClip | null) => void;
}

export function useClipHandlers({
  clips,
  onClipsChange,
  rippleEditMode,
  copiedClip,
  setCopiedClip,
}: UseClipHandlersArgs) {
  const t = useTranslations('editor');
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);
  const setSelectedClipIndices = useEditorStore((s) => s.setSelectedClipIndices);

  // Local addToHistory mirrors VideoEditor's behaviour: defer the store push
  // via queueMicrotask so we never call setState synchronously from a render.
  const addToHistory = useCallback(
    (newClips: VideoClip[]) => {
      queueMicrotask(() => pushHistory(newClips));
    },
    [pushHistory],
  );

  const handleClipDelete = useCallback(
    (index: number) => {
      const updatedClips = clips.filter((_, i) => i !== index);
      addToHistory(updatedClips);
      onClipsChange(updatedClips);

      // Selection bookkeeping for ripple-edit mode (the only path that
      // currently differs from "normal" mode in the original code).
      if (rippleEditMode) {
        const updatedIndices = selectedClipIndices
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));
        setSelectedClipIndices(updatedIndices);
      }
    },
    [clips, onClipsChange, addToHistory, rippleEditMode, selectedClipIndices, setSelectedClipIndices],
  );

  const handleClipReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const updatedClips = [...clips];
      const [movedClip] = updatedClips.splice(fromIndex, 1);
      updatedClips.splice(toIndex, 0, movedClip);

      // インデックスを更新
      updatedClips.forEach((clip, index) => {
        clip.index = index;
        clip.totalClips = updatedClips.length;
      });

      addToHistory(updatedClips);
      onClipsChange(updatedClips);

      // 選択中のクリップのインデックスを更新
      const updatedIndices = selectedClipIndices.map((i) => {
        if (i === fromIndex) return toIndex;
        if (fromIndex < i && toIndex >= i) return i - 1;
        if (fromIndex > i && toIndex <= i) return i + 1;
        return i;
      });
      setSelectedClipIndices(updatedIndices);
    },
    [clips, onClipsChange, addToHistory, selectedClipIndices, setSelectedClipIndices],
  );

  const handleClipExtend = useCallback(
    (index: number, newDuration: number) => {
      if (newDuration <= 0) {
        alert(t('alert.durationPositive'));
        return;
      }

      const updatedClips = [...clips];
      updatedClips[index] = {
        ...updatedClips[index],
        duration: Math.max(0.1, newDuration),
      };
      addToHistory(updatedClips);
      onClipsChange(updatedClips);
    },
    [clips, onClipsChange, addToHistory, t],
  );

  const handleClipCopy = useCallback(() => {
    // 複数選択時は単一選択でないとコピーしない（旧実装の挙動を踏襲）。
    if (selectedClipIndices.length === 1 && clips[selectedClipIndices[0]]) {
      setCopiedClip(clips[selectedClipIndices[0]]);
    }
  }, [clips, selectedClipIndices, setCopiedClip]);

  const handleClipPaste = useCallback(() => {
    if (!copiedClip) return;
    const newClip: VideoClip = {
      ...copiedClip,
      plotName: `${copiedClip.plotName} ${t('clipProperties.copySuffix')}`,
      index: clips.length,
      totalClips: clips.length + 1,
    };
    const updatedClips = [...clips, newClip];
    addToHistory(updatedClips);
    onClipsChange(updatedClips);
    setSelectedClipIndices([clips.length]);
  }, [copiedClip, clips, onClipsChange, addToHistory, setSelectedClipIndices, t]);

  return {
    handleClipDelete,
    handleClipReorder,
    handleClipExtend,
    handleClipCopy,
    handleClipPaste,
  };
}
