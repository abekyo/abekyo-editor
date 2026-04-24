#!/usr/bin/env node
// Verifies that every locale in messages/ has the same set of translation keys.
// Run locally or in CI: `npm run i18n:check`. Exits non-zero on any mismatch
// (missing keys, extra keys, or empty-string values), so a PR that only
// touches one locale cannot merge without the others being updated.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(__dirname, '..', 'messages');

/** Flatten a nested JSON object into dotted keys. */
function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

const localeFiles = readdirSync(messagesDir).filter((f) => f.endsWith('.json')).sort();
if (localeFiles.length < 2) {
  console.error(`Need at least 2 locale files in ${messagesDir}; found ${localeFiles.length}.`);
  process.exit(1);
}

const trees = {};
for (const file of localeFiles) {
  const locale = path.basename(file, '.json');
  const raw = readFileSync(path.join(messagesDir, file), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`✗ ${file}: invalid JSON — ${err.message}`);
    process.exit(1);
  }
  trees[locale] = flatten(parsed);
}

const [baseLocale, ...otherLocales] = Object.keys(trees);
const baseKeys = new Set(trees[baseLocale].map(([k]) => k));

let ok = true;

// Cross-locale key parity
for (const locale of otherLocales) {
  const localeKeys = new Set(trees[locale].map(([k]) => k));
  const missing = [...baseKeys].filter((k) => !localeKeys.has(k)).sort();
  const extra = [...localeKeys].filter((k) => !baseKeys.has(k)).sort();
  if (missing.length) {
    ok = false;
    console.error(`✗ [${locale}] missing ${missing.length} key(s) present in ${baseLocale}:`);
    for (const k of missing) console.error(`    - ${k}`);
  }
  if (extra.length) {
    ok = false;
    console.error(`✗ [${locale}] has ${extra.length} key(s) not in ${baseLocale}:`);
    for (const k of extra) console.error(`    + ${k}`);
  }
}

// Empty-string detection (all locales): empty values render the raw key name
// in the UI via next-intl's fallback, which is effectively a missing translation.
for (const [locale, entries] of Object.entries(trees)) {
  const empties = entries.filter(([, v]) => typeof v === 'string' && v.trim() === '').map(([k]) => k);
  if (empties.length) {
    ok = false;
    console.error(`✗ [${locale}] has ${empties.length} empty-string value(s):`);
    for (const k of empties) console.error(`    · ${k}`);
  }
}

if (ok) {
  console.log(
    `✓ i18n OK — ${baseKeys.size} keys across ${Object.keys(trees).length} locales ` +
      `(${Object.keys(trees).join(', ')})`,
  );
  process.exit(0);
}
process.exit(1);
