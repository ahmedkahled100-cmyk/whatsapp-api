'use client';

import { useState, useEffect } from 'react';
import { getAllStudents, saveStudent, deleteStudent, getTeachers } from '@/lib/db';
import { Student, TeacherUser } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Users, User, Clock, Edit2, Trash2, X, Save, 
  Search, Filter, CreditCard, Calendar, GraduationCap, 
  UserCircle, Building, Eye, Phone, PhoneCall
} from 'lucide-react';

export default function ManageStudentsAdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    subType: 'none' as Student['subType'],
    subPrice: 0,
    subExpiry: null as number | null,
    phone: '',
    parentPhone: '',
    grade: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsData, teachersData] = await Promise.all([
        getAllStudents(),
        getTeachers()
      ]);
      setStudents(studentsData);
      setTeachers(teachersData);
    } catch(e) { 
      console.error(e); 
      showToast('خطأ في تحميل البيانات');
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setSaving(true);
    try {
      const data = { ...editingStudent, ...form };
      await saveStudent(data as any);
      showToast('تمت تحديث بيانات الطالب بنجاح');
      setEditingStudent(null);
      loadData();
    } catch(err) {
      showToast('حدث خطأ أثناء الحفظ');
    } finally { 
      setSaving(false); 
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الطالب ${name}؟`)) return;
    try {
      await deleteStudent(id);
      showToast('تم الحذف بنجاح');
      loadData();
    } catch (e: any) { 
      showToast('فشل الحذف'); 
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  const getTeacherName = (teacherId: string) => {
    return teachers.find(t => t.id === teacherId)?.name || 'غير معروف';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-purple-500/5 p-6 rounded-2xl border border-purple-500/10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-cairo font-black text-purple-400 flex items-center gap-2">
            <Users className="text-purple-500" /> إدارة جميع الطلاب
          </h1>
          <p className="text-sm text-gray-400 mt-1">عرض وتحرير بيانات الطلاب والاشتراكات عبر جميع المعلمين في المنصة.</p>
        </div>
        <div className="relative group">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو الكود..." 
            className="input-base pr-10 w-64 focus:w-80 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {editingStudent && (
        <form onSubmit={handleSubmit} className="card-base p-6 border border-purple-500/30 animate-scale-in space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Edit2 size={20} className="text-purple-400"/> تعديل طالب: {editingStudent.name}
            </h3>
            <button type="button" onClick={() => setEditingStudent(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest px-1">المعلومات الأساسية</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs mb-1 text-gray-400">الاسم الكامل</label>
                  <input type="text" className="input-base w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">الكود</label>
                  <input type="text" className="input-base w-full font-mono" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">السنة الدراسية</label>
                  <input type="text" className="input-base w-full" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})}/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">رقم الهاتف</label>
                  <input type="text" className="input-base w-full" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">رقم ولي الأمر</label>
                  <input type="text" className="input-base w-full" value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})}/>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest px-1">إدارة الاشتراك</h4>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1 text-gray-400">نوع الاشتراك</label>
                    <select className="input-base w-full" value={form.subType} onChange={e => setForm({...form, subType: e.target.value as any})}>
                      <option value="none">بدون اشتراك</option>
                      <option value="monthly">شهري</option>
                      <option value="yearly">سنوي</option>
                      <option value="session">بالحصة</option>
                      <option value="halfYearly">نصف سنوي</option>
                      <option value="course">بالكورس</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-gray-400">مبلغ الاشتراك (ج.م)</label>
                    <input type="number" className="input-base w-full" value={form.subPrice} onChange={e => setForm({...form, subPrice: parseFloat(e.target.value) || 0})}/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs mb-1 text-gray-400">تاريخ انتهاء الاشتراك</label>
                    <input type="date" className="input-base w-full" 
                      value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} 
                      onChange={e => setForm({...form, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-white/5">
            <button type="button" onClick={() => setEditingStudent(null)} className="btn-outline px-8 py-3">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-gold bg-purple-500 px-10 py-3 disabled:opacity-50 shadow-xl shadow-purple-500/20 active:scale-95 transition-all">
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </form>
      )}

      {viewingStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card-base w-full max-w-2xl border border-purple-500/30 overflow-hidden animate-scale-in">
            <div className="bg-purple-500/10 p-6 border-b border-purple-500/20 flex justify-between items-center text-right" dir="rtl">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                    {viewingStudent.name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-purple-400">{viewingStudent.name}</h3>
                    <p className="text-sm text-gray-400">كود الطالب: {viewingStudent.code}</p>
                  </div>
               </div>
               <button onClick={() => setViewingStudent(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
               </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-right" dir="rtl">
                <div className="space-y-6">
                   <div>
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">بيانات التواصل</h4>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3 text-sm">
                            <Phone size={16} className="text-blue-400" />
                            <span className="text-gray-400 min-w-24">هاتف الطالب:</span>
                            <span className="font-mono">{viewingStudent.phone || 'غير مسجل'}</span>
                         </div>
                         <div className="flex items-center gap-3 text-sm">
                            <PhoneCall size={16} className="text-green-400" />
                            <span className="text-gray-400 min-w-24">رقم ولي الأمر:</span>
                            <span className="font-mono">{viewingStudent.parentPhone || 'غير مسجل'}</span>
                         </div>
                      </div>
                   </div>

                   <div>
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">المعلم والأكاديمية</h4>
                      <div className="flex items-center gap-3 text-sm">
                         <Building size={16} className="text-orange-400" />
                         <span className="text-gray-400 min-w-24">اسم المعلم:</span>
                         <span className="font-bold">{getTeacherName(viewingStudent.teacherId)}</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">حالة الاشتراك</h4>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">نوع الباقة:</span>
                            <span className="font-black text-emerald-400 uppercase">{viewingStudent.subType}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">معدل الدفع:</span>
                            <span className="font-black text-purple-400">{viewingStudent.subPrice || 0} ج.م</span>
                         </div>
                         {viewingStudent.subExpiry && (
                           <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px]">
                              <span className="text-gray-500">تاريخ الانتهاء:</span>
                              <span className="text-gray-300">{new Date(viewingStudent.subExpiry).toLocaleDateString('ar-EG')}</span>
                           </div>
                         )}
                      </div>
                   </div>

                   <div className="text-[10px] text-gray-500 space-y-1 opacity-60">
                      <div className="flex items-center gap-1"><Clock size={10}/> مسجل منذ: {new Date(viewingStudent.createdAt || 0).toLocaleString('ar-EG')}</div>
                      <div className="flex items-center gap-1"><UserCircle size={10}/> معرف النظام: {viewingStudent.id}</div>
                   </div>
                </div>
            </div>

            <div className="bg-white/5 p-4 flex justify-center">
               <button onClick={() => setViewingStudent(null)} className="btn-gold bg-purple-600 px-12 py-2 shadow-lg shadow-purple-900/40">إغلاق النافذة</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 px-2">
          <GraduationCap size={20} className="text-gray-400" /> قائمة الطلاب المسجلين ({filteredStudents.length})
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 text-center py-20 grayscale opacity-50">
              <div className="animate-spin text-4xl mb-4 text-purple-500">⌛</div>
              جاري تحميل بيانات الطلاب...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="col-span-3 text-center py-20 text-gray-500">لا يوجد طلاب مطابقين للبحث.</div>
          ) : filteredStudents.map(s => (
            <div key={s.id} 
              className="card-base p-5 border border-white/5 hover:border-purple-500/30 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold font-cairo text-white shadow-lg shadow-blue-500/20">
                  {s.name[0]}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded-md flex items-center gap-1">
                    <Building size={10}/> {getTeacherName(s.teacherId)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <button 
                      onClick={() => setViewingStudent(s)}
                      className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white flex items-center justify-center transition-all"
                    >
                      <Eye size={14}/>
                    </button>
                    <button 
                      onClick={() => {
                        setEditingStudent(s);
                        setForm({
                          name: s.name,
                          code: s.code,
                          subType: s.subType || 'none',
                          subPrice: s.subPrice || 0,
                          subExpiry: s.subExpiry || null,
                          phone: s.phone || '',
                          parentPhone: s.parentPhone || '',
                          grade: s.grade || ''
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all"
                    >
                      <Edit2 size={14}/>
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id, s.name)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg mb-1">{s.name}</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2 py-1 rounded-lg font-bold">كود: {s.code}</div>
                {s.grade && <div className="text-[11px] text-gray-400 bg-white/5 border border-white/5 px-2 py-1 rounded-lg">{s.grade}</div>}
              </div>

              <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex justify-between items-center text-[10px] mb-2">
                  <span className="text-gray-400 font-bold flex items-center gap-1"><CreditCard size={10}/> حالة الاشتراك</span>
                  <div className="flex flex-col items-end">
                    <span className={`font-black ${!s.subExpiry || s.subExpiry > Date.now() ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.subType === 'monthly' ? 'شهري' : s.subType === 'yearly' ? 'سنوي' : s.subType === 'session' ? 'بالحصة' : s.subType === 'none' ? 'لا يوجد' : s.subType}
                      {s.subExpiry && s.subExpiry < Date.now() && ' (منتهي)'}
                    </span>
                    {s.subPrice ? <span className="text-[9px] text-purple-400 font-bold">{s.subPrice} ج.م</span> : null}
                  </div>
                </div>
                {s.subExpiry && (
                  <div className="text-[10px] text-gray-500 flex items-center gap-1 mb-2">
                    <Calendar size={10}/> تنتهي في: {new Date(s.subExpiry).toLocaleDateString('ar-EG')}
                  </div>
                )}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${!s.subExpiry || s.subExpiry > Date.now() ? 'bg-blue-500' : 'bg-red-500'}`} 
                    style={{ width: s.subType === 'none' ? '0%' : '100%' }} 
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5 text-[10px] text-gray-500 flex items-center justify-between">
                <span className="flex items-center gap-1"><Clock size={10}/> {new Date(s.createdAt || 0).toLocaleDateString('ar-EG')}</span>
                <span className="flex items-center gap-1"><UserCircle size={10}/> ID: {s.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
