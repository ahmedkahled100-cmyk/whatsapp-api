'use client';
// src/app/teacher/subscriptions/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { saveStudent, deleteRegistrationRequest } from '@/lib/db';
import { CreditCard, Search, Calendar, ShieldCheck, Clock, UserX, CheckCircle, XCircle, Copy, AlertCircle, FileText, Image as ImageIcon, X, Download } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatDateAr, generateCode } from '@/lib/utils';
import { Student } from '@/types';
import { useFilePreview } from '@/components/FilePreviewModal';

export default function SubscriptionsPage() {
  const { students, groups, registrationRequests } = useTeacherStore();
  const [activeTab, setActiveTab] = useState<'current' | 'pending'>('current');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'monthly' | 'yearly' | 'halfYearly' | 'course' | 'session' | 'none'>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  
  // File Viewer
  const { openPreview, PreviewModal } = useFilePreview();

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.code.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || s.subType === filter;
      return matchSearch && matchFilter;
    });
  }, [students, search, filter]);

  const stats = useMemo(() => {
    return {
      total: students.length,
      monthly: students.filter(s => s.subType === 'monthly').length,
      halfYearly: students.filter(s => s.subType === 'halfYearly').length,
      yearly: students.filter(s => s.subType === 'yearly').length,
      course: students.filter(s => s.subType === 'course').length,
      session: students.filter(s => s.subType === 'session').length,
      none: students.filter(s => s.subType === 'none').length,
      expired: students.filter(s => s.subType !== 'none' && s.subExpiry && new Date(s.subExpiry).getTime() < Date.now()).length
    };
  }, [students]);

  const handleUpdateSubscription = async (studentId: string, subType: Student['subType'], daysToAdd?: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    let subExpiry = null;
    if (subType !== 'none' && daysToAdd) {
      const now = new Date();
      now.setDate(now.getDate() + daysToAdd);
      subExpiry = now.getTime();
    }

    try {
      await saveStudent({
        ...student,
        subType,
        subExpiry,
      });
      showToast(`تم تحديث اشتراك الطالب ${student.name} بنجاح`);
    } catch (error) {
      showToast('حدث خطأ أثناء تحديث الاشتراك');
      console.error(error);
    }
  };

  const getSubBadgeColor = (type: string) => {
    switch(type) {
      case 'yearly': return 'badge-gold';
      case 'halfYearly': return 'badge-gold';
      case 'course': return 'badge-purple';
      case 'monthly': return 'badge-blue';
      case 'session': return 'badge-purple';
      default: return 'badge-red';
    }
  };

  const translateSubType = (type: string) => {
    switch(type) {
      case 'yearly': return 'سنوي';
      case 'halfYearly': return 'نصف سنوي';
      case 'course': return 'كورس كامل';
      case 'monthly': return 'شهري';
      case 'session': return 'بالحصة';
      default: return 'بدون اشتراك';
    }
  };

  const approveRequest = async (req: any) => {
    if (!confirm(`هل أنت متأكد من قبول اشتراك الطالب ${req.name}؟`)) return;

    const code = generateCode();
    let subExpiry = null;
    const now = new Date();
    if (req.subType === 'monthly') {
      now.setDate(now.getDate() + 30);
      subExpiry = now.getTime();
    } else if (req.subType === 'halfYearly') {
      now.setDate(now.getDate() + 180);
      subExpiry = now.getTime();
    } else if (req.subType === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
      subExpiry = now.getTime();
    } else if (req.subType === 'course') {
      now.setFullYear(now.getFullYear() + 2); // Practically infinite or very long
      subExpiry = now.getTime();
    } else if (req.subType === 'session') {
      now.setDate(now.getDate() + 1);
      subExpiry = now.getTime();
    }

    try {
      await saveStudent({
        name: req.name,
        phone: req.phone,
        parentPhone: req.parentPhone,
        grade: req.grade,
        code,
        subType: req.subType,
        subExpiry,
        email: '',
        groupIds: [],
        notes: `تم طلب التسجيل إلكترونياً. رقم الإيصال / ملاحظة: ${req.paymentRef || 'لا يوجد'}`,
        registeredAt: new Date().toISOString(),
        createdAt: Date.now()
      });
      await deleteRegistrationRequest(req.id);
      showToast(`تم إضافة الطالب بنجاح! كود التفعيل: ${code}`);
    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء حفظ الطالب');
    }
  };

  const rejectRequest = async (id: string) => {
    if (!confirm('هل تريد فعلاً رفض وحذف هذا الطلب؟')) return;
    await deleteRegistrationRequest(id);
  };

  const copyRegisterLink = () => {
    const url = `${window.location.origin}/register`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openVFile = (url: string, name?: string) => {
    openPreview(url, name || 'إيصال دفع');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">إدارة الاشتراكات</h1>
          <button 
            onClick={copyRegisterLink}
            className="ml-4 flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm transition-colors text-white"
            title="نسخ رابط صفحة التسجيل للطلاب"
          >
            {copiedLink ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} className="text-gold" />}
            <span className="hidden sm:inline">{copiedLink ? 'تم النسخ!' : 'رابط التسجيل'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('current')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'current' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
          >
            المشتركين ({students.length})
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${activeTab === 'pending' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            طلبات التسجيل 
            {registrationRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white">
                {registrationRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'current' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'شهري', value: stats.monthly, icon: <Calendar size={20} className="text-blue-400" /> },
              { label: 'نصف سنوي', value: stats.halfYearly, icon: <Calendar size={20} className="text-gold" /> },
              { label: 'سنوي', value: stats.yearly, icon: <ShieldCheck size={20} className="text-gold" /> },
              { label: 'كورس كامل', value: stats.course, icon: <ShieldCheck size={20} className="text-purple-400" /> },
              { label: 'بالحصة', value: stats.session, icon: <Clock size={20} className="text-purple-400" /> },
              { label: 'غير مشتركين / منتهي', value: stats.none + stats.expired, icon: <UserX size={20} className="text-red-400" /> }
            ].map((stat, i) => (
              <div key={i} className="card-base p-4 flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-xl">{stat.icon}</div>
                <div>
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="text-xs text-gray-400">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card-base p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
              <input
                type="text"
                placeholder="ابحث باسم الطالب أو الكود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-base pr-11 text-sm w-full"
              />
            </div>
            <select 
              className="input-base text-sm py-2"
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
            >
              <option value="all">كل الطلاب</option>
              <option value="monthly">اشتراك شهري</option>
              <option value="halfYearly">نصف سنوي</option>
              <option value="yearly">اشتراك سنوي</option>
              <option value="course">كورس كامل</option>
              <option value="session">بالحصة</option>
              <option value="none">بدون اشتراك</option>
            </select>
          </div>

          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="text-xs bg-white/5 text-gray-400 uppercase">
                  <tr>
                    <th className="px-6 py-4">الطالب</th>
                    <th className="px-6 py-4">نوع الاشتراك</th>
                    <th className="px-6 py-4">تاريخ الانتهاء</th>
                    <th className="px-6 py-4">الإجراءات التلقائية</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(student => {
                    const isExpired = student.subType !== 'none' && student.subExpiry && new Date(student.subExpiry).getTime() < Date.now();
                    return (
                      <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold mb-1">{student.name}</div>
                          <div className="text-xs text-gray-500">{student.code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${getSubBadgeColor(student.subType)}`}>
                            {translateSubType(student.subType)}
                          </span>
                          {isExpired && <span className="badge badge-red ml-2 text-xs">منتهي</span>}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {student.subExpiry ? formatDateAr(new Date(student.subExpiry).toISOString()) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateSubscription(student.id, 'monthly', 30)} className="btn-outline text-xs py-1.5 px-3 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                              تجديد شهر
                            </button>
                            <button onClick={() => handleUpdateSubscription(student.id, 'session', 1)} className="btn-outline text-xs py-1.5 px-3 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                              جلسة واحدة
                            </button>
                            {student.subType !== 'none' && (
                              <button onClick={() => handleUpdateSubscription(student.id, 'none')} className="btn-outline text-xs py-1.5 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10">
                                إلغاء الاشتراك
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400">لا يوجد طلاب مطابقين للبحث</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="card-base p-5 border-blue-500/20 bg-blue-500/5 flex gap-3">
            <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-gray-300 leading-relaxed">
              هذه الطلبات مقدمة من الطلاب عبر رابط (تسجيل الدخول). بمجرد الضغط على &quot;تأكيد الدفع وقبول الطلب&quot;، 
              سيقوم النظام بإنشاء <strong>كود طالب</strong> جديد آلياً، وحفظ الطالب في قائمة طلابك 
              وتحديد فترة صلاحية اشتراكه حسب النوع الذي اختاره أوتوماتيكياً.
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {registrationRequests.length === 0 ? (
              <div className="col-span-2 card-base p-12 text-center text-gray-500">
                لا توجد أي طلبات اشتراك معلقة حالياً.
              </div>
            ) : (
              registrationRequests.map(req => (
                <div key={req.id} className="card-base p-5 border border-white/10 hover:border-gold/30 transition-colors">
                  <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{req.name}</h3>
                      <p className="text-xs text-gray-400">{formatDateAr(new Date(req.createdAt).toISOString())}</p>
                    </div>
                    <span className={`badge ${getSubBadgeColor(req.subType)} text-xs`}>
                      {translateSubType(req.subType)}
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">الصف الدراسي:</span>
                      <span className="text-gray-200">{req.grade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">رقم الطالب:</span>
                      <span className="text-gray-200" dir="ltr">{req.phone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">رقم ولي الأمر:</span>
                      <span className="text-gray-200" dir="ltr">{req.parentPhone}</span>
                    </div>
                    {req.paymentRef && (
                      <div className="mt-4 p-3 bg-white/5 rounded-lg border border-dashed border-white/10">
                        <span className="block text-xs text-gray-400 mb-1">رقم/ملاحظة التحويل (تأكيد الدفع):</span>
                        <span className="text-sm text-gold font-medium break-all">{req.paymentRef}</span>
                      </div>
                    )}
                    {req.receiptUrl && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-bold flex items-center gap-2">
                          <ImageIcon size={16} className="text-gold" />
                          صورة الإيصال
                        </span>
                        <button onClick={() => openVFile(req.receiptUrl!, `إيصال دفع - ${req.name}`)} className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1 border-white/10 hover:border-gold">
                          <FileText size={12} /> عرض صورة الحوالة
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => approveRequest(req)} 
                      className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-2 transition-colors border border-green-500/20"
                    >
                      <CheckCircle size={16} /> تأكيد وقبول الطلب
                    </button>
                    <button 
                      onClick={() => rejectRequest(req.id)} 
                      className="btn-danger w-auto px-4 py-2.5 flex justify-center items-center"
                      title="رفض وحذف الطلب"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {PreviewModal}
    </div>
  );
}
