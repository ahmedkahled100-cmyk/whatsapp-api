import { NextRequest, NextResponse } from 'next/server';
import { ILovePDFClient } from '@/lib/ilovepdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/compress-pdf
 * Compresses a PDF file using iLovePDF API with local fallback
 */
export async function POST(req: NextRequest) {
  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided / لم يتم توفير ملف' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF / يجب أن يكون الملف بصيغة PDF' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB to stay under Vercel limits)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB / الملف كبير جداً. الحد الأقصى 50 ميجابايت' },
        { status: 400 }
      );
    }

    console.log('[API Compress] Starting compression:', {
      fileName: file.name,
      originalSize: file.size,
      configured: ILovePDFClient.isConfigured(),
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[API Compress] File converted to buffer, size:', buffer.length);

    // Compress using iLovePDF (with local fallback built-in)
    const compressedBuffer = await ILovePDFClient.compress(buffer);

    const reduction = ((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1);
    console.log('[API Compress] ✅ Compression complete:', {
      originalSize: buffer.length,
      compressedSize: compressedBuffer.length,
      reduction: reduction + '%',
      usingFallback: compressedBuffer.length >= buffer.length * 0.95, // If barely compressed, likely using fallback
    });

    // Return compressed file
    return new NextResponse(new Uint8Array(compressedBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
        'X-Original-Size': buffer.length.toString(),
        'X-Compressed-Size': compressedBuffer.length.toString(),
        'X-Compression-Ratio': reduction,
      },
    });

  } catch (error: any) {
    const errorMsg = error?.message || error;
    console.error('[API Compress] ❌ Error:', errorMsg);
    
    return NextResponse.json(
      { 
        error: 'Failed to compress PDF. Please try again. / فشل ضغط الملف. يرجى المحاولة مجدداً',
        details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
      },
      { status: 500 }
    );
  }
}
