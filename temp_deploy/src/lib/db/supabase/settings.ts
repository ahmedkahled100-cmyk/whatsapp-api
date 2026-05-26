// src/lib/db/supabase/settings.ts
import { supabase } from '@/lib/supabase';
import { SETTINGS } from '../constants';
import { fromDB, toDB } from './dbUtils';
import type { Settings } from '@/types';

export const getSettings = async (teacherId: string): Promise<Settings | null> => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') return null;
  const { data, error } = await supabase.from(SETTINGS).select('*').eq('teacher_id', teacherId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  
  const settings = fromDB<Settings>(data);
  
  // Deserialize extras from paymentMethods if present (Workaround for missing columns)
  if (settings.paymentMethods && settings.paymentMethods.includes('|SET:')) {
    try {
      const match = settings.paymentMethods.match(/\|SET:(.*?)\|/);
      if (match && match[1]) {
        const extras = JSON.parse(match[1]);
        Object.assign(settings, extras);
        // Clean up paymentMethods text for display
        settings.paymentMethods = settings.paymentMethods.replace(/\|SET:.*?\|/, '').trim();
      }
    } catch (e) {
      console.error('Failed to parse settings extras', e);
    }
  }
  
  return settings;
};

export const saveSettings = async (settings: Partial<Settings> & { teacherId: string }) => {
  if (!settings.teacherId || settings.teacherId === 'unknown_teacher' || settings.teacherId === 'undefined') {
    console.error('saveSettings: Invalid teacherId', settings.teacherId);
    return;
  }
  const payload = toDB({ ...settings });
  
  // Serialize extras into payment_methods to prevent data loss (Workaround for missing columns)
  const extraPayload: any = {};
  const possibleExtras = ['whatsappNumber', 'whatsappEnabled', 'whatsappTemplate'];
  
  possibleExtras.forEach(key => {
    if ((settings as any)[key] !== undefined) {
      extraPayload[key] = (settings as any)[key];
    }
  });

  if (Object.keys(extraPayload).length > 0) {
    const serialized = `|SET:${JSON.stringify(extraPayload)}|`;
    payload.payment_methods = payload.payment_methods 
      ? `${payload.payment_methods} ${serialized}` 
      : serialized;
  }

  // teacher_password is not in the Supabase schema for the settings table
  delete payload.teacher_password;
  // Remove possible duplicate snake_case versions that might cause 400 if columns missing
  const fieldsToRemove = ['whatsapp_number', 'whatsapp_enabled', 'whatsapp_template'];
  fieldsToRemove.forEach(f => delete payload[f]);
  
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

export const subscribeToSettings = (teacherId: string, callback: (settings: Settings | null) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') {
    callback(null);
    return () => {};
  }
  const channel = supabase
    .channel(`settings:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SETTINGS, filter: `teacher_id=eq.${teacherId}` },
      async () => {
        const s = await getSettings(teacherId);
        callback(s);
      }
    )
    .subscribe();
  
  getSettings(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
