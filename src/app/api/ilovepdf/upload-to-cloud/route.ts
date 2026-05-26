import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/ilovepdf/upload-to-cloud
 * Downloads an already-processed file from iLovePDF and uploads it to Cloudinary.
 * This avoids re-processing an already-consumed task (which returns 400).
 */
export async function POST(req: Request) {
  try {
    const { task, server, fileName } = await req.json();

    if (!task || !server) {
      return NextResponse.json({ success: false, error: 'Missing task or server' }, { status: 200 });
    }

    // 1. Download the already-processed file from iLovePDF
    const downloadUrl = `https://${server}/v1/download/${task}`;
    console.log('[upload-to-cloud] Downloading from iLovePDF:', downloadUrl);

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      throw new Error(`فشل تحميل الملف من iLovePDF (${fileRes.status}): ${fileRes.statusText}`);
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (!buffer || buffer.length === 0) {
      throw new Error('الملف المُستلم فارغ أو تالف');
    }

    // 2. Upload buffer to Cloudinary
    const nameWithoutExt = (fileName || 'document')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const publicId = `an_academy/${nameWithoutExt}_${Date.now().toString().slice(-6)}`;

    console.log('[upload-to-cloud] Uploading to Cloudinary, publicId:', publicId);

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          public_id: publicId,
          folder: 'course-materials',
          use_filename: false,
          unique_filename: false,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

    console.log('[upload-to-cloud] Success! URL:', uploadResult.secure_url);

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      size: uploadResult.bytes,
    });

  } catch (error: any) {
    console.error('[upload-to-cloud] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل الرفع السحابي',
    }, { status: 200 });
  }
}
