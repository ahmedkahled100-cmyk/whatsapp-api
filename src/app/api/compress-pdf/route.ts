import { NextRequest, NextResponse } from 'next/server';
import { ILovePDFClient } from '@/lib/ilovepdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/compress-pdf
 * Compresses a PDF file using iLovePDF API with local fallback
 */
export async function POST(req: NextRequest) {
  try {
    // Log request details
    const contentType = req.headers.get('content-type');
    const contentLength = req.headers.get('content-length');
    console.log('[API Compress] Request received:', {
      contentType,
      contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown',
    });

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

    // Validate file size (max 100MB for compression)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 100MB / الملف كبير جداً. الحد الأقصى 100 ميجابايت. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 413 }
      );
    }

    console.log('[API Compress] Starting compression:', {
      fileName: file.name,
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      configured: ILovePDFClient.isConfigured(),
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[API Compress] File converted to buffer, size:', `${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Compress using iLovePDF (with local fallback built-in)
    const compressedBuffer = await ILovePDFClient.compress(buffer);

    const reduction = ((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1);
    console.log('[API Compress] ✅ Compression complete:', {
      originalSize: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
      compressedSize: `${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB`,
      reduction: reduction + '%',
      usingFallback: compressedBuffer.length >= buffer.length * 0.95,
    });

    // Return compressed file
    return new NextResponse(new Uint8Array(compressedBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
        'X-Original-Size': buffer.length.toString(),
        'X-Compressed-Size': compressedBuffer.length.toString(),
        'X-Compression-Ratio': reduction,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    const errorMsg = error?.message || error;
    console.error('[API Compress] ❌ Error:', errorMsg);
    
    // Check if it's a payload too large error
    if (errorMsg.includes('413') || errorMsg.includes('too large') || errorMsg.includes('payload')) {
      return NextResponse.json(
        { 
          error: 'File too large for processing / الملف كبير جداً للمعالجة',
          details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
        },
        { status: 413 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to compress PDF. Please try again. / فشل ضغط الملف. يرجى المحاولة مجدداً',
        details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
      },
      { status: 500 }
    );
  }
}
