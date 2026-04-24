// Pure-function media-kind detector used by /api/upload.
//
// Lives in its own module so it can be unit-tested without spinning up the
// full Next.js route, formData, or filesystem. The route imports this and
// delegates classification entirely to detectMediaKind.

export type MediaKind = 'image' | 'audio' | 'video';

/**
 * Classify a file by its magic bytes. Returns null when the content does not
 * match any supported signature, regardless of what the client-declared
 * Content-Type / file.type claims.
 *
 * Supported signatures:
 *  - Images: JPEG, PNG, GIF87a/89a, WebP
 *  - Audio:  MP3 (ID3 + raw frame), WAV, OGG, FLAC, M4A/M4B (ISO-BMFF audio brand)
 *  - Video:  MP4 / QuickTime brands (isom, iso2-6, mp41/42, avc1, M4V*, qt  ),
 *            WebM/Matroska (EBML)
 */
export function detectMediaKind(buf: Buffer): MediaKind | null {
  if (buf.length < 12) return null;

  // --- Images ---
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image';
  // GIF87a / GIF89a
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return 'image';
  // WebP: "RIFF....WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image';

  // --- Audio ---
  // MP3 with ID3v2 tag: "ID3"
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio';
  // MPEG audio frame sync (MP3 / AAC ADTS): 12 bits of 1s
  if (buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0) return 'audio';
  // WAV: "RIFF....WAVE"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) return 'audio';
  // OGG: "OggS"
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'audio';
  // FLAC: "fLaC"
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return 'audio';

  // --- ISO-BMFF (MP4 / MOV / M4A / M4V): "....ftyp<brand>" ---
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'M4A ' || brand === 'M4B ') return 'audio';
    if (
      brand === 'isom' ||
      brand === 'iso2' ||
      brand === 'iso3' ||
      brand === 'iso4' ||
      brand === 'iso5' ||
      brand === 'iso6' ||
      brand === 'mp41' ||
      brand === 'mp42' ||
      brand === 'avc1' ||
      brand === 'M4V ' ||
      brand === 'M4VH' ||
      brand === 'M4VP' ||
      brand === 'qt  '
    ) return 'video';
  }

  // --- WebM / Matroska: EBML header 1A 45 DF A3 ---
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video';

  return null;
}
