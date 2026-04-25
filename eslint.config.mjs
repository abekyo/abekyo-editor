import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The React Compiler rules below ship as errors in eslint-config-next,
      // but they flag aspirational patterns rather than bugs — patterns the
      // React Compiler cannot auto-memoize, not patterns that misbehave at
      // runtime. We surface them as warnings so the signal is preserved
      // without blocking CI; tightening to errors is a follow-up if/when the
      // codebase is migrated to compiler-friendly idioms wholesale.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
