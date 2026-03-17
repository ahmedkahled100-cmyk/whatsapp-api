'use client';
// src/app/auth/page.tsx
// صفحة تسجيل دخول المعلم

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { getSettings } from '@/lib/db';
import { Eye, EyeOff, Lock, GraduationCap, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth, setSettings, settings } = useTeacherStore();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) router.replace('/teacher/dashboard');
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (!password.trim()) { setError('يرجى إدخال كلمة المرور'); return; }
    setLoading(true);
    setError('');
    try {
      let settings = null;
      try {
        settings = await getSettings();
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        // Fallback to default password if DB is unreachable
      }

      const correctPass = settings?.teacherPassword || 'admin123';
      if (password === correctPass) {
        setAuth(true);
        if (settings) setSettings(settings);
        router.replace('/teacher/dashboard');
      } else {
        setError('❌ كلمة المرور غير صحيحة');
        setPassword('');
      }
    } catch (error) {
      console.error(error);
      setError('حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--dark)' }}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent)', filter: 'blur(80px)' }} />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md animate-scale-in">
        <div className="card-base p-6 sm:p-10" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,197,24,0.15)' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg, var(--gold), var(--accent))', boxShadow: '0 0 40px rgba(245,197,24,0.4)', animation: 'pulseGold 3s ease-in-out infinite' }}>
              {settings?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover relative z-10" />
              ) : (
                <GraduationCap size={32} color="#000" className="relative z-10 sm:size-[40px]" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-cairo font-black gold-text text-center">{settings?.acadName || 'A-N Academy'}</h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>لوحة تحكم المعلم</p>
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <label className="block text-xs sm:text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              <Lock size={13} className="inline ml-1" />
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="كلمة المرور..."
                className="input-base text-center text-lg sm:text-xl tracking-widest px-10 sm:px-14"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-gold transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--red)' }}>{error}</span>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-gold w-full justify-center text-lg py-4 disabled:opacity-60"
          >
            {loading ? '⏳ جاري التحقق...' : '🚀 دخول لوحة التحكم'}
          </button>

          {/* Hint */}
          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            كلمة المرور الافتراضية: <span className="font-mono" style={{ color: 'var(--gold)' }}>admin123</span>
            <br />يمكن تغييرها من الإعدادات
          </p>

          {/* Student link */}
          <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <a href="/student" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
              👤 أنت طالب؟ اضغط هنا للدخول
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
