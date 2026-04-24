import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { detectMediaKind } from './detect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const subdir = detectMediaKind(buffer);
    if (!subdir) {
      return NextResponse.json(
        { error: 'Unsupported or unrecognized file content' },
        { status: 415 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const saveDir = path.join(process.cwd(), 'public', 'uploads', subdir);
    const savePath = path.join(saveDir, filename);

    await mkdir(saveDir, { recursive: true });
    await writeFile(savePath, buffer);

    return NextResponse.json({
      url: `/uploads/${subdir}/${filename}`,
      type: subdir,
      filename,
      size: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
