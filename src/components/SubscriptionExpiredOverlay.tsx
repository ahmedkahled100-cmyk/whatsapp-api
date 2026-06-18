'use client';
// src/components/SubscriptionExpiredOverlay.tsx

import { useState } from 'react';
import { Lock, Phone, RefreshCw, LogOut, Calendar, CreditCard, User, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import type { Student, TeacherUser, Settings } from '@/types';
import { RenewalRequestModal } from './RenewalRequestModal';
import { cleanWhatsAppPhone } from '@/lib/utils';

// ============================================================
// Helper: Student WhatsApp message builder
// ============================================================
function buildStudentWhatsAppMessage(student: Student, teacherInfo: TeacherUser | null, isCancelled?: boolean): string {
  const subTypeMap: Record<string, string> = {
    monthly: 'شهري', halfYearly: 'نصف سنوي', yearly: 'سنوي',
    course: 'كورس كامل', session: 'بالحصة', none: 'ملغى',
  };
  const expiry = student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : 'غير محدد';

  const lines = [
    `🎓 *تواصل بشأن اشتراك منصة ${teacherInfo?.name || 'AN Academy'}*`,
    ``,
    `📝 *بيانات الطالب:* ${student.name}`,
    `🆔 *كود الطالب:* ${student.code}`,
    `📱 *الهاتف:* ${student.phone || '—'}`,
    ``,
    `📋 *حالة الاشتراك:*`,
    `• النوع: ${subTypeMap[student.subType] || student.subType}`,
    `• الصلاحية حتى: ${expiry}`,
    ``,
  ];

  if (isCancelled) {
    lines.push(`🚫 *تنبيه:* تم إيقاف الاشتراك من قِبل المعلم.`);
    if (student.cancelReason) {
      lines.push(`💬 *السبب المذكور:* ${student.cancelReason}`);
    }
    lines.push(``);
    lines.push(`أود الاستفسار عن كيفية استعادة الوصول للمنصة. شكراً لك.`);
  } else {
    lines.push(`⚠️ *تنبيه:* انتهت صلاحية الاشتراك الحالي.`);
    lines.push(``);
    lines.push(`أود تجديد اشتراكي لمتابعة الدروس والاختبارات. شكراً لك.`);
  }

  return lines.join('\n');
}

// ============================================================
// Helper: Teacher WhatsApp message builder  
// ============================================================
function buildTeacherWhatsAppMessage(teacher: TeacherUser, adminInfo: TeacherUser | null): string {
  const subTypeMap: Record<string, string> = {
    free: 'مجاني', monthly: 'شهري', yearly: 'سنوي',
  };
  const expiry = teacher.subExpiry ? new Date(teacher.subExpiry).toLocaleDateString('ar-EG') : 'غير محدد';

  return [
    `📚 *طلب تواصل من معلم - منصة AN Academy*`,
    ``,
    `👨‍🏫 *بيانات المعلم:*`,
    `• الاسم: ${teacher.name}`,
    `• اسم المستخدم: @${teacher.username}`,
    `• الكود: ${teacher.code || '—'}`,
    `• المادة: ${teacher.subject || '—'}`,
    ``,
    `📋 *بيانات الاشتراك:*`,
    `• نوع الاشتراك: ${subTypeMap[teacher.subType || 'free'] || teacher.subType}`,
    `• تاريخ الانتهاء: ${expiry}`,
    `• قيمة التجديد: ${teacher.subPrice || 0} ج.م`,
    ``,
    `⚠️ *السبب:* انتهى اشتراك المنصة الخاص بي وأود تجديد الوصول.`,
    ``,
    `يرجى التواصل لتفعيل الحساب. شكراً 🙏`,
  ].join('\n');
}

// ============================================================
// Main Component: SubscriptionExpiredOverlay
// ============================================================

interface StudentOverlayProps {
  target: 'student';
  student: Student;
  teacherInfo: TeacherUser | null;
  settings: Settings | null;
  isCancelled?: boolean;
  hasMultipleAcademies?: boolean;
  onSwitchAcademy?: () => void;
  onLogout: () => void;
  onRenewalSuccess: () => void;
}

interface TeacherOverlayProps {
  target: 'teacher';
  teacher: TeacherUser;
  adminInfo: TeacherUser | null;
  isCancelled?: boolean;
  onLogout: () => void;
  onRenewalSuccess: () => void;
}

export type SubscriptionExpiredOverlayProps = StudentOverlayProps | TeacherOverlayProps;

export function SubscriptionExpiredOverlay(props: SubscriptionExpiredOverlayProps) {
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalSent, setRenewalSent] = useState(false);

  const isStudent = props.target === 'student';

  // ---- Build info for display ----
  const name = isStudent ? (props as StudentOverlayProps).student.name : (props as TeacherOverlayProps).teacher.name;
  const expiryTs = isStudent
    ? (props as StudentOverlayProps).student.subExpiry
    : (props as TeacherOverlayProps).teacher.subExpiry;
  const expiryDate = expiryTs ? new Date(expiryTs).toLocaleDateString('ar-EG') : null;
  const daysSinceExpiry = expiryTs ? Math.abs(Math.ceil((expiryTs - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  // ---- WhatsApp handlers ----
  const handleContactWhatsApp = () => {
    let phone = '';
    let msg = '';

    if (isStudent) {
      const { student, teacherInfo, settings, isCancelled } = props as StudentOverlayProps;
      // Prioritize settings.whatsappNumber (teacher's support number), then teacher.phone
      phone = settings?.whatsappNumber || teacherInfo?.phone || '';
      msg = buildStudentWhatsAppMessage(student, teacherInfo, isCancelled);
    } else {
      const { teacher, adminInfo } = props as TeacherOverlayProps;
      // Teachers contact the platform super_admin
      phone = adminInfo?.phone || ''; 
      msg = buildTeacherWhatsAppMessage(teacher, adminInfo);
    }

    const encoded = encodeURIComponent(msg);
    const cleanPhone = cleanWhatsAppPhone(phone);
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      // Fallback: search for contact or generic message
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const isContactLoading = isStudent 
    ? !(props as StudentOverlayProps).teacherInfo && !(props as StudentOverlayProps).settings?.whatsappNumber
    : !(props as TeacherOverlayProps).adminInfo;

  // ---- Renewal submit handler ----
  const handleRenewalSubmit = async (data: {
    subType: string;
    paymentRef: string;
    receiptUrl: string;
    notes: string;
  }) => {
    const { saveRegistrationRequest, dispatchNotification } = await import('@/lib/db');

    if (isStudent) {
      const { student, teacherInfo } = props as StudentOverlayProps;
      const subTypeMap: Record<string, string> = {
        monthly: 'شهري', halfYearly: 'نصف سنوي', yearly: 'سنوي',
        course: 'كورس كامل', session: 'بالحصة',
      };

      // Save renewal request
      await saveRegistrationRequest({
        teacherId: student.teacherId,
        name: student.name,
        phone: student.phone || '',
        parentPhone: student.parentPhone || '',
        grade: student.grade || '',
        subType: data.subType as any,
        paymentRef: data.paymentRef,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        type: 'renewal',
        status: 'pending',
        studentId: student.id,
        createdAt: Date.now(),
      });

      // WhatsApp notification message to teacher
      const whatsappMsg = [
        `📢 *طلب تجديد اشتراك جديد - ${teacherInfo?.name || 'المنصة'}*`,
        ``,
        `👤 *بيانات الطالب:*`,
        `• الاسم: ${student.name}`,
        `• كود الطالب: ${student.code}`,
        `• الهاتف: ${student.phone || 'غير محدد'}`,
        `• هاتف ولي الأمر: ${student.parentPhone || 'غير محدد'}`,
        `• الصف: ${student.grade || 'غير محدد'}`,
        ``,
        `📋 *تفاصيل طلب التجديد:*`,
        `• نوع الاشتراك المطلوب: ${subTypeMap[data.subType] || data.subType}`,
        `• مرجع الدفع: ${data.paymentRef || 'لم يُحدد'}`,
        data.notes ? `• ملاحظات: ${data.notes}` : '',
        ``,
        `⏰ تاريخ الطلب: ${new Date().toLocaleDateString('ar-EG')}`,
        ``,
        `يرجى مراجعة طلب التجديد من لوحة الاشتراكات والموافقة عليه. ✅`,
      ].filter(Boolean).join('\n');

      // Send in-app notification to teacher
      await dispatchNotification({
        teacherId: student.teacherId,
        msg: `🔄 طلب تجديد اشتراك من الطالب ${student.name} (${subTypeMap[data.subType] || data.subType}) — بانتظار موافقتك`,
        type: 'warning',
        channels: { inApp: true, whatsapp: !!(teacherInfo?.phone || teacherInfo?.username) },
        whatsappNumbers: (teacherInfo?.phone || teacherInfo?.username)
          ? [(teacherInfo?.phone || teacherInfo?.username)!]
          : [],
        actionPath: '/teacher/subscriptions',
      });

    } else {
      // Teacher renewal → notify admin
      const { teacher, adminInfo } = props as TeacherOverlayProps;
      const subTypeMap: Record<string, string> = { monthly: 'شهري', yearly: 'سنوي' };

      // Save renewal request for teacher
      await saveRegistrationRequest({
        teacherId: teacher.id,
        name: teacher.name,
        phone: teacher.phone || '',
        parentPhone: teacher.phone || '',
        grade: teacher.subject || '',
        subType: data.subType as any,
        paymentRef: data.paymentRef,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        type: 'teacher_renewal',
        status: 'pending',
        studentId: teacher.id,
        subject: teacher.subject,
        createdAt: Date.now(),
      });

      // Find super_admin id to notify
      const adminId = adminInfo?.id;
      if (adminId) {
        await dispatchNotification({
          teacherId: adminId,
          msg: `🔄 طلب تجديد اشتراك من المعلم ${teacher.name} (${subTypeMap[data.subType] || data.subType}) — بانتظار موافقتك`,
          type: 'warning',
          channels: { inApp: true, whatsapp: !!(adminInfo?.phone) },
          whatsappNumbers: adminInfo?.phone ? [adminInfo.phone] : [],
          actionPath: '/admin/subscriptions',
        });
      }
    }

    setShowRenewalModal(false);
    setRenewalSent(true);
  };

  // ---- Info lines for student detail display ----
  const studentInfo = isStudent ? (props as StudentOverlayProps).student : null;
  const teacherUser = !isStudent ? (props as TeacherOverlayProps).teacher : null;

  // ---- Derived state ----
  const isCancelled = isStudent ? !!(props as StudentOverlayProps).isCancelled : !!(props as TeacherOverlayProps).isCancelled;
  const cancelReason = isStudent ? (props as StudentOverlayProps).student?.cancelReason : (props as TeacherOverlayProps).teacher?.cancelReason;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
      style={{ 
        background: 'radial-gradient(circle at 50% 50%, #0d121f 0%, #070910 100%)' 
      }}
      dir="rtl"
    >
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03] animate-pulse"
          style={{ background: isCancelled ? '#f59e0b' : '#ef4444', filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03] animate-pulse"
          style={{ background: 'var(--gold)', filter: 'blur(120px)', animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md animate-scale-in">
        <div className="card-base p-6 sm:p-8 space-y-6 border-white/10 shadow-2xl shadow-black/80 backdrop-blur-xl relative overflow-hidden group">
          {/* Top Status Bar */}
          <div className={`absolute top-0 left-0 w-full h-1.5 ${isCancelled ? 'bg-orange-500' : 'bg-red-500'} opacity-80`} />
          
          <div className="text-center space-y-4">
            <div className="relative inline-block group">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] flex items-center justify-center mx-auto border transition-transform duration-500 group-hover:rotate-6 ${
                isCancelled 
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <Lock size={40} className={isCancelled ? 'text-orange-400' : 'text-red-400'} />
              </div>
              <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#12121f] ${
                isCancelled ? 'bg-orange-500' : 'bg-red-500'
              } animate-bounce-slow`}>
                <span className="text-white text-xs font-black">!</span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white font-cairo leading-tight">
                {isCancelled 
                  ? (isStudent ? 'عذراً، اشتراكك غير مفعل' : 'تنبيه: حساب المنصة متوقف')
                  : (isStudent ? 'انتهت صلاحية اشتراكك' : 'تنبيه: اشتراك المنصة منتهي')
                }
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed px-2">
                {isCancelled
                  ? (isStudent 
                      ? `أهلاً ${name}، نأسف لإبلاغك بأن اشتراكك متوقف حالياً بناءً على تعليمات المعلم.`
                      : `أهلاً أستاذ ${name}، نأسف لإبلاغك بأن حسابك متوقف حالياً بناءً على تعليمات الإدارة.`)
                  : isStudent
                    ? `أهلاً ${name}، يؤسفنا إبلاغك بانتهاء فترة اشتراكك الحالية بالمنصة.`
                    : `أهلاً أستاذ ${name}، نود تذكيرك بانتهاء اشتراك المنصة الخاص بك.`}
              </p>
            </div>
          </div>

          {/* Cancellation Info Section */}
          {isCancelled && (
            <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
                <AlertCircle size={14} /> سبب الإيقاف
              </div>
              <p className="text-sm text-gray-200 leading-relaxed font-bold bg-black/20 p-3 rounded-xl border border-white/5">
                {cancelReason || (isStudent ? 'يرجى التواصل مع المعلم لمعرفة تفاصيل إيقاف الحساب.' : 'يرجى التواصل مع إدارة المنصة لمعرفة تفاصيل إيقاف الحساب.')}
              </p>
            </div>
          )}

          {/* Details Grid (Teacher or Student) */}
          {!isCancelled && (
            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[10px] text-gray-500 mb-1">الاسم</div>
                <div className="text-xs font-bold text-white truncate">
                  {isStudent ? studentInfo?.name : teacherUser?.name}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[10px] text-gray-500 mb-1">الكود / الكود</div>
                <div className="text-xs font-black text-gold font-mono tracking-wider">
                  {isStudent ? studentInfo?.code : (teacherUser?.code || teacherUser?.username?.slice(0, 8))}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center col-span-2">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-center gap-1">
                  <Calendar size={10} /> تاريخ الانتهاء
                </div>
                <div className="text-xs font-bold text-red-400">{expiryDate || 'منتهي'}</div>
              </div>
            </div>
          )}

          {/* Action Area */}
          {renewalSent ? (
            <div className="p-6 text-center space-y-3 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl animate-scale-in">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <RefreshCw size={24} className="animate-spin-slow" />
              </div>
              <h3 className="font-bold text-emerald-400">طلبك قيد المراجعة</h3>
              <p className="text-[11px] text-gray-400">سيتم تفعيل حسابك فور مراجعة بيانات الدفع من قِبل الإدارة.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {!isCancelled && (
                <button
                  onClick={() => setShowRenewalModal(true)}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] premium-gold-btn"
                >
                  <RefreshCw size={18} /> تجديد الاشتراك الآن
                </button>
              )}

              <button
                onClick={handleContactWhatsApp}
                disabled={isContactLoading}
                className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-xs transition-all active:scale-[0.98] border ${
                  isContactLoading 
                    ? 'bg-gray-500/10 border-white/5 text-gray-500' 
                    : 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 shadow-lg shadow-[#25D366]/5'
                }`}
              >
                {isContactLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Phone size={16} />
                    {isCancelled 
                      ? 'تواصل مع المعلم للاستفسار'
                      : isStudent ? 'تواصل مع المعلم عبر واتساب' : 'تواصل مع الدعم الفني'}
                  </>
                )}
              </button>

              <div className="flex gap-2 pt-2">
                {isStudent && (props as StudentOverlayProps).hasMultipleAcademies && (
                  <button
                    onClick={(props as StudentOverlayProps).onSwitchAcademy}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[10px] bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    تبديل الأكاديمية
                  </button>
                )}
                <button
                  onClick={props.onLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[10px] bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  بريد الخروج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRenewalModal && (
        <RenewalRequestModal
          settings={isStudent ? (props as StudentOverlayProps).settings : null}
          target={isStudent ? 'student' : 'teacher'}
          userData={isStudent ? (props as StudentOverlayProps).student : (props as TeacherOverlayProps).teacher}
          onClose={() => setShowRenewalModal(false)}
          onSubmit={handleRenewalSubmit}
        />
      )}

      <style jsx>{`
        .premium-gold-btn {
          background: linear-gradient(135deg, #f5c518 0%, #e8a000 100%);
          color: #000;
          box-shadow: 0 10px 25px -5px rgba(245, 197, 24, 0.4);
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
        .animate-spin-slow {
          animation: spin 4s linear infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
