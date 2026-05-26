// src/lib/db/settings.ts
import { 
  collection, doc, getDocs, setDoc, query, where, limit, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { SETTINGS } from './constants';
import type { Settings } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getSettings = async (teacherId: string): Promise<Settings | null> => {
  if (!teacherId || teacherId === 'unknown_teacher' || teacherId === 'undefined') return null;
  const q = query(collection(db, SETTINGS), where('teacherId', '==', teacherId), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id } as Settings;
};

export const saveSettings = async (settings: Partial<Settings> & { teacherId: string }) => {
  if (!settings.teacherId || settings.teacherId === 'unknown_teacher' || settings.teacherId === 'undefined') {
    console.error('saveSettings: Invalid teacherId', settings.teacherId);
    return;
  }
  if (settings.id) {
    await setDoc(doc(db, SETTINGS, settings.id), settings, { merge: true });
  } else {
    const q = query(collection(db, SETTINGS), where('teacherId', '==', settings.teacherId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await setDoc(doc(db, SETTINGS, snap.docs[0].id), settings, { merge: true });
    } else {
      await addDoc(collection(db, SETTINGS), settings);
    }
  }
};
