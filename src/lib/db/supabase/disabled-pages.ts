// src/lib/db/supabase/disabled-pages.ts
import { supabase } from '@/lib/supabase';
import { APP_HOME } from '../constants';
import { fromDB, toDB } from './dbUtils';
import type { DisabledPageItem } from '@/types';

export const DISABLED_PAGES_DOC = 'disabled_pages_config';

export const DEFAULT_DISABLED_PAGES: DisabledPageItem[] = [
  // ─── صفحات المعلم ─────────────────────────────────────────────────────────────
  { id: 't_dashboard', path: '/teacher/dashboard', title: 'لوحة التحكم (الرئيسية)', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_notifications', path: '/teacher/notifications', title: 'صفحة الإشعارات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_analytics', path: '/teacher/analytics', title: 'صفحة التحليلات والإحصائيات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_messages', path: '/teacher/messages', title: 'نظام الرسائل والدردشة', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_exams', path: '/teacher/exams', title: 'قسم الاختبارات الإلكترونية', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_essays', path: '/teacher/essays', title: 'قسم أسئلة المقالي التصحيح', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_results', path: '/teacher/results', title: 'سجل وكشوف النتائج', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_qbank', path: '/teacher/qbank', title: 'بنك الأسئلة الإلكتروني', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_ai', path: '/teacher/ai', title: 'مساعد الذكاء الاصطناعي', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_games', path: '/teacher/games', title: 'الألعاب والمسابقات التعليمية', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_students', path: '/teacher/students', title: 'إدارة ورصد الطلاب', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_attendance', path: '/teacher/attendance', title: 'سجل الحضور والغياب', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_groups', path: '/teacher/groups', title: 'إدارة الفصول والمجموعات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_subscriptions', path: '/teacher/subscriptions', title: 'إدارة اشتراكات الطلاب', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_finances', path: '/teacher/finances', title: 'السجل المالي والمعاملات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_courses', path: '/teacher/courses', title: 'المناهج والكورسات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_files', path: '/teacher/files', title: 'مدير الملفات والمستندات', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_youtube', path: '/teacher/youtube', title: 'قناة اليوتيوب والدروس', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_assignments', path: '/teacher/assignments', title: 'قسم الواجبات والمهام', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_calendar', path: '/teacher/calendar', title: 'التقويم والأجندة', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_schedule', path: '/teacher/schedule', title: 'جدول الحصص والمواعيد', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_ilovepdf', path: '/teacher/tools/ilovepdf', title: 'أدوات iLovePDF للضغط والتعديل', category: 'teacher', isDisabled: false, reason: '' },
  { id: 't_staff', path: '/teacher/staff', title: 'إدارة فريق العمل والمساعدين', category: 'teacher', isDisabled: false, reason: '' },

  // ─── صفحات الطالب ─────────────────────────────────────────────────────────────
  { id: 's_home', path: '/student', title: 'بوابة الطالب الرئيسية', category: 'student', isDisabled: false, reason: '' },
  { id: 's_exams', path: '/student/exams', title: 'اختبارات الطالب', category: 'student', isDisabled: false, reason: '' },
  { id: 's_courses', path: '/student/courses', title: 'مناهج وكورسات الطالب', category: 'student', isDisabled: false, reason: '' },
  { id: 's_assignments', path: '/student/assignments', title: 'واجبات الطالب', category: 'student', isDisabled: false, reason: '' },
  { id: 's_results', path: '/student/results', title: 'نتائج الطالب والدرجات', category: 'student', isDisabled: false, reason: '' },
  { id: 's_messages', path: '/student/messages', title: 'مراسلات الطالب', category: 'student', isDisabled: false, reason: '' },
  { id: 's_games', path: '/student/games', title: 'الألعاب التعليمية للطالب', category: 'student', isDisabled: false, reason: '' },

  // ─── صفحات المساعدين والعموم ──────────────────────────────────────────────────
  { id: 'a_dashboard', path: '/assistant/dashboard', title: 'لوحة التحكم للمساعدين', category: 'assistant', isDisabled: false, reason: '' },
  { id: 'p_teacher_reg', path: '/teacher-register', title: 'صفحة تسجيل المعلمين الجدد', category: 'public', isDisabled: false, reason: '' },
  { id: 'p_assistant_reg', path: '/assistant-register', title: 'صفحة تسجيل المساعدين الجدد', category: 'public', isDisabled: false, reason: '' },
  { id: 'p_student_reg', path: '/register', title: 'صفحة تسجيل الطلاب الجدد', category: 'public', isDisabled: false, reason: '' },
];

export const getDisabledPages = async (): Promise<DisabledPageItem[]> => {
  try {
    const { data, error } = await supabase
      .from(APP_HOME)
      .select('*')
      .eq('id', DISABLED_PAGES_DOC)
      .maybeSingle();

    if (error) throw error;
    if (data && data.pages) {
      const savedPages: DisabledPageItem[] = fromDB<any>(data).pages || [];
      const mergedMap = new Map<string, DisabledPageItem>();
      
      DEFAULT_DISABLED_PAGES.forEach(p => mergedMap.set(p.path, { ...p }));
      savedPages.forEach(p => {
        mergedMap.set(p.path, { ...(mergedMap.get(p.path) || p), ...p });
      });

      return Array.from(mergedMap.values());
    }
    return DEFAULT_DISABLED_PAGES;
  } catch (e: any) {
    console.error('getDisabledPages error:', e);
    return DEFAULT_DISABLED_PAGES;
  }
};

export const saveDisabledPages = async (pages: DisabledPageItem[]): Promise<void> => {
  const payload = toDB({
    id: DISABLED_PAGES_DOC,
    pages,
    updatedAt: Date.now(),
  });

  const { error } = await supabase
    .from(APP_HOME)
    .upsert([payload], { onConflict: 'id' });

  if (error) throw error;
};

export const subscribeToDisabledPages = (callback: (pages: DisabledPageItem[]) => void) => {
  let cancelled = false;

  const fetchPages = async () => {
    const pages = await getDisabledPages();
    if (!cancelled) callback(pages);
  };

  const channel = supabase
    .channel('disabled_pages_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: APP_HOME, filter: `id=eq.${DISABLED_PAGES_DOC}` },
      () => {
        void fetchPages();
      }
    )
    .subscribe();

  void fetchPages();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};
