import { supabase } from '@/lib/supabase';
import { TEACHERS, STUDENTS } from '../constants';
import { ASSISTANTS_PROFILES } from './hr';

export const checkUserUniqueness = async (
  code?: string,
  username?: string,
  excludeId?: string,
  phone?: string
): Promise<void> => {
  const codeCheck = code?.trim().toUpperCase();
  const usernameCheck = username?.trim().toLowerCase();

  if (!codeCheck && !usernameCheck) return;

  const checkTable = async (table: string, hasUsername: boolean) => {
    // Check code
    if (codeCheck) {
      let query = supabase.from(table).select('id, phone').eq('code', codeCheck);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query.limit(10); // Fetch a few to check phones
      if (error) throw error;
      if (data && data.length > 0) {
        const roleName = table === TEACHERS ? 'معلم' : table === STUDENTS ? 'طالب' : 'مساعد';
        // If it's the students table, allow if the phone matches (unified identity)
        if (table === STUDENTS && phone) {
          const allMatchPhone = data.every(row => row.phone === phone);
          if (!allMatchPhone) {
            throw new Error(`الكود المختار (${codeCheck}) مستخدم بالفعل بواسطة ${roleName} آخر.`);
          }
        } else {
          throw new Error(`الكود المختار (${codeCheck}) مستخدم بالفعل بواسطة ${roleName} آخر.`);
        }
      }
    }

    // Check username
    if (hasUsername && usernameCheck) {
      let query = supabase.from(table).select('id').eq('username', usernameCheck);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query.limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        const roleName = table === TEACHERS ? 'معلم' : table === STUDENTS ? 'طالب' : 'مساعد';
        const base = usernameCheck.replace(/\d+$/, '');
        const random1 = Math.floor(Math.random() * 900) + 100;
        const random2 = Math.floor(Math.random() * 90) + 10;
        throw new Error(`اسم المستخدم (${usernameCheck}) مسجل مسبقاً كـ ${roleName}.\nاقتراحات: ${base}${random1}, ${base}${random2}`);
      }
    }
  };

  await Promise.all([
    checkTable(TEACHERS, true),
    checkTable(STUDENTS, false),
    checkTable(ASSISTANTS_PROFILES, true)
  ]);
};
