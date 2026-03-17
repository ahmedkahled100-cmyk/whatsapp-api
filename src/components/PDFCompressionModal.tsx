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
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#1A1A25] border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(245,197,24,0.1)]">
        
        {/* iLovePDF Style Header */}
        <div className="bg-gradient-to-r from-[#E5322E] to-[#b31d1a] p-6 flex items-center justify-between text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
             <div className="bg-white p-2.5 rounded-xl shadow-lg transform -rotate-6">
                <FileText className="text-[#E5322E]" size={28} />
             </div>
             <div>
                <h2 className="font-cairo font-black text-2xl leading-none flex items-center gap-2">
                  AN <span className="text-[#E5322E]">Compress</span> <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">iLovePDF Turbo</span>
                </h2>
                <p className="text-[10px] opacity-80 mt-1 uppercase tracking-widest font-medium">Auto-Optimization & Cloud Transfer</p>
             </div>
          </div>
          <button onClick={onCancel} className="hover:bg-white/20 p-2.5 rounded-full transition-all hover:rotate-90">
            <X size={22} />
          </button>
        </div>

        <div className="p-8">
            {/* Main Visual */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="mb-4 relative">
                    {getStageIcon()}
                    {status.stage === 'completed' && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 animate-bounce">
                            <CheckCircle size={16} />
                        </div>
                    )}
                </div>
                <h3 className="font-cairo font-bold text-lg mb-2">{status.message}</h3>
                <p className="text-gray-400 text-sm">{file.name}</p>
            </div>

            {/* Stats Comparison */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
                            <FileText size={18} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">الحجم الأصلي</p>
                            <p className="font-bold">{formatSize(file.size)}</p>
                        </div>
                    </div>
                    {status.compressedSize && (
                        <>
                            <ArrowRight className="text-gray-600" size={20} />
                            <div className="flex items-center gap-3 text-right">
                                <div>
                                    <p className="text-[10px] text-green-500 uppercase">الحجم المضغوط</p>
                                    <p className="font-bold text-green-400">{formatSize(status.compressedSize)}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <ShieldCheck size={18} className="text-green-400" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Progress Wrapper */}
            <div className="mb-8">
                <div className="flex justify-between text-[11px] mb-2 font-black text-gray-400 uppercase tracking-tighter">
                    <span>حالة المعالجة</span>
                    <span>{status.progress}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div 
                        className="h-full bg-gradient-to-r from-[#E5322E] via-[#ff5d59] to-[#E5322E] bg-[length:200%_100%] animate-gradient-x rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(229,50,46,0.4)]"
                        style={{ width: `${status.progress}%` }}
                    />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.stage === 'uploading' ? 'bg-[#E5322E] animate-pulse' : 'bg-white/10'}`} />
                        <span>الرفع لـ iLovePDF</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.stage === 'compressing' ? 'bg-[#E5322E] animate-pulse' : 'bg-white/10'}`} />
                        <span>المعالجة والتخزين الآمن</span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {status.stage === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} className="flex-shrink-0" />
                    <p className="text-sm font-medium">{status.error || 'حدث خطأ في عملية الضغط'}</p>
                </div>
            )}

            {/* Footer Actions */}
            <div className="flex gap-3">
                {status.stage === 'error' ? (
                    <>
                        <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all">إلغاء</button>
                        <button onClick={compressPDF} className="flex-1 py-3 px-4 rounded-xl bg-[#E5322E] text-white font-bold hover:bg-[#c92a27] transition-all shadow-lg shadow-red-500/20">إعادة المحاولة</button>
                    </>
                ) : status.stage === 'completed' ? (
                    <div className="w-full flex flex-col gap-3">
                         <div className="text-center py-3 bg-green-500/10 rounded-xl border border-green-500/20 mb-2">
                            <p className="text-green-400 font-bold text-sm">✅ تم الضغط والرفع بنجاح</p>
                            <p className="text-[10px] text-green-500/70 mt-1">الملف متاح الآن في المنصة</p>
                         </div>
                         <button onClick={onClose} className="w-full py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 font-bold transition-all border border-white/5 shadow-xl">إكمال عملية النشر</button>
                    </div>
                ) : (
                    <button onClick={onCancel} className="w-full py-3.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all border border-white/5 flex items-center justify-center gap-2">
                         <Loader2 size={18} className="animate-spin text-gray-400" />
                         <span>إلغاء العملية</span>
                    </button>
                )}
            </div>
            
            <p className="text-[9px] text-gray-500 text-center mt-6 uppercase tracking-widest opacity-50">
                Powered by iLovePDF Technology • AN Academy Internal Security
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
