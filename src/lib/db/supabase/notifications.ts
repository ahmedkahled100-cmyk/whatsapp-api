// src/lib/db/supabase/notifications.ts
import { supabase } from '@/lib/supabase';
import { debounceTrailing } from '@/lib/realtime-debounce';
import { NOTIFICATIONS, NOTIFICATION_LOGS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Notification, NotificationLog } from '@/types';

export const addNotification = async (teacherId: string, msg: string, type: Notification['type'] = 'info', targetUsers?: string[], targetRoles?: string[], actionPath?: string, targetGroups?: string[]) => {
  const data: any = {
    teacher_id: teacherId, 
    msg, 
    type, 
    read: false,
    time: new Date().toLocaleString('ar-EG'),
    created_at: Date.now(),
  };
  if (targetUsers && targetUsers.length > 0) data.target_users = targetUsers;
  if (targetRoles && targetRoles.length > 0) data.target_roles = targetRoles;
  if (targetGroups && targetGroups.length > 0) data.target_groups = targetGroups;
  if (actionPath) data.action_path = actionPath;

  const { error } = await supabase.from(NOTIFICATIONS).insert([data]);
  if (error) throw error;
};

export interface DispatchOptions {
  teacherId: string;
  msg: string;
  type?: Notification['type'];
  targetUsers?: string[];
  targetRoles?: ('admin' | 'super_admin' | 'teacher' | 'student' | 'assistant')[];
  targetGroups?: string[];
  channels: { inApp: boolean; whatsapp: boolean };
  whatsappNumbers?: string[];
  actionPath?: string;
}

export const dispatchNotification = async (options: DispatchOptions) => {
  const { teacherId, msg, type = 'info', targetUsers, targetRoles, targetGroups, channels, whatsappNumbers, actionPath } = options;

  if (channels.inApp) {
    if (targetRoles?.includes('teacher')) {
      const { data: teachersList } = await supabase.from('teachers').select('id');
      if (teachersList && teachersList.length > 0) {
        const promises = teachersList.map(t => 
          addNotification(t.id, msg, type, targetUsers, targetRoles, actionPath, targetGroups)
        );
        await Promise.all(promises);
      }
    } else if (targetUsers && targetUsers.length > 0 && !targetRoles?.includes('student')) {
      const promises = targetUsers.map(uid => 
        addNotification(uid, msg, type, targetUsers, targetRoles, actionPath, targetGroups)
      );
      await Promise.all(promises);
    } else {
      await addNotification(teacherId, msg, type, targetUsers, targetRoles, actionPath, targetGroups);
    }

    // Log the In-App notification
    await saveNotificationLog({
      teacherId,
      type: 'inApp',
      target: targetRoles?.includes('admin') || targetRoles?.includes('super_admin') ? 'مختص' : (targetUsers?.length ? 'طالب محدد' : 'الكل'),
      status: 'sent',
      message: msg,
      createdAt: Date.now()
    } as any);
  }

  if (channels.whatsapp && whatsappNumbers && whatsappNumbers.length > 0) {
    const { getApiBase } = await import('@/lib/utils');
    const apiBase = getApiBase();

    // Send WhatsApp concurrently in the background so the caller doesn't wait
    const sendWhatsapp = async (phone: string) => {
      try {
        const logId = await saveNotificationLog({
          teacherId,
          type: 'whatsapp',
          target: phone,
          status: 'pending',
          message: msg,
          createdAt: Date.now()
        } as any);

        const res = await fetch(`${apiBase}/api/whatsapp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: msg })
        });
        
        const result = await res.json();
        if (result.success) {
          await updateNotificationLog(logId, { status: 'sent' });
        } else {
          await updateNotificationLog(logId, { status: 'failed', error: result.error || 'API Error' });
        }
      } catch (err: any) {
        console.error('WhatsApp dispatch error for phone:', phone, err);
      }
    };

    whatsappNumbers.forEach(phone => {
      if (phone) {
        void sendWhatsapp(phone);
      }
    });
  }
};

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from(NOTIFICATIONS).update({ read: true }).eq('id', id);
  if (error) throw error;
};

export const markNotificationsAsReadBulk = async (ids: string[]) => {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.from(NOTIFICATIONS).update({ read: true }).in('id', ids);
  if (error) throw error;
};

export const markAllNotificationsRead = async (teacherId: string) => {
  const { error } = await supabase.from(NOTIFICATIONS).update({ read: true }).eq('teacher_id', teacherId).eq('read', false);
  if (error) throw error;
};

export const subscribeToNotifications = (teacherId: string, callback: (notifs: Notification[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') return () => {};

  let cancelled = false;
  let cachedNotifs: Notification[] = [];

  const runFetch = async () => {
    const { data } = await supabase.from(NOTIFICATIONS).select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(50);
    if (!cancelled) {
      cachedNotifs = manyFromDB<Notification>(data || []);
      callback([...cachedNotifs]);
    }
  };

  const channel = supabase
    .channel(`notifs:${teacherId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIFICATIONS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      const newNotif = fromDB<Notification>(payload.new);
      if (!cachedNotifs.find(n => n.id === newNotif.id)) {
        cachedNotifs = [newNotif, ...cachedNotifs].slice(0, 50);
        callback([...cachedNotifs]);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: NOTIFICATIONS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      const updatedNotif = fromDB<Notification>(payload.new);
      cachedNotifs = cachedNotifs.map(n => n.id === updatedNotif.id ? updatedNotif : n);
      callback([...cachedNotifs]);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: NOTIFICATIONS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      cachedNotifs = cachedNotifs.filter(n => n.id !== payload.old.id);
      callback([...cachedNotifs]);
    })
    .subscribe();

  void runFetch();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...log, updatedAt: Date.now() });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (log.id) {
    const { error } = await supabase.from(NOTIFICATION_LOGS).update(payload).eq('id', log.id);
    if (error) throw error;
    return log.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from(NOTIFICATION_LOGS).insert([{ ...payload, id: newId, created_at: Date.now() }]).select().single();
    if (error) throw error;
    return data.id;
  }
};

export const getNotificationLogs = async (teacherId: string): Promise<NotificationLog[]> => {
  const { data, error } = await supabase.from(NOTIFICATION_LOGS).select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return manyFromDB<NotificationLog>(data);
};

export const subscribeToNotificationLogs = (teacherId: string, callback: (logs: NotificationLog[]) => void) => {
  let cancelled = false;
  let cachedLogs: NotificationLog[] = [];

  const runFetch = async () => {
    const logs = await getNotificationLogs(teacherId);
    if (!cancelled) {
      cachedLogs = logs;
      callback([...cachedLogs]);
    }
  };

  const channel = supabase
    .channel(`notif_logs:${teacherId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIFICATION_LOGS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      const newLog = fromDB<NotificationLog>(payload.new);
      if (!cachedLogs.find(l => l.id === newLog.id)) {
        cachedLogs = [newLog, ...cachedLogs].slice(0, 100);
        callback([...cachedLogs]);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: NOTIFICATION_LOGS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      const updatedLog = fromDB<NotificationLog>(payload.new);
      cachedLogs = cachedLogs.map(l => l.id === updatedLog.id ? updatedLog : l);
      callback([...cachedLogs]);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: NOTIFICATION_LOGS, filter: `teacher_id=eq.${teacherId}` }, (payload) => {
      if (cancelled) return;
      cachedLogs = cachedLogs.filter(l => l.id !== payload.old.id);
      callback([...cachedLogs]);
    })
    .subscribe();

  void runFetch();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

export const updateNotificationLog = async (id: string, updates: Partial<NotificationLog>) => {
  const payload = toDB({ ...updates, updatedAt: Date.now() });
  const { error } = await supabase.from(NOTIFICATION_LOGS).update(payload).eq('id', id);
  if (error) throw error;
};
