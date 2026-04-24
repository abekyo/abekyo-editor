import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Integration test: the i18n parity script is a CI guard, so we run it as a
// subprocess against fixture locale dirs. We point the script at our fixture
// by copying it into a sandbox repo layout (it expects `messages/` next to
// itself).

const SCRIPT_SOURCE = path.resolve(__dirname, '..', 'scripts', 'check-i18n.mjs');

interface Sandbox {
  root: string;
  messagesDir: string;
  scriptPath: string;
  cleanup: () => void;
}

function makeSandbox(locales: Record<string, unknown>): Sandbox {
  const root = mkdtempSync(path.join(tmpdir(), 'abekyo-i18n-'));
  const messagesDir = path.join(root, 'messages');
  const scriptsDir = path.join(root, 'scripts');
  mkdirSync(messagesDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  for (const [code, content] of Object.entries(locales)) {
    writeFileSync(path.join(messagesDir, `${code}.json`), JSON.stringify(content, null, 2));
  }
  // Copy the script verbatim — its path resolution is relative to itself,
  // so dropping it into <sandbox>/scripts/ makes it look at <sandbox>/messages/.
  const scriptPath = path.join(scriptsDir, 'check-i18n.mjs');
  cpSync(SCRIPT_SOURCE, scriptPath);
  return {
    root,
    messagesDir,
    scriptPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function run(scriptPath: string) {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
  });
  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('scripts/check-i18n.mjs', () => {
  let sandboxes: Sandbox[] = [];
  beforeEach(() => { sandboxes = []; });
  afterEach(() => { sandboxes.forEach((s) => s.cleanup()); });

  it('passes when both locales have identical key trees', () => {
    const s = makeSandbox({
      en: { hello: 'Hello', nested: { a: '1', b: '2' } },
      ja: { hello: 'こんにちは', nested: { a: '一', b: '二' } },
    });
    sandboxes.push(s);
    const r = run(s.scriptPath);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/i18n OK/);
  });

  it('fails when one locale is missing a key', () => {
    const s = makeSandbox({
      en: { hello: 'Hello', goodbye: 'Bye' },
      ja: { hello: 'こんにちは' }, // missing goodbye
    });
    sandboxes.push(s);
    const r = run(s.scriptPath);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/missing/);
    expect(r.stderr).toMatch(/goodbye/);
  });

  it('fails when one locale has an extra key not in the base', () => {
    const s = makeSandbox({
      en: { hello: 'Hello' },
      ja: { hello: 'こんにちは', extra: '追加' }, // extra
    });
    sandboxes.push(s);
    const r = run(s.scriptPath);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/extra/);
  });

  it('fails when a value is an empty string (renders as raw key in next-intl)', () => {
    const s = makeSandbox({
      en: { greeting: 'Hi', blank: '' },
      ja: { greeting: 'やあ', blank: '' },
    });
    sandboxes.push(s);
    const r = run(s.scriptPath);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/empty-string/);
    expect(r.stderr).toMatch(/blank/);
  });

  it('fails fast on invalid JSON', () => {
    const s = makeSandbox({ en: { hello: 'Hello' } });
    sandboxes.push(s);
    // Replace ja.json with garbage.
    writeFileSync(path.join(s.messagesDir, 'ja.json'), '{ this is: not json');
    const r = run(s.scriptPath);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/invalid JSON/);
  });

  it('fails when fewer than 2 locales exist (nothing to compare against)', () => {
    const s = makeSandbox({ en: { hello: 'Hello' } });
    sandboxes.push(s);
    const r = run(s.scriptPath);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/Need at least 2/);
  });

  it('script file exists and is non-empty (sanity)', () => {
    expect(statSync(SCRIPT_SOURCE).size).toBeGreaterThan(0);
  });
});
