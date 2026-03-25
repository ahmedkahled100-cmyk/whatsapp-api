// src/lib/db/supabase/students.ts
import { supabase } from '@/lib/supabase';
import { STUDENTS, ATTEMPTS, GROUPS, REG_REQUESTS } from '../constants';
import type { Student, Group, RegistrationRequest } from '@/types';

export const getStudents = async (teacherId: string): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('teacherId', teacherId);
  
  if (error) throw error;
  return data as Student[];
};

export const getAllStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from(STUDENTS).select('*');
  if (error) throw error;
  return data as Student[];
};

export const getStudentByCode = async (code: string): Promise<Student | null> => {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  
  if (error) throw error;
  return data as Student | null;
};

export const getStudentByParentPhone = async (parentPhone: string): Promise<Student | null> => {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('parentPhone', parentPhone.trim())
    .maybeSingle();
  if (error) throw error;
  return data as Student | null;
};

export const saveStudent = async (student: Omit<Student, 'id'> & { id?: string }): Promise<string> => {
  const payload = { ...student };
  
  if (student.id) {
    const { error } = await supabase
      .from(STUDENTS)
      .update(payload)
      .eq('id', student.id);
    if (error) throw error;
    return student.id;
  } else {
    const { data, error } = await supabase
      .from(STUDENTS)
      .insert([{ ...payload, createdAt: Date.now() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteStudent = async (id: string) => {
  const { error: studentErr } = await supabase.from(STUDENTS).delete().eq('id', id);
  if (studentErr) throw studentErr;
  
  const { error: attemptErr } = await supabase.from(ATTEMPTS).delete().eq('studentId', id);
  if (attemptErr) throw attemptErr;
};

export const subscribeToStudents = (teacherId: string, callback: (students: Student[]) => void) => {
  const channel = supabase
    .channel(`students:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const students = await getStudents(teacherId);
        callback(students);
      }
    )
    .subscribe();

  // Initial fetch
  getStudents(teacherId).then(callback);
  
  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToAllStudents = (callback: (students: Student[]) => void) => {
  const channel = supabase
    .channel('all_students')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS },
      async () => {
        const students = await getAllStudents();
        callback(students);
      }
    )
    .subscribe();
  
  getAllStudents().then(callback);
  return () => supabase.removeChannel(channel);
};

// Groups
export const getGroups = async (teacherId: string): Promise<Group[]> => {
  const { data, error } = await supabase
    .from(GROUPS)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as Group[];
};

export const saveGroup = async (group: Omit<Group, 'id'> & { id?: string }): Promise<string> => {
  if (group.id) {
    const { error } = await supabase.from(GROUPS).update(group).eq('id', group.id);
    if (error) throw error;
    return group.id;
  } else {
    const { data, error } = await supabase
      .from(GROUPS)
      .insert([{ ...group, createdAt: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteGroup = async (id: string) => {
  const { error } = await supabase.from(GROUPS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToGroups = (teacherId: string, callback: (groups: Group[]) => void) => {
  const channel = supabase
    .channel(`groups:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: GROUPS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const groups = await getGroups(teacherId);
        callback(groups);
      }
    )
    .subscribe();

  getGroups(teacherId).then(callback);
  
  return () => {
    supabase.removeChannel(channel);
  };
};

export const getRegistrationRequests = async (teacherId: string): Promise<RegistrationRequest[]> => {
  const { data, error } = await supabase
    .from(REG_REQUESTS)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as RegistrationRequest[];
};

export const saveRegistrationRequest = async (req: Omit<RegistrationRequest, 'id'> & { id?: string }): Promise<string> => {
  if (req.id) {
    const { error } = await supabase.from(REG_REQUESTS).update(req).eq('id', req.id);
    if (error) throw error;
    return req.id;
  } else {
    const { data, error } = await supabase
      .from(REG_REQUESTS)
      .insert([{ ...req, createdAt: Date.now() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteRegistrationRequest = async (id: string) => {
  const { error } = await supabase.from(REG_REQUESTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToRegistrationRequests = (teacherId: string, callback: (requests: RegistrationRequest[]) => void) => {
  const channel = supabase
    .channel(`reg_reqs:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: REG_REQUESTS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const reqs = await getRegistrationRequests(teacherId);
        callback(reqs);
      }
    )
    .subscribe();

  getRegistrationRequests(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
