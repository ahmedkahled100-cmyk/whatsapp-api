export type ILovePDFProgressCallback = (progress: number, message: string) => void;

export async function compressWithILovePDF(
  file: File,
  onProgress: ILovePDFProgressCallback,
  level: 'extreme' | 'recommended' | 'low' = 'recommended'
): Promise<Blob> {
  try {
    // Stage 1: Init Task
    onProgress(5, 'جاري بدء جلسة الضغط...');
    
    const initRes = await fetch('/api/ilovepdf/start');
    const data = await initRes.json();
    
    if (!initRes.ok || data.success === false) {
      throw new Error(data.error || 'فشل بدء جلسة iLovePDF');
    }
    
    const { task, server, publicKey, token } = data;

    // Stage 2: Upload Direct to iLovePDF
    onProgress(10, 'جاري الرفع لخوادم الضغط...');
    
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 60) + 10;
          onProgress(percent, 'جاري الرفع لخوادم الضغط...');
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`فشل الرفع لـ iLovePDF: ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('خطأ في الاتصال بالرفع')));
      xhr.open('POST', `https://${server}/v1/upload`);
      
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      xhr.send(formData);
    });

    const uploadData = await uploadPromise as any;

    // Stage 3: Server-side processing
    onProgress(80, 'جاري الضغط والمعالجة...');
    
    const processRes = await fetch('/api/ilovepdf/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        task, 
        server, 
        fileName: file.name,
        serverFilename: uploadData.server_filename,
        compression_level: level
      }),
    });

    const processData = await processRes.json();

    if (!processRes.ok || processData.success === false) {
      throw new Error(processData.error || 'فشل معالجة الملف');
    }

    const { url } = processData;

    // Stage 4: Completed
    onProgress(100, 'اكتملت المعالجة بنجاح');

    const downloadRes = await fetch(url);
    if (!downloadRes.ok) throw new Error('فشل جلب الملف المضغوط');
    
    return await downloadRes.blob();

  } catch (error: any) {
    console.error('ILovePDF Compression error:', error);
    throw new Error(error.message || 'حدث خطأ في عملية ضغط الملف');
  }
}

// Legacy wrapper for backwards compatibility with src/app/exam/page.tsx
export async function compressPDFWithILovePDF(
  file: File,
  onProgress: (p: { progress: number; message: string }) => void
): Promise<{ blob: Blob }> {
  const blob = await compressWithILovePDF(file, (progress, message) => {
    onProgress({ progress, message });
  });
  return { blob };
}
