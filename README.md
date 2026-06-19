# 🎓 A-N Academy — منصة التعليم الذكي

منصة تعليمية متكاملة مبنية بـ **Next.js 14** + **Firebase** بميزانية **مجانية تماماً**.

---

## 🚀 الميزات

### لوحة المعلم
- ✅ إنشاء اختبارات (اختيار متعدد + مقالي)
- ✅ إدارة الطلاب والفصول الدراسية
- ✅ تخصيص اختبار لفصل معين
- ✅ نتائج فورية وإحصاءات تفصيلية
- ✅ تصدير النتائج CSV
- ✅ تصحيح الأسئلة المقالية
- ✅ جدولة الاختبارات بوقت بداية ونهاية
- ✅ إعدادات الأمان (منع النسخ، تسجيل مغادرة الصفحة)
- ✅ شريط جانبي قابل للطي

### بوابة الطالب
- ✅ دخول بكود خاص (6 أحرف)
- ✅ عرض الاختبارات المتاحة للطالب حسب فصله
- ✅ أداء الاختبار مع مؤقت
- ✅ نتائج فورية وتاريخ المحاولات
- ✅ متوافق مع الجوال

---

## 📦 البنية التقنية

```
Next.js 14 (App Router)  — الإطار الرئيسي
Firebase Firestore        — قاعدة بيانات حقيقية (مجانية)
Firebase Auth             — مصادقة المستخدمين (مستقبلاً)
Zustand                   — إدارة الحالة
Tailwind CSS              — التصميم
TypeScript                — أمان الأنواع
Vercel                    — الاستضافة (مجانية)
```

---

## 🛠️ خطوات الإعداد (15 دقيقة فقط)

### الخطوة 1: Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. أنشئ مشروعاً جديداً (الاسم: `an-academy`)
3. فعّل **Firestore Database** (اختر mode: Production)
4. أضف هذه القواعد في Firestore Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // الإعدادات - قراءة للجميع، كتابة للمعلم فقط
    match /settings/{doc} {
      allow read: if true;
      allow write: if true; // عدّل هذا للإنتاج
    }
    // باقي المجموعات
    match /{collection}/{doc} {
      allow read, write: if true; // عدّل للإنتاج
    }
  }
}
```

5. اذهب إلى **Project Settings** → **Web App** → انسخ الإعدادات

### الخطوة 2: إعداد المشروع

```bash
# نسخ المشروع
git clone https://github.com/yourusername/an-academy.git
cd an-academy

# تثبيت المكتبات
npm install

# إنشاء ملف البيئة
cp .env.example .env.local
```

### الخطوة 3: إضافة إعدادات Firebase

عدّل ملف `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123
```

### الخطوة 4: تشغيل المشروع

```bash
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

- **لوحة المعلم**: `http://localhost:3000/auth` (كلمة المرور: `admin123`)
- **بوابة الطالب**: `http://localhost:3000/student`

---

## 🌐 النشر المجاني على Vercel

```bash
# تثبيت Vercel CLI
npm i -g vercel

# نشر المشروع
vercel

# أضف متغيرات البيئة في:
# vercel.com → مشروعك → Settings → Environment Variables
```

**أو** عبر واجهة Vercel:
1. ارفع المشروع على GitHub
2. اذهب إلى [vercel.com](https://vercel.com) وسجّل بحساب GitHub
3. انقر **Import Project** واختر المشروع
4. أضف متغيرات البيئة (Environment Variables)
5. انقر **Deploy** ✅

---

## 📊 حدود الخطة المجانية

| الخدمة | الحد المجاني | ملاحظة |
|--------|-------------|---------|
| Firebase Firestore | 1 GB تخزين | كافٍ لآلاف الطلاب |
| Firebase Reads | 50,000/يوم | كافٍ جداً |
| Firebase Writes | 20,000/يوم | كافٍ جداً |
| Vercel Hosting | 100 GB bandwidth | مجاني تماماً |
| Domain | vercel.app subdomain | مجاني |

---

## 📁 هيكل المشروع

```
src/
├── app/
│   ├── auth/           # صفحة دخول المعلم
│   ├── teacher/
│   │   ├── layout.tsx  # تخطيط الشريط الجانبي
│   │   ├── dashboard/  # لوحة التحكم الرئيسية
│   │   ├── exams/      # إدارة الاختبارات
│   │   ├── students/   # إدارة الطلاب
│   │   ├── groups/     # الفصول الدراسية
│   │   ├── results/    # النتائج والتقارير
│   │   └── settings/   # الإعدادات
│   ├── student/        # بوابة الطالب
│   └── exam/[id]/      # صفحة أداء الاختبار
├── lib/
│   ├── firebase.ts     # إعداد Firebase
│   ├── db.ts           # كل عمليات قاعدة البيانات
│   ├── store.ts        # إدارة الحالة (Zustand)
│   └── utils.ts        # دوال مساعدة
└── types/
    └── index.ts        # تعريفات TypeScript
```

---

## 🔮 الميزات المستقبلية (يمكن إضافتها)

- [ ] تطبيق موبايل (React Native - نفس الكود)
- [ ] نظام إشعارات WhatsApp
- [ ] رفع ملفات PDF للإجابات المقالية
- [ ] شهادات إتمام مُولَّدة تلقائياً
- [ ] تحليلات متقدمة بالرسوم البيانية
- [ ] نظام الدفع (اشتراكات الطلاب)
- [ ] بنك أسئلة مع بحث متقدم
- [ ] واجبات منزلية

---

## 🤝 المساهمة

هذا المشروع مفتوح المصدر. يُرجى فتح Issue أو Pull Request لأي تحسين.

---

**صُنع بـ ❤️ للأستاذ أحمد خالد | A-N Academy**
# whatsapp-api
