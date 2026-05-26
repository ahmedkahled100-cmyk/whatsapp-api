import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

    if (!process.env.GEMINI_API_KEY) {
      console.warn('Gemini API key is missing. Using fallback message.');
      const fallbackMsg = isPassed 
        ? `ألف مبروك! 🎉\nنود إعلامكم بنجاح الطالب/ة: *${studentName}*\nفي اختبار: *${examTitle}*\nبنتيجة: *${score}* من *${maxScore}*.\nمع تمنياتنا بدوام التفوق!`
        : `تحية طيبة،\nنود إعلامكم بنتيجة الطالب/ة: *${studentName}*\nفي اختبار: *${examTitle}*\nكانت النتيجة: *${score}* من *${maxScore}*.\nنتمنى له/لها التوفيق في المرات القادمة وبذل المزيد من الجهد.`;
      
      return NextResponse.json({ message: fallbackMsg });
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    return NextResponse.json({ message: text });
    
  } catch (error) {
    console.error('Error generating WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    );
  }
}
