'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Clock, ExternalLink, X, Info, AlertTriangle, CheckCircle, BellRing } from 'lucide-react';
import { Notification } from '@/types';
import { useRouter } from 'next/navigation';
import { formatDateAr } from '@/lib/utils';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/db';
import { showToast } from '@/lib/toast';

interface GlobalNotificationWidgetProps {
  notifications: Notification[];
  currentUser: any;
  teacherId?: string; // Needed for mark all as read if we are relying on teacherId, though markAllNotificationsRead usually works by teacher_id, which might be tricky for students.
}

export function GlobalNotificationWidget({ notifications, currentUser, teacherId }: GlobalNotificationWidgetProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayNotifs = teacherId ? notifications.filter((n: any) => n.teacher_id === teacherId || n.teacherId === teacherId) : notifications;
  const unreadCount = displayNotifs.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: Notification) => {
    setIsOpen(false);
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
    if (n.actionPath) {
      router.push(n.actionPath);
    }
  };

  const handleMarkAllRead = async () => {
    if (!teacherId || unreadCount === 0) return;
    try {
      // NOTE: markAllNotificationsRead in DB is currently implemented to mark ALL notifications for a teacher_id.
      // If the current user is a student, we can't easily mark *all* of them because the notifications belong to the teacher.
      // Instead, we mark the student's specific unread notifications one by one to be safe, or just loop over the displayed ones.
      const unreadNotifs = displayNotifs.filter(n => !n.read);
      await Promise.all(unreadNotifs.map(n => markNotificationRead(n.id)));
      showToast('تم تحديد الكل كمقروء');
    } catch (error) {
      console.error('Error marking all as read:', error);
      showToast('حدث خطأ أثناء التحديث', 'error');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="text-green-400" />;
      case 'warning': return <AlertTriangle size={18} className="text-yellow-400" />;
      case 'error': return <AlertTriangle size={18} className="text-red-400" />;
      default: return <Info size={18} className="text-blue-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl flex items-center justify-center relative transition-all hover:bg-white/5 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-gold' : 'text-gray-400'} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel (Glassmorphism) */}
      {isOpen && (
        <div 
          className="absolute left-0 sm:left-auto sm:right-0 mt-3 w-[320px] sm:w-[380px] rounded-2xl shadow-2xl overflow-hidden z-[100] border border-white/10 animate-scale-in"
          style={{ 
            background: 'rgba(15, 15, 25, 0.85)', 
            backdropFilter: 'blur(20px)',
            transformOrigin: 'top right'
          }}
          dir="rtl"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h3 className="font-black text-white flex items-center gap-2">
              <BellRing size={16} className="text-gold" /> الإشعارات
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/5 hover:border-white/10"
              >
                <Check size={12} /> تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {displayNotifs.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 opacity-50">
                <Bell size={32} className="text-gray-500 mb-2" />
                <p className="text-sm font-bold text-gray-400">لا توجد إشعارات</p>
                <p className="text-[10px] text-gray-500">سوف تظهر الإشعارات الجديدة هنا</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {displayNotifs.slice(0, 30).map((n) => (
                  <button 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-right p-4 border-b border-white/5 transition-all hover:bg-white/5 flex gap-3 ${!n.read ? 'bg-gold/5' : ''}`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {getIcon(n.type || 'info')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed mb-1.5 ${!n.read ? 'text-white font-bold' : 'text-gray-300 font-medium'}`}>
                        {n.msg}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock size={10} />
                          {n.time || formatDateAr(n.createdAt)}
                        </span>
                        {n.actionPath && (
                          <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            رابط <ExternalLink size={8} />
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_5px_var(--gold)] mt-1.5 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-white/5 bg-black/20">
            {currentUser.role === 'teacher' && (
              <button 
                onClick={() => { setIsOpen(false); router.push('/teacher/notifications'); }}
                className="w-full py-2 text-xs font-bold text-gold hover:text-gold/80 transition-colors"
              >
                عرض كل الإشعارات والإرسال
              </button>
            )}
            {currentUser.role === 'super_admin' && (
              <button 
                onClick={() => { setIsOpen(false); router.push('/admin/notifications'); }}
                className="w-full py-2 text-xs font-bold text-gold hover:text-gold/80 transition-colors"
              >
                إدارة الإشعارات المركزية
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
