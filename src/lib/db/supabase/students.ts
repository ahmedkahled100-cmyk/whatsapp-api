// src/lib/db/supabase/students.ts
import { supabase } from '@/lib/supabase';
import { STUDENTS, ATTEMPTS, GROUPS, REG_REQUESTS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Student, Group, RegistrationRequest } from '@/types';

export const getStudents = async (teacherId: string): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<Student>(data);
};

export const getAllStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from(STUDENTS).select('*');
  if (error) throw error;
  return manyFromDB<Student>(data);
};

export const getStudentByCode = async (code: string): Promise<Student | null> => {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<Student>(data) : null;
};

export const getStudentByParentPhone = async (parentPhone: string): Promise<Student | null> => {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('parent_phone', parentPhone.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<Student>(data) : null;
};

export const getEnrollmentsByParentPhone = async (parentPhone: string): Promise<Student[]> => {
  if (!parentPhone) return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('parent_phone', parentPhone.trim());
  if (error) throw error;
  return manyFromDB<Student>(data);
};

export const getEnrollmentsByPhone = async (phone: string): Promise<Student[]> => {
  if (!phone) return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('phone', phone.trim());
  if (error) throw error;
  return manyFromDB<Student>(data);
};

export const saveStudent = async (student: Omit<Student, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...student, createdAt: student.id ? undefined : Date.now() });
  // Remove undefined values
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  
  delete payload.teacher_code;
  delete payload.teacher_name;

  if (payload.registered_at && typeof payload.registered_at === 'string') {
    const parsed = new Date(payload.registered_at);
    if (isNaN(parsed.getTime())) {
      delete payload.registered_at;
    } else {
      payload.registered_at = parsed.toISOString();
    }
  }

  // Normalize phone numbers
  if (payload.phone) payload.phone = String(payload.phone).trim();
  if (payload.parent_phone) payload.parent_phone = String(payload.parent_phone).trim();
  if (payload.code) payload.code = String(payload.code).trim().toUpperCase();

  if (student.id) {
    const { error } = await supabase
      .from(STUDENTS)
      .update(payload)
      .eq('id', student.id);
    if (error) {
       if (error.code === '23505') throw new Error('DUPLICATE_CODE_OR_PHONE');
       throw error;
    }
    return student.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(STUDENTS)
      .insert([{ ...payload, id: newId }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_CODE_OR_PHONE');
      throw error;
    }
    return data.id;
  }
};

export const deleteStudent = async (id: string) => {
  const { error: attemptErr } = await supabase.from(ATTEMPTS).delete().eq('student_id', id);
  if (attemptErr) console.error('deleteStudent attempts error:', attemptErr);
  const { error: studentErr } = await supabase.from(STUDENTS).delete().eq('id', id);
  if (studentErr) throw studentErr;
};

export const subscribeToStudents = (teacherId: string, callback: (students: Student[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') {
    callback([]);
    return () => {};
  }
  const channel = supabase
    .channel(`students:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS, filter: `teacher_id=eq.${teacherId}` },
      async (payload) => {
        // Only re-fetch if it's an insert/delete or more than a presence update
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          const students = await getStudents(teacherId);
          callback(students);
        } else if (payload.eventType === 'UPDATE') {
          // Check if it's more than just presence (e.g. name, grade, code)
          const n = payload.new as any;
          const o = payload.old as any;
          if (n.name !== o.name || n.grade !== o.grade || n.code !== o.code || n.phone !== o.phone) {
             const students = await getStudents(teacherId);
             callback(students);
          }
        }
      }
    )
    .subscribe();

  getStudents(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

export const subscribeToAllStudents = (callback: (students: Student[]) => void) => {
  const channel = supabase
    .channel('all_students')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS },
      async (payload) => {
        if (payload.eventType !== 'UPDATE' || (payload.new as any).name !== (payload.old as any).name) {
          const students = await getAllStudents();
          callback(students);
        }
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
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<Group>(data).map(g => ({ ...g, desc: (g as any).description }));
};

export const saveGroup = async (group: Omit<Group, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...group });
  
  // Map desc -> description
  if (payload.desc) {
    payload.description = payload.desc;
    delete payload.desc;
  }

  // Sanitize
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (group.id) {
    const { error } = await supabase.from(GROUPS).update(payload).eq('id', group.id);
    if (error) throw error;
    return group.id;
  } else {
    const { data, error } = await supabase
      .from(GROUPS)
      .insert([{ ...payload, created_at: new Date().toISOString() }])
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
      { event: '*', schema: 'public', table: GROUPS, filter: `teacher_id=eq.${teacherId}` },
      async () => {
        const groups = await getGroups(teacherId);
        callback(groups);
      }
    )
    .subscribe();
  getGroups(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

export const getRegistrationRequests = async (teacherId: string): Promise<RegistrationRequest[]> => {
  const { data, error } = await supabase
    .from(REG_REQUESTS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<RegistrationRequest>(data);
};

export const saveRegistrationRequest = async (req: Omit<RegistrationRequest, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...req });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  delete payload.teacher_code;

  if (req.id) {
    const { error } = await supabase.from(REG_REQUESTS).update(payload).eq('id', req.id);
    if (error) throw error;
    return req.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(REG_REQUESTS)
      .insert([{ ...payload, id: newId, created_at: Date.now() }])
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
      { event: '*', schema: 'public', table: REG_REQUESTS, filter: `teacher_id=eq.${teacherId}` },
      async () => {
        const reqs = await getRegistrationRequests(teacherId);
        callback(reqs);
      }
    )
    .subscribe();
  getRegistrationRequests(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
