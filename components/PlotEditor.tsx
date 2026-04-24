'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plot } from '@/lib/types';

interface PlotEditorProps {
  plot: Plot;
  onRegenerate: () => Promise<void>;
  onEdit: (content: string) => void;
  loading?: boolean;
}

export function PlotEditor({
  plot,
  onRegenerate,
  onEdit,
  loading = false,
}: PlotEditorProps) {
  const t = useTranslations('plotEditor');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(plot.content);

  useEffect(() => {
    setEditContent(plot.content);
  }, [plot.content]);

  const handleSave = () => {
    onEdit(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(plot.content);
    setIsEditing(false);
  };

  const hasContent = plot.content && plot.content.trim().length > 0;

  return (
    <div className="group relative bg-gradient-to-br from-[rgba(255,255,255,0.04)] to-[rgba(255,255,255,0.02)] backdrop-blur-xl rounded-2xl border border-[rgba(255,255,255,0.1)] p-6 space-y-5 hover:border-[rgba(255,255,255,0.2)] hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
      {/* シーン番号バッジ */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="text-xl font-bold text-indigo-400">{plot.index + 1}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-gray-100 mb-1 flex items-center gap-2">
              <span className="text-indigo-400">🎬</span>
              {plot.name}
            </h3>
            <p className="text-xs text-gray-500">{t('sceneCaption', { number: plot.index + 1 })}</p>
          </div>
        </div>
        
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:shadow-none flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{t('generating')}</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{t('regenerate')}</span>
            </>
          )}
        </button>
      </div>

      {/* コンテンツエリア */}
      {isEditing ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-2">
              {t('editLabel')}
            </label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[140px] bg-[rgba(0,0,0,0.3)] border-2 border-indigo-500/30 rounded-xl p-4 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/60 backdrop-blur-sm transition-all resize-y"
              placeholder={t('editPlaceholder')}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {t('charCount', { count: editContent.length })}
              </p>
              {editContent.length > 15 && (
                <p className="text-xs text-amber-400">{t('charTooMany')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 text-sm font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2"
            >
              <span>✓</span>
              <span>{t('save')}</span>
            </button>
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-gray-300 rounded-xl hover:bg-[rgba(255,255,255,0.1)] text-sm font-medium transition-all backdrop-blur-sm"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {hasContent ? (
            <>
              <div className="bg-[rgba(0,0,0,0.2)] rounded-xl p-5 border border-[rgba(255,255,255,0.05)]">
                <p className="text-gray-100 whitespace-pre-wrap leading-relaxed text-base font-medium">
                  {plot.content}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>📝</span>
                  <span>{t('charCountShort', { count: plot.content.length })}</span>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-indigo-400 rounded-lg hover:bg-[rgba(255,255,255,0.1)] hover:border-indigo-500/50 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <span>✏️</span>
                  <span>{t('edit')}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-8 border-2 border-dashed border-[rgba(255,255,255,0.1)] text-center">
              <div className="text-4xl mb-3 opacity-50">📝</div>
              <p className="text-gray-400 text-sm mb-4">
                {t('emptyMessage')}
              </p>
              <button
                onClick={onRegenerate}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all text-sm font-semibold shadow-lg shadow-indigo-500/30 disabled:shadow-none flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('generating')}</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>{t('generateContent')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

