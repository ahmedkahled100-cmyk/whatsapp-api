// src/lib/db/messages.ts
import { 
  collection, addDoc, getDocs, setDoc, onSnapshot, 
  query, where, orderBy, limit, writeBatch, doc,
  serverTimestamp, updateDoc, increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { MESSAGES, CONVERSATIONS } from './constants';
import type { Message, Conversation } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const sendMessage = async (msg: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
  const convId = [msg.senderId, msg.receiverId].sort().join('_');
  
  const messageData = {
    ...msg,
    timestamp: Date.now(),
    isRead: false,
    conversationId: convId
  };

  const msgRef = await addDoc(collection(db, MESSAGES), messageData);
  
  // Update or create conversation
  const convRef = doc(db, CONVERSATIONS, convId);
  await setDoc(convRef, {
    id: convId,
    participants: [msg.senderId, msg.receiverId],
    participantNames: [msg.senderName, msg.receiverName],
    lastMessage: { ...messageData, id: msgRef.id },
    updatedAt: Date.now(),
    teacherId: msg.teacherId,
    // We'll increment unread count for the receiver in a more complex setup, 
    // but for now let's just update the timestamp
  }, { merge: true });

  return msgRef.id;
};

export const subscribeToConversations = (userId: string, callback: (convs: Conversation[]) => void) => {
  const q = query(
    collection(db, CONVERSATIONS),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Conversation)));
  });
};

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  const q = query(
    collection(db, MESSAGES),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc'),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Message)));
  });
};

export const markMessagesAsRead = async (conversationId: string, userId: string) => {
  const q = query(
    collection(db, MESSAGES),
    where('conversationId', '==', conversationId),
    where('receiverId', '==', userId),
    where('isRead', '==', false)
  );

  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
  await batch.commit();
};

export const setUserOnlineStatus = async (userId: string, role: string, isOnline: boolean) => {
  if (!userId || !role) return;
  // Fallback map: super_admin might be in users or teachers, assume 'teachers' since there's no 'users' constants typically except maybe 'users', let's use string directly or check if admin is in 'teachers'. Usually admin is in 'teachers' but let's check. 
  const collectionName = role === 'student' ? 'students' : 'teachers';
  try {
    await setDoc(doc(db, collectionName, userId), { isOnline, lastActive: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update online status', e);
  }
};

export const subscribeToUserOnlineStatus = (userId: string, role: string, callback: (isOnline: boolean, lastActive?: number) => void) => {
  if (!userId || !role) return () => {};
  const collectionName = role === 'student' ? 'students' : 'teachers';
  return onSnapshot(doc(db, collectionName, userId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Consider online if isOnline is true OR lastActive is within last 2 minutes just in case
      const isRecentlyActive = data.lastActive ? (Date.now() - data.lastActive < 2 * 60 * 1000) : false;
      callback(!!data.isOnline || isRecentlyActive, data.lastActive);
    } else {
      callback(false);
    }
  });
};
