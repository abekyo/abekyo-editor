'use client';

// Top toolbar of the editor: Undo / Redo, frame-step controls, play / pause,
// sync warning, Back-to-top, Save draft, Export.
//
// Subscribes directly to the editor store for state that changes often and
// that no other component needs to receive as a callback (history, isPlaying).
// Action handlers come in as props because they are wired into the parent's
// player ref / clip state / navigation — not appropriate to lift here.

import { useTranslations } from 'next-intl';
import { useEditorStore, PLAYBACK_RATES } from '@/lib/editorStore';
import { TOUR_TARGETS } from '@/lib/onboardingTargets';

export interface EditorToolbarProps {
  // Data the toolbar displays but does not own
  totalDuration: number;
  showSyncWarning: boolean;
  previewDuration: number | null;
  isSavingDraft: boolean;
  // Whether the parent supplied an onSaveDraft handler at all (toggles the
  // save button visibility, mirroring the legacy `{onSaveDraft && ...}` JSX).
  hasSaveDraft: boolean;

  // Action handlers — owned by VideoEditor because they touch the player ref,
  // clip state, navigation, etc. Callbacks here are deliberately no-arg.
  onUndo: () => void;
  onRedo: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onPlayPause: () => void;
  onBackToTop: () => void;
  onSaveDraft: () => void;
  onExport: () => void;
}

export function EditorToolbar({
  totalDuration,
  showSyncWarning,
  previewDuration,
  isSavingDraft,
  hasSaveDraft,
  onUndo,
  onRedo,
  onStepBack,
  onStepForward,
  onPlayPause,
  onBackToTop,
  onSaveDraft,
  onExport,
}: EditorToolbarProps) {
  const t = useTranslations('editor');
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const historyLength = useEditorStore((s) => s.history.length);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const playbackRate = useEditorStore((s) => s.playbackRate);
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  const cyclePlaybackRate = () => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const next = idx === -1 ? 1 : PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(next);
  };

  const formatRate = (rate: number) =>
    Number.isInteger(rate) ? `${rate}x` : `${rate.toString().replace(/\.?0+$/, '')}x`;

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-[rgba(0,0,0,0.6)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.1)]">
      {/* 左側: 元に戻す、やり直し、再生コントロール */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`px-3 py-2 rounded-lg transition-all text-sm ${
              !canUndo
                ? 'bg-[rgba(255,255,255,0.05)] text-gray-500 cursor-not-allowed'
                : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.2)]'
            }`}
            title={t('toolbar.undoTooltip')}
          >
            ↶ {t('toolbar.undo')}
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`px-3 py-2 rounded-lg transition-all text-sm ${
              !canRedo
                ? 'bg-[rgba(255,255,255,0.05)] text-gray-500 cursor-not-allowed'
                : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.2)]'
            }`}
            title={t('toolbar.redoTooltip')}
          >
            ↷ {t('toolbar.redo')}
          </button>
        </div>

        {/* 再生コントロール */}
        <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.1)] rounded-full p-1">
          <button
            onClick={onStepBack}
            className="p-2 hover:bg-[rgba(255,255,255,0.2)] rounded-full transition-colors"
            title={t('toolbar.stepBackOneFrameTooltip')}
          >
            ⏮
          </button>
          <button
            onClick={onPlayPause}
            className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 transition-all"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={onStepForward}
            className="p-2 hover:bg-[rgba(255,255,255,0.2)] rounded-full transition-colors"
            title={t('toolbar.stepForwardOneFrameTooltip')}
          >
            ⏭
          </button>
        </div>

        {/* 倍速再生 — クリックで cycle、右クリックで 1x にリセット */}
        <button
          onClick={cyclePlaybackRate}
          onContextMenu={(e) => {
            e.preventDefault();
            setPlaybackRate(1);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${
            playbackRate === 1
              ? 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.2)]'
              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 hover:bg-indigo-500/30'
          }`}
          title={t('toolbar.playbackRateTooltip')}
        >
          {formatRate(playbackRate)}
        </button>
      </div>

      {/* 右側: 同期警告、トップに戻る、下書き保存、エクスポート */}
      <div className="flex items-center gap-3">
        {showSyncWarning && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg">
            <span className="text-red-400 text-sm">{t('toolbar.syncWarning')}</span>
            <div className="text-xs text-red-300/80">
              {t('toolbar.syncWarningDetail', {
                timeline: totalDuration.toFixed(1),
                preview: previewDuration?.toFixed(1) || '?',
              })}
            </div>
          </div>
        )}

        <button
          onClick={onBackToTop}
          className="px-4 py-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] rounded-lg transition-all text-sm text-gray-300"
          title={t('toolbar.backToTopTooltip')}
        >
          {t('toolbar.backToTop')}
        </button>

        {hasSaveDraft && (
          <button
            id="save-draft-button"
            onClick={onSaveDraft}
            disabled={isSavingDraft}
            className={`px-5 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
              isSavingDraft
                ? 'bg-[rgba(255,255,255,0.1)] text-gray-400 cursor-not-allowed'
                : 'bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] text-gray-300 border border-[rgba(255,255,255,0.2)]'
            }`}
            title={t('toolbar.saveDraftTooltip')}
          >
            {isSavingDraft ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                <span>{t('toolbar.saving')}</span>
              </>
            ) : (
              <>
                <span className="text-lg">💾</span>
                <span>{t('toolbar.saveDraft')}</span>
              </>
            )}
          </button>
        )}

        <button
          id={TOUR_TARGETS.exportButton}
          onClick={onExport}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl font-semibold shadow-lg shadow-green-500/30 transition-all flex items-center gap-2"
        >
          <span className="text-lg">📥</span>
          <span>{t('toolbar.export')}</span>
        </button>
      </div>
    </div>
  );
}
