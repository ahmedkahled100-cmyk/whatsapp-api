import { NextRequest, NextResponse } from 'next/server';
import { ILovePDFClient } from '@/lib/ilovepdf';

export const runtime = 'nodejs';

/**
 * GET /api/test-ilovepdf
 * Tests the iLovePDF API connection and returns status
 */
export async function GET(req: NextRequest) {
  try {
    const isWorking = await ILovePDFClient.testConnection();
    
    if (isWorking) {
      return NextResponse.json({
        success: true,
        message: 'iLovePDF API connection successful',
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        message: 'iLovePDF API connection failed',
        error: 'Could not establish connection to iLovePDF API',
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
  } catch (error: any) {
    console.error('iLovePDF Test API Error:', error);
    return NextResponse.json({
      success: false,
      message: 'iLovePDF API test failed with error',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
