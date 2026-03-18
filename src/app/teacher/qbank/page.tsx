'use client';
// src/app/teacher/qbank/page.tsx

import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getQBank, addToQBank, deleteFromQBank, uploadFileToStorage } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { QuestionBankItem } from '@/types';
import { Database, PlusCircle, Search, Trash2, Filter, Image as ImageIcon, FileText, Upload, X } from 'lucide-react';

import { useRouter } from 'next/navigation';

export default function QBankPage() {
  const router = useRouter();
  const { setTempExamQuestions } = useTeacherStore();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'essay' | 'tf'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  
  // Advanced filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterUnit, setFilterUnit] = useState('');

  // Selection
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  
  // Quick Exam
  const [showQuickExamModal, setShowQuickExamModal] = useState(false);
  const [quickExamCount, setQuickExamCount] = useState(5);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState<any>({
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: undefined,
    difficulty: 'medium',
    subject: '',
    unit: '',
    points: 1,
    imageUrl: '',
    pdfUrl: ''
  });

  const [uploadingMedia, setUploadingMedia] = useState<'image' | 'pdf' | null>(null);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await getQBank();
      setQuestions(data);
    } catch (error) {
      console.error("Error loading question bank:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleAddQuestion = async () => {
    if (!newQuestion.text) {
      showToast('الرجاء كتابة نص السؤال');
      return;
    }

    try {
      const q: any = {
        ...newQuestion,
        createdAt: new Date().toISOString(),
        usageCount: 0
      };

      // Ensure correctAnswer is a string referencing the option name and correct is the index
      if (q.type === 'mcq' || q.type === 'tf') {
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
          showToast('الرجاء اختيار الإجابة الصحيحة');
          return;
        }
        q.correct = q.options.indexOf(q.correctAnswer);
      }

      await addToQBank(q as any); // using any for now since strict type mapping depends on options logic
      showToast('تم إضافة السؤال بنجاح');
      setShowAddForm(false);
      setNewQuestion({ type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: undefined, difficulty: 'medium', subject: '', unit: '', points: 1 });
      loadQuestions();
    } catch (error) {
      showToast('حدث خطأ أثناء حفظ السؤال');
      console.error(error);
    }
  };

  const handleMediaUpload = async (file: File, type: 'image' | 'pdf') => {
    setUploadingMedia(type);
    try {
      const path = `qbank/media/${Date.now()}_${file.name}`;
      const url = await uploadFileToStorage(file, path);
      setNewQuestion({ ...newQuestion, [type === 'image' ? 'imageUrl' : 'pdfUrl']: url });
      showToast('✅ تم رفع الملف');
    } catch (err: any) {
      showToast('❌ فشل الرفع');
    } finally {
      setUploadingMedia(null);
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    try {
      await deleteFromQBank(id);
      setQuestions(q => q.filter(item => item.id !== id));
      setSelectedQuestions(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      showToast('حدث خطأ أثناء الحذف');
    }
  };

  const filtered = questions.filter(q => {
    const matchSearch = q.text.toLowerCase().includes(search.toLowerCase()) || 
                       (q.subject || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || q.type === filterType;
    const matchDiff = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    const matchSubject = !filterSubject || (q.subject && q.subject.includes(filterSubject));
    const matchUnit = !filterUnit || (q.unit && q.unit.includes(filterUnit));
    
    return matchSearch && matchType && matchDiff && matchSubject && matchUnit;
  });

  const toggleSelection = (id: string) => {
    setSelectedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateExamFromSelection = () => {
    const selected = questions.filter(q => selectedQuestions.has(q.id));
    createExamFromQuestions(selected);
  };

  const handleQuickExam = () => {
    if (filtered.length === 0) {
      showToast("لا توجد أسئلة مطابقة للفلترة الحالية");
      return;
    }
    
    // Pick random N questions from filtered
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(quickExamCount, filtered.length));
    
    createExamFromQuestions(selected);
    setShowQuickExamModal(false);
  };

  const createExamFromQuestions = (selected: any[]) => {
    if (setTempExamQuestions) {
      // Map to standard Question format
      const formatted = selected.map((q, i) => ({
        id: q.id || `qbank-${Date.now()}-${i}`,
        type: q.type as any,
        text: q.text,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation || '',
        maxScore: (q as any).points || 1,
        imageUrl: q.imageUrl || '',
        pdfUrl: q.pdfUrl || '',
      }));
      setTempExamQuestions(formatted as import('@/types').Question[]);
      router.push('/teacher/exams/create');
    } else {
      showToast("الميزة قيد التطوير.");
    }
  };

  // Extract unique subjects and units for filter dropdowns
  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject).filter(Boolean)));
  const uniqueUnits = Array.from(new Set(questions.map(q => q.unit).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Database size={28} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">بنك الأسئلة الشامل</h1>
        </div>
        <div className="flex gap-3">
          {selectedQuestions.size > 0 && (
            <button onClick={handleCreateExamFromSelection} className="btn-accent flex items-center gap-2 px-4 animate-fade-in">
              إنشاء اختبار ({selectedQuestions.size})
            </button>
          )}
          <button onClick={() => setShowQuickExamModal(true)} className="btn-accent flex items-center gap-2 px-4">
               <PlusCircle size={18} /> اختبار سريع عشوائي
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-gold flex items-center gap-2">
            {showAddForm ? 'إلغاء' : <><PlusCircle size={18} /> إضافة سؤال</>}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card-base p-6 animate-fade-in border border-yellow-500/30">
          <h2 className="font-bold text-lg mb-4">إضافة سؤال جديد للبنك</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1 opacity-70">نوع السؤال</label>
              <select 
                className="input-base w-full"
                value={newQuestion.type}
                onChange={e => setNewQuestion({...newQuestion, type: e.target.value as any})}
              >
                <option value="mcq">اختيار من متعدد</option>
                <option value="essay">مقالى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">المادة / التصنيف</label>
              <input 
                type="text" 
                className="input-base w-full" 
                placeholder="مثال: لغة عربية، فيزياء..."
                value={newQuestion.subject || ''}
                onChange={e => setNewQuestion({...newQuestion, subject: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">مستوى الصعوبة</label>
              <select 
                className="input-base w-full"
                value={newQuestion.difficulty}
                onChange={e => setNewQuestion({...newQuestion, difficulty: e.target.value as any})}
              >
                <option value="easy">سهل 🟢</option>
                <option value="medium">متوسط 🟡</option>
                <option value="hard">صعب 🔴</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">الدرجة المقترحة</label>
              <input 
                type="number" 
                className="input-base w-full" 
                min="1"
                value={(newQuestion as any).points || 1}
                onChange={e => setNewQuestion({...newQuestion, points: Number(e.target.value)} as any)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1 opacity-70">نص السؤال</label>
            <textarea 
              className="input-base w-full resize-none h-24" 
              value={newQuestion.text}
              onChange={e => setNewQuestion({...newQuestion, text: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gold uppercase">صورة السؤال</label>
              {newQuestion.imageUrl ? (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-gold/30 bg-black/20">
                  <img src={newQuestion.imageUrl} alt="Q" className="w-full h-full object-contain" />
                  <button onClick={() => setNewQuestion({...newQuestion, imageUrl: ''})} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-lg">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-6 cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-all h-32">
                  <ImageIcon size={24} className="text-muted mb-2" />
                  <span className="text-xs font-bold">رفع صورة</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'image')} />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-blue-400 uppercase">ملف PDF للسؤال</label>
              {newQuestion.pdfUrl ? (
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl h-32">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <FileText size={24} className="text-blue-400" />
                    <span className="text-[10px] font-bold truncate max-w-full italic">ملف مرفق جاهز</span>
                  </div>
                  <button onClick={() => setNewQuestion({...newQuestion, pdfUrl: ''})} className="text-red-400 hover:text-red-300 ml-2">
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-6 cursor-pointer hover:border-blue-400/40 hover:bg-blue-400/5 transition-all h-32">
                  <Upload size={24} className="text-muted mb-2" />
                  <span className="text-xs font-bold">رفع PDF</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'pdf')} />
                </label>
              )}
            </div>
          </div>

          {newQuestion.type === 'mcq' && (
            <div className="space-y-3 mb-6 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <label className="block text-sm opacity-70 mb-2">الخيارات (حدد الإجابة الصحيحة)</label>
              {newQuestion.options?.map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    name="correct_answer"
                    checked={(newQuestion as any).correctAnswer === opt && opt !== ''}
                    onChange={() => setNewQuestion({...newQuestion, correctAnswer: opt} as any)}
                    className="w-4 h-4 text-gold focus:ring-gold"
                  />
                  <input 
                    type="text"
                    className="input-base flex-1"
                    placeholder={`الخيار ${i + 1}`}
                    value={opt}
                    onChange={e => {
                      const newOpts = [...(newQuestion.options || [])];
                      newOpts[i] = e.target.value;
                      // Update correct answer if this option was previously selected as correct
                      let correct = (newQuestion as any).correctAnswer;
                      if (correct === opt) correct = e.target.value;
                      setNewQuestion({...newQuestion, options: newOpts, correctAnswer: correct} as any);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAddForm(false)} className="btn-outline px-6">إلغاء</button>
            <button onClick={handleAddQuestion} className="btn-gold px-6">حفظ في البنك</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card-base p-4 flex flex-wrap gap-3 items-center">
        <Filter size={18} className="text-gray-400" />
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
          <input
            type="text"
            placeholder="ابحث في الأسئلة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-base pr-11 text-sm w-full"
          />
        </div>
        
        <select 
          className="input-base text-sm py-2"
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
        >
          <option value="">كل المواد</option>
          {uniqueSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>

        <select 
          className="input-base text-sm py-2"
          value={filterUnit}
          onChange={e => setFilterUnit(e.target.value)}
        >
          <option value="">كل الصفوف</option>
          {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
        </select>

        <select 
          className="input-base text-sm py-2"
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
        >
          <option value="all">كل الأنواع</option>
          <option value="mcq">اختياري</option>
          <option value="tf">صح/خطأ</option>
          <option value="essay">مقالي</option>
        </select>
        <select 
          className="input-base text-sm py-2"
          value={filterDifficulty}
          onChange={e => setFilterDifficulty(e.target.value as any)}
        >
          <option value="all">كل المستويات</option>
          <option value="easy">سهل 🟢</option>
          <option value="medium">متوسط 🟡</option>
          <option value="hard">صعب 🔴</option>
        </select>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 opacity-50">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Database size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-gray-400">لا توجد أسئلة مطابقة للبحث أو البنك فارغ.</p>
          </div>
        ) : (
          filtered.map((q, i) => (
            <div 
              key={q.id} 
              className={`card-base p-4 border transition-all cursor-pointer ${selectedQuestions.has(q.id) ? 'border-gold bg-gold/5' : 'border-transparent hover:border-white/10'}`}
              onClick={() => toggleSelection(q.id)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2 text-xs">
                    <span className="badge badge-blue">{q.type === 'mcq' ? '📝 اختياري' : q.type === 'tf' ? '✅ صح/خطأ' : '✍️ مقالي'}</span>
                    <span className={`badge ${q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-gold'}`}>
                      {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                    </span>
                    {q.unit && <span className="badge" style={{ background: 'rgba(255,165,0,0.1)', color: 'orange' }}>🏫 {q.unit}</span>}
                    {q.subject && <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>📚 {q.subject}</span>}
                    <span className="opacity-50 mt-1">استُخدم {q.usageCount || 0} مرة</span>
                  </div>
                  <p className="font-medium text-sm md:text-base leading-relaxed">{q.text}</p>
                </div>
                <div className="flex flex-col gap-2 items-center">
                   <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-gold"
                      checked={selectedQuestions.has(q.id)}
                      onChange={() => {}} // Controlled via parent onClick
                      onClick={e => e.stopPropagation()} 
                   />
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }} 
                     className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors mt-2"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Exam Modal */}
      {showQuickExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-base p-6 w-full max-w-sm animate-scale-in border border-gold/30">
            <h3 className="text-xl font-bold mb-4 font-cairo">إنشاء اختبار سريع</h3>
            <p className="text-sm text-gray-400 mb-4">
               سيتم اختيار أسئلة عشوائية من النتائج المفلترة حالياً ({filtered.length} سؤال متاح).
            </p>
            
            <div className="mb-6">
              <label className="block text-sm mb-2 opacity-70">عدد الأسئلة المطلوبة</label>
              <input 
                type="number" 
                className="input-base w-full text-center text-lg font-bold" 
                min="1" 
                max={filtered.length}
                value={quickExamCount}
                onChange={e => setQuickExamCount(Number(e.target.value))}
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowQuickExamModal(false)} 
                className="btn-outline flex-1"
              >
                إلغاء
              </button>
              <button 
                onClick={handleQuickExam} 
                className="btn-gold flex-1"
                disabled={filtered.length === 0}
              >
                إنشاء الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
