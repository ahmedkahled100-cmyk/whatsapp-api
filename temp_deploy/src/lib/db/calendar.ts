// src/lib/db/calendar.ts
import { 
  collection, getDocs, setDoc, deleteDoc, onSnapshot, query, where, addDoc, doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { EVENTS } from './constants';
import type { CalendarEvent } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getCalendarEvents = async (teacherId: string): Promise<CalendarEvent[]> => {
  const q = query(collection(db, EVENTS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as CalendarEvent));
};

export const saveCalendarEvent = async (event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<string> => {
  if (event.id) {
    await setDoc(doc(db, EVENTS, event.id), event);
    return event.id;
  }
  const ref = await addDoc(collection(db, EVENTS), { ...event, createdAt: new Date().toISOString() });
  return ref.id;
};

export const deleteCalendarEvent = async (id: string) => {
  await deleteDoc(doc(db, EVENTS, id));
};

export const subscribeToCalendarEvents = (teacherId: string, callback: (data: CalendarEvent[]) => void) => {
  const q = query(collection(db, EVENTS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as CalendarEvent)));
  });
};
