'use client';
// src/app/teacher/analytics/page.tsx

import { useMemo, useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { gradeColor, getApiBase } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, FileText, CheckCircle, Sparkles, Loader2, Award, AlertTriangle, Lightbulb } from 'lucide-react';
import { showToast } from '@/lib/toast';

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { exams, students, attempts, groups } = useTeacherStore();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  const chartData = useMemo(() => {
    // Collect average score per exam to display in the chart
    return exams.map(exam => {
      const examAttempts = attempts.filter(a => a.examId === exam.id && a.completed);
      const avgScore = examAttempts.length > 0
        ? Math.round(examAttempts.reduce((sum, current) => sum + (current.finalScore ?? current.mcqScore ?? 0), 0) / examAttempts.length)
        : 0;

      return {
        name: exam.title.length > 15 ? exam.title.substring(0, 15) + '...' : exam.title,
        score: avgScore,
        attempts: examAttempts.length,
      };
    });
  }, [exams, attempts]);

  const stats = useMemo(() => {
    const completed = attempts.filter(a => a.completed);
    const avgOverall = completed.length > 0
      ? Math.round(completed.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completed.length)
      : 0;
    const passRate = completed.length > 0
      ? Math.round((completed.filter(a => a.passed).length / completed.length) * 100)
      : 0;

    return { avgOverall, passRate, totalCompleted: completed.length };
  }, [attempts]);

  const fetchAiInsights = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      // Summarize data to avoid overloading AI context
      const studentData = students.map(s => {
        const myAttempts = attempts.filter(a => a.studentId === s.id && a.completed);
        if (myAttempts.length === 0) return null;
        const avg = myAttempts.reduce((sum, a) => sum + (a.finalScore ?? a.mcqScore ?? 0), 0) / myAttempts.length;
        return { name: s.name, examsCount: myAttempts.length, avgScore: Math.round(avg) };
      }).filter(Boolean); // Only send students who took exams

      // Just keep top 50 randomly or the first 50 to avoid sending too much text
      const promptData = JSON.stringify(studentData.slice(0, 50));
      
      const res = await fetch(`${getApiBase()}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'analytics', prompt: promptData })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAiInsights(data.result);
      showToast('✅ تم تحليل البيانات بنجاح');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={28} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">التحليلات والمتابعة</h1>
        </div>
        <button 
          onClick={fetchAiInsights} 
          disabled={aiLoading || students.length === 0} 
          className="btn-gold flex items-center gap-2 py-2 px-4 shadow-[0_0_15px_rgba(245,197,24,0.3)] animate-pulse-glow disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          <span className="hidden sm:inline">تحليل الأداء بالذكاء الاصطناعي</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-6 text-center">
          <div className="text-4xl font-black mb-2" style={{ color: gradeColor(stats.avgOverall, 50) }}>
            {stats.avgOverall}%
          </div>
          <p style={{ color: 'var(--text-muted)' }}>متوسط أداء الطلاب العام</p>
        </div>
        <div className="card-base p-6 text-center">
          <div className="text-4xl font-black mb-2" style={{ color: stats.passRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
            {stats.passRate}%
          </div>
          <p style={{ color: 'var(--text-muted)' }}>معدل النجاح الكلي</p>
        </div>
        <div className="card-base p-6 text-center">
          <div className="text-4xl font-black mb-2 text-gold">
            {stats.totalCompleted}
          </div>
          <p style={{ color: 'var(--text-muted)' }}>إجمالي الاختبارات المكتملة</p>
        </div>
      </div>

      {aiInsights && (
        <div className="card-base p-6 animate-slide-up border border-gold/30 shadow-[0_0_30px_rgba(245,197,24,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl -mx-16 -my-16" />
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <Sparkles size={24} className="text-gold" />
            <h2 className="text-xl font-black font-cairo text-white">رؤى الذكاء الاصطناعي</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {/* Top Students */}
            {aiInsights.topStudents && aiInsights.topStudents.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-green-400 flex items-center gap-2 mb-3">
                  <Award size={18} /> المتفوقون
                </h3>
                {aiInsights.topStudents.map((s: any, i: number) => (
                  <div key={i} className="p-3 bg-green-500/5 rounded-xl border border-green-500/10 hover:bg-green-500/10 transition-colors">
                    <div className="font-bold text-white text-sm">{s.name}</div>
                    <div className="text-xs text-green-300/70 mt-1">{s.insight}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Needs Support */}
            {aiInsights.needsSupport && aiInsights.needsSupport.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-red-400 flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} /> بحاجة لدعم
                </h3>
                {aiInsights.needsSupport.map((s: any, i: number) => (
                  <div key={i} className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 hover:bg-red-500/10 transition-colors">
                    <div className="font-bold text-white text-sm">{s.name}</div>
                    <div className="text-xs text-red-300/70 mt-1">{s.insight}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* General Recommendations */}
          {aiInsights.generalRecommendations && aiInsights.generalRecommendations.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
              <h3 className="font-bold text-gold flex items-center gap-2 mb-3">
                <Lightbulb size={18} /> توصيات المعلم
              </h3>
              <ul className="space-y-2">
                {aiInsights.generalRecommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300 bg-white/5 p-3 rounded-lg">
                    <span className="text-gold">•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card-base p-6">
        <h3 className="font-cairo font-bold mb-6 text-lg">متوسط درجات الطلاب في الاختبارات</h3>
        <div className="h-80 w-full" dir="ltr">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} angle={-45} textAnchor="end" />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--dark2)', border: '1px solid rgba(245,197,24,0.3)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--gold)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="score" name="متوسط الدرجات %" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="animate-spin text-gold" size={24} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
