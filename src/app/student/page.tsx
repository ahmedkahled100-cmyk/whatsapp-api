'use client';
// src/app/student/page.tsx
// بوابة الطالب - تسجيل الدخول بالكود

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useStudentStore, useFileProcessingStore } from '@/lib/store';
import { 
  getStudentByCode, 
  getStudentByParentPhone, 
  getPublishedExams, 
  getAttemptsByStudent, 
  getSettings, 
  getMaterials, 
  getAssignments, 
  getStudentSubmissions, 
  uploadFileToStorage, 
  submitAssignment, 
  subscribeToNotifications, 
  dispatchNotification, 
  getEnrollmentsByPhone, 
  getEnrollmentsByParentPhone, 
  getGamesForStudent, 
  getCalendarEvents, 
  getExams, 
  sendMessage, 
  subscribeToMessages, 
  markMessagesAsRead, 
  subscribeToConversations, 
  getTeacherById, 
  getSuperAdmin, 
  setUserOnlineStatus, 
  subscribeToUserOnlineStatus, 
  markNotificationRead 
} from '@/lib/db';
import { FileProcessor } from '@/lib/file-processor';
import { showToast } from '@/lib/toast';
import type { Settings } from '@/types';
import type { Exam, Attempt, CourseMaterial, Assignment, AssignmentSubmission, Notification, Message, Conversation, CalendarEvent, Student } from '@/types';
import { GraduationCap, LogOut, BookOpen, BarChart2, ClipboardList, Download, Award, Video, FileText, Link as LinkIcon, BookMarked, Globe, Lock, Upload, MessageCircle, MessageSquare, Loader2, Bell, Send, Check, CheckCheck, X, Plus, ShieldCheck, AlertCircle, Paperclip, Image as ImageIcon, Trash2, User, Gamepad2, Layers, Trophy, Languages, Brain, Zap, ChevronRight, Calendar, Clock } from 'lucide-react';
import { PDFCompressionModal, usePDFCompression } from '@/components/PDFCompressionModal';
import Link from 'next/link';
import { filterNotificationsForStudent } from '@/lib/notification-audience';
import { formatDateAr, gradeColor, scoreLabel, getDownloadUrl, formatRelativeLastSeenAr } from '@/lib/utils';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { MobileStudentPortalWrapper } from '@/components/MobileStudentPortalWrapper';
import { TeacherDiscovery } from '@/components/TeacherDiscovery';
import { SubscriptionExpiredOverlay } from '@/components/SubscriptionExpiredOverlay';
import type { EducationalGame } from '@/types';

const GamePortal = dynamic(() => import('@/components/games/GamePortal').then((m) => m.GamePortal), {
  ssr: false,
  loading: () => null,
});

export default function StudentPortal() {
  const student = useStudentStore(state => state.student);
  const setStudent = useStudentStore(state => state.setStudent);
  const logout = useStudentStore(state => state.logout);
  const conversations = useStudentStore(state => state.conversations);
  const setConversations = useStudentStore(state => state.setConversations);
  const allEnrollments = useStudentStore(state => state.allEnrollments);
  const setAllEnrollments = useStudentStore(state => state.setAllEnrollments);
  const queue = useFileProcessingStore(state => state.queue);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allTeacherEvents, setAllTeacherEvents] = useState<CalendarEvent[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  
  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<AssignmentSubmission[]>([]);
  const [submitText, setSubmitText] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [submittingAssignId, setSubmittingAssignId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [activeTab, setActiveTab] = useState<'home' | 'exams' | 'courses' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile' | 'discover' | 'link' | 'games' | 'schedule'>('home');
  const [games, setGames] = useState<EducationalGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<EducationalGame | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [certData, setCertData] = useState<{ attempt: Attempt, exam: Exam } | null>(null);
  const [siteSettings, setSiteSettings] = useState<Settings | null>(null);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [parentPhone, setParentPhone] = useState('');
  const [recoveredCode, setRecoveredCode] = useState('');
  const [findingCode, setFindingCode] = useState(false);
  const [teacherPermissions, setTeacherPermissions] = useState<string[] | null>(null);
  const certRef = useRef<HTMLDivElement>(null);

  // File Preview Hook
  const { openPreview, PreviewModal } = useFilePreview();
  const { openCompression, CompressionModal } = usePDFCompression({ showSelection: true });

  // Chat State
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<number | undefined>();
  const [chatUploadingFile, setChatUploadingFile] = useState(false);
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [chatAttachmentType, setChatAttachmentType] = useState<'text' | 'image' | 'file'>('text');
  
  // ILovePDF Compression States
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionMessage, setCompressionMessage] = useState('');
  const [showAcademySwitcher, setShowAcademySwitcher] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleChatAttachment = async (e: React.ChangeEvent<HTMLInputElement>, _type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-detect actual file type from MIME
    const isImage = file.type.startsWith('image/');
    const detectedType: 'image' | 'file' = isImage ? 'image' : 'file';

    if (file.size > 25 * 1024 * 1024) {
      showToast('حجم الملف كبير جداً (الأقصى 25 ميجابايت)');
      e.target.value = '';
      return;
    }

    const uploadFile = async (fileToUpload: File | Blob) => {
      setChatUploadingFile(true);
      try {
        const path = `chat-attachments/${Date.now()}_${file.name}`;
        const url = await uploadFileToStorage(fileToUpload, path);
        setChatAttachmentUrl(url);
        setChatAttachmentType(detectedType);
        showToast('✅ تم إرفاق الملف بنجاح');
      } catch (err: any) {
        console.error('Chat file upload error:', err);
        showToast('❌ فشل رفع الملف: ' + (err?.message || 'تحقق من الاتصال'));
      } finally {
        setChatUploadingFile(false);
        e.target.value = '';
      }
    };

    // Large PDF → compress via iLovePDF Client
    if (!isImage && file.type === 'application/pdf' && file.size > 10 * 1024 * 1024) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionMessage('جاري التحضير للضغط عبر سيرفرات iLovePDF...');
      try {
        const { compressWithILovePDF } = await import('@/lib/ilovepdf-client');
        const compressedFile = await compressWithILovePDF(file, (progress, message) => {
          setCompressionProgress(progress);
          setCompressionMessage(message);
        });
        await uploadFile(compressedFile);
      } catch (err: any) {
        showToast(err.message || 'فشل الضغط الذكي، جاري الرفع بالحجم الأصلي...');
        await uploadFile(file);
      } finally {
        setIsCompressing(false);
      }
      return;
    }

    // Large image → compress locally
    if (isImage && file.size > 4 * 1024 * 1024) {
      showToast('صورة كبيرة، جاري الضغط...');
      setChatUploadingFile(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        await uploadFile(compressed);
      } catch {
        await uploadFile(file);
      }
      return;
    }

    await uploadFile(file);
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (siteSettings?.primaryColor) {
      document.documentElement.style.setProperty('--gold', siteSettings.primaryColor);
    }
  }, [siteSettings?.primaryColor]);

  // Handle our own presence
  useEffect(() => {
    if (student && student.id !== 'unknown_student') {
      setUserOnlineStatus(student.id, 'student', true);
      
      const handleUnload = () => {
        setUserOnlineStatus(student.id, 'student', false);
      };
      window.addEventListener('beforeunload', handleUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        setUserOnlineStatus(student.id, 'student', false);
      };
    }
  }, [student]);

  const loadStudentData = useCallback(async () => {
    if (!student || !student.id || student.id === 'unknown_student') return;
    try {
      const tId = student.teacherId || 'unknown_teacher';
      const sId = student.id;

      if (tId === 'unknown_teacher') {
        console.warn('Student has no teacherId assigned');
        return;
      }

      const [allExams, myAtts, allMaterials, allAssignments, mySubs, allGames] = await Promise.all([
        getPublishedExams(tId).catch((e: any) => { console.error('Failed to load exams:', e); return [] as Exam[]; }),
        getAttemptsByStudent(sId).catch((e: any) => { console.error('Failed to load attempts:', e); return [] as Attempt[]; }),
        getMaterials(tId).catch((e: any) => { console.error('Failed to load materials:', e); return [] as CourseMaterial[]; }),
        getAssignments(tId).catch((e: any) => { console.error('Failed to load assignments:', e); return [] as Assignment[]; }),
        getStudentSubmissions(sId).catch((e: any) => { console.error('Failed to load submissions:', e); return [] as AssignmentSubmission[]; }),
        getGamesForStudent(tId, student.groupIds?.[0]).catch((e: any) => { console.error('Failed to load games:', e); return [] as EducationalGame[]; }),
      ]);

      // Filter exams for this student's group
      const filteredExams = allExams.filter((exam: Exam) => {
        if (!exam.targetGroup) return true;
        return student.groupIds?.includes(exam.targetGroup);
      });

      setExams(filteredExams);
      setAttempts(myAtts.filter((a: Attempt) => a.completed));
      setGames(allGames);
      
      // Fetch teacher name if missing
      if (!student.teacherName && tId !== 'unknown_teacher') {
        getTeacherById(tId).then((t: any) => {
          if (t && student) setStudent({ ...student, teacherName: t.name });
        });
      }
      
      const isSubscribed = student.subType !== 'none';
      const isExpired = student.subExpiry ? new Date(student.subExpiry).getTime() < Date.now() : false;
      const hasActiveSub = isSubscribed && !isExpired;

      const filteredMaterials = allMaterials.filter((m: CourseMaterial) => {
        // Filter by group visibility
        const groupMatch = !m.targetGroups || m.targetGroups.length === 0 || 
                         m.targetGroups.some((gId: string) => student.groupIds?.includes(gId));
        if (!groupMatch) return false;

        // Filter by subscription & exceptions
        if (m.isFree) return true;
        
        // Paid material
        const isExceptional = m.exceptionalStudents?.includes(student.id);
        if (isExceptional) return true;
        
        return hasActiveSub;
      });

      setMaterials(filteredMaterials);

      // Filter assignments by group
      const filteredAssigns = allAssignments.filter((a: Assignment) => {
        if (!a.targetGroup) return true;
        return student.groupIds?.includes(a.targetGroup);
      });
      setAssignments(filteredAssigns);
      setMySubmissions(mySubs);
    } catch (e) {
      console.error('loadStudentData error:', e);
    }
  }, [student, setStudent]);

  useEffect(() => {
    if (!student) return;
    if (student.teacherId) {
      getSettings(student.teacherId).then((s: any) => setSiteSettings(s));
      import('@/lib/db').then(({ getTeacherById }: any) => {
        getTeacherById(student.teacherId).then((t: any) => {
          setTeacherPermissions(t?.permissions || null);
          setTeacherInfo(t);
        });
      });
    }
    void loadStudentData();
    let unsubNotifs = () => {};
    let unsubConvs = () => {};
    if (student.teacherId && student.teacherId !== 'unknown_teacher') {
      unsubNotifs = subscribeToNotifications(student.teacherId, (allNotifs) => {
        setNotifications(filterNotificationsForStudent(allNotifs, student));
      });
      unsubConvs = subscribeToConversations(student.id, setConversations);
    }
    return () => {
      unsubNotifs();
      unsubConvs();
    };
  }, [student, loadStudentData, setConversations]);

  // Handle Chat and Other User Presence
  useEffect(() => {
    if (!selectedConv || !student) return;

    setLoadingChat(true);
    const unsub = subscribeToMessages(selectedConv.id, (msgs: Message[]) => {
      setChatMessages(msgs);
      setLoadingChat(false);
      markMessagesAsRead(selectedConv.id, student!.id);
    });

    const otherParticipantId = selectedConv.participants.find((p: string) => p !== student!.id);
    let unsubPresence = () => {};
    if (otherParticipantId) {
      unsubPresence = subscribeToUserOnlineStatus(otherParticipantId, 'teachers', (isOnline, lastActive) => {
        setOtherUserOnline(isOnline);
        setOtherUserLastActive(lastActive);
      });
    }

    return () => {
      unsub();
      unsubPresence();
    };
  }, [selectedConv, student]);

  // Listen for background upload completion
  useEffect(() => {
    const handleUploaded = (e: any) => {
      const { url, path, fileName } = e.detail;
      if (path.startsWith('assignments/')) {
        setUploadedFileUrl(url);
        if (e.detail.stats) {
          const { originalSize, compressedSize } = e.detail.stats;
          const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          showToast(`✅ تم الضغط والرفع: ${fileName} (قل بنسبة ${reduction}%)`);
        } else {
          showToast(`تم اكتمال رفع ملف الواجب: ${fileName}`);
        }
      }
    };
    window.addEventListener('fileUploaded', handleUploaded);
    return () => window.removeEventListener('fileUploaded', handleUploaded);
  }, []);

  const loadGlobalSchedule = useCallback(async () => {
    if (!student || student.id === 'unknown_student') return;
    setLoadingSchedule(true);
    try {
      const allEvents: CalendarEvent[] = [];
      
      // Load events for each enrollment
      for (const enrollment of allEnrollments) {
        if (!enrollment.teacherId) continue;
        
        // Fetch manual events
        const manual = await getCalendarEvents(enrollment.teacherId);
        
        // Fetch exams and assignments to include them in schedule
        const teacherExams = await getExams(enrollment.teacherId);
        const teacherAssigns = await getAssignments(enrollment.teacherId);
        
        const examEvents = teacherExams
          .filter((e: Exam) => e.startTime)
          .map((e: Exam) => ({
            id: `exam-${e.id}`,
            title: `امتحان: ${e.title}`,
            date: e.startTime!,
            type: 'exam' as const,
            teacherId: e.teacherId,
            teacherName: (e as any).teacherName || (enrollment as any).teacherName || 'المعلم',
            createdAt: e.createdAt || new Date().toISOString()
          }));
          
        const assignEvents = teacherAssigns
          .filter((a: Assignment) => a.dueDate)
          .map((a: Assignment) => ({
            id: `assign-${a.id}`,
            title: `واجب: ${a.title}`,
            date: a.dueDate,
            type: 'assignment' as const,
            teacherId: enrollment.teacherId,
            teacherName: (enrollment as any).teacherName || 'المعلم',
            createdAt: a.createdAt || new Date().toISOString()
          }));

        // Tag manual events with teacher name
        const taggedManual = manual.map((m: CalendarEvent) => ({
          ...m,
          teacherName: (enrollment as any).teacherName || 'المعلم'
        }));

        allEvents.push(...examEvents, ...assignEvents, ...taggedManual);
      }
      
      // Sort by date/time
      setAllTeacherEvents(allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (err) {
      console.error('Failed to load global schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }, [student, allEnrollments]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      void loadGlobalSchedule();
    }
  }, [activeTab, loadGlobalSchedule]);

  const handleLogin = async () => {
    if (!code.trim()) { setError('أدخل كودك أولاً'); return; }
    setLoading(true);
    setError('');
    try {
      const s = await getStudentByCode(code.trim());
      if (!s) { 
        setError('❌ الكود غير صحيح'); 
      } else { 
        // Success! Now fetch ALL enrollments for this student's phone
        const all = await getEnrollmentsByPhone(s.phone || '');
        
        // Find teacher names for all enrollments if missing
        const enriched = await Promise.all(all.map(async (en: Student) => {
          if (!en.teacherName && en.teacherId) {
            const t = await getTeacherById(en.teacherId);
            return { 
              ...en, 
              teacherName: t?.name || 'معلم غير معروف',
              teacherImage: t?.imageUrl,
              teacherSubject: t?.subject || 'مادة دراسية'
            };
          }
          return en;
        }));

        setAllEnrollments(enriched);
        
        // Find the specific enrollment that matches the code entered
        const active = enriched.find((e: Student) => e.code === code.trim().toUpperCase()) || enriched[0];
        setStudent(active);
        showToast(`✅ أهلاً بك في أكاديمية ${active.teacherName}`);
      }
    } catch (err: any) { 
      console.error(err);
      setError('تعذّر الاتصال'); 
    }
    finally { setLoading(false); }
  };

  const handleForgotCode = async () => {
    if (!parentPhone.trim()) { showToast('أدخل رقم ولي الأمر أولاً'); return; }
    setFindingCode(true);
    setRecoveredCode('');
    try {
      const all = await getEnrollmentsByParentPhone(parentPhone.trim());
      if (all.length > 0) {
        // Enriched all for the switcher to work later if they enter one code
        const enriched = await Promise.all(all.map(async (en: Student) => {
          if (!en.teacherName && en.teacherId) {
            const t = await getTeacherById(en.teacherId);
            return { 
              ...en, 
              teacherName: t?.name || 'معلم غير معروف',
              teacherImage: t?.imageUrl,
              teacherSubject: t?.subject || 'مادة دراسية'
            };
          }
          return en;
        }));
        setAllEnrollments(enriched);
        setRecoveredCode(all[0].code); // Show first one for now as a hint
        showToast('✅ تم العثور على اشتراكاتك، أدخل أي كود للدخول');
      } else {
        showToast('لم يتم العثور على طالب بهذا الرقم');
      }
    } catch (e: any) {
      showToast('حدث خطأ أثناء البحث');
    } finally {
      setFindingCode(false);
    }
  };

  const handleAssignmentSubmit = async (assignId: string) => {
    if (!submitText.trim() && !uploadedFileUrl) {
      showToast('يرجى كتابة نص الإجابة أو الانتظار حتى اكتمال رفع الملف');
      return;
    }

    setSubmittingAssignId(assignId);
    try {
      const sub: Omit<AssignmentSubmission, 'id'> = {
        assignmentId: assignId,
        studentId: student!.id,
        studentName: student!.name,
        teacherId: student!.teacherId,
        textAnswer: submitText,
        fileUrl: uploadedFileUrl,
        maxScore: assignments.find(a => a.id === assignId)?.maxScore || 10,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };

      await submitAssignment(sub);
      
      try {
        const assign = assignments.find(a => a.id === assignId);
        await dispatchNotification({
          teacherId: student!.teacherId,
          msg: `قام الطالب ${student!.name} بتسليم واجب: ${assign?.title || 'غير معروف'}`,
          targetRoles: ['admin'],
          channels: { inApp: true, whatsapp: false },
          actionPath: '/teacher/assignments'
        });
      } catch (e) {
        console.error('Failed to notify admin:', e);
      }

      setSubmitText('');
      setSubmitFile(null);
      setUploadedFileUrl('');
      showToast('تم تقديم الواجب بنجاح');
      loadStudentData(); // Refresh submissions list
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء تقديم الواجب');
    } finally {
      setSubmittingAssignId(null);
    }
  };

  const printCertificate = () => {
    window.print();
  };

  if (!mounted) return null;

  // Academy Selection Overlay
  if (!student && allEnrollments.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--dark)' }}>
        <div className="w-full max-w-lg space-y-6 animate-scale-in text-right" dir="rtl">
          <div className="text-center space-y-2">
            <div className="text-5xl">🏰</div>
            <h1 className="text-2xl font-black gold-text">اختر الأكاديمية</h1>
            <p className="text-sm text-text-muted">أهلاً بك مجدداً، يرجى اختيار المعلم الذي تود متابعته الآن</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allEnrollments.map((en) => (
              <button
                key={en.id}
                onClick={() => setStudent(en)}
                className="card-base p-6 text-right hover:border-gold/50 transition-all group relative overflow-hidden active:scale-95"
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold text-xl font-bold border border-gold/20 overflow-hidden shrink-0">
                    {en.teacherImage ? (
                      <img src={en.teacherImage} alt={en.teacherName} className="w-full h-full object-cover" />
                    ) : (
                      en.teacherName?.[0] || '👨‍🏫'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white group-hover:gold-text transition-colors truncate">أكاديمية {en.teacherName || 'متميزة'}</div>
                    <div className="text-[10px] text-text-muted mt-0.5 flex flex-wrap items-center gap-2 truncate">
                      <span className="shrink-0">{en.teacherSubject || 'مادة دراسية'}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                      <span className="truncate">كود: {en.code}</span>
                      
                      {/* Subscription Status Badge */}
                      {(() => {
                        if (en.subType === 'none') return <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-500/10 text-gray-500 border border-white/5">غير مشترك</span>;
                        const isExpired = en.subExpiry && en.subExpiry < Date.now();
                        return isExpired 
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-black">⚠️ اشتراك منتهي</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">✅ مشترك نشط</span>;
                      })()}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-gold/20 transition-all text-text-muted group-hover:text-gold shrink-0">
                    ←
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center pt-4">
            <button 
              onClick={() => { logout(); setAllEnrollments([]); }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 mx-auto"
            >
              🚪 تسجيل الخروج وتبديل الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login screen
  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--dark)' }}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-80 h-80 rounded-full opacity-8"
            style={{ background: 'radial-gradient(circle, var(--gold), transparent)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative w-full max-w-sm animate-scale-in">
          <div className="card-base p-5 sm:p-7 text-center"
            style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,197,24,0.12)' }}>
            <div className="text-4xl sm:text-5xl mb-3">🎓</div>
            <h1 className="text-lg sm:text-xl font-cairo font-black gold-text mb-1">بوابة الطالب</h1>
            <p className="text-[10px] sm:text-xs mb-4" style={{ color: 'var(--text-muted)' }}>أدخل كودك للوصول إلى اختباراتك</p>

            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="أدخل الكود..."
              className="input-base text-center text-lg sm:text-xl font-mono tracking-[0.2em] sm:tracking-[0.3em] mb-3 py-3"
              style={{ border: '2px solid rgba(245,197,24,0.2)' }}
              maxLength={8}
              autoFocus
            />


            {error && (
              <div className="p-2 rounded-lg mb-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading}
              className="btn-gold w-full justify-center text-base py-3 mb-4 shadow-xl shadow-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              {loading ? <><Loader2 className="animate-spin" size={18} /> جاري...</> : '🚀 دخول للمنصة'}
            </button>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex flex-col gap-2">
                <Link href="/register" className="text-xs font-bold gold-text hover:brightness-125 transition-all">
                  ✨ ليس لديك حساب؟ اطلب اشتراك الآن
                </Link>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => setShowForgotCode(true)}
                    className="text-[10px] text-text-muted hover:text-white transition-colors flex items-center gap-1"
                  >
                    ❓ نسيت الكود؟
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Code Modal */}
            {showForgotCode && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="card-base w-full max-w-sm p-6 border border-gold/30 animate-scale-in">
                  <h3 className="text-xl font-bold mb-4 text-center">استرجاع كود الطالب</h3>
                  <p className="text-xs text-text-muted mb-4 text-center">أدخل رقم هاتف ولي الأمر المسجل للحصول على الكود الخاص بك.</p>
                  
                  <input
                    type="tel"
                    placeholder="رقم هاتف ولي الأمر..."
                    className="input-base w-full text-center mb-4"
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                  />

                  {recoveredCode && (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-4 text-center animate-bounce">
                      <p className="text-xs text-green-400 mb-1">كود الطالب الخاص بك هو:</p>
                      <p className="text-2xl font-black font-mono text-white tracking-widest">{recoveredCode}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setShowForgotCode(false); setRecoveredCode(''); setParentPhone(''); }}
                      className="btn-outline flex-1 py-3"
                    >
                      إغلاق
                    </button>
                    {!recoveredCode && (
                      <button 
                        onClick={handleForgotCode}
                        disabled={findingCode}
                        className="btn-gold flex-[2] py-3"
                      >
                        {findingCode ? 'جاري البحث...' : '🔍 عرض الكود'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Subscription expiry check ----
  const isSubExpired =
    student.subType !== 'none' &&
    student.subExpiry != null &&
    student.subExpiry < Date.now();

  // If subscription is expired → show full-screen overlay
  if (isSubExpired) {
    return (
      <SubscriptionExpiredOverlay
        target="student"
        student={student}
        teacherInfo={teacherInfo}
        settings={siteSettings}
        onLogout={logout}
        onRenewalSuccess={() => {
          // Refresh student data after teacher approves (polling not needed — overlay shows success message)
        }}
      />
    );
  }

  // Student dashboard
  const completedAttempts = attempts.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark)' }} dir="rtl">
      {/* ═══ MOBILE APP LAYOUT OVERLAY ═══ */}
      <MobileStudentPortalWrapper
        student={student}
        notifications={notifications}
        conversations={conversations}
        exams={exams}
        materials={materials}
        assignments={assignments}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
        onNotifClick={() => setShowNotifs(!showNotifs)}
        onLogout={logout}
        hasMultipleAcademies={allEnrollments.length > 1}
        onAcademySwitch={() => setStudent(null)}
      >
        <div className="space-y-4">
          {/* Expiry Warning */}
          {student.subExpiry && new Date(student.subExpiry).getTime() > Date.now() && new Date(student.subExpiry).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 && (
            <div className="card-base p-4 bg-red-500/10 border-red-500/30 flex items-start gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="font-bold text-red-400">تنبيه اقتراب انتهاء الاشتراك</div>
                <div className="text-sm text-red-300 mt-1 leading-relaxed">
                  عزيزي الطالب، اشتراكك الحالي سينتهي يوم <strong>{formatDateAr(new Date(student.subExpiry).toISOString())}</strong>. يرجى التجديد قريباً لضمان استمرار وصولك للمنصة.
                </div>
              </div>
            </div>
          )}

          {/* Discover Teachers Tab */}
          {activeTab === 'discover' && (
            <TeacherDiscovery 
              currentTeacherId={student.teacherId}
              onBack={() => setActiveTab('home')}
            />
          )}

          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div className="space-y-3 animate-slide-up">
              {exams.length === 0 ? (
                <div className="card-base p-10 text-center">
                  <div className="text-4xl mb-2">📝</div>
                  <p style={{ color: 'var(--text-muted)' }}>لا توجد اختبارات متاحة لك الآن</p>
                </div>
              ) : exams.map(exam => {
                const myAttempts = attempts.filter(a => a.examId === exam.id);
                const lastAtt = myAttempts.length ? myAttempts[myAttempts.length - 1] : null;

                const calculateRawScore = (a: Attempt) => {
                  const mcqPoints = a.mcqScore * a.mcqTotal / 100;
                  const essayPoints = a.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
                  const totalPoints = a.mcqTotal + (a.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
                  return { points: Math.round((mcqPoints + essayPoints) * 10) / 10, total: totalPoints };
                };

                const lastScoreData = lastAtt ? calculateRawScore(lastAtt) : null;
                const lastScorePercent = lastAtt ? (lastAtt.finalScore ?? lastAtt.mcqScore ?? 0) : null;
                const maxAttempts = exam.allowRetake ? null : 1;
                const canTake = !maxAttempts || myAttempts.length < maxAttempts;

                const now = Date.now();
                const start = exam.startTime ? new Date(exam.startTime).getTime() : 0;
                const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity;
                const available = !start || (now >= start && now <= end);
                const upcoming = start && now < start;

                const isPendingEssay = lastAtt?.essayAnswers?.some(ea => ea.pending) ?? false;

                return (
                  <div id={`exam-${exam.id}`} key={exam.id} className="card-base p-4 transition-all hover:border-yellow-500/20">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base mb-1">{exam.title}</div>
                        <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {exam.subject && <span>📚 {exam.subject}</span>}
                          <span>❓ {(exam.questions || []).length} سؤال</span>
                          <span>⏱ {exam.duration} دقيقة</span>
                          <span>📊 نجاح {exam.passScore}%</span>
                        </div>
                        {lastScoreData !== null && (
                          <div className="mt-2 text-sm">
                            آخر نتيجة:
                            {isPendingEssay ? (
                              <span className="font-bold mr-1 text-purple-400">
                                ⏳ بانتظار تصحيح الأسئلة المقالية
                              </span>
                            ) : (
                              <span className="font-bold mr-1" style={{ color: gradeColor(lastScorePercent!, exam.passScore) }}>
                                {lastScoreData.points} / {lastScoreData.total} ({lastScorePercent}%) — {scoreLabel(lastScorePercent!)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-xs">
                          {upcoming ? (
                            <span style={{ color: 'var(--gold)' }}>🟡 يبدأ: {formatDateAr(exam.startTime!)}</span>
                          ) : available ? (
                            <span style={{ color: 'var(--green)' }}>🟢 متاح الآن</span>
                          ) : (
                            <span style={{ color: 'var(--red)' }}>🔴 انتهى وقت الاختبار</span>
                          )}
                        </div>
                      </div>
                      {canTake && available && (
                        <Link href={`/exam?id=${exam.id}`} className="btn-gold text-sm py-2 px-4 flex-shrink-0">
                          📝 ابدأ
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div className="space-y-4 animate-slide-up">
              {materials.length === 0 ? (
                <div className="card-base p-10 text-center">
                  <div className="text-4xl mb-2 opacity-50">📚</div>
                  <p style={{ color: 'var(--text-muted)' }}>لا توجد مناهج أو دروس متاحة لك حالياً.</p>
                </div>
              ) : (
                Object.entries(
                  materials.reduce((acc, m) => {
                    if (!acc[m.subject]) acc[m.subject] = [];
                    acc[m.subject].push(m);
                    return acc;
                  }, {} as Record<string, CourseMaterial[]>)
                ).map(([subject, subjectMaterials]) => (
                  <div key={subject} className="card-base overflow-hidden">
                    <div className="bg-white/5 p-4 border-b border-white/5 flex items-center gap-3">
                      <BookMarked className="text-gold" size={20} />
                      <h2 className="font-bold text-lg text-white font-cairo">{subject}</h2>
                    </div>
                    <div className="divide-y divide-white/5">
                      {subjectMaterials.map(material => (
                        <div key={material.id} className="p-4 hover:bg-white/5 transition-colors flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                            {material.type === 'video' && <Video size={18} className="text-blue-400" />}
                            {material.type === 'pdf' && <FileText size={18} className="text-red-400" />}
                            {material.type === 'image' && <span className="text-lg leading-none">🖼️</span>}
                            {material.type === 'file' && <Download size={18} className="text-emerald-400" />}
                            {material.type === 'link' && <LinkIcon size={18} className="text-gold" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{material.title}</div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs">
                              {material.isFree ? (
                                <span className="text-green-500 flex items-center gap-1"><Globe size={10}/> مجاني</span>
                              ) : (
                                <span className="text-gold flex items-center gap-1"><Lock size={10}/> للمشتركين</span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => openPreview((material.url || material.fileUrl)!, material.title)}
                                className="btn-outline text-[10px] px-3 py-1.5 h-auto">
                                عرض
                              </button>
                              {(material.type === 'pdf' || material.type === 'file' || material.type === 'image') && (
                                <a href={getDownloadUrl((material.url || material.fileUrl)!, material.title)} target="_blank" download className="btn-gold text-[10px] px-3 py-1.5 h-auto">
                                  تحميل
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="space-y-4 animate-slide-up">
              {assignments.length === 0 ? (
                <div className="card-base p-10 text-center">
                  <div className="text-4xl mb-2 opacity-50">📋</div>
                  <p style={{ color: 'var(--text-muted)' }}>لا توجد واجبات مطلوبة.</p>
                </div>
              ) : assignments.map(assign => {
                const submission = mySubmissions.find(s => s.assignmentId === assign.id);
                const isPastDue = new Date(assign.dueDate).getTime() < Date.now();
                const isSubmitting = submittingAssignId === assign.id;

                return (
                  <div key={assign.id} className="card-base p-5 border border-white/5 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-1 h-full ${submission ? 'bg-green-500' : isPastDue ? 'bg-red-500' : 'bg-gold'}`} />
                    <h3 className="font-bold text-base mb-1">{assign.title}</h3>
                    <p className="text-xs text-gray-400 mb-4">{assign.description}</p>
                    
                    {submission ? (
                      <div className="bg-black/20 p-3 rounded-xl space-y-2">
                        <p className="text-xs text-green-400 font-bold">✓ تم التسليم</p>
                        {submission.status === 'graded' && (
                          <p className="text-lg font-black text-white">الدرجة: {submission.score} / {submission.maxScore}</p>
                        )}
                        {submission.teacherComment && (
                          <p className="text-[10px] text-gray-400 bg-white/5 p-2 rounded"><b>ملاحظة:</b> {submission.teacherComment}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea 
                          className="input-base w-full h-20 p-3 text-xs resize-none"
                          placeholder="اكتب إجابتك هنا..."
                          value={submitText}
                          onChange={e => setSubmitText(e.target.value)}
                        />
                        <GlobalFileUpload 
                          isUploading={isSubmitting}
                          label="إرفاق ملف الحل"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSubmitFile(file);
                              const path = `assignments/${assign.id}/${student!.id}_${file.name}`;
                              await FileProcessor.queueFile(file, path);
                            }
                          }}
                        />
                        <button 
                          onClick={() => handleAssignmentSubmit(assign.id)}
                          disabled={isSubmitting || (!submitText.trim() && !uploadedFileUrl)}
                          className="btn-gold w-full py-2.5 text-xs font-bold"
                        >
                          {isSubmitting ? 'جاري التسليم...' : 'إرسال الواجب'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="flex flex-col h-[500px] card-base overflow-hidden animate-slide-up bg-[#0d121f]">
              {!selectedConv ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-gold/5 rounded-full flex items-center justify-center border border-gold/10">
                    <MessageSquare size={32} className="text-gold/20" />
                  </div>
                  <button 
                    onClick={() => {
                      const convId = [student.id, student.teacherId].sort().join('_');
                      const existing = conversations.find(c => c.id === convId);
                      setSelectedConv(existing || {
                        id: convId,
                        participants: [student.id, student.teacherId],
                        participantNames: [student.name, student.teacherName || 'المعلم'],
                        updatedAt: Date.now()
                      } as Conversation);
                    }}
                    className="w-full p-4 rounded-2xl bg-gold/5 border border-gold/10 flex items-center gap-3 hover:bg-gold/10 transition-all text-right"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-black font-black">
                       {(student.teacherName || 'م')[0]}
                    </div>
                    <div className="flex-1">
                       <p className="font-bold text-sm text-gold">المعلم: {student.teacherName || 'غير معروف'}</p>
                       <p className="text-[10px] text-gray-500">تواصل مباشر مع معلمك</p>
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedConv(null)} className="text-gray-400 p-1"><X size={18}/></button>
                      <div className="flex flex-col">
                        <div className="text-xs font-bold">{selectedConv.participantNames.find(n => n !== student.name)}</div>
                        <div className={`text-[9px] flex items-center gap-1 ${otherUserOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
                          <span className={`w-1 h-1 rounded-full shrink-0 ${otherUserOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          {otherUserOnline
                            ? 'متصل الآن'
                            : otherUserLastActive
                              ? `آخر نشاط: ${formatRelativeLastSeenAr(otherUserLastActive)}`
                              : 'خارج الخط'}
                        </div>
                      </div>
                    </div>
                    {siteSettings?.whatsappEnabled && siteSettings?.whatsappNumber && (
                      <a 
                        href={`https://wa.me/${siteSettings.whatsappNumber.startsWith('2') ? siteSettings.whatsappNumber : '2' + siteSettings.whatsappNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 bg-[#25D366]/10 text-[#25D366] px-3 py-1.5 rounded-xl border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all text-[10px] font-bold"
                      >
                        <MessageCircle size={14} />
                        تواصل عبر واتساب
                      </a>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.senderId === student.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-2.5 rounded-2xl text-xs shadow-lg ${
                          msg.senderId === student.id ? 'bg-gold text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                        }`}>
                           {msg.type === 'image' && msg.fileUrl && (
                             <img src={msg.fileUrl} alt="Attachment" className="max-w-full h-auto rounded-lg mb-2" onClick={() => openPreview(msg.fileUrl!, 'صورة')} />
                           )}
                           {msg.type === 'file' && msg.fileUrl && (
                             <div className="flex items-center gap-2 mb-2 p-2 bg-black/20 rounded-lg cursor-pointer" onClick={() => openPreview(msg.fileUrl!, 'ملف')}>
                               <FileText size={16} /> <span className="text-[10px] truncate">ملف مرفق</span>
                             </div>
                           )}
                           {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                           <div className="text-[8px] opacity-50 mt-1 text-left">
                             {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                           </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 bg-white/5 flex flex-col gap-2 relative">
                    
                    {/* Inline ILovePDF Compression Progress UI */}
                    {isCompressing && (
                      <div className="flex items-center gap-4 bg-gold/10 border border-gold/20 p-3 rounded-xl mb-1 animate-fade-in shadow-glow">
                        <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin shrink-0 shadow-[0_0_10px_var(--gold)]" />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-gold">{compressionMessage}</span>
                            <span className="text-[10px] text-gold font-black bg-gold/10 px-2 py-0.5 rounded-md">{compressionProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-gold transition-all duration-300 shadow-[0_0_8px_var(--gold)]" style={{ width: `${compressionProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {chatAttachmentUrl && (
                      <div className="flex items-center justify-between p-2 bg-gold/10 rounded-lg border border-gold/20">
                        <span className="text-[9px] text-gold font-bold flex items-center gap-1">
                          {chatAttachmentType === 'image' ? <ImageIcon size={12}/> : <FileText size={12}/>} ملف مرفق جاهز
                        </span>
                        <button onClick={() => setChatAttachmentUrl('')} className="text-red-400"><X size={14}/></button>
                      </div>
                    )}
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if ((!newMsg.trim() && !chatAttachmentUrl) || !selectedConv) return;
                      const recId = selectedConv.participants.find(p => p !== student.id);
                      if (!recId) { showToast('خطأ: لا يمكن تحديد المستلم'); return; }
                      const recName = selectedConv.participantNames[selectedConv.participants.indexOf(recId)] || 'المعلم';
                      const msgContent = newMsg.trim();
                      setNewMsg('');
                      const attachUrl = chatAttachmentUrl;
                      const attachType = chatAttachmentType;
                      setChatAttachmentUrl('');
                      setChatAttachmentType('text');
                      try {
                        await sendMessage({
                          senderId: student.id,
                          senderName: student.name,
                          receiverId: recId,
                          receiverName: recName,
                          content: msgContent,
                          teacherId: student.teacherId || recId,
                          type: attachUrl ? attachType : 'text',
                          ...(attachUrl ? { fileUrl: attachUrl } : {})
                        });

                        // Notify the teacher about the new message
                        await dispatchNotification({
                          teacherId: student.teacherId || recId,
                          msg: `رسالة جديدة من الطالب ${student.name}`,
                          channels: { inApp: true, whatsapp: false },
                          actionPath: `/teacher/messages?studentId=${student.id}`
                        });
                      } catch (err: any) {
                        showToast('فشل الإرسال: ' + (err?.message || 'خطأ غير معروف'));
                        setNewMsg(msgContent); // restore message
                      }
                    }} className="flex gap-2">
                      <div className="flex gap-1">
                        <label className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors ${chatUploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                          {chatUploadingFile ? (
                            <Loader2 size={18} className="text-gold animate-spin" />
                          ) : (
                            <Paperclip size={18} className="text-gray-400" />
                          )}
                          <input type="file" className="hidden" disabled={chatUploadingFile} onChange={(e) => handleChatAttachment(e, 'file')} accept="image/*,application/pdf,.doc,.docx,.txt" />
                        </label>
                      </div>
                      <input type="text" placeholder="اكتب رسالتك..." className="input-base flex-1 h-10 text-xs px-3" value={newMsg} onChange={e => setNewMsg(e.target.value)} />
                      <button type="submit" disabled={isCompressing || chatUploadingFile} className="w-10 h-10 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"><Send size={18}/></button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-3 animate-slide-up">
              {completedAttempts.length === 0 ? (
                <div className="card-base p-10 text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p style={{ color: 'var(--text-muted)' }}>لا توجد نتائج بعد</p>
                </div>
              ) : [...completedAttempts].reverse().map(att => {
                const essayPending = att.essayAnswers?.some((ea) => ea.pending) ?? false;
                const scorePercent = att.finalScore ?? att.mcqScore ?? 0;
                const exam = exams.find(e => e.id === att.examId);

                return (
                  <div key={att.id} className="card-base p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-bold text-sm">{att.examTitle}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {essayPending ? (
                          <span className="badge badge-purple text-[10px] sm:text-xs animate-pulse">
                            ⏳ قيد التصحيح
                          </span>
                        ) : (
                          <span className={`badge ${att.passed ? 'badge-green' : 'badge-red'}`}>
                            {att.passed ? '✅ ناجح' : '❌ راسب'}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {att.submittedAt ? formatDateAr(att.submittedAt) : ''}
                        </span>
                      </div>
                      <div className={`text-lg font-black mt-1 ${essayPending ? 'text-purple-300' : 'gold-text'}`}>
                        {essayPending ? (
                          <span className="text-sm font-bold">درجة مؤقتة: {scorePercent}% — بانتظار تصحيح المقالي</span>
                        ) : (
                          `${scorePercent}%`
                        )}
                      </div>
                    </div>
                    {att.passed && !essayPending && (
                       <button onClick={() => setCertData({ attempt: att, exam: exams.find(e=>e.id===att.examId)! })} className="btn-gold text-[10px] px-3 py-2 flex items-center gap-2">
                         <Award size={14} /> الشهادة
                       </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Games Tab */}
          {activeTab === 'games' && (
            <div className="space-y-4 animate-slide-up pb-20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Gamepad2 size={24} className="text-gold" /> الألعاب التعليمية
                </h3>
                <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">مهمات ذكية</span>
              </div>

              {games.length === 0 ? (
                <div className="card-base p-16 text-center space-y-4 border-dashed border-white/10">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20">
                    <Gamepad2 size={32} />
                  </div>
                  <p className="text-xs text-text-muted">لا توجد ألعاب تعليمية مفعلة لك حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {games.map(game => (
                    <button 
                      key={game.id}
                      onClick={() => setSelectedGame(game)}
                      className="card-base p-4 text-right flex items-center gap-4 group active:scale-95 transition-all bg-gradient-to-l from-white/5 to-transparent border-white/10 hover:border-gold/30 relative z-10 cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-dark transition-all">
                         {game.type === 'flashcards' ? <Layers size={28} /> 
                          : game.type === 'match' ? <Trophy size={28} />
                          : game.type === 'sentence' ? <Languages size={28} />
                          : game.type === 'sort' ? <Brain size={28} />
                          : game.type === 'tf_run' ? <Zap size={28} />
                          : <GraduationCap size={28} />}
                      </div>
                      <div className="flex-1">
                         <h4 className="font-bold text-white group-hover:gold-text transition-all">{game.title}</h4>
                         <p className="text-[10px] text-text-muted mt-1 uppercase tracking-tighter">
                            {game.type === 'flashcards' ? 'بطاقات تعليمية' 
                             : game.type === 'match' ? 'مطابقة المصطلحات'
                             : game.type === 'sentence' ? 'ترتيب الجمل'
                             : game.type === 'sort' ? 'تصنيف المواد'
                             : game.type === 'tf_run' ? 'سرعة الرد'
                             : 'تحدي الأسئلة'}
                         </p>
                      </div>
                      <ChevronRight size={20} className="text-white/20 group-hover:text-gold" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-slide-up">
              {/* Profile Header Card */}
              <div className="card-base p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 50% 0%, var(--gold), transparent 70%)' }} />
                <div className="relative w-28 h-28 rounded-full border-4 border-gold shadow-[0_0_25px_rgba(245,197,24,0.4)] mb-4 overflow-hidden">
                  {student.imageUrl ? (
                    <img src={student.imageUrl} alt={student.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gold/20">
                      <User size={48} className="text-gold" />
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-black font-cairo text-white">{student.name}</h3>
                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-gold" /> الكود: <span className="font-mono text-gold font-bold">{student.code}</span>
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className={`badge ${student.subExpiry && new Date(student.subExpiry).getTime() > Date.now() ? 'badge-green' : student.subType === 'none' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' : 'badge-gold'}`}>
                    {student.subType === 'monthly' ? '📅 اشتراك شهري'
                      : student.subType === 'yearly' ? '📆 اشتراك سنوي'
                      : student.subType === 'halfYearly' ? '📅 نصف سنوي'
                      : student.subType === 'session' ? '🎯 حصص'
                      : student.subType === 'course' ? '📚 كورس'
                      : '🚫 بدون اشتراك'}
                  </span>
                </div>
              </div>

              {/* Details Card */}
              <div className="card-base p-0 overflow-hidden text-sm divide-y divide-white/5">
                {student.phone && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-gray-400">📱 رقم الطالب</span>
                    <span className="font-bold" dir="ltr">{student.phone}</span>
                  </div>
                )}
                {student.parentPhone && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-gray-400">📞 ولي الأمر</span>
                    <span className="font-bold" dir="ltr">{student.parentPhone}</span>
                  </div>
                )}
                <div className="p-4 flex items-center justify-between">
                  <span className="text-gray-400">📅 تاريخ الانضمام</span>
                  <span className="font-bold">{student.createdAt ? new Date(student.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}</span>
                </div>
                {student.subExpiry && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-gray-400">⏰ انتهاء الاشتراك</span>
                    <span className={`font-bold ${new Date(student.subExpiry).getTime() > Date.now() ? 'text-green-400' : 'text-red-400'}`}>
                      {new Date(student.subExpiry).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                )}
                {student.subPrice != null && student.subPrice > 0 && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-gray-400">💰 سعر الاشتراك</span>
                    <span className="font-bold text-gold">{student.subPrice} جنيه</span>
                  </div>
                )}
                {student.grade && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-gray-400">🎓 الصف الدراسي</span>
                    <span className="font-bold">{student.grade}</span>
                  </div>
                )}
              </div>

              {/* Teacher Info Card */}
              {teacherInfo && (
                <div className="card-base p-0 overflow-hidden">
                  <div className="p-3 bg-gold/5 border-b border-gold/10 flex items-center gap-2">
                    <GraduationCap size={16} className="text-gold" />
                    <span className="text-xs font-bold text-gold">المعلم المشترك معه</span>
                  </div>
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-gold/30 overflow-hidden flex-shrink-0 bg-gold/10 flex items-center justify-center">
                      {teacherInfo.imageUrl ? (
                        <img src={teacherInfo.imageUrl} alt={teacherInfo.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gold font-black text-lg">{teacherInfo.name?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{teacherInfo.name}</p>
                      {teacherInfo.subject && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <BookOpen size={11} className="text-gold" /> {teacherInfo.subject}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp + Logout */}
              {teacherInfo && teacherInfo.phone && (
                <a href={`https://wa.me/${teacherInfo.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-3 font-bold text-white py-4 rounded-2xl shadow-lg shadow-[#25D366]/20" style={{ background: '#25D366' }}>
                  <MessageCircle size={22} /> تواصل مع المعلم عبر واتساب
                </a>
              )}

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 transition-colors"
              >
                <LogOut size={18} /> تسجيل الخروج
              </button>
            </div>
          )}

          {/* Global Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-4 animate-slide-up pb-24">
              <div className="flex items-center justify-between bg-gold/5 p-4 rounded-2xl border border-gold/10">
                <div className="flex items-center gap-3">
                  <Calendar className="text-gold" />
                  <h3 className="font-bold text-white">جدولك الدراسي الموحد</h3>
                </div>
                <button onClick={loadGlobalSchedule} className="text-xs gold-text">🔄 تحديث</button>
              </div>

              {loadingSchedule ? (
                <div className="flex flex-col items-center justify-center p-20 gap-3">
                  <Loader2 className="animate-spin text-gold" size={32} />
                  <span className="text-xs text-text-muted">جاري تجميع جدولك...</span>
                </div>
              ) : allTeacherEvents.length === 0 ? (
                <div className="card-base p-16 text-center space-y-4">
                  <Calendar className="mx-auto text-white/5" size={48} />
                  <p className="text-xs text-text-muted">لا توجد فعاليات مجدولة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allTeacherEvents.map((evt: any) => {
                    const dateObj = new Date(evt.date);
                    const isPast = dateObj.getTime() < Date.now();
                    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
                    const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={evt.id} className={`card-base p-4 border border-white/5 flex gap-4 ${isPast ? 'opacity-50' : ''}`}>
                         <div className="w-16 flex flex-col items-center justify-center border-l border-white/5 pl-4 shrink-0">
                           <span className="text-[10px] font-bold text-gold uppercase">{dayName}</span>
                           <span className="text-xl font-black">{dateObj.getDate()}</span>
                           <span className="text-[10px] text-gray-500">{dateObj.toLocaleDateString('ar-EG', { month: 'short' })}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                               <h4 className="font-bold text-sm truncate">{evt.title}</h4>
                               <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ml-2 ${
                                 evt.type === 'exam' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                 evt.type === 'assignment' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                 evt.type === 'fixed_class' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                               }`}>
                                 {evt.type === 'exam' ? 'امتحان' : 
                                  evt.type === 'assignment' ? 'واجب' : 
                                  evt.type === 'fixed_class' ? 'حصة ثابتة' : 'فعالية'}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                               <Clock size={10} className="text-gold" /> {timeStr}
                               <span className="w-1 h-1 rounded-full bg-white/20" />
                               <span className="gold-text font-bold">🎓 {evt.teacherName}</span>
                            </div>
                            {evt.isRecurring && evt.recurringDays && (
                              <div className="mt-2 flex gap-1">
                                {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, dIdx) => (
                                  <span key={dIdx} className={`w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold ${evt.recurringDays.includes(dIdx) ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-600'}`}>
                                    {day}
                                  </span>
                                ))}
                              </div>
                            )}
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </MobileStudentPortalWrapper>

      {/* ═══ NOTIFICATIONS PANEL ═══ */}
      {showNotifs && (
        <div
          className="fixed inset-0 z-[80] flex justify-start"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowNotifs(false)}
        >
          <div
            className="w-full max-w-sm h-full flex flex-col bg-[#12121f] shadow-2xl border-l border-white/10"
            style={{ animation: 'slideInLeft 0.25s ease' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20 flex-shrink-0">
              <h3 className="font-black text-lg font-cairo flex items-center gap-2 text-white">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center border border-gold/30">
                  <Bell size={18} className="text-gold" />
                </div>
                الإشعارات
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </h3>
              <button onClick={() => setShowNotifs(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
              {notifications.length === 0 ? (
                <div className="text-center p-12 text-gray-500 flex flex-col items-center justify-center h-full gap-3">
                  <Bell size={48} className="text-white/5" />
                  <p className="font-bold">لا توجد إشعارات حالياً</p>
                </div>
              ) : notifications.map(n => (
                <div key={n.id} 
                  onClick={async () => {
                    if (!n.read) {
                      try {
                        await markNotificationRead(n.id);
                      } catch (e: any) {
                        console.error('Failed to mark read:', e);
                      }
                    }
                    if (n.actionPath) {
                      // Map full paths to student tabs if necessary
                      let targetTab = n.actionPath;
                      if (targetTab.startsWith('/')) {
                        const parts = targetTab.split('/');
                        targetTab = parts[parts.length - 1]; // e.g. /teacher/exams -> exams
                      }
                      setActiveTab(targetTab as any);
                      setShowNotifs(false);
                    }
                  }}
                  className={`p-4 rounded-xl border relative overflow-hidden transition-all ${
                    n.actionPath || !n.read ? 'cursor-pointer hover:border-gold/50' : ''
                  } ${
                    n.read
                      ? 'border-white/5 bg-white/5 opacity-70'
                      : 'border-gold/20 bg-gradient-to-br from-gold/10 to-transparent shadow-md'
                  }`}>
                  {n.type === 'error' && <div className="absolute top-0 right-0 w-1 h-full bg-red-500 rounded-l" />}

                  {n.type === 'success' && <div className="absolute top-0 right-0 w-1 h-full bg-green-500 rounded-l" />}
                  {n.type === 'warning' && <div className="absolute top-0 right-0 w-1 h-full bg-yellow-500 rounded-l" />}
                  {n.type === 'info' && <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-l" />}
                  <p className="text-sm font-semibold leading-relaxed text-white pr-3">{n.msg}</p>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-gray-500">{n.time || new Date(n.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_6px_rgba(245,197,24,0.8)] animate-pulse" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LUXURIOUS CERTIFICATE MODAL ═══ */}
      {/* ═══ EDUCATIONAL GAME PORTAL ═══ */}
      {selectedGame && student && (
        <GamePortal 
          game={selectedGame}
          studentId={student.id}
          studentName={student.name}
          onClose={() => setSelectedGame(null)}
        />
      )}

      {certData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
           <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(245,197,24,0.2)] animate-scale-in">
             <div className="p-4 border-b flex justify-between items-center text-black bg-gray-50">
               <span className="font-bold text-sm">شهادة اجتياز معتمدة</span>
               <button onClick={()=>setCertData(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={20}/></button>
             </div>
             
             {/* Certificate Content - Print Optimized Area */}
             <div ref={certRef} className="p-8 text-center text-black bg-white relative overflow-hidden">
                {/* Decorative Borders */}
                <div className="absolute inset-4 border-[6px] border-[#f5c518] pointer-events-none" />
                <div className="absolute inset-5 border border-dashed border-[#f5c518]/30 pointer-events-none" />
                
                <div className="relative z-10 pt-6 pb-4">
                  <div className="w-20 h-20 bg-[#1a1a25] rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <GraduationCap size={40} className="text-[#f5c518]" />
                  </div>
                  
                  <h3 className="text-2xl font-black mb-1 font-cairo">شهادة شكر وتقدير</h3>
                  <div className="w-24 h-1 bg-[#f5c518] mx-auto mb-6" />
                  
                  <p className="text-sm italic mb-2 text-gray-600">نمنح هذه الشهادة بكل فخر للطالب/ة</p>
                  <h2 className="text-3xl font-black mb-6 text-[#1a1a25] font-cairo underline decoration-[#f5c518] decoration-4 underline-offset-8">
                    {certData.attempt.studentName}
                  </h2>
                  
                  <p className="text-sm text-gray-600 mb-2 leading-relaxed">لاجتيازه بتفوق ونجاح دراسة واختبار</p>
                  <h4 className="font-bold text-lg mb-8">&quot; {certData.exam.title} &quot;</h4>
                  
                  <div className="flex justify-around items-center mt-12 pt-8 border-t border-gray-100">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-bold mb-1">الدرجة النهائية</p>
                      <p className="text-xl font-black text-[#f5c518]">{certData.attempt.finalScore ?? certData.attempt.mcqScore ?? 0}%</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400 font-bold mb-1">تاريخ الإصدار</p>
                      <p className="text-xs font-bold">{new Date(certData.attempt.submittedAt || Date.now()).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                </div>
             </div>
             
             <div className="p-5 bg-gray-50 flex gap-3">
               <button onClick={() => window.print()} className="flex-1 btn-gold py-3 px-6 shadow-xl shadow-gold/20 flex items-center justify-center gap-2 font-bold">
                 <Download size={18} /> حفظ الشهادة
               </button>
             </div>
           </div>
        </div>
      )}

      {PreviewModal}
      {CompressionModal}
    </div>
  );
}

