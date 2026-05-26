// src/lib/db/teachers.ts
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, onSnapshot, query, where, limit, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { TEACHERS } from './constants';
import { clean } from './utils';
import type { TeacherUser } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getTeachers = async (): Promise<TeacherUser[]> => {
  const snap = await getDocs(collection(db, TEACHERS));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as TeacherUser));
};

export const getSuperAdmin = async (): Promise<TeacherUser | null> => {
  const q = query(collection(db, TEACHERS), where('role', '==', 'super_admin'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const getTeacherByUsername = async (username: string): Promise<TeacherUser | null> => {
  const q = query(collection(db, TEACHERS), where('username', '==', username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const getTeacherByCode = async (code: string): Promise<TeacherUser | null> => {
  const q = query(collection(db, TEACHERS), where('code', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const getTeacherById = async (id: string): Promise<TeacherUser | null> => {
  const snap = await getDoc(doc(db, TEACHERS, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } as TeacherUser : null;
};

export const saveTeacher = async (teacher: Omit<TeacherUser, 'id'> & { id?: string }): Promise<string> => {
  const cleanTeacher: any = { 
    ...teacher, 
    username: (teacher.username || '').trim().toLowerCase() 
  };
  
  if (teacher.code !== undefined && teacher.code !== null) {
    cleanTeacher.code = teacher.code.trim().toUpperCase();
  }

  if (teacher.id) {
    await setDoc(doc(db, TEACHERS, teacher.id), clean(cleanTeacher), { merge: true });
    return teacher.id;
  }
  const ref = await addDoc(collection(db, TEACHERS), clean({ 
    ...cleanTeacher, 
    createdAt: Date.now(), 
    isActive: teacher.isActive !== undefined ? teacher.isActive : true 
  }));
  return ref.id;
};

export const updateSuperAdminCredentials = async (id: string, username: string, password?: string) => {
  const data: any = { username: username.trim().toLowerCase() };
  if (password) data.password = password;
  await updateDoc(doc(db, TEACHERS, id), clean(data));
};

export const deleteTeacher = async (id: string) => {
  const teacher = await getTeacherById(id);
  if (teacher?.role === 'super_admin') {
    throw new Error('لا يمكن حذف حساب المدير العام (Super Admin)');
  }
  await deleteDoc(doc(db, TEACHERS, id));
};

export const subscribeToTeachers = (callback: (teachers: TeacherUser[]) => void) => {
  return onSnapshot(collection(db, TEACHERS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as TeacherUser)));
  });
};

export const subscribeToTeacherProfile = (teacherId: string, callback: (teacher: TeacherUser | null) => void) => {
  return onSnapshot(doc(db, TEACHERS, teacherId), (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } as TeacherUser : null);
  });
};

export const getTeacherByPhone = async (phone: string): Promise<TeacherUser | null> => {
  const q = query(collection(db, TEACHERS), where('phone', '==', phone.trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};
