// src/lib/db/supabase/settings.ts
import { supabase } from '@/lib/supabase';
import { SETTINGS } from '../constants';
import { fromDB, toDB } from './dbUtils';
import type { Settings } from '@/types';

export const getSettings = async (teacherId: string): Promise<Settings | null> => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') return null;
  const { data, error } = await supabase.from(SETTINGS).select('*').eq('teacher_id', teacherId).maybeSingle();
  if (error) throw error;
  return data ? fromDB<Settings>(data) : null;
};

export const saveSettings = async (settings: Partial<Settings> & { teacherId: string }) => {
  if (!settings.teacherId || settings.teacherId === 'unknown_teacher' || settings.teacherId === 'undefined') {
    console.error('saveSettings: Invalid teacherId', settings.teacherId);
    return;
  }
  const payload = toDB({ ...settings });
  // teacher_password is not in the Supabase schema for the settings table
  delete payload.teacher_password;
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  const { data: existing } = await supabase.from(SETTINGS).select('id').eq('teacher_id', settings.teacherId).maybeSingle();
  if (existing || settings.id) {
    const id = existing?.id || settings.id;
    const { error } = await supabase.from(SETTINGS).update(payload).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(SETTINGS).insert([payload]);
    if (error) throw error;
  }
};
