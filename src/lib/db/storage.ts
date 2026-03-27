// src/lib/db/storage.ts
// Cloudinary signed upload - no unsigned preset required

export const uploadFileToStorage = async (
  file: File | Blob,
  path: string,
  onProgress?: (progress: number, status?: string) => void,
  customFileName?: string
): Promise<string> => {
  const originalName = (file as File).name || (file as any).fileName || customFileName || 'file';
  const fileType = (file as File).type || (file as any).fileType || 'application/octet-stream';

  const isPDF = fileType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');

  const LIMIT_100MB = 100 * 1024 * 1024;
  if (file.size > LIMIT_100MB) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميجابايت).');
  }

  const nameBase = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const public_id = `${nameBase}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const folder = path.split('/')[0] || 'an-academy';

  try {
    // Step 1: Get upload signature from our server
    const apiBase =
      typeof window !== 'undefined' && window.location.hostname.includes('localhost')
        ? ''
        : 'https://an-academy.vercel.app';

    const signRes = await fetch(`${apiBase}/api/cloudinary/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, public_id }),
    });

    if (!signRes.ok) {
      throw new Error('فشل الحصول على توقيع الرفع من الخادم');
    }

    const { signature, timestamp, apiKey, cloudName } = await signRes.json();

    // Step 2: Upload directly to Cloudinary with signature
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
            reject(new Error(err.error?.message || `فشل الرفع إلى Cloudinary (${xhr.status})`));
          } catch {
            reject(new Error(`خطأ في الرفع: ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('خطأ في الاتصال بالخادم أثناء الرفع.'));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('public_id', public_id);

      xhr.send(formData);
    });
  } catch (error: any) {
    console.error('[Storage] Upload Process Error:', error);
    throw error;
  }
};

export const deleteFileFromStorage = async (url: string): Promise<boolean> => {
  if (!url || !url.includes('cloudinary.com')) return false;

  try {
    // Extract public_id and folder from URL
    // Format: .../upload/v12345/folder/public_id.ext
    const parts = url.split('/upload/');
    if (parts.length < 2) return false;

    const pathParts = parts[1].split('/');
    // Skip version (v12345) if present
    const startIndex = pathParts[0].startsWith('v') && !isNaN(Number(pathParts[0].substring(1))) ? 1 : 0;
    const fileWithExt = pathParts[pathParts.length - 1];
    const publicIdWithFolder = pathParts.slice(startIndex).join('/').split('.')[0];
    
    // Resource type detection
    const isRaw = url.includes('/raw/upload/') || url.includes('/files/upload/');
    const resource_type = isRaw ? 'raw' : 'image';

    const apiBase = typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? '' : 'https://an-academy.vercel.app';

    const res = await fetch(`${apiBase}/api/cloudinary/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicIdWithFolder, resource_type }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[Storage] Delete error:', err);
    return false;
  }
};
