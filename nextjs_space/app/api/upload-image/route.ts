export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Save uploaded base64 image to disk, return the serving path
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dataUrl = body?.imageData;

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Parse the data URL
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Could not parse image data URL' }, { status: 400 });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const hash = crypto.randomBytes(6).toString('hex');
    const filename = `${timestamp}-${hash}.${ext}`;

    // Determine uploads directory - use app root's uploads/chat-images/
    // In standalone mode, __dirname is inside .build/standalone/app/...
    // We go up to the app root and use uploads/ there
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chat-images');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    // Return the API path that will serve this image
    const servingPath = `/api/uploads/chat-images/${filename}`;

    return NextResponse.json({ path: servingPath });
  } catch (error: any) {
    console.error('Upload image error:', error?.message);
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
  }
}
