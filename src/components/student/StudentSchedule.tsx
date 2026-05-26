'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { getCalendarEvents, getExams, getAssignments } from '@/lib/db';
import type { CalendarEvent, Student, Exam, Assignment } from '@/types';

interface StudentScheduleProps {
  student: Student;
  allEnrollments: any[];
}

export function StudentSchedule({ student, allEnrollments }: StudentScheduleProps) {
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [allTeacherEvents, setAllTeacherEvents] = useState<any[]>([]);

  const loadGlobalSchedule = useCallback(async () => {
    if (!student || student.id === 'unknown_student') return;
    setLoadingSchedule(true);
    try {
      const allEvents: any[] = [];
      
      // Load events for each enrollment
      for (const enrollment of allEnrollments) {
        if (!enrollment.teacherId) continue;
        
        // Fetch manual events
        const manual = await getCalendarEvents(enrollment.teacherId);
        
        // Fetch exams and assignments to include them in schedule
        const teacherExams = await getExams(enrollment.teacherId);
        const teacherAssigns = await getAssignments(enrollment.teacherId);
        
        const examEvents = teacherExams
          .filter((e: Exam) => e.startTime)
          .map((e: Exam) => ({
            id: `exam-${e.id}`,
            title: `امتحان: ${e.title}`,
            date: e.startTime!,
            type: 'exam' as const,
            teacherId: e.teacherId,
            teacherName: (e as any).teacherName || (enrollment as any).teacherName || 'المعلم',
            createdAt: e.createdAt || new Date().toISOString()
          }));
          
        const assignEvents = teacherAssigns
          .filter((a: Assignment) => a.dueDate)
          .map((a: Assignment) => ({
            id: `assign-${a.id}`,
            title: `واجب: ${a.title}`,
            date: a.dueDate,
            type: 'assignment' as const,
            teacherId: enrollment.teacherId,
            teacherName: (enrollment as any).teacherName || 'المعلم',
            createdAt: a.createdAt || new Date().toISOString()
          }));

        // Tag manual events with teacher name
        const taggedManual = manual.map((m: CalendarEvent) => ({
          ...m,
          teacherName: (enrollment as any).teacherName || 'المعلم'
        }));

        allEvents.push(...examEvents, ...assignEvents, ...taggedManual);
      }
      
      // Sort by date/time
      setAllTeacherEvents(allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (err) {
      console.error('Failed to load global schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }, [student, allEnrollments]);

  useEffect(() => {
    void loadGlobalSchedule();
  }, [loadGlobalSchedule]);

  const TabSkeleton = () => (
    <div className="space-y-4 animate-fade-in px-2">
      <div className="h-8 w-48 skeleton mb-6" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card-base p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 skeleton" />
            <div className="h-3 w-1/2 skeleton opacity-50" />
          </div>
          <div className="w-20 h-8 rounded-xl skeleton" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 animate-slide-up pb-24">
      <div className="flex items-center justify-between bg-gold/5 p-4 rounded-2xl border border-gold/10">
        <div className="flex items-center gap-3">
          <Calendar className="text-gold" />
          <h3 className="font-bold text-white">جدولك الدراسي الموحد</h3>
        </div>
        <button onClick={loadGlobalSchedule} className="text-xs gold-text flex items-center gap-1">
          🔄 تحديث
        </button>
      </div>

      {loadingSchedule ? (
        <TabSkeleton />
      ) : allTeacherEvents.length === 0 ? (
        <div className="card-base p-16 text-center space-y-4">
          <Calendar className="mx-auto text-white/5" size={48} />
          <p className="text-xs text-text-muted">لا توجد فعاليات مجدولة حالياً.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTeacherEvents.map((evt: any) => {
            const dateObj = new Date(evt.date);
            const isPast = dateObj.getTime() < Date.now();
            const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
            const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={evt.id} className={`card-base p-4 border border-white/5 flex gap-4 ${isPast ? 'opacity-50' : ''}`}>
                <div className="w-16 flex flex-col items-center justify-center border-l border-white/5 pl-4 shrink-0">
                  <span className="text-[10px] font-bold text-gold uppercase">{dayName}</span>
                  <span className="text-xl font-black">{dateObj.getDate()}</span>
                  <span className="text-[10px] text-gray-500">{dateObj.toLocaleDateString('ar-EG', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-sm truncate">{evt.title}</h4>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ml-2 ${
                      evt.type === 'exam' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      evt.type === 'assignment' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                      evt.type === 'fixed_class' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}>
                      {evt.type === 'exam' ? 'امتحان' : 
                       evt.type === 'assignment' ? 'واجب' : 
                       evt.type === 'fixed_class' ? 'حصة ثابتة' : 'فعالية'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <Clock size={10} className="text-gold" /> {timeStr}
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="gold-text font-bold">🎓 {evt.teacherName}</span>
                  </div>
                  {evt.isRecurring && evt.recurringDays && (
                    <div className="mt-2 flex gap-1">
                      {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, dIdx) => (
                        <span 
                          key={dIdx} 
                          className={`w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold ${
                            evt.recurringDays.includes(dIdx) ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-600'
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
