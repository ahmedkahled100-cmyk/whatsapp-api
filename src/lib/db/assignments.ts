// src/lib/db/assignments.ts
import { 
  collection, addDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, onSnapshot, query, where, writeBatch, doc, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ASSIGNMENTS, ASSIGN_SUBS } from './constants';
import type { Assignment, AssignmentSubmission } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getAssignments = async (teacherId: string): Promise<Assignment[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(
    collection(db, ASSIGNMENTS), 
    where('teacherId', '==', teacherId),
    orderBy('dueDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
};

export const saveAssignment = async (assign: Omit<Assignment, 'id'> & { id?: string }): Promise<string> => {
  if (assign.id) {
    await setDoc(doc(db, ASSIGNMENTS, assign.id), assign);
    return assign.id;
  }
  const refer = await addDoc(collection(db, ASSIGNMENTS), { ...assign, createdAt: new Date().toISOString() });
  return refer.id;
};

export const deleteAssignment = async (id: string) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, ASSIGNMENTS, id));
  const subSnap = await getDocs(query(collection(db, ASSIGN_SUBS), where('assignmentId', '==', id)));
  subSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const subscribeToAssignments = (teacherId: string, callback: (data: Assignment[]) => void) => {
  const q = query(
    collection(db, ASSIGNMENTS), 
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment)));
  });
};

export const getAssignmentSubmissions = async (assignmentId: string): Promise<AssignmentSubmission[]> => {
  const q = query(collection(db, ASSIGN_SUBS), where('assignmentId', '==', assignmentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as AssignmentSubmission));
};

export const submitAssignment = async (submission: Omit<AssignmentSubmission, 'id'>): Promise<string> => {
  const refer = await addDoc(collection(db, ASSIGN_SUBS), submission);
  return refer.id;
};

export const gradeSubmission = async (submissionId: string, score: number, comment?: string) => {
  await updateDoc(doc(db, ASSIGN_SUBS, submissionId), {
    score,
    teacherComment: comment || '',
    status: 'graded'
  });
};

export const getStudentSubmissions = async (studentId: string): Promise<AssignmentSubmission[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const q = query(collection(db, ASSIGN_SUBS), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as AssignmentSubmission));
};

export const saveAssignmentSubmission = async (sub: Omit<AssignmentSubmission, 'id'> & { id?: string }): Promise<string> => {
  if (sub.id) {
    await setDoc(doc(db, ASSIGN_SUBS, sub.id), sub);
    return sub.id;
  }
  const ref = await addDoc(collection(db, ASSIGN_SUBS), sub);
  return ref.id;
};
