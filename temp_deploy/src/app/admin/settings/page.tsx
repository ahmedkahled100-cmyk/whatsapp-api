'use client';

import { useState, useEffect } from 'react';
import { 
  getSettings, saveSettings, getSuperAdmin, 
  updateSuperAdminCredentials, getRegistrationRequests,
  saveTeacher, deleteRegistrationRequest, uploadFileToStorage
} from '@/lib/db';
import { Settings, TeacherUser, RegistrationRequest } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Settings as SettingsIcon, Lock, Phone, CreditCard, 
  Save, UserPlus, Check, X, 
  Trash2, ExternalLink, Clock, User, Upload
} from 'lucide-react';
import { ImageModal } from '@/components/ImageModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { useTeacherStore } from '@/lib/store';

export default function AdminSettingsPage() {
  const { user: currentUser } = useTeacherStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [superAdmin, setSuperAdmin] = useState<TeacherUser | null>(null);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Image Modal state
  const [selectedImg, setSelectedImg] = useState<{ src: string, alt: string } | null>(null);

  // Forms
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

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

  const handleUpdateImage = async (url: string) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const updatedUser = { ...currentUser, imageUrl: url };
      await saveTeacher(updatedUser);
      useTeacherStore.getState().setUser(updatedUser); // Update local store
      showToast('تم تحديث الصورة الشخصية بنجاح');
    } catch (e) { showToast('فشل تحديث الصورة'); }
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
                  <input type="number" className="input-base w-full" value={settings?.monthlyPrice ?? ''} onChange={e => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setSettings(s => s ? {...s, monthlyPrice: v} : { monthlyPrice: v, teacherId: superAdmin?.id || '' } as any);
                  }}/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">سعر الاشتراك السنوي (ج.م)</label>
                  <input type="number" className="input-base w-full" value={settings?.yearlyPrice ?? ''} onChange={e => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setSettings(s => s ? {...s, yearlyPrice: v} : { yearlyPrice: v, teacherId: superAdmin?.id || '' } as any);
                  }}/>
                </div>
             </div>
             <div>
                <label className="block text-xs text-gray-400 mb-1">رقم واتساب الإدارة (للدعم الفني)</label>
                <div className="relative">
                  <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="01XXXXXXXXX" className="input-base pr-12 w-full" value={settings?.whatsappNumber || ''} onChange={e => {
                    const v = e.target.value;
                    setSettings(s => s ? {...s, whatsappNumber: v} : { whatsappNumber: v, teacherId: superAdmin?.id || '' } as any);
                  }}/>
                </div>
             </div>
             <div>
                <label className="block text-xs text-gray-400 mb-1">تعليمات الدفع (تظهر في صفحة التسجيل)</label>
                <textarea className="input-base w-full min-h-[100px]" value={settings?.paymentMethods || ''} onChange={e => {
                  const v = e.target.value;
                  setSettings(s => s ? {...s, paymentMethods: v} : { paymentMethods: v, teacherId: superAdmin?.id || '' } as any);
                }} />
             </div>
             <button type="submit" disabled={saving} className="btn-gold w-full bg-purple-500 flex items-center justify-center gap-2">
               <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
             </button>
          </form>
        </div>

        {/* Admin Profile & Password */}
        <div className="card-base p-6 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock size={20} className="text-red-400" /> حساب الأدمن (المدير)
          </h2>
          
          <div className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
            <div className="flex items-center gap-5">
               {currentUser?.imageUrl ? (
                 <img 
                  src={currentUser.imageUrl} 
                  alt="Admin" 
                  className="w-20 h-20 rounded-full object-cover border-4 border-purple-500/30 cursor-pointer hover:brightness-110 active:scale-95 transition-all" 
                  onClick={() => setSelectedImg({ src: currentUser.imageUrl!, alt: currentUser.name })}
                 />
               ) : (
                 <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-3xl font-black border-4 border-purple-500/10">
                   {currentUser?.name?.[0]}
                 </div>
               )}
               <div className="flex-1">
                 <GlobalFileUpload 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploading(true);
                      setUploadProgress(0);
                      try {
                        const url = await uploadFileToStorage(file, `admins/profile_${currentUser?.id}_${Date.now()}`, setUploadProgress);
                        await handleUpdateImage(url);
                      } catch (err: any) { 
                        showToast(err.message || 'فشل رفع الصورة'); 
                      } finally { 
                        setIsUploading(false); 
                        setUploadProgress(0); 
                      }
                    }}
                    disabled={isUploading}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    label="تغيير الصورة الشخصية"
                    needCrop={true}
                    circularCrop={true}
                    cropAspect={1}
                 />
               </div>
            </div>
            <div className="text-center w-full pt-4 border-t border-white/5">
              <div className="font-bold text-lg">{currentUser?.name}</div>
              <div className="text-xs text-gray-500 mt-1">@{currentUser?.username}</div>
            </div>
          </div>

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
                           <img 
                            src={req.imageUrl} 
                            alt={req.name} 
                            className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-purple-500/20 border border-purple-500/30 cursor-pointer hover:scale-110 active:scale-95 transition-all" 
                            onClick={() => setSelectedImg({ src: req.imageUrl!, alt: req.name })}
                           />
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
                        <button 
                          onClick={() => setSelectedImg({ src: req.receiptUrl!, alt: `إيصال دفع: ${req.name}` })}
                          className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                          title="عرض الإيصال"
                        >
                           <ExternalLink size={14} />
                        </button>
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
