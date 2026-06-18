'use client';

import { useState, useEffect } from 'react';
import { Loader2, QrCode, MessageSquare, CheckCircle2 } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<{ isConnected: boolean; qrCode: string | null }>({
    isConnected: false,
    qrCode: null,
  });
  const [loading, setLoading] = useState(true);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/status`);
      const data = await res.json();
      setStatus({
        isConnected: data.isConnected,
        qrCode: data.qrCode,
      });
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 5 seconds if not connected
    const interval = setInterval(() => {
      if (!status.isConnected) {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status.isConnected]);

  const sendTestMessage = async () => {
    if (!testNumber || !testMessage) {
      alert("يرجى إدخال الرقم والرسالة");
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testNumber, message: testMessage }),
      });
      const data = await res.json();

      if (data.success) {
        alert("✅ تم إرسال الرسالة بنجاح!");
        setTestMessage('');
      } else {
        alert("❌ فشل الإرسال: " + data.error);
      }
    } catch (error: any) {
      alert("❌ حدث خطأ: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="text-emerald-500 w-8 h-8" />
            إدارة الواتساب (WhatsApp)
          </h1>
          <p className="text-muted-foreground mt-2">
            قم بربط هاتفك بخادم الواتساب لإرسال الإشعارات والرسائل للطلاب.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <div className="card-base p-6 flex flex-col items-center justify-center min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>جاري فحص حالة الاتصال...</p>
            </div>
          ) : status.isConnected ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-emerald-600 mb-2">متصل بنجاح!</h2>
                <p className="text-muted-foreground">
                  رقمك الآن مربوط بالخادم ومستعد لإرسال الرسائل من النظام.
                </p>
              </div>
              <button onClick={fetchStatus} className="btn-outline">تحديث الحالة</button>
            </div>
          ) : status.qrCode ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <h2 className="text-xl font-bold text-amber-600 flex items-center gap-2">
                <QrCode className="w-6 h-6" />
                يرجى مسح كود QR
              </h2>
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCode value={status.qrCode} size={256} />
              </div>
              <p className="text-sm text-muted-foreground mt-4 max-w-xs">
                افتح تطبيق الواتساب في هاتفك {'>'} الأجهزة المرتبطة {'>'} ربط جهاز، ثم امسح الكود.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">
                في انتظار توليد كود QR... يرجى التأكد من تشغيل خادم الواتساب.
              </p>
            </div>
          )}
        </div>

        {/* Test Send Card */}
        <div className="card-base p-6">
          <h2 className="text-xl font-bold mb-4">إرسال رسالة تجريبية</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">رقم الهاتف (مع مفتاح الدولة أو بدونه)</label>
              <input
                type="text"
                placeholder="مثال: 01012345678"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                disabled={!status.isConnected}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">محتوى الرسالة</label>
              <textarea
                placeholder="اكتب رسالتك التجريبية هنا..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                disabled={!status.isConnected}
              />
            </div>
            <button 
              className="btn-gold w-full flex items-center justify-center" 
              onClick={sendTestMessage}
              disabled={!status.isConnected || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الإرسال...
                </>
              ) : 'إرسال الرسالة'}
            </button>
            
            {!status.isConnected && (
              <p className="text-sm text-red-500 text-center mt-2">
                يجب الاتصال بالواتساب أولاً لتتمكن من الإرسال
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
