import { NextResponse } from 'next/server';
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || '';
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tool = searchParams.get('tool') || 'compress';
  
  console.log(`[iLovePDF Start] Initializing task: ${tool} with SDK`);

  try {
    if (!PUBLIC_KEY || !SECRET_KEY) {
      return NextResponse.json({ 
        success: false,
        error: 'iLovePDF credentials are missing in environmental variables.',
        hasPK: !!PUBLIC_KEY,
        hasSK: !!SECRET_KEY
      }, { status: 200 });
    }

    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask(tool as any);
    
    // Start task (internal server-side auth)
    await task.start();

    // Generate JWT token for client-side authorization
    // @ts-ignore - access private auth for token generation
    const token = await instance.auth.getToken();

    // @ts-ignore - access internal properties for the multi-stage flow
    const taskId = task.id;
    // @ts-ignore
    const server = task.server;

    console.log('[iLovePDF Start] SDK Task started:', taskId, 'on server:', server);

    return NextResponse.json({
      success: true,
      task: taskId,
      server: server,
      token: token,
      publicKey: PUBLIC_KEY,
    });

  } catch (error: any) {
    console.error('[iLovePDF Start Error]:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal Exception during SDK init',
      details: typeof error === 'object' ? JSON.stringify(error) : error
    }, { status: 200 });
  }
}
