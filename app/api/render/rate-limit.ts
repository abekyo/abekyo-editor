// Rate-limiting + client-IP extraction for /api/render.
//
// Pulled out of route.ts so the logic can be unit-tested without booting
// Next.js or Remotion. The route owns one factory-created instance; tests
// create their own with controlled config and a `now()` injection point.

export interface RateLimiterConfig {
  windowMs: number;
  max: number;
  /** Lazily prune the IP map when it grows beyond this size. */
  sweepThreshold?: number;
}

export type RateCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

export interface RateLimiter {
  check(ip: string, now?: number): RateCheckResult;
  /** Test helper: number of distinct IPs currently tracked. */
  size(): number;
}

/**
 * Per-key sliding-window limiter. State is held in an internal Map; create one
 * per logical scope (one for /api/render, etc).
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const windowMs = Math.max(1, config.windowMs);
  const max = Math.max(1, config.max);
  const sweepThreshold = Math.max(1, config.sweepThreshold ?? 1000);
  const log = new Map<string, number[]>();

  return {
    check(ip, now = Date.now()) {
      const cutoff = now - windowMs;

      // Lazy sweep: prune all stale entries whenever the map grows large, so
      // a long-running process facing many unique clients doesn't leak memory.
      if (log.size > sweepThreshold) {
        for (const [key, timestamps] of log) {
          const fresh = timestamps.filter((t) => t > cutoff);
          if (fresh.length === 0) log.delete(key);
          else log.set(key, fresh);
        }
      }

      const history = (log.get(ip) ?? []).filter((t) => t > cutoff);
      if (history.length >= max) {
        const oldest = history[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        log.set(ip, history);
        return { allowed: false, retryAfterSec };
      }
      history.push(now);
      log.set(ip, history);
      return { allowed: true };
    },
    size() {
      return log.size;
    },
  };
}

/**
 * Extract the originating client IP from a Next.js request, in this order:
 *   1. The first entry of `x-forwarded-for` (when behind a reverse proxy).
 *   2. `x-real-ip` (alternative proxy convention).
 *   3. `'unknown'` sentinel — keeps the limiter functional rather than
 *      throwing, but groups all directly-connected clients into one bucket.
 */
export function getClientIp(request: { headers: Headers }): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}
