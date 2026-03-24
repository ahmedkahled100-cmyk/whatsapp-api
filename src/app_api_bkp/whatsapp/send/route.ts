import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing phone or message parameters' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(phone, message);

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('WhatsApp API Route Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while sending message' },
      { status: 500 }
    );
  }
}
