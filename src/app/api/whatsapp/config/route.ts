import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

const urlFilePath = path.join(process.cwd(), 'whatsapp-tunnel.url');
const configFilePath = path.join(process.cwd(), 'whatsapp-config.json');

export async function GET() {
  let activeUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3001';

  try {
    const { data } = await supabase.from('app_home').select('welcome_message').eq('id', 'whatsapp_config').maybeSingle();
    if (data && data.welcome_message) {
      activeUrl = data.welcome_message;
      return NextResponse.json({ success: true, url: activeUrl });
    }
  } catch (err) {
    console.error('Error fetching config from supabase:', err);
  }

  if (fs.existsSync(configFilePath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      if (config.url) {
        activeUrl = config.url;
      }
    } catch (e) {}
  } else if (fs.existsSync(urlFilePath)) {
    try {
      const tunnelUrl = fs.readFileSync(urlFilePath, 'utf8').trim();
      if (tunnelUrl && tunnelUrl.startsWith('http')) {
        activeUrl = tunnelUrl;
      }
    } catch (e) {}
  }

  return NextResponse.json({ success: true, url: activeUrl });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'رابط غير صالح' }, { status: 400 });
    }

    const cleanUrl = url.trim().replace(/\/+$/, '');

    // Write to Supabase instead of local file system to fix EROFS on Vercel
    const { error } = await supabase.from('app_home').upsert({
      id: 'whatsapp_config',
      welcome_message: cleanUrl,
      ticker: '1' // required by schema or at least good to provide a fallback
    });

    if (error) {
      console.error('Error saving config to Supabase:', error);
      throw new Error('فشل حفظ الرابط في قاعدة البيانات');
    }

    // Try saving locally just in case it's a local dev environment
    try {
      fs.writeFileSync(configFilePath, JSON.stringify({ url: cleanUrl }, null, 2), 'utf8');
    } catch (e) {
      // Ignore EROFS error on Vercel
    }

    return NextResponse.json({ success: true, message: 'تم حفظ رابط السيرفر بنجاح', url: cleanUrl });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'فشل حفظ الرابط' }, { status: 500 });
  }
}
