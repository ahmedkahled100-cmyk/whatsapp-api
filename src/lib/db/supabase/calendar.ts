// src/lib/db/supabase/calendar.ts
import { supabase } from '@/lib/supabase';
import { EVENTS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { CalendarEvent } from '@/types';

export const getCalendarEvents = async (teacherId: string): Promise<CalendarEvent[]> => {
  const { data, error } = await supabase.from(EVENTS).select('*').eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<CalendarEvent>(data);
};

export const saveCalendarEvent = async (event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<string> => {
  const raw = toDB({ ...event });
  const payload = { ...raw };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  
  if (!payload.id) {
    payload.id = crypto.randomUUID();
    payload.created_at = new Date().toISOString();
  }

  // Supabase timestamptz columns require full ISO strings.
  // If the frontend passes just '08:00', convert it to a valid timestamp.
  const formatTime = (timeStr: string, dateStr: string) => {
    if (!timeStr) return null;
    if (timeStr.includes('T')) return timeStr; // Already ISO
    const baseDate = dateStr ? dateStr.split('T')[0] : new Date().toISOString().split('T')[0];
    return `${baseDate}T${timeStr}:00.000Z`;
  };

  if ('start_time' in payload) payload.start_time = formatTime(payload.start_time, payload.date);
  if ('end_time' in payload) payload.end_time = formatTime(payload.end_time, payload.date);

  
  let { data, error } = await supabase.from(EVENTS).upsert(payload).select('id').single();
  
  // Fallback for PGRST204 (Missing Columns in DB Schema)
  if (error && error.code === 'PGRST204') {
    console.warn('Database schema missing columns. Retrying with safe whitelist...');
    const SAFE_COLS = ['id', 'teacher_id', 'title', 'description', 'start_time', 'end_time', 'created_at'];
    const safePayload: Record<string, any> = {};
    SAFE_COLS.forEach(c => { if (payload[c] !== undefined) safePayload[c] = payload[c]; });
    if (!safePayload.id) {
      safePayload.id = crypto.randomUUID();
      safePayload.created_at = new Date().toISOString();
    }
    const retry = await supabase.from(EVENTS).upsert(safePayload).select('id').single();
    if (retry.error) throw retry.error;
    return retry.data?.id || safePayload.id;
  }
  
  if (error) throw error;
  return data?.id || payload.id;
};

export const deleteCalendarEvent = async (id: string) => {
  const { error } = await supabase.from(EVENTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToCalendarEvents = (teacherId: string, callback: (data: CalendarEvent[]) => void) => {
  const fetch = async () => {
    const events = await getCalendarEvents(teacherId);
    callback(events);
  };
  const channel = supabase
    .channel(`calendar:${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: EVENTS, filter: `teacher_id=eq.${teacherId}` }, fetch)
    .subscribe();
  fetch();
  return () => supabase.removeChannel(channel);
};
