'use client';
// src/app/teacher/layout.tsx
// تخطيط لوحة المعلم مع الشريط الجانبي

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { subscribeToExams, subscribeToStudents, subscribeToAttempts, subscribeToGroups, subscribeToNotifications, subscribeToRegistrationRequests, subscribeToMaterials, subscribeToAssignments } from '@/lib/db';
import {
  LayoutDashboard, PlusCircle, FileText, Users, BookOpen,
  BarChart2, ClipboardList, Calendar, Bot, TrendingUp,
  CreditCard, BookMarked, Settings, LogOut, Bell, Menu, X,
  GraduationCap, Database, ChevronLeft, Zap, ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'الرئيسية', section: 'main', permission: 'dashboard' },
  { href: '/teacher/notifications', icon: Bell, label: 'الإشعارات', section: 'main', permission: 'notifications' },
  { href: '/teacher/analytics', icon: TrendingUp, label: 'التحليلات', section: 'main', permission: 'analytics' },
  { href: '/teacher/exams/create', icon: PlusCircle, label: 'اختبار جديد', section: 'exams', permission: 'exams' },
  { href: '/teacher/exams', icon: FileText, label: 'الاختبارات', section: 'exams', permission: 'exams' },
  { href: '/teacher/essays', icon: ClipboardList, label: 'المقالي', section: 'exams', permission: 'analytics' },
  { href: '/teacher/results', icon: BarChart2, label: 'النتائج', section: 'exams', permission: 'students' },
  { href: '/teacher/qbank', icon: Database, label: 'بنك الأسئلة', section: 'exams', permission: 'exams' },
  { href: '/teacher/ai', icon: Bot, label: 'الذكاء الاصطناعي', section: 'exams', permission: 'ai' },
  { href: '/teacher/students', icon: Users, label: 'الطلاب', section: 'students', permission: 'students' },
  { href: '/teacher/groups', icon: BookOpen, label: 'الفصول', section: 'students', permission: 'groups' },
  { href: '/teacher/subscriptions', icon: CreditCard, label: 'الاشتراكات', section: 'students', permission: 'subscriptions' },
  { href: '/teacher/courses', icon: BookMarked, label: 'المناهج', section: 'content', permission: 'courses' },
  { href: '/teacher/assignments', icon: ClipboardList, label: 'الواجبات', section: 'content', permission: 'assignments' },
  { href: '/teacher/calendar', icon: Calendar, label: 'التقويم', section: 'content', permission: 'calendar' },
  { href: '/teacher/tools/ilovepdf', icon: Zap, label: 'أدوات iLovePDF', section: 'content', permission: 'exams' },
  { href: '/teacher/settings', icon: Settings, label: 'الإعدادات', section: 'settings', permission: 'settings' },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'الرئيسية',
  exams: 'الاختبارات والنتائج',
  students: 'الطلاب',
  content: 'المحتوى',
  settings: 'الإعدادات',
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, setExams, setStudents, setAttempts, setGroups, setNotifications, setRegistrationRequests, setMaterials, setAssignments, notifications, settings } = useTeacherStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>('syncing');

  useEffect(() => {
    setMounted(true);
    if (!user) { router.replace('/auth'); return; }

    // Real-time subscriptions
    setSyncStatus('syncing');
    const unsubs = [
      subscribeToExams(user.id, data => { setExams(data); setSyncStatus('synced'); }),
      subscribeToStudents(user.id, setStudents),
      subscribeToAttempts(user.id, setAttempts),
      subscribeToGroups(user.id, setGroups),
      subscribeToNotifications(user.id, setNotifications),
      subscribeToRegistrationRequests(user.id, setRegistrationRequests),
      subscribeToMaterials(user.id, setMaterials),
      subscribeToAssignments(user.id, setAssignments),
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!mounted || !user) return null;

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (user.role === 'super_admin') return true;
    if (item.permission === 'settings') return true; // Always allow settings
    return user.permissions?.includes(item.permission as string);
  });

  const grouped = filteredNavItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof NAV_ITEMS>);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--dark)' }}>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out"
        style={{
          width: '280px',
          background: 'linear-gradient(180deg, var(--dark2), var(--dark3))',
          borderLeft: '1px solid rgba(245,197,24,0.12)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(280px)',
        }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
            style={{ 
              background: 'linear-gradient(135deg, var(--gold), var(--accent))', 
              boxShadow: '0 0 20px rgba(245,197,24,0.3)', 
              animation: 'pulseGold 3s ease-in-out infinite' 
            }}>
            {settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover relative z-10" />
            ) : (
              <GraduationCap size={20} color="#000" className="relative z-10" />
            )}
          </div>
          <div>
            <div className="font-cairo font-black text-sm gold-text">{settings?.acadName || 'A-N Academy'}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>لوحة المعلم</div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden mr-auto w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="mb-2">
              <div className="px-5 py-2 text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                {SECTION_LABELS[section]}
              </div>
              {items.map(item => {
                const active = pathname === item.href || (item.href !== '/teacher/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-200 text-sm font-medium group"
                    style={{
                      color: active ? 'var(--gold)' : 'var(--text-muted)',
                      background: active ? 'rgba(245,197,24,0.1)' : 'transparent',
                      border: active ? '1px solid rgba(245,197,24,0.15)' : '1px solid transparent',
                    }}
                  >
                    <item.icon size={18} className={`flex-shrink-0 ${active ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`} />
                    <span>{item.label}</span>
                    {active && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
               <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
            </div>
            <div className="flex-1 min-w-0">
               <div className="text-[10px] text-text-muted">حالة المزامنة</div>
               <div className="text-xs font-bold truncate">{syncStatus === 'synced' ? 'متصل ومحدث' : syncStatus === 'offline' ? 'غير متصل' : 'جاري المزامنة...'}</div>
            </div>
          </div>
          {user.role === 'super_admin' && (
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-200 text-sm font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 mb-2">
              <ShieldCheck size={18} />
              <span>لوحة الإدارة الشاملة</span>
            </Link>
          )}
          <button onClick={handleLogout}
            className="btn-danger w-full justify-center text-sm py-3">
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300"
        style={{ marginRight: (sidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024) ? '280px' : '0' }}>

        {/* Top Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 lg:px-6"
          style={{
            background: 'rgba(10, 10, 15, 0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
          }}>
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Menu size={20} />
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h2 className="font-cairo font-black text-lg truncate gold-text">
              {NAV_ITEMS.find(i => pathname === i.href || (i.href !== '/teacher/dashboard' && pathname.startsWith(i.href)))?.label || 'لوحة التحكم'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/teacher/notifications" className="w-10 h-10 rounded-xl flex items-center justify-center relative transition-all hover:bg-white/5"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Bell size={20} className="text-text-muted" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
            </Link>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

