// src/lib/db/storage.ts
import { 
  collection, addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { compressAndUploadPDFAction, compressAndUploadImageAction, getCloudinarySignature } from '../actions';

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
    onProgress?.(10, 'جاري ضغط الملف عبر iLovePDF...');
    const formData = new FormData();
    const fileForAction = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], originalName, { type: fileType });
    formData.append('file', fileForAction);
    formData.append('fileName', originalName);
    formData.append('folder', path.split('/')[0] || 'an-academy');

    try {
      const result = isPDF 
        ? await compressAndUploadPDFAction(formData)
        : await compressAndUploadImageAction(formData);

      if (result.success && result.url) {
        onProgress?.(100, 'اكتمل الضغط والرفع!');
        try {
          await addDoc(collection(db, 'upload_logs'), {
            fileName: originalName,
            url: result.url,
            originalSize: fileToUpload.size,
            compressedSize: result.size,
            type: fileType,
            timestamp: Date.now(),
            method: 'ilovepdf_compression'
          });
        } catch (e) { console.error('Logging failed', e); }
        return result.url;
      } else {
        throw new Error(result.error || 'فشل الضغط عبر iLovePDF');
      }
    } catch (err: any) {
      console.error('iLovePDF Failed:', err);
      if (fileToUpload.size > 20 * 1024 * 1024) throw new Error('فشل ضغط الملف الكبير (>20MB) عبر iLovePDF. يرجى محاولة تقليل حجمه يدوياً.');
    }
  }

  const LIMIT_100MB = 100 * 1024 * 1024;
  if (fileToUpload.size > LIMIT_100MB) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميجابايت).');
  }

  const nameBase = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const public_id = `${nameBase}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const folder = path.split('/')[0] || 'an-academy';

  try {
    const { signature, timestamp, apiKey, cloudName } = await getCloudinarySignature(folder, public_id);

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
          const logUpload = async () => {
            try {
              await addDoc(collection(db, 'upload_logs'), {
                fileName: originalName,
                url: response.secure_url,
                size: fileToUpload.size,
                type: fileToUpload.type,
                timestamp: Date.now(),
                status: 'success'
              });
            } catch (e) { console.error('Logging failed', e); }
          };
          logUpload();
          resolve(response.secure_url);
        } else {
          const err = JSON.parse(xhr.responseText);
          const errorMsg = err.error?.message || 'فشل الرفع إلى Cloudinary';
          if (xhr.status === 413 || errorMsg.includes('Large') || errorMsg.includes('Payload')) {
            reject(new Error('حجم الملف يتجاوز حد الرفع المباشر (10MB). جاري ضغطه تلقائياً...'));
          } else {
            reject(new Error(errorMsg));
          }
        }
      };
      xhr.onerror = () => reject(new Error('خطأ في الاتصال بالخادم أثناء الرفع.'));

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', apiKey);
      formData.append('folder', folder);
      formData.append('public_id', public_id); 

      xhr.send(formData);
    });
  } catch (error: any) {
    console.error('Upload Process Error:', error);
    throw error;
  }
};
