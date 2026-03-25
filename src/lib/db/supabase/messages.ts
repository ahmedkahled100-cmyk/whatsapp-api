// src/lib/db/supabase/messages.ts
import { supabase } from '@/lib/supabase';
import { MESSAGES, CONVERSATIONS } from '../constants';
import type { Message, Conversation } from '@/types';

export const sendMessage = async (msg: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
  const convId = [msg.senderId, msg.receiverId].sort().join('_');
  
  const messageData = {
    ...msg,
    timestamp: Date.now(),
    isRead: false,
    conversationId: convId
  };

  const { data: msgData, error: msgError } = await supabase
    .from(MESSAGES)
    .insert([messageData])
    .select()
    .single();

  if (msgError) throw msgError;

  // Update or create conversation
  const convData = {
    id: convId,
    participants: [msg.senderId, msg.receiverId],
    participantNames: [msg.senderName, msg.receiverName],
    lastMessage: { ...messageData, id: msgData.id },
    updatedAt: Date.now(),
    teacherId: msg.teacherId,
  };

  const { error: convError } = await supabase
    .from(CONVERSATIONS)
    .upsert(convData);

  if (convError) throw convError;

  return msgData.id;
};

export const subscribeToConversations = (userId: string, callback: (convs: Conversation[]) => void) => {
  // Use JSONB containment to find where participants array contains userId
  const channel = supabase
    .channel(`convs:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CONVERSATIONS },
      async () => {
        const { data } = await supabase
          .from(CONVERSATIONS)
          .select('*')
          .contains('participants', [userId])
          .order('updatedAt', { ascending: false });
        callback((data || []) as Conversation[]);
      }
    )
    .subscribe();

  supabase
    .from(CONVERSATIONS)
    .select('*')
    .contains('participants', [userId])
    .order('updatedAt', { ascending: false })
    .then(({ data }) => callback((data || []) as Conversation[]));

  return () => supabase.removeChannel(channel);
};

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  const channel = supabase
    .channel(`msgs:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: MESSAGES, filter: `conversationId=eq.${conversationId}` },
      async () => {
        const { data } = await supabase
          .from(MESSAGES)
          .select('*')
          .eq('conversationId', conversationId)
          .order('timestamp', { ascending: true });
        callback((data || []) as Message[]);
      }
    )
    .subscribe();

  supabase
    .from(MESSAGES)
    .select('*')
    .eq('conversationId', conversationId)
    .order('timestamp', { ascending: true })
    .then(({ data }) => callback((data || []) as Message[]));

  return () => supabase.removeChannel(channel);
};

export const markMessagesAsRead = async (conversationId: string, userId: string) => {
  const { error } = await supabase
    .from(MESSAGES)
    .update({ isRead: true })
    .eq('conversationId', conversationId)
    .eq('receiverId', userId)
    .eq('isRead', false);

  if (error) throw error;
  
  // Note: In a real app, you'd also want to update the last_message.isRead in the conversation table.
  // This might require a small RPC or a more complex update if using JSONB.
};

export const setUserOnlineStatus = async (userId: string, role: string, isOnline: boolean) => {
  if (!userId || !role) return;
  const table = role === 'student' ? 'students' : 'teachers';
  await supabase
    .from(table)
    .update({ isActive: isOnline, lastActive: Date.now() })
    .eq('id', userId);
};

export const subscribeToUserOnlineStatus = (userId: string, role: string, callback: (isOnline: boolean, lastActive?: number) => void) => {
  const table = role === 'student' ? 'students' : 'teachers';
  const channel = supabase
    .channel(`usage:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: table, filter: `id=eq.${userId}` },
      (payload) => {
        const data = payload.new as any;
        const isRecentlyActive = data.lastActive ? (Date.now() - data.lastActive < 2 * 60 * 1000) : false;
        callback(!!data.isActive || isRecentlyActive, data.lastActive);
      }
    )
    .subscribe();

  supabase
    .from(table)
    .select('isActive, lastActive')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        const isRecentlyActive = data.lastActive ? (Date.now() - data.lastActive < 2 * 60 * 1000) : false;
        callback(!!data.isActive || isRecentlyActive, data.lastActive);
      }
    });

  return () => supabase.removeChannel(channel);
};
