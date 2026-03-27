'use client';
import { useState, useEffect } from 'react';
import { saveCalendarEvent, getExams, getAssignments, getCalendarEvents } from '@/lib/db';
import { useTeacherStore } from '@/lib/store';
import { CalendarEvent } from '@/types';
import { showToast } from '@/lib/toast';
import { Calendar as CalendarIcon, PlusCircle, Clock, BookOpen, ClipboardList } from 'lucide-react';

export default function CalendarPage() {
  const { user } = useTeacherStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    type: 'manual' as CalendarEvent['type'],
    isRecurring: false,
    recurringDays: [] as number[],
    startTime: '',
    endTime: ''
  });

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      if (!user) return;
      // 1. Get Exams
      const exams = await getExams(user.id);
      const examEvents = exams
        .filter((e: any) => e.startTime) // Only scheduled exams
        .map((e: any) => ({
          id: `exam-${e.id}`,
          title: `امتحان: ${e.title}`,
          description: e.desc,
          date: e.startTime!,
          type: 'exam' as const,
          referenceId: e.id,
          teacherId: user!.id,
          createdAt: e.createdAt
        }));

      // 2. Get Assignments
      const assignments = await getAssignments(user.id);
      const assignEvents = assignments
        .filter((a: any) => a.dueDate)
        .map((a: any) => ({
          id: `assign-${a.id}`,
          title: `تسليم واجب: ${a.title}`,
          description: a.description,
          date: a.dueDate,
          type: 'assignment' as const,
          referenceId: a.id,
          teacherId: user!.id,
          createdAt: a.createdAt
        }));

      // 3. Get Manual Calendar Events
      const manualEvents = await getCalendarEvents(user.id);

      // Merge and Sort
      const allEvents = [...examEvents, ...assignEvents, ...manualEvents]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
      setEvents(allEvents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllEvents();
  }, []);

  const handleSave = async () => {
    if (!newEvent.title || !newEvent.date) {
      showToast('الرجاء إدخال العنوان والتاريخ');
      return;
    }
    setSaving(true);
    const eventData: CalendarEvent = {
        id: crypto.randomUUID(),
        title: newEvent.title,
        description: newEvent.description || '',
        date: newEvent.isRecurring && !newEvent.date ? new Date().toISOString() : newEvent.date,
        type: newEvent.type,
        isRecurring: newEvent.isRecurring,
        recurringDays: newEvent.recurringDays,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        teacherId: user!.id,
        createdAt: Date.now()
    };

    // Optimistic Update
    const previousEvents = [...events];
    const updatedEvents = [...previousEvents, eventData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setEvents(updatedEvents);

    try {
      await saveCalendarEvent(eventData);
      setShowAddForm(false);
      setNewEvent({ 
        title: '', description: '', date: '', type: 'manual', 
        isRecurring: false, recurringDays: [], startTime: '', endTime: '' 
      });
      showToast('✅ تم إضافة الحدث بنجاح');
    } catch (e) {
      setEvents(previousEvents);
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'exam': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'assignment': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'live_session': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'fixed_class': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'holiday': return 'bg-green-500/20 text-green-500 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'exam': return <BookOpen size={16} />;
      case 'assignment': return <ClipboardList size={16} />;
      case 'live_session': return <Clock size={16} />;
      case 'fixed_class': return <CalendarIcon size={16} className="text-purple-500" />;
      default: return <CalendarIcon size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon size={28} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">التقويم الأكاديمي</h1>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-gold flex items-center gap-2">
          {showAddForm ? 'إلغاء' : <><PlusCircle size={18} /> إضافة حدث</>}
        </button>
      </div>

      {showAddForm && (
        <div className="card-base p-6 animate-fade-in border border-yellow-500/30">
          <h2 className="font-bold text-lg mb-4">إضافة حدث للتقويم</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1 opacity-70">عنوان الحدث *</label>
              <input 
                type="text" className="input-base w-full" placeholder="مثال: حصة مراجعة مباشرة"
                value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">التاريخ والوقت *</label>
              <input 
                type="datetime-local" className="input-base w-full"
                value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">نوع الحدث</label>
              <select 
                className="input-base w-full"
                value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
              >
                <option value="manual">حدث عام</option>
                <option value="live_session">حصة مباشرة</option>
                <option value="fixed_class">حصة ثابتة</option>
                <option value="holiday">إجازة</option>
              </select>
            </div>
            <div className="md:col-span-2 bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={newEvent.isRecurring} 
                  onChange={e => setNewEvent({...newEvent, isRecurring: e.target.checked, type: e.target.checked ? 'fixed_class' : 'manual'})}
                  className="w-4 h-4 rounded border-gray-600 text-gold focus:ring-gold"
                />
                <span className="font-bold text-sm">حصة ثابتة (تتكرر أسبوعياً)</span>
              </label>

              {newEvent.isRecurring && (
                <div className="animate-fade-in space-y-4 pt-2 border-t border-white/5">
                  <div className="space-y-2">
                    <label className="text-xs opacity-70">اختر أيام الأسبوع:</label>
                    <div className="flex flex-wrap gap-2">
                      {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const days = newEvent.recurringDays.includes(idx)
                              ? newEvent.recurringDays.filter(d => d !== idx)
                              : [...newEvent.recurringDays, idx];
                            setNewEvent({...newEvent, recurringDays: days});
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            newEvent.recurringDays.includes(idx) ? 'bg-gold text-dark' : 'bg-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs opacity-70 block mb-1">وقت البدء</label>
                      <input 
                        type="time" className="input-base w-full"
                        value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs opacity-70 block mb-1">وقت الانتهاء</label>
                      <input 
                        type="time" className="input-base w-full"
                        value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
               <label className="block text-sm mb-1 opacity-70">التفاصيل / الملاحظات</label>
               <textarea 
                  className="input-base w-full resize-none h-20" placeholder="اكتب الملاحظات هنا..."
                  value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
               />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowAddForm(false)} className="btn-outline px-6">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="btn-gold px-6">
               {saving ? 'جاري الحفظ...' : 'حفظ الحدث'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 opacity-50">جاري التحميل...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 card-base">
          <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-gray-400">لا توجد أحداث مجدولة قادمة.</p>
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
          {events.map((evt, idx) => {
            const dateObj = new Date(evt.date);
            const isPast = dateObj.getTime() < Date.now();
            
            return (
              <div key={evt.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${isPast ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0f1c] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"
                     style={{ background: '#111827' }}>
                  <div className={`w-3 h-3 rounded-full ${isPast ? 'bg-gray-500' : 'bg-gold'}`} />
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] card-base p-4 border border-white/5 transition-all hover:-translate-y-1 hover:border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1.5 ${getTypeColor(evt.type)}`}>
                      {getTypeIcon(evt.type)}
                      {evt.type === 'exam' ? 'امتحان' : 
                       evt.type === 'assignment' ? 'واجب' : 
                       evt.type === 'live_session' ? 'حصة مباشرة' : 
                       evt.type === 'holiday' ? 'إجازة' : 'عام'}
                    </span>
                    <span className="text-xs font-bold opacity-70">
                      {dateObj.toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1">{evt.title}</h3>
                  <div className="text-xs opacity-70 mb-3 flex items-center gap-1.5">
                    <Clock size={12} /> {dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {evt.description && (
                    <p className="text-sm opacity-60 leading-relaxed line-clamp-2">{evt.description}</p>
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
