'use client';

// "Save before leaving?" confirmation shown when the user clicks Back-to-top
// while there are unsaved changes. Show/hide state lives in VideoEditor as
// local state (not lifted to the editor store) — it's a one-shot confirmation
// tightly coupled to the back navigation, so we keep it as a plain prop.

import { useTranslations } from 'next-intl';

export interface ExitConfirmDialogProps {
  open: boolean;
  isSavingDraft: boolean;
  onSaveAndExit: () => void;
  onExit: () => void;
  onCancel: () => void;
}

export function ExitConfirmDialog({
  open,
  isSavingDraft,
  onSaveAndExit,
  onExit,
  onCancel,
}: ExitConfirmDialogProps) {
  const t = useTranslations('editor');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-[rgba(20,20,20,0.95)] backdrop-blur-xl rounded-2xl border border-[rgba(255,255,255,0.1)] p-8 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-2xl font-bold text-white mb-4">{t('exitConfirm.title')}</h3>
        <p className="text-gray-300 mb-6">{t('exitConfirm.description')}</p>
        <div className="flex gap-3">
          <button
            onClick={onSaveAndExit}
            disabled={isSavingDraft}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingDraft ? t('exitConfirm.savingAndExit') : t('exitConfirm.saveAndExit')}
          </button>
          <button
            onClick={onExit}
            className="flex-1 px-6 py-3 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-gray-300 rounded-xl transition-all font-semibold"
          >
            {t('exitConfirm.exitWithoutSaving')}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-gray-400 rounded-xl transition-all font-semibold"
          >
            {t('exitConfirm.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
