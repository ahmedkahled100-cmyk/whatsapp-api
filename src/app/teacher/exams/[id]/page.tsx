'use client';
// src/app/teacher/exams/[id]/page.tsx

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import Link from 'next/link';
import { ArrowRight, Eye, Edit, Trash2, Users, FileText, CheckCircle } from 'lucide-react';

export default function ExamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { exams, attempts } = useTeacherStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const exam = exams.find(e => e.id === id);

  if (!exam) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold mb-2">الاختبار غير موجود</h2>
        <p className="text-gray-400 mb-6">قد يكون تم حذفه أو أن الرابط غير صحيح.</p>
        <Link href="/teacher/exams" className="btn-gold py-2 px-6">العودة للاختبارات</Link>
      </div>
    );
  }

  const examAttempts = attempts.filter(a => a.examId === id);
  const completedAttempts = examAttempts.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ArrowRight size={20} />
        </button>
        <h1 className="text-2xl font-cairo font-black gold-text">تفاصيل الاختبار</h1>
      </div>

      <div className="card-base p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h2 className="text-xl font-bold mb-1">{exam.title}</h2>
            <div className="flex gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>📚 {exam.subject || 'عام'}</span>
              <span>⏱ {exam.duration} دقيقة</span>
              <span>📊 نسبة النجاح {exam.passScore}%</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/teacher/exams/${id}/edit`} className="btn-outline text-sm py-2 px-4">
              <Edit size={16} /> تعديل
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-2xl font-black text-gold mb-1">{exam.questions.length || 0}</div>
            <div className="text-sm opacity-60">عدد الأسئلة</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-2xl font-black text-blue-400 mb-1">{examAttempts.length}</div>
            <div className="text-sm opacity-60">إجمالي المحاولات</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-2xl font-black text-green-400 mb-1">{avgScore}%</div>
            <div className="text-sm opacity-60">متوسط الدرجات</div>
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-4 text-lg">الأسئلة ({exam.questions.length})</h3>
          <div className="space-y-3">
            {exam.questions.map((q, i) => (
              <div key={q.id} className="p-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gold/20 text-gold flex flex-shrink-0 items-center justify-center text-xs font-bold pt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-2">{q.text}</p>
                    {q.type === 'mcq' && q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                        {q.options.map((opt, oi) => {
                          const isCorrect = opt === (q as any).correctAnswer;
                          return (
                            <div key={oi} className={`p-2 rounded text-sm ${isCorrect ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/5 opacity-70'}`}>
                              {opt} {isCorrect && <CheckCircle size={14} className="inline ml-1" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.type === 'essay' && (
                      <div className="text-sm text-blue-400 mt-2">📝 سؤال مقالي (يحتاج تصحيح يدوي)</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {exam.questions.length === 0 && (
              <div className="text-center py-8 opacity-50">لا توجد أسئلة في هذا الاختبار</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
