/**
 * Client-side utility for iLovePDF compression flow
 */

export interface ILovePDFProgress {
  stage: 'preparing' | 'uploading' | 'compressing' | 'completed' | 'error';
  progress: number;
  message: string;
}

export async function compressPDFWithILovePDF(
  file: File,
  onProgress: (status: ILovePDFProgress) => void
): Promise<{ task: string; server: string; blob: Blob }> {
  try {
    onProgress({ stage: 'preparing', progress: 5, message: 'جاري التحضير للضغط...' });

    // 1. Start Task
    const startRes = await fetch('/api/ilovepdf/start');
    const startData = await startRes.json();
    if (!startRes.ok || !startData.success) throw new Error(startData.error || 'فشل بدء عملية الضغط');

    const { task, server, token } = startData;

    // 2. Upload File
    onProgress({ stage: 'uploading', progress: 10, message: 'جاري رفع الملف للمدقق...' });

    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    const uploadPromise = new Promise<{ server_filename: string }>((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 60) + 10;
          onProgress({ stage: 'uploading', progress: percent, message: 'جاري الرفع...' });
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`فشل الرفع: ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('خطأ في الاتصال أثناء الرفع')));
      xhr.open('POST', `https://${server}/v1/upload`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });

    const uploadData = await uploadPromise;

    // 3. Process File
    onProgress({ stage: 'compressing', progress: 80, message: 'جاري الضغط الفائق...' });

    const processRes = await fetch('/api/ilovepdf/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        server,
        fileName: file.name,
        serverFilename: uploadData.server_filename,
        mode: 'proxy' // We want the blob back to upload to Cloudinary
      }),
    });

    if (!processRes.ok) {
      const errData = await processRes.json();
      throw new Error(errData.error || 'فشل ضغط الملف');
    }

    const blob = await processRes.blob();
    
    onProgress({ stage: 'completed', progress: 100, message: 'اكتمل الضغط بنجاح' });

    return { task, server, blob };

  } catch (error: any) {
    onProgress({ stage: 'error', progress: 0, message: error.message || 'حدث خطأ غير متوقع' });
    throw error;
  }
}
