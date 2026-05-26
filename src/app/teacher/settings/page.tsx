'use client';
// src/app/teacher/settings/page.tsx


import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { saveSettings, uploadFileToStorage, wipeAllData, saveTeacher, getSuperAdmin, getSettings } from '@/lib/db';
import type { Settings } from '@/types';
import { Save, Eye, EyeOff, Copy, Upload, Loader2, MessageCircle, Phone, Trash2, AlertTriangle, X } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import Image from 'next/image';

const DEFAULT_SETTINGS: Settings = {
  teacherId: '',
  acadName: 'A-N Academy',
  teacherName: 'الأستاذ أحمد خالد',
  teacherPassword: 'admin123',
  primaryColor: '#F5C518',
  secTabSwitch: true,
  secCopyPaste: true,
  secFullscreen: false,
  secShuffleOptions: true,
  certHeader: 'شهادة إتمام واجتياز',
  certFooter: 'بكل فخر وتقدير',
  whatsappTemplate: 'السلام عليكم، أود إبلاغكم بأن الطالب/ة {name} أتم/ت اختبار "{exam}" وحصل/ت على درجة {score} من {total}. {status}',
};

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { user, setUser, settings, setSettings } = useTeacherStore();
  const [form, setForm] = useState<Settings>(settings || { ...DEFAULT_SETTINGS, teacherId: user?.id || '' });
  const [initialized, setInitialized] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [signatureProgress, setSignatureProgress] = useState(0);
  const [showCertPreview, setShowCertPreview] = useState(false);
  
  // Wipe Data State
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);
  
  // Teacher Profile State (for code editing)
  const [teacherCode, setTeacherCode] = useState(user?.code || '');
  
  // Admin Contact State
  const [adminWhatsApp, setAdminWhatsApp] = useState('');

  useEffect(() => {
    if (initialized) return;
    if (settings) {
      setForm(prev => ({ ...prev, ...settings, teacherId: settings.teacherId || user?.id || '' }));
      setInitialized(true);
    } else if (user?.id) {
      setForm(prev => ({ ...prev, teacherId: user.id }));
    }
  }, [settings, user, initialized]);

  // Sync teacher profile image
  const [teacherImageUrl, setTeacherImageUrl] = useState(user?.imageUrl || '');
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [profileProgress, setProfileProgress] = useState(0);
  const [teacherSubject, setTeacherSubject] = useState(user?.subject || '');

  useEffect(() => {
    if (user?.imageUrl) setTeacherImageUrl(user.imageUrl);
    if (user?.subject !== undefined) setTeacherSubject(user.subject);
  }, [user?.imageUrl, user?.subject]);
  useEffect(() => {
    getSuperAdmin().then(admin => {
      if (admin) {
        getSettings(admin.id).then(s => {
          if (s?.whatsappNumber) setAdminWhatsApp(s.whatsappNumber);
        });
      }
    });
  }, []);

  // Handle pre-fill from iLovePDF
  useEffect(() => {
    const prefillLogo = searchParams.get('prefillLogo');
    if (prefillLogo) {
      update('logoUrl', prefillLogo);
      showToast('📥 تم استلام الشعار من أدوات PDF');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const update = (key: keyof Settings, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!user?.id) { showToast('فشل الحصول على بيانات المعلم'); return; }
    
    setSaving(true);
    const finalForm = { ...form, teacherId: user.id };
    try {
      // Save Settings
      await saveSettings(finalForm);
      setSettings(finalForm);

      // Save Teacher Profile if changed
      const passwordChanged = form.teacherPassword !== user.password;
      const codeChanged = user.role === 'super_admin' && teacherCode !== user.code;
      const profileImgChanged = teacherImageUrl !== user.imageUrl;
      const subjectChanged = teacherSubject !== user.subject;

      if (passwordChanged || codeChanged || profileImgChanged || subjectChanged) {
        const updatedUser = { 
          ...user, 
          password: form.teacherPassword, 
          code: codeChanged ? teacherCode.trim().toUpperCase() : user.code,
          imageUrl: teacherImageUrl,
          subject: teacherSubject
        };
        await saveTeacher(updatedUser);
        setUser(updatedUser as any);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast('✅ تم حفظ الإعدادات');
    } catch (err: any) { 
      console.error(err);
      showToast('فشل الحفظ: ' + (err.message || '')); 
    }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { showToast('حجم الصورة يجب أن لا يتجاوز 100 ميجابايت'); return; }
    setUploadingLogo(true);
    setLogoProgress(0);
    try {
      const url = await uploadFileToStorage(file, `settings/logo_${Date.now()}_${file.name}`, setLogoProgress);
      update('logoUrl', url);
      showToast('تم رفع الشعار بنجاح!');
    } catch (err: any) {
      console.error(err);
      showToast('فشل رفع الشعار: ' + (err.message || 'خطأ غير معروف'));
    } finally { 
      setUploadingLogo(false); 
      setLogoProgress(0);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true);
    setSignatureProgress(0);
    try {
      const url = await uploadFileToStorage(file, `settings/signature_${Date.now()}_${file.name}`, setSignatureProgress);
      update('certSignatureUrl', url);
      showToast('تم رفع التوقيع بنجاح!');
    } catch (err: any) {
      console.error(err);
      showToast('فشل رفع التوقيع: ' + (err.message || 'خطأ غير معروف'));
    } finally { 
      setUploadingSignature(false); 
      setSignatureProgress(0);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    setProfileProgress(0);
    try {
      const url = await uploadFileToStorage(file, `profiles/${user?.id || 'teacher'}_${Date.now()}_${file.name}`, setProfileProgress);
      setTeacherImageUrl(url);
      showToast('تم تحديث صورة الملف الشخصي!');
    } catch (err: any) {
      console.error(err);
      showToast('فشل رفع الصورة: ' + (err.message || ''));
    } finally {
      setUploadingProfile(false);
      setProfileProgress(0);
    }
  };

  const studentLink = typeof window !== 'undefined' ? `${window.location.origin}/student` : '';
  const copyLink = () => { navigator.clipboard.writeText(studentLink); showToast('✅ تم نسخ رابط بوابة الطلاب!'); };

  const handleWipeData = async () => {
    if (wipeConfirmText !== 'مسح') {
      showToast('يرجى كتابة كلمة "مسح" للتأكيد');
      return;
    }
    
    setWiping(true);
    try {
      await wipeAllData();
      showToast('تم مسح جميع البيانات بنجاح.');
      setShowWipeModal(false);
      setWipeConfirmText('');
      window.location.reload(); // Reload to clear any cached states
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء مسح البيانات.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-cairo font-black gold-text">⚙️ الإعدادات</h1>
        <button onClick={handleSave} disabled={saving}
          className={`${saved ? 'btn-outline' : 'btn-gold'} disabled:opacity-60`}>
          <Save size={15} /> {saving ? 'جاري الحفظ...' : saved ? '✅ تم الحفظ' : 'حفظ الإعدادات'}
        </button>
      </div>

      {/* Academy Info */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>🎓 معلومات المنصة</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>اسم المنصة</label>
            <input value={form.acadName} onChange={e => update('acadName', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>اسم المعلم</label>
            <input value={form.teacherName} onChange={e => update('teacherName', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>المادة الدراسية</label>
            <input value={teacherSubject} onChange={e => setTeacherSubject(e.target.value)} className="input-base" placeholder="مثال: لغة إنجليزية" />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>شعار المنصة (Logo)</label>
            <div className="flex items-center gap-3">
              {form.logoUrl && (
                <Image src={form.logoUrl} alt="شعار المنصة" className="w-14 h-14 object-contain rounded-xl border border-white/10 bg-white/5 p-1 flex-shrink-0" width={56} height={56} />
              )}
              <div className="flex-1 space-y-2">
                <GlobalFileUpload 
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  uploadedUrl={form.logoUrl}
                  isUploading={uploadingLogo}
                  uploadProgress={logoProgress}
                  label="رفع شعار من جهازك"
                  needCrop={true}
                  cropAspect={1}
                />
                <input
                  value={form.logoUrl || ''}
                  onChange={e => update('logoUrl', e.target.value)}
                  className="input-base text-sm"
                  placeholder="أو أدخل رابط الشعار مباشرة..."
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>يُفضل PNG أو JPG.</p>
          </div>

          {/* Teacher Profile Image */}
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>صورة المعلم الشخصية</label>
            <div className="flex items-center gap-3">
              {teacherImageUrl ? (
                <Image src={teacherImageUrl} alt="المعلم" className="w-14 h-14 object-cover rounded-full border border-gold/30 shadow-lg flex-shrink-0" width={56} height={56} />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-black flex-shrink-0">
                  {user?.name?.[0]}
                </div>
              )}
              <div className="flex-1">
                <GlobalFileUpload 
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  disabled={uploadingProfile}
                  uploadedUrl={teacherImageUrl}
                  isUploading={uploadingProfile}
                  uploadProgress={profileProgress}
                  label="تغيير صورتك الشخصية"
                  needCrop={true}
                  circularCrop={true}
                  cropAspect={1}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>🔐 كلمة مرور لوحة التحكم</h2>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} value={form.teacherPassword}
            onChange={e => update('teacherPassword', e.target.value)} className="input-base has-icon-left" />
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute top-1/2 left-3 -translate-y-1/2 opacity-50 hover:opacity-100">
            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ⚠️ احفظ كلمة المرور في مكان آمن. الافتراضية: admin123
        </p>
      </div>

      {/* Teacher Code */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>🔑 كود دخول المعلم</h2>
        <div className="relative">
          <input 
            type="text" 
            value={teacherCode}
            onChange={e => setTeacherCode(e.target.value.toUpperCase())} 
            disabled={user?.role !== 'super_admin'}
            className="input-base font-mono tracking-widest text-center text-lg disabled:opacity-70 disabled:cursor-not-allowed" 
            placeholder="مثال: TEACHER123"
          />
        </div>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {user?.role === 'super_admin' 
            ? '💡 بصفتك مديراً عاماً، يمكنك تعديل كود الدخول الخاص بك هنا.' 
            : '🔒 كود الدخول الخاص بك هو معرف فريد ولا يمكن تعديله إلا من خلال المدير العام.'}
        </p>
      </div>

      {/* Student Portal Link */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>🔗 رابط بوابة الطلاب</h2>
        <div className="flex gap-2">
          <input value={studentLink} readOnly className="input-base text-sm flex-1" style={{ direction: 'ltr', textAlign: 'left' }} />
          <button onClick={copyLink} className="btn-outline text-sm px-3 flex-shrink-0">
            <Copy size={14} /> نسخ
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          شارك هذا الرابط مع طلابك للدخول ببوابة الطالب
        </p>
      </div>

      {/* WhatsApp Settings */}
      <div className="card-base p-5" style={{ border: '1px solid rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.03)' }}>
        <h2 className="font-cairo font-bold mb-4 flex items-center gap-2" style={{ color: '#25D366' }}>
          <MessageCircle size={18} /> إعدادات واتساب
        </h2>
        <div className="space-y-4">
          {/* Teacher WhatsApp for students */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              📱 رقم واتساب المعلم (للتواصل مع الطلاب)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Phone size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  value={form.whatsappNumber || ''}
                  onChange={e => update('whatsappNumber', e.target.value)}
                  className="input-base has-icon flex-1"
                  placeholder="مثال: 201012345678 (بدون + أو 00)"
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">تفعيل التواصل؟</span>
                <button onClick={() => update('whatsappEnabled', !form.whatsappEnabled)}
                  className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                  style={{ background: form.whatsappEnabled ? '#25D366' : 'rgba(255,255,255,0.1)' }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ right: form.whatsappEnabled ? '2px' : 'auto', left: form.whatsappEnabled ? 'auto' : '2px' }} />
                </button>
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              سيظهر زر &quot;تواصل مع المعلم&quot; في صفحة الطالب يفتح واتساب مباشرة على هذا الرقم.
            </p>
          </div>

          {/* WhatsApp message template for parents */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              📋 قالب رسالة إبلاغ أولياء الأمور بالنتائج
            </label>
            <textarea
              value={form.whatsappTemplate || ''}
              onChange={e => update('whatsappTemplate', e.target.value)}
              rows={4}
              className="input-base resize-y text-sm"
              placeholder="اكتب قالب الرسالة... يمكنك استخدام: {name} {exam} {score} {total} {status}"
            />
            <div className="mt-2 p-2 rounded-lg text-xs flex flex-wrap gap-2" style={{ background: 'rgba(37,211,102,0.08)', color: '#25D366' }}>
              <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{'{name}'}</span> اسم الطالب
              <span className="mx-1 opacity-40">|</span>
              <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{'{exam}'}</span> اسم الاختبار
              <span className="mx-1 opacity-40">|</span>
              <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{'{score}'}</span> الدرجة
              <span className="mx-1 opacity-40">|</span>
              <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{'{total}'}</span> الدرجة الكلية
              <span className="mx-1 opacity-40">|</span>
              <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{'{status}'}</span> ناجح/راسب
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              سيُستخدم هذا القالب في صفحة النتائج عند الضغط على زر &quot;إبلاغ ولي الأمر عبر واتساب&quot;.
            </p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>🛡️ أمان الاختبار</h2>
        <div className="space-y-3">
          {[
            { key: 'secTabSwitch', label: 'تسجيل مغادرة صفحة الاختبار', desc: 'يُنبّه عند تبديل التبويب' },
            { key: 'secCopyPaste', label: 'منع النسخ واللصق', desc: 'يمنع النسخ من الاختبار' },
            { key: 'secShuffleOptions', label: 'خلط ترتيب الخيارات', desc: 'يخلط خيارات كل سؤال عشوائياً' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
              </div>
              <button onClick={() => update(key as keyof Settings, !(form as any)[key])}
                className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                style={{ background: (form as any)[key] ? 'var(--green)' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ right: (form as any)[key] ? '2px' : 'auto', left: (form as any)[key] ? 'auto' : '2px' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Certificate */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cairo font-bold" style={{ color: 'var(--gold)' }}>🎓 إعدادات الشهادة</h2>
          <button 
            onClick={() => setShowCertPreview(true)}
            className="text-xs btn-outline py-1.5 px-3 flex items-center gap-2"
          >
            <Eye size={14} /> معاينة الشهادة
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>رأس الشهادة</label>
            <input value={form.certHeader || ''} onChange={e => update('certHeader', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>تذييل الشهادة</label>
            <input value={form.certFooter || ''} onChange={e => update('certFooter', e.target.value)} className="input-base" />
          </div>

          {/* Signature Upload */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              ✍️ توقيع / ختم الشهادة (اختياري)
            </label>
            <div className="flex items-center gap-3">
              {form.certSignatureUrl && (
                <div className="relative w-24 h-14 rounded-xl border border-white/10 bg-white/5 p-2 flex-shrink-0 flex items-center justify-center">
                  <Image src={form.certSignatureUrl} alt="التوقيع" className="object-contain p-2" fill />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <GlobalFileUpload 
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  disabled={uploadingSignature}
                  uploadedUrl={form.certSignatureUrl}
                  isUploading={uploadingSignature}
                  uploadProgress={signatureProgress}
                  label={form.certSignatureUrl ? 'تغيير التوقيع/الختم' : 'رفع توقيع أو ختم'}
                  needCrop={true}
                  cropAspect={2}
                />
                {form.certSignatureUrl && (
                  <button onClick={() => update('certSignatureUrl', '')} className="text-xs text-red-400 hover:text-red-300 w-full text-center">
                    🗑️ إزالة التوقيع
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              يُفضل استخدام صيغة PNG بخلفية شفافة. سيظهر في الشهادات الممنوحة للطلاب الناجحين.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="card-base p-5">
        <h2 className="font-cairo font-bold mb-4" style={{ color: 'var(--gold)' }}>💳 طرق الدفع والاشتراكات</h2>
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>بيانات وطرق الدفع (تظهر للطلاب عند التسجيل)</label>
          <textarea
            value={form.paymentMethods || ''}
            onChange={e => update('paymentMethods', e.target.value)}
            rows={4}
            className="input-base resize-y"
            placeholder="مثال: يرجى تحويل قيمة الاشتراك على فودافون كاش رقم 0101XXXXXXX ثم كتابة رقم التحويل في الملاحظات..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>سعر الاشتراك الشهري</label>
            <div className="relative">
              <input type="number" value={form.monthlyPrice ?? ''} onChange={e => update('monthlyPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="input-base pr-10" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ج.م</span>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>سعر الاشتراك نصف السنوي</label>
            <div className="relative">
              <input type="number" value={form.halfYearlyPrice ?? ''} onChange={e => update('halfYearlyPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="input-base pr-10" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ج.م</span>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>سعر الاشتراك السنوي</label>
            <div className="relative">
              <input type="number" value={form.yearlyPrice ?? ''} onChange={e => update('yearlyPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="input-base pr-10" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ج.م</span>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>سعر الاشتراك كورس كامل</label>
            <div className="relative">
              <input type="number" value={form.coursePrice ?? ''} onChange={e => update('coursePrice', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="input-base pr-10" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ج.م</span>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>سعر الحصة / الجلسة</label>
            <div className="relative">
              <input type="number" value={form.sessionPrice ?? ''} onChange={e => update('sessionPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="input-base pr-10" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Contact / Support */}
      {adminWhatsApp && user?.role !== 'super_admin' && (
        <div className="card-base p-5 border-purple-500/20 bg-purple-500/5">
          <h2 className="font-cairo font-bold mb-4 flex items-center gap-2 text-purple-400">
            <MessageCircle size={18} /> الدعم الفني وتجديد الاشتراك
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            إذا كنت تواجه مشكلة تقنية أو ترغب في الاستفسار عن تجديد اشتراك الأكاديمية الخاص بك، يمكنك التواصل مباشرة مع إدارة المنصة.
          </p>
          <a 
            href={`https://wa.me/${adminWhatsApp.startsWith('2') ? adminWhatsApp : '2' + adminWhatsApp}`}
            target="_blank"
            className="btn-gold bg-green-600 w-full flex items-center justify-center gap-2"
          >
            <Phone size={16} /> تواصل مع الإدارة عبر واتساب
          </a>
        </div>
      )}


      {/* Dangerous Operations */}
      <div className="card-base p-5 border-red-500/20 bg-red-500/5">
        <h2 className="font-cairo font-bold mb-4 flex items-center gap-2 text-red-500">
          <AlertTriangle size={20} /> منطقة الخطر (إدارة البيانات)
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 bg-black/20">
          <div>
            <h3 className="font-bold text-red-400 mb-1">مسح جميع بيانات المنصة</h3>
            <p className="text-sm text-gray-400">
              سيتم حذف جميع حسابات الطلاب، الامتحانات، والإجابات. سيتم تصفير قاعدة البيانات بالكامل للبدء من جديد وتوفير المساحة. (لا يشمل الملفات المرفوعة يدوياً، يجب حذفها من Cloudinary لاحقاً إذا لزم الأمر).
            </p>
          </div>
          <button 
            onClick={() => setShowWipeModal(true)}
            className="btn-danger whitespace-nowrap"
          >
            <Trash2 size={16} /> مسح كل البيانات
          </button>
        </div>
      </div>

      {/* Wipe Confirmation Modal */}
      {showWipeModal && (
        <div className="modal-overlay" onClick={() => setShowWipeModal(false)}>
          <div className="modal-content modal-content-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header border-red-500/10 bg-red-500/5">
              <h3 className="font-bold text-lg text-red-500 flex items-center gap-2">
                <AlertTriangle size={20} /> تحذير نهائي!
              </h3>
              <button onClick={() => setShowWipeModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body py-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Trash2 size={32} />
              </div>
              <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                أنت على وشك مسح <span className="text-red-400 font-bold underline">جميع</span> البيانات من المنصة بشكل نهائي ولا يمكن التراجع عن هذا الإجراء أبداً.
              </p>
              
              <div className="bg-black/40 p-5 rounded-2xl border border-red-500/20">
                <label className="block text-xs mb-3 text-gray-400 font-bold uppercase tracking-wider">
                  للتأكيد، اكتب كلمة <span className="text-white px-2 py-0.5 bg-red-600 rounded">مسح</span> أدناه:
                </label>
                <input
                  type="text"
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  className="input-base text-center font-black text-red-400 text-xl border-red-500/30 focus:border-red-500 focus:ring-2 focus:ring-red-500/50 bg-red-500/5"
                  placeholder="اكتب هنا..."
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer bg-red-500/5">
              <button
                onClick={() => setShowWipeModal(false)}
                className="flex-1 btn-outline py-3"
                disabled={wiping}
              >
                إلغاء
              </button>
              <button
                onClick={handleWipeData}
                disabled={wipeConfirmText !== 'مسح' || wiping}
                className="flex-1 btn-danger justify-center py-3 shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:grayscale"
              >
                {wiping ? <><Loader2 size={18} className="animate-spin ml-2" /> جاري المسح...</> : 'تأكيد المسح النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Preview Modal */}
      {showCertPreview && (
        <div className="modal-overlay !bg-black/90" onClick={() => setShowCertPreview(false)}>
          <div className="modal-content modal-content-lg !p-1" onClick={e => e.stopPropagation()}>
             <button 
               onClick={() => setShowCertPreview(false)}
               className="absolute top-4 right-4 z-20 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black"
             >
               ✕
             </button>
             
             {/* Realistic Certificate Layout - Preview */}
             <div className="relative overflow-hidden bg-gradient-to-br from-white to-[#fdfbf7] min-h-[600px] flex flex-col items-center border-[8px] border-[#F5C518] shadow-[inset_0_0_0_4px_#fff,inset_0_0_0_8px_#F5C518] p-8 md:p-12 text-center">
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#F5C518 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                {form.logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0">
                     <Image src={form.logoUrl} alt="Watermark" className="w-[60%] object-contain" width={300} height={300} />
                  </div>
                )}
                
                <div className="relative z-10 w-full flex-1 flex flex-col items-center">
                  <div className="mb-8 flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#1A1A25] rounded-full flex items-center justify-center shadow-lg mb-4">
                      🎓
                    </div>
                    <h3 className="text-4xl font-black mb-2 text-[#1A1A25] tracking-widest font-cairo" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                      {form.certHeader || 'شهادة إتمام واجتياز'}
                    </h3>
                  </div>
                  
                  <p className="text-2xl text-gray-700 mb-6 font-medium">بكل فخر واعتزاز، نمنح هذه الشهادة للطالب/ة:</p>
                  
                  <h2 className="text-5xl font-black text-[#F5C518] bg-[#1A1A25] px-12 py-5 rounded-2xl mb-8 shadow-2xl transform -rotate-1 hover:rotate-0 transition-transform font-cairo font-black inline-block">
                    اسم الطالب الرباعي
                  </h2>
                  
                  <p className="text-xl text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                    نظراً لاجتيازه(ا) بتفوق ونجاح دراسة واختبار <br/>
                    <b className="text-2xl text-[#1A1A25] inline-block mt-3 border-b-2 border-dashed border-[#F5C518] pb-1">&quot;الرياضيات المتقدمة و الجبر&quot;</b>
                  </p>
                  
                  <div className="w-full mt-auto flex flex-col sm:flex-row sm:grid sm:grid-cols-3 gap-4 items-center sm:items-end pt-8 border-t-2 border-[#F5C518]/20 text-center sm:text-right">
                     <div className="order-2 sm:order-1 sm:text-right">
                        <p className="text-sm text-gray-500 mb-2 font-bold">تاريخ الإصدار</p>
                        <p className="text-xl font-bold text-[#1A1A25]">{new Date().toLocaleDateString('ar-EG')}</p>
                     </div>
                     
                     <div className="text-center flex justify-center relative -top-8">
                        <div className="w-32 h-32 bg-gradient-to-br from-[#F5C518] to-[#d4af37] rounded-full flex flex-col items-center justify-center border-[6px] border-white shadow-2xl relative">
                           <div className="absolute inset-1 rounded-full border border-dashed border-black/20" />
                           <span className="text-sm font-bold text-[#1A1A25] mb-1">النسبة المئوية</span>
                           <span className="text-4xl font-black text-[#1A1A25]">100%</span>
                        </div>
                     </div>

                     <div className="order-3 sm:order-3 sm:text-left flex flex-col items-center">
                        <p className="text-sm text-gray-500 mb-2 font-bold text-center">التوقيع والختم</p>
                        {form.certSignatureUrl ? (
                           <Image src={form.certSignatureUrl} alt="توقيع" className="h-16 max-w-[150px] object-contain" width={150} height={64} />
                        ) : (
                           <p className="font-bold text-2xl text-[#1A1A25] mt-2 opacity-80 font-cairo shrink-0 text-center whitespace-nowrap">
                             {form.teacherName}
                           </p>
                        )}
                     </div>
                  </div>
                  
                  <p className="mt-6 text-lg text-gray-400 font-bold italic w-full text-center">
                    {form.certFooter || 'بكل فخر وتقدير'}
                  </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center opacity-50 font-cairo">جاري تحميل الإعدادات...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

