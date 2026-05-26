'use client';
// src/app/teacher/subscriptions/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { saveStudent, deleteRegistrationRequest, getSettings, dispatchNotification, getEnrollmentsByPhone } from '@/lib/db';
import { CreditCard, Search, Calendar, ShieldCheck, Clock, UserX, CheckCircle, XCircle, Copy, AlertCircle, FileText, Image as ImageIcon, X, Download, TrendingUp, Bell, DollarSign, Users, RefreshCw, Edit2, ArrowRight, Printer, RotateCcw, Phone } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatDateAr, generateCode, cleanWhatsAppPhone } from '@/lib/utils';
import { normalizePhone } from '@/lib/utils';
import { Student } from '@/types';
import { useFilePreview } from '@/components/FilePreviewModal';
import { FinancialReports } from '@/components/FinancialReports';

const SUB_COLORS: Record<string, string> = {
  yearly: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300',
  halfYearly: 'from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-300',
  monthly: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-300',
  session: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-300',
  none: 'from-gray-500/10 to-gray-600/5 border-gray-600/20 text-gray-400',
  free: 'from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-300',
};

const daysUntil = (ts: number | null | undefined) => {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
};

const totalPaidOf = (s: Student) => {
  return s.totalPaid || (s.paymentHistory?.reduce((sum, h) => sum + h.amount, 0) || 0);
};

type SubType = 'monthly' | 'halfYearly' | 'yearly' | 'course' | 'session' | 'none' | 'free';

export default function SubscriptionsPage() {
  const { students, groups, registrationRequests, setRegistrationRequests } = useTeacherStore();
  const user = useTeacherStore(state => state.user);
  const [activeTab, setActiveTab] = useState<'current' | 'pending' | 'expiring' | 'renewals' | 'financials'>('current');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | SubType>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [receiptStudent, setReceiptStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ subType: 'none' as SubType, daysToAdd: '', subPrice: '', subNote: '', subStart: '', subExpiry: '', cancelReason: '' });
  const [saving, setSaving] = useState(false);

  // Approval Modal State
  const [pendingApproval, setPendingApproval] = useState<{ req: any, type: 'new' | 'renewal' } | null>(null);
  const [approvalForm, setApprovalForm] = useState({ subStart: '', subExpiry: '', code: '' });
  
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
    const totalRevenue = students.reduce((sum, s) => sum + totalPaidOf(s), 0);
    const active = students.filter(s => s.subType !== 'none' && (!s.subExpiry || s.subExpiry > Date.now())).length;
    const expired = students.filter(s => s.subType !== 'none' && s.subExpiry && s.subExpiry < Date.now()).length;
    const expiring7 = expiringStudents.length;
    return { totalRevenue, active, expired, expiring7, total: students.length };
  }, [students, expiringStudents]);

  const translateSubType = (type: string) => {
    const map: Record<string, string> = { yearly: 'سنوي', halfYearly: 'نصف سنوي', course: 'كورس كامل', monthly: 'شهري', session: 'بالحصة', none: 'بدون اشتراك', free: 'مجاني' };
    return map[type] || type;
  };

  const getExpiryStatus = (student: Student) => {
    if (student.subType === 'none') return null;
    if (student.subType === 'free') return { label: 'مجاني دائم', color: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30' };
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
    setEditForm({ 
      subType: student.subType as SubType, 
      daysToAdd: '', 
      subPrice: String(student.subPrice || ''), 
      subNote: '',
      subStart: student.subStart ? new Date(student.subStart).toISOString().split('T')[0] : '',
      subExpiry: student.subExpiry ? new Date(student.subExpiry).toISOString().split('T')[0] : '',
      cancelReason: student.cancelReason || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setSaving(true);
    try {
      let subExpiry = editingStudent.subExpiry;
      let subStart = editingStudent.subStart || null;

      // Start Date
      if (editForm.subStart) subStart = new Date(editForm.subStart).getTime();
      
      // End Date
      if (editForm.subExpiry) {
        subExpiry = new Date(editForm.subExpiry).getTime();
      }
      // daysToAdd overrides explicitly set subExpiry if provided
      if (editForm.daysToAdd) {
        const base = editingStudent.subExpiry && editingStudent.subExpiry > Date.now()
          ? editingStudent.subExpiry
          : Date.now();
        subExpiry = base + parseInt(editForm.daysToAdd) * 86400000;
      }
      if (editForm.subType === 'none') {
        subExpiry = null;
        subStart = null;
      }
 
 
      const newStudentObj = { 
        ...editingStudent, 
        subType: editForm.subType, 
        subStart, 
        subExpiry, 
        subPrice,
        cancelReason: editForm.cancelReason
      };

      // Optimistic Update
      useTeacherStore.getState().setStudents(students.map(s => s.id === editingStudent.id ? newStudentObj as Student : s));

      await saveStudent(newStudentObj);
      showToast('✅ تم تحديث بيانات الاشتراك دون تسجيل دفعة جديدة');
      setEditingStudent(null);
    } catch {
      showToast('❌ حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const addPaymentAndRenew = async () => {
    if (!editingStudent) return;
    const price = parseFloat(editForm.subPrice) || 0;
    if (price <= 0) {
       showToast('يرجى تحديد مبلغ الاشتراك لتسجيل الدفعة');
       return;
    }
    setSaving(true);
    try {
      const history = [...(editingStudent.paymentHistory || [])];
      let totalPaid = editingStudent.totalPaid || 0;
      
      history.push({ date: Date.now(), amount: price, type: editForm.subType });
      totalPaid += price;

      let subExpiry = editingStudent.subExpiry;
      let subStart = editingStudent.subStart || null;

      if (editForm.subStart) subStart = new Date(editForm.subStart).getTime();
      if (editForm.subExpiry) subExpiry = new Date(editForm.subExpiry).getTime();
      if (editForm.daysToAdd) {
        const base = editingStudent.subExpiry && editingStudent.subExpiry > Date.now()
          ? editingStudent.subExpiry
          : Date.now();
        subExpiry = base + parseInt(editForm.daysToAdd) * 86400000;
      }
      if (editForm.subType === 'none') { subExpiry = null; subStart = null; }

      const updated = { 
        ...editingStudent, 
        subType: editForm.subType, 
        subStart, 
        subExpiry, 
        subPrice: price,
        totalPaid,
        paymentHistory: history,
        cancelReason: editForm.cancelReason
      };

      // Optimistic update
      useTeacherStore.getState().setStudents(students.map(s => s.id === editingStudent.id ? updated as Student : s));

      await saveStudent(updated);
      showToast('✅ تم تسجيل الدفعة بنجاح وتحديث الاشتراك');
      setEditingStudent(null);
    } catch {
      showToast('❌ حدث خطأ أثناء التحديث');
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

  const sendPaymentReport = (student: Student) => {
    if (!student.paymentHistory || student.paymentHistory.length === 0) {
      showToast('⚠️ لا يوجد تاريخ مدفوعات لهذا الطالب بعد');
      return;
    }

    const historyLines = student.paymentHistory.map((h, i) => {
      const date = new Date(h.date).toLocaleDateString('ar-EG');
      return `🔹 ${date}: *${h.amount} ج.م* (${translateSubType(h.type)})`;
    }).join('\n');

    const msg = [
      `📊 *تقرير مدفوعات الطالب: ${student.name}*`,
      `---`,
      `✅ *إجمالي المدفوعات:* ${totalPaidOf(student).toLocaleString()} ج.م`,
      `📅 *تاريخ التقرير:* ${new Date().toLocaleDateString('ar-EG')}`,
      `---`,
      `📈 *تفاصيل الدفعات:*`,
      historyLines,
      `---`,
      `🎓 أكاديمية ${user?.name || 'A-N'}`
    ].join('\n');

    const phone = cleanWhatsAppPhone(student.parentPhone || student.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openApproveModal = async (req: any, type: 'new' | 'renewal') => {
    // Initial dates calculation
    const now = new Date();
    const daysMap: Record<string, number> = { monthly: 30, halfYearly: 180, yearly: 365, course: 730, session: 1 };
    
    let subStartTs = Date.now();
    let subExpiryTs: number | null = null;

    if (type === 'renewal') {
      const existingStudent = students.find(s => s.id === req.studentId || normalizePhone(s.phone) === normalizePhone(req.phone));
      subStartTs = existingStudent?.subExpiry && existingStudent.subExpiry > Date.now()
        ? existingStudent.subExpiry
        : Date.now();
    }

    const days = daysMap[req.subType as string] || 30;
    subExpiryTs = subStartTs + (days * 86400000);

    // UNIFIED CODE LOGIC: Prioritize code from registration request, fallback to aggressive DB search
    let code = req.existingCode || '';
    
    if (!code && req.phone) {
        try {
            const normalized = normalizePhone(req.phone);
            const enrollments = await getEnrollmentsByPhone(normalized);
            if (enrollments.length > 0 && enrollments[0].code) {
                code = enrollments[0].code;
            } else if (req.parentPhone) {
                // Try parent phone as last resort
                const normalizedParent = normalizePhone(req.parentPhone);
                const parentEnrollments = await getEnrollmentsByPhone(normalizedParent);
                if (parentEnrollments.length > 0 && parentEnrollments[0].code) {
                    code = parentEnrollments[0].code;
                }
            }
        } catch (e) {
            console.warn('Failed to find existing enrollment code:', e);
        }
    }

    if (!code) {
        const localExisting = students.find(s => s.id === req.studentId || normalizePhone(s.phone) === normalizePhone(req.phone));
        if (localExisting && localExisting.code) {
            code = localExisting.code;
        }
    }

    if (type === 'new' && !code) {
        // Only generate if absolutely no record exists anywhere
        code = generateCode();
    } else if (type === 'renewal' && !code) {
        const existingStudent = students.find(s => s.id === req.studentId || normalizePhone(s.phone) === normalizePhone(req.phone));
        code = existingStudent?.code || '';
    }

    setApprovalForm({
        subStart: new Date(subStartTs).toISOString().split('T')[0],
        subExpiry: new Date(subExpiryTs).toISOString().split('T')[0],
        code
    });
    setPendingApproval({ req, type });
  };

  const finalApprove = async () => {
    if (!pendingApproval) return;
    const { req, type } = pendingApproval;
    setSaving(true);
    try {
      const subStart = new Date(approvalForm.subStart).getTime();
      const subExpiry = new Date(approvalForm.subExpiry).getTime();
      
      let finalStudentObj: any = null;

      if (type === 'new') {
        const existingStudent = students.find(s => normalizePhone(s.phone) === normalizePhone(req.phone));
        const code = existingStudent ? existingStudent.code : (approvalForm.code || req.existingCode || generateCode());
        
        finalStudentObj = {
          name: req.name, phone: req.phone, parentPhone: req.parentPhone,
          grade: req.grade, code, subType: req.subType, subExpiry, subStart,
          subPrice: req.subPrice || 0, imageUrl: req.imageUrl || '',
          teacherId: req.teacherId, teacherCode: req.teacherCode || '',
          email: '', groupIds: [],
          notes: `تم طلب التسجيل إلكترونياً. مرجع: ${req.paymentRef || 'لا يوجد'}`,
          registeredAt: new Date().toISOString(), createdAt: Date.now()
        };
        
        if (existingStudent) {
            finalStudentObj = { ...existingStudent, ...finalStudentObj, id: existingStudent.id };
        } else {
            finalStudentObj.id = 'temp-' + Date.now();
        }

        // Optimistic UI state
        useTeacherStore.getState().setStudents(
            existingStudent ? students.map(s => s.id === existingStudent.id ? finalStudentObj as Student : s) : [...students, finalStudentObj as Student]
        );
        useTeacherStore.getState().setRegistrationRequests(registrationRequests.filter(r => r.id !== req.id));

        await saveStudent(finalStudentObj);
      } else {
        const existingStudent = students.find(s => s.id === req.studentId || normalizePhone(s.phone) === normalizePhone(req.phone));
        if (!existingStudent) throw new Error('Student not found');

        // Cumulative Revenue for approval
        const price = req.subPrice || existingStudent.subPrice || 0;
        const history = [...(existingStudent.paymentHistory || []), { date: Date.now(), amount: price, type: req.subType }];
        const totalPaid = (existingStudent.totalPaid || 0) + price;

        finalStudentObj = {
          ...existingStudent,
          subType: req.subType,
          subStart,
          subExpiry,
          subPrice: price,
          totalPaid,
          paymentHistory: history
        };

        // Optimistic UI state
        useTeacherStore.getState().setStudents(students.map(s => s.id === existingStudent.id ? finalStudentObj as Student : s));
        useTeacherStore.getState().setRegistrationRequests(registrationRequests.filter(r => r.id !== req.id));

        await saveStudent(finalStudentObj);
      }

      const subTypeMap: Record<string, string> = {
        monthly: 'شهري', halfYearly: 'نصف سنوي',
        yearly: 'سنوي', course: 'كورس كامل', session: 'بالحصة',
      };

      // Notify Student (WhatsApp)
      if (req.phone) {
        try {
          await dispatchNotification({
            teacherId: req.teacherId,
            msg: type === 'new' 
              ? `🎉 أهلاً بك يا ${req.name} في منصتنا!\n\nتم تفعيل حسابك بنجاح.\n🔑 كود الطالب الخاص بك: ${code}\nيرجى استخدامه لتسجيل الدخول الفوري.\n\nنتمنى لك رحلة تعليمية مثمرة!`
              : `✅ تم تجديد اشتراكك بنجاح يا ${req.name}!\n\n📅 تاريخ الانتهاء الجديد: ${new Date(subExpiry).toLocaleDateString('ar-EG')}\nشكراً لثقتك بنا!`,
            whatsappNumbers: [req.phone],
            channels: { inApp: false, whatsapp: true }
          });
        } catch (notifErr) { console.error('WhatsApp notify error:', notifErr); }
      }

      // Notify Student (In-App) for renewals
      if (type === 'renewal') {
          const existingStudent = students.find(s => s.id === req.studentId || s.phone === req.phone);
          if (existingStudent) {
            await dispatchNotification({
                teacherId: user?.id || '',
                msg: `✅ تم تجديد اشتراكك (${subTypeMap[req.subType] || req.subType}) حتى ${new Date(subExpiry).toLocaleDateString('ar-EG')}. أهلاً بعودتك!`,
                type: 'success',
                targetUsers: [existingStudent.id],
                channels: { inApp: true, whatsapp: false },
            });
          }
      }

      await deleteRegistrationRequest(req.id);
      showToast(`✅ تم ${type === 'new' ? 'تفعيل الطالب' : 'تجديد الاشتراك'} بنجاح! ${type === 'new' ? `كود: ${finalStudentObj.code}` : ''}`);
      setPendingApproval(null);
    } catch (e: any) {
      showToast('❌ فشل الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
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
    await openApproveModal(req, 'renewal');
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
         <button onClick={() => setActiveTab('financials')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'financials' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}>
            التقارير المالية
         </button>
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
                      <div className="text-xs text-gray-400 font-mono">{student.code.replace(/-T[A-Z0-9]+$/i, '')}</div>
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
                    {/* Financial Info */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">قيمة الاشتراك الحالي</span>
                        <span className="font-bold text-gray-300">{(student.subPrice || 0).toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-black">
                        <span className="text-gold/70">إجمالي المدفوعات</span>
                        <span className="text-gold">{(totalPaidOf(student)).toLocaleString()} ج.م</span>
                      </div>
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

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openEdit(student)} className="flex-1 min-w-[30%] bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-purple-500/20 transition-colors">
                      <RefreshCw size={12} /> تجديد
                    </button>
                    {(isExpired || isExpiring) && student.parentPhone && (
                      <button onClick={() => sendWhatsappReminder(student)} className="flex-1 min-w-[30%] bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-green-500/20 transition-colors">
                        📲 تذكير
                      </button>
                    )}
                    <button onClick={() => setReceiptStudent(student)} className="flex-1 min-w-[30%] bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                      <Printer size={12} /> إيصال
                    </button>
                    <button onClick={() => sendPaymentReport(student)} className="flex-1 min-w-[30%] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-blue-500/10 transition-colors">
                      <FileText size={12} /> تقرير مالي
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
 
      {/* === FINANCIALS TAB === */}
      {activeTab === 'financials' && (
        <FinancialReports 
          data={students.filter(s => s.subType !== 'none')} 
          type="students" 
          title="إحصائيات إيرادات الطلاب" 
        />
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
                  <div className="text-xs text-gray-400">{student.code.replace(/-T[A-Z0-9]+$/i, '')} | {translateSubType(student.subType)} | {(student.subPrice || 0)} ج.م</div>
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
                  <button onClick={() => openApproveModal(req, 'new')} className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-2 border border-green-500/20 transition-colors">
                    <CheckCircle size={16} /> مراجعة وتفعيل
                  </button>
                  <button onClick={async () => {
                    if (!confirm('رفض هذا الطلب؟')) return;
                    setRegistrationRequests(registrationRequests.filter(r => r.id !== req.id));
                    try { await deleteRegistrationRequest(req.id); showToast('✅ تم رفض الطلب'); }
                    catch { showToast('❌ فشل الرفض'); }
                  }} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/10 transition-colors">
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
                      onClick={async () => {
                        if (!confirm('رفض طلب التجديد؟')) return;
                        setRegistrationRequests(registrationRequests.filter(r => r.id !== req.id));
                        try { await deleteRegistrationRequest(req.id); showToast('✅ تم رفض طلب التجديد'); }
                        catch { showToast('❌ فشل الرفض'); }
                      }}
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

      {/* Redesigned Edit Student Modal */}
      {editingStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingStudent(null)}>
          <div className="modal-content modal-content-sm !p-0 border border-gold/20 animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-gold/5">
                <div className="min-w-0">
                    <h3 className="text-xl font-black font-cairo gold-text truncate">تعديل اشتراك</h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{editingStudent.name}</p>
                </div>
                <button 
                    onClick={() => setEditingStudent(null)} 
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
                    className="input-base w-full text-sm font-bold h-12" 
                    value={editForm.subType} 
                    onChange={e => setEditForm({...editForm, subType: e.target.value as SubType})}
                  >
                    <option value="monthly">شهري</option>
                    <option value="halfYearly">نصف سنوي</option>
                    <option value="yearly">سنوي</option>
                    <option value="course">كورس كامل</option>
                    <option value="session">بالحصة</option>
                    <option value="free">مجاني (دائم)</option>
                    <option value="none">إلغاء الاشتراك</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">قيمة الاشتراك (ج.م)</label>
                  <input 
                    type="number" 
                    className="input-base w-full text-sm font-black h-12 text-gold" 
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
                        value={editForm.subStart} 
                        onChange={e => setEditForm({...editForm, subStart: e.target.value})} 
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
                        onChange={e => { 
                            setEditForm({...editForm, subExpiry: e.target.value}); 
                            if (e.target.value) setEditForm(f => ({...f, subExpiry: e.target.value, daysToAdd: ''})); 
                        }} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Accumulate Days */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-gold" />
                    <label className="block text-xs text-gold font-bold px-1 uppercase tracking-wider">تمديد الاشتراك (إضافة أيام)</label>
                </div>
                <input 
                    type="number" 
                    placeholder="مثال: 30 لإضافة شهر على تاريخ الانتهاء الحالي" 
                    className="input-base w-full text-sm bg-black/20 h-12" 
                    value={editForm.daysToAdd} 
                    onChange={e => setEditForm({...editForm, daysToAdd: e.target.value})} 
                />
                
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between text-[11px]"><span className="text-gray-500 font-bold">تاريخ الانتهاء الحالي:</span><span className="text-gray-300">{editingStudent.subExpiry ? new Date(editingStudent.subExpiry).toLocaleDateString('ar-EG') : '—'}</span></div>
                    {editForm.daysToAdd && (
                        <div className="flex justify-between text-[11px] animate-fade-in">
                            <span className="text-gold font-bold">تاريخ الانتهاء الجديد (تقديري):</span>
                            <span className="text-gold font-black bg-gold/10 px-2 py-0.5 rounded shadow-sm">
                                {new Date((editingStudent.subExpiry && editingStudent.subExpiry > Date.now() ? editingStudent.subExpiry : Date.now()) + parseInt(editForm.daysToAdd) * 86400000).toLocaleDateString('ar-EG')}
                            </span>
                        </div>
                    )}
                </div>
              </div>

              {/* Row 4: Cancel Reason */}
              {editForm.subType === 'none' && (
                <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/20 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                      <XCircle size={16} className="text-red-400" />
                      <label className="block text-xs text-red-400 font-bold px-1 uppercase tracking-wider">سبب إلغاء الاشتراك (يظهر للطالب)</label>
                  </div>
                  <textarea 
                      placeholder="اكتب سبب إلغاء الاشتراك ليظهر للطالب عند محاولة الدخول..." 
                      className="input-base w-full text-sm bg-black/20 min-h-[80px] py-3 leading-relaxed" 
                      value={editForm.cancelReason} 
                      onChange={e => setEditForm({...editForm, cancelReason: e.target.value})} 
                  />
                </div>
              )}

              {/* Row 4: Financial Report / Payment History */}
              {editingStudent.paymentHistory && editingStudent.paymentHistory.length > 0 && (
                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3 animate-fade-in">
                   <h4 className="text-sm font-bold text-gold flex items-center gap-2"><DollarSign size={16}/> تقرير مدفوعات الطالب:</h4>
                   <div className="max-h-32 overflow-y-auto pr-1 space-y-2">
                     {editingStudent.paymentHistory.map((p, i) => (
                       <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-black/20 text-xs shadow-inner">
                          <div>
                            <span className="text-gray-400">{new Date(p.date).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                            <span className="block font-bold mt-1 text-white">{translateSubType(p.type)}</span>
                          </div>
                          <div className="font-black text-green-400">{p.amount} ج.م</div>
                       </div>
                     ))}
                   </div>
                   <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm">
                      <span className="text-gray-400">إجمالي المدفوعات:</span>
                      <span className="font-black text-gold text-lg">{editingStudent.totalPaid || 0} ج.م</span>
                   </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
             <div className="p-4 sm:p-6 border-t border-white/5 bg-white/[0.02] flex flex-wrap gap-2">
                <button onClick={() => setEditingStudent(null)} className="btn-outline flex-[0.5] h-11 sm:h-12 text-xs sm:text-sm border-white/10">إلغاء</button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-outline border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1 h-11 sm:h-12 text-xs sm:text-sm">
                  {saving ? 'جاري...' : 'حفظ كبيانات فقط'}
                </button>
                <button onClick={addPaymentAndRenew} disabled={saving} className="btn-gold flex-[1.5] bg-green-600 hover:bg-green-700 h-11 sm:h-12 text-xs sm:text-sm font-black border-none text-white shadow-lg shadow-green-900/20">
                  {saving ? 'جاري...' : '+ تسجيل دفعة وتمديد'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Redesigned Approval Confirmation Modal */}
      {pendingApproval && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPendingApproval(null)}>
          <div className="modal-content modal-content-sm !p-0 border border-gold/20 animate-scale-in">
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-gold/5">
                <div className="min-w-0">
                    <h3 className="text-xl font-black font-cairo gold-text truncate">تفعيل الطالب</h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{pendingApproval.req.name}</p>
                </div>
                <button 
                    onClick={() => setPendingApproval(null)} 
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-90"
                >
                    <X size={20}/>
                </button>
            </div>
            
            {/* Body */}
            <div className="p-5 sm:p-6 space-y-5">
                <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">نوع الطلب</span>
                        <span className="bg-gold/20 text-gold px-2 py-0.5 rounded font-black border border-gold/20">
                            {pendingApproval.type === 'new' ? 'تسجيل جديد' : 'تجديد اشتراك'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">الباقة المختارة</span>
                        <span className="text-white font-black">{translateSubType(pendingApproval.req.subType)}</span>
                    </div>
                    {pendingApproval.type === 'new' && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">كود الطالب الموحد</span>
                        <input
                            type="text"
                            value={approvalForm.code}
                            onChange={(e) => setApprovalForm({ ...approvalForm, code: e.target.value })}
                            className="input-base text-xs font-mono font-black text-gold bg-black/30 px-2 py-1 rounded border border-white/5 w-32 text-center"
                        />
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-500 font-black px-1 uppercase tracking-widest">تاريخ البداية</label>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input 
                            type="date" 
                            className="input-base w-full text-sm pl-10 h-12" 
                            value={approvalForm.subStart} 
                            onChange={e => setApprovalForm({...approvalForm, subStart: e.target.value})} 
                        />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-500 font-black px-1 uppercase tracking-widest">تاريخ الانتهاء</label>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input 
                            type="date" 
                            className="input-base w-full text-sm pl-10 h-12 font-bold" 
                            value={approvalForm.subExpiry} 
                            onChange={e => setApprovalForm({...approvalForm, subExpiry: e.target.value})} 
                        />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex gap-3 animate-pulse-slow">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-[11px] text-blue-300 leading-relaxed font-medium">
                        تم حساب التواريخ آلياً بناءً على نوع الباقة. يمكنك إجراء تعديلات نهائية قبل التفعيل. سيتم إرسال إشعار للطالب فوراً.
                    </p>
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
                className="btn-gold flex-1 h-12 text-sm justify-center shadow-lg border-b-4 border-gold-dark active:border-b-0 active:translate-y-1 transition-all"
              >
                {saving ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري التفعيل...</span>
                    </div>
                ) : 'تأكيد وتفعيل الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReceiptStudent(null)}>
          <div className="modal-content modal-content-sm bg-white text-black !p-6" id="receipt-container">
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
