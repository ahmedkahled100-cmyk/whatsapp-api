'use client';
// src/app/teacher/tools/ilovepdf/page.tsx
// أداة ضغط ملفات PDF باستخدام iLovePDF مع معالجة في الخلفية

import { useState, useEffect } from 'react';
import { useILovePDFStore } from '@/lib/ilovepdf-store';
import { showToast } from '@/lib/toast';
import { 
  Zap, Upload, FileText, X, RefreshCw, 
  CheckCircle, Loader2, Download, AlertTriangle, Activity,
  Split, Merge, Image as ImageIcon, FileImage
} from 'lucide-react';

export default function ILovePDFPage() {
  const { files, addFiles, removeFile, setFiles, tool, setTool, status, setStatus, startTask, reset } = useILovePDFStore();
  const [mounted, setMounted] = useState(false);

  const tools = [
    { id: 'compress', label: 'ضغط PDF', icon: Zap, color: 'text-gold', desc: 'تقليل حجم الملف مع الحفاظ على الجودة' },
    { id: 'merge', label: 'دمج PDF', icon: Merge, color: 'text-blue-400', desc: 'جمع عدة ملفات في ملف واحد' },
    { id: 'split', label: 'تقسيم PDF', icon: Split, color: 'text-purple-400', desc: 'استخراج صفحات معينة من الملف' },
    { id: 'pdfjpg', label: 'PDF إلى صور', icon: ImageIcon, color: 'text-emerald-400', desc: 'تحويل صفحات الملف إلى صور JPG' },
    { id: 'imagepdf', label: 'صور إلى PDF', icon: FileImage, color: 'text-orange-400', desc: 'تحويل الصور والمستندات إلى ملف PDF' },
  ];

  const currentTool = tools.find(t => t.id === tool) || tools[0];

  useEffect(() => {
    setMounted(true);
    // Explicitly rehydrate on mount
    useILovePDFStore.persist.rehydrate();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validFiles = selectedFiles.filter(f => {
        if (tool === 'imagepdf') return f.type.startsWith('image/');
        return f.type === 'application/pdf';
      });

      if (validFiles.length !== selectedFiles.length) {
        showToast(tool === 'imagepdf' ? 'يرجى اختيار صور فقط' : 'يرجى اختيار ملفات PDF فقط');
      }

      if (validFiles.length > 0) {
        addFiles(validFiles);
        const totalSize = [...files, ...validFiles].reduce((sum, f) => sum + f.size, 0);
        setStatus({ 
          stage: 'idle', progress: 0, message: '', originalSize: totalSize
        });
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card-base p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold via-accent to-gold" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center ${currentTool.color} shadow-lg shadow-gold/5 border border-gold/10`}>
              <currentTool.icon size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black font-cairo gold-text">أدوات iLovePDF</h1>
              <p className="text-muted text-sm mt-1 font-medium">{currentTool.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${status.stage === 'idle' ? 'bg-white/5 border-white/10 text-muted' : 'bg-gold/10 border-gold/20 text-gold shadow-glow'}`}>
              الحالة: {status.stage === 'idle' ? 'جاهز' : status.message}
            </div>
            {status.stage !== 'idle' && (
              <button 
                onClick={reset}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10 transition-all active:scale-95"
                title="إعادة تعيين"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tool Selector Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-bold text-muted px-2 mb-2 uppercase tracking-widest">اختر الأداة</h3>
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (status.stage !== 'idle' && status.stage !== 'completed' && status.stage !== 'error') {
                  showToast('يرجى الانتظار حتى اكتمال المهمة الحالية');
                  return;
                }
                setTool(t.id);
                reset();
              }}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-right ${tool === t.id ? 'bg-gold/10 border-gold/30 gold-text shadow-glow' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}
            >
              <t.icon size={20} className={tool === t.id ? 'text-gold' : 'text-muted'} />
              <div className="flex-1">
                <div className="font-bold text-sm tracking-tight">{t.label}</div>
              </div>
              {tool === t.id && <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1: File Selection */}
          <div className="md:col-span-1 space-y-6">
            <div className="card-base p-6 h-full flex flex-col">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gold/10 text-gold flex items-center justify-center text-xs font-black">1</span>
                اختيار الملفات
              </h2>
              
              <div className="flex-1 flex flex-col gap-4">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-gold/30 hover:bg-gold/5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload size={20} className="text-muted group-hover:text-gold" />
                  </div>
                  <div className="text-xs font-bold text-center">اضغط لإضافة {files.length > 0 ? 'المزيد' : 'ملفات'}</div>
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple={tool === 'merge' || tool === 'imagepdf'}
                    accept={tool === 'imagepdf' ? 'image/*' : '.pdf'} 
                    onChange={handleFileChange} 
                  />
                </label>

                {files.length > 0 && (
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] scrollbar-thin">
                    {files.map((f, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 relative group animate-fade-in">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${f.type.startsWith('image/') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {f.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[10px] truncate">{f.name}</div>
                            <div className="text-[10px] text-muted">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <button 
                            onClick={() => removeFile(i)}
                            className="p-1.5 text-muted hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {files.length > 0 && (status.stage === 'idle' || status.stage === 'error') && (
                  <button 
                    onClick={startTask}
                    className="btn-gold w-full py-4 font-black shadow-[0_0_20px_rgba(245,197,24,0.3)] mt-auto"
                  >
                    بدء {currentTool.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 2 & 3: Progress & Results */}
          <div className="md:col-span-2">
            {status.stage !== 'idle' ? (
              <div className="card-base p-8 h-full">
                <div className="max-w-md mx-auto h-full flex flex-col">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/10 text-gold mb-4 relative">
                      {status.stage === 'completed' ? (
                        <CheckCircle size={40} className="animate-scale-in text-green-500" />
                      ) : status.stage === 'error' ? (
                        <AlertTriangle size={40} className="text-red-500" />
                      ) : (
                        <div className="relative">
                          <Loader2 size={40} className="animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                            {status.progress}%
                          </div>
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-black font-cairo mb-2">{status.message}</h3>
                    {status.error && <p className="text-red-400 text-sm mt-2 p-3 bg-red-500/10 rounded-xl border border-red-500/10">{status.error}</p>}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-10">
                    <div className="flex justify-between text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">
                      <span>نسبة الإنجاز</span>
                      <span>{status.progress}%</span>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(245,197,24,0.3)] ${status.stage === 'completed' ? 'bg-green-500' : status.stage === 'error' ? 'bg-red-500' : 'bg-gold animate-pulse-glow'}`}
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Results Card */}
                  {status.stage === 'completed' && status.task && status.server && (
                    <div className="space-y-4 mt-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                          <div className="text-[10px] text-muted mb-1 font-bold">الحجم السابق</div>
                          <div className="text-lg font-black">{(status.originalSize / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gold/5 border border-gold/10 text-center">
                          <div className="text-[10px] text-gold mb-1 font-bold">الحجم الحالي</div>
                          <div className="text-lg font-black text-gold">
                            {status.compressedSize ? (status.compressedSize / 1024 / 1024).toFixed(2) : '—'} MB
                          </div>
                        </div>
                      </div>
                      
                      <a 
                        href={`/api/ilovepdf/download?task=${status.task}&server=${status.server}&fileName=${encodeURIComponent(status.fileName || (tool === 'pdfjpg' ? 'images.zip' : 'processed.pdf'))}`}
                        className="btn-gold w-full py-5 text-lg font-black flex items-center justify-center gap-3 shadow-2xl animate-bounce-subtle mt-4 text-black"
                      >
                        <Download size={22} /> تحميل الملف الجديد الآن
                      </a>
                      
                      <button 
                        onClick={reset}
                        className="w-full py-4 text-muted hover:text-white transition-colors text-sm font-bold"
                      >
                        القيام بعملية أخرى
                      </button>
                    </div>
                  )}
                  
                  {status.stage === 'error' && (
                    <button 
                      onClick={reset}
                      className="btn-danger w-full py-4 font-bold mt-auto"
                    >
                      حاول مرة أخرى
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-base p-12 h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted/30 mb-6 group-hover:scale-110 transition-transform">
                  <Activity size={48} />
                </div>
                <h3 className="text-xl font-bold text-muted mb-2">في انتظار بدء المهمة</h3>
                <p className="text-sm text-muted/60 max-w-xs">بمجرد اختيار الملف والضغط على زر البدء، ستظهر هنا تفاصيل المعالجة والنتائج</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
