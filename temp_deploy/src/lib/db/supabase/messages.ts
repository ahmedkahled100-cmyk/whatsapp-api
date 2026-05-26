// src/lib/db/supabase/messages.ts
import { supabase } from '@/lib/supabase';
import { debounceTrailing } from '@/lib/realtime-debounce';
import { MESSAGES, CONVERSATIONS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Message, Conversation } from '@/types';

export const sendMessage = async (msg: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
  const convId = [msg.senderId, msg.receiverId].sort().join('_');

  const messageData = toDB({
    ...msg,
    timestamp: Date.now(),
    isRead: false,
    conversationId: convId,
    type: msg.type || 'text',
  });
  
  // Clean undefined
  Object.keys(messageData).forEach(k => messageData[k] === undefined && delete messageData[k]);

  const { data: msgData, error: msgError } = await supabase
    .from(MESSAGES)
    .insert([messageData])
    .select()
    .single();
  if (msgError) throw msgError;

  const convData = toDB({
    id: convId,
    participants: [msg.senderId, msg.receiverId],
    participantNames: [msg.senderName, msg.receiverName],
    lastMessage: { ...messageData, id: msgData.id },
    updatedAt: Date.now(),
    teacherId: msg.teacherId,
  });
  
  const { error: convError } = await supabase.from(CONVERSATIONS).upsert(convData);
  if (convError) throw convError;

  return msgData.id;
};

export const subscribeToConversations = (userId: string, callback: (convs: Conversation[]) => void) => {
  let cancelled = false;
  const fetch = async () => {
    const { data } = await supabase
      .from(CONVERSATIONS)
      .select('*')
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });
    if (!cancelled) callback(manyFromDB<Conversation>(data || []));
  };

  const debouncedFetch = debounceTrailing(() => {
    void fetch();
  }, 200);

  const channel = supabase
    .channel(`convs:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: CONVERSATIONS }, debouncedFetch)
    .subscribe();

  void fetch();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  let cancelled = false;
  const fetch = async () => {
    const { data } = await supabase
      .from(MESSAGES)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });
    if (!cancelled) callback(manyFromDB<Message>(data || []));
  };

  const debouncedFetch = debounceTrailing(() => {
    void fetch();
  }, 80);

  const channel = supabase
    .channel(`msgs:${conversationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: MESSAGES, filter: `conversation_id=eq.${conversationId}` }, debouncedFetch)
    .subscribe();

  void fetch();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

export const markMessagesAsRead = async (conversationId: string, userId: string) => {
  const { error } = await supabase
    .from(MESSAGES)
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('receiver_id', userId)
    .eq('is_read', false);
  if (error) throw error;
};

export const setUserOnlineStatus = async (userId: string, role: string, isOnline: boolean) => {
  if (!userId || !role) return;
  const table = role === 'student' ? 'students' : 'teachers';
  await supabase
    .from(table)
    .update({ is_online: isOnline, last_active: Date.now() })
    .eq('id', userId);
};

export const subscribeToUserOnlineStatus = (userId: string, role: string, callback: (isOnline: boolean, lastActive?: number) => void) => {
  const table = role === 'student' ? 'students' : 'teachers';
  const channel = supabase
    .channel(`usage:${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${userId}` }, (payload) => {
      const data = payload.new as any;
      const isRecentlyActive = data.last_active ? (Date.now() - data.last_active < 2 * 60 * 1000) : false;
      callback(!!data.is_online || isRecentlyActive, data.last_active);
    })
    .subscribe();

  supabase.from(table).select('is_online, last_active').eq('id', userId).maybeSingle()
    .then(({ data }) => {
      if (data) {
        const isRecentlyActive = data.last_active ? (Date.now() - data.last_active < 2 * 60 * 1000) : false;
        callback(!!data.is_online || isRecentlyActive, data.last_active);
      }
    });

  return () => supabase.removeChannel(channel);
};
