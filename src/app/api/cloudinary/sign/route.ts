// src/app/api/cloudinary/sign/route.ts
// Returns a signed Cloudinary upload signature so clients can upload directly
// without needing an unsigned upload preset.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
  }

  const { folder, public_id } = await req.json();

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    type: 'upload',
    access_mode: 'public',
  };
  if (folder) paramsToSign.folder = folder;
  if (public_id) paramsToSign.public_id = public_id;

  // Build the string to sign: sorted key=value pairs joined by &
  const signatureString =
    Object.keys(paramsToSign)
      .sort()
      .map((k) => `${k}=${paramsToSign[k]}`)
      .join('&') + apiSecret;

  const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

  return NextResponse.json({ signature, timestamp, apiKey, cloudName });
}
