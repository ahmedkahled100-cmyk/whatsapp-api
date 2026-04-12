'use client';
// src/app/admin/teachers/page.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTeachers, saveTeacher, deleteTeacher, updateSuperAdminCredentials, getSuperAdmin, getSettings, deleteRegistrationRequest, dispatchNotification } from '@/lib/db';
import { TeacherUser, Settings as PlatformSettings } from '@/types';
import { showToast } from '@/lib/toast';
import { UserPlus, Shield, User, Clock, Edit2, Trash2, X, Save, Lock, LayoutDashboard, Bell, FileText, Users, CreditCard, BookMarked, ClipboardList, Calendar, Bot, BarChart2, Check, ExternalLink, CheckCircle2, XCircle, Printer, Send, TrendingUp, DollarSign, UserX, ArrowRight, RefreshCw } from 'lucide-react';
import { useTeacherStore } from '@/lib/store';
import { ImageModal } from '@/components/ImageModal';
import { cleanWhatsAppPhone } from '@/lib/utils';
import { FinancialReports } from '@/components/FinancialReports';

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'pending' | 'expiring' | 'financials'>('current');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherUser | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Image Modal state
  const [selectedImg, setSelectedImg] = useState<{ src: string, alt: string } | null>(null);

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
    subject: ''
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
      const [teachersList, admin] = await Promise.all([getTeachers(), getSuperAdmin()]);
      setTeachers(teachersList);

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
      showToast(editingTeacher ? 'تم تحديث الحساب' : 'تمت إضافة الحساب بنجاح');
      setShowAddForm(false);
      setEditingTeacher(null);
      setForm({
        name: '', username: '', password: '', code: '', role: 'teacher',
        permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
        subType: 'free', subExpiry: null, subLink: '', subPrice: 0, imageUrl: '', subject: ''
      });
      void loadData(false);
    } catch (err) {
      showToast('حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleApproveRequest = async (req: any) => {
    if (!confirm(`هل أنت متأكد من الموافقة على انضمام ${req.name}؟`)) return;
    setSaving(true);
    try {
        const newTeacher: Partial<TeacherUser> = {
            name: req.name,
            username: req.phone,
            password: Math.random().toString(36).slice(-8),
            code: Math.random().toString(36).toUpperCase().slice(-6),
            role: 'teacher',
            isActive: true,
            createdAt: Date.now(),
            subType: req.subType || 'monthly',
            subExpiry: Date.now() + (req.subType === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000,
            imageUrl: req.imageUrl || '',
            subject: req.subject || ''
        };
        await saveTeacher(newTeacher as any);
        await deleteRegistrationRequest(req.id);
        showToast('✅ تم تفعيل حساب المعلم بنجاح');
        void loadData(false);
    } catch (e: any) {
        showToast(e.message || 'فشل تفعيل الحساب');
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
        {(['current', 'expiring', 'pending', 'financials'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${
              activeTab === tab ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'current' && `المعلمون (${teachers.length})`}
            {tab === 'expiring' && `قريباً ${stats.expiringCount > 0 ? `(${stats.expiringCount})` : ''}`}
            {tab === 'pending' && `الطلبات ${teacherJoinRequests.length > 0 ? `(${teacherJoinRequests.length})` : ''}`}
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
                                    <img src={req.imageUrl} alt={req.name} className="w-12 h-12 rounded-2xl object-cover" />
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
                             <button onClick={() => handleRejectRequest(req.id, req.name)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition group"><XCircle size={18} /></button>
                        </div>
                    </div>
                ))
              )}
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
                        name: t.name, username: t.username, password: '', code: t.code || '', role: t.role,
                        permissions: t.permissions || AVAILABLE_PERMISSIONS.map(p => p.id),
                        subType: t.subType || 'free', subExpiry: t.subExpiry || null, subLink: t.subLink || '', 
                        subPrice: t.subPrice || 0, imageUrl: t.imageUrl || '', subject: t.subject || ''
                      });
                      setShowAddForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`card-base p-5 border transition-all cursor-pointer relative overflow-hidden group ${isExpired ? 'border-red-500/30' : isExpiring ? 'border-orange-500/30' : 'border-white/5 hover:border-purple-500/40'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {t.imageUrl ? <img src={t.imageUrl} className="w-12 h-12 rounded-2xl object-cover" /> : <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center font-bold text-purple-400">{t.name[0]}</div>}
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
                              <span className={isExpired ? 'text-red-400' : isExpiring ? 'text-orange-400' : 'text-gray-500'}>
                                {isExpired ? 'محظور (انتهى)' : isExpiring ? `ينتهي خلال ${days} يوم` : t.subType === 'free' ? 'صلاحية مفتوحة' : `يتبقى ${days} يوم`}
                              </span>
                           </div>
                           <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full transition-all ${isExpired ? 'bg-red-500' : isExpiring ? 'bg-orange-500' : 'bg-purple-500'}`} style={{ width: t.subType === 'free' ? '100%' : `${Math.max(5, Math.min(100, ((days || 0) / 30) * 100))}%` }} />
                           </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button className="flex-1 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold hover:bg-purple-500 hover:text-white transition">تعديل</button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={(e) => { if(e.target === e.currentTarget) { setShowAddForm(false); setEditingTeacher(null); } }}>
           <form onSubmit={handleSubmit} className="card-base w-full max-w-2xl max-h-[90vh] overflow-y-auto border-purple-500/30 animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 bg-black/90 p-6 border-b border-white/5 flex items-center justify-between">
                 <h2 className="text-xl font-bold font-cairo flex items-center gap-2">
                    {editingTeacher ? <Edit2 className="text-purple-400" /> : <UserPlus className="text-purple-400" />}
                    {editingTeacher ? 'تعديل بيانات المعلم' : 'إضافة حساب معلم جديد'}
                 </h2>
                 <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={24}/></button>
              </div>
              <div className="p-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">الاسم الكامل</label>
                       <input type="text" className="input-base w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">المادة</label>
                       <input type="text" className="input-base w-full" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">اسم المستخدم</label>
                       <input type="text" className="input-base w-full" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">كلمة المرور {editingTeacher && '(فارغ للحفاظ على الحالية)'}</label>
                       <input type="text" className="input-base w-full" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editingTeacher}/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">كود المعلم</label>
                       <input type="text" className="input-base w-full" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-500 font-bold px-1">نوع الكيان</label>
                       <select className="input-base w-full" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                          <option value="teacher">معلم</option>
                          <option value="super_admin">أدمن المنصة (صلاحية كاملة)</option>
                       </select>
                    </div>
                 </div>

                 {form.role === 'teacher' && (
                    <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10 space-y-4">
                       <h3 className="text-sm font-bold text-purple-400">بيانات الاشتراك المالي</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <label className="text-[10px] text-gray-500">الباقة</label>
                             <select className="input-base w-full" value={form.subType} onChange={e => setForm({...form, subType: e.target.value as any})}>
                                <option value="free">مجاني</option>
                                <option value="monthly">شهري</option>
                                <option value="yearly">سنوي</option>
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] text-gray-500">تاريخ الانتهاء</label>
                             <input type="date" className="input-base w-full" value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} onChange={e => setForm({...form, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null})} />
                          </div>
                          <div className="col-span-2 space-y-1">
                             <label className="text-[10px] text-gray-500">رابط الدفع الخاص به</label>
                             <input type="text" className="input-base w-full" value={form.subLink} onChange={e => setForm({...form, subLink: e.target.value})} placeholder="https://..." />
                          </div>
                          <div className="col-span-1 space-y-1">
                             <label className="text-[10px] text-gray-500">تكلفة الباقة (ج.م)</label>
                             <input type="number" className="input-base w-full" value={form.subPrice} onChange={e => setForm({...form, subPrice: parseFloat(e.target.value) || 0})} />
                          </div>
                       </div>
                    </div>
                 )}

                 <div className="space-y-3">
                    <label className="text-xs text-gray-500 font-bold px-1">الصلاحيات الممنوحة</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                       {AVAILABLE_PERMISSIONS.map(p => (
                          <button key={p.id} type="button" onClick={() => togglePermission(p.id)} className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-2 transition ${form.permissions.includes(p.id) ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/5 text-gray-600'}`}>
                             <p.icon size={12} /> {p.label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex gap-3 pt-4 sticky bottom-0 bg-black/90 py-4 border-t border-white/5">
                    <button type="submit" disabled={submitting} className="flex-[2] btn-gold bg-purple-600 hover:bg-purple-700 py-3 text-lg">{submitting ? 'جاري الحفظ...' : 'حفظ البيانات'}</button>
                    <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} className="flex-1 btn-outline border-white/10 hover:bg-white/5">إلغاء</button>
                 </div>
              </div>
           </form>
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
    </div>
  );
}

// Helper components (Search, etc.)
function Search({ size, className }: { size?: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
