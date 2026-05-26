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
  serverFilenames?: string[];
  cloudinaryUrl?: string;
  aiResult?: any;
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
  saveToCloud: () => Promise<string | null>;
  analyzeWithAI: () => Promise<void>;
}

export const useILovePDFStore = create<ILovePDFStore>()(
  persist(
    (set, get) => ({
      files: [],
      tool: 'compress',
      toolSettings: {
        watermark: { type: 'text', text: 'AN Academy', position: 'Center', transparency: 50, size: 40 },
        pagenumber: { position: 'Bottom Center', startNumber: 1, format: '{page}' },
        pdfocr: { languages: ['ara'] },
        ocr: { languages: ['ara'] }, // legacy key kept for backward compat
        rotate: { angle: 90 },
        editpdf: { text: '', position: 'Bottom Center', size: 14, color: '#000000' },
        compress: { compression_level: 'recommended' },
        split: { ranges: '1-end' },
        protect: { password: '' },
        pdfjpg: { dpi: 150 },
        imagepdf: { orientation: 'portrait', margin: 0, pagesize: 'fit' },
        pdfoffice: { outputType: 'Word' },
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
      setStatus: (update) => set((state) => ({ status: { ...state.status, ...update } })),

      reset: () => set({
        files: [],
        status: { stage: 'idle', progress: 0, message: '', originalSize: 0 }
      }),

      // ── saveToCloud ────────────────────────────────────────────────────────────
      // Downloads the already-processed file from iLovePDF and uploads to Cloudinary.
      // The key insight: do NOT re-process the task (it's already consumed). 
      // Instead, use the /v1/download/{task} endpoint directly.
      saveToCloud: async () => {
        const { status } = get();

        // Return cached URL if already uploaded in this session
        if (status.cloudinaryUrl) return status.cloudinaryUrl;

        if (!status.task || !status.server) {
          console.error('[saveToCloud] Missing task/server in status');
          return null;
        }

        set((state) => ({
          status: { ...state.status, stage: 'compressing', message: 'جاري الرفع للسحابة الدائمة...' }
        }));

        try {
          const res = await fetch(`${getApiBase()}/api/ilovepdf/upload-to-cloud`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task: status.task,
              server: status.server,
              fileName: status.fileName || 'document.pdf',
            }),
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'فشل الرفع للسحابة');

          // Cache for subsequent transfers
          set((state) => ({
            status: { ...state.status, stage: 'completed', cloudinaryUrl: data.url }
          }));

          return data.url as string;
        } catch (error: any) {
          console.error('[saveToCloud] Error:', error);
          set((state) => ({
            status: { ...state.status, stage: 'completed', error: error.message }
          }));
          return null;
        }
      },

      // ── analyzeWithAI ──────────────────────────────────────────────────────────
      analyzeWithAI: async () => {
        let url = get().status.cloudinaryUrl;
        if (!url) url = await get().saveToCloud();
        if (!url) return;

        set((state) => ({ status: { ...state.status, stage: 'preparing', message: 'جاري تحليل المحتوى بالذكاء الاصطناعي...' } }));

        try {
          const fileRes = await fetch(url);
          const blob = await fileRes.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });

          const aiRes = await fetch(`${getApiBase()}/api/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'summary', fileData: { inlineData: base64, mimeType: 'application/pdf' }, options: { style: 'detailed' } }),
          });

          const aiData = await aiRes.json();
          if (!aiRes.ok || !aiData.result) throw new Error(aiData.error || 'فشل تحليل المادة');

          set((state) => ({
            status: { ...state.status, stage: 'completed', message: 'تم التحليل بنجاح ✨', aiResult: aiData.result }
          }));
        } catch (error: any) {
          console.error('[analyzeWithAI] Error:', error);
          set((state) => ({ status: { ...state.status, stage: 'error', error: error.message } }));
        }
      },

      // ── startTask ──────────────────────────────────────────────────────────────
      startTask: async () => {
        const { files, tool, toolSettings, setStatus } = get();
        if (files.length === 0) return;

        const toolLabels: Record<string, string> = {
          'compress': 'الضغط', 'merge': 'الدمج', 'split': 'التقسيم',
          'pdfjpg': 'التحويل لصور', 'imagepdf': 'التحويل لـ PDF',
          'watermark': 'إضافة علامة مائية', 'pagenumber': 'ترقيم الصفحات',
          'ocr': 'التعرف الضوئي (OCR)', 'rotate': 'تدوير الصفحات',
          'protect': 'حماية بكلمة مرور', 'unlock': 'فك التشفير',
          'organize': 'تنظيم الصفحات', 'editpdf': 'تعديل PDF'
        };
        const label = toolLabels[tool] || 'المعالجة';
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        try {
          setStatus({
            stage: 'preparing', progress: 5,
            message: `جاري بدء جلسة ${label} الآمنة...`,
            originalSize: totalSize, cloudinaryUrl: undefined, // Reset cloud URL for new task
            fileName: files.length === 1 ? files[0].name : `${files.length} ملفات`
          });

          // 1. Start session
          const initRes = await fetch(`${getApiBase()}/api/ilovepdf/start?tool=${tool}`);
          const initData = await initRes.json();
          if (!initRes.ok || !initData.success) throw new Error(initData.error || 'فشل بدء الجلسة');
          const { task, server, token } = initData;

          // 2. Upload files
          const serverFilenames: string[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileBaseProgress = 10 + (i / files.length) * 60;
            setStatus({ stage: 'uploading', progress: Math.round(fileBaseProgress), message: `جاري رفع الملف ${i + 1} من ${files.length}...` });

            const formData = new FormData();
            formData.append('task', task);
            formData.append('file', file);

            const uploadData = await new Promise<any>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  setStatus({ progress: Math.round(fileBaseProgress + (e.loaded / e.total) * (60 / files.length)) });
                }
              });
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
                else reject(new Error(`فشل رفع الملف ${i + 1}: ${xhr.status}`));
              });
              xhr.addEventListener('error', () => reject(new Error(`خطأ في الاتصال بالرفع للملف ${i + 1}`)));
              xhr.open('POST', `https://${server}/v1/upload`);
              if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              xhr.send(formData);
            });
            serverFilenames.push(uploadData.server_filename);
          }

          // 3. Process (download mode - fast, no Cloudinary)
          setStatus({ stage: 'compressing', progress: 80, message: 'جاري المعالجة الذكية للملف...' });

          // Determine output file name based on tool
          const getOutputFileName = () => {
            if (files.length > 1) {
              if (tool === 'merge') return 'merged.pdf';
              if (tool === 'pdfjpg') return 'images.zip';
              return 'processed.pdf';
            }
            const baseName = files[0].name.replace(/\.[^/.]+$/, '');
            if (tool === 'pdfoffice') return `${baseName}.docx`;
            if (tool === 'pdfjpg') return `${baseName}.zip`;
            return files[0].name;
          };

          const processRes = await fetch(`${getApiBase()}/api/ilovepdf/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task, server, tool,
              fileName: getOutputFileName(),
              serverFilenames,
              mode: 'download',
              settings: toolSettings[tool]
            }),
          });

          const processData = await processRes.json();
          if (!processRes.ok || !processData.success) throw new Error(processData.error || 'فشل المعالجة');

          // 4. Done — store task + serverFilenames so saveToCloud can use them later
          setStatus({
            stage: 'completed', progress: 100,
            message: `تمت عملية ${label} بنجاح! ✅`,
            compressedSize: processData.size,
            fileName: processData.downloadName || get().status.fileName,
            task, server,
            serverFilenames // ← critical: saved for Smart Transfer
          });

        } catch (error: any) {
          console.error('[startTask] Error:', error);
          setStatus({ stage: 'error', message: 'فشل العملية', error: error.message || 'حدث خطأ غير متوقع' });
        }
      }
    }),
    {
      name: 'ilovepdf-standalone-storage',
      partialize: (state) => ({
        status: state.status,
        tool: state.tool,
        toolSettings: state.toolSettings,
      } as any),
    }
  )
);
