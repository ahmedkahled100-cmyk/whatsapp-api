'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getNotificationLogs, saveNotificationLog, updateNotificationLog, dispatchNotification, subscribeToNotificationLogs, markNotificationRead, getTeachers, getAllStudents } from '@/lib/db';
import type { NotificationLog, TeacherUser, Student } from '@/types';
import { showToast } from '@/lib/toast';
import { Send, AlertCircle, CheckCircle2, Search, RefreshCw, MessageSquare, Clock, Filter, Users, ShieldAlert, RotateCcw, Bell, Loader2 } from 'lucide-react';
import { formatDateAr, getApiBase } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function NotificationsSuperAdmin() {
  const router = useRouter();
  const { user, adminNotifications } = useTeacherStore();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compose' | 'logs'>('compose');

  // Compose State
  const [msg, setMsg] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'teacher' | 'all_students' | 'student'>('all');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [channels, setChannels] = useState({ inApp: true, whatsapp: false });
  const [sending, setSending] = useState(false);
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const templates = [
    { label: '-- اختر قالباً جاهزاً --', value: '' },
    { label: '⚠️ تنبيه صيانة المنصة', value: 'تنبيه إداري: يرجى العلم بأنه سيتم إجراء أعمال صيانة دورية للمنصة وتحديث للخوادم يوم [اليوم] القادم في تمام الساعة [الوقت] صباحاً. قد يتوقف الوصول للمنصة لمدة [المدة] دقائق. شكراً لتفهمكم.' },
    { label: '✨ إطلاق ميزات وتحديثات جديدة', value: 'نود إعلامكم بأنه تم إطلاق تحديث جديد للمنصة يحتوي على مميزات وأدوات جديدة لتحسين وإثراء تجربتكم التعليمية وإدارة شؤون طلابكم. للاستفسارات يرجى مراسلة الدعم الفني.' },
    { label: '💳 تذكير بتجديد الاشتراك', value: 'تذكير إداري: نود تذكيركم بقرب نهاية اشتراككم الحالي في المنصة، يرجى تسوية الحساب والتجديد لضمان استمرار عمل لوحة التحكم الخاصة بكم وبوابة الطلاب دون توقف.' },
    { label: '📢 تنبيه إداري عاجل وهام', value: 'تنبيه هام وعاجل من إدارة المنصة: يرجى العلم بأنه...' }
  ];

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Load teachers and students
    getTeachers().then(data => {
      setTeachers(data.filter(t => t.role !== 'super_admin'));
    });
    getAllStudents().then(data => setStudents(data));

    const unsub = subscribeToNotificationLogs(user.id, (data: any) => {
      setLogs(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const loadLogs = () => {
    if (user) {
      getNotificationLogs(user.id).then(setLogs).catch(console.error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) { showToast('الرجاء كتابة نص الإشعار'); return; }
    if (!channels.inApp && !channels.whatsapp) { showToast('الرجاء اختيار وسيلة إرسال واحدة على الأقل'); return; }
    if (targetType === 'teacher' && selectedTeachers.length === 0) { showToast('الرجاء اختيار المعلمين المستهدفين'); return; }
    if (targetType === 'student' && selectedStudents.length === 0) { showToast('الرجاء اختيار الطلاب المستهدفين'); return; }

    setSending(true);
    if (!user) return;
    try {
      let targetUsers: string[] = [];
      let whatsappNumbers: string[] = [];
      let summaryText = 'الكل';

      if (targetType === 'teacher') {
        const selected = teachers.filter(x => selectedTeachers.includes(x.id));
        if (selected.length > 0) {
          targetUsers = selected.map(t => t.id);
          selected.forEach(t => {
            if (t.phone || t.username) whatsappNumbers.push((t.phone || t.username) as string);
          });
          summaryText = selected.length === 1 ? selected[0].name : `${selected.length} معلمين`;
        }
      } else if (targetType === 'all') {
        targetUsers = [];
        whatsappNumbers = teachers.map(t => (t.phone || t.username) as string).filter(Boolean);
        summaryText = 'جميع المعلمين';
      } else if (targetType === 'student') {
        const selected = students.filter(x => selectedStudents.includes(x.id));
        if (selected.length > 0) {
          targetUsers = selected.map(s => s.id);
          selected.forEach(s => {
            if (s.phone) whatsappNumbers.push(s.phone as string);
          });
          summaryText = selected.length === 1 ? selected[0].name : `${selected.length} طلاب`;
        }
      } else if (targetType === 'all_students') {
        targetUsers = [];
        whatsappNumbers = students.map(s => s.phone as string).filter(Boolean);
        summaryText = 'جميع الطلاب بالمنصة';
      }

      await dispatchNotification({
        teacherId: user.id,
        msg,
        type: notifType,
        targetRoles: (targetType === 'all' || targetType === 'teacher') ? ['teacher'] : ['student'],
        targetUsers: targetUsers.length > 0 ? targetUsers : undefined,
        channels: { inApp: channels.inApp, whatsapp: channels.whatsapp },
        whatsappNumbers: channels.whatsapp ? whatsappNumbers : []
      });

      showToast(`تم بدء الإرسال إلى ${summaryText}`);
      setMsg('');
      setNotifType('info');
      setActiveTab('logs');
    } catch (e: any) {
      console.error(e);
      showToast('حدث خطأ أثناء الإرسال');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (log: NotificationLog) => {
    if (!log.target || log.type !== 'whatsapp') return;
    setLogs(logs.map(l => l.id === log.id ? { ...l, status: 'pending' } : l));
    
    try {
      const res = await fetch(`${getApiBase()}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: log.target, message: log.message })
      });
      
      const result = await res.json();
      if (result.success) {
        await updateNotificationLog(log.id!, { status: 'sent', error: undefined });
        setLogs(logs.map(l => l.id === log.id ? { ...l, status: 'sent', error: undefined } : l));
        showToast('تمت إعادة الإرسال بنجاح');
      } else {
        await updateNotificationLog(log.id!, { status: 'failed', error: result.error });
        setLogs(logs.map(l => l.id === log.id ? { ...l, status: 'failed', error: result.error } : l));
        showToast('فشلت إعادة الإرسال');
      }
    } catch (e: any) {
      setLogs(logs.map(l => l.id === log.id ? { ...l, status: 'failed', error: 'استثناء الشبكة' } : l));
      showToast('حدث خطأ أثناء إعادة المحاولة');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-3">
          <MessageSquare className="text-gold" size={28} />
          <span>الإشعارات الإدارية (للمعلمين)</span>
        </h1>
        <div className="flex bg-white/5 rounded-xl p-1">
          <button 
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'compose' ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'}`}
          >
            إرسال إشعار
          </button>
          <button 
            onClick={() => { setActiveTab('logs'); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'}`}
          >
            سجل العمليات
          </button>
        </div>
      </div>

      {activeTab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 card-base p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold">إرسال إشعار إداري للمعلمين</h2>
              <select 
                className="input-base text-xs max-w-xs"
                onChange={e => {
                  if (e.target.value) setMsg(e.target.value);
                }}
              >
                {templates.map((t, idx) => (
                  <option key={idx} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            
            <form onSubmit={handleSend} className="space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-300">نص الإشعار</label>
                <textarea 
                  className="input-base w-full h-32 resize-none"
                  placeholder="اكتب رسالة الإشعار هنا أو اختر قالباً جاهزاً من الأعلى..."
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-300">نوع التنبيه (لإشعار التطبيق)</label>
                  <select 
                    className="input-base w-full"
                    value={notifType}
                    onChange={(e: any) => setNotifType(e.target.value)}
                  >
                    <option value="info">إرشاد (أزرق)</option>
                    <option value="success">موافقة/نجاح (أخضر)</option>
                    <option value="warning">تحذير (أصفر)</option>
                    <option value="error">تنبيه عاجل/خطر (أحمر)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-300">الاستهداف (إلى من؟)</label>
                  <select 
                    className="input-base w-full"
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                  >
                    <option value="all">جميع المعلمين</option>
                    <option value="teacher">معلمين محددين</option>
                    <option value="all_students">جميع طلاب المنصة</option>
                    <option value="student">طلاب محددين</option>
                  </select>

                  {targetType === 'teacher' && (
                    <select 
                      multiple 
                      className="input-base w-full mt-2 h-32 scrollbar-thin" 
                      value={selectedTeachers} 
                      onChange={e => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setSelectedTeachers(values);
                      }} 
                      required
                    >
                      <option value="" disabled>-- اختر المعلم (يمكنك تحديد أكثر من واحد) --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} - {t.phone || t.username}</option>
                      ))}
                    </select>
                  )}

                  {targetType === 'student' && (
                    <select 
                      multiple 
                      className="input-base w-full mt-2 h-32 scrollbar-thin" 
                      value={selectedStudents} 
                      onChange={e => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setSelectedStudents(values);
                      }} 
                      required
                    >
                      <option value="" disabled>-- اختر الطالب (يمكنك تحديد أكثر من واحد) --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.name} - {s.phone}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-300">قنوات الإرسال</label>
                  <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={channels.inApp}
                        onChange={e => setChannels({ ...channels, inApp: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 focus:ring-gold focus:ring-opacity-50 text-gold bg-dark" 
                      />
                      <span className="flex items-center gap-2 text-xs"><Bell size={14} className="text-gold"/> إشعار داخل التطبيق</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer mt-4">
                      <input 
                        type="checkbox" 
                        checked={channels.whatsapp}
                        onChange={e => setChannels({ ...channels, whatsapp: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 focus:ring-green-500 focus:ring-opacity-50 text-green-500 bg-dark" 
                      />
                      <span className="flex items-center gap-2 text-xs"><MessageSquare size={14} className="text-green-500"/> رسالة واتساب</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button 
                  type="submit" 
                  disabled={sending || (!channels.inApp && !channels.whatsapp)}
                  className="btn-gold w-full flex justify-center py-3 text-lg"
                >
                  {sending ? <Loader2 className="animate-spin text-dark mr-2" size={20} /> : <><Send size={20} className="mr-2"/> إرسال للإدارة</>}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="card-base p-6 border-purple-500/20 bg-purple-500/5">
              <h3 className="font-bold flex items-center gap-2 text-purple-400 mb-4 text-sm">
                <Bell size={16} />
                معاينة الإشعار الفورية (المتلقي)
              </h3>
              <div className="border border-white/10 bg-black/40 rounded-xl p-4 relative overflow-hidden transition-all shadow-glow min-h-24">
                {notifType === 'error' && <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />}
                {notifType === 'success' && <div className="absolute top-0 right-0 w-1 h-full bg-green-500" />}
                {notifType === 'warning' && <div className="absolute top-0 right-0 w-1 h-full bg-yellow-500" />}
                {notifType === 'info' && <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />}
                
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {notifType === 'error' && <AlertCircle size={16} className="text-red-400" />}
                    {notifType === 'success' && <CheckCircle2 size={16} className="text-green-400" />}
                    {notifType === 'warning' && <AlertCircle size={16} className="text-yellow-400" />}
                    {notifType === 'info' && <AlertCircle size={16} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words">
                      {msg.trim() || 'اكتب رسالة لرؤية المعاينة هنا...'}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-[8px] text-gray-500">
                      <Clock size={8} />
                      {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-base p-6 border-blue-500/20 bg-blue-500/5 text-xs">
              <h3 className="font-bold flex items-center gap-2 text-blue-400 mb-4">
                <ShieldAlert size={20} />
                ملاحظات إدارية هامة
              </h3>
              <ul className="space-y-3 text-gray-300 list-disc list-inside leading-relaxed">
                <li>الإشعارات الإدارية تظهر للمعلمين فوراً في لوحة التحكم وتُميز عن إشعارات النظام.</li>
                <li>توزيع الإشعار على الواتساب يتم في الخلفية بشكل متزامن دون التسبب في بطء استجابة الصفحة.</li>
              </ul>
            </div>
          </div>
        </div>

      ) : (
        <div className="card-base p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold">سجل الإرسال الحديث</h2>
            <button onClick={loadLogs} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="تحديث السجل">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-gray-400 border-b border-white/10 bg-white/5">
                <tr>
                  <th className="p-4 font-bold rounded-tr-xl">النوع</th>
                  <th className="p-4 font-bold">المستهدف</th>
                  <th className="p-4 font-bold">الرسالة</th>
                  <th className="p-4 font-bold">التاريخ</th>
                  <th className="p-4 font-bold">الحالة</th>
                  <th className="p-4 font-bold text-center rounded-tl-xl">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">لا يوجد سجل إشعارات بعد</td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      {log.type === 'whatsapp' ? (
                        <span className="flex items-center gap-1.5 text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded-lg w-fit">
                          <MessageSquare size={14} /> WhatsApp
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gold font-bold bg-gold/10 px-2 py-1 rounded-lg w-fit">
                          <Bell size={14} /> In-App
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs" dir="ltr">{log.target || 'N/A'}</td>
                    <td className="p-4 w-1/3 truncate max-w-[200px]" title={log.message}>{log.message}</td>
                    <td className="p-4 text-xs text-gray-400">{formatDateAr(log.createdAt)}</td>
                    <td className="p-4">
                      {log.status === 'sent' && <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={16}/> نجح</span>}
                      {log.status === 'failed' && <span className="text-red-500 flex items-center gap-1" title={log.error}><AlertCircle size={16}/> فشل</span>}
                      {log.status === 'pending' && <span className="text-yellow-500 flex items-center gap-1"><Clock size={16}/> جاري</span>}
                    </td>
                    <td className="p-4 text-center">
                      {(log.status === 'failed' || log.status === 'pending') && log.type === 'whatsapp' && (
                        <button 
                          onClick={() => handleRetry(log)} 
                          className="btn-outline border-white/10 text-xs px-3 py-1.5 text-gray-400 hover:text-white hover:border-gold inline-flex items-center gap-1"
                        >
                          <RotateCcw size={12} /> إعادة محاولة
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
