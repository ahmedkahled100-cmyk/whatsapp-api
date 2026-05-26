// src/lib/db/supabase/exams.ts
import { supabase } from '@/lib/supabase';
import { EXAMS, ATTEMPTS, QBANK } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Exam, Attempt, QuestionBankItem } from '@/types';

export const getExams = async (teacherId: string): Promise<Exam[]> => {
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<Exam>(data).map(e => ({ ...e, desc: (e as any).description }));
};

export const getPublishedExams = async (teacherId: string): Promise<Exam[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('published', true);
  if (error) throw error;
  return manyFromDB<Exam>(data).map(e => ({ ...e, desc: (e as any).description }));
};

export const getExam = async (id: string): Promise<Exam | null> => {
  const { data, error } = await supabase
    .from(EXAMS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const exam = fromDB<Exam>(data);
  return { ...exam, desc: (exam as any).description };
};

export const saveExam = async (exam: Omit<Exam, 'id'> & { id?: string }): Promise<string> => {
  const raw = toDB({ ...exam });

  // Map desc -> description
  if (raw.desc) { raw.description = raw.desc; }

  // Fix ISO dates
  ['start_time', 'end_time'].forEach(k => {
    if (raw[k] && typeof raw[k] === 'string') {
      const d = new Date(raw[k]);
      raw[k] = isNaN(d.getTime()) ? null : d.toISOString();
    }
  });

  // Strict whitelist: only columns that exist in the exams table
  const VALID_COLS = [
    'id', 'title', 'description', 'subject', 'duration', 'pass_score',
    'teacher_id', 'questions', 'shuffle', 'random_pick_count', 'allow_retake',
    'allow_resume', 'show_answers', 'published', 'start_time', 'end_time',
    'created_at', 'image_url', 'pdf_url', 'target_group',
  ];
  const payload: Record<string, any> = {};
  VALID_COLS.forEach(col => {
    if (raw[col] !== undefined && raw[col] !== null) payload[col] = raw[col];
  });

  if (exam.id) {
    const { error } = await supabase.from(EXAMS).update(payload).eq('id', exam.id);
    if (error) throw error;
    return exam.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(EXAMS)
      .insert([{ ...payload, id: newId, created_at: payload.created_at ?? new Date().toISOString() }])
      .select('id')
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
  if (!teacherId || teacherId === 'unknown_teacher') { callback([]); return () => {}; }
  const channel = supabase
    .channel(`exams:${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: EXAMS, filter: `teacher_id=eq.${teacherId}` }, async () => {
      const exams = await getExams(teacherId);
      callback(exams);
    })
    .subscribe();
  getExams(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

// Attempts
export const getAttemptsByStudent = async (studentId: string): Promise<Attempt[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const { data, error } = await supabase
    .from(ATTEMPTS).select('*').eq('student_id', studentId);
  if (error) throw error;
  return manyFromDB<Attempt>(data);
};

export const getAttemptsByExam = async (examId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase
    .from(ATTEMPTS).select('*').eq('exam_id', examId);
  if (error) throw error;
  return manyFromDB<Attempt>(data);
};

export const getAllAttempts = async (teacherId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase
    .from(ATTEMPTS).select('*').eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<Attempt>(data);
};

export const saveAttempt = async (attempt: Omit<Attempt, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...attempt });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (attempt.id) {
    const { error } = await supabase.from(ATTEMPTS).update(payload).eq('id', attempt.id);
    if (error) throw error;
    return attempt.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(ATTEMPTS).insert([{ ...payload, id: newId }]).select().single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteAttempt = async (id: string) => {
  const { error } = await supabase.from(ATTEMPTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToAttempts = (teacherId: string, callback: (attempts: Attempt[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') { callback([]); return () => {}; }
  const channel = supabase
    .channel(`attempts:${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: ATTEMPTS, filter: `teacher_id=eq.${teacherId}` }, async () => {
      const attempts = await getAllAttempts(teacherId);
      callback(attempts);
    })
    .subscribe();
  getAllAttempts(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

// Question Bank
export const getQBank = async (teacherId: string): Promise<QuestionBankItem[]> => {
  const { data, error } = await supabase
    .from(QBANK).select('*').eq('teacher_id', teacherId);
  if (error) throw error;
  // Remap DB columns → UI fields
  return (data || []).map((row: any) => ({
    id: row.id,
    teacherId: row.teacher_id,
    text: row.content ?? row.text ?? '',      // content → text
    type: row.type,
    options: row.options || [],
    correct: row.answer !== undefined ? Number(row.answer) : undefined,
    difficulty: row.grade ?? row.difficulty ?? 'medium',  // grade → difficulty
    subject: row.subject,
    unit: row.unit,
    usageCount: row.usage_count ?? 0,
    createdAt: row.created_at,
    imageUrl: row.image_url,
    pdfUrl: row.pdf_url,
  } as any));
};

export const addToQBank = async (item: Omit<QuestionBankItem, 'id'>): Promise<string> => {
  const q = item as any;
  
  const cleaned: any = {
    teacher_id: String(q.teacherId || q.teacher_id || ''),
    content: q.text || q.content || '',
    type: q.type || 'mcq',
    options: q.options || [],
    answer: q.correct !== undefined ? String(q.correct) : (q.answer !== undefined ? String(q.answer) : null),
    grade: q.difficulty || q.grade || (q.points ? String(q.points) : 'medium'), 
    subject: q.subject || null,
    unit: q.unit || null,
    image_url: q.imageUrl || q.image_url || q.image_uri || null,
    pdf_url: q.pdfUrl || q.pdf_url || q.pdf_uri || null,
    title: q.title || (q.text || q.content || '').substring(0, 70) || null,
    usage_count: 0,
    created_at: new Date().toISOString(),
  };

  // Remove undefined values, keep nulls
  Object.keys(cleaned).forEach(k => { if (cleaned[k] === undefined) delete (cleaned as any)[k]; });

  const { data, error } = await supabase
    .from(QBANK)
    .insert([cleaned])
    .select('id')
    .single();
    
  if (error) {
    console.error("Supabase addToQBank error:", error);
    throw error;
  }
  return data?.id;
};

export const deleteFromQBank = async (id: string) => {
  const { error } = await supabase.from(QBANK).delete().eq('id', id);
  if (error) throw error;
};
