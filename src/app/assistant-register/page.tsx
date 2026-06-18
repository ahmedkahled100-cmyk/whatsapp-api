'use client';

import { useState, useEffect } from 'react';
import { getSettings, saveAssistantProfile, uploadFileToStorage, dispatchNotification, getSuperAdmin } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { GraduationCap, ShieldCheck, Mail, Phone, Calculator, CheckCircle2, User, FileText, Upload, Image as ImageIcon, Loader2, BookOpen, Sparkles, Key, KeyRound, ArrowRight, Coins } from 'lucide-react';
import ImageCropperModal from '@/components/ImageCropperModal';

export default function AssistantRegisterPage() {
  const [loading, setLoading] = useState(true);
  const [superAdmin, setSuperAdmin] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [assistantImageFile, setAssistantImageFile] = useState<File | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [cvUploadProgress, setCvUploadProgress] = useState(0);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    username: '',
    password: '',
    roleTitle: '',
    imageUrl: '',
    cvUrl: '',
    salaryPaymentMethod: 'fixed',
  });

  // Image Cropper state
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    getSuperAdmin().then(admin => {
      setSuperAdmin(admin);
      setLoading(false);
    });
  }, []);

  const handleCvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showToast('يرجى اختيار ملف PDF فقط للسيرة الذاتية');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)');
        return;
      }
      setCvUploadProgress(10);
      try {
        const url = await uploadFileToStorage(file, `cvs/${Date.now()}_${file.name}`);
        setForm(f => ({ ...f, cvUrl: url }));
        setCvUploadProgress(100);
        showToast('تم رفع السيرة الذاتية بنجاح');
      } catch (e) {
        setCvUploadProgress(0);
        showToast('فشل رفع ملف السيرة الذاتية');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.username.trim() || !form.password.trim() || !form.roleTitle.trim()) {
      showToast('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setSubmitting(true);
    try {
      // Create assistant profile
      const assistantData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password.trim(),
        roleTitle: form.roleTitle.trim(),
        imageUrl: form.imageUrl,
        cvUrl: form.cvUrl,
        salaryPaymentMethod: form.salaryPaymentMethod,
        code: `AST-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'pending' as const,
        createdAt: Date.now(),
      };

      await saveAssistantProfile(assistantData);

      // Notify Super Admin
      if (superAdmin) {
        try {
          await dispatchNotification({
            teacherId: superAdmin.id,
            msg: `طلب تسجيل مساعد جديد: ${form.name} (${form.roleTitle})`,
            targetRoles: ['super_admin'],
            channels: { inApp: true, whatsapp: false },
            actionPath: '/admin/assistants' // point directly to the new assistants page!
          });
        } catch (e) {
          console.error(e);
        }
      }

      setSuccess(true);
      showToast('تم إرسال طلب التسجيل بنجاح');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCropperImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropper(false);
    const file = new File([croppedBlob], 'assistant_profile.jpg', { type: 'image/jpeg' });
    setAssistantImageFile(file);

    setImageUploadProgress(10);
    try {
      const url = await uploadFileToStorage(file, `assistants/${Date.now()}_cropped.jpg`);
      setForm(f => ({ ...f, imageUrl: url }));
      setImageUploadProgress(100);
      showToast('تم رفع الصورة الشخصية بنجاح');
    } catch (e) {
      setImageUploadProgress(0);
      showToast('فشل رفع الصورة');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c]">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] text-white p-4" dir="rtl">
        <div className="card-base max-w-md w-full p-8 text-center space-y-6 !border-amber-500/30">
          <CheckCircle2 size={60} className="text-amber-500 mx-auto" />
          <h1 className="text-2xl font-black text-amber-400">تم إرسال طلبك بنجاح!</h1>
          <p className="text-gray-300">أهلاً بك يا أستاذ {form.name}، تم استلام طلب تسجيلك كمساعد مادة في المنصة. سيقوم المشرف العام بمراجعة حسابك وتفعيله قريباً.</p>
          <button onClick={() => window.location.href = '/auth'} className="btn-gold w-full bg-amber-600 text-black font-bold">الذهاب لصفحة الدخول</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-4 sm:p-8" dir="rtl">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <a href="/auth" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <ArrowRight size={14} /> العودة للدخول
          </a>
        </div>

        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <Sparkles size={40} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-black gold-text">تسجيل مساعد جديد</h1>
          <p className="text-gray-400">قم بإنشاء حساب مساعد مادة للانضمام إلى فريق عمل معلمي المنصة.</p>
        </div>

        <div className="card-base p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Image Upload section */}
            <div className="flex flex-col items-center space-y-3 mb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-amber-500/30 flex items-center justify-center bg-white/5 relative">
                  {form.imageUrl ? (
                    <img loading="lazy" src={form.imageUrl} alt="Cropped profile" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-gray-500" />
                  )}
                  {imageUploadProgress > 0 && imageUploadProgress < 100 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold">
                      {imageUploadProgress}%
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 transition-all">
                  <Upload size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400">الصورة الشخصية (اختياري)</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">الاسم الكامل</label>
                <div className="relative">
                  <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="الاسم الثلاثي أو الرباعي..." 
                    className="input-base has-icon-right w-full" 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">رقم الهاتف (واتساب)</label>
                <div className="relative">
                  <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="tel" 
                    placeholder="01XXXXXXXXX" 
                    className="input-base has-icon-right w-full" 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})} 
                    required
                  />
                </div>
              </div>

              {/* Specialized Role Title */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">التخصص / دور المساعد</label>
                <div className="relative">
                  <BookOpen size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="مثال: مساعد لغة عربية، مصحح فيزياء، مشرف حضور..." 
                    className="input-base has-icon-right w-full" 
                    value={form.roleTitle} 
                    onChange={e => setForm({...form, roleTitle: e.target.value})} 
                    required
                  />
                </div>
              </div>

              {/* Preferred Salary Payment Method */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">طريقة دفع الراتب المفضلة</label>
                <div className="relative">
                  <Coins size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <select
                    className="input-base has-icon-right w-full bg-[#0a0f1c]"
                    value={form.salaryPaymentMethod}
                    onChange={e => setForm({...form, salaryPaymentMethod: e.target.value})}
                  >
                    <option value="fixed">راتب شهري ثابت</option>
                    <option value="hourly">بالساعة (حسب ساعات العمل)</option>
                    <option value="percentage">نسبة مئوية من الدخل</option>
                    <option value="flexible">بالاتفاق / مرن</option>
                  </select>
                </div>
              </div>

              {/* CV File Upload */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">رفع السيرة الذاتية (ملف PDF فقط)</label>
                <div className="relative flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer text-sm text-gray-300 font-bold">
                    <Upload size={16} className="text-amber-500" />
                    <span>اختر ملف السيرة الذاتية</span>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={handleCvSelect} 
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    {form.cvUrl ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl">
                        <FileText size={14} />
                        <span className="truncate">تم تحميل ملف السيرة الذاتية بنجاح</span>
                      </div>
                    ) : cvUploadProgress > 0 ? (
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${cvUploadProgress}%` }} />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">السيرة الذاتية مطلوبة لمراجعة حسابك</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 px-1">اسم المستخدم (للدخول)</label>
                  <div className="relative">
                    <Key size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="اسم مستخدم بالإنجليزية..." 
                      className="input-base has-icon-right w-full text-left font-mono" 
                      dir="ltr"
                      value={form.username} 
                      onChange={e => setForm({...form, username: e.target.value})} 
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 px-1">كلمة المرور</label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      type="password" 
                      placeholder="أدخل كلمة مرور قوية..." 
                      className="input-base has-icon-right w-full text-left font-mono"
                      dir="ltr" 
                      value={form.password} 
                      onChange={e => setForm({...form, password: e.target.value})} 
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || (imageUploadProgress > 0 && imageUploadProgress < 100)}
              className="btn-gold w-full justify-center text-base py-3.5 disabled:opacity-60 bg-amber-500 text-black hover:bg-amber-600 font-bold"
            >
              {submitting ? '⏳ جاري إرسال الطلب...' : '🤝 إرسال طلب الانضمام'}
            </button>
          </form>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && cropperImage && (
        <ImageCropperModal
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setShowCropper(false)}
          aspect={1}
        />
      )}
    </div>
  );
}
