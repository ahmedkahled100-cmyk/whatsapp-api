// src/lib/db/students.ts
import { 
  collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, 
  query, where, limit, writeBatch, addDoc, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { STUDENTS, ATTEMPTS, GROUPS, REG_REQUESTS } from './constants';
import { clean } from './utils';
import type { Student, Group, RegistrationRequest } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getStudents = async (teacherId: string): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(collection(db, STUDENTS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
};

export const getAllStudents = async (): Promise<Student[]> => {
  const snap = await getDocs(collection(db, STUDENTS));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
};

export const getStudentByCode = async (code: string): Promise<Student | null> => {
  const q = query(collection(db, STUDENTS), where('code', '==', code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as Student;
};

export const getStudentByParentPhone = async (parentPhone: string): Promise<Student | null> => {
  const q = query(collection(db, STUDENTS), where('parentPhone', '==', parentPhone.trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as Student;
};

export const saveStudent = async (student: Omit<Student, 'id'> & { id?: string }): Promise<string> => {
  if (student.id) {
    await setDoc(doc(db, STUDENTS, student.id), clean(student));
    return student.id;
  }
  const ref = await addDoc(collection(db, STUDENTS), clean({ ...student, createdAt: Date.now() }));
  return ref.id;
};

export const deleteStudent = async (id: string) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, STUDENTS, id));
  const attSnap = await getDocs(query(collection(db, ATTEMPTS), where('studentId', '==', id)));
  attSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const subscribeToStudents = (teacherId: string, callback: (students: Student[]) => void) => {
  const q = query(collection(db, STUDENTS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Student)));
  });
};

export const subscribeToAllStudents = (callback: (students: Student[]) => void) => {
  return onSnapshot(collection(db, STUDENTS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Student)));
  });
};

// Groups
export const getGroups = async (teacherId: string): Promise<Group[]> => {
  const q = query(collection(db, GROUPS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Group));
};

export const saveGroup = async (group: Omit<Group, 'id'> & { id?: string }): Promise<string> => {
  if (group.id) {
    await setDoc(doc(db, GROUPS, group.id), clean(group));
    return group.id;
  }
  const ref = await addDoc(collection(db, GROUPS), clean({ ...group, createdAt: new Date().toISOString() }));
  return ref.id;
};

export const deleteGroup = async (id: string) => {
  await deleteDoc(doc(db, GROUPS, id));
};

export const subscribeToGroups = (teacherId: string, callback: (groups: Group[]) => void) => {
  const q = query(collection(db, GROUPS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Group)));
  });
};

// Registration Requests
export const getRegistrationRequests = async (teacherId: string): Promise<RegistrationRequest[]> => {
  const q = query(
    collection(db, REG_REQUESTS), 
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistrationRequest));
};

export const saveRegistrationRequest = async (req: Omit<RegistrationRequest, 'id'> & { id?: string }): Promise<string> => {
  if (req.id) {
    await setDoc(doc(db, REG_REQUESTS, req.id), clean(req));
    return req.id;
  }
  const ref = await addDoc(collection(db, REG_REQUESTS), clean({ ...req, createdAt: Date.now() }));
  return ref.id;
};

export const deleteRegistrationRequest = async (id: string) => {
  await deleteDoc(doc(db, REG_REQUESTS, id));
};

export const subscribeToRegistrationRequests = (teacherId: string, callback: (requests: RegistrationRequest[]) => void) => {
  const q = query(
    collection(db, REG_REQUESTS), 
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistrationRequest)));
  });
};

export const getEnrollmentsByPhone = async (phone: string): Promise<Student[]> => {
  return []; // Firebase not supported for multi-enrollment
};

export const getEnrollmentsByParentPhone = async (parentPhone: string): Promise<Student[]> => {
  return []; // Firebase not supported for multi-enrollment
};
