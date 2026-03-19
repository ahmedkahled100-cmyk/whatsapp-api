// src/lib/db.ts
// طبقة خدمة Firestore - كل عمليات قاعدة البيانات هنا

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, limit,
  writeBatch, addDoc
} from 'firebase/firestore';
import { db as firebaseDb, storage as firebaseStorage } from './firebase';
const db = firebaseDb!;
const storage = firebaseStorage!;
import type { 
  Exam, Student, Attempt, Group, Settings, 
  QuestionBankItem, Notification, Assignment, 
  AssignmentSubmission, CalendarEvent, 
  RegistrationRequest, CourseMaterial, NotificationLog, TeacherUser 
} from '@/types';
import { getCloudinarySignature, compressAndUploadPDFAction } from './actions';
import { FileProcessor } from './file-processor';

// ========================================
// COLLECTIONS
// ========================================
const TEACHERS = 'teachers';
const EXAMS = 'exams';
const STUDENTS = 'students';
const ATTEMPTS = 'attempts';
const GROUPS = 'groups';
const QBANK = 'questionBank';
const NOTIFICATIONS = 'notifications';
const SETTINGS = 'settings';
const ASSIGNMENTS = 'assignments';
const ASSIGN_SUBS = 'assignmentSubmissions';
const EVENTS = 'calendarEvents';
const REG_REQUESTS = 'registrationRequests';
const MATERIALS = 'materials';
const NOTIFICATION_LOGS = 'notificationLogs';

// ========================================
// TEACHERS (USERS)
// ========================================
export const getTeachers = async (): Promise<TeacherUser[]> => {
  if (!db) return [];
  const snap = await getDocs(collection(db, TEACHERS));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as TeacherUser));
};

export const getTeacherByUsername = async (username: string): Promise<TeacherUser | null> => {
  if (!db) return null;
  const q = query(collection(db, TEACHERS), where('username', '==', username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const getTeacherByCode = async (code: string): Promise<TeacherUser | null> => {
  if (!db) return null;
  const q = query(collection(db, TEACHERS), where('code', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const getTeacherById = async (id: string): Promise<TeacherUser | null> => {
  if (!db) return null;
  const snap = await getDoc(doc(db, TEACHERS, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } as TeacherUser : null;
};

export const saveTeacher = async (teacher: Omit<TeacherUser, 'id'> & { id?: string }): Promise<string> => {
  if (!db) throw new Error('Database not initialized');
  // Clean up undefined/null values before saving to Firestore
  const cleanTeacher: any = { 
    ...teacher, 
    username: (teacher.username || '').trim().toLowerCase() 
  };
  
  if (teacher.code !== undefined && teacher.code !== null) {
    cleanTeacher.code = teacher.code.trim().toUpperCase();
  }

  if (teacher.id) {
    await setDoc(doc(db, TEACHERS, teacher.id), cleanTeacher, { merge: true });
    return teacher.id;
  }
  const ref = await addDoc(collection(db, TEACHERS), { 
    ...cleanTeacher, 
    createdAt: Date.now(), 
    isActive: teacher.isActive !== undefined ? teacher.isActive : true 
  });
  return ref.id;
};

export const updateSuperAdminCredentials = async (id: string, username: string, password?: string) => {
  if (!db) throw new Error('Database not initialized');
  const data: any = { username: username.trim().toLowerCase() };
  if (password) data.password = password;
  await updateDoc(doc(db, TEACHERS, id), data);
};

export const deleteTeacher = async (id: string) => {
  if (!db) throw new Error('Database not initialized');
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

// ========================================
// SETTINGS
// ========================================
export const getSettings = async (teacherId: string): Promise<Settings | null> => {
  if (!teacherId || teacherId === 'unknown_teacher') return null;
  const q = query(collection(db, SETTINGS), where('teacherId', '==', teacherId), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id } as Settings;
};

export const saveSettings = async (settings: Partial<Settings> & { teacherId: string }) => {
  if (settings.id) {
    await setDoc(doc(db, SETTINGS, settings.id), settings, { merge: true });
  } else {
    // Check if exists first
    const q = query(collection(db, SETTINGS), where('teacherId', '==', settings.teacherId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await setDoc(doc(db, SETTINGS, snap.docs[0].id), settings, { merge: true });
    } else {
      await addDoc(collection(db, SETTINGS), settings);
    }
  }
};

// ========================================
// EXAMS
// ========================================
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

// ========================================
// STUDENTS
// ========================================
export const getStudents = async (teacherId: string): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(collection(db, STUDENTS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
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

export const getTeacherByPhone = async (phone: string): Promise<TeacherUser | null> => {
  const q = query(collection(db, TEACHERS), where('phone', '==', phone.trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as TeacherUser;
};

export const saveStudent = async (student: Omit<Student, 'id'> & { id?: string }): Promise<string> => {
  if (student.id) {
    await setDoc(doc(db, STUDENTS, student.id), student);
    return student.id;
  }
  const ref = await addDoc(collection(db, STUDENTS), { ...student, createdAt: Date.now() });
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

// ========================================
// REGISTRATION REQUESTS
// ========================================
export const getRegistrationRequests = async (teacherId: string): Promise<RegistrationRequest[]> => {
  const q = query(collection(db, REG_REQUESTS), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistrationRequest));
};

export const saveRegistrationRequest = async (req: Omit<RegistrationRequest, 'id'> & { id?: string }): Promise<string> => {
  if (req.id) {
    await setDoc(doc(db, REG_REQUESTS, req.id), req);
    return req.id;
  }
  const ref = await addDoc(collection(db, REG_REQUESTS), { ...req, createdAt: Date.now() });
  return ref.id;
};

export const deleteRegistrationRequest = async (id: string) => {
  await deleteDoc(doc(db, REG_REQUESTS, id));
};

export const subscribeToRegistrationRequests = (teacherId: string, callback: (requests: RegistrationRequest[]) => void) => {
  const q = query(collection(db, REG_REQUESTS), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistrationRequest)));
  });
};

// ========================================
// ATTEMPTS
// ========================================
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

// ========================================
// GROUPS
// ========================================
export const getGroups = async (teacherId: string): Promise<Group[]> => {
  const q = query(collection(db, GROUPS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Group));
};

export const saveGroup = async (group: Omit<Group, 'id'> & { id?: string }): Promise<string> => {
  if (group.id) {
    await setDoc(doc(db, GROUPS, group.id), group);
    return group.id;
  }
  const ref = await addDoc(collection(db, GROUPS), { ...group, createdAt: new Date().toISOString() });
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

// ========================================
// QUESTION BANK
// ========================================
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

// ========================================
// NOTIFICATIONS
// ========================================
export const addNotification = async (teacherId: string, msg: string, type: Notification['type'] = 'info', targetUsers?: string[]) => {
  const data: any = {
    teacherId, msg, type, read: false,
    time: new Date().toLocaleString('ar-EG'),
    createdAt: Date.now(),
  };
  if (targetUsers && targetUsers.length > 0) {
    data.targetUsers = targetUsers;
  }
  await addDoc(collection(db, NOTIFICATIONS), data);
};

export const markAllNotificationsRead = async (teacherId: string) => {
  const q = query(collection(db, NOTIFICATIONS), where('teacherId', '==', teacherId), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

export const subscribeToNotifications = (teacherId: string, callback: (notifs: Notification[]) => void) => {
  const q = query(collection(db, NOTIFICATIONS), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Notification)));
  });
};

// ========================================
// NOTIFICATION LOGS
// ========================================
export const saveNotificationLog = async (log: Omit<NotificationLog, 'id'> & { id?: string }): Promise<string> => {
  if (log.id) {
    await setDoc(doc(db, NOTIFICATION_LOGS, log.id), { ...log, updatedAt: Date.now() }, { merge: true });
    return log.id;
  }
  const ref = await addDoc(collection(db, NOTIFICATION_LOGS), { ...log, createdAt: Date.now(), updatedAt: Date.now() });
  return ref.id;
};

export const getNotificationLogs = async (teacherId: string): Promise<NotificationLog[]> => {
  const q = query(collection(db, NOTIFICATION_LOGS), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as NotificationLog));
};

export const subscribeToNotificationLogs = (teacherId: string, callback: (logs: NotificationLog[]) => void) => {
  const q = query(collection(db, NOTIFICATION_LOGS), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as NotificationLog)));
  });
};

export const updateNotificationLog = async (id: string, updates: Partial<NotificationLog>) => {
  await setDoc(doc(db, NOTIFICATION_LOGS, id), { ...updates, updatedAt: Date.now() }, { merge: true });
};

export interface DispatchOptions {
  teacherId: string;
  msg: string;
  type?: Notification['type'];
  targetUsers?: string[];
  targetRoles?: ('admin' | 'student')[];
  channels: { inApp: boolean; whatsapp: boolean };
  whatsappNumbers?: string[];
}

export const dispatchNotification = async (options: DispatchOptions) => {
  const { teacherId, msg, type = 'info', targetUsers, targetRoles, channels, whatsappNumbers } = options;

  if (channels.inApp) {
    const data: any = {
      teacherId, msg, type, read: false,
      time: new Date().toLocaleString('ar-EG'),
      createdAt: Date.now(),
    };
    if (targetUsers && targetUsers.length > 0) data.targetUsers = targetUsers;
    if (targetRoles && targetRoles.length > 0) data.targetRoles = targetRoles;
    await addDoc(collection(db, NOTIFICATIONS), data);
  }

  if (channels.whatsapp && whatsappNumbers && whatsappNumbers.length > 0) {
    for (const phone of whatsappNumbers) {
      if (!phone) continue;
      try {
        const logId = await saveNotificationLog({
          teacherId,
          type: 'whatsapp',
          target: phone,
          status: 'pending',
          message: msg,
          createdAt: Date.now()
        } as any);

        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: msg })
        });
        
        const result = await res.json();
        
        if (result.success) {
          await updateNotificationLog(logId, { status: 'sent' });
        } else {
          await updateNotificationLog(logId, { status: 'failed', error: result.error || 'API Error' });
        }
      } catch (err: any) {
        console.error('WhatsApp dispatch error:', err);
      }
    }
  }
};

// ========================================
// ASSIGNMENTS
// ========================================
export const getAssignments = async (teacherId: string): Promise<Assignment[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const q = query(collection(db, ASSIGNMENTS), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
  return items.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
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
  const q = query(collection(db, ASSIGNMENTS), where('teacherId', '==', teacherId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Assignment));
    callback(items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
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

// ========================================
// FILE UPLOAD (UNMODIFIED EXCEPT AS NEEDED)
// ========================================
export const uploadFileToStorage = async (
  file: File | Blob, 
  path: string, 
  onProgress?: (progress: number, status?: string) => void,
  customFileName?: string
): Promise<string> => {
  let fileToUpload = file;
  const originalName = (file as File).name || (file as any).fileName || customFileName || 'file';
  const fileType = (file as File).type || (file as any).fileType || 'application/octet-stream';

  const isPDF = fileType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
  const isLarge = fileToUpload.size > 10 * 1024 * 1024;

  if (isPDF && isLarge) {
    onProgress?.(10, 'جاري ضغط الملف عبر iLovePDF...');
    const formData = new FormData();
    const fileForAction = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], originalName, { type: fileType });
    formData.append('file', fileForAction);
    formData.append('fileName', originalName);
    formData.append('folder', path.split('/')[0] || 'an-academy');

    try {
      const result = await compressAndUploadPDFAction(formData);
      if (result.success && result.url) {
        onProgress?.(100, 'اكتمل الضغط والرفع!');
        try {
          await addDoc(collection(db, 'upload_logs'), {
            fileName: originalName,
            url: result.url,
            originalSize: fileToUpload.size,
            compressedSize: result.size,
            type: fileType,
            timestamp: Date.now(),
            method: 'ilovepdf_compression'
          });
        } catch (e) { console.error('Logging failed', e); }
        return result.url;
      } else {
        throw new Error(result.error || 'فشل الضغط عبر iLovePDF');
      }
    } catch (err: any) {
      console.error('iLovePDF Failed:', err);
      if (fileToUpload.size > 20 * 1024 * 1024) throw new Error('فشل ضغط الملف الكبير (>20MB) عبر iLovePDF. يرجى محاولة تقليل حجمه يدوياً.');
    }
  }

  const LIMIT_100MB = 100 * 1024 * 1024;
  if (fileToUpload.size > LIMIT_100MB) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميجابايت).');
  }

  const fileExt = originalName.split('.').pop() || 'file';
  const nameBase = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const public_id = `${nameBase}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const folder = path.split('/')[0] || 'an-academy';

  try {
    const { signature, timestamp, apiKey, cloudName } = await getCloudinarySignature(folder, public_id);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const resourceType = isPDF ? 'raw' : 'auto';
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      xhr.open('POST', url, true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const uploadPercent = Math.round((event.loaded / event.total) * 100);
          onProgress(uploadPercent, 'جاري الرفع...');
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const logUpload = async () => {
            try {
              await addDoc(collection(db, 'upload_logs'), {
                fileName: originalName,
                url: response.secure_url,
                size: fileToUpload.size,
                type: fileToUpload.type,
                timestamp: Date.now(),
                status: 'success'
              });
            } catch (e) { console.error('Logging failed', e); }
          };
          logUpload();
          resolve(response.secure_url);
        } else {
          const err = JSON.parse(xhr.responseText);
          const errorMsg = err.error?.message || 'فشل الرفع إلى Cloudinary';
          if (xhr.status === 413 || errorMsg.includes('Large') || errorMsg.includes('Payload')) {
            reject(new Error('حجم الملف يتجاوز حد الرفع المباشر (10MB). جاري ضغطه تلقائياً...'));
          } else {
            reject(new Error(errorMsg));
          }
        }
      };
      xhr.onerror = () => reject(new Error('خطأ في الاتصال بالخادم أثناء الرفع.'));

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', apiKey);
      formData.append('folder', folder);
      formData.append('public_id', public_id); 

      xhr.send(formData);
    });
  } catch (error: any) {
    console.error('Upload Process Error:', error);
    throw error;
  }
};

export const saveAssignmentSubmission = async (sub: Omit<AssignmentSubmission, 'id'> & { id?: string }): Promise<string> => {
  if (sub.id) {
    await setDoc(doc(db, ASSIGN_SUBS, sub.id), sub);
    return sub.id;
  }
  const ref = await addDoc(collection(db, ASSIGN_SUBS), sub);
  return ref.id;
};

// ========================================
// CALENDAR EVENTS
// ========================================
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

// ========================================
// STATS
// ========================================
export const getDashboardStats = async (teacherId: string) => {
  const qExams = query(collection(db, EXAMS), where('teacherId', '==', teacherId));
  const qStudents = query(collection(db, STUDENTS), where('teacherId', '==', teacherId));
  const qAttempts = query(collection(db, ATTEMPTS), where('teacherId', '==', teacherId));

  const [exams, students, attempts] = await Promise.all([
    getDocs(qExams),
    getDocs(qStudents),
    getDocs(qAttempts),
  ]);

  const attData = attempts.docs.map(d => d.data() as Attempt);
  const pendingEssays = attData.filter(a =>
    a.essayAnswers?.some(ea => ea.pending)
  ).length;

  const completedAttempts = attData.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return {
    totalExams: exams.size,
    totalStudents: students.size,
    totalAttempts: attempts.size,
    pendingEssays,
    avgScore,
    passRate: completedAttempts.length > 0
      ? Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100)
      : 0,
  };
};

export const getPlatformStats = async () => {
  // Global stats for super_admin
  const [teachers, exams, students, attempts] = await Promise.all([
    getDocs(collection(db, TEACHERS)),
    getDocs(collection(db, EXAMS)),
    getDocs(collection(db, STUDENTS)),
    getDocs(collection(db, ATTEMPTS)),
  ]);

  return {
    totalTeachers: teachers.size,
    totalExams: exams.size,
    totalStudents: students.size,
    totalAttempts: attempts.size
  };
};

// ========================================
// MATERIALS
// ========================================
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

// ========================================
// SYSTEM ADMIN
// ========================================
export const wipeAllData = async () => {
  const collectionsToWipe = [
    TEACHERS, EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
    NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
    REG_REQUESTS, MATERIALS, NOTIFICATION_LOGS
  ];

  for (const collName of collectionsToWipe) {
    const collRef = collection(db, collName);
    const snap = await getDocs(collRef);
    
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    snap.docs.forEach((docSnap) => {
      currentBatch.delete(docSnap.ref);
      count++;
      if (count === 500) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        count = 0;
      }
    });

    if (count > 0) batches.push(currentBatch);

    for (const b of batches) await b.commit();
  }
};
