// src/lib/whatsapp.ts

/**
 * Utility for sending WhatsApp messages via the local whatsapp-web.js microservice.
 */
export async function sendWhatsAppMessage(targetPhone: string, message: string) {
  const apiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3001';

  try {
    const url = `${apiUrl}/send`;
    
    const body = {
      number: targetPhone,
      message: message
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

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
