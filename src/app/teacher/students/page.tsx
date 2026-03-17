'use client';
// src/app/teacher/students/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { showToast } from '@/lib/toast';
import { saveStudent, deleteStudent, uploadFileToStorage } from '@/lib/db';
import { generateCode, formatDateAr } from '@/lib/utils';
import type { Student } from '@/types';
import { UserPlus, Search, Trash2, Copy, Users, Phone, Upload, Loader2, FileSpreadsheet, Download, Edit } from 'lucide-react';

const EMPTY_STUDENT: Omit<Student, 'id'> = {
  name: '', code: '', email: '', phone: '', parentPhone: '',
  grade: '', groupIds: [], notes: '', subType: 'none',
  subExpiry: null, registeredAt: new Date().toLocaleDateString('ar-EG'), createdAt: Date.now(),
  imageUrl: ''
};

export default function StudentsPage() {
  const { students, groups, attempts } = useTeacherStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Omit<Student, 'id'>>(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const filtered = useMemo(() =>
    students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.includes(search.toUpperCase()) ||
      (s.grade || '').includes(search)
    ), [students, search]
  );

  const openAdd = () => {
    setForm({ ...EMPTY_STUDENT, code: generateCode() });
    setProfileImage(null);
    setUploadProgress(0);
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    setForm(student);
    setProfileImage(null);
    setUploadProgress(0);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('❗ أدخل اسم الطالب'); return; }
    // Check if code is used by another student
    const existing = students.find((s: any) => s.code === form.code);
    if (existing && existing.id !== (form as any).id) { showToast('❗ الكود مستخدم بالفعل'); return; }
    
    setSaving(true);
    try {
      await saveStudent(form);
      setShowModal(false);
    } catch { showToast('فشل الحفظ'); }
    finally { setSaving(false); setUploadProgress(0); }
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
    if (students.length === 0) {
      showToast('لا توجد بيانات لتصديرها');
      return;
    }
    
    const headers = ['الاسم', 'الكود', 'الهاتف', 'هاتف ولي الأمر', 'الصف الدراسي', 'نوع الاشتراك', 'تاريخ التسجيل'];
    const rows = filtered.map(s => [
      `"${s.name}"`, 
      `"${s.code}"`, 
      `"${s.phone || ''}"`, 
      `"${s.parentPhone || ''}"`, 
      `"${s.grade || ''}"`, 
      `"${s.subType === 'monthly' ? 'شهري' : s.subType === 'yearly' ? 'سنوي' : s.subType === 'halfYearly' ? 'نصف سنوي' : s.subType === 'course' ? 'كورس كامل' : s.subType === 'session' ? 'بالحصة' : 'بدون اشتراك'}"`,
      `"${s.registeredAt}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCSV(true);
    try {
      const text = await file.text();
      // Split by newlines, handling both \n and \r\n
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      
      if (lines.length <= 1) {
        showToast('الملف فارغ أو لا يحتوي على بيانات صحيحة.');
        return;
      }

      // Assume simple format: Name,Phone,ParentPhone,Grade
      // (Header line is skipped)
      let addedCount = 0;
      const newStudents = [];

      for (let i = 1; i < lines.length; i++) {
        const [name, phone, parentPhone, grade] = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        
        if (!name) continue; // Skip if no name

        const newStudent = {
          ...EMPTY_STUDENT,
          name,
          phone: phone || '',
          parentPhone: parentPhone || '',
          grade: grade || '',
          code: generateCode() // Generate a unique code for each
        };
        
        newStudents.push(newStudent);
      }

      // Save sequentially (or could use a batch write if using native firebase SDK)
      for (const student of newStudents) {
         await saveStudent(student);
         addedCount++;
      }

      showToast(`✅ تم إضافة ${addedCount} طالب بنجاح!`);
    } catch (err) {
      console.error(err);
      showToast('❌ حدث خطأ أثناء تحليل ملف CSV. تأكد من الصيغة: (الاسم, الهاتف, هاتف ولي الأمر, الصف)');
    } finally {
      setUploadingCSV(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-cairo font-black gold-text">👥 الطلاب ({students.length})</h1>
        <div className="flex gap-2">
          <label className="btn-outline cursor-pointer relative overflow-hidden">
            {uploadingCSV ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            <span className="hidden sm:inline">{uploadingCSV ? 'جاري الرفع...' : 'استيراد CSV'}</span>
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleCSVUpload}
              disabled={uploadingCSV}
            />
          </label>
          <button onClick={exportCSV} className="btn-outline flex items-center gap-2" title="تصدير بيانات الطلاب">
            <Download size={16} /> <span className="hidden sm:inline">تصدير CSV</span>
          </button>
          <button onClick={openAdd} className="btn-gold"><UserPlus size={16} /> إضافة طالب</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
        <input type="text" placeholder="ابحث بالاسم أو الكود أو الصف..."
          value={search} onChange={e => setSearch(e.target.value)} className="input-base has-icon pr-11 text-sm w-full" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'إجمالي الطلاب', value: students.length, icon: '👥' },
          { label: 'الفصول', value: groups.length, icon: '🏫' },
          { label: 'المحاولات', value: attempts.filter(a => a.completed).length, icon: '📝' },
        ].map((s, i) => (
          <div key={i} className="stat-card text-center py-3">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-cairo font-black" style={{ color: 'var(--gold)' }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Students Table */}
      {filtered.length === 0 ? (
        <div className="card-base p-12 text-center">
          <div className="text-5xl mb-3">👥</div>
          <p style={{ color: 'var(--text-muted)' }}>{search ? 'لا توجد نتائج' : 'لا يوجد طلاب مسجلون بعد'}</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-white/5 text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">الكود</th>
                  <th className="px-4 py-3">الصف</th>
                  <th className="px-4 py-3">المحاولات</th>
                  <th className="px-4 py-3">تاريخ التسجيل</th>
                  <th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(student => {
                  const studentAttempts = attempts.filter(a => a.studentId === student.id && a.completed);
                  const avgScore = studentAttempts.length > 0
                    ? Math.round(studentAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / studentAttempts.length)
                    : null;

                  return (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {student.imageUrl ? (
                            <img src={student.imageUrl} alt={student.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg,var(--gold),var(--accent))', color: '#000' }}>
                              {student.name[0]}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{student.name}</div>
                            {student.phone && (
                              <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <Phone size={10} /> {student.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-sm font-mono px-2 py-0.5 rounded"
                            style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--gold)' }}>
                            {student.code}
                          </code>
                          <button onClick={() => copyCode(student.code)} className="opacity-40 hover:opacity-100">
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{student.grade || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{studentAttempts.length} محاولة</span>
                          {avgScore !== null && (
                            <span className="badge" style={{ background: avgScore >= 50 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: avgScore >= 50 ? 'var(--green)' : 'var(--red)' }}>
                              {avgScore}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs opacity-60">{student.registeredAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(student)} className="btn-outline text-xs py-1.5 px-2 text-blue-400 hover:bg-blue-500/10 border-blue-500/30">
                            <Edit size={12} /> تعديل
                          </button>
                          <button onClick={() => handleDelete(student.id, student.name)} className="btn-danger text-xs py-1.5 px-2">
                            <Trash2 size={12} /> حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="lg:hidden divide-y divide-white/5">
            {filtered.map(student => {
              const studentAttempts = attempts.filter(a => a.studentId === student.id && a.completed);
              const avgScore = studentAttempts.length > 0
                ? Math.round(studentAttempts.reduce((s, a) => s + (a.finalScore ?? a.mcqScore ?? 0), 0) / studentAttempts.length)
                : null;

              return (
                <div key={student.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {student.imageUrl ? (
                        <img src={student.imageUrl} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: 'linear-gradient(135deg,var(--gold),var(--accent))', color: '#000' }}>
                          {student.name[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm">{student.name}</div>
                        <div className="text-[11px] opacity-60 mt-0.5">{student.grade || 'بدون صف'}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                          {student.code}
                        </code>
                        <button onClick={() => copyCode(student.code)} className="opacity-40 p-1">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] text-text-muted">
                        <span className="font-bold text-text ml-1">{studentAttempts.length}</span> محاولات
                      </div>
                      {avgScore !== null && (
                        <span className="badge text-[10px]" style={{ background: avgScore >= 50 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: avgScore >= 50 ? 'var(--green)' : 'var(--red)' }}>
                          {avgScore}%
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-40 italic">{student.registeredAt}</div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEdit(student)} className="btn-outline flex-1 text-xs py-2 px-3 justify-center text-blue-400">
                      <Edit size={14} /> تعديل
                    </button>
                    <button onClick={() => handleDelete(student.id, student.name)} className="btn-danger flex-1 text-xs py-2 px-3 justify-center">
                      <Trash2 size={14} /> حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="card-base p-6 w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-cairo font-bold text-lg mb-4" style={{ color: 'var(--gold)' }}>➕ إضافة طالب جديد</h3>
            <div className="space-y-3">
              {[
                { label: 'الاسم الكامل *', key: 'name', placeholder: 'اسم الطالب' },
                { label: 'الكود (تلقائي)', key: 'code', placeholder: 'كود الدخول' },
                { label: 'الصف الدراسي', key: 'grade', placeholder: 'مثال: الأول الثانوي' },
                { label: 'رقم الهاتف', key: 'phone', placeholder: '01XXXXXXXXX' },
                { label: 'هاتف ولي الأمر', key: 'parentPhone', placeholder: '01XXXXXXXXX' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                  <div className="flex gap-2">
                    <input value={(form as any)[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="input-base text-sm flex-1" />
                    {key === 'code' && (
                      <button onClick={() => setForm(f => ({ ...f, code: generateCode() }))}
                        className="btn-outline text-xs px-3 flex-shrink-0">🔄 جديد</button>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نوع الاشتراك</label>
                  <select 
                    value={form.subType} 
                    onChange={e => setForm(f => ({ ...f, subType: e.target.value as Student['subType'] }))}
                    className="input-base text-sm w-full"
                  >
                    <option value="none">بدون اشتراك (مجاني)</option>
                    <option value="monthly">شهري</option>
                    <option value="halfYearly">نصف سنوي</option>
                    <option value="yearly">سنوي</option>
                    <option value="course">كورس كامل</option>
                    <option value="session">بالحصة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ الانتهاء</label>
                  <input 
                    type="date" 
                    value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''}
                    onChange={e => setForm(f => ({ ...f, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null }))}
                    className="input-base text-sm w-full" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>صورة الطالب (اختياري)</label>
                <div className="flex items-center gap-3">
                  <label className="btn-outline cursor-pointer overflow-hidden flex items-center gap-2 flex-1 justify-center relative">
                    {uploadProgress > 0 && uploadProgress < 100 ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {uploadProgress > 0 && uploadProgress < 100 ? `جاري الرفع... ${uploadProgress}%` : 'اختر صورة للرفع'}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          showToast('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
                          return;
                        }
                        
                        setUploadProgress(10);
                        try {
                          const fileName = `${Date.now()}_${form.code || 'new'}_${file.name}`;
                          const uploadedUrl = await uploadFileToStorage(
                            file, 
                            `students/${fileName}`,
                            (progress) => setUploadProgress(progress)
                          );
                          setForm(f => ({ ...f, imageUrl: uploadedUrl }));
                        } catch (err) {
                          console.error(err);
                          showToast('فشل رفع الصورة');
                        } finally {
                          setUploadProgress(0);
                        }
                      }}
                      disabled={uploadProgress > 0 && uploadProgress < 100}
                    />
                  </label>
                  
                  {(form as any).imageUrl && (
                    <div className="flex items-center gap-2">
                      <img src={(form as any).imageUrl} alt="الطالب" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    </div>
                  )}
                </div>
                
                {/* Progress Bar inside Add Modal */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-2">
                    <div 
                      className="bg-gold h-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="ملاحظات عن الطالب..." className="input-base text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 justify-center disabled:opacity-60">
                {saving ? `⏳ جاري الحفظ... ${uploadProgress > 0 ? `(${uploadProgress}%)` : ''}` : ((form as any).id ? '✅ حفظ التعديلات' : '✅ إضافة الطالب')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
