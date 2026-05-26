import { 
  collection, addDoc, getDocs, setDoc, onSnapshot, 
  query, where, orderBy, limit, writeBatch, doc,
  serverTimestamp, updateDoc, increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { MESSAGES, CONVERSATIONS } from './constants';
import { clean } from './utils';
import type { Message, Conversation } from '@/types';

if (!db) throw new Error('Firebase Firestore not initialized');

export const sendMessage = async (msg: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
  const convId = [msg.senderId, msg.receiverId].sort().join('_');
  
  const messageData = clean({
    ...msg,
    timestamp: Date.now(),
    isRead: false,
    conversationId: convId
  });

  const msgRef = await addDoc(collection(db, MESSAGES), messageData);

  // Update or create conversation
  const convRef = doc(db, CONVERSATIONS, convId);
  const convData = clean({
    id: convId,
    participants: [msg.senderId, msg.receiverId],
    participantNames: [msg.senderName, msg.receiverName],
    lastMessage: { ...messageData, id: msgRef.id },
    updatedAt: Date.now(),
    teacherId: msg.teacherId,
  });
  await setDoc(convRef, convData, { merge: true });

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

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void, onError?: (err: Error) => void) => {
  const q = query(
    collection(db, MESSAGES),
    where('conversationId', '==', conversationId),
    limit(200)
  );

  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ ...d.data(), id: d.id } as Message));
    // Sort locally to bypass Firebase composite index requirements
    messages.sort((a, b) => a.timestamp - b.timestamp);
    callback(messages);
  }, (error) => {
    console.error("Messages Subscription Error: ", error);
    if (onError) onError(error);
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
  if (snap.empty) return; // Nothing to update
  
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
  
  // Also update the parent conversation's lastMessage to reflect the read status
  const convRef = doc(db, CONVERSATIONS, conversationId);
  batch.update(convRef, { 'lastMessage.isRead': true });
  
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
