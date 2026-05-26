'use client';
import { useState, useEffect, useRef } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getAttendanceSessions, createAttendanceSession, updateAttendanceSessionStatus, getAttendanceRecords, saveAttendanceRecord } from '@/lib/db';
import { AttendanceSession, AttendanceRecord, Student } from '@/types';
import { PlusCircle, Search, QrCode, CheckCircle, XCircle, Clock, Save, ChevronRight, User, FileSpreadsheet, Printer, X } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { printHtml, openStudentCardForPrint } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export default function AttendancePage() {
  const user = useTeacherStore(state => state.user);
  const students = useTeacherStore(state => state.students);
  const groups = useTeacherStore(state => state.groups);
  
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  
  const [loading, setLoading] = useState(true);
  const [qrInput, setQrInput] = useState('');
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedStudentForQr, setSelectedStudentForQr] = useState<Student | null>(null);

  // New session modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionGroupId, setNewSessionGroupId] = useState('');

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getAttendanceSessions(user.id);
      setSessions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const newSession: Omit<AttendanceSession, 'id'> = {
        teacherId: user.id,
        title: newSessionTitle || undefined,
        groupId: newSessionGroupId || undefined,
        date: new Date().toISOString().split('T')[0],
        status: 'open',
        createdAt: Date.now()
      };
      const id = await createAttendanceSession(newSession);
      const fullSession = { ...newSession, id } as AttendanceSession;
      setSessions([fullSession, ...sessions]);
      setActiveSession(fullSession);
      setRecords({});
      setShowCreateModal(false);
      setNewSessionTitle('');
      setNewSessionGroupId('');
      showToast('تم بدء جلسة الحضور بنجاح', 'success');
    } catch (err) {
      showToast('خطأ في إنشاء الجلسة', 'error');
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    try {
      await updateAttendanceSessionStatus(activeSession.id, 'closed');
      const updated = { ...activeSession, status: 'closed' as const };
      setActiveSession(updated);
      setSessions(sessions.map(s => s.id === updated.id ? updated : s));
      showToast('تم إغلاق الجلسة بنجاح', 'success');
    } catch (err) {
      showToast('خطأ في إغلاق الجلسة', 'error');
    }
  };

  const loadSessionRecords = async (session: AttendanceSession) => {
    setActiveSession(session);
    setLoading(true);
    try {
      const data = await getAttendanceRecords(session.id);
      const recMap: Record<string, AttendanceRecord> = {};
      data.forEach(r => recMap[r.studentId] = r);
      setRecords(recMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    if (!activeSession || !user) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const newRecord: Omit<AttendanceRecord, 'id'> = {
      teacherId: user.id,
      sessionId: activeSession.id,
      studentId: student.id,
      studentName: student.name,
      status,
      time: new Date().toISOString()
    };

    try {
      // Optimistic update
      setRecords(prev => ({ ...prev, [studentId]: { ...newRecord, id: 'temp' } as AttendanceRecord }));
      const id = await saveAttendanceRecord(newRecord);
      setRecords(prev => ({ ...prev, [studentId]: { ...newRecord, id } as AttendanceRecord }));
    } catch (err) {
      showToast('فشل في حفظ الحضور', 'error');
    }
  };

  const handleQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !qrInput.trim()) return;
    
    const code = qrInput.trim().toUpperCase();
    const student = students.find(s => s.code === code || s.qrCodeId === code);
    
    if (student) {
      if (activeSession.groupId && (!student.groupIds || !student.groupIds.includes(activeSession.groupId))) {
        showToast(`تنبيه: الطالب (${student.name}) لا ينتمي للمجموعة المحددة لهذه الجلسة!`, 'warning');
      } else {
        showToast(`تم تحضير: ${student.name}`, 'success');
      }
      handleMarkAttendance(student.id, 'present');
    } else {
      showToast('لم يتم العثور على الطالب بهذا الكود', 'error');
    }
    setQrInput('');
    qrInputRef.current?.focus();
  };

  const handleExportCSV = () => {
    if (!activeSession) return;
    const headers = ['اسم الطالب', 'الكود', 'حالة الحضور', 'وقت التسجيل'];
    const rows = students.map(s => {
      const record = records[s.id];
      const statusText = record?.status === 'present' ? 'حاضر' : record?.status === 'late' ? 'متأخر' : record?.status === 'absent' ? 'غائب' : 'لم يسجل';
      const timeText = record?.time ? new Date(record.time).toLocaleTimeString('ar-EG') : '-';
      return `"${s.name}","${s.code}","${statusText}","${timeText}"`;
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `attendance_${activeSession.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!activeSession) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-cairo gold-text mb-1">إدارة الحضور والغياب</h1>
            <p className="text-sm text-text-muted">نظام متكامل لتتبع حضور الطلاب عبر QR Code</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-gold">
            <PlusCircle size={18} />
            بدء جلسة حضور جديدة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(session => (
            <div key={session.id} onClick={() => loadSessionRecords(session)} className="card-base p-5 cursor-pointer hover-premium group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                  <Clock size={20} />
                </div>
                <span className={`badge ${session.status === 'open' ? 'badge-green' : 'badge-red'}`}>
                  {session.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1">{session.title || session.date}</h3>
              <p className="text-sm font-bold text-gold/80 mb-2">{session.groupId ? groups.find(g => g.id === session.groupId)?.name : 'كل المجموعات'}</p>
              <p className="text-xs text-text-muted">اضغط لعرض أو تعديل الحضور</p>
            </div>
          ))}
          {sessions.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-gray-500">لا توجد جلسات سابقة</div>
          )}
        </div>

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
            <div className="modal-content max-w-md">
              <div className="modal-header">
                <h3 className="font-bold text-lg gold-text flex items-center gap-2">
                  <PlusCircle size={20} /> بدء جلسة جديدة
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateSession} className="modal-body space-y-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-300">اسم الجلسة (اختياري)</label>
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={e => setNewSessionTitle(e.target.value)}
                    placeholder="مثال: حصة المراجعة النهائية"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-300">المجموعة (اختياري)</label>
                  <select
                    value={newSessionGroupId}
                    onChange={e => setNewSessionGroupId(e.target.value)}
                    className="input-base"
                  >
                    <option value="">-- كل المجموعات --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-gold flex-1">بدء الجلسة</button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-outline flex-1">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveSession(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all">
          <ChevronRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black font-cairo gold-text mb-1">
            {activeSession.title || 'جلسة الحضور'} ({activeSession.date})
          </h1>
          <p className="text-sm font-bold text-white/70 mb-1">المجموعة: {activeSession.groupId ? groups.find(g => g.id === activeSession.groupId)?.name : 'كل المجموعات'}</p>
          <p className="text-sm text-text-muted">قم بتحضير الطلاب يدوياً أو باستخدام جهاز الباركود</p>
        </div>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={handleExportCSV} className="btn-outline flex items-center gap-2">
          <FileSpreadsheet size={16} /> تصدير Excel
        </button>
        <button 
          onClick={() => {
            const sessionGroupName = activeSession.groupId
              ? groups.find(g => g.id === activeSession.groupId)?.name || 'كل المجموعات'
              : 'كل المجموعات';
            const sessionLabel = activeSession.title || activeSession.date;
            const rows = students.map(s => {
              const record = records[s.id];
              const statusText = record?.status === 'present' ? 'حاضر ✅' : record?.status === 'late' ? 'متأخر 🕐' : record?.status === 'absent' ? 'غائب ❌' : '--- ⬜';
              const timeText = record?.time ? new Date(record.time).toLocaleTimeString('ar-EG') : '-';
              const groupName = groups.find(g => s.groupIds?.includes(g.id))?.name || 'غير محدد';
              return `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:8px 12px;font-weight:bold">${s.name}</td>
                <td style="padding:8px 12px;font-family:monospace;color:#4b5563;font-size:12px">${s.code.replace(/-T[A-Z0-9]+$/i,'')}</td>
                <td style="padding:8px 12px;color:#6b7280;font-size:13px">${groupName}</td>
                <td style="padding:8px 12px;font-weight:bold">${statusText}</td>
                <td style="padding:8px 12px;color:#9ca3af;font-size:12px">${timeText}</td>
              </tr>`;
            }).join('');
            const presentCount = Object.values(records).filter(r => r.status === 'present').length;
            const lateCount = Object.values(records).filter(r => r.status === 'late').length;
            const absentCount = Object.values(records).filter(r => r.status === 'absent').length;
            const html = `
              <html dir="rtl">
              <head>
                <meta charset="utf-8">
                <title>تقرير الحضور - ${sessionLabel}</title>
                <style>
                  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
                  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                  body { font-family:'Cairo',Arial,sans-serif; direction:rtl; padding:20px; background:#fff; color:#111; }
                  @page { margin:15mm; }
                  .header { background:linear-gradient(135deg,#1a1a2e,#0f3460); color:#fbbf24; padding:20px; border-radius:12px; margin-bottom:20px; }
                  .header h1 { font-size:22px; font-weight:900; }
                  .header p { font-size:13px; opacity:0.8; margin-top:4px; }
                  .stats { display:flex; gap:12px; margin-bottom:20px; }
                  .stat { flex:1; padding:12px; border-radius:10px; text-align:center; font-weight:bold; }
                  .stat-green { background:#dcfce7; color:#166534; }
                  .stat-yellow { background:#fef9c3; color:#854d0e; }
                  .stat-red { background:#fee2e2; color:#991b1b; }
                  .stat-num { font-size:24px; font-weight:900; display:block; }
                  table { width:100%; border-collapse:collapse; font-size:13px; }
                  thead { background:#f3f4f6; }
                  th { padding:10px 12px; text-align:right; font-weight:700; color:#374151; border-bottom:2px solid #e5e7eb; }
                  td { color:#374151; }
                  tr:nth-child(even) td { background:#f9fafb; }
                  .footer { margin-top:24px; text-align:center; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:12px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>📋 تقرير الحضور والغياب</h1>
                  <p>الجلسة: ${sessionLabel} | المجموعة: ${sessionGroupName} | المعلم: ${user?.name || ''}</p>
                </div>
                <div class="stats">
                  <div class="stat stat-green"><span class="stat-num">${presentCount}</span>حاضر</div>
                  <div class="stat stat-yellow"><span class="stat-num">${lateCount}</span>متأخر</div>
                  <div class="stat stat-red"><span class="stat-num">${absentCount}</span>غائب</div>
                </div>
                <table>
                  <thead><tr><th>الطالب</th><th>الكود</th><th>المجموعة</th><th>الحضور</th><th>الوقت</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <div class="footer">تم إنشاء هذا التقرير بتاريخ ${new Date().toLocaleDateString('ar-EG')} - منصة AN Academy</div>
              </body>
              </html>
            `;
            const win = window.open('', '_blank', 'width=850,height=700');
            if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 600); }
          }} 
          className="btn-outline flex items-center gap-2"
        >
          <Printer size={16} /> طباعة التقرير / PDF
        </button>
        {activeSession.status === 'open' && (
          <button onClick={handleCloseSession} className="btn-outline border-red-500/50 text-red-500 hover:bg-red-500/10 flex items-center gap-2 mr-auto">
            <CheckCircle size={16} /> إغلاق الجلسة
          </button>
        )}
      </div>

      <div className="card-base p-6 mb-6">
        <form onSubmit={handleQrSubmit} className="flex gap-4 items-end max-w-xl">
          <div className="flex-1">
            <label className="block text-xs font-bold text-text-muted mb-2">تسجيل الحضور السريع (QR Code Scanner)</label>
            <div className="relative">
              <QrCode className="absolute right-3 top-3.5 text-gray-400" size={18} />
              <input
                ref={qrInputRef}
                type="text"
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="امسح الباركود أو أدخل كود الطالب هنا..."
                className="input-base has-icon-right font-mono"
                autoFocus
              />
            </div>
          </div>
          <button type="submit" className="btn-accent shrink-0">تحضير</button>
        </form>
      </div>

      <div className="card-base overflow-hidden" id="attendance-print-area">
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center print:bg-white print:border-black/10">
          <h3 className="font-bold print:text-black">
            تقرير الحضور: {activeSession.title || activeSession.date} - {activeSession.groupId ? groups.find(g => g.id === activeSession.groupId)?.name : 'كل المجموعات'}
            <span className="print:hidden"> ({students.length})</span>
          </h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الكود</th>
                <th>المجموعة</th>
                <th>حالة الحضور</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const record = records[student.id];
                const groupName = groups.find(g => student.groupIds?.includes(g.id))?.name || 'غير محدد';
                
                return (
                  <tr key={student.id} className="print:border-b print:border-black/10">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold print:hidden">
                          <User size={16} />
                        </div>
                        <span className="font-bold text-sm print:text-black">{student.name}</span>
                      </div>
                    </td>
                    <td><span className="font-mono text-xs px-2 py-1 bg-white/5 rounded-md print:bg-gray-100 print:text-black">{student.code}</span></td>
                    <td><span className="text-xs text-gray-400 print:text-gray-600">{groupName}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleMarkAttendance(student.id, 'present')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${record?.status === 'present' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          حاضر
                        </button>
                        <button onClick={() => handleMarkAttendance(student.id, 'late')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${record?.status === 'late' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          متأخر
                        </button>
                        <button onClick={() => handleMarkAttendance(student.id, 'absent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all print:hidden ${record?.status === 'absent' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          غائب
                        </button>
                        
                        {/* Print Only Status Text */}
                        <span className="hidden print:inline font-bold text-sm">
                          {record?.status === 'present' ? 'حاضر' : record?.status === 'late' ? 'متأخر' : record?.status === 'absent' ? 'غائب' : '---'}
                        </span>
                        
                        <button onClick={() => { setSelectedStudentForQr(student); setShowQrModal(true); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-blue-400 hover:bg-white/10 flex items-center gap-1 print:hidden">
                          <QrCode size={14} /> باركود
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showQrModal && selectedStudentForQr && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowQrModal(false)}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-gold flex items-center gap-2">
                <QrCode size={20} /> بطاقة الطالب
              </h3>
              <button onClick={() => setShowQrModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body flex flex-col items-center justify-center p-8 space-y-4">
              {/* Live preview */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-amber-400/60 w-full max-w-xs">
                <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0f3460] px-4 py-2.5 text-center">
                  <span className="text-amber-400 font-black text-sm">⭐ أكاديمية {user?.name || 'المنصة التعليمية'} ⭐</span>
                </div>
                <div className="flex items-center gap-3 p-4">
                  {selectedStudentForQr.imageUrl ? (
                    <img src={selectedStudentForQr.imageUrl} alt={selectedStudentForQr.name} className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">{selectedStudentForQr.name[0]}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-800 text-sm leading-tight">{selectedStudentForQr.name}</div>
                    {selectedStudentForQr.grade && <div className="text-xs text-gray-500 mt-0.5">📚 {selectedStudentForQr.grade}</div>}
                    <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block tracking-wider">{selectedStudentForQr.code.replace(/-T[A-Z0-9]+$/i,'')}</div>
                  </div>
                  <div className="flex-shrink-0 border border-gray-200 rounded-lg p-1">
                    <QRCodeSVG value={selectedStudentForQr.code} size={64} level="H" includeMargin={false} fgColor="#0f3460" />
                  </div>
                </div>
                <div className="bg-amber-400 px-4 py-1.5 flex justify-between">
                  <span className="text-xs font-bold text-[#1a1a2e]">بطاقة الطالب الرسمية</span>
                  <span className="text-xs font-bold text-[#1a1a2e]">امسح الباركود للحضور</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  openStudentCardForPrint(selectedStudentForQr, user?.name || 'المنصة التعليمية');
                }}
                className="btn-gold w-full max-w-xs flex items-center justify-center gap-2 py-3 text-base rounded-xl shadow-lg"
              >
                <Printer size={20} /> طباعة البطاقة / حفظ PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles removed because we are using iframe printHtml */}


    </div>
  );
}
