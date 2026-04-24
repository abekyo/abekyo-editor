import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock the entire Remotion surface. The route's value-add is everything
// that happens *before* the renderer runs — rate limiting, concurrency
// guarding, body validation, NDJSON streaming shape, cancel propagation.
// We don't want to actually spin up Chrome and ffmpeg in unit tests.

vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('http://test-serve-url'),
}));

// Per-call mutable state for makeCancelSignal so we can observe whether the
// route propagated a cancel after a client disconnect.
const lastCancelSpy: { value: ReturnType<typeof vi.fn> | null } = { value: null };

vi.mock('@remotion/renderer', () => ({
  selectComposition: vi.fn().mockResolvedValue({
    id: 'test-composition',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 90,
    defaultProps: {},
    props: {},
    height_fixed: 1080,
  }),
  renderMedia: vi.fn().mockResolvedValue(undefined),
  makeCancelSignal: vi.fn().mockImplementation(() => {
    const cbs: Array<() => void> = [];
    const cancel = vi.fn(() => cbs.forEach((cb) => cb()));
    lastCancelSpy.value = cancel;
    return {
      cancelSignal: (cb: () => void) => cbs.push(cb),
      cancel,
    };
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  lastCancelSpy.value = null;
});

async function callRender(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const { POST } = await import('@/app/api/render/route');
  const { NextRequest } = await import('next/server');
  const req = new NextRequest('http://localhost/api/render', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  }) as NextRequest;
  return POST(req);
}

interface RenderEvent {
  type: 'progress' | 'done' | 'error';
  [k: string]: unknown;
}

async function readNdjson(res: Response): Promise<RenderEvent[]> {
  const events: RenderEvent[] = [];
  if (!res.body) return events;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) events.push(JSON.parse(line) as RenderEvent);
    }
  }
  if (buffer.trim()) events.push(JSON.parse(buffer) as RenderEvent);
  return events;
}

const validBody = {
  clips: [{
    plotName: 'Clip 1',
    text: '',
    imageUrl: '/uploads/image/test.png',
    audioUrl: '',
    duration: 3,
    index: 0,
    totalClips: 1,
  }],
  resolution: '1080p' as const,
  aspectRatio: '16:9' as const,
};

// ---------------------------------------------------------------------------
// Validation — these all run BEFORE rate-limit/concurrency state mutates,
// so they are safe to share an IP without mutual contamination.
// ---------------------------------------------------------------------------

describe('POST /api/render — body validation', () => {
  it('400 when clips field is missing', async () => {
    const res = await callRender(
      { resolution: '1080p', aspectRatio: '16:9' },
      { 'x-real-ip': '10.0.0.1' },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/clips/);
  });

  it('400 when clips is an empty array', async () => {
    const res = await callRender({ ...validBody, clips: [] }, { 'x-real-ip': '10.0.0.2' });
    expect(res.status).toBe(400);
  });

  it('400 when resolution is missing', async () => {
    const { resolution: _r, ...partial } = validBody;
    void _r;
    const res = await callRender(partial, { 'x-real-ip': '10.0.0.3' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/resolution/);
  });

  it('400 when aspectRatio is missing', async () => {
    const { aspectRatio: _a, ...partial } = validBody;
    void _a;
    const res = await callRender(partial, { 'x-real-ip': '10.0.0.4' });
    expect(res.status).toBe(400);
  });

  it('400 when body is not valid JSON', async () => {
    const res = await callRender('not-json {', { 'x-real-ip': '10.0.0.5' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — uses unique IPs per test so they don't contaminate
// each other through the in-memory IP map.
// ---------------------------------------------------------------------------

describe('POST /api/render — rate limiting', () => {
  it('429 + Retry-After header after the 11th request from same IP', async () => {
    const ip = '20.0.0.1';
    for (let i = 0; i < 10; i++) {
      const r = await callRender(validBody, { 'x-real-ip': ip });
      expect(r.status).toBe(200);
      // Drain so activeRenders gets decremented (renderMedia mock resolves
      // immediately) — otherwise the concurrency guard triggers before rate.
      await readNdjson(r);
    }
    const blocked = await callRender(validBody, { 'x-real-ip': ip });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    const retry = Number(blocked.headers.get('Retry-After'));
    expect(retry).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/Too many/i);
  });

  it('different IPs are isolated', async () => {
    const exhausted = '20.0.0.10';
    for (let i = 0; i < 10; i++) {
      const r = await callRender(validBody, { 'x-real-ip': exhausted });
      await readNdjson(r);
    }
    expect((await callRender(validBody, { 'x-real-ip': exhausted })).status).toBe(429);

    // A different IP starts with a fresh window.
    const fresh = await callRender(validBody, { 'x-real-ip': '20.0.0.11' });
    expect(fresh.status).toBe(200);
    await readNdjson(fresh);
  });

  it('uses the first hop of x-forwarded-for, not x-real-ip, when both present', async () => {
    const ip = '30.0.0.1';
    for (let i = 0; i < 10; i++) {
      const r = await callRender(validBody, {
        'x-forwarded-for': `${ip}, 192.168.0.1`,
        'x-real-ip': '99.99.99.99', // would NOT exhaust this bucket
      });
      await readNdjson(r);
    }
    // 11th from same xff first-hop → blocked
    const blocked = await callRender(validBody, {
      'x-forwarded-for': `${ip}, 192.168.0.1`,
    });
    expect(blocked.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Concurrency cap — default is 1; second in-flight render gets 503.
// ---------------------------------------------------------------------------

describe('POST /api/render — concurrency cap', () => {
  it('503 + Retry-After: 30 when activeRenders is at MAX_CONCURRENT_RENDERS', async () => {
    // The first stream's start() callback runs eagerly (Web Streams spec) and
    // — with default mocks where renderMedia resolves immediately — would
    // race to the finally block and decrement activeRenders before we get to
    // the second request. Pin the first call by making renderMedia hang.
    const remotion = await import('@remotion/renderer');
    let resolveFirst!: () => void;
    const hangPromise = new Promise<void>((r) => { resolveFirst = r; });
    // The mock signature insists on RenderMediaResult, but the route never
    // inspects the resolved value — it just awaits. Cast through unknown.
    vi.mocked(remotion.renderMedia).mockReturnValueOnce(
      hangPromise as unknown as ReturnType<typeof remotion.renderMedia>,
    );

    const r1 = await callRender(validBody, { 'x-real-ip': '40.0.0.1' });
    expect(r1.status).toBe(200);

    // Yield so r1's stream start() advances past bundle/selectComposition and
    // hits the (now hanging) renderMedia. activeRenders stays at 1.
    await new Promise((r) => setTimeout(r, 0));

    const r2 = await callRender(validBody, { 'x-real-ip': '40.0.0.2' });
    expect(r2.status).toBe(503);
    expect(r2.headers.get('Retry-After')).toBe('30');
    expect((await r2.json()).error).toMatch(/busy/i);

    // Cleanup so the test doesn't leak microtasks.
    resolveFirst();
    await readNdjson(r1).catch(() => undefined);
  });
});

// ---------------------------------------------------------------------------
// NDJSON streaming shape — content-type, event sequence, terminal event.
// ---------------------------------------------------------------------------

describe('POST /api/render — streamed NDJSON response', () => {
  it('returns application/x-ndjson with a "done" event at the end', async () => {
    const r = await callRender(validBody, { 'x-real-ip': '50.0.0.1' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/x-ndjson/);
    expect(r.headers.get('cache-control')).toMatch(/no-cache/);

    const events = await readNdjson(r);
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.type).toBe('done');
    expect(last.videoUrl).toMatch(/^\/uploads\/output\//);
    expect(last.filename).toMatch(/^output-.*\.mp4$/);
    // At least one progress event before done.
    expect(events.filter((e) => e.type === 'progress').length).toBeGreaterThan(0);
  });

  it('progress events carry monotonically non-decreasing percentages', async () => {
    const r = await callRender(validBody, { 'x-real-ip': '50.0.0.2' });
    const events = await readNdjson(r);
    const progresses = events
      .filter((e): e is RenderEvent & { progress: number } => e.type === 'progress')
      .map((e) => e.progress);
    for (let i = 1; i < progresses.length; i++) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Cancellation — when the client disconnects mid-stream the route must call
// the renderer's cancel function so we don't burn CPU on an orphan render.
// ---------------------------------------------------------------------------

describe('POST /api/render — client disconnect propagates cancel', () => {
  it('invokes the renderer cancel signal when the response stream is cancelled', async () => {
    // Make renderMedia hang so the stream is alive when we cancel it.
    const remotion = await import('@remotion/renderer');
    vi.mocked(remotion.renderMedia).mockReturnValueOnce(new Promise(() => {}));

    const r = await callRender(validBody, { 'x-real-ip': '60.0.0.1' });
    expect(r.status).toBe(200);

    // Start consuming the stream so its start() callback runs and reaches
    // renderMedia (which now hangs).
    const reader = r.body!.getReader();
    // Read at least one chunk so the stream actually started.
    await reader.read();
    // Simulate client disconnect: cancel the reader → triggers stream.cancel()
    // on the route side, which is wired to call cancelRender().
    await reader.cancel();

    // Give microtasks a tick.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(lastCancelSpy.value).not.toBeNull();
    expect(lastCancelSpy.value).toHaveBeenCalled();
  });
});
