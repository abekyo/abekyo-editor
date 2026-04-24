'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';

const LOCALES: { code: 'en' | 'ja'; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const handleChange = (next: 'en' | 'ja') => {
    if (next === locale) return;
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `lang=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    startTransition(() => {
      window.location.reload();
    });
  };

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur px-1.5 py-1 text-xs border border-white/10">
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => handleChange(l.code)}
            disabled={pending || active}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-full transition ${
              active
                ? 'bg-white/20 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            } ${pending ? 'opacity-60 cursor-wait' : ''}`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
