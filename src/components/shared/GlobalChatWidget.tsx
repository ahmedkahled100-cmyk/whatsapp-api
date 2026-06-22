'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, X, Send, Paperclip, ImageIcon, FileText, 
  Search, Users, Loader2, Check, CheckCheck, Trash2, ArrowRight,
  Archive, Pin
} from 'lucide-react';
import { motion, useMotionValue } from 'framer-motion';
import { 
  sendMessage, subscribeToMessages, markMessagesAsRead, 
  subscribeToUserOnlineStatus, uploadFileToStorage, dispatchNotification,
  broadcastTyping, subscribeToTyping,
  setUserOnlineStatus, heartbeatUserOnlineStatus, setUserOfflineBeacon, deleteConversation,
  toggleConversationPin, toggleConversationArchive
} from '@/lib/db';
import { showToast } from '@/lib/toast';
import { formatRelativeLastSeenAr } from '@/lib/utils';
import { useFilePreview } from '@/components/FilePreviewModal';
import type { Conversation, Message } from '@/types';

interface GlobalChatWidgetProps {
  currentUser: { id: string; name: string; role: string; teacherId?: string };
  conversations: Conversation[];
  contacts: { id: string; name: string; subtitle?: string; role?: string }[];
  superAdmin?: { id: string; name: string } | null;
}

export function GlobalChatWidget({ currentUser, conversations, contacts, superAdmin }: GlobalChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<number | undefined>();

  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'text' | 'image' | 'file'>('text');
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionMessage, setCompressionMessage] = useState('');
  const [typingName, setTypingName] = useState<string | null>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { openPreview, PreviewModal } = useFilePreview();

  const unreadTotal = conversations.reduce((acc, conv) => {
    if (conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === currentUser.id && selectedConv?.id !== conv.id) {
      return acc + 1;
    }
    return acc;
  }, 0);

  // Restore widget position
  useEffect(() => {
    const savedPos = localStorage.getItem(`chatWidgetPos_${currentUser?.id}`);
    if (savedPos) {
      try {
        let { x: savedX, y: savedY } = JSON.parse(savedPos);
        
        // Prevent widget from being placed off-screen on smaller devices
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        
        if (savedX > 50 || savedX < -ww + 50) savedX = 0;
        if (savedY > 50 || savedY < -wh + 100) savedY = 0;

        x.set(savedX);
        y.set(savedY);
      } catch (e) {}
    }
  }, [currentUser?.id, x, y]);

  // Global presence tracking
  useEffect(() => {
    if (!currentUser?.id) return;
    const role = currentUser.role === 'student' ? 'student' : 'teachers';
    
    setUserOnlineStatus(currentUser.id, role, true);
    
    const beat = setInterval(() => {
      heartbeatUserOnlineStatus(currentUser.id, role);
    }, 25000);
    
    const onActivity = () => heartbeatUserOnlineStatus(currentUser.id, role);
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    
    const markOfflineSync = () => setUserOfflineBeacon(currentUser.id, role);
    window.addEventListener('beforeunload', markOfflineSync);
    
    const onVis = () => {
      if (document.hidden) setUserOfflineBeacon(currentUser.id, role);
      else setUserOnlineStatus(currentUser.id, role, true);
    };
    document.addEventListener('visibilitychange', onVis);
    
    return () => {
      clearInterval(beat);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('beforeunload', markOfflineSync);
      document.removeEventListener('visibilitychange', onVis);
      setUserOfflineBeacon(currentUser.id, role);
    };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (isOpen && selectedConv) {
      setLoadingMessages(true);
      // Mark read once on open
      markMessagesAsRead(selectedConv.id, currentUser.id);

      const unsubMsgs = subscribeToMessages(selectedConv.id, (msgs: Message[]) => {
        setMessages(prev => {
          const tempMsgs = prev.filter(m => m.id.startsWith('temp_'));
          const remainingTemps = tempMsgs.filter(t => !msgs.some(m => m.content === t.content && m.senderId === t.senderId && Math.abs(m.timestamp - t.timestamp) < 10000));
          const all = [...msgs, ...remainingTemps].sort((a, b) => a.timestamp - b.timestamp);
          // Remove duplicates by ID just in case
          const uniqueIds = new Set();
          return all.filter(m => {
            if (uniqueIds.has(m.id)) return false;
            uniqueIds.add(m.id);
            return true;
          });
        });
        setLoadingMessages(false);
        markMessagesAsRead(selectedConv.id, currentUser.id);
      });

      markMessagesAsRead(selectedConv.id, currentUser.id);
      setMessages(prev => prev.map(m => m.receiverId === currentUser.id && !m.isRead ? { ...m, isRead: true } : m));

      const otherParticipantId = selectedConv.participants.find(p => p !== currentUser.id);
      let unsubPresence = () => {};
      
      if (otherParticipantId) {
        const contact = contacts.find(c => c.id === otherParticipantId);
        const role = contact?.role === 'student' ? 'student' : 'teachers';
        unsubPresence = subscribeToUserOnlineStatus(
          otherParticipantId, 
          role, 
          (isOnline, lastActive) => {
            setOtherUserOnline(isOnline);
            setOtherUserLastActive(lastActive);
          }
        );
      }

      // Typing indicator
      const unsubTyping = subscribeToTyping(selectedConv.id, currentUser.id, setTypingName);

      return () => {
        unsubMsgs();
        unsubPresence();
        unsubTyping();
      };
    }
  }, [isOpen, selectedConv?.id, currentUser.id]);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachmentUrl) || !selectedConv) return;

    const msgContent = newMessage.trim();
    const attachUrl = attachmentUrl;
    const attachType = attachmentType;
    
    // Optimistic UI update
    const tempId = `temp_${Date.now()}`;
    const receiverId = selectedConv.participants.find(p => p !== currentUser.id)!;
    const receiverName = selectedConv.participantNames[selectedConv.participants.indexOf(receiverId)] || 'المستخدم';
    
    const optimisticMsg: Message = {
      id: tempId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId,
      receiverName,
      content: msgContent,
      timestamp: Date.now(),
      isRead: false,
      teacherId: currentUser.teacherId || currentUser.id,
      type: attachUrl ? attachType : 'text',
      fileUrl: attachUrl
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setAttachmentUrl('');
    setAttachmentType('text');
    setAttachmentType('text');

    try {
      const realId = await sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        receiverId,
        receiverName,
        content: msgContent,
        teacherId: currentUser.teacherId || currentUser.id,
        type: attachUrl ? attachType : 'text',
        ...(attachUrl ? { fileUrl: attachUrl } : {})
      });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId } : m));
      
      // Notify receiver if they are a teacher
      if (currentUser.role === 'student') {
        await dispatchNotification({
          teacherId: currentUser.teacherId || receiverId,
          msg: `رسالة جديدة من الطالب ${currentUser.name}`,
          channels: { inApp: true, whatsapp: false },
          actionPath: `/teacher/messages?studentId=${currentUser.id}`
        });
      }
    } catch (err: any) {
      console.error('Send Error:', err);
      showToast('فشل إرسال الرسالة');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(msgContent); // Restore text
      if (attachUrl) {
        setAttachmentUrl(attachUrl);
        setAttachmentType(attachType);
      }
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
      } catch (err) {
        showToast('فشل رفع الملف');
      } finally {
        setUploadingFile(false);
        e.target.value = '';
      }
    };

    if (type === 'file' && file.type === 'application/pdf' && file.size > 10 * 1024 * 1024) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionMessage('جاري الضغط عبر iLovePDF...');
      try {
        const { compressWithILovePDF } = await import('@/lib/ilovepdf-client');
        const compressedFile = await compressWithILovePDF(file, (progress, message) => {
          setCompressionProgress(progress);
          setCompressionMessage(message);
        });
        await uploadFile(compressedFile);
      } catch (err: any) {
        showToast('فشل الضغط الذكي، جاري الرفع بالحجم الأصلي...');
        await uploadFile(file);
      } finally {
        setIsCompressing(false);
      }
      return;
    }

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

  const startNewChat = (targetId: string, targetName: string) => {
    const convId = [currentUser.id, targetId].sort().join('_');
    const existing = conversations.find(c => c.id === convId);
    
    if (existing) {
      setSelectedConv(existing);
    } else {
      setSelectedConv({
        id: convId,
        participants: [currentUser.id, targetId],
        participantNames: [currentUser.name, targetName],
        updatedAt: Date.now()
      });
    }
    setShowNewChat(false);
  };

  const getOtherParticipant = (conv: Conversation) => {
    const idx = conv.participants.findIndex(p => p !== currentUser.id);
    return {
      id: conv.participants[idx],
      name: conv.participantNames[idx]
    };
  };

  const isConvArchived = (c: Conversation) => !!c.archivedBy?.includes(currentUser.id);
  const isConvPinned = (c: Conversation) => !!c.pinnedBy?.includes(currentUser.id);

  const filteredConversations = conversations.filter(c => 
    (!searchQuery || c.participantNames?.some(name => name?.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (showArchived ? isConvArchived(c) : !isConvArchived(c))
  ).sort((a, b) => {
    const pinA = isConvPinned(a);
    const pinB = isConvPinned(b);
    if (pinA && !pinB) return -1;
    if (!pinA && pinB) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const filteredContacts = contacts.filter(c => 
    !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dropzone handling
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!selectedConv) return;
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const type = isImage ? 'image' : 'file';
    
    // We simulate a synthetic event to reuse handleAttachment
    const mockEvent = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
    await handleAttachment(mockEvent, type);
  };

  return (
    <>
      {/* Floating Button */}
      {/* Floating Button */}
      <motion.button 
        drag
        dragMomentum={false}
        style={{ x, y }}
        onDragEnd={() => { 
          localStorage.setItem(`chatWidgetPos_${currentUser?.id}`, JSON.stringify({ x: x.get(), y: y.get() }));
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ 
          rotate: isOpen ? 90 : 0
        }}
        onTap={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[100px] lg:bottom-10 right-4 lg:right-10 z-[100] w-14 h-14 rounded-full bg-gradient-to-tr from-gold to-amber-400 text-black shadow-xl shadow-gold/20 flex items-center justify-center ${isOpen ? 'pointer-events-none' : ''}`}
      >
        <MessageSquare size={28} />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0a0a0f] shadow-lg animate-bounce">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </motion.button>

      {/* Chat Widget Panel Wrapper for Position Tracking */}
      <motion.div
        style={{ x, y }}
        className="fixed bottom-[100px] lg:bottom-10 right-4 lg:right-10 z-[100] w-[360px] max-w-[calc(100dvw-32px)] flex flex-col justify-end pointer-events-none"
      >
        <div 
          className={`w-full h-[600px] max-h-[80vh] bg-[#0a0f1c]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-20 opacity-0 scale-95 pointer-events-none'}`}
        >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {selectedConv && (
              <button onClick={() => setSelectedConv(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <ArrowRight size={18} />
              </button>
            )}
            <div>
              <h3 className="font-black text-white text-base">
                {selectedConv ? getOtherParticipant(selectedConv).name : 'المراسلة اللحظية'}
              </h3>
              <p className="text-[10px] text-gray-400">
                {selectedConv 
                  ? (otherUserOnline ? <span className="text-emerald-400">متصل الآن</span> : otherUserLastActive ? `آخر نشاط: ${formatRelativeLastSeenAr(otherUserLastActive)}` : 'خارج الخط')
                  : 'تواصل مع المعلمين والطلاب'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedConv && (
              <button 
                onClick={async () => {
                  if (confirm('هل أنت متأكد من حذف هذه المحادثة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
                    try {
                      await deleteConversation(selectedConv.id);
                      setSelectedConv(null);
                      showToast('تم حذف المحادثة بنجاح');
                    } catch (err) {
                      showToast('فشل حذف المحادثة');
                    }
                  }
                }} 
                className="text-red-400 hover:text-red-300 p-1 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
                title="حذف المحادثة"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!selectedConv ? (
          // Conversations List
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex gap-2 p-3 border-b border-white/5 shrink-0">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder={showNewChat ? "البحث عن جهة اتصال..." : "بحث في المحادثات..."}
                  className="input-base has-icon-right w-full text-xs bg-black/40 border-white/5"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              {!showNewChat && (
                <button 
                  onClick={() => setShowArchived(!showArchived)} 
                  className={`p-2 rounded-xl transition-colors flex items-center justify-center shrink-0 ${showArchived ? 'bg-gold/20 text-gold' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                  title={showArchived ? 'العودة للمحادثات الرئيسية' : 'الأرشيف'}
                >
                  <Archive size={18} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 relative">
              {showNewChat ? (
                // New Chat List
                <div className="animate-fade-in">
                  <div className="text-[10px] font-bold text-gray-500 px-3 py-2 uppercase">جهات الاتصال</div>
                  {superAdmin && superAdmin.id !== currentUser.id && (
                     <button 
                       onClick={() => startNewChat(superAdmin.id, superAdmin.name)}
                       className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right"
                     >
                       <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                          <Users size={18} />
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-sm text-white truncate">إدارة المنصة</div>
                         <div className="text-[10px] text-purple-400">الدعم الفني</div>
                       </div>
                     </button>
                  )}
                  {filteredContacts.length === 0 ? (
                    <div className="text-center text-xs text-gray-500 p-8">لا يوجد نتائج للبحث</div>
                  ) : (
                    filteredContacts.map(c => (
                      <button 
                        key={c.id}
                        onClick={() => startNewChat(c.id, c.name)}
                        className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 text-gray-300 font-bold flex items-center justify-center shrink-0">
                           {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white truncate">{c.name}</div>
                          {c.subtitle && <div className="text-[10px] text-gray-500 truncate">{c.subtitle}</div>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                // Existing Conversations List
                <div className="animate-fade-in">
                  {filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center opacity-50">
                      <MessageSquare size={32} className="mb-2 text-gold" />
                      <p className="text-xs">{showArchived ? 'لا توجد محادثات مؤرشفة' : 'لا توجد محادثات سابقة'}</p>
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const other = getOtherParticipant(conv);
                      const hasUnread = conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === currentUser.id;

                      return (
                        <div 
                          key={conv.id}
                          className="w-full p-2.5 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right relative group cursor-pointer"
                          onClick={() => setSelectedConv(conv)}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border ${hasUnread ? 'bg-gold text-black border-gold' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                            {other.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold text-sm truncate ${hasUnread ? 'text-white' : 'text-gray-300'}`}>{other.name}</span>
                              <div className="flex flex-col items-end gap-1">
                                {conv.lastMessage && <span className="text-[9px] text-gray-500 shrink-0">{new Date(conv.lastMessage.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                                {hasUnread && <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] shrink-0" />}
                              </div>
                            </div>
                            <div className="flex justify-between items-center pr-14">
                              <p className={`text-xs truncate ${hasUnread ? 'text-gold font-bold' : 'text-gray-500'}`}>
                                {conv.lastMessage?.content || (conv.lastMessage?.type === 'image' ? '📸 صورة' : conv.lastMessage?.type === 'file' ? '📁 ملف' : 'رسالة جديدة')}
                              </p>
                            </div>
                          </div>
                          
                          {/* Pin / Archive Actions */}
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0a0f1c]/80 backdrop-blur-sm p-1 rounded-xl shadow-lg border border-white/5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleConversationPin(conv.id, currentUser.id, !isConvPinned(conv)); }}
                              className={`p-1.5 rounded-lg transition-colors ${isConvPinned(conv) ? 'text-gold bg-gold/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                              title={isConvPinned(conv) ? 'إلغاء التثبيت' : 'تثبيت'}
                            >
                              <Pin size={14} className={isConvPinned(conv) ? 'fill-gold' : ''} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleConversationArchive(conv.id, currentUser.id, !isConvArchived(conv)); }}
                              className={`p-1.5 rounded-lg transition-colors ${isConvArchived(conv) ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                              title={isConvArchived(conv) ? 'استعادة من الأرشيف' : 'أرشفة'}
                            >
                              <Archive size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            
            {/* Toggle New Chat Button */}
            {!showNewChat && contacts.length > 0 && (
              <button 
                onClick={() => setShowNewChat(true)}
                className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors backdrop-blur-md shadow-xl"
              >
                <Users size={16} /> بدء محادثة جديدة
              </button>
            )}
            {showNewChat && (
              <button 
                onClick={() => setShowNewChat(false)}
                className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors backdrop-blur-md shadow-xl"
              >
                العودة للرسائل
              </button>
            )}
          </div>
        ) : (
          // Active Chat View
          <div 
            className="flex-1 flex flex-col relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 bg-gold/10 backdrop-blur-sm border-2 border-dashed border-gold rounded-xl m-2 flex items-center justify-center pointer-events-none">
                <div className="bg-[#0a0f1c] p-6 rounded-2xl flex flex-col items-center shadow-2xl">
                  <Paperclip size={48} className="text-gold mb-4" />
                  <p className="text-white font-bold">أفلت الملف هنا للإرسال</p>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gold" size={24} /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                  <MessageSquare size={32}/>
                  <p className="text-xs">ابدأ المحادثة الآن!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.senderId === currentUser.id;
                  const isOptimistic = msg.id.startsWith('temp_');

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-slide-up`} style={{ animationDuration: '0.2s' }}>
                      <div className={`max-w-[85%] p-2.5 rounded-2xl shadow-lg relative group transition-opacity ${
                        isMine ? 'bg-gradient-to-br from-gold to-amber-500 text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                      } ${isOptimistic ? 'opacity-60' : 'opacity-100'}`}>
                         {msg.type === 'image' && msg.fileUrl && (
                           <div className="mb-2 rounded-xl overflow-hidden cursor-pointer bg-black/10" onClick={() => openPreview(msg.fileUrl!, 'صورة')}>
                             <img loading="lazy" src={msg.fileUrl} alt="Attachment" className="max-w-full h-auto max-h-48 object-contain hover:scale-105 transition-transform" />
                           </div>
                         )}
                         {msg.type === 'file' && msg.fileUrl && (
                           <div className="mb-2 p-2.5 rounded-xl bg-black/20 flex items-center gap-2 cursor-pointer hover:bg-black/30 transition-colors" onClick={() => openPreview(msg.fileUrl!, 'ملف')}>
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-black/10 text-black' : 'bg-white/10 text-white'}`}>
                               <FileText size={16} />
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="font-bold text-xs truncate">ملف مرفق</p>
                             </div>
                           </div>
                         )}
                         {msg.content && <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                         <div className={`flex items-center gap-1 mt-1 justify-end opacity-70`}>
                            <span className="text-[8px]">{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (
                              isOptimistic ? <Loader2 size={10} className="animate-spin" /> :
                              msg.isRead ? <CheckCheck size={12} className="text-blue-800" /> : <Check size={12} />
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
                  <div className="bg-white/10 border border-white/5 text-white px-3 py-2 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                    <span className="text-gray-400">{typingName} يكتب</span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-black/50 backdrop-blur-xl border-t border-white/5 shrink-0 flex flex-col gap-2">
              {/* Upload Progress */}
              {isCompressing && (
                <div className="flex items-center gap-3 bg-gold/10 border border-gold/20 p-2 rounded-xl animate-fade-in">
                  <Loader2 size={14} className="animate-spin text-gold shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gold">{compressionMessage}</span>
                      <span className="text-[9px] text-gold">{compressionProgress}%</span>
                    </div>
                    <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gold transition-all duration-300" style={{ width: `${compressionProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Attachment Preview */}
              {attachmentUrl && (
                <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl animate-fade-in relative overflow-hidden group">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-gold shrink-0">
                    {attachmentType === 'image' ? <ImageIcon size={14} /> : <FileText size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white font-bold truncate">ملف جاهز للإرسال</p>
                  </div>
                  <button onClick={() => { setAttachmentUrl(''); setAttachmentType('text'); }} className="text-red-400 hover:text-red-300 bg-red-400/10 p-1.5 rounded-lg shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <input type="file" className="hidden" ref={fileInputRef} accept="application/pdf,.doc,.docx,.txt" onChange={e => handleAttachment(e, 'file')} />
                <input type="file" className="hidden" ref={imageInputRef} accept="image/*" onChange={e => handleAttachment(e, 'image')} />
                
                <div className="flex gap-1 mb-1 shrink-0 bg-white/5 rounded-xl p-1 border border-white/5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || !!attachmentUrl} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50">
                    {uploadingFile && attachmentType === 'file' ? <Loader2 size={16} className="animate-spin text-gold" /> : <Paperclip size={16} />}
                  </button>
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingFile || !!attachmentUrl} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50">
                    {uploadingFile && attachmentType === 'image' ? <Loader2 size={16} className="animate-spin text-gold" /> : <ImageIcon size={16} />}
                  </button>
                </div>

                <div className="flex-1 relative">
                  <textarea 
                    rows={1}
                    placeholder="اكتب رسالتك..." 
                    className="input-base w-full py-2.5 px-3 min-h-[40px] max-h-24 resize-none text-xs bg-black/50 border-white/10 focus:border-gold/50"
                    value={newMessage}
                    onChange={e => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                      // Broadcast typing
                      if (selectedConv && e.target.value.trim()) {
                        broadcastTyping(selectedConv.id, currentUser.id, currentUser.name);
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
                  className="w-10 h-10 shrink-0 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}
        </div>
      </motion.div>

      {PreviewModal}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(245, 197, 24, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245, 197, 24, 0.4); }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </>
  );
}
