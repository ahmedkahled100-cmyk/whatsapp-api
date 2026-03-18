'use client';
import { useState, useEffect } from 'react';
import { getTeachers, saveTeacher } from '@/lib/db';
import { TeacherUser } from '@/types';
import { showToast } from '@/lib/toast';
import { UserPlus, Shield, User, Clock, Check } from 'lucide-react';

export default function ManageTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'teacher' as 'super_admin' | 'teacher'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTeachers();
      setTeachers(data);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) { showToast('أكمل جميع الحقول'); return; }

    setSaving(true);
    try {
      await saveTeacher({
        ...form,
        isActive: true,
        createdAt: Date.now()
      });
      showToast('تمت إضافة الحساب بنجاح');
      setShowAddForm(false);
      setForm({ name: '', username: '', password: '', role: 'teacher' });
      loadData();
    } catch(err) {
      showToast('حدث خطأ');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-cairo font-black text-purple-400">حسابات المنصة</h1>
          <p className="text-sm text-gray-400 mt-1">تفريخ حسابات مستقلة تماماً للمعلمين (Multi-Tenant).</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-gold bg-purple-500 hover:bg-purple-600 shadow-purple-500/20">
          <UserPlus size={16} /> إضافة حساب جديد
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="card-base p-6 border border-purple-500/30 animate-fade-in space-y-4">
          <h3 className="font-bold mb-4">إنشاء حساب جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-gray-400">الاسم الكامل للإستاذ</label>
              <input type="text" className="input-base w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">اسم المستخدم للولوج (Username)</label>
              <input type="text" className="input-base w-full" value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase()})} required/>
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">كلمة السر</label>
              <input type="text" className="input-base w-full" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required/>
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">الصلاحية</label>
              <select className="input-base w-full" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                <option value="teacher">معلم (لوحة قياسية)</option>
                <option value="super_admin">مدير شامل (Super Admin)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/5">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-outline px-6">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-gold bg-purple-500 px-6 disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'إنشاء الحساب'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-3 text-center py-8">جاري التحميل...</div> : teachers.map(t => (
          <div key={t.id} className="card-base p-5 border border-white/5">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl font-bold font-cairo text-white">
                {t.name[0]}
              </div>
              <span className={`px-2 py-1 text-[10px] rounded-md font-bold ${t.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                {t.role === 'super_admin' ? <span className="flex items-center gap-1"><Shield size={10}/> Admin</span> : <span className="flex items-center gap-1"><User size={10}/> Teacher</span>}
              </span>
            </div>
            <h3 className="font-bold text-lg">{t.name}</h3>
            <div className="text-sm font-mono text-gray-400 mb-4 bg-white/5 px-2 py-1 rounded inline-block mt-1">@{t.username}</div>
            
            <div className="pt-4 border-t border-white/5 text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12}/> {new Date(t.createdAt || 0).toLocaleDateString('ar-EG')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
