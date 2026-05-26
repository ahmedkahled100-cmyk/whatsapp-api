'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { isAdminDirectedNotification } from '@/lib/notification-audience';
import { getNotificationLogs, saveNotificationLog, updateNotificationLog, dispatchNotification, subscribeToNotificationLogs, markNotificationRead } from '@/lib/db';
import type { NotificationLog } from '@/types';
import { showToast } from '@/lib/toast';
import { Send, AlertCircle, CheckCircle2, Search, RefreshCw, MessageSquare, Clock, Filter, Users, ShieldAlert, RotateCcw, Bell } from 'lucide-react';
import { formatDateAr, getApiBase } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function NotificationsAdmin() {
  const router = useRouter();
  const { students, groups, user, notifications } = useTeacherStore();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'logs'>('inbox');
  const [inboxTab, setInboxTab] = useState<'teacher' | 'admin'>('teacher');


  // Compose State
  const [msg, setMsg] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'group' | 'student' | 'assistant'>('all');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [channels, setChannels] = useState({ inApp: true, whatsapp: false });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToNotificationLogs(user.id, (data: any) => {
      setLogs(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const loadLogs = () => {
    // Handled by subscription now
  };


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) { showToast('الرجاء كتابة نص الإشعار'); return; }
    if (!channels.inApp && !channels.whatsapp) { showToast('الرجاء اختيار وسيلة إرسال واحدة على الأقل'); return; }
    if (targetType === 'group' && !selectedGroup) { showToast('الرجاء اختيار المجموعة'); return; }
    if (targetType === 'student' && !selectedStudent) { showToast('الرجاء اختيار الطالب'); return; }

    setSending(true);
    if (!user) return;
    try {
      let targetUsers: string[] = [];
      let whatsappNumbers: string[] = [];
      let summaryText = 'الكل';

      if (targetType === 'student') {
        const s = students.find(x => x.id === selectedStudent);
        if (s) {
          targetUsers = [s.id];
          if (s.phone) whatsappNumbers.push(s.phone);
          summaryText = s.name;
        }
      } else if (targetType === 'group') {
        const groupStudents = students.filter(s => s.groupIds?.includes(selectedGroup));
        targetUsers = groupStudents.map(s => s.id);
        whatsappNumbers = groupStudents.filter(s => s.phone).map(s => s.phone as string);
        summaryText = groups.find(g => g.id === selectedGroup)?.name || 'مجموعة';
      } else if (targetType === 'assistant') {
        // target all assistants
        targetUsers = []; // empty means global for in-app
        summaryText = 'جميع المساعدين';
      } else {
        // all
        targetUsers = []; // empty means global for in-app
        whatsappNumbers = students.filter(s => s.phone).map(s => s.phone as string);
      }

      await dispatchNotification({
        teacherId: user.id,
        msg,
        targetRoles: targetType === 'all' ? ['student'] : targetType === 'assistant' ? ['assistant'] : [], // if all, target all students
        targetUsers: targetUsers.length > 0 ? targetUsers : undefined,
        channels: { inApp: channels.inApp, whatsapp: channels.whatsapp },
        whatsappNumbers: channels.whatsapp ? whatsappNumbers : []
      });

      showToast(`تم بدء الإرسال إلى ${summaryText}`);
      setMsg('');
      setActiveTab('logs');
      // Adding a small delay to let backend process pending logs
      // Handled by subscription

    } catch (e: any) {
      console.error(e);
      showToast('حدث خطأ أثناء الإرسال');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (log: NotificationLog) => {
    if (!log.target || log.type !== 'whatsapp') return;
    
    // Optimistic UI update
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

  const displayedNotifications = notifications.filter(n => {
    const isAdminNotif = isAdminDirectedNotification(n);
    return inboxTab === 'admin' ? isAdminNotif : !isAdminNotif;
  });

  const unreadTeacher = useMemo(
    () => notifications.filter(n => !n.read && !isAdminDirectedNotification(n)).length,
    [notifications]
  );
  const unreadAdmin = useMemo(
    () => notifications.filter(n => !n.read && isAdminDirectedNotification(n)).length,
    [notifications]
  );
  const unreadInboxTotal = unreadTeacher + unreadAdmin;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-3">
          <MessageSquare className="text-gold" size={28} />
          <span>مركز الإشعارات والتنبيهات</span>
        </h1>
        <div className="flex bg-white/5 rounded-xl p-1">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'inbox' ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'}`}
          >
            الوارد
            {unreadInboxTotal > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs tabular-nums">
                {unreadInboxTotal}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'compose' ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'}`}
          >
            إرسال جديد
          </button>
          <button 
            onClick={() => { setActiveTab('logs'); loadLogs(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'}`}
          >
            سجل العمليات
          </button>
        </div>
      </div>

      {activeTab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 card-base p-6">
            <h2 className="text-lg font-bold mb-6 border-b border-white/10 pb-4">إرسال إشعار يدوي</h2>
            <form onSubmit={handleSend} className="space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-300">نص الإشعار</label>
                <textarea 
                  className="input-base w-full h-32 resize-none"
                  placeholder="اكتب رسالتك هنا..."
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-300">الاستهداف (إلى من؟)</label>
                  <select 
                    className="input-base w-full"
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                  >
                    <option value="all">جميع الطلاب مسجلون</option>
                    <option value="assistant">جميع المساعدين</option>
                    <option value="group">مجموعة محددة (طلاب)</option>
                    <option value="student">طالب محدد</option>
                  </select>

                  {targetType === 'group' && (
                    <select className="input-base w-full mt-2" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} required>
                      <option value="">-- اختر المجموعة --</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}

                  {targetType === 'student' && (
                    <select className="input-base w-full mt-2" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} required>
                      <option value="">-- اختر الطالب --</option>
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
                        defaultChecked={true}
                        checked={channels.inApp}
                        onChange={e => setChannels({ ...channels, inApp: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 focus:ring-gold focus:ring-opacity-50" 
                      />
                      <span className="flex items-center gap-2"><Bell size={16} className="text-gold"/> إشعار داخل التطبيق</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer mt-4">
                      <input 
                        type="checkbox" 
                        checked={channels.whatsapp}
                        onChange={e => setChannels({ ...channels, whatsapp: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 focus:ring-green-500 focus:ring-opacity-50" 
                      />
                      <span className="flex items-center gap-2"><MessageSquare size={16} className="text-green-500"/> رسالة واتساب (يتطلب اشتراك API)</span>
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
                  {sending ? 'جاري الإرسال...' : <><Send size={20} className="mr-2"/> إرسال الآن</>}
                </button>
              </div>
            </form>
          </div>

          <div className="card-base p-6 border-blue-500/20 bg-blue-500/5 h-fit">
            <h3 className="font-bold flex items-center gap-2 text-blue-400 mb-4">
              <ShieldAlert size={20} />
              ملاحظات هامة
            </h3>
            <ul className="space-y-3 text-sm text-gray-300 list-disc list-inside">
              <li>الإشعارات داخل التطبيق فورية وتظهر للجرس الخاص بالطالب عند تسجيل دخوله.</li>
              <li>إرسال رسائل الواتساب يتطلب تفعيل وتسجيل أرقام مقبولة في Meta if in Dev mode، أو رصيد كافٍ وAPI Key مفعل in Live mode.</li>
              <li>يرجى التأكد من اختيار الجمهور الصحيح قبل الضغط على إرسال حيث لا يمكن التراجع.</li>
            </ul>
          </div>
        </div>
      ) : activeTab === 'inbox' ? (
        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold">الإشعارات الواردة</h2>
            <div className="flex bg-white/5 rounded-lg p-1">
              <button 
                type="button"
                onClick={() => setInboxTab('teacher')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all inline-flex items-center gap-1 ${inboxTab === 'teacher' ? 'bg-gold text-dark' : 'text-gray-400'}`}
              >
                إشعارات المعلم
                {unreadTeacher > 0 && (
                  <span className={`rounded-full px-1.5 text-[9px] font-black ${inboxTab === 'teacher' ? 'bg-black/20 text-dark' : 'bg-red-500 text-white'}`}>{unreadTeacher}</span>
                )}
              </button>
              <button 
                type="button"
                onClick={() => setInboxTab('admin')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all inline-flex items-center gap-1 ${inboxTab === 'admin' ? 'bg-gold text-dark' : 'text-gray-400'}`}
              >
                إشعارات الإدارة
                {unreadAdmin > 0 && (
                  <span className={`rounded-full px-1.5 text-[9px] font-black ${inboxTab === 'admin' ? 'bg-black/20 text-dark' : 'bg-red-500 text-white'}`}>{unreadAdmin}</span>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {displayedNotifications.length === 0 ? (
              <div className="text-center p-12 text-gray-500 flex flex-col items-center justify-center h-full gap-3">
                <Bell size={48} className="text-white/5" />
                <p className="font-bold">لا توجد إشعارات {inboxTab === 'admin' ? 'إدارية' : 'تعليمية'} حالياً</p>
              </div>
            ) : displayedNotifications.map(n => (
              <div 
                key={n.id} 
                onClick={async () => {
                  if (!n.read) {
                    try {
                      await markNotificationRead(n.id);
                    } catch (e) {
                      console.error('Failed to mark read:', e);
                    }
                  }
                  if (n.actionPath) {
                    router.push(n.actionPath);
                  }
                }}
                className={`p-4 rounded-xl border relative overflow-hidden transition-all ${
                  n.actionPath || !n.read ? 'cursor-pointer hover:border-gold/50' : ''
                } ${
                  n.read
                    ? 'border-white/5 bg-white/5 opacity-70'
                    : 'border-gold/20 bg-gradient-to-br from-gold/10 to-transparent shadow-md'
                }`}>
                {n.type === 'error' && <div className="absolute top-0 right-0 w-1 h-full bg-red-500 rounded-l" />}
                {n.type === 'success' && <div className="absolute top-0 right-0 w-1 h-full bg-green-500 rounded-l" />}
                {n.type === 'warning' && <div className="absolute top-0 right-0 w-1 h-full bg-yellow-500 rounded-l" />}
                {n.type === 'info' && <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-l" />}
                
                <p className="text-sm font-bold text-white mb-2 pr-3">{n.msg}</p>
                
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {n.time || formatDateAr(n.createdAt)}
                  </span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_6px_rgba(245,197,24,0.8)] animate-pulse" />}
                </div>
              </div>
            ))}
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
