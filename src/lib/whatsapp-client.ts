import { getApiBase } from '@/lib/utils';

/**
 * Client-side utility for sending WhatsApp messages.
 * Attempts the Next.js API route first, and if that fails or errors out (e.g. when Vercel cannot reach localhost),
 * falls back to calling the local WhatsApp microservice at http://localhost:3001/send directly from the browser.
 */
export async function sendWhatsAppMessageClient(phone: string, message: string): Promise<{ success: boolean; error?: string; data?: any }> {
  // 1. Try Next.js API route
  try {
    const apiBase = typeof window !== 'undefined' ? '' : getApiBase();
    const res = await fetch(`${apiBase}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });
    
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return { success: true, data: data.data };
    }
  } catch (err) {
    // API route call failed
  }

  // 2. Direct browser fallback to local WhatsApp microservice (http://localhost:3001/send)
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
      formattedPhone = `2${formattedPhone}`;
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const defaultUrl = `http://${host}:3001`;
    const localServerUrl = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || defaultUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const localRes = await fetch(`${localServerUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
      },
      body: JSON.stringify({ number: formattedPhone, message }),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (localRes && localRes.ok) {
      const localData = await localRes.json();
      if (localData.success) {
        return { success: true, data: localData.response };
      }
      return { success: false, error: localData.error || 'فشل إرسال الرسالة عبر خادم الواتساب المحلي' };
    }
  } catch (localErr) {
    // Direct local fetch failed
  }

  return { 
    success: false, 
    error: 'تعذر الاتصال بخادم الواتساب. يرجى التأكد من تشغيل الخادم بواسطة npm run whatsapp' 
  };
}
