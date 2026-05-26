'use client';
// src/components/TeacherDiscovery.tsx
// شاشة اكتشاف المدرسين والاشتراك معهم

import { useState, useEffect, useMemo } from 'react';
import { useStudentStore } from '@/lib/store';
import { getTeachers, dispatchNotification, saveRegistrationRequest, getRegistrationRequestsByPhone } from '@/lib/db';
import type { TeacherUser, RegistrationRequest } from '@/types';
import { User, BookOpen, ExternalLink, Search, Loader2, Sparkles, Send } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface Props {
  currentTeacherId: string;
  enrolledTeacherIds?: string[];
  onBack: () => void;
}

export function TeacherDiscovery({ currentTeacherId, enrolledTeacherIds = [], onBack }: Props) {
  const student = useStudentStore(state => state.student);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [pendingTeacherIds, setPendingTeacherIds] = useState<string[]>([]);

  useEffect(() => {
    getTeachers().then(ts => {
      // إظهار المدرسين النشطين (باستثناء المدرس الحالي للمساعدة في تنويع المواد)
      setTeachers(ts.filter(t => t.isActive));
      setLoading(false);
    });

    // Fetch existing registration requests to show "Pending" status
    if (student?.phone) {
        getRegistrationRequestsByPhone(student.phone).then(reqs => {
            const pendingIds = reqs
                .filter(r => r.status === 'pending')
                .map(r => r.teacherId);
            setPendingTeacherIds(pendingIds);
        });
    }
  }, [currentTeacherId, student?.phone]);

  const handleJoinRedirect = (teacherId: string) => {
    // Redirect to registration page with teacherId pre-selected
    // Optionally pass student info if logged in to pre-fill (though RegisterPage needs update to read it)
    const params = new URLSearchParams();
    params.set('teacherId', teacherId);
    if (student && student.id !== 'unknown_student') {
        params.set('name', student.name);
        params.set('phone', student.phone || '');
    }
    window.location.href = `/register?${params.toString()}`;
  };

  const filtered = useMemo(() => {
    return teachers.filter((t: TeacherUser) => 
      t.name.toLowerCase().includes(search.toLowerCase()) || 
      (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()))
    );
  }, [teachers, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3">
        <Loader2 className="animate-spin text-gold" size={32} />
        <span className="text-xs text-text-muted">جاري تحميل قائمة المبدعين...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up" dir="rtl">
      {/* Header section */}
      <div className="bg-gradient-to-r from-gold/20 to-transparent p-4 rounded-2xl border border-gold/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-black">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="font-cairo font-black text-lg text-white">اكتشف مدرسيك</h2>
          <p className="text-[10px] text-gray-400">انضم لأفضل الأكاديميات التعليمية في المنصة</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input 
          type="text" 
          placeholder="ابحث عن مدرس أو مادة دراسية..." 
          className="input-base has-icon-right w-full h-12 text-sm bg-white/5 border-white/10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((teacher: TeacherUser) => (
          <div 
            key={teacher.id} 
            className={`card-base p-4 flex items-center gap-4 transition-all group ${teacher.id === currentTeacherId ? 'border-gold/40 bg-gold/5' : 'hover:border-gold/30'}`}
          >
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                {teacher.imageUrl ? (
                  <img src={teacher.imageUrl} alt={teacher.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-accent/20 text-gold font-black text-xl">
                    {teacher.name[0]}
                  </div>
                )}
              </div>
              {teacher.id === currentTeacherId && (
                <span className="absolute -top-1 -right-1 bg-gold text-[8px] font-black px-1.5 py-0.5 rounded-full text-black border border-dark">أكاديميتك</span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white group-hover:gold-text transition-colors truncate">{teacher.name}</div>
              <div className="text-[11px] text-text-muted mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 capitalize shrink-0">
                  <BookOpen size={10} className="text-gold" /> {teacher.subject || 'مادة دراسية'}
                </span>
                {teacher.subPrice ? (
                  <span className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/10 text-green-400 font-bold shrink-0">
                    💰 {teacher.subPrice} ج.م / شهر
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/10 text-blue-400 font-bold shrink-0">
                    ✨ مجاني
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {student && student.id !== 'unknown_student' ? (
                <button
                  onClick={() => handleJoinRedirect(teacher.id)}
                  disabled={teacher.id === currentTeacherId || enrolledTeacherIds.includes(teacher.id) || pendingTeacherIds.includes(teacher.id)}
                  className={`btn-gold !py-2 !px-4 text-xs font-bold items-center gap-1.5 shadow-none flex rounded-xl transition-all active:scale-95 ${
                    (teacher.id === currentTeacherId || enrolledTeacherIds.includes(teacher.id) || pendingTeacherIds.includes(teacher.id)) ? 'opacity-50 grayscale' : ''
                  }`}
                >
                  {pendingTeacherIds.includes(teacher.id) ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>طلبك قيد المراجعة</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>{teacher.id === currentTeacherId || enrolledTeacherIds.includes(teacher.id) ? 'مشترك بالفعل' : 'طلب انضمام'}</span>
                    </>
                  )}
                </button>
              ) : (
                  <a 
                  href={`/register?teacherId=${teacher.id}`}
                  target="_blank"
                  className={`btn-gold !py-2 !px-4 text-xs font-bold items-center gap-1.5 shadow-none flex rounded-xl transition-transform active:scale-95 ${(teacher.id === currentTeacherId || enrolledTeacherIds.includes(teacher.id)) ? 'opacity-50 pointer-events-none grayscale' : ''}`}
                >
                  <span>{teacher.id === currentTeacherId || enrolledTeacherIds.includes(teacher.id) ? 'مشترك بالفعل' : 'تسجيل'}</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">🔍</div>
          <div className="text-sm text-text-muted font-bold">عذراً، لم نجد مدرسين بهذا الاسم</div>
          <button onClick={() => setSearch('')} className="text-xs gold-text underline">عرض الكل</button>
        </div>
      )}

      <button 
        onClick={onBack} 
        className="w-full py-4 text-sm text-gray-500 font-bold hover:text-white transition-colors"
      >
        ← العودة للرئيسية
      </button>
    </div>
  );
}
