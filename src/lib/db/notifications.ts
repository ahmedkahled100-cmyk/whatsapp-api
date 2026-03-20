// src/lib/db/notifications.ts
import { 
  collection, addDoc, getDocs, setDoc, onSnapshot, 
  query, where, orderBy, limit, writeBatch, doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { NOTIFICATIONS, NOTIFICATION_LOGS } from './constants';
import type { Notification, NotificationLog } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const addNotification = async (teacherId: string, msg: string, type: Notification['type'] = 'info', targetUsers?: string[]) => {
  const data: any = {
    teacherId, msg, type, read: false,
    time: new Date().toLocaleString('ar-EG'),
    createdAt: Date.now(),
  };
  if (targetUsers && targetUsers.length > 0) {
    data.targetUsers = targetUsers;
  }
  await addDoc(collection(db, NOTIFICATIONS), data);
};

export const markAllNotificationsRead = async (teacherId: string) => {
  const q = query(collection(db, NOTIFICATIONS), where('teacherId', '==', teacherId), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

export const subscribeToNotifications = (teacherId: string, callback: (notifs: Notification[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') {
    return () => {};
  }
  const q = query(
    collection(db, NOTIFICATIONS),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Notification)));
  });
};

// Notification Logs
export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'> & { id?: string }): Promise<string> => {
  if (log.id) {
    await setDoc(doc(db, NOTIFICATION_LOGS, log.id), { ...log, updatedAt: Date.now() }, { merge: true });
    return log.id;
  }
  const ref = await addDoc(collection(db, NOTIFICATION_LOGS), { ...log, createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
};

export const getNotificationLogs = async (teacherId: string): Promise<NotificationLog[]> => {
  const q = query(
    collection(db, NOTIFICATION_LOGS),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as NotificationLog));
};

export const subscribeToNotificationLogs = (teacherId: string, callback: (logs: NotificationLog[]) => void) => {
  const q = query(
    collection(db, NOTIFICATION_LOGS),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as NotificationLog)));
  });
};

export const updateNotificationLog = async (id: string, updates: Partial<NotificationLog>) => {
  await setDoc(doc(db, NOTIFICATION_LOGS, id), { ...updates, updatedAt: Date.now() }, { merge: true });
};

export interface DispatchOptions {
  teacherId: string;
  msg: string;
  type?: Notification['type'];
  targetUsers?: string[];
  targetRoles?: ('admin' | 'student')[];
  channels: { inApp: boolean; whatsapp: boolean };
  whatsappNumbers?: string[];
}

export const dispatchNotification = async (options: DispatchOptions) => {
  const { teacherId, msg, type = 'info', targetUsers, targetRoles, channels, whatsappNumbers } = options;

  if (channels.inApp) {
    const data: any = {
      teacherId, msg, type, read: false,
      time: new Date().toLocaleString('ar-EG'),
      createdAt: Date.now(),
    };
    if (targetUsers && targetUsers.length > 0) data.targetUsers = targetUsers;
    if (targetRoles && targetRoles.length > 0) data.targetRoles = targetRoles;
    await addDoc(collection(db, NOTIFICATIONS), data);
  }

  if (channels.whatsapp && whatsappNumbers && whatsappNumbers.length > 0) {
    for (const phone of whatsappNumbers) {
      if (!phone) continue;
      try {
        const logId = await saveNotificationLog({
          teacherId,
          type: 'whatsapp',
          target: phone,
          status: 'pending',
          message: msg,
          createdAt: Date.now()
        } as any);

        const res = await fetch('/api/whatsapp/send', {
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
        console.error('WhatsApp dispatch error:', err);
      }
    }
  }
};
