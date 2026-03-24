// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const maxDuration = 60; // Increase timeout to 60s for Vercel
// For Next.js App Router, the default body size limit is 4MB. Need to override it or read stream.
// Unfortunately, overriding body size in App Router uses `serverActions` in next.config.js, or nothing. 
// Oh wait, `req.formData()` might fail if it exceeds Next.js default.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file' },
        { status: 400 }
      );
    }

    // Check file size (100MB limit for Cloudinary or matching UI)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    // Upload to Cloudinary
    // Use the 'path' as the folder name or public_id prefix if provided
    const folder = path ? path.split('/')[0] : 'an-academy';
    const result: any = await uploadToCloudinary(file, folder);

    return NextResponse.json({ 
      success: true, 
      url: result.secure_url,
      public_id: result.public_id,
    });

  } catch (error: any) {
    console.error('Upload error in route.ts:', error);
    
    // Sometimes error is an object with message, sometimes it's a string, or an Axios error
    const getErrMsg = (err: any) => {
      if (typeof err === 'string') return err;
      if (err.message) return err.message;
      return JSON.stringify(err);
    };

    return NextResponse.json(
      { error: getErrMsg(error) || 'Failed to upload file due to an unknown server error' },
      { status: 500 }
    );
  }
}

