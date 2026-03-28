'use client';
// src/app/teacher/layout.tsx
// تخطيط لوحة المعلم مع الشريط الجانبي

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { filterNotificationsForTeacherInbox } from '@/lib/notification-audience';
import { subscribeToExams, subscribeToStudents, subscribeToAttempts, subscribeToGroups, subscribeToNotifications, subscribeToRegistrationRequests, subscribeToMaterials, subscribeToAssignments, subscribeToTeacherProfile, subscribeToConversations, getExams, getAllAttempts, getStudents, getGroups, getMaterials, getAssignments, getRegistrationRequests } from '@/lib/db';
import {
  LayoutDashboard, PlusCircle, FileText, Users, BookOpen,
  BarChart2, ClipboardList, Calendar, Bot, TrendingUp,
  CreditCard, BookMarked, Settings, LogOut, Bell, Menu, X,
  GraduationCap, Database, ChevronLeft, Zap, ShieldCheck, ExternalLink, MessageSquare, Gamepad2
} from 'lucide-react';
import { SubscriptionExpiredOverlay } from '@/components/SubscriptionExpiredOverlay';
import { getSuperAdmin } from '@/lib/db';

const NAV_ITEMS = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'الرئيسية', section: 'main', permission: 'dashboard' },
  { href: '/teacher/notifications', icon: Bell, label: 'الإشعارات', section: 'main', permission: 'notifications' },
  { href: '/teacher/analytics', icon: TrendingUp, label: 'التحليلات', section: 'main', permission: 'analytics' },
  { href: '/teacher/messages', icon: MessageSquare, label: 'الرسائل', section: 'main', permission: 'dashboard' },
  { href: '/teacher/exams/create', icon: PlusCircle, label: 'اختبار جديد', section: 'exams', permission: 'exams' },
  { href: '/teacher/exams', icon: FileText, label: 'الاختبارات', section: 'exams', permission: 'exams' },
  { href: '/teacher/essays', icon: ClipboardList, label: 'المقالي', section: 'exams', permission: 'analytics' },
  { href: '/teacher/results', icon: BarChart2, label: 'النتائج', section: 'exams', permission: 'students' },
  { href: '/teacher/qbank', icon: Database, label: 'بنك الأسئلة', section: 'exams', permission: 'exams' },
  { href: '/teacher/ai', icon: Bot, label: 'الذكاء الاصطناعي', section: 'exams', permission: 'ai' },
  { href: '/teacher/games', icon: Gamepad2, label: 'الألعاب التعليمية', section: 'exams', permission: 'ai' },
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
  const user = useTeacherStore(state => state.user);
  const setUser = useTeacherStore(state => state.setUser);
  const logout = useTeacherStore(state => state.logout);
  const setExams = useTeacherStore(state => state.setExams);
  const setStudents = useTeacherStore(state => state.setStudents);
  const setAttempts = useTeacherStore(state => state.setAttempts);
  const setGroups = useTeacherStore(state => state.setGroups);
  const setNotifications = useTeacherStore(state => state.setNotifications);
  const setRegistrationRequests = useTeacherStore(state => state.setRegistrationRequests);
  const setMaterials = useTeacherStore(state => state.setMaterials);
  const setAssignments = useTeacherStore(state => state.setAssignments);
  const setConversations = useTeacherStore(state => state.setConversations);
  const notifications = useTeacherStore(state => state.notifications);
  const settings = useTeacherStore(state => state.settings);
  const registrationRequests = useTeacherStore(state => state.registrationRequests);
  const conversations = useTeacherStore(state => state.conversations);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>('syncing');
  const [adminInfo, setAdminInfo] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    if (!user) { router.replace('/auth'); return; }

    // Real-time subscriptions — initial fetch + realtime updates
    setSyncStatus('syncing');
    const applyTeacherNotifications = user.role === 'super_admin'
      ? setNotifications
      : (data: Parameters<typeof setNotifications>[0]) => setNotifications(filterNotificationsForTeacherInbox(data));

    const unsubs = [
      subscribeToExams(user.id, data => { setExams(data); setSyncStatus('synced'); }),
      subscribeToStudents(user.id, setStudents),
      subscribeToAttempts(user.id, setAttempts),
      subscribeToGroups(user.id, setGroups),
      subscribeToNotifications(user.id, applyTeacherNotifications),
      subscribeToRegistrationRequests(user.id, setRegistrationRequests),
      subscribeToMaterials(user.id, setMaterials),
      subscribeToAssignments(user.id, setAssignments),
      subscribeToTeacherProfile(user.id, setUser),
      subscribeToConversations(user.id, setConversations),
    ];

    // Initial fetch of static data that doesn't change often but is needed immediately
    getExams(user.id).then(setExams);
    getStudents(user.id).then(setStudents);
    getGroups(user.id).then(setGroups);

    return () => unsubs.forEach(u => u());
  }, [user?.id, user?.role]);

  // Fetch admin info for teacher to use in renewal contact
  useEffect(() => {
    if (user?.role === 'teacher') {
      getSuperAdmin().then(admin => setAdminInfo(admin)).catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--gold', settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  // Removed redundant fetch-on-navigation logic

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

  // ---- Teacher subscription expiry check ----
  // Only block non-super_admin teachers with expired paid subscriptions
  const isTeacherSubExpired =
    user.role === 'teacher' &&
    user.subType !== 'free' &&
    user.subExpiry != null &&
    user.subExpiry < Date.now();

  if (isTeacherSubExpired) {
    return (
      <SubscriptionExpiredOverlay
        target="teacher"
        teacher={user}
        adminInfo={adminInfo}
        onLogout={() => { logout(); router.replace('/auth'); }}
        onRenewalSuccess={() => {}}
      />
    );
  }

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
              <Image 
                src={settings.logoUrl} 
                alt="Logo" 
                width={40} 
                height={40} 
                className="w-full h-full object-cover relative z-10" 
              />
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
                    {item.href === '/teacher/students' && registrationRequests.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold mr-auto">
                        {registrationRequests.length}
                      </span>
                    )}
                    {active && item.href !== '/teacher/students' && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
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
            <Link href="/teacher/messages" className="w-10 h-10 rounded-xl flex items-center justify-center relative transition-all hover:bg-white/5"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MessageSquare size={20} className="text-text-muted" />
              {conversations.some(c => c.lastMessage && !c.lastMessage.isRead && c.lastMessage.receiverId === user.id) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              )}
            </Link>
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
          {/* Subscription Banner */}
          {user.role === 'teacher' && user.subType !== 'free' && user.subExpiry && user.subExpiry < Date.now() + (7 * 24 * 60 * 60 * 1000) && (
            <div className={`mb-6 p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse-subtle ${user.subExpiry < Date.now() ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-gold/10 border-gold/20 text-gold'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.subExpiry < Date.now() ? 'bg-red-500 text-white' : 'bg-gold text-black'}`}>
                  <CreditCard size={20} />
                </div>
                <div>
                   <h3 className="font-bold text-sm">
                     {user.subExpiry < Date.now() ? 'انتهى اشتراك المنصة الخاص بك' : 'اشتراكك ينتهي قريباً'}
                   </h3>
                   <p className="text-xs opacity-80">
                     {user.subExpiry < Date.now() ? 'يرجى تجديد الاشتراك لاستمرار الخدمة.' : `ينتهي في ${new Date(user.subExpiry).toLocaleDateString('ar-EG')}`}
                   </p>
                </div>
              </div>
              {user.subLink && (
                <a href={user.subLink} target="_blank" rel="noopener noreferrer" className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${user.subExpiry < Date.now() ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gold text-black hover:bg-gold/80'}`}>
                  تجديد الاشتراك الآن <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
          {children}
        </div>

      </main>
    </div>
  );
}
