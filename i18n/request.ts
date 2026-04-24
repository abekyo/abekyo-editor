import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { cookies, headers } from 'next/headers';

type SupportedLocale = (typeof routing.locales)[number];

// Type-safe membership check. routing.locales is a readonly tuple of literal
// strings; checking an arbitrary string against it requires widening the
// element type, not casting the input to `any`.
function isSupportedLocale(value: string): value is SupportedLocale {
  return (routing.locales as readonly string[]).includes(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // requestLocaleが設定されていない場合、クッキーやヘッダーから取得
  if (!locale || !isSupportedLocale(locale)) {
    const cookieStore = await cookies();
    const langCookie = cookieStore.get('lang')?.value;

    if (langCookie && isSupportedLocale(langCookie)) {
      locale = langCookie;
    } else {
      // ヘッダーから取得を試みる
      const headersList = await headers();
      const headerLocale = headersList.get('x-user-locale');

      if (headerLocale && isSupportedLocale(headerLocale)) {
        locale = headerLocale;
      } else {
        locale = routing.defaultLocale;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

