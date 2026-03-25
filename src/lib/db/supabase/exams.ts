// src/lib/db/supabase/exams.ts
import { supabase } from '@/lib/supabase';
import { EXAMS, ATTEMPTS, QBANK } from '../constants';
import type { Exam, Attempt, QuestionBankItem } from '@/types';

export const getExams = async (teacherId: string): Promise<Exam[]> => {
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as Exam[];
};

export const getPublishedExams = async (teacherId: string): Promise<Exam[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('teacherId', teacherId)
    .eq('published', true);
  if (error) throw error;
  return data as Exam[];
};

export const getExam = async (id: string): Promise<Exam | null> => {
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Exam | null;
};

export const saveExam = async (exam: Omit<Exam, 'id'> & { id?: string }): Promise<string> => {
  if (exam.id) {
    const { error } = await supabase.from(EXAMS).update(exam).eq('id', exam.id);
    if (error) throw error;
    return exam.id;
  } else {
    const { data, error } = await supabase
      .from(EXAMS)
      .insert([{ ...exam, createdAt: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteExam = async (id: string) => {
  const { error } = await supabase.from(EXAMS).delete().eq('id', id);
  if (error) throw error;
};

export const toggleExamPublish = async (id: string, published: boolean) => {
  const { error } = await supabase.from(EXAMS).update({ published }).eq('id', id);
  if (error) throw error;
};

export const subscribeToExams = (teacherId: string, callback: (exams: Exam[]) => void) => {
  const channel = supabase
    .channel(`exams:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: EXAMS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const exams = await getExams(teacherId);
        callback(exams);
      }
    )
    .subscribe();

  getExams(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

// Attempts
export const getAttemptsByStudent = async (studentId: string): Promise<Attempt[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*')
    .eq('studentId', studentId);
  if (error) throw error;
  return data as Attempt[];
};

export const getAttemptsByExam = async (examId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*')
    .eq('examId', examId);
  if (error) throw error;
  return data as Attempt[];
};

export const getAllAttempts = async (teacherId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as Attempt[];
};

export const saveAttempt = async (attempt: Omit<Attempt, 'id'> & { id?: string }): Promise<string> => {
  if (attempt.id) {
    const { error } = await supabase.from(ATTEMPTS).update(attempt).eq('id', attempt.id);
    if (error) throw error;
    return attempt.id;
  } else {
    const { data, error } = await supabase
      .from(ATTEMPTS)
      .insert([attempt])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteAttempt = async (id: string) => {
  const { error } = await supabase.from(ATTEMPTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToAttempts = (teacherId: string, callback: (attempts: Attempt[]) => void) => {
  const channel = supabase
    .channel(`attempts:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: ATTEMPTS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const attempts = await getAllAttempts(teacherId);
        callback(attempts);
      }
    )
    .subscribe();

  getAllAttempts(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

// Question Bank
export const getQBank = async (teacherId: string): Promise<QuestionBankItem[]> => {
  const { data, error } = await supabase
    .from(QBANK)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as QuestionBankItem[];
};

export const addToQBank = async (item: Omit<QuestionBankItem, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(QBANK)
    .insert([{ ...item, createdAt: new Date().toISOString(), usageCount: 0 }])
    .select()
    .single();
  if (error) throw error;
  return data.id;
};

export const deleteFromQBank = async (id: string) => {
  const { error } = await supabase.from(QBANK).delete().eq('id', id);
  if (error) throw error;
};
