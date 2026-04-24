'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { VideoEditor } from '@/components/VideoEditor';
import type { VideoClip, Subtitle, VideoResolution } from '@/src/types';

type RenderPhase =
  | 'idle'
  | 'bundling'
  | 'browserDownload'
  | 'selectingComposition'
  | 'rendering'
  | 'done';

interface RenderStatus {
  phase: RenderPhase;
  progress: number; // 0-100
  message: string;
}

export default function VideoEditPage() {
  const router = useRouter();
  const tc = useTranslations('common');
  const trp = useTranslations('render');

  const initialClips = useAppStore((s) => s.clips);
  const productData = useAppStore((s) => s.productData);
  const videoResolution = useAppStore((s) => s.videoResolution);
  const videoAspectRatio = useAppStore((s) => s.videoAspectRatio);
  const videoTempo = useAppStore((s) => s.videoTempo);
  const audioEnabled = useAppStore((s) => s.audioEnabled);
  const bgmUrl = useAppStore((s) => s.bgmUrl);
  const bgmVolume = useAppStore((s) => s.bgmVolume);
  const setBgmUrl = useAppStore((s) => s.setBgmUrl);
  const setBgmVolume = useAppStore((s) => s.setBgmVolume);
  const videoUrl = useAppStore((s) => s.videoUrl);
  const setVideoUrl = useAppStore((s) => s.setVideoUrl);

  const [mounted, setMounted] = useState(false);
  const [clips, setClips] = useState<VideoClip[]>(initialClips);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>({
    phase: 'idle',
    progress: 0,
    message: '',
  });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [, setBgmStartTime] = useState(0);
  const [, setBgmEndTime] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && initialClips.length === 0) {
      router.replace('/');
    }
  }, [mounted, initialClips, router]);

  const handleExport = async (exportResolution: VideoResolution) => {
    setRendering(true);
    setRenderError(null);
    setRenderStatus({
      phase: 'bundling',
      progress: 0,
      message: trp('preparing'),
    });

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips,
          subtitles,
          bgmUrl,
          bgmVolume,
          resolution: exportResolution,
          aspectRatio: videoAspectRatio,
          productName: productData?.name,
          audioEnabled,
        }),
      });

      // 4xx/5xx before streaming starts → JSON error body.
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Render failed' }));
        throw new Error(body.error || `Render failed (HTTP ${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Stream not supported by this browser.');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalVideoUrl: string | null = null;
      let finalFilename: string | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === 'progress') {
            setRenderStatus({
              phase: (event.phase as RenderPhase) ?? 'rendering',
              progress: typeof event.progress === 'number' ? event.progress : 0,
              message: typeof event.message === 'string' ? event.message : '',
            });
          } else if (event.type === 'done') {
            finalVideoUrl = typeof event.videoUrl === 'string' ? event.videoUrl : null;
            finalFilename = typeof event.filename === 'string' ? event.filename : null;
            setRenderStatus({
              phase: 'done',
              progress: 100,
              message: trp('done'),
            });
          } else if (event.type === 'error') {
            streamError = typeof event.error === 'string' ? event.error : 'Render failed';
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }
      if (!finalVideoUrl || !finalFilename) {
        throw new Error('Render finished without producing a video file.');
      }

      setVideoUrl(finalVideoUrl);
      const a = document.createElement('a');
      a.href = finalVideoUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
      setRenderStatus({ phase: 'idle', progress: 0, message: '' });
    }
  };

  const handleSaveDraft = async (subs: Subtitle[]) => {
    setSubtitles(subs);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        {tc('loading')}
      </div>
    );
  }

  if (initialClips.length === 0) {
    return null;
  }

  const phaseLabel = (phase: RenderPhase): string => {
    switch (phase) {
      case 'bundling':
        return trp('phase.bundling');
      case 'browserDownload':
        return trp('phase.browserDownload');
      case 'selectingComposition':
        return trp('phase.selectingComposition');
      case 'rendering':
        return trp('phase.rendering');
      case 'done':
        return trp('phase.done');
      default:
        return trp('phase.bundling');
    }
  };

  return (
    <main>
      {rendering && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            role="status"
            aria-live="polite"
            className="bg-gradient-to-br from-[#1a1a1a] via-[#121212] to-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 px-8 py-7"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 border-r-purple-400 animate-spin" />
              </div>
              <div className="text-sm font-semibold text-gray-100">
                {phaseLabel(renderStatus.phase)}
              </div>
            </div>

            <div className="text-xs text-gray-400 mb-4 min-h-[1.25rem]">
              {renderStatus.message || trp('phase.bundling')}
            </div>

            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(2, Math.min(100, renderStatus.progress))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
              <span>{renderStatus.progress}%</span>
              {renderStatus.phase === 'browserDownload' && (
                <span className="text-indigo-300/80">{trp('firstRunNotice')}</span>
              )}
            </div>
          </div>
        </div>
      )}
      {renderError && (
        <div className="fixed top-4 right-4 max-w-md bg-red-600/90 border border-red-500 rounded-lg px-4 py-3 text-white text-sm z-50">
          <div className="font-semibold mb-1">{trp('failedTitle')}</div>
          <div className="opacity-90">{renderError}</div>
          <button
            type="button"
            onClick={() => setRenderError(null)}
            className="mt-2 text-xs underline opacity-70 hover:opacity-100"
          >
            {trp('dismiss')}
          </button>
        </div>
      )}
      <VideoEditor
        clips={clips}
        productName={productData?.name || ''}
        videoResolution={videoResolution}
        videoAspectRatio={videoAspectRatio}
        videoTempo={videoTempo}
        audioEnabled={audioEnabled}
        bgmUrl={bgmUrl}
        bgmVolume={bgmVolume}
        onBgmUrlChange={setBgmUrl}
        onBgmVolumeChange={setBgmVolume}
        onBgmStartTimeChange={setBgmStartTime}
        onBgmEndTimeChange={setBgmEndTime}
        onClipsChange={setClips}
        onExport={handleExport}
        onSaveDraft={handleSaveDraft}
        isSavingDraft={false}
        videoUrl={videoUrl}
        initialSubtitles={subtitles}
      />
    </main>
  );
}
