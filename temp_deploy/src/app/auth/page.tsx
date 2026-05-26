'use client';
// src/app/auth/page.tsx
// صفحة تسجيل دخول المعلم / الإدارة

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { getTeacherByUsername, getTeachers, saveTeacher, getSettings, getTeacherByCode, getTeacherByPhone, updateSuperAdminCredentials } from '@/lib/db';
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
        
        // 1. Check specifically if the admin user exists (more robust than checking total count)
        let adminExists = await getTeacherByUsername('admin');
        
        if (!adminExists) {
          // Seed default admin and security accounts
          const adminData = {
            name: 'المدير العام (Admin)',
            username: 'admin',
            password: 'admin123',
            role: 'super_admin' as const,
            isActive: true,
            createdAt: Date.now()
          };
          
          const securityData = {
            name: 'مسؤول الأمن (Security)',
            username: 'security',
            password: 'security123',
            role: 'super_admin' as const,
            isActive: true,
            createdAt: Date.now()
          };

          const adminId = await saveTeacher(adminData);
          await saveTeacher(securityData);

          // If current login is for one of these, use them directly
          if (username === 'admin' && password === 'admin123') {
            teacherToAuth = { ...adminData, id: adminId };
          } else if (username === 'security' && password === 'security123') {
            const sec = await getTeacherByUsername('security');
            if (sec) teacherToAuth = sec;
          }
        }

        // 2. Fetch user if not already set by seed logic
        if (!teacherToAuth) {
          teacherToAuth = await getTeacherByUsername(username);
        }

        if (!teacherToAuth) {
          setError('❌ المستخدم غير موجود');
        } else if (!teacherToAuth.isActive) {
          setError('❌ هذا الحساب غير مفعل');
        } else if ((teacherToAuth.password || '').trim() !== (password || '').trim()) {
          // Check for 'admin' rescue scenario
          if (username === 'admin' && password === 'admin123') {
            try {
              await updateSuperAdminCredentials(teacherToAuth.id, 'admin', 'admin123');
              teacherToAuth.password = 'admin123';
              // Continue login...
            } catch (rescueErr) {
              console.error('Rescue failed', rescueErr);
              setError('❌ كلمة المرور غير صحيحة');
              teacherToAuth = null;
            }
          } else {
            setError('❌ كلمة المرور غير صحيحة');
            teacherToAuth = null;
          }
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
          setSettings(s || null);
        } catch (dbError) {
          console.error('Settings not found or db error', dbError);
          setSettings(null);
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
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="card-base p-5 sm:p-7" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,197,24,0.15)' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-4 sm:mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gold rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,197,24,0.3)] relative group animate-fade-in mb-4">
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping group-hover:animate-none opacity-20" />
              <img src="/logo.png" alt="A-N Academy" className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-full" />
            </div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black gold-text text-center">أكاديمية A-N</h1>
            <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>تسجيل الدخول للإدارة والمعلمين</p>
          </div>

          {/* Method Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-4 border border-white/10">
            <button
              onClick={() => { setLoginMethod('credentials'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'credentials' ? 'bg-gold text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-white'}`}
            >
              اسم المستخدم
            </button>
            <button
              onClick={() => { setLoginMethod('code'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'code' ? 'bg-gold text-black shadow-lg shadow-yellow-500/20' : 'text-gray-400 hover:text-white'}`}
            >
              كود الدخول
            </button>
          </div>

          {loginMethod === 'credentials' ? (
            <>
              {/* Username Input */}
              <div className="mb-3">
                <label className="block text-[10px] sm:text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <User size={12} className="inline ml-1" />
                  اسم المستخدم
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="اسم المستخدم..."
                    className="input-base text-center text-base sm:text-lg px-8 sm:px-10 py-2.5"
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-3">
                <label className="block text-[10px] sm:text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <Lock size={12} className="inline ml-1" />
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="كلمة المرور..."
                    className="input-base text-center text-base sm:text-lg tracking-widest px-8 sm:px-10 py-2.5"
                    dir="ltr"
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
            </>
          ) : (
            <>
              {/* Code Input */}
              <div className="mb-3">
                <label className="block text-[10px] sm:text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <KeySquare size={12} className="inline ml-1" />
                  كود الدخول
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="أدخل كود المرور..."
                    className="input-base text-center text-base sm:text-lg px-8 sm:px-10 tracking-widest font-mono py-2.5"
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3 animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-gold w-full justify-center text-base py-3 disabled:opacity-60 mt-2"
          >
            {loading ? '⏳ جاري التحقق...' : '🚀 دخول'}
          </button>

          {/* Student link */}
          <div className="mt-4 pt-3 text-center space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
