import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests live under /tests and exercise pure-logic helpers extracted from the
// API routes. We deliberately avoid pulling in the full Remotion renderer or
// next/server runtime in unit tests — those concerns are tested only at the
// shape of their inputs/outputs, not by spinning up a real renderer.
export default defineConfig({
  test: {
    environment: 'node',
    // Pick up both .test.ts (route/util/store unit tests in node) and
    // .test.tsx (React component smoke tests; they opt into jsdom via the
    // file-level `// @vitest-environment jsdom` annotation).
    include: ['tests/**/*.test.{ts,tsx}'],
    // tests/helpers/* are utilities, not test files
    exclude: ['tests/helpers/**', 'node_modules/**', '.next/**'],
    setupFiles: ['tests/setup-jsdom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'app/api/**/*.ts',
        'lib/**/*.ts',
        'scripts/**/*.mjs',
        'components/editor/**/*.tsx',
      ],
      exclude: [
        '**/*.d.ts',
        'lib/utils/logger*.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
