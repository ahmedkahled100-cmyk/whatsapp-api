// src/lib/db/supabase/stats.ts
import { supabase } from '@/lib/supabase';
import { EXAMS, STUDENTS, ATTEMPTS, TEACHERS } from '../constants';
import type { Attempt } from '@/types';

export const getDashboardStats = async (teacherId: string) => {
  const [exams, students, attempts] = await Promise.all([
    supabase.from(EXAMS).select('id', { count: 'exact', head: true }).eq('teacherId', teacherId),
    supabase.from(STUDENTS).select('id', { count: 'exact', head: true }).eq('teacherId', teacherId),
    supabase.from(ATTEMPTS).select('*').eq('teacherId', teacherId),
  ]);

  const attData = (attempts.data || []) as Attempt[];
  const pendingEssays = attData.filter(a =>
    a.essayAnswers?.some(ea => ea.pending)
  ).length;

  const completedAttempts = attData.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return {
    totalExams: exams.count || 0,
    totalStudents: students.count || 0,
    totalAttempts: attempts.data?.length || 0,
    pendingEssays,
    avgScore,
    passRate: completedAttempts.length > 0
      ? Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100)
      : 0,
  };
};

export const getPlatformStats = async () => {
  const [teachers, exams, students, attempts] = await Promise.all([
    supabase.from(TEACHERS).select('*'),
    supabase.from(EXAMS).select('id', { count: 'exact', head: true }),
    supabase.from(STUDENTS).select('*'),
    supabase.from(ATTEMPTS).select('id', { count: 'exact', head: true }),
  ]);

  let totalRevenue = 0;
  
  (students.data || []).forEach((data: any) => {
    if (data.subPrice && typeof data.subPrice === 'number') {
      totalRevenue += data.subPrice;
    }
  });

  (teachers.data || []).forEach((data: any) => {
    if (data.subPrice && typeof data.subPrice === 'number') {
      totalRevenue += data.subPrice;
    }
  });

  return {
    totalTeachers: teachers.data?.length || 0,
    totalExams: exams.count || 0,
    totalStudents: students.data?.length || 0,
    totalAttempts: attempts.count || 0,
    totalRevenue
  };
};
