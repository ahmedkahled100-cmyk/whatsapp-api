import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ilovepdf/extract-text
 * Downloads an OCR-processed PDF from iLovePDF and extracts its text content.
 */
export async function POST(req: Request) {
  try {
    const { task, server } = await req.json();

    if (!task || !server) {
      return NextResponse.json({ success: false, error: 'Missing task or server' }, { status: 200 });
    }

    // 1. Download the processed PDF buffer
    const downloadUrl = `https://${server}/v1/download/${task}`;
    console.log('[extract-text] Downloading from:', downloadUrl);

    const fileRes = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'AN-Academy-Proxy/1.0' }
    });

    if (!fileRes.ok) {
      throw new Error(`فشل تحميل الملف: ${fileRes.status} ${fileRes.statusText}`);
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (!buffer || buffer.length === 0) {
      throw new Error('الملف المُعالج فارغ');
    }

    // 2. Extract text using pdf-parse
    // Dynamic import to avoid edge runtime issues
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer, {
      // Don't execute JS inside PDF
      normalizeWhitespace: true,
    });

    const text = (data.text || '').trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const pageCount = data.numpages || 0;

    console.log(`[extract-text] Extracted ${text.length} chars, ${wordCount} words, ${pageCount} pages`);

    return NextResponse.json({
      success: true,
      text,
      wordCount,
      pageCount,
      info: data.info || {},
    });

  } catch (error: any) {
    console.error('[extract-text] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل استخراج النصوص',
    }, { status: 200 });
  }
}
