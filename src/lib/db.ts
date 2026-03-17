// src/lib/db.ts
// طبقة خدمة Firestore - كل عمليات قاعدة البيانات هنا

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, limit,
  serverTimestamp, writeBatch, Timestamp, addDoc
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Exam, Student, Attempt, Group, Settings, QuestionBankItem, Notification, Assignment, AssignmentSubmission, CalendarEvent, RegistrationRequest, CourseMaterial } from '@/types';


// ========================================
// COLLECTIONS
// ========================================
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

// ========================================
// SETTINGS
// ========================================
export const getSettings = async (): Promise<Settings | null> => {
  const snap = await getDoc(doc(db, SETTINGS, 'main'));
  return snap.exists() ? snap.data() as Settings : null;
};

export const saveSettings = async (settings: Partial<Settings>) => {
  await setDoc(doc(db, SETTINGS, 'main'), settings, { merge: true });
};

// ========================================
// EXAMS
// ========================================
export const getExams = async (): Promise<Exam[]> => {
  const snap = await getDocs(collection(db, EXAMS));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
};

export const getPublishedExams = async (): Promise<Exam[]> => {
  const q = query(collection(db, EXAMS), where('published', '==', true));
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

// Real-time listener
export const subscribeToExams = (callback: (exams: Exam[]) => void) => {
  return onSnapshot(collection(db, EXAMS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam)));
  });
};

// ========================================
// STUDENTS
// ========================================
export const getStudents = async (): Promise<Student[]> => {
  const snap = await getDocs(collection(db, STUDENTS));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
};

export const getStudentByCode = async (code: string): Promise<Student | null> => {
  const q = query(collection(db, STUDENTS), where('code', '==', code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as Student;
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
  // Delete student and all their attempts in batch
  const batch = writeBatch(db);
  batch.delete(doc(db, STUDENTS, id));
  const attSnap = await getDocs(query(collection(db, ATTEMPTS), where('studentId', '==', id)));
  attSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const subscribeToStudents = (callback: (students: Student[]) => void) => {
  return onSnapshot(collection(db, STUDENTS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Student)));
  });
};

// ========================================
// REGISTRATION REQUESTS
// ========================================
export const getRegistrationRequests = async (): Promise<RegistrationRequest[]> => {
  const snap = await getDocs(query(collection(db, REG_REQUESTS), orderBy('createdAt', 'desc')));
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

export const subscribeToRegistrationRequests = (callback: (requests: RegistrationRequest[]) => void) => {
  return onSnapshot(query(collection(db, REG_REQUESTS), orderBy('createdAt', 'desc')), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistrationRequest)));
  });
};

// ========================================
// ATTEMPTS
// ========================================
export const getAttemptsByStudent = async (studentId: string): Promise<Attempt[]> => {
  const q = query(collection(db, ATTEMPTS), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt));
};

export const getAttemptsByExam = async (examId: string): Promise<Attempt[]> => {
  const q = query(collection(db, ATTEMPTS), where('examId', '==', examId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt));
};

export const getAllAttempts = async (): Promise<Attempt[]> => {
  const snap = await getDocs(collection(db, ATTEMPTS));
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

export const subscribeToAttempts = (callback: (attempts: Attempt[]) => void) => {
  return onSnapshot(collection(db, ATTEMPTS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Attempt)));
  });
};

// ========================================
// GROUPS
// ========================================
export const getGroups = async (): Promise<Group[]> => {
  const snap = await getDocs(collection(db, GROUPS));
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

export const subscribeToGroups = (callback: (groups: Group[]) => void) => {
  return onSnapshot(collection(db, GROUPS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Group)));
  });
};

// ========================================
// QUESTION BANK
// ========================================
export const getQBank = async (): Promise<QuestionBankItem[]> => {
  const snap = await getDocs(collection(db, QBANK));
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
export const addNotification = async (msg: string, type: Notification['type'] = 'info') => {
  await addDoc(collection(db, NOTIFICATIONS), {
    msg, type, read: false,
    time: new Date().toLocaleString('ar-EG'),
    createdAt: Date.now(),
  });
};

export const markAllNotificationsRead = async () => {
  const snap = await getDocs(query(collection(db, NOTIFICATIONS), where('read', '==', false)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

export const subscribeToNotifications = (callback: (notifs: Notification[]) => void) => {
  const q = query(collection(db, NOTIFICATIONS), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Notification)));
  });
};

// ========================================
// ASSIGNMENTS
// ========================================
export const getAssignments = async (): Promise<Assignment[]> => {
  const snap = await getDocs(collection(db, ASSIGNMENTS));
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
  // Delete all related submissions as well
  const subSnap = await getDocs(query(collection(db, ASSIGN_SUBS), where('assignmentId', '==', id)));
  subSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const subscribeToAssignments = (callback: (data: Assignment[]) => void) => {
  return onSnapshot(collection(db, ASSIGNMENTS), (snap) => {
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
  const q = query(collection(db, ASSIGN_SUBS), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as AssignmentSubmission));
};

import { getCloudinarySignature, compressAndUploadPDFAction } from './actions';
import { FileProcessor } from './file-processor';

export const uploadFileToStorage = async (
  file: File | Blob, 
  path: string, 
  onProgress?: (progress: number, status?: string) => void,
  customFileName?: string
): Promise<string> => {
  let fileToUpload = file;
  const originalName = (file as File).name || (file as any).fileName || customFileName || 'file';
  const fileType = (file as File).type || (file as any).fileType || 'application/octet-stream';

  // 1. Advanced iLovePDF Compression for large PDFs (>10MB)
  // This bypasses direct Cloudinary upload to avoid 10MB limit
  const isPDF = fileType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
  const isLarge = fileToUpload.size > 10 * 1024 * 1024;

  if (isPDF && isLarge) {
    onProgress?.(10, 'جاري ضغط الملف عبر iLovePDF...');
    
    const formData = new FormData();
    // Ensure we send it as a File with a name if it's a Blob
    const fileForAction = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], originalName, { type: fileType });
    formData.append('file', fileForAction);
    formData.append('folder', path.split('/')[0] || 'an-academy');

    try {
      // Use Server Action to compress THEN upload
      const result = await compressAndUploadPDFAction(formData);
      
      if (result.success && result.url) {
        onProgress?.(100, 'اكتمل الضغط والرفع!');
        
        // Log success
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
      // Fallback to direct upload if permitted by Cloudinary (some plans allow more)
      // or throw error
      if (fileToUpload.size > 20 * 1024 * 1024) {
        throw new Error('فشل ضغط الملف الكبير (>20MB) عبر iLovePDF. يرجى محاولة تقليل حجمه يدوياً.');
      }
      console.warn('Falling back to direct Cloudinary upload for large file after iLovePDF failure');
    }
  }

  // Basic Image/PDF Optimization if not handled by iLovePDF
  if (file instanceof File && file.size > 10 * 1024 * 1024) {
    onProgress?.(0, 'جاري تحسين الملف محلياً...');
    // ... basic logic is already in FileProcessor, but we can call it here if needed
  }

  // Final check after compression
  const LIMIT_100MB = 100 * 1024 * 1024;
  if (fileToUpload.size > LIMIT_100MB) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميجابايت). يرجى ضغط الملف أو رفعه على Google Drive ومشاركة الرابط.');
  }

  // Obfuscate filename for security
  const fileExt = originalName.split('.').pop() || 'file';
  const public_id = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  const obfuscatedName = `${public_id}.${fileExt}`;
  const folder = path.split('/')[0] || 'an-academy';

  try {
    // 2. Get signed signature from server
    const { signature, timestamp, apiKey, cloudName } = await getCloudinarySignature(folder, public_id);

    // 3. Upload directly to Cloudinary using XHR for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const resourceType = isPDF ? 'raw' : 'auto';
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      xhr.open('POST', url, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          // Upload is 0-100%
          const uploadPercent = Math.round((event.loaded / event.total) * 100);
          onProgress(uploadPercent, 'جاري الرفع...');
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          
          // 3. Log the upload in Firestore (optional but recommended for security audit)
          const logUpload = async () => {
            try {
              await addDoc(collection(db, 'upload_logs'), {
                fileName: originalName,
                obfuscatedName,
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
          // Improved error detection for Cloudinary limits
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
      formData.append('public_id', public_id); // Use the same ID that was signed

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
export const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  const snap = await getDocs(collection(db, EVENTS));
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

export const subscribeToCalendarEvents = (callback: (data: CalendarEvent[]) => void) => {
  return onSnapshot(collection(db, EVENTS), (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as CalendarEvent)));
  });
};

// ========================================
// STATS (for dashboard)
// ========================================
export const getDashboardStats = async () => {
  const [exams, students, attempts] = await Promise.all([
    getDocs(collection(db, EXAMS)),
    getDocs(collection(db, STUDENTS)),
    getDocs(collection(db, ATTEMPTS)),
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

// ========================================
// MATERIALS (CURRICULUM)
// ========================================
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

export const subscribeToMaterials = (callback: (m: CourseMaterial[]) => void) => {
  return onSnapshot(collection(db, MATERIALS), (snap) => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as CourseMaterial));
    callback(items.sort((a, b) => (a.sequence - b.sequence) || (b.createdAt - a.createdAt)));
  });
};

export const getMaterials = async (): Promise<CourseMaterial[]> => {
  const snap = await getDocs(collection(db, MATERIALS));
  const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as CourseMaterial));
  return items.sort((a, b) => (a.sequence - b.sequence) || (b.createdAt - a.createdAt));
};

// ========================================
// SYSTEM ADMIN
// ========================================
export const wipeAllData = async () => {
  // We will delete all documents from these core collections:
  const collectionsToWipe = [
    EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
    NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
    REG_REQUESTS, MATERIALS
  ];

  for (const collName of collectionsToWipe) {
    const collRef = collection(db, collName);
    const snap = await getDocs(collRef);
    
    // Firestore batch limits to 500 ops per batch.
    // If a collection has many documents, we chunk them.
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

    if (count > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches for this collection
    for (const b of batches) {
      await b.commit();
    }
  }
};

