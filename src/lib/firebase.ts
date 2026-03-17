// src/lib/firebase.ts
// ==========================================
// إعداد Firebase - استبدل بإعداداتك الخاصة
// الخطوات:
// 1. اذهب إلى https://console.firebase.google.com
// 2. أنشئ مشروعاً جديداً
// 3. أضف تطبيق Web
// 4. انسخ الإعدادات هنا
// 5. فعّل Firestore Database و Authentication
// ==========================================

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase Configuration - Hardcoded for reliability
const firebaseConfig = {
  apiKey: "AIzaSyDfHZ9DhHwnE03KfuCFP8Gul-3QoGGUV9A",
  authDomain: "a-n-academy-2026.firebaseapp.com",
  projectId: "a-n-academy-2026",
  storageBucket: "a-n-academy-2026.appspot.com",
  messagingSenderId: "991660062279",
  appId: "1:991660062279:web:763011fc1776db624be362",
  measurementId: "G-L8Q6EKSRKY",
};

// Prevent duplicate initialization with error handling
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } else {
    app = getApps()[0];
    console.log('Using existing Firebase app');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Fallback to existing app if any
  app = getApps()[0] || null;
}

// Only export if app is initialized
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
export default app;
