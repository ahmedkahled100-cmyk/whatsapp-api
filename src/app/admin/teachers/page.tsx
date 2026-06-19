'use client';
// src/app/admin/teachers/page.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTeachers, saveTeacher, deleteTeacher, updateSuperAdminCredentials, getSuperAdmin, getSettings, deleteRegistrationRequest, dispatchNotification, getAllAssistantProfiles, saveAssistantProfile } from '@/lib/db';
import { TeacherUser, Settings as PlatformSettings, AssistantProfile } from '@/types';
import { showToast } from '@/lib/toast';
import { UserPlus, Shield, User, Clock, Edit2, Trash2, X, Save, Lock, LayoutDashboard, Bell, FileText, Users, CreditCard, BookMarked, ClipboardList, Calendar, Bot, BarChart2, Check, ExternalLink, CheckCircle2, XCircle, Printer, Send, TrendingUp, DollarSign, UserX, ArrowRight, RefreshCw, Phone, MessageCircle, AlertCircle } from 'lucide-react';
import { useTeacherStore } from '@/lib/store';
import { ImageModal } from '@/components/ImageModal';
import { cleanWhatsAppPhone } from '@/lib/utils';
import { FinancialReports } from '@/components/FinancialReports';
import { TeacherLedgerModal } from '@/components/admin/TeacherLedgerModal';
import { supabase } from '@/lib/supabase';
import { ASSISTANTS_PROFILES } from '@/lib/db/supabase/hr';

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'exams', label: 'الاختبارات', icon: FileText },
  { id: 'students', label: 'الطلاب والنتائج', icon: Users },
  { id: 'subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { id: 'courses', label: 'المناهج', icon: BookMarked },
  { id: 'assignments', label: 'الواجبات', icon: ClipboardList },
  { id: 'calendar', label: 'التقويم', icon: Calendar },
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: Bot },
  { id: 'analytics', label: 'التحليلات والمقالي', icon: BarChart2 },
];

export default function ManageTeachersPage() {
  const { user: currentUser, teacherJoinRequests } = useTeacherStore();
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [assistants, setAssistants] = useState<AssistantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'pending' | 'expiring' | 'assistants' | 'financials'>('current');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherUser | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ledgerTeacher, setLedgerTeacher] = useState<TeacherUser | null>(null);
  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; teacher: TeacherUser | null; reason: string }>({ isOpen: false, teacher: null, reason: '' });
  
  // Image Modal state
  const [selectedImg, setSelectedImg] = useState<{ src: string, alt: string } | null>(null);

  // Pending Approval State for Teachers Join Requests
  const [pendingApproval, setPendingApproval] = useState<any | null>(null);
  const [approvalForm, setApprovalForm] = useState({
    code: '',
    password: '',
    subType: 'monthly' as 'monthly' | 'yearly' | 'free',
    subPrice: 0,
    subStart: '',
    subExpiry: '',
    name: '',
    subject: '',
    phone: ''
  });

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    code: '',
    role: 'teacher' as 'super_admin' | 'teacher',
    permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
    subType: 'free' as 'free' | 'monthly' | 'yearly',
    subExpiry: null as number | null,
    subLink: '',
    subPrice: 0,
    imageUrl: '',
    subject: '',
    phone: ''
  });

  const [adminForm, setAdminForm] = useState({
    username: currentUser?.username || '',
    password: '',
    confirmPassword: ''
  });

  const [receiptForm, setReceiptForm] = useState({
    teacherName: '',
    amount: 0,
    subType: 'monthly',
    date: new Date().toISOString().split('T')[0],
    whatsapp: ''
  });

  const loadData = useCallback(async (showFullLoader = true) => {
    if (showFullLoader) setLoading(true);
    try {
      const [teachersList, admin, assistantsList] = await Promise.all([
        getTeachers(), 
        getSuperAdmin(),
        getAllAssistantProfiles()
      ]);
      setTeachers(teachersList);
      setAssistants(assistantsList);

      if (admin) {
        const s = await getSettings(admin.id);
        setPlatformSettings(s);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showFullLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    let list = teachers;
    
    if (activeTab === 'expiring') {
        list = teachers.filter(t => {
            if (t.role === 'super_admin' || t.subType === 'free' || !t.subExpiry) return false;
            const days = Math.ceil((t.subExpiry - Date.now()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 7;
        });
    }

    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        (t.code || '').toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch, activeTab]);

  const stats = useMemo(() => {
    const active = teachers.filter(t => t.isActive && (t.subType === 'free' || !t.subExpiry || t.subExpiry > Date.now())).length;
    const expired = teachers.filter(t => t.role !== 'super_admin' && t.subType !== 'free' && t.subExpiry && t.subExpiry < Date.now()).length;
    const totalRevenue = teachers.reduce((sum, t) => sum + (t.totalPaid || 0), 0);
    const expiringCount = teachers.filter(t => {
        if (t.role === 'super_admin' || t.subType === 'free' || !t.subExpiry) return false;
        const days = Math.ceil((t.subExpiry - Date.now()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 7;
    }).length;

    return { active, expired, totalRevenue, expiringCount, total: teachers.length };
  }, [teachers]);

  const sendTeacherReminder = (teacher: TeacherUser) => {
    const days = teacher.subExpiry ? Math.ceil((teacher.subExpiry - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    const msg = `📢 *تذكير باشتراك المنصة*\n\nأهلاً بك يا أستاذ *${teacher.name}*،\n\nنود تذكير سيادتكم بأن اشتراك المنصة الخاص بكم ${days <= 0 ? 'قد انتهى بالفعل!' : `سينتهي خلال *${days} أيام فقط*`}\n\nتاريخ الانتهاء: ${teacher.subExpiry ? new Date(teacher.subExpiry).toLocaleDateString('ar-EG') : '—'}\nقيمة التجديد: *${teacher.subPrice || 0} ج.م*\n\nيرجى التنسيق للتجديد لضمان استمرار عمل الأكاديمية دون توقف.\n\nشكراً لك 🎓`;
    const phone = cleanWhatsAppPhone(teacher.phone || teacher.username);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Auto-fill price based on subType
  useEffect(() => {
    if (!platformSettings || editingTeacher) return;
    
    if (form.subType === 'monthly') {
      setForm(f => ({ ...f, subPrice: platformSettings.monthlyPrice || 0 }));
    } else if (form.subType === 'yearly') {
      setForm(f => ({ ...f, subPrice: platformSettings.yearlyPrice || 0 }));
    } else if (form.subType === 'free') {
      setForm(f => ({ ...f, subPrice: 0 }));
    }
  }, [form.subType, platformSettings, editingTeacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || (!editingTeacher && !form.password)) { showToast('أكمل جميع الحقول المطلوبة'); return; }

    setSubmitting(true);
    try {
      const data = editingTeacher
        ? { ...editingTeacher, ...form, id: editingTeacher.id }
        : { ...form, isActive: true, createdAt: Date.now() };

      await saveTeacher(data as any);

      // Update UI only after success
      setTeachers(prev => {
        if (editingTeacher) {
          return prev.map(t => t.id === editingTeacher.id ? data as TeacherUser : t);
        } else {
          // Temporarily use Date.now as ID if not fully refetched
          return [...prev, { ...data, id: 'temp-' + Date.now() } as TeacherUser];
        }
      });
      setShowAddForm(false);
      setEditingTeacher(null);
      setForm({
        name: '', username: '', password: '', code: '', role: 'teacher',
        permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
        subType: 'free', subExpiry: null, subLink: '', subPrice: 0, imageUrl: '', subject: '', phone: ''
      });

      showToast(editingTeacher ? 'تم تحديث الحساب' : 'تمت إضافة الحساب بنجاح');
      void loadData(false);

    } catch (err: any) {
      const msg = err.message || 'حدث خطأ';
      showToast(msg);
      
      // Auto-revert the specific duplicate field to original if editing
      if (editingTeacher) {
        if (msg.includes('الكود')) {
          setForm(f => ({ ...f, code: editingTeacher.code || '' }));
        }
        if (msg.includes('اسم المستخدم')) {
          setForm(f => ({ ...f, username: editingTeacher.username || '' }));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  const calculateExpiryDate = (startStr: string, type: 'monthly' | 'yearly' | 'free') => {
    if (type === 'free') return '';
    const date = new Date(startStr);
    if (isNaN(date.getTime())) return '';
    if (type === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().split('T')[0];
  };

  const handleApprovalTypeChange = (newType: 'monthly' | 'yearly' | 'free') => {
    let price = 0;
    if (newType === 'monthly') {
      price = platformSettings?.monthlyPrice || 0;
    } else if (newType === 'yearly') {
      price = platformSettings?.yearlyPrice || 0;
    }

    const startStr = approvalForm.subStart || new Date().toISOString().split('T')[0];
    const expiryStr = calculateExpiryDate(startStr, newType);

    setApprovalForm(prev => ({
      ...prev,
      subType: newType,
      subPrice: price,
      subExpiry: expiryStr
    }));
  };

  const handleApprovalStartChange = (newStart: string) => {
    const expiryStr = calculateExpiryDate(newStart, approvalForm.subType);
    setApprovalForm(prev => ({
      ...prev,
      subStart: newStart,
      subExpiry: expiryStr
    }));
  };

  const handleApproveRequest = (req: any) => {
    const defaultPassword = Math.random().toString(36).slice(-8);
    const defaultCode = Math.random().toString(36).toUpperCase().slice(-6);
    const subType = (req.subType as 'monthly' | 'yearly' | 'free') || 'monthly';
    const subStart = new Date().toISOString().split('T')[0];
    
    // Calculate price based on type
    let price = 0;
    if (subType === 'monthly') {
      price = platformSettings?.monthlyPrice || 0;
    } else if (subType === 'yearly') {
      price = platformSettings?.yearlyPrice || 0;
    }

    const expiryStr = calculateExpiryDate(subStart, subType);

    setApprovalForm({
      code: defaultCode,
      password: defaultPassword,
      subType: subType,
      subPrice: price,
      subStart: subStart,
      subExpiry: expiryStr,
      name: req.name,
      subject: req.subject || '',
      phone: req.phone || ''
    });
    setPendingApproval(req);
  };

  const finalApprove = async () => {
    if (!pendingApproval) return;
    setSaving(true);
    try {
        const subStart = approvalForm.subStart ? new Date(approvalForm.subStart).getTime() : Date.now();
        const subExpiry = approvalForm.subType === 'free' ? null : (approvalForm.subExpiry ? new Date(approvalForm.subExpiry).getTime() : (subStart + 30 * 24 * 60 * 60 * 1000));
        
        const newTeacher: Partial<TeacherUser> = {
            name: approvalForm.name,
            username: approvalForm.phone,
            password: approvalForm.password,
            code: approvalForm.code,
            phone: approvalForm.phone,
            role: 'teacher',
            isActive: true,
            createdAt: Date.now(),
            subType: approvalForm.subType,
            subExpiry: subExpiry,
            subPrice: approvalForm.subPrice,
            imageUrl: pendingApproval.imageUrl || '',
            subject: approvalForm.subject
        };

        // Optimistic update for immediate UI response
        setTeachers(prev => [...prev, { ...newTeacher, id: 'temp-' + Date.now() } as TeacherUser]);
        useTeacherStore.getState().setTeacherJoinRequests(useTeacherStore.getState().teacherJoinRequests.filter(r => r.id !== pendingApproval.id));

        await saveTeacher(newTeacher as any);
        await deleteRegistrationRequest(pendingApproval.id);

        // Notify Teacher (WhatsApp)
        try {
          const msg = `🎉 أهلاً بك يا أستاذ ${newTeacher.name} في منصتنا!\n\nتم تفعيل حسابك كمعلم بنجاح.\n🔑 كود المعلم الخاص بك: ${newTeacher.code}\n📱 رقم الهاتف (اسم الدخول): ${newTeacher.username}\n🔑 كلمة المرور: ${newTeacher.password}\n\nنتمنى لك رحلة تعليمية مثمرة!`;
          const cleanPhone = cleanWhatsAppPhone(newTeacher.username || '');
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        } catch (notifErr) { console.error('WhatsApp notify error:', notifErr); }

        showToast('✅ تم تفعيل حساب المعلم بنجاح');
        setPendingApproval(null);
        void loadData(false);
    } catch (e: any) {
        showToast('❌ فشل التفعيل: ' + e.message);
    } finally {
        setSaving(false);
    }
  };

  const generateReceiptWhatsApp = () => {
    if (!receiptForm.teacherName || !receiptForm.whatsapp) {
      showToast('أكمل بيانات الإيصال المحول');
      return;
    }
    const msg = `🧾 *إيصال اشتراك منصة AN Academy*\n---\n👤 *المعلم:* ${receiptForm.teacherName}\n💰 *المبلغ:* ${receiptForm.amount} ج.م\n📅 *التاريخ:* ${receiptForm.date}\n📦 *نوع الاشتراك:* ${receiptForm.subType === 'monthly' ? 'شهري' : 'سنوي'}\n---\n✅ تم تفعيل حسابك بنجاح. يمكنك الآن الدخول للمنصة والبدء.\nنتمنى لك تجربة تعليمية ممتعة!`;
    const phone = cleanWhatsAppPhone(receiptForm.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleRejectRequest = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رفض طلب ${name}؟ سيتم حذف البيانات.`)) return;
    try {
        await deleteRegistrationRequest(id);
        showToast('تم رفض الطلب بنجاح');
        void loadData(false);
    } catch (e: any) {
        showToast('فشل حذف الطلب');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب ${name}؟`)) return;
    try {
      await deleteTeacher(id);
      showToast('تم الحذف بنجاح');
      void loadData(false);
    } catch (e: any) { 
      showToast(e.message || 'فشل الحذف'); 
    }
  };

  const handleSuspendConfirm = async () => {
    if (!suspendModal.teacher || !suspendModal.reason) {
      showToast('يرجى إدخال سبب الإيقاف');
      return;
    }
    setSaving(true);
    try {
      const t = suspendModal.teacher;
      await saveTeacher({ ...t, isActive: false, cancelReason: suspendModal.reason } as any);
      
      const msg = `⚠️ *إشعار إيقاف حساب*\n\nأهلاً أ. ${t.name}\nنؤسف إبلاغك بأنه تم إيقاف حسابك على المنصة.\n\n*السبب:* ${suspendModal.reason}\n\nيرجى التواصل مع الإدارة للمراجعة.`;
      const phone = cleanWhatsAppPhone(t.phone || t.username);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      
      showToast('تم إيقاف الحساب وإرسال رسالة واتساب');
      setSuspendModal({ isOpen: false, teacher: null, reason: '' });
      void loadData(false);
    } catch (e) {
      showToast('فشل الإيقاف');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (teacher: TeacherUser) => {
    if (!confirm(`هل أنت متأكد من تفعيل حساب ${teacher.name}؟`)) return;
    setSaving(true);
    try {
      await saveTeacher({ ...teacher, isActive: true, cancelReason: '' } as any);
      
      const msg = `🎉 *إشعار تفعيل حساب*\n\nأهلاً أ. ${teacher.name}\nنود إبلاغك بأنه تم إعادة تفعيل حسابك على المنصة بنجاح.\n\nنتمنى لك رحلة موفقة!`;
      const phone = cleanWhatsAppPhone(teacher.phone || teacher.username);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      
      showToast('تم تفعيل الحساب وإرسال رسالة واتساب');
      void loadData(false);
    } catch (e) {
      showToast('فشل التفعيل');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (adminForm.password && adminForm.password !== adminForm.confirmPassword) {
      showToast('كلمات المرور غير متطابقة'); return;
    }
    setSaving(true);
    try {
      await updateSuperAdminCredentials(currentUser.id, adminForm.username, adminForm.password || undefined);
      showToast('تم تحديث بيانات الأدمن بنجاح');
      setAdminForm({ ...adminForm, password: '', confirmPassword: '' });
    } catch (e) { showToast('فشل التحديث'); }
    finally { setSaving(false); }
  };

  const togglePermission = (id: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(id) ? f.permissions.filter(p => p !== id) : [...f.permissions, id]
    }));
  };

  return (
    <div className="space-y-8 pb-20">
      {selectedImg && <ImageModal src={selectedImg.src} alt={selectedImg.alt} onClose={() => setSelectedImg(null)} />}

      <div className="flex justify-between items-center bg-purple-500/5 p-6 rounded-2xl border border-purple-500/10">
        <div>
          <h1 className="text-2xl font-cairo font-black text-purple-400 flex items-center gap-2">
            <Shield className="text-purple-500" /> لوحة التحكم الشاملة
          </h1>
          <p className="text-sm text-gray-400 mt-1">إدارة المعلمين، الاشتراكات، والتقارير المالية للمنصة.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const url = `${window.location.origin}/teacher-register`;
            navigator.clipboard.writeText(url);
            showToast('✅ تم نسخ رابط تسجيل المعلمين');
          }} className="btn-outline border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hidden sm:flex">
            <ExternalLink size={16} /> رابط التسجيل
          </button>
          <button onClick={() => { setShowAddForm(true); setEditingTeacher(null); }} className="btn-gold bg-purple-500 hover:bg-purple-600 shadow-purple-500/20">
            <UserPlus size={16} /> إضافة حساب
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue.toLocaleString()} ج.م`, icon: <DollarSign size={22} className="text-purple-400"/>, bg: 'from-purple-500/10 to-indigo-500/5 border-purple-500/20' },
          { label: 'معلمون نشطون', value: stats.active, icon: <Users size={22} className="text-green-400"/>, bg: 'from-green-500/10 to-emerald-500/5 border-green-500/20' },
          { label: 'ينتهي قريباً', value: stats.expiringCount, icon: <Bell size={22} className="text-orange-400"/>, bg: 'from-orange-500/10 to-red-500/5 border-orange-500/20' },
          { label: 'حسابات منتهية', value: stats.expired, icon: <UserX size={22} className="text-red-400"/>, bg: 'from-red-500/10 to-rose-500/5 border-red-500/20' },
        ].map((s, i) => (
          <div key={i} className={`card-base p-4 flex items-center gap-3 bg-gradient-to-br ${s.bg} border`}>
            <div className="p-2.5 bg-white/5 rounded-xl flex-shrink-0">{s.icon}</div>
            <div className="min-w-0">
              <div className="text-xl font-black truncate">{s.value}</div>
              <div className="text-xs text-gray-400 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
        {(['current', 'expiring', 'pending', 'assistants', 'financials'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${
              activeTab === tab ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'current' && `المعلمون (${teachers.length})`}
            {tab === 'expiring' && `قريباً ${stats.expiringCount > 0 ? `(${stats.expiringCount})` : ''}`}
            {tab === 'pending' && `الطلبات ${teacherJoinRequests.length > 0 ? `(${teacherJoinRequests.length})` : ''}`}
            {tab === 'assistants' && `المساعدون (${assistants.length})`}
            {tab === 'financials' && `التقارير`}
           </button>
         ))}
       </div>

      {activeTab === 'pending' && (
        <div className="animate-fade-in space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherJoinRequests.length === 0 ? (
                <p className="col-span-3 text-center py-10 text-gray-500">لا توجد طلبات انضمام حالياً</p>
              ) : (
                teacherJoinRequests.map((req) => (
                    <div key={req.id} className="card-base p-5 border border-purple-500/20 bg-purple-500/5 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-purple-500" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                {req.imageUrl ? (
                                    <img loading="lazy" src={req.imageUrl} alt={req.name} className="w-12 h-12 rounded-2xl object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-lg font-bold text-purple-400">{req.name[0]}</div>
                                )}
                                <div>
                                    <h3 className="font-bold text-white truncate max-w-[120px]">{req.name}</h3>
                                    <div className="text-[10px] text-gray-400 font-mono">{req.phone}</div>
                                </div>
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-[10px] font-black">{req.subType === 'yearly' ? 'سنوي' : 'شهري'}</span>
                        </div>
                        <div className="space-y-1 text-xs mb-4">
                             <div className="flex justify-between opacity-60"><span>المادة:</span> <span className="text-white font-bold">{req.subject || '—'}</span></div>
                             <div className="flex justify-between opacity-60"><span>التاريخ:</span> <span>{new Date(req.createdAt).toLocaleDateString('ar-EG')}</span></div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => handleApproveRequest(req)} disabled={saving} className="flex-1 py-2 rounded-xl bg-purple-500 text-white text-xs font-black hover:bg-purple-600 transition disabled:opacity-50">تفعيل</button>
                             <button 
                               onClick={() => {
                                 const cleanPhone = cleanWhatsAppPhone(req.phone);
                                 const msg = encodeURIComponent(`مرحباً أ. ${req.name}، بخصوص طلب انضمامك كمعلم لمنصة AN Academy...`);
                                 window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                               }}
                               className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 border border-green-500/20 flex items-center justify-center hover:bg-green-500 hover:text-white transition"
                               title="تواصل عبر واتساب"
                             >
                               <Phone size={16} />
                             </button>
                             <button onClick={() => handleRejectRequest(req.id, req.name)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition group"><XCircle size={18} /></button>
                        </div>
                    </div>
                ))
              )}
             </div>
        </div>
      )}

      {activeTab === 'assistants' && (
        <div className="animate-fade-in space-y-6">
          {/* Pending Assistants Section */}
          <div className="space-y-3">
            <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
              <Clock size={18} /> طلبات انضمام المساعدين المعلقة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assistants.filter(a => a.status === 'pending').length === 0 ? (
                <p className="col-span-3 text-center py-6 text-gray-500 text-sm">لا توجد طلبات معلقة لمساعدين حالياً</p>
              ) : (
                assistants.filter(a => a.status === 'pending').map((ast) => (
                  <div key={ast.id} className="card-base p-5 border border-amber-500/20 bg-amber-500/5 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {ast.imageUrl ? (
                          <img loading="lazy" src={ast.imageUrl} alt={ast.name} className="w-12 h-12 rounded-2xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-lg font-bold text-amber-400">{ast.name[0]}</div>
                        )}
                        <div>
                          <h3 className="font-bold text-white truncate max-w-[140px]">{ast.name}</h3>
                          <div className="text-[10px] text-gray-400 font-mono">{ast.phone}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs mb-4">
                      <div className="flex justify-between opacity-60"><span>التخصص:</span> <span className="text-white font-bold">{ast.roleTitle || 'مساعد مادة'}</span></div>
                      <div className="flex justify-between opacity-60"><span>اسم المستخدم:</span> <span className="font-mono text-white">@{ast.username}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          if (!confirm(`هل توافق على تفعيل حساب المساعد ${ast.name}؟`)) return;
                          setSaving(true);
                          try {
                            await saveAssistantProfile({ ...ast, status: 'approved' });
                            showToast('✅ تم تفعيل حساب المساعد');
                            void loadData(false);
                          } catch (e) { showToast('فشل تفعيل الحساب'); }
                          finally { setSaving(false); }
                        }} 
                        disabled={saving} 
                        className="flex-1 py-2 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-600 transition disabled:opacity-50"
                      >
                        تفعيل
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm(`هل أنت متأكد من رفض وحذف طلب المساعد ${ast.name}؟`)) return;
                          setSaving(true);
                          try {
                            const { error } = await supabase.from(ASSISTANTS_PROFILES).delete().eq('id', ast.id);
                            if (error) throw error;
                            showToast('✅ تم حذف الطلب بنجاح');
                            void loadData(false);
                          } catch (e) { showToast('فشل رفض الطلب'); }
                          finally { setSaving(false); }
                        }} 
                        disabled={saving}
                        className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Approved Assistants Section */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h3 className="text-base font-black text-green-400 flex items-center gap-2">
              <Users size={18} /> المساعدون المعتمدون في المنصة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assistants.filter(a => a.status === 'approved').length === 0 ? (
                <p className="col-span-3 text-center py-6 text-gray-500 text-sm">لا يوجد مساعدون معتمدون حالياً</p>
              ) : (
                assistants.filter(a => a.status === 'approved').map((ast) => (
                  <div key={ast.id} className="card-base p-5 border border-white/5 bg-white/5 relative group overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {ast.imageUrl ? (
                          <img loading="lazy" src={ast.imageUrl} alt={ast.name} className="w-12 h-12 rounded-2xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-lg font-bold text-amber-400">{ast.name[0]}</div>
                        )}
                        <div>
                          <h3 className="font-bold text-white truncate max-w-[140px]">{ast.name}</h3>
                          <div className="text-[10px] text-gray-500 font-mono">{ast.phone}</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-[10px] font-black">{ast.code}</span>
                    </div>
                    <div className="space-y-1 text-xs mb-4">
                      <div className="flex justify-between opacity-60"><span>التخصص:</span> <span className="text-white font-bold">{ast.roleTitle || 'مساعد مادة'}</span></div>
                      <div className="flex justify-between opacity-60"><span>اسم المستخدم:</span> <span className="font-mono text-white">@{ast.username}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          if (!confirm(`هل أنت متأكد من حذف حساب المساعد ${ast.name} نهائياً؟ سيتم إلغاء تعاقداته مع جميع المعلمين.`)) return;
                          setSaving(true);
                          try {
                            await supabase.from('teacher_assistant_links').delete().eq('assistant_id', ast.id);
                            const { error } = await supabase.from(ASSISTANTS_PROFILES).delete().eq('id', ast.id);
                            if (error) throw error;
                            showToast('✅ تم حذف المساعد بنجاح');
                            void loadData(false);
                          } catch (e) { showToast('فشل حذف حساب المساعد'); }
                          finally { setSaving(false); }
                        }} 
                        disabled={saving}
                        className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Trash2 size={14} /> حذف المساعد نهائياً
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'current' || activeTab === 'expiring') && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users size={18} className="text-gray-400" /> {activeTab === 'expiring' ? 'الاشتراكات المنتهية قريباً' : 'قائمة المعلمين'}
            </h3>
            <div className="relative max-w-md w-full">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
               <input type="search" placeholder="ابحث بالاسم أو الموبايل..." className="input-base w-full pl-10 text-sm" value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="card-base p-5 h-48 animate-pulse bg-white/5" />)
            ) : filteredTeachers.length === 0 ? (
              <p className="col-span-3 text-center py-16 text-gray-500">لا يوجد معلمون في هذا القسم</p>
            ) : (
              filteredTeachers.map((t) => {
                const days = t.subExpiry ? Math.ceil((t.subExpiry - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const isExpired = t.role !== 'super_admin' && t.subType !== 'free' && days !== null && days < 0;
                const isExpiring = t.role !== 'super_admin' && t.subType !== 'free' && days !== null && days >= 0 && days <= 7;
                return (
                  <div key={t.id} onClick={() => {
                      setEditingTeacher(t);
                      setForm({
                        name: t.name, username: t.username, password: '', code: t.code || '', role: t.role === 'super_admin' ? 'super_admin' : 'teacher',
                        permissions: t.permissions || AVAILABLE_PERMISSIONS.map(p => p.id),
                        subType: t.subType || 'free', subExpiry: t.subExpiry || null, subLink: t.subLink || '', 
                        subPrice: t.subPrice || 0, imageUrl: t.imageUrl || '', subject: t.subject || '', phone: t.phone || ''
                      });
                      setShowAddForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`card-base p-5 border transition-all cursor-pointer relative overflow-hidden group ${isExpired ? 'border-red-500/30' : isExpiring ? 'border-orange-500/30' : 'border-white/5 hover:border-purple-500/40'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {t.imageUrl ? <img loading="lazy" src={t.imageUrl} className="w-12 h-12 rounded-2xl object-cover" /> : <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center font-bold text-purple-400">{t.name[0]}</div>}
                        <div>
                          <h3 className="font-bold text-white truncate max-w-[120px]">{t.name}</h3>
                          <div className="text-[10px] text-gray-500 font-mono">@{t.username}</div>
                        </div>
                      </div>
                    </div>
                    {t.role !== 'super_admin' && (
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs opacity-60"><span>الباقة:</span> <span className="text-purple-400 font-bold">{t.subType === 'free' ? 'مجاني' : t.subType === 'monthly' ? 'شهري' : 'سنوي'}</span></div>
                        <div className="flex justify-between text-xs opacity-60"><span>المدفوع:</span> <span className="text-emerald-400 font-bold">{t.totalPaid || 0} ج.م</span></div>
                        <div className="pt-2">
                           <div className="flex justify-between text-[10px] mb-1">
                              <span className={!t.isActive ? 'text-red-500 font-black' : isExpired ? 'text-red-400' : isExpiring ? 'text-orange-400' : 'text-gray-500'}>
                                {!t.isActive ? 'موقوف إدارياً' : isExpired ? 'محظور (انتهى)' : isExpiring ? `ينتهي خلال ${days} يوم` : t.subType === 'free' ? 'صلاحية مفتوحة' : `يتبقى ${days} يوم`}
                              </span>
                           </div>
                           <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full transition-all ${isExpired ? 'bg-red-500' : isExpiring ? 'bg-orange-500' : 'bg-purple-500'}`} style={{ width: t.subType === 'free' ? '100%' : `${Math.max(5, Math.min(100, ((days || 0) / 30) * 100))}%` }} />
                           </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-white/5 flex-wrap">
                      <button className="flex-1 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold hover:bg-purple-500 hover:text-white transition">تعديل</button>
                      <button onClick={(e) => { e.stopPropagation(); setLedgerTeacher(t); }} className="flex-1 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold hover:bg-blue-600 hover:text-white transition">الحسابات</button>
                      {t.role !== 'super_admin' && (
                        t.isActive ? (
                           <button onClick={(e) => { e.stopPropagation(); setSuspendModal({ isOpen: true, teacher: t, reason: '' }); }} className="flex-1 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-bold hover:bg-orange-600 hover:text-white transition">إيقاف</button>
                        ) : (
                           <button onClick={(e) => { e.stopPropagation(); handleActivate(t); }} className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition">تفعيل</button>
                        )
                      )}
                      {(isExpired || isExpiring) && <button onClick={(e) => { e.stopPropagation(); sendTeacherReminder(t); }} className="flex-1 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-bold hover:bg-green-600 hover:text-white transition flex items-center justify-center gap-1"><Send size={10} /> تذكير</button>}
                      {t.role !== 'super_admin' && <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition"><Trash2 size={12} /></button>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="animate-fade-in">
          <FinancialReports data={teachers.filter(t => t.role !== 'super_admin')} type="teachers" title="تقارير المنصة المالية" />
        </div>
      )}

      {/* Add/Edit Form Overlay */}
      {(showAddForm || editingTeacher) && (
        <div className="modal-overlay" >
           <form 
              onSubmit={handleSubmit} 
              className="modal-content modal-content-lg border-purple-500/30" 
              onClick={e => e.stopPropagation()}
           >
              {/* Header */}
              <div className="modal-header bg-gradient-to-r from-purple-500/10 to-transparent">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                       {editingTeacher ? <Edit2 size={20} /> : <UserPlus size={20} />}
                    </div>
                    <div>
                       <h2 className="text-xl font-bold font-cairo text-white">
                          {editingTeacher ? 'تعديل بيانات المعلم' : 'إضافة حساب معلم جديد'}
                       </h2>
                       <p className="text-[11px] text-gray-500 mt-0.5">يرجى ملء البيانات بدقة لضمان عمل الحساب بشكل صحيح.</p>
                    </div>
                 </div>
                 <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} className="p-2 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white"><X size={24}/></button>
              </div>

              {/* Body */}
              <div className="modal-body space-y-8 scrollbar-thin">
                 {/* Basic Info Section */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                       <User size={16} className="text-purple-400" />
                       <h3 className="text-sm font-bold text-gray-300">البيانات الأساسية</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">الاسم الكامل</label>
                          <input type="text" className="input-base" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="أدخل اسم المعلم الثلاثي..."/>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">المادة الدراسية</label>
                          <input type="text" className="input-base" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="مثال: اللغة العربية"/>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">كود المعلم (اختياري)</label>
                          <input type="text" className="input-base" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="كود تعريفي خاص..."/>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">نوع الكيان</label>
                          <select className="input-base" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                             <option value="teacher">معلم</option>
                             <option value="super_admin">أدمن المنصة (صلاحية كاملة)</option>
                          </select>
                       </div>
                    </div>
                 </div>

                 {/* Account Section */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                       <Lock size={16} className="text-purple-400" />
                       <h3 className="text-sm font-bold text-gray-300">بيانات الحساب والدخول</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">اسم المستخدم (رقم الموبايل)</label>
                          <input type="text" className="input-base" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required placeholder="01xxxxxxxxx"/>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[11px] text-gray-400 font-bold px-1">
                             كلمة المرور {editingTeacher && <span className="text-orange-400 font-bold">(اتركه فارغاً للحفاظ على الحالية)</span>}
                          </label>
                          <input type="text" className="input-base" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editingTeacher} placeholder="كلمة مرور قوية..."/>
                       </div>
                    </div>
                 </div>

                 {/* Subscription Section */}
                 {form.role === 'teacher' && (
                    <div className="space-y-4 bg-purple-500/5 p-5 rounded-2xl border border-purple-500/10">
                       <div className="flex items-center gap-2 pb-2 border-b border-purple-500/10">
                          <CreditCard size={16} className="text-purple-400" />
                          <h3 className="text-sm font-bold text-purple-400">إدارة الاشتراك المالي</h3>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                             <label className="text-[11px] text-gray-400 font-bold">باقة الاشتراك</label>
                             <select className="input-base" value={form.subType} onChange={e => setForm({...form, subType: e.target.value as any})}>
                                <option value="free">باقة مجانية (Free)</option>
                                <option value="monthly">اشتراك شهري</option>
                                <option value="yearly">اشتراك سنوي</option>
                             </select>
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[11px] text-gray-400 font-bold">تاريخ انتهاء الاشتراك</label>
                             <input type="date" className="input-base" value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} onChange={e => setForm({...form, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null})} />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                             <label className="text-[11px] text-gray-400 font-bold">رابط الدفع المخصص (لتحصيل الاشتراكات من طلابه)</label>
                             <input type="text" className="input-base" value={form.subLink} onChange={e => setForm({...form, subLink: e.target.value})} placeholder="https://..." />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[11px] text-gray-400 font-bold">تكلفة الباقة (ج.م)</label>
                             <input type="number" className="input-base" value={form.subPrice} onChange={e => setForm({...form, subPrice: parseFloat(e.target.value) || 0})} />
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Permissions Section */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                       <Shield size={16} className="text-purple-400" />
                       <h3 className="text-sm font-bold text-gray-300">الصلاحيات الممنوحة للمعلم</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                       {AVAILABLE_PERMISSIONS.map(p => (
                          <button key={p.id} type="button" onClick={() => togglePermission(p.id)} 
                             className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 transition-all ${
                                form.permissions.includes(p.id) 
                                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-lg shadow-purple-500/5' 
                                : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                             }`}>
                             <p.icon size={14} className={form.permissions.includes(p.id) ? 'text-purple-400' : 'text-gray-600'} /> 
                             {p.label}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Footer */}
              <div className="modal-footer bg-black/40 backdrop-blur-md">
                 <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} 
                    className="flex-1 btn-outline h-12 justify-center">إلغاء</button>
                 <button type="submit" disabled={submitting} 
                    className="flex-[2] btn-gold bg-purple-600 hover:bg-purple-700 h-12 justify-center text-lg relative overflow-hidden group">
                    {submitting ? (
                       <div className="flex items-center gap-2">
                          <RefreshCw size={18} className="animate-spin" />
                          <span>جاري الحفظ...</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-2">
                          <CheckCircle2 size={18} />
                          <span>حفظ البيانات</span>
                       </div>
                    )}
                 </button>
              </div>
           </form>
        </div>
      )}
      {/* Custom Teacher Activation Modal */}
      {pendingApproval && (
        <div className="modal-overlay" >
          <div className="modal-content modal-content-lg !p-0 border border-purple-500/20 bg-[#0d1527] animate-scale-in" dir="rtl">
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-purple-500/5">
                <div className="min-w-0">
                    <h3 className="text-xl font-black font-cairo text-purple-400 truncate">تفعيل حساب المعلم</h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{pendingApproval.name}</p>
                </div>
                <button 
                    onClick={() => setPendingApproval(null)} 
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-90"
                >
                    <X size={20}/>
                </button>
            </div>
            
            {/* Body */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[75vh] scrollbar-thin">
                {/* Section 1: Profile Summary */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-xs text-purple-400 font-bold uppercase tracking-wider">الملف الشخصي للطلب</h4>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex gap-3 items-center">
                            {pendingApproval.imageUrl ? (
                                <img loading="lazy" src={pendingApproval.imageUrl} alt={pendingApproval.name} className="w-14 h-14 rounded-2xl object-cover border border-purple-500/30" />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center text-xl font-bold text-purple-400">{pendingApproval.name[0]}</div>
                            )}
                            <div>
                                <h4 className="font-bold text-white text-base">{pendingApproval.name}</h4>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{pendingApproval.phone}</p>
                                <p className="text-xs text-gray-400 mt-1">تاريخ الطلب: {new Date(pendingApproval.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 self-stretch sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                            <div className="text-xs text-gray-400"><span className="opacity-60">المادة المطلوبة:</span> <span className="text-white font-bold">{pendingApproval.subject || '—'}</span></div>
                            <div className="text-xs text-gray-400"><span className="opacity-60">الباقة المطلوبة:</span> <span className="text-purple-400 font-black">{pendingApproval.subType === 'yearly' ? 'سنوي' : 'شهري'}</span></div>
                        </div>
                    </div>

                    {/* Receipt & Payment Verification */}
                    {(pendingApproval.paymentRef || pendingApproval.receiptUrl) && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                            <h5 className="text-xs font-bold text-gray-300">تفاصيل الدفع والمرفقات:</h5>
                            {pendingApproval.paymentRef && (
                                <div className="p-3 bg-black/30 rounded-xl border border-white/5 text-xs text-gray-300">
                                    <span className="block text-[10px] text-gray-500 font-bold mb-1">مرجع التحويل / ملاحظات:</span>
                                    <span className="font-medium whitespace-pre-wrap">{pendingApproval.paymentRef}</span>
                                </div>
                            )}
                            {pendingApproval.receiptUrl && (
                                <button 
                                  onClick={() => setSelectedImg({ src: pendingApproval.receiptUrl, alt: `إيصال دفع - ${pendingApproval.name}` })} 
                                  className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                                >
                                  <FileText size={14} /> عرض صورة إيصال الدفع المرفقة
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Section 2: Onboarding Credentials */}
                <div className="space-y-4">
                    <h4 className="text-xs text-purple-400 font-bold uppercase tracking-wider">بيانات الدخول والاعتماد</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">اسم المعلم المعتمد</label>
                            <input 
                                type="text" 
                                className="input-base text-sm" 
                                value={approvalForm.name} 
                                onChange={e => setApprovalForm({ ...approvalForm, name: e.target.value })} 
                                placeholder="الاسم الكامل للمعلم"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">المادة الدراسية</label>
                            <input 
                                type="text" 
                                className="input-base text-sm" 
                                value={approvalForm.subject} 
                                onChange={e => setApprovalForm({ ...approvalForm, subject: e.target.value })} 
                                placeholder="المادة الدراسية"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">كود المعلم الموحد</label>
                            <input 
                                type="text" 
                                className="input-base text-sm font-mono text-purple-300 font-bold" 
                                value={approvalForm.code} 
                                onChange={e => setApprovalForm({ ...approvalForm, code: e.target.value.toUpperCase() })} 
                                placeholder="كود فريد للدخول"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">كلمة المرور المؤقتة</label>
                            <input 
                                type="text" 
                                className="input-base text-sm font-mono" 
                                value={approvalForm.password} 
                                onChange={e => setApprovalForm({ ...approvalForm, password: e.target.value })} 
                                placeholder="كلمة المرور المؤقتة"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Subscription & Plan Customization */}
                <div className="space-y-4 bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10">
                    <h4 className="text-xs text-purple-400 font-bold uppercase tracking-wider">تخصيص فترة وقيمة الاشتراك</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">باقة الاشتراك</label>
                            <select 
                                className="input-base text-sm font-bold" 
                                value={approvalForm.subType} 
                                onChange={e => handleApprovalTypeChange(e.target.value as any)}
                            >
                                <option value="monthly">شهري</option>
                                <option value="yearly">سنوي</option>
                                <option value="free">مجاني (دائم)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">سعر الباقة المخصص (ج.م)</label>
                            <input 
                                type="number" 
                                className="input-base text-sm font-bold text-purple-300" 
                                value={approvalForm.subPrice} 
                                onChange={e => setApprovalForm({ ...approvalForm, subPrice: parseFloat(e.target.value) || 0 })} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-bold px-1">هاتف الدخول المعتمد</label>
                            <input 
                                type="text" 
                                className="input-base text-sm" 
                                value={approvalForm.phone} 
                                onChange={e => setApprovalForm({ ...approvalForm, phone: e.target.value })} 
                                required
                            />
                        </div>
                    </div>

                    {approvalForm.subType !== 'free' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-gray-400 font-bold px-1">تاريخ بداية الاشتراك</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    <input 
                                        type="date" 
                                        className="input-base w-full text-sm pl-10" 
                                        value={approvalForm.subStart} 
                                        onChange={e => handleApprovalStartChange(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-gray-400 font-bold px-1">تاريخ انتهاء الاشتراك</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    <input 
                                        type="date" 
                                        className="input-base w-full text-sm pl-10 font-bold text-purple-300" 
                                        value={approvalForm.subExpiry} 
                                        onChange={e => setApprovalForm({ ...approvalForm, subExpiry: e.target.value })} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-5 sm:p-6 border-t border-white/5 bg-white/[0.02] flex gap-3">
              <button 
                onClick={() => setPendingApproval(null)} 
                className="btn-outline flex-1 h-12 text-sm justify-center border-white/10 text-gray-400 hover:text-white"
              >
                رجوع
              </button>
              <button 
                onClick={finalApprove} 
                disabled={saving} 
                className="btn-gold bg-purple-600 hover:bg-purple-700 flex-1 h-12 text-sm justify-center shadow-lg active:translate-y-0.5 transition-all text-white border-none"
              >
                {saving ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري التفعيل...</span>
                    </div>
                ) : 'تأكيد وتفعيل الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Generator Section */}
      <div className="card-base p-6 bg-blue-500/5 border border-blue-500/20">
         <h2 className="text-xl font-bold font-cairo flex items-center gap-2 text-white mb-4"><Printer className="text-blue-400" /> إرسال إيصال اشتراك (WhatsApp)</h2>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input type="text" placeholder="اسم المعلم" className="input-base" value={receiptForm.teacherName} onChange={e => setReceiptForm({...receiptForm, teacherName: e.target.value})}/>
            <input type="text" placeholder="موبايل الواتساب" className="input-base" value={receiptForm.whatsapp} onChange={e => setReceiptForm({...receiptForm, whatsapp: e.target.value})}/>
            <input type="number" placeholder="المبلغ ج.م" className="input-base" value={receiptForm.amount || ''} onChange={e => setReceiptForm({...receiptForm, amount: parseFloat(e.target.value) || 0})}/>
            <select className="input-base" value={receiptForm.subType} onChange={e => setReceiptForm({...receiptForm, subType: e.target.value})}>
               <option value="monthly">شهري</option>
               <option value="yearly">سنوي</option>
            </select>
            <button onClick={generateReceiptWhatsApp} className="btn-gold bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 lg:col-span-2 h-12"><Send size={18} /> إنشاء وإرسال الإيصال</button>
         </div>
      </div>

      {/* Super Admin Settings Section */}
      <div className="card-base p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
         <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white"><Lock size={20} /></div>
            <div><h3 className="text-xl font-bold font-cairo">بيانات الأمان (Super Admin)</h3><p className="text-sm text-gray-500">تغيير بيانات الدخول الرئيسية للمنصة.</p></div>
         </div>
         <form onSubmit={handleUpdateAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" className="input-base" value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} placeholder="اسم مستخدم جديد" required />
            <input type="password" className="input-base" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} placeholder="كلمة سر جديدة" />
            <input type="password" className="input-base" value={adminForm.confirmPassword} onChange={e => setAdminForm({...adminForm, confirmPassword: e.target.value})} placeholder="تأكيد كلمة السر" />
            <button type="submit" disabled={saving} className="btn-gold bg-purple-600 hover:bg-purple-700 md:col-span-3 h-12 flex items-center justify-center gap-2">{saving ? 'جاري التحديث...' : 'تحديث بيانات الدخول'}</button>
         </form>
       </div>

      {ledgerTeacher && (
        <TeacherLedgerModal 
          teacher={ledgerTeacher} 
          onClose={() => setLedgerTeacher(null)} 
          onUpdate={(updatedTeacher) => {
            setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
            setLedgerTeacher(updatedTeacher);
          }}
        />
      )}

      {suspendModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-sm">
            <div className="modal-header">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertCircle className="text-orange-400" /> إيقاف حساب معلم
              </h2>
              <button onClick={() => setSuspendModal({ isOpen: false, teacher: null, reason: '' })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-gray-300">أدخل سبب الإيقاف لإرساله عبر الواتساب إلى {suspendModal.teacher?.name}:</p>
              <textarea 
                className="input-base w-full h-24 resize-none" 
                placeholder="مثال: انتهاء فترة السماح للاشتراك المتأخر..."
                value={suspendModal.reason}
                onChange={e => setSuspendModal({...suspendModal, reason: e.target.value})}
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSuspendConfirm}
                  disabled={saving || !suspendModal.reason}
                  className="btn-gold w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'جاري التنفيذ...' : 'تأكيد الإيقاف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components (Search, etc.)
function Search({ size, className }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
