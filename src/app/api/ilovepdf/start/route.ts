import { NextResponse } from 'next/server';
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || '';
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || '';

const TOOL_MAPPING: Record<string, string> = {
  'ocr': 'pdfocr',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawTool = searchParams.get('tool') || 'compress';
  const tool = TOOL_MAPPING[rawTool] || rawTool;
  
  console.log(`[iLovePDF Start] Initializing task: ${tool} (raw: ${rawTool}) with SDK`);

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
    let task;
    try {
      task = instance.newTask(tool as any);
    } catch (e: any) {
      if (e.name === 'TaskTypeNotExistsError' && tool === 'organize') {
        // Polyfill Organize task which is missing from SDK 0.3.1 TaskFactory
        try {
          // @ts-ignore
          const TaskBaseProcess = require('@ilovepdf/ilovepdf-js-core/tasks/TaskBaseProcess').default;
          // @ts-ignore
          task = new TaskBaseProcess(instance.auth, instance.xhr);
          task.type = 'organize';
        } catch (polyfillErr) {
          console.error('[iLovePDF Polyfill Error]:', polyfillErr);
          throw e; // Throw original error if polyfill fails
        }
      } else if (e.name === 'TaskTypeNotExistsError') {
        return NextResponse.json({
          success: false,
          error: `الأداة "${rawTool}" غير مدعومة حالياً في هذا النظام.`,
          code: 'TOOL_NOT_SUPPORTED'
        }, { status: 200 });
      } else {
        throw e;
      }
    }
    
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
    // Log the full error object for debugging
    if (error.response && error.response.data) {
      console.error('[iLovePDF SDK Error Detail]:', JSON.stringify(error.response.data));
    }
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal Exception during SDK init',
      details: error.response?.data || error.message || error
    }, { status: 200 });
  }
}
