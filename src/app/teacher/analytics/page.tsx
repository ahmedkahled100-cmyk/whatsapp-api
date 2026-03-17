'use client';
// src/app/teacher/analytics/page.tsx

import { useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { gradeColor } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, Users, FileText, CheckCircle } from 'lucide-react';

export default function AnalyticsPage() {
  const { exams, students, attempts, groups } = useTeacherStore();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp size={28} className="text-gold" />
        <h1 className="text-2xl font-cairo font-black gold-text">التحليلات والمتابعة</h1>
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

      <div className="card-base p-6">
        <h3 className="font-cairo font-bold mb-6 text-lg">متوسط درجات الطلاب في الاختبارات</h3>
        <div className="h-80 w-full" dir="ltr">
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
        </div>
      </div>
    </div>
  );
}
