'use client';
// src/app/teacher/exams/create/page.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { saveExam, uploadFileToStorage } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { generateId } from '@/lib/utils';
import type { Question, Exam } from '@/types';
import { PlusCircle, Trash2, Save, GripVertical, ChevronDown, ChevronUp, Image as ImageIcon, FileText, Upload, X, Loader2 } from 'lucide-react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';

import { useEffect } from 'react';

type QForm = Question & { expanded?: boolean };

export default function CreateExamPage() {
  const router = useRouter();
  const { user, groups, tempExamQuestions, setTempExamQuestions } = useTeacherStore();
  const [saving, setSaving] = useState(false);

  // Exam settings
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(30);
  const [passScore, setPassScore] = useState(50);
  const [targetGroup, setTargetGroup] = useState('');
  const [published, setPublished] = useState(true);
  const [shuffle, setShuffle] = useState(true);
  const [allowRetake, setAllowRetake] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [scheduleType, setScheduleType] = useState<'open' | 'scheduled'>('open');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [desc, setDesc] = useState('');
  const [randomPickCount, setRandomPickCount] = useState<number>(0);
  const [examImageUrl, setExamImageUrl] = useState('');
  const [examPdfUrl, setExamPdfUrl] = useState('');
  const [uploadingExamMedia, setUploadingExamMedia] = useState<'image' | 'pdf' | null>(null);

  // Questions
  const [questions, setQuestions] = useState<QForm[]>([]);

  // Load temp questions if any
  useEffect(() => {
    if (tempExamQuestions && tempExamQuestions.length > 0) {
      setQuestions(tempExamQuestions.map((q) => ({ ...q, expanded: true })));
      // Clear them from store after loading so they don't persist on subsequent visits
      setTempExamQuestions(null);
    }
  }, [tempExamQuestions, setTempExamQuestions]);

  const addMCQ = () => {
    setQuestions(prev => [...prev, {
      id: generateId('q'),
      type: 'mcq',
      text: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: '',
      timeLimit: 0,
      expanded: true,
    }]);
  };

  const addTF = () => {
    setQuestions(prev => [...prev, {
      id: generateId('q'),
      type: 'tf',
      text: '',
      isTrue: true,
      explanation: '',
      timeLimit: 0,
      expanded: true,
    }]);
  };

  const addEssay = () => {
    setQuestions(prev => [...prev, {
      id: generateId('q'),
      type: 'essay',
      text: '',
      maxScore: 10,
      allowImage: true,
      allowPdf: true,
      allowWord: true,
      timeLimit: 0,
      gradingNote: '',
      expanded: true,
    }]);
  };

  const removeQ = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id));

  const updateQ = (id: string, updates: Partial<QForm>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

  const updateOption = (qId: string, idx: number, value: string) =>
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const opts = [...(q.options || [])];
      opts[idx] = value;
      return { ...q, options: opts };
    }));

  const handleSave = async () => {
    if (!title.trim()) { showToast('❗ أدخل عنوان الاختبار'); return; }
    if (questions.length === 0) { showToast('❗ أضف سؤالاً على الأقل'); return; }
    const validQs = questions.filter(q => q.text.trim());
    if (validQs.length === 0) { showToast('❗ أدخل نص السؤال'); return; }

    setSaving(true);
    try {
      const exam: Omit<Exam, 'id'> = {
        title, subject, desc, duration, passScore, teacherId: user?.id || '',
        questions: validQs.map(({ expanded, ...q }) => q),
        shuffle, randomPickCount: randomPickCount > 0 ? randomPickCount : undefined, 
        allowRetake, allowResume: true, showAnswers, published,
        startTime: scheduleType === 'scheduled' ? startTime : null,
        endTime: scheduleType === 'scheduled' ? endTime : null,
        createdAt: new Date().toISOString(),
        imageUrl: examImageUrl || undefined,
        pdfUrl: examPdfUrl || undefined,
      };
      if (targetGroup) exam.targetGroup = targetGroup;

      const cleanExam = JSON.parse(JSON.stringify(exam));
      await saveExam(cleanExam);
      router.push('/teacher/exams');
    } catch (e) {
      showToast('فشل الحفظ - تحقق من الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (file: File, type: 'exam-image' | 'exam-pdf' | { qId: string, type: 'image' | 'pdf' }) => {
    try {
      const isExam = typeof type === 'string';
      const qId = !isExam ? type.qId : '';
      const mediaType = isExam ? (type === 'exam-image' ? 'image' : 'pdf') : type.type;

      if (isExam) setUploadingExamMedia(mediaType as any);
      
      const path = isExam ? `exams/media/${Date.now()}_${file.name}` : `exams/questions/${qId}/${file.name}`;
      const url = await uploadFileToStorage(file, path);
      
      if (isExam) {
        if (mediaType === 'image') setExamImageUrl(url);
        else setExamPdfUrl(url);
      } else {
        updateQ(qId, { [mediaType === 'image' ? 'imageUrl' : 'pdfUrl']: url });
      }
      showToast('✅ تم رفع الملف بنجاح');
    } catch (err: any) {
      showToast('❌ فشل الرفع: ' + err.message);
    } finally {
      setUploadingExamMedia(null);
    }
  };

  const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-cairo font-black gold-text">➕ اختبار جديد</h1>
        <button onClick={handleSave} disabled={saving} className="btn-gold disabled:opacity-60">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الاختبار'}
        </button>
      </div>

      {/* Settings Card */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>⚙️ إعدادات الاختبار</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>عنوان الاختبار *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="مثال: اختبار الفصل الأول - الرياضيات" className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>المادة الدراسية</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="رياضيات، علوم، لغة عربية..." className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>⏱ الوقت المسموح (دقيقة)</label>
            <input type="number" value={duration} min={1} max={240}
              onChange={e => setDuration(+e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>📊 درجة النجاح (%)</label>
            <input type="number" value={passScore} min={1} max={100}
              onChange={e => setPassScore(+e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>🏫 تخصيص لفصل (اختياري)</label>
            <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="input-base">
              <option value="">— جميع الطلاب —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>📅 توقيت الاختبار</label>
            <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} className="input-base">
              <option value="open">مفتوح - بدون توقيت</option>
              <option value="scheduled">محدد - وقت بداية ونهاية</option>
            </select>
          </div>
          {scheduleType === 'scheduled' && (
            <>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>🕐 وقت البداية</label>
                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>🕕 وقت النهاية</label>
                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="input-base" />
              </div>
            </>
          )}
          {/* Toggles */}
          {[
            { label: '🔀 ترتيب عشوائي للأسئلة', value: shuffle, set: setShuffle },
            { label: '🔁 السماح بإعادة الاختبار', value: allowRetake, set: setAllowRetake },
            { label: '👁 إظهار الإجابات بعد الانتهاء', value: showAnswers, set: setShowAnswers },
            { label: '✅ نشر الاختبار الآن', value: published, set: setPublished },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm">{label}</span>
              <button onClick={() => set(!value)}
                className="w-10 h-5 rounded-full transition-all relative"
                style={{ background: value ? 'var(--green)' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ right: value ? '2px' : 'auto', left: value ? 'auto' : '2px' }} />
              </button>
            </div>
          ))}
          <div className="sm:col-span-2 p-3 rounded-xl"
            style={{ background: 'rgba(255,197,24,0.05)', border: '1px solid rgba(245,197,24,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gold">🎲 عدد الأسئلة العشوائية لكل طالب</span>
              <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-md">ميزة متقدمة</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2">
              إذا تم تحديد رقم (مثلاً 10)، سيقوم النظام باختيار 10 أسئلة عشوائية من إجمالي الأسئلة المضافة ({questions.length}) لكل طالب عند دخوله الامتحان.
              (اتركه 0 أو فارغ لعرض جميع الأسئلة).
            </p>
            <input 
              type="number" 
              min={0} 
              max={questions.length}
              value={randomPickCount || ''} 
              onChange={e => setRandomPickCount(+e.target.value)}
              className="input-base text-sm py-2"
              placeholder="مثال: 10"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>وصف الاختبار (اختياري)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="تعليمات أو وصف للطلاب..." rows={2} className="input-base resize-none" />
          </div>

          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gold uppercase tracking-wider">صورة الغلاف / توضيحية للاختبار</label>
              <div className="flex items-center gap-3">
                {examImageUrl ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gold/30 flex-shrink-0">
                    <img src={examImageUrl} alt="Exam" className="w-full h-full object-cover" />
                    <button onClick={() => setExamImageUrl('')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-lg">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 max-w-[120px] h-20">
                    <GlobalFileUpload 
                      accept="image/*"
                      variant="compact"
                      onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'exam-image')}
                      isUploading={uploadingExamMedia === 'image'}
                      label={<span className="text-[10px] font-bold">رفع صورة</span>}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider">ملف PDF مرفق (مرجع)</label>
              <div className="flex items-center gap-3">
                {examPdfUrl ? (
                  <div className="flex-1 flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={16} className="text-blue-400" />
                      <span className="text-xs truncate font-bold">ملف مرفق</span>
                    </div>
                    <button onClick={() => setExamPdfUrl('')} className="text-red-400 hover:text-red-300">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 max-w-[120px] h-20">
                    <GlobalFileUpload 
                      accept=".pdf"
                      variant="compact"
                      onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'exam-pdf')}
                      isUploading={uploadingExamMedia === 'pdf'}
                      label={<span className="text-[10px] font-bold">رفع PDF</span>}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cairo font-bold" style={{ color: 'var(--gold)' }}>❓ الأسئلة ({questions.length})</h2>
          <div className="flex gap-2">
            <button onClick={addMCQ} className="btn-accent text-sm py-2 px-3"><PlusCircle size={14} /> اختياري</button>
            <button onClick={addTF} className="btn-accent text-sm py-2 px-3 bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700 text-white"><PlusCircle size={14} /> صح/خطأ</button>
            <button onClick={addEssay} className="text-sm py-2 px-3 rounded-xl font-bold inline-flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff' }}>
              <PlusCircle size={14} /> مقالي
            </button>
          </div>
        </div>

        {questions.length === 0 && (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-2">💭</div>
            <p className="text-sm">اضغط «سؤال اختياري» أو «سؤال مقالي» لإضافة أسئلة</p>
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl overflow-hidden transition-all"
              style={{ border: `1px solid ${q.type === 'essay' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.02)' }}>
              {/* Question header */}
              <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: q.type === 'essay' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
                  {idx + 1}
                </div>
                <span className="text-sm font-medium flex-1">
                  {q.type === 'essay' ? '✍️ سؤال مقالي' : q.type === 'tf' ? '⚖️ سؤال صح أو خطأ' : '⭕ سؤال اختياري متعدد'}
                </span>
                <button onClick={() => updateQ(q.id, { expanded: !q.expanded })} className="opacity-50 hover:opacity-100">
                  {q.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={() => removeQ(q.id)} className="opacity-50 hover:opacity-100" style={{ color: 'var(--red)' }}>
                  <Trash2 size={16} />
                </button>
              </div>

              {q.expanded && (
                <div className="p-4 space-y-3">
                  <div>
                    <textarea value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })}
                      rows={2} placeholder="أكتب نص السؤال هنا..." className="input-base resize-none text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-gold uppercase">صورة السؤال</label>
                      {q.imageUrl ? (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10">
                          <img src={q.imageUrl} alt="Q" className="w-full h-full object-cover" />
                          <button onClick={() => updateQ(q.id, { imageUrl: '' })} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5">
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-16">
                          <GlobalFileUpload 
                            accept="image/*"
                            variant="compact"
                            onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], { qId: q.id, type: 'image' })}
                            label={<span className="text-[10px] font-bold mt-1">صورة</span>}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-blue-400 uppercase">ملف PDF للسؤال</label>
                      {q.pdfUrl ? (
                        <div className="h-12 flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-3 rounded-lg">
                          <FileText size={14} className="text-blue-400" />
                          <button onClick={() => updateQ(q.id, { pdfUrl: '' })} className="text-red-400">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-16">
                          <GlobalFileUpload 
                            accept=".pdf"
                            variant="compact"
                            onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0], { qId: q.id, type: 'pdf' })}
                            label={<span className="text-[10px] font-bold mt-1">PDF</span>}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>⏱ مؤقت السؤال (بالثواني) - للأسئلة المحددة بوقت (اتركه 0 أو فارغ للوقت المفتوح)</label>
                    <input type="number" value={q.timeLimit || ''} onChange={e => updateQ(q.id, { timeLimit: +e.target.value })}
                      placeholder="مثال: 60" className="input-base text-sm rtl" />
                  </div>

                  {q.type === 'mcq' && (
                    <>
                      <div>
                        <label className="block text-xs mb-2" style={{ color: 'var(--gold)', fontWeight: 600 }}>✅ الإجابات (اختر الصحيحة)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(q.options || []).map((opt, i) => (
                            <div key={i} onClick={() => updateQ(q.id, { correct: i })}
                              className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all"
                              style={{
                                border: `1px solid ${q.correct === i ? 'var(--green)' : 'rgba(255,255,255,0.08)'}`,
                                background: q.correct === i ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                              }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                style={{ borderColor: q.correct === i ? 'var(--green)' : 'rgba(255,255,255,0.2)', background: q.correct === i ? 'var(--green)' : 'transparent' }}>
                                {q.correct === i && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="text-xs font-bold" style={{ color: 'var(--gold)', minWidth: '1rem' }}>{ARABIC_LETTERS[i]}</span>
                              <input value={opt} onChange={e => { e.stopPropagation(); updateOption(q.id, i, e.target.value); }}
                                onClick={e => e.stopPropagation()}
                                placeholder={`الإجابة ${ARABIC_LETTERS[i]}...`}
                                className="flex-1 bg-transparent border-none outline-none text-sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>💡 شرح الإجابة (يظهر بعد الاختبار)</label>
                        <input value={q.explanation || ''} onChange={e => updateQ(q.id, { explanation: e.target.value })}
                          placeholder="اشرح الإجابة الصحيحة..." className="input-base text-sm" />
                      </div>
                    </>
                  )}

                  {q.type === 'tf' && (
                    <>
                      <div>
                        <label className="block text-xs mb-2" style={{ color: 'var(--gold)', fontWeight: 600 }}>✅ الإجابة الصحيحة</label>
                        <div className="flex gap-4">
                          <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all flex-1 justify-center ${q.isTrue === true ? 'bg-green-500/20 border-green-500' : 'bg-white/5 border-white/10'}`} style={{ border: '2px solid', borderColor: q.isTrue === true ? 'var(--green)' : 'rgba(255,255,255,0.1)' }}>
                            <input type="radio" name={`tf_${q.id}`} checked={q.isTrue === true} onChange={() => updateQ(q.id, { isTrue: true })} className="sr-only" />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${q.isTrue === true ? 'border-green-500 bg-green-500' : 'border-white/20'}`}>
                              {q.isTrue === true && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <span className={q.isTrue === true ? 'text-green-500 font-bold' : 'text-gray-400'}>صح</span>
                          </label>
                          <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all flex-1 justify-center ${q.isTrue === false ? 'bg-red-500/20 border-red-500' : 'bg-white/5 border-white/10'}`} style={{ border: '2px solid', borderColor: q.isTrue === false ? 'var(--red)' : 'rgba(255,255,255,0.1)' }}>
                            <input type="radio" name={`tf_${q.id}`} checked={q.isTrue === false} onChange={() => updateQ(q.id, { isTrue: false })} className="sr-only" />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${q.isTrue === false ? 'border-red-500 bg-red-500' : 'border-white/20'}`}>
                              {q.isTrue === false && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <span className={q.isTrue === false ? 'text-red-500 font-bold' : 'text-gray-400'}>خطأ</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs mb-1 mt-3" style={{ color: 'var(--text-muted)' }}>💡 شرح الإجابة (يظهر بعد الاختبار)</label>
                        <input value={q.explanation || ''} onChange={e => updateQ(q.id, { explanation: e.target.value })}
                          placeholder="اشرح الإجابة الصحيحة..." className="input-base text-sm" />
                      </div>
                    </>
                  )}

                  {q.type === 'essay' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الدرجة القصوى</label>
                        <input type="number" value={q.maxScore} min={1} max={100}
                          onChange={e => updateQ(q.id, { maxScore: +e.target.value })} className="input-base text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظة للتصحيح</label>
                        <input value={q.gradingNote || ''} onChange={e => updateQ(q.id, { gradingNote: e.target.value })}
                          placeholder="تعليمات للمصحح..." className="input-base text-sm" />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowImage} onChange={e => updateQ(q.id, { allowImage: e.target.checked })}
                            style={{ accentColor: '#a855f7' }} />
                          رفع صورة
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowPdf} onChange={e => updateQ(q.id, { allowPdf: e.target.checked })}
                            style={{ accentColor: '#a855f7' }} />
                          رفع PDF
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowWord} onChange={e => updateQ(q.id, { allowWord: e.target.checked })}
                            style={{ accentColor: '#a855f7' }} />
                          رفع Word
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-gold py-3 px-8 text-base disabled:opacity-60">
          <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ الاختبار'}
        </button>
      </div>
    </div>
  );
}
