'use client';

import { useState } from 'react';
import { validatePromoCode } from '@/lib/db';
import { showToast } from '@/lib/toast';
import { Ticket, CheckCircle, Tag, X, Sparkles, Loader2 } from 'lucide-react';

interface PromoCodeInputProps {
  role?: 'teacher' | 'student' | 'assistant' | 'all';
  originalPrice: number;
  onApply: (res: { code: string; discountAmount: number; finalPrice: number }) => void;
  onClear: () => void;
}

export function PromoCodeInput({
  role = 'all',
  originalPrice,
  onApply,
  onClear,
}: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    finalPrice: number;
    message: string;
  } | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      showToast('يرجى كتابة رمز الخصم أولاً', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await validatePromoCode(code, role, originalPrice);
      if (result.valid) {
        setAppliedPromo({
          code: result.promoCode?.code || code.trim().toUpperCase(),
          discountAmount: result.discountAmount,
          finalPrice: result.finalPrice,
          message: result.message,
        });
        onApply({
          code: result.promoCode?.code || code.trim().toUpperCase(),
          discountAmount: result.discountAmount,
          finalPrice: result.finalPrice,
        });
        showToast(result.message);
      } else {
        showToast(result.message, 'error');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء التحقق من رمز الخصم', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setAppliedPromo(null);
    onClear();
    showToast('تم إلغاء رمز الخصم');
  };

  return (
    <div className="card-base p-4 border-amber-500/20 bg-amber-500/5 rounded-2xl space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Ticket size={16} />
          <span>هل لديك رمز دعوة أو خصم؟</span>
        </label>
        {appliedPromo && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={12} />
            تم تطبيق الخصم
          </span>
        )}
      </div>

      {!appliedPromo ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="أدخل رمز الدعوة/الخصم..."
              className="input-field uppercase font-mono tracking-wider font-bold text-amber-200 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal text-sm py-2.5"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || !code.trim()}
            className="btn-gold px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-md shadow-amber-500/10 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>تطبيق</span>
          </button>
        </div>
      ) : (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-300 font-mono tracking-wider">
              الرمز المُطبق: {appliedPromo.code}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-400 hover:text-red-300 font-bold text-xs flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg transition"
            >
              <X size={12} />
              <span>إلغاء الخصم</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-500/20">
            <div className="space-x-2 space-x-reverse">
              <span className="text-gray-400">السعر الأصلي:</span>
              <span className="line-through text-gray-500">{originalPrice.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="space-x-2 space-x-reverse">
              <span className="text-gray-400">قيمة الخصم:</span>
              <span className="font-bold text-emerald-400">-{appliedPromo.discountAmount.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm font-bold text-white pt-1">
            <span>المبلغ الإجمالي بعد الخصم:</span>
            <span className="text-amber-300 text-base">{appliedPromo.finalPrice.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>
      )}
    </div>
  );
}
