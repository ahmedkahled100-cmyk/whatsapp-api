// src/lib/whatsapp.ts
import fs from 'fs';
import path from 'path';

import { supabase } from './supabase';

export async function getWhatsAppApiUrl(): Promise<string> {
  try {
    const { data } = await supabase.from('app_home').select('welcome_message').eq('id', 'whatsapp_config').maybeSingle();
    if (data && data.welcome_message) {
      return data.welcome_message;
    }
  } catch (err) {
    console.error('Error fetching whatsapp URL from Supabase:', err);
  }

  const configFilePath = path.join(process.cwd(), 'whatsapp-config.json');
  const urlFilePath = path.join(process.cwd(), 'whatsapp-tunnel.url');

  if (fs.existsSync(configFilePath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      if (config.url) return config.url;
    } catch (e) {}
  }
  if (fs.existsSync(urlFilePath)) {
    try {
      const tunnelUrl = fs.readFileSync(urlFilePath, 'utf8').trim();
      if (tunnelUrl && tunnelUrl.startsWith('http')) return tunnelUrl;
    } catch (e) {}
  }
  return process.env.WHATSAPP_API_URL || 'http://localhost:3001';
}

/**
 * Utility for sending WhatsApp messages via the local whatsapp-web.js microservice.
 */
export async function sendWhatsAppMessage(targetPhone: string, message: string) {
  const apiUrl = await getWhatsAppApiUrl();

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
        'bypass-tunnel-reminder': 'true',
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
