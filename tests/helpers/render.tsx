// Test render helper that wraps the component-under-test in the same
// providers it would have at runtime — currently just NextIntlClientProvider
// loaded with the real English message bundle. Keeps each test free of
// boilerplate and ensures missing-translation bugs surface naturally.

import type { ReactElement } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/messages/en.json';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: 'en' | 'ja';
}

export function render(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { locale = 'en', ...rtlOptions } = options;
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...rtlOptions,
  });
}

// Re-export everything from @testing-library/react so test files only need
// one import line (`import { render, screen, … } from '../helpers/render'`).
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
