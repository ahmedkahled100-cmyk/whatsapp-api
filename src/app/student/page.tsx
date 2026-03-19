'use client';
// src/app/student/page.tsx
// بوابة الطالب - تسجيل الدخول بالكود

import { useState, useEffect, useRef, useMemo } from 'react';
import { useStudentStore, useFileProcessingStore } from '@/lib/store';
import { getStudentByCode, getStudentByParentPhone, getPublishedExams, getAttemptsByStudent, getSettings, getMaterials, getAssignments, getStudentSubmissions, uploadFileToStorage, submitAssignment, subscribeToNotifications, dispatchNotification } from '@/lib/db';
import { FileProcessor } from '@/lib/file-processor';
import { showToast } from '@/lib/toast';
import type { Settings } from '@/types';
import type { Exam, Attempt, CourseMaterial, Assignment, AssignmentSubmission, Notification } from '@/types';
import { GraduationCap, LogOut, BookOpen, BarChart2, ClipboardList, Download, Award, Video, FileText, Link as LinkIcon, BookMarked, Globe, Lock, Upload, MessageCircle, Loader2, Bell } from 'lucide-react';
import { PDFCompressionModal } from '@/components/PDFCompressionModal';
import Link from 'next/link';
import { formatDateAr, gradeColor, scoreLabel, getViewerUrl, getDownloadUrl } from '@/lib/utils';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';

export default function StudentPortal() {
  const { student, setStudent, logout } = useStudentStore();
  const { queue } = useFileProcessingStore();
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
  
  // PDF Compression state
  const [compressionModal, setCompressionModal] = useState<{
    isOpen: boolean;
    file: File | null;
    onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  }>({ isOpen: false, file: null });

  const [activeTab, setActiveTab] = useState<'exams' | 'courses' | 'assignments' | 'results'>('exams');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [certData, setCertData] = useState<{ attempt: Attempt, exam: Exam } | null>(null);
  const [siteSettings, setSiteSettings] = useState<Settings | null>(null);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [parentPhone, setParentPhone] = useState('');
  const [recoveredCode, setRecoveredCode] = useState('');
  const [findingCode, setFindingCode] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  // File Preview Hook
  const { openPreview, PreviewModal } = useFilePreview();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (student) {
      if (student.teacherId) {
        getSettings(student.teacherId).then(s => setSiteSettings(s));
      }
      loadStudentData();
      const unsub = subscribeToNotifications(student.teacherId, (allNotifs) => {
        const myNotifs = allNotifs.filter(n => !n.targetUsers || n.targetUsers.length === 0 || n.targetUsers.includes(student.id) || (n as any).targetRoles?.includes('student'));
        setNotifications(myNotifs);
      });
      return () => unsub();
    }
  }, [student]);

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

  const loadStudentData = async () => {
    if (!student) return;
    try {
      const tId = student.teacherId || 'unknown_teacher';
      const sId = student.id || 'unknown_student';

      const [allExams, myAtts, allMaterials, allAssignments, mySubs] = await Promise.all([
        getPublishedExams(tId).catch(e => { console.error('Failed to load exams:', e); return [] as Exam[]; }),
        getAttemptsByStudent(sId).catch(e => { console.error('Failed to load attempts:', e); return [] as Attempt[]; }),
        getMaterials(tId).catch(e => { console.error('Failed to load materials:', e); return [] as CourseMaterial[]; }),
        getAssignments(tId).catch(e => { console.error('Failed to load assignments:', e); return [] as Assignment[]; }),
        getStudentSubmissions(sId).catch(e => { console.error('Failed to load submissions:', e); return [] as AssignmentSubmission[]; }),
      ]);

      // Filter exams for this student's group
      const filteredExams = allExams.filter(exam => {
        if (!exam.targetGroup) return true;
        return student.groupIds?.includes(exam.targetGroup);
      });

      setExams(filteredExams);
      setAttempts(myAtts.filter(a => a.completed));
      
      const isSubscribed = student.subType !== 'none';
      const isExpired = student.subExpiry ? new Date(student.subExpiry).getTime() < Date.now() : false;
      const hasActiveSub = isSubscribed && !isExpired;

      const filteredMaterials = allMaterials.filter(m => {
        // Filter by group visibility
        const groupMatch = !m.targetGroups || m.targetGroups.length === 0 || 
                         m.targetGroups.some(gId => student.groupIds?.includes(gId));
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
      const filteredAssigns = allAssignments.filter(a => {
        if (!a.targetGroup) return true;
        return student.groupIds?.includes(a.targetGroup);
      });
      setAssignments(filteredAssigns);
      setMySubmissions(mySubs);

    } catch (e) {
      console.error('loadStudentData error:', e);
    }
  };

  const handleLogin = async () => {
    if (!code.trim()) { setError('أدخل كودك أولاً'); return; }
    setLoading(true);
    setError('');
    try {
      const s = await getStudentByCode(code.trim());
      if (!s) { setError('❌ الكود غير صحيح'); }
      else { setStudent(s); }
    } catch { setError('تعذّر الاتصال'); }
    finally { setLoading(false); }
  };

  const handleForgotCode = async () => {
    if (!parentPhone.trim()) { showToast('أدخل رقم ولي الأمر أولاً'); return; }
    setFindingCode(true);
    setRecoveredCode('');
    try {
      const s = await getStudentByParentPhone(parentPhone.trim());
      if (s) {
        setRecoveredCode(s.code);
      } else {
        showToast('لم يتم العثور على طالب بهذا الرقم');
      }
    } catch (e) {
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
          channels: { inApp: true, whatsapp: false }
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

  // Login screen
  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--dark)' }}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-80 h-80 rounded-full opacity-8"
            style={{ background: 'radial-gradient(circle, var(--gold), transparent)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative w-full max-w-sm animate-scale-in">
          <div className="card-base p-6 sm:p-8 text-center"
            style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,197,24,0.12)' }}>
            <div className="text-5xl sm:text-6xl mb-4">🎓</div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black gold-text mb-1">بوابة الطالب</h1>
            <p className="text-xs sm:text-sm mb-6" style={{ color: 'var(--text-muted)' }}>أدخل كودك للوصول إلى اختباراتك</p>

            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="أدخل الكود..."
              className="input-base text-center text-xl sm:text-2xl font-mono tracking-[0.2em] sm:tracking-[0.3em] mb-4"
              style={{ border: '2px solid rgba(245,197,24,0.2)' }}
              maxLength={8}
              autoFocus
            />


            {error && (
              <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading}
              className="btn-gold w-full justify-center text-lg py-4 mb-6 shadow-xl shadow-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              {loading ? <><Loader2 className="animate-spin" size={20} /> جاري الدخول...</> : '🚀 دخول للمنصة'}
            </button>

            <div className="space-y-4 pt-6 border-t border-white/5">
              <div className="flex flex-col gap-3">
                <Link href="/register" className="text-sm font-bold gold-text hover:brightness-125 transition-all">
                  ✨ ليس لديك حساب؟ اطلب اشتراك الآن
                </Link>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => setShowForgotCode(true)}
                    className="text-xs text-text-muted hover:text-white transition-colors flex items-center gap-1"
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

  // Student dashboard
  const completedAttempts = attempts.filter(a => a.completed);
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / completedAttempts.length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(17,17,24,0.95)', borderBottom: '1px solid rgba(245,197,24,0.1)', backdropFilter: 'blur(12px)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'linear-gradient(135deg,var(--gold),var(--accent))', color: '#000' }}>
          {student.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{student.name}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>كود: {student.code}</div>
        </div>
        <div className="flex items-center gap-2">
          {siteSettings?.whatsappNumber && (
            <a
              href={`https://wa.me/${siteSettings.whatsappNumber}?text=${encodeURIComponent(`مرحباً أستاذ، أنا الطالب ${student.name} (كود: ${student.code})، أتواصل معك من بوابة الطلاب.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)' }}
            >
              <MessageCircle size={13} /> واتساب
            </a>
          )}
          
          <div className="relative">
            <button 
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Bell size={18} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
            
            {showNotifs && (
              <div className="absolute left-0 mt-2 w-72 max-h-96 overflow-y-auto bg-dark border border-white/10 rounded-xl shadow-xl z-50 p-2">
                <h3 className="text-sm font-bold p-2 border-b border-white/10 mb-2">الإشعارات</h3>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted">لا توجد إشعارات حالياً</div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map(notif => (
                      <div key={notif.id} className="p-2.5 rounded-lg text-xs hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${notif.read ? 'bg-gray-500' : 'bg-gold'}`} />
                          <span className={`${notif.read ? 'text-gray-400' : 'text-white font-bold'}`}>{notif.msg}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 mr-3.5">{notif.time || new Date(notif.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={logout} className="btn-outline text-xs py-1.5 px-3">
            <LogOut size={13} /> خروج
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
          {[
            { label: 'اختبار متاح', value: exams.length, icon: '📋' },
            { label: 'محاولة مكتملة', value: completedAttempts.length, icon: '✅' },
            { label: 'متوسط الدرجات', value: avgScore ? `${avgScore}%` : '—', icon: '📊', className: 'col-span-2 sm:col-span-1' },
          ].map((s, i) => (
            <div key={i} className={`stat-card text-center py-4 flex flex-col items-center justify-center ${s.className || ''}`}>
              <div className="text-2xl mb-1.5">{s.icon}</div>
              <div className="font-cairo font-black leading-none" style={{ color: 'var(--gold)', fontSize: '22px' }}>{s.value}</div>
              <div className="text-[11px] mt-1.5 font-bold opacity-70 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1.5 rounded-2xl overflow-x-auto no-scrollbar scroll-smooth" 
             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'exams', label: 'اختباراتي', icon: BookOpen },
            { id: 'courses', label: 'المناهج', icon: BookMarked },
            { id: 'assignments', label: 'الواجبات', icon: ClipboardList },
            { id: 'results', label: 'نتائجي', icon: BarChart2 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 rounded-xl text-[12px] sm:text-sm font-bold transition-all whitespace-nowrap px-4 flex items-center justify-center gap-2 ${activeTab === tab.id ? 'btn-gold shadow-lg shadow-gold/20' : 'text-text-muted hover:bg-white/5'}`}>
              <tab.icon size={14} className={activeTab === tab.id ? 'text-dark' : 'text-text-muted'} />
              {tab.label}
            </button>
          ))}
        </div>


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

              // Check schedule
              const now = Date.now();
              const start = exam.startTime ? new Date(exam.startTime).getTime() : 0;
              const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity;
              const available = !start || (now >= start && now <= end);
              const upcoming = start && now < start;

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
                          <span className="font-bold mr-1" style={{ color: gradeColor(lastScorePercent!, exam.passScore) }}>
                            {lastScoreData.points} / {lastScoreData.total} ({lastScorePercent}%) — {scoreLabel(lastScorePercent!)}
                          </span>
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
                      <Link href={`/exam/${exam.id}`}
                        className="btn-gold text-sm py-2 px-4 flex-shrink-0">
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
              // Group materials by subject
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
                    <span className="mr-auto text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">{subjectMaterials.length} دروس</span>
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
                          <div className="flex items-center gap-2 mt-1.5 text-xs">
                            {material.type === 'video' && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">🎬 فيديو</span>}
                            {material.type === 'pdf' && <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">📄 PDF</span>}
                            {material.type === 'image' && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">🖼️ صورة</span>}
                            {material.type === 'file' && <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold">📁 ملف</span>}
                            {material.type === 'link' && <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-bold">🔗 رابط</span>}
                            <span className="text-white/10">|</span>
                            {material.isFree ? (
                              <span className="text-green-500 flex items-center gap-1"><Globe size={10}/> مجاني</span>
                            ) : (
                              <span className="text-gold flex items-center gap-1">
                                {material.exceptionalStudents?.includes(student.id) ? (
                                  <><Award size={10}/> استثناء خاص لك</>
                                ) : (
                                  <><Lock size={10}/> للمشتركين</>
                                )}
                              </span>
                            )}
                          </div>
                          
                          {/* Links Row */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(material.url || material.fileUrl) && (
                              <button onClick={() => openPreview((material.url || material.fileUrl)!, material.title)} 
                                className="text-xs text-gold hover:underline flex items-center gap-1">
                                <LinkIcon size={10} /> الرابط الرئيسي
                              </button>
                            )}
                            {(material.additionalLinks || []).map((lnk: any, i: number) => (
                              <button key={i} onClick={() => openPreview(lnk.url, lnk.label || 'رابط إضافي')}
                                className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                <LinkIcon size={10} /> {lnk.label}
                              </button>
                            ))}
                          </div>
                          
                          {/* Linked Exam / Assignment Row */}
                          {(material.linkedExamId || material.linkedAssignmentId) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {material.linkedExamId && (() => {
                                const exam = exams.find(e => e.id === material.linkedExamId);
                                if (!exam) return null;
                                return (
                                  <button onClick={() => {
                                    setActiveTab('exams');
                                    setTimeout(() => document.getElementById(`exam-${exam.id}`)?.scrollIntoView({ behavior: 'smooth' }), 100);
                                  }} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:brightness-125 transition-all outline-none" style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--gold)' }}>
                                    <BookOpen size={10} /> {exam.title}
                                  </button>
                                );
                              })()}
                              {material.linkedAssignmentId && (() => {
                                const assign = assignments.find(a => a.id === material.linkedAssignmentId);
                                if (!assign) return null;
                                return (
                                  <button onClick={() => {
                                    setActiveTab('assignments');
                                    setTimeout(() => document.getElementById(`assign-${assign.id}`)?.scrollIntoView({ behavior: 'smooth' }), 100);
                                  }} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:brightness-125 transition-all outline-none" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                                    <ClipboardList size={10} /> {assign.title}
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {(material.url || material.fileUrl) && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => openPreview((material.url || material.fileUrl)!, material.title)}
                              className="btn-outline border-white/10 text-white/70 hover:text-white hover:border-gold px-4 py-2 text-xs h-auto flex-shrink-0"
                            >
                              {material.type === 'pdf' ? 'عرض الملف' : 
                               material.type === 'image' ? 'عرض الصورة' : 
                               material.type === 'video' ? 'مشاهدة' : 
                               material.type === 'file' ? 'عرض الملف' : 'فتح الرابط'}
                            </button>
                            {(material.type === 'pdf' || material.type === 'file' || material.type === 'image') && (
                              <a 
                                href={getDownloadUrl((material.url || material.fileUrl)!, material.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={`${material.title}${material.type === 'pdf' ? '.pdf' : ''}`}
                                className="btn-gold px-3 py-2 text-xs flex items-center justify-center gap-1.5 h-auto flex-shrink-0"
                                title="تحميل الملف"
                              >
                                <Download size={14} />
                                <span className="hidden sm:inline">تحميل</span>
                              </a>
                            )}
                          </div>
                        )}
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
                <p style={{ color: 'var(--text-muted)' }}>لا توجد واجبات مطلوبة حالياً.</p>
              </div>
            ) : assignments.map(assign => {
              const submission = mySubmissions.find(s => s.assignmentId === assign.id);
              const isPastDue = new Date(assign.dueDate).getTime() < Date.now();
              const isSubmitting = submittingAssignId === assign.id;

              return (
                <div id={`assign-${assign.id}`} key={assign.id} className="card-base p-5 border border-white/5 relative overflow-hidden">
                  {/* Decorative line */}
                  <div className={`absolute top-0 right-0 w-1 h-full ${submission ? 'bg-green-500' : isPastDue ? 'bg-red-500' : 'bg-gold'}`} />
                  
                  <div className="flex justify-between items-start mb-3 pl-4">
                    <div>
                      <h3 className="font-bold text-lg mb-1">{assign.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className={isPastDue ? 'text-red-400' : 'text-gold'}>⏱ موعد التسليم:</span>
                          {formatDateAr(assign.dueDate)}
                        </span>
                        <span>|</span>
                        <span>الدرجة: {assign.maxScore}</span>
                      </div>
                    </div>
                    
                    {submission ? (
                      <span className={`badge ${submission.status === 'graded' ? 'badge-green' : 'badge-gold'}`}>
                        {submission.status === 'graded' ? 'تم التصحيح' : 'تم التسليم'}
                      </span>
                    ) : (
                      <span className={`badge ${isPastDue ? 'badge-red' : 'bg-white/10'}`}>
                        {isPastDue ? 'متأخر' : 'مطلوب'}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-300 mb-4 bg-white/5 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">{assign.description}</p>
                  
                  {assign.fileUrl && (
                    <div className="mb-4">
                      <button onClick={() => openPreview(assign.fileUrl!, 'المرفق التوضيحي')} className="text-gold text-xs hover:underline flex items-center gap-1">
                        <FileText size={14} /> فتح المرفق التوضيحي للواجب
                      </button>
                    </div>
                  )}

                  <hr className="border-white/5 my-4" />

                  {/* Submission Form OR Result */}
                  {submission ? (
                    <div className="bg-black/20 p-4 rounded-xl space-y-3">
                      <h4 className="font-bold text-sm text-gray-300 border-b border-white/5 pb-2">إجابتك المسلمة:</h4>
                      {submission.textAnswer && <p className="text-sm whitespace-pre-wrap">{submission.textAnswer}</p>}
                      {submission.fileUrl && (
                        <button onClick={() => openPreview(submission.fileUrl!, 'ملف الإجابة')} className="btn-outline border-white/10 text-xs px-3 py-1.5 inline-flex items-center gap-2">
                          <LinkIcon size={12} /> مشاهدة الملف المرفق
                        </button>
                      )}
                      
                      {submission.status === 'graded' && (
                        <div className="mt-4 pt-3 border-t border-green-500/20 bg-green-500/5 p-3 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-green-400">نتيجة الواجب:</h5>
                            <span className="font-black text-xl text-green-400">{submission.score} / {submission.maxScore}</span>
                          </div>
                          {submission.teacherComment && (
                            <div className="text-sm text-gray-300 bg-black/40 p-2 rounded border border-white/5">
                              <b>تعليق المعلم:</b> {submission.teacherComment}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isPastDue ? (
                    <div className="text-red-400 text-sm text-center py-2 bg-red-400/10 rounded-lg">
                      انتهى وقت تسليم هذا الواجب
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm">تقديم الحل:</h4>
                      <textarea 
                        className="input-base w-full h-24 p-3 text-sm resize-none"
                        placeholder="اكتب إجابتك هنا... (اختياري إذا قمت برفع ملف)"
                        value={submitText}
                        onChange={e => setSubmitText(e.target.value)}
                        disabled={submittingAssignId !== null}
                      />
                      
                      <div className="flex items-center gap-2">
                        <label className="btn-outline flex-1 border-white/10 text-gray-400 hover:text-white cursor-pointer group flex items-center justify-center gap-2 py-3 rounded-xl border-dashed">
                          <Upload size={18} className="group-hover:text-gold transition-colors" />
                          <span className="text-sm">{submitFile ? submitFile.name : 'إرفاق ملف (صور، PDF، Word...)'}</span>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 100 * 1024 * 1024) {
                                    showToast('حجم الملف كبير جداً (أقصى حجم 100 ميجابايت)');
                                    return;
                                  }

                                  // Check if PDF > 10MB - Show compression modal
                                  const TEN_MB = 10 * 1024 * 1024;
                                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                  
                                  if (isPdf && file.size > TEN_MB) {
                                    setCompressionModal({
                                      isOpen: true,
                                      file: file,
                                      onComplete: async (compressedBlob, cloudinaryUrl, stats) => {
                                        try {
                                          const path = `assignments/${assign.id}/${student!.id}_${file.name}`;
                                          
                                          // Dispatch event to update the UI
                                          window.dispatchEvent(new CustomEvent('fileUploaded', {
                                            detail: { 
                                              url: cloudinaryUrl, 
                                              path, 
                                              fileName: file.name,
                                              stats
                                            }
                                          }));

                                          setSubmitFile(new File([compressedBlob], file.name, { type: 'application/pdf' }));
                                          setUploadedFileUrl(cloudinaryUrl);
                                          setCompressionModal({ isOpen: false, file: null });
                                        } catch (err: any) {
                                          console.error('Handoff Error:', err);
                                          showToast('حدث خطأ أثناء استلام الملف المضغوط');
                                        }
                                      }
                                    });
                                    e.target.value = '';
                                    return;
                                  }

                                  setSubmitFile(file);
                                  try {
                                    const path = `assignments/${assign.id}/${student!.id}_${file.name}`;
                                    await FileProcessor.queueFile(file, path);
                                    showToast('جاري ضغط ورفع الملف في الخلفية...');
                                  } catch (err: any) {
                                    showToast(err.message || 'فشل معالجة الملف');
                                  }
                                }
                            }}
                            disabled={submittingAssignId !== null}
                          />
                        </label>
                      </div>

                      {submitFile && (
                        <div className="flex items-center justify-between text-xs text-gold opacity-70">
                          <span>حجم الملف: {(submitFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          {queue.find(f => f.fileName === submitFile.name && f.status !== 'completed' && f.status !== 'failed') && (
                            <span className="flex items-center gap-1 animate-pulse">
                              <Loader2 size={10} className="animate-spin" /> جاري المعالجة...
                            </span>
                          )}
                          {uploadedFileUrl && <span className="text-green-400">✓ جاهز للتسليم</span>}
                        </div>
                      )}

                      <button 
                        onClick={() => handleAssignmentSubmit(assign.id)}
                        disabled={submittingAssignId !== null || (!submitText.trim() && !uploadedFileUrl)}
                        className="btn-gold w-full flex justify-center items-center gap-2 py-3 mt-2 disabled:opacity-50"
                      >
                        {submittingAssignId === assign.id ? (
                          <>⏳ جاري التسليم...</>
                        ) : queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.includes(assign.id)) ? (
                          <>⏳ يرجى الانتظار حتى اكتمال المعالجة...</>
                        ) : 'إرسال الواجب'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
              const scorePercent = att.finalScore ?? att.mcqScore ?? 0;
              const exam = exams.find(e => e.id === att.examId);
              const passScore = exam?.passScore || 50;

              const mcqPoints = att.mcqScore * att.mcqTotal / 100;
              const essayPoints = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
              const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
              const rawScore = Math.round((mcqPoints + essayPoints) * 10) / 10;
              
              const isPendingEssays = att.essayAnswers?.some(ea => ea.pending) || false;

              return (
                <div key={att.id} className="card-base p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        border: `3px solid ${isPendingEssays ? 'var(--accent)' : gradeColor(scorePercent, passScore)}`,
                        background: `rgba(${isPendingEssays ? '124,58,237' : (scorePercent >= passScore ? '16,185,129' : '239,68,68')},0.1)`,
                      }}>
                      <span className="font-cairo font-black text-[10px] text-center" style={{ color: isPendingEssays ? 'var(--accent)' : gradeColor(scorePercent, passScore) }}>
                        {isPendingEssays ? 'قيد التصحيح' : `${rawScore} / ${totalPoints}`}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{att.examTitle}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${isPendingEssays ? 'badge-purple' : (att.passed ? 'badge-green' : 'badge-red')}`}>
                          {isPendingEssays ? '📝 بانتظار المقالي' : (att.passed ? '✅ ناجح' : '❌ راسب')}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {att.submittedAt ? formatDateAr(att.submittedAt) : ''}
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {isPendingEssays ? 'سيتم إظهار النتيجة فور التصحيح' : `${att.mcqTotal > 0 ? `MCQ: ${Math.round(mcqPoints*10)/10} / ${att.mcqTotal} | ` : ''}${scoreLabel(scorePercent)}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {att.passed && exam && (
                      <button 
                        onClick={() => setCertData({ attempt: att, exam })}
                        className="btn-gold text-xs px-3 py-2 flex items-center gap-1.5"
                        style={{ boxShadow: '0 0 15px rgba(245,197,24,0.3)' }}
                      >
                        <Award size={14} /> <span className="hidden sm:inline">الشهادة</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {certData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-3xl animate-scale-in flex flex-col max-h-[95vh]">
            
            {/* Action Bar (hidden when printing) */}
            <div className="bg-[#111] border border-white/10 rounded-t-xl p-3 flex justify-between items-center print:hidden">
              <button onClick={() => setCertData(null)} className="text-white/50 hover:text-white px-3 text-sm">إغلاق</button>
              <button onClick={printCertificate} className="btn-gold py-1.5 px-4 text-xs flex items-center gap-2">
                <Download size={14} /> حفظ كصورة (أو طباعة)
              </button>
            </div>

            {/* Certificate Canvas */}
            <div 
              ref={certRef}
              className="bg-white rounded-b-xl overflow-y-auto print:rounded-none relative print:overflow-visible print:m-0"
              style={{
                aspectRatio: '1.414/1', // A4 Landscape ratio
                maxHeight: 'calc(95vh - 60px)',
              }}
            >
              {/* Certificate Luxurious Layout */}
              <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#fdfbf7] flex flex-col items-center border-[8px] border-[#F5C518] shadow-[inset_0_0_0_4px_#fff,inset_0_0_0_8px_#F5C518] p-8 md:p-12 text-center h-full min-h-[500px]">
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#F5C518 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                {siteSettings?.logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0">
                     <img src={siteSettings.logoUrl} alt="Watermark" className="w-[60%] object-contain" />
                  </div>
                )}

                <div className="relative z-10 w-full flex-1 flex flex-col items-center">
                  <div className="mb-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#1A1A25] rounded-full flex items-center justify-center shadow-lg mb-4">
                      <GraduationCap size={32} color="#F5C518" />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-black mb-1 text-[#1A1A25] tracking-widest font-cairo" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                      {siteSettings?.certHeader || 'شهادة إتمام واجتياز'}
                    </h3>
                  </div>

                  <p className="text-xl md:text-2xl text-gray-700 mb-5 font-medium">بكل فخر واعتزاز، نمنح هذه الشهادة للطالب/ة:</p>
                  
                  <h2 className="text-4xl md:text-5xl font-black text-[#F5C518] bg-[#1A1A25] px-10 md:px-12 py-4 md:py-5 rounded-2xl mb-6 shadow-2xl transform -rotate-1 font-cairo inline-block">
                    {certData.attempt.studentName}
                  </h2>

                  <p className="text-lg md:text-xl text-gray-700 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
                    نظراً لاجتيازه(ا) بتفوق ونجاح دراسة واختبار <br/>
                    <b className="text-[#1A1A25] text-xl md:text-2xl inline-block mt-2 border-b-2 border-dashed border-[#F5C518] pb-1">"{certData.exam.title}"</b>
                  </p>

                  {/* Score & Footer */}
                  <div className="w-full mt-auto flex flex-col sm:flex-row sm:grid sm:grid-cols-3 gap-4 items-center sm:items-end pt-6 border-t-2 border-[#F5C518]/20 text-center sm:text-right">
                    <div className="order-2 sm:order-1 sm:text-right">
                      <p className="text-xs md:text-sm text-gray-500 mb-1 font-bold">تاريخ الإصدار</p>
                      <p className="text-lg md:text-xl font-bold text-[#1A1A25]">{new Date(certData.attempt.submittedAt || Date.now()).toLocaleDateString('ar-EG')}</p>
                    </div>
                    
                    <div className="text-center flex justify-center relative -top-6">
                      <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-[#F5C518] to-[#d4af37] rounded-full flex flex-col items-center justify-center border-[4px] md:border-[6px] border-white shadow-2xl relative">
                        <div className="absolute inset-1 rounded-full border border-dashed border-black/20" />
                        <span className="text-[10px] md:text-xs font-bold text-[#1A1A25] mb-1">النسبة المئوية</span>
                        <span className="text-xl md:text-3xl font-black text-[#1A1A25]">
                          {certData.attempt.finalScore ?? certData.attempt.mcqScore ?? 0}%
                        </span>
                      </div>
                    </div>

                    <div className="order-3 sm:order-3 sm:text-left flex flex-col items-center">
                      <p className="text-xs md:text-sm text-gray-500 mb-2 font-bold text-center">التوقيع والختم</p>
                      {siteSettings?.certSignatureUrl ? (
                        <img src={siteSettings.certSignatureUrl} alt="التوقيع" className="h-12 md:h-16 max-w-[120px] md:max-w-[150px] object-contain" />
                      ) : (
                        <div className="font-cairo font-black text-lg md:text-2xl text-[#1A1A25] opacity-80 shrink-0 text-center whitespace-nowrap mt-2">
                           {siteSettings?.teacherName || siteSettings?.acadName || 'A-N Academy'}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 md:mt-6 text-base md:text-lg text-gray-400 font-bold italic w-full text-center">
                    {siteSettings?.certFooter || 'بكل فخر وتقدير'}
                  </p>
                </div>
              </div>
            </div>

            {/* Print specific CSS hidden in normal view but active during window.print() */}
            <style jsx global>{`
              @media print {
                body > *:not(.fixed) { display: none; }
                .fixed { position: absolute; left: 0; top: 0; right: 0; bottom: 0; padding: 0 !important; margin: 0 !important; background: white !important; }
                .fixed > div { max-width: none !important; width: 100% !important; height: 100vh !important; }
                @page { size: landscape; margin: 0; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {PreviewModal}

      {/* PDF Compression Modal */}
      {compressionModal.isOpen && compressionModal.file && (
        <PDFCompressionModal
          file={compressionModal.file}
          onClose={() => setCompressionModal({ isOpen: false, file: null })}
          onComplete={(blob, url, stats) => {
            compressionModal.onComplete?.(blob, url, stats);
            setCompressionModal({ isOpen: false, file: null });
          }}
          onCancel={() => {
            setCompressionModal({ isOpen: false, file: null });
          }}
        />
      )}
    </div>
  );
}
