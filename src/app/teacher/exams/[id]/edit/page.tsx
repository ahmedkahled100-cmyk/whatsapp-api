'use client';
// src/app/teacher/exams/[id]/edit/page.tsx

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { saveExam, getExam } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { Question, Exam } from '@/types';
import { PlusCircle, Trash2, Save, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

type QForm = Question & { expanded?: boolean };

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { groups } = useTeacherStore();
  
  const [loading, setLoading] = useState(true);
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

  // Questions
  const [questions, setQuestions] = useState<QForm[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const e = await getExam(id);
        if (!e) {
          showToast('الاختبار غير موجود');
          router.push('/teacher/exams');
          return;
        }

        setTitle(e.title);
        setSubject(e.subject || '');
        setDuration(e.duration);
        setPassScore(e.passScore);
        setTargetGroup(e.targetGroup || '');
        setPublished(e.published);
        setShuffle(e.shuffle);
        setAllowRetake(e.allowRetake);
        setShowAnswers(e.showAnswers);
        setScheduleType(e.startTime || e.endTime ? 'scheduled' : 'open');
        setStartTime(e.startTime || '');
        setEndTime(e.endTime || '');
        setDesc(e.desc || '');
        setQuestions(e.questions.map(q => ({ ...q, expanded: false })));
      } catch (err) {
        showToast('حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

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
      const examData: Exam = {
        id,
        title, subject, desc, duration, passScore,
        questions: validQs.map(({ expanded, ...q }) => q as Question),
        shuffle, allowRetake, allowResume: true, showAnswers, published,
        startTime: scheduleType === 'scheduled' ? startTime : null,
        endTime: scheduleType === 'scheduled' ? endTime : null,
        createdAt: new Date().toISOString(), // Keeping created at or should we track updated?
      };
      if (targetGroup) examData.targetGroup = targetGroup;

      const cleanExam = JSON.parse(JSON.stringify(examData));
      await saveExam(cleanExam);
      router.push(`/teacher/exams/${id}`);
    } catch (e) {
      showToast('فشل الحفظ - تحقق من الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center font-bold">جاري التحميل...</div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <ArrowRight size={20} />
          </button>
          <h1 className="text-2xl font-cairo font-black gold-text">تعديل الاختبار</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-gold disabled:opacity-60">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      {/* Settings Card */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>⚙️ إعدادات الاختبار</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1.5 text-muted">عنوان الاختبار *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="مثال: اختبار الفصل الأول..." className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted">المادة الدراسية</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="رياضيات، علوم..." className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted">⏱ الوقت المسموح (دقيقة)</label>
            <input type="number" value={duration} min={1} max={240}
              onChange={e => setDuration(+e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted">📊 درجة النجاح (%)</label>
            <input type="number" value={passScore} min={1} max={100}
              onChange={e => setPassScore(+e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted">🏫 تخصيص لفصل (اختياري)</label>
            <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="input-base">
              <option value="">— جميع الطلاب —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted">📅 توقيت الاختبار</label>
            <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} className="input-base">
              <option value="open">مفتوح - بدون توقيت</option>
              <option value="scheduled">محدد - وقت بداية ونهاية</option>
            </select>
          </div>
          {scheduleType === 'scheduled' && (
            <>
              <div>
                <label className="block text-sm mb-1.5 text-muted">🕐 وقت البداية</label>
                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="block text-sm mb-1.5 text-muted">🕕 وقت النهاية</label>
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
            <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-sm">{label}</span>
              <button onClick={() => set(!value)}
                className="w-10 h-5 rounded-full transition-all relative"
                style={{ background: value ? 'var(--green)' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ right: value ? '2px' : 'auto', left: value ? 'auto' : '2px' }} />
              </button>
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1.5 text-muted">وصف الاختبار (اختياري)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="تعليمات أو وصف للطلاب..." rows={2} className="input-base resize-none" />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cairo font-bold gold-text">❓ الأسئلة ({questions.length})</h2>
          <div className="flex gap-2">
            <button onClick={addMCQ} className="btn-accent text-sm py-2 px-3"><PlusCircle size={14} /> اختياري</button>
            <button onClick={addTF} className="btn-accent text-sm py-2 px-3 bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700 text-white"><PlusCircle size={14} /> صح/خطأ</button>
            <button onClick={addEssay} className="text-sm py-2 px-3 rounded-xl font-bold inline-flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff' }}>
              <PlusCircle size={14} /> مقالي
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl overflow-hidden transition-all border border-white/10 bg-white/5">
              {/* Question header */}
              <div className="flex items-center gap-2 p-3 border-b border-white/5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: q.type === 'essay' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
                  {idx + 1}
                </div>
                <span className="text-sm font-medium flex-1">
                  {q.type === 'essay' ? '✍️ سؤال مقالي' : q.type === 'tf' ? '⚖️ سؤال صح أو خطأ' : '⭕ سؤال اختياري متعدد'}
                </span>
                <button onClick={() => updateQ(q.id, { expanded: !q.expanded })} className="opacity-50 hover:opacity-100 p-1">
                  {q.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={() => removeQ(q.id)} className="opacity-50 hover:opacity-100 p-1 text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>

              {q.expanded && (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs mb-1 text-muted">نص السؤال *</label>
                    <textarea value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })}
                      rows={2} placeholder="أكتب نص السؤال هنا..." className="input-base resize-none text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs mb-1 text-muted">⏱ مؤقت السؤال (بالثواني) - للوقت المفتوح اتركه 0</label>
                    <input type="number" value={q.timeLimit || ''} onChange={e => updateQ(q.id, { timeLimit: +e.target.value })}
                      placeholder="مثال: 60" className="input-base text-sm rtl" />
                  </div>

                  {q.type === 'mcq' && (
                    <>
                      <div>
                        <label className="block text-xs mb-2 font-bold gold-text">✅ الإجابات (اختر الصحيحة)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(q.options || []).map((opt, i) => (
                            <div key={i} onClick={() => updateQ(q.id, { correct: i })}
                              className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all border ${q.correct === i ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${q.correct === i ? 'border-green-500 bg-green-500' : 'border-white/20'}`}>
                                {q.correct === i && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="text-xs font-bold gold-text min-w-[1rem]">{ARABIC_LETTERS[i]}</span>
                              <input value={opt} onChange={e => { e.stopPropagation(); updateOption(q.id, i, e.target.value); }}
                                onClick={e => e.stopPropagation()}
                                placeholder={`الإجابة ${ARABIC_LETTERS[i]}...`}
                                className="flex-1 bg-transparent border-none outline-none text-sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {q.type === 'tf' && (
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all flex-1 justify-center border-2 ${q.isTrue === true ? 'border-green-500 bg-green-500/10' : 'border-white/10'}`}>
                        <input type="radio" checked={q.isTrue === true} onChange={() => updateQ(q.id, { isTrue: true })} className="sr-only" />
                        <span className={q.isTrue === true ? 'text-green-500 font-bold' : 'text-gray-400'}>صح</span>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all flex-1 justify-center border-2 ${q.isTrue === false ? 'border-red-500 bg-red-500/10' : 'border-white/10'}`}>
                        <input type="radio" checked={q.isTrue === false} onChange={() => updateQ(q.id, { isTrue: false })} className="sr-only" />
                        <span className={q.isTrue === false ? 'text-red-500 font-bold' : 'text-gray-400'}>خطأ</span>
                      </label>
                    </div>
                  )}

                  {q.type === 'essay' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1 text-muted">الدرجة القصوى</label>
                        <input type="number" value={q.maxScore} min={1} max={100}
                          onChange={e => updateQ(q.id, { maxScore: +e.target.value })} className="input-base text-sm" />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowImage} onChange={e => updateQ(q.id, { allowImage: e.target.checked })} /> رفع صورة
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowPdf} onChange={e => updateQ(q.id, { allowPdf: e.target.checked })} /> رفع PDF
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={q.allowWord} onChange={e => updateQ(q.id, { allowWord: e.target.checked })} /> رفع Word
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs mb-1 text-muted">💡 شرح الإجابة (اختياري)</label>
                    <input value={q.explanation || ''} onChange={e => updateQ(q.id, { explanation: e.target.value })}
                      placeholder="اشرح الإجابة الصحيحة..." className="input-base text-sm" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end p-5">
        <button onClick={handleSave} disabled={saving} className="btn-gold py-3 px-10 text-base shadow-xl">
           حفظ التعديلات
        </button>
      </div>
    </div>
  );
}
