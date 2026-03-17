'use client';
// src/app/page.tsx
// الصفحة الرئيسية - تحويل حسب نوع المستخدم

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useTeacherStore(s => s.isAuthenticated);

  useEffect(() => {
    // Check URL params for student route
    const params = new URLSearchParams(window.location.search);
    if (params.has('student') || params.has('exam')) {
      router.replace('/student');
      return;
    }
    // Teacher route
    if (isAuthenticated) {
      router.replace('/teacher/dashboard');
    } else {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark)' }}>
      <div className="text-center animate-fade-in">
        <div className="text-6xl mb-4">🎓</div>
        <div className="text-xl font-cairo" style={{ color: 'var(--gold)' }}>A-N Academy</div>
        <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</div>
      </div>
    </div>
  );
}
