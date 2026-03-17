// src/lib/store.ts
// إدارة الحالة العامة للتطبيق

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, Exam, Attempt, Group, Settings, Notification, Question, RegistrationRequest, CourseMaterial, Assignment } from '@/types';

// ==========================================
// TEACHER STORE
// ==========================================
interface TeacherStore {
  isAuthenticated: boolean;
  exams: Exam[];
  students: Student[];
  attempts: Attempt[];
  groups: Group[];
  notifications: Notification[];
  settings: Settings | null;
  registrationRequests: RegistrationRequest[];
  materials: CourseMaterial[];
  assignments: Assignment[];
  activeTab: string;
  isLoading: boolean;
  tempExamQuestions: Question[] | null;

  // Actions
  setAuth: (val: boolean) => void;
  setExams: (exams: Exam[]) => void;
  setStudents: (students: Student[]) => void;
  setAttempts: (attempts: Attempt[]) => void;
  setGroups: (groups: Group[]) => void;
  setNotifications: (notifs: Notification[]) => void;
  setRegistrationRequests: (requests: RegistrationRequest[]) => void;
  setMaterials: (materials: CourseMaterial[]) => void;
  setAssignments: (assignments: Assignment[]) => void;
  setSettings: (settings: Settings) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (val: boolean) => void;
  setTempExamQuestions: (questions: Question[] | null) => void;
  logout: () => void;
}

export const useTeacherStore = create<TeacherStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      exams: [],
      students: [],
      attempts: [],
      groups: [],
      notifications: [],
      registrationRequests: [],
      materials: [],
      assignments: [],
      settings: null,
      activeTab: 'dashboard',
      isLoading: false,
      tempExamQuestions: null,

      setAuth: (val) => set({ isAuthenticated: val }),
      setExams: (exams) => set({ exams }),
      setStudents: (students) => set({ students }),
      setAttempts: (attempts) => set({ attempts }),
      setGroups: (groups) => set({ groups }),
      setNotifications: (notifications) => set({ notifications }),
      setRegistrationRequests: (registrationRequests) => set({ registrationRequests }),
      setMaterials: (materials) => set({ materials }),
      setAssignments: (assignments) => set({ assignments }),
      setSettings: (settings) => set({ settings }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setLoading: (isLoading) => set({ isLoading }),
      setTempExamQuestions: (tempExamQuestions) => set({ tempExamQuestions }),
      logout: () => set({ isAuthenticated: false, tempExamQuestions: null }),
    }),
    {
      name: 'an-academy-teacher',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, settings: state.settings }),
    }
  )
);

// ==========================================
// STUDENT STORE
// ==========================================
interface StudentStore {
  student: Student | null;
  currentExam: Exam | null;
  currentAttempt: Partial<Attempt> | null;
  answers: Record<string, number>;
  essayAnswers: Record<string, { text?: string; fileUrls?: string[] }>;
  timeLeft: number;
  examPhase: 'login' | 'dashboard' | 'intro' | 'taking' | 'results';

  setStudent: (student: Student | null) => void;
  setCurrentExam: (exam: Exam | null) => void;
  setCurrentAttempt: (attempt: Partial<Attempt> | null) => void;
  setAnswer: (questionId: string, optionIndex: number) => void;
  setEssayAnswer: (questionId: string, data: { text?: string; fileUrls?: string[] }) => void;
  setTimeLeft: (time: number) => void;
  setExamPhase: (phase: StudentStore['examPhase']) => void;
  resetExam: () => void;
  logout: () => void;
}

// ==========================================
// FILE PROCESSING STORE
// ==========================================
import { QueuedFile, getAllQueuedFiles, deleteQueuedFile as deleteIDBFile } from './idb';

interface FileProcessingStore {
  queue: QueuedFile[];
  isProcessing: boolean;
  
  setQueue: (queue: QueuedFile[]) => void;
  updateFile: (id: string, updates: Partial<QueuedFile>) => void;
  addFile: (file: QueuedFile) => void;
  removeFile: (id: string) => void;
  loadQueue: () => Promise<void>;
}

export const useFileProcessingStore = create<FileProcessingStore>((set, get) => ({
  queue: [],
  isProcessing: false,

  setQueue: (queue) => set({ queue }),
  updateFile: (id, updates) => set((state) => ({
    queue: state.queue.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  addFile: (file) => set((state) => ({
    queue: [...state.queue, file]
  })),
  removeFile: (id) => {
    set((state) => ({
      queue: state.queue.filter(f => f.id !== id)
    }));
    deleteIDBFile(id);
  },
  loadQueue: async () => {
    const queue = await getAllQueuedFiles();
    // Only load non-completed files or recent ones
    set({ queue: queue.filter(f => f.status !== 'completed' || (Date.now() - f.createdAt < 3600000)) });
  }
}));

export const useStudentStore = create<StudentStore>()(
  persist(
    (set) => ({
      student: null,
      currentExam: null,
      currentAttempt: null,
      answers: {},
      essayAnswers: {},
      timeLeft: 0,
      examPhase: 'login',

      setStudent: (student) => set({ student }),
      setCurrentExam: (currentExam) => set({ currentExam }),
      setCurrentAttempt: (currentAttempt) => set({ currentAttempt }),
      setAnswer: (questionId, optionIndex) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: optionIndex } })),
      setEssayAnswer: (questionId, data) =>
        set((state) => {
          const prev = state.essayAnswers[questionId] || {};
          return { essayAnswers: { ...state.essayAnswers, [questionId]: { ...prev, ...data } } };
        }),
      setTimeLeft: (timeLeft) => set({ timeLeft }),
      setExamPhase: (examPhase) => set({ examPhase }),
      resetExam: () => set({ currentExam: null, currentAttempt: null, answers: {}, essayAnswers: {}, timeLeft: 0, examPhase: 'dashboard' }),
      logout: () => set({ student: null, currentExam: null, currentAttempt: null, answers: {}, essayAnswers: {}, timeLeft: 0, examPhase: 'login' }),
    }),
    {
      name: 'an-academy-student',
      partialize: (state) => ({
        student: state.student,
        currentAttempt: state.currentAttempt,
        answers: state.answers,
        essayAnswers: state.essayAnswers,
        timeLeft: state.timeLeft,
        examPhase: state.examPhase,
      }),
    }
  )
);
