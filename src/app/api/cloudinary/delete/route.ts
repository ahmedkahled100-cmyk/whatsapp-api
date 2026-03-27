// src/app/api/cloudinary/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
  }

  try {
    const { public_id, resource_type = 'raw' } = await req.json();

    if (!public_id) {
      return NextResponse.json({ error: 'Missing public_id' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      public_id,
      timestamp,
    };

    const signatureString = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    const formData = new FormData();
    formData.append('public_id', public_id);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/destroy`, {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();

    if (result.result === 'ok') {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.result }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Cloudinary/Delete] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
