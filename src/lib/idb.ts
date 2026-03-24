
/**
 * IndexedDB utility for persisting file processing state and blobs
 * This allows "resuming" or "continuing" processing if the browser is closed or refreshed.
 */

const DB_NAME = 'an-academy-processing';
const DB_VERSION = 1;
const STORE_NAME = 'file-queue';

export interface QueuedFile {
  id: string;
  fileName: string;
  fileType: string;
  blob: Blob;
  status: 'pending' | 'compressing' | 'uploading' | 'completed' | 'failed';
  progress: number;
  statusText?: string;
  error?: string;
  url?: string;
  createdAt: number;
  path: string; // The target path/folder in storage
}

export const openDB = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
  
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
  
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
};

export const saveQueuedFile = async (file: QueuedFile): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getQueuedFile = async (id: string): Promise<QueuedFile | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllQueuedFiles = async (): Promise<QueuedFile[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteQueuedFile = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateQueuedFileStatus = async (id: string, updates: Partial<QueuedFile>): Promise<void> => {
  const file = await getQueuedFile(id);
  if (file) {
    await saveQueuedFile({ ...file, ...updates });
  }
};
