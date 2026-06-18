'use client';
// src/app/admin/messages/page.tsx
// نظام الرسائل المطور بين الادمن والمعلمين

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTeacherStore } from '@/lib/store';
import { 
  getTeachers, sendMessage, subscribeToMessages, markMessagesAsRead,
  setUserOnlineStatus, subscribeToUserOnlineStatus, uploadFileToStorage,
  heartbeatUserOnlineStatus, broadcastTyping, subscribeToTyping, loadOlderMessages,
  subscribeToConversations
} from '@/lib/db';
import type { Message, Conversation, TeacherUser } from '@/types';
import { 
  Search, Send, Check, CheckCheck, Users,
  MessageSquare, Plus, X, Loader2,
  ShieldCheck, Image as ImageIcon, Paperclip, FileText, Trash2, ChevronUp
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { useFilePreview } from '@/components/FilePreviewModal';
import { usePDFCompression } from '@/components/PDFCompressionModal';
import { useSearchParams } from 'next/navigation';
import { formatRelativeLastSeenAr } from '@/lib/utils';

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const teacherIdParam = searchParams.get('teacherId');
  const { user } = useTeacherStore();

  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<number | undefined>();
  const [typingName, setTypingName] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'text' | 'image' | 'file'>('text');
  
  // ILovePDF Compression States
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionMessage, setCompressionMessage] = useState('');

  const { openPreview, PreviewModal } = useFilePreview();
  const { openCompression, CompressionModal } = usePDFCompression({ showSelection: true });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load teachers list
  useEffect(() => {
    getTeachers()
      .then(list => setTeachers(list.filter(t => t.role === 'teacher')))
      .catch(console.error);
  }, []);

  // Admin Presence: online status + heartbeat
  useEffect(() => {
    if (!user) return;
    setUserOnlineStatus(user.id, 'teachers', true);

    const beat = setInterval(() => {
      heartbeatUserOnlineStatus(user.id, 'teachers');
    }, 25000);

    const onActivity = () => heartbeatUserOnlineStatus(user.id, 'teachers');
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    const handleUnload = () => setUserOnlineStatus(user.id, 'teachers', false);
    window.addEventListener('beforeunload', handleUnload);
    
    const handleVisibilityChange = () => {
      if (document.hidden) setUserOnlineStatus(user.id, 'teachers', false);
      else setUserOnlineStatus(user.id, 'teachers', true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(beat);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setUserOnlineStatus(user.id, 'teachers', false);
    };
  }, [user?.id]);

  // Subscribe to conversations list
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToConversations(user.id, setConversations);
    return () => unsub();
  }, [user?.id]);

  // Handle teacherId param for redirect
  useEffect(() => {
    if (teacherIdParam && teachers.length > 0) {
      const target = teachers.find(t => t.id === teacherIdParam);
      if (target) setSelectedTeacher(target);
    }
  }, [teacherIdParam, teachers]);

  // Subscribe to messages + online presence + typing indicators for selected teacher
  useEffect(() => {
    if (!selectedTeacher || !user) {
      setMessages([]);
      setHasOlderMessages(false);
      return;
    }

    setLoadingMessages(true);
    setHasOlderMessages(false);
    setTypingName(null);

    const convId = [user.id, selectedTeacher.id].sort().join('_');

    // Mark messages as read on open
    markMessagesAsRead(convId, user.id);

    const unsubMsgs = subscribeToMessages(convId, (msgs: Message[]) => {
      setMessages(prev => {
        const tempMsgs = prev.filter(m => m.id.startsWith('temp_'));
        const remainingTemps = tempMsgs.filter(t => !msgs.some(m => m.content === t.content && m.senderId === t.senderId && Math.abs(m.timestamp - t.timestamp) < 10000));
        const all = [...msgs, ...remainingTemps].sort((a, b) => a.timestamp - b.timestamp);
        return all;
      });
      setLoadingMessages(false);
      setHasOlderMessages(msgs.length >= 100);
      markMessagesAsRead(convId, user.id);
    });

    // Mark existing messages as read immediately on open
    markMessagesAsRead(convId, user.id);
    setMessages(prev => prev.map(m => m.receiverId === user.id && !m.isRead ? { ...m, isRead: true } : m));

    // Presence Subscription for the selected teacher
    const unsubPresence = subscribeToUserOnlineStatus(
      selectedTeacher.id,
      'teachers',
      (isOnline, lastActive) => {
        setOtherUserOnline(isOnline);
        setOtherUserLastActive(lastActive);
      }
    );

    // Typing Indicator Subscription
    const unsubTyping = subscribeToTyping(convId, user.id, setTypingName);

    return () => {
      unsubMsgs();
      unsubPresence();
      unsubTyping();
    };
  }, [selectedTeacher?.id, user?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const handleLoadOlder = async () => {
    if (!selectedTeacher || messages.length === 0 || !user) return;
    setLoadingOlder(true);
    try {
      const convId = [user.id, selectedTeacher.id].sort().join('_');
      const older = await loadOlderMessages(convId, messages[0].timestamp);
      if (older.length === 0) {
        setHasOlderMessages(false);
      } else {
        setMessages(prev => [...older, ...prev]);
        setHasOlderMessages(older.length >= 100);
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachmentUrl) || !selectedTeacher || !user) return;

    const msgContent = newMessage.trim();
    const attachUrl = attachmentUrl;
    const attachType = attachmentType;
    const receiverId = selectedTeacher.id;
    const receiverName = selectedTeacher.name;

    // Optimistic message object
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user.id,
      senderName: user.name,
      receiverId,
      receiverName,
      content: msgContent,
      timestamp: Date.now(),
      isRead: false,
      teacherId: user.id,
      type: attachUrl ? attachType : 'text',
      fileUrl: attachUrl || undefined,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setAttachmentUrl('');
    setAttachmentType('text');
    setAttachmentType('text');

    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      textareaRef.current.focus();
    }

    try {
      const realId = await sendMessage({
        senderId: user.id,
        senderName: user.name,
        receiverId,
        receiverName,
        content: msgContent,
        teacherId: user.id,
        type: attachUrl ? attachType : 'text',
        ...(attachUrl ? { fileUrl: attachUrl } : {})
      });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId } : m));
    } catch (err) {
      console.error('Send Error:', err);
      showToast('فشل إرسال الرسالة');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(msgContent);
      if (attachUrl) { setAttachmentUrl(attachUrl); setAttachmentType(attachType); }
    }
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('حجم الملف كبير جداً (الأقصى 25 ميجابايت)');
      e.target.value = '';
      return;
    }

    const uploadFile = async (fileToUpload: File | Blob) => {
      setUploadingFile(true);
      try {
        const path = `chat-attachments/${Date.now()}_${file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        const url = await uploadFileToStorage(fileToUpload, path);
        setAttachmentUrl(url);
        setAttachmentType(type);
        showToast('تم إرفاق الملف بنجاح');
      } catch (err) {
        showToast('فشل رفع الملف');
      } finally {
        setUploadingFile(false);
        e.target.value = '';
      }
    };

    // Smart PDF Compression
    if (type === 'file' && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && file.size > 10 * 1024 * 1024) {
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
        showToast(err.message || 'فشل الضغط، جاري الرفع بالحجم الأصلي...');
        await uploadFile(file);
      } finally {
        setIsCompressing(false);
      }
      return;
    }

    // Smart Image Compression
    if (type === 'image' && file.size > 4 * 1024 * 1024) {
      showToast('جاري ضغط الصورة...');
      setUploadingFile(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        await uploadFile(compressed);
      } catch (err) {
        await uploadFile(file);
      }
      return;
    }

    await uploadFile(file);
  };

  const getConvForTeacher = (teacherId: string) => {
    return conversations.find(c => c.participants.includes(teacherId));
  };

  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#0a0f1c] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl" dir="rtl">
      
      {/* Sidebar: Teachers List */}
      <div className={`w-full md:w-80 border-l border-white/5 bg-white/5 flex flex-col ${selectedTeacher ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black gold-text flex items-center gap-2">
              <MessageSquare size={20} /> رسائل المعلمين
            </h2>
          </div>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="بحث في الرسائل..." 
              className="input-base has-icon-right w-full text-xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center opacity-60 space-y-3 mt-10">
               <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                 <Users size={28} className="text-gray-500" />
               </div>
               <p className="text-sm font-bold text-gray-300">لا توجد محادثات</p>
               <p className="text-xs text-gray-500">اختر معلماً لبدء المحادثة.</p>
            </div>
          ) : (
            filteredTeachers.map(teacher => {
              const conv = getConvForTeacher(teacher.id);
              const active = selectedTeacher?.id === teacher.id;
              const hasUnread = conv?.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === user.id && selectedTeacher?.id !== teacher.id;

              return (
                <button 
                  key={teacher.id}
                  onClick={() => setSelectedTeacher(teacher)}
                  className={`w-full p-4 flex items-center gap-3 transition-all border-b border-white/5 text-right relative overflow-hidden group ${active ? 'bg-gradient-to-l from-gold/10 to-transparent' : 'hover:bg-white/5'}`}
                >
                  {active && <div className="absolute top-0 right-0 w-[3px] h-full bg-gold shadow-[0_0_10px_var(--gold)]" />}
                  {teacher.imageUrl ? (
                    <img loading="lazy" src={teacher.imageUrl} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex shrink-0 items-center justify-center font-black text-lg shadow-lg border ${active ? 'bg-gold text-black border-gold/50' : 'bg-white/5 text-gray-400 border-white/10 group-hover:bg-white/10'}`}>
                      {teacher.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-bold truncate text-sm transition-colors ${hasUnread ? 'text-white' : (active ? 'text-gold' : 'text-gray-300')}`}>{teacher.name}</span>
                      {conv?.lastMessage && <span className="text-[10px] text-gray-500 shrink-0 mr-2">{new Date(conv.lastMessage.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                       <p className={`text-xs truncate ${hasUnread ? 'text-gold font-bold' : 'text-gray-500'}`}>
                         {conv?.lastMessage?.content || 'ابدأ المحادثة الآن...'}
                       </p>
                       {hasUnread && <span className="w-2 h-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] animate-pulse" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#0d121f] ${!selectedTeacher ? 'hidden md:flex items-center justify-center p-10 text-center' : 'flex'}`}>
        {!selectedTeacher ? (
          <div className="flex flex-col items-center justify-center p-10 h-full w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/5 via-[#0d121f] to-[#0d121f]">
             <div className="w-24 h-24 bg-gradient-to-br from-gold/20 to-gold/5 rounded-3xl flex items-center justify-center mx-auto border border-gold/10 shadow-2xl mb-8 transform -rotate-6 transition-transform hover:rotate-0">
                <MessageSquare size={48} className="text-gold/60" />
             </div>
             <h3 className="text-2xl font-black text-white mb-2 tracking-tight">مرحباً بك في <span className="text-gold">نظام المراسلة للادمن</span></h3>
             <p className="text-sm text-gray-400 max-w-sm text-center leading-relaxed">اختر معلماً من القائمة لبدء التواصل الفوري والمباشر معه بمميزات متقدمة.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedTeacher(null)} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400"><X size={20}/></button>
                {selectedTeacher.imageUrl ? (
                  <img loading="lazy" src={selectedTeacher.imageUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-black font-black">
                    {selectedTeacher.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedTeacher.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${otherUserOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-500'}`} />
                     <span className="text-[10px] text-gray-400 tabular-nums">
                       {otherUserOnline
                         ? 'متصل الآن'
                         : otherUserLastActive
                           ? `آخر نشاط: ${formatRelativeLastSeenAr(otherUserLastActive)}`
                           : 'خارج الخط'}
                     </span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setSelectedTeacher(null); setMessages([]); }} className="text-gray-400 hover:text-white p-2">
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
              {/* Load older messages */}
              {hasOlderMessages && (
                <div className="flex justify-center">
                  <button
                    onClick={handleLoadOlder}
                    disabled={loadingOlder}
                    className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gold transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
                  >
                    {loadingOlder ? <Loader2 size={10} className="animate-spin" /> : <ChevronUp size={10} />}
                    تحميل رسائل أقدم
                  </button>
                </div>
              )}
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gold" size={32} /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                   <MessageSquare size={48}/>
                   <p className="text-sm">لا توجد رسائل سابقة. أرسل رسالة للبدء!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.senderId === user.id;
                  const isOptimistic = msg.id.startsWith('temp_');
                  const showTime = i === 0 || Math.abs(msg.timestamp - messages[i-1].timestamp) > 300000;

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {showTime && (
                        <span className="text-[10px] text-gray-600 my-2 self-center bg-black/20 px-3 py-1 rounded-full border border-white/5">
                          {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <div className={`max-w-[80%] p-3 rounded-2xl shadow-lg relative group transition-opacity ${
                        isMine ? 'bg-gradient-to-br from-gold to-amber-500 text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                      } ${isOptimistic ? 'opacity-60' : 'opacity-100'}`}>
                         {msg.type === 'image' && msg.fileUrl && (
                           <div className="mb-2 rounded-xl overflow-hidden cursor-pointer bg-black/10" onClick={() => openPreview(msg.fileUrl!, 'مرفق صورة')}>
                             <img loading="lazy" src={msg.fileUrl} alt="Attachment" className="max-w-full h-auto max-h-60 object-contain hover:opacity-90 transition-opacity" />
                           </div>
                         )}
                         {msg.type === 'file' && msg.fileUrl && (
                           <div className="mb-2 p-3 rounded-xl bg-black/20 flex items-center gap-3 cursor-pointer hover:bg-black/30 transition-colors" onClick={() => openPreview(msg.fileUrl!, 'مرفق ملف')}>
                             <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMine ? 'bg-black/10 text-black' : 'bg-white/10 text-white'}`}>
                               <FileText size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="font-bold text-sm truncate">ملف مرفق</p>
                               <span className="text-[10px] opacity-70">اضغط للفتح</span>
                             </div>
                           </div>
                         )}
                         {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                         <div className={`flex items-center gap-1 mt-1 justify-end opacity-60`}>
                            <span className="text-[9px]">{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (
                              isOptimistic
                                ? <Loader2 size={10} className="animate-spin" />
                                : msg.isRead ? <CheckCheck size={12} className="text-blue-600" /> : <Check size={12} />
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
                  <div className="bg-white/10 border border-white/5 text-white px-4 py-2.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 shadow">
                    <span className="text-gray-400">{typingName} يكتب</span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex flex-col gap-2 relative">
              
              {/* Inline ILovePDF Compression Progress UI */}
              {isCompressing && (
                <div className="flex items-center gap-4 bg-gold/10 border border-gold/20 p-3 rounded-xl mb-1 animate-fade-in shadow-glow">
                  <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin shrink-0 shadow-[0_0_10px_var(--gold)]" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gold">{compressionMessage}</span>
                      <span className="text-[10px] text-gold font-black bg-gold/10 px-2 py-0.5 rounded-md">{compressionProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gold transition-all duration-300 shadow-[0_0_8px_var(--gold)]" style={{ width: `${compressionProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {attachmentUrl && (
                <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl w-max">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-gold">
                    {attachmentType === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="text-xs text-gold font-bold">ملف مرفق جاهز للإرسال</div>
                  <button onClick={() => { setAttachmentUrl(''); setAttachmentType('text'); }} className="text-red-400 hover:text-red-300 bg-red-400/10 p-1.5 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-3 w-full">
                 <div className="flex gap-2 mb-1">
                    <label className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer relative overflow-hidden">
                      {uploadingFile && attachmentType === 'file' ? <Loader2 size={18} className="animate-spin text-gold" /> : <Paperclip size={20}/>}
                      <input type="file" className="hidden" accept="application/pdf,.doc,.docx,.txt" onChange={(e) => handleAttachment(e, 'file')} disabled={uploadingFile || !!attachmentUrl} />
                    </label>
                    <label className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer relative overflow-hidden">
                      {uploadingFile && attachmentType === 'image' ? <Loader2 size={18} className="animate-spin text-gold" /> : <ImageIcon size={20}/>}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAttachment(e, 'image')} disabled={uploadingFile || !!attachmentUrl} />
                    </label>
                 </div>
                 <div className="flex-1 relative">
                    <textarea 
                      ref={textareaRef}
                      rows={1}
                      placeholder="اكتب رسالتك هنا..." 
                      className="input-base w-full pr-4 py-3 min-h-[48px] max-h-32 resize-none overflow-y-auto"
                      value={newMessage}
                      onChange={e => {
                        setNewMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        // Broadcast typing indicator
                        if (selectedTeacher && e.target.value.trim() && user) {
                          const convId = [user.id, selectedTeacher.id].sort().join('_');
                          broadcastTyping(convId, user.id, user.name);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newMessage.trim() || attachmentUrl) {
                            handleSendMessage(e as any);
                          }
                        }
                      }}
                    />
                 </div>
                 <button 
                   type="submit" 
                   disabled={(!newMessage.trim() && !attachmentUrl) || uploadingFile || isCompressing}
                   className="w-12 h-12 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg shadow-gold/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                 >
                   <Send size={24} />
                 </button>
              </form>
            </div>
          </>
        )}
      </div>

      {PreviewModal}
      {CompressionModal}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(245, 197, 24, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245, 197, 24, 0.3); }
        
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
