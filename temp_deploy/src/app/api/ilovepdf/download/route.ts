import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const task = searchParams.get('task');
  const server = searchParams.get('server');
  const fileName = searchParams.get('fileName') || 'document.pdf';
  const inline = searchParams.get('inline') === 'true'; // for preview mode

  if (!task || !server) {
    return new NextResponse('Missing task or server', { status: 400 });
  }

  try {
    const downloadUrl = `https://${server}/v1/download/${task}`;
    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'AN-Academy-Proxy/1.0' }
    });

    if (!response.ok) {
      throw new Error(`iLovePDF download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const headers = new Headers();

    // Map extensions to MIME types
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      zip: 'application/zip',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      png: 'image/png'
    };

    const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    headers.set('Content-Type', contentType);

    // Inline = browser renders it (preview); attachment = browser downloads it
    const disposition = inline ? 'inline' : 'attachment';
    const safeFileName = fileName.replace(/[^\x00-\x7F]/g, '_').replace(/[/\\?%*:|"<>]/g, '_');
    const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    headers.set('Content-Disposition', `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);

    // Allow embedding in iframe from same origin
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    headers.set('Content-Length', buffer.length.toString());

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error: any) {
    console.error('[iLovePDF Download Proxy Error]:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
