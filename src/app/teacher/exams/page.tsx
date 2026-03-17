'use client';
// src/app/teacher/exams/page.tsx

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { deleteExam, toggleExamPublish } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { PlusCircle, Search, Trash2, Eye, Edit, Share2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function ExamsPage() {
  const { exams, groups, attempts, setExams } = useTeacherStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  const filtered = useMemo(() => {
    return exams.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || (e.subject || '').includes(search);
      const matchFilter = filter === 'all' || (filter === 'published' ? e.published : !e.published);
      return matchSearch && matchFilter;
    });
  }, [exams, search, filter]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`هل تريد حذف اختبار "${title}" نهائياً؟`)) return;
    await deleteExam(id);
  };

  const handleTogglePublish = async (id: string, current: boolean) => {
    await toggleExamPublish(id, !current);
  };

  const shareExam = (id: string) => {
    const url = `${window.location.origin}/exam/${id}`;
    navigator.clipboard.writeText(url);
    showToast('✅ تم نسخ رابط الاختبار للطلاب!');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-cairo font-black gold-text">📋 الاختبارات</h1>
        <Link href="/teacher/exams/create" className="btn-gold">
          <PlusCircle size={16} /> اختبار جديد
        </Link>
      </div>

      {/* Filters */}
      <div className="card-base p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
          <input
            type="text"
            placeholder="ابحث باسم الاختبار أو المادة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-base pr-11 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn-gold text-sm py-2 px-3' : 'btn-outline text-sm py-2 px-3'}>
              {f === 'all' ? 'الكل' : f === 'published' ? '✅ منشورة' : '📝 مسودة'}
            </button>
          ))}
        </div>
      </div>

      {/* Exams List */}
      {filtered.length === 0 ? (
        <div className="card-base p-12 text-center">
          <div className="text-5xl mb-3">📝</div>
          <p style={{ color: 'var(--text-muted)' }}>{search ? 'لا توجد نتائج للبحث' : 'لا توجد اختبارات بعد'}</p>
          <Link href="/teacher/exams/create" className="btn-gold inline-flex mt-4 text-sm">
            <PlusCircle size={14} /> أنشئ أول اختبار
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(exam => {
            const examAttempts = attempts.filter(a => a.examId === exam.id && a.completed);
            const avgScore = examAttempts.length > 0
              ? Math.round(examAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / examAttempts.length)
              : null;
            const group = exam.targetGroup ? groups.find(g => g.id === exam.targetGroup) : null;

            return (
              <div key={exam.id} className="card-base p-4 transition-all hover:border-yellow-500/20">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-cairo font-bold text-base">{exam.title}</h3>
                      <span className={`badge ${exam.published ? 'badge-green' : 'badge-red'}`}>
                        {exam.published ? '✅ منشور' : '📝 مسودة'}
                      </span>
                      {group && <span className="badge badge-blue">🏫 {group.name}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1.5">📚 {exam.subject || 'عام'}</span>
                      <span className="flex items-center gap-1.5">❓ {(exam.questions || []).length} سؤال</span>
                      <span className="flex items-center gap-1.5">⏱ {exam.duration} دقيقة</span>
                      <span className="flex items-center gap-1.5">📊 {exam.passScore}%</span>
                      <span className="flex items-center gap-1.5">🔄 {examAttempts.length} محاولة</span>
                      {avgScore !== null && (
                        <span className="flex items-center gap-1.5" style={{ color: avgScore >= exam.passScore ? 'var(--green)' : 'var(--red)' }}>
                          📈 متوسط {Math.round((avgScore * (exam.questions?.length || 0)) / 100)} / {exam.questions?.length || 0}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {exam.shuffle && <span className="badge badge-purple">🔀 عشوائي</span>}
                      {exam.allowRetake && <span className="badge badge-gold">🔁 إعادة مسموح</span>}
                      {exam.showAnswers && <span className="badge badge-blue">👁 يظهر الحل</span>}
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 sm:flex-shrink-0 flex-wrap">
                    <button onClick={() => handleTogglePublish(exam.id, exam.published)}
                      className="btn-outline flex-1 sm:flex-none text-xs py-2 px-3 justify-center" title={exam.published ? 'إخفاء الاختبار' : 'نشر الاختبار'}>
                      {exam.published ? <ToggleRight size={14} style={{ color: 'var(--green)' }} /> : <ToggleLeft size={14} />}
                      <span>{exam.published ? 'إخفاء' : 'نشر'}</span>
                    </button>
                    <button onClick={() => shareExam(exam.id)} className="btn-outline flex-1 sm:flex-none text-xs py-2 px-3 justify-center">
                      <Share2 size={14} /> <span>مشاركة</span>
                    </button>
                    <Link href={`/teacher/exams/${exam.id}/edit`} className="btn-outline flex-1 sm:flex-none text-xs py-2 px-3 justify-center">
                      <Edit size={14} /> <span>تعديل</span>
                    </Link>
                    <button onClick={() => handleDelete(exam.id, exam.title)}
                      className="btn-danger flex-1 sm:flex-none text-xs py-2 px-3 justify-center">
                      <Trash2 size={14} /> <span>حذف</span>
                    </button>
                  </div>
                </div>
              </div>

            );
          })}
        </div>
      )}
    </div>
  );
}
