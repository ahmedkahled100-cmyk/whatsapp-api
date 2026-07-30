'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { subscribeToDisabledPages } from '@/lib/db';
import type { DisabledPageItem } from '@/types';
import { ShieldAlert, ArrowRight, Home, RefreshCw } from 'lucide-react';

export function DisabledPageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useTeacherStore(state => state.user);
  const [disabledPages, setDisabledPages] = useState<DisabledPageItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = subscribeToDisabledPages((pages) => {
      setDisabledPages(pages);
    });
    return () => unsub();
  }, []);

  if (!mounted) return <>{children}</>;

  // Check if current route is disabled
  const disabledItem = disabledPages.find(item => {
    if (!item.isDisabled) return false;
    if (item.path === pathname) return true;
    // Handle sub-routes e.g. /teacher/exams/create or /teacher/exams/123 matches /teacher/exams
    if (item.path !== '/teacher' && item.path !== '/student' && item.path.length > 7 && pathname.startsWith(item.path)) return true;
    return false;
  });

  const isSuperAdmin = user?.role === 'super_admin';

  // If page is disabled and user is NOT super admin, show suspended screen
  if (disabledItem && !isSuperAdmin) {
    const homePath = pathname.startsWith('/student') ? '/student' : (user?.role === 'assistant' ? '/assistant/dashboard' : '/teacher/dashboard');

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-[#111827]/90 border border-amber-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
          {/* Icon Badge */}
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/30 shadow-lg shadow-amber-500/10 animate-bounce-slow">
            <ShieldAlert size={40} className="text-amber-400" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">
              هذه الصفحة <span className="text-amber-400">معطلة مؤقتاً</span>
            </h2>
            <p className="text-xs text-gray-400">
              تم إيقاف الوصول إلى ({disabledItem.title}) بقرار من إدارة المنصة.
            </p>
          </div>

          {/* Reason Box */}
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-4 text-right space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              💬 <span>سبب الإيقاف من الإدارة:</span>
            </div>
            <p className="text-sm text-gray-200 font-medium leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
              {disabledItem.reason && disabledItem.reason.trim() ? disabledItem.reason : 'جاري إجراء صيانة وتحديثات دورية على هذه الصفحة وسيتم إعادتها قريباً.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => router.push(homePath)}
              className="w-full btn-gold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Home size={18} /> العودة للرئيسية
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 border border-white/10 text-xs transition-colors"
            >
              <RefreshCw size={14} /> إعادة التحقق من الحالة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {disabledItem && isSuperAdmin && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 text-xs py-2 px-4 flex items-center justify-between font-bold">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>تنبيه للأدمن: هذه الصفحة معطلة حالياً عن جميع المستخدمين!</span>
            {disabledItem.reason && <span className="opacity-80">({disabledItem.reason})</span>}
          </div>
          <button
            onClick={() => router.push('/admin/disabled-pages')}
            className="bg-amber-500 text-black px-2.5 py-1 rounded-lg text-[11px] font-black hover:bg-amber-400 transition"
          >
            إدارة التعطيل
          </button>
        </div>
      )}
      {children}
    </>
  );
}
