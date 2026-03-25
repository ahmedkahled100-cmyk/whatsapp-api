// src/lib/db/supabase/teachers.ts
import { supabase } from '@/lib/supabase';
import { TEACHERS } from '../constants';
import type { TeacherUser } from '@/types';

export const getTeachers = async (): Promise<TeacherUser[]> => {
  const { data, error } = await supabase.from(TEACHERS).select('*');
  if (error) throw error;
  return data as TeacherUser[];
};

export const getSuperAdmin = async (): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('role', 'super_admin')
    .maybeSingle();
  if (error) throw error;
  return data as TeacherUser | null;
};

export const getTeacherByUsername = async (username: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data as TeacherUser | null;
};

export const getTeacherByCode = async (code: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data as TeacherUser | null;
};

export const getTeacherById = async (id: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TeacherUser | null;
};

export const saveTeacher = async (teacher: Omit<TeacherUser, 'id'> & { id?: string }): Promise<string> => {
  const payload: any = { 
    ...teacher, 
    username: (teacher.username || '').trim().toLowerCase() 
  };
  
  if (teacher.code) {
    payload.code = teacher.code.trim().toUpperCase();
  }

  if (teacher.id) {
    const { error } = await supabase.from(TEACHERS).update(payload).eq('id', teacher.id);
    if (error) throw error;
    return teacher.id;
  } else {
    const { data, error } = await supabase
      .from(TEACHERS)
      .insert([{ ...payload, createdAt: Date.now(), isActive: true }])
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

export const getTeacherByPhone = async (phone: string): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('phone', phone.trim())
    .maybeSingle();
  if (error) throw error;
  return data as TeacherUser | null;
};
