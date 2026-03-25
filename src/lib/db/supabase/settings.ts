// src/lib/db/supabase/settings.ts
import { supabase } from '@/lib/supabase';
import { SETTINGS } from '../constants';
import type { Settings } from '@/types';

export const getSettings = async (teacherId: string): Promise<Settings | null> => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') return null;
  const { data, error } = await supabase
    .from(SETTINGS)
    .select('*')
    .eq('teacherId', teacherId)
    .maybeSingle();
  if (error) throw error;
  return data as Settings | null;
};

export const saveSettings = async (settings: Partial<Settings> & { teacherId: string }) => {
  if (!settings.teacherId || settings.teacherId === 'unknown_teacher' || settings.teacherId === 'undefined') {
    console.error('saveSettings: Invalid teacherId', settings.teacherId);
    return;
  }
  
  const { data: existing } = await supabase
    .from(SETTINGS)
    .select('id')
    .eq('teacherId', settings.teacherId)
    .maybeSingle();

  if (existing || settings.id) {
    const id = existing?.id || settings.id;
    const { error } = await supabase
      .from(SETTINGS)
      .update(settings)
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(SETTINGS)
      .insert([settings]);
    if (error) throw error;
  }
};
