'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { VideoClip } from '@/src/types';

const DEFAULT_CLIP_DURATION = 3;
// Repository URL for GitHub CTAs. Set NEXT_PUBLIC_GITHUB_URL in .env.local.
// When unset the GitHub buttons and footer links are hidden so the page never
// ships with a dead placeholder link.
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || '';
const HAS_GITHUB_URL = GITHUB_URL.length > 0;

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data: { url: string } = await res.json();
  return data.url;
}

// --- Icons -----------------------------------------------------------------

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconImageStack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 7h3v3H7z" />
      <path d="M21 7v14a2 2 0 0 1-2 2H7" />
    </svg>
  );
}

function IconGithub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.33-1.78-1.33-1.78-1.1-.74.08-.73.08-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.48 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.3.47-2.38 1.24-3.22-.13-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.71.84.58A12 12 0 0 0 12 .3" />
    </svg>
  );
}

// --- Drag overlay ----------------------------------------------------------

function DragOverlay({ visible, label, hint }: { visible: boolean; label: string; hint: string }) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-0 z-[100] transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm" />
      <div className="absolute inset-6 rounded-3xl border-2 border-dashed border-indigo-400/60" />
      <div className="relative h-full flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-6 w-24 h-24 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center animate-pulse">
            <IconUpload className="w-10 h-10 text-indigo-200" />
          </div>
          <div className="text-2xl font-semibold text-white">{label}</div>
          <div className="mt-2 text-sm text-indigo-300">{hint}</div>
        </div>
      </div>
    </div>
  );
}

// --- Page ------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('home');
  const setClips = useAppStore((s) => s.setClips);
  const setProductData = useAppStore((s) => s.setProductData);

  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Content from i18n (arrays via t.raw so translators can own the copy)
  const highlights = useMemo(() => (t.raw('highlights') as string[]) ?? [], [t]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Single entry point for both file-input selection and global drag-and-drop.
  // The moment the user picks media, we upload it and jump to the editor.
  // No staging area on the landing page — refinements (BGM, narration, more
  // clips, reordering) all happen in the editor.
  const handleMedia = useCallback(
    async (files: FileList | File[] | null) => {
      if (uploading || !files) return;
      const list = Array.from(files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      );
      if (list.length === 0) return;

      setUploading(true);
      setErrorMessage(null);
      try {
        const uploaded: string[] = [];
        for (let i = 0; i < list.length; i++) {
          setUploadProgress(t('uploadingN', { current: i + 1, total: list.length }));
          uploaded.push(await uploadFile(list[i]));
        }

        const clips: VideoClip[] = uploaded.map((imageUrl, index) => ({
          plotName: `Clip ${index + 1}`,
          text: '',
          imageUrl,
          audioUrl: '',
          duration: DEFAULT_CLIP_DURATION,
          index,
          totalClips: uploaded.length,
        }));

        setClips(clips);
        setProductData({
          name: 'Untitled Project',
          description: '',
          images: uploaded,
          reviews: [],
        });

        router.push('/video-edit');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setUploading(false);
        setUploadProgress('');
      }
      // Note: no `finally` to clear `uploading` on success — we want the
      // overlay to stay visible until the navigation actually happens, so the
      // user does not see the empty upload zone flash for a frame.
    },
    [uploading, t, setClips, setProductData, router],
  );

  // Window-wide drag & drop
  useEffect(() => {
    let counter = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter += 1;
      setIsDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter = Math.max(0, counter - 1);
      if (counter === 0) setIsDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      counter = 0;
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        handleMedia(e.dataTransfer.files);
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleMedia]);

  return (
    <>
      <LanguageSwitcher />
      <DragOverlay visible={isDragging} label={t('dropOverlayTitle')} hint={t('dropOverlayHint')} />

      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#121214] to-[#0d0d0d] text-white">
        {/* --- decorative background (5 pulse blurs + subtle grid) --- */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl animate-pulse" />
          <div
            className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-purple-500/15 via-pink-500/10 to-transparent blur-3xl animate-pulse"
            style={{ animationDelay: '1.5s' }}
          />
          <div
            className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-pink-500/8 via-orange-500/5 to-transparent blur-3xl animate-pulse"
            style={{ animationDelay: '3s' }}
          />
          <div
            className="absolute top-20 right-20 h-72 w-72 rounded-full bg-indigo-400/5 blur-2xl animate-pulse"
            style={{ animationDelay: '0.5s' }}
          />
          <div
            className="absolute bottom-20 left-20 h-72 w-72 rounded-full bg-purple-400/5 blur-2xl animate-pulse"
            style={{ animationDelay: '2.5s' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-20 pb-40 sm:px-6 md:pt-28 lg:px-8 lg:pb-32">
          {/* --- Hero --- */}
          <section
            className={`mb-16 text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="inline-flex items-center gap-2.5 rounded-full border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 px-5 py-2.5 text-sm font-medium text-indigo-300 shadow-lg shadow-indigo-500/10 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-indigo-500/20 mb-10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
              </span>
              <span className="bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
                {t('heroBadge')}
              </span>
            </div>

            <h1 className="mb-8 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              <span className="block mb-2 text-white drop-shadow-2xl">
                {t('heroTitleLine1')}
              </span>
              <span className="block animate-gradient bg-gradient-to-r from-indigo-400 via-purple-400 via-pink-400 to-orange-400 bg-[length:200%_auto] bg-clip-text text-transparent">
                {t('heroTitleLine2')}
              </span>
            </h1>

            {HAS_GITHUB_URL && (
              <div className="flex items-center justify-center">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  <IconGithub className="h-4 w-4" />
                  {t('ctaGithub')}
                </a>
              </div>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-gray-500">
              {highlights.map((h) => (
                <span key={h} className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span>
                  {h}
                </span>
              ))}
            </div>
          </section>

          {/* --- Upload section --- */}
          <section
            className={`relative mb-24 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="relative mx-auto max-w-5xl">
              {/* pulsing glow border */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-20 blur-xl animate-pulse" />

              <div className="relative rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-white/[0.01] p-6 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-white/25 hover:shadow-[0_20px_60px_rgba(99,102,241,0.28)] sm:p-8 lg:p-10">
                {/* headline inside the card */}
                <div className="mb-6 flex items-center gap-3">
                  <IconImageStack className="h-5 w-5 text-indigo-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                    {t('uploadHeroTitle')}
                  </h2>
                </div>

                {uploading ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/5 px-6 py-16 text-center">
                    <span className="h-10 w-10 rounded-full border-[3px] border-indigo-300/30 border-t-indigo-300 animate-spin" />
                    <div className="text-sm font-medium text-indigo-100">
                      {uploadProgress || t('uploading')}
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-purple-500/25 transition group-hover:scale-110">
                        <IconUpload className="h-7 w-7 text-indigo-200" />
                      </div>
                      <div className="text-base font-semibold text-gray-100">
                        {t('uploadImages')}
                      </div>
                      <div className="mt-1.5 text-xs text-gray-500">{t('uploadHeroHint')}</div>
                      <div className="mt-2 text-[11px] text-gray-600">{t('uploadImagesHint')}</div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*,video/mp4,video/quicktime,video/webm"
                        multiple
                        className="hidden"
                        onChange={(e) => handleMedia(e.target.files)}
                      />
                    </button>

                    {errorMessage && (
                      <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {errorMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* --- Footer --- */}
          <footer className="mt-24 border-t border-white/5 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span>{t('footerCopyright')}</span>
                <span className="text-gray-700">·</span>
                <span>{t('footerLicense')}</span>
              </div>
              {HAS_GITHUB_URL && (
                <div className="flex items-center gap-4">
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-gray-200"
                  >
                    <IconGithub className="h-3.5 w-3.5" />
                    {t('footerGithub')}
                  </a>
                  <a
                    href={`${GITHUB_URL}#readme`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-gray-200"
                  >
                    {t('footerReadme')}
                  </a>
                </div>
              )}
            </div>
          </footer>
        </div>

      </main>
    </>
  );
}
