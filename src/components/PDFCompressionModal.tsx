import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Loader2, CheckCircle, AlertCircle, Zap, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface PDFCompressionModalProps {
  file: File;
  onClose: () => void;
  onComplete: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  onCancel: () => void;
}

type CompressionStage = 'preparing' | 'uploading' | 'compressing' | 'completed' | 'error';

interface CompressionStatus {
  stage: CompressionStage;
  progress: number;
  message: string;
  originalSize: number;
  compressedSize?: number;
  error?: string;
}

export function PDFCompressionModal({ file, onClose, onComplete, onCancel }: PDFCompressionModalProps) {
  const [status, setStatus] = useState<CompressionStatus>({
    stage: 'preparing',
    progress: 0,
    message: 'جاري التحضير...',
    originalSize: file.size,
  });

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const compressPDF = useCallback(async () => {
    try {
      // Stage 1: Init Task
      setStatus(prev => ({ ...prev, stage: 'preparing', progress: 5, message: 'جاري بدء جلسة الضغط...' }));
      
      const initRes = await fetch('/api/ilovepdf/start');
      const data = await initRes.json();
      
      if (!initRes.ok || data.success === false) {
        throw new Error(data.error || 'فشل بدء جلسة iLovePDF');
      }
      
      const { task, server, publicKey, token } = data;

      // Stage 2: Upload Direct to iLovePDF (Bypassing Vercel Limit)
      setStatus(prev => ({ ...prev, stage: 'uploading', progress: 10, message: 'جاري رفع الملف إلى iLovePDF...' }));
      
      const formData = new FormData();
      formData.append('task', task);
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 60) + 10;
            setStatus(prev => ({ ...prev, progress: percent }));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(`فشل الرفع لـ iLovePDF: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('خطأ في الاتصال بالرفع')));
        xhr.open('POST', `https://${server}/v1/upload`);
        
        // Add Authorization header with the JWT token
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        xhr.send(formData);
      });

      const uploadData = await uploadPromise as any;

      // Stage 3: Server-side processing
      setStatus(prev => ({ ...prev, stage: 'compressing', progress: 80, message: 'جاري الضغط والمعالجة...' }));
      
      const processRes = await fetch('/api/ilovepdf/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task, 
          server, 
          fileName: file.name,
          serverFilename: uploadData.server_filename 
        }),
      });

      const processData = await processRes.json();

      if (!processRes.ok || processData.success === false) {
        throw new Error(processData.error || 'فشل معالجة الملف');
      }

      const { url, size } = processData;

      // Stage 4: Completed
      const reduction = ((file.size - size) / file.size * 100).toFixed(1);
      setStatus({
        stage: 'completed',
        progress: 100,
        message: `تم الضغط بنجاح! بنسبة ${reduction}%`,
        originalSize: file.size,
        compressedSize: size,
      });

      // Pass completion to parent
      setTimeout(() => {
        // We fetch the blob for local UI preview compatibility, although it's now primarily stored in Cloudinary
        fetch(url).then(r => r.blob()).then(blob => {
            onComplete(blob, url, { originalSize: file.size, compressedSize: size });
        });
      }, 1000);

    } catch (error: any) {
      console.error('Compression crash:', error);
      setStatus(prev => ({
        ...prev,
        stage: 'error',
        progress: 0,
        message: 'فشل العملية',
        error: error.message || 'حدث خطأ غير متوقع',
      }));
    }
  }, [file, onComplete]);

  useEffect(() => {
    compressPDF();
  }, [compressPDF]);

  const getStageIcon = () => {
    switch (status.stage) {
      case 'preparing': return <Activity className="text-blue-400 animate-pulse" size={56} />;
      case 'uploading': return <Loader2 className="text-orange-400 animate-spin" size={56} />;
      case 'compressing': return <Zap className="text-gold animate-bounce" size={56} />;
      case 'completed': return <ShieldCheck className="text-green-400" size={56} />;
      case 'error': return <AlertCircle className="text-red-500" size={56} />;
      default: return <FileText className="text-gray-400" size={56} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#11111a]/80 border border-white/10 rounded-[32px] max-w-lg w-full overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-saturate-150 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-accent/5 pointer-events-none" />
        
        {/* iLovePDF Style Header */}
        <div className="bg-gradient-to-r from-gold/20 via-gold/10 to-transparent p-10 flex items-center justify-between text-white relative">
          <div className="flex items-center gap-6 relative z-10">
             <div className="bg-gold/10 p-4 rounded-3xl border border-gold/20 shadow-glow group-hover:scale-110 transition-transform">
                <FileText className="text-gold" size={32} />
             </div>
             <div>
                <h2 className="font-cairo font-black text-3xl leading-none gold-text">
                  iLovePDF <span className="text-white/40 font-light mx-1">|</span> سمارت
                </h2>
                <p className="text-[10px] text-muted font-black mt-2 uppercase tracking-[0.3em]">تحويل الملفات التلقائي والمعالجة الذكية</p>
             </div>
          </div>
          <button onClick={onCancel} className="hover:bg-white/5 p-3 rounded-2xl transition-all hover:rotate-90 group">
            <X size={20} className="text-muted group-hover:text-white" />
          </button>
        </div>

        <div className="p-10 relative z-10">
            {/* Main Visual */}
            <div className="flex flex-col items-center text-center mb-10">
                <div className="relative mb-12">
                     <div className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center relative">
                        {/* Interactive Circle Progress */}
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="64" cy="64" r="60"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-white/5"
                          />
                          <circle
                            cx="64" cy="64" r="60"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={377}
                            strokeDashoffset={377 - (377 * status.progress) / 100}
                            className={`transition-all duration-700 ${status.stage === 'completed' ? 'text-green-500' : status.stage === 'error' ? 'text-red-500' : 'text-gold'}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className={`absolute inset-0 flex items-center justify-center rounded-full animate-pulse-glow ${status.stage === 'completed' ? 'shadow-[0_0_40px_rgba(34,197,94,0.1)] text-green-500' : 'text-gold'}`}>
                            {getStageIcon()}
                        </div>
                    </div>
                </div>
                <h3 className="text-2xl font-black font-cairo mb-3">{status.message}</h3>
                <p className="text-muted text-xs font-medium opacity-60 max-w-[280px] truncate">{file.name}</p>
            </div>

            {/* Stats Comparison */}
            <div className="grid grid-cols-1 gap-4 mb-10">
                <div className="bg-white/5 rounded-3xl p-5 flex items-center justify-between border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                            <FileText size={20} className="text-muted" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 opacity-40">الحجم الأصلي</p>
                            <p className="font-black text-lg">{formatSize(file.size)}</p>
                        </div>
                    </div>
                    {status.compressedSize && (
                        <>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                <ArrowRight className="text-muted/30" size={16} />
                            </div>
                            <div className="flex items-center gap-4 text-right relative z-10">
                                <div>
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest mb-1 opacity-60">الحجم النهائي</p>
                                    <p className="font-black text-lg text-green-400">{formatSize(status.compressedSize)}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/10">
                                    <ShieldCheck size={20} className="text-green-400" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Progress Wrapper */}
            <div className="mb-10">
                <div className="flex justify-between items-end text-[11px] mb-3 font-black text-muted uppercase tracking-widest">
                    <span>تحليل الجزيئات</span>
                    <span className="text-gold">{status.progress}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-glow ${status.stage === 'completed' ? 'bg-green-500 shadow-green-500/30' : 'bg-gold shadow-gold/30'}`}
                        style={{ width: `${status.progress}%` }}
                    />
                </div>
            </div>

            {/* Error Message */}
            {status.stage === 'error' && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-10 flex items-start gap-4 text-red-400 animate-shake">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-bold leading-relaxed">{status.error || 'حدث خطأ غير متوقع أثناء معالجة الملف'}</p>
                </div>
            )}

            {/* Footer Actions */}
            <div className="flex gap-4">
                {status.stage === 'error' ? (
                    <>
                        <button onClick={onCancel} className="flex-1 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 font-black text-sm transition-all text-muted">تجاهل</button>
                        <button onClick={compressPDF} className="flex-1 py-4 px-6 rounded-2xl bg-gold text-dark font-black text-sm hover:shadow-glow transition-all">إعادة المحاولة</button>
                    </>
                ) : status.stage === 'completed' ? (
                    <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                         <button onClick={onClose} className="w-full py-5 px-6 rounded-2xl bg-gold text-dark font-black transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98] text-lg">إكمال عملية النشر</button>
                         <p className="text-center text-[10px] text-green-500 font-bold opacity-60">تم التأمين والرفع بنجاح لـ AN Cloud</p>
                    </div>
                ) : (
                    <button onClick={onCancel} className="w-full py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition-all border border-white/5 flex items-center justify-center gap-3 text-muted">
                         <Loader2 size={16} className="animate-spin" />
                         <span className="text-xs uppercase tracking-widest">إلغاء المعالجة</span>
                    </button>
                )}
            </div>
            
            <p className="text-[9px] text-muted/30 text-center mt-8 uppercase tracking-[0.4em] font-black">
                AN SECURITY PROTOCOL • ILOVEPDF CORE
            </p>
        </div>
      </div>
    </div>
  );
}

// Hook to manage compression modal
export function usePDFCompression() {
  const [compressionData, setCompressionData] = useState<{
    file: File | null;
    isOpen: boolean;
  }>({ file: null, isOpen: false });

  const openCompression = (file: File) => {
    setCompressionData({ file, isOpen: true });
  };

  const closeCompression = () => {
    setCompressionData({ file: null, isOpen: false });
  };

  const CompressionModal = compressionData.isOpen && compressionData.file ? (
    <PDFCompressionModal
      file={compressionData.file}
      onClose={closeCompression}
      onComplete={(blob, url) => {
        // The parent component should handle the compressed file
        closeCompression();
      }}
      onCancel={() => {
        closeCompression();
      }}
    />
  ) : null;

  return {
    openCompression,
    closeCompression,
    CompressionModal,
    isOpen: compressionData.isOpen,
    currentFile: compressionData.file,
  };
}
