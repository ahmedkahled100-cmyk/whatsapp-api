// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'a-n-academy-2026',
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

if (!admin.apps.length) {
  try {
    if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as any),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'a-n-academy-2026.appspot.com',
      });
    } else {
      console.warn('Firebase Admin credentials missing. Admin services will not be available.');
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.message);
  }
}

export const adminStorage = admin.apps.length > 0 ? admin.storage() : null;
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;
export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export default admin;
