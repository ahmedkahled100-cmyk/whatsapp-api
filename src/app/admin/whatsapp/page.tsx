'use client';

import { useState, useEffect } from 'react';
import { Loader2, QrCode, MessageSquare, CheckCircle2, RotateCcw, AlertTriangle, Globe, Copy, Save, Activity } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<{ isConnected: boolean; qrCode: string | null }>({
    isConnected: false,
    qrCode: null,
  });
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Server URL Config State
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');
  const [savingUrl, setSavingUrl] = useState(false);
  const [testingUrl, setTestingUrl] = useState(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  const fetchServerConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config');
      const data = await res.json();
      if (data.success && data.url) {
        setServerUrl(data.url);
      }
    } catch (e) {}
  };

  const saveServerUrl = async () => {
    setSavingUrl(true);
    setUrlMessage(null);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: serverUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setUrlMessage('✅ تم حفظ رابط السيرفر بنجاح!');
        fetchStatus();
      } else {
        setUrlMessage('❌ فشل الحفظ: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (e: any) {
      setUrlMessage('❌ خطأ: ' + e.message);
    } finally {
      setSavingUrl(false);
    }
  };

  const testServerUrlConnection = async () => {
    setTestingUrl(true);
    setUrlMessage(null);
    try {
      const targetUrl = serverUrl.replace(/\/+$/, '');
      const res = await fetch(`${targetUrl}/status`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setUrlMessage(`✅ تم الاتصال بالسيرفر بنجاح! (حالة الاتصال: ${data.isConnected ? 'متصل بالواتساب 🟢' : 'في انتظار مسح الـ QR Code 🟡'})`);
      } else {
        setUrlMessage('⚠️ السيرفر استجاب بخطأ HTTP: ' + res.status);
      }
    } catch (e: any) {
      setUrlMessage('❌ تعذر الاتصال بهذا الرابط: ' + e.message);
    } finally {
      setTestingUrl(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();

      if (res.ok && !data.error && !data.isOffline) {
        setServerError(null);
        setStatus({
          isConnected: data.isConnected || false,
          qrCode: data.qrCode || null,
        });
        return;
      }

      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const defaultUrl = `http://${host}:3001`;
      const localServerUrl = serverUrl || process.env.NEXT_PUBLIC_WHATSAPP_API_URL || defaultUrl;

      try {
        const localRes = await fetch(`${localServerUrl}/status`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (localRes.ok) {
          const localData = await localRes.json();
          setServerError(null);
          setStatus({
            isConnected: localData.isConnected || false,
            qrCode: localData.qrCode || null,
          });
          return;
        }
      } catch (localErr) {}

      setServerError(data.error || 'تعذر الاتصال بخادم الواتساب');
      setStatus({ isConnected: false, qrCode: null });
    } catch (error: any) {
      console.error('Error fetching WhatsApp status:', error);
      setServerError('فشل الاتصال بالخادم. يرجى التأكد من تشغيل خادم الواتساب.');
      setStatus({ isConnected: false, qrCode: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerConfig();
    fetchStatus();
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
      let data: any = null;

      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testNumber, message: testMessage }),
        });
        data = await res.json();
      } catch (e) {}

      if (!data || !data.success) {
        try {
          let formattedPhone = testNumber.replace(/\D/g, '');
          if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
            formattedPhone = `2${formattedPhone}`;
          }
          const targetUrl = serverUrl || 'http://localhost:3001';
          const localRes = await fetch(`${targetUrl}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'true',
            },
            body: JSON.stringify({ number: formattedPhone, message: testMessage }),
          });
          data = await localRes.json();
        } catch (localErr) {}
      }

      if (data && data.success) {
        alert("✅ تم إرسال الرسالة بنجاح!");
        setTestMessage('');
      } else {
        alert("❌ فشل الإرسال: " + (data?.error || 'تعذر الاتصال بخادم الواتساب'));
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

      {/* Main Status & Test Grid */}
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
          ) : serverError ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-red-500">{serverError}</h3>
              <p className="text-xs text-muted-foreground">
                يرجى تشغيل خادم الواتساب المحلي باستخدام الأمر:
                <br />
                <code className="bg-slate-800 text-gold px-2 py-1 rounded inline-block mt-2 text-sm dir-ltr">
                  npm run whatsapp
                </code>
              </p>
              <button 
                onClick={() => { setLoading(true); fetchStatus(); }} 
                className="btn-outline mt-2 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                إعادة المحاولة
              </button>
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

      {/* Public Server URL Config Card */}
      <div className="card-base p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-sky-500" />
          <h2 className="text-xl font-bold">رابط سيرفر الواتساب العام (المحلي أو الإنترنت)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          ضع هنا رابط سيرفر الواتساب (مثال: <code className="bg-slate-800 text-gold px-1 rounded">https://xxxx.loca.lt</code> للمشرقين خارج الشبكة أو <code className="bg-slate-800 text-gold px-1 rounded">http://192.168.1.X:3001</code> للأجهزة المحلية).
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-black dir-ltr font-mono"
            placeholder="http://localhost:3001 أو https://xxxx.loca.lt"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={saveServerUrl}
              disabled={savingUrl}
              className="btn-primary flex items-center gap-1 text-sm py-2 px-4"
            >
              {savingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </button>

            <button
              onClick={testServerUrlConnection}
              disabled={testingUrl}
              className="btn-outline flex items-center gap-1 text-sm py-2 px-4"
            >
              {testingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-emerald-500" />}
              اختبار
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(serverUrl);
                alert('تم نسخ الرابط!');
              }}
              className="btn-outline flex items-center gap-1 text-sm py-2 px-4"
            >
              <Copy className="w-4 h-4" />
              نسخ
            </button>
          </div>
        </div>

        {urlMessage && (
          <div className="p-3 rounded-lg bg-slate-900/60 text-sm font-medium text-amber-300 border border-amber-500/20">
            {urlMessage}
          </div>
        )}
      </div>
    </div>
  );
}
