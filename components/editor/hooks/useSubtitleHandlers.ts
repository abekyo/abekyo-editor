'use client';

// Subtitle CRUD handlers extracted from VideoEditor.tsx as a custom hook.
//
// Scope: simple add / edit / delete / copy / paste. The complex pieces
// (subtitle CUT operations, preview-drag handlers, the cross-cut from
// handleClipEdit that auto-syncs a subtitle when a clip's text changes)
// stay in VideoEditor.tsx for now — their refactor is deferred.

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useEditorStore } from '@/lib/editorStore';
import type { Subtitle } from '@/src/types';

export interface UseSubtitleHandlersArgs {
  subtitles: Subtitle[];
  setSubtitles: (subtitles: Subtitle[]) => void;
  totalDuration: number;
  copiedSubtitle: Subtitle | null;
  setCopiedSubtitle: (subtitle: Subtitle | null) => void;
  /** Returns true if the proposed subtitle window overlaps an existing one
   *  (excluding the subtitle being edited, identified by `excludeId`). */
  checkSubtitleOverlap: (startTime: number, endTime: number, excludeId?: string) => boolean;
}

export function useSubtitleHandlers({
  subtitles,
  setSubtitles,
  totalDuration,
  copiedSubtitle,
  setCopiedSubtitle,
  checkSubtitleOverlap,
}: UseSubtitleHandlersArgs) {
  const t = useTranslations('editor');
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedSubtitleIds = useEditorStore((s) => s.selectedSubtitleIds);
  const setSelectedSubtitleIds = useEditorStore((s) => s.setSelectedSubtitleIds);
  const setSelectedClipIndices = useEditorStore((s) => s.setSelectedClipIndices);
  const activePanel = useEditorStore((s) => s.activePanel);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);

  const handleSubtitleAdd = useCallback(() => {
    const newStartTime = currentTime;
    const newEndTime = Math.min(currentTime + 3, totalDuration);

    if (checkSubtitleOverlap(newStartTime, newEndTime)) {
      alert(t('alert.subtitleTimeConflict'));
      return;
    }

    const newSubtitle: Subtitle = {
      id: `subtitle-${Date.now()}`,
      text: t('subtitleEditor.defaultNewText'),
      startTime: newStartTime,
      endTime: newEndTime,
      position: 'bottom',
      positionYPercent: 90,
      fontSize: 5,
      fontSizePercent: 5,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      align: 'center',
      positionXPercent: 50,
    };
    setSubtitles([...subtitles, newSubtitle]);

    // Clear clip selection and switch the side panel to the subtitle editor.
    // Mutual exclusion in the store auto-closes any other open panel.
    setSelectedClipIndices([]);
    setActivePanel('subtitle');
    setSelectedSubtitleIds([newSubtitle.id]);
  }, [
    currentTime, totalDuration, subtitles, checkSubtitleOverlap, t, setSubtitles,
    setSelectedClipIndices, setActivePanel, setSelectedSubtitleIds,
  ]);

  const handleSubtitleEdit = useCallback(
    (id: string, updates: Partial<Subtitle>) => {
      const currentSubtitle = subtitles.find((sub) => sub.id === id);
      if (!currentSubtitle) return;

      // startTime / endTime のバリデーション
      if (updates.startTime !== undefined || updates.endTime !== undefined) {
        const newStartTime = updates.startTime ?? currentSubtitle.startTime;
        const newEndTime = updates.endTime ?? currentSubtitle.endTime;

        if (newStartTime >= newEndTime) {
          alert(t('alert.subtitleStartBeforeEnd'));
          return;
        }
        if (checkSubtitleOverlap(newStartTime, newEndTime, id)) {
          alert(t('alert.subtitleTimeConflictDifferent'));
          return;
        }
      }

      setSubtitles(subtitles.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub)));
    },
    [subtitles, checkSubtitleOverlap, t, setSubtitles],
  );

  const handleSubtitleDelete = useCallback(
    (id: string) => {
      setSubtitles(subtitles.filter((sub) => sub.id !== id));
      const updatedIds = selectedSubtitleIds.filter((i) => i !== id);
      setSelectedSubtitleIds(updatedIds);
      if (updatedIds.length === 0 && activePanel === 'subtitle') {
        setActivePanel('none');
      }
    },
    [subtitles, selectedSubtitleIds, setSubtitles, setSelectedSubtitleIds, activePanel, setActivePanel],
  );

  const handleSubtitleCopy = useCallback(() => {
    if (selectedSubtitleIds.length > 0) {
      const subtitle = subtitles.find((s) => s.id === selectedSubtitleIds[0]);
      if (subtitle) setCopiedSubtitle(subtitle);
    }
  }, [subtitles, selectedSubtitleIds, setCopiedSubtitle]);

  const handleSubtitlePaste = useCallback(() => {
    if (!copiedSubtitle) return;
    const newSubtitle: Subtitle = {
      ...copiedSubtitle,
      id: `subtitle-${Date.now()}-${Math.random()}`,
      text: `${copiedSubtitle.text} ${t('clipProperties.copySuffix')}`,
      startTime: Math.max(0, Math.min(totalDuration - 0.1, currentTime)),
      endTime: Math.min(totalDuration, currentTime + (copiedSubtitle.endTime - copiedSubtitle.startTime)),
    };
    setSubtitles([...subtitles, newSubtitle]);
    setSelectedSubtitleIds([newSubtitle.id]);
  }, [
    copiedSubtitle, subtitles, currentTime, totalDuration, t, setSubtitles, setSelectedSubtitleIds,
  ]);

  return {
    handleSubtitleAdd,
    handleSubtitleEdit,
    handleSubtitleDelete,
    handleSubtitleCopy,
    handleSubtitlePaste,
  };
}
