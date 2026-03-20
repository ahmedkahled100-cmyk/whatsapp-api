'use client';
// src/app/admin/teachers/page.tsx

import { useState, useEffect } from 'react';
import { getTeachers, saveTeacher, deleteTeacher, updateSuperAdminCredentials, getSuperAdmin, getSettings } from '@/lib/db';
import { TeacherUser, Settings as PlatformSettings } from '@/types';
import { showToast } from '@/lib/toast';
import { UserPlus, Shield, User, Clock, Edit2, Trash2, X, Save, Lock, LayoutDashboard, Bell, FileText, Users, CreditCard, BookMarked, ClipboardList, Calendar, Bot, BarChart2, Check, ExternalLink } from 'lucide-react';
import { useTeacherStore } from '@/lib/store';

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'exams', label: 'الاختبارات', icon: FileText },
  { id: 'students', label: 'الطلاب والنتائج', icon: Users },
  { id: 'subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { id: 'courses', label: 'المناهج', icon: BookMarked },
  { id: 'assignments', label: 'الواجبات', icon: ClipboardList },
  { id: 'calendar', label: 'التقويم', icon: Calendar },
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: Bot },
  { id: 'analytics', label: 'التحليلات والمقالي', icon: BarChart2 },
];

export default function ManageTeachersPage() {
  const { user: currentUser } = useTeacherStore();
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherUser | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    code: '',
    role: 'teacher' as 'super_admin' | 'teacher',
    permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
    subType: 'free' as 'free' | 'monthly' | 'yearly',
    subExpiry: null as number | null,
    subLink: '',
    subPrice: 0
  });

  const [adminForm, setAdminForm] = useState({
    username: currentUser?.username || '',
    password: '',
    confirmPassword: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [teachersList, admin] = await Promise.all([
        getTeachers(),
        getSuperAdmin()
      ]);
      setTeachers(teachersList);
      
      if (admin) {
        const s = await getSettings(admin.id);
        setPlatformSettings(s);
      }
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Auto-fill price based on subType
  useEffect(() => {
    if (!platformSettings || editingTeacher) return;
    
    if (form.subType === 'monthly') {
      setForm(f => ({ ...f, subPrice: platformSettings.monthlyPrice || 0 }));
    } else if (form.subType === 'yearly') {
      setForm(f => ({ ...f, subPrice: platformSettings.yearlyPrice || 0 }));
    } else if (form.subType === 'free') {
      setForm(f => ({ ...f, subPrice: 0 }));
    }
  }, [form.subType, platformSettings, editingTeacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || (!editingTeacher && !form.password)) { showToast('أكمل جميع الحقول المطلوبة'); return; }

    setSaving(true);
    try {
      const data = editingTeacher 
        ? { ...editingTeacher, ...form, id: editingTeacher.id }
        : { ...form, isActive: true, createdAt: Date.now() };
      
      await saveTeacher(data as any);
      showToast(editingTeacher ? 'تم تحديث الحساب' : 'تمت إضافة الحساب بنجاح');
      setShowAddForm(false);
      setEditingTeacher(null);
      setForm({ 
        name: '', username: '', password: '', code: '', role: 'teacher', 
        permissions: AVAILABLE_PERMISSIONS.map(p => p.id),
        subType: 'free', subExpiry: null, subLink: '', subPrice: 0
      });
      loadData();
    } catch(err) {
      showToast('حدث خطأ');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب ${name}؟`)) return;
    try {
      await deleteTeacher(id);
      showToast('تم الحذف بنجاح');
      loadData();
    } catch (e: any) { 
      showToast(e.message || 'فشل الحذف'); 
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (adminForm.password && adminForm.password !== adminForm.confirmPassword) {
      showToast('كلمات المرور غير متطابقة');
      return;
    }
    setSaving(true);
    try {
      await updateSuperAdminCredentials(currentUser.id, adminForm.username, adminForm.password || undefined);
      showToast('تم تحديث بيانات الأدمن بنجاح');
      setAdminForm({ ...adminForm, password: '', confirmPassword: '' });
    } catch (e) { showToast('فشل التحديث'); }
    finally { setSaving(false); }
  };

  const togglePermission = (id: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(id) 
        ? f.permissions.filter(p => p !== id) 
        : [...f.permissions, id]
    }));
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex justify-between items-center bg-purple-500/5 p-6 rounded-2xl border border-purple-500/10">
        <div>
          <h1 className="text-2xl font-cairo font-black text-purple-400 flex items-center gap-2">
            <Shield className="text-purple-500" /> إدارة الحسابات والصلاحيات
          </h1>
          <p className="text-sm text-gray-400 mt-1">تخصيص كامل للمعلمين، الفصول، والميزات المتاحة لكل حساب.</p>
        </div>
        <button onClick={() => { setShowAddForm(!showAddForm); setEditingTeacher(null); }} className="btn-gold bg-purple-500 hover:bg-purple-600 shadow-purple-500/20">
          <UserPlus size={16} /> إضافة حساب جديد
        </button>
      </div>

      {(showAddForm || editingTeacher) && (
        <form onSubmit={handleSubmit} className="card-base p-6 border border-purple-500/30 animate-scale-in space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-xl flex items-center gap-2">
              {editingTeacher ? <Edit2 size={20} className="text-purple-400"/> : <UserPlus size={20} className="text-purple-400"/>}
              {editingTeacher ? `تعديل حساب: ${editingTeacher.name}` : 'إنشاء حساب جديد'}
            </h3>
            <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} className="text-gray-500 hover:text-white"><X size={20}/></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest px-1">المعلومات الأساسية</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs mb-1 text-gray-400">الاسم الكامل</label>
                  <input type="text" className="input-base w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">اسم المستخدم (Login Username)</label>
                  <input type="text" className="input-base w-full" value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase()})} required/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">كلمة السر {editingTeacher && '(اتركه فارغاً لعدم التغيير)'}</label>
                  <input type="text" className="input-base w-full" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editingTeacher}/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">كود الدخول (اختياري)</label>
                  <input type="text" className="input-base w-full" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="كود فريد"/>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-gray-400">الدور / الصلاحية</label>
                  <select className="input-base w-full" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                    <option value="teacher">معلم (لوحة قياسية)</option>
                    <option value="super_admin">مدير شامل (Super Admin)</option>
                  </select>
                </div>
              </div>

              {form.role === 'teacher' && (
                <div className="mt-4 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 space-y-4">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">إدارة اشتراك المنصة</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs mb-1 text-gray-400">نوع الاشتراك</label>
                      <select className="input-base w-full" value={form.subType} onChange={e => setForm({...form, subType: e.target.value as any})}>
                        <option value="free">مجاني (دائم)</option>
                        <option value="monthly">شهري</option>
                        <option value="yearly">سنوي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1 text-gray-400">تاريخ انتهاء الاشتراك</label>
                      <input type="date" className="input-base w-full" 
                        value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} 
                        onChange={e => setForm({...form, subExpiry: e.target.value ? new Date(e.target.value).getTime() : null})}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs mb-1 text-gray-400">رابط تجديد الاشتراك (يظهر للمعلم)</label>
                      <input type="text" className="input-base w-full" value={form.subLink} onChange={e => setForm({...form, subLink: e.target.value})} placeholder="https://..."/>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-xs mb-1 text-gray-400">مبلغ الاشتراك (بالجنيه)</label>
                       <input type="number" className="input-base w-full" value={form.subPrice || ''} onChange={e => setForm({...form, subPrice: parseFloat(e.target.value) || 0})} placeholder="0.00"/>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest px-1">الميزات والصلاحيات المخصصة</h4>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 grid grid-cols-2 gap-2">
                {AVAILABLE_PERMISSIONS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePermission(p.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                      form.permissions.includes(p.id) 
                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/10' 
                        : 'bg-white/5 border-white/5 text-gray-500 opacity-60'
                    }`}
                  >
                    <p.icon size={14} className={form.permissions.includes(p.id) ? 'text-purple-400' : ''} />
                    {p.label}
                    {form.permissions.includes(p.id) && <Check size={12} className="mr-auto" />}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 px-2 italic text-center">سيتم إخفاء الأقسام غير المحددة من لوحة تحكم المعلم.</p>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-white/5">
            <button type="button" onClick={() => { setShowAddForm(false); setEditingTeacher(null); }} className="btn-outline px-8 py-3">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-gold bg-purple-500 px-10 py-3 disabled:opacity-50 shadow-xl shadow-purple-500/20 active:scale-95 transition-all">
                {saving ? 'جاري الحفظ...' : (editingTeacher ? 'تحديث الحساب' : 'إنشاء الحساب الآن')}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 px-2">
            <Users size={18} className="text-gray-400" /> قائمة الحسابات النشطة ({teachers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? <div className="col-span-3 text-center py-20 grayscale opacity-50"><div className="animate-spin text-4xl mb-4">⌛</div>جاري التحميل...</div> : teachers.map(t => (
            <div key={t.id} 
              onClick={() => {
                setEditingTeacher(t);
                setForm({
                  name: t.name,
                  username: t.username,
                  password: '',
                  code: t.code || '',
                  role: t.role,
                  permissions: t.permissions || AVAILABLE_PERMISSIONS.map(p => p.id),
                  subType: t.subType || 'free',
                  subExpiry: t.subExpiry || null,
                  subLink: t.subLink || '',
                  subPrice: t.subPrice || 0
                });
                setShowAddForm(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="card-base p-5 border border-white/5 hover:border-purple-500/30 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl font-bold font-cairo text-white shadow-lg shadow-purple-500/20">
                  {t.name[0]}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-[10px] rounded-lg font-black tracking-wider uppercase ${t.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'bg-green-500/20 text-green-400 border border-green-500/20'}`}>
                      {t.role === 'super_admin' ? <span className="flex items-center gap-1"><Shield size={10}/> Admin</span> : <span className="flex items-center gap-1"><User size={10}/> Teacher</span>}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                        <button className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all">
                            <Edit2 size={14}/>
                        </button>
                        {t.role !== 'super_admin' && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                              <Trash2 size={14}/>
                          </button>
                        )}
                    </div>
                </div>
              </div>

              <h3 className="font-bold text-lg mb-1">{t.name}</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                  <div className="text-[11px] font-mono text-gray-400 bg-white/5 border border-white/5 px-2 py-1 rounded-lg">@{t.username}</div>
                  {t.code && <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2 py-1 rounded-lg font-bold">كود: {t.code}</div>}
              </div>

              {t.role !== 'super_admin' && (
                <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-3">
                   <div className="flex justify-between items-center text-[10px] mb-2">
                       <span className="text-gray-400 font-bold">باقة المنصة</span>
                       <div className="flex flex-col items-end">
                          <span className={`font-black ${!t.subExpiry || t.subExpiry > Date.now() ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.subType === 'yearly' ? 'سنوي' : t.subType === 'monthly' ? 'شهري' : 'مجاني'}
                            {t.subExpiry && t.subExpiry < Date.now() && ' (منتهي)'}
                          </span>
                          {t.subPrice ? <span className="text-[9px] text-purple-400 font-bold">{t.subPrice} ج.م</span> : null}
                       </div>
                    </div>
                   {t.subExpiry && (
                     <div className="text-[10px] text-gray-500 mb-2">تنتهي في: {new Date(t.subExpiry).toLocaleDateString('ar-EG')}</div>
                   )}
                   <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${!t.subExpiry || t.subExpiry > Date.now() ? 'bg-purple-500' : 'bg-red-500'}`} 
                        style={{ width: t.subType === 'free' ? '100%' : '85%' }} 
                      />
                   </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
                  {(t.permissions || AVAILABLE_PERMISSIONS.map(p => p.id)).slice(0, 5).map(pId => {
                      const p = AVAILABLE_PERMISSIONS.find(x => x.id === pId);
                      return p ? <div key={pId} className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-gray-500" title={p.label}><p.icon size={12}/></div> : null;
                  })}
                  {(t.permissions?.length || 10) > 5 && <div className="text-[10px] text-gray-600 self-center">+{ (t.permissions?.length || 10) - 5 } ميزات</div>}
              </div>
              
              <div className="pt-4 border-t border-white/5 text-[10px] text-gray-500 flex items-center justify-between">
                <span className="flex items-center gap-1"><Clock size={10}/> {new Date(t.createdAt || 0).toLocaleDateString('ar-EG')}</span>
                <span className="text-gray-600">ID: {t.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-10 border-t border-white/5">
        <div className="card-base p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <Lock size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold font-cairo">تحديث ملف الأدمن الرئيسي</h3>
              <p className="text-sm text-gray-400">تغيير بيانات الدخول الخاصة بك (Super Admin).</p>
            </div>
          </div>

          <form onSubmit={handleUpdateAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
                <label className="block text-xs mb-1 text-gray-400 px-1">اسم المستخدم الحالي</label>
                <input type="text" className="input-base w-full" value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} required/>
             </div>
             <div>
                <label className="block text-xs mb-1 text-gray-400 px-1">كلمة مرور جديدة</label>
                <input type="password" placeholder="اترك فارغاً لعدم التغيير" className="input-base w-full" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})}/>
             </div>
             <div>
                <label className="block text-xs mb-1 text-gray-400 px-1">تأكيد كلمة المرور</label>
                <input type="password" placeholder="تأكيد كلمة المرور" className="input-base w-full" value={adminForm.confirmPassword} onChange={e => setAdminForm({...adminForm, confirmPassword: e.target.value})}/>
             </div>
             <div className="md:col-span-3 flex justify-end pt-4">
                <button type="submit" disabled={saving} className="btn-gold bg-indigo-600 px-10 py-3 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2">
                    {saving ? 'جاري الحفظ...' : <><Save size={18}/> حفظ التغييرات</>}
                </button>
             </div>
          </form>
        </div>
      </div>
    </div>
  );
}
