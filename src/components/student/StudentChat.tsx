'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, MessageCircle, X, FileText, ImageIcon, Loader2, Paperclip, Send, Check, CheckCheck, ChevronUp } from 'lucide-react';
import { 
  sendMessage, 
  dispatchNotification, 
  subscribeToMessages, 
  markMessagesAsRead, 
  subscribeToUserOnlineStatus, 
  uploadFileToStorage,
  setUserOnlineStatus,
  heartbeatUserOnlineStatus,
  broadcastTyping,
  subscribeToTyping,
  loadOlderMessages,
} from '@/lib/db';
import { formatRelativeLastSeenAr } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { useFilePreview } from '@/components/FilePreviewModal';
import type { Conversation, Message, Student } from '@/types';

interface StudentChatProps {
  student: Student;
  conversations: Conversation[];
  siteSettings: any;
}

export function StudentChat({ student, conversations, siteSettings }: StudentChatProps) {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Connection / Presence status
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<number | undefined>(undefined);
  const [typingName, setTypingName] = useState<string | null>(null);

  // File Upload states
  const [chatUploadingFile, setChatUploadingFile] = useState(false);
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [chatAttachmentType, setChatAttachmentType] = useState<'text' | 'image' | 'file'>('text');

  // iLovePDF compression states
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionMessage, setCompressionMessage] = useState('');

  const [sending, setSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openPreview, PreviewModal } = useFilePreview();

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // ── Presence: mark student as online + heartbeat ──────────────────────────
  useEffect(() => {
    if (!student?.id) return;
    setUserOnlineStatus(student.id, 'student', true);

    // Heartbeat every 25 seconds while page is open
    const beat = setInterval(() => {
      heartbeatUserOnlineStatus(student.id, 'student');
    }, 25000);

    // Activity-based heartbeat (mouse/keyboard)
    const onActivity = () => heartbeatUserOnlineStatus(student.id, 'student');
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    const markOffline = () => setUserOnlineStatus(student.id, 'student', false);
    window.addEventListener('beforeunload', markOffline);
    const onVis = () => {
      if (document.hidden) setUserOnlineStatus(student.id, 'student', false);
      else setUserOnlineStatus(student.id, 'student', true);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(beat);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('beforeunload', markOffline);
      document.removeEventListener('visibilitychange', onVis);
      setUserOnlineStatus(student.id, 'student', false);
    };
  }, [student?.id]);

  // ── Subscribe to messages, presence, and typing ───────────────────────────
  useEffect(() => {
    if (!selectedConv || !student) return;

    setLoadingChat(true);
    setHasOlderMessages(false);

    // Messages subscription
    const unsub = subscribeToMessages(selectedConv.id, (msgs: Message[]) => {
      setChatMessages(prev => {
        const tempMsgs = prev.filter(m => m.id.startsWith('temp_'));
        const remainingTemps = tempMsgs.filter(t => !msgs.some(m => m.content === t.content && m.senderId === t.senderId && Math.abs(m.timestamp - t.timestamp) < 10000));
        const all = [...msgs, ...remainingTemps].sort((a, b) => a.timestamp - b.timestamp);
        const uniqueIds = new Set();
        return all.filter(m => {
          if (uniqueIds.has(m.id)) return false;
          uniqueIds.add(m.id);
          return true;
        });
      });
      setLoadingChat(false);
      // Check if there could be older messages beyond our page
      setHasOlderMessages(msgs.length >= 100);
      // Mark any newly-arrived messages as read
      markMessagesAsRead(selectedConv.id, student.id);
    });

    // Mark existing messages as read immediately on open
    markMessagesAsRead(selectedConv.id, student.id);
    setChatMessages(prev => prev.map(m => m.receiverId === student.id && !m.isRead ? { ...m, isRead: true } : m));

    // Presence subscription
    const otherParticipantId = selectedConv.participants.find((p: string) => p !== student.id);
    let unsubPresence = () => {};
    if (otherParticipantId) {
      unsubPresence = subscribeToUserOnlineStatus(otherParticipantId, 'teachers', (isOnline, lastActive) => {
        setOtherUserOnline(isOnline);
        setOtherUserLastActive(lastActive);
      });
    }

    // Typing indicator subscription
    const unsubTyping = subscribeToTyping(selectedConv.id, student.id, setTypingName);

    return () => {
      unsub();
      unsubPresence();
      unsubTyping();
    };
  }, [selectedConv?.id, student?.id]);

  // ── Load older messages ───────────────────────────────────────────────────
  const handleLoadOlder = async () => {
    if (!selectedConv || chatMessages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = chatMessages[0].timestamp;
      const older = await loadOlderMessages(selectedConv.id, oldest);
      if (older.length === 0) {
        setHasOlderMessages(false);
      } else {
        setChatMessages(prev => [...older, ...prev]);
        setHasOlderMessages(older.length >= 100);
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── File attachment handler ───────────────────────────────────────────────
  const handleChatAttachment = async (e: React.ChangeEvent<HTMLInputElement>, _type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const detectedType: 'image' | 'file' = isImage ? 'image' : 'file';

    if (file.size > 25 * 1024 * 1024) {
      showToast('حجم الملف كبير جداً (الأقصى 25 ميجابايت)');
      e.target.value = '';
      return;
    }

    const uploadFile = async (fileToUpload: File | Blob) => {
      setChatUploadingFile(true);
      try {
        const path = `chat-attachments/${Date.now()}_${file.name}`;
        const url = await uploadFileToStorage(fileToUpload, path);
        setChatAttachmentUrl(url);
        setChatAttachmentType(detectedType);
        showToast('✅ تم إرفاق الملف بنجاح');
      } catch (err: any) {
        showToast('❌ فشل رفع الملف: ' + (err?.message || 'تحقق من الاتصال'));
      } finally {
        setChatUploadingFile(false);
        e.target.value = '';
      }
    };

    // Large PDF → compress via iLovePDF
    if (!isImage && file.type === 'application/pdf' && file.size > 10 * 1024 * 1024) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionMessage('جاري التحضير للضغط عبر سيرفرات iLovePDF...');
      try {
        const { compressWithILovePDF } = await import('@/lib/ilovepdf-client');
        const compressedFile = await compressWithILovePDF(file, (progress, message) => {
          setCompressionProgress(progress);
          setCompressionMessage(message);
        });
        await uploadFile(compressedFile);
      } catch (err: any) {
        showToast(err.message || 'فشل الضغط الذكي، جاري الرفع بالحجم الأصلي...');
        await uploadFile(file);
      } finally {
        setIsCompressing(false);
      }
      return;
    }

    // Large image → compress locally
    if (isImage && file.size > 4 * 1024 * 1024) {
      showToast('صورة كبيرة، جاري الضغط...');
      setChatUploadingFile(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        await uploadFile(compressed);
      } catch {
        await uploadFile(file);
      }
      return;
    }

    await uploadFile(file);
  };

  // ── Send Message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMsg.trim() && !chatAttachmentUrl) || !selectedConv) return;

    const recId = selectedConv.participants.find(p => p !== student.id);
    if (!recId) { showToast('خطأ: لا يمكن تحديد المستلم'); return; }
    const recName = selectedConv.participantNames[selectedConv.participants.indexOf(recId)] || 'المعلم';
    const msgContent = newMsg.trim();
    const attachUrl = chatAttachmentUrl;
    const attachType = chatAttachmentType;

    // ── Optimistic UI ──
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: student.id,
      senderName: student.name,
      receiverId: recId,
      receiverName: recName,
      content: msgContent,
      timestamp: Date.now(),
      isRead: false,
      teacherId: student.teacherId || recId,
      type: attachUrl ? attachType : 'text',
      fileUrl: attachUrl || undefined,
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
    setNewMsg('');
    setChatAttachmentUrl('');
    setChatAttachmentType('text');
    inputRef.current?.focus();

    try {
      const realId = await sendMessage({
        senderId: student.id,
        senderName: student.name,
        receiverId: recId,
        receiverName: recName,
        content: msgContent,
        teacherId: student.teacherId || recId,
        type: attachUrl ? attachType : 'text',
        ...(attachUrl ? { fileUrl: attachUrl } : {}),
      });

      // Replace temp message with confirmed one (subscription will handle it, but update id instantly)
      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId } : m));

      // Notify the teacher
      dispatchNotification({
        teacherId: student.teacherId || recId,
        msg: `رسالة جديدة من الطالب ${student.name}`,
        channels: { inApp: true, whatsapp: false },
        actionPath: `/teacher/messages?studentId=${student.id}`,
      }).catch(() => {});
    } catch (err: any) {
      showToast('فشل الإرسال: ' + (err?.message || 'خطأ غير معروف'));
      // Rollback optimistic message
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMsg(msgContent);
      if (attachUrl) { setChatAttachmentUrl(attachUrl); setChatAttachmentType(attachType); }
    }
  };

  // ── Helper: group messages (show time header every 5 minutes) ─────────────
  const shouldShowTime = (msgs: Message[], index: number): boolean => {
    if (index === 0) return true;
    return Math.abs(msgs[index].timestamp - msgs[index - 1].timestamp) > 5 * 60 * 1000;
  };

  return (
    <div className="flex flex-col h-[500px] card-base overflow-hidden animate-slide-up bg-[#0d121f]">
      {!selectedConv ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-gold/5 rounded-full flex items-center justify-center border border-gold/10">
            <MessageSquare size={32} className="text-gold/20" />
          </div>
          <button
            onClick={() => {
              const convId = [student.id, student.teacherId].sort().join('_');
              const existing = conversations.find(c => c.id === convId);
              setSelectedConv(existing || {
                id: convId,
                participants: [student.id, student.teacherId],
                participantNames: [student.name, student.teacherName || 'المعلم'],
                updatedAt: Date.now(),
              } as Conversation);
            }}
            className="w-full p-4 rounded-2xl bg-gold/5 border border-gold/10 flex items-center gap-3 hover:bg-gold/10 transition-all text-right cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-black font-black shrink-0">
              {(student.teacherName || 'م')[0]}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-gold">المعلم: {student.teacherName || 'غير معروف'}</p>
              <p className="text-[10px] text-gray-500">تواصل مباشر مع معلمك</p>
            </div>
          </button>
        </div>
      ) : (
        <>
          {/* ── Header ── */}
          <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedConv(null)} className="text-gray-400 p-1 cursor-pointer hover:text-white transition-colors">
                <X size={18} />
              </button>
              <div className="flex flex-col">
                <div className="text-xs font-bold">{selectedConv.participantNames.find(n => n !== student.name)}</div>
                <div className={`text-[9px] flex items-center gap-1 transition-colors ${otherUserOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${otherUserOnline ? 'bg-emerald-400 shadow-[0_0_6px_#4ade80]' : 'bg-gray-500'}`} />
                  {otherUserOnline
                    ? 'متصل الآن'
                    : otherUserLastActive
                      ? `آخر نشاط: ${formatRelativeLastSeenAr(otherUserLastActive)}`
                      : 'خارج الخط'}
                </div>
              </div>
            </div>
            {siteSettings?.whatsappEnabled && siteSettings?.whatsappNumber && (
              <a
                href={`https://wa.me/${siteSettings.whatsappNumber.startsWith('2') ? siteSettings.whatsappNumber : '2' + siteSettings.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-[#25D366]/10 text-[#25D366] px-3 py-1.5 rounded-xl border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all text-[10px] font-bold"
              >
                <MessageCircle size={14} />
                واتساب
              </a>
            )}
          </div>

          {/* ── Messages Area ── */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-black/20">
            {/* Load older messages */}
            {hasOlderMessages && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gold transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
                >
                  {loadingOlder
                    ? <Loader2 size={10} className="animate-spin" />
                    : <ChevronUp size={10} />}
                  تحميل رسائل أقدم
                </button>
              </div>
            )}

            {loadingChat ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-gold" />
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isMine = msg.senderId === student.id;
                const isOptimistic = msg.id.startsWith('temp_');
                const showTime = shouldShowTime(chatMessages, i);

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {showTime && (
                      <span className="text-[9px] text-gray-600 my-1 self-center bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                        {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <div className={`max-w-[85%] p-2.5 rounded-2xl text-xs shadow-lg transition-opacity ${
                      isMine ? 'bg-gradient-to-br from-gold to-amber-500 text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                    } ${isOptimistic ? 'opacity-60' : 'opacity-100'}`}>
                      {msg.type === 'image' && msg.fileUrl && (
                        <img
                          src={msg.fileUrl}
                          alt="Attachment"
                          className="max-w-full h-auto rounded-lg mb-2 cursor-pointer hover:opacity-90"
                          onClick={() => openPreview(msg.fileUrl!, 'صورة')}
                        />
                      )}
                      {msg.type === 'file' && msg.fileUrl && (
                        <div
                          className="flex items-center gap-2 mb-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30"
                          onClick={() => openPreview(msg.fileUrl!, 'ملف')}
                        >
                          <FileText size={16} />
                          <span className="text-[10px] truncate">ملف مرفق</span>
                        </div>
                      )}
                      {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                      <div className="flex items-center gap-1 mt-1 justify-end opacity-60">
                        {!showTime && (
                          <span className="text-[8px]">
                            {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {isMine && (
                          isOptimistic
                            ? <Loader2 size={10} className="animate-spin" />
                            : msg.isRead
                              ? <CheckCheck size={10} className="text-blue-800" />
                              : <Check size={10} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing indicator */}
            {typingName && (
              <div className="flex items-start animate-fade-in">
                <div className="bg-white/10 text-white border border-white/5 px-3 py-2 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                  <span className="text-gray-400">{typingName} يكتب</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div className="p-3 bg-white/5 flex flex-col gap-2 relative shrink-0">
            {/* iLovePDF Compression Progress */}
            {isCompressing && (
              <div className="flex items-center gap-4 bg-gold/10 border border-gold/20 p-3 rounded-xl mb-1 animate-fade-in shadow-glow">
                <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gold">{compressionMessage}</span>
                    <span className="text-[10px] text-gold font-black bg-gold/10 px-2 py-0.5 rounded-md">{compressionProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all duration-300" style={{ width: `${compressionProgress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Attachment preview */}
            {chatAttachmentUrl && (
              <div className="flex items-center justify-between p-2 bg-gold/10 rounded-lg border border-gold/20 animate-fade-in">
                <span className="text-[9px] text-gold font-bold flex items-center gap-1">
                  {chatAttachmentType === 'image' ? <ImageIcon size={12} /> : <FileText size={12} />}
                  ملف مرفق جاهز للإرسال
                </span>
                <button onClick={() => setChatAttachmentUrl('')} className="text-red-400 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-2">
              <div className="flex gap-1">
                <label className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors ${chatUploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                  {chatUploadingFile
                    ? <Loader2 size={18} className="text-gold animate-spin" />
                    : <Paperclip size={18} className="text-gray-400" />}
                  <input
                    type="file"
                    className="hidden"
                    disabled={chatUploadingFile}
                    onChange={(e) => handleChatAttachment(e, 'file')}
                    accept="image/*,application/pdf,.doc,.docx,.txt"
                  />
                </label>
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="اكتب رسالتك..."
                className="input-base flex-1 h-10 text-xs px-3"
                value={newMsg}
                onChange={e => {
                  setNewMsg(e.target.value);
                  // Broadcast typing indicator
                  if (selectedConv && e.target.value.trim()) {
                    broadcastTyping(selectedConv.id, student.id, student.name);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
              />
              <button
                type="submit"
                disabled={(!newMsg.trim() && !chatAttachmentUrl) || chatUploadingFile || isCompressing}
                className="w-10 h-10 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </>
      )}

      {PreviewModal}
    </div>
  );
}
