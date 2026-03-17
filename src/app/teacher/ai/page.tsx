'use client';
// src/app/teacher/ai/page.tsx

import { useState } from 'react';
import { useTeacherStore } from '@/lib/store';
import { addToQBank } from '@/lib/db';
import { QuestionBankItem, Question } from '@/types';
import { showToast } from '@/lib/toast';
import { Bot, Sparkles, Loader2, Save, CheckCircle, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PDFCompressionModal, usePDFCompression } from '@/components/PDFCompressionModal';

export default function AIPage() {
  const router = useRouter();
  const { setTempExamQuestions } = useTeacherStore();
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [type, setType] = useState<'mcq' | 'essay' | 'tf' | 'mixed'>('mixed');
  const [count, setCount] = useState(5);
  const [fileData, setFileData] = useState<{ inlineData: string; mimeType: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<Partial<QuestionBankItem>[]>([]);
  const [savingStatus, setSavingStatus] = useState<Record<number, 'idle' | 'saving' | 'saved'>>({});
  const [aiProgress, setAiProgress] = useState(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [modalData, setModalData] = useState({
    subject: '',
    unit: '', // Using unit for Grades/Class
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  // iLovePDF Compression Hook
  const { openCompression, CompressionModal } = usePDFCompression();

  const handleGenerate = async () => {
    if (!topic && !fileData) {
      showToast('الرجاء كتابة الموضوع أو إرفاق ملف لكي يستطيع الذكاء الاصطناعي توليد الأسئلة.');
      return;
    }

    setLoading(true);
    setAiProgress(0);
    setGeneratedQuestions([]);
    setSavingStatus({});

    const progressInterval = setInterval(() => {
      setAiProgress(prev => {
        if (prev >= 95) return 95;
        const increment = prev < 50 ? 5 : prev < 80 ? 2 : 1;
        return prev + increment;
      });
    }, 500);

    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, difficulty, type, count, fileData }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'فشل في توليد الأسئلة');
      }

      const data = await res.json();

      setAiProgress(100);
      setGeneratedQuestions(data.questions);
    } catch (error: any) {
      showToast(error.message);
      console.error(error);
      setAiProgress(0);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setLoading(false), 500);
    }
  };

  // Helper function to compress image before upload
  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 with compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size - max 15MB for PDF, 5MB for images
    const isPDF = file.type === 'application/pdf';
    const maxSize = isPDF ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      if (isPDF) {
        openCompression(file);
      } else {
        showToast(`حجم الملف كبير جداً. الحد الأقصى للصور هو 5 ميجابايت.`);
      }
      e.target.value = '';
      return;
    }

    setFileName(file.name);

    try {
      let base64Data: string;
      let mimeType = file.type;

      // Compress images, pass through PDFs as-is (with size check)
      if (file.type.startsWith('image/')) {
        base64Data = await compressImage(file, 1200, 0.7);
        mimeType = 'image/jpeg'; // Compressed images become JPEG
      } else if (file.type === 'application/pdf') {
        // For PDFs, we still need to encode but they're usually smaller
        const reader = new FileReader();
        base64Data = await new Promise((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        showToast('نوع الملف غير مدعوم. يُدعم فقط الصور وملفات PDF.');
        e.target.value = '';
        return;
      }

      const base64 = base64Data.split(',')[1];
      
      // Check final payload size (should be under 3MB to be safe)
      const payloadSize = (base64.length * 3) / 4 / 1024 / 1024; // Approximate MB
      if (payloadSize > 3) {
        showToast('حجم الملف بعد الضغط كبير جداً. يرجى اختيار ملف أصغر أو تقليل جودة الصورة.');
        e.target.value = '';
        setFileName('');
        return;
      }

      setFileData({
        inlineData: base64,
        mimeType: mimeType,
      });
    } catch (error) {
      console.error('Error processing file:', error);
      showToast('حدث خطأ أثناء معالجة الملف. يرجى المحاولة مرة أخرى.');
      e.target.value = '';
      setFileName('');
    }
  };

  const handleCompressed = async (blob: Blob, url: string) => {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64 = base64Data.split(',')[1];
      setFileData({
        inlineData: base64,
        mimeType: 'application/pdf',
      });
      showToast('تم ضغط الملف ومعالجته بجودة عالية');
    } catch (error) {
      console.error('Error handling compressed file:', error);
      showToast('حدث خطأ أثناء معالجة الملف المضغوط');
    }
  };

  const openSaveModal = (index: number | null) => {
    setSelectedQuestionIndex(index); // null means "Save All"
    setShowModal(true);
  };

  const confirmSaveToQBank = async () => {
    setShowModal(false);
    
    if (selectedQuestionIndex !== null) {
      await saveSingleQuestion(selectedQuestionIndex, generatedQuestions[selectedQuestionIndex]);
    } else {
      let savedCount = 0;
      for (let i = 0; i < generatedQuestions.length; i++) {
          if (savingStatus[i] !== 'saved') {
              await saveSingleQuestion(i, generatedQuestions[i]);
              savedCount++;
          }
      }
      if (savedCount > 0) {
          showToast(`تم حفظ ${savedCount} أسئلة في بنك الأسئلة بنجاح!`);
      }
    }
  };

  const saveSingleQuestion = async (index: number, question: any) => {
    setSavingStatus(prev => ({ ...prev, [index]: 'saving' }));
    try {
      if (question.type === 'mcq' || question.type === 'tf') {
        question.correct = question.options.indexOf(question.correctAnswer);
      }
      question.usageCount = 0;
      question.subject = modalData.subject || question.subject;
      question.unit = modalData.unit;
      question.difficulty = modalData.difficulty;

      await addToQBank(question);
      setSavingStatus(prev => ({ ...prev, [index]: 'saved' }));
    } catch (error) {
      showToast('حدث خطأ أثناء حفظ السؤال.');
      setSavingStatus(prev => ({ ...prev, [index]: 'idle' }));
    }
  };

  const handleCreateExamDirectly = () => {
    // Map AI generated questions to standard Question format
    const formattedQuestions: Question[] = generatedQuestions.map((q, i) => ({
      id: `ai-${Date.now()}-${i}`,
      type: q.type as 'mcq' | 'essay' | 'tf',
      text: q.text || '',
      options: q.options,
      correct: q.type === 'mcq' || q.type === 'tf' ? (q.options ? q.options.indexOf((q as any).correctAnswer as string) : undefined) : undefined,
      explanation: q.explanation,
      maxScore: (q as any).points || 1,
    }));
    
    // Check if setTempExamQuestions exists in the store, if not we will implement it next
    if (setTempExamQuestions) {
      setTempExamQuestions(formattedQuestions);
      router.push('/teacher/exams/create');
    } else {
      showToast("هذه الميزة قيد التطوير حالياً وسيتم برمجتها في الخطوة القادمة.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot size={28} className="text-gold" />
        <h1 className="text-2xl font-cairo font-black gold-text">مساعد الذكاء الاصطناعي</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-base p-6 border border-gold/20" style={{ background: 'linear-gradient(180deg, rgba(245,197,24,0.05) 0%, rgba(0,0,0,0) 100%)' }}>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-gold" /> توليد أسئلة
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 opacity-70">الموضوع أو الدرس</label>
                <textarea 
                  className="input-base w-full h-24 resize-none" 
                  placeholder="مثال: الخلية النباتية والحيوانية، نظرية فيثاغورس، أسباب الحرب العالمية الثانية..."
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1 opacity-70">مستوى الصعوبة</label>
                <select className="input-base w-full" value={difficulty} onChange={e => setDifficulty(e.target.value as any)}>
                  <option value="easy">سهل</option>
                  <option value="medium">متوسط</option>
                  <option value="hard">صعب</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1 opacity-70">نوع الأسئلة</label>
                <select className="input-base w-full" value={type} onChange={e => setType(e.target.value as any)}>
                  <option value="mixed">مختلط (مقالي واختياري وصح/خطأ)</option>
                  <option value="mcq">اختيار من متعدد فقط</option>
                  <option value="tf">صح أم خطأ فقط</option>
                  <option value="essay">مقالي فقط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1 opacity-70">عدد الأسئلة</label>
                <input 
                  type="number" 
                  className="input-base w-full" 
                  min="1" max="10" 
                  value={count} 
                  onChange={e => setCount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm mb-1 opacity-70">إرفاق ملف (اختياري)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="input-base w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gold file:text-black hover:file:bg-yellow-400 cursor-pointer"
                  />
                  {fileName && (
                    <button 
                      onClick={() => { setFileData(null); setFileName(''); }}
                      className="p-2 text-red-500 hover:bg-white/5 rounded-xl shrink-0"
                      title="مسح الملف"
                    >
                      ×
                    </button>
                  )}
                </div>
                <p className="text-xs mt-1 text-gray-500">يدعم PDF (حتى 15MB) وصور (حتى 5MB). سيتم ضغط ملفات PDF الكبيرة تلقائياً.</p>
              </div>

              <button 
                onClick={handleGenerate} 
                disabled={loading || (!topic && !fileData)}
                className="btn-gold w-full justify-center mt-4 py-3"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> جاري التوليد...</> : 'توليد الأسئلة'}
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl text-xs opacity-70" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <strong className="block mb-1 text-gold">💡 نصيحة احترافية:</strong>
            كلما كان وصف الموضوع دقيقاً (مذكور فيه المحاور الأساسية المطلوبة)، كلما حصلت على أسئلة ذات جودة أعلى ومناسبة تماماً لمنهجك.
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {generatedQuestions.length === 0 && !loading && (
            <div className="card-base p-12 text-center h-full flex flex-col items-center justify-center">
              <Bot size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-gray-400">الأسئلة المُولّدة بالذكاء الاصطناعي ستظهر هنا.</p>
              <p className="text-xs opacity-50 mt-2">مدعوم بنموذج Gemini 2.5 Flash من Google</p>
            </div>
          )}

          {loading && (
            <div className="card-base p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative mb-6">
                <Bot size={56} className="text-gold animate-pulse" />
                <Sparkles size={24} className="text-gold absolute -top-2 -right-2 animate-spin-slow" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-cairo">جاري التوليد...</h3>
              <p className="text-gray-400 mb-8 max-w-md text-sm">يقوم الذكاء الاصطناعي الآن بقراءة المحتوى وتوليد الأسئلة المناسبة</p>
              
              <div className="w-full max-w-md bg-white/5 rounded-full h-3 overflow-hidden border border-white/10 relative">
                <div 
                  className="bg-gradient-to-r from-yellow-600 to-gold h-full transition-all duration-300 relative"
                  style={{ width: `${aiProgress}%` }}
                >
                  <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <p className="mt-3 text-gold font-bold font-mono">{aiProgress}%</p>
            </div>
          )}

          {generatedQuestions.length > 0 && !loading && (
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="font-bold">النتيجة ({generatedQuestions.length} أسئلة)</h3>
              <div className="flex gap-4">
                <button 
                  onClick={handleCreateExamDirectly}
                  className="bg-gold/10 text-gold text-sm hover:bg-gold hover:text-black transition-colors rounded-xl font-bold flex items-center gap-1 px-3 py-1.5"
                >
                  <Sparkles size={14} /> إنشاء اختبار فوراً
                </button>
                <button 
                  onClick={() => openSaveModal(null)}
                  className="text-gold text-sm hover:underline font-bold flex items-center gap-1"
                >
                  <Save size={14} /> حفظ الكل في البنك
                </button>
              </div>
            </div>
          )}

          {generatedQuestions.map((q, i) => (
            <div key={i} className="card-base p-5 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex gap-2 text-xs">
                  <span className="badge badge-blue">
                    {q.type === 'mcq' ? '📝 اختياري' : q.type === 'tf' ? '✅ صح/خطأ' : '✍️ مقالي'}
                  </span>
                  <span className={`badge ${q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-gold'}`}>
                    {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>📚 {q.subject || 'عام'}</span>
                </div>
                
                <button 
                  onClick={() => openSaveModal(i)}
                  disabled={savingStatus[i] === 'saved' || savingStatus[i] === 'saving'}
                  className={`btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 ${savingStatus[i] === 'saved' ? 'border-green-500/30 text-green-400' : ''}`}
                >
                  {savingStatus[i] === 'saving' ? <Loader2 size={14} className="animate-spin" /> : 
                   savingStatus[i] === 'saved' ? <CheckCircle size={14} /> : <Save size={14} />}
                  {savingStatus[i] === 'saving' ? 'جاري الحفظ...' : 
                   savingStatus[i] === 'saved' ? 'تم الحفظ' : 'حفظ في البنك'}
                </button>
              </div>

              <p className="font-medium text-lg mb-4">{q.text}</p>
              
              {(q.type === 'mcq' || q.type === 'tf') && q.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {q.options.map((opt, oi) => {
                    const isCorrect = opt === (q as any).correctAnswer;
                    return (
                      <div key={oi} className={`p-2 rounded-lg text-sm border ${isCorrect ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-white/5 border-transparent opacity-70'}`}>
                        {opt} {isCorrect && <CheckCircle size={14} className="inline ml-1" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.explanation && (
                <div className="p-3 rounded-lg text-sm flex gap-2 items-start" style={{ background: 'rgba(245,197,24,0.05)', color: 'var(--text-muted)' }}>
                  <span className="text-xl">💡</span>
                  <div>
                    <strong className="block mb-1" style={{ color: 'var(--gold)' }}>
                      {(q.type === 'mcq' || q.type === 'tf') ? 'تفسير الإجابة:' : 'الإجابة النموذجية:'}
                    </strong>
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-base p-6 w-full max-w-md animate-fade-in border border-yellow-500/30">
            <h3 className="text-xl font-bold mb-4 font-cairo">تخصيص الحفظ في البنك</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm mb-1 opacity-70">الصف الدراسي (اختياري)</label>
                <input 
                  type="text" 
                  placeholder="مثال: الصف الأول الثانوي"
                  className="input-base w-full"
                  value={modalData.unit}
                  onChange={e => setModalData({...modalData, unit: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1 opacity-70">المادة (اختياري)</label>
                <input 
                  type="text" 
                  placeholder="مثال: كيمياء"
                  className="input-base w-full"
                  value={modalData.subject}
                  onChange={e => setModalData({...modalData, subject: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm mb-1 opacity-70">المستوى / الصعوبة</label>
                <select 
                  className="input-base w-full"
                  value={modalData.difficulty}
                  onChange={e => setModalData({...modalData, difficulty: e.target.value as any})}
                >
                  <option value="easy">سهل</option>
                  <option value="medium">متوسط</option>
                  <option value="hard">صعب</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-outline px-6">إلغاء</button>
              <button onClick={confirmSaveToQBank} className="btn-gold px-6 flex items-center gap-2">
                <Save size={18} /> تأكيد الحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {CompressionModal && CompressionModal.props && (
        <PDFCompressionModal 
          file={CompressionModal.props.file}
          onClose={CompressionModal.props.onClose}
          onCancel={CompressionModal.props.onCancel}
          onComplete={handleCompressed}
        />
      )}
    </div>
  );
}
