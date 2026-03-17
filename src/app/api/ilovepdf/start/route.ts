import { NextResponse } from 'next/server';
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';

const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || '';
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || '';

const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    // Check if iLovePDF is properly configured
    if (!PUBLIC_KEY || !SECRET_KEY) {
      console.warn('[iLovePDF Start] API keys not configured. Using fallback compression.');
      return NextResponse.json(
        { 
          warning: 'iLovePDF API keys not configured. Using local fallback compression.',
          fallbackMode: true,
        },
        { status: 200 }
      );
    }

    try {
      // Create a new compression task
      const task = instance.newTask('compress');
      await task.start();

      // @ts-ignore - accessing internal properties
      const server = task.server;
      // @ts-ignore
      const taskId = task.id;

      console.log('[iLovePDF Start] ✅ Task started successfully:', taskId);

      return NextResponse.json({
        success: true,
        task: taskId,
        server: server,
        publicKey: PUBLIC_KEY.substring(0, 20) + '...',
      });
    } catch (apiError: any) {
      const errorMsg = apiError?.message || apiError;
      console.warn('[iLovePDF Start] ⚠️  API call failed:', errorMsg);
      
      // If API fails, return fallback response
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('invalid')) {
        console.warn('[iLovePDF Start] 🔐 Authentication failed. Credentials may be expired.');
        return NextResponse.json(
          { 
            warning: 'iLovePDF authentication failed. Using local fallback compression.',
            fallbackMode: true,
            reason: 'Invalid or expired credentials',
          },
          { status: 200 }
        );
      }
      
      throw apiError;
    }
  } catch (error: any) {
    const errorMsg = error?.message || error;
    console.error('[iLovePDF Start] ❌ Error:', errorMsg);
    
    // Always return a workable response, don't fail completely
    return NextResponse.json(
      { 
        warning: 'iLovePDF service unavailable. Using local fallback.',
        fallbackMode: true,
        error: process.env.NODE_ENV === 'development' ? errorMsg : 'Service temporarily unavailable',
      },
      { status: 200 }
    );
  }
}
