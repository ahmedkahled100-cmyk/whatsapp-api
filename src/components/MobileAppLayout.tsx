'use client';
// src/components/MobileAppLayout.tsx
// الشريط السفلي للتنقل في التطبيق مع الهيدر

import { useState, useEffect } from 'react';
import { Home, BookOpen, ClipboardList, BarChart2, Settings, Bell, User, MessageSquare, LogOut, LayoutGrid, Calendar } from 'lucide-react';
import Image from 'next/image';
import { GlobalNotificationWidget } from '@/components/shared/GlobalNotificationWidget';

type TabId = 'home' | 'courses' | 'exams' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile' | 'discover' | 'link' | 'games' | 'schedule';

interface BottomNavConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_NAV: BottomNavConfig[] = [
  { id: 'courses',     label: 'الكورسات',   icon: <BookOpen size={20} /> },
  { id: 'exams',       label: 'الاختبارات', icon: <ClipboardList size={20} /> },
  { id: 'home',        label: 'الرئيسية',   icon: <Home size={26} /> },
  { id: 'schedule',    label: 'الجدول',     icon: <Calendar size={20} /> },
  { id: 'results',     label: 'نتائجي',     icon: <BarChart2 size={20} /> },
];

interface Props {
  studentName?: string;
  studentImage?: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  notifCount?: number;
  notifications?: any[];
  msgCount?: number;
  onNotifClick?: () => void;
  onLogout?: () => void;
  appName?: string;
  onAcademySwitch?: () => void;
  hasMultipleAcademies?: boolean;
  student?: any; // To access points and level
  children: React.ReactNode;
}

export function MobileAppLayout({
  studentName,
  studentImage,
  activeTab,
  onTabChange,
  notifCount = 0,
  notifications = [],
  msgCount = 0,
  onNotifClick,
  onLogout,
  onAcademySwitch,
  appName = 'AN Academy',
  hasMultipleAcademies = false,
  student,
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
    <div className="min-h-screen flex flex-col mx-auto bg-dark shadow-2xl relative transition-all duration-300" style={{ maxWidth: 'min(100%, 1280px)' }}>
      {/* Container to restrict app-feel on huge screens while allowing tablet/desktop expansion */}
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto border-x border-white/5 relative">
      {/* ══ App Header ══ */}
      <header
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between transition-all"
        style={{
          background: scrolled ? 'rgba(10,10,24,0.97)' : 'rgba(10,10,24,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(245,197,24,0.1)',
        }}
      >
        {/* Left: Notification & Switcher */}
        <div className="flex items-center gap-2">
          <GlobalNotificationWidget 
            notifications={notifications} 
            currentUser={{...student, role: 'student'}} 
            teacherId={student?.teacherId} 
          />
          
          {hasMultipleAcademies && (
            <button
              onClick={onAcademySwitch}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)' }}
            >
              <LayoutGrid size={20} className="gold-text" />
            </button>
          )}
        </div>

        {/* Center: App name / Teacher Info */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 mx-2 overflow-hidden">
          {student?.teacherName ? (
             <div className="flex items-center justify-center gap-2 max-w-full w-full">
                <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {student.teacherImage ? (
                    <Image src={student.teacherImage} alt={student.teacherName} className="w-full h-full object-cover" width={32} height={32} />
                  ) : (
                    <span className="text-xs gold-text font-bold">{student.teacherName[0]}</span>
                  )}
                </div>
                <div className="flex flex-col text-right truncate">
                  <span className="font-cairo font-black text-[13px] sm:text-[14px] gold-text truncate leading-tight">أ. {student.teacherName?.replace(/^أ\.\s*/, '')}</span>
                  <span className="text-[10px] text-gray-400 truncate">{student.teacherSubject || 'منصة تعليمية'}</span>
                </div>
             </div>
           ) : (
             <div className="font-cairo font-black text-base gold-text truncate">{appName}</div>
           )}
          
          {/* Level and points (optional - hidden on very small screens to save space if teacher info is visible) */}
          {student && !student.teacherName && (
            <div className="text-[11px] mt-0.5 flex flex-col items-center justify-center">
              <button onClick={() => onTabChange('leaderboard')} className="flex items-center gap-1 mt-0.5 bg-white/5 px-2 py-0.5 rounded-full border border-gold/20 text-gold font-bold text-[10px] hover:bg-gold/10 transition-colors">
                <span>🏆 مـ {student.level || 1}</span>
                <span className="w-1 h-1 bg-white/20 rounded-full mx-0.5"></span>
                <span>✨ {student.points || 0} ن</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Avatar - navigate to profile */}
        <button
          onClick={() => onTabChange('profile')}
          className="w-10 h-10 rounded-xl overflow-hidden border-2 border-gold/30 transition-transform active:scale-90"
          title="ملفي الشخصي"
        >
          {studentImage ? (
            <Image src={studentImage} alt={studentName} className="w-full h-full object-cover" width={40} height={40} />
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
          maxWidth: 'min(100%, 896px)', /* matching max-w-4xl */
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
    </div>
  );
}
