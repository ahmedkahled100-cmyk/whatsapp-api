'use client';
// src/app/exam/[id]/page.tsx
// صفحة أداء الاختبار للطالب

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentStore } from '@/lib/store';
import { getExam, getStudentByCode, saveAttempt, getAttemptsByStudent, uploadFileToStorage } from '@/lib/db';
import { shuffleArray, generateId, formatTime, gradeColor, scoreLabel, getViewerUrl } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import imageCompression from 'browser-image-compression';
import { compressPDFWithILovePDF } from '@/lib/ilovepdf-client';

import { Clock, CheckCircle, XCircle, AlertTriangle, User, ArrowLeft, ArrowRight, Send, Upload, FileText, Image as ImageIcon, X, AlertCircle, Eye, Loader2 } from 'lucide-react';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';
import type { Exam, Question, Attempt, EssayAnswer } from '@/types';

type Phase = 'loading' | 'login' | 'intro' | 'taking' | 'results';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const { student, setStudent, answers, setAnswer, essayAnswers, setEssayAnswer, timeLeft, setTimeLeft } = useStudentStore();
  const { openPreview, PreviewModal } = useFilePreview();

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studentCode, setStudentCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState<Partial<Attempt> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [qTimeLeft, setQTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const filePickerOpenRef = useRef(false); // Track when file picker is open

  // Load exam
  useEffect(() => {
    loadExam();
  }, [examId]);

  const loadExam = async () => {
    try {
      const e = await getExam(examId);
      if (!e) { showToast('الاختبار غير موجود'); router.push('/student'); return; }
      if (!e.published) { showToast('هذا الاختبار غير متاح حالياً'); router.push('/student'); return; }

      // Check schedule
      const now = Date.now();
      if (e.startTime && now < new Date(e.startTime).getTime()) {
        showToast(`لم يبدأ الاختبار بعد. يبدأ في: ${new Date(e.startTime).toLocaleString('ar-EG')}`);
        router.push('/student'); return;
      }
      if (e.endTime && now > new Date(e.endTime).getTime()) {
        showToast('انتهى وقت الاختبار'); router.push('/student'); return;
      }

      setExam(e);
      
      // Randomization Logic
      let qs = [...(e.questions || [])];
      if (e.randomPickCount && e.randomPickCount > 0) {
        // Shuffle ALL and pick N
        qs = shuffleArray(qs).slice(0, e.randomPickCount);
      } else if (e.shuffle) {
        // Just shuffle all
        qs = shuffleArray(qs);
      }
      
      setQuestions(qs);

      setPhase(student ? 'intro' : 'login');
    } catch { showToast('حدث خطأ'); }
  };

  // Login
  const handleLogin = async () => {
    if (!studentCode.trim()) { setCodeError('أدخل كودك أولاً'); return; }
    try {
      const s = await getStudentByCode(studentCode);
      if (!s) { setCodeError('❌ الكود غير صحيح'); return; }

      // Check attempts
      if (exam && !exam.allowRetake) {
        const prevAttempts = await getAttemptsByStudent(s.id);
        if (prevAttempts.some(a => a.examId === examId && a.completed)) {
          showToast('لقد أجريت هذا الاختبار مسبقاً ولا يمكن إعادته');
          router.push('/student'); return;
        }
      }

      setStudent(s);
      setPhase('intro');
    } catch { setCodeError('خطأ في الاتصال'); }
  };

  // Start exam
  const startExam = () => {
    setTimeLeft((exam?.duration || 30) * 60);
    setPhase('taking');
    
    // Enter fullscreen if possible
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  };

  // Submit
  const submitExam = useCallback(async () => {
    if (submitting || !exam || !student) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const autoGradedQs = questions.filter(q => q.type === 'mcq' || q.type === 'tf');
    let correct = 0;
    autoGradedQs.forEach(q => {
      if (q.type === 'mcq') {
        if (answers[q.id] === q.correct) correct++;
      } else if (q.type === 'tf') {
        if ((answers[q.id] === 1) === q.isTrue) correct++;
      }
    });

    const mcqScore = autoGradedQs.length > 0 ? Math.round((correct / autoGradedQs.length) * 100) : 0;
    
    // Compile essay answers
    const finalEssayAnswers: EssayAnswer[] = [];
    questions.filter(q => q.type === 'essay').forEach(q => {
      const ans = essayAnswers[q.id];
      if (ans) {
        finalEssayAnswers.push({
          questionId: q.id,
          questionText: q.text,
          text: ans.text || '',
          fileUrls: ans.fileUrls || [],
          maxScore: q.maxScore || 10,
          pending: true,
          gradingNote: q.gradingNote,
        });
      }
    });

    const attempt: Omit<Attempt, 'id'> = {
      examId: exam.id,
      examTitle: exam.title,
      studentId: student.id,
      studentName: student.name,
      studentCode: student.code,
      answers,
      essayAnswers: finalEssayAnswers,
      mcqScore,
      mcqTotal: autoGradedQs.length,
      finalScore: mcqScore,
      passed: mcqScore >= exam.passScore,
      completed: true,
      submittedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      tabSwitches: tabSwitches,
    };

    try {
      const id = await saveAttempt(attempt);
      setResult({ ...attempt, id });
      setPhase('results');
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      } catch (e) {}
    } catch { showToast('فشل إرسال الإجابات'); }
    finally { setSubmitting(false); }
  }, [exam, student, questions, answers, essayAnswers, submitting, tabSwitches]);

  // Anti-cheat & Tab Switches
  useEffect(() => {
    if (phase !== 'taking') return;

    const handleVisibilityChange = () => {
      // Skip if file picker is open - don't count as tab switch
      if (filePickerOpenRef.current) return;
      
      if (document.hidden) {
        setTabSwitches(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            showToast('تم إنهاء الاختبار تلقائياً لتجاوز الحد المسموح من الخروج عن الشاشة.');
            submitExam();
          } else {
            showToast(`تحذير نظام المراقبة ❗: لا تقم بمغادرة صفحة الاختبار أو تبديل النوافذ. (المخالفة ${newCount}/3)`);
          }
          return newCount;
        });
      }
    };

    const handleContext = (e: Event) => e.preventDefault();
    const handleCopy = (e: Event) => e.preventDefault();
    const handlePaste = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [phase, submitExam]);

  // Timer logic (Global & Per Question)
  useEffect(() => {
    if (phase !== 'taking') return;
    
    const q = questions[currentQ];
    let localQTime = q?.timeLimit && q.timeLimit > 0 ? q.timeLimit : null;
    setQTimeLeft(localQTime);

    timerRef.current = setInterval(() => {
      // Global timer
      const currentGlobal = useStudentStore.getState().timeLeft;
      if (currentGlobal <= 1) {
        submitExam();
        setTimeLeft(0);
        return;
      } else {
        setTimeLeft(currentGlobal - 1);
      }

      // Local question timer
      if (localQTime !== null) {
        localQTime -= 1;
        if (localQTime <= 0) {
          if (currentQ < questions.length - 1) {
            setCurrentQ(c => c + 1); // Auto move next
          } else {
            submitExam();
          }
        } else {
          setQTimeLeft(localQTime);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentQ, questions, submitExam, setTimeLeft]);


  // Main render logic continues...


  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-dark">
      <div className="text-center"><div className="text-5xl mb-3 animate-spin duration-1000">⏳</div><p className="text-muted">جاري تحميل الاختبار...</p></div>
    </div>
  );

  if (phase === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark">
      <div className="card-base p-6 sm:p-8 w-full max-w-sm text-center animate-scale-in blur-backdrop relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold to-accent" />
        <div className="text-4xl sm:text-5xl mb-4">🔐</div>
        <h2 className="font-cairo font-black text-lg sm:text-xl mb-1 gold-text">{exam?.title}</h2>
        <p className="text-xs sm:text-sm mb-6 text-muted">أدخل كودك للبدء</p>
        <input type="text" value={studentCode}
          onChange={e => { setStudentCode(e.target.value.toUpperCase()); setCodeError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="كود الطالب..." className="input-base text-center text-lg sm:text-xl font-mono tracking-[0.2em] sm:tracking-[0.3em] mb-2 rtl"
          autoFocus />
        {codeError && <p className="text-sm mb-2 text-red-500 animate-pulse">{codeError}</p>}
        <button onClick={handleLogin} className="btn-gold w-full justify-center py-3.5 mt-4 text-sm sm:text-base">🚀 تأكيد والدخول</button>
      </div>
    </div>
  );

  if (phase === 'intro' && exam) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark">
      <div className="card-base p-6 sm:p-8 w-full max-w-md animate-scale-in blur-backdrop">
        <div className="text-center mb-6">
          <div className="text-4xl sm:text-5xl mb-3 drop-shadow-lg">📋</div>
          <h2 className="font-cairo font-black text-xl sm:text-2xl gold-text mb-1">{exam.title}</h2>
          {exam.subject && <span className="text-[10px] sm:text-xs px-3 py-1 bg-white/5 rounded-full text-muted">{exam.subject}</span>}
        </div>
        <div className="space-y-2.5 sm:space-y-3 mb-8">
          {[
            { label: 'الطالب', value: student?.name, icon: '👤' },
            { label: 'عدد الأسئلة', value: `${questions.length} أسئلة`, icon: '📝' },
            { label: 'مدة الاختبار', value: `${exam.duration} دقيقة`, icon: '⏳' },
            { label: 'درجة النجاح', value: `${exam.passScore}%`, icon: '🎯' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-muted text-xs sm:text-sm flex items-center gap-2">{icon} {label}</span>
              <span className="font-bold text-sm sm:text-base">{value}</span>
            </div>
          ))}
        </div>
        <div className="p-3.5 rounded-xl mb-6 bg-red-500/10 border border-red-500/20 text-[11px] sm:text-xs text-red-300 flex gap-2">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>تنبيه: محاولة الغش أو مغادرة شاشة الامتحان أكثر من 3 مرات ستؤدي إلى إنهاء الاختبار تلقائياً.</span>
        </div>
        <button onClick={startExam} className="btn-gold w-full justify-center py-4 text-base sm:text-lg animate-pulse-glow">
          بدء الاختبار الآن
        </button>
      </div>
    </div>
  );


  if (phase === 'taking') {
    const q = questions[currentQ];
    const timerColor = timeLeft < 60 ? 'text-red-500' : timeLeft < 300 ? 'text-orange-400' : 'text-gold';
    const answeredCount = questions.filter(qu => {
      if (qu.type === 'essay') return essayAnswers[qu.id]?.text || essayAnswers[qu.id]?.fileUrls?.length;
      return answers[qu.id] !== undefined;
    }).length;

    return (
      <div className="min-h-screen flex flex-col bg-dark">
        {/* Navigation & Status Header */}
        <div className="sticky top-0 z-30 px-3 sm:px-4 py-3 flex items-center justify-between gap-3 sm:gap-4 border-b border-white/5 blur-backdrop bg-dark/80 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-2 bg-white/5 border border-white/10 ${timerColor}`}>
              <Clock size={16} className={timeLeft < 60 ? 'animate-pulse' : ''} />
              <div className="font-cairo font-black text-lg sm:text-xl tabular-nums leading-none">
                {formatTime(timeLeft)}
              </div>
            </div>
            {qTimeLeft !== null && (
               <div className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-2 ${qTimeLeft < 10 ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                 <span className="text-[10px] hidden sm:inline">سؤال:</span>
                 <div className="font-cairo font-bold text-sm sm:text-base tabular-nums leading-none">{formatTime(qTimeLeft)}</div>
               </div>
            )}
          </div>
          
          <div className="flex-1 max-w-sm hidden md:block">
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>التقدم</span>
              <span className="font-bold">{answeredCount} / {questions.length}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden bg-white/10">
              <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-accent to-gold"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
          
          <div className="text-left text-[10px] sm:text-xs text-muted flex flex-col items-end">
            <div className="flex items-center gap-1 justify-end truncate max-w-[100px] sm:max-w-none"><User size={12}/> {student?.name}</div>
            {tabSwitches > 0 && <div className="text-red-400 font-bold mt-0.5">مخالفات: {tabSwitches}/3</div>}
          </div>
        </div>

        <div className="flex-1 max-w-3xl mx-auto w-full p-3 sm:p-4 flex flex-col justify-center">
          {/* Progress for Mobile */}
          <div className="md:hidden mb-4">
             <div className="flex justify-between text-[10px] text-muted mb-1 px-1">
                <span>سؤال {currentQ + 1} من {questions.length}</span>
                <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
             </div>
             <div className="h-1 rounded-full overflow-hidden bg-white/10">
                <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-accent to-gold"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
             </div>
          </div>

          {/* Main Question Card */}
          {q && (
            <div className="card-base p-5 sm:p-8 animate-slide-up blur-backdrop border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mx-16 -my-16" />
              
              <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0 shadow-lg bg-gradient-to-br from-accent to-accent2 text-white">
                    {currentQ + 1}
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl leading-relaxed font-medium flex-1 pt-0.5">{q.text}</h3>
                </div>

                {/* Option Rendering based on type */}
                <div className="space-y-2.5 sm:space-y-3 mt-2 sm:mt-4">
                  {/* MCQ */}
                  {q.type === 'mcq' && (q.options || []).map((opt, i) => {
                    const selected = answers[q.id] === i;
                    return (
                      <button key={i} onClick={() => setAnswer(q.id, i)}
                        className={`w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl text-right transition-all duration-200 border-2 ${selected ? 'border-accent bg-accent/10 shadow-[0_0_15px_rgba(124,58,237,0.2)] transform scale-[1.01]' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs sm:text-sm font-bold transition-all ${selected ? 'border-accent bg-accent text-white' : 'border-white/20 bg-transparent text-muted'}`}>
                          {['أ', 'ب', 'ج', 'د'][i]}
                        </div>
                        <span className="flex-1 text-sm sm:text-base font-medium">{opt}</span>
                      </button>
                    );
                  })}

                  {/* True / False */}
                  {q.type === 'tf' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* True */}
                      <button onClick={() => setAnswer(q.id, 1)}
                        className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 border-2 ${answers[q.id] === 1 ? 'border-green-500 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.15)] transform scale-[1.02]' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${answers[q.id] === 1 ? 'border-green-500 bg-green-500' : 'border-white/20'}`}>
                          {answers[q.id] === 1 && <div className="w-3 pos h-3 bg-white rounded-full animate-scale-in" />}
                        </div>
                        <span className={`text-xl font-bold ${answers[q.id] === 1 ? 'text-green-500' : 'text-gray-400'}`}>صح</span>
                      </button>
                      
                      {/* False */}
                      <button onClick={() => setAnswer(q.id, 0)}
                        className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 border-2 ${answers[q.id] === 0 ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)] transform scale-[1.02]' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${answers[q.id] === 0 ? 'border-red-500 bg-red-500' : 'border-white/20'}`}>
                          {answers[q.id] === 0 && <div className="w-3 h-3 bg-white rounded-full animate-scale-in" />}
                        </div>
                        <span className={`text-xl font-bold ${answers[q.id] === 0 ? 'text-red-500' : 'text-gray-400'}`}>خطأ</span>
                      </button>
                    </div>
                  )}

                  {/* Essay */}
                  {q.type === 'essay' && (
                    <EssayUploadArea 
                      q={q} 
                      ans={essayAnswers[q.id]} 
                      setEssayAnswer={setEssayAnswer}
                      filePickerOpenRef={filePickerOpenRef}
                      openPreview={openPreview}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 mt-8">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
              className="btn-outline px-5 py-3 text-sm disabled:opacity-30 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-colors">
              <ArrowRight size={18} /> السابق
            </button>

            {/* Pagination Dots (Hidden on small screens) */}
            <div className="hidden md:flex gap-1.5 flex-wrap justify-center flex-1 max-w-sm">
              {questions.map((qu, i) => {
                const isAns = qu.type === 'essay' ? !!(essayAnswers[qu.id]?.text || essayAnswers[qu.id]?.fileUrls?.length) : answers[qu.id] !== undefined;
                return (
                  <button key={i} onClick={() => setCurrentQ(i)}
                    className="w-8 h-8 rounded-lg text-xs font-bold transition-all relative overflow-hidden flex items-center justify-center shadow-sm"
                    style={{
                      background: i === currentQ ? 'var(--gold)' : isAns ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                      color: i === currentQ ? '#000' : isAns ? 'var(--green)' : 'var(--text-muted)',
                      border: i === currentQ ? '2px solid var(--gold)' : isAns ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {currentQ < questions.length - 1 ? (
              <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                className="btn-accent px-5 py-3 text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-accent/20 transition-transform active:scale-95">
                التالي <ArrowLeft size={18} />
              </button>
            ) : (
              <button onClick={() => {
                if (answeredCount < questions.length) {
                  if (!confirm(`أجبت على ${answeredCount} من ${questions.length} سؤال. هل تريد التسليم الآن؟`)) return;
                }
                submitExam();
              }}
                disabled={submitting}
                className="btn-gold px-6 py-3 text-sm font-bold flex items-center gap-2 disabled:opacity-60 shadow-[0_0_20px_rgba(245,197,24,0.3)] animate-pulse-glow">
                {submitting ? '⏳ جاري...' : <><Send size={18} /> تسليم الاختبار</>}
              </button>
            )}
          </div>
        </div>
        {PreviewModal}
      </div>
    );
  }

  if (phase === 'results' && result && exam) {
    const score = result.finalScore ?? result.mcqScore ?? 0;
    const passed = result.passed;
    const isEssayPresent = questions.some(q => q.type === 'essay');

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dark">
        <div className="card-base p-6 sm:p-10 w-full max-w-md text-center animate-scale-in blur-backdrop shadow-2xl relative overflow-hidden">
          {passed && <div className="absolute top-0 inset-0 pointer-events-none bg-[url('https://cdn.pixabay.com/photo/2016/09/16/09/20/confetti-1673516_1280.png')] bg-cover opacity-10 mix-blend-screen" />}
          
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center mx-auto mb-6 relative z-10"
            style={{
              border: `6px solid ${isEssayPresent ? 'var(--accent)' : gradeColor(score, exam.passScore)}`,
              background: `rgba(${isEssayPresent ? '124,58,237' : (passed ? '16,185,129' : '239,68,68')},0.1)`,
              boxShadow: `0 0 50px rgba(${isEssayPresent ? '124,58,237' : (passed ? '16,185,129' : '239,68,68')},0.3)`,
            }}>
            <span className="font-cairo font-black text-2xl sm:text-3xl" style={{ color: isEssayPresent ? 'var(--accent)' : gradeColor(score, exam.passScore) }}>
              {isEssayPresent ? 'قيد التصحيح' : `${score}%`}
            </span>
            <span className="text-[10px] sm:text-xs mt-1 sm:mt-2 text-muted font-bold">{isEssayPresent ? 'بانتظار المقالي' : scoreLabel(score)}</span>
          </div>

          <div className="text-4xl sm:text-5xl mb-3">{isEssayPresent ? '📝' : (passed ? '🏆' : '😔')}</div>
          <h2 className="font-cairo font-black text-2xl sm:text-3xl mb-2" style={{ color: isEssayPresent ? 'var(--accent)' : (passed ? 'var(--green)' : 'var(--red)') }}>
            {isEssayPresent ? 'تم تسليم الإجابات' : (passed ? 'مبروك! ناجح' : 'للأسف! راسب')}
          </h2>
          <p className="text-xs sm:text-sm mb-6 text-muted">{isEssayPresent ? 'سيتم إشعارك بالنتيجة النهائية فور التصحيح' : `درجة النجاح: ${exam.passScore}%`}</p>
          
          {isEssayPresent && (
             <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-300 p-3 rounded-xl text-[11px] sm:text-sm flex items-center gap-2 justify-center">
                <AlertCircle size={16} className="flex-shrink-0" /> 
                <span>هذه الدرجة مبدئية، بانتظار تصحيح الأسئلة المقالية.</span>
             </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
               <div className="text-xl sm:text-2xl font-cairo font-black text-gold">{result.mcqTotal}</div> {/* Changed gold-text to text-gold for better contrast with black background */}
               <div className="text-[10px] text-muted mt-1 leading-tight">الأسئلة المصححة تلقائياً</div>
            </div>
            {isEssayPresent && (
              <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
                 <div className="text-xl sm:text-2xl font-cairo font-black text-accent">{result.essayAnswers?.length || 0}</div>
                 <div className="text-[10px] text-muted mt-1 leading-tight">أسئلة مقالية للمراجعة</div>
              </div>
            )}
          </div>

          <button onClick={() => router.push('/student')} className="btn-gold w-full justify-center py-3.5 sm:py-4 text-base sm:text-lg font-bold shadow-lg">
             العودة للرئيسية
          </button>
        </div>
        {PreviewModal}
      </div>
    );

  }

  return null;
}
// --- Moved components outside of ExamPage to prevent re-creation and focus loss ---

interface EssayUploadAreaProps {
  q: Question;
  ans: any;
  setEssayAnswer: (id: string, data: { text?: string; fileUrls?: string[] }) => void;
  filePickerOpenRef: React.MutableRefObject<boolean>;
  openPreview: (url: string, title: string) => void;
}

const EssayUploadArea = ({ q, ans, setEssayAnswer, filePickerOpenRef, openPreview }: EssayUploadAreaProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState(''); // Added statusMsg state
  
  const data = ans || { text: '', fileUrls: [] };
  const { text = '', fileUrls = [] } = data;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    setProgress(0);
    setStatusMsg('جاري تحضير الملفات...'); // Initial status message
    filePickerOpenRef.current = false;
    
    try {
      const newUrls = [...fileUrls];
      for (let i = 0; i < e.target.files.length; i++) {
        let file = e.target.files[i];
        
        // 1. Automatic Image Compression
        if (file.type.startsWith('image/')) {
          try {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true
            };
            const compressedFile = await imageCompression(file, options);
            if (compressedFile.size < file.size) {
              file = new File([compressedFile], file.name, { type: file.type });
            }
          } catch (err) {
            console.warn('Image compression failed', err);
          }
        }

        // 2. iLovePDF Cloud Compression for PDFs > 10MB
        if (file.type === 'application/pdf' && file.size > 10 * 1024 * 1024) {
          try {
            setStatusMsg('جاري ضغط ملف PDF (خدمة خارجية)...');
            const { blob } = await compressPDFWithILovePDF(file, (p) => {
              setProgress(p.progress);
              setStatusMsg(p.message);
            });
            file = new File([blob], file.name, { type: 'application/pdf' });
          } catch (err: any) {
            console.error('iLovePDF Error:', err);
            showToast('تنبيه: فشل الضغط الفائق لملف PDF، سيتم الرفع بالحجم الأصلي إذا كان أقل من 20 ميجا.');
            if (file.size > 20 * 1024 * 1024) {
              throw new Error('الملف كبير جداً وفشل الضغط. حاول تصغيره أولاً.');
            }
          }
        }

        // 3. Final Size Check (Cloudinary limit check)
        if (file.size > 25 * 1024 * 1024) { // Changed limit to 25MB
          showToast(`الملف ${file.name} كبير جداً (أقصى حجم 25 ميجابايت). حاول ضغطه أكثر.`);
          continue;
        }

        const path = `exam-essays/${Date.now()}_${file.name}`;
        const url = await uploadFileToStorage(file, path, (p) => setProgress(p));
        newUrls.push(url);
      }
      setEssayAnswer(q.id, { text, fileUrls: newUrls });
      showToast('تم رفع الملفات بنجاح');
    } catch (err: any) {
      showToast(err.message || 'فشل رفع الملف. جرب مرة أخرى.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (e.target) e.target.value = '';
    }
  };


  const handleFileInputClick = () => {
    filePickerOpenRef.current = true;
    const onFocus = () => {
      setTimeout(() => {
        filePickerOpenRef.current = false;
      }, 1000);
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);
  };

  const removeFile = (idx: number) => {
    const fresh = [...fileUrls];
    fresh.splice(idx, 1);
    setEssayAnswer(q.id, { text, fileUrls: fresh });
  };

  const acceptTypes = [];
  if (q.allowImage) acceptTypes.push('image/*');
  if (q.allowPdf) acceptTypes.push('.pdf');
  if (q.allowWord) acceptTypes.push('.doc,.docx');

  return (
    <div className="space-y-4 pt-4 border-t border-white/10 mt-4">
      <textarea
        value={text || ''}
        onChange={(e) => setEssayAnswer(q.id, { text: e.target.value, fileUrls })}
        placeholder="اكتب إجابتك هنا..."
        className="w-full input-base min-h-[120px] resize-y"
      />
      {acceptTypes.length > 0 && (
        <div className="space-y-3">
          <label
            className={`btn-outline px-4 py-3 cursor-pointer w-full text-center flex justify-center items-center gap-2 border-dashed border-2 hover:bg-white/5 transition-all relative overflow-hidden ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
            onClick={handleFileInputClick}
          >
            {uploading ? (
              <div className="flex items-center gap-2 z-10">
                <Clock size={18} className="animate-spin" />
                <span>جاري الرفع... {progress}%</span>
              </div>
            ) : (
              <>
                <Upload size={18} />
                <span>إرفاق صور أو ملفات</span>
              </>
            )}
            
            {/* Background Progress Bar */}
            {uploading && (
              <div 
                className="absolute inset-x-0 bottom-0 bg-gold/20 transition-all duration-300 h-1"
                style={{ width: `${progress}%` }}
              />
            )}

            <input
              type="file"
              multiple
              accept={acceptTypes.join(',')}
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <div className="flex flex-col items-center gap-1">
            {statusMsg && <p className="text-[10px] text-gold animate-pulse font-bold">{statusMsg}</p>}
            <p className="text-[10px] text-center opacity-60">
              الحد الأقصى للملف الواحد: 25 ميجا | يتم ضغط الصور والـ PDF تلقائياً
            </p>
          </div>
        </div>
      )}

      {fileUrls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {fileUrls.map((url: string, i: number) => {
            const isImg = url.match(/\.(jpg|jpeg|png|webp|gif)$|cloudinary.*\/image\//i);
            return (
              <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-xl animate-scale-in group">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImg ? (
                    <img src={url} alt="مرفق" className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={20} className="text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button 
                    onClick={() => openPreview(url, `مرفق ${i + 1}`)}
                    className="text-xs font-bold truncate block w-full text-right hover:text-gold transition-colors">
                    معاينة المرفق {i + 1}
                  </button>
                  <div className="text-[10px] opacity-40">ملف مرفوع</div>
                </div>
                <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

