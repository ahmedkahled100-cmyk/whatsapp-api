'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { filterNotificationsForAdminInbox } from '@/lib/notification-audience';
import { subscribeToNotifications, subscribeToRegistrationRequests } from '@/lib/db';
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldCheck, GraduationCap, MessageSquare, CreditCard, Smartphone, Briefcase, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GlobalNotificationWidget } from '@/components/shared/GlobalNotificationWidget';

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'لوحة التحكم الشاملة' },
  { href: '/admin/teachers', icon: Users, label: 'إدارة المعلمين' },
  { href: '/admin/assistants', icon: Briefcase, label: 'إدارة مساعدي المادة' },
  { href: '/admin/subscriptions', icon: CreditCard, label: 'إدارة الاشتراكات' },
  { href: '/admin/messages', icon: MessageSquare, label: 'رسائل المعلمين' },
  { href: '/admin/notifications', icon: Bell, label: 'إدارة الإشعارات' },
  { href: '/admin/app-settings', icon: Smartphone, label: 'تخصيص التطبيق' },
  { href: '/admin/settings', icon: Settings, label: 'إعدادات المنصة' },
  { href: '/teacher/dashboard', icon: GraduationCap, label: 'لوحة المعلم الخاصة بي' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, adminNotifications, setAdminNotifications, teacherJoinRequests, setTeacherJoinRequests } = useTeacherStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingAssistantsCount, setPendingAssistantsCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.role !== 'super_admin') {
      router.replace('/teacher/dashboard');
      return;
    }
  }, [user, router, mounted]);
  
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToNotifications(user.id, (data) => {
      setAdminNotifications(filterNotificationsForAdminInbox(data));
    });
    return () => { unsub(); };
  }, [user?.id, setAdminNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToRegistrationRequests(user.id, (data) => {
      // Filter only teacher join requests
      setTeacherJoinRequests(data.filter(r => r.type === 'teacher' || r.type === 'teacher_renewal' || !r.type));
    });
    return () => { unsub(); };
  }, [user?.id, setTeacherJoinRequests]);

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('assistants_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (!error && count !== null) {
          setPendingAssistantsCount(count);
        }
      } catch (e) {
        console.error(e);
      }
    };

    void fetchPendingCount();

    // Subscribe to changes in assistants_profiles
    const channel = supabase
      .channel('admin_assistants_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assistants_profiles' },
        () => {
          void fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
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

  if (!mounted || !user || user.role !== 'super_admin') return null;

  return (
    <div className="min-h-screen bg-[#0a0f1c] relative overflow-x-hidden" dir="rtl">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 h-full z-[70] flex flex-col bg-[#0f172a] border-l border-white/5 transition-all duration-300 ease-in-out shadow-2xl
        ${isMobile ? (sidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 translate-x-[285px] invisible') : 'w-[280px] translate-x-0'}`}>
        
        {/* Logo/Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="font-cairo font-black text-sm text-white leading-none">الإدارة العليا</h1>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">A-N Academy</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-white transition">
              <X size={20} />
            </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  active 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/5' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} className={active ? 'scale-110' : 'opacity-70 group-hover:opacity-100'} />
                <span className="font-bold text-sm">{item.label}</span>
                {item.href === '/admin/teachers' && teacherJoinRequests.length > 0 && (
                   <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full mr-auto">
                     {teacherJoinRequests.length}
                   </span>
                )}
                {item.href === '/admin/assistants' && pendingAssistantsCount > 0 && (
                   <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full mr-auto animate-pulse">
                     {pendingAssistantsCount}
                   </span>
                )}
                {active && 
                  ! (item.href === '/admin/teachers' && teacherJoinRequests.length > 0) && 
                  ! (item.href === '/admin/assistants' && pendingAssistantsCount > 0) && 
                  <div className="mr-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                }
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 text-center">
            <button onClick={handleLogout} className="btn-outline border-red-500/30 text-red-400 hover:bg-red-500/10 w-full justify-center">
              <LogOut size={16} /> تسجيل الخروج
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`transition-all duration-300 ease-in-out min-h-screen ${
        isMobile ? 'w-full mr-0' : 'mr-[280px] w-[calc(100%-280px)]'
      }`}>
        
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0f1cf2] backdrop-blur-md w-full">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <Menu size={20} />
          </button>
          <h2 className="font-cairo font-black text-lg text-white">إدارة المنصة الشاملة</h2>
            <div className="mr-auto flex items-center gap-3">
              <GlobalNotificationWidget 
                notifications={adminNotifications} 
                currentUser={user} 
                teacherId={user.id} 
              />
              <Link href="/admin/settings" className="flex items-center gap-2 p-1 pr-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                 <div className="text-left hidden sm:block">
                    <div className="text-[10px] font-bold text-white leading-none">{user.name}</div>
                    <div className="text-[8px] text-gray-500 mt-1">مدير المنصة</div>
                 </div>
                 {user.imageUrl ? (
                   <img src={user.imageUrl} alt="Admin" className="w-8 h-8 rounded-lg object-cover" />
                 ) : (
                   <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black">
                     {user.name[0]}
                   </div>
                 )}
              </Link>
            </div>
        </header>

        <div className="p-4 lg:p-10 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
