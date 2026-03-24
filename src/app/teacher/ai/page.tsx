'use client';
// src/app/teacher/ai/page.tsx
// نظام الذكاء الاصطناعي المتطور

import { useState, useRef, useCallback } from 'react';
import { useTeacherStore } from '@/lib/store';
import { addToQBank } from '@/lib/db';
import type { QuestionBankItem, Question } from '@/types';
import { showToast } from '@/lib/toast';
import { Bot, Sparkles, Loader2, Save, CheckCircle, Upload, FileText, MessageSquare, BookOpen, Brain, Layers, Download, X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PDFCompressionModal, usePDFCompression } from '@/components/PDFCompressionModal';
import { FileProcessor } from '@/lib/file-processor';

type Mode = 'questions' | 'summary' | 'chat' | 'flashcards' | 'explain';

interface Flashcard { front: string; back: string; hint?: string; }
interface ChatMessage { role: 'user' | 'ai'; content: string; timestamp: number; }

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { id: 'questions', label: 'توليد أسئلة', icon: <Sparkles size={20} />, desc: 'أنشئ أسئلة اختبار متنوعة', color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300' },
  { id: 'summary', label: 'تلخيص ذكي', icon: <BookOpen size={20} />, desc: 'لخص الدروس والمناهج', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-300' },
  { id: 'flashcards', label: 'بطاقات دراسية', icon: <Layers size={20} />, desc: 'أنشئ بطاقات للمراجعة', color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-300' },
  { id: 'explain', label: 'شرح المفاهيم', icon: <Brain size={20} />, desc: 'اشرح أي موضوع بوضوح', color: 'from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-300' },
  { id: 'chat', label: 'محادثة ذكية', icon: <MessageSquare size={20} />, desc: 'تحدث مع المساعد الذكي', color: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-300' },
];

const COMPRESS_THRESHOLD = 10 * 1024 * 1024; // 10MB

export default function AIPage() {
  const router = useRouter();
  const { setTempExamQuestions } = useTeacherStore();
  const [mode, setMode] = useState<Mode>('questions');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  
  // Shared file state
  const [fileData, setFileData] = useState<{ inlineData: string; mimeType: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [compressing, setCompressing] = useState(false);
  
  // Questions mode
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [qType, setQType] = useState<'mcq' | 'essay' | 'tf' | 'mixed'>('mixed');
  const [count, setCount] = useState(5);
  const [generatedQuestions, setGeneratedQuestions] = useState<Partial<QuestionBankItem>[]>([]);
  const [savingStatus, setSavingStatus] = useState<Record<number, 'idle' | 'saving' | 'saved'>>({});
  const [aiProgress, setAiProgress] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTargetIdx, setSaveTargetIdx] = useState<number | null>(null);
  const [modalData, setModalData] = useState({ subject: '', unit: '', difficulty: 'medium' as 'easy' | 'medium' | 'hard' });
  
  // Summary mode
  const [summaryStyle, setSummaryStyle] = useState<'bullet' | 'detailed' | 'simple'>('bullet');
  const [summaryResult, setSummaryResult] = useState<any>(null);
  
  // Flashcards mode
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [fcSubject, setFcSubject] = useState('');
  const [fcCount, setFcCount] = useState(10);
  
  // Explain mode
  const [explainResult, setExplainResult] = useState<any>(null);
  
  // Chat mode
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const { openCompression, CompressionModal } = usePDFCompression({ showSelection: true });

  // ══════════════════════════════════════
  // File handling with auto-compression
  // ══════════════════════════════════════
  const processFile = useCallback(async (file: File) => {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPDF && !isImage) {
      showToast('يدعم النظام فقط ملفات PDF والصور');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setFileData(null);

    // Auto-compress if > 10MB
    if (file.size > COMPRESS_THRESHOLD) {
      if (isPDF) {
        showToast(`📦 الملف كبير (${(file.size / 1024 / 1024).toFixed(1)}MB)، جاري الضغط تلقائياً...`);
        setCompressing(true);
        try {
          const compressed = await FileProcessor.compressPdfFileLocally(file);
          showToast(`✅ تم الضغط: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB`);
          await encodeFile(compressed, compressed.type || 'application/pdf');
        } catch {
          // Try iLovePDF compression modal as fallback
          openCompression(file, async (blob) => {
            await encodeFile(blob, 'application/pdf');
          });
        } finally {
          setCompressing(false);
        }
        return;
      } else if (isImage) {
        showToast(`🖼️ جاري ضغط الصورة...`);
        setCompressing(true);
        try {
          const imageCompression = (await import('browser-image-compression')).default;
          const compressed = await imageCompression(file, { maxSizeMB: 4, maxWidthOrHeight: 2048, useWebWorker: true });
          await encodeFile(compressed, compressed.type || 'image/jpeg');
          showToast(`✅ تم ضغط الصورة`);
        } catch {
          if (file.size > 15 * 1024 * 1024) { showToast('الصورة كبيرة جداً'); return; }
          await encodeFile(file, file.type);
        } finally {
          setCompressing(false);
        }
        return;
      }
    }

    // Small file - encode directly
    await encodeFile(file, file.type);
  }, [openCompression]);

  const encodeFile = async (blob: Blob, mimeType: string) => {
    const reader = new FileReader();
    const base64Data = await new Promise<string>((res, rej) => {
      reader.onload = e => res(e.target?.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    const base64 = base64Data.split(',')[1];

    const payloadMB = (base64.length * 3) / 4 / 1024 / 1024;
    if (payloadMB > 20) {
      showToast('الملف كبير جداً حتى بعد الضغط. يرجى اختيار ملف أصغر.');
      setFileName('');
      return;
    }

    setFileData({ inlineData: base64, mimeType });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ══════════════════════════════════════
  // API calls
  // ══════════════════════════════════════
  const callAI = async (requestMode: Mode, prompt?: string, extraOptions?: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: requestMode, prompt, fileData, options: extraOptions }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic && !fileData) { showToast('أدخل موضوعاً أو أرفق ملفاً'); return; }
    setGeneratedQuestions([]); setSavingStatus({}); setAiProgress(0);
    const progressInterval = setInterval(() => setAiProgress(p => p >= 95 ? 95 : p + (p < 50 ? 5 : 2)), 500);
    try {
      const data = await callAI('questions', topic, { topic, difficulty, type: qType, count });
      setAiProgress(100);
      setGeneratedQuestions(data.questions || []);
    } catch (e: any) { showToast(e.message); setAiProgress(0); }
    finally { clearInterval(progressInterval); }
  };

  const handleSummary = async () => {
    if (!fileData && !topic) { showToast('أرفق ملفاً أو أدخل نصاً للتلخيص'); return; }
    setSummaryResult(null);
    try {
      const data = await callAI('summary', topic, { style: summaryStyle });
      setSummaryResult(data.result);
    } catch (e: any) { showToast(e.message); }
  };

  const handleFlashcards = async () => {
    if (!fileData && !topic) { showToast('أرفق ملفاً أو أدخل موضوعاً'); return; }
    setFlashcards([]); setFlippedCards(new Set());
    try {
      const data = await callAI('flashcards', topic, { subject: fcSubject, count: fcCount });
      setFlashcards(data.flashcards || []);
    } catch (e: any) { showToast(e.message); }
  };

  const handleExplain = async () => {
    if (!topic) { showToast('أدخل الموضوع الذي تريد شرحه'); return; }
    setExplainResult(null);
    try {
      const data = await callAI('explain', topic);
      setExplainResult(data.result);
    } catch (e: any) { showToast(e.message); }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    try {
      const data = await callAI('chat', chatInput);
      const aiMsg: ChatMessage = { role: 'ai', content: data.result?.answer || 'حدث خطأ', timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'ai', content: `❌ ${e.message}`, timestamp: Date.now() }]);
    }
  };

  // ══════════════════════════════════════
  // Question save
  // ══════════════════════════════════════
  const saveSingleQuestion = async (index: number, question: any) => {
    setSavingStatus(prev => ({ ...prev, [index]: 'saving' }));
    try {
      if (question.type === 'mcq' || question.type === 'tf') question.correct = question.options?.indexOf(question.correctAnswer);
      question.usageCount = 0;
      question.subject = modalData.subject || question.subject;
      question.unit = modalData.unit;
      question.difficulty = modalData.difficulty;
      await addToQBank(question);
      setSavingStatus(prev => ({ ...prev, [index]: 'saved' }));
    } catch { showToast('فشل حفظ السؤال'); setSavingStatus(prev => ({ ...prev, [index]: 'idle' })); }
  };

  const confirmSave = async () => {
    setShowSaveModal(false);
    if (saveTargetIdx !== null) {
      await saveSingleQuestion(saveTargetIdx, generatedQuestions[saveTargetIdx]);
    } else {
      let saved = 0;
      for (let i = 0; i < generatedQuestions.length; i++) {
        if (savingStatus[i] !== 'saved') { await saveSingleQuestion(i, generatedQuestions[i]); saved++; }
      }
      if (saved > 0) showToast(`✅ تم حفظ ${saved} أسئلة`);
    }
  };

  const handleCreateExam = () => {
    if (!setTempExamQuestions) { showToast('الميزة قيد التطوير'); return; }
    const formatted: Question[] = generatedQuestions.map((q, i) => ({
      id: `ai-${Date.now()}-${i}`, type: q.type as any, text: q.text || '',
      options: q.options, correct: q.type === 'mcq' || q.type === 'tf' ? q.options?.indexOf((q as any).correctAnswer) : undefined,
      explanation: q.explanation, maxScore: (q as any).points || 1,
    }));
    setTempExamQuestions(formatted);
    router.push('/teacher/exams/create');
  };

  const currentMode = MODES.find(m => m.id === mode)!;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center shadow-lg shadow-gold/20">
          <Bot size={22} className="text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-cairo font-black gold-text">مساعد الذكاء الاصطناعي</h1>
          <p className="text-xs text-gray-500">مدعوم بـ Gemini 2.5 Flash من Google</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`p-4 rounded-2xl border text-right transition-all hover:scale-[1.02] ${mode === m.id ? `bg-gradient-to-br ${m.color}` : 'card-base border-white/5 hover:border-white/15'}`}
          >
            <div className={`mb-2 ${mode === m.id ? '' : 'text-gray-400'}`}>{m.icon}</div>
            <div className="font-bold text-sm">{m.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === LEFT PANEL: File Upload + Settings === */}
        <div className="space-y-4">
          {/* File Upload */}
          <div
            className="card-base p-5 border-2 border-dashed border-white/10 hover:border-gold/30 transition-colors cursor-pointer"
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          >
            <label className="cursor-pointer block">
              <div className="text-center">
                {compressing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-gold animate-spin" />
                    <p className="text-sm text-gold font-bold">جاري ضغط الملف...</p>
                  </div>
                ) : fileData ? (
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={20} className="text-gold flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{fileName}</div>
                        <div className="text-xs text-green-400">✓ جاهز ({(fileSize / 1024 / 1024).toFixed(1)}MB)</div>
                      </div>
                    </div>
                    <button onClick={e => { e.preventDefault(); setFileData(null); setFileName(''); setFileSize(0); }} className="text-red-400 hover:text-red-300 p-1 flex-shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto mb-2 text-gray-500" />
                    <p className="text-sm font-bold text-gray-300">أسقط ملفاً هنا أو انقر للرفع</p>
                    <p className="text-xs text-gray-500 mt-1">PDF أو صورة • يُضغط تلقائياً إذا &gt; 10MB</p>
                  </>
                )}
              </div>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {/* Mode-specific settings */}
          <div className={`card-base p-5 border bg-gradient-to-br ${currentMode.color} space-y-4`}>
            <h2 className="font-bold text-lg flex items-center gap-2">{currentMode.icon} {currentMode.label}</h2>

            {mode === 'questions' && (
              <>
                <div>
                  <label className="block text-xs mb-1 opacity-70">الموضوع أو الدرس</label>
                  <textarea className="input-base w-full h-20 resize-none text-sm" placeholder="مثال: المعادلات التفاضلية..." value={topic} onChange={e => setTopic(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1 opacity-70">الصعوبة</label>
                    <select className="input-base w-full text-sm" value={difficulty} onChange={e => setDifficulty(e.target.value as any)}>
                      <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1 opacity-70">العدد</label>
                    <input type="number" className="input-base w-full text-sm" min={1} max={20} value={count} onChange={e => setCount(+e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1 opacity-70">نوع الأسئلة</label>
                  <select className="input-base w-full text-sm" value={qType} onChange={e => setQType(e.target.value as any)}>
                    <option value="mixed">مختلط</option>
                    <option value="mcq">اختيار متعدد</option>
                    <option value="tf">صح/خطأ</option>
                    <option value="essay">مقالي</option>
                  </select>
                </div>
                <button onClick={handleGenerate} disabled={loading || (!topic && !fileData)} className="btn-gold w-full justify-center py-3 disabled:opacity-50">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> جاري التوليد...</> : '✨ توليد الأسئلة'}
                </button>
              </>
            )}

            {mode === 'summary' && (
              <>
                <div>
                  <label className="block text-xs mb-1 opacity-70">نص إضافي (اختياري)</label>
                  <textarea className="input-base w-full h-20 resize-none text-sm" placeholder="أو اكتب نصاً للتلخيص..." value={topic} onChange={e => setTopic(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1 opacity-70">أسلوب الملخص</label>
                  <select className="input-base w-full text-sm" value={summaryStyle} onChange={e => setSummaryStyle(e.target.value as any)}>
                    <option value="bullet">نقاط مرتبة</option>
                    <option value="detailed">تفصيلي شامل</option>
                    <option value="simple">مبسط (للطلاب)</option>
                  </select>
                </div>
                <button onClick={handleSummary} disabled={loading || (!topic && !fileData)} className="btn-gold w-full justify-center py-3 disabled:opacity-50">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> جاري التلخيص...</> : '📝 تلخيص المحتوى'}
                </button>
              </>
            )}

            {mode === 'flashcards' && (
              <>
                <div>
                  <label className="block text-xs mb-1 opacity-70">موضوع البطاقات</label>
                  <input className="input-base w-full text-sm" placeholder="مثال: القوانين الفيزيائية..." value={topic} onChange={e => setTopic(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1 opacity-70">المادة</label>
                    <input className="input-base w-full text-sm" placeholder="فيزياء..." value={fcSubject} onChange={e => setFcSubject(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 opacity-70">عدد البطاقات</label>
                    <input type="number" className="input-base w-full text-sm" min={5} max={30} value={fcCount} onChange={e => setFcCount(+e.target.value)} />
                  </div>
                </div>
                <button onClick={handleFlashcards} disabled={loading || (!topic && !fileData)} className="btn-gold w-full justify-center py-3 disabled:opacity-50">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</> : '🃏 إنشاء البطاقات'}
                </button>
              </>
            )}

            {mode === 'explain' && (
              <>
                <div>
                  <label className="block text-xs mb-1 opacity-70">الموضوع أو المفهوم</label>
                  <textarea className="input-base w-full h-24 resize-none text-sm" placeholder="مثال: ما هو قانون أوم؟ كيف تعمل الخلية النباتية؟" value={topic} onChange={e => setTopic(e.target.value)} />
                </div>
                <button onClick={handleExplain} disabled={loading || !topic} className="btn-gold w-full justify-center py-3 disabled:opacity-50">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> جاري الشرح...</> : '🎓 شرح المفهوم'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* === RIGHT PANEL: Results === */}
        <div className="lg:col-span-2 space-y-4">

          {/* QUESTIONS RESULTS */}
          {mode === 'questions' && (
            <>
              {loading && (
                <div className="card-base p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
                  <div className="relative mb-6">
                    <Bot size={56} className="text-gold animate-pulse" />
                    <Sparkles size={24} className="text-gold absolute -top-2 -right-2 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">جاري التوليد...</h3>
                  <div className="w-full max-w-md bg-white/5 rounded-full h-3 overflow-hidden border border-white/10">
                    <div className="bg-gradient-to-r from-yellow-600 to-gold h-full transition-all duration-300 relative rounded-full"
                      style={{ width: `${aiProgress}%` }}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                    </div>
                  </div>
                  <p className="mt-3 text-gold font-bold font-mono">{aiProgress}%</p>
                </div>
              )}
              {!loading && generatedQuestions.length === 0 && (
                <div className="card-base p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
                  <Bot size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-gray-400">الأسئلة المُولّدة ستظهر هنا</p>
                  <p className="text-xs opacity-40 mt-2">اختر موضوعاً أو أرفق ملفاً ثم انقر "توليد"</p>
                </div>
              )}
              {generatedQuestions.length > 0 && !loading && (
                <>
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-bold">النتيجة ({generatedQuestions.length} أسئلة)</h3>
                    <div className="flex gap-3">
                      <button onClick={handleCreateExam} className="bg-gold/10 text-gold hover:bg-gold hover:text-black text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all">
                        <Sparkles size={14} /> إنشاء اختبار
                      </button>
                      <button onClick={() => { setSaveTargetIdx(null); setShowSaveModal(true); }} className="text-gold text-xs hover:underline font-bold flex items-center gap-1">
                        <Save size={14} /> حفظ الكل
                      </button>
                    </div>
                  </div>
                  {generatedQuestions.map((q, i) => (
                    <div key={i} className="card-base p-5 animate-fade-in border border-white/5" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div className="flex gap-2 flex-wrap text-xs">
                          <span className="badge badge-blue">{q.type === 'mcq' ? '📝 اختياري' : q.type === 'tf' ? '✅ صح/خطأ' : '✍️ مقالي'}</span>
                          <span className={`badge ${q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-gold'}`}>
                            {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                          </span>
                        </div>
                        <button onClick={() => { setSaveTargetIdx(i); setShowSaveModal(true); }} disabled={savingStatus[i] === 'saved' || savingStatus[i] === 'saving'}
                          className={`btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0 ${savingStatus[i] === 'saved' ? 'border-green-500/30 text-green-400' : ''}`}>
                          {savingStatus[i] === 'saving' ? <Loader2 size={12} className="animate-spin" /> : savingStatus[i] === 'saved' ? <CheckCircle size={12} /> : <Save size={12} />}
                          {savingStatus[i] === 'saving' ? 'يحفظ...' : savingStatus[i] === 'saved' ? 'تم' : 'حفظ'}
                        </button>
                      </div>
                      <p className="font-bold text-base mb-3">{q.text}</p>
                      {(q.type === 'mcq' || q.type === 'tf') && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          {q.options.map((opt, oi) => {
                            const isCorrect = opt === (q as any).correctAnswer;
                            return <div key={oi} className={`p-2 rounded-lg text-sm border ${isCorrect ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-white/5 border-transparent opacity-60'}`}>
                              {opt} {isCorrect && <CheckCircle size={12} className="inline mr-1" />}
                            </div>;
                          })}
                        </div>
                      )}
                      {q.explanation && (
                        <div className="p-3 rounded-lg text-sm flex gap-2 bg-gold/5 border border-gold/10">
                          <span>💡</span>
                          <div><strong className="text-gold block mb-0.5">{(q.type === 'mcq' || q.type === 'tf') ? 'التفسير:' : 'الإجابة:'}</strong>{q.explanation}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* SUMMARY RESULTS */}
          {mode === 'summary' && (
            <>
              {loading && <div className="card-base p-12 text-center flex flex-col items-center gap-4"><Loader2 size={40} className="text-gold animate-spin" /><p className="text-gray-400">جاري تلخيص المحتوى...</p></div>}
              {summaryResult && !loading && (
                <div className="card-base p-6 space-y-5 animate-slide-up">
                  <h2 className="text-xl font-bold gold-text">{summaryResult.title}</h2>
                  {summaryResult.mainPoints?.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-3 text-gray-300">النقاط الأساسية:</h3>
                      <ul className="space-y-2">
                        {summaryResult.mainPoints.map((p: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm"><span className="text-gold mt-0.5">•</span><span>{p}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summaryResult.keyTerms?.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-3 text-gray-300">المفاهيم الأساسية:</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {summaryResult.keyTerms.map((t: any, i: number) => (
                          <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="font-bold text-gold text-sm">{t.term}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{t.definition}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summaryResult.summary && (
                    <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                      <h3 className="font-bold mb-2 text-blue-300">الملخص الختامي:</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">{summaryResult.summary}</p>
                    </div>
                  )}
                  <button onClick={() => window.print()} className="btn-outline text-xs flex items-center gap-1 border-white/10">
                    <Download size={14} /> طباعة الملخص
                  </button>
                </div>
              )}
              {!loading && !summaryResult && (
                <div className="card-base p-12 text-center flex flex-col items-center gap-3 min-h-[350px] justify-center">
                  <BookOpen size={48} className="opacity-20" />
                  <p className="text-gray-400">أرفق ملفاً ثم اضغط "تلخيص"</p>
                </div>
              )}
            </>
          )}

          {/* FLASHCARDS RESULTS */}
          {mode === 'flashcards' && (
            <>
              {loading && <div className="card-base p-12 text-center flex flex-col items-center gap-4"><Loader2 size={40} className="text-gold animate-spin" /><p>جاري إنشاء البطاقات...</p></div>}
              {flashcards.length > 0 && !loading && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-bold">{flashcards.length} بطاقة دراسية</h3>
                    <button onClick={() => setFlippedCards(new Set())} className="text-xs text-gray-400 hover:text-white">إعادة تعيين</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {flashcards.map((card, i) => {
                      const flipped = flippedCards.has(i);
                      return (
                        <div key={i}
                          onClick={() => setFlippedCards(prev => { const n = new Set(prev); flipped ? n.delete(i) : n.add(i); return n; })}
                          className={`card-base p-5 cursor-pointer transition-all hover:scale-[1.02] min-h-[120px] flex flex-col justify-center border ${flipped ? 'border-gold/30 bg-gold/5' : 'border-white/5'}`}
                        >
                          {!flipped ? (
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-2">السؤال (انقر للإجابة)</div>
                              <p className="font-bold">{card.front}</p>
                              {card.hint && <p className="text-xs text-gray-500 mt-2">💡 {card.hint}</p>}
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="text-xs text-gold mb-2">✅ الإجابة</div>
                              <p className="text-green-300 font-bold">{card.back}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!loading && flashcards.length === 0 && (
                <div className="card-base p-12 text-center flex flex-col items-center gap-3 min-h-[350px] justify-center">
                  <Layers size={48} className="opacity-20" />
                  <p className="text-gray-400">أدخل موضوعاً أو أرفق ملفاً لإنشاء البطاقات</p>
                </div>
              )}
            </>
          )}

          {/* EXPLAIN RESULTS */}
          {mode === 'explain' && (
            <>
              {loading && <div className="card-base p-12 text-center flex flex-col items-center gap-4"><Loader2 size={40} className="text-gold animate-spin" /><p>جاري شرح المفهوم...</p></div>}
              {explainResult && !loading && (
                <div className="card-base p-6 space-y-5 animate-slide-up">
                  <h2 className="text-xl font-bold gold-text">{explainResult.title}</h2>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-sm leading-relaxed text-gray-200">{explainResult.explanation}</p>
                  </div>
                  {explainResult.examples?.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-3 text-gray-300">أمثلة:</h3>
                      <ul className="space-y-2">
                        {explainResult.examples.map((ex: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm bg-green-500/5 p-3 rounded-xl border border-green-500/10">
                            <span className="text-green-400">✦</span><span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {explainResult.summary && (
                    <div className="p-3 bg-gold/5 rounded-xl border border-gold/10 text-sm">
                      <strong className="text-gold">الخلاصة: </strong>{explainResult.summary}
                    </div>
                  )}
                </div>
              )}
              {!loading && !explainResult && (
                <div className="card-base p-12 text-center flex flex-col items-center gap-3 min-h-[350px] justify-center">
                  <Brain size={48} className="opacity-20" />
                  <p className="text-gray-400">أدخل الموضوع الذي تريد شرحه</p>
                </div>
              )}
            </>
          )}

          {/* CHAT */}
          {mode === 'chat' && (
            <div className="card-base flex flex-col h-[500px] overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <Bot size={20} className="text-gold" />
                <span className="font-bold text-sm">المساعد الذكي</span>
                {fileData && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20">📎 مع ملف</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-60">
                    <Bot size={40} />
                    <p className="text-sm">ابدأ المحادثة مع المساعد الذكي</p>
                    <p className="text-xs text-gray-500">يمكنك رفع ملف والسؤال عنه</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gold text-black rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-tl-sm">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={e => { e.preventDefault(); handleChat(); }} className="p-3 border-t border-white/5 flex gap-2">
                <input
                  className="input-base flex-1 text-sm"
                  placeholder="اسأل المساعد..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                />
                <button type="submit" disabled={!chatInput.trim() || loading}
                  className="btn-gold w-10 h-10 flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-base p-6 w-full max-w-md animate-scale-in border border-gold/30 space-y-4">
            <h3 className="text-xl font-bold font-cairo">تخصيص الحفظ في البنك</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 opacity-70">الصف الدراسي</label>
                <input type="text" placeholder="مثال: الثاني الثانوي" className="input-base w-full text-sm" value={modalData.unit} onChange={e => setModalData({...modalData, unit: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-70">المادة</label>
                <input type="text" placeholder="مثال: رياضيات" className="input-base w-full text-sm" value={modalData.subject} onChange={e => setModalData({...modalData, subject: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-70">مستوى الصعوبة</label>
                <select className="input-base w-full text-sm" value={modalData.difficulty} onChange={e => setModalData({...modalData, difficulty: e.target.value as any})}>
                  <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSaveModal(false)} className="btn-outline px-6">إلغاء</button>
              <button onClick={confirmSave} className="btn-gold px-6 flex items-center gap-2"><Save size={16} /> حفظ</button>
            </div>
          </div>
        </div>
      )}

      {CompressionModal}
    </div>
  );
}
