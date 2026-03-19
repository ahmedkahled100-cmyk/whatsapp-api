'use client';
// src/app/page.tsx
// الصفحة الرئيسية - تحويل حسب نوع المستخدم

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const user = useTeacherStore(s => s.user);
  const isAuthenticated = !!user;

  useEffect(() => {
    // Check for student session in local storage (client-side)
    const studentData = localStorage.getItem('an-academy-student');
    const hasStudent = studentData ? JSON.parse(studentData).state?.student : null;

    // Check URL params for student route
    const params = new URLSearchParams(window.location.search);
    if (params.has('student') || params.has('exam') || hasStudent) {
      router.replace('/student');
      return;
    }
    // Teacher route
    if (isAuthenticated) {
      router.replace('/teacher/dashboard');
    } else {
      // Default to student portal as it's the primary entry point for users
      router.replace('/student');
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
