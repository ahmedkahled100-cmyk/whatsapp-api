// src/lib/db/admin.ts
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  TEACHERS, EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
  NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
  REG_REQUESTS, MATERIALS, NOTIFICATION_LOGS 
} from './constants';

if (!db) throw new Error('Firebase Firestore not initialized');

export const wipeAllData = async () => {
  const collectionsToWipe = [
    TEACHERS, EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
    NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
    REG_REQUESTS, MATERIALS, NOTIFICATION_LOGS
  ];

  for (const collName of collectionsToWipe) {
    const collRef = collection(db, collName);
    const snap = await getDocs(collRef);
    
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    snap.docs.forEach((docSnap) => {
      currentBatch.delete(docSnap.ref);
      count++;
      if (count === 500) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        count = 0;
      }
    });

    if (count > 0) batches.push(currentBatch);

    for (const b of batches) await b.commit();
  }
};
