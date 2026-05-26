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
  const payload = toDB({ ...event });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (event.id) {
    const { error } = await supabase.from(EVENTS).update(payload).eq('id', event.id);
    if (error) throw error;
    return event.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from(EVENTS).insert([{ ...payload, id: newId, created_at: new Date().toISOString() }]).select().single();
    if (error) throw error;
    return data.id;
  }
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
