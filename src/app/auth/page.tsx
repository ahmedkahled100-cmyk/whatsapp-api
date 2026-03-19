'use client';
// src/app/auth/page.tsx
// صفحة تسجيل دخول المعلم / الإدارة

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { getTeacherByUsername, getTeachers, saveTeacher, getSettings, getTeacherByCode, getTeacherByPhone } from '@/lib/db';
import { Eye, EyeOff, Lock, User, GraduationCap, AlertCircle, KeySquare } from 'lucide-react';
import type { TeacherUser } from '@/types';

export default function AuthPage() {
  const router = useRouter();
  const { user, setUser, setSettings } = useTeacherStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'code'>('credentials');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [phone, setPhone] = useState('');
  const [recoveredInfo, setRecoveredInfo] = useState<TeacherUser | null>(null);
  const [finding, setFinding] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (user) {
      if (user.role === 'super_admin') router.replace('/admin');
      else router.replace('/teacher/dashboard');
    }
  }, [user, router]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      let teacherToAuth: TeacherUser | null = null;

      if (loginMethod === 'credentials') {
        if (!username.trim() || !password.trim()) { 
          setError('يرجى إدخال اسم المستخدم وكلمة المرور'); 
          setLoading(false); 
          return; 
        }
        
        // 1. Check if any users exist to seed the default admin
        const existingTeachers = await getTeachers();
        
        if (existingTeachers.length === 0) {
          // Seed default super_admin
          const newAdminId = await saveTeacher({
            name: 'المدير العام',
            username: 'admin',
            password: 'admin123', // In production, this should be hashed
            role: 'super_admin',
            isActive: true,
            createdAt: Date.now()
          });
          if (username === 'admin' && password === 'admin123') {
            teacherToAuth = {
              id: newAdminId,
              name: 'المدير العام',
              username: 'admin',
              role: 'super_admin',
              isActive: true,
              createdAt: Date.now()
            };
          }
        } else {
          teacherToAuth = await getTeacherByUsername(username);
        }

        if (!teacherToAuth) {
          setError('❌ المستخدم غير موجود');
        } else if (!teacherToAuth.isActive) {
          setError('❌ هذا الحساب غير مفعل');
        } else if (teacherToAuth.password !== password) {
          setError('❌ كلمة المرور غير صحيحة');
          teacherToAuth = null;
        }
      } else {
        if (!code.trim()) { 
          setError('يرجى إدخال كود الدخول'); 
          setLoading(false); 
          return; 
        }
        teacherToAuth = await getTeacherByCode(code.trim());
        if (!teacherToAuth) {
          setError('❌ الكود غير صحيح');
        } else if (!teacherToAuth.isActive) {
          setError('❌ هذا الحساب غير مفعل');
          teacherToAuth = null;
        }
      }

      if (teacherToAuth) {
        // Success
        setUser(teacherToAuth);
        
        // Try to load settings if regular teacher
        try {
          const s = await getSettings(teacherToAuth.id);
          if (s) setSettings(s);
        } catch (dbError) {
          console.error('Settings not found or db error', dbError);
        }
        
        if (teacherToAuth.role === 'super_admin') {
          router.replace('/admin');
        } else {
          router.replace('/teacher/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotInfo = async () => {
    if (!phone.trim()) { setError('أدخل رقم هاتفك المسجل أولاً'); return; }
    setFinding(true);
    setRecoveredInfo(null);
    try {
      const t = await getTeacherByPhone(phone.trim());
      if (t) {
        setRecoveredInfo(t);
        setError('');
      } else {
        setError('❌ لم يتم العثور على حساب بهذا الرقم');
      }
    } catch (err) {
      setError('حدث خطأ أثناء البحث');
    } finally {
      setFinding(false);
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
              <GraduationCap size={32} color="#000" className="relative z-10 sm:size-[40px]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-cairo font-black gold-text text-center">أكاديمية A-N</h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>تسجيل الدخول للإدارة والمعلمين</p>
          </div>

          {/* Method Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
            <button
              onClick={() => { setLoginMethod('credentials'); setError(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${loginMethod === 'credentials' ? 'bg-gold text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-white'}`}
            >
              اسم المستخدم
            </button>
            <button
              onClick={() => { setLoginMethod('code'); setError(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${loginMethod === 'code' ? 'bg-gold text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-white'}`}
            >
              كود الدخول
            </button>
          </div>

          {loginMethod === 'credentials' ? (
            <>
              {/* Username Input */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                  <User size={13} className="inline ml-1" />
                  اسم المستخدم
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="اسم المستخدم..."
                    className="input-base text-center text-lg sm:text-xl px-10 sm:px-14 py-4"
                    dir="ltr"
                    autoFocus
                  />
                </div>
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
                    className="input-base text-center text-lg sm:text-xl tracking-widest px-10 sm:px-14 py-4"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-gold transition-colors"
                  >
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Code Input */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                  <KeySquare size={13} className="inline ml-1" />
                  كود الدخول
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="أدخل كود المرور..."
                    className="input-base text-center text-lg sm:text-xl px-10 sm:px-14 tracking-widest font-mono py-4"
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>
            </>
          )}

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
            className="btn-gold w-full justify-center text-lg py-4 disabled:opacity-60 mt-4"
          >
            {loading ? '⏳ جاري التحقق...' : '🚀 دخول'}
          </button>

          {/* Student link */}
          <div className="mt-6 pt-4 text-center space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button 
              onClick={() => { setShowForgot(true); setError(''); }}
              className="text-sm block w-full hover:underline" style={{ color: 'var(--text-muted)' }}
            >
              ❓ نسيت بيانات الدخول؟ استرجاع بالهاتف
            </button>
            <a href="/student" className="text-sm block w-full hover:underline font-bold" style={{ color: 'var(--gold)' }}>
              👤 أنت طالب؟ اضغط هنا للدخول بالكود
            </a>
          </div>

          {/* Forgot Credentials Modal */}
          {showForgot && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
              <div className="card-base w-full max-w-md p-6 sm:p-8 border border-gold/30 animate-scale-in">
                <h3 className="text-xl font-bold mb-4 text-center gold-text">استرجاع بيانات المعلم</h3>
                <p className="text-xs text-text-muted mb-6 text-center">أدخل رقم الهاتف المسجل في حسابك لاسترجاع بيانات الدخول.</p>
                
                <input
                  type="tel"
                  placeholder="رقم الهاتف..."
                  className="input-base w-full text-center text-lg mb-4"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  dir="ltr"
                />

                {error && (
                  <div className="p-3 rounded-lg mb-4 text-xs text-center" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {error}
                  </div>
                )}

                {recoveredInfo && (
                  <div className="p-5 rounded-2xl bg-white/5 border border-gold/20 mb-6 space-y-3 animate-slide-up">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-xs text-text-muted">اسم المستخدم:</span>
                      <span className="font-bold text-white selection:bg-gold selection:text-black">{recoveredInfo.username}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-xs text-text-muted">كلمة المرور:</span>
                      <span className="font-bold text-white selection:bg-gold selection:text-black">{recoveredInfo.password}</span>
                    </div>
                    {recoveredInfo.code && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted">كود الدخول:</span>
                        <span className="font-bold text-gold selection:bg-white selection:text-black">{recoveredInfo.code}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowForgot(false); setRecoveredInfo(null); setPhone(''); setError(''); }}
                    className="btn-outline flex-1 py-3"
                  >
                    إغلاق
                  </button>
                  {!recoveredInfo && (
                    <button 
                      onClick={handleForgotInfo}
                      disabled={finding}
                      className="btn-gold flex-[2] py-3 shadow-lg shadow-gold/20"
                    >
                      {finding ? '⏳ جاري البحث...' : '🔍 استرجاع البيانات'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
