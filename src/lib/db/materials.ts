// src/lib/db/materials.ts
import { 
  collection, addDoc, getDocs, setDoc, deleteDoc, 
  onSnapshot, query, where, doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { MATERIALS } from './constants';
import type { CourseMaterial } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getMaterials = async (teacherId: string): Promise<CourseMaterial[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(collection(db, MATERIALS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as CourseMaterial));
  return items.sort((a, b) => (a.sequence - b.sequence) || (b.createdAt - a.createdAt));
};

export const saveMaterial = async (material: Omit<CourseMaterial, 'id'> & { id?: string }): Promise<string> => {
  if (material.id) {
    await setDoc(doc(db, MATERIALS, material.id), material);
    return material.id;
  }
  const ref = await addDoc(collection(db, MATERIALS), { ...material, createdAt: Date.now() });
  return ref.id;
};

export const deleteMaterial = async (id: string) => {
  await deleteDoc(doc(db, MATERIALS, id));
};

export const subscribeToMaterials = (teacherId: string, callback: (m: CourseMaterial[]) => void) => {
  const q = query(collection(db, MATERIALS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as CourseMaterial));
    callback(items.sort((a, b) => (a.sequence - b.sequence) || (b.createdAt - a.createdAt)));
  });
};
