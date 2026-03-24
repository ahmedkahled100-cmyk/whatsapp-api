'use client';
// src/components/MobileAppLayout.tsx
// الشريط السفلي للتنقل في التطبيق مع الهيدر

import { useState, useEffect } from 'react';
import { Home, BookOpen, ClipboardList, BarChart2, Settings, Bell, User, MessageSquare, LogOut } from 'lucide-react';

type TabId = 'home' | 'courses' | 'exams' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile';

interface BottomNavConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_NAV: BottomNavConfig[] = [
  { id: 'courses',     label: 'الكورسات',   icon: <BookOpen size={20} /> },
  { id: 'exams',       label: 'الاختبارات', icon: <ClipboardList size={20} /> },
  { id: 'home',        label: 'الرئيسية',   icon: <Home size={26} /> },
  { id: 'messages',    label: 'الرسائل',    icon: <MessageSquare size={20} /> },
  { id: 'results',     label: 'نتائجي',     icon: <BarChart2 size={20} /> },
];

interface Props {
  studentName?: string;
  studentImage?: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  notifCount?: number;
  msgCount?: number;
  onNotifClick?: () => void;
  onLogout?: () => void;
  appName?: string;
  children: React.ReactNode;
}

export function MobileAppLayout({
  studentName,
  studentImage,
  activeTab,
  onTabChange,
  notifCount = 0,
  msgCount = 0,
  onNotifClick,
  onLogout,
  appName = 'AN Academy',
  children,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.getElementById('app-scroll-container');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 10);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--dark)', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
      {/* ══ App Header ══ */}
      <header
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between transition-all"
        style={{
          background: scrolled ? 'rgba(10,10,24,0.97)' : 'rgba(10,10,24,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(245,197,24,0.1)',
        }}
      >
        {/* Left: Notification */}
        <button
          onClick={onNotifClick}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Bell size={20} className="text-gray-300" />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white animate-pulse">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Center: App name */}
        <div className="text-center">
          <div className="font-cairo font-black text-base gold-text">{appName}</div>
          {studentName && (
            <div className="text-[11px] text-gray-400 mt-0.5">مرحباً، {studentName}</div>
          )}
        </div>

        {/* Right: Avatar - navigate to profile */}
        <button
          onClick={() => onTabChange('profile')}
          className="w-10 h-10 rounded-xl overflow-hidden border-2 border-gold/30 transition-transform active:scale-90"
          title="ملفي الشخصي"
        >
          {studentImage ? (
            <img src={studentImage} alt={studentName} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-sm font-black"
              style={{ background: 'linear-gradient(135deg,var(--gold),var(--accent))', color: '#000' }}
            >
              {studentName?.[0] || <User size={18} />}
            </div>
          )}
        </button>
      </header>

      {/* ══ Main Scrollable Content ══ */}
      <div
        id="app-scroll-container"
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: '90px' }}
      >
        {children}
      </div>

      {/* ══ Bottom Navigation ══ */}
      <nav
        className="fixed bottom-0 left-1/2 z-40"
        style={{
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(10,10,24,0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(245,197,24,0.12)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        <div className="flex items-end justify-around px-2 pt-2 pb-1">
          {DEFAULT_NAV.map((item) => {
            const isCenter = item.id === 'home';
            const isActive = activeTab === item.id;

            if (isCenter) {
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className="relative -top-5 flex flex-col items-center"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, var(--gold), #e6a800)'
                        : 'linear-gradient(135deg, var(--gold), var(--accent))',
                      boxShadow: isActive
                        ? '0 0 30px rgba(245,197,24,0.5), 0 8px 20px rgba(0,0,0,0.5)'
                        : '0 0 20px rgba(245,197,24,0.3), 0 6px 16px rgba(0,0,0,0.4)',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <Home size={28} className="text-black" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] mt-1 font-bold" style={{ color: 'var(--gold)' }}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all relative"
              >
                {item.id === 'messages' && msgCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-gold text-[9px] font-bold flex items-center justify-center text-black">
                    {msgCount}
                  </span>
                )}
                <span
                  style={{
                    color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{
                    color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
