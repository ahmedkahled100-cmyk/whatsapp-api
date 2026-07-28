// src/lib/db/supabase/assignments.ts
import { supabase } from '@/lib/supabase';
import { ASSIGNMENTS, ASSIGN_SUBS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Assignment, AssignmentSubmission } from '@/types';

export const getAssignments = async (teacherId: string): Promise<Assignment[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase.from(ASSIGNMENTS).select('*').eq('teacher_id', teacherId).order('due_date', { ascending: false });
  if (error) throw error;
  return manyFromDB<Assignment>(data);
};

export const saveAssignment = async (assign: Omit<Assignment, 'id'> & { id?: string }): Promise<string> => {
  const raw = toDB({ ...assign });
  const payload = { ...raw };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  
  if (!payload.id) {
    payload.id = crypto.randomUUID();
    payload.created_at = new Date().toISOString();
  }
  
  let { data, error } = await supabase.from(ASSIGNMENTS).upsert(payload).select('id').single();
  
  // Fallback for PGRST204 (Missing Columns in DB Schema)
  if (error && error.code === 'PGRST204') {
    console.warn('Database schema missing columns. Retrying with safe whitelist...');
    const SAFE_COLS = ['id', 'teacher_id', 'title', 'description', 'due_date', 'created_at'];
    const safePayload: Record<string, any> = {};
    SAFE_COLS.forEach(c => { if (payload[c] !== undefined) safePayload[c] = payload[c]; });
    if (!safePayload.id) {
      safePayload.id = crypto.randomUUID();
      safePayload.created_at = new Date().toISOString();
    }
    const retry = await supabase.from(ASSIGNMENTS).upsert(safePayload).select('id').single();
    if (retry.error) throw retry.error;
    return retry.data?.id || safePayload.id;
  }
  
  if (error) throw error;
  return data?.id || payload.id;
};

export const deleteAssignment = async (id: string) => {
  await supabase.from(ASSIGN_SUBS).delete().eq('assignment_id', id);
  const { error } = await supabase.from(ASSIGNMENTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToAssignments = (teacherId: string, callback: (data: Assignment[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') { callback([]); return () => {}; }
  const fetch = async () => {
    const assigns = await getAssignments(teacherId);
    callback(assigns);
  };
  const channel = supabase
    .channel(`assigns:${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: ASSIGNMENTS, filter: `teacher_id=eq.${teacherId}` }, fetch)
    .subscribe();
  fetch();
  return () => supabase.removeChannel(channel);
};

export const getAssignmentSubmissions = async (assignmentId: string): Promise<AssignmentSubmission[]> => {
  const { data, error } = await supabase.from(ASSIGN_SUBS).select('*').eq('assignment_id', assignmentId);
  if (error) throw error;
  return manyFromDB<AssignmentSubmission>(data);
};

export const submitAssignment = async (submission: Omit<AssignmentSubmission, 'id'>): Promise<string> => {
  const payload = toDB({ ...submission });
  const { data, error } = await supabase.from(ASSIGN_SUBS).insert([payload]).select().single();
  if (error) throw error;
  return data.id;
};

export const gradeSubmission = async (submissionId: string, score: number, comment?: string, status: string = 'graded') => {
  const { error } = await supabase.from(ASSIGN_SUBS).update({ score, teacher_comment: comment || '', status }).eq('id', submissionId);
  if (error) throw error;
};

export const getStudentSubmissions = async (studentId: string): Promise<AssignmentSubmission[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const { data, error } = await supabase.from(ASSIGN_SUBS).select('*').eq('student_id', studentId);
  if (error) throw error;
  return manyFromDB<AssignmentSubmission>(data);
};

export const saveAssignmentSubmission = async (sub: Omit<AssignmentSubmission, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...sub });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  
  if (!payload.id) {
    payload.id = crypto.randomUUID();
    payload.submitted_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase.from(ASSIGN_SUBS).upsert(payload).select('id').single();
  if (error) throw error;
  return data?.id || payload.id;
};
