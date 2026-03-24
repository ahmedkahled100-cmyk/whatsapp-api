'use client';
// src/app/teacher/students/page.tsx

import { useState, useMemo, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { showToast } from '@/lib/toast';
import { saveStudent, deleteStudent, uploadFileToStorage, deleteRegistrationRequest, getSettings } from '@/lib/db';
import { generateCode, formatDateAr } from '@/lib/utils';
import type { Student } from '@/types';
import { UserPlus, Search, Trash2, Copy, Users, Phone, Upload, Loader2, FileSpreadsheet, Download, Edit, Eye, Printer, Calendar, Clock, Award, CheckCircle2, XCircle } from 'lucide-react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';

const EMPTY_STUDENT: Omit<Student, 'id'> = {
  name: '', code: '', email: '', phone: '', parentPhone: '',
  grade: '', groupIds: [], notes: '', subType: 'none', subPrice: 0,
  subExpiry: null, registeredAt: new Date().toLocaleDateString('ar-EG'), createdAt: Date.now(),
  imageUrl: '', teacherId: ''
};

export default function StudentsPage() {
  const { students, groups, attempts, exams, user, registrationRequests } = useTeacherStore();
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'requests'>('active');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Omit<Student, 'id'>>(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      getSettings(user.id).then(s => setSettings(s));
    }
  }, [user?.id]);

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
    setForm(f => ({ ...f, subType: newType as any, subPrice: newPrice }));
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

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('❗ أدخل اسم الطالب'); return; }
    if (!user) { showToast('❗ خطأ في الجلسة'); return; }

    const existing = students.find((s: any) => s.code === form.code);
    if (existing && existing.id !== (form as any).id) { showToast('❗ الكود مستخدم بالفعل'); return; }
    
    setSaving(true);
    try {
      await saveStudent({ 
        ...form, 
        teacherId: user.id,
        teacherCode: user.code || ''
      });
      setShowModal(false);
      showToast('✅ تم حفظ بيانات الطالب');
    } catch { showToast('فشل الحفظ'); }
    finally { setSaving(false); setUploadProgress(0); }
  };

  const handleApproveRequest = async (req: any) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveStudent({
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
        createdAt: Date.now()
      });
      await deleteRegistrationRequest(req.id);
      showToast('✅ تم قبول الطالب بنجاح');
    } catch { showToast('فشل قبول الطلب'); }
    finally { setSaving(false); }
  };

  const handleRejectRequest = async (id: string) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    try {
      await deleteRegistrationRequest(id);
      showToast('❌ تم رفض الطلب');
    } catch { showToast('فشل رفض الطلب'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف الطالب "${name}" وجميع سجلاته نهائياً؟`)) return;
    await deleteStudent(id);
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
      `"${s.subType}"`, `"${s.registeredAt}"`
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

      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'active' ? 'bg-gold text-dark' : 'text-gray-400'}`}>
          الطلاب النشطين ({students.length})
        </button>
        <button onClick={() => setActiveTab('requests')} className={`flex-1 py-3 rounded-xl font-bold transition-all relative ${activeTab === 'requests' ? 'bg-gold text-dark' : 'text-gray-400'}`}>
          طلبات التسجيل ({registrationRequests.length})
          {registrationRequests.length > 0 && activeTab !== 'requests' && (
            <span className="absolute top-2 left-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
            <input type="text" placeholder="ابحث بالاسم أو الكود أو الصف..." value={search} onChange={e => setSearch(e.target.value)} className="input-base has-icon pr-11 text-sm w-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الطلاب', value: students.length, icon: '👥' },
              { label: 'الفصول', value: groups.length, icon: '🏫' },
              { label: 'المحاولات', value: attempts.filter(a => a.completed).length, icon: '📝' },
            ].map((s, i) => (
              <div key={i} className="stat-card text-center py-3">
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
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-white/5 text-[11px] uppercase text-text-muted">
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
                      return (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {student.imageUrl ? <img src={student.imageUrl} className="w-8 h-8 rounded-full border border-white/10" alt="" /> : <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">{student.name[0]}</div>}
                              <div className="text-sm font-medium">{student.name}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><code className="bg-gold/10 text-gold px-2 py-0.5 rounded text-xs">{student.code}</code></td>
                          <td className="px-4 py-3 text-sm">{student.grade || '—'}</td>
                          <td className="px-4 py-3 text-sm text-text-muted">{studentAttempts.length} محاولة</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
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
              <div className="lg:hidden divide-y divide-white/5">
                {filtered.map(student => (
                  <div key={student.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{student.name}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{student.grade} | {student.code}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setViewStudent(student)} className="p-2 bg-white/5 rounded-lg text-green-400"><Eye size={14} /></button>
                      <button onClick={() => openEdit(student)} className="p-2 bg-white/5 rounded-lg text-blue-400"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(student.id, student.name)} className="p-2 bg-white/5 rounded-lg text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {registrationRequests.length === 0 ? (
            <div className="card-base p-12 text-center text-text-muted">📩 لا توجد طلبات جديدة</div>
          ) : (
            registrationRequests.map(req => (
              <div key={req.id} className="card-base p-5 border border-white/5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg">{req.name}</h4>
                    <p className="text-xs text-text-muted">{req.grade} | {formatDateAr(new Date(req.createdAt).toISOString())}</p>
                  </div>
                  <div className="badge badge-gold">
                    {req.subType === 'monthly' ? 'شهري' : req.subType === 'yearly' ? 'سنوي' : req.subType === 'halfYearly' ? 'نصف سنوي' : req.subType === 'course' ? 'كورس' : 'حصة'}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4 bg-white/5 p-4 rounded-xl font-cairo">
                   <div>هاتف الطالب: {req.phone}</div>
                   <div>هاتف ولي الأمر: {req.parentPhone}</div>
                   {req.paymentRef && <div className="col-span-full opacity-60">كود الدفع: {req.paymentRef}</div>}
                </div>
                <div className="flex gap-2">
                  {req.receiptUrl && <button onClick={() => window.open(req.receiptUrl, '_blank')} className="btn-outline flex-1 py-2 text-xs">👁 الإيصال</button>}
                  <button onClick={() => handleApproveRequest(req)} className="btn-gold flex-[2] py-2 text-xs">✅ قبول</button>
                  <button onClick={() => handleRejectRequest(req.id)} className="btn-danger flex-1 py-2 text-xs">❌ رفض</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Student Profile & Print Modal */}
      {viewStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm print:p-0 print:bg-white print:block overflow-y-auto">
          <div className="card-base w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black">
            {/* Header / Actions */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-[#0a0f18]/90 backdrop-blur border-b border-white/5 print:hidden">
              <h3 className="font-black text-xl gold-text flex items-center gap-2"><Eye size={24} /> ملف الطالب الشامل</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="btn-gold py-2 px-4 flex items-center gap-2"><Printer size={18} /> طباعة التقرير</button>
                <button onClick={() => setViewStudent(null)} className="btn-outline py-2 px-4">إغلاق</button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8 print:p-0" id="printable-profile">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-right border-b border-white/10 print:border-gray-200 pb-6">
                {viewStudent.imageUrl ? (
                  <img src={viewStudent.imageUrl} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gold shadow-lg object-cover" alt={viewStudent.name} />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gold bg-gold/10 flex items-center justify-center text-4xl font-black text-gold">
                    {viewStudent.name[0]}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <h2 className="text-3xl font-black text-white print:text-black">{viewStudent.name}</h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-gray-400 print:text-gray-600 font-mono">
                    <span className="bg-white/5 print:bg-gray-100 px-3 py-1 rounded-lg">الكود: {viewStudent.code}</span>
                    <span className="bg-white/5 print:bg-gray-100 px-3 py-1 rounded-lg">الصف: {viewStudent.grade || 'غير محدد'}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 justify-center sm:justify-start print:text-black">
                    <div className="flex items-center gap-2"><Phone size={16} className="text-gold" /> {viewStudent.phone || '—'} (طالب)</div>
                    {viewStudent.parentPhone && <div className="flex items-center gap-2"><Users size={16} className="text-gold" /> {viewStudent.parentPhone} (ولي أمر)</div>}
                  </div>
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
                  <strong className="text-lg print:text-black">{viewStudent.registeredAt}</strong>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-base p-6 w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4 text-gold">{(form as any).id ? '📝 تعديل بيانات طالب' : '➕ إضافة طالب جديد'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] mb-1 text-text-muted">الاسم الكامل *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-base text-sm w-full py-2" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">رقم الهاتف</label>
                <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-base text-sm w-full py-2" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">هاتف ولي الأمر</label>
                <input value={form.parentPhone || ''} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} className="input-base text-sm w-full py-2" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">الصف الدراسي</label>
                <input value={form.grade || ''} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="input-base text-sm w-full py-2" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">الكود (تلقائي)</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="input-base text-sm w-full py-2 font-mono" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">نوع الاشتراك</label>
                <select value={form.subType} onChange={e => handleSubTypeChange(e.target.value)} className="input-base text-sm w-full h-[42px]">
                  <option value="none">مجاني</option>
                  <option value="monthly">شهري</option>
                  <option value="halfYearly">نصف سنوي</option>
                  <option value="yearly">سنوي</option>
                  <option value="course">كورس</option>
                  <option value="session">بالحصة</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">مبلغ الاشتراك (ج.م)</label>
                <input type="number" value={form.subPrice || 0} onChange={e => setForm(f => ({ ...f, subPrice: Number(e.target.value) }))} className="input-base text-sm w-full py-2" />
              </div>
              <div>
                <label className="block text-[11px] mb-1 text-text-muted">تاريخ الانتهاء</label>
                <input type="date" value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} 
                  onChange={e => setForm(f => ({ ...f, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null }))} className="input-base text-sm w-full py-2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] mb-1 text-text-muted">صورة الطالب (اختياري)</label>
                <div className="flex gap-3 items-center h-12">
                  <div className="flex-1 h-full">
                    <GlobalFileUpload
                      accept="image/*"
                      variant="compact"
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
                      label={<span className="text-xs">رفع صورة</span>}
                    />
                  </div>
                  {form.imageUrl && <img src={form.imageUrl} className="w-10 h-10 rounded-full object-cover" alt="" />}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] mb-1 text-text-muted">ملاحظات</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input-base text-sm resize-none py-2" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 justify-center">{saving ? '⏳ جاري الحفظ...' : '✅ حفظ الطالب'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-profile, #printable-profile * {
            visibility: visible;
          }
          #printable-profile {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
