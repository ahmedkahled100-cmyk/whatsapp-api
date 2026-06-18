'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  getTeachers, 
  saveRegistrationRequest, 
  dispatchNotification, 
  getStudentByPhoneAnywhere,
  uploadFileToStorage,
  getSettings
} from '@/lib/db';
import { FileProcessor } from '@/lib/file-processor';
import { useFileProcessingStore } from '@/lib/store';
import { normalizePhone } from '@/lib/utils';
import type { Settings, TeacherUser } from '@/types';
import { showToast } from '@/lib/toast';
import { GraduationCap, ShieldCheck, Mail, Phone, Calculator, CheckCircle2, User, FileText, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { PDFCompressionModal } from '@/components/PDFCompressionModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const queryTeacherId = searchParams.get('teacherId');
  const { queue } = useFileProcessingStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [studentImageFile, setStudentImageFile] = useState<File | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const [form, setForm] = useState({
    name: searchParams.get('name') || '',
    phone: searchParams.get('phone') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    grade: '',
    subType: 'monthly' as 'monthly' | 'yearly' | 'halfYearly' | 'course' | 'session',
    subPrice: 0,
    paymentRef: '',
    receiptUrl: '',
    imageUrl: '',
    existingCode: '',
    studentId: ''
  });

  // PDF Compression state
  const [compressionModal, setCompressionModal] = useState<{
    isOpen: boolean;
    file: File | null;
    onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  }>({ isOpen: false, file: null });

  useEffect(() => {
    getTeachers().then(ts => {
      setTeachers(ts);
      if (queryTeacherId && ts.some(t => t.id === queryTeacherId)) {
        setSelectedTeacherId(queryTeacherId);
      } else if (ts.length > 0) {
        const defaultT = ts.find(t => t.role === 'super_admin') || ts[0];
        setSelectedTeacherId(defaultT.id);
      } else {
        setLoading(false);
      }
    });
  }, [queryTeacherId]);

  useEffect(() => {
    if (selectedTeacherId) {
      setLoading(true);
      getSettings(selectedTeacherId).then(s => {
        setSettings(s);
        setForm(f => ({ ...f, subPrice: s?.monthlyPrice || 0 }));
        setLoading(false);
      });
    }
  }, [selectedTeacherId]);

  // Listen for background upload completion
  useEffect(() => {
    const handleUploaded = (e: any) => {
      const { url, path, fileName } = e.detail;
      if (path.startsWith('receipts/')) {
        setForm(f => ({ ...f, receiptUrl: url }));
        setUploadProgress(0);
        if (e.detail.stats) {
          const { originalSize, compressedSize } = e.detail.stats;
          const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          showToast(`✅ تم الضغط والرفع: ${fileName || 'الإيصال'} (قل بنسبة ${reduction}%)`);
        } else {
          showToast('تم اكتمال رفع إيصال الدفع');
        }
      } else if (path.startsWith('students/')) {
        setForm(f => ({ ...f, imageUrl: url }));
        setImageUploadProgress(0);
        showToast('تم اكتمال رفع صورة الطالب');
      }
    };
    window.addEventListener('fileUploaded', handleUploaded);
    return () => window.removeEventListener('fileUploaded', handleUploaded);
  }, []);
  // Auto-fill Profile from Unified Identity
  useEffect(() => {
    const phone = normalizePhone(form.phone);
    if (phone && phone.length >= 10) {
      const timeout = setTimeout(async () => {
        try {
          const existing = await getStudentByPhoneAnywhere(phone);
          if (existing) {
            setForm(f => ({
              ...f,
              name: f.name || existing.name,
              parentPhone: f.parentPhone || existing.parentPhone || '',
              grade: f.grade || existing.grade || '',
              imageUrl: f.imageUrl || existing.imageUrl || '',
              existingCode: existing.code || '',
              studentId: existing.id || '',
            }));
            showToast('✨ تم استرجاع بيانات ملفك الشخصي الموحد');
          }
        } catch (e) {
          console.warn('Auto-fill failed:', e);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [form.phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.parentPhone || !selectedTeacherId) {
      showToast('يرجى ملء جميع الحقول المطلوبة واختيار المعلم');
      return;
    }

    setSubmitting(true);
    try {
      // Unified Code Check: Search for student by phone across ALL academies
      let existingCode = '';
      let studentId = '';
      try {
        const existing = await getStudentByPhoneAnywhere(form.phone);
        if (existing) {
          existingCode = existing.code;
          // IMPORTANT: DO NOT set studentId = existing.id here. 
          // If we pass an existing ID for a different teacher, it will overwrite the old student record.
          
          // Ensure image is unified if no new one was uploaded
          if (!form.imageUrl && existing.imageUrl) {
            form.imageUrl = existing.imageUrl;
          }
        }
      } catch (e) {
        console.warn('Unified code check failed:', e);
      }

      const requestData: any = {
        ...form,
        teacherId: selectedTeacherId,
        studentId,
        existingCode,
        status: 'pending',
        createdAt: Date.now(),
      };
      
      await saveRegistrationRequest(requestData);
      
      try {
        await dispatchNotification({
          teacherId: selectedTeacherId,
          msg: `طلب اشتراك جديد: ${form.name} (${form.subType})`,
          targetRoles: ['teacher'],
          channels: { inApp: true, whatsapp: false },
          actionPath: '/teacher/subscriptions'
        });
        if (form.phone) {
          await dispatchNotification({
            teacherId: selectedTeacherId,
            msg: `أهلاً بك ${form.name} في منصتنا! تم استلام طلبك وبانتظار تفعيله من الإدارة.`,
            whatsappNumbers: [form.phone],
            channels: { inApp: false, whatsapp: true }
          });
        }
      } catch (e) {
        console.error('Failed to dispatch notifications:', e);
      }

      setSuccess(true);
    } catch (error: any) {
      console.error(error);
      showToast('حدث خطأ أثناء إرسال الطلب: ' + (error.message || 'يرجى المحاولة لاحقاً.'));
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gold border-t-transparent"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] text-white p-4" dir="rtl">
        <div className="card-base max-w-md w-full p-8 text-center space-y-6 !border-green-500/30">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-green-400">تم إرسال طلبك بنجاح!</h1>
          <p className="text-gray-300">
            شكراً لك {form.name}، لقد تم استلام طلب الاشتراك الخاص بك. 
            يرجى الانتظار حتى يقوم المعلم بمراجعة الطلب وتفعيل الحساب. سيتم التواصل معك قريباً.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-3 sm:p-6 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header Section - Logo, Academy Info, Payment Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Academy Info Card */}
          <div className="card-base p-5 sm:p-6 text-center bg-gradient-to-b from-white/5 to-transparent">
            {settings?.logoUrl ? (
              <img loading="lazy" src={settings.logoUrl} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 object-contain rounded-full" />
            ) : (
              <img loading="lazy" src="/logo.png" alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 object-contain rounded-full bg-white/5 p-1" />
            )}
            <h2 className="text-lg sm:text-xl font-black mb-1">{settings?.acadName || 'أكاديمية A-N'}</h2>
            <p className="text-gray-400 text-xs sm:text-sm">أهلاً بك في منصتنا التعليمية، نهدف لتقديم أفضل مستوى تعليمي لك.</p>
          </div>

          {/* Payment Methods Card */}
          <div className="card-base p-5 sm:p-6 border-blue-500/20 bg-blue-500/5">
            <h3 className="font-bold mb-3 sm:mb-4 flex items-center gap-2 text-blue-400 text-sm sm:text-base">
              <ShieldCheck size={18} />
              طرق و تعليمات الدفع
            </h3>
            {settings?.paymentMethods ? (
              <div className="text-[12px] sm:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                {settings.paymentMethods}
              </div>
            ) : (
              <p className="text-xs text-gray-500">لم يقم المعلم بتحديد تفاصيل طرق الدفع بعد. يمكنك التسجيل مؤقتاً وسيتم التواصل معك.</p>
            )}
          </div>
        </div>

        {/* Registration Form */}
        <div className="card-base p-5 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-black mb-2 gold-text">طلب اشتراك جديد</h1>
            <p className="text-xs sm:text-sm text-gray-400">انضم إلينا الآن للبدء في رحلة التعلم</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-4">
              <div className="relative">
                <User size={18} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="اسم الطالب (رباعي)" 
                  className="input-base has-icon-right w-full text-sm sm:text-base"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-sm mb-2 text-gray-300 font-bold px-1">المعلم المطلوب التسجيل معه</label>
                <select 
                  className="input-base w-full text-sm sm:text-base"
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                  required
                >
                  <option value="" disabled>اختر المعلم...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.code ? `[${t.code}]` : `(@${t.username})`}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Phone size={18} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
                  <input 
                    type="tel" 
                    placeholder="رقم الطالب" 
                    className="input-base has-icon-right w-full text-right text-sm sm:text-base"
                    dir="rtl"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    required
                  />
                </div>
                <div className="relative">
                  <Phone size={18} className="absolute top-1/2 -translate-y-1/2 right-4 text-gold" />
                  <input 
                    type="tel" 
                    placeholder="رقم ولي الأمر" 
                    className="input-base has-icon-right w-full text-right text-sm sm:text-base"
                    dir="rtl"
                    value={form.parentPhone}
                    onChange={e => setForm({...form, parentPhone: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="relative">
                <GraduationCap size={18} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="الصف الدراسي (مثال: الصف الأول الثانوي)" 
                  className="input-base has-icon-right w-full text-sm sm:text-base"
                  value={form.grade}
                  onChange={e => setForm({...form, grade: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-gray-300 font-bold px-1">نوع الاشتراك المطلوب</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <label className={`cursor-pointer p-3 rounded-xl border border-white/10 text-center transition-all flex flex-col justify-center ${form.subType === 'monthly' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 hover:bg-white/10'}`}>
                    <input type="radio" className="hidden" name="type" checked={form.subType === 'monthly'} onChange={() => setForm({...form, subType: 'monthly', subPrice: settings?.monthlyPrice || 0})} />
                    <div className="font-bold text-sm sm:text-base">شهري</div>
                    {settings?.monthlyPrice && <div className="text-[10px] sm:text-xs mt-1 opacity-80">{settings.monthlyPrice} ج.م</div>}
                  </label>
                  <label className={`cursor-pointer p-3 rounded-xl border border-white/10 text-center transition-all flex flex-col justify-center ${form.subType === 'halfYearly' ? 'bg-gold/20 border-gold/50 gold-text' : 'bg-white/5 hover:bg-white/10'}`}>
                    <input type="radio" className="hidden" name="type" checked={form.subType === 'halfYearly'} onChange={() => setForm({...form, subType: 'halfYearly', subPrice: settings?.halfYearlyPrice || 0})} />
                    <div className="font-bold text-sm sm:text-base">نصف سنوي</div>
                    {settings?.halfYearlyPrice && <div className="text-[10px] sm:text-xs mt-1 opacity-80">{settings.halfYearlyPrice} ج.م</div>}
                  </label>
                  <label className={`cursor-pointer p-3 rounded-xl border border-white/10 text-center transition-all flex flex-col justify-center ${form.subType === 'yearly' ? 'bg-gold/20 border-gold/50 gold-text' : 'bg-white/5 hover:bg-white/10'}`}>
                    <input type="radio" className="hidden" name="type" checked={form.subType === 'yearly'} onChange={() => setForm({...form, subType: 'yearly', subPrice: settings?.yearlyPrice || 0})} />
                    <div className="font-bold text-sm sm:text-base">سنوي</div>
                    {settings?.yearlyPrice && <div className="text-[10px] sm:text-xs mt-1 opacity-80">{settings.yearlyPrice} ج.م</div>}
                  </label>
                  <label className={`cursor-pointer p-3 rounded-xl border border-white/10 text-center transition-all flex flex-col justify-center ${form.subType === 'course' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 hover:bg-white/10'}`}>
                    <input type="radio" className="hidden" name="type" checked={form.subType === 'course'} onChange={() => setForm({...form, subType: 'course', subPrice: settings?.coursePrice || 0})} />
                    <div className="font-bold text-sm sm:text-base">كورس كامل</div>
                    {settings?.coursePrice && <div className="text-[10px] sm:text-xs mt-1 opacity-80">{settings.coursePrice} ج.م</div>}
                  </label>
                  <label className={`cursor-pointer p-3 rounded-xl border border-white/10 text-center transition-all flex flex-col justify-center ${form.subType === 'session' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 hover:bg-white/10'}`}>
                    <input type="radio" className="hidden" name="type" checked={form.subType === 'session'} onChange={() => setForm({...form, subType: 'session', subPrice: settings?.sessionPrice || 0})} />
                    <div className="font-bold text-sm sm:text-base">بالحصة</div>
                    {settings?.sessionPrice && <div className="text-[10px] sm:text-xs mt-1 opacity-80">{settings.sessionPrice} ج.م</div>}
                  </label>
                </div>
              </div>

              <div className="relative">
                <FileText size={18} className="absolute top-3.5 right-4 text-gray-400" />
                <textarea 
                  placeholder="رقم التحويل أو كود الإيصال المحول منه (لتأكيد الدفع)..." 
                  className="input-base has-icon-right w-full min-h-[100px] resize-y text-sm sm:text-base"
                  value={form.paymentRef}
                  onChange={e => setForm({...form, paymentRef: e.target.value})}
                />
              </div>

              {/* Student Image / Photo Upload */}
              <div className="relative">
                <label className="block text-sm mb-2 text-gray-300 font-bold px-1">صورة الطالب الشخصية (اختياري)</label>
                <GlobalFileUpload 
                    accept="image/*"
                    needCrop={true}
                    circularCrop={true}
                    cropAspect={1}
                    isUploading={submitting || (queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('students/')))}
                    uploadProgress={imageUploadProgress}
                    label={studentImageFile ? studentImageFile.name : 'اختر صورة شخصية للطالب'}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 20 * 1024 * 1024) {
                            showToast('حجم الصورة كبير جداً (أقصى حجم 20 ميجابايت)');
                            return;
                          }
                          setStudentImageFile(file);
                          setImageUploadProgress(10);
                          try {
                            const fileName = `${Date.now()}_${form.phone || 'no_phone'}_profile_${file.name}`;
                            const path = `students/${fileName}`;
                            await FileProcessor.queueFile(file, path);
                            showToast('جاري رفع صورة الطالب...');
                          } catch (err: any) {
                            showToast(err.message || 'فشل رفع الصورة');
                            setImageUploadProgress(0);
                          }
                        }
                    }}
                />
                {queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('students/')) && (
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-3">
                    <div className="bg-gold h-full transition-all duration-300 animate-pulse w-full" />
                  </div>
                )}
                {form.imageUrl && (
                  <div className="text-[10px] sm:text-xs text-green-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={14} /> تم إرفاق الصورة الشخصية بنجاح
                  </div>
                )}
              </div>

              {/* Receipt File Upload */}
              <div className="relative">
                <label className="block text-sm mb-2 text-gray-300 font-bold px-1">إرفاق صورة الإيصال (اختياري)</label>
                <GlobalFileUpload 
                    accept="image/*"
                    isUploading={submitting || (queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('receipts/')))}
                    uploadProgress={uploadProgress}
                    label={receiptFile ? receiptFile.name : 'اختر صورة الفاتورة / سكرين شوت الحوالة'}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 100 * 1024 * 1024) {
                            showToast('حجم الصورة كبير جداً (أقصى حجم 100 ميجابايت)');
                            return;
                          }
                            setReceiptFile(file);
                            setUploadProgress(10); // Start showing activity

                            // Check if PDF > 10MB - Show compression modal
                            const TEN_MB = 10 * 1024 * 1024;
                            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                            
                            if (isPdf && file.size > TEN_MB) {
                              setCompressionModal({
                                isOpen: true,
                                file: file,
                                onComplete: async (compressedBlob, cloudinaryUrl, stats) => {
                                  try {
                                    const fileName = `${Date.now()}_${form.phone || 'no_phone'}_${file.name}`;
                                    const path = `receipts/${fileName}`;
                                    
                                    // Dispatch event to update the UI
                                    window.dispatchEvent(new CustomEvent('fileUploaded', {
                                      detail: { 
                                        url: cloudinaryUrl, 
                                        path, 
                                        fileName: file.name,
                                        stats
                                      }
                                    }));

                                    setReceiptFile(new File([compressedBlob], file.name, { type: 'application/pdf' }));
                                    setForm(f => ({ ...f, receiptUrl: cloudinaryUrl }));
                                    setUploadProgress(0);
                                    setCompressionModal({ isOpen: false, file: null });
                                  } catch (err: any) {
                                    console.error('Handoff Error:', err);
                                    showToast('حدث خطأ أثناء استلام الملف المضغوط');
                                  }
                                }
                              });
                              e.target.value = '';
                              return;
                            }

                            try {
                              const fileName = `${Date.now()}_${form.phone || 'no_phone'}_${file.name}`;
                              const path = `receipts/${fileName}`;
                              await FileProcessor.queueFile(file, path);
                              showToast('جاري معالجة الإيصال في الخلفية...');
                            } catch (err: any) {
                              showToast(err.message || 'فشل معالجة الملف');
                              setUploadProgress(0);
                            }
                          }
                        }}
                />
                  {queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('receipts/')) && (
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-3">
                      <div className="bg-gold h-full transition-all duration-300 animate-pulse w-full" />
                    </div>
                  )}
                  {form.receiptUrl && (
                    <div className="text-[10px] sm:text-xs text-gold mt-2 flex items-center gap-1">
                      <ImageIcon size={14} /> تم رفع الصورة بنجاح و إرفاقها بالطلب
                    </div>
                  )}
                </div>
              </div>

              <button 
                disabled={submitting || queue.some(f => f.status !== 'completed' && f.status !== 'failed' && (f.path.startsWith('receipts/') || f.path.startsWith('students/')))} 
                type="submit" 
                className="btn-gold w-full mt-4 h-12 text-base sm:text-lg font-bold shadow-lg shadow-gold/20 disabled:opacity-50"
              >
                {submitting ? 'جاري إرسال الطلب...' : 
                 queue.some(f => f.status !== 'completed' && f.status !== 'failed' && (f.path.startsWith('receipts/') || f.path.startsWith('students/'))) ? 
                 '⏳ جاري الرفع...' : 'إرسال طلب الاشتراك'}
              </button>
          </form>
        </div>
      </div>

      {/* PDF Compression Modal */}
      {compressionModal.isOpen && compressionModal.file && (
        <PDFCompressionModal
          file={compressionModal.file}
          onClose={() => setCompressionModal({ isOpen: false, file: null })}
          onComplete={(blob, url, stats) => {
            compressionModal.onComplete?.(blob, url, stats);
            setCompressionModal({ isOpen: false, file: null });
          }}
          onCancel={() => {
            setCompressionModal({ isOpen: false, file: null });
          }}
        />
      )}
    </div>
  );

}
