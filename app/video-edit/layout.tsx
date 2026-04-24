import type { Metadata } from "next";
import { getLocale } from 'next-intl/server';
import { getBaseUrl, generateCanonicalUrl, generateHreflangUrls } from '@/lib/utils/metadata';

const baseUrl = getBaseUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const canonicalUrl = generateCanonicalUrl('/video-edit', locale as 'en' | 'ja');

  return {
    title: locale === 'ja' ? "動画編集" : "Video Editor",
    description: locale === 'ja' 
      ? "タイムライン編集、字幕調整、BGM追加など、動画を自由に編集できます。"
      : "Edit your video with timeline editing, subtitle adjustments, BGM, and more.",
    robots: {
      index: false, // 認証が必要なページはインデックスしない
      follow: false,
    },
    alternates: {
      canonical: canonicalUrl,
      languages: generateHreflangUrls('/video-edit'),
    },
  };
}

export default function VideoEditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}





