'use client';

import { useState, useEffect } from 'react';
import { getSettings, saveRegistrationRequest, uploadFileToStorage, dispatchNotification, getSuperAdmin } from '@/lib/db';
import { FileProcessor } from '@/lib/file-processor';
import { useFileProcessingStore } from '@/lib/store';
import type { Settings, TeacherUser } from '@/types';
import { showToast } from '@/lib/toast';
import { GraduationCap, ShieldCheck, Mail, Phone, Calculator, CheckCircle2, User, FileText, Upload, Image as ImageIcon, Loader2, BookOpen, Sparkles, CreditCard } from 'lucide-react';
import { PDFCompressionModal } from '@/components/PDFCompressionModal';

export default function TeacherRegisterPage() {
  const { queue } = useFileProcessingStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [superAdmin, setSuperAdmin] = useState<TeacherUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [teacherImageFile, setTeacherImageFile] = useState<File | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    parentPhone: '', // Not used for teachers but keeping compatible with type
    grade: '', // Not used for teachers but keeping compatible with type
    subject: '',
    subType: 'monthly' as 'monthly' | 'yearly',
    paymentRef: '',
    receiptUrl: '',
    type: 'teacher' as 'teacher',
    imageUrl: ''
  });

  // PDF Compression state
  const [compressionModal, setCompressionModal] = useState<{
    isOpen: boolean;
    file: File | null;
    onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  }>({ isOpen: false, file: null });

  useEffect(() => {
    getSuperAdmin().then(admin => {
      setSuperAdmin(admin);
      if (admin) {
        getSettings(admin.id).then(s => {
          setSettings(s);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const handleUploaded = (e: any) => {
      const { url, path, fileName } = e.detail;
      if (path.startsWith('receipts/')) {
        setForm(f => ({ ...f, receiptUrl: url }));
        setUploadProgress(0);
        showToast('تم اكتمال رفع إيصال الدفع');
      } else if (path.startsWith('teachers/')) {
        setForm(f => ({ ...f, imageUrl: url }));
        setImageUploadProgress(0);
        showToast('تم اكتمال رفع الصورة الشخصية');
      }
    };
    window.addEventListener('fileUploaded', handleUploaded);
    return () => window.removeEventListener('fileUploaded', handleUploaded);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.subject || !superAdmin) {
      showToast('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setSubmitting(true);
    try {
      const requestData: any = {
        ...form,
        teacherId: superAdmin.id,
        status: 'pending',
        createdAt: Date.now(),
      };
      
      await saveRegistrationRequest(requestData);
      
      try {
        await dispatchNotification({
          teacherId: superAdmin.id,
          msg: `طلب انضمام معلم جديد: ${form.name} (${form.subject})`,
          targetRoles: ['admin'],
          channels: { inApp: true, whatsapp: false }
        });
      } catch (e) { console.error(e); }

      setSuccess(true);
    } catch (error: any) {
      showToast('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c]"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] text-white p-4" dir="rtl">
        <div className="card-base max-w-md w-full p-8 text-center space-y-6 !border-purple-500/30">
          <CheckCircle2 size={60} className="text-purple-500 mx-auto" />
          <h1 className="text-2xl font-black text-purple-400">تم إرسال طلبك بنجاح!</h1>
          <p className="text-gray-300">أهلاً بك يا أستاذ {form.name}، تم استلام طلب انضمامك للمنصة. سيقوم الدعم الفني بمراجعة طلبك وتفعيل حسابك خلال 24 ساعة.</p>
          <button onClick={() => window.location.href = '/'} className="btn-gold w-full bg-purple-600">العودة للرئيسية</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-4 sm:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
            <Sparkles size={40} className="text-purple-400" />
          </div>
          <h1 className="text-3xl font-black gold-text">انضم إلينا كمعلم</h1>
          <p className="text-gray-400">ابدأ الآن في بناء أكاديميتك الإلكترونية الخاصة بكل سهولة واحترافية.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-base p-6 border-purple-500/20 bg-purple-500/5 space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-purple-400">
              <CreditCard size={20} /> تعليمات الدفع وطرق التحويل
            </h3>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-white leading-relaxed whitespace-pre-wrap font-medium">
              {settings?.paymentMethods || 'يرجى التواصل مع الإدارة للحصول على بيانات التحويل.'}
            </div>
            {settings?.whatsappNumber && (
              <a 
                href={`https://wa.me/${settings.whatsappNumber.startsWith('2') ? settings.whatsappNumber : '2' + settings.whatsappNumber}?text=${encodeURIComponent('مرحباً، أود الاستفسار عن تفاصيل الدفع لتفعيل حساب المعلم.')}`}
                target="_blank"
                className="btn-outline w-full border-green-500/30 text-green-400 hover:bg-green-500/10 flex items-center justify-center gap-2 py-3 text-xs"
              >
                <Phone size={14} /> تواصل مع الدعم الفني عبر واتساب
              </a>
            )}
          </div>

          <div className="card-base p-6 border-blue-500/20 bg-blue-500/5 space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-blue-400">
              <Calculator size={20} /> خطط الأسعار
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                 <div className="text-xs text-gray-400 mb-1">شهري</div>
                 <div className="text-xl font-black text-white">{settings?.monthlyPrice || 0} ج.م</div>
              </div>
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                 <div className="text-xs text-gray-400 mb-1">سنوي</div>
                 <div className="text-xl font-black text-white">{settings?.yearlyPrice || 0} ج.م</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-base p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">الاسم الكامل</label>
                <div className="relative">
                  <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="أدخل اسمك الثلاثي أو الرباعي" className="input-base pr-12 w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400 px-1">رقم الهاتف (واتساب)</label>
                <div className="relative">
                  <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="tel" placeholder="01XXXXXXXXX" className="input-base pr-12 w-full" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required/>
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-gray-400 px-1">المادة الدراسية</label>
                <div className="relative">
                  <BookOpen size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="مثال: لغة عربية، رياضيات، فيزياء..." className="input-base pr-12 w-full" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required/>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-300">اختر باقة الاشتراك</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`cursor-pointer p-4 rounded-2xl border transition-all text-center ${form.subType === 'monthly' ? 'bg-purple-500/20 border-purple-500 shadow-lg' : 'bg-white/5 border-white/5'}`}>
                  <input type="radio" className="hidden" name="sub" checked={form.subType === 'monthly'} onChange={() => setForm({...form, subType: 'monthly'})} />
                  <div className="font-bold">اشتراك شهري</div>
                  <div className="text-xs text-gray-400 mt-1">{settings?.monthlyPrice || 0} ج.م</div>
                </label>
                <label className={`cursor-pointer p-4 rounded-2xl border transition-all text-center ${form.subType === 'yearly' ? 'bg-purple-500/20 border-purple-500 shadow-lg' : 'bg-white/5 border-white/5'}`}>
                  <input type="radio" className="hidden" name="sub" checked={form.subType === 'yearly'} onChange={() => setForm({...form, subType: 'yearly'})} />
                  <div className="font-bold">اشتراك سنوي</div>
                  <div className="text-xs text-gray-400 mt-1">{settings?.yearlyPrice || 0} ج.م</div>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {/* Profile Image Upload */}
              <div className="relative">
                <label className="text-xs text-gray-400 px-1">صورة شخصية للمعلم (اختياري)</label>
                <label className="btn-outline w-full border-dashed border-white/20 py-6 flex flex-col items-center gap-2 cursor-pointer hover:border-purple-500 hover:text-purple-400 mb-4">
                  {imageUploadProgress > 0 && imageUploadProgress < 100 ? (
                    <Loader2 size={24} className="animate-spin text-purple-500" />
                  ) : (
                    <ImageIcon size={24} />
                  )}
                  <span className="text-sm">
                    {imageUploadProgress > 0 && imageUploadProgress < 100 
                      ? `جاري الرفع... ${imageUploadProgress}%` 
                      : (teacherImageFile ? teacherImageFile.name : 'ارفع صورة شخصية لعرضها في حسابك')}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTeacherImageFile(file);
                      setImageUploadProgress(10);
                      const path = `teachers/profile_${Date.now()}_${file.name}`;
                      try {
                        await FileProcessor.queueFile(file, path);
                        showToast('جاري رفع الصورة...');
                      } catch (err) {
                        setImageUploadProgress(0);
                      }
                    }
                  }} disabled={submitting || queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('teachers/'))} />
                </label>
                {queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('teachers/')) && (
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-3 mb-2">
                    <div className="bg-purple-500 h-full transition-all duration-300 animate-pulse w-full" />
                  </div>
                )}
                {form.imageUrl && <div className="text-[10px] text-green-400 text-center mt-2 mb-2">✅ تم رفع الصورة بنجاح</div>}
              </div>

              <div className="relative">
                <label className="text-xs text-gray-400 px-1">رقم التحويل أو تفاصيل الدفع</label>
                <textarea placeholder="أدخل كود التحويل أو أي ملاحظات حول الدفع..." className="input-base w-full min-h-[80px]" value={form.paymentRef} onChange={e => setForm({...form, paymentRef: e.target.value})} />
              </div>

              <div className="relative">
                <label className="text-xs text-gray-400 px-1">صورة الإيصال (اختياري)</label>
                <label className="btn-outline w-full border-dashed border-white/20 py-6 flex flex-col items-center gap-2 cursor-pointer hover:border-purple-500 hover:text-purple-400">
                  <Upload size={24} />
                  <span className="text-sm">{receiptFile ? receiptFile.name : 'ارفع صورة الإيصال لتسريع عملية التفعيل'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReceiptFile(file);
                      const path = `receipts/teacher_${Date.now()}_${file.name}`;
                      await FileProcessor.queueFile(file, path);
                      showToast('جاري رفع الإيصال...');
                    }
                  }} />
                </label>
                {form.receiptUrl && <div className="text-[10px] text-green-400 text-center mt-2">✅ تم الرفع والإرفاق</div>}
              </div>
            </div>

            <button type="submit" disabled={submitting || queue.some(f => f.status !== 'completed' && f.status !== 'failed' && (f.path.startsWith('receipts/') || f.path.startsWith('teachers/')))} className="btn-gold w-full py-4 text-lg font-black bg-purple-600 shadow-xl shadow-purple-500/20 active:scale-95 transition-all">
              {submitting ? 'جاري الإرسال...' : queue.some(f => f.status !== 'completed' && f.status !== 'failed' && (f.path.startsWith('receipts/') || f.path.startsWith('teachers/'))) ? '⏳ جاري الرفع...' : 'إرسال طلب الانضمام الآن'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
