// src/lib/db/supabase/teachers.ts
import { supabase } from '@/lib/supabase';
import { TEACHERS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import { checkUserUniqueness } from './validation';
import type { TeacherUser } from '@/types';

const decode = (str: string) => {
  try {
    return typeof window !== 'undefined' && typeof atob !== 'undefined'
      ? decodeURIComponent(escape(atob(str))) 
      : Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
};

const encode = (str: string) => {
  try {
    return typeof window !== 'undefined' && typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf-8').toString('base64');
  } catch {
    return str;
  }
};

export const getTeachers = async (): Promise<TeacherUser[]> => {
  const { data, error } = await supabase.from(TEACHERS).select('*');
  if (error) throw error;
  
  return manyFromDB<TeacherUser>(data).map(teacher => {
    // Fallback deserialize from notes field if native columns are empty
    const t = teacher as any;
    if ((teacher.totalPaid === undefined || teacher.totalPaid === null) && t.notes) {
      const tpMatch = t.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) teacher.totalPaid = parseInt(tpMatch[1]);
    }
    if ((!teacher.paymentHistory || teacher.paymentHistory.length === 0) && t.notes) {
      const histMatch = t.notes.match(/\[HIST:(.*?)\]/);
      if (histMatch) {
         try { teacher.paymentHistory = JSON.parse(decode(histMatch[1])); } catch {}
      }
    }
    return teacher;
  });
};

export const getSuperAdmin = async (): Promise<TeacherUser | null> => {
  const { data, error } = await supabase
    .from(TEACHERS)
    .select('*')
    .eq('role', 'super_admin')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const admin = fromDB<TeacherUser>(data);
  const t = admin as any;
  if ((admin.totalPaid === undefined || admin.totalPaid === null) && t.notes) {
      const tpMatch = t.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) admin.totalPaid = parseInt(tpMatch[1]);
  }
  if ((!admin.paymentHistory || admin.paymentHistory.length === 0) && t.notes) {
      const histMatch = t.notes.match(/\[HIST:(.*?)\]/);
      if (histMatch) {
         try { admin.paymentHistory = JSON.parse(decode(histMatch[1])); } catch {}
      }
  }
  return admin;
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
  if (!data) return null;
  const teacher = fromDB<TeacherUser>(data);
  const t = teacher as any;
  if ((teacher.totalPaid === undefined || teacher.totalPaid === null) && t.notes) {
      const tpMatch = t.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) teacher.totalPaid = parseInt(tpMatch[1]);
  }
  if ((!teacher.paymentHistory || teacher.paymentHistory.length === 0) && t.notes) {
      const histMatch = t.notes.match(/\[HIST:(.*?)\]/);
      if (histMatch) {
         try { teacher.paymentHistory = JSON.parse(decode(histMatch[1])); } catch {}
      }
  }
  return teacher;
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

  await checkUserUniqueness(teacher.code, teacher.username, teacher.id);

  if (teacher.id) {
    const { error } = await supabase
      .from(TEACHERS)
      .upsert([{ ...payload, id: teacher.id, created_at: payload.created_at ?? Date.now(), is_active: payload.is_active ?? true }], { onConflict: 'id' });
    if (error) throw error;
    return teacher.id;
  } else {
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
