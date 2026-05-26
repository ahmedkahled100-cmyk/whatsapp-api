// src/lib/whatsapp.ts

/**
 * Utility for sending WhatsApp messages via the official WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage(targetPhone: string, message: string) {
  const token = process.env.WHATSAPP_TOKEN || process.env.NEXT_PUBLIC_WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID || process.env.NEXT_PUBLIC_WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn("WhatsApp credentials (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID) are missing. Logging instead of sending.");
    return { success: false, error: "Missing WhatsApp credentials in environment variables." };
  }

  // Ensure the phone number is correctly formatted (remove + if any, ensure it has country code)
  let formattedPhone = targetPhone.replace(/\D/g, ''); // Remove non-numeric characters
  if (!formattedPhone) {
    return { success: false, error: "Invalid phone number." };
  }

  // Attempt to map leading zeros or lacking country code if standard in your region (e.g. Egypt 010... -> 2010...)
  if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
    formattedPhone = `2${formattedPhone}`; // Egypt
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    
    const body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data.error?.message || "Error sending WhatsApp message" };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("WhatsApp Request Error:", error);
    return { success: false, error: error.message || "Failed to make request" };
  }
}
