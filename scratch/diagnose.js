// scratch/diagnose.js
const dns = require('dns');
const https = require('https');

const host = 'frltgnhyvqkjpsdkiove.supabase.co';

console.log(`🔍 بدء فحص الاتصال بـ ${host}...\n`);

// 1. DNS Lookup
dns.lookup(host, (err, address, family) => {
  if (err) {
    console.error("❌ فشل حل اسم النطاق (DNS Lookup Failed):");
    console.error(`   الرمز: ${err.code}`);
    console.error(`   الرسالة: ${err.message}`);
    console.error("\n💡 هذا يعني غالباً أن مزود الإنترنت الخاص بك (ISP) يمنع أو يحجب نطاقات Supabase، أو لا يوجد اتصال إنترنت في نافذة الأوامر.");
    console.error("💡 حل مقترح: قم بتشغيل VPN (مثل Cloudflare WARP) وأعد المحاولة.");
  } else {
    console.log(`✅ تم حل اسم النطاق بنجاح!`);
    console.log(`   العنوان IP: ${address}`);
    
    // 2. HTTPS Request
    console.log("\n🌐 جاري اختبار طلب HTTPS...");
    const req = https.get(`https://${host}/rest/v1/`, (res) => {
      console.log(`✅ تم الاستجابة من الخادم بنجاح!`);
      console.log(`   كود الحالة: ${res.statusCode}`);
    });
    
    req.on('error', (e) => {
      console.error("❌ فشل طلب HTTPS (HTTP Request Failed):");
      console.error(`   الرمز: ${e.code}`);
      console.error(`   الرسالة: ${e.message}`);
      console.error("\n💡 هذا يعني أن اسم النطاق يترجم بشكل صحيح ولكن هناك جدار حماية أو برنامج حماية يمنع الاتصال بالخادم.");
    });
    
    req.end();
  }
});
