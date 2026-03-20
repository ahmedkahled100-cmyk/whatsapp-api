// src/lib/db/stats.ts
import { 
  collection, getDocs, query, where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { EXAMS, STUDENTS, ATTEMPTS, TEACHERS } from './constants';
import type { Attempt } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getDashboardStats = async (teacherId: string) => {
  const qExams = query(collection(db, EXAMS), where('teacherId', '==', teacherId));
  const qStudents = query(collection(db, STUDENTS), where('teacherId', '==', teacherId));
  const qAttempts = query(collection(db, ATTEMPTS), where('teacherId', '==', teacherId));

  const [exams, students, attempts] = await Promise.all([
    getDocs(qExams),
    getDocs(qStudents),
    getDocs(qAttempts),
  ]);

  const attData = attempts.docs.map(d => d.data() as Attempt);
  const pendingEssays = attData.filter(a =>
    a.essayAnswers?.some(ea => ea.pending)
  ).length;

  const completedAttempts = attData.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return {
    totalExams: exams.size,
    totalStudents: students.size,
    totalAttempts: attempts.size,
    pendingEssays,
    avgScore,
    passRate: completedAttempts.length > 0
      ? Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100)
      : 0,
  };
};

export const getPlatformStats = async () => {
  const [teachers, exams, students, attempts] = await Promise.all([
    getDocs(collection(db, TEACHERS)),
    getDocs(collection(db, EXAMS)),
    getDocs(collection(db, STUDENTS)),
    getDocs(collection(db, ATTEMPTS)),
  ]);

  let totalRevenue = 0;
  students.forEach((doc: any) => {
    const data = doc.data();
    if (data.subPrice && typeof data.subPrice === 'number') {
      totalRevenue += data.subPrice;
    }
  });

  return {
    totalTeachers: teachers.size,
    totalExams: exams.size,
    totalStudents: students.size,
    totalAttempts: attempts.size,
    totalRevenue
  };
};
