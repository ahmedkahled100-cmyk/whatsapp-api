'use client';
// src/app/admin/subscriptions/page.tsx

import { useState, useEffect, useMemo } from 'react';
import { getDocs, collection, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TEACHERS, STUDENTS } from '@/lib/db/constants';
import type { TeacherUser, Student } from '@/types';
import { CreditCard, Users, Search, Bell, TrendingUp, DollarSign, Edit2, Save, X, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Calendar } from 'lucide-react';
import { showToast } from '@/lib/toast';

const daysUntil = (ts: number | null | undefined) => {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
};

const subLabel = (type: string) => {
  const m: Record<string, string> = { free: 'مجاني', monthly: 'شهري', yearly: 'سنوي' };
  return m[type] || type || '—';
};

export default function AdminSubscriptionsPage() {
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teachers' | 'students'>('teachers');
  const [search, setSearch] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<TeacherUser | null>(null);
  const [editForm, setEditForm] = useState({ subType: 'free', subExpiry: '', subPrice: '', subLink: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!db) throw new Error('Firebase not initialized');
      const [tSnap, sSnap] = await Promise.all([getDocs(collection(db, TEACHERS)), getDocs(collection(db, STUDENTS))]);
      setTeachers(tSnap.docs.map(d => ({ ...d.data(), id: d.id }) as TeacherUser));
      setStudents(sSnap.docs.map(d => ({ ...d.data(), id: d.id }) as Student));
    } catch {
      showToast('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const teacherRevenue = teachers.reduce((s, t) => s + (t.subPrice || 0), 0);
    const studentRevenue = students.reduce((s, st) => s + (st.subPrice || 0), 0);
    const expiringTeachers = teachers.filter(t => { const d = daysUntil(t.subExpiry); return d !== null && d >= 0 && d <= 7; });
    const expiredTeachers = teachers.filter(t => { const d = daysUntil(t.subExpiry); return d !== null && d < 0; });
    return { teacherRevenue, studentRevenue, grand: teacherRevenue + studentRevenue, expiringTeachers, expiredTeachers };
  }, [teachers, students]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.username || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const da = daysUntil(a.subExpiry) ?? 9999;
      const db2 = daysUntil(b.subExpiry) ?? 9999;
      return da - db2;
    });
  }, [teachers, search]);

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const da = daysUntil(a.subExpiry) ?? 9999;
      const db2 = daysUntil(b.subExpiry) ?? 9999;
      return da - db2;
    });
  }, [students, search]);

  const getExpiryStatus = (subExpiry: number | null | undefined, subType?: string) => {
    if (subType === 'free' || !subExpiry) return { label: 'مجاني دائم', color: 'text-green-400', bg: 'bg-green-500/10' };
    const days = daysUntil(subExpiry);
    if (days === null) return { label: '—', color: 'text-gray-400', bg: '' };
    if (days < 0) return { label: 'منتهي', color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/20' };
    if (days === 0) return { label: 'ينتهي اليوم!', color: 'text-red-400 animate-pulse', bg: 'bg-red-500/20 border border-red-500/30' };
    if (days <= 3) return { label: `${days} أيام`, color: 'text-red-400', bg: 'bg-red-500/10' };
    if (days <= 7) return { label: `${days} أيام`, color: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (days <= 30) return { label: `${days} يوم`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return { label: new Date(subExpiry).toLocaleDateString('ar-EG'), color: 'text-green-400', bg: 'bg-green-500/10' };
  };

  const openEditTeacher = (t: TeacherUser) => {
    setEditingTeacher(t);
    setEditForm({
      subType: t.subType || 'free',
      subExpiry: t.subExpiry ? new Date(t.subExpiry).toISOString().split('T')[0] : '',
      subPrice: String(t.subPrice || ''),
      subLink: t.subLink || '',
    });
  };

  const handleSaveTeacher = async () => {
    if (!editingTeacher || !db) return;
    setSaving(true);
    try {
      const update: Partial<TeacherUser> = {
        subType: editForm.subType as any,
        subExpiry: editForm.subExpiry ? new Date(editForm.subExpiry).getTime() : null,
        subPrice: parseFloat(editForm.subPrice) || 0,
        subLink: editForm.subLink,
      };
      await setDoc(doc(db, TEACHERS, editingTeacher.id), { ...editingTeacher, ...update });
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...update } as TeacherUser : t));
      showToast('✅ تم تحديث اشتراك المعلم');
      setEditingTeacher(null);
    } catch {
      showToast('❌ فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsappToTeacher = (t: TeacherUser) => {
    const days = daysUntil(t.subExpiry);
    const msg = `💬 *تذكير بنهاية اشتراك منصة AN Academy*\n\nالأستاذ/ة ${t.name}،\n\n${days !== null && days <= 0 ? 'انتهى اشتراكك بالفعل!' : `اشتراكك (${subLabel(t.subType || 'free')}) سينتهي خلال *${days} أيام*`}\n\nيرجى التجديد للمحافظة على نشاط منصتك.${t.subLink ? `\n\nرابط التجديد: ${t.subLink}` : ''}`;
    if (!t.username) { showToast('لا يوجد رقم هاتف للمعلم'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-purple-400" />
          <h1 className="text-2xl font-cairo font-black text-purple-300">إدارة الاشتراكات الشاملة</h1>
        </div>
        <button onClick={() => loadData()} className="btn-outline text-xs flex items-center gap-1 border-purple-500/30 text-purple-400">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* Expiry Alert */}
      {stats.expiringTeachers.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3">
          <Bell className="text-orange-400 mt-0.5 flex-shrink-0 animate-bounce" size={20} />
          <div className="flex-1">
            <p className="font-bold text-orange-300 mb-1">⚠️ {stats.expiringTeachers.length} معلم اشتراكه ينتهي خلال 7 أيام</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {stats.expiringTeachers.map(t => (
                <span key={t.id} className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/20">
                  {t.name} ({daysUntil(t.subExpiry)} يوم)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الإيرادات', value: `${stats.grand.toLocaleString()} ج.م`, icon: <DollarSign size={22} className="text-gold"/>, bg: 'from-yellow-500/10 border-yellow-500/20' },
          { label: 'إيرادات المعلمين', value: `${stats.teacherRevenue.toLocaleString()} ج.م`, icon: <TrendingUp size={22} className="text-purple-400"/>, bg: 'from-purple-500/10 border-purple-500/20' },
          { label: 'إيرادات الطلاب', value: `${stats.studentRevenue.toLocaleString()} ج.م`, icon: <Users size={22} className="text-blue-400"/>, bg: 'from-blue-500/10 border-blue-500/20' },
          { label: 'اشتراكات منتهية', value: stats.expiredTeachers.length, icon: <AlertCircle size={22} className="text-red-400"/>, bg: 'from-red-500/10 border-red-500/20' },
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
      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit">
        {(['teachers', 'students'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {tab === 'teachers' ? `المعلمون (${teachers.length})` : `طلاب المنصة (${students.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
        <input type="text" placeholder="ابحث..." value={search} onChange={e => setSearch(e.target.value)} className="input-base pr-11 text-sm w-full" />
      </div>

      {loading ? (
        <div className="text-center py-20 opacity-50">جاري التحميل...</div>
      ) : activeTab === 'teachers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers.map(teacher => {
            const status = getExpiryStatus(teacher.subExpiry, teacher.subType);
            const days = daysUntil(teacher.subExpiry);
            const isExpiring = days !== null && days >= 0 && days <= 7;
            const isExpired = days !== null && days < 0;
            return (
              <div key={teacher.id} className={`card-base p-5 border transition-all hover:scale-[1.01] ${isExpired ? 'border-red-500/30' : isExpiring ? 'border-orange-500/30' : 'border-white/5'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {teacher.imageUrl ? (
                      <img src={teacher.imageUrl} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                        {teacher.name[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{teacher.name}</h3>
                      <div className="text-xs text-gray-400">@{teacher.username}</div>
                    </div>
                  </div>
                  <button onClick={() => openEditTeacher(teacher)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white flex-shrink-0">
                    <Edit2 size={14} />
                  </button>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">نوع الاشتراك</span>
                    <span className="font-bold">{subLabel(teacher.subType || 'free')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">قيمة الاشتراك</span>
                    <span className="font-black text-gold">{(teacher.subPrice || 0).toLocaleString()} ج.م</span>
                  </div>
                  {teacher.subExpiry && teacher.subType !== 'free' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">موعد الانتهاء</span>
                      <span>{new Date(teacher.subExpiry).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center ${status.bg} ${status.color}`}>
                    {status.label}
                  </div>
                </div>
                {teacher.subType !== 'free' && teacher.subExpiry && (
                  <div className="mb-4">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(days ?? 0) > 30 ? 'bg-green-500' : (days ?? 0) > 7 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, ((days ?? 0) / 365) * 100))}%` }} />
                    </div>
                  </div>
                )}
                {(isExpired || isExpiring) && (
                  <button onClick={() => sendWhatsappToTeacher(teacher)} className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-400 py-2 rounded-lg text-xs font-bold border border-green-500/20 transition-colors">
                    📲 إرسال تذكير
                  </button>
                )}
              </div>
            );
          })}
          {filteredTeachers.length === 0 && <div className="col-span-3 py-12 text-center text-gray-500">لا يوجد معلمون مطابقون</div>}
        </div>
      ) : (
        /* Students Table */
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[600px]">
              <thead className="bg-white/5 text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-3">الطالب</th>
                  <th className="px-4 py-3">المعلم</th>
                  <th className="px-4 py-3">الاشتراك</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">الانتهاء</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.map(student => {
                  const status = getExpiryStatus(student.subExpiry, student.subType);
                  const teacher = teachers.find(t => t.id === student.teacherId);
                  return (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{student.code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{teacher?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="badge badge-blue text-xs">
                          {student.subType === 'monthly' ? 'شهري' : student.subType === 'yearly' ? 'سنوي' : student.subType === 'halfYearly' ? 'نصف سنوي' : student.subType === 'course' ? 'كورس' : student.subType === 'session' ? 'حصة' : 'غير مشترك'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-gold">{(student.subPrice || 0)} ج.م</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {student.subExpiry ? new Date(student.subExpiry).toLocaleDateString('ar-EG') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-lg ${status.bg} ${status.color} font-bold`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">لا يوجد طلاب مطابقون</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setEditingTeacher(null)}>
          <div className="card-base p-6 w-full max-w-md animate-scale-in border border-purple-500/30 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">تعديل اشتراك: {editingTeacher.name}</h3>
              <button onClick={() => setEditingTeacher(null)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">نوع الاشتراك</label>
                <select className="input-base w-full text-sm" value={editForm.subType} onChange={e => setEditForm({...editForm, subType: e.target.value})}>
                  <option value="free">مجاني</option>
                  <option value="monthly">شهري</option>
                  <option value="yearly">سنوي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">المبلغ (ج.م)</label>
                <input type="number" className="input-base w-full text-sm" value={editForm.subPrice} onChange={e => setEditForm({...editForm, subPrice: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">تاريخ انتهاء الاشتراك</label>
                <input type="date" className="input-base w-full text-sm" value={editForm.subExpiry} onChange={e => setEditForm({...editForm, subExpiry: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">رابط التجديد (يظهر للمعلم)</label>
                <input type="text" className="input-base w-full text-sm" placeholder="https://..." value={editForm.subLink} onChange={e => setEditForm({...editForm, subLink: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingTeacher(null)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSaveTeacher} disabled={saving} className="btn-gold flex-1 bg-purple-500 hover:bg-purple-600">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
