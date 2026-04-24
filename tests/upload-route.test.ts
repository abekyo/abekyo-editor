import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Avoid actually writing to disk. The route's behaviour we care about
// (status code, sub-directory routing, filename sanitization, response body)
// is observable from the mocks' call args + the Response.
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Build a File whose first bytes match a given magic number. Pads to >= 12
// bytes so the route's length precondition passes.
function makeFile(magic: number[], name: string, contentType: string, totalSize = 16): File {
  const buf = new Uint8Array(totalSize);
  for (let i = 0; i < magic.length; i++) buf[i] = magic[i];
  return new File([buf], name, { type: contentType });
}

function pngFile(name = 'photo.png'): File {
  return makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name, 'image/png');
}

function mp4File(name = 'movie.mp4', brand = 'mp42'): File {
  const buf = new Uint8Array(16);
  buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
  for (let i = 0; i < 4; i++) buf[8 + i] = brand.charCodeAt(i);
  return new File([buf], name, { type: 'video/mp4' });
}

function mp3File(name = 'song.mp3'): File {
  return makeFile([0x49, 0x44, 0x33, 0x03], name, 'audio/mpeg');
}

async function callUpload(file: File | null): Promise<Response> {
  const fd = new FormData();
  if (file) fd.append('file', file);
  const { POST } = await import('@/app/api/upload/route');
  const { NextRequest } = await import('next/server');
  const req = new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: fd,
  }) as NextRequest;
  return POST(req);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('POST /api/upload — happy path', () => {
  it('200 + image url for a valid PNG, saves under /uploads/image/', async () => {
    const res = await callUpload(pngFile('photo.png'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('image');
    expect(body.url).toMatch(/^\/uploads\/image\//);
    expect(body.url).toMatch(/photo\.png$/);
    expect(body.filename).toBeTruthy();

    const fs = await import('fs/promises');
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [savePath] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(savePath)).toMatch(/public\/uploads\/image\//);
  });

  it('200 + video url for a valid MP4, saves under /uploads/video/', async () => {
    const res = await callUpload(mp4File('clip.mp4', 'isom'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('video');
    expect(body.url).toMatch(/^\/uploads\/video\//);

    const fs = await import('fs/promises');
    const [savePath] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(savePath)).toMatch(/public\/uploads\/video\//);
  });

  it('200 + audio url for a valid MP3 (ID3 tagged)', async () => {
    const res = await callUpload(mp3File());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('audio');
    expect(body.url).toMatch(/^\/uploads\/audio\//);
  });
});

describe('POST /api/upload — rejection paths', () => {
  it('400 when the multipart body has no "file" entry', async () => {
    const res = await callUpload(null);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file provided' });

    const fs = await import('fs/promises');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('413 when file exceeds the 100 MB limit', async () => {
    // 100 MB + 1 byte. Use a typed-array view to avoid huge JS allocation.
    const buf = new Uint8Array(100 * 1024 * 1024 + 1);
    // PNG magic so it would otherwise pass detection.
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
    const file = new File([buf], 'huge.png', { type: 'image/png' });

    const res = await callUpload(file);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/100MB/);

    const fs = await import('fs/promises');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('415 when content does not match any supported magic bytes', async () => {
    // HTML disguised as PNG by name + content-type. Magic bytes don't match.
    const html = new Uint8Array(64);
    const text = '<!DOCTYPE html><html></html>';
    for (let i = 0; i < text.length; i++) html[i] = text.charCodeAt(i);
    const file = new File([html], 'evil.png', { type: 'image/png' });

    const res = await callUpload(file);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toMatch(/Unsupported|unrecognized/i);

    const fs = await import('fs/promises');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});

describe('POST /api/upload — security', () => {
  it('sanitizes path-traversal attempts in the filename', async () => {
    const res = await callUpload(pngFile('../../etc/passwd.png'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Slashes and dots that form ".." get replaced with underscores.
    expect(body.url).not.toMatch(/\.\.\//);
    expect(body.url).not.toMatch(/etc\/passwd/);
    expect(body.filename).toMatch(/_+etc_passwd\.png$/);

    // The actual save path must remain inside public/uploads/image/.
    const fs = await import('fs/promises');
    const [savePath] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(savePath)).toMatch(/\/public\/uploads\/image\/[^/]+\.png$/);
  });

  it('caps the sanitized filename suffix to 100 characters', async () => {
    const longName = 'x'.repeat(300) + '.png';
    const res = await callUpload(pngFile(longName));
    expect(res.status).toBe(200);
    const body = await res.json();
    // filename = `${ts}-${rnd}-${safeName}`; safeName itself is sliced to 100.
    // So the trailing portion after the last hyphen is at most 100 chars.
    const trailing = body.filename.split('-').slice(2).join('-');
    expect(trailing.length).toBeLessThanOrEqual(100);
  });

  it('respects magic-byte truth over claimed Content-Type for video brands', async () => {
    // File literally named .mp3 but containing real MP4 (isom) bytes — gets
    // classified as video, not audio, because we trust bytes.
    const res = await callUpload(mp4File('disguise.mp3', 'mp42'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('video');
    expect(body.url).toMatch(/^\/uploads\/video\//);
  });
});
