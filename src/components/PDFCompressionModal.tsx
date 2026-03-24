import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Loader2, CheckCircle, AlertCircle, Zap, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface PDFCompressionModalProps {
  file: File;
  showSelection?: boolean; // New: allow selection in teacher pages
  onClose: () => void;
  onComplete: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  onCancel: () => void;
}

type CompressionStage = 'selecting' | 'preparing' | 'uploading' | 'compressing' | 'completed' | 'error';

interface CompressionStatus {
  stage: CompressionStage;
  level: 'extreme' | 'recommended' | 'low';
  progress: number;
  message: string;
  originalSize: number;
  compressedSize?: number;
  error?: string;
}

export function PDFCompressionModal({ file, showSelection = false, onClose, onComplete, onCancel }: PDFCompressionModalProps) {
  const [status, setStatus] = useState<CompressionStatus>({
    stage: showSelection ? 'selecting' : 'preparing',
    level: 'recommended',
    progress: 0,
    message: showSelection ? 'اختر مستوى الضغط' : 'جاري التحضير...',
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
      
      const getApiBase = () => {
        if (typeof window === 'undefined') return '';
        if (window.location.hostname.includes('vercel.app')) return '';
        return 'https://an-academy.vercel.app';
      };
      const API_BASE = getApiBase();

      const initRes = await fetch(`${API_BASE}/api/ilovepdf/start`);
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
      
      const processRes = await fetch(`${API_BASE}/api/ilovepdf/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task, 
          server, 
          fileName: file.name,
          serverFilename: uploadData.server_filename,
          compression_level: status.level // Pass the selected level
        }),
      });

      const processData = await processRes.json();

      if (!processRes.ok || processData.success === false) {
        throw new Error(processData.error || 'فشل معالجة الملف');
      }

      const { url, size } = processData;

      // Stage 4: Completed
      const reduction = ((file.size - size) / file.size * 100).toFixed(1);
      setStatus(prev => ({
        ...prev,
        stage: 'completed',
        progress: 100,
        message: `تم الضغط بنجاح! بنسبة ${reduction}%`,
        originalSize: file.size,
        compressedSize: size,
      }));

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
  }, [file, onComplete, status.level]);

  useEffect(() => {
    if (status.stage === 'preparing') {
        compressPDF();
    }
  }, [compressPDF, status.stage]);

  const getStageIcon = () => {
    switch (status.stage) {
      case 'selecting': return <Activity className="text-gold" size={56} />;
      case 'preparing': return <Activity className="text-blue-400 animate-pulse" size={56} />;
      case 'uploading': return <Loader2 className="text-orange-400 animate-spin" size={56} />;
      case 'compressing': return <Zap className="text-gold animate-bounce" size={56} />;
      case 'completed': return <ShieldCheck className="text-green-400" size={56} />;
      case 'error': return <AlertCircle className="text-red-500" size={56} />;
      default: return <FileText className="text-gray-400" size={56} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,191,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,191,0,0.2); }
      `}</style>
      <div className="bg-[#11111a]/95 border border-white/10 rounded-[32px] max-w-md w-full overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-saturate-150 flex flex-col max-h-[90vh]">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-accent/5 pointer-events-none" />
        
        {/* iLovePDF Style Header */}
        <div className="bg-gradient-to-r from-gold/20 via-gold/10 to-transparent p-5 flex items-center justify-between text-white relative flex-shrink-0">
          <div className="flex items-center gap-4 relative z-10">
             <div className="bg-gold/10 p-3 rounded-2xl border border-gold/20 shadow-glow">
                <FileText className="text-gold" size={24} />
             </div>
             <div>
                <h2 className="font-cairo font-black text-xl leading-none gold-text">
                  iLovePDF <span className="text-white/40 font-light mx-1">|</span> سمارت
                </h2>
                <p className="text-[8px] text-muted font-black mt-1 uppercase tracking-[0.2em]">المعالجة الذكية للملفات</p>
             </div>
          </div>
          <button onClick={onCancel} className="hover:bg-white/5 p-2 rounded-xl transition-all">
            <X size={18} className="text-muted" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 pt-2 pb-0 overflow-y-auto custom-scrollbar flex-1 relative z-10">
            {/* Main Visual */}
            <div className="flex flex-col items-center text-center mb-6 pt-4">
                <div className="relative mb-6">
                     <div className="w-24 h-24 rounded-full border border-white/5 flex items-center justify-center relative">
                        {/* Interactive Circle Progress */}
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="48" cy="48" r="44"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-white/5"
                          />
                          <circle
                            cx="48" cy="48" r="44"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={276}
                            strokeDashoffset={276 - (276 * status.progress) / 100}
                            className={`transition-all duration-700 ${status.stage === 'completed' ? 'text-green-500' : status.stage === 'error' ? 'text-red-500' : 'text-gold'}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className={`absolute inset-0 flex items-center justify-center rounded-full animate-pulse-glow ${status.stage === 'completed' ? 'shadow-[0_0_30px_rgba(34,197,94,0.1)] text-green-500' : 'text-gold'}`}>
                            {getStageIcon()}
                        </div>
                    </div>
                </div>
                <h3 className="text-xl font-black font-cairo mb-2 leading-tight">{status.message}</h3>
                <p className="text-muted text-[10px] font-medium opacity-60 max-w-[240px] truncate">{file.name}</p>
            </div>

            {/* Selection UI */}
            {status.stage === 'selecting' && (
                <div className="grid grid-cols-1 gap-2.5 mb-6 animate-in fade-in slide-in-from-bottom-4">
                    {[
                        { id: 'extreme', title: 'ضغط فائق', desc: 'أقصى ضغط، جودة أقل', icon: Zap, color: 'text-orange-400' },
                        { id: 'recommended', title: 'ضغط متوسط', desc: 'توازن مثالي', icon: ShieldCheck, color: 'text-green-400' },
                        { id: 'low', title: 'ضغط ضعيف', desc: 'جودة عالية، ضغط أقل', icon: FileText, color: 'text-blue-400' },
                    ].map(lvl => (
                        <button
                            key={lvl.id}
                            onClick={() => setStatus(prev => ({ ...prev, level: lvl.id as any }))}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-right ${status.level === lvl.id ? 'border-gold bg-gold/5 shadow-glow' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                        >
                            <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 ${lvl.color}`}>
                                <lvl.icon size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-xs">{lvl.title}</h4>
                                <p className="text-[9px] text-muted leading-none">{lvl.desc}</p>
                            </div>
                            {status.level === lvl.id && <CheckCircle size={18} className="text-gold" />}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats Comparison */}
            <div className="mb-6">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                            <FileText size={18} className="text-muted" />
                        </div>
                        <div>
                            <p className="text-[9px] text-muted font-black uppercase mb-0.5 opacity-40">الأصلي</p>
                            <p className="font-black text-sm">{formatSize(file.size)}</p>
                        </div>
                    </div>
                    {status.compressedSize && (
                        <>
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                <ArrowRight className="text-muted/30" size={14} />
                            </div>
                            <div className="flex items-center gap-3 text-right">
                                <div>
                                    <p className="text-[9px] text-green-500 font-black uppercase mb-0.5 opacity-60">النهائي</p>
                                    <p className="font-black text-sm text-green-400">{formatSize(status.compressedSize)}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/10">
                                    <ShieldCheck size={18} className="text-green-400" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Progress Wrapper */}
            <div className="mb-6">
                <div className="flex justify-between items-end text-[9px] mb-2 font-black text-muted uppercase">
                    <span>نسبة الإنجاز</span>
                    <span className="text-gold">{status.progress}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden p-0.5">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-glow ${status.stage === 'completed' ? 'bg-green-500 shadow-green-500/30' : 'bg-gold shadow-gold/30'}`}
                        style={{ width: `${status.progress}%` }}
                    />
                </div>
            </div>

            {/* Error Message */}
            {status.stage === 'error' && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3 text-red-400 animate-shake">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold leading-relaxed">{status.error || 'فشل ضغط الملف'}</p>
                </div>
            )}
        </div>

        {/* Footer Actions - Sticky */}
        <div className="p-6 pt-4 bg-[#11111a]/80 backdrop-blur-md border-t border-white/5 relative z-20 flex-shrink-0">
            <div className="flex gap-3">
                {status.stage === 'selecting' ? (
                    <>
                        <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs transition-all text-muted">إلغاء</button>
                        <button 
                            onClick={() => setStatus(prev => ({ ...prev, stage: 'preparing', message: 'جاري التحضير...' }))} 
                            className="flex-1 py-3 px-4 rounded-xl bg-gold text-dark font-black text-xs hover:shadow-glow transition-all flex items-center justify-center gap-2"
                        >
                            بدء الضغط <ArrowRight size={14} />
                        </button>
                    </>
                ) : status.stage === 'error' ? (
                    <>
                        <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs transition-all text-muted">تجاهل</button>
                        <button onClick={compressPDF} className="flex-1 py-3 px-4 rounded-xl bg-gold text-dark font-black text-xs hover:shadow-glow transition-all">إعادة المحاولة</button>
                    </>
                ) : status.stage === 'completed' ? (
                    <div className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4">
                         <button onClick={onClose} className="w-full py-4 px-6 rounded-xl bg-gold text-dark font-black transition-all shadow-glow hover:scale-[1.01] active:scale-[0.99] text-sm">إكمال عملية النشر</button>
                         <p className="text-center text-[9px] text-green-500 font-bold opacity-60 italic">تم التأمين والرفع بنجاح لـ AN Cloud</p>
                    </div>
                ) : (
                    <button onClick={onCancel} className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all border border-white/5 flex items-center justify-center gap-2 text-muted">
                         <Loader2 size={14} className="animate-spin" />
                         <span className="text-[10px] uppercase tracking-widest font-black">إلغاء المعالجة</span>
                    </button>
                )}
            </div>
            <p className="text-[7px] text-muted/30 text-center mt-4 uppercase tracking-[0.4em] font-black">
                AN SECURITY PROTOCOL • ILOVEPDF CORE
            </p>
        </div>
      </div>
    </div>
    );
}

// Hook to manage compression modal
export function usePDFCompression(options?: { showSelection?: boolean }) {
  const [compressionData, setCompressionData] = useState<{
    file: File | null;
    isOpen: boolean;
    onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  }>({ file: null, isOpen: false });

  const openCompression = (file: File, onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void) => {
    setCompressionData({ file, isOpen: true, onComplete });
  };

  const closeCompression = () => {
    setCompressionData({ file: null, isOpen: false });
  };

  const CompressionModal = compressionData.isOpen && compressionData.file ? (
    <PDFCompressionModal
      file={compressionData.file}
      showSelection={options?.showSelection}
      onClose={closeCompression}
      onComplete={(blob, url, stats) => {
        compressionData.onComplete?.(blob, url, stats);
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
