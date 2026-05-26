import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, prompt: userPrompt, fileData, options } = body;

    if (!mode) {
      return NextResponse.json({ error: 'Missing mode' }, { status: 400 });
    }

    let systemPrompt = '';
    let contents: any[] = [];

    // Process file if provided
    let processedFileData = fileData;

    switch (mode) {
      case 'questions':
        const { topic, difficulty, type, count } = options || {};
        systemPrompt = `أنت معلم عربي خبير. قم بتوليد ${count || 5} أسئلة.
${topic ? `الموضوع: "${topic}".` : ''}
${processedFileData ? 'قم بتوليد الأسئلة بناءً على محتوى المستند المرفق.' : ''}
مستوى الصعوبة: ${difficulty || 'medium'}.
نوع الأسئلة: ${type === 'mcq' ? 'اختيار من متعدد' : type === 'tf' ? 'صح أو خطأ' : type === 'essay' ? 'مقالي' : 'مختلط'}.

أعد JSON array فقط بدون markdown. كل سؤال في هذا الشكل:
{
  "text": "نص السؤال بالعربية",
  "type": "${type === 'mixed' ? 'mcq أو tf أو essay' : type}",
  "difficulty": "${difficulty}",
  "subject": "اسم المادة بالعربية",
  "points": <نقاط مقترحة>,
  "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
  "correctAnswer": "الإجابة الصحيحة",
  "explanation": "شرح الإجابة بالعربية"
}`;
        break;

      case 'summary':
        systemPrompt = `أنت مساعد تعليمي متخصص. قم بتلخيص المحتوى المرفق بشكل منظم واحترافي باللغة العربية.
${options?.style === 'bullet' ? 'استخدم نقاط مرتبة وواضحة.' : ''}
${options?.style === 'detailed' ? 'اعطِ تلخيصاً تفصيلياً شاملاً.' : ''}
${options?.style === 'simple' ? 'اجعل الملخص بسيطاً ومناسباً للطلاب.' : ''}

قدم:
1. عنوان رئيسي للمحتوى
2. النقاط الأساسية
3. المفاهيم المهمة
4. ملخص ختامي

أجب بـ JSON:
{"title": "عنوان المحتوى", "mainPoints": ["نقطة 1", "نقطة 2"], "keyTerms": [{"term": "مصطلح", "definition": "تعريف"}], "summary": "الملخص الختامي"}`;
        break;

      case 'chat':
        systemPrompt = `أنت مساعد ذكاء اصطناعي تعليمي متخصص لمنصة AN Academy. أجب عن أسئلة المعلم باللغة العربية بشكل واضح ومختصر.
${processedFileData ? 'لديك وصول لمستند مرفق، يمكن للمعلم السؤال عن محتواه.' : ''}
السؤال: ${userPrompt}

أجب بـ JSON: {"answer": "الإجابة بالعربية", "tips": ["نصيحة اختيارية"]}`;
        break;

      case 'flashcards':
        systemPrompt = `أنت معلم خبير في إنشاء بطاقات دراسية. قم بإنشاء ${options?.count || 10} بطاقة دراسية (flashcards) من المحتوى المرفق.
${options?.subject ? `المادة: ${options.subject}` : ''}

أعد JSON array:
[{"front": "سؤال أو مصطلح", "back": "إجابة أو تعريف", "hint": "تلميح اختياري"}]`;
        break;

      case 'explain':
        systemPrompt = `أنت معلم متخصص. اشرح الموضوع التالي بشكل مبسط وواضح باللغة العربية: "${userPrompt}"
${processedFileData ? 'استخدم المستند المرفق كمرجع.' : ''}
أجب بـ JSON: {"title": "عنوان الشرح", "explanation": "شرح تفصيلي", "examples": ["مثال 1", "مثال 2"], "summary": "ملخص"}`;
        break;

      case 'mindmap':
        systemPrompt = `أنت خبير في رسم الخرائط الذهنية التعليمية. قم بتحليل المحتوى المرفق أو الموضوع المعطى وإنشاء خريطة ذهنية احترافية وشاملة باللغة العربية.
الموضوع: "${userPrompt || 'المحتوى المرفق'}"

يجب أن تكون الخريطة هرمية ومنظمة بشكل منطقي لتسهيل الفهم والحفظ.
أجب بـ JSON فقط بالهيكل التالي:
{
  "title": "العنوان الرئيسي للخريطة",
  "nodes": [
    {
      "text": "الفكرة الرئيسية 1",
      "children": [
        { "text": "فكرة فرعية 1.1" },
        { "text": "فكرة فرعية 1.2" }
      ]
    },
    {
      "text": "الفكرة الرئيسية 2",
      "children": [
        { "text": "فكرة فرعية 2.1" }
      ]
    }
  ]
}`;
        break;

      case 'analytics':
        systemPrompt = `أنت خبير في علم أصول التدريس وتحليل البيانات التعليمية. سأزودك ببيانات أداء الطلاب (الدرجات، الاختبارات).
        قم بتحليل البيانات وتقديم رؤى عميقة (AI Insights) باللغة العربية.
        حدد:
        1. أفضل الطلاب أداءً (المتفوقين).
        2. الطلاب الذين يحتاجون إلى دعم والمواضيع التي يعانون منها.
        3. توصيات عامة للمعلم لتحسين الأداء الكلي.

        البيانات المرفقة: ${userPrompt}

        أجب بـ JSON فقط بالهيكل التالي:
        {
          "topStudents": [{"name": "اسم الطالب", "insight": "رؤية قصيرة"}],
          "needsSupport": [{"name": "اسم الطالب", "insight": "رؤية قصيرة لتطويره"}],
          "generalRecommendations": ["توصية 1", "توصية 2"]
        }`;
        break;

      default:
        return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
    }

    contents.push(systemPrompt);
    if (processedFileData?.inlineData && processedFileData?.mimeType) {
      contents.push({ inlineData: { data: processedFileData.inlineData, mimeType: processedFileData.mimeType } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // For questions mode, parse as array; for others parse as object
    const result = JSON.parse(cleaned);
    
    if (mode === 'questions') {
      return NextResponse.json({ questions: Array.isArray(result) ? result : result.questions || [] });
    } else if (mode === 'flashcards') {
      return NextResponse.json({ flashcards: Array.isArray(result) ? result : result.flashcards || [] });
    } else {
      return NextResponse.json({ result });
    }
  } catch (err: any) {
    console.error('AI API error:', err);
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 });
  }
}
