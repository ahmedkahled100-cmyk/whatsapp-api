import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the SDK with the API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gameType, fileData, topic, count = 10 } = body;

    if (!gameType || (!fileData && !topic)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let prompt = `You are an expert Arabic educational game designer. Generate content for a "${gameType}" game in Arabic.
${topic ? `Topic/Subject: "${topic}".` : ''}
${fileData ? `Base the content strictly on the provided study material.` : ''}
Generate exactly ${count} items.

Return ONLY a valid JSON array of objects. Do NOT include markdown code blocks.
`;

    if (gameType === 'flashcards') {
      prompt += `Each object MUST be: {"front": "Term or Question in Arabic", "back": "Summary or Answer in Arabic"}`;
    } else if (gameType === 'match') {
      prompt += `Each object MUST be: {"term": "Word/Term in Arabic", "definition": "A short matching definition in Arabic"}`;
    } else if (gameType === 'sentence') {
      prompt += `Each object MUST be: {"correct": "A full useful sentence in Arabic", "scrambled": ["word1", "word2", "word3", "..."]}`;
    } else if (gameType === 'sort') {
      prompt += `Each object MUST be: {"item": "Subject/Term in Arabic", "category": "The correct category name in Arabic"}`;
    } else if (gameType === 'tf_run') {
      prompt += `Each object MUST be: {"statement": "A fact in Arabic", "isTrue": true/false, "explanation": "Brief explanation in Arabic"}`;
    } else {
       // Default to quiz
      prompt += `Each object MUST be a standard MCQ: {"text": "Question", "options": ["A","B","C","D"], "correct": index}`;
    }

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
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    
    try {
      const gameContent = JSON.parse(cleanedText);
      return NextResponse.json({ gameContent });
    } catch (e) {
      console.error('Failed to parse AI JSON:', cleanedText);
      throw new Error('AI returned invalid JSON format');
    }
  } catch (error: any) {
    console.error('AI Game Generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate game content' }, { status: 500 });
  }
}
