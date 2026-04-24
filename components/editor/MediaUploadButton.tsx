'use client';

// Per-clip media upload button used in the Properties panel to swap an
// existing clip's image/video. Posts to /api/upload and hands the resulting
// URL back through onUpload.

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { logError } from '@/lib/utils/logger.client';

export interface MediaUploadButtonProps {
  onUpload: (url: string) => void;
}

export function MediaUploadButton({ onUpload }: MediaUploadButtonProps) {
  const t = useTranslations('editor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || t('error.mediaUploadFailed'));
      }

      const data = await response.json();
      if (!data.url) throw new Error(t('error.noUrlReturned'));
      onUpload(data.url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('メディアのアップロードに失敗しました:', error);
      alert(message || t('alert.mediaUploadFailed'));
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUpload(file);
          }
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full px-4 py-8 border-2 border-dashed border-[rgba(255,255,255,0.3)] rounded-xl hover:border-indigo-400 hover:bg-indigo-500/10 transition-all text-gray-400 hover:text-indigo-400"
      >
        <div className="text-2xl mb-2">🎞️</div>
        <div className="text-sm">{t('mediaUpload.uploadMedia')}</div>
      </button>
    </>
  );
}
