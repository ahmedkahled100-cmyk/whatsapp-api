'use client';
// src/app/teacher/subscriptions/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { saveStudent, deleteRegistrationRequest, getSettings, dispatchNotification } from '@/lib/db';
import { CreditCard, Search, Calendar, ShieldCheck, Clock, UserX, CheckCircle, XCircle, Copy, AlertCircle, FileText, Image as ImageIcon, X, Download, TrendingUp, Bell, DollarSign, Users, RefreshCw, Edit2, ArrowRight, Printer, RotateCcw, Phone } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatDateAr, generateCode, cleanWhatsAppPhone } from '@/lib/utils';
import { Student } from '@/types';
import { useFilePreview } from '@/components/FilePreviewModal';

const SUB_COLORS: Record<string, string> = {
  yearly: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300',
  halfYearly: 'from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-300',
  monthly: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-300',
  course: 'from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-300',
  session: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-300',
  none: 'from-gray-500/10 to-gray-600/5 border-gray-600/20 text-gray-400',
};

const daysUntil = (ts: number | null | undefined) => {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
};

type SubType = 'monthly' | 'halfYearly' | 'yearly' | 'course' | 'session' | 'none';

export default function SubscriptionsPage() {
  const { students, groups, registrationRequests } = useTeacherStore();
  const user = useTeacherStore(state => state.user);
  const [activeTab, setActiveTab] = useState<'current' | 'pending' | 'expiring' | 'renewals'>('current');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | SubType>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [receiptStudent, setReceiptStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ subType: 'none' as SubType, daysToAdd: '', subPrice: '', subNote: '' });
  const [saving, setSaving] = useState(false);
  
  const { openPreview, PreviewModal } = useFilePreview();

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.code.toLowerCase().includes(search.toLowerCase()) ||
                          (s.phone || '').includes(search);
      const matchFilter = filter === 'all' || s.subType === filter;
      return matchSearch && matchFilter;
    }).sort((a, b) => {
      const da = daysUntil(a.subExpiry) ?? 9999;
      const db = daysUntil(b.subExpiry) ?? 9999;
      return da - db;
    });
  }, [students, search, filter]);

  const expiringStudents = useMemo(() => {
    return students.filter(s => {
      const days = daysUntil(s.subExpiry);
      return days !== null && days >= 0 && days <= 7;
    }).sort((a, b) => (daysUntil(a.subExpiry) ?? 0) - (daysUntil(b.subExpiry) ?? 0));
  }, [students]);

  const stats = useMemo(() => {
    const totalRevenue = students.reduce((sum, s) => sum + (s.subPrice || 0), 0);
    const active = students.filter(s => s.subType !== 'none' && (!s.subExpiry || s.subExpiry > Date.now())).length;
    const expired = students.filter(s => s.subType !== 'none' && s.subExpiry && s.subExpiry < Date.now()).length;
    const expiring7 = expiringStudents.length;
    return { totalRevenue, active, expired, expiring7, total: students.length };
  }, [students, expiringStudents]);

  const translateSubType = (type: string) => {
    const map: Record<string, string> = { yearly: 'سنوي', halfYearly: 'نصف سنوي', course: 'كورس كامل', monthly: 'شهري', session: 'بالحصة', none: 'بدون اشتراك' };
    return map[type] || type;
  };

  const getExpiryStatus = (student: Student) => {
    if (student.subType === 'none') return null;
    const days = daysUntil(student.subExpiry);
    if (days === null) return { label: 'غير محدد', color: 'text-gray-400', bg: 'bg-gray-500/10' };
    if (days < 0) return { label: 'منتهي', color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/20' };
    if (days === 0) return { label: 'ينتهي اليوم!', color: 'text-red-400 animate-pulse', bg: 'bg-red-500/20 border border-red-500/30' };
    if (days <= 3) return { label: `ينتهي خلال ${days} أيام`, color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/20' };
    if (days <= 7) return { label: `ينتهي خلال ${days} أيام`, color: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/20' };
    if (days <= 14) return { label: `ينتهي خلال ${days} يوم`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { label: student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : '—', color: 'text-green-400', bg: 'bg-green-500/10' };
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setEditForm({ subType: student.subType as SubType, daysToAdd: '', subPrice: String(student.subPrice || ''), subNote: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setSaving(true);
    try {
      let subExpiry = editingStudent.subExpiry;
      if (editForm.daysToAdd) {
        const base = editingStudent.subExpiry && editingStudent.subExpiry > Date.now()
          ? editingStudent.subExpiry
          : Date.now();
        subExpiry = base + parseInt(editForm.daysToAdd) * 86400000;
      }
      if (editForm.subType === 'none') {
        subExpiry = null;
      }
      await saveStudent({ ...editingStudent, subType: editForm.subType, subExpiry, subPrice: parseFloat(editForm.subPrice) || 0 });
      showToast('✅ تم تحديث اشتراك الطالب');
      setEditingStudent(null);
    } catch {
      showToast('❌ حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsappReminder = (student: Student) => {
    const days = daysUntil(student.subExpiry);
    const msg = `💬 تذكير بنهاية الاشتراك\n\nعزيزي ولي أمر الطالب *${student.name}*،\n\nنود تذكيركم بأن اشتراك الطالب في المنصة (${translateSubType(student.subType)}) ${days !== null && days <= 0 ? 'قد انتهى بالفعل!' : `سينتهي خلال *${days} أيام فقط*`}\n\nتاريخ الانتهاء: ${student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : '—'}\nقيمة الاشتراك: *${student.subPrice || 0} ج.م*\n\nيرجى التجديد لضمان استمرار وصول الطالب للمحتوى التعليمي.\n\nشكراً لثقتكم بنا 🎓`;
    const phone = cleanWhatsAppPhone(student.parentPhone || student.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const approveRequest = async (req: any) => {
    if (!confirm(`هل أنت متأكد من قبول اشتراك الطالب ${req.name}؟`)) return;
    const code = generateCode();
    let subExpiry: number | null = null;
    const now = new Date();
    const daysMap: Record<string, number> = { monthly: 30, halfYearly: 180, yearly: 365, course: 730, session: 1 };
    const days = daysMap[req.subType];
    if (days) { now.setDate(now.getDate() + days); subExpiry = now.getTime(); }
    try {
      await saveStudent({
        name: req.name, phone: req.phone, parentPhone: req.parentPhone,
        grade: req.grade, code, subType: req.subType, subExpiry,
        subPrice: req.subPrice || 0, imageUrl: req.imageUrl || '',
        teacherId: req.teacherId, teacherCode: req.teacherCode || '',
        email: '', groupIds: [],
        notes: `تم طلب التسجيل إلكترونياً. ملاحظة: ${req.paymentRef || 'لا يوجد'}`,
        registeredAt: new Date().toISOString(), createdAt: Date.now()
      });
      await deleteRegistrationRequest(req.id);
      showToast(`✅ تم إضافة الطالب! كود التفعيل: ${code}`);
    } catch { showToast('فشل الحفظ'); }
  };

  const copyRegisterLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Renewal requests (type === 'renewal') — separated from regular registration requests
  const renewalRequests = useMemo(() => {
    return registrationRequests.filter(r => r.type === 'renewal');
  }, [registrationRequests]);

  // Regular new registration requests (not renewals)
  const newRegistrationRequests = useMemo(() => {
    return registrationRequests.filter(r => !r.type || r.type === 'student');
  }, [registrationRequests]);

  const approveRenewal = async (req: any) => {
    if (!confirm(`هل أنت متأكد من الموافقة على تجديد اشتراك الطالب ${req.name}؟`)) return;
    try {
      // Find the student by studentId or phone
      const existingStudent = students.find(s => s.id === req.studentId || s.phone === req.phone);
      if (!existingStudent) {
        showToast('❌ لم يتم العثور على الطالب');
        return;
      }

      const daysMap: Record<string, number> = {
        monthly: 30, halfYearly: 180, yearly: 365, course: 730, session: 1,
      };
      const now = new Date();
      const base = existingStudent.subExpiry && existingStudent.subExpiry > Date.now()
        ? existingStudent.subExpiry
        : Date.now();
      const days = daysMap[req.subType] || 30;
      const subExpiry = base + days * 86400000;

      await saveStudent({
        ...existingStudent,
        subType: req.subType,
        subExpiry,
      });

      await deleteRegistrationRequest(req.id);

      // Notify student via in-app notification
      const subTypeMap: Record<string, string> = {
        monthly: 'شهري', halfYearly: 'نصف سنوي',
        yearly: 'سنوي', course: 'كورس كامل', session: 'بالحصة',
      };
      await dispatchNotification({
        teacherId: user?.id || '',
        msg: `✅ تم تجديد اشتراكك (${subTypeMap[req.subType] || req.subType}) حتى ${new Date(subExpiry).toLocaleDateString('ar-EG')}. أهلاً بعودتك!`,
        type: 'success',
        targetUsers: [existingStudent.id],
        channels: { inApp: true, whatsapp: false },
      });

      showToast(`✅ تم تجديد اشتراك الطالب ${req.name} بنجاح!`);
    } catch (e) {
      console.error(e);
      showToast('❌ حدث خطأ أثناء الموافقة');
    }
  };

  const sendWhatsAppToStudentOnRenewal = (req: any) => {
    const subTypeMap: Record<string, string> = {
      monthly: 'شهري', halfYearly: 'نصف سنوي',
      yearly: 'سنوي', course: 'كورس كامل', session: 'بالحصة',
    };
    const msg = [
      `📢 *رد على طلب تجديد الاشتراك*`,
      ``,
      `عزيزي الطالب *${req.name}*،`,
      ``,
      `👤 *بيانات الطالب:*`,
      `• الاسم: ${req.name}`,
      `• الهاتف: ${req.phone || 'غير محدد'}`,
      `• هاتف ولي الأمر: ${req.parentPhone || 'غير محدد'}`,
      `• الصف: ${req.grade || 'غير محدد'}`,
      ``,
      `📋 *تفاصيل الطلب:*`,
      `• نوع الاشتراك المطلوب: ${subTypeMap[req.subType] || req.subType}`,
      `• مرجع الدفع: ${req.paymentRef || 'لم يُحدد'}`,
      req.notes ? `• الملاحظات: ${req.notes}` : '',
      ``,
      `✅ تمت مراجعة طلبك وسيتم التواصل معك قريباً.`,
    ].filter(Boolean).join('\n');

    const phone = cleanWhatsAppPhone(req.phone || req.parentPhone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">إدارة الاشتراكات</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyRegisterLink} className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm transition-colors text-white">
            {copiedLink ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} className="text-gold" />}
            <span className="hidden sm:inline">{copiedLink ? 'تم النسخ!' : 'رابط التسجيل'}</span>
          </button>
        </div>
      </div>

      {/* Expiry Alert Banner */}
      {expiringStudents.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
          <Bell className="text-orange-400 mt-0.5 flex-shrink-0 animate-bounce" size={20} />
          <div className="flex-1">
            <p className="font-bold text-orange-300 mb-1">⚠️ تنبيه: {expiringStudents.length} طالب اشتراكه على وشك الانتهاء خلال 7 أيام!</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {expiringStudents.slice(0, 5).map(s => (
                <span key={s.id} className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/20">
                  {s.name} ({daysUntil(s.subExpiry)} يوم)
                </span>
              ))}
              {expiringStudents.length > 5 && <span className="text-xs text-gray-400">+{expiringStudents.length - 5} آخرون</span>}
            </div>
          </div>
          <button onClick={() => setActiveTab('expiring')} className="text-xs flex items-center gap-1 text-orange-300 hover:text-orange-200 font-bold flex-shrink-0">
            عرض الكل <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue.toLocaleString()} ج.م`, icon: <DollarSign size={22} className="text-gold"/>, bg: 'from-yellow-500/10 to-amber-500/5 border-yellow-500/20' },
          { label: 'مشتركون نشطون', value: stats.active, icon: <Users size={22} className="text-green-400"/>, bg: 'from-green-500/10 to-emerald-500/5 border-green-500/20' },
          { label: 'ينتهي قريباً', value: stats.expiring7, icon: <Bell size={22} className="text-orange-400"/>, bg: 'from-orange-500/10 to-red-500/5 border-orange-500/20' },
          { label: 'منتهية الاشتراك', value: stats.expired, icon: <UserX size={22} className="text-red-400"/>, bg: 'from-red-500/10 to-rose-500/5 border-red-500/20' },
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
        {(['current', 'expiring', 'pending', 'renewals'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${
              activeTab === tab
                ? (tab === 'expiring' ? 'bg-orange-500 text-white' : tab === 'pending' ? 'bg-blue-500 text-white' : tab === 'renewals' ? 'bg-purple-500 text-white' : 'bg-gold text-black')
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'current' && `المشتركون (${students.length})`}
            {tab === 'expiring' && <>قريباً {expiringStudents.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">{expiringStudents.length}</span>}</>}
            {tab === 'pending' && <>طلبات التسجيل {newRegistrationRequests.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">{newRegistrationRequests.length}</span>}</>}
            {tab === 'renewals' && <>طلبات التجديد {renewalRequests.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[9px] flex items-center justify-center text-white">{renewalRequests.length}</span>}</>}
          </button>
        ))}
      </div>

      {/* === CURRENT TAB === */}
      {activeTab === 'current' && (
        <>
          {/* Search & Filter */}
          <div className="card-base p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
              <input type="text" placeholder="ابحث بالاسم أو الكود أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="input-base pr-11 text-sm w-full" />
            </div>
            <select className="input-base text-sm py-2" value={filter} onChange={e => setFilter(e.target.value as any)}>
              <option value="all">كل الطلاب</option>
              <option value="monthly">شهري</option>
              <option value="halfYearly">نصف سنوي</option>
              <option value="yearly">سنوي</option>
              <option value="course">كورس كامل</option>
              <option value="session">بالحصة</option>
              <option value="none">بدون اشتراك</option>
            </select>
          </div>

          {/* Students Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(student => {
              const expiryStatus = getExpiryStatus(student);
              const days = daysUntil(student.subExpiry);
              const isExpired = days !== null && days < 0;
              const isExpiring = days !== null && days >= 0 && days <= 7;
              return (
                <div key={student.id} className={`card-base p-5 border transition-all hover:scale-[1.01] bg-gradient-to-br ${SUB_COLORS[student.subType] || SUB_COLORS.none}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{student.name}</h3>
                      <div className="text-xs text-gray-400 font-mono">{student.code}</div>
                      {student.phone && <div className="text-xs text-gray-500 mt-0.5" dir="ltr">{student.phone}</div>}
                    </div>
                    <button onClick={() => openEdit(student)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                      <Edit2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    {/* Sub type */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">نوع الاشتراك</span>
                      <span className="font-bold text-white">{translateSubType(student.subType)}</span>
                    </div>
                    {/* Price */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">قيمة الاشتراك</span>
                      <span className="font-black text-gold">{(student.subPrice || 0).toLocaleString()} ج.م</span>
                    </div>
                    {/* Expiry */}
                    {student.subExpiry && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">تاريخ الانتهاء</span>
                        <span className="text-gray-200">{new Date(student.subExpiry).toLocaleDateString('ar-EG')}</span>
                      </div>
                    )}
                    {/* Expiry Status */}
                    {expiryStatus && (
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center ${expiryStatus.bg} ${expiryStatus.color}`}>
                        {expiryStatus.label}
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {student.subExpiry && student.subType !== 'none' && (() => {
                    const totalDays = student.subType === 'yearly' ? 365 : student.subType === 'halfYearly' ? 180 : student.subType === 'monthly' ? 30 : student.subType === 'course' ? 730 : 1;
                    const pct = Math.min(100, Math.max(0, ((days ?? 0) / totalDays) * 100));
                    return (
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>المدة المتبقية</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    {(isExpired || isExpiring) && student.parentPhone && (
                      <button onClick={() => sendWhatsappReminder(student)} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-green-500/20 transition-colors">
                        📲 تذكير
                      </button>
                    )}
                    <button onClick={() => setReceiptStudent(student)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                      <Printer size={12} /> إيصال
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-3 py-16 text-center text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-20" />
                <p>لا يوجد طلاب مطابقون</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* === EXPIRING TAB === */}
      {activeTab === 'expiring' && (
        <div className="space-y-3">
          {expiringStudents.length === 0 ? (
            <div className="card-base p-12 text-center">
              <Bell size={48} className="mx-auto mb-4 text-green-400 opacity-50" />
              <p className="text-green-400 font-bold">لا توجد اشتراكات على وشك الانتهاء 🎉</p>
            </div>
          ) : expiringStudents.map(student => {
            const days = daysUntil(student.subExpiry);
            return (
              <div key={student.id} className={`card-base p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border ${(days ?? 99) <= 3 ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${(days ?? 99) <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  <span className="text-xl leading-none">{days}</span>
                  <span className="text-[9px]">يوم</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg">{student.name}</h3>
                  <div className="text-xs text-gray-400">{student.code} | {translateSubType(student.subType)} | {(student.subPrice || 0)} ج.م</div>
                  <div className="text-xs text-gray-500 mt-0.5">ينتهي: {student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : '—'}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => sendWhatsappReminder(student)} className="btn-outline border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs px-3 py-2">📲 واتساب</button>
                  <button onClick={() => openEdit(student)} className="btn-gold text-xs px-3 py-2 flex items-center gap-1"><RefreshCw size={12} /> تجديد</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === PENDING TAB === */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="card-base p-4 border-blue-500/20 bg-blue-500/5 flex gap-3">
            <AlertCircle className="text-blue-400 shrink-0" size={20} />
            <p className="text-sm text-gray-300">بمجرد القبول، سيتم إنشاء كود طالب آلياً وتحديد فترة الاشتراك حسب النوع المختار.</p>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {newRegistrationRequests.length === 0 ? (
              <div className="col-span-2 card-base p-12 text-center text-gray-500">لا توجد أي طلبات اشتراك معلقة.</div>
            ) : newRegistrationRequests.map(req => (
              <div key={req.id} className="card-base p-5 border border-white/10 hover:border-gold/30 transition-colors">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/5">
                  <div className="flex gap-3 items-center">
                    {req.imageUrl && <img src={req.imageUrl} className="w-11 h-11 rounded-full object-cover border border-gold/30" alt="" />}
                    <div>
                      <h3 className="font-bold text-white">{req.name}</h3>
                      <p className="text-xs text-gray-400">{formatDateAr(new Date(req.createdAt).toISOString())}</p>
                    </div>
                  </div>
                  <span className="badge badge-gold text-xs">{translateSubType(req.subType)}</span>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">المبلغ:</span><span className="text-gold font-bold">{req.subPrice || 0} ج.م</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">الصف:</span><span>{req.grade}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span dir="ltr">{req.phone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ولي الأمر:</span><span dir="ltr">{req.parentPhone}</span></div>
                  {req.paymentRef && <div className="p-3 bg-gold/5 rounded-lg border border-gold/20 mt-2"><span className="block text-xs text-gray-400 mb-1">مرجع الدفع:</span><span className="text-sm text-gold">{req.paymentRef}</span></div>}
                  {req.receiptUrl && (
                    <button onClick={() => openPreview(req.receiptUrl!, `إيصال - ${req.name}`)} className="w-full btn-outline border-white/10 text-xs py-2 flex items-center justify-center gap-2">
                      <ImageIcon size={14} /> عرض صورة الإيصال
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveRequest(req)} className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-2 border border-green-500/20 transition-colors">
                    <CheckCircle size={16} /> قبول وتفعيل
                  </button>
                  <button onClick={async () => { if (!confirm('رفض هذا الطلب؟')) return; await deleteRegistrationRequest(req.id); }} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/10 transition-colors">
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === RENEWALS TAB === */}
      {activeTab === 'renewals' && (
        <div className="space-y-4">
          <div className="card-base p-4 border-purple-500/20 bg-purple-500/5 flex gap-3">
            <RotateCcw className="text-purple-400 shrink-0" size={20} />
            <p className="text-sm text-gray-300">عند الموافقة، سيتم تجديد اشتراك الطالب تلقائياً وستعود إمكانية دخوله للمنصة.</p>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {renewalRequests.length === 0 ? (
              <div className="col-span-2 card-base p-12 text-center">
                <RotateCcw size={48} className="mx-auto mb-4 text-purple-400 opacity-30" />
                <p className="text-gray-500">لا توجد طلبات تجديد اشتراك معلقة.</p>
              </div>
            ) : renewalRequests.map(req => {
              const existingStudent = students.find(s => s.id === req.studentId || s.phone === req.phone);
              return (
                <div key={req.id} className="card-base p-5 border border-purple-500/20 hover:border-purple-400/40 transition-colors bg-purple-500/5">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <RotateCcw size={14} className="text-purple-400" />
                        <h3 className="font-bold text-white text-sm">{req.name}</h3>
                      </div>
                      <p className="text-xs text-gray-400">{formatDateAr(new Date(req.createdAt).toISOString())}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/20">
                      {translateSubType(req.subType)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 mb-4 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span dir="ltr">{req.phone}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">ولي الأمر:</span><span dir="ltr">{req.parentPhone}</span></div>
                    {existingStudent && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">اشتراك حالي:</span>
                        <span className={`text-xs font-bold ${
                          existingStudent.subExpiry && existingStudent.subExpiry < Date.now() ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {translateSubType(existingStudent.subType)}
                          {existingStudent.subExpiry ? ` — (${existingStudent.subExpiry < Date.now() ? 'منتهي' : 'نشط'})` : ''}
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
                        <span className="block text-xs text-gray-400 mb-1">ملاحظات الطالب:</span>
                        <span className="text-sm text-gray-300">{req.notes}</span>
                      </div>
                    )}
                    {req.receiptUrl && (
                      <button onClick={() => openPreview(req.receiptUrl!, `إيصال تجديد - ${req.name}`)} className="w-full btn-outline border-purple-500/20 text-purple-400 text-xs py-2 flex items-center justify-center gap-2 mt-2">
                        <ImageIcon size={14} /> عرض صورة الإيصال
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveRenewal(req)}
                      className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-2 border border-green-500/20 transition-colors"
                    >
                      <CheckCircle size={15} /> موافقة وتجديد
                    </button>
                    <button
                      onClick={() => sendWhatsAppToStudentOnRenewal(req)}
                      className="px-3 py-2.5 bg-green-600/20 border border-green-500/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                      title="تواصل عبر واتساب"
                    >
                      <Phone size={16} />
                    </button>
                    <button
                      onClick={async () => { if (!confirm('رفض طلب التجديد؟')) return; await deleteRegistrationRequest(req.id); showToast('تم رفض الطلب'); }}
                      className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/10 transition-colors"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setEditingStudent(null)}>
          <div className="card-base p-6 w-full max-w-md animate-scale-in border border-gold/20 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">تعديل اشتراك: {editingStudent.name}</h3>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">نوع الاشتراك</label>
                <select className="input-base w-full text-sm" value={editForm.subType} onChange={e => setEditForm({...editForm, subType: e.target.value as SubType})}>
                  <option value="monthly">شهري</option>
                  <option value="halfYearly">نصف سنوي</option>
                  <option value="yearly">سنوي</option>
                  <option value="course">كورس كامل</option>
                  <option value="session">بالحصة</option>
                  <option value="none">إلغاء الاشتراك</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">قيمة الاشتراك (ج.م)</label>
                <input type="number" className="input-base w-full text-sm" value={editForm.subPrice} onChange={e => setEditForm({...editForm, subPrice: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">إضافة أيام للاشتراك (يتراكم على الحالي)</label>
                <input type="number" placeholder="مثال: 30 لإضافة شهر" className="input-base w-full text-sm" value={editForm.daysToAdd} onChange={e => setEditForm({...editForm, daysToAdd: e.target.value})} />
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-400">تاريخ الانتهاء الحالي:</span><span>{editingStudent.subExpiry ? new Date(editingStudent.subExpiry).toLocaleDateString('ar-EG') : '—'}</span></div>
              {editForm.daysToAdd && <div className="flex justify-between"><span className="text-gray-400">تاريخ الانتهاء الجديد:</span><span className="text-gold font-bold">{new Date((editingStudent.subExpiry && editingStudent.subExpiry > Date.now() ? editingStudent.subExpiry : Date.now()) + parseInt(editForm.daysToAdd) * 86400000).toLocaleDateString('ar-EG')}</span></div>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingStudent(null)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-gold flex-1">{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in text-black" id="receipt-container">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black mb-1">🏫 إيصال اشتراك</h2>
              <div className="text-xs text-gray-500">{new Date().toLocaleDateString('ar-EG')}</div>
            </div>
            <div className="space-y-3 mb-6 text-sm font-bold">
              {[
                ['اسم الطالب', receiptStudent.name],
                ['كود الطالب', receiptStudent.code],
                ['نوع الاشتراك', translateSubType(receiptStudent.subType)],
                ['القيمة المسددة', `${receiptStudent.subPrice || 0} ج.م`],
                ['تاريخ الانتهاء', receiptStudent.subExpiry ? new Date(receiptStudent.subExpiry).toLocaleDateString('ar-EG') : '—'],
                ['الصف', receiptStudent.grade || '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b pb-2 border-gray-100">
                  <span className="text-gray-500">{label}:</span>
                  <span>{val}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mb-4">حُرِّر إلكترونياً — تم الدفع بنجاح</p>
            <div className="flex gap-2 no-print">
              <button onClick={() => window.print()} className="flex-1 bg-gray-800 text-white py-2.5 rounded-lg text-sm font-bold">🖨️ طباعة</button>
              <button onClick={() => sendWhatsappReminder(receiptStudent)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold">واتساب</button>
              <button onClick={() => setReceiptStudent(null)} className="flex-1 bg-red-100 text-red-600 py-2.5 rounded-lg text-sm font-bold border">إغلاق</button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #receipt-container, #receipt-container * { visibility: visible; } .no-print { display: none !important; } }`}} />
        </div>
      )}

      {PreviewModal}
    </div>
  );
}
