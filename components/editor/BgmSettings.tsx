'use client';

// BGM track picker, custom upload, volume + trim controls, and subtitle
// read-aloud volume controls. Owns its own UI state (selected genre,
// preview track, library cache from localStorage) and is otherwise driven
// by props from the parent VideoEditor.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { debug, logError } from '@/lib/utils/logger.client';
import { getBgmByGenre, getGenres, type BgmTrack } from '@/lib/bgmLibrary';

export interface BgmSettingsProps {
  bgmUrl: string | null;
  bgmVolume: number;
  bgmStartTime: number; // BGMの開始位置（秒）
  bgmEndTime: number | null; // BGMの終了位置（秒、nullの場合は最後まで）
  bgmEnabled: boolean;
  subtitleAudioEnabled: boolean;
  subtitleAudioVolume: number; // 字幕読み上げの音量
  onBgmUrlChange: (url: string | null) => void;
  onVolumeChange: (volume: number) => void;
  onBgmStartTimeChange: (time: number) => void;
  onBgmEndTimeChange: (time: number | null) => void;
  onEnabledChange: (enabled: boolean) => void;
  onSubtitleAudioEnabledChange: (enabled: boolean) => void;
  onSubtitleAudioVolumeChange: (volume: number) => void;
}

export function BgmSettings({
  bgmUrl,
  bgmVolume,
  bgmStartTime,
  bgmEndTime,
  bgmEnabled: _bgmEnabled,
  subtitleAudioEnabled,
  subtitleAudioVolume,
  onBgmUrlChange,
  onVolumeChange,
  onBgmStartTimeChange,
  onBgmEndTimeChange,
  onEnabledChange,
  onSubtitleAudioEnabledChange,
  onSubtitleAudioVolumeChange,
}: BgmSettingsProps) {
  const t = useTranslations('editor');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [previewBgmId, setPreviewBgmId] = useState<string | null>(null);
  const [bgmLibrary, setBgmLibrary] = useState<BgmTrack[]>([]);
  const [loadingLibrary] = useState(false);
  const [bgmDuration, setBgmDuration] = useState<number>(0);
  const libraryLoadedRef = useRef(false);

  // BGMライブラリはlocalStorageで永続化（ユーザー自身がアップロードしたBGMを保持）
  useEffect(() => {
    if (libraryLoadedRef.current) return;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('abekyo:bgmLibrary');
        if (raw) {
          const parsed = JSON.parse(raw) as BgmTrack[];
          if (Array.isArray(parsed)) setBgmLibrary(parsed);
        }
      }
      libraryLoadedRef.current = true;
    } catch (error) {
      logError('BGMライブラリの読み込みエラー:', error);
    }
  }, []);

  const persistLibrary = useCallback((library: BgmTrack[]) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('abekyo:bgmLibrary', JSON.stringify(library));
      }
    } catch (error) {
      logError('BGMライブラリの保存エラー:', error);
    }
  }, []);

  const handleRemoveLibraryTrack = useCallback((trackId: string) => {
    setBgmLibrary((prev) => {
      const next = prev.filter((tr) => tr.id !== trackId);
      persistLibrary(next);
      return next;
    });
    if (previewBgmId === trackId) setPreviewBgmId(null);
  }, [persistLibrary, previewBgmId]);

  // BGM URLが変更された時に自動再生
  useEffect(() => {
    if (bgmUrl && audioRef.current && previewBgmId) {
      const track = bgmLibrary.find((tr) => tr.id === previewBgmId);
      if (track && track.url === bgmUrl) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = bgmUrl;
        audioRef.current.load();
        audioRef.current.play().catch((error) => {
          debug('[BgmSettings] 自動再生がブロックされました（ユーザー操作が必要）:', error);
        });
      }
    }
  }, [bgmUrl, previewBgmId, bgmLibrary]);

  const handleBgmUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'BGM upload failed');
      }
      const data = await response.json();
      if (!data.url) throw new Error('No URL returned');

      const newTrack: BgmTrack = {
        id: `bgm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        description: '',
        genre: 'Uploaded',
        url: data.url,
      };

      setBgmLibrary((prev) => {
        const next = [newTrack, ...prev];
        persistLibrary(next);
        return next;
      });

      onBgmUrlChange(data.url);
      onEnabledChange(true);
      setPreviewBgmId(newTrack.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BGMのアップロードに失敗しました:', error);
      alert(message || t('alert.bgmUploadFailed'));
    }
  };

  const filteredBgms = selectedGenre ? getBgmByGenre(bgmLibrary, selectedGenre) : bgmLibrary;

  const handleBgmSelect = (track: BgmTrack) => {
    onBgmUrlChange(track.url);
    onEnabledChange(true);
    setPreviewBgmId(track.id);
  };

  return (
    <div className="space-y-4">
      {/* BGMライブラリ */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-3">{t('bgmSettings.libraryLabel')}</label>

        {/* ジャンルフィルター */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              selectedGenre === null
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.15)]'
            }`}
          >
            {t('bgmSettings.genreAll')}
          </button>
          {getGenres(bgmLibrary).map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                selectedGenre === genre
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                  : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.15)]'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* BGMリスト */}
        {loadingLibrary ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {t('bgmSettings.loadingLibrary')}
          </div>
        ) : filteredBgms.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            {bgmLibrary.length === 0 ? t('bgmSettings.emptyLibrary') : t('bgmSettings.emptyGenre')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {filteredBgms.map((track) => (
              <div
                key={track.id}
                className={`group relative p-3 rounded-xl border transition-all ${
                  bgmUrl === track.url
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-400/50'
                    : 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <button type="button" onClick={() => handleBgmSelect(track)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="text-sm font-semibold text-gray-200 truncate">{track.name}</div>
                      {track.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{track.description}</div>
                      )}
                    </div>
                    {bgmUrl === track.url && <div className="ml-2 text-pink-400">✓</div>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveLibraryTrack(track.id);
                  }}
                  aria-label={t('bgmSettings.removeFromLibraryAria')}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 hover:bg-red-600 text-gray-400 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[rgba(255,255,255,0.1)]"></div>

      {/* カスタムアップロード */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">{t('bgmSettings.customBgmLabel')}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBgmUpload(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-6 border-2 border-dashed border-[rgba(255,255,255,0.3)] rounded-xl hover:border-pink-400 hover:bg-pink-500/10 transition-all text-gray-400 hover:text-pink-400"
        >
          <div className="text-2xl mb-2">🎵</div>
          <div className="text-sm">{bgmUrl ? t('bgmSettings.changeBgm') : t('bgmSettings.uploadBgm')}</div>
        </button>
      </div>

      {bgmUrl && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-300">
            {t('bgmSettings.bgmVolumeLabel', { percent: Math.round(bgmVolume * 100) })}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={bgmVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* BGMの再生とトリミング機能 */}
      {bgmUrl && (
        <div className="space-y-4">
          <div className="relative p-4 bg-[rgba(255,255,255,0.1)] rounded-xl border border-[rgba(255,255,255,0.2)]">
            <audio
              ref={audioRef}
              src={bgmUrl}
              controls
              className="w-full"
              onLoadedMetadata={(e) => {
                const audio = e.currentTarget;
                setBgmDuration(audio.duration);
                if (!bgmEndTime || bgmEndTime > audio.duration) {
                  onBgmEndTimeChange(audio.duration);
                }
                if (previewBgmId) {
                  const track = bgmLibrary.find((tr) => tr.id === previewBgmId);
                  if (track && track.url === bgmUrl) {
                    setTimeout(() => {
                      audio.play().catch((error) => {
                        debug('[BgmSettings] 自動再生がブロックされました（ユーザー操作が必要）:', error);
                      });
                    }, 100);
                  }
                }
              }}
            />
          </div>

          {/* BGM削除ボタン */}
          <button
            onClick={() => {
              onBgmUrlChange(null);
              onEnabledChange(false);
              setPreviewBgmId(null);
              onBgmStartTimeChange(0);
              onBgmEndTimeChange(null);
              setBgmDuration(0);
            }}
            className="w-full px-4 py-3 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl hover:bg-red-500/30 transition-all font-medium"
          >
            {t('bgmSettings.deleteBgm')}
          </button>

          {/* トリミング設定 */}
          {bgmDuration > 0 && (
            <div className="space-y-4 p-4 bg-[rgba(255,255,255,0.05)] rounded-xl border border-[rgba(255,255,255,0.1)]">
              <label className="block text-sm font-semibold text-gray-300">{t('bgmSettings.trimmingLabel')}</label>

              {/* 開始位置 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">{t('bgmSettings.trimStartLabel')}</label>
                  <span className="text-xs text-gray-300">{t('bgmSettings.secondsSuffix', { value: bgmStartTime.toFixed(1) })}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={bgmDuration}
                  step="0.1"
                  value={bgmStartTime}
                  onChange={(e) => {
                    const newStart = parseFloat(e.target.value);
                    const maxEnd = bgmEndTime || bgmDuration;
                    if (newStart < maxEnd) {
                      onBgmStartTimeChange(newStart);
                      if (audioRef.current) audioRef.current.currentTime = newStart;
                    }
                  }}
                  className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              {/* 終了位置 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">{t('bgmSettings.trimEndLabel')}</label>
                  <span className="text-xs text-gray-300">
                    {t('bgmSettings.secondsSuffix', { value: (bgmEndTime || bgmDuration).toFixed(1) })}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={bgmDuration}
                  step="0.1"
                  value={bgmEndTime || bgmDuration}
                  onChange={(e) => {
                    const newEnd = parseFloat(e.target.value);
                    if (newEnd > bgmStartTime) onBgmEndTimeChange(newEnd);
                  }}
                  className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              {/* 使用される長さの表示 */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[rgba(255,255,255,0.1)]">
                <span className="text-gray-400">{t('bgmSettings.usedLengthLabel')}</span>
                <span className="text-gray-200 font-semibold">
                  {t('bgmSettings.secondsSuffix', { value: ((bgmEndTime || bgmDuration) - bgmStartTime).toFixed(1) })}
                </span>
              </div>

              {/* リセットボタン */}
              <button
                onClick={() => {
                  onBgmStartTimeChange(0);
                  onBgmEndTimeChange(bgmDuration);
                  if (audioRef.current) audioRef.current.currentTime = 0;
                }}
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] text-gray-300 rounded-lg hover:bg-[rgba(255,255,255,0.15)] transition-all text-xs"
              >
                {t('bgmSettings.resetTrimming')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 字幕読み上げの音設定 */}
      <div className="pt-4 border-t border-[rgba(255,255,255,0.1)] space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-300">{t('bgmSettings.subtitleReadAloudLabel')}</label>
          <button
            onClick={() => onSubtitleAudioEnabledChange(!subtitleAudioEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              subtitleAudioEnabled ? 'bg-pink-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                subtitleAudioEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-400">{t('bgmSettings.subtitleReadAloudHelp')}</p>

        {/* 字幕読み上げの音量調整 */}
        {subtitleAudioEnabled && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-300">
              {t('bgmSettings.readAloudVolumeLabel', { percent: Math.round(subtitleAudioVolume * 100) })}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={subtitleAudioVolume}
              onChange={(e) => onSubtitleAudioVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">{t('bgmSettings.readAloudVolumeHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
