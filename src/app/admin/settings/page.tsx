'use client';

import { useState, useEffect } from 'react';
import { 
  getSettings, saveSettings, getSuperAdmin, 
  updateSuperAdminCredentials, getRegistrationRequests,
  saveTeacher, deleteRegistrationRequest
} from '@/lib/db';
import { Settings, TeacherUser, RegistrationRequest } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Settings as SettingsIcon, Lock, Phone, CreditCard, 
  Save, UserPlus, Check, X, Printer, Send, 
  Trash2, ExternalLink, Clock, User
} from 'lucide-react';
import { useTeacherStore } from '@/lib/store';

export default function AdminSettingsPage() {
  const { user: currentUser } = useTeacherStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [superAdmin, setSuperAdmin] = useState<TeacherUser | null>(null);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Forms
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [receiptForm, setReceiptForm] = useState({
    teacherName: '',
    amount: 0,
    subType: 'monthly',
    date: new Date().toISOString().split('T')[0],
    whatsapp: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const admin = await getSuperAdmin();
      if (admin) {
        setSuperAdmin(admin);
        const [s, reqs] = await Promise.all([
          getSettings(admin.id),
          getRegistrationRequests(admin.id)
        ]);
        setSettings(s);
        setRequests(reqs.filter(r => r.type === 'teacher'));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdmin || !settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      showToast('تم حفظ إعدادات المنصة بنجاح');
    } catch (e) { showToast('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (passwordForm.password !== passwordForm.confirm) {
      showToast('كلمات المرور غير متطابقة');
      return;
    }
    setSaving(true);
    try {
      await updateSuperAdminCredentials(currentUser.id, currentUser.username, passwordForm.password);
      showToast('تم تحديث كلمة المرور بنجاح');
      setPasswordForm({ password: '', confirm: '' });
    } catch (e) { showToast('فشل التحديث'); }
    finally { setSaving(false); }
  };

  const handleApproveTeacher = async (req: RegistrationRequest) => {
    if (!confirm(`هل أنت متأكد من تفعيل حساب المعلم ${req.name}؟`)) return;
    try {
      const newTeacher: Partial<TeacherUser> = {
        name: req.name,
        username: req.phone, // Default username is phone
        password: Math.random().toString(36).slice(-8), // Temporary random password
        role: 'teacher',
        isActive: true,
        subType: req.subType as any,
        subExpiry: Date.now() + (req.subType === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        permissions: ['dashboard', 'exams', 'students'],
        imageUrl: req.imageUrl || '',
      };
      await saveTeacher(newTeacher as any);
      await deleteRegistrationRequest(req.id);
      showToast('تم تفعيل حساب المعلم بنجاح');
      loadData();
    } catch (e) { showToast('فشل التفعيل'); }
  };

  const generateReceiptWhatsApp = () => {
    if (!receiptForm.teacherName || !receiptForm.whatsapp) {
      showToast('أكمل بيانات الإيصال المحول');
      return;
    }
    const msg = `🧾 *إيصال اشتراك منصة AN Academy*
---
👤 *المعلم:* ${receiptForm.teacherName}
💰 *المبلغ:* ${receiptForm.amount} ج.م
📅 *التاريخ:* ${receiptForm.date}
📦 *نوع الاشتراك:* ${receiptForm.subType === 'monthly' ? 'شهري' : 'سنوي'}
---
✅ تم تفعيل حسابك بنجاح. يمكنك الآن الدخول للمنصة والبدء.
نتمنى لك تجربة تعليمية ممتعة!`;

    const url = `https://wa.me/${receiptForm.whatsapp.startsWith('2') ? receiptForm.whatsapp : '2' + receiptForm.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-20 text-center text-gray-400">جاري التحميل...</div>;

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 bg-purple-500/5 p-6 rounded-2xl border border-purple-500/10">
        <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-purple-400">إعدادات المنصة الشاملة</h1>
          <p className="text-sm text-gray-400">تحكم كامل في الأسعار، بيانات التواصل، والحسابات.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Platform Prices & WhatsApp */}
        <div className="card-base p-6 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CreditCard size={20} className="text-purple-400" /> إعدادات الاشتراك والدعم
          </h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">سعر الاشتراك الشهري (ج.م)</label>
                  <input type="number" className="input-base w-full" value={settings?.monthlyPrice || 0} onChange={e => setSettings(s => s ? {...s, monthlyPrice: parseFloat(e.target.value) || 0} : null)}/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">سعر الاشتراك السنوي (ج.م)</label>
                  <input type="number" className="input-base w-full" value={settings?.yearlyPrice || 0} onChange={e => setSettings(s => s ? {...s, yearlyPrice: parseFloat(e.target.value) || 0} : null)}/>
                </div>
             </div>
             <div>
                <label className="block text-xs text-gray-400 mb-1">رقم واتساب الإدارة (للدعم الفني)</label>
                <div className="relative">
                  <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="01XXXXXXXXX" className="input-base pr-12 w-full" value={settings?.whatsappNumber || ''} onChange={e => setSettings(s => s ? {...s, whatsappNumber: e.target.value} : null)}/>
                </div>
             </div>
             <div>
                <label className="block text-xs text-gray-400 mb-1">تعليمات الدفع (تظهر في صفحة التسجيل)</label>
                <textarea className="input-base w-full min-h-[100px]" value={settings?.paymentMethods || ''} onChange={e => setSettings(s => s ? {...s, paymentMethods: e.target.value} : null)} />
             </div>
             <button type="submit" disabled={saving} className="btn-gold w-full bg-purple-500 flex items-center justify-center gap-2">
               <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
             </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card-base p-6 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock size={20} className="text-red-400" /> تغيير كلمة سر الأدمن
          </h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
             <div>
                <label className="block text-xs text-gray-400 mb-1">كلمة المرور الجديدة</label>
                <input type="password" placeholder="••••••••" className="input-base w-full" value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} required/>
             </div>
             <div>
                <label className="block text-xs text-gray-400 mb-1">تأكيد كلمة المرور</label>
                <input type="password" placeholder="••••••••" className="input-base w-full" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} required/>
             </div>
             <button type="submit" disabled={saving} className="btn-gold w-full bg-red-600 shadow-red-900/40">
               تحديث كلمة السر
             </button>
          </form>
        </div>

        {/* Receipt Generator */}
        <div className="card-base p-6 space-y-6 lg:col-span-2 bg-gradient-to-r from-purple-500/5 to-transparent">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold flex items-center gap-2">
                <Printer size={22} className="text-blue-400" /> منشئ إيصالات اشتراك المعلمين
             </h2>
             <span className="text-[10px] text-gray-500">سيتم إرسال التفاصيل مباشرة عبر الواتساب</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <input type="text" placeholder="اسم المعلم" className="input-base" value={receiptForm.teacherName} onChange={e => setReceiptForm({...receiptForm, teacherName: e.target.value})}/>
             <input type="text" placeholder="رقم الموبايل" className="input-base" value={receiptForm.whatsapp} onChange={e => setReceiptForm({...receiptForm, whatsapp: e.target.value})}/>
             <input type="number" placeholder="المبلغ" className="input-base" value={receiptForm.amount || ''} onChange={e => setReceiptForm({...receiptForm, amount: parseFloat(e.target.value) || 0})}/>
             <select className="input-base" value={receiptForm.subType} onChange={e => setReceiptForm({...receiptForm, subType: e.target.value})}>
                <option value="monthly">اشتراك شهري</option>
                <option value="yearly">اشتراك سنوي</option>
             </select>
             <input type="date" className="input-base" value={receiptForm.date} onChange={e => setReceiptForm({...receiptForm, date: e.target.value})}/>
             <button onClick={generateReceiptWhatsApp} className="btn-gold bg-green-600 flex items-center justify-center gap-2 shadow-green-900/40">
                <Send size={18} /> إرسال الإيصال للأستاذ
             </button>
          </div>
        </div>

        {/* Teacher Requests */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 px-2">
            <UserPlus size={22} className="text-emerald-400" /> طلبات انضمام المعلمين ({requests.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {requests.length === 0 ? (
               <div className="col-span-2 card-base p-10 text-center text-gray-500">لا يوجد طلبات انضمام حالياً.</div>
             ) : requests.map(req => (
               <div key={req.id} className="card-base p-5 border-white/5 hover:border-purple-500/30 transition-all group overflow-hidden">
                  <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                     <div className="flex items-center gap-3">
                        {req.imageUrl ? (
                           <img src={req.imageUrl} alt={req.name} className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-purple-500/20 border border-purple-500/30" />
                        ) : (
                           <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-black">
                              {req.name[0]}
                           </div>
                        )}
                        <div className="flex flex-col gap-1">
                           <h3 className="font-bold text-lg mb-0 leading-none">{req.name}</h3>
                           <div className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10}/> {new Date(req.createdAt).toLocaleDateString('ar-EG')}</div>
                        </div>
                     </div>
                     <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.subType === 'yearly' ? 'bg-gold/20 text-gold' : 'bg-blue-500/20 text-blue-400'}`}>
                        {req.subType === 'yearly' ? 'خطة سنوية' : 'خطة شهرية'}
                     </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-4 px-1 flex items-center gap-1"><User size={14}/> المادة: {req.subject}</p>
                  
                  <div className="space-y-2 mb-6">
                     <div className="flex items-center gap-2 text-xs">
                        <Phone size={14} className="text-gray-500"/>
                        <span>{req.phone}</span>
                     </div>
                     <div className="flex items-center gap-2 text-xs">
                        <CreditCard size={14} className="text-gray-500"/>
                        <span>مرجع الدفع: {req.paymentRef || 'لا يوجد'}</span>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <button onClick={() => handleApproveTeacher(req)} className="flex-1 btn-gold bg-emerald-600 text-[11px] h-9">
                        <Check size={14} /> تفعيل الحساب
                     </button>
                     {req.receiptUrl && (
                        <a href={req.receiptUrl} target="_blank" className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                           <ExternalLink size={14} />
                        </a>
                     )}
                     <button onClick={() => deleteRegistrationRequest(req.id).then(loadData)} className="w-9 h-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                        <Trash2 size={14} />
                     </button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
