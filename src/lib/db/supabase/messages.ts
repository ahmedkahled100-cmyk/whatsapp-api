// src/lib/db/supabase/messages.ts
import { supabase } from '@/lib/supabase';
import { debounceTrailing, debounceLeading, throttle } from '@/lib/realtime-debounce';
import { MESSAGES, CONVERSATIONS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Message, Conversation } from '@/types';

// ─── Send Message ───────────────────────────────────────────────────────────
export const sendMessage = async (msg: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
  const convId = [msg.senderId, msg.receiverId].sort().join('_');

  const messageData = toDB({
    ...msg,
    timestamp: Date.now(),
    isRead: false,
    conversationId: convId,
    type: msg.type || 'text',
  });

  // Clean undefined values
  Object.keys(messageData).forEach(k => messageData[k] === undefined && delete messageData[k]);

  const { data: msgData, error: msgError } = await supabase
    .from(MESSAGES)
    .insert([messageData])
    .select()
    .single();
  if (msgError) throw msgError;

  // Upsert conversation (last message preview)
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

  return msgData.id as string;
};

// ─── Subscribe to Conversations ──────────────────────────────────────────────
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

  // Leading debounce: show new conversation immediately, suppress trailing burst
  const debouncedFetch = debounceLeading(() => { void fetch(); }, 300);

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

// ─── Subscribe to Messages (with pagination) ─────────────────────────────────
const MESSAGE_PAGE_SIZE = 100;

export const subscribeToMessages = (
  conversationId: string,
  callback: (msgs: Message[]) => void,
  pageSize = MESSAGE_PAGE_SIZE
) => {
  let cancelled = false;
  const fetch = async () => {
    const { data } = await supabase
      .from(MESSAGES)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: false })
      .limit(pageSize);
    if (!cancelled) {
      // Return in ascending order for display
      callback(manyFromDB<Message>((data || []).reverse()));
    }
  };

  // Leading debounce: new message appears instantly, then cooldown 60ms
  const debouncedFetch = debounceLeading(() => { void fetch(); }, 60);

  const channel = supabase
    .channel(`msgs:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MESSAGES, filter: `conversation_id=eq.${conversationId}` },
      debouncedFetch
    )
    .subscribe();

  void fetch();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

// ─── Load Older Messages (pagination) ────────────────────────────────────────
export const loadOlderMessages = async (
  conversationId: string,
  beforeTimestamp: number,
  pageSize = MESSAGE_PAGE_SIZE
): Promise<Message[]> => {
  const { data } = await supabase
    .from(MESSAGES)
    .select('*')
    .eq('conversation_id', conversationId)
    .lt('timestamp', beforeTimestamp)
    .order('timestamp', { ascending: false })
    .limit(pageSize);
  return manyFromDB<Message>((data || []).reverse());
};

// ─── Mark Messages as Read ───────────────────────────────────────────────────
// Debounced to avoid multiple DB calls when subscription fires multiple times
const _markRead = async (conversationId: string, userId: string) => {
  await supabase
    .from(MESSAGES)
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('receiver_id', userId)
    .eq('is_read', false);
};

const _markReadThrottled = throttle(_markRead as (...args: unknown[]) => void, 3000);

export const markMessagesAsRead = (conversationId: string, userId: string) => {
  (_markReadThrottled as (a: string, b: string) => void)(conversationId, userId);
};

// ─── User Online Status ───────────────────────────────────────────────────────
export const setUserOnlineStatus = async (userId: string, role: string, isOnline: boolean) => {
  if (!userId || !role) return;
  const table = role === 'student' ? 'students' : 'teachers';
  await supabase
    .from(table)
    .update({ is_online: isOnline, last_active: Date.now() })
    .eq('id', userId);
};

// Heartbeat: call this periodically while the user is active
export const heartbeatUserOnlineStatus = throttle(
  async (userId: string, role: string) => {
    if (!userId || !role) return;
    const table = role === 'student' ? 'students' : 'teachers';
    await supabase
      .from(table)
      .update({ is_online: true, last_active: Date.now() })
      .eq('id', userId);
  },
  25000 // once every 25 seconds
) as (userId: string, role: string) => void;

export const subscribeToUserOnlineStatus = (
  userId: string,
  role: string,
  callback: (isOnline: boolean, lastActive?: number) => void
) => {
  // Online = is_online flag OR was active within 3 minutes
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;

  const table = role === 'student' ? 'students' : 'teachers';
  const channel = supabase
    .channel(`presence:${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${userId}` }, (payload) => {
      const data = payload.new as any;
      const isRecentlyActive = data.last_active ? (Date.now() - data.last_active < ONLINE_WINDOW_MS) : false;
      callback(!!data.is_online || isRecentlyActive, data.last_active);
    })
    .subscribe();

  // Initial fetch
  supabase.from(table).select('is_online, last_active').eq('id', userId).maybeSingle()
    .then(({ data }) => {
      if (data) {
        const isRecentlyActive = data.last_active ? (Date.now() - data.last_active < ONLINE_WINDOW_MS) : false;
        callback(!!data.is_online || isRecentlyActive, data.last_active);
      }
    });

  return () => supabase.removeChannel(channel);
};

// ─── Typing Indicator (Broadcast — no DB writes) ──────────────────────────────
/**
 * Broadcast a "typing" event to the other participant.
 * Uses Supabase Realtime Broadcast (ephemeral, no DB).
 * Throttled to once per 2 seconds to avoid flooding.
 */
const _typing = async (conversationId: string, senderId: string, senderName: string) => {
  await supabase
    .channel(`typing:${conversationId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderId, senderName, ts: Date.now() },
    });
};

export const broadcastTyping = throttle(
  _typing as (...args: unknown[]) => void,
  2000
) as (conversationId: string, senderId: string, senderName: string) => void;

/**
 * Subscribe to typing events in a conversation.
 * `callback` receives the name of the person typing (or null when they stopped).
 * The indicator auto-clears after 4 seconds of silence.
 */
export const subscribeToTyping = (
  conversationId: string,
  currentUserId: string,
  callback: (typerName: string | null) => void
) => {
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const channel = supabase
    .channel(`typing:${conversationId}`)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.senderId === currentUserId) return; // ignore own events
      callback(payload.senderName);
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => callback(null), 4000);
    })
    .subscribe();

  return () => {
    clearTimeout(clearTimer);
    supabase.removeChannel(channel);
  };
};
