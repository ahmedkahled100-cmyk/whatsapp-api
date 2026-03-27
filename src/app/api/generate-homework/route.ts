import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the SDK with the API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, fileData, topic } = body; // type: 'mcq', 'tf', 'essay', 'mixed'

    if (!type || (!fileData && !topic)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let typeDesc = '';
    if (type === 'mcq') typeDesc = 'أسئلة اختيار من متعدد (MCQ) فقط مع 4 خيارات لكل سؤال';
    else if (type === 'tf') typeDesc = 'أسئلة صح أو خطأ فقط';
    else if (type === 'essay') typeDesc = 'أسئلة مقالية وشرح فقط';
    else typeDesc = 'مزيج من أسئلة الاختيار من متعدد، والصح والخطأ، والأسئلة المقالية';

    let prompt = `أنت معلم خبير ومصمم محتوى تعليمي محترف. 
مهمتك هي إنشاء "واجب منزلي" (Homework) باللغة العربية للطلاب بناءً على المادة العلمية المقدمة.

الموضوع/المجال: "${topic || 'مادة دراسية'}".
نوع الأسئلة المطلوب: ${typeDesc}.

التعليمات:
1. قم بصياغة عنوان جذاب للواجب (مثال: واجب الدرس الأول: قوانين الحركة).
2. قم بصياغة الأسئلة بدقة تربوية وعلمية لتشمل مستويات تفكير متنوعة.
3. التنسيق: استخدم تنسيقاً جميلاً ومنظماً يسهل على الطالب قراءته وفهمه.
4. استخدم العناوين (مثل: السؤال الأول، السؤال الثاني) والتحسينات البصرية (مثل: • أو 1.).
5. في أسئلة الاختيار من متعدد، اذكر 4 خيارات واضحة (أ، ب، ج، د).
6. في أسئلة المقالي، اجعل السؤال واضحاً ومحدداً.
7. أضف جملة تشجيعية في نهاية الواجب (مثال: بالتوفيق يا بطل!).

هام جداً:
- اجعل المحتوى في شكل نص منسق (Formatted Text).
- لا تستخدم كود JSON أو كتل Markdown البرمجية.
- اعتمد بشكل أساسي على المادة العلمية إذا تم توفيرها.

${fileData ? `استخلص الأسئلة وفلكرتها بناءً على الملف المرفق حصرياً.` : ''}
`;

    const parts: any[] = [{ text: prompt }];
    
    if (fileData?.inlineData && fileData?.mimeType) {
      parts.push({
        inlineData: {
          data: fileData.inlineData,
          mimeType: fileData.mimeType,
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');
    
    // Split title and body logic (simple heuristic)
    const lines = text.trim().split('\n');
    const title = lines[0].replace(/^(عنوان الواجب:|العنوان:|#|##)\s*/i, '').trim();
    const description = lines.slice(1).join('\n').trim();

    return NextResponse.json({ title, description });
  } catch (error: any) {
    console.error('AI Homework Generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate homework content' }, { status: 500 });
  }
}
