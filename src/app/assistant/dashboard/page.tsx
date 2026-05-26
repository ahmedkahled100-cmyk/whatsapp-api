'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { 
  getTeachersForAssistant, getAssistantJobs, saveJobApplication, 
  getApplicationsForAssistant, updateAssistantProfile, uploadFileToStorage,
  sendMessage, subscribeToConversations, subscribeToMessages, markMessagesAsRead,
  getSuperAdmin, updateAssistantLinkStatus, getSettings, subscribeToNotifications
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';
import { 
  LogOut, BookOpen, GraduationCap, ShieldCheck, DollarSign, Calendar, 
  ArrowLeft, Loader2, Sparkles, Building2, User, Key, FileText, Search, 
  UploadCloud, Send, MessageSquare, Check, CheckCheck, Briefcase, Plus, Phone, AlertCircle, Mail
} from 'lucide-react';
import { Message, Conversation } from '@/types';
import { GlobalChatWidget } from '@/components/shared/GlobalChatWidget';
import { GlobalNotificationWidget } from '@/components/shared/GlobalNotificationWidget';
import { filterNotificationsForAssistant } from '@/lib/notification-audience';

export default function AssistantDashboard() {
  const router = useRouter();
  const { user, logout, setActiveTeacherId, setUser, setSettings } = useTeacherStore();
  const [enteringTeacherId, setEnteringTeacherId] = useState<string | null>(null);
  const [links, setLinks] = useState<{ link: any; teacher: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'academies' | 'jobs' | 'profile' | 'messages'>('academies');

  // Super Admin state for Contact Admin feature
  const [superAdmin, setSuperAdmin] = useState<any>(null);
  
  // Account Suspension state
  const [profileSuspended, setProfileSuspended] = useState(false);
  const [profileSuspensionReason, setProfileSuspensionReason] = useState('');

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    bio: '',
    experience: '',
    education: '',
    cvUrl: '',
    roleTitle: '',
    imageUrl: '',
    salaryPaymentMethod: 'fixed'
  });
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Jobs States
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingToJob, setApplyingToJob] = useState<any | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  // Chat/Messages States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to calculate payroll, resolving ReferenceError
  const calculatePayroll = (a: any) => {
    if (!a) return '-';
    if (a.salaryType === 'fixed' || a.salary_type === 'fixed') return `${a.salaryValue || a.salary_value} ج.م شهرياً`;
    if (a.salaryType === 'hourly' || a.salary_type === 'hourly') return `${a.salaryValue || a.salary_value} ج.م / ساعة`;
    if (a.salaryType === 'percentage' || a.salary_type === 'percentage') return `${a.salaryValue || a.salary_value}% من الدخل`;
    return '-';
  };

  // Load linked teachers and profile fields
  const loadInitialData = async () => {
    if (!user) return;
    try {
      // 1. Load active academy link contracts
      const res = await getTeachersForAssistant(user.id);
      setLinks(res);
      
      // 2. Fetch latest profile state from database
      const { data: dbProfile, error: dbProfileError } = await supabase
        .from('assistants_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (dbProfileError) {
        console.error('Error fetching database profile:', dbProfileError);
      }

      const mergedProfile = dbProfile ? {
        bio: dbProfile.bio || '',
        experience: dbProfile.experience || '',
        education: dbProfile.education || '',
        cvUrl: dbProfile.cv_url || '',
        roleTitle: dbProfile.role_title || '',
        imageUrl: dbProfile.image_url || '',
        salaryPaymentMethod: dbProfile.salary_payment_method || 'fixed',
        isSuspended: !!dbProfile.is_suspended,
        suspensionReason: dbProfile.suspension_reason || ''
      } : {
        bio: (user as any).bio || '',
        experience: (user as any).experience || '',
        education: (user as any).education || '',
        cvUrl: (user as any).cvUrl || '',
        roleTitle: (user as any).roleTitle || '',
        imageUrl: (user as any).imageUrl || '',
        salaryPaymentMethod: (user as any).salaryPaymentMethod || 'fixed',
        isSuspended: false,
        suspensionReason: ''
      };

      setProfileForm({
        bio: mergedProfile.bio,
        experience: mergedProfile.experience,
        education: mergedProfile.education,
        cvUrl: mergedProfile.cvUrl,
        roleTitle: mergedProfile.roleTitle,
        imageUrl: mergedProfile.imageUrl,
        salaryPaymentMethod: mergedProfile.salaryPaymentMethod
      });

      setProfileSuspended(mergedProfile.isSuspended);
      setProfileSuspensionReason(mergedProfile.suspensionReason);

      // 3. Load platform Super Admin for contact feature
      const admin = await getSuperAdmin();
      setSuperAdmin(admin);
      
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحميل البيانات المبدئية', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.role !== 'assistant') {
      router.replace('/auth');
      return;
    }
    loadInitialData();
  }, [user, router, mounted]);

  // Load jobs and applications when Jobs tab is selected
  useEffect(() => {
    if (activeTab === 'jobs' && user) {
      const fetchJobsData = async () => {
        setLoadingJobs(true);
        try {
          const jobsList = await getAssistantJobs();
          const appsList = await getApplicationsForAssistant(user.id);
          setAvailableJobs(jobsList);
          setMyApplications(appsList);
        } catch (err) {
          console.error(err);
          showToast('فشل تحميل الوظائف المعروضة', 'error');
        } finally {
          setLoadingJobs(false);
        }
      };
      fetchJobsData();
    }
  }, [activeTab, user]);

  // Real-time Chat Subscription
  useEffect(() => {
    if (activeTab === 'messages' && user) {
      const unsubConvs = subscribeToConversations(user.id, (convs) => {
        setConversations(convs);
      });
      return () => unsubConvs();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (selectedConv && user) {
      setLoadingMessages(true);
      const unsubMsgs = subscribeToMessages(selectedConv.id, (msgs) => {
        setMessages(msgs);
        setLoadingMessages(false);
        markMessagesAsRead(selectedConv.id, user.id);
      });
      return () => unsubMsgs();
    } else {
      setMessages([]);
    }
  }, [selectedConv?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEnterWorkspace = async (teacherId: string, teacherName: string) => {
    if (enteringTeacherId) return; // prevent double-click
    setEnteringTeacherId(teacherId);
    try {
      // Set active teacher in store (updates in-memory + localStorage synchronously)
      setActiveTeacherId(teacherId);
      // Pre-load the teacher's settings so they appear instantly
      try {
        const s = await getSettings(teacherId);
        setSettings(s || null);
      } catch {
        setSettings(null);
      }
      showToast(`🎓 جاري الدخول إلى أكاديمية أ. ${teacherName}...`, 'success');
      // Use window.location.href (full reload) to guarantee Zustand persisted state
      // is read from localStorage correctly on the teacher dashboard page
      window.location.href = '/teacher/dashboard';
    } catch (err) {
      console.error('Error entering workspace:', err);
      showToast('حدث خطأ أثناء الدخول، حاول مرة أخرى', 'error');
      setEnteringTeacherId(null);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  // CV Upload Handler
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== 'application/pdf') {
      showToast('يرجى رفع ملف بصيغة PDF فقط', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم الملف يجب ألا يتجاوز 10 ميجابايت', 'error');
      return;
    }

    setUploadingCV(true);
    try {
      const path = `assistant-cvs/${user.id}_cv.pdf`;
      const url = await uploadFileToStorage(file, path);
      setProfileForm(f => ({ ...f, cvUrl: url }));
      showToast('تم رفع السيرة الذاتية بنجاح', 'success');
    } catch (err) {
      console.error(err);
      showToast('فشل رفع الملف', 'error');
    } finally {
      setUploadingCV(false);
    }
  };

  // Upload Profile Image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صحيح', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `assistant-images/${user.id}_avatar.${ext}`;
      const url = await uploadFileToStorage(file, path);
      setProfileForm(f => ({ ...f, imageUrl: url }));
      showToast('تم رفع الصورة الشخصية بنجاح', 'success');
    } catch (err) {
      console.error(err);
      showToast('فشل رفع الصورة الشخصية', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Save profile info
  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateAssistantProfile(user.id, profileForm);
      
      // Update state in Zustand store
      setUser({
        ...user,
        ...profileForm
      } as any);

      showToast('تم تحديث ملفك المهني بنجاح', 'success');
    } catch (err) {
      console.error(err);
      showToast('فشل حفظ البيانات', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Job Application
  const handleApplyJob = async () => {
    if (!user || !applyingToJob) return;
    
    if (!profileForm.cvUrl) {
      showToast('يرجى رفع السيرة الذاتية أولاً في تبويب الملف المهني قبل التقديم', 'error');
      return;
    }

    setSubmittingApp(true);
    try {
      await saveJobApplication({
        jobId: applyingToJob.id,
        assistantId: user.id,
        cvUrl: profileForm.cvUrl,
        message: applyMessage,
        status: 'pending',
        createdAt: Date.now()
      });

      showToast('تم تقديم طلبك بنجاح وننتظر رد المعلم', 'success');
      setShowApplyModal(false);
      setApplyMessage('');
      
      // Refresh applications list
      const appsList = await getApplicationsForAssistant(user.id);
      setMyApplications(appsList);
    } catch (err) {
      console.error(err);
      showToast('لقد قمت بالتقديم على هذه الفرصة مسبقاً', 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleAcceptOffer = async (linkId: string) => {
    try {
      await updateAssistantLinkStatus(linkId, 'active');
      showToast('تم قبول العرض والإنضمام لأكاديمية المعلم بنجاح', 'success');
      // Refresh
      const res = await getTeachersForAssistant(user!.id);
      setLinks(res);
    } catch (err) {
      showToast('حدث خطأ أثناء قبول العرض', 'error');
    }
  };

  const handleRejectOffer = async (linkId: string) => {
    if (!confirm('هل أنت متأكد من رفض هذا العرض؟')) return;
    try {
      await updateAssistantLinkStatus(linkId, 'rejected');
      showToast('تم رفض العرض', 'success');
      // Refresh
      const res = await getTeachersForAssistant(user!.id);
      setLinks(res);
    } catch (err) {
      showToast('حدث خطأ أثناء رفض العرض', 'error');
    }
  };

  // Send Message inside Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || !user) return;

    setSending(true);
    try {
      const receiverId = selectedConv.participants.find(p => p !== user.id)!;

      const receiverName = selectedConv.participantNames[selectedConv.participants.indexOf(receiverId)] || 'المعلم';

      await sendMessage({
        senderId: user.id,
        senderName: user.name,
        receiverId,
        receiverName,
        content: newMessage.trim(),
        teacherId: receiverId, // Assumes receiver is the teacher
        type: 'text'
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
      showToast('فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const getPermissionLabel = (perm: string) => {
    switch (perm) {
      case 'dashboard': return 'الرئيسية';
      case 'notifications': return 'الإشعارات';
      case 'analytics': return 'التحليلات والمتابعة';
      case 'messages': return 'الرسائل والدردشة';
      case 'exams': return 'إدارة الاختبارات';
      case 'essays': return 'تصحيح المقالي';
      case 'results': return 'نتائج الطلاب';
      case 'qbank': return 'بنك الأسئلة';
      case 'ai': return 'الذكاء الاصطناعي';
      case 'games': return 'الألعاب التعليمية';
      case 'students': return 'إدارة الطلاب';
      case 'attendance': return 'الحضور والغياب';
      case 'groups': return 'إدارة الفصول';
      case 'subscriptions': return 'إدارة الاشتراكات';
      case 'finances': return 'الماليات والخزنة';
      case 'courses': return 'المناهج والكورسات';
      case 'assignments': return 'الواجبات';
      case 'calendar': return 'التقويم';
      case 'schedule': return 'جدول الحصص';
      case 'tools': return 'أدوات PDF';
      case 'settings': return 'الإعدادات (خطر)';
      default: return perm;
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c]">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );
  }

  // Blocking suspension screen
  if (profileSuspended) {
    const handleLogoutAndRedirect = async () => {
      await logout();
      router.replace('/auth');
    };

    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white flex items-center justify-center p-4 sm:p-8" dir="rtl">
        <div className="card-base p-8 max-w-xl w-full border-red-500/20 bg-gradient-to-b from-red-500/5 to-transparent text-center space-y-6 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
            <AlertCircle size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black font-cairo text-red-400">تم إيقاف حسابك مؤقتاً</h1>
            <p className="text-sm text-text-muted">لقد قامت إدارة المنصة بتجميد حساب المساعد الخاص بك.</p>
          </div>

          {profileSuspensionReason && (
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-sm text-gray-300 text-right space-y-1">
              <span className="font-bold text-red-400 text-xs block">سبب إيقاف الحساب:</span>
              <p className="italic text-gray-200">"{profileSuspensionReason}"</p>
            </div>
          )}

          {/* Contact Methods Grid */}
          <div className="space-y-3 pt-2 text-right">
            <span className="text-xs font-bold text-amber-500/80 block pr-1">طرق التواصل المتاحة مع الإدارة:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {superAdmin?.phone && (
                <>
                  {/* WhatsApp */}
                  <a 
                    href={`https://wa.me/20${superAdmin.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                      `مرحباً، أنا المساعد ${user?.name} (كود: ${user?.code || 'غير محدد'}). تم إيقاف حسابي وأود الاستفسار عن السبب.`
                    )}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 bg-green-500/5 hover:bg-green-500/10 border border-green-500/20 hover:border-green-500/40 rounded-2xl text-right transition group flex flex-col justify-between min-h-[90px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-1.5 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500 group-hover:text-black transition">
                        <MessageSquare size={14} />
                      </span>
                      <span className="text-[9px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded">موصى به</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">محادثة واتساب</h4>
                      <p className="text-[9px] text-text-muted mt-0.5">مراسلة فورية مع مسؤول المنصة</p>
                    </div>
                  </a>

                  {/* Phone Call */}
                  <a 
                    href={`tel:${superAdmin.phone}`}
                    className="p-4 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-2xl text-right transition group flex flex-col justify-between min-h-[90px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition">
                        <Phone size={14} />
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">اتصال هاتفي مباشر</h4>
                      <p className="text-[9px] text-text-muted mt-0.5">{superAdmin.phone}</p>
                    </div>
                  </a>
                </>
              )}

              {/* Email Support */}
              <a 
                href={`mailto:${superAdmin?.email || 'support@an-academy.com'}?subject=${encodeURIComponent(
                  `استفسار بخصوص حساب مساعد موقوف - ${user?.name || ''}`
                )}`}
                className="p-4 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl text-right transition group flex flex-col justify-between min-h-[90px] sm:col-span-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition">
                    <Mail size={14} />
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">البريد الإلكتروني للدعم</h4>
                  <p className="text-[9px] text-text-muted mt-0.5">{superAdmin?.email || 'support@an-academy.com'}</p>
                </div>
              </a>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleLogoutAndRedirect}
              className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <LogOut size={16} /> تسجيل الخروج من الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-4 sm:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Profile Section */}
        <div className="card-base p-6 sm:p-8 border-amber-500/20 bg-gradient-to-l from-amber-500/5 via-transparent to-transparent flex flex-col sm:flex-row justify-between items-center gap-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 text-center sm:text-right flex-col sm:flex-row">
            {profileForm.imageUrl ? (
              <img src={profileForm.imageUrl} alt={user?.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500/30 shrink-0" />
            ) : user?.imageUrl ? (
              <img src={user.imageUrl} alt={user?.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500/30 shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center text-2xl font-black text-amber-400 border border-amber-500/30 shrink-0">
                {user?.name?.[0] || 'A'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-black font-cairo text-white">{user?.name}</h1>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/20 flex items-center gap-0.5 animate-pulse">
                  <Sparkles size={10} /> مساعد مادة
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">تخصص: {profileForm.roleTitle || user?.subject || 'مساعد مادة عام'}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 font-mono justify-center sm:justify-start">
                <span>📞 {user?.phone || '—'}</span>
                <span className="text-amber-500/50">|</span>
                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">كود المساعد: {user?.code}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            <GlobalNotificationWidget 
              notifications={notifications} 
              currentUser={user} 
              teacherId={user?.id} 
            />
            {superAdmin?.phone && (
              <a 
                href={`https://wa.me/20${superAdmin.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                  `مرحباً إدارة منصة A-N Academy، أنا المساعد ${user?.name} (كود: ${user?.code})، أود التواصل معكم.`
                )}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-outline border-green-500/20 text-green-400 hover:bg-green-500/10 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition"
              >
                <Phone size={14} /> تواصل مع الإدارة
              </a>
            )}

            <button 
              onClick={handleLogout}
              className="btn-outline border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition"
            >
              <LogOut size={14} /> تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab('academies')}
            className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'academies' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <Building2 size={16} /> أكاديمياتي المتصلة ({links.length})
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'jobs' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <Briefcase size={16} /> فرص العمل والتوظيف
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'profile' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <User size={16} /> ملفي المهني والسيرة الذاتية
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'messages' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <MessageSquare size={16} /> محادثاتي ورسائل المعلمين
          </button>
        </div>

        {/* Tab Content 1: Linked Academies */}
        {activeTab === 'academies' && (
          <div className="space-y-6 animate-fade-in">
            {links.length === 0 ? (
              <div className="card-base p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
                <Building2 size={50} className="mx-auto mb-3 opacity-20 text-amber-500" />
                <p className="font-bold text-lg mb-1">لا توجد أكاديميات متصلة بحسابك حالياً</p>
                <p className="text-sm max-w-sm mx-auto mb-4">أعطِ رمز كود المساعد الخاص بك للمعلم ليقوم بإضافتك، أو تقدم على إحدى الفرص المفتوحة بالمنصة.</p>
                <button 
                  onClick={() => setActiveTab('jobs')}
                  className="px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-xs hover:bg-amber-600 transition"
                >
                  تصفح فرص العمل بالمنصة
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {links.map(({ link, teacher }) => (
                  <div key={link.id} className="card-base p-6 border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between group h-full bg-gradient-to-b from-white/5 to-transparent">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        {teacher.imageUrl ? (
                          <img src={teacher.imageUrl} alt={teacher.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-500/20">
                            {teacher.name[0]}
                          </div>
                        )}
                        <div>
                          <h3 className="font-black text-white group-hover:text-amber-400 transition-colors text-base">أ. {teacher.name}</h3>
                          <p className="text-xs text-text-muted">مادة: {teacher.subject || '—'}</p>
                        </div>
                      </div>

                      {link.status === 'pending' && (
                        <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs text-center font-bold">
                          لديك عرض انضمام معلق من هذا المعلم
                        </div>
                      )}
                      {link.status === 'rejected' && (
                        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-bold">
                          لقد قمت برفض هذا العرض
                        </div>
                      )}

                      <div className="space-y-2.5 py-4 border-y border-white/5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-text-muted text-xs">دور المساعد:</span>
                          <span className="font-bold text-white bg-white/5 px-2.5 py-0.5 rounded text-xs">{link.role}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-muted text-xs">حساب الراتب:</span>
                          <span className="font-mono font-black text-emerald-400 text-xs">{calculatePayroll(link)}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-text-muted text-xs block mb-1">الصلاحيات المصرحة:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {link.permissions.length === 0 ? (
                              <span className="text-xs text-gray-500 font-bold">لا توجد صلاحيات</span>
                            ) : (
                              link.permissions.map((p: string) => (
                                <span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/10">
                                  {getPermissionLabel(p)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {link.status === 'pending' ? (
                      <div className="mt-5 space-y-2">
                        <button 
                          onClick={() => handleAcceptOffer(link.id)}
                          className="w-full bg-amber-500 text-black font-black py-2.5 rounded-xl hover:bg-amber-600 transition flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(245,158,11,0.15)] group-hover:scale-[1.01]"
                        >
                          <Check size={16} /> قبول العرض
                        </button>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRejectOffer(link.id)}
                            className="flex-1 bg-red-500/10 text-red-400 font-bold py-2 rounded-xl hover:bg-red-500/20 transition flex items-center justify-center gap-1.5 text-xs border border-red-500/20"
                          >
                            رفض
                          </button>
                          <Link 
                            href={`/assistant/dashboard?tab=messages`}
                            onClick={() => setActiveTab('messages')}
                            className="flex-1 bg-blue-500/10 text-blue-400 font-bold py-2 rounded-xl hover:bg-blue-500/20 transition flex items-center justify-center gap-1.5 text-xs border border-blue-500/20"
                          >
                            <MessageSquare size={13} /> طلب تعديل
                          </Link>
                        </div>
                      </div>
                    ) : link.status === 'rejected' ? (
                      <div className="w-full mt-5 bg-white/5 text-gray-500 font-bold py-2.5 rounded-xl flex items-center justify-center text-sm border border-white/10 cursor-not-allowed">
                        عرض مرفوض
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleEnterWorkspace(teacher.id, teacher.name)}
                        disabled={enteringTeacherId === teacher.id}
                        className="w-full mt-5 bg-amber-500 text-black font-black py-2.5 rounded-xl hover:bg-amber-600 transition flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(245,158,11,0.15)] group-hover:scale-[1.01] disabled:opacity-80 disabled:cursor-wait"
                      >
                        {enteringTeacherId === teacher.id ? (
                          <><Loader2 size={16} className="animate-spin" /> جاري الدخول...</>
                        ) : (
                          <>دخول لوحة عمل المعلم <ArrowLeft size={16} /></>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Jobs */}
        {activeTab === 'jobs' && (
          <div className="space-y-8 animate-fade-in">
            {/* My Submitted Applications */}
            {myApplications.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-white">طلبات التقديم السابقة لك</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myApplications.map(app => (
                    <div key={app.id} className="card-base p-4 border-white/5 bg-white/5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm">{app.job?.title}</h4>
                          <p className="text-xs text-text-muted">المعلم: {app.job?.teacherName}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.status === 'accepted' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {app.status === 'accepted' ? 'مقبول وتم التوظيف' : app.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                        <span className="text-text-muted">الراتب المعروض: {app.job ? calculatePayroll(app.job) : '-'}</span>
                        <div className="flex gap-2">
                          <Link 
                            href={`/assistant/dashboard?tab=messages`}
                            onClick={() => setActiveTab('messages')}
                            className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/20"
                          >
                            دردشة بالمنصة
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Jobs list */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-white">فرص العمل المتاحة بالمنصة</h3>
              
              {loadingJobs ? (
                <div className="text-center p-8"><Loader2 className="animate-spin text-amber-500 mx-auto" /></div>
              ) : availableJobs.length === 0 ? (
                <div className="card-base p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
                  لا توجد فرص عمل منشورة بالمنصة حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableJobs.map(job => {
                    const hasApplied = myApplications.some(app => app.jobId === job.id);
                    return (
                      <div key={job.id} className="card-base p-5 border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between h-full bg-gradient-to-b from-white/5 to-transparent relative">
                        <div className="space-y-3">
                          <h4 className="font-bold text-white text-base">{job.title}</h4>
                          <p className="text-xs text-text-muted">المعلم المعلن: {job.teacherName}</p>
                          <p className="text-xs text-gray-400 line-clamp-3">"{job.description}"</p>
                          {job.requirements && (
                            <p className="text-[11px] text-text-muted"><strong>الشروط:</strong> {job.requirements}</p>
                          )}
                          <div className="text-xs font-bold text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 w-max">
                            الراتب: {calculatePayroll(job)}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-white/5">
                          {hasApplied ? (
                            <div className="w-full bg-amber-500/10 text-amber-400 font-bold text-xs py-2 rounded-xl border border-amber-500/20 text-center">
                              لقد قدمت على هذه الفرصة
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setApplyingToJob(job); setShowApplyModal(true); }}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-2 rounded-xl text-xs transition"
                              >
                                تقديم على الوظيفة
                              </button>
                              {job.teacherPhone && (
                                <a
                                  href={`https://wa.me/20${job.teacherPhone.replace(/^0/, '')}?text=${encodeURIComponent(`مرحباً أ. ${job.teacherName}، أنا المساعد ${user?.name} ومهتم بفرصة العمل: ${job.title}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-green-500/20"
                                >
                                  <Phone size={13} /> تواصل
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 3: Profile */}
        {activeTab === 'profile' && (
          <div className="card-base p-6 sm:p-8 space-y-6 border-white/10 bg-gradient-to-b from-white/5 to-transparent animate-fade-in max-w-2xl mx-auto">
            <div>
              <h3 className="text-lg font-bold text-amber-400 mb-1 flex items-center gap-2">
                <User size={20} /> بناء الملف المهني والسيرة الذاتية
              </h3>
              <p className="text-xs text-text-muted">تعبئة خبراتك وسيرتك الذاتية يزيد من فرصة قبولك للعمل لدى المعلمين بالمنصة.</p>
            </div>

            <div className="space-y-4">
              {/* Profile Avatar Image Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-white/5 bg-black/20 rounded-2xl">
                <div className="relative shrink-0">
                  {profileForm.imageUrl ? (
                    <img src={profileForm.imageUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500/30" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center text-2xl font-black text-amber-400 border border-amber-500/30">
                      {user?.name?.[0] || 'A'}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 text-center sm:text-right">
                  <span className="block text-xs font-bold text-white">صورة الملف الشخصي</span>
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 cursor-pointer text-xs font-bold transition">
                    <UploadCloud size={14} />
                    <span>{uploadingImage ? 'جاري الرفع...' : 'تغيير الصورة الشخصية'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                  <p className="text-[10px] text-gray-500">صورة مربعة واضحة (PNG أو JPG)</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">المسمى المهني / التخصص</label>
                <input 
                  type="text" 
                  value={profileForm.roleTitle} 
                  onChange={e => setProfileForm({ ...profileForm, roleTitle: e.target.value })}
                  placeholder="مثال: مصحح لغة عربية، سكرتير مجموعة، مساعد فيزياء..." 
                  className="input-base w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">نبذة تعريفية قصيرة</label>
                <textarea 
                  value={profileForm.bio} 
                  onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder="اكتب نبذة مختصرة عن مهاراتك وشغفك بالتعليم..." 
                  className="input-base w-full min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">الخبرات السابقة</label>
                <textarea 
                  value={profileForm.experience} 
                  onChange={e => setProfileForm({ ...profileForm, experience: e.target.value })}
                  placeholder="اذكر الأماكن والمدرسين الذين عملت معهم مسبقاً والمهام التي أديتها..." 
                  className="input-base w-full min-h-[100px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">التعليم والدراسة</label>
                <input 
                  type="text" 
                  value={profileForm.education} 
                  onChange={e => setProfileForm({ ...profileForm, education: e.target.value })}
                  placeholder="الكلية، التخصص، أو الشهادات الدراسية..." 
                  className="input-base w-full"
                />
              </div>

              {/* Preferred Salary Method selector */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">طريقة دفع الراتب المفضلة</label>
                <select
                  value={profileForm.salaryPaymentMethod}
                  onChange={e => setProfileForm({ ...profileForm, salaryPaymentMethod: e.target.value })}
                  className="input-base w-full bg-[#0a0f1c]"
                >
                  <option value="fixed">راتب شهري ثابت</option>
                  <option value="hourly">بالساعة (حسب ساعات العمل)</option>
                  <option value="percentage">نسبة مئوية من الدخل</option>
                  <option value="flexible">بالاتفاق / مرن</option>
                </select>
              </div>

              {/* CV File Upload */}
              <div className="p-4 border border-white/5 bg-black/20 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText size={16} className="text-amber-400" /> ملف السيرة الذاتية (CV)
                </label>
                
                {profileForm.cvUrl ? (
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
                      <FileText size={14} /> سيرة ذاتية مرفوعة
                    </div>
                    <a 
                      href={profileForm.cvUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-blue-400 underline hover:text-blue-300"
                    >
                      معاينة وتحميل
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">لم تقم برفع سيرتك الذاتية بعد.</p>
                )}

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-amber-500/30 p-6 rounded-xl cursor-pointer transition bg-white/5">
                  <UploadCloud size={28} className={uploadingCV ? 'animate-bounce text-amber-500' : 'text-gray-400'} />
                  <span className="text-xs font-bold mt-2">{uploadingCV ? 'جاري رفع الملف...' : 'اضغط هنا لرفع السيرة الذاتية (PDF)'}</span>
                  <span className="text-[10px] text-gray-500 mt-1">الحد الأقصى 10 ميجابايت</span>
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={handleCVUpload} 
                    className="hidden" 
                    disabled={uploadingCV}
                  />
                </label>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || uploadingCV}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات بالملف الشخصي'}
            </button>
          </div>
        )}

        {/* Tab Content 4: Messages */}
        {activeTab === 'messages' && (
          <div className="flex h-[550px] bg-[#0d121f] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl">
            {/* Conversations List */}
            <div className={`w-full md:w-80 border-l border-white/5 bg-white/5 flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-white/5">
                <h3 className="font-bold text-lg text-white">محادثات المعلمين</h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center opacity-60 mt-10">
                    <MessageSquare size={36} className="text-gray-500 mb-2" />
                    <p className="text-xs font-bold text-gray-300">لا توجد محادثات نشطة</p>
                    <p className="text-[10px] text-gray-500 mt-1">عند قبول طلب تعيينك أو تواصل معلم معك ستظهر المحادثة هنا.</p>
                  </div>
                ) : (
                  conversations.map(conv => {
                    const idx = conv.participants.findIndex(p => p !== user?.id);
                    const name = conv.participantNames[idx] || 'معلم';
                    const active = selectedConv?.id === conv.id;
                    const hasUnread = conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === user?.id;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConv(conv)}
                        className={`w-full p-4 flex items-center gap-3 transition border-b border-white/5 text-right relative ${
                          active ? 'bg-gradient-to-l from-gold/10 to-transparent' : 'hover:bg-white/5'
                        }`}
                      >
                        {active && <div className="absolute top-0 right-0 w-[3px] h-full bg-gold" />}
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                          {name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold truncate text-sm text-gray-200">{name}</span>
                          </div>
                          <p className={`text-xs truncate ${hasUnread ? 'text-amber-400 font-bold' : 'text-gray-500'}`}>
                            {conv.lastMessage?.content || 'عرض المحادثة...'}
                          </p>
                        </div>
                        {hasUnread && <span className="w-2 h-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat Box */}
            <div className={`flex-1 flex flex-col bg-[#0a0f1c] ${!selectedConv ? 'hidden md:flex items-center justify-center p-10 text-center' : 'flex'}`}>
              {!selectedConv ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare size={48} className="text-amber-500/30 mb-4" />
                  <h4 className="font-bold text-white mb-1">حدد محادثة للبدء</h4>
                  <p className="text-xs text-gray-500">اختر أحد المعلمين من القائمة الجانبية لبدء المحادثة.</p>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedConv(null)} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400">&larr;</button>
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        {selectedConv.participantNames[selectedConv.participants.findIndex(p => p !== user?.id)][0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          {selectedConv.participantNames[selectedConv.participants.findIndex(p => p !== user?.id)]}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Message History */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/10">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
                    ) : (
                      messages.map((msg, i) => {
                        const isMine = msg.senderId === user?.id;
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl shadow-lg relative ${
                              isMine ? 'bg-amber-500 text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                            }`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <span className="text-[9px] opacity-60 mt-1 block text-left">
                                {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
                    <input 
                      type="text" 
                      value={newMessage} 
                      onChange={e => setNewMessage(e.target.value)} 
                      placeholder="اكتب رسالة..." 
                      className="input-base flex-1 py-2 text-xs" 
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Apply Job Modal */}
      {showApplyModal && applyingToJob && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowApplyModal(false)}>
          <div className="modal-content border-amber-500/20 max-w-md">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                تقديم على وظيفة: {applyingToJob.title}
              </h3>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <span className="block text-xs font-bold text-text-muted mb-1">السيرة الذاتية المستخدمة:</span>
                {profileForm.cvUrl ? (
                  <div className="p-2.5 bg-green-500/5 border border-green-500/10 rounded-xl text-xs text-green-400 font-bold flex items-center justify-between">
                    <span>✓ سيرة ذاتية جاهزة</span>
                    <a href={profileForm.cvUrl} target="_blank" rel="noopener noreferrer" className="underline text-[10px]">عرض الملف</a>
                  </div>
                ) : (
                  <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 font-bold">
                    ⚠️ لم تقم برفع سيرتك الذاتية بعد. يرجى التوجه لتبويب "ملفي المهني" ورفعها بصيغة PDF أولاً.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">رسالة تعريفية للمعلم (اختياري)</label>
                <textarea 
                  value={applyMessage} 
                  onChange={e => setApplyMessage(e.target.value)} 
                  className="input-base w-full min-h-[100px]" 
                  placeholder="اكتب رسالة للمعلم توضح فيها سبب رغبتك بالعمل معه وخبرتك..." 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowApplyModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button 
                onClick={handleApplyJob} 
                disabled={submittingApp || !profileForm.cvUrl} 
                className="btn-gold flex-1 justify-center text-black bg-amber-500 hover:bg-amber-600 font-bold"
              >
                {submittingApp ? 'جاري التقديم...' : 'تأكيد التقديم والطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Floating Chat Widget */}
      <GlobalChatWidget 
        currentUser={user}
        conversations={conversations}
        contacts={links.map(l => ({ id: l.teacher.id, name: l.teacher.name, subtitle: l.teacher.subject, role: 'teacher' }))}
        superAdmin={superAdmin}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(245, 197, 24, 0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
