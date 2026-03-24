// src/lib/db/storage.ts
import { 
  collection, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
// import { compressAndUploadPDFAction, compressAndUploadImageAction, getCloudinarySignature } from '../actions';

if (!db) throw new Error('Firebase Firestore not initialized');

export const uploadFileToStorage = async (
  file: File | Blob, 
  path: string, 
  onProgress?: (progress: number, status?: string) => void,
  customFileName?: string
): Promise<string> => {
  let fileToUpload = file;
  const originalName = (file as File).name || (file as any).fileName || customFileName || 'file';
  const fileType = (file as File).type || (file as any).fileType || 'application/octet-stream';

  const isPDF = fileType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || originalName.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i);
  const isLarge = fileToUpload.size > 10 * 1024 * 1024;

  if (isLarge && (isPDF || isImage)) {
    onProgress?.(10, 'جاري معالجة الملف...');
    // Server-side compression is disabled for static export (APK)
    console.warn('Server-side compression is not available in static export.');
  }

  const LIMIT_100MB = 100 * 1024 * 1024;
  if (fileToUpload.size > LIMIT_100MB) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميجابايت).');
  }

  const nameBase = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const public_id = `${nameBase}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const folder = path.split('/')[0] || 'an-academy';

  try {
    // For static export/APK, we prefer unsigned uploads or we need a client-side signature logic.
    // If you want to use signed uploads in APK, you'd need to call a separate backend API for the signature.
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dc9vbg5ec'; // Fallback to provided cloud name if possible
    const uploadPreset = 'an_academy_unsigned'; // You should create this preset in Cloudinary

    console.log('[Storage] Using direct upload logic for APK compatibility');

    // If we have no signature, we attempt unsigned upload if the preset is set, 
    // otherwise we just throw a descriptive error for the developer.
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const resourceType = isPDF ? 'raw' : 'auto';
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      xhr.open('POST', url, true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const uploadPercent = Math.round((event.loaded / event.total) * 100);
          onProgress(uploadPercent, 'جاري الرفع...');
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || 'فشل الرفع إلى Cloudinary'));
          } catch (e) {
            reject(new Error(`خطأ في الرفع: ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('خطأ في الاتصال بالخادم أثناء الرفع.'));

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folder);
      formData.append('public_id', public_id); 

      xhr.send(formData);
    });
  } catch (error: any) {
    console.error('Upload Process Error:', error);
    throw error;
  }
};
