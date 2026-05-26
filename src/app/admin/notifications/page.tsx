'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getNotificationLogs, saveNotificationLog, updateNotificationLog, dispatchNotification, subscribeToNotificationLogs, markNotificationRead, getTeachers } from '@/lib/db';
import type { NotificationLog, TeacherUser } from '@/types';
import { showToast } from '@/lib/toast';
import { Send, AlertCircle, CheckCircle2, Search, RefreshCw, MessageSquare, Clock, Filter, Users, ShieldAlert, RotateCcw, Bell } from 'lucide-react';
import { formatDateAr, getApiBase } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function NotificationsSuperAdmin() {
  const router = useRouter();
  const { user, adminNotifications } = useTeacherStore();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compose' | 'logs'>('compose');

  // Compose State
  const [msg, setMsg] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'teacher'>('all');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [channels, setChannels] = useState({ inApp: true, whatsapp: false });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Load teachers
    getTeachers().then(data => {
      setTeachers(data.filter(t => t.role !== 'super_admin'));
    });

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
    if (targetType === 'teacher' && !selectedTeacher) { showToast('الرجاء اختيار المعلم'); return; }

    setSending(true);
    if (!user) return;
    try {
      let targetUsers: string[] = [];
      let whatsappNumbers: string[] = [];
      let summaryText = 'الكل';

      if (targetType === 'teacher') {
        const t = teachers.find(x => x.id === selectedTeacher);
        if (t) {
          targetUsers = [t.id];
          if (t.phone || t.username) whatsappNumbers.push((t.phone || t.username) as string);
          summaryText = t.name;
        }
      } else {
        // all teachers
        targetUsers = []; // empty means global for in-app based on targetRoles
        whatsappNumbers = teachers.map(t => (t.phone || t.username) as string).filter(Boolean);
        summaryText = 'جميع المعلمين';
      }

      await dispatchNotification({
        teacherId: user.id, // Admi id acting as sender
        msg,
        targetRoles: targetType === 'all' ? ['teacher'] : [], // if all, target all teachers
        targetUsers: targetUsers.length > 0 ? targetUsers : undefined,
        channels: { inApp: channels.inApp, whatsapp: channels.whatsapp },
        whatsappNumbers: channels.whatsapp ? whatsappNumbers : []
      });

      showToast(`تم بدء الإرسال إلى ${summaryText}`);
      setMsg('');
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
            <h2 className="text-lg font-bold mb-6 border-b border-white/10 pb-4">إرسال إشعار إداري للمعلمين</h2>
            <form onSubmit={handleSend} className="space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-300">نص الإشعار</label>
                <textarea 
                  className="input-base w-full h-32 resize-none"
                  placeholder="اكتب رسالة الإشعار هنا..."
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
                    <option value="all">جميع المعلمين</option>
                    <option value="teacher">معلم محدد</option>
                  </select>

                  {targetType === 'teacher' && (
                    <select className="input-base w-full mt-2" value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} required>
                      <option value="">-- اختر المعلم --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} - {t.username}</option>
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
                  {sending ? 'جاري الإرسال...' : <><Send size={20} className="mr-2"/> إرسال للإدارة</>}
                </button>
              </div>
            </form>
          </div>

          <div className="card-base p-6 border-blue-500/20 bg-blue-500/5 h-fit">
            <h3 className="font-bold flex items-center gap-2 text-blue-400 mb-4">
              <ShieldAlert size={20} />
              ملاحظات إدارية هامة
            </h3>
            <ul className="space-y-3 text-sm text-gray-300 list-disc list-inside">
              <li>الإشعارات الإدارية تظهر للمعلمين فوراً في لوحة التحكم وتُميز عن إشعارات النظام.</li>
              <li>يرجى التأكد من اختيار المعلم الصحيح قبل الضغط على إرسال.</li>
            </ul>
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
