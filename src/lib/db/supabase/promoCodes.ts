// src/lib/db/supabase/promoCodes.ts
import { supabase } from '@/lib/supabase';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { PromoCode } from '@/types';

const PROMO_CODES_TABLE = 'promo_codes';
const LOCAL_STORAGE_KEY = 'an_academy_promo_codes_backup';

// Helper to generate a clean random promo code string
export const generateRandomPromoCode = (prefix: string = 'AN'): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${rand}`;
};

// Backup helper for local storage fallback
const getLocalPromoCodes = (): PromoCode[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalPromoCodes = (codes: PromoCode[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(codes));
  } catch {}
};

/** Get all promo codes */
export const getPromoCodes = async (): Promise<PromoCode[]> => {
  try {
    const { data, error } = await supabase
      .from(PROMO_CODES_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Fallback to local promo codes due to table error:', error.message);
      return getLocalPromoCodes();
    }
    const result = manyFromDB<PromoCode>(data);
    saveLocalPromoCodes(result);
    return result;
  } catch (err) {
    console.warn('Fallback to local promo codes:', err);
    return getLocalPromoCodes();
  }
};

/** Save or update a promo code */
export const savePromoCode = async (promo: Omit<PromoCode, 'id'> & { id?: string }): Promise<PromoCode> => {
  const id = promo.id || crypto.randomUUID();
  const cleanCode = (promo.code || '').trim().toUpperCase();

  if (!cleanCode) throw new Error('رمز الخصم مطلوب');

  const record: PromoCode = {
    id,
    code: cleanCode,
    discountType: promo.discountType || 'percentage',
    discountValue: Math.max(0, Number(promo.discountValue) || 0),
    maxUses: Math.max(0, Number(promo.maxUses) || 0),
    usedCount: Number(promo.usedCount) || 0,
    targetRole: promo.targetRole || 'all',
    expiryDate: promo.expiryDate || null,
    isActive: promo.isActive !== false,
    createdAt: promo.createdAt || Date.now(),
  };

  try {
    const payload = toDB(record);
    const { error } = await supabase
      .from(PROMO_CODES_TABLE)
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      console.warn('Error saving promo code to DB, saving locally:', error.message);
    }
  } catch (e) {
    console.warn('Local fallback for savePromoCode:', e);
  }

  // Update local storage backup
  const current = getLocalPromoCodes();
  const existingIndex = current.findIndex(c => c.id === record.id || c.code === record.code);
  let updatedList: PromoCode[];
  if (existingIndex >= 0) {
    updatedList = [...current];
    updatedList[existingIndex] = record;
  } else {
    updatedList = [record, ...current];
  }
  saveLocalPromoCodes(updatedList);

  return record;
};

/** Delete a promo code */
export const deletePromoCode = async (id: string): Promise<void> => {
  try {
    await supabase.from(PROMO_CODES_TABLE).delete().eq('id', id);
  } catch (e) {
    console.warn('Failed deleting promo code from DB:', e);
  }
  const current = getLocalPromoCodes();
  saveLocalPromoCodes(current.filter(c => c.id !== id));
};

/**
 * Validate a promo code against role, usage limits, and original price
 */
export const validatePromoCode = async (
  codeStr: string,
  role: 'teacher' | 'student' | 'assistant' | 'all' = 'all',
  originalPrice: number = 0
): Promise<{
  valid: boolean;
  message: string;
  discountAmount: number;
  finalPrice: number;
  promoCode?: PromoCode;
}> => {
  const cleanCode = (codeStr || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'يرجى إدخال رمز الخصم', discountAmount: 0, finalPrice: originalPrice };
  }

  const allCodes = await getPromoCodes();
  const promo = allCodes.find(c => c.code === cleanCode);

  if (!promo) {
    return { valid: false, message: 'رمز الخصم/الدعوة غير صحيح', discountAmount: 0, finalPrice: originalPrice };
  }

  if (!promo.isActive) {
    return { valid: false, message: 'رمز الخصم متوقف حالياً', discountAmount: 0, finalPrice: originalPrice };
  }

  if (promo.expiryDate && promo.expiryDate < Date.now()) {
    return { valid: false, message: 'رمز الخصم منتهي الصلاحية', discountAmount: 0, finalPrice: originalPrice };
  }

  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return { valid: false, message: 'تم استنفاذ جميع مرات استخدام هذا الرمز', discountAmount: 0, finalPrice: originalPrice };
  }

  if (promo.targetRole && promo.targetRole !== 'all' && role !== 'all' && promo.targetRole !== role) {
    const roleMap: Record<string, string> = { teacher: 'المعلمين', student: 'الطلاب', assistant: 'المساعدين' };
    const targetName = roleMap[promo.targetRole] || promo.targetRole;
    return { valid: false, message: `هذا الرمز مخصص لفئة ${targetName} فقط`, discountAmount: 0, finalPrice: originalPrice };
  }

  // Calculate discount
  let discountAmount = 0;
  if (promo.discountType === 'percentage') {
    discountAmount = (originalPrice * promo.discountValue) / 100;
  } else {
    discountAmount = promo.discountValue;
  }

  discountAmount = Math.min(discountAmount, originalPrice);
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    valid: true,
    message: `تم تطبيق خصم بقيمة ${discountAmount.toLocaleString('ar-EG')} ج.م بنجاح! 🎉`,
    discountAmount,
    finalPrice,
    promoCode: promo,
  };
};

/** Increment usage count for a promo code */
export const usePromoCode = async (codeStr: string): Promise<void> => {
  const cleanCode = (codeStr || '').trim().toUpperCase();
  if (!cleanCode) return;

  const allCodes = await getPromoCodes();
  const promo = allCodes.find(c => c.code === cleanCode);
  if (!promo) return;

  const updated: PromoCode = {
    ...promo,
    usedCount: promo.usedCount + 1,
  };

  await savePromoCode(updated);
};
