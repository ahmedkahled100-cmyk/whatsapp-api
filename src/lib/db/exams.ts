// src/lib/db/exams.ts
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, onSnapshot, query, where, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { EXAMS, ATTEMPTS, QBANK } from './constants';
import type { Exam, Attempt, QuestionBankItem } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const getExams = async (teacherId: string): Promise<Exam[]> => {
  const q = query(collection(db, EXAMS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
};

export const getPublishedExams = async (teacherId: string): Promise<Exam[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(collection(db, EXAMS), where('teacherId', '==', teacherId), where('published', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
};

export const getExam = async (id: string): Promise<Exam | null> => {
  const snap = await getDoc(doc(db, EXAMS, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } as Exam : null;
};

export const saveExam = async (exam: Omit<Exam, 'id'> & { id?: string }): Promise<string> => {
  if (exam.id) {
    await setDoc(doc(db, EXAMS, exam.id), exam);
    return exam.id;
  }
  const ref = await addDoc(collection(db, EXAMS), { ...exam, createdAt: new Date().toISOString() });
  return ref.id;
};

export const deleteExam = async (id: string) => {
  await deleteDoc(doc(db, EXAMS, id));
};

export const toggleExamPublish = async (id: string, published: boolean) => {
  await updateDoc(doc(db, EXAMS, id), { published });
};

export const subscribeToExams = (teacherId: string, callback: (exams: Exam[]) => void) => {
  const q = query(collection(db, EXAMS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam)));
  });
};

// Attempts
export const getAttemptsByStudent = async (studentId: string): Promise<Attempt[]> => {
  if (!studentId || studentId === 'unknown_student') return [];
  const q = query(collection(db, ATTEMPTS), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt));
};

export const getAttemptsByExam = async (examId: string): Promise<Attempt[]> => {
  const q = query(collection(db, ATTEMPTS), where('examId', '==', examId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt));
};

export const getAllAttempts = async (teacherId: string): Promise<Attempt[]> => {
  const q = query(collection(db, ATTEMPTS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt));
};

export const saveAttempt = async (attempt: Omit<Attempt, 'id'> & { id?: string }): Promise<string> => {
  const cleanAttempt = JSON.parse(JSON.stringify(attempt));
  if (attempt.id) {
    await setDoc(doc(db, ATTEMPTS, attempt.id), cleanAttempt);
    return attempt.id;
  }
  const ref = await addDoc(collection(db, ATTEMPTS), cleanAttempt);
  return ref.id;
};

export const deleteAttempt = async (id: string) => {
  await deleteDoc(doc(db, ATTEMPTS, id));
};

export const subscribeToAttempts = (teacherId: string, callback: (attempts: Attempt[]) => void) => {
  const q = query(collection(db, ATTEMPTS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt)));
  });
};

// Question Bank
export const getQBank = async (teacherId: string): Promise<QuestionBankItem[]> => {
  const q = query(collection(db, QBANK), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as QuestionBankItem));
};

export const addToQBank = async (item: Omit<QuestionBankItem, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, QBANK), { ...item, createdAt: new Date().toISOString(), usageCount: 0 });
  return ref.id;
};

export const deleteFromQBank = async (id: string) => {
  await deleteDoc(doc(db, QBANK, id));
};
