# دليل ربط خادم الواتساب بالإنترنت للمعلمين خارج الشبكة (Remote Access Guide) 🌍

تتيح لك هذه الطرق تحويل جهازك الشخصي إلى سيرفر واتساب متاح عبر الإنترنت، بحيث يمكن لأي معلم أو موظف **خارج شبكة الـ Wi-Fi (من المنزل أو عبر باقة الموبايل)** استخدام خدمة الواتساب وإرسال الرسائل ومسح الـ QR Code بدون أي مشاكل.

---

## 🚀 الطريقة الأولى: استخدام Cloudflare Tunnel (الموصى بها - مجانية وآمنة 100%)

تمنحك هذه الطريقة رابط **HTTPS** دائم وخاص بسيرفرك بدون الحاجة لتغيير إعدادات الراوتر.

### الخطوات:
1. قم بتحميل أداة **Cloudflare Tunnel (`cloudflared`)** على جهازك من الموقع الرسمي:
   `https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/`

2. افتح موجه الأوامر (CMD) واكتب الأمر التالي لفتح النفق:
   ```cmd
   cloudflared tunnel --url http://localhost:3001
   ```

3. سيظهر لك رابط عالمي آمن مثل:
   `https://whatsapp-academy-random.trycloudflare.com`

4. ضع هذا الرابط في ملف البيئة `.env.local` للمشروع:
   ```env
   WHATSAPP_API_URL=https://whatsapp-academy-random.trycloudflare.com
   NEXT_PUBLIC_WHATSAPP_API_URL=https://whatsapp-academy-random.trycloudflare.com
   ```

---

## ⚡ الطريقة الثانية: رابط إنترنت فوري سريّع (Localtunnel)

للتجربة السريعة والمباشرة بدون تثبيت برامج:

1. افتح موجه الأوامر (CMD) واكتب الأمر التالي:
   ```cmd
   npx localtunnel --port 3001
   ```

2. سيقوم البرنامج بإعطائك رابط إنترنت عام فوراً مثل:
   `https://academy-whatsapp-service.loca.lt`

3. يمكنك إرسال هذا الرابط أو ربطه بالموقع ليعمل مع جميع المعلمين خارج الشبكة.

---

## 🌐 الطريقة الثالثة: فتح المنفذ في الراوتر (Port Forwarding)

1. ادخل على صفحة الراوتر الخص بك (`192.168.1.1`).
2. اذهب إلى قسم **Port Forwarding / Virtual Server**.
3. أضف قاعدة تحويل للمنفذ `3001` إلى عنوان IP جهازك (مثال: `192.168.1.15`).
4. سيكون رابط السيرفر للخارج هو الـ IP العام الخاص بك:
   `http://YOUR_PUBLIC_IP:3001`
