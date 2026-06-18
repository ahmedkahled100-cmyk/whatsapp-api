import { NextResponse } from 'next/server';
// @ts-ignore
import PDFParser from 'pdf2json';

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

    // 2. Extract text using pdf2json
    const extractResult = await new Promise<{text: string, pageCount: number}>((resolve, reject) => {
      // Initialize with 1 for text only extraction
      const pdfParser = new PDFParser(null, 1);
      
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error("PDFParser Error:", errData.parserError);
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const rawText = pdfParser.getRawTextContent();
          resolve({ 
            text: rawText, 
            pageCount: pdfData?.Pages?.length || 0 
          });
        } catch (e) {
          reject(e);
        }
      });

      pdfParser.parseBuffer(buffer);
    });

    const text = (extractResult.text || '').replace(/\r\n/g, '\n').trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    console.log(`[extract-text] Extracted ${text.length} chars, ${wordCount} words, ${extractResult.pageCount} pages`);

    return NextResponse.json({
      success: true,
      text,
      wordCount,
      pageCount: extractResult.pageCount,
      info: {},
    });

  } catch (error: any) {
    console.error('[extract-text] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل استخراج النصوص',
    }, { status: 200 });
  }
}
