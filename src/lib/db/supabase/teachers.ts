// src/lib/db/supabase/teachers.ts
import { supabase } from '@/lib/supabase';
import { TEACHERS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { TeacherUser } from '@/types';

export const getTeachers = async (): Promise<TeacherUser[]> => {
  const { data, error } = await supabase.from(TEACHERS).select('*');
  if (error) throw error;
  return manyFromDB<TeacherUser>(data);
};

export const getSuperAdmin = async (): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('role', 'super_admin')
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<TeacherUser>(data) : null;
};

export const getTeacherByUsername = async (username: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<TeacherUser>(data) : null;
};

export const getTeacherByCode = async (code: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<TeacherUser>(data) : null;
};

export const getTeacherById = async (id: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<TeacherUser>(data) : null;
};

export const getTeacherByPhone = async (phone: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('phone', phone.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? fromDB<TeacherUser>(data) : null;
};

export const saveTeacher = async (teacher: Omit<TeacherUser, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({
    ...teacher,
    username: (teacher.username || '').trim().toLowerCase(),
    code: teacher.code ? teacher.code.trim().toUpperCase() : undefined,
  });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (teacher.id) {
    // Upsert using Firebase UID as the primary key
    const { error } = await supabase
      .from(TEACHERS)
      .upsert([{ ...payload, id: teacher.id, created_at: payload.created_at ?? Date.now(), is_active: payload.is_active ?? true }], { onConflict: 'id' });
    if (error) throw error;
    return teacher.id;
  } else {
    // Generate an ID if not provided to avoid NULL primary key error
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(TEACHERS)
      .insert([{ ...payload, id: newId, created_at: Date.now(), is_active: true }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const updateSuperAdminCredentials = async (id: string, username: string, password?: string) => {
  const data: any = { username: username.trim().toLowerCase() };
  if (password) data.password = password;
  const { error } = await supabase.from(TEACHERS).update(data).eq('id', id);
  if (error) throw error;
};

export const deleteTeacher = async (id: string) => {
  const teacher = await getTeacherById(id);
  if (teacher?.role === 'super_admin') {
    throw new Error('لا يمكن حذف حساب المدير العام (Super Admin)');
  }
  const { error } = await supabase.from(TEACHERS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToTeachers = (callback: (teachers: TeacherUser[]) => void) => {
  const noop = () => {};
  // Don't subscribe if no valid session
  const channel = supabase
    .channel('all_teachers')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TEACHERS },
      async () => {
        const teachers = await getTeachers();
        callback(teachers);
      }
    )
    .subscribe();
  getTeachers().then(callback);
  return () => supabase.removeChannel(channel);
};

export const subscribeToTeacherProfile = (teacherId: string, callback: (teacher: TeacherUser | null) => void) => {
  // Guard against invalid IDs - malformed filter causes 400 errors
  if (!teacherId || teacherId === 'undefined' || teacherId === 'unknown_teacher') {
    callback(null);
    return () => {};
  }
  const channel = supabase
    .channel(`teacher:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TEACHERS, filter: `id=eq.${teacherId}` },
      async () => {
        const profile = await getTeacherById(teacherId);
        callback(profile);
      }
    )
    .subscribe();
  getTeacherById(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
