'use client';
// src/components/SubscriptionExpiredOverlay.tsx

import { useState } from 'react';
import { Lock, Phone, RefreshCw, LogOut, Calendar, CreditCard, User, BookOpen } from 'lucide-react';
import type { Student, TeacherUser, Settings } from '@/types';
import { RenewalRequestModal } from './RenewalRequestModal';
import { cleanWhatsAppPhone } from '@/lib/utils';

// ============================================================
// Helper: Student WhatsApp message builder
// ============================================================
function buildStudentWhatsAppMessage(student: Student, teacherInfo: TeacherUser | null): string {
  const subTypeMap: Record<string, string> = {
    monthly: 'شهري', halfYearly: 'نصف سنوي', yearly: 'سنوي',
    course: 'كورس كامل', session: 'بالحصة', none: 'غير مشترك',
  };
  const expiry = student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : 'غير محدد';

  return [
    `📚 *طلب تواصل من طالب - منصة ${teacherInfo?.name || 'AN Academy'}*`,
    ``,
    `👤 *بيانات الطالب:*`,
    `• الاسم: ${student.name}`,
    `• كود الطالب: ${student.code}`,
    `• الهاتف: ${student.phone || 'غير محدد'}`,
    `• هاتف ولي الأمر: ${student.parentPhone || 'غير محدد'}`,
    `• الصف الدراسي: ${student.grade || 'غير محدد'}`,
    ``,
    `📋 *بيانات الاشتراك:*`,
    `• نوع الاشتراك: ${subTypeMap[student.subType] || student.subType}`,
    `• تاريخ انتهاء الاشتراك: ${expiry}`,
    `• قيمة الاشتراك: ${student.subPrice || 0} ج.م`,
    ``,
    `⚠️ *السبب:* انتهاء الاشتراك وعدم القدرة على الدخول للمنصة`,
    ``,
    `يرجى التواصل لتجديد الاشتراك. شكراً 🙏`,
  ].join('\n');
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
    `• الهاتف: ${teacher.phone || 'غير محدد'}`,
    `• المادة الدراسية: ${teacher.subject || 'غير محدد'}`,
    ``,
    `📋 *بيانات الاشتراك:*`,
    `• نوع الاشتراك: ${subTypeMap[teacher.subType || 'free'] || teacher.subType}`,
    `• تاريخ انتهاء الاشتراك: ${expiry}`,
    `• قيمة الاشتراك: ${teacher.subPrice || 0} ج.م`,
    ``,
    `⚠️ *السبب:* انتهاء اشتراك المنصة وعدم القدرة على الدخول`,
    ``,
    `يرجى التواصل لتجديد الاشتراك. شكراً 🙏`,
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
  hasMultipleAcademies?: boolean;
  onSwitchAcademy?: () => void;
  onLogout: () => void;
  onRenewalSuccess: () => void;
}

interface TeacherOverlayProps {
  target: 'teacher';
  teacher: TeacherUser;
  adminInfo: TeacherUser | null;
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
      const { student, teacherInfo, settings } = props as StudentOverlayProps;
      // Prioritize settings.whatsappNumber (teacher's support number), then teacher.phone
      phone = settings?.whatsappNumber || teacherInfo?.phone || '';
      msg = buildStudentWhatsAppMessage(student, teacherInfo);
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

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #070910 0%, #0d1117 50%, #080c12 100%)' }}
      dir="rtl"
    >
      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #f59e0b, transparent)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative w-full max-w-md animate-scale-in space-y-4">

        {/* Lock icon + status */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <Lock size={40} className="text-red-400" />
            </div>
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-sm font-black">!</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-cairo font-black text-white mb-2">
              {isStudent ? 'انتهى اشتراكك في المنصة' : 'انتهى اشتراك منصتك'}
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              {isStudent
                ? `عزيزي الطالب ${name}، انتهت صلاحية اشتراكك ولا يمكنك الوصول للمنصة حتى يتم تجديد الاشتراك.`
                : `عزيزي الأستاذ ${name}، انتهت صلاحية اشتراك منصتك ولا يمكنك الوصول حتى يتم التجديد.`}
            </p>
          </div>
        </div>

        {/* Expiry Status Card */}
        <div className="card-base p-4 border border-red-500/20 bg-red-500/5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-red-400" />
            <span className="text-red-400 font-bold text-xs uppercase tracking-wider">بيانات الاشتراك المنتهي</span>
          </div>

          {studentInfo && (
            <div className="space-y-2 text-sm">
              {[
                ['الاسم', studentInfo.name, User],
                ['كود الطالب', studentInfo.code, BookOpen],
                ['تاريخ الانتهاء', expiryDate || '—', Calendar],
                ['منذ', daysSinceExpiry ? `${daysSinceExpiry} يوم` : '—', Calendar],
              ].map(([label, value, Icon]) => (
                <div key={label as string} className="flex justify-between items-center">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    {/* @ts-ignore */}
                    <Icon size={12} className="opacity-60" />
                    {label}
                  </span>
                  <span className="text-gray-200 font-bold font-mono">{value as string}</span>
                </div>
              ))}
            </div>
          )}

          {teacherUser && (
            <div className="space-y-2 text-sm">
              {[
                ['المعلم', teacherUser.name],
                ['اسم المستخدم', `@${teacherUser.username}`],
                ['تاريخ الانتهاء', expiryDate || '—'],
                ['منذ', daysSinceExpiry ? `${daysSinceExpiry} يوم` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-200 font-bold">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {renewalSent ? (
          <div className="card-base p-5 border border-green-500/20 bg-green-500/5 text-center space-y-2">
            <div className="text-4xl">✅</div>
            <h3 className="font-bold text-green-400">تم إرسال طلب التجديد!</h3>
            <p className="text-gray-400 text-sm">
              {isStudent
                ? 'انتظر موافقة المعلم على طلب التجديد. سيتم تفعيل حسابك قريباً.'
                : 'انتظر موافقة الإدارة على طلب التجديد. سيتم تفعيل حسابك قريباً.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Renew Button */}
            <button
              onClick={() => setShowRenewalModal(true)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-cairo font-black text-base transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--gold), #e8a000)',
                color: '#000',
                boxShadow: '0 8px 30px rgba(245,197,24,0.3)',
              }}
            >
              <RefreshCw size={20} />
              🔄 تجديد الاشتراك الآن
            </button>

            {/* WhatsApp Contact Button */}
            <button
              onClick={handleContactWhatsApp}
              disabled={isContactLoading}
              className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] border ${
                isContactLoading 
                  ? 'bg-gray-500/10 border-white/5 text-gray-500 cursor-not-allowed' 
                  : 'bg-green-600/20 border-green-500/30 text-green-400 hover:bg-green-600/30'
              }`}
            >
              {isContactLoading ? (
                <>جاري تحميل بيانات التواصل...</>
              ) : (
                <>
                  <Phone size={18} />
                  {isStudent ? '📲 تواصل مع المعلم عبر واتساب' : '📲 تواصل مع الإدارة عبر واتساب'}
                </>
              )}
            </button>

            {/* Switch Academy Button */}
            {isStudent && (props as StudentOverlayProps).hasMultipleAcademies && (
              <button
                onClick={(props as StudentOverlayProps).onSwitchAcademy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw size={16} />
                العودة لاختيار الأكاديمية (معلم آخر)
              </button>
            )}

            {/* Logout */}
            <button
              onClick={props.onLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <LogOut size={14} />
              تسجيل الخروج
            </button>
          </div>
        )}
      </div>

      {/* Renewal Modal */}
      {showRenewalModal && (
        <RenewalRequestModal
          settings={isStudent ? (props as StudentOverlayProps).settings : null}
          target={isStudent ? 'student' : 'teacher'}
          userData={isStudent ? (props as StudentOverlayProps).student : (props as TeacherOverlayProps).teacher}
          onClose={() => setShowRenewalModal(false)}
          onSubmit={handleRenewalSubmit}
        />
      )}
    </div>
  );
}
