// src/types/index.ts

export interface TeacherUser {
  id: string;
  name: string;
  username: string; // Used for login
  password?: string; // Stored hashed or plain based on current setup
  code?: string; // Unique mode for login
  role: 'super_admin' | 'teacher';
  subject?: string;
  phone?: string;
  isActive: boolean;
  permissions?: string[]; // Granular features
  imageUrl?: string;
  subType?: 'free' | 'monthly' | 'yearly';
  subExpiry?: number | null;
  subLink?: string;
  subPrice?: number;
  createdAt: number;
}

export interface Student {
  id: string;
  teacherId: string;
  teacherCode?: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  parentPhone?: string;
  grade?: string;
  teacherName?: string; // Cache for easy UI/Messaging display
  teacherImage?: string; // Cache for academy switcher UI
  teacherSubject?: string; // Cache for academy switcher UI
  groupIds: string[];
  notes?: string;
  imageUrl?: string;
  subType: 'none' | 'monthly' | 'yearly' | 'session' | 'halfYearly' | 'course';
  subPrice?: number;
  subExpiry?: number | null;
  registeredAt: string;
  createdAt: number;
}

export interface Group {
  id: string;
  teacherId: string;
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
  pdfUrl?: string;
}

export type EssayQuestion = Question; 

export interface Exam {
  id: string;
  teacherId: string;
  title: string;
  subject?: string;
  desc?: string;
  duration: number;
  passScore: number;
  questions: Question[];
  essayQuestions?: Question[];
  shuffle: boolean;
  randomPickCount?: number; 
  allowRetake: boolean;
  allowResume: boolean;
  showAnswers: boolean;
  published: boolean;
  targetGroup?: string;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  createdBy?: string;
  imageUrl?: string;
  pdfUrl?: string;
}


export type GameType = 'flashcards' | 'match' | 'quiz' | 'sentence' | 'sort' | 'tf_run';

export interface EducationalGame {
  id: string;
  teacherId: string;
  title: string;
  type: GameType;
  content: any; // FlashcardItem[] | MatchItem[] | Question[]
  targetGroup?: string;
  createdAt: string;
}

export interface GameResult {
  id: string;
  gameId: string;
  studentId: string;
  studentName?: string;
  score: number;
  total: number;
  completedAt: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface MatchItem {
  term: string;
  definition: string;
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
  teacherId: string;
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
  teacherId: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  time: string;
  createdAt: number;
  targetUsers?: string[]; 
  targetRoles?: ('admin' | 'student')[];
  targetGroups?: string[];
  actionPath?: string;
}

export interface NotificationLog {
  id: string;
  teacherId: string;
  type: 'whatsapp' | 'in_app' | 'both';
  target: string; 
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  message: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id?: string;
  teacherId: string;
  acadName: string;
  teacherName: string;
  logoUrl?: string;
  teacherPassword?: string; // Legacy, might be removed later
  primaryColor: string;
  secTabSwitch: boolean;
  secCopyPaste: boolean;
  secFullscreen: boolean;
  secShuffleOptions: boolean;
  certHeader?: string;
  certFooter?: string;
  certSignatureUrl?: string; 
  paymentMethods?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  halfYearlyPrice?: number;
  coursePrice?: number;
  sessionPrice?: number;
  whatsappNumber?: string; 
  whatsappEnabled?: boolean;
  whatsappTemplate?: string; 
}

export interface RegistrationRequest {
  id: string;
  teacherId: string;
  teacherCode?: string;
  name: string;
  phone: string;
  parentPhone: string;
  grade: string;
  subType: 'monthly' | 'yearly' | 'halfYearly' | 'course' | 'session';
  paymentRef?: string;
  receiptUrl?: string;
  type?: 'student' | 'teacher' | 'renewal' | 'teacher_renewal';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  subject?: string; // For teacher registration
  subPrice?: number; // Subscription price matched during registration
  imageUrl?: string; // Student profile image if uploaded during registration
  studentId?: string; // For renewal requests: links to existing student
  notes?: string; // Additional notes from student/teacher
}

export interface CourseMaterial {
  id: string;
  teacherId: string;
  title: string;
  type: 'video' | 'pdf' | 'link' | 'file' | 'image';
  url: string; 
  additionalLinks?: { label: string; url: string }[]; 
  fileUrl?: string; 
  grade: string; 
  targetGroups?: string[]; 
  subject: string;
  sequence: number;
  isFree: boolean;
  exceptionalStudents: string[]; 
  linkedExamId?: string; 
  linkedAssignmentId?: string; 
  createdAt: number;
  createdBy?: string;
}

export interface Assignment {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  targetGroup?: string; 
  targetGroups?: string[]; 
  fileUrl?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AssignmentSubmission {
  id: string;
  teacherId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  fileUrl?: string;
  textAnswer?: string;
  score?: number;
  maxScore: number;
  teacherComment?: string;
  submittedAt: string;
  status: 'pending' | 'graded' | 'redo';
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  teacherId: string; // Context for grouping
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
}

export interface Conversation {
  id: string; // Typically minId_maxId
  participants: string[];
  participantNames: string[];
  lastMessage?: Message;
  updatedAt: number;
  unreadCount?: number;
}

export interface CalendarEvent {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  date: string; 
  type: 'exam' | 'assignment' | 'manual' | 'holiday' | 'live_session' | 'fixed_class';
  referenceId?: string; 
  isRecurring?: boolean;
  recurringDays?: number[]; // 0=Sun, 1=Mon...
  startTime?: string;
  endTime?: string;
  createdAt: string;
}

export interface AcademyDB {
  teachers: TeacherUser[];
  exams: Exam[];
  students: Student[];
  attempts: Attempt[];
  groups: Group[];
  notifications: Notification[];
  materials: CourseMaterial[];
  settings: Settings[]; // Now an array of settings per teacher
}

export interface QuestionBankItem extends Question {
  teacherId: string;
  subject?: string;
  unit?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  usageCount: number;
  createdAt: string;
}
