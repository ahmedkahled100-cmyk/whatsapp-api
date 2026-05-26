'use client';

import { useToastStore } from '@/lib/toast';
import { Check, X, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border pointer-events-auto backdrop-blur-md transition-all duration-300 animate-slide-down ${
            toast.type === 'success'
              ? 'bg-[#0f1b21]/90 border-[#1a3328] text-white'
              : toast.type === 'error'
              ? 'bg-[#2a1114]/90 border-[#4a1d22] text-white'
              : 'bg-[#121c2d]/90 border-[#1f314d] text-white'
          }`}
          style={{ minWidth: '300px' }}
        >
          {toast.type === 'success' && (
            <div className="bg-[#2ecc71] text-white rounded p-1 flex-shrink-0">
              <Check size={16} strokeWidth={3} />
            </div>
          )}
          {toast.type === 'error' && (
            <div className="bg-[#e74c3c] text-white rounded p-1 flex-shrink-0">
              <X size={16} strokeWidth={3} />
            </div>
          )}
          {toast.type === 'info' && (
            <div className="bg-[#3498db] text-white rounded p-1 flex-shrink-0">
              <Info size={16} strokeWidth={3} />
            </div>
          )}

          <div className="flex-1 text-sm font-medium font-cairo" dir="rtl">
            {toast.message}
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
