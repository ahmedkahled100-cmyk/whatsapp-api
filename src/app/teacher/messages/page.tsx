'use client';

import { useState, useEffect, useRef } from 'react';
import { useTeacherStore } from '@/lib/store';
import { 
  sendMessage, subscribeToMessages, markMessagesAsRead,
  getSuperAdmin, setUserOnlineStatus, subscribeToUserOnlineStatus, uploadFileToStorage
} from '@/lib/db';
import { Message, Conversation, Student, TeacherUser } from '@/types';
import { 
  Search, Send, User, Clock, Check, CheckCheck, 
  MessageSquare, Plus, X, Loader2, Phone, GraduationCap,
  ShieldCheck, MoreVertical, Image as ImageIcon, Paperclip, FileText, Trash2
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { useFilePreview } from '@/components/FilePreviewModal';
import { usePDFCompression } from '@/components/PDFCompressionModal';
import { FileProcessor } from '@/lib/file-processor';

export default function TeacherMessagesPage() {
  const { user, students, conversations } = useTeacherStore();
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [superAdmin, setSuperAdmin] = useState<TeacherUser | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<number | undefined>();

  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'text' | 'image' | 'file'>('text');
  const { openPreview, PreviewModal } = useFilePreview();
  const { openCompression, CompressionModal } = usePDFCompression({ showSelection: true });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track teacher's own presence
  useEffect(() => {
    if (user) {
      setUserOnlineStatus(user.id, 'teachers', true);
      
      const handleUnload = () => {
        setUserOnlineStatus(user.id, 'teachers', false);
      };
      window.addEventListener('beforeunload', handleUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        setUserOnlineStatus(user.id, 'teachers', false);
      };
    }
  }, [user]);

  useEffect(() => {
    getSuperAdmin().then(setSuperAdmin);
  }, []);

  useEffect(() => {
    if (selectedConv && user) {
      setLoadingMessages(true);
      const unsubMsgs = subscribeToMessages(selectedConv.id, (msgs: Message[]) => {
        setMessages(msgs);
        setLoadingMessages(false);
        markMessagesAsRead(selectedConv.id, user.id);
      });

      const otherParticipantId = selectedConv.participants.find(p => p !== user.id);
      let unsubPresence = () => {};
      
      if (otherParticipantId) {
        const isStudent = students.some(s => s.id === otherParticipantId);
        unsubPresence = subscribeToUserOnlineStatus(
          otherParticipantId, 
          isStudent ? 'student' : 'teachers', 
          (isOnline, lastActive) => {
            setOtherUserOnline(isOnline);
            setOtherUserLastActive(lastActive);
          }
        );
      }

      return () => {
        unsubMsgs();
        unsubPresence();
      };
    } else {
      setMessages([]);
    }
  }, [selectedConv?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachmentUrl) || !selectedConv || !user) return;

    setSending(true);
    try {
      const receiverId = selectedConv.participants.find(p => p !== user.id)!;
      const receiverName = selectedConv.participantNames[selectedConv.participants.indexOf(receiverId)];

      await sendMessage({
        senderId: user.id,
        senderName: user.name,
        receiverId,
        receiverName,
        content: newMessage.trim(),
        teacherId: user.id,
        type: attachmentUrl ? attachmentType : 'text',
        ...(attachmentUrl ? { fileUrl: attachmentUrl } : {})
      });
      setNewMessage('');
      setAttachmentUrl('');
      setAttachmentType('text');
    } catch (err: any) {
      console.error('Send Error:', err);
      showToast('فشل إرسال الرسالة');
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
        showToast('تم إرفاق الملف بنجاح');
      } catch (err) {
        showToast('فشل رفع الملف');
      } finally {
        setUploadingFile(false);
        e.target.value = '';
      }
    };

    if (type === 'file' && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && file.size > 10 * 1024 * 1024) {
      showToast('جاري ضغط ملف الـ PDF قبل الرفع...');
      setUploadingFile(true);
      try {
        const compressedFile = await FileProcessor.compressPdfFileLocally(file);
        await uploadFile(compressedFile);
      } catch (err) {
        // Fallback to original if compression fails
        await uploadFile(file);
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


  const startNewChat = (target: Student | TeacherUser) => {
    if (!user) return;
    const convId = [user.id, target.id].sort().join('_');
    const existing = conversations.find(c => c.id === convId);
    
    if (existing) {
      setSelectedConv(existing);
    } else {
      // Create a temporary conversation object for the UI
      setSelectedConv({
        id: convId,
        participants: [user.id, target.id],
        participantNames: [user.name, target.name],
        updatedAt: Date.now()
      });
    }
    setShowNewChatModal(false);
  };

  const filteredConversations = conversations.filter(c => 
    c.participantNames.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getOtherParticipant = (conv: Conversation) => {
    const idx = conv.participants.findIndex(p => p !== user?.id);
    return {
      id: conv.participants[idx],
      name: conv.participantNames[idx]
    };
  };

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#0a0f1c] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl">
      
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-l border-white/5 bg-white/5 flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black gold-text">محادثاتي</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="w-8 h-8 rounded-lg bg-gold/10 text-gold flex items-center justify-center hover:bg-gold hover:text-black transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="بحث في الرسائل..." 
              className="input-base pr-10 w-full text-xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">لا توجد محادثات بدأت بعد.</div>
          ) : (
            filteredConversations.map(conv => {
              const other = getOtherParticipant(conv);
              const active = selectedConv?.id === conv.id;
              const hasUnread = conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.receiverId === user.id;

              return (
                <button 
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full p-4 flex items-center gap-3 transition-all border-b border-white/5 text-right ${active ? 'bg-gold/10 border-r-2 border-r-gold' : 'hover:bg-white/5'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-lg ${active ? 'bg-gold text-black' : 'bg-white/10 text-gray-400'}`}>
                    {other.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-bold truncate text-sm ${hasUnread ? 'text-white' : 'text-gray-300'}`}>{other.name}</span>
                      {conv.lastMessage && <span className="text-[10px] text-gray-500">{new Date(conv.lastMessage.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                       <p className={`text-xs truncate ${hasUnread ? 'text-gold font-bold' : 'text-gray-500'}`}>
                         {conv.lastMessage?.content || 'ابدأ المحادثة الآن...'}
                       </p>
                       {hasUnread && <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#0d121f] ${!selectedConv ? 'hidden md:flex items-center justify-center p-10 text-center' : 'flex'}`}>
        {!selectedConv ? (
          <div className="space-y-4">
             <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center mx-auto border border-gold/10">
                <MessageSquare size={40} className="text-gold/20" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-gray-400">مرحباً بك في نظام المراسلة</h3>
                <p className="text-sm text-gray-500">اختر محادثة من القائمة الجانبية أو ابدأ محادثة جديدة مع طالب أو الأدمن.</p>
             </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedConv(null)} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400"><X size={20}/></button>
                <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-black font-black">
                  {getOtherParticipant(selectedConv).name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{getOtherParticipant(selectedConv).name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <span className={`w-1.5 h-1.5 rounded-full ${otherUserOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                     <span className="text-[10px] text-gray-500">
                       {otherUserOnline ? 'نشط الآن' : (otherUserLastActive ? `آخر ظهور: ${new Date(otherUserLastActive).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : 'غير متصل')}
                     </span>
                  </div>
                </div>
              </div>
              {/* Removed phone and more buttons */}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
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
                  const showTime = i === 0 || Math.abs(msg.timestamp - messages[i-1].timestamp) > 300000;

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {showTime && (
                        <span className="text-[10px] text-gray-600 my-2 self-center bg-black/20 px-3 py-1 rounded-full border border-white/5">
                          {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <div className={`max-w-[80%] p-3 rounded-2xl shadow-lg relative group ${
                        isMine ? 'bg-gold text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                      }`}>
                         {msg.type === 'image' && msg.fileUrl && (
                           <div className="mb-2 rounded-xl overflow-hidden cursor-pointer bg-black/10" onClick={() => openPreview(msg.fileUrl!, 'مرفق صورة')}>
                             <img src={msg.fileUrl} alt="Attachment" className="max-w-full h-auto max-h-60 object-contain hover:opacity-90 transition-opacity" />
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
                              msg.isRead ? <CheckCheck size={12} className="text-blue-600" /> : <Check size={12} />
                            )}
                         </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex flex-col gap-2">
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
                      rows={1}
                      placeholder="اكتب رسالتك هنا..." 
                      className="input-base w-full pr-4 py-3 min-h-[48px] max-h-32 resize-none overflow-y-auto"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                 </div>
                 <button 
                   type="submit" 
                   disabled={(!newMessage.trim() && !attachmentUrl) || sending || uploadingFile}
                   className="w-12 h-12 rounded-xl bg-gold text-black flex items-center justify-center shadow-lg shadow-gold/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                 >
                   {sending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                 </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-base w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
             <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-black text-lg gold-text">بدء محادثة جديدة</h3>
                <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
             </div>
             
             <div className="p-4">
                <div className="relative mb-4">
                   <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                   <input 
                     type="text" 
                     placeholder="ابحث عن طالب أو معلم..." 
                     className="input-base pr-12 w-full"
                     onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
                   {/* Option to chat with Admin */}
                   {superAdmin && user && superAdmin.id !== user.id && (
                     <button 
                       onClick={() => startNewChat(superAdmin as TeacherUser)}
                       className="w-full p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-3 hover:bg-purple-500/20 transition-all text-right"
                     >
                       <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                          <ShieldCheck size={24} />
                       </div>
                       <div>
                          <p className="font-bold text-sm text-purple-400">إدارة المنصة (الأدمن)</p>
                          <p className="text-[10px] text-gray-500">تواصل مباشر مع الدعم الفني</p>
                       </div>
                     </button>
                   )}

                   <div className="text-[10px] font-bold text-gray-600 py-2 uppercase tracking-widest px-2">الطلاب</div>
                   {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                     <div className="p-10 text-center text-gray-500 text-xs">لا يوجد طلاب مطابقين للبحث.</div>
                   ) : (
                     students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                       <button 
                         key={s.id}
                         onClick={() => startNewChat(s)}
                         className="w-full p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3 hover:bg-gold/10 hover:border-gold/20 transition-all text-right"
                       >
                         <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 font-bold">
                           {s.name[0]}
                         </div>
                         <div>
                            <p className="font-bold text-sm text-gray-200">{s.name}</p>
                            <p className="text-[10px] text-gray-500">{s.grade}</p>
                         </div>
                       </button>
                     ))
                   )}
                </div>
             </div>
          </div>
        </div>
      )}
      
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
