'use client';
// src/app/admin/messages/page.tsx
// نظام الرسائل بين الادمن والمعلمين

import { useState, useEffect, useRef } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getTeachers } from '@/lib/db';
import { sendMessage, subscribeToMessages, subscribeToConversations } from '@/lib/db';
import { showToast } from '@/lib/toast';
import type { TeacherUser, Message as ChatMessage, Conversation } from '@/types';
import { MessageSquare, Send, Search, Circle, X } from 'lucide-react';
import { formatDateAr } from '@/lib/utils';

export default function AdminMessagesPage() {
  const { user } = useTeacherStore();
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load teachers list
  useEffect(() => {
    getTeachers().then(setTeachers).catch(console.error);
  }, []);

  // Subscribe to conversations
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToConversations(user.id, setConversations);
    return () => unsub();
  }, [user?.id]);

  // Subscribe to messages for selected teacher
  useEffect(() => {
    if (!user?.id || !selectedTeacher) return;
    const convId = [user.id, selectedTeacher.id].sort().join('_');
    const unsub = subscribeToMessages(convId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [user?.id, selectedTeacher?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !user || !selectedTeacher) return;

    setSending(true);
    try {
      await sendMessage({
        senderId: user.id,
        senderName: user.name,
        receiverId: selectedTeacher.id,
        receiverName: selectedTeacher.name,
        content: newMsg.trim(),
        teacherId: user.id,
        type: 'text',
      });
      setNewMsg('');
    } catch {
      showToast('فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.username || '').toLowerCase().includes(search.toLowerCase())
  );

  const getConvForTeacher = (teacherId: string) => {
    return conversations.find(c => c.participants.includes(teacherId));
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)] card-base overflow-hidden" dir="rtl">
      {/* Sidebar: Teachers List */}
      <div className="w-80 flex-shrink-0 border-l border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-lg font-bold gold-text flex items-center gap-2 mb-3">
            <MessageSquare size={20} /> رسائل المعلمين
          </h2>
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-500" />
            <input
              type="text"
              placeholder="ابحث عن معلم..."
              className="input-base w-full pr-9 text-sm py-2"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {filteredTeachers.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">لا يوجد معلمون</div>
          ) : filteredTeachers.map(teacher => {
            const conv = getConvForTeacher(teacher.id);
            const isActive = selectedTeacher?.id === teacher.id;

            return (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacher(teacher)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-right ${isActive ? 'bg-gold/5 border-r-2 border-gold' : ''}`}
              >
                {teacher.imageUrl ? (
                  <img src={teacher.imageUrl} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                    {teacher.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{teacher.name}</div>
                  <div className="text-[11px] text-gray-500">@{teacher.username}</div>
                  {conv?.lastMessage && (
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{(conv.lastMessage as any).content || ''}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTeacher ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                {selectedTeacher.imageUrl ? (
                  <img src={selectedTeacher.imageUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white">
                    {selectedTeacher.name[0]}
                  </div>
                )}
                <div>
                  <div className="font-bold">{selectedTeacher.name}</div>
                  <div className="text-xs text-gray-400">@{selectedTeacher.username}</div>
                </div>
              </div>
              <button onClick={() => { setSelectedTeacher(null); setMessages([]); }} className="text-gray-400 hover:text-white p-2">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  ابدأ المحادثة مع {selectedTeacher.name}
                </div>
              )}
              {messages.map(msg => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-gold text-black rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                      <p>{msg.content}</p>
                      <div className={`text-[10px] mt-1 opacity-70 ${isMine ? 'text-right text-black/60' : 'text-gray-400'}`}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex gap-2">
              <input
                type="text"
                placeholder="اكتب رسالة للمعلم..."
                className="input-base flex-1 text-sm"
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newMsg.trim() || sending}
                className="btn-gold w-10 h-10 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-gray-400 mb-2">رسائل الإدارة</h3>
            <p className="text-sm">اختر معلماً من القائمة على اليسار لبدء المحادثة</p>
          </div>
        )}
      </div>
    </div>
  );
}
