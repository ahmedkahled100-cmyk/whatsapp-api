'use client';
// src/app/teacher/layout.tsx
// تخطيط لوحة المعلم مع الشريط الجانبي

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { filterNotificationsForTeacherInbox } from '@/lib/notification-audience';
import { supabase } from '@/lib/supabase';
import {
  subscribeToExams, subscribeToStudents, subscribeToAttempts, subscribeToGroups, subscribeToNotifications, subscribeToRegistrationRequests, subscribeToMaterials, subscribeToAssignments, subscribeToTeacherProfile, subscribeToSettings, subscribeToConversations, getExams, getAllAttempts, getStudents, getGroups, getMaterials, getAssignments, getRegistrationRequests, getSuperAdmin
} from '@/lib/db';
import {
  LayoutDashboard, PlusCircle, FileText, Users, BookOpen,
  BarChart2, ClipboardList, Calendar, Bot, TrendingUp,
  CreditCard, BookMarked, Settings, LogOut, Bell, Menu, X, Clock, DollarSign,
  GraduationCap, Database, ChevronLeft, Zap, ShieldCheck, ExternalLink, MessageSquare, Gamepad2, AlertCircle, Youtube
} from 'lucide-react';
import { SubscriptionExpiredOverlay } from '@/components/SubscriptionExpiredOverlay';
import { GlobalChatWidget } from '@/components/shared/GlobalChatWidget';
import { GlobalNotificationWidget } from '@/components/shared/GlobalNotificationWidget';

const NAV_ITEMS = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'الرئيسية', section: 'main', permission: 'dashboard' },
  { href: '/teacher/notifications', icon: Bell, label: 'الإشعارات', section: 'main', permission: 'notifications' },
  { href: '/teacher/analytics', icon: TrendingUp, label: 'التحليلات', section: 'main', permission: 'analytics' },
  { href: '/teacher/messages', icon: MessageSquare, label: 'الرسائل', section: 'main', permission: 'messages' },
  { href: '/teacher/exams/create', icon: PlusCircle, label: 'اختبار جديد', section: 'exams', permission: 'exams' },
  { href: '/teacher/exams', icon: FileText, label: 'الاختبارات', section: 'exams', permission: 'exams' },
  { href: '/teacher/essays', icon: ClipboardList, label: 'المقالي', section: 'exams', permission: 'essays' },
  { href: '/teacher/results', icon: BarChart2, label: 'النتائج', section: 'exams', permission: 'results' },
  { href: '/teacher/qbank', icon: Database, label: 'بنك الأسئلة', section: 'exams', permission: 'qbank' },
  { href: '/teacher/ai', icon: Bot, label: 'الذكاء الاصطناعي', section: 'exams', permission: 'ai' },
  { href: '/teacher/games', icon: Gamepad2, label: 'الألعاب التعليمية', section: 'exams', permission: 'games' },
  { href: '/teacher/students', icon: Users, label: 'الطلاب', section: 'students', permission: 'students' },
  { href: '/teacher/attendance', icon: Clock, label: 'الحضور والغياب', section: 'students', permission: 'attendance' },
  { href: '/teacher/groups', icon: BookOpen, label: 'الفصول', section: 'students', permission: 'groups' },
  { href: '/teacher/subscriptions', icon: CreditCard, label: 'الاشتراكات', section: 'students', permission: 'subscriptions' },
  { href: '/teacher/finances', icon: DollarSign, label: 'الماليات', section: 'students', permission: 'finances' },
  { href: '/teacher/courses', icon: BookMarked, label: 'المناهج', section: 'content', permission: 'courses' },
  { href: '/teacher/youtube', icon: Youtube, label: 'قناة اليوتيوب', section: 'content', permission: 'courses' },
  { href: '/teacher/assignments', icon: ClipboardList, label: 'الواجبات', section: 'content', permission: 'assignments' },
  { href: '/teacher/calendar', icon: Calendar, label: 'التقويم', section: 'content', permission: 'calendar' },
  { href: '/teacher/schedule', icon: Calendar, label: 'جدول الحصص', section: 'content', permission: 'schedule' },
  { href: '/teacher/tools/ilovepdf', icon: Zap, label: 'أدوات iLovePDF', section: 'content', permission: 'tools' },
  { href: '/teacher/settings', icon: Settings, label: 'الإعدادات', section: 'settings', permission: 'settings' },
  { href: '/teacher/staff', icon: Users, label: 'فريق العمل (HR)', section: 'settings', permission: 'settings' }
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
  const activeTeacherId = useTeacherStore(state => state.activeTeacherId);
  
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
  const setSettings = useTeacherStore(state => state.setSettings);
  const setConversations = useTeacherStore(state => state.setConversations);
  const notifications = useTeacherStore(state => state.notifications);
  const settings = useTeacherStore(state => state.settings);
  const registrationRequests = useTeacherStore(state => state.registrationRequests);
  const conversations = useTeacherStore(state => state.conversations);
  const students = useTeacherStore(state => state.students);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>('syncing');
  const [adminInfo, setAdminInfo] = useState<any>(null);

  // Assistant permissions cache
  const [assistantPermissions, setAssistantPermissions] = useState<string[]>([]);
  const [activeTeacherName, setActiveTeacherName] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'assistant' && activeTeacherId) {
      supabase
        .from('teacher_assistant_links')
        .select('permissions')
        .eq('teacher_id', activeTeacherId)
        .eq('assistant_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAssistantPermissions(data.permissions || []);
          }
        });

      supabase
        .from('teachers')
        .select('name')
        .eq('id', activeTeacherId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setActiveTeacherName(data.name);
          }
        });
    }
  }, [user?.role, user?.id, activeTeacherId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { router.replace('/auth'); return; }
    if (user.role === 'assistant' && !activeTeacherId) {
      router.replace('/assistant/dashboard');
      return;
    }

    const targetId = user.role === 'assistant' ? activeTeacherId : user.id;
    if (!targetId) return;

    // Real-time subscriptions — initial fetch + realtime updates
    setSyncStatus('syncing');
    
    // Fallback timeout to prevent indefinite "syncing" UI state
    const syncTimeout = setTimeout(() => {
      setSyncStatus(prev => prev === 'syncing' ? 'synced' : prev);
    }, 5000);

    let lastNotifIds = new Set<string>();
    let isFirstLoad = true;

    const applyTeacherNotifications = (data: Parameters<typeof setNotifications>[0]) => {
      setNotifications(filterNotificationsForTeacherInbox(data));
      setSyncStatus('synced');
      
      if (!isFirstLoad && lastNotifIds.size > 0) {
        const newNotifs = data.filter(n => !lastNotifIds.has(n.id) && !n.read);
        
        newNotifs.forEach(n => {
          import('@/lib/toast').then(m => m.showToast(`🔔 ${(n as any).msg || (n as any).message || 'إشعار جديد'}`));
        });

        // Always refresh registration requests on any new notification
        if (newNotifs.length > 0) {
          getRegistrationRequests(targetId).then(reqs => {
            setRegistrationRequests(reqs.filter(r => r.type === 'student' || r.type === 'renewal' || !r.type));
          }).catch(console.error);
        }
      }
      lastNotifIds = new Set(data.map(n => n.id));
      isFirstLoad = false;
    };

    const unsubs = [
      subscribeToExams(targetId, data => { setExams(data); setSyncStatus('synced'); }),
      subscribeToStudents(targetId, (data) => { setStudents(data); setSyncStatus('synced'); }),
      subscribeToAttempts(targetId, setAttempts),
      subscribeToGroups(targetId, setGroups),
      subscribeToNotifications(targetId, applyTeacherNotifications),
      subscribeToRegistrationRequests(targetId, (data) => {
        setRegistrationRequests(data.filter(r => r.type === 'student' || r.type === 'renewal' || !r.type));
        setSyncStatus('synced');
      }),
      subscribeToMaterials(targetId, setMaterials),
      subscribeToAssignments(targetId, setAssignments),
      user.role === 'teacher' ? subscribeToTeacherProfile(user.id, setUser) : () => {}, // Maintain user's login state
      subscribeToSettings(targetId, setSettings),
      subscribeToConversations(targetId, setConversations),
    ];

    // Initial fetch of static data
    getExams(targetId).then(setExams);
    getStudents(targetId).then(setStudents);
    getGroups(targetId).then(setGroups);

    // ⚡ Polling fallback every 30 seconds
    const pollInterval = setInterval(() => {
      getRegistrationRequests(targetId).then(reqs => {
        setRegistrationRequests(reqs.filter(r => r.type === 'student' || r.type === 'renewal' || !r.type));
      }).catch(() => {});
    }, 30000);

    return () => {
      unsubs.forEach(u => u());
      clearInterval(pollInterval);
      clearTimeout(syncTimeout);
    };
  }, [user?.id, user?.role, activeTeacherId, mounted]);

  // Fetch admin info for teacher to use in renewal contact
  useEffect(() => {
    if (user?.role === 'teacher') {
      getSuperAdmin().then(admin => setAdminInfo(admin)).catch(() => {});
    }
  }, [user?.role]);

  // Check for expiring subscription (5 days warning)
  useEffect(() => {
    if (user?.role === 'teacher' && user.subType !== 'free' && user.subExpiry) {
      const daysLeft = Math.ceil((user.subExpiry - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft > 0 && daysLeft <= 5) {
        const warningKey = `sub_warning_${user.id}`;
        const lastWarning = localStorage.getItem(warningKey);
        const now = Date.now();
        
        // Warn once every 24 hours
        if (!lastWarning || now - parseInt(lastWarning) > 24 * 60 * 60 * 1000) {
          localStorage.setItem(warningKey, now.toString());
          
          import('@/lib/db').then(({ dispatchNotification }) => {
            dispatchNotification({
              teacherId: user.id,
              msg: `⚠️ تنبيه هام: سينتهي اشتراكك في المنصة خلال ${daysLeft} أيام. يرجى تجديد الاشتراك لتجنب إيقاف الحساب.`,
              type: 'warning',
              channels: { inApp: true, whatsapp: !!(user.phone || user.username) },
              whatsappNumbers: (user.phone || user.username) ? [(user.phone || user.username)!] : [],
              actionPath: '/teacher/settings'
            }).catch(console.error);
          });
        }
      }
    }
  }, [user?.id, user?.subExpiry, user?.subType, user?.role, user?.phone, user?.username]);

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--gold', settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
        setIsCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    if (!isMobile) {
        setIsCollapsed(!isCollapsed);
    } else {
        setSidebarOpen(!sidebarOpen);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!mounted || !user) return null;

  // ---- Teacher blocking check ----
  const isTeacherBlocked =
    user.role === 'teacher' && (
      (user.subType !== 'free' && user.subExpiry != null && user.subExpiry < Date.now()) ||
      user.isActive === false
    );

  if (isTeacherBlocked) {
    return (
      <SubscriptionExpiredOverlay
        target="teacher"
        teacher={user}
        adminInfo={adminInfo}
        isCancelled={user.isActive === false}
        onLogout={() => { logout(); router.replace('/auth'); }}
        onRenewalSuccess={() => {}}
      />
    );
  }

  const isNavItemVisible = (item: typeof NAV_ITEMS[0]) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;

    // Always allowed for assistants (Essential routes)
    if (item.href === '/teacher/dashboard') return true;
    if (item.href === '/teacher/messages') return true;
    if (item.href === '/teacher/notifications') return true;
    
    if (item.href === '/teacher/settings' || item.href === '/teacher/staff') return false;

    // Route specific permission mapping
    if (item.href.includes('/attendance')) return assistantPermissions.includes('attendance');
    
    if (item.href.includes('/exams') || item.href.includes('/essays') || item.href.includes('/results') || item.href.includes('/qbank') || item.href.includes('/tools') || item.href.includes('/ai') || item.href.includes('/games') || item.href.includes('/assignments')) {
      return assistantPermissions.includes('grading');
    }
    
    if (item.href.includes('/students') || item.href.includes('/groups')) {
      return assistantPermissions.includes('students');
    }
    
    if (item.href.includes('/finances') || item.href.includes('/subscriptions')) {
      return assistantPermissions.includes('finances');
    }
    
    if (item.href.includes('/analytics')) {
      return assistantPermissions.includes('grading') || assistantPermissions.includes('finances') || assistantPermissions.includes('students');
    }

    return false; // Hide any other generic menus (e.g., calendar, courses) unless explicitly granted
  };

  const isCurrentRouteAllowed = () => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    
    // Find matching nav item
    const navItem = NAV_ITEMS.find(item => pathname === item.href || (item.href !== '/teacher/dashboard' && pathname.startsWith(item.href)));
    
    if (navItem) {
      return isNavItemVisible(navItem);
    }
    
    // Special routes
    if (pathname.includes('/teacher/tools')) return true;
    
    return true; 
  };

  const filteredNavItems = NAV_ITEMS.filter(isNavItemVisible);

  const grouped = filteredNavItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof NAV_ITEMS>);

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-x-hidden print:overflow-visible print:bg-white">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full z-[70] flex flex-col transition-all duration-300 ease-in-out border-l border-white/5 print:hidden
          ${isMobile ? (sidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 translate-x-[285px] invisible') : (isCollapsed ? 'w-20 translate-x-0' : 'w-[280px] translate-x-0')}`}
        style={{
          background: 'linear-gradient(180deg, var(--dark2), var(--dark3))',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
          {!isCollapsed && (
            <div className="animate-fade-in">
                <div className="font-cairo font-black text-sm gold-text whitespace-nowrap">{settings?.acadName || 'A-N Academy'}</div>
                {user.role === 'assistant' ? (
                  <div className="text-xs font-bold text-amber-400 whitespace-nowrap overflow-hidden text-ellipsis">مساعد: أ. {activeTeacherName || '...'}</div>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>لوحة المعلم</div>
                )}
            </div>
          )}
          {/* Close button for mobile */}
          {!isCollapsed && (
            <button 
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden mr-auto w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10"
            >
                <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="mb-2">
              {!isCollapsed && (
                <div className="px-5 py-2 text-[10px] font-bold tracking-[0.2em] uppercase animate-fade-in"
                    style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                    {SECTION_LABELS[section]}
                </div>
              )}
              {items.map(item => {
                const active = pathname === item.href || (item.href !== '/teacher/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 mx-2 rounded-xl transition-all duration-200 text-sm font-medium group relative`}
                    style={{
                      color: active ? 'var(--gold)' : 'var(--text-muted)',
                      background: active ? 'rgba(245,197,24,0.1)' : 'transparent',
                      border: active ? '1px solid rgba(245,197,24,0.15)' : '1px solid transparent',
                    }}
                  >
                    <item.icon size={18} className={`flex-shrink-0 ${active ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`} />
                    {!isCollapsed && <span className="animate-fade-in truncate">{item.label}</span>}
                    
                    {!isCollapsed && item.href === '/teacher/subscriptions' && registrationRequests.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold mr-auto">
                        {registrationRequests.length}
                      </span>
                    )}
                    
                    {isCollapsed && item.href === '/teacher/subscriptions' && registrationRequests.length > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center text-white border border-[#12121f]">
                        {registrationRequests.length}
                      </span>
                    )}

                    {active && !isCollapsed && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 p-2 group animate-fade-in">
               {user.imageUrl ? (
                 <img loading="lazy" src={user.imageUrl} alt={user.name} className="w-10 h-10 rounded-full border-2 border-gold/30 object-cover shadow-lg" />
               ) : (
                 <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-black border border-gold/20">
                    {user.name?.[0]}
                 </div>
               )}
               <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate text-white">{user.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">@{user.username || 'user'}</div>
               </div>
            </div>
          )}

          {!isCollapsed && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                </div>
                <div className="flex-1 min-w-0">
                <div className="text-[10px] text-text-muted">حالة المزامنة</div>
                <div className="text-xs font-bold truncate">{syncStatus === 'synced' ? 'متصل ومحدث' : syncStatus === 'offline' ? 'غير متصل' : 'جاري المزامنة...'}</div>
                </div>
            </div>
          )}
          
          {user.role === 'assistant' && (
            <Link href="/assistant/dashboard" className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 mx-2 rounded-xl transition-all duration-200 text-sm font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 mb-2 overflow-hidden`}>
              <ExternalLink size={18} className="shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">بوابة المساعد</span>}
            </Link>
          )}
          
          {user.role === 'super_admin' && (
            <Link href="/admin" className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 mx-2 rounded-xl transition-all duration-200 text-sm font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 mb-2 overflow-hidden`}>
              <ShieldCheck size={18} className="shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">لوحة الإدارة</span>}
            </Link>
          )}
          <button onClick={handleLogout}
            className={`btn-danger w-full justify-center text-sm py-3 ${isCollapsed ? 'px-0' : ''}`}>
            <LogOut size={16} className="shrink-0" />
            {!isCollapsed && <span className="mr-2">خروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`transition-all duration-300 ease-in-out min-h-screen print:min-h-0 print:w-full print:m-0 print:overflow-visible ${
        isMobile ? 'w-full mr-0' : (isCollapsed ? 'mr-20 w-[calc(100%-80px)]' : 'mr-[280px] w-[calc(100%-280px)]')
      }`}>

        {/* Top Header */}
        <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 lg:px-6 w-full print:hidden"
          style={{
            background: 'rgba(10, 10, 15, 0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
          }}>
          {/* Sidebar toggle */}
          <button onClick={toggleSidebar}
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
            <GlobalNotificationWidget 
              notifications={filterNotificationsForTeacherInbox(notifications)} 
              currentUser={user} 
              teacherId={user.id} 
            />

            {/* Live sync indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hidden sm:flex" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' :
                syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse shadow-[0_0_6px_#facc15]' :
                'bg-red-400 shadow-[0_0_6px_#f87171]'
              }`} />
              <span className="text-[10px] text-gray-500">
                {syncStatus === 'synced' ? 'متصل' : syncStatus === 'syncing' ? 'جاري...' : 'غير متصل'}
              </span>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 pb-32 lg:pb-8 w-full max-w-full overflow-x-hidden">
          {/* Subscription Banner */}
          {user.role === 'teacher' && user.subType !== 'free' && user.subExpiry && user.subExpiry < Date.now() + (5 * 24 * 60 * 60 * 1000) && (
            (() => {
              const daysLeft = Math.ceil((user.subExpiry - Date.now()) / (24 * 60 * 60 * 1000));
              const isUrgent = daysLeft <= 5;
              const isExpired = user.subExpiry < Date.now();
              return (
                <div className={`mb-6 p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse-subtle ${
                  isExpired ? 'bg-red-500/20 border-red-500/30 text-red-500' : 
                  'bg-orange-600/20 border-orange-500/40 text-orange-400'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isExpired ? 'bg-red-500 text-white' : 
                      'bg-orange-500 text-white'
                    }`}>
                      {isExpired ? <AlertCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">
                        {isExpired ? 'انتهى اشتراك المنصة الخاص بك' : 
                         `تنبيه تلقائي: اشتراكك ينتهي خلال ${daysLeft} أيام!`}
                      </h3>
                      <p className="text-xs opacity-80">
                        {isExpired ? 'يرجى تجديد الاشتراك لاستمرار الخدمة.' : 
                         'يرجى التجديد الآن لتجنب توقف حسابك بشكل فوري.'}
                      </p>
                    </div>
                  </div>
                  {user.subLink && (
                    <a href={user.subLink} target="_blank" rel="noopener noreferrer" className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      isExpired ? 'bg-red-500 text-white hover:bg-red-600' : 
                      'bg-orange-500 text-white hover:bg-orange-600'
                    }`}>
                      تجديد الاشتراك الآن <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              );
            })()
          )}
          {isCurrentRouteAllowed() ? children : (
            <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in mt-10">
              <ShieldCheck size={64} className="text-red-500 mb-4 opacity-50" />
              <h2 className="text-2xl font-black text-red-500 mb-2 font-cairo">غير مصرح لك بالدخول</h2>
              <p className="text-gray-400">عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة، يمكنك مراجعة المعلم لتعديل صلاحياتك.</p>
            </div>
          )}
        </div>

      </main>

      {/* 📱 Mobile Bottom Navigation - Application feel */}
      <nav className="fixed lg:hidden bottom-0 left-0 right-0 z-[60] bg-[#12121f]/90 backdrop-blur-xl border-t border-white/5 px-2 py-2 flex justify-around items-center h-20 shadow-[0_-10px_30px_rgba(0,0,0,0.4)] print:hidden">
          <Link href="/teacher/dashboard" className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${pathname === '/teacher/dashboard' ? 'text-gold' : 'text-gray-500'}`}>
              <LayoutDashboard size={20} className={pathname === '/teacher/dashboard' ? 'scale-110 drop-shadow-[0_0_8px_var(--gold)]' : ''} />
              <span className="text-[10px] font-bold">الرئيسية</span>
          </Link>
          <Link href="/teacher/students" className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all relative ${pathname === '/teacher/students' ? 'text-gold' : 'text-gray-500'}`}>
              <Users size={20} className={pathname === '/teacher/students' ? 'scale-110 drop-shadow-[0_0_8px_var(--gold)]' : ''} />
              <span className="text-[10px] font-bold">الطلاب</span>
              {registrationRequests.length > 0 && (
                <span className="absolute -top-1 -right-0 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                    {registrationRequests.length}
                </span>
              )}
          </Link>
          
          {/* Main Action Button - Quick Exam */}
          <Link href="/teacher/exams/create" className="w-14 h-14 bg-gradient-to-tr from-gold to-amber-400 rounded-full flex items-center justify-center text-[#12121f] shadow-[0_0_20px_rgba(245,197,24,0.4)] -mt-10 border-4 border-[#12121f] active:scale-95 transition-transform">
              <PlusCircle size={28} />
          </Link>

          <Link href="/teacher/exams" className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${pathname === '/teacher/exams' ? 'text-gold' : 'text-gray-500'}`}>
              <FileText size={20} className={pathname === '/teacher/exams' ? 'scale-110 drop-shadow-[0_0_8px_var(--gold)]' : ''} />
              <span className="text-[10px] font-bold">الاختبارات</span>
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all text-gray-500`}>
              <Menu size={20} />
              <span className="text-[10px] font-bold">المزيد</span>
          </button>
      </nav>

      {/* 📲 Full Screen Mobile Menu Overlay */}
      {showMobileMenu && (
          <div className="fixed inset-0 z-[100] bg-[#0d121f] animate-fade-in flex flex-col overflow-hidden" dir="rtl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold border border-gold/20">
                          <PlusCircle size={20} />
                      </div>
                      <h3 className="text-xl font-black text-white font-cairo">كل القوائم</h3>
                  </div>
                  <button onClick={() => setShowMobileMenu(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                      <X size={24} />
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 pb-20">
                  {filteredNavItems.map(item => (
                      <Link 
                        key={item.href} 
                        href={item.href} 
                        onClick={() => setShowMobileMenu(false)}
                        className={`p-4 rounded-2xl flex flex-col gap-3 transition-all active:scale-95 ${
                            pathname === item.href ? 'bg-gold/10 border border-gold/30' : 'bg-white/5 border border-white/5'
                        }`}
                      >
                          <item.icon size={24} className={pathname === item.href ? 'text-gold' : 'text-gray-400'} />
                          <span className={`text-xs font-bold ${pathname === item.href ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                      </Link>
                  ))}
                  <button 
                    onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3 text-red-500"
                  >
                      <LogOut size={24} />
                      <span className="text-xs font-bold">تسجيل الخروج</span>
                  </button>
              </div>
          </div>
      )}

      {/* Global Floating Chat Widget */}
      <GlobalChatWidget 
        currentUser={user}
        conversations={conversations}
        contacts={students.map(s => ({ id: s.id, name: s.name, subtitle: s.grade, role: 'student' }))}
        superAdmin={adminInfo}
      />
    </div>
  );
}
