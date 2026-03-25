// src/lib/db/supabase/notifications.ts
import { supabase } from '@/lib/supabase';
import { NOTIFICATIONS, NOTIFICATION_LOGS } from '../constants';
import type { Notification, NotificationLog } from '@/types';

export const addNotification = async (teacherId: string, msg: string, type: Notification['type'] = 'info', targetUsers?: string[]) => {
  const data: any = {
    teacherId, 
    msg, 
    type, 
    read: false,
    time: new Date().toLocaleString('ar-EG'),
    createdAt: Date.now(),
  };
  if (targetUsers && targetUsers.length > 0) {
    data.targetUsers = targetUsers;
  }
  const { error } = await supabase.from(NOTIFICATIONS).insert([data]);
  if (error) throw error;
};

export const markAllNotificationsRead = async (teacherId: string) => {
  const { error } = await supabase
    .from(NOTIFICATIONS)
    .update({ read: true })
    .eq('teacherId', teacherId)
    .eq('read', false);
  if (error) throw error;
};

export const subscribeToNotifications = (teacherId: string, callback: (notifs: Notification[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') {
    return () => {};
  }
  
  const channel = supabase
    .channel(`notifs:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: NOTIFICATIONS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const { data } = await supabase
          .from(NOTIFICATIONS)
          .select('*')
          .eq('teacherId', teacherId)
          .order('createdAt', { ascending: false })
          .limit(50);
        callback((data || []) as Notification[]);
      }
    )
    .subscribe();

  supabase
    .from(NOTIFICATIONS)
    .select('*')
    .eq('teacherId', teacherId)
    .order('createdAt', { ascending: false })
    .limit(50)
    .then(({ data }) => callback((data || []) as Notification[]));

  return () => supabase.removeChannel(channel);
};

// Notification Logs
export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'> & { id?: string }): Promise<string> => {
  const payload = { ...log, updatedAt: Date.now() };
  if (log.id) {
    const { error } = await supabase.from(NOTIFICATION_LOGS).update(payload).eq('id', log.id);
    if (error) throw error;
    return log.id;
  } else {
    const { data, error } = await supabase
      .from(NOTIFICATION_LOGS)
      .insert([{ ...payload, createdAt: Date.now() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const getNotificationLogs = async (teacherId: string): Promise<NotificationLog[]> => {
  const { data, error } = await supabase
    .from(NOTIFICATION_LOGS)
    .select('*')
    .eq('teacherId', teacherId)
    .order('createdAt', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as NotificationLog[];
};

export const subscribeToNotificationLogs = (teacherId: string, callback: (logs: NotificationLog[]) => void) => {
  const channel = supabase
    .channel(`notif_logs:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: NOTIFICATION_LOGS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const logs = await getNotificationLogs(teacherId);
        callback(logs);
      }
    )
    .subscribe();

  getNotificationLogs(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

export const updateNotificationLog = async (id: string, updates: Partial<NotificationLog>) => {
  const { error } = await supabase
    .from(NOTIFICATION_LOGS)
    .update({ ...updates, updatedAt: Date.now() })
    .eq('id', id);
  if (error) throw error;
};
