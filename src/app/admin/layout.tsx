'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTeacherStore } from '@/lib/store';
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, ShieldCheck, GraduationCap, MessageSquare, CreditCard } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'لوحة التحكم الشاملة' },
  { href: '/admin/teachers', icon: Users, label: 'إدارة المعلمين' },
  { href: '/admin/subscriptions', icon: CreditCard, label: 'إدارة الاشتراكات' },
  { href: '/admin/messages', icon: MessageSquare, label: 'رسائل المعلمين' },
  { href: '/admin/settings', icon: Settings, label: 'إعدادات المنصة' },
  { href: '/teacher/dashboard', icon: GraduationCap, label: 'لوحة المعلم الخاصة بي' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useTeacherStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.role !== 'super_admin') {
      router.replace('/teacher/dashboard');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024);
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
    <div className="min-h-screen flex" style={{ background: 'var(--dark)' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-l border-white/5 bg-[#0a0f1c]"
        style={{ width: '280px', transform: sidebarOpen ? 'translateX(0)' : 'translateX(280px)' }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="font-cairo font-black text-sm text-purple-400">AN Academy</div>
              <div className="text-xs text-text-muted">لوحة الإدارة (Super Admin)</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400"><X size={18} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  active ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginRight: (sidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024) ? '280px' : '0' }}>
        
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0f1cf2] backdrop-blur-md">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <Menu size={20} />
          </button>
          <h2 className="font-cairo font-black text-lg text-white">إدارة المنصة الشاملة</h2>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
