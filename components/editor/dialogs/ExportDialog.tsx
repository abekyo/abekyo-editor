'use client';

// Export confirmation dialog with the resolution picker. Subscribes to
// `showExportDialog` directly from the editor store. The currently-selected
// resolution and the confirm action remain owned by VideoEditor (they are
// intertwined with the render pipeline), so they come in as props.

import { useTranslations } from 'next-intl';
import { useEditorStore } from '@/lib/editorStore';
import { RESOLUTIONS, type VideoResolution, type VideoAspectRatio } from '@/src/types';

export interface ExportDialogProps {
  videoAspectRatio: VideoAspectRatio;
  exportResolution: VideoResolution;
  onResolutionChange: (resolution: VideoResolution) => void;
  onConfirm: () => void;
}

export function ExportDialog({
  videoAspectRatio,
  exportResolution,
  onResolutionChange,
  onConfirm,
}: ExportDialogProps) {
  const t = useTranslations('editor');
  const showExportDialog = useEditorStore((s) => s.showExportDialog);
  const setShowExportDialog = useEditorStore((s) => s.setShowExportDialog);

  if (!showExportDialog) return null;

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl border border-[rgba(255,255,255,0.2)] p-8 max-w-2xl w-full mx-4 shadow-2xl">
        <h3 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          {t('export.dialogTitle')}
        </h3>
        <p className="text-gray-400 mb-6">{t('export.dialogDescription')}</p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-4">
            {t('export.resolutionLabel')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            {(Object.keys(RESOLUTIONS) as VideoResolution[]).map((res) => {
              const config = RESOLUTIONS[res][videoAspectRatio];
              const isSelected = exportResolution === res;

              return (
                <button
                  key={res}
                  type="button"
                  onClick={() => onResolutionChange(res)}
                  className={`px-4 py-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/30 scale-105'
                      : 'bg-[rgba(255,255,255,0.05)] text-gray-300 border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'
                  }`}
                >
                  <div className="font-bold text-lg mb-1">{config.label}</div>
                  <div className="text-xs opacity-80">
                    {config.width}×{config.height}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setShowExportDialog(false)}
            className="flex-1 px-6 py-4 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] text-gray-300 rounded-xl hover:bg-[rgba(255,255,255,0.15)] transition-all font-semibold"
          >
            {t('export.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl transition-all font-bold shadow-lg shadow-green-500/30 text-lg"
          >
            {t('export.startExport')}
          </button>
        </div>
      </div>
    </div>
  );
}
