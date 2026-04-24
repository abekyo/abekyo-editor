import { describe, it, expect } from 'vitest';
import { createRateLimiter, getClientIp } from '@/app/api/render/rate-limit';

describe('createRateLimiter — sliding window', () => {
  it('allows requests up to the configured maximum', () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 3 });
    const t = 1_000_000;
    expect(limiter.check('1.1.1.1', t)).toEqual({ allowed: true });
    expect(limiter.check('1.1.1.1', t)).toEqual({ allowed: true });
    expect(limiter.check('1.1.1.1', t)).toEqual({ allowed: true });
  });

  it('rejects the (max+1)th request and reports retryAfter', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const t = 1_000_000;
    limiter.check('2.2.2.2', t);
    limiter.check('2.2.2.2', t);
    const result = limiter.check('2.2.2.2', t);
    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      // window starts at t and is 60s; oldest entry is at t, so retry in ~60s
      expect(result.retryAfterSec).toBe(60);
    }
  });

  it('reports a smaller retryAfter as the window slides', () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    limiter.check('3.3.3.3', 0);
    const at7s = limiter.check('3.3.3.3', 7_000);
    expect(at7s.allowed).toBe(false);
    if (at7s.allowed === false) {
      // oldest is at t=0, window expires at t=10_000, so 10000-7000 = 3s
      expect(at7s.retryAfterSec).toBe(3);
    }
  });

  it('lets the request through once the oldest entry falls out of the window', () => {
    const limiter = createRateLimiter({ windowMs: 5_000, max: 1 });
    expect(limiter.check('4.4.4.4', 0).allowed).toBe(true);
    expect(limiter.check('4.4.4.4', 4_000).allowed).toBe(false);
    // Past the window; oldest entry expires.
    expect(limiter.check('4.4.4.4', 5_001).allowed).toBe(true);
  });

  it('isolates state across distinct IPs', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const t = 1_000;
    expect(limiter.check('a', t).allowed).toBe(true);
    expect(limiter.check('a', t).allowed).toBe(false); // a exhausted
    expect(limiter.check('b', t).allowed).toBe(true); // b is independent
  });

  it('counts blocked attempts toward the cap (no free retries)', () => {
    // The blocked attempt should NOT push out the original entry. Otherwise an
    // attacker could DoS by retrying in a loop just to keep the bucket fresh.
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    limiter.check('attacker', 0);
    // 100 retries at the same instant must all be blocked.
    for (let i = 0; i < 100; i++) {
      expect(limiter.check('attacker', 1_000).allowed).toBe(false);
    }
    // Still blocked after the burst because the window hasn't slid.
    expect(limiter.check('attacker', 9_999).allowed).toBe(false);
  });

  it('clamps non-positive config to safe defaults', () => {
    // windowMs and max are coerced to >= 1; this should still allow a
    // single request and then block.
    const limiter = createRateLimiter({ windowMs: 0, max: 0 });
    expect(limiter.check('x', 0).allowed).toBe(true);
    expect(limiter.check('x', 0).allowed).toBe(false);
  });
});

describe('createRateLimiter — memory hygiene', () => {
  it('prunes stale IP entries once the map exceeds sweepThreshold', () => {
    const limiter = createRateLimiter({
      windowMs: 1_000,
      max: 1,
      sweepThreshold: 5,
    });
    // Plant 6 stale entries (so map.size > sweepThreshold).
    for (let i = 0; i < 6; i++) limiter.check(`stale-${i}`, 0);
    expect(limiter.size()).toBe(6);
    // A check well past the window should trigger sweep + drop the stale ones.
    limiter.check('fresh', 1_000_000);
    expect(limiter.size()).toBe(1); // only 'fresh' survives
  });

  it('does not sweep below the threshold', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1, sweepThreshold: 100 });
    for (let i = 0; i < 5; i++) limiter.check(`ip-${i}`, 0);
    limiter.check('new', 1_000_000);
    expect(limiter.size()).toBe(6); // no pruning
  });
});

describe('getClientIp', () => {
  function req(headerEntries: Array<[string, string]>): { headers: Headers } {
    return { headers: new Headers(headerEntries) };
  }

  it('returns the first hop from x-forwarded-for', () => {
    expect(getClientIp(req([['x-forwarded-for', '203.0.113.5, 10.0.0.1, 10.0.0.2']]))).toBe('203.0.113.5');
  });

  it('trims surrounding whitespace in x-forwarded-for', () => {
    expect(getClientIp(req([['x-forwarded-for', '  203.0.113.5  , 10.0.0.1']]))).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp(req([['x-real-ip', '198.51.100.7']]))).toBe('198.51.100.7');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    expect(
      getClientIp(req([
        ['x-forwarded-for', '203.0.113.5'],
        ['x-real-ip', '198.51.100.7'],
      ])),
    ).toBe('203.0.113.5');
  });

  it('returns "unknown" when no proxy headers are set', () => {
    expect(getClientIp(req([]))).toBe('unknown');
  });

  it('returns "unknown" for an empty x-forwarded-for value', () => {
    expect(getClientIp(req([['x-forwarded-for', '']]))).toBe('unknown');
  });
});
