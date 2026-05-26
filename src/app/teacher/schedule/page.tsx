'use client';
import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { CalendarEvent } from '@/types';
import { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from '@/lib/db';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Edit } from 'lucide-react';
import { showToast } from '@/lib/toast';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function SchedulePage() {
  const user = useTeacherStore(state => state.user);
  const groups = useTeacherStore(state => state.groups);
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({
    type: 'fixed_class',
    title: '',
    description: '',
    startTime: '08:00',
    endTime: '10:00',
    recurringDays: [0],
    isRecurring: true
  });

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getCalendarEvents(user.id);
      setEvents(data.filter(e => e.type === 'fixed_class' || e.type === 'live_session'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.title) {
      showToast('يرجى إدخال عنوان الحصة', 'error');
      return;
    }
    
    try {
      const newEvent = {
        ...form,
        teacherId: user.id,
        date: new Date().toISOString().split('T')[0], // Base date, ignored if recurring
        createdAt: new Date().toISOString()
      } as CalendarEvent;
      
      const id = await saveCalendarEvent(newEvent);
      setEvents([...events, { ...newEvent, id }]);
      setShowModal(false);
      showToast('تم حفظ الحصة بنجاح', 'success');
    } catch (err) {
      showToast('فشل في حفظ الحصة', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الحصة من الجدول؟')) return;
    try {
      await deleteCalendarEvent(id);
      setEvents(events.filter(e => e.id !== id));
      showToast('تم الحذف بنجاح', 'success');
    } catch (err) {
      showToast('فشل الحذف', 'error');
    }
  };

  const renderTimetable = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {DAYS.map((dayName, dayIndex) => {
          const dayEvents = events.filter(e => e.recurringDays?.includes(dayIndex)).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
          return (
            <div key={dayIndex} className="card-base p-4 min-h-[200px]">
              <h3 className="text-center font-bold text-gold border-b border-white/10 pb-2 mb-4">{dayName}</h3>
              <div className="space-y-3">
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">لا يوجد حصص</p>
                ) : (
                  dayEvents.map(ev => (
                    <div key={ev.id} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:border-gold/30 transition-all group relative">
                      <div className="font-bold text-sm mb-1">{ev.title}</div>
                      <div className="flex items-center gap-1 text-xs text-text-muted mb-2">
                        <Clock size={12} />
                        <span>{ev.startTime} - {ev.endTime}</span>
                      </div>
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 left-2">
                        <button onClick={() => handleDelete(ev.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-cairo gold-text mb-1 flex items-center gap-2">
            <CalendarIcon size={24} /> جدول الحصص الأسبوعي
          </h1>
          <p className="text-sm text-text-muted">نظم أوقات حصصك الثابتة لتظهر للطلاب في حساباتهم</p>
        </div>
        <button onClick={() => { setForm({ type: 'fixed_class', startTime: '08:00', endTime: '10:00', recurringDays: [0], isRecurring: true }); setShowModal(true); }} className="btn-gold">
          <Plus size={18} /> إضافة حصة للجدول
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        renderTimetable()
      )}

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content modal-content-sm">
            <div className="modal-header">
              <h3 className="font-bold">إضافة حصة للجدول الأسبوعي</h3>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">عنوان الحصة (مثال: مراجعة الصف الأول)</label>
                <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="input-base w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">من الساعة</label>
                  <input type="time" value={form.startTime || ''} onChange={e => setForm({ ...form, startTime: e.target.value })} className="input-base w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">إلى الساعة</label>
                  <input type="time" value={form.endTime || ''} onChange={e => setForm({ ...form, endTime: e.target.value })} className="input-base w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">أيام تكرار الحصة</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => (
                    <label key={i} className={`px-3 py-1.5 border rounded-lg cursor-pointer text-sm transition-all ${form.recurringDays?.includes(i) ? 'bg-gold/20 border-gold text-gold' : 'bg-white/5 border-white/10'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={form.recurringDays?.includes(i) || false}
                        onChange={(e) => {
                          const current = form.recurringDays || [];
                          if (e.target.checked) setForm({ ...form, recurringDays: [...current, i] });
                          else setForm({ ...form, recurringDays: current.filter(day => day !== i) });
                        }}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">المجموعة (اختياري)</label>
                <select value={form.referenceId || ''} onChange={e => setForm({ ...form, referenceId: e.target.value })} className="input-base w-full">
                  <option value="">عام (لكل الطلاب)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSave} className="btn-gold flex-1 justify-center">حفظ الحصة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
