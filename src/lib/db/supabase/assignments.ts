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
  const payload = toDB({ ...assign });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (assign.id) {
    const { error } = await supabase.from(ASSIGNMENTS).update(payload).eq('id', assign.id);
    if (error) throw error;
    return assign.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from(ASSIGNMENTS).insert([{ ...payload, id: newId, created_at: new Date().toISOString() }]).select().single();
    if (error) throw error;
    return data.id;
  }
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
  if (sub.id) {
    const { error } = await supabase.from(ASSIGN_SUBS).update(payload).eq('id', sub.id);
    if (error) throw error;
    return sub.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from(ASSIGN_SUBS).insert([{ ...payload, id: newId }]).select().single();
    if (error) throw error;
    return data.id;
  }
};
