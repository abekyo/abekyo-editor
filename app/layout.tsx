import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP, Inter, Roboto, Poppins } from "next/font/google";
import "./globals.css";
import { ProgressBar } from "@/components/ProgressBar";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getBaseUrl, generateCanonicalUrl, generateHreflangUrls } from '@/lib/utils/metadata';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const baseUrl = getBaseUrl();

const APP_NAME = "Abekyo Editor";
const APP_DESCRIPTION_EN = "Open-source video editor built on Remotion. Upload images and audio, arrange clips, add subtitles and BGM, then export.";
const APP_DESCRIPTION_JA = "Remotionベースのオープンソース動画編集エディタ。画像と音声をアップロードし、クリップ配置・字幕・BGM編集を行い、動画として書き出せます。";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const canonicalUrl = generateCanonicalUrl('/', locale as 'en' | 'ja');
  const hreflangUrls = generateHreflangUrls('/');
  const isJapanese = locale === 'ja';
  const description = isJapanese ? APP_DESCRIPTION_JA : APP_DESCRIPTION_EN;

  return {
    title: {
      default: APP_NAME,
      template: `%s | ${APP_NAME}`,
    },
    description,
    applicationName: APP_NAME,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangUrls,
    },
    openGraph: {
      type: "website",
      locale: isJapanese ? "ja_JP" : "en_US",
      url: canonicalUrl,
      siteName: APP_NAME,
      title: APP_NAME,
      description,
    },
    twitter: {
      card: "summary",
      title: APP_NAME,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} ${inter.variable} ${roboto.variable} ${poppins.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProgressBar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
