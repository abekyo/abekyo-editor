// Loaded by Vitest before each component test (the ones that opt into the
// jsdom environment via `@vitest-environment jsdom`). Wires up the matchers
// from @testing-library/jest-dom (`toBeInTheDocument`, `toHaveClass`, …)
// and provides DOM API polyfills that jsdom lacks but Tailwind / Next.js
// components routinely call.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia. Some Tailwind utilities and a few
// Next.js components touch it on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Stub scrollIntoView — used by Onboarding to bring the highlighted target
// into view; jsdom doesn't implement it.
if (typeof window !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
