import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Middleware to check file size before it reaches the API
export function middleware(req: NextRequest) {
  // Check if it's the compress-pdf endpoint
  if (req.nextUrl.pathname === '/api/compress-pdf' && req.method === 'POST') {
    // Get content length from request
    const contentLength = req.headers.get('content-length');
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / 1024 / 1024;
      
      // Vercel limit is around 32MB, we set max to 30MB to be safe
      if (sizeInMB > 30) {
        console.warn('[Middleware] 🚫 File too large:', `${sizeInMB.toFixed(2)}MB`);
        return NextResponse.json(
          {
            error: `File too large (${sizeInMB.toFixed(2)}MB). Maximum is 30MB.`,
            maxSize: 30,
            yourSize: sizeInMB.toFixed(2),
          },
          { status: 413 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/compress-pdf',
  ],
};
