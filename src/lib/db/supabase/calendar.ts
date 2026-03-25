// src/lib/db/supabase/calendar.ts
import { supabase } from '@/lib/supabase';
import { EVENTS } from '../constants';
import type { CalendarEvent } from '@/types';

export const getCalendarEvents = async (teacherId: string): Promise<CalendarEvent[]> => {
  const { data, error } = await supabase
    .from(EVENTS)
    .select('*')
    .eq('teacherId', teacherId);
  if (error) throw error;
  return data as CalendarEvent[];
};

export const saveCalendarEvent = async (event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<string> => {
  if (event.id) {
    const { error } = await supabase.from(EVENTS).update(event).eq('id', event.id);
    if (error) throw error;
    return event.id;
  } else {
    const { data, error } = await supabase
      .from(EVENTS)
      .insert([{ ...event, createdAt: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteCalendarEvent = async (id: string) => {
  const { error } = await supabase.from(EVENTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToCalendarEvents = (teacherId: string, callback: (data: CalendarEvent[]) => void) => {
  const channel = supabase
    .channel(`calendar:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: EVENTS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const events = await getCalendarEvents(teacherId);
        callback(events);
      }
    )
    .subscribe();

  getCalendarEvents(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
