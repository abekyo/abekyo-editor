'use client';

// All keyboard shortcuts for the editor live here. Centralising them in one
// hook keeps VideoEditor.tsx free of the long switch-on-key block and makes
// the bindings easier to audit.
//
// State the hook needs (currentTime, selection, panel toggles, dialog flags,
// clipboard) is read directly from useEditorStore — the parent does not have
// to thread them through. Handlers are accepted as props because they wrap
// player ref + clip state + parent callbacks.

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEditorStore } from '@/lib/editorStore';
import type { VideoClip, Subtitle } from '@/src/types';

export interface KeyboardShortcutHandlers {
  // Playback / time
  onPlayPause: () => void;
  updateCurrentTime: (time: number, shouldSeek?: boolean) => void;

  // Clip handlers
  onClipAdd: () => void;
  onClipCopy: () => void;
  onClipPaste: () => void;
  onClipCut: () => void;
  onClipCutToPrevious: () => void;
  onClipCutToNext: () => void;

  // Subtitle handlers
  onSubtitleCopy: () => void;
  onSubtitlePaste: () => void;
  onSubtitleDelete: (id: string) => void;
  onSubtitleCut: () => void;

  // Coordinator-level
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onConfirmExport: () => void;
}

export interface KeyboardShortcutContext {
  // Per-clip data the hook needs to compute Up/Down navigation.
  clips: VideoClip[];
  clipStartTimes: number[];
  totalDuration: number;

  // Subtitles + clipboard live in VideoEditor's local state, not the store.
  subtitles: Subtitle[];
  copiedClip: VideoClip | null;
  copiedSubtitle: Subtitle | null;

  // Local setter for the subtitle clipboard (used by Cmd+X for subtitles).
  setCopiedSubtitle: (subtitle: Subtitle) => void;
}

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  ctx: KeyboardShortcutContext,
) {
  const t = useTranslations('editor');

  // Read from the store directly — the hook must always see the latest
  // values inside the keydown handler.
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);
  const selectedSubtitleIds = useEditorStore((s) => s.selectedSubtitleIds);
  const activePanel = useEditorStore((s) => s.activePanel);
  const showExportDialog = useEditorStore((s) => s.showExportDialog);
  const showShortcuts = useEditorStore((s) => s.showShortcuts);
  const setSelectedClipIndices = useEditorStore((s) => s.setSelectedClipIndices);
  const setSelectedSubtitleIds = useEditorStore((s) => s.setSelectedSubtitleIds);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setShowExportDialog = useEditorStore((s) => s.setShowExportDialog);
  const setShowShortcuts = useEditorStore((s) => s.setShowShortcuts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合は無視
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case ' ': // スペース: 再生/一時停止
          e.preventDefault();
          handlers.onPlayPause();
          break;

        case 'ArrowLeft': {
          e.preventDefault();
          const fps = 30;
          handlers.updateCurrentTime(Math.max(0, currentTime - 1 / fps), true);
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const fps = 30;
          handlers.updateCurrentTime(
            Math.min(ctx.totalDuration, currentTime + 1 / fps),
            true,
          );
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (ctx.clips.length === 0) break;
          let prevIndex: number;
          if (selectedClipIndices.length === 0) {
            prevIndex = ctx.clips.length - 1;
          } else if (selectedClipIndices[0] > 0) {
            prevIndex = selectedClipIndices[0] - 1;
          } else {
            break;
          }
          const prevStartTime = ctx.clipStartTimes[prevIndex];
          if (prevStartTime === undefined || prevIndex < 0 || prevIndex >= ctx.clips.length) break;
          setSelectedClipIndices([prevIndex]);
          setSelectedSubtitleIds([]);
          if (activePanel === 'subtitle') setActivePanel('none');
          handlers.updateCurrentTime(prevStartTime, true);
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (ctx.clips.length === 0) break;
          let nextIndex: number;
          if (selectedClipIndices.length === 0) {
            nextIndex = 0;
          } else if (selectedClipIndices[0] < ctx.clips.length - 1) {
            nextIndex = selectedClipIndices[0] + 1;
          } else {
            break;
          }
          const nextStartTime = ctx.clipStartTimes[nextIndex];
          if (nextStartTime === undefined || nextIndex < 0 || nextIndex >= ctx.clips.length) break;
          setSelectedClipIndices([nextIndex]);
          setSelectedSubtitleIds([]);
          if (activePanel === 'subtitle') setActivePanel('none');
          handlers.updateCurrentTime(nextStartTime, true);
          break;
        }

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handlers.onDeleteSelected();
          break;

        case 'x':
        case 'X':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // 字幕優先 → クリップ
            if (selectedSubtitleIds.length > 0) {
              const subtitle = ctx.subtitles.find((s) => s.id === selectedSubtitleIds[0]);
              if (subtitle) {
                ctx.setCopiedSubtitle(subtitle);
                handlers.onSubtitleDelete(selectedSubtitleIds[0]);
              }
            } else if (selectedClipIndices.length > 0) {
              handlers.onClipCut();
            }
          }
          break;

        case 's':
        case 'S':
          e.preventDefault();
          if (selectedSubtitleIds.length > 0) {
            handlers.onSubtitleCut();
          } else if (selectedClipIndices.length > 0) {
            handlers.onClipCut();
          } else {
            alert(t('alert.selectSequenceToCut'));
          }
          break;

        case 'a':
        case 'A':
          e.preventDefault();
          handlers.onClipCutToPrevious();
          break;

        case 'd':
        case 'D':
          e.preventDefault();
          handlers.onClipCutToNext();
          break;

        case 'Escape':
          e.preventDefault();
          if (showExportDialog) setShowExportDialog(false);
          if (showShortcuts) setShowShortcuts(false);
          // Legacy parity: only Properties and BGM panels close on Esc.
          // The Subtitle panel intentionally does NOT — preserved verbatim.
          if (activePanel === 'properties' || activePanel === 'bgm') {
            setActivePanel('none');
          }
          break;

        case 'Enter':
          if (showExportDialog) {
            e.preventDefault();
            handlers.onConfirmExport();
          }
          break;

        case 'n':
        case 'N':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlers.onClipAdd();
          }
          break;

        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selectedSubtitleIds.length > 0) {
              handlers.onSubtitleCopy();
            } else if (selectedClipIndices.length > 0) {
              handlers.onClipCopy();
            }
          }
          break;

        case 'v':
        case 'V':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (ctx.copiedSubtitle !== null) {
              handlers.onSubtitlePaste();
            } else if (ctx.copiedClip !== null) {
              handlers.onClipPaste();
            }
          }
          break;

        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) handlers.onRedo();
            else handlers.onUndo();
          }
          break;

        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlers.onRedo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlers, ctx, t,
    currentTime, selectedClipIndices, selectedSubtitleIds, activePanel,
    showExportDialog, showShortcuts,
    setSelectedClipIndices, setSelectedSubtitleIds, setActivePanel,
    setShowExportDialog, setShowShortcuts,
  ]);
}
