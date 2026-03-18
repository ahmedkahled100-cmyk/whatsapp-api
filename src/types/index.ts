// src/types/index.ts

export interface Student {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  parentPhone?: string;
  grade?: string;
  groupIds: string[];
  notes?: string;
  imageUrl?: string;
  subType: 'none' | 'monthly' | 'yearly' | 'session' | 'halfYearly' | 'course';
  subExpiry?: number | null;
  registeredAt: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  desc?: string;
  studentIds: string[];
  createdAt: string;
}

export interface Question {
  id: string;
  type: 'mcq' | 'essay' | 'tf';
  text: string;
  options?: string[]; // for mcq
  correct?: number;   // for mcq
  isTrue?: boolean;   // for tf correctness
  explanation?: string;
  maxScore?: number;
  timeLimit?: number; // per-question timer in seconds (0 or undefined means no limit)
  allowImage?: boolean;
  allowPdf?: boolean;
  allowWord?: boolean; // Word document upload
  gradingNote?: string;
  imageUrl?: string;
}

// Assuming EssayQuestion is similar to Question but specifically for essays,
// or it might be a subset/extension. For now, let's define it simply
// or assume it's the same as Question if no other definition is provided.
// If EssayQuestion is meant to be different, it should be defined elsewhere.
// For the purpose of this edit, we'll assume it's a type that can be used here.
// If EssayQuestion is not defined, this will cause a TS error.
// Based on the context of EssayAnswer, it seems EssayQuestion might be similar to Question.
export type EssayQuestion = Question; // Placeholder definition if not explicitly defined

export interface Exam {
  id: string;
  title: string;
  subject?: string;
  desc?: string;
  duration: number;
  passScore: number;
  questions: Question[];
  essayQuestions?: Question[];
  shuffle: boolean;
  randomPickCount?: number; // Number of questions to randomly pick for each student (0 or undefined means all)
  allowRetake: boolean;
  allowResume: boolean;
  showAnswers: boolean;
  published: boolean;
  targetGroup?: string;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  createdBy?: string;
}

export interface EssayAnswer {
  questionId: string;
  questionText: string;
  text?: string;
  fileUrls?: string[];
  score?: number;
  maxScore: number;
  teacherComment?: string;
  pending: boolean;
  gradingNote?: string;
}

export interface Attempt {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  answers: Record<string, number>;
  essayAnswers?: EssayAnswer[];
  mcqScore: number;
  mcqTotal: number;
  finalScore?: number;
  passed?: boolean;
  completed: boolean;
  submittedAt?: string;
  startedAt: string;
  timeSpent?: number;
  tabSwitches?: number;
}

export interface Notification {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  time: string;
  createdAt: number;
}

export interface Settings {
  acadName: string;
  teacherName: string;
  logoUrl?: string;
  teacherPassword: string;
  primaryColor: string;
  secTabSwitch: boolean;
  secCopyPaste: boolean;
  secFullscreen: boolean;
  secShuffleOptions: boolean;
  certHeader?: string;
  certFooter?: string;
  certSignatureUrl?: string; // صورة التوقيع/الختم في الشهادة
  paymentMethods?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  halfYearlyPrice?: number;
  coursePrice?: number;
  sessionPrice?: number;
  whatsappNumber?: string; // رقم واتساب المعلم للتواصل مع الطلاب
  whatsappTemplate?: string; // قالب رسالة الواتساب لإبلاغ أولياء الأمور
}

export interface RegistrationRequest {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  grade: string;
  subType: 'monthly' | 'yearly' | 'halfYearly' | 'course' | 'session';
  paymentRef?: string;
  receiptUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface CourseMaterial {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'link' | 'file' | 'image';
  url: string; // الرابط الأساسي
  additionalLinks?: { label: string; url: string }[]; // روابط إضافية
  fileUrl?: string; // رابط ملف مرفوع مباشرة
  grade: string; // Empty means all grades
  targetGroups?: string[]; // List of specific group IDs. If empty or absent, falls back to 'grade' or all groups.
  subject: string;
  sequence: number;
  isFree: boolean;
  exceptionalStudents: string[]; // List of specific student IDs who can bypass the subscription requirement
  linkedExamId?: string; // اختبار مرتبط بهذا الدرس
  linkedAssignmentId?: string; // واجب مرتبط بهذا الدرس
  createdAt: number;
  createdBy?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  targetGroup?: string; // Legacy
  targetGroups?: string[]; // New: support multiple groups
  fileUrl?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  fileUrl?: string;
  textAnswer?: string;
  score?: number;
  maxScore: number;
  teacherComment?: string;
  submittedAt: string;
  status: 'pending' | 'graded';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO string for the date/time
  type: 'exam' | 'assignment' | 'manual' | 'holiday' | 'live_session';
  referenceId?: string; // id of exam or assignment if linked
  createdAt: string;
}

export interface AcademyDB {
  exams: Exam[];
  students: Student[];
  attempts: Attempt[];
  groups: Group[];
  notifications: Notification[];
  materials: CourseMaterial[];
  settings: Settings;
}

export interface QuestionBankItem extends Question {
  subject?: string;
  unit?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  usageCount: number;
  createdAt: string;
}
