'use client';
// src/app/teacher/students/page.tsx

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { showToast } from '@/lib/toast';
import { saveStudent, deleteStudent, uploadFileToStorage, deleteRegistrationRequest, getSettings, wipeStudentInteraction } from '@/lib/db';
import { generateCode, formatDateAr, printHtml, openStudentCardForPrint, exportBulkToPdf } from '@/lib/utils';
import type { Student } from '@/types';
import { UserPlus, Search, Trash2, Copy, Users, Phone, Upload, Loader2, FileSpreadsheet, Edit, Eye, Printer, Calendar, Clock, Award, CheckCircle2, XCircle, RotateCcw, ImageIcon, X, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { ImageModal } from '@/components/ImageModal';
import { FinancialReports } from '@/components/FinancialReports';
import Image from 'next/image';

const EMPTY_STUDENT: Omit<Student, 'id'> = {
  name: '', code: '', email: '', phone: '', parentPhone: '',
  grade: '', groupIds: [], notes: '', subType: 'none', subPrice: 0,
  subExpiry: null, registeredAt: new Date().toLocaleDateString('ar-EG'), createdAt: Date.now(),
  imageUrl: '', teacherId: ''
};

function StudentsPageContent() {
  const searchParams = useSearchParams();
  const { students, groups, attempts, exams, user, registrationRequests } = useTeacherStore();
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Omit<Student, 'id'>>(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  
  // Image Modal state
  const [selectedImg, setSelectedImg] = useState<{ src: string, alt: string } | null>(null);

  // Selection state for bulk barcode printing
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [printingBarcodes, setPrintingBarcodes] = useState(false);
  const [exportingStudent, setExportingStudent] = useState<Student | null>(null);
  const [exportingBulk, setExportingBulk] = useState(false);

  useEffect(() => {
    if (user?.id) {
      getSettings(user.id).then(setSettings);
    }
  }, [user?.id]);

  // Handle pre-fill from iLovePDF
  useEffect(() => {
    const prefillPhoto = searchParams.get('prefillPhoto');
    if (prefillPhoto) {
      setForm(prev => ({ ...prev, imageUrl: prefillPhoto }));
      setShowModal(true);
      showToast('📥 تم استلام صورة الطالب من أدوات PDF');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const handleSubTypeChange = (newType: string) => {
    let newPrice = form.subPrice || 0;
    if (settings && newType !== 'none') {
      if (newType === 'monthly') newPrice = settings.monthlyPrice || 0;
      else if (newType === 'yearly') newPrice = settings.yearlyPrice || 0;
      else if (newType === 'halfYearly') newPrice = settings.halfYearlyPrice || 0;
      else if (newType === 'course') newPrice = settings.coursePrice || 0;
      else if (newType === 'session') newPrice = settings.sessionPrice || 0;
    } else if (newType === 'none') {
      newPrice = 0;
    }
    // Clear cancelReason if re-activating subscription
    const cancelReason = newType !== 'none' ? '' : (form as any).cancelReason || '';
    setForm(f => ({ ...f, subType: newType as any, subPrice: newPrice, cancelReason }));
  };

  const filtered = useMemo(() =>
    students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.includes(search.toUpperCase()) ||
      (s.grade || '').includes(search)
    ), [students, search]
  );

  const openAdd = () => {
    setForm({ ...EMPTY_STUDENT, code: generateCode() });
    setUploadProgress(0);
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    setForm(student);
    setUploadProgress(0);
    setShowModal(true);
  };

   const handleSave = async (shouldNotify = false) => {
    if (!form.name.trim()) { showToast('❗ أدخل اسم الطالب'); return; }
    if (!user) { showToast('❗ خطأ في الجلسة'); return; }

    const studentData = { 
      ...form, 
      teacherId: user.id,
      teacherCode: user.code || '',
      id: (form as any).id || crypto.randomUUID(),
    } as Student;

    // Financial Tracking Logic
    const isNew = !(form as any).id;
    const oldStudent = isNew ? null : students.find(s => s.id === (form as any).id);
    
    let newTotal = studentData.totalPaid || 0;
    const history = [...(studentData.paymentHistory || [])];
    
    // If it's a new student with a price, or an existing student with a price change/renewal
    const subPrice = studentData.subPrice || 0;
    if (studentData.subType !== 'none' && subPrice > 0) {
       const hasChanged = isNew || (oldStudent && (oldStudent.subType !== studentData.subType || oldStudent.subExpiry !== studentData.subExpiry));
       if (hasChanged) {
          history.push({ date: Date.now(), amount: subPrice, type: studentData.subType });
          newTotal += subPrice;
       }
    }
    
    studentData.totalPaid = newTotal;
    studentData.paymentHistory = history;
    
    // Optimistic Update
    const previousStudents = [...students];
    if ((form as any).id) {
       useTeacherStore.getState().setStudents(previousStudents.map(s => s.id === (form as any).id ? studentData : s));
    } else {
       useTeacherStore.getState().setStudents([...previousStudents, studentData]);
    }

    setSaving(true);
    try {
      await saveStudent(studentData);
      setShowModal(false);
      showToast('✅ تم حفظ بيانات الطالب');
      if (shouldNotify) {
        handleWhatsAppReport(studentData);
      }
    } catch (err: any) { 
      useTeacherStore.getState().setStudents(previousStudents);
      const msg = err.message === 'DUPLICATE_CODE_OR_PHONE' ? '❗ خطأ: هذا الكود مسجل بالفعل' : (err.message || 'فشل الحفظ: يرجى التحقق من البيانات');
      showToast(msg);
      
      // Auto-revert the specific duplicate field to original if editing
      if (oldStudent && msg.includes('الكود')) {
        setForm(f => ({ ...f, code: oldStudent.code || '' }));
      }
    }
    finally { setSaving(false); setUploadProgress(0); }
  };

  const handleApproveRequest = async (req: any) => {
    if (!user) return;
    const newStudent: Student = {
      id: crypto.randomUUID(),
      name: req.name,
      phone: req.phone,
      parentPhone: req.parentPhone,
      grade: req.grade,
      subType: req.subType,
      subPrice: req.subPrice || 0,
      imageUrl: req.imageUrl || '',
      teacherId: user.id,
      teacherCode: user.code || '',
      code: generateCode(),
      groupIds: [],
      registeredAt: new Date().toLocaleDateString('ar-EG'),
      createdAt: Date.now(),
      notes: ''
    };

    // Financials for new approved student
    const approvedPrice = newStudent.subPrice || 0;
    if (newStudent.subType !== 'none' && approvedPrice > 0) {
       newStudent.paymentHistory = [{ date: Date.now(), amount: approvedPrice, type: newStudent.subType }];
       newStudent.totalPaid = approvedPrice;
    }

    // Optimistic Updates
    const prevStudents = [...students];
    const prevReqs = [...registrationRequests];
    useTeacherStore.getState().setStudents([...prevStudents, newStudent]);
    useTeacherStore.getState().setRegistrationRequests(prevReqs.filter(r => r.id !== req.id));

    setSaving(true);
    try {
      await saveStudent(newStudent);
      await deleteRegistrationRequest(req.id);
      showToast('✅ تم قبول الطالب بنجاح');
    } catch { 
      useTeacherStore.getState().setStudents(prevStudents);
      useTeacherStore.getState().setRegistrationRequests(prevReqs);
      showToast('فشل قبول الطلب'); 
    }
    finally { setSaving(false); }
  };

  const handleRejectRequest = async (id: string) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    const prevReqs = [...registrationRequests];
    useTeacherStore.getState().setRegistrationRequests(prevReqs.filter(r => r.id !== id));
    showToast('❌ تم رفض الطلب');
    try {
      await deleteRegistrationRequest(id);
    } catch { 
      useTeacherStore.getState().setRegistrationRequests(prevReqs);
      showToast('فشل رفض الطلب'); 
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف الطالب "${name}" وجميع سجلاته نهائياً؟`)) return;
    const prevStudents = [...students];
    useTeacherStore.getState().setStudents(prevStudents.filter(s => s.id !== id));
    showToast('✅ تم حذف الطالب');
    try {
      await deleteStudent(id);
    } catch {
      useTeacherStore.getState().setStudents(prevStudents);
      showToast('❌ فشل الحذف');
    }
  };

  const handleResetInteraction = async (studentId: string, name: string) => {
    if (!confirm(`هل أنت متأكد من تصفير جميع تفاعلات الطالب "${name}"؟ سيتم حذف جميع المحاولات والواجبات ونتائج الألعاب.`)) return;
    try {
      await wipeStudentInteraction(studentId);
      showToast('✅ تم تصفير تفاعلات الطالب بنجاح');
    } catch {
      showToast('❌ فشل تصفير التفاعلات');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`✅ تم نسخ كود الطالب: ${code}`);
  };

  const exportCSV = () => {
    if (students.length === 0) { showToast('لا توجد بيانات لتصديرها'); return; }
    const headers = ['الاسم', 'الكود', 'الهاتف', 'هاتف ولي الأمر', 'الصف الدراسي', 'نوع الاشتراك', 'تاريخ التسجيل'];
    const rows = filtered.map(s => [
      `"${s.name}"`, `"${s.code}"`, `"${s.phone || ''}"`, `"${s.parentPhone || ''}"`, `"${s.grade || ''}"`, 
      `"${s.subType}"`, `"${s.registeredAt ? (s.registeredAt.includes('T') ? s.registeredAt.split('T')[0] : s.registeredAt) : ''}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingCSV(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length <= 1) return;
      for (let i = 1; i < lines.length; i++) {
        const [name, phone, parentPhone, grade] = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (!name) continue;
        await saveStudent({
          ...EMPTY_STUDENT, name, phone: phone || '', parentPhone: parentPhone || '', 
          grade: grade || '', code: generateCode(), 
          teacherId: user.id,
          teacherCode: user.code || ''
        });
      }
      showToast('✅ تم استيراد الطلاب بنجاح');
    } catch { showToast('❌ خطأ في استيراد CSV'); }
    finally { setUploadingCSV(false); e.target.value = ''; }
  };

  const handleWhatsAppReport = (student: Student) => {
    if (!student.parentPhone) {
      showToast('❗ لا يوجد رقم هاتف لولي الأمر لإرسال التقرير');
      return;
    }

    const teacherName = user?.name || 'المعلم';
    const totalPaid = student.totalPaid || 0;
    const history = student.paymentHistory || [];

    // Build subscription status text
    const subTypeMap: Record<string, string> = {
      monthly: 'شهري', yearly: 'سنوي', halfYearly: 'نصف سنوي',
      course: 'كورس', session: 'بالحصة', none: 'ملغى', free: 'مجاني'
    };
    const isCancelled = student.subType === 'none';
    const isExpired = !isCancelled && student.subExpiry != null && student.subExpiry < Date.now();
    const subStatus = isCancelled ? '⛔ ملغى'
      : isExpired ? '❌ منتهي'
      : '✅ نشط';
    const expiryStr = student.subExpiry
      ? new Date(student.subExpiry).toLocaleDateString('ar-EG')
      : 'مفتوح';

    const lines = [
      `📊 *تقرير الطالب - أكاديمية ${teacherName}*`,
      ``,
      `👤 *بيانات الطالب:*`,
      `• الاسم: ${student.name}`,
      `• الكود: ${student.code.replace(/-T[A-Z0-9]+$/i, '')}`,
      `• الصف: ${student.grade || 'غير محدد'}`,
      ``,
      `🏆 *التميز والتفاعل:*`,
      `• المستوى: ${student.level || 1}`,
      `• إجمالي النقاط: 🌟 ${student.points || 0} نقطة`,
      ...(student.badges && student.badges.length > 0 ? [`• الأوسمة المكتسبة: 🏅 ${student.badges.length} وسام`] : []),
      ``,
      ...((student as any).behavioralNotes ? [
        `📝 *الملاحظات السلوكية:*`,
        `${(student as any).behavioralNotes}`,
        ``
      ] : []),
      `📋 *حالة الاشتراك:*`,
      `• النوع: ${subTypeMap[student.subType] || student.subType}`,
      `• الحالة: ${subStatus}`,
      `• تاريخ الانتهاء: ${expiryStr}`,
      `• سعر الاشتراك: ${student.subPrice || 0} ج.م`,
      ``,
    ];

    if (isCancelled && (student as any).cancelReason) {
      lines.push(`📝 *سبب إلغاء الاشتراك:*`);
      lines.push(`${(student as any).cancelReason}`);
      lines.push(``);
    }

    lines.push(`💰 *ملخص الحساب:*`);
    lines.push(`• إجمالي المدفوعات: ${totalPaid} ج.م`);
    lines.push(``);

    if (history.length > 0) {
      lines.push(`📅 *سجل العمليات:*`);
      history.slice().reverse().forEach(h => {
        const typeMap: any = { monthly: 'شهري', yearly: 'سنوي', halfYearly: 'نصف سنوي', course: 'كورس', session: 'حصة' };
        const date = new Date(h.date).toLocaleDateString('ar-EG');
        lines.push(`• ${date}: ${h.amount} ج.م (${typeMap[h.type] || h.type})`);
      });
      lines.push(``);
    }

    lines.push(`شكراً لثقتكم بنا. 🙏`);

    const msg = lines.join('\n');
    const { cleanWhatsAppPhone } = require('@/lib/utils');
    const cleanPhone = cleanWhatsAppPhone(student.parentPhone);
    
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleExportStudentCard = (student: Student) => {
    openStudentCardForPrint(student, user?.name || 'المنصة التعليمية');
    showToast('✅ تم فتح بطاقة الطالب - اختر "حفظ كـ PDF" من قائمة الطباعة');
  };

  const handleExportBulkCards = async () => {
    setExportingBulk(true);
    try {
      await exportBulkToPdf('bulk-print-container', `بطاقات_الطلاب_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('✅ تم تصدير كافة بطاقات الطلاب كـ PDF بنجاح');
    } catch (err) {
      showToast('❌ فشل تصدير ملف PDF المجمع', 'error');
    } finally {
      setExportingBulk(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-cairo font-black gold-text">👥 الطلاب ({students.length})</h1>
        <div className="flex gap-2">
          <label className="btn-outline cursor-pointer relative overflow-hidden">
            {uploadingCSV ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            <span className="hidden sm:inline">{uploadingCSV ? 'جاري الرفع...' : 'استيراد CSV'}</span>
            <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleCSVUpload} disabled={uploadingCSV} />
          </label>
          <button onClick={exportCSV} className="btn-outline flex items-center gap-2">
            <Download size={16} /> <span className="hidden sm:inline">تصدير CSV</span>
          </button>
          <button onClick={openAdd} className="btn-gold"><UserPlus size={16} /> إضافة طالب</button>
        </div>
      </div>

      {selectedStudents.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-fade-in">
          <div className="text-amber-400 font-bold text-sm">تم تحديد {selectedStudents.size} طالب</div>
          <div className="flex gap-2">
            <button onClick={() => setPrintingBarcodes(true)} className="btn-gold text-black px-4 py-1.5 rounded-lg text-sm flex items-center gap-2">
              <QrCode size={16} /> طباعة الباركود للطلاب المحددين
            </button>
            <button onClick={() => setSelectedStudents(new Set())} className="px-3 py-1.5 text-gray-400 hover:text-white transition">إلغاء التحديد</button>
          </div>
        </div>
      )}

          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم أو الكود أو الصف (امسح الباركود واضغط Enter)..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter' && filtered.length === 1) {
                  setViewStudent(filtered[0]);
                }
              }}
              className="input-base has-icon-right text-sm w-full" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الطلاب', value: students.length, icon: '👥' },
              { label: 'الفصول', value: groups.length, icon: '🏫' },
              { label: 'المحاولات', value: attempts.filter(a => a.completed).length, icon: '📝' },
            ].map((s, i) => (
              <div key={i} className="stat-card hover-premium text-center py-3">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-cairo font-black text-gold">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card-base p-12 text-center text-text-muted">
              {search ? 'لا توجد نتائج بحث' : 'لا يوجد طلاب مسجلون'}
            </div>
          ) : (
            <div className="card-base overflow-hidden">
              <div className="hidden lg:block table-container">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-white/5 text-[11px] uppercase text-text-muted">
                      <th className="px-4 py-3 w-10">
                        <input 
                          type="checkbox" 
                          className="accent-amber-500" 
                          checked={filtered.length > 0 && selectedStudents.size === filtered.length}
                          onChange={e => {
                            if (e.target.checked) setSelectedStudents(new Set(filtered.map(s => s.id)));
                            else setSelectedStudents(new Set());
                          }}
                        />
                      </th>
                      <th className="px-4 py-3">الاسم</th>
                      <th className="px-4 py-3">الكود</th>
                      <th className="px-4 py-3">الصف</th>
                      <th className="px-4 py-3">المحاولات</th>
                      <th className="px-4 py-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map(student => {
                        const studentAttempts = attempts.filter(a => a.studentId === student.id && a.completed);
                      const isCancelledByTeacher = student.subType === 'none' && !!(student as any).cancelReason;
                      const isFreeStudent = student.subType === 'none' && !(student as any).cancelReason;
                      const isExpired = !isCancelledByTeacher && !isFreeStudent && student.subExpiry != null && student.subExpiry < Date.now();
                      const isActive = student.subType !== 'none' && !isExpired;
                      return (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              className="accent-amber-500"
                              checked={selectedStudents.has(student.id)}
                              onChange={e => {
                                const newSet = new Set(selectedStudents);
                                if (e.target.checked) newSet.add(student.id);
                                else newSet.delete(student.id);
                                setSelectedStudents(newSet);
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {student.imageUrl ? (
                                <Image 
                                  src={student.imageUrl} 
                                  className="w-10 h-10 rounded-full border border-white/10 object-cover cursor-pointer hover:scale-110 hover:border-gold transition-all" 
                                  alt={student.name}
                                  width={40}
                                  height={40}
                                  onClick={() => setSelectedImg({ src: student.imageUrl!, alt: student.name })}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                                  {student.name[0]}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium">{student.name}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {isCancelledByTeacher ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">⛔ ملغى</span>
                                  ) : isFreeStudent ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-white/10 font-bold">مجاني</span>
                                  ) : isExpired ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">⚠️ منتهي</span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold">✅ نشط</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><code className="bg-gold/10 text-gold px-2 py-0.5 rounded text-xs">{student.code.replace(/-T[A-Z0-9]+$/i, '')}</code></td>
                          <td className="px-4 py-3 text-sm">{student.grade || '—'}</td>
                          <td className="px-4 py-3 text-sm text-text-muted">{studentAttempts.length} محاولة</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleWhatsAppReport(student)} className="text-emerald-400 hover:text-emerald-300 p-1 bg-white/5 rounded" title="إرسال تقرير واتساب"><Phone size={16} /></button>
                              <button onClick={() => handleResetInteraction(student.id, student.name)} className="text-orange-400 hover:text-orange-300 p-1 bg-white/5 rounded" title="تصفير التفاعل"><RotateCcw size={16} /></button>
                              <button onClick={() => handleExportStudentCard(student)} className="text-amber-400 hover:text-amber-300 p-1 bg-white/5 rounded" title="تصدير بطاقة الطالب PDF"><Download size={16} /></button>
                              <button onClick={() => setViewStudent(student)} className="text-green-400 hover:text-green-300 p-1 bg-white/5 rounded" title="تفاصيل الطالب"><Eye size={16} /></button>
                              <button onClick={() => openEdit(student)} className="text-blue-400 hover:text-blue-300 p-1 bg-white/5 rounded"><Edit size={16} /></button>
                              <button onClick={() => handleDelete(student.id, student.name)} className="text-red-400 hover:text-red-300 p-1 bg-white/5 rounded"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="lg:hidden grid grid-cols-1 gap-3 p-3">
                {filtered.map(student => {
                  const isCancelledByTeacher = student.subType === 'none' && !!(student as any).cancelReason;
                  const isFreeStudent = student.subType === 'none' && !(student as any).cancelReason;
                  const isExpired = !isCancelledByTeacher && !isFreeStudent && student.subExpiry != null && student.subExpiry < Date.now();
                  return (
                  <div key={student.id} className="card-base p-4 flex items-center justify-between border border-white/5 hover-premium">
                    <div className="flex items-center gap-3">
                      {student.imageUrl ? (
                        <Image 
                          src={student.imageUrl} 
                          className="w-10 h-10 rounded-full border border-white/10 object-cover" 
                          alt={student.name}
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                          {student.name[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm">{student.name}</div>
                        <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                          <span>{student.grade}</span>
                          <span>|</span>
                          <code className="text-gold">{student.code.replace(/-T[A-Z0-9]+$/i, '')}</code>
                          {isCancelledByTeacher ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">⛔ ملغى</span>
                          ) : isFreeStudent ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-white/10 font-bold">مجاني</span>
                          ) : isExpired ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">⚠️ منتهي</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold">✅ نشط</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleWhatsAppReport(student)} className="p-2 bg-white/5 rounded-lg text-emerald-400"><Phone size={14} /></button>
                      <button onClick={() => handleExportStudentCard(student)} className="p-2 bg-white/5 rounded-lg text-amber-400" title="تصدير بطاقة الطالب PDF"><Download size={14} /></button>
                      <button onClick={() => setViewStudent(student)} className="p-2 bg-white/5 rounded-lg text-green-400"><Eye size={14} /></button>
                      <button onClick={() => openEdit(student)} className="p-2 bg-white/5 rounded-lg text-blue-400"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(student.id, student.name)} className="p-2 bg-white/5 rounded-lg text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

      {/* Student Profile & Print Modal */}
      {viewStudent && (
        <div className="modal-overlay print:p-0 print:bg-white print:block overflow-y-auto" >
          <div className="modal-content modal-content-xl print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black">
            {/* Header / Actions */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-[#0a0f18]/90 backdrop-blur border-b border-white/5 print:hidden">
              <h3 className="font-black text-xl gold-text flex items-center gap-2"><Eye size={24} /> ملف الطالب الشامل</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const cleanPhone = require('@/lib/utils').cleanWhatsAppPhone(viewStudent.phone || viewStudent.parentPhone);
                    if (cleanPhone) {
                      const msg = `مرحباً بك في أكاديمية ${user?.name || ''} 👋\n\nكود الطالب الخاص بك هو:\n*${viewStudent.code}*\n\nيمكنك استخدام هذا الكود لتسجيل الحضور ومعرفة درجاتك.\n\nرابط الباركود:\nhttps://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${viewStudent.code}`;
                      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                    } else {
                      showToast('لا يوجد رقم هاتف صالح', 'error');
                    }
                  }} 
                  className="btn-outline border-green-500/50 text-green-400 py-2 px-4 flex items-center gap-2 print:hidden"
                  title="إرسال الباركود عبر واتساب"
                >
                  <QrCode size={18} /> إرسال الباركود
                </button>
                <button 
                  onClick={() => openStudentCardForPrint(viewStudent, user?.name || 'المنصة التعليمية')} 
                  className="btn-outline border-amber-500/50 text-amber-400 py-2 px-4 flex items-center gap-2 print:hidden"
                  title="طباعة / حفظ بطاقة الطالب كـ PDF"
                >
                  <Printer size={18} /> بطاقة / PDF
                </button>
                <button onClick={() => handleWhatsAppReport(viewStudent)} className="btn-outline border-green-500/50 text-green-400 py-2 px-4 flex items-center gap-2 print:hidden"><Phone size={18} /> تقرير واتساب</button>
                <button 
                  onClick={() => {
                    const studentAttempts = attempts.filter(a => a.studentId === viewStudent.id && a.completed);
                    const statusClass = (s: string) => s === 'passed' || s === 'true' ? 'background:#dcfce7;color:#166534' : 'background:#fee2e2;color:#991b1b';
                    const rows = studentAttempts
                      .sort((a,b) => (b.submittedAt ? new Date(b.submittedAt).getTime() : 0) - (a.submittedAt ? new Date(a.submittedAt).getTime() : 0))
                      .map(att => {
                        const mcqPoints = att.mcqScore * att.mcqTotal / 100;
                        const essayPoints = att.essayAnswers?.reduce((sum: number, ea: any) => sum + (ea.score || 0), 0) || 0;
                        const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum: number, ea: any) => sum + (ea.maxScore || 0), 0) || 0);
                        const rawScore = Math.round((mcqPoints + essayPoints) * 10) / 10;
                        const isPending = att.essayAnswers?.some((ea: any) => ea.pending);
                        const resultText = isPending ? 'انتظار' : att.passed ? 'ناجح ✅' : 'راسب ❌';
                        const bgStyle = isPending ? 'background:#f3e8ff;color:#6b21a8' : att.passed ? 'background:#dcfce7;color:#166534' : 'background:#fee2e2;color:#991b1b';
                        return `<tr style="border-bottom:1px solid #e5e7eb">
                          <td style="padding:8px 12px;font-weight:bold">${att.examTitle}</td>
                          <td style="padding:8px 12px;color:#6b7280;font-size:12px">${att.submittedAt ? new Date(att.submittedAt).toLocaleDateString('ar-EG') : '—'}</td>
                          <td style="padding:8px 12px;font-family:monospace" dir="ltr">${isPending ? 'قيد التصحيح' : rawScore + ' / ' + totalPoints}</td>
                          <td style="padding:8px 12px"><span style="padding:3px 10px;border-radius:20px;font-weight:bold;font-size:12px;${bgStyle}">${resultText}</span></td>
                        </tr>`;
                      }).join('');
                    const groupNames = groups.filter(g => viewStudent.groupIds?.includes(g.id)).map(g => g.name).join(' | ') || 'غير محدد';
                    const passCount = studentAttempts.filter(a => a.passed).length;
                    const failCount = studentAttempts.filter(a => !a.passed && !a.essayAnswers?.some((e: any) => e.pending)).length;
                    const html = `
                      <html dir="rtl"><head><meta charset="utf-8"><title>تقرير الطالب - ${viewStudent.name}</title>
                      <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
                        * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                        body { font-family:'Cairo',Arial,sans-serif; direction:rtl; padding:20px; background:#fff; }
                        @page { margin:15mm; }
                        .header { background:linear-gradient(135deg,#1a1a2e,#0f3460); color:#fbbf24; padding:20px 24px; border-radius:14px; margin-bottom:20px; display:flex; align-items:center; gap:16px; }
                        .avatar { width:64px; height:64px; border-radius:50%; border:3px solid #fbbf24; object-fit:cover; flex-shrink:0; }
                        .avatar-placeholder { width:64px; height:64px; border-radius:50%; background:#fbbf24; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:900; color:#1a1a2e; flex-shrink:0; }
                        .header-info h1 { font-size:20px; font-weight:900; }
                        .header-info p { font-size:12px; opacity:0.8; margin-top:3px; }
                        .stats { display:flex; gap:12px; margin-bottom:20px; }
                        .stat { flex:1; padding:14px; border-radius:10px; text-align:center; font-weight:bold; }
                        .stat-blue { background:#dbeafe; color:#1e40af; }
                        .stat-green { background:#dcfce7; color:#166534; }
                        .stat-red { background:#fee2e2; color:#991b1b; }
                        .stat-num { font-size:26px; font-weight:900; display:block; }
                        table { width:100%; border-collapse:collapse; font-size:13px; }
                        thead { background:#f3f4f6; }
                        th { padding:10px 12px; text-align:right; font-weight:700; color:#374151; border-bottom:2px solid #e5e7eb; }
                        td { color:#374151; }
                        tr:nth-child(even) td { background:#f9fafb; }
                        .footer { margin-top:24px; text-align:center; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:12px; }
                      </style></head><body>
                      <div class="header">
                        ${viewStudent.imageUrl ? `<img loading="lazy" src="${viewStudent.imageUrl}" class="avatar" crossorigin="anonymous" />` : `<div class="avatar-placeholder">${viewStudent.name[0]}</div>`}
                        <div class="header-info">
                          <h1>${viewStudent.name}</h1>
                          <p>الصف: ${viewStudent.grade || 'غير محدد'} | المجموعة: ${groupNames} | الكود: ${viewStudent.code.replace(/-T[A-Z0-9]+$/i,'')}</p>
                          <p>الاشتراك: ${viewStudent.subType === 'monthly' ? 'شهري' : viewStudent.subType === 'yearly' ? 'سنوي' : viewStudent.subType === 'course' ? 'كورس' : viewStudent.subType === 'session' ? 'بالحصة' : 'مجاني'} | المعلم: ${user?.name || ''}</p>
                        </div>
                      </div>
                      <div class="stats">
                        <div class="stat stat-blue"><span class="stat-num">${studentAttempts.length}</span>إجمالي الامتحانات</div>
                        <div class="stat stat-green"><span class="stat-num">${passCount}</span>ناجح</div>
                        <div class="stat stat-red"><span class="stat-num">${failCount}</span>راسب</div>
                      </div>
                      ${studentAttempts.length === 0 ? '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px">لم يكمل الطالب أي امتحانات حتى الآن.</div>' :
                        `<table><thead><tr><th>اسم الامتحان</th><th>التاريخ</th><th>الدرجة</th><th>النتيجة</th></tr></thead><tbody>${rows}</tbody></table>`
                      }
                      <div class="footer">تقرير مولّد بتاريخ ${new Date().toLocaleDateString('ar-EG')} - منصة AN Academy</div>
                      </body></html>`;
                    const win = window.open('', '_blank', 'width=850,height=680');
                    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 600); }
                  }} 
                  className="btn-gold py-2 px-4 flex items-center gap-2 print:hidden"
                >
                  <Printer size={18} /> تقرير الطالب / PDF
                </button>
                <button onClick={() => setViewStudent(null)} className="btn-outline py-2 px-4 print:hidden">إغلاق</button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8 print:p-0" id="printable-profile">
              {/* Hidden Print Card for Single Barcode */}
              <div id={`print-student-${viewStudent.id}`} className="hidden print:flex flex-col items-center text-center space-y-4">
                <div className="font-black text-xl text-black">{user?.name ? `أكاديمية ${user.name}` : 'المنصة التعليمية'}</div>
                
                {viewStudent.imageUrl && (
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-black/20 shadow-md">
                    <img loading="lazy" src={viewStudent.imageUrl} alt={viewStudent.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex justify-center my-4">
                  <QRCodeSVG value={viewStudent.code} size={150} level="H" includeMargin={true} />
                </div>
                
                <div className="font-bold text-lg text-black">{viewStudent.name}</div>
                <div className="font-mono bg-black/10 px-3 py-1 rounded text-sm text-black">{viewStudent.code.replace(/-T[A-Z0-9]+$/i, '')}</div>
                <div className="text-sm text-gray-800">{viewStudent.grade || 'طالب'}</div>
              </div>

              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-right border-b border-white/10 print:hidden pb-6">
                {viewStudent.imageUrl ? (
                  <Image 
                    src={viewStudent.imageUrl} 
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gold shadow-lg object-cover cursor-pointer hover:brightness-110 active:scale-95 transition-all" 
                    alt={viewStudent.name} 
                    width={128}
                    height={128}
                    onClick={() => setSelectedImg({ src: viewStudent.imageUrl!, alt: viewStudent.name })}
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gold bg-gold/10 flex items-center justify-center text-4xl font-black text-gold shrink-0">
                    {viewStudent.name[0]}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <h2 className="text-3xl font-black text-white">{viewStudent.name}</h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-gray-400 font-mono">
                    <span className="bg-white/5 px-3 py-1 rounded-lg">الكود: {viewStudent.code.replace(/-T[A-Z0-9]+$/i, '')}</span>
                    <span className="bg-white/5 px-3 py-1 rounded-lg">الصف: {viewStudent.grade || 'غير محدد'}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 justify-center sm:justify-start print:text-black">
                    <div className="flex items-center gap-2"><Phone size={16} className="text-gold" /> {viewStudent.phone || '—'} (طالب)</div>
                    {viewStudent.parentPhone && <div className="flex items-center gap-2"><Users size={16} className="text-gold" /> {viewStudent.parentPhone} (ولي أمر)</div>}
                  </div>
                </div>
                {/* Barcode Display */}
                <div className="bg-white p-3 rounded-2xl flex flex-col items-center justify-center border border-white/10 shrink-0 print:border-gray-300">
                  <QRCodeSVG value={viewStudent.code} size={100} level="H" includeMargin={false} />
                  <span className="text-black font-mono font-bold text-xs mt-2">{viewStudent.code.replace(/-T[A-Z0-9]+$/i, '')}</span>
                </div>
              </div>

              {/* Subscriptions Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 print:bg-gray-50 border border-white/5 print:border-gray-200 flex flex-col justify-center items-center text-center">
                  <Award size={24} className="text-gold mb-2" />
                  <span className="text-xs text-gray-400 print:text-gray-500 mb-1">الاشتراك</span>
                  <strong className="text-lg print:text-black">{viewStudent.subType === 'monthly' ? 'شهري' : viewStudent.subType === 'yearly' ? 'سنوي' : viewStudent.subType === 'course' ? 'كورس' : viewStudent.subType === 'session' ? 'بالحصة' : viewStudent.subType === 'halfYearly' ? 'نصف سنوي' : 'مجاني'}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 print:bg-gray-50 border border-white/5 print:border-gray-200 flex flex-col justify-center items-center text-center">
                  <Calendar size={24} className="text-gold mb-2" />
                  <span className="text-xs text-gray-400 print:text-gray-500 mb-1">تاريخ التسجيل</span>
                  <strong className="text-lg print:text-black">
                    {viewStudent.registeredAt ? (viewStudent.registeredAt.includes('T') ? viewStudent.registeredAt.split('T')[0] : viewStudent.registeredAt) : '—'}
                  </strong>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 print:bg-gray-50 border border-white/5 print:border-gray-200 flex flex-col justify-center items-center text-center">
                  <Clock size={24} className={viewStudent.subExpiry && new Date(viewStudent.subExpiry).getTime() < Date.now() ? "text-red-500 mb-2" : "text-gold mb-2"} />
                  <span className="text-xs text-gray-400 print:text-gray-500 mb-1">تاريخ الانتهاء</span>
                  <strong className={`text-lg print:text-black ${viewStudent.subExpiry && new Date(viewStudent.subExpiry).getTime() < Date.now() ? 'text-red-400' : ''}`}>
                    {viewStudent.subExpiry ? new Date(viewStudent.subExpiry).toLocaleDateString('ar-EG') : 'مفتوح'}
                  </strong>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 print:bg-gray-50 border border-white/5 print:border-gray-200 flex flex-col justify-center items-center text-center">
                  <FileSpreadsheet size={24} className="text-gold mb-2" />
                  <span className="text-xs text-gray-400 print:text-gray-500 mb-1">إجمالي الامتحانات</span>
                  <strong className="text-lg print:text-black">{attempts.filter(a => a.studentId === viewStudent.id && a.completed).length} امتحانات</strong>
                </div>
              </div>

              {/* Exams History */}
              <div className="space-y-4">
                <h4 className="text-xl font-bold border-b border-white/10 print:border-gray-300 pb-2 print:text-black print:mt-4">سجل الامتحانات والدرجات</h4>
                {attempts.filter(a => a.studentId === viewStudent.id && a.completed).length === 0 ? (
                  <div className="p-8 text-center text-gray-500 bg-white/5 print:bg-gray-50 rounded-2xl border border-white/5 print:border-gray-200">
                    لم يكمل الطالب أي امتحانات حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10 print:border-gray-300">
                    <table className="w-full text-right print:text-black text-sm">
                      <thead className="bg-white/5 print:bg-gray-100 border-b border-white/10 print:border-gray-300">
                        <tr>
                          <th className="p-3">اسم الامتحان</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الدرجة</th>
                          <th className="p-3">النتيجة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 print:divide-gray-200 bg-[#0a0f18] print:bg-white">
                        {attempts
                          .filter(a => a.studentId === viewStudent.id && a.completed)
                          .sort((a,b) => (b.submittedAt ? new Date(b.submittedAt).getTime() : 0) - (a.submittedAt ? new Date(a.submittedAt).getTime() : 0))
                          .map(att => {
                            const exam = exams?.find((e: any) => e.id === att.examId);
                            const mcqPoints = att.mcqScore * att.mcqTotal / 100;
                            const essayPoints = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
                            const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
                            const rawScore = Math.round((mcqPoints + essayPoints) * 10) / 10;
                            const isPending = att.essayAnswers?.some(ea => ea.pending);

                            return (
                              <tr key={att.id} className="hover:bg-white/5 print:hover:bg-gray-50 transition-colors">
                                <td className="p-3 font-bold">{att.examTitle}</td>
                                <td className="p-3 text-gray-400 print:text-gray-600">{att.submittedAt ? new Date(att.submittedAt).toLocaleDateString('ar-EG') : '—'}</td>
                                <td className="p-3 font-mono" dir="ltr">
                                  {isPending ? <span className="text-purple-400">قيد التصحيح</span> : `${rawScore} / ${totalPoints}`}
                                </td>
                                <td className="p-3">
                                  {isPending ? (
                                    <span className="px-2 py-1 rounded bg-purple-500/20 print:bg-purple-100 text-purple-400 print:text-purple-700 text-xs font-bold inline-block">انتظار</span>
                                  ) : att.passed ? (
                                    <span className="flex items-center gap-1 text-green-500 print:text-green-700 font-bold"><CheckCircle2 size={16} /> ناجح</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-red-500 print:text-red-700 font-bold"><XCircle size={16} /> راسب</span>
                                  )}
                                </td>
                              </tr>
                            );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Bulk Printing Modal */}
      {printingBarcodes && (
        <div className="modal-overlay overflow-y-auto" >
          <div className="modal-content modal-content-xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-[#0a0f18]/90 backdrop-blur border-b border-white/5">
              <h3 className="font-black text-xl gold-text flex items-center gap-2"><QrCode size={24} /> طباعة باركود الطلاب ({selectedStudents.size})</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const selected = students.filter(s => selectedStudents.has(s.id));
                    sessionStorage.setItem('bulkPrintStudents', JSON.stringify({
                      students: selected,
                      teacherName: user?.name || 'المنصة التعليمية'
                    }));
                    window.open('/bulk-print-cards', '_blank');
                    showToast(`✅ تم فتح صفحة الطباعة المجمعة`);
                  }} 
                  className="btn-gold py-2 px-4 flex items-center gap-2"
                >
                  <Printer size={18} /> طباعة البطاقات المجمعة
                </button>
                <button onClick={() => setPrintingBarcodes(false)} className="btn-outline py-2 px-4">إغلاق</button>
              </div>
            </div>

            {/* Card Previews Grid */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.filter(s => selectedStudents.has(s.id)).map(student => (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-amber-400/40 hover:border-amber-400 transition-all cursor-pointer hover:shadow-amber-500/20 hover:shadow-xl"
                  onClick={() => openStudentCardForPrint(student, user?.name || 'المنصة التعليمية')}
                  title="اضغط لطباعة / تصدير PDF هذه البطاقة"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0f3460] px-4 py-2 text-center">
                    <span className="text-amber-400 font-black text-xs">⭐ أكاديمية {user?.name || 'المنصة التعليمية'} ⭐</span>
                  </div>

                  {/* Card Body */}
                  <div className="flex items-center gap-3 p-3">
                    {student.imageUrl ? (
                      <Image
                        src={student.imageUrl}
                        alt={student.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                        {student.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-black text-gray-800 text-sm leading-tight truncate">{student.name}</div>
                      {student.grade && <div className="text-xs text-gray-500 mt-0.5">📚 {student.grade}</div>}
                      <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block tracking-wider">
                        {student.code.replace(/-T[A-Z0-9]+$/i, '')}
                      </div>
                    </div>
                    <div className="flex-shrink-0 border border-gray-200 rounded-lg p-1 bg-white">
                      <QRCodeSVG value={student.code} size={52} level="H" includeMargin={false} fgColor="#0f3460" />
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="bg-amber-400 px-3 py-1 flex justify-between items-center">
                    <span className="text-xs font-bold text-[#1a1a2e]">🖨️ اضغط للطباعة</span>
                    <span className="text-xs font-bold text-[#1a1a2e]">امسح للحضور</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-gold flex items-center gap-2">
                {(form as any).id ? <Edit size={20} /> : <UserPlus size={20} />}
                {(form as any).id ? 'تعديل بيانات طالب' : 'إضافة طالب جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">الاسم الكامل *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-base text-sm w-full py-2.5" placeholder="أدخل اسم الطالب رباعي..." />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">رقم الهاتف</label>
                  <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-base text-sm w-full py-2.5" placeholder="01xxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">هاتف ولي الأمر</label>
                  <input value={form.parentPhone || ''} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} className="input-base text-sm w-full py-2.5" placeholder="01xxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">الصف الدراسي</label>
                  <input value={form.grade || ''} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="input-base text-sm w-full py-2.5" placeholder="مثلاً: الصف الأول الثانوي" />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">الكود (تلقائي)</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="input-base text-sm w-full py-2.5 font-mono text-gold bg-gold/5" />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">كود QR (للحضور)</label>
                  <input value={(form as any).qrCodeId || ''} onChange={e => setForm(f => ({ ...f, qrCodeId: e.target.value } as any))} className="input-base text-sm w-full py-2.5 font-mono text-gold bg-gold/5" placeholder="امسح الباركود..." />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">نوع الاشتراك</label>
                  <select value={form.subType} onChange={e => handleSubTypeChange(e.target.value)} className="input-base text-sm w-full h-[46px]">
                    <option value="none">مجاني</option>
                    <option value="monthly">شهري</option>
                    <option value="halfYearly">نصف سنوي</option>
                    <option value="yearly">سنوي</option>
                    <option value="course">كورس</option>
                    <option value="session">بالحصة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">مبلغ الاشتراك (ج.م)</label>
                  <input type="number" value={form.subPrice || 0} onChange={e => setForm(f => ({ ...f, subPrice: Number(e.target.value) }))} className="input-base text-sm w-full py-2.5" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">تاريخ الانتهاء <span className="text-text-muted/50 normal-case font-normal">(سينتهي عند نهاية هذا اليوم)</span></label>
                  <input
                    type="date"
                    value={form.subExpiry ? (() => { const d = new Date(form.subExpiry); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; })() : ''}
                    onChange={e => {
                      if (!e.target.value) { setForm(f => ({ ...f, subExpiry: null })); return; }
                      // Set to end of the selected day (23:59:59.999) in local timezone
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
                      setForm(f => ({ ...f, subExpiry: endOfDay.getTime() }));
                    }}
                    className="input-base text-sm w-full py-2.5"
                  />
                  {form.subExpiry && (
                    <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                      <Clock size={11} />
                      ينتهي: {new Date(form.subExpiry).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">صورة الطالب (اختياري)</label>
                  <div className="flex gap-4 items-center p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex-1">
                      <GlobalFileUpload
                        accept="image/*"
                        variant="compact"
                        needCrop={true}
                        circularCrop={true}
                        cropAspect={1}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadProgress(10);
                          try {
                            const url = await uploadFileToStorage(file, `students/${Date.now()}_${file.name}`, p => setUploadProgress(p));
                            setForm(f => ({ ...f, imageUrl: url }));
                          } catch { showToast('فشل رفع الصورة'); }
                          finally { setUploadProgress(0); }
                        }}
                        isUploading={uploadProgress > 0}
                        label={<div className="flex items-center gap-2"><Upload size={14} /> رفع صورة</div>}
                      />
                    </div>
                    {form.imageUrl ? (
                      <div className="relative group">
                        <Image src={form.imageUrl} className="w-14 h-14 rounded-full object-cover border-2 border-gold shadow-lg" alt="" width={56} height={56} />
                        <button onClick={() => setForm(f => ({ ...f, imageUrl: '' }))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-text-muted">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                </div>
                {/* Cancel Reason — only shown when subType is 'none' */}
                {form.subType === 'none' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                      <XCircle size={12} className="text-red-400" />
                      سبب إلغاء الاشتراك <span className="text-red-400">(سيُعرض للطالب)</span>
                    </label>
                    <textarea
                      value={(form as any).cancelReason || ''}
                      onChange={e => setForm(f => ({ ...f, cancelReason: e.target.value } as any))}
                      rows={2}
                      className="input-base text-sm resize-none py-3 border-red-500/20 focus:border-red-500/40"
                      placeholder="مثال: عدم الانتظام في الحضور، عدم سداد الاشتراك..."
                    />
                    <p className="text-[11px] text-red-400/70 mt-1">هذا السبب سيظهر للطالب عند محاولة الدخول للمنصة ويُرسل في رسالة الواتساب.</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">ملاحظات إضافية</label>
                  <textarea 
                    value={form.notes || ''} 
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
                    rows={2} 
                    className="input-base text-sm resize-none py-3" 
                    placeholder="أي ملاحظات تخص الطالب (ستكون مخفية عن الطالب)..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] mb-1.5 text-text-muted font-bold uppercase tracking-wider">الملاحظات السلوكية (سجل الطالب)</label>
                  <textarea 
                    value={(form as any).behavioralNotes || ''} 
                    onChange={e => setForm(f => ({ ...f, behavioralNotes: e.target.value } as any))} 
                    rows={2} 
                    className="input-base text-sm resize-none py-3" 
                    placeholder="تسجيل غياب متكرر، سلوك الطالب، تنبيهات..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer gap-2">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1 py-3">إلغاء</button>
              {form.subType === 'none' && (
                <button 
                  onClick={() => handleSave(true)} 
                  disabled={saving} 
                  className="btn-gold flex-[2] justify-center py-3 shadow-xl bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50"
                  title="حفظ وإرسال سبب الإلغاء عبر واتساب"
                >
                  {saving ? <Loader2 size={18} className="animate-spin ml-2" /> : <><Phone size={14} className="ml-2" /> حفظ وإبلاغ</>}
                </button>
              )}
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-gold flex-[2] justify-center py-3 shadow-xl">
                {saving ? <><Loader2 size={18} className="animate-spin ml-2" /> جاري الحفظ...</> : '✅ حفظ البيانات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal overlay */}
      {selectedImg && (
        <ImageModal 
          src={selectedImg.src} 
          alt={selectedImg.alt} 
          onClose={() => setSelectedImg(null)} 
        />
      )}

    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center opacity-50 font-cairo">جاري تحميل إدارة الطلاب...</div>}>
      <StudentsPageContent />
    </Suspense>
  );
}
