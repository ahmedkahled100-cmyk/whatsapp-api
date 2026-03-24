import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// API Route for generating AI WhatsApp message
export async function POST(req: Request) {
  try {
    let { studentName, examTitle, score, isPassed, maxScore } = await req.json();

    const missing: string[] = [];
    if (!studentName) missing.push('studentName');
    if (!examTitle) missing.push('examTitle');
    if (score === undefined) missing.push('score');

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required parameters: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    maxScore = maxScore || 100;

    // Use environment variable for the API key, typically NEXT_PUBLIC_GEMINI_API_KEY
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('Gemini API key is missing. Using fallback message.');
      const fallbackMsg = isPassed 
        ? `ألف مبروك! 🎉\nنود إعلامكم بنجاح الطالب/ة: *${studentName}*\nفي اختبار: *${examTitle}*\nبنتيجة: *${score}* من *${maxScore}*.\nمع تمنياتنا بدوام التفوق!`
        : `تحية طيبة،\nنود إعلامكم بنتيجة الطالب/ة: *${studentName}*\nفي اختبار: *${examTitle}*\nكانت النتيجة: *${score}* من *${maxScore}*.\nنتمنى له/لها التوفيق في المرات القادمة وبذل المزيد من الجهد.`;
      
      return NextResponse.json({ message: fallbackMsg });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    أنت أكاديمية تعليمية راقية تُدعى "A-N Academy". 
    قم بكتابة رسالة واتس آب قصيرة ومخصصة لولي أمر الطالب/ة بخصوص نتيجة اختباره.
    يجب أن تكون الرسالة ودية ولطيفة ومناسبة للإرسال عبر الواتس آب (استخدم الإيموجي المناسبة).
    
    بيانات الطالب:
    - الاسم: ${studentName}
    - اسم الاختبار: ${examTitle}
    - الدرجة الفعلية: ${score} من ${maxScore} (يجب ذكر هذه الدرجة في الرسالة بوضوح، مثلا "حصل على كذا من كذا")
    - حالة النجاح: ${isPassed ? 'ناجح ✅' : 'يحتاج لمزيد من المذاكرة ❌'}

    التعليمات:
    - إن كان ناجحاً: هنئه وأشعر ولي الأمر بالفخر.
    - إن كان راسباً أو درجته ضعيفة: كن مشجعاً ولطيفاً واطلب من ولي الأمر دعمه للتحسن في المرات القادمة، لا تستخدم ألفاظاً قاسية.
    - اذكر الدرجة الفعلية بالضبط كما هي (مثل ${score} من ${maxScore}).
    - لا تذكر النسبة المئوية أبداً.
    - اجعل الرسالة قصيرة قدر الإمكان (حوالي 3-4 أسطر).
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ message: text });
    
  } catch (error) {
    console.error('Error generating WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    );
  }
}
