'use client';
// src/components/RenewalRequestModal.tsx

import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, Loader2, CreditCard, Phone, FileImage, AlertCircle } from 'lucide-react';
import { showToast } from '@/lib/toast';
import type { Settings, Student, TeacherUser } from '@/types';

export type RenewalTarget = 'student' | 'teacher';

interface RenewalRequestModalProps {
  settings: Settings | null;
  target: RenewalTarget;
  userData: Student | TeacherUser; // The student or teacher object
  onClose: () => void;
  onSubmit: (data: {
    subType: string;
    paymentRef: string;
    receiptUrl: string;
    notes: string;
  }) => Promise<void>;
}

const SUB_TYPES_STUDENT = [
  { value: 'monthly', label: 'شهري', priceKey: 'monthlyPrice' },
  { value: 'halfYearly', label: 'نصف سنوي', priceKey: 'halfYearlyPrice' },
  { value: 'yearly', label: 'سنوي', priceKey: 'yearlyPrice' },
  { value: 'course', label: 'كورس كامل', priceKey: 'coursePrice' },
  { value: 'session', label: 'بالحصة', priceKey: 'sessionPrice' },
] as const;

const SUB_TYPES_TEACHER = [
  { value: 'monthly', label: 'شهري', priceKey: 'monthlyPrice' },
  { value: 'yearly', label: 'سنوي', priceKey: 'yearlyPrice' },
] as const;

export function RenewalRequestModal({ settings, target, userData, onClose, onSubmit }: RenewalRequestModalProps) {
  const [subType, setSubType] = useState('monthly');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subTypes = target === 'student' ? SUB_TYPES_STUDENT : SUB_TYPES_TEACHER;

  const getPrice = (key: string): number | undefined => {
    if (!settings) return undefined;
    return (settings as any)[key];
  };

  const selectedSubTypeData = subTypes.find(s => s.value === subType);
  const selectedPrice = selectedSubTypeData && 'priceKey' in selectedSubTypeData
    ? getPrice(selectedSubTypeData.priceKey)
    : undefined;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('❌ حجم الملف كبير جداً (الأقصى 10 ميجابايت)');
      return;
    }

    setUploading(true);
    try {
      const { uploadFileToStorage } = await import('@/lib/db');
      const path = `receipts/${Date.now()}_${file.name}`;
      const url = await uploadFileToStorage(file, path);
      setReceiptUrl(url);
      setUploadDone(true);
      showToast('✅ تم رفع الإيصال بنجاح');
    } catch (err: any) {
      showToast('❌ فشل رفع الإيصال: ' + (err?.message || 'تحقق من الاتصال'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!paymentRef.trim() && !receiptUrl) {
      showToast('⚠️ يرجى إدخال مرجع الدفع أو رفع صورة الإيصال');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ subType, paymentRef, receiptUrl, notes });
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMethods = settings?.paymentMethods?.trim();
  const subLabel = subTypes.find(s => s.value === subType)?.label || subType;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-[#0f1117] border border-gold/20 rounded-2xl shadow-2xl shadow-black/60 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/8 bg-gradient-to-r from-gold/10 to-transparent flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
            <CreditCard size={20} className="text-gold" />
          </div>
          <div>
            <h2 className="font-cairo font-black text-lg text-white">طلب تجديد الاشتراك</h2>
            <p className="text-xs text-gray-400">
              {target === 'student' ? 'أرسل طلبك وانتظر موافقة المعلم' : 'أرسل طلبك وانتظر موافقة الإدارة'}
            </p>
          </div>
          <button onClick={onClose} className="mr-auto p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Prices panel */}
          {settings && (
            <div className="bg-gradient-to-br from-gold/8 to-transparent border border-gold/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gold font-bold text-sm">💰 أسعار الاشتراكات</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {subTypes.map(s => {
                  const price = 'priceKey' in s ? getPrice(s.priceKey) : undefined;
                  if (price === undefined && target === 'student') return null;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setSubType(s.value)}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        subType === s.value
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-white/10 bg-white/3 text-gray-300 hover:border-gold/40'
                      }`}
                    >
                      <div className="font-bold text-sm">{s.label}</div>
                      <div className={`text-lg font-black ${subType === s.value ? 'text-gold' : 'text-white'}`}>
                        {price !== undefined ? `${price} ج.م` : 'تواصل للإستفسار'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Methods */}
          {paymentMethods && (
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone size={14} className="text-blue-400" />
                <span className="text-blue-300 font-bold text-sm">طرق الدفع المتاحة</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{paymentMethods}</p>
            </div>
          )}

          {/* Payment Reference */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-bold">
              مرجع الدفع / رقم العملية
            </label>
            <input
              type="text"
              placeholder="مثال: 123456789 أو رقم الحوالة..."
              className="input-base w-full text-sm"
              value={paymentRef}
              onChange={e => setPaymentRef(e.target.value)}
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-bold">
              صورة إيصال الدفع
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadDone ? (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                <span className="text-green-400 text-sm font-bold">تم رفع الإيصال بنجاح</span>
                <button
                  onClick={() => { setReceiptUrl(''); setUploadDone(false); }}
                  className="mr-auto text-xs text-red-400 hover:text-red-300"
                >
                  إزالة
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full p-4 border-2 border-dashed border-white/15 hover:border-gold/40 rounded-xl text-center transition-all group"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">جاري الرفع...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-gray-400 group-hover:text-gold">
                    <FileImage size={18} />
                    <span className="text-sm">اضغط لرفع صورة الإيصال (اختياري)</span>
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-bold">ملاحظات إضافية (اختياري)</label>
            <textarea
              placeholder="أي ملاحظات تريد إرسالها..."
              className="input-base w-full text-sm h-20 resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              {target === 'student'
                ? 'بعد إرسال الطلب، سيقوم المعلم بالمراجعة والموافقة. ستتمكن من الدخول للمنصة عند التأكيد.'
                : 'بعد إرسال الطلب، سيقوم فريق الإدارة بالمراجعة والموافقة. ستتمكن من الدخول للمنصة عند التأكيد.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/8 flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">إلغاء</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="btn-gold flex-[2] justify-center"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> جاري الإرسال...</>
            ) : (
              <>📤 إرسال طلب التجديد</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
