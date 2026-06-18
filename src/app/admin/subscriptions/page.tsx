'use client';
// src/app/admin/subscriptions/page.tsx

import { useState, useEffect, useMemo } from 'react';
import { getTeachers, getAllStudents, saveTeacher, saveStudent, getRegistrationRequests, deleteRegistrationRequest, dispatchNotification } from '@/lib/db';
import type { TeacherUser, Student, RegistrationRequest } from '@/types';
import { CreditCard, Users, Search, Bell, TrendingUp, DollarSign, Edit2, Save, X, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Calendar, RotateCcw, Phone, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { useFilePreview } from '@/components/FilePreviewModal';
import { FinancialReports } from '@/components/FinancialReports';
import { getSettings } from '@/lib/db';
import type { Settings } from '@/types';

const daysUntil = (ts: number | null | undefined) => {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
};

const subLabel = (type: string) => {
  const m: Record<string, string> = { free: 'مجاني', monthly: 'شهري', yearly: 'سنوي' };
  return m[type] || type || '—';
};

export default function AdminSubscriptionsPage() {
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherRenewalRequests, setTeacherRenewalRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teachers' | 'students' | 'renewals' | 'financials'>('teachers');
  const [search, setSearch] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<TeacherUser | null>(null);
  const [editForm, setEditForm] = useState({ subType: 'free', subExpiry: '', subPrice: '', subLink: '', logPayment: false });
  const [saving, setSaving] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<Settings | null>(null);

  const { openPreview, PreviewModal } = useFilePreview();

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, sList, adminSettings] = await Promise.all([
        getTeachers(), 
        getAllStudents(),
        getSettings('admin') // Admin settings typically stored under 'admin' ID
      ]);
      setTeachers(tList);
      setStudents(sList);
      setPlatformSettings(adminSettings);

      // Load all teacher renewal requests across all teachers
      const allTeacherRenewals: RegistrationRequest[] = [];
      for (const teacher of tList) {
        if (teacher.role === 'teacher') {
          try {
            const reqs = await getRegistrationRequests(teacher.id);
            const renewals = reqs.filter(r => r.type === 'teacher_renewal');
            allTeacherRenewals.push(...renewals);
          } catch {}
        }
      }
      setTeacherRenewalRequests(allTeacherRenewals);
    } catch (e) {
      console.error(e);
      showToast('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const teacherRevenue = teachers.reduce((s, t) => s + (t.totalPaid || t.subPrice || 0), 0);
    const studentRevenue = students.reduce((s, st) => s + (st.totalPaid || st.subPrice || 0), 0);
    const expiringTeachers = teachers.filter(t => { const d = daysUntil(t.subExpiry); return d !== null && d >= 0 && d <= 7; });
    const expiredTeachers = teachers.filter(t => { const d = daysUntil(t.subExpiry); return d !== null && d < 0; });
    return { teacherRevenue, studentRevenue, grand: teacherRevenue + studentRevenue, expiringTeachers, expiredTeachers };
  }, [teachers, students]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.username || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const da = daysUntil(a.subExpiry) ?? 9999;
      const db2 = daysUntil(b.subExpiry) ?? 9999;
      return da - db2;
    });
  }, [teachers, search]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchBasic = s.name.toLowerCase().includes(search.toLowerCase()) ||
                         (s.code || '').toLowerCase().includes(search.toLowerCase());
      
      const teacher = teachers.find(t => t.id === s.teacherId);
      const matchTeacher = teacher ? (
        teacher.name.toLowerCase().includes(search.toLowerCase()) ||
        (teacher.code || '').toLowerCase().includes(search.toLowerCase())
      ) : false;

      return matchBasic || matchTeacher;
    }).sort((a, b) => {
      const da = daysUntil(a.subExpiry) ?? 9999;
      const db2 = daysUntil(b.subExpiry) ?? 9999;
      return da - db2;
    });
  }, [students, teachers, search]);

  const groupedFilteredStudents = useMemo(() => {
    const map = new Map<string, Student & { enrollments: Student[] }>();
    filteredStudents.forEach(s => {
      const key = s.phone || s.code || s.name;
      if (!map.has(key)) {
        map.set(key, { ...s, enrollments: [s] });
      } else {
        const existing = map.get(key)!;
        existing.enrollments.push(s);
        existing.subPrice = (existing.subPrice || 0) + (s.subPrice || 0);
      }
    });
    return Array.from(map.values());
  }, [filteredStudents]);

  const uniqueTotalStudentsCount = useMemo(() => {
    return new Set(students.map(s => s.phone || s.code || s.name)).size;
  }, [students]);

  const getExpiryStatus = (subExpiry: number | null | undefined, subType?: string) => {
    if (subType === 'free' || !subExpiry) return { label: 'مجاني دائم', color: 'text-green-400', bg: 'bg-green-500/10' };
    const days = daysUntil(subExpiry);
    if (days === null) return { label: '—', color: 'text-gray-400', bg: '' };
    if (days < 0) return { label: 'منتهي', color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/20' };
    if (days === 0) return { label: 'ينتهي اليوم!', color: 'text-red-400 animate-pulse', bg: 'bg-red-500/20 border border-red-500/30' };
    if (days <= 3) return { label: `${days} أيام`, color: 'text-red-400', bg: 'bg-red-500/10' };
    if (days <= 7) return { label: `${days} أيام`, color: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (days <= 30) return { label: `${days} يوم`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { label: new Date(subExpiry).toLocaleDateString('ar-EG'), color: 'text-green-400', bg: 'bg-green-500/10' };
  };

  const openEditTeacher = (t: TeacherUser) => {
    setEditingTeacher(t);
    setEditForm({
      subType: t.subType || 'free',
      subExpiry: t.subExpiry ? new Date(t.subExpiry).toISOString().split('T')[0] : '',
      subPrice: String(t.subPrice || ''),
      subLink: t.subLink || '',
      logPayment: false,
    });
  };

  const onSubTypeChange = (type: string) => {
    let price = editForm.subPrice;
    if (platformSettings) {
      if (type === 'monthly') price = String(platformSettings.monthlyPrice || 0);
      else if (type === 'yearly') price = String(platformSettings.yearlyPrice || 0);
      else if (type === 'free') price = '0';
    }
    setEditForm({ ...editForm, subType: type, subPrice: price });
  };

  const handleSaveTeacher = async () => {
    if (!editingTeacher) return;
    setSaving(true);
    try {
      const newPrice = parseFloat(editForm.subPrice) || 0;
      const oldPrice = editingTeacher.subPrice || 0;
      
      // Calculate payment history if price changed or it's a renewal
      const history = [...(editingTeacher.paymentHistory || [])];
      let newTotal = editingTeacher.totalPaid || 0;
      
      // If the admin explicitly chose to log this as a new payment
      if (editForm.logPayment && newPrice > 0) {
         history.push({ date: Date.now(), amount: newPrice, type: editForm.subType });
         newTotal += newPrice;
      }

      const update: Partial<TeacherUser> = {
        ...editingTeacher,
        subType: editForm.subType as any,
        subExpiry: editForm.subExpiry ? new Date(editForm.subExpiry).getTime() : null,
        subPrice: newPrice,
        subLink: editForm.subLink,
        totalPaid: newTotal,
        paymentHistory: history,
      };
      await saveTeacher(update as any);
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...update } as TeacherUser : t));
      showToast('✅ تم تحديث اشتراك المعلم');
      setEditingTeacher(null);
    } catch (e) {
      console.error(e);
      showToast('❌ فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsappToTeacher = (t: TeacherUser) => {
    const days = daysUntil(t.subExpiry);
    const subTypeMap: Record<string, string> = { free: 'مجاني', monthly: 'شهري', yearly: 'سنوي' };
    const msg = [
      `💬 *تذكير بنهاية اشتراك منصة AN Academy*`,
      ``,
      `👨‍🏫 *بيانات المعلم:*`,
      `• الاسم: ${t.name}`,
      `• اسم المستخدم: @${t.username}`,
      `• الهاتف: ${t.phone || 'غير محدد'}`,
      `• المادة: ${t.subject || 'غير محدد'}`,
      ``,
      `📋 *بيانات الاشتراك:*`,
      `• نوع الاشتراك: ${subTypeMap[t.subType || 'free'] || t.subType}`,
      `• تاريخ الانتهاء: ${t.subExpiry ? new Date(t.subExpiry).toLocaleDateString('ar-EG') : 'غير محدد'}`,
      `• قيمة الاشتراك: ${t.subPrice || 0} ج.م`,
      ``,
      days !== null && days <= 0
        ? `⚠️ اشتراكك قد انتهى بالفعل!`
        : `⚠️ اشتراكك (${subLabel(t.subType || 'free')}) سينتهي خلال *${days} أيام*`,
      ``,
      `يرجى التجديد للمحافظة على نشاط منصتك.${t.subLink ? `\n\nرابط التجديد: ${t.subLink}` : ''}`,
    ].filter(Boolean).join('\n');

    if (!t.phone && !t.username) { showToast('لا يوجد رقم هاتف للمعلم'); return; }
    const phone = (t.phone || '').replace(/[\s\-\(\)]/g, '').replace(/^0/, '20');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const approveTeacherRenewal = async (req: RegistrationRequest) => {
    if (!confirm(`موافقة على تجديد اشتراك المعلم ${req.name}؟`)) return;
    const teacher = teachers.find(t => t.id === req.studentId || t.id === req.teacherId);
    if (!teacher) { showToast('❌ لم يتم العثور على المعلم'); return; }

    const daysMap: Record<string, number> = { monthly: 30, yearly: 365 };
    const base = teacher.subExpiry && teacher.subExpiry > Date.now() ? teacher.subExpiry : Date.now();
    const days = daysMap[req.subType] || 30;
    const subExpiry = base + days * 86400000;

    try {
      const subExpiry = base + days * 86400000;
      
      // Update financials on approval
      const price = teacher.subPrice || req.subPrice || 
        (req.subType === 'yearly' ? (platformSettings?.yearlyPrice || 0) : (platformSettings?.monthlyPrice || 0));
        
      const history = [...(teacher.paymentHistory || []), { date: Date.now(), amount: price, type: req.subType }];
      const totalPaid = (teacher.totalPaid || 0) + price;

      await saveTeacher({ 
        ...teacher, 
        subType: req.subType as any, 
        subExpiry, 
        totalPaid, 
        paymentHistory: history,
        subPrice: price
      });
      await deleteRegistrationRequest(req.id);

      // Notify teacher (In-App)
      await dispatchNotification({
        teacherId: teacher.id,
        msg: `✅ تم تجديد اشتراك منصتك (${req.subType === 'yearly' ? 'سنوي' : 'شهري'}) حتى ${new Date(subExpiry).toLocaleDateString('ar-EG')}. أهلاً بعودتك!`,
        type: 'success',
        channels: { inApp: true, whatsapp: false },
      });

      // Notify teacher (WhatsApp)
      if (teacher.phone) {
        try {
          await dispatchNotification({
            teacherId: teacher.id,
            msg: `✅ تم تمديد اشتراك منصتكم يا أستاذ ${teacher.name}!\n\n📋 نوع التجديد: ${req.subType === 'yearly' ? 'سنوي' : 'شهري'}\n📅 تاريخ الانتهاء الجديد: ${new Date(subExpiry).toLocaleDateString('ar-EG')}\n\nشكراً لاستخدامكم منصة AN Academy!`,
            whatsappNumbers: [teacher.phone],
            channels: { inApp: false, whatsapp: true }
          });
        } catch (notifErr) { console.error('WhatsApp notify error:', notifErr); }
      }

      setTeacherRenewalRequests(prev => prev.filter(r => r.id !== req.id));
      setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, subType: req.subType as any, subExpiry } : t));
      showToast(`✅ تم تجديد اشتراك المعلم ${req.name} بنجاح!`);
    } catch (e) {
      console.error(e);
      showToast('❌ حدث خطأ أثناء التجديد');
    }
  };

  const sendWhatsAppToTeacherOnRenewal = (req: RegistrationRequest) => {
    const subTypeMap: Record<string, string> = { monthly: 'شهري', yearly: 'سنوي' };
    const msg = [
      `📢 *رد على طلب تجديد اشتراك المنصة*`,
      ``,
      `عزيزي الأستاذ *${req.name}*،`,
      ``,
      `👨‍🏫 *بياناتك:*`,
      `• الاسم: ${req.name}`,
      `• الهاتف: ${req.phone || 'غير محدد'}`,
      `• المادة: ${req.subject || req.grade || 'غير محدد'}`,
      ``,
      `📋 *تفاصيل طلب التجديد:*`,
      `• نوع الاشتراك المطلوب: ${subTypeMap[req.subType] || req.subType}`,
      `• مرجع الدفع: ${req.paymentRef || 'لم يُحدد'}`,
      req.notes ? `• الملاحظات: ${req.notes}` : '',
      ``,
      `✅ تمت مراجعة طلبك وسيتم التواصل معك قريباً.`,
    ].filter(Boolean).join('\n');

    const phone = (req.phone || '').replace(/[\s\-\(\)]/g, '').replace(/^0/, '20');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-purple-400" />
          <h1 className="text-2xl font-cairo font-black text-purple-300">إدارة الاشتراكات الشاملة</h1>
        </div>
        <button onClick={() => loadData()} className="btn-outline text-xs flex items-center gap-1 border-purple-500/30 text-purple-400">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* Expiry Alert */}
      {stats.expiringTeachers.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3">
          <Bell className="text-orange-400 mt-0.5 flex-shrink-0 animate-bounce" size={20} />
          <div className="flex-1">
            <p className="font-bold text-orange-300 mb-1">⚠️ {stats.expiringTeachers.length} معلم اشتراكه ينتهي خلال 7 أيام</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {stats.expiringTeachers.map(t => (
                <span key={t.id} className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/20">
                  {t.name} ({daysUntil(t.subExpiry)} يوم)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الإيرادات', value: `${stats.grand.toLocaleString()} ج.م`, icon: <DollarSign size={22} className="text-gold"/>, bg: 'from-yellow-500/10 border-yellow-500/20' },
          { label: 'إيرادات المعلمين', value: `${stats.teacherRevenue.toLocaleString()} ج.م`, icon: <TrendingUp size={22} className="text-purple-400"/>, bg: 'from-purple-500/10 border-purple-500/20' },
          { label: 'إيرادات الطلاب', value: `${stats.studentRevenue.toLocaleString()} ج.م`, icon: <Users size={22} className="text-blue-400"/>, bg: 'from-blue-500/10 border-blue-500/20' },
          { label: 'اشتراكات منتهية', value: stats.expiredTeachers.length, icon: <AlertCircle size={22} className="text-red-400"/>, bg: 'from-red-500/10 border-red-500/20' },
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

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
        {(['teachers', 'students', 'renewals', 'financials'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${activeTab === tab ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {tab === 'teachers' ? `المعلمون (${teachers.length})` : 
             tab === 'students' ? `طلاب المنصة (${uniqueTotalStudentsCount})` : 
             tab === 'renewals' ? `الطلبات (${teacherRenewalRequests.length})` : 'التقارير المالية'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
        <input type="text" placeholder="ابحث..." value={search} onChange={e => setSearch(e.target.value)} className="input-base pr-11 text-sm w-full" />
      </div>

      {loading ? (
        <div className="text-center py-20 opacity-50">جاري التحميل...</div>
      ) : activeTab === 'teachers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers.map(teacher => {
            const status = getExpiryStatus(teacher.subExpiry, teacher.subType);
            const days = daysUntil(teacher.subExpiry);
            const isExpiring = days !== null && days >= 0 && days <= 7;
            const isExpired = days !== null && days < 0;
            return (
              <div key={teacher.id} className={`card-base p-5 border transition-all hover:scale-[1.01] ${isExpired ? 'border-red-500/30' : isExpiring ? 'border-orange-500/30' : 'border-white/5'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {teacher.imageUrl ? (
                      <img loading="lazy" src={teacher.imageUrl} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                        {teacher.name[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{teacher.name}</h3>
                      <div className="text-xs text-gray-400">@{teacher.username}</div>
                    </div>
                  </div>
                  <button onClick={() => openEditTeacher(teacher)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white flex-shrink-0">
                    <Edit2 size={14} />
                  </button>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">نوع الاشتراك</span>
                    <span className="font-bold">{subLabel(teacher.subType || 'free')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">قيمة الاشتراك الحالي</span>
                    <span className="font-black text-gold">{(teacher.subPrice || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between font-semibold text-purple-300">
                    <span className="text-gray-400">إجمالي المدفوعات</span>
                    <span>{(teacher.totalPaid || 0).toLocaleString()} ج.م</span>
                  </div>
                  {teacher.subExpiry && teacher.subType !== 'free' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">موعد الانتهاء</span>
                      <span>{new Date(teacher.subExpiry).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center ${status.bg} ${status.color}`}>
                    {status.label}
                  </div>
                </div>
                {teacher.subType !== 'free' && teacher.subExpiry && (
                  <div className="mb-4">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(days ?? 0) > 30 ? 'bg-green-500' : (days ?? 0) > 7 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, ((days ?? 0) / 365) * 100))}%` }} />
                    </div>
                  </div>
                )}
                {(isExpired || isExpiring) && (
                  <button onClick={() => sendWhatsappToTeacher(teacher)} className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-400 py-2 rounded-lg text-xs font-bold border border-green-500/20 transition-colors">
                    📲 إرسال تذكير
                  </button>
                )}
              </div>
            );
          })}
          {filteredTeachers.length === 0 && <div className="col-span-3 py-12 text-center text-gray-500">لا يوجد معلمون مطابقون</div>}
        </div>
      ) : activeTab === 'students' ? (
        /* Students Table */
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[600px]">
              <thead className="bg-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3">الطالب</th>
                  <th className="px-4 py-3">المعلم</th>
                  <th className="px-4 py-3">الاشتراك</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">الانتهاء</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {groupedFilteredStudents.map(student => {
                  return (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold">{student.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{student.code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs align-top">
                        <div className="space-y-2">
                          {student.enrollments.map(e => {
                            const teacher = teachers.find(t => t.id === e.teacherId);
                            return <div key={e.id}>{teacher?.name || '—'}</div>;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-2">
                          {student.enrollments.map(e => (
                            <div key={e.id}>
                              <span className="badge badge-blue text-xs">
                                {e.subType === 'monthly' ? 'شهري' : e.subType === 'yearly' ? 'سنوي' : e.subType === 'halfYearly' ? 'نصف سنوي' : e.subType === 'course' ? 'كورس' : e.subType === 'session' ? 'حصة' : 'غير مشترك'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-black text-gold align-top">
                        <div className="space-y-2">
                          {student.enrollments.map(e => (
                            <div key={e.id}>{(e.subPrice || 0)} ج.م</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs align-top">
                        <div className="space-y-2">
                          {student.enrollments.map(e => (
                            <div key={e.id}>
                              {e.subExpiry ? new Date(e.subExpiry).toLocaleDateString('ar-EG') : '—'}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-2">
                          {student.enrollments.map(e => {
                            const status = getExpiryStatus(e.subExpiry, e.subType);
                            return (
                              <div key={e.id}>
                                <span className={`text-xs px-2 py-1 rounded-lg ${status.bg} ${status.color} font-bold`}>
                                  {status.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {groupedFilteredStudents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">لا يوجد طلاب مطابقون</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'financials' ? (
        <FinancialReports 
          data={teachers.filter(t => t.subType !== 'free')} 
          type="teachers" 
          title="إحصائيات إيرادات المعلمين" 
        />
      ) : (
        /* Teacher Renewal Requests */
        <div className="space-y-4">
          <div className="card-base p-4 border-purple-500/20 bg-purple-500/5 flex gap-3">
            <RotateCcw className="text-purple-400 shrink-0" size={20} />
            <p className="text-sm text-gray-300">عند الموافقة، سيتم تجديد اشتراك المعلم تلقائياً وستعود إمكانية دخوله للوحة التحكم.</p>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {teacherRenewalRequests.length === 0 ? (
              <div className="col-span-3 card-base p-12 text-center">
                <RotateCcw size={48} className="mx-auto mb-4 text-purple-400 opacity-30" />
                <p className="text-gray-500">لا توجد طلبات تجديد اشتراك معلقة من المعلمين.</p>
              </div>
            ) : teacherRenewalRequests.map(req => {
              const teacher = teachers.find(t => t.id === req.studentId || t.id === req.teacherId);
              const subTypeMap: Record<string, string> = { monthly: 'شهري', yearly: 'سنوي' };
              return (
                <div key={req.id} className="card-base p-5 border border-purple-500/20 hover:border-purple-400/40 transition-colors bg-purple-500/5">
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      {teacher?.imageUrl ? (
                        <img loading="lazy" src={teacher.imageUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 font-black">{req.name[0]}</div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <RotateCcw size={12} className="text-purple-400" />
                          <h3 className="font-bold text-white text-sm">{req.name}</h3>
                        </div>
                        <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString('ar-EG')}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold">
                      {subTypeMap[req.subType] || req.subType}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span dir="ltr">{req.phone}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">المادة:</span><span>{req.subject || req.grade || '—'}</span></div>
                    {teacher && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">اشتراك حالي:</span>
                        <span className={`text-xs font-bold ${
                          teacher.subExpiry && teacher.subExpiry < Date.now() ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {subLabel(teacher.subType || 'free')}
                          {teacher.subExpiry ? ` — (${teacher.subExpiry < Date.now() ? 'منتهي' : 'نشط'})` : ''}
                        </span>
                      </div>
                    )}
                    {req.paymentRef && (
                      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 mt-2">
                        <span className="block text-xs text-gray-400 mb-1">مرجع الدفع:</span>
                        <span className="text-sm text-purple-300 font-bold">{req.paymentRef}</span>
                      </div>
                    )}
                    {req.notes && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10 mt-1">
                        <span className="block text-xs text-gray-400 mb-1">ملاحظات المعلم:</span>
                        <span className="text-sm text-gray-300">{req.notes}</span>
                      </div>
                    )}
                    {req.receiptUrl && (
                      <button onClick={() => openPreview(req.receiptUrl!, `إيصال - ${req.name}`)} className="w-full btn-outline border-purple-500/20 text-purple-400 text-xs py-2 flex items-center justify-center gap-2 mt-2">
                        <ImageIcon size={14} /> عرض صورة الإيصال
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => approveTeacherRenewal(req)}
                      className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-2 border border-green-500/20 transition-colors"
                    >
                      <CheckCircle size={15} /> موافقة وتجديد
                    </button>
                    <button
                      onClick={() => sendWhatsAppToTeacherOnRenewal(req)}
                      className="px-3 py-2.5 bg-green-600/20 border border-green-500/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                      title="تواصل عبر واتساب"
                    >
                      <Phone size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('رفض طلب التجديد؟')) return;
                        await deleteRegistrationRequest(req.id);
                        setTeacherRenewalRequests(prev => prev.filter(r => r.id !== req.id));
                        showToast('تم رفض الطلب');
                      }}
                      className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/10"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Redesigned Edit Teacher Modal */}
      {editingTeacher && (
        <div className="modal-overlay" >
          <div className="modal-content modal-content-sm !p-0 border border-purple-500/30 animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-purple-500/5">
                <div className="min-w-0">
                    <h3 className="text-xl font-black font-cairo text-white truncate">تعديل اشتراك المعلم</h3>
                    <p className="text-xs text-purple-400 mt-0.5 truncate">{editingTeacher.name}</p>
                </div>
                <button 
                    onClick={() => setEditingTeacher(null)} 
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-90"
                >
                    <X size={20}/>
                </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Row 1: Type & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">نوع الاشتراك</label>
                  <select 
                    className="input-base w-full text-sm font-bold h-12 border-purple-500/20" 
                    value={editForm.subType} 
                    onChange={e => onSubTypeChange(e.target.value)}
                  >
                    <option value="free">مجاني (دائم)</option>
                    <option value="monthly">اشتراك شهري</option>
                    <option value="yearly">اشتراك سنوي</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">قيمة الاشتراك (ج.م)</label>
                  <input 
                    type="number" 
                    className="input-base w-full text-sm font-black h-12 text-purple-400" 
                    value={editForm.subPrice} 
                    onChange={e => setEditForm({...editForm, subPrice: e.target.value})} 
                  />
                </div>
              </div>

              {/* Row 2: Manual Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">تاريخ البداية (اختياري)</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input 
                        type="date" 
                        className="input-base w-full text-sm pl-10 h-12" 
                        onChange={e => {
                          if (e.target.value && editingTeacher.subType === 'monthly') {
                             const start = new Date(e.target.value).getTime();
                             const end = new Date(start + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                             setEditForm(f => ({ ...f, subExpiry: end }));
                          }
                        }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">تاريخ الانتهاء</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input 
                        type="date" 
                        className="input-base w-full text-sm pl-10 h-12 font-bold" 
                        value={editForm.subExpiry} 
                        onChange={e => setEditForm({...editForm, subExpiry: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Accumulate Days */}
              <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-purple-400" />
                    <label className="block text-xs text-purple-400 font-bold px-1 uppercase tracking-wider">تمديد الاشتراك (إضافة أيام)</label>
                </div>
                <input 
                    type="number" 
                    placeholder="أدخل عدد الأيام للإضافة على الحالي..." 
                    className="input-base w-full text-sm bg-black/20 h-12" 
                    onChange={e => {
                      const days = parseInt(e.target.value);
                      if (!isNaN(days) && editingTeacher.subExpiry) {
                        const base = Math.max(Date.now(), editingTeacher.subExpiry);
                        const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setEditForm(f => ({ ...f, subExpiry: newExpiry }));
                      }
                    }}
                />
                
                <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                    <span className="text-gray-500 font-bold">تاريخ الانتهاء الحالي:</span>
                    <span className="font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {editingTeacher.subExpiry ? new Date(editingTeacher.subExpiry).toLocaleDateString('ar-EG') : 'غير محدد'}
                    </span>
                </div>
              </div>

              {/* Row 4: Renewal Link */}
              <div className="space-y-2">
                <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">رابط التجديد المخصص</label>
                <div className="relative">
                    <ShieldCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input 
                      type="text" 
                      className="input-base w-full text-sm pl-10 h-12" 
                      placeholder="https://..." 
                      value={editForm.subLink} 
                      onChange={e => setEditForm({...editForm, subLink: e.target.value})} 
                    />
                </div>
              </div>

              {/* Row 5: Log Payment Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer group p-3 bg-purple-500/5 hover:bg-purple-500/10 rounded-xl border border-purple-500/10 transition">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${editForm.logPayment ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500 text-transparent'}`}>
                    <CheckCircle size={14} className={editForm.logPayment ? 'opacity-100' : 'opacity-0'} />
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={editForm.logPayment} 
                    onChange={e => setEditForm({...editForm, logPayment: e.target.checked})} 
                  />
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-purple-300 transition">تسجيل هذه العملية كدفعة جديدة (تجديد اشتراك)</div>
                    <div className="text-[10px] text-gray-500">سيتم إضافة المبلغ إلى إجمالي مدفوعات المعلم وتوثيقه في دفتر الحسابات.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-white/5 bg-white/[0.02] flex gap-3">
              <button 
                onClick={() => setEditingTeacher(null)} 
                className="btn-outline flex-1 h-12 text-sm justify-center border-white/10 text-gray-400 hover:text-white"
              >
                إلغاء التعديل
              </button>
              <button 
                onClick={handleSaveTeacher} 
                disabled={saving} 
                className="btn-gold flex-[2] bg-purple-600 hover:bg-purple-700 h-12 text-sm font-black shadow-lg shadow-purple-900/40 active:scale-95 transition-all text-white border-none"
              >
                {saving ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري الحفظ...</span>
                    </div>
                ) : 'حفظ التغييرات الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {PreviewModal}
    </div>
  );
}
