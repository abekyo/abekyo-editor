import { describe, it, expect } from 'vitest';
import { detectMediaKind } from '@/app/api/upload/detect';

// Helper: build a Buffer that begins with the given byte sequence and is
// padded out to 16 bytes so the length precondition (>= 12) passes.
function magic(bytes: number[]): Buffer {
  const buf = Buffer.alloc(Math.max(16, bytes.length));
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes[i];
  return buf;
}

// Build a buffer for an ISO-BMFF "....ftyp<brand>" container.
function isoBmff(brand: string): Buffer {
  const buf = Buffer.alloc(16);
  buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70; // 'ftyp'
  Buffer.from(brand.padEnd(4, ' '), 'ascii').copy(buf, 8);
  return buf;
}

describe('detectMediaKind — images', () => {
  it('classifies JPEG (FF D8 FF)', () => {
    expect(detectMediaKind(magic([0xff, 0xd8, 0xff, 0xe0]))).toBe('image');
  });

  it('classifies PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    expect(detectMediaKind(magic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image');
  });

  it('classifies GIF87a', () => {
    expect(detectMediaKind(magic([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe('image');
  });

  it('classifies GIF89a', () => {
    expect(detectMediaKind(magic([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image');
  });

  it('classifies WebP (RIFF....WEBP)', () => {
    const buf = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii');
    expect(detectMediaKind(buf)).toBe('image');
  });
});

describe('detectMediaKind — audio', () => {
  it('classifies MP3 with ID3v2 tag', () => {
    expect(detectMediaKind(magic([0x49, 0x44, 0x33, 0x03]))).toBe('audio');
  });

  it('classifies raw MPEG audio frame (FF F1)', () => {
    expect(detectMediaKind(magic([0xff, 0xf1, 0x90, 0x80]))).toBe('audio');
  });

  it('classifies WAV (RIFF....WAVE)', () => {
    const buf = Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'ascii');
    expect(detectMediaKind(buf)).toBe('audio');
  });

  it('classifies OGG (OggS)', () => {
    expect(detectMediaKind(magic([0x4f, 0x67, 0x67, 0x53]))).toBe('audio');
  });

  it('classifies FLAC (fLaC)', () => {
    expect(detectMediaKind(magic([0x66, 0x4c, 0x61, 0x43]))).toBe('audio');
  });

  it('classifies M4A (ftyp + brand "M4A ")', () => {
    expect(detectMediaKind(isoBmff('M4A'))).toBe('audio');
  });

  it('classifies M4B (ftyp + brand "M4B ")', () => {
    expect(detectMediaKind(isoBmff('M4B'))).toBe('audio');
  });
});

describe('detectMediaKind — video', () => {
  it.each(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V', 'M4VH', 'M4VP'])(
    'classifies MP4 brand "%s" as video',
    (brand) => {
      expect(detectMediaKind(isoBmff(brand))).toBe('video');
    },
  );

  it('classifies QuickTime brand "qt  "', () => {
    const buf = Buffer.alloc(16);
    buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
    Buffer.from('qt  ', 'ascii').copy(buf, 8);
    expect(detectMediaKind(buf)).toBe('video');
  });

  it('classifies WebM (EBML 1A 45 DF A3)', () => {
    expect(detectMediaKind(magic([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video');
  });
});

describe('detectMediaKind — rejection', () => {
  it('returns null for buffers shorter than 12 bytes', () => {
    expect(detectMediaKind(Buffer.from('short', 'ascii'))).toBeNull();
  });

  it('returns null for unknown content (e.g. plain ASCII)', () => {
    expect(detectMediaKind(Buffer.from('Hello world! Just text.', 'ascii'))).toBeNull();
  });

  it('returns null for HTML attempting to disguise as PNG (no magic bytes)', () => {
    const html = Buffer.from('<!DOCTYPE html><html></html>', 'ascii');
    expect(detectMediaKind(html)).toBeNull();
  });

  it('returns null for ISO-BMFF with unknown brand', () => {
    expect(detectMediaKind(isoBmff('XXXX'))).toBeNull();
  });

  it('returns null for RIFF container that is neither WebP nor WAV', () => {
    const buf = Buffer.from('RIFF\0\0\0\0AVI LIST', 'ascii');
    expect(detectMediaKind(buf)).toBeNull();
  });
});

describe('detectMediaKind — security regression', () => {
  // The whole point of this module: client-declared MIME is irrelevant.
  // A file that *says* it's a PNG but contains JS source must still be
  // rejected, because we look only at bytes.
  it('rejects script content even if the user named it photo.png', () => {
    const malicious = Buffer.from('<script>alert(1)</script>'.padEnd(64, ' '), 'ascii');
    expect(detectMediaKind(malicious)).toBeNull();
  });
});
