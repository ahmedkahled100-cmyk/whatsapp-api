// src/lib/whatsapp.ts

/**
 * Utility for sending WhatsApp messages via the local whatsapp-web.js microservice.
 */
export async function sendWhatsAppMessage(targetPhone: string, message: string) {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://whatsapp-api-2026.up.railway.app';

  try {
    const url = `${apiUrl}/send`;
    
    let formattedPhone = targetPhone.replace(/\D/g, '');
    if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
      formattedPhone = `2${formattedPhone}`;
    }

    const body = {
      number: formattedPhone,
      message: message
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("WhatsApp Microservice Error:", data);
      return { success: false, error: data.error || "Error sending WhatsApp message" };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("WhatsApp Request Error:", error);
    return { success: false, error: error.message || "Failed to connect to WhatsApp Microservice" };
  }
}
