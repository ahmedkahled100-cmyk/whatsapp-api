import { NextResponse } from 'next/server';
import { getWhatsAppApiUrl } from '@/lib/whatsapp';

export async function GET() {
  try {
    const apiUrl = await getWhatsAppApiUrl();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${apiUrl}/status`, {
      cache: 'no-store',
      headers: {
        'bypass-tunnel-reminder': 'true',
      },
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);
    
    if (!res || !res.ok) {
      return NextResponse.json(
        { isConnected: false, qrCode: null, isOffline: true, error: 'تعذر الاتصال بخادم الواتساب من السيرفر' },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { isConnected: false, qrCode: null, isOffline: true, error: 'فشل استعلام حالة الواتساب' },
      { status: 503 }
    );
  }
}
