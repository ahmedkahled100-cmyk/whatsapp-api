import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://whatsapp-api-2026.up.railway.app';
    
    const res = await fetch(`${apiUrl}/status`, {
      cache: 'no-store'
    });
    
    if (!res.ok) {
      return NextResponse.json({ isConnected: false, qrCode: null, error: 'Failed to fetch status' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('WhatsApp Status API Error:', error);
    return NextResponse.json(
      { isConnected: false, qrCode: null, error: 'Internal server error while fetching status' },
      { status: 500 }
    );
  }
}
