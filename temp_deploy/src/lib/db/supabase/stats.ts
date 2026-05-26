// src/lib/db/supabase/stats.ts
import { supabase } from '@/lib/supabase';
import { EXAMS, STUDENTS, ATTEMPTS, TEACHERS } from '../constants';
import { manyFromDB } from './dbUtils';
import type { Attempt } from '@/types';

export const getDashboardStats = async (teacherId: string) => {
  const [exams, students, attempts] = await Promise.all([
    supabase.from(EXAMS).select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from(STUDENTS).select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supabase.from(ATTEMPTS).select('*').eq('teacher_id', teacherId),
  ]);

  const attData = manyFromDB<Attempt>(attempts.data || []);
  const pendingEssays = attData.filter(a => a.essayAnswers?.some(ea => ea.pending)).length;
  const completedAttempts = attData.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return {
    totalExams: exams.count || 0,
    totalStudents: students.count || 0,
    totalAttempts: attData.length,
    pendingEssays, avgScore,
    passRate: completedAttempts.length > 0
      ? Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100)
      : 0,
  };
};

export const getPlatformStats = async () => {
  const [teachers, exams, students, attempts] = await Promise.all([
    supabase.from(TEACHERS).select('*'),
    supabase.from(EXAMS).select('id', { count: 'exact', head: true }),
    supabase.from(STUDENTS).select('sub_price'),
    supabase.from(ATTEMPTS).select('id', { count: 'exact', head: true }),
  ]);

  let totalRevenue = 0;
  (students.data || []).forEach((r: any) => { if (r.sub_price) totalRevenue += r.sub_price; });
  (teachers.data || []).forEach((r: any) => { if (r.sub_price) totalRevenue += r.sub_price; });

  return {
    totalTeachers: teachers.data?.length || 0,
    totalExams: exams.count || 0,
    totalStudents: students.data?.length || 0,
    totalAttempts: attempts.count || 0,
    totalRevenue,
  };
};
