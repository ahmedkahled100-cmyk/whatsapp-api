import { NextRequest, NextResponse } from 'next/server';
import { ILovePDFClient } from '@/lib/ilovepdf';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { fileName, originalSize } = await req.json();

    if (!ILovePDFClient.isConfigured()) {
      return NextResponse.json(
        { error: 'iLovePDF API not configured' },
        { status: 503 }
      );
    }

    // For SDK-based flow, we need to handle this differently
    // The file was already uploaded directly to iLovePDF by the client
    // Now we need to use the SDK to process and download
    
    // Since the SDK doesn't expose the task ID easily for external uploads,
    // we'll use the compress-pdf endpoint approach instead
    
    return NextResponse.json({
      error: 'Direct upload flow not supported with SDK. Please use /api/compress-pdf for files under 50MB.',
    }, { status: 400 });

  } catch (error: any) {
    console.error('[iLovePDF Process Error]:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
