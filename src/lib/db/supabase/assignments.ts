// src/lib/db/supabase/assignments.ts
import { supabase } from '@/lib/supabase';
import { ASSIGNMENTS, ASSIGN_SUBS } from '../constants';
import type { Assignment, AssignmentSubmission } from '@/types';

export const getAssignments = async (teacherId: string): Promise<Assignment[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(ASSIGNMENTS)
    .select('*')
    .eq('teacherId', teacherId)
    .order('dueDate', { ascending: false });
  if (error) throw error;
  return data as Assignment[];
};

export const saveAssignment = async (assign: Omit<Assignment, 'id'> & { id?: string }): Promise<string> => {
  if (assign.id) {
    const { error } = await supabase.from(ASSIGNMENTS).update(assign).eq('id', assign.id);
    if (error) throw error;
    return assign.id;
  } else {
    const { data, error } = await supabase
      .from(ASSIGNMENTS)
      .insert([{ ...assign, createdAt: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteAssignment = async (id: string) => {
  const { error: assignErr } = await supabase.from(ASSIGNMENTS).delete().eq('id', id);
  if (assignErr) throw assignErr;
  
  const { error: subErr } = await supabase.from(ASSIGN_SUBS).delete().eq('assignmentId', id);
  if (subErr) throw subErr;
};

export const subscribeToAssignments = (teacherId: string, callback: (data: Assignment[]) => void) => {
  const channel = supabase
    .channel(`assigns:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: ASSIGNMENTS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const assigns = await getAssignments(teacherId);
        callback(assigns);
      }
    )
    .subscribe();

  getAssignments(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

export const getAssignmentSubmissions = async (assignmentId: string): Promise<AssignmentSubmission[]> => {
  const { data, error } = await supabase
    .from(ASSIGN_SUBS)
    .select('*')
    .eq('assignmentId', assignmentId);
  if (error) throw error;
  return data as AssignmentSubmission[];
};

export const submitAssignment = async (submission: Omit<AssignmentSubmission, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(ASSIGN_SUBS)
    .insert([submission])
    .select()
    .single();
  if (error) throw error;
  return data.id;
};

export const gradeSubmission = async (submissionId: string, score: number, comment?: string, status: string = 'graded') => {
  const { error } = await supabase
    .from(ASSIGN_SUBS)
    .update({
      score,
      teacherComment: comment || '',
      status
    })
    .eq('id', submissionId);
  if (error) throw error;
};

export const getStudentSubmissions = async (studentId: string): Promise<AssignmentSubmission[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const { data, error } = await supabase
    .from(ASSIGN_SUBS)
    .select('*')
    .eq('studentId', studentId);
  if (error) throw error;
  return data as AssignmentSubmission[];
};

export const saveAssignmentSubmission = async (sub: Omit<AssignmentSubmission, 'id'> & { id?: string }): Promise<string> => {
  if (sub.id) {
    const { error } = await supabase.from(ASSIGN_SUBS).update(sub).eq('id', sub.id);
    if (error) throw error;
    return sub.id;
  } else {
    const { data, error } = await supabase
      .from(ASSIGN_SUBS)
      .insert([sub])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};
