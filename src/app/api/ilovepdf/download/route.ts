import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const task = searchParams.get('task');
  const server = searchParams.get('server');
  const fileName = searchParams.get('fileName') || 'document.pdf';

  if (!task || !server) {
    return new NextResponse('Missing task or server', { status: 400 });
  }

  try {
    const downloadUrl = `https://${server}/v1/download/${task}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`iLovePDF download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const headers = new Headers();
    
    // Force application/pdf unless it's a zip (for pdfjpg tool)
    const isZip = fileName.toLowerCase().endsWith('.zip');
    headers.set('Content-Type', isZip ? 'application/zip' : 'application/pdf');
    
    // Robust Content-Disposition with RFC 5987 (UTF-8) support
    // Use a safe ASCII-only filename for the regular 'filename' param to avoid ByteString errors
    const safeFileName = fileName.replace(/[^\x00-\x7F]/g, '_').replace(/[/\\?%*:|"<>]/g, '_');
    const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    headers.set('Content-Disposition', `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);

    return new NextResponse(blob, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[iLovePDF Download Proxy Error]:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
