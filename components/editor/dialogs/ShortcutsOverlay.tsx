'use client';

// Keyboard-shortcuts cheat sheet shown over the editor.
// Self-contained: subscribes to `showShortcuts` directly from the editor
// store and calls the store action to close. No props at all — drop it
// anywhere in the editor tree and it manages its own visibility.

import { useTranslations } from 'next-intl';
import { useEditorStore } from '@/lib/editorStore';

export function ShortcutsOverlay() {
  const t = useTranslations('editor');
  const showShortcuts = useEditorStore((s) => s.showShortcuts);
  const setShowShortcuts = useEditorStore((s) => s.setShowShortcuts);

  if (!showShortcuts) return null;

  const close = () => setShowShortcuts(false);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-[rgba(255,255,255,0.05)] backdrop-blur-xl rounded-2xl border border-[rgba(255,255,255,0.1)] p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-200">{t('shortcuts.modalTitle')}</h3>
          <button
            onClick={close}
            className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-300 mb-3">{t('shortcuts.playbackGroup')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label={t('shortcuts.playPause')} keys="Space" />
              <Row label={t('shortcuts.stepBack')} keys="←" />
              <Row label={t('shortcuts.stepForward')} keys="→" />
              <Row label={t('shortcuts.prevSequenceHead')} keys="↑" />
              <Row label={t('shortcuts.nextSequenceHead')} keys="↓" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-300 mb-3">{t('shortcuts.clipEditGroup')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label={t('shortcuts.copyClip')} keys="⌘ C" />
              <Row label={t('shortcuts.pasteClip')} keys="⌘ V" />
              <Row label={t('shortcuts.deleteClip')} keys="Del" />
              <Row label={t('shortcuts.cutClipSplit')} keys="S" />
              <Row label={t('shortcuts.cutClipCopy')} keys="⌘ X" />
              <Row label={t('shortcuts.cutToPrevClip')} keys="A" />
              <Row label={t('shortcuts.cutToNextClip')} keys="D" />
              <Row label={t('shortcuts.addClip')} keys="⌘ N" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-300 mb-3">{t('shortcuts.subtitleEditGroup')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label={t('shortcuts.copySubtitle')} keys="⌘ C" />
              <Row label={t('shortcuts.pasteSubtitle')} keys="⌘ V" />
              <Row label={t('shortcuts.deleteSubtitle')} keys="Del" />
              <Row label={t('shortcuts.cutSubtitleSplit')} keys="S" />
              <Row label={t('shortcuts.cutSubtitleCopy')} keys="⌘ X" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-300 mb-3">{t('shortcuts.otherActionsGroup')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label={t('toolbar.undo')} keys="⌘ Z" />
              <Row label={t('toolbar.redo')} keys="⌘ ⇧ Z" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-300 mb-3">{t('shortcuts.miscGroup')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row label={t('shortcuts.closeDialog')} keys="Esc" />
              <Row label={t('shortcuts.runExport')} keys="Enter" />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.1)]">
          <button
            onClick={close}
            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all font-medium"
          >
            {t('shortcuts.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// One label + key-cap row in the shortcut grid. Tiny private helper so the
// grids above don't drown in repeated className strings.
function Row({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.1)]">
      <span className="text-gray-300">{label}</span>
      <kbd className="px-3 py-1 bg-[rgba(255,255,255,0.1)] rounded text-sm font-mono text-gray-200">
        {keys}
      </kbd>
    </div>
  );
}
