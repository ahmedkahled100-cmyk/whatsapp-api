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
  markNotificationRead,
  saveStudent,
  subscribeToStudent,
  subscribeToStudentByPhone,
  subscribeToRegistrationRequestByPhone,
  getRegistrationRequestsByPhone,
  getTopStudents,
  getAllSettings,
  getTeachers
} from '@/lib/db';
import { FileProcessor } from '@/lib/file-processor';
import { showToast } from '@/lib/toast';
import type { Settings } from '@/types';
import type { Exam, Attempt, CourseMaterial, Assignment, AssignmentSubmission, Notification, Message, Conversation, CalendarEvent, Student } from '@/types';
import { GraduationCap, LogOut, BookOpen, BarChart2, ClipboardList, Download, Award, Video, FileText, Link as LinkIcon, BookMarked, Globe, Lock, Upload, MessageCircle, MessageSquare, Loader2, Bell, Send, Check, CheckCheck, X, Plus, ShieldCheck, AlertCircle, Paperclip, Image as ImageIcon, Trash2, User, Gamepad2, Layers, Trophy, Star, Languages, Brain, Zap, ChevronRight, ChevronDown, ChevronUp, Sparkles, Bot, Calendar, Clock, Camera, Youtube, PlayCircle } from 'lucide-react';
import { YoutubeChannelCard } from '@/components/YoutubeChannelCard';
import { PDFCompressionModal, usePDFCompression } from '@/components/PDFCompressionModal';
import Link from 'next/link';
import { filterNotificationsForStudent } from '@/lib/notification-audience';
import { formatDateAr, gradeColor, scoreLabel, getDownloadUrl, formatRelativeLastSeenAr, getApiBase } from '@/lib/utils';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { MobileStudentPortalWrapper } from '@/components/MobileStudentPortalWrapper';
import { TeacherDiscovery } from '@/components/TeacherDiscovery';
import { SubscriptionExpiredOverlay } from '@/components/SubscriptionExpiredOverlay';
import type { EducationalGame } from '@/types';

// استيراد المكونات الفرعية الجديدة للطالب
import { StudentLeaderboard } from '@/components/student/StudentLeaderboard';
import { StudentGames } from '@/components/student/StudentGames';
import { StudentSchedule } from '@/components/student/StudentSchedule';
import { StudentChat } from '@/components/student/StudentChat';
import { GlobalChatWidget } from '@/components/shared/GlobalChatWidget';

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

  const [activeTab, setActiveTab] = useState<'home' | 'exams' | 'courses' | 'youtube' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile' | 'discover' | 'link' | 'games' | 'schedule' | 'leaderboard'>('home');
  const [games, setGames] = useState<EducationalGame[]>([]);
  const [leaderboardStudents, setLeaderboardStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [certData, setCertData] = useState<{ attempt: Attempt, exam: Exam } | null>(null);
  const [siteSettings, setSiteSettings] = useState<Settings | null>(null);
  const [allTeacherChannels, setAllTeacherChannels] = useState<{teacherId: string, teacherName: string, url: string, image?: string}[]>([]);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [parentPhone, setParentPhone] = useState('');
  const [recoveredCode, setRecoveredCode] = useState('');
  const [findingCode, setFindingCode] = useState(false);
  const [teacherPermissions, setTeacherPermissions] = useState<string[] | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [pendingEnrollmentNotif, setPendingEnrollmentNotif] = useState<{teacherName: string, subject?: string} | null>(null);
  const [mounted, setMounted] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  // File Preview Hook
  const { openPreview, PreviewModal } = useFilePreview();
  const { openCompression, CompressionModal } = usePDFCompression({ showSelection: true });

  const [showAcademySwitcher, setShowAcademySwitcher] = useState(false);

  // AI Feedback State
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [explainingQuestionId, setExplainingQuestionId] = useState<string | null>(null);
  const [localAIFeedbacks, setLocalAIFeedbacks] = useState<Record<string, string>>({});

  const handleExplainError = async (att: Attempt, exam: Exam, qId: string) => {
    if (explainingQuestionId) return;
    setExplainingQuestionId(qId);
    try {
      const q = exam.questions?.find(x => x.id === qId);
      const studentAns = att.answers?.[qId];
      if (!q || studentAns === undefined) throw new Error('السؤال غير موجود');
      
      const qText = q.text;
      const studentAnsText = q.options 
        ? q.options[studentAns] 
        : (q.type === 'tf' ? (studentAns === 1 ? 'صح' : 'خطأ') : String(studentAns));
      const correctAnsText = q.options 
        ? q.options[Number(q.correct)] 
        : (q.type === 'tf' ? (q.isTrue ? 'صح' : 'خطأ') : 'غير متوفرة');
      
      const prompt = `السؤال: ${qText}\nإجابة الطالب الخاطئة: ${studentAnsText}\nالإجابة الصحيحة: ${correctAnsText}\nاشرح للطالب بأسلوب مبسط ومختصر وبناء لماذا إجابته خاطئة وكيف يصل للإجابة الصحيحة في سطرين.`;
      
      const res = await fetch(`${getApiBase()}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', prompt })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const feedback = data.result?.answer || 'تعذر جلب الشرح.';

      setLocalAIFeedbacks(prev => ({ ...prev, [`${att.id}_${qId}`]: feedback }));
    } catch (e: any) {
      showToast('خطأ: ' + (e.message || 'فشل جلب الشرح'));
    } finally {
      setExplainingQuestionId(null);
    }
  };



  useEffect(() => { setHasMounted(true); setMounted(true); }, []);

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

      const [allExams, myAtts, allMaterials, allAssignments, mySubs, allGames, topStudentsList] = await Promise.all([
        getPublishedExams(tId).catch((e: any) => { console.error('Failed to load exams:', e); return [] as Exam[]; }),
        getAttemptsByStudent(sId).catch((e: any) => { console.error('Failed to load attempts:', e); return [] as Attempt[]; }),
        getMaterials(tId).catch((e: any) => { console.error('Failed to load materials:', e); return [] as CourseMaterial[]; }),
        getAssignments(tId).catch((e: any) => { console.error('Failed to load assignments:', e); return [] as Assignment[]; }),
        getStudentSubmissions(sId).catch((e: any) => { console.error('Failed to load submissions:', e); return [] as AssignmentSubmission[]; }),
        getGamesForStudent(tId, student.groupIds?.[0]).catch((e: any) => { console.error('Failed to load games:', e); return [] as EducationalGame[]; }),
        getTopStudents(tId, 20).catch((e: any) => { console.error('Failed to load top students:', e); return [] as Student[]; })
      ]);

      // Filter exams for this student's group
      const filteredExams = allExams.filter((exam: Exam) => {
        if (!exam.targetGroup) return true;
        return student.groupIds?.includes(exam.targetGroup);
      });

      setExams(filteredExams);
      setAttempts(myAtts.filter((a: Attempt) => a.completed));
      setGames(allGames);
      setLeaderboardStudents(topStudentsList);
      
      // Fetch teacher name if missing
      if (!student.teacherName && tId !== 'unknown_teacher') {
        getTeacherById(tId).then((t: any) => {
          if (t && student) setStudent({ ...student, teacherName: t.name });
        });
      }
      
      const isSubscribed = student.subType !== 'none' && student.subType !== 'free';
      const isExpired = student.subExpiry ? new Date(student.subExpiry).getTime() < Date.now() : false;
      const hasActiveSub = isSubscribed && !isExpired;
      // 'free' students only see free materials; only paid+active can see paid content
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
      import('@/lib/db').then(({ getTeacherById, getTeachers, getAllSettings }: any) => {
        getTeacherById(student.teacherId).then((t: any) => {
          setTeacherPermissions(t?.permissions || null);
          setTeacherInfo(t);
        });

        Promise.all([getTeachers(), getAllSettings()]).then(([ts, sets]: any) => {
          const channels: any[] = [];
          sets.forEach((s: any) => {
             if (s.youtubeChannelUrl) {
               const t = ts.find((x: any) => x.id === s.teacherId);
               // Filter out current active teacher because it's already shown as the main channel
               // or maybe just show everyone. User asked for "list of channels of teachers in the platform".
               if (t && t.isActive) {
                 channels.push({ teacherId: t.id, teacherName: t.name, url: s.youtubeChannelUrl, image: t.imageUrl });
               }
             }
          });
          setAllTeacherChannels(channels);
        });
      });
    }
    void loadStudentData();
    let unsubConvs = () => {};
    if (student.teacherId && student.teacherId !== 'unknown_teacher') {
      unsubConvs = subscribeToConversations(student.id, setConversations);
    }

    // Subscribe only to notifications from the active teacher
    const teacherIds = student.teacherId && student.teacherId !== 'unknown_teacher' 
      ? [student.teacherId] 
      : [];

    let knownNotifIds = new Set<string>();
    const unsubNotifsList: (() => void)[] = [];

    teacherIds.forEach(tId => {
      const unsub = subscribeToNotifications(tId, (allNotifs) => {
        const studentNotifs = filterNotificationsForStudent(allNotifs, student);
        setNotifications(prev => {
          // Merge: keep previous notifs from other teachers, replace this teacher's notifs
          const otherTeacherNotifs = prev.filter(n => (n as any).teacherId !== tId);
          const merged = [...studentNotifs, ...otherTeacherNotifs];
          // Deduplicate by id
          const seen = new Set<string>();
          return merged.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
        });

        // Toast for truly new unread notifications
        const newUnread = studentNotifs.filter(n => !n.read && !knownNotifIds.has(n.id));
        newUnread.forEach(n => {
          const msg = (n as any).msg || (n as any).message || 'إشعار جديد من المعلم';
          showToast(`🔔 ${msg.slice(0, 80)}`);
        });
        studentNotifs.forEach(n => knownNotifIds.add(n.id));
      });
      unsubNotifsList.push(unsub);
    });

    return () => {
      unsubNotifsList.forEach(u => u());
      unsubConvs();
    };
  }, [student, loadStudentData, setConversations, allEnrollments]);

  // ⚡ Real-time Status Sync via Supabase Realtime
  // When the teacher changes sub_type, sub_expiry, or cancel_reason in DB,
  // this fires instantly (no polling needed)
  useEffect(() => {
    if (!student?.id || !student?.teacherId) return;
    const unsub = subscribeToStudent(student.id, student.teacherId, (freshData) => {
      const current = useStudentStore.getState().student;
      if (!current) return;
      const hasChanged =
        freshData.subType !== current.subType ||
        freshData.subExpiry !== current.subExpiry ||
        (freshData as any).cancelReason !== (current as any).cancelReason;
      if (hasChanged) {
        console.log('⚡ [Realtime] Student status changed:', freshData.subType, (freshData as any).cancelReason);
        useStudentStore.getState().setStudent({ ...current, ...freshData });
      }
    });
    return () => {
      if (unsub) void unsub();
    };
  }, [student?.id, student?.teacherId]);

  // 🔔 Real-time: detect new teacher approvals (new enrollment with same phone)
  useEffect(() => {
    const phone = student?.phone;
    if (!phone) return;

    // Subscribe to new student records with this phone — fires when teacher approves registration
    const unsubEnroll = subscribeToStudentByPhone(phone, async (freshEnrollments) => {
      const currentEnrollments = useStudentStore.getState().allEnrollments;
      // Check if there are genuinely NEW enrollments (by teacherId)
      const existingTeacherIds = new Set(currentEnrollments.map(e => e.teacherId));
      const newOnes = freshEnrollments.filter(e => !existingTeacherIds.has(e.teacherId));

      if (newOnes.length > 0) {
        // Enrich teacher info for new enrollments
        const enriched = await Promise.all(freshEnrollments.map(async (en) => {
          if (!en.teacherName && en.teacherId) {
            try {
              const t = await getTeacherById(en.teacherId);
              return { ...en, teacherName: t?.name || 'معلم', teacherImage: t?.imageUrl, teacherSubject: t?.subject };
            } catch { return en; }
          }
          return en;
        }));

        // Share image across enrollments
        const sharedImg = enriched.find(e => e.imageUrl)?.imageUrl;
        if (sharedImg) enriched.forEach(e => { if (!e.imageUrl) e.imageUrl = sharedImg; });

        useStudentStore.getState().setAllEnrollments(enriched);

        // Show notification banner for each new enrollment
        for (const newEnroll of newOnes) {
          const teacherName = enriched.find(e => e.teacherId === newEnroll.teacherId)?.teacherName || 'معلم';
          const subject = enriched.find(e => e.teacherId === newEnroll.teacherId)?.teacherSubject;
          setPendingEnrollmentNotif({ teacherName, subject });
          showToast(`🎉 تم قبولك في أكاديمية أ. ${teacherName}! يمكنك التبديل الآن`);

          // Add an in-app notification for the student
          setNotifications(prev => [{
            id: `enrollment_${newEnroll.teacherId}_${Date.now()}`,
            teacherId: newEnroll.teacherId,
            msg: `🎉 تم قبولك في أكاديمية أ. ${teacherName}${subject ? ` (مادة ${subject})` : ''}! يمكنك الآن الدخول فوراً.`,
            type: 'success',
            read: false,
            time: new Date().toISOString(),
            createdAt: Date.now(),
          } as any, ...prev]);
        }
      }
    });

    // Subscribe to pending registration request status changes
    const unsubReq = subscribeToRegistrationRequestByPhone(phone, (reqs) => {
      // If all pending requests are now gone — they were either approved or rejected
      const pendingReqs = reqs.filter(r => r.status === 'pending');
      if (pendingReqs.length === 0 && reqs.length > 0) {
        const lastReq = reqs[reqs.length - 1];
        if (lastReq.status === 'rejected') {
          showToast('❌ تم رفض طلب تسجيلك. تواصل مع المعلم للمزيد');
        }
      }
    });

    return () => {
      unsubEnroll();
      unsubReq();
    };
  }, [student?.phone]);



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



  const handleLogin = async () => {
    if (!code.trim()) { setError('أدخل كودك أولاً'); return; }
    setLoading(true);
    setError('');
    try {
      const results = await getStudentByCode(code.trim());
      if (results.length === 0) { 
        setError('❌ الكود غير صحيح'); 
      } else { 
        const mainStudent = results[0];
        // Fetch ALL enrollments for this student's phone
        const all = (mainStudent.phone && mainStudent.phone.trim()) 
          ? await getEnrollmentsByPhone(mainStudent.phone.trim()) 
          : results;

        if (all.length === 0) all.push(mainStudent); // Defensive fallback
        
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

        const sharedImageUrl = enriched.find(e => e.imageUrl)?.imageUrl;
        if (sharedImageUrl) {
          enriched.forEach(e => e.imageUrl = sharedImageUrl);
        }

        setAllEnrollments(enriched);
        
        if (enriched.length > 1) {
          // Keep student state null so the Academy Switcher is presented
          setStudent(null);
          showToast(`تم العثور على اشتراكات متعددة، يرجى اختيار المعلم`);
        } else {
          const active = enriched.find((e: Student) => e.code === code.trim().toUpperCase()) || enriched[0];
          setStudent(active);
          showToast(`✅ أهلاً بك في أكاديمية ${active.teacherName}`);
        }
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

        const sharedImageUrl = enriched.find(e => e.imageUrl)?.imageUrl;
        if (sharedImageUrl) {
          enriched.forEach(e => e.imageUrl = sharedImageUrl);
        }

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

      const assign = assignments.find(a => a.id === assignId);

      // Optimistic update: show submission instantly
      const optimisticSub = { ...sub, id: `temp-${Date.now()}` } as AssignmentSubmission;
      setMySubmissions(prev => [...prev, optimisticSub]);

      await submitAssignment(sub);
      
      // --- Gamification Logic: Award 5 points for submitting an assignment ---
      if (student) {
        const pointsEarned = 5;
        const newPoints = (student.points || 0) + pointsEarned;
        const newLevel = Math.floor(newPoints / 1000) + 1;
        const updatedStudent = { ...student, points: newPoints, level: newLevel };
        try {
          await saveStudent(updatedStudent);
          useStudentStore.getState().setStudent(updatedStudent);
          showToast(`🌟 حصلت على ${pointsEarned} نقاط لمشاركتك بالواجب!`);
        } catch(e) {
          console.error("Gamification save error:", e);
        }
      }
      // ---------------------------------------------------------------------

      try {
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
      showToast('✅ تم تقديم الواجب بنجاح');
      
      // Background confirm
      loadStudentData().catch(() => {});
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

  const TabSkeleton = () => (
    <div className="space-y-4 animate-fade-in px-2">
      <div className="h-8 w-48 skeleton mb-6" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card-base p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 skeleton" />
            <div className="h-3 w-1/2 skeleton opacity-50" />
          </div>
          <div className="w-20 h-8 rounded-xl skeleton" />
        </div>
      ))}
    </div>
  );

  if (!hasMounted) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <Loader2 className="animate-spin text-gold" size={40} />
    </div>
  );

  // Academy Selection Overlay
  if (!student && allEnrollments.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ background: 'var(--dark)' }}>
        <div className="w-full max-w-2xl space-y-8 animate-scale-in text-right" dir="rtl">
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
                className="card-base p-6 text-right hover:border-gold/50 transition-all group relative overflow-hidden active:scale-95 hover-premium"
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold text-xl font-bold border border-gold/20 overflow-hidden shrink-0">
                    {en.teacherImage ? (
                      <img loading="lazy" src={en.teacherImage} alt={en.teacherName} className="w-full h-full object-cover" />
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
                        const isExpiredSub = en.subExpiry && en.subExpiry < Date.now() && en.subType !== 'none' && en.subType !== 'free';
                        const isCancelledByTeacher = en.subType === 'none' && !!(en as any).cancelReason;
                        const isFreeAccount = en.subType === 'free';
                        const isPendingNoSub = en.subType === 'none' && !(en as any).cancelReason;
                        const isActiveSub = en.subType !== 'none' && en.subType !== 'free' && !isExpiredSub;

                        if (isCancelledByTeacher) {
                          return <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-black">⛔ ملغى</span>;
                        }
                        if (isFreeAccount) {
                          return <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">✨ مجاني</span>;
                        }
                        if (isPendingNoSub) {
                          return <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-500 border border-white/5 font-bold">⏳ بانتظار</span>;
                        }
                        if (isExpiredSub) {
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 font-black">
                              ⚠️ منتهي{en.subExpiry ? ` (${new Date(en.subExpiry).toLocaleDateString('ar-EG')})` : ''}
                            </span>
                          );
                        }
                        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 font-bold">✅ نشط</span>;
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

          <button
            onClick={() => {
              const firstEn = allEnrollments[0];
              const phoneParam = firstEn.phone ? `&phone=${encodeURIComponent(firstEn.phone)}` : '';
              const parentPhoneParam = firstEn.parentPhone ? `&parentPhone=${encodeURIComponent(firstEn.parentPhone)}` : '';
              window.location.href = `/register?name=${encodeURIComponent(firstEn.name)}${phoneParam}${parentPhoneParam}`;
            }}
            className="card-base w-full p-4 mt-4 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50 flex items-center justify-center gap-3 transition-all text-blue-400 group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-lg leading-none">+</span>
            </div>
            <span className="font-bold relative top-0.5">تسجيل الانضمام لمعلم جديد</span>
          </button>

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
          <div className="card-base p-5 sm:p-7 text-center hover-premium"
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
              <div className="modal-overlay" >
                <div className="modal-content modal-content-sm" onClick={e => e.stopPropagation()}>
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
  // A student is "cancelled by teacher" ONLY if subType='none'
  const isSubCancelled = student.subType === 'none';

  const isSubExpired =
    !isSubCancelled &&
    student.subType !== 'none' &&
    student.subType !== 'free' &&
    student.subExpiry != null &&
    // subExpiry is stored as end-of-day timestamp, check if fully expired
    student.subExpiry < Date.now();

  // If subscription is cancelled by teacher (has cancelReason) → show cancellation overlay
  if (isSubCancelled) {
    return (
      <SubscriptionExpiredOverlay
        target="student"
        student={student}
        teacherInfo={teacherInfo}
        settings={siteSettings}
        isCancelled={true}
        hasMultipleAcademies={allEnrollments.length > 1}
        onSwitchAcademy={() => setStudent(null)}
        onLogout={logout}
        onRenewalSuccess={() => {}}
      />
    );
  }

  // If subscription is expired (had paid sub, now past expiry date) → show full-screen overlay
  if (isSubExpired) {
    return (
      <SubscriptionExpiredOverlay
        target="student"
        student={student}
        teacherInfo={teacherInfo}
        settings={siteSettings}
        isCancelled={false}
        hasMultipleAcademies={allEnrollments.length > 1}
        onSwitchAcademy={() => setStudent(null)}
        onLogout={logout}
        onRenewalSuccess={() => {
          // Refresh student data after teacher approves
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
              enrolledTeacherIds={allEnrollments.map(e => e.teacherId)}
              onBack={() => setActiveTab('home')}
            />
          )}

          {/* 🎉 NEW ENROLLMENT BANNER — appears instantly when teacher approves */}
          {pendingEnrollmentNotif && (
            <div
              className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-between gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)',
                border: '1px solid rgba(16,185,129,0.35)',
                boxShadow: '0 0 30px rgba(16,185,129,0.1)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(16,185,129,0.1) 0%, transparent 60%)' }} />
              <div className="flex items-center gap-3 relative z-10">
                <span className="text-2xl">🎉</span>
                <div>
                  <div className="font-black text-green-400 text-sm leading-tight">تم قبولك في أكاديمية أ. {pendingEnrollmentNotif.teacherName}!</div>
                  {pendingEnrollmentNotif.subject && (
                    <div className="text-xs text-green-300/70 mt-0.5">مادة: {pendingEnrollmentNotif.subject}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10 shrink-0">
                <button
                  onClick={() => setStudent(null)}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}
                >
                  تبديل الآن ←
                </button>
                <button onClick={() => setPendingEnrollmentNotif(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400/50 hover:text-green-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {student.subType === 'none' && !!(student as any).cancelReason && activeTab !== 'discover' ? (
             <div className="card-base p-12 text-center border-red-500/30 bg-red-500/5 my-8 animate-fade-in shadow-xl shadow-red-500/10">
               <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <AlertCircle size={48} className="text-red-500 opacity-80" />
               </div>
               <h2 className="text-2xl font-black text-red-400 mb-3 font-cairo">تم إلغاء اشتراكك من قِبل المعلم</h2>
               
               <div className="p-4 bg-white/5 border border-orange-500/20 rounded-2xl mb-6 max-w-md mx-auto animate-fade-in">
                 <span className="block text-[10px] text-orange-400 font-bold mb-2 uppercase tracking-widest text-right">📝 سبب الإلغاء:</span>
                 <p className="text-sm text-white leading-relaxed font-semibold">{(student as any).cancelReason}</p>
               </div>

               <div className="flex flex-col sm:flex-row justify-center gap-3">
                 <button onClick={() => setActiveTab('discover')} className="btn-outline border-white/10 px-8 py-3.5 text-sm font-bold flex items-center justify-center gap-2">🔍 تصفح المعلمين</button>
                 
                 {/* WhatsApp Support Button */}
                 {(teacherInfo?.phone || siteSettings?.whatsappNumber) && (
                   <a 
                     href={`https://wa.me/${(teacherInfo?.phone || siteSettings?.whatsappNumber).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                       `أهلاً بك يا ${teacherInfo?.name || 'أستاذنا'}، أنا الطالب ${student.name} (كود: ${student.code}).\nلقد تم إلغاء اشتراكي لسبب: ${(student as any).cancelReason || 'غير محدد'}.\nأود الاستفسار عن ذلك لاستكمال دراستي. شكراً لك!`
                     )}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="px-8 py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 text-white shadow-lg shadow-[#25D366]/20 transition-all hover:scale-[1.02] active:scale-95"
                     style={{ background: '#25D366' }}
                   >
                     <MessageCircle size={20} />
                     تواصل مع المعلم للاستفسار
                   </a>
                 )}
               </div>
             </div>
          ) : (
            <div className="contents animate-fade-in">
              {activeTab === 'leaderboard' && (
                <StudentLeaderboard leaderboardStudents={leaderboardStudents} currentStudentId={student.id} />
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
                  materials.filter(m => m.type !== 'youtube').reduce((acc, m) => {
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

          {/* YouTube Tab */}
          {activeTab === 'youtube' && (
            <div className="space-y-6 animate-slide-up">
               {/* Channel Header (if available) */}
               {siteSettings?.youtubeChannelUrl && (
                  <YoutubeChannelCard url={siteSettings.youtubeChannelUrl} />
               )}

               {/* Teacher Channels List */}
               {allTeacherChannels.filter(c => c.teacherId !== student?.teacherId).length > 0 && (
                 <div className="space-y-4 pt-4 border-t border-white/10 mt-6">
                   <h3 className="font-bold text-lg text-white flex items-center gap-2">
                     <Youtube className="text-red-500" size={20} />
                     اكتشف قنوات المدرسين بالمنصة
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {allTeacherChannels.filter(c => c.teacherId !== student?.teacherId).map(channel => (
                       <YoutubeChannelCard key={channel.teacherId} url={channel.url} />
                     ))}
                   </div>
                 </div>
               )}

               <div className="pt-4 border-t border-white/10 mt-6">
                 <h3 className="font-bold text-lg text-white mb-4">مقاطع فيديو مضافة</h3>
                 {materials.filter(m => m.type === 'youtube').length === 0 ? (
                 <div className="card-base p-16 text-center border-dashed border-2 border-white/5 bg-black/10">
                   <div className="w-20 h-20 bg-red-500/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Youtube size={32} className="text-red-500/30" />
                   </div>
                   <h3 className="text-lg font-bold text-gray-300 mb-2">لا يوجد مقاطع يوتيوب متاحة حالياً</h3>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {materials.filter(m => m.type === 'youtube').sort((a, b) => a.sequence - b.sequence).map(material => {
                      const getYoutubeVideoId = (url: string) => {
                         const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                         const match = url.match(regExp);
                         return (match && match[2].length === 11) ? match[2] : null;
                      };
                      const videoId = getYoutubeVideoId(material.url || '');
                      const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

                      return (
                         <div key={material.id} className="card-base overflow-hidden group hover:border-red-500/30 transition-all hover:-translate-y-1 shadow-lg bg-black/20 flex flex-col cursor-pointer" onClick={() => window.open(material.url, '_blank')}>
                            {/* Thumbnail */}
                            <div className="w-full h-44 bg-black relative border-b border-white/5 flex-shrink-0">
                               {thumbnailUrl ? (
                                 <img src={thumbnailUrl} alt={material.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                    <Youtube size={40} className="text-gray-700" />
                                 </div>
                               )}
                               <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                               
                               {/* Play Overlay */}
                               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40 backdrop-blur-sm">
                                  <PlayCircle size={56} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                               </div>

                               {/* Sequence Badge */}
                               <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center text-sm font-black shadow-lg">
                                  {material.sequence}
                               </div>

                               {/* Status Badge */}
                               <div className="absolute top-3 left-3 flex gap-1">
                                  {material.isFree ? (
                                    <span className="bg-green-500/80 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1 shadow-lg">
                                      <Globe size={10} /> مجاني
                                    </span>
                                  ) : (
                                    <span className="bg-black/70 backdrop-blur-md text-red-400 border border-red-500/30 text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1 shadow-lg">
                                      <Lock size={10} /> للمشتركين
                                    </span>
                                  )}
                               </div>
                            </div>

                            <div className="p-4 flex flex-col flex-1">
                               <h3 className="font-bold text-gray-100 mb-2 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors" title={material.title}>{material.title}</h3>
                               
                               <div className="mt-auto pt-4 border-t border-white/5 text-xs text-gray-400 flex items-center gap-1 group-hover:text-red-400 transition-colors">
                                  <PlayCircle size={14} /> مشاهدة الآن على يوتيوب
                               </div>
                            </div>
                         </div>
                      );
                   })}
                 </div>
               )}
               </div>
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
            <StudentChat student={student} conversations={conversations} siteSettings={siteSettings} />
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
                  <div key={att.id} className="card-base overflow-hidden relative">
                    <div 
                      className="p-4 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedAttemptId(expandedAttemptId === att.id ? null : att.id)}
                    >
                      <div className="flex-1 w-full">
                        <div className="flex justify-between items-center w-full">
                          <div className="font-bold text-sm">{att.examTitle}</div>
                          <div className="text-gray-400">
                            {expandedAttemptId === att.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
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
                         <div onClick={e => e.stopPropagation()}>
                           <button onClick={() => setCertData({ attempt: att, exam: exams.find(e=>e.id===att.examId)! })} className="btn-gold text-[10px] px-3 py-2 flex items-center gap-2">
                             <Award size={14} /> الشهادة
                           </button>
                         </div>
                      )}
                    </div>
                    
                    {expandedAttemptId === att.id && exam && (
                      <div className="p-4 border-t border-white/5 bg-black/20 space-y-3 animate-slide-up">
                        <h4 className="font-bold text-sm mb-3">تفاصيل الإجابات</h4>
                        {exam.questions?.map((q, i) => {
                          const studentAns = att.answers?.[q.id];
                          const isCorrect = studentAns !== undefined && (q.type === 'tf' ? ((studentAns === 1 && q.isTrue === true) || (studentAns === 0 && q.isTrue === false)) : studentAns === q.correct);
                          if (studentAns === undefined || isCorrect) return null; // Only show wrong questions for AI Feedback
                          
                          const feedbackText = localAIFeedbacks[`${att.id}_${q.id}`] || (att.aiFeedback as any)?.[q.id];
                          const isExplaining = explainingQuestionId === q.id;

                          return (
                            <div key={q.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-3 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-1 h-full bg-red-500/50" />
                              <div className="text-sm font-bold">السؤال {i + 1}: {q.text}</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                  <span className="text-red-400 font-bold block mb-1">إجابتك (خاطئة)</span>
                                  {q.options 
                                    ? q.options[studentAns] 
                                    : (q.type === 'tf' ? (studentAns === 1 ? 'صح' : 'خطأ') : String(studentAns))}
                                </div>
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                  <span className="text-green-400 font-bold block mb-1">الإجابة الصحيحة</span>
                                  {q.options 
                                    ? q.options[Number(q.correct)] 
                                    : (q.type === 'tf' ? (q.isTrue ? 'صح' : 'خطأ') : 'غير متوفرة')}
                                </div>
                              </div>
                              
                              <div className="pt-2 border-t border-red-500/10">
                                {!feedbackText && !isExplaining && (
                                  <button onClick={() => handleExplainError(att, exam, q.id)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-2 text-gold border-gold/30 hover:bg-gold/10 w-full justify-center">
                                    <Sparkles size={14} /> اشرح لي الخطأ بالذكاء الاصطناعي
                                  </button>
                                )}
                                {isExplaining && (
                                  <div className="flex items-center justify-center gap-2 text-xs text-gold py-1.5">
                                    <Loader2 size={14} className="animate-spin" /> جاري تحليل الخطأ...
                                  </div>
                                )}
                                {feedbackText && (
                                  <div className="p-3 bg-gold/10 border border-gold/20 rounded-lg text-xs leading-relaxed flex items-start gap-3">
                                    <Bot size={18} className="text-gold shrink-0 mt-0.5" />
                                    <div>
                                      <strong className="block text-gold mb-1">مساعد المعلم الذكي:</strong>
                                      {feedbackText}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {exam.questions?.every(q => {
                           const studentAns = att.answers?.[q.id];
                           const isCorrect = studentAns !== undefined && (q.type === 'tf' ? ((studentAns === 1 && q.isTrue === true) || (studentAns === 0 && q.isTrue === false)) : studentAns === q.correct);
                           return studentAns === undefined || isCorrect;
                        }) && (
                          <div className="text-center text-xs text-gray-400 p-4">لا توجد إجابات خاطئة، عمل ممتاز!</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Games Tab */}
          {activeTab === 'games' && (
            <StudentGames games={games} student={student} />
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-slide-up">
              {/* Profile Header Card */}
              <div className="card-base p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 50% 0%, var(--gold), transparent 70%)' }} />
                <div className="relative w-28 h-28 mb-4">
                  <div className="w-full h-full rounded-full border-4 border-gold shadow-[0_0_25px_rgba(245,197,24,0.4)] overflow-hidden relative">
                    {student.imageUrl ? (
                      <img loading="lazy" src={student.imageUrl} alt={student.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gold/20">
                        <User size={48} className="text-gold" />
                      </div>
                    )}
                  </div>
                  
                  {/* Floating Camera Button - Much better for mobile than hover */}
                  <label className="absolute bottom-0 right-0 w-10 h-10 bg-gold rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-[#12121f] active:scale-90 transition-transform z-20">
                    {useFileProcessingStore.getState().queue.some(f => f.path.startsWith(`students/${student.id}`) && f.status !== 'completed' && f.status !== 'failed') ? (
                      <Loader2 className="animate-spin text-black" size={18} />
                    ) : (
                      <Camera className="text-black" size={20} />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) {
                          showToast('حجم الصورة كبير جداً (أقصى حجم 20 ميجابايت)');
                          return;
                        }
                        try {
                          const fileName = `profile_${student.id}_${Date.now()}.jpg`;
                          const path = `students/${student.id}/${fileName}`;
                          
                          // Setup listener for completion
                          const handleUploaded = async (ev: any) => {
                            const { url, path: uploadedPath } = ev.detail;
                            if (uploadedPath === path) {
                              window.removeEventListener('fileUploaded', handleUploaded);
                              try {
                                // Update DB
                                await saveStudent({ ...student, imageUrl: url });
                                useStudentStore.getState().setStudent({ ...student, imageUrl: url });
                                showToast('✅ تم تحديث الصورة بنجاح');
                              } catch (err) {
                                showToast('❌ حدث خطأ أثناء الحفظ');
                              }
                            }
                          };
                          window.addEventListener('fileUploaded', handleUploaded);
                          
                          await FileProcessor.queueFile(file, path);
                          showToast('جاري رفع الصورة...');
                        } catch (err: any) {
                          showToast(err.message || 'فشل رفع الصورة');
                        }
                      }}
                    />
                  </label>
                </div>
                <h3 className="text-2xl font-black font-cairo text-white">{student.name}</h3>
                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-gold" /> الكود: <span className="font-mono text-gold font-bold">{student.code}</span>
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {/* Subscription Badge - clearly differentiates free, active, cancelled, expired */}
                  {(() => {
                    const hasCancelReason = !!(student as any).cancelReason;
                    const isActive = student.subType !== 'none' && student.subType !== 'free' && student.subExpiry && student.subExpiry > Date.now();
                    const isExpired = student.subType !== 'none' && student.subType !== 'free' && student.subExpiry && student.subExpiry <= Date.now();
                    const isFreeAccount = student.subType === 'free';
                    const isCancelledAccount = student.subType === 'none' && hasCancelReason;
                    const isPending = student.subType === 'none' && !hasCancelReason;
                    
                    const subTypeLabel: Record<string, string> = {
                      monthly: '📅 شهري',
                      yearly: '📆 سنوي',
                      halfYearly: '📅 نصف سنوي',
                      session: '🎯 حصص',
                      course: '📚 كورس',
                      free: '✨ مجاني',
                    };

                    if (isCancelledAccount) return <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">🚫 ملغى من المعلم</span>;
                    if (isFreeAccount) return <span className="badge bg-blue-500/20 text-blue-300 border border-blue-500/30">✨ اشتراك مجاني</span>;
                    if (isActive) return <span className="badge badge-green">{subTypeLabel[student.subType] || student.subType} ✅</span>;
                    if (isExpired) return <span className="badge badge-red">{subTypeLabel[student.subType] || student.subType} — منتهي ⚠️</span>;
                    if (isPending) return <span className="badge bg-gray-500/20 text-gray-400 border border-gray-500/30">⏳ بانتظار التفعيل</span>;
                    return null;
                  })()}
                </div>
              </div>

              {/* Gamification Stats Card */}
              <div className="card-base p-4 flex flex-col items-center justify-center relative overflow-hidden text-center bg-gradient-to-tr from-gold/5 to-transparent border border-gold/10">
                <div className="flex w-full justify-around items-center">
                  <div className="flex flex-col items-center">
                    <Trophy size={28} className="text-gold mb-1" />
                    <span className="text-2xl font-black text-white">{student.level || 1}</span>
                    <span className="text-[10px] text-gray-400">المستوى الحالي</span>
                  </div>
                  <div className="w-px h-12 bg-white/10" />
                  <div className="flex flex-col items-center">
                    <Star size={28} className="text-yellow-400 mb-1" />
                    <span className="text-2xl font-black text-white">{student.points || 0}</span>
                    <span className="text-[10px] text-gray-400">إجمالي النقاط</span>
                  </div>
                  <div className="w-px h-12 bg-white/10" />
                  <div className="flex flex-col items-center">
                    <Award size={28} className="text-emerald-400 mb-1" />
                    <span className="text-2xl font-black text-white">{student.badges?.length || 0}</span>
                    <span className="text-[10px] text-gray-400">الأوسمة المكتسبة</span>
                  </div>
                </div>
                {/* Progress bar to next level */}
                <div className="w-full mt-4">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gold font-bold">التقدم للمستوى { (student.level || 1) + 1 }</span>
                    <span className="text-gray-400">{student.points || 0} / {((student.level || 1) * 1000)}</span>
                  </div>
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-gold/50 to-gold rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(((student.points || 0) / ((student.level || 1) * 1000)) * 100, 100)}%` }}
                    />
                  </div>
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
                        <img loading="lazy" src={teacherInfo.imageUrl} alt={teacherInfo.name} className="w-full h-full object-cover" />
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
              {/* WhatsApp + Logout */}
              {teacherInfo && teacherInfo.phone && (
                <a href={`https://wa.me/${teacherInfo.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `السلام عليكم ورحمة الله وبركاته،\n\n` +
                  `أنا الطالب(ة): ${student.name}\n` +
                  `الكود الخاص بي: ${student.code}\n` +
                  (student.grade ? `الصف الدراسي: ${student.grade}\n` : '') +
                  (student.phone ? `رقم الهاتف: ${student.phone}\n` : '') +
                  (student.parentPhone ? `رقم ولي الأمر: ${student.parentPhone}` : '')
                )}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-3 font-bold text-white py-4 rounded-2xl shadow-lg shadow-[#25D366]/20" style={{ background: '#25D366' }}>
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
            <StudentSchedule student={student} allEnrollments={allEnrollments} />
          )}
            </div>
          )}
        </div>
      </MobileStudentPortalWrapper>

      {/* Global Floating Chat Widget */}
      {student && student.id !== 'unknown_student' && (
        <GlobalChatWidget 
          currentUser={{...student, role: 'student'}}
          conversations={conversations}
          contacts={teacherInfo ? [{ id: teacherInfo.id, name: teacherInfo.name, subtitle: teacherInfo.subject, role: 'teacher' }] : []}
          superAdmin={null}
        />
      )}

      {/* ═══ LUXURIOUS CERTIFICATE MODAL ═══ */}

      {certData && (
        <div className="modal-overlay" >
           <div className="modal-content modal-content-sm !bg-white !p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
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

