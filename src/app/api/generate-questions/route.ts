import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the SDK. It automatically picks up GEMINI_API_KEY from the environment.
const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, difficulty, type, count, fileData } = body;

    // We allow generation if EITHER topic OR fileData is present
    if ((!topic && !fileData) || !difficulty || !type || !count) {
      return NextResponse.json({ error: 'Missing required parameters (Topic or File needed)' }, { status: 400 });
    }

    let prompt = `You are an expert Arabic teacher. Generate ${count} questions. 
${topic ? `Focus strongly on this topic/instructions: "${topic}".` : ''}
${fileData ? `Base your questions mainly on the provided attached document/image content.` : ''}
Difficulty level: ${difficulty} (easy, medium, hard).
Question type: ${type === 'mcq' ? 'Multiple Choice (MCQ)' : 'Essay / Short Answer'}.

Return ONLY a valid JSON array of objects. Do NOT wrap it in markdown codeblocks (no \`\`\`json). Just the raw JSON array.
Each object must match this interface:
{
  "text": "The question text in Arabic",
  "type": "${type}",
  "difficulty": "${difficulty}",
  "subject": "The extracted general subject name in Arabic (e.g. رياضيات, لغة عربية)",
  "points": <suggested points for this question, e.g. 1 or 2>,
`;

    if (type === 'mcq') {
      prompt += `
  "options": ["Option 1 in Arabic", "Option 2 in Arabic", "Option 3 in Arabic", "Option 4 in Arabic"],
  "correctAnswer": "The exact string of the correct option from the options array",
  "explanation": "A short explanation of why this answer is correct in Arabic"
}
`;
    } else {
      prompt += `
  "explanation": "A model answer or grading rubric in Arabic"
}
`;
    }

    // construct contents array
    const contents: any[] = [prompt];
    
    // Add file data if present
    if (fileData && fileData.inlineData && fileData.mimeType) {
        let finalInlineData = fileData.inlineData;
        
        // Auto-compress PDFs if they are potentially large (> 5MB in base64 is ~3.75MB raw, let's check base64 length)
        // A 5MB raw file is ~6.67MB in base64.
        if (fileData.mimeType === 'application/pdf' && fileData.inlineData.length > 6.5 * 1024 * 1024) {
          try {
            const { ILovePDFClient } = await import('@/lib/ilovepdf');
            if (ILovePDFClient.isConfigured()) {
              console.log('[AI API] PDF is large, attempting compression...');
              const buffer = Buffer.from(fileData.inlineData, 'base64');
              const compressedBuffer = await ILovePDFClient.compress(buffer);
              finalInlineData = compressedBuffer.toString('base64');
              console.log(`[AI API] Compression complete: ${buffer.length} -> ${compressedBuffer.length}`);
            }
          } catch (compErr) {
            console.error('[AI API] Compression failed, proceeding with original:', compErr);
          }
        }

        contents.push({
            inlineData: {
                data: finalInlineData,
                mimeType: fileData.mimeType,
            }
        });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    const text = response.text;
    
    if (!text) {
        throw new Error("No text returned from Gemini");
    }

    // Attempt to parse the response as JSON (cleaning up markdown if the AI ignored the instruction)
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(cleanedText);

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('AI Generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate questions' }, { status: 500 });
  }
}
