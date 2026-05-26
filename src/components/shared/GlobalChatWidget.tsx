'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, X, Send, Paperclip, ImageIcon, FileText, 
  Search, Users, Loader2, Check, CheckCheck, Trash2, ArrowRight
} from 'lucide-react';
import { 
  sendMessage, subscribeToMessages, markMessagesAsRead, 
  subscribeToUserOnlineStatus, uploadFileToStorage, dispatchNotification,
  broadcastTyping, subscribeToTyping
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { openPreview, PreviewModal } = useFilePreview();

  const unreadTotal = conversations.reduce((acc, conv) => {
    if (conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === currentUser.id) {
      return acc + 1;
    }
    return acc;
  }, 0);

  useEffect(() => {
    if (isOpen && selectedConv) {
      setLoadingMessages(true);
      // Mark read once on open
      markMessagesAsRead(selectedConv.id, currentUser.id);

      const unsubMsgs = subscribeToMessages(selectedConv.id, (msgs: Message[]) => {
        setMessages(msgs);
        setLoadingMessages(false);
        markMessagesAsRead(selectedConv.id, currentUser.id);
      });

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
    setSending(true);

    try {
      await sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        receiverId,
        receiverName,
        content: msgContent,
        teacherId: currentUser.teacherId || currentUser.id,
        type: attachUrl ? attachType : 'text',
        ...(attachUrl ? { fileUrl: attachUrl } : {})
      });
      
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
    } finally {
      setSending(false);
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

  const filteredConversations = conversations.filter(c => 
    c.participantNames.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 lg:right-10 z-[100] w-14 h-14 rounded-full bg-gradient-to-tr from-gold to-amber-400 text-black shadow-xl shadow-gold/20 flex items-center justify-center transform transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? 'rotate-90 opacity-0 pointer-events-none' : 'rotate-0 opacity-100'}`}
      >
        <MessageSquare size={28} />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0a0a0f] shadow-lg animate-bounce">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Chat Widget Panel */}
      <div 
        className={`fixed bottom-6 right-6 lg:right-10 z-[100] w-[360px] h-[600px] max-h-[85vh] max-w-[calc(100vw-32px)] bg-[#0a0f1c]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-95 pointer-events-none'}`}
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
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {!selectedConv ? (
          // Conversations List
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="p-3 border-b border-white/5 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder={showNewChat ? "البحث عن جهة اتصال..." : "بحث في المحادثات..."}
                  className="input-base has-icon-right w-full text-xs bg-black/40 border-white/5"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
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
                      <p className="text-xs">لا توجد رسائل سابقة</p>
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const other = getOtherParticipant(conv);
                      const hasUnread = conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === currentUser.id;

                      return (
                        <button 
                          key={conv.id}
                          onClick={() => setSelectedConv(conv)}
                          className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right relative group"
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border ${hasUnread ? 'bg-gold text-black border-gold' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                            {other.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold text-sm truncate ${hasUnread ? 'text-white' : 'text-gray-300'}`}>{other.name}</span>
                              {conv.lastMessage && <span className="text-[9px] text-gray-500 shrink-0">{new Date(conv.lastMessage.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            <div className="flex justify-between items-center">
                              <p className={`text-xs truncate ${hasUnread ? 'text-gold font-bold' : 'text-gray-500'}`}>
                                {conv.lastMessage?.content || (conv.lastMessage?.type === 'image' ? '📸 صورة' : conv.lastMessage?.type === 'file' ? '📁 ملف' : 'رسالة جديدة')}
                              </p>
                              {hasUnread && <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] shrink-0" />}
                            </div>
                          </div>
                        </button>
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
                             <img src={msg.fileUrl} alt="Attachment" className="max-w-full h-auto max-h-48 object-contain hover:scale-105 transition-transform" />
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
                  disabled={(!newMessage.trim() && !attachmentUrl) || sending || uploadingFile || isCompressing}
                  className="w-10 h-10 shrink-0 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg shadow-gold/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale mb-0.5"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

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
