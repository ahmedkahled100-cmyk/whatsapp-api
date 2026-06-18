// src/lib/db/app-settings.ts
// Mobile app configuration (sliders, ticker, categories)
import { supabase } from '@/lib/supabase';
import { APP_HOME } from './constants';
import { clean } from './utils';
import { fromDB, toDB } from './supabase/dbUtils';

export const APP_HOME_SETTINGS_KEY = 'app_home';
export const APP_HOME_DOC = 'config';

export type SliderItem = {
  id: string;
  imageUrl: string;
  title?: string;
  link?: string;
  order: number;
  youtubeData?: {
    banner?: string;
    avatar?: string;
    title?: string;
    subs?: string;
  };
};

export type TabId = 'home' | 'courses' | 'exams' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile' | 'discover' | 'link' | 'games' | 'youtube';

export type CategoryItem = {
  id: string;
  title: string;
  icon: string; // emoji or icon name
  color: string; // gradient color for bg
  targetTab: TabId;
  link?: string; // if targetTab=link
  order: number;
};

export type BottomNavItem = {
  id: string;
  label: string;
  icon: string;
  targetTab: string;
  order: number;
};

export type AppHomeSettings = {
  ticker: string; // scrolling news text
  sliders: SliderItem[];
  categories: CategoryItem[];
  bottomNav: BottomNavItem[];
  appName: string;
  primaryColor: string;
  showDailyReward: boolean;
  dailyRewardText?: string;
  welcomeMessage?: string;
};

const defaultSettings: AppHomeSettings = {
  ticker: '🎓 مرحباً بكم في AN Academy — منصة التعليم الذكي 🌟',
  appName: 'AN Academy',
  primaryColor: '#f5c518',
  showDailyReward: true,
  dailyRewardText: 'افتح التطبيق يومياً لمتابعة الأسئلة الحصرية',
  welcomeMessage: 'مرحباً بك',
  sliders: [
    {
      id: 'slide1',
      imageUrl: '',
      title: 'أهلاً بك في AN Academy',
      link: '',
      order: 0,
    },
  ],
  categories: [
    { id: 'c1', title: 'اختباراتي', icon: '📋', color: '#f5c518', targetTab: 'exams', order: 0 },
    { id: 'c2', title: 'المناهج', icon: '📚', color: '#3b82f6', targetTab: 'courses', order: 1 },
    { id: 'c3', title: 'الواجبات', icon: '📝', color: '#8b5cf6', targetTab: 'assignments', order: 2 },
    { id: 'c4', title: 'نتائجي', icon: '📊', color: '#10b981', targetTab: 'results', order: 3 },
    { id: 'c5', title: 'الرسائل', icon: '💬', color: '#ec4899', targetTab: 'messages', order: 4 },
    { id: 'c6', title: 'حسابي', icon: '👤', color: '#f97316', targetTab: 'profile', order: 5 },
    { id: 'c7', title: 'اشتراك مع معلمين المنصة', icon: '🎓', color: '#f5c518', targetTab: 'discover', order: 6 },
    { id: 'c8', title: 'الألعاب التعليمية', icon: '🎮', color: '#f5c518', targetTab: 'games', order: 7 },
  ],
  bottomNav: [
    { id: 'home', label: 'الرئيسية', icon: 'Home', targetTab: 'home', order: 0 },
    { id: 'courses', label: 'الكورسات', icon: 'BookOpen', targetTab: 'courses', order: 1 },
    { id: 'exams', label: 'اختباراتي', icon: 'ClipboardList', targetTab: 'exams', order: 2 },
    { id: 'account', label: 'حسابي', icon: 'User', targetTab: 'profile', order: 3 },
    { id: 'settings', label: 'الإعدادات', icon: 'Settings', targetTab: 'settings', order: 4 },
  ],
};

export const getAppHomeSettings = async (): Promise<AppHomeSettings> => {
  try {
    const { data, error } = await supabase
      .from(APP_HOME)
      .select('*')
      .eq('id', APP_HOME_DOC)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return { ...defaultSettings, ...fromDB<AppHomeSettings>(data) } as AppHomeSettings;
    }
    return defaultSettings;
  } catch (e: any) {
    if (e.code === 'PGRST205') {
       console.warn('⚠️ Table app_home not found. Using default settings.');
    } else {
       console.error('getAppHomeSettings error:', e);
    }
    return defaultSettings;
  }
};

export const updateAppHomeSettings = async (settings: Partial<AppHomeSettings>): Promise<void> => {
  const payload = toDB({
    ...settings,
    id: APP_HOME_DOC
  });

  const { error } = await supabase
    .from(APP_HOME)
    .upsert([payload], { onConflict: 'id' });

  if (error) throw error;
};
