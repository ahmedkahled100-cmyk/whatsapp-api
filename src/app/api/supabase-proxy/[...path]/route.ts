// src/app/api/supabase-proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, authorization, prefer, x-client-info',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: await corsHeaders() });
}

async function handleRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Supabase URL is not configured on the server' }, { status: 500 });
  }

  // Construct target URL
  const subPath = params.path.join('/');
  const searchParams = req.nextUrl.search;
  const targetUrl = `${supabaseUrl}/${subPath}${searchParams}`;

  // Read request body if present
  let body: any = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      // No body
    }
  }

  // Prepare headers to forward
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Avoid forwarding host and other auto-generated headers that conflict
    if (!['host', 'connection', 'content-length', 'accept-encoding'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // Ensure apiKey and authorization are sent if they exist in env
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseKey && !headers.has('apikey')) {
    headers.set('apikey', supabaseKey);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers(await corsHeaders());
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = [204, 205, 304].includes(response.status) ? null : await response.text();
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[Supabase Proxy Error]:`, err);
    return NextResponse.json(
      { error: 'Connection to Database failed via Proxy server', details: err.message },
      { status: 502, headers: await corsHeaders() }
    );
  }
}

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
  handleRequest as DELETE,
  handleRequest as PATCH,
};
