// scratch/reset_admin.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("❌ ملف .env.local غير موجود في المجلد الرئيسي للمشروع!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}\\s*=\\s*["']?(.*?)["']?$`,'m'));
  return match ? match[1] : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ لم يتم العثور على مفاتيح Supabase في ملف .env.local!");
  process.exit(1);
}

console.log("🌐 جاري الاتصال بقاعدة بيانات Supabase...");
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdmin() {
  try {
    // 2. Search for existing admin
    const { data: existingAdmins, error: fetchError } = await supabase
      .from('teachers')
      .select('*')
      .eq('role', 'super_admin');

    if (fetchError) {
      console.error("❌ فشل استعلام قاعدة البيانات:", fetchError.message);
      return;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      const admin = existingAdmins[0];
      console.log(`🔍 تم العثور على حساب مدير قائم: ${admin.username}`);
      
      // Update credentials to admin/admin123
      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          username: 'admin',
          password: 'admin123',
          is_active: true
        })
        .eq('id', admin.id);

      if (updateError) {
        console.error("❌ فشل تحديث بيانات الأدمن:", updateError.message);
      } else {
        console.log("✅ تم إعادة تعيين بيانات الأدمن بنجاح!");
        console.log("   اسم المستخدم: admin");
        console.log("   كلمة المرور: admin123");
      }
    } else {
      console.log("💡 لم يتم العثور على حساب مدير عام. جاري إنشاء حساب جديد...");
      
      // Create new super_admin
      const newAdmin = {
        id: crypto?.randomUUID() || 'admin-root-user-id',
        name: 'المدير العام',
        username: 'admin',
        password: 'admin123',
        role: 'super_admin',
        is_active: true,
        created_at: Date.now()
      };

      const { error: insertError } = await supabase
        .from('teachers')
        .insert([newAdmin]);

      if (insertError) {
        console.error("❌ فشل إنشاء حساب الأدمن الجديد:", insertError.message);
      } else {
        console.log("✅ تم إنشاء حساب الأدمن الجديد بنجاح!");
        console.log("   اسم المستخدم: admin");
        console.log("   كلمة المرور: admin123");
      }
    }
  } catch (err) {
    console.error("❌ حدث خطأ غير متوقع:", err.message);
  }
}

resetAdmin();
