import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBase } from '@/lib/utils';

interface CompressionStatus {
  stage: 'idle' | 'preparing' | 'uploading' | 'compressing' | 'completed' | 'error';
  progress: number;
  message: string;
  originalSize: number;
  compressedSize?: number;
  error?: string;
  fileName?: string;
  task?: string;
  server?: string;
}

interface ILovePDFStore {
  files: File[];
  tool: string;
  toolSettings: any;
  status: CompressionStatus;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  setFiles: (files: File[]) => void;
  setTool: (tool: string) => void;
  setToolSettings: (settings: any) => void;
  setStatus: (status: Partial<CompressionStatus>) => void;
  reset: () => void;
  startTask: () => Promise<void>;
}

export const useILovePDFStore = create<ILovePDFStore>()(
  persist(
    (set, get) => ({
      files: [],
      tool: 'compress',
      toolSettings: {
        // Default settings for various tools
        watermark: { type: 'text', text: 'AN Academy', position: 'Center', transparency: 50, size: 40 },
        pagenumber: { position: 'Bottom Center', startNumber: 1, format: '{page}' },
        ocr: { language: 'ara' },
        rotate: { angle: 90 },
      },
      status: {
        stage: 'idle',
        progress: 0,
        message: '',
        originalSize: 0,
      },

      addFiles: (newFiles) => {
        const { files } = get();
        set({ files: [...files, ...newFiles] });
      },

      removeFile: (index) => {
        const { files } = get();
        set({ files: files.filter((_, i) => i !== index) });
      },

      setFiles: (files) => set({ files }),
      
      setTool: (tool) => set({ tool }),

      setToolSettings: (settings) => set((state) => ({ toolSettings: { ...state.toolSettings, [state.tool]: settings } })),
      
      setStatus: (update) => set((state) => ({
        status: { ...state.status, ...update }
      })),

      reset: () => set({
        files: [],
        status: { stage: 'idle', progress: 0, message: '', originalSize: 0 }
      }),

      startTask: async () => {
        const { files, tool, toolSettings, setStatus } = get();
        if (files.length === 0) return;

        try {
          const toolLabels: Record<string, string> = {
            'compress': 'الضغط',
            'merge': 'الدمج',
            'split': 'التقسيم',
            'pdfjpg': 'التحويل لصور',
            'imagepdf': 'التحويل لـ PDF',
            'watermark': 'إضافة علامة مائية',
            'pagenumber': 'ترقيم الصفحات',
            'ocr': 'التعرف الضوئي (OCR)',
            'rotate': 'تدوير الصفحات',
            'protect': 'حماية بكلمة مرور',
            'unlock': 'فك التشفير',
            'organize': 'تنظيم الصفحات',
            'editpdf': 'تعديل PDF'
          };
          const label = toolLabels[tool] || 'المعالجة';
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);

          setStatus({
            stage: 'preparing',
            progress: 5,
            message: `جاري بدء جلسة ${label} الآمنة...`,
            originalSize: totalSize,
            fileName: files.length === 1 ? files[0].name : `${files.length} ملفات`
          });

          // 1. Init
          const initRes = await fetch(`${getApiBase()}/api/ilovepdf/start?tool=${tool}`);
          const initData = await initRes.json();
          if (!initRes.ok || !initData.success) {
            throw new Error(initData.error || 'فشل بدء الجلسة');
          }

          const { task, server, token } = initData;

          // 2. Upload Files
          const serverFilenames: string[] = [];
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileBaseProgress = 10 + (i / files.length) * 60;
            
            setStatus({
              stage: 'uploading', 
              progress: Math.round(fileBaseProgress), 
              message: `جاري رفع الملف ${i + 1} من ${files.length}...`,
            });
            
            const formData = new FormData();
            formData.append('task', task);
            formData.append('file', file);

            const uploadPromise = new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  const subPercent = (e.loaded / e.total) * (60 / files.length);
                  setStatus({ progress: Math.round(fileBaseProgress + subPercent) });
                }
              });
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
                else reject(new Error(`فشل رفع الملف ${i+1}: ${xhr.status}`));
              });
              xhr.addEventListener('error', () => reject(new Error(`خطأ في الاتصال بالرفع للملف ${i+1}`)));
              xhr.open('POST', `https://${server}/v1/upload`);
              if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              xhr.send(formData);
            });

            const uploadData = await uploadPromise as any;
            serverFilenames.push(uploadData.server_filename);
          }

          // 3. Process (Download Mode)
          setStatus({
            stage: 'compressing', 
            progress: 80, 
            message: 'جاري المعالجة والانتهاء من المهمة...',
          });

          const processRes = await fetch(`${getApiBase()}/api/ilovepdf/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task,
              server,
              tool,
              fileName: files.length === 1 ? files[0].name : (tool === 'merge' ? 'merged.pdf' : (tool === 'pdfjpg' ? 'images.zip' : 'processed.pdf')),
              serverFilenames: serverFilenames,
              mode: 'download',
              settings: toolSettings[tool]
            }),
          });

          const processData = await processRes.json();
          if (!processRes.ok || !processData.success) throw new Error(processData.error || 'فشل المعالجة');

          // 4. Completed
          setStatus({
            stage: 'completed',
            progress: 100,
            message: `تمت عملية ${label} بنجاح! الملف جاهز للتحميل.`,
            compressedSize: processData.size,
            fileName: processData.downloadName || get().status.fileName,
            task: task,
            server: server
          });

        } catch (error: any) {
          console.error('Store Task Error:', error);
          setStatus({
            stage: 'error',
            message: 'فشل العملية',
            error: error.message || 'حدث خطأ غير متوقع'
          });
        }
      }
    }),
    {
      name: 'ilovepdf-standalone-storage',
      partialize: (state) => ({ status: state.status, tool: state.tool } as any),
    }
  )
);
