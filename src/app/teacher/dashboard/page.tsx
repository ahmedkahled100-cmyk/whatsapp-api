'use client';
// src/app/teacher/dashboard/page.tsx

import { useMemo } from 'react';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { formatDateAr, scoreLabel, gradeColor } from '@/lib/utils';
import { Users, FileText, TrendingUp, Clock, PlusCircle, Eye, Share2, ChevronLeft, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { user, exams, students, attempts, groups, notifications } = useTeacherStore();

  const stats = useMemo(() => {
    const completed = attempts.filter(a => a.completed);
    const pendingEssays = attempts.filter(a => a.essayAnswers?.some(ea => ea.pending)).length;
    const avgScore = completed.length > 0
      ? Math.round(completed.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completed.length)
      : 0;
    const passRate = completed.length > 0
      ? Math.round((completed.filter(a => a.passed).length / completed.length) * 100)
      : 0;
    
    // Calculate total revenue from students (ignore those who didn't pay)
    const totalRevenue = students.reduce((sum, s) => {
      const price = s.subPrice ? Number(s.subPrice) : 0;
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
    
    return { pendingEssays, avgScore, passRate, totalRevenue };
  }, [attempts, students]);

  const recentExams = useMemo(() => [...exams].reverse().slice(0, 5), [exams]);
  const recentAttempts = useMemo(() =>
    [...attempts].filter(a => a.completed).sort((a, b) =>
      new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    ).slice(0, 8),
    [attempts]
  );

  const copyStudentLink = () => {
    const url = `${window.location.origin}/student`;
    navigator.clipboard.writeText(url);
    alert('✅ تم نسخ رابط بوابة الطلاب!');
  };

  const hasPermission = (p: string) => user?.role === 'super_admin' || user?.permissions?.includes(p);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt={user.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-gold/30 shadow-lg shadow-gold/20" />
          ) : (
            <div className="text-3xl">🏠</div>
          )}
          <div>
            <h1 className="text-2xl font-cairo font-black gold-text">لوحة التحكم</h1>
            <p className="text-sm mt-1 font-bold" style={{ color: 'var(--text-muted)' }}>
              مرحباً بك {user?.name} — {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission('students') && (
            <button onClick={copyStudentLink} className="btn-outline text-sm py-2 px-3">
              <Share2 size={14} /> رابط بوابة الطلاب
            </button>
          )}
          {hasPermission('exams') && (
            <Link href="/teacher/exams/create" className="btn-gold text-sm py-2 px-4">
              <PlusCircle size={15} /> اختبار جديد
            </Link>
          )}
        </div>
      </div>

      {/* Expiry Warning */}
      {user?.role === 'teacher' && user?.subExpiry && user.subType !== 'free' && new Date(user.subExpiry).getTime() > Date.now() && new Date(user.subExpiry).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 && (
        <div className="card-base p-4 sm:p-5 bg-red-500/10 border-red-500/30 flex justify-between items-center flex-wrap gap-4 animate-pulse-slow">
           <div className="flex gap-3 items-start sm:items-center">
             <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0 mt-0.5 sm:mt-0">
               <AlertCircle size={20} />
             </div>
             <div>
               <div className="font-bold text-red-400">تنبيه اقتراب انتهاء اشتراك المنصة</div>
               <div className="text-sm text-red-300 mt-1 leading-relaxed">
                 عزيزي المعلم، اشتراكك الحالي سينتهي يوم <strong>{formatDateAr(new Date(user.subExpiry).toISOString())}</strong>. يرجى التجديد لضمان استمرار وصولك للوحة التحكم وبوابة طلابك.
               </div>
             </div>
           </div>
           {user.subLink && (
             <a href={user.subLink.startsWith('http') ? user.subLink : `https://${user.subLink}`} target="_blank" className="btn-gold bg-red-600 shadow-lg shadow-red-900/40 text-sm whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center">
               تجديد الاشتراك
             </a>
           )}
        </div>
      )}
      
      {/* Expired Warning */}
      {user?.role === 'teacher' && user?.subExpiry && user.subType !== 'free' && new Date(user.subExpiry).getTime() < Date.now() && (
        <div className="card-base p-4 sm:p-5 bg-red-900/40 border-red-500/50 flex justify-between items-center flex-wrap gap-4 relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
           <div className="flex gap-3 items-start sm:items-center relative z-10">
             <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5 sm:mt-0">
               <AlertCircle size={20} />
             </div>
             <div>
               <div className="font-black text-red-400 text-lg">⚠️ انتهى اشتراك المنصة الخاصة بك</div>
               <div className="text-sm text-red-300 mt-1 leading-relaxed">
                 انتهى اشتراكك يوم <strong>{formatDateAr(new Date(user.subExpiry).toISOString())}</strong>. يرجى تجديد الاشتراك فوراً لاستعادة كامل الصلاحيات والوصول لمنصتك التعليمية مجدداً.
               </div>
             </div>
           </div>
           {user.subLink && (
             <a href={user.subLink.startsWith('http') ? user.subLink : `https://${user.subLink}`} target="_blank" className="btn-gold bg-red-600 shadow-xl shadow-red-900/40 text-sm whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center hover:bg-red-500 relative z-10">
               تجديد الاشتراك الآن
             </a>
           )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { id: 'exams', label: 'اختبار', value: exams.length, icon: '📋', color: 'var(--accent)', sub: `${exams.filter(e => e.published).length} منشور`, href: '/teacher/exams' },
          { id: 'students', label: 'طالب', value: students.length, icon: '👥', color: 'var(--green)', sub: `${groups.length} فصل`, href: '/teacher/students' },
          { id: 'results', label: 'محاولة', value: attempts.length, icon: '📝', color: 'var(--gold)', sub: `${attempts.filter(a => a.completed).length} مكتملة`, href: '/teacher/results' },
          { id: 'analytics', label: 'مقالي ينتظر', value: stats.pendingEssays, icon: '⏳', color: 'var(--red)', sub: `معدل النجاح ${stats.passRate}%`, href: '/teacher/essays' },
          { id: 'subscriptions', label: 'إجمالي الاشتراكات', value: `${stats.totalRevenue} ج.م`, icon: '💰', color: '#10B981', sub: 'إيرادات الطلاب', href: '/teacher/subscriptions' },
        ].filter(s => hasPermission(s.id)).map((s, i) => (
          <Link href={s.href} key={i} className="stat-card hover:-translate-y-1 hover:shadow-lg transition-all duration-300 block cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl xl:text-3xl font-cairo font-black mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-xs mt-1 opacity-60" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
              </div>
              <div className="text-3xl opacity-80">{s.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Score Stats */}
      {hasPermission('analytics') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="stat-card text-center">
            <div className="text-4xl font-cairo font-black" style={{ color: gradeColor(stats.avgScore, 50) }}>
              {stats.avgScore}%
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>متوسط الدرجات</div>
            <div className="badge mt-2" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)' }}>
              {scoreLabel(stats.avgScore)}
            </div>
          </div>
          <div className="stat-card text-center">
            <div className="text-4xl font-cairo font-black" style={{ color: stats.passRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
              {stats.passRate}%
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>معدل النجاح</div>
            <div className="text-xs mt-2 opacity-60" style={{ color: 'var(--text-muted)' }}>
              من {attempts.filter(a => a.completed).length} محاولة
            </div>
          </div>
        </div>
      )}

      {/* Recent Exams */}
      {hasPermission('exams') && (
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-cairo font-bold text-base" style={{ color: 'var(--gold)' }}>📋 آخر الاختبارات</h3>
            <Link href="/teacher/exams" className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              عرض الكل <ChevronLeft size={13} />
            </Link>
          </div>
          {recentExams.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-2">📝</div>
              <p className="text-sm">لا توجد اختبارات بعد</p>
              <Link href="/teacher/exams/create" className="btn-gold text-sm mt-3 inline-flex py-2 px-4">
                <PlusCircle size={14} /> أنشئ أول اختبار
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExams.map(exam => {
                const examAttempts = attempts.filter(a => a.examId === exam.id);
                return (
                  <div key={exam.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{exam.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {(exam.questions || []).length} سؤال • {exam.duration}د • {examAttempts.length} محاولة
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge ${exam.published ? 'badge-green' : 'badge-red'}`}>
                        {exam.published ? '✅ منشور' : '📝 مسودة'}
                      </span>
                      <Link href={`/teacher/exams/view?id=${exam.id}`} className="btn-outline text-xs py-1 px-2">
                        <Eye size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent Attempts */}
      {hasPermission('students') && recentAttempts.length > 0 && (
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-cairo font-bold text-base" style={{ color: 'var(--gold)' }}>📊 آخر النتائج</h3>
            <Link href="/teacher/results" className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              عرض الكل <ChevronLeft size={13} />
            </Link>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-white/5 text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3">الطالب</th>
                  <th className="px-4 py-3">الاختبار</th>
                  <th className="px-4 py-3">النتيجة</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentAttempts.map(att => {
                  const score = att.finalScore ?? att.mcqScore ?? 0;
                  return (
                    <tr key={att.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--text)' }}>{att.studentName}</td>
                      <td className="px-4 py-3 text-sm max-w-32 truncate">{att.examTitle}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-bold" style={{ color: gradeColor(score, 50) }}>{score}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${att.passed ? 'badge-green' : 'badge-red'}`}>
                          {att.passed ? '✅ ناجح' : '❌ راسب'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs opacity-60">{att.submittedAt ? formatDateAr(att.submittedAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {recentAttempts.map(att => {
              const score = att.finalScore ?? att.mcqScore ?? 0;
              return (
                <div key={att.id} className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm truncate flex-1 ml-2">{att.studentName}</div>
                    <span className="font-black text-sm" style={{ color: gradeColor(score, 50) }}>{score}%</span>
                  </div>
                  <div className="text-xs opacity-60 truncate">{att.examTitle}</div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className={`badge ${att.passed ? 'badge-green' : 'badge-red'}`}>
                      {att.passed ? '✅ ناجح' : '❌ راسب'}
                    </span>
                    <span className="text-[10px] opacity-40">{att.submittedAt ? formatDateAr(att.submittedAt) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
