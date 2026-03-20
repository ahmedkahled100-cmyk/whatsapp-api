'use client';
// src/app/teacher/tools/ilovepdf/page.tsx
// أداة ضغط ملفات PDF باستخدام iLovePDF مع معالجة في الخلفية

import { useState, useEffect } from 'react';
import { useILovePDFStore } from '@/lib/ilovepdf-store';
import { showToast } from '@/lib/toast';
import { 
  Zap, Upload, FileText, X, RefreshCw, 
  CheckCircle, Loader2, Download, AlertTriangle, Activity,
  Split, Merge, Image as ImageIcon, FileImage, Stamp, Hash, 
  RotateCw, ShieldCheck, Lock, Languages, Settings2, Info,
  Eye, ChevronUp, ChevronDown, Palette, Maximize2, Type, 
  Layout, AlignCenter, AlignLeft, AlignRight, EyeOff
} from 'lucide-react';

export default function ILovePDFPage() {
  const { files, addFiles, removeFile, setFiles, tool, setTool, toolSettings, setToolSettings, status, setStatus, startTask, reset } = useILovePDFStore();
  const [mounted, setMounted] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string; type: string } | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const tools = [
    { id: 'compress', label: 'ضغط PDF', icon: Zap, color: 'text-gold', desc: 'تقليل حجم الملف مع الحفاظ على الجودة العالية' },
    { id: 'merge', label: 'دمج PDF', icon: Merge, color: 'text-blue-400', desc: 'دمج ملفات PDF متعددة في مستند واحد مرتب' },
    { id: 'split', label: 'تقسيم PDF', icon: Split, color: 'text-purple-400', desc: 'استخراج صفحات معينة أو تقسيم الملف إلى أجزاء' },
    { id: 'editpdf', label: 'تعديل PDF', icon: Settings2, color: 'text-indigo-400', desc: 'إضافة نصوص وصور وأشكال للمستند' },
    { id: 'watermark', label: 'علامة مائية', icon: Stamp, color: 'text-pink-400', desc: 'إضافة نص أو صورة كعلامة مائية لحماية الملكية' },
    { id: 'pagenumber', label: 'ترقيم الصفحات', icon: Hash, color: 'text-indigo-400', desc: 'إضافة أرقام الصفحات بتنسيقات احترافية' },
    { id: 'organize', label: 'تنظيم PDF', icon: Activity, color: 'text-orange-400', desc: 'إعادة ترتيب الصفحات، حذفها، أو تدويرها' },
    { id: 'rotate', label: 'تدوير PDF', icon: RotateCw, color: 'text-cyan-400', desc: 'تدوير صفحات الملف في اتجاهات محددة' },
    { id: 'pdfjpg', label: 'PDF إلى صور', icon: ImageIcon, color: 'text-emerald-400', desc: 'تحويل صفحات الملف إلى صور JPG عالية الدقة' },
    { id: 'imagepdf', label: 'صور إلى PDF', icon: FileImage, color: 'text-orange-400', desc: 'تحويل الصور والمستندات الورقية إلى PDF' },
    { id: 'ocr', label: 'OCR (نصوص)', icon: Languages, color: 'text-lime-400', desc: 'تحويل النصوص الممسوحة ضوئياً إلى نصوص قابلة للبحث' },
    { id: 'protect', label: 'حماية PDF', icon: Lock, color: 'text-red-400', desc: 'تشفير وحماية الملف بكلمة مرور قوية' },
  ];

  const currentTool = tools.find(t => t.id === tool) || tools[0];

  useEffect(() => {
    setMounted(true);
    useILovePDFStore.persist.rehydrate();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validFiles = selectedFiles.filter(f => {
        if (tool === 'imagepdf') return f.type.startsWith('image/');
        return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
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

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFiles.length) return;
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setFiles(newFiles);
  };

  const openPreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewFile({ file, url, type: file.type });
  };

  const closePreview = () => {
    if (previewFile) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const renderAdvancedSettings = () => {
    const settings = toolSettings[tool] || {};

    if (tool === 'compress') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">مستوى الضغط</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'extreme', label: 'ضغط فائق', desc: 'أقل حجم ممكن، جودة أقل' },
                { id: 'recommended', label: 'ضغط مستحسن', desc: 'توازن مثالي بين الجودة والحجم' },
                { id: 'low', label: 'ضغط منخفض', desc: 'جودة عالية، حجم أكبر قليلاً' }
              ].map(level => (
                <button 
                  key={level.id}
                  onClick={() => setToolSettings({ ...settings, compression_level: level.id })}
                  className={`p-3 rounded-xl border text-right transition-all group ${settings.compression_level === level.id ? 'bg-gold/10 border-gold/40 shadow-glow' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className={`text-xs font-black ${settings.compression_level === level.id ? 'text-gold' : 'text-white'}`}>{level.label}</div>
                  <div className="text-[10px] text-muted font-medium mt-1">{level.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (tool === 'watermark') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider flex items-center gap-2">
                <Type size={14} className="text-gold" /> نص العلامة المائية
              </label>
              <input 
                type="text" 
                value={settings.text || ''} 
                onChange={(e) => setToolSettings({ ...settings, text: e.target.value })}
                className="input-base text-sm h-10 w-full"
                placeholder="مثال: AN Academy"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider flex items-center gap-2">
                <Palette size={14} className="text-gold" /> الشفافية ({settings.transparency || 50}%)
              </label>
              <input 
                type="range" min="10" max="100" step="10"
                value={settings.transparency || 50} 
                onChange={(e) => setToolSettings({ ...settings, transparency: parseInt(e.target.value) })}
                className="w-full accent-gold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider flex items-center gap-2">
                <Maximize2 size={14} className="text-gold" /> حجم الخط ({settings.size || 40})
              </label>
              <input 
                type="number" 
                value={settings.size || 40} 
                onChange={(e) => setToolSettings({ ...settings, size: parseInt(e.target.value) })}
                className="input-base text-sm h-10 w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider flex items-center gap-2">
              <Layout size={14} className="text-gold" /> الموضع في الصفحة
            </label>
            <div className="grid grid-cols-3 gap-1.5 max-w-[180px] bg-black/40 p-2 rounded-xl border border-white/5">
              {[
                { id: 'Top Left', icon: AlignLeft }, { id: 'Top Center', icon: AlignCenter }, { id: 'Top Right', icon: AlignRight },
                { id: 'Center Left', icon: AlignLeft }, { id: 'Center', icon: AlignCenter }, { id: 'Center Right', icon: AlignRight },
                { id: 'Bottom Left', icon: AlignLeft }, { id: 'Bottom Center', icon: AlignCenter }, { id: 'Bottom Right', icon: AlignRight }
              ].map((pos, idx) => (
                <button 
                  key={idx}
                  onClick={() => setToolSettings({ ...settings, position: pos.id })}
                  className={`aspect-square rounded-lg border flex items-center justify-center transition-all ${settings.position === pos.id ? 'bg-gold border-gold text-dark' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}
                  title={pos.id}
                >
                   <pos.icon size={12} className={idx % 3 === 0 ? '' : idx % 3 === 1 ? '' : ''} />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (tool === 'pagenumber') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">تنسيق النص</label>
            <input 
              type="text" 
              value={settings.format || '{page}'} 
              onChange={(e) => setToolSettings({ ...settings, format: e.target.value })}
              className="input-base text-sm h-10 w-full"
              placeholder="مثال: صفحة {page} من {total}"
            />
            <p className="text-[10px] text-muted/60 mt-1">استخدم {'{page}'} للصفحة الحالية و {'{total}'} للإجمالي</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">البداية من</label>
              <input 
                type="number" 
                value={settings.startNumber || 1} 
                onChange={(e) => setToolSettings({ ...settings, startNumber: parseInt(e.target.value) })}
                className="input-base text-sm h-10 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">الموضع</label>
              <select 
                value={settings.position || 'Bottom Center'} 
                onChange={(e) => setToolSettings({ ...settings, position: e.target.value })}
                className="input-base text-sm h-10 w-full appearance-none bg-dark/40"
              >
                <option value="Top Left">أعلى اليسار</option>
                <option value="Top Center">أعلى الوسط</option>
                <option value="Top Right">أعلى اليمين</option>
                <option value="Bottom Left">أسفل اليسار</option>
                <option value="Bottom Center">أسفل الوسط</option>
                <option value="Bottom Right">أسفل اليمين</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    if (tool === 'split') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">نطاق الصفحات</label>
            <input 
              type="text" 
              value={settings.ranges || '1-end'} 
              onChange={(e) => setToolSettings({ ...settings, ranges: e.target.value })}
              className="input-base text-sm h-10 w-full"
              placeholder="مثال: 1, 2-5, 8"
            />
            <p className="text-[10px] text-muted/60 mt-1">أدخل نطاقات الصفحات مفصولة بفواصل</p>
          </div>
        </div>
      );
    }

    if (tool === 'protect') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">كلمة المرور</label>
            <div className="relative group">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={settings.password || ''} 
                onChange={(e) => setToolSettings({ ...settings, password: e.target.value })}
                className="input-base text-sm h-12 w-full pl-10 pr-10"
                placeholder="أدخل كلمة مرور قوية..."
              />
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-hover:text-gold transition-colors" />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
                title={showPassword ? 'إخفاء' : 'إظهار'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-red-400/60 mt-2 font-bold flex gap-1 items-center">
              <AlertTriangle size={10} />
              تأكد من حفظ كلمة المرور جيداً لحماية ملفك
            </p>
          </div>
        </div>
      );
    }

    if (tool === 'ocr') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">لغة التعرف</label>
            <select 
              value={settings.language || 'ara'} 
              onChange={(e) => setToolSettings({ ...settings, language: e.target.value })}
              className="input-base text-sm h-10 w-full appearance-none bg-dark/40"
            >
              <option value="ara">العربية</option>
              <option value="eng">الإنجليزية</option>
              <option value="fra">الفرنسية</option>
              <option value="deu">الألمانية</option>
            </select>
          </div>
          <div className="p-4 bg-gold/5 border border-gold/10 rounded-2xl">
            <div className="flex gap-2 text-[10px] text-gold font-black mb-2 uppercase tracking-tight">
              <Info size={12} />
              <span>تقنية OCR المتقدمة</span>
            </div>
            <p className="text-[10px] text-muted/80 leading-relaxed font-medium">
              سيتم تحويل المستندات الممسوحة ضوئياً إلى ملفات PDF قابلة للبحث والتعامل مع النصوص بدقة عالية.
            </p>
          </div>
        </div>
      );
    }

    if (tool === 'rotate') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">زاوية التدوير</label>
            <div className="grid grid-cols-3 gap-2">
              {[90, 180, 270].map(deg => (
                <button 
                  key={deg}
                  onClick={() => setToolSettings({ ...settings, angle: deg })}
                  className={`py-3 rounded-xl border text-xs font-black transition-all ${settings.angle === deg ? 'bg-gold/10 border-gold/40 text-gold shadow-glow' : 'bg-white/5 border-white/10 text-muted hover:border-gold/20'}`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (tool === 'pdfjpg') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">دقة الصور (DPI)</label>
            <div className="grid grid-cols-3 gap-2">
              {[96, 150, 300].map(dpi => (
                <button 
                  key={dpi}
                  onClick={() => setToolSettings({ ...settings, dpi })}
                  className={`py-3 rounded-xl border text-xs font-black transition-all ${settings.dpi === dpi ? 'bg-gold/10 border-gold/40 text-gold shadow-glow' : 'bg-white/5 border-white/10 text-muted hover:border-gold/20'}`}
                >
                  {dpi} DPI
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted/60 mt-2">DPI أعلى يعني جودة أفضل وحجم ملف أكبر</p>
          </div>
        </div>
      );
    }

    if (tool === 'imagepdf') {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">الاتجاه</label>
              <select 
                value={settings.orientation || 'portrait'} 
                onChange={(e) => setToolSettings({ ...settings, orientation: e.target.value })}
                className="input-base text-sm h-10 w-full appearance-none bg-dark/40"
              >
                <option value="portrait">طولي (Portrait)</option>
                <option value="landscape">عرضي (Landscape)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">الهوامش</label>
              <select 
                value={settings.margin || 0} 
                onChange={(e) => setToolSettings({ ...settings, margin: parseInt(e.target.value) })}
                className="input-base text-sm h-10 w-full appearance-none bg-dark/40"
              >
                <option value="0">بدون هوامش</option>
                <option value="10">هوامش ضيقة</option>
                <option value="20">هوامش واسعة</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted mb-2 block uppercase tracking-wider">حجم الصفحة</label>
            <select 
              value={settings.pagesize || 'fit'} 
              onChange={(e) => setToolSettings({ ...settings, pagesize: e.target.value })}
              className="input-base text-sm h-10 w-full appearance-none bg-dark/40"
            >
              <option value="fit">نفس حجم الصور (Fit)</option>
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="letter">Letter (216 x 279 mm)</option>
            </select>
          </div>
        </div>
      );
    }

    if (tool === 'merge') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-blue-500/5 rounded-2xl border border-dashed border-blue-500/20">
          <FileText size={24} className="text-blue-400/30 mb-3" />
          <h4 className="text-xs font-black text-blue-400/80 mb-1">ترتيب المستندات</h4>
          <p className="text-[10px] text-muted/60 font-medium leading-relaxed">
            سيتم دمج الملفات حسب ترتيب اختيارها في القائمة أدناه. يمكنك إعادة المحاولة إذا أردت ترتيباً مختلفاً.
          </p>
        </div>
      );
    }

    if (tool === 'organize' || tool === 'editpdf') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gold/5 rounded-2xl border border-dashed border-gold/20">
          <Activity size={24} className="text-gold/30 mb-3 animate-pulse" />
          <h4 className="text-xs font-black text-gold/80 mb-1">المعالجة الذكية نشطة</h4>
          <p className="text-[10px] text-muted/60 font-medium leading-relaxed">
            تستخدم هذه الأداة الذكاء الاصطناعي لمعالجة الملف بشكل تلقائي بأفضل الإعدادات المتاحة.
          </p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white/5 rounded-2xl border border-dashed border-white/10">
        <Settings2 size={24} className="text-muted/30 mb-2" />
        <p className="text-xs text-muted/60 font-medium">لا توجد إعدادات إضافية لهذه الأداة</p>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20" dir="rtl">
      {/* Header */}
      <div className="card-base p-8 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold via-accent to-gold group-hover:h-1.5 transition-all" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center ${currentTool.color} shadow-lg shadow-gold/5 border border-gold/15 group-hover:scale-105 transition-transform`}>
              <currentTool.icon size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black font-cairo gold-text">محرر iLovePDF الذكي</h1>
              <p className="text-muted text-sm mt-1 font-medium">{currentTool.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2.5 rounded-2xl border text-[11px] font-black tracking-wider transition-all shadow-sm ${status.stage === 'idle' ? 'bg-white/5 border-white/10 text-muted uppercase' : 'bg-gold/10 border-gold/20 text-gold shadow-glow'}`}>
              <span className="opacity-60 ml-2">الحالة:</span> 
              {status.stage === 'idle' ? 'بانتظار ملفاتك' : status.message}
            </div>
            {status.stage !== 'idle' && (
              <button 
                onClick={reset}
                className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10 transition-all flex items-center justify-center active:scale-95 shadow-lg"
                title="إعادة تعيين"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tool Selector Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-sm font-bold text-muted px-4 mb-1 uppercase tracking-[0.2em]">الأدوات المتاحة</h3>
          <div className="grid grid-cols-1 gap-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/20">
            {tools.map((t: any) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.status === 'COMING_SOON') {
                    showToast('هذه الأداة ستتوفر قريباً');
                    return;
                  }
                  if (status.stage !== 'idle' && status.stage !== 'completed' && status.stage !== 'error') {
                    showToast('يرجى الانتظار حتى اكتمال المهمة الحالية');
                    return;
                  }
                  setTool(t.id);
                  if (status.stage === 'completed' || status.stage === 'error') reset();
                }}
                className={`w-full group/item flex items-center gap-4 p-4 rounded-2xl border transition-all text-right relative overflow-hidden ${tool === t.id ? 'bg-gold/10 border-gold/40 gold-text shadow-glow ring-1 ring-gold/20' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:border-white/20'} ${t.status === 'COMING_SOON' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 transition-transform group-hover/item:scale-110 ${tool === t.id ? t.color + ' bg-gold/5' : 'text-muted'}`}>
                  <t.icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-black text-sm tracking-tight flex items-center gap-2">
                    {t.label}
                    {t.status === 'COMING_SOON' && (
                      <span className="text-[8px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full border border-white/5">قريباً</span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-40 font-bold hidden group-hover/item:block transition-all">
                    {t.status === 'COMING_SOON' ? 'غير متوفر حالياً' : 'انقر للاختيار'}
                  </div>
                </div>
                {tool === t.id && (
                  <div className="absolute left-4 w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Step 1: File Selection & Configuration */}
          <div className="md:col-span-5 space-y-6">
            <div className="card-base p-6 shadow-xl border border-white/10">
              <h2 className="text-xl font-black mb-6 flex items-center gap-3 font-cairo">
                <span className="w-8 h-8 rounded-xl bg-gold text-dark flex items-center justify-center text-sm font-black shadow-lg shadow-gold/20">1</span>
                إعداد المهمة
              </h2>
              
              <div className="space-y-6">
                {/* Upload Section */}
                <div>
                  <label className="text-xs font-bold text-muted mb-3 block uppercase tracking-wider">رفع الملفات</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-8 cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-all group/upload relative overflow-hidden">
                    <div className="absolute inset-0 bg-gold/5 scale-0 group-hover/upload:scale-100 transition-transform duration-500 rounded-full" />
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover/upload:scale-110 group-hover/upload:bg-gold/20 transition-all border border-white/5 group-hover/upload:border-gold/30">
                        <Upload size={24} className="text-muted group-hover/upload:text-gold" />
                      </div>
                      <div className="text-sm font-black text-center">{files.length > 0 ? 'إضافة ملفات أخرى' : 'اختر ملفاتك الآن'}</div>
                      <div className="text-[10px] text-muted mt-2 font-bold opacity-60 text-center">
                        {tool === 'imagepdf' ? 'JPG, PNG, WEBP (حتى 10MB)' : 'ملفات PDF فقط'}
                      </div>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple={['merge', 'imagepdf', 'rotate'].includes(tool)}
                      accept={tool === 'imagepdf' ? 'image/*' : '.pdf'} 
                      onChange={handleFileChange} 
                    />
                  </label>
                </div>

                {/* Advanced Settings Section */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">إعدادات متقدمة</label>
                    <Settings2 size={14} className="text-muted opacity-40" />
                  </div>
                  <div className="bg-black/20 rounded-2xl p-5 border border-white/5 min-h-[160px]">
                    {renderAdvancedSettings()}
                  </div>
                </div>

                {/* Action Button */}
                {files.length > 0 && (status.stage === 'idle' || status.stage === 'error' || status.stage === 'completed') && (
                  <button 
                    onClick={startTask}
                    className="btn-gold w-full py-5 font-black shadow-[0_10px_30px_rgba(245,197,24,0.3)] hover:shadow-gold/40 active:scale-[0.98] transition-all text-lg group/btn"
                  >
                    <span className="flex items-center justify-center gap-3">
                      بدء عملية {currentTool.label}
                      <Zap size={20} className="group-hover/btn:animate-pulse" />
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div className="card-base p-6 border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest">الملفات المختارة ({files.length})</h3>
                  <button onClick={() => setFiles([])} className="text-[10px] font-bold text-red-400/60 hover:text-red-400 transition-colors uppercase">مسح الكل</button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gold/20">
                  {files.map((f, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 relative group/file hover:bg-white/10 transition-all hover:border-gold/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${f.type.startsWith('image/') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {f.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-xs truncate mb-0.5">{f.name}</div>
                          <div className="text-[9px] text-muted font-mono tracking-tighter">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                          {tool === 'merge' && (
                            <div className="flex flex-col gap-0.5 mr-2">
                              <button onClick={() => moveFile(i, 'up')} disabled={i === 0} className="p-1 text-muted hover:text-gold disabled:opacity-20"><ChevronUp size={14} /></button>
                              <button onClick={() => moveFile(i, 'down')} disabled={i === files.length - 1} className="p-1 text-muted hover:text-gold disabled:opacity-20"><ChevronDown size={14} /></button>
                            </div>
                          )}
                          <button 
                            onClick={() => openPreview(f)}
                            className="p-2 text-muted hover:text-gold hover:bg-gold/10 rounded-lg transition-all"
                            title="معاينة"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => removeFile(i)}
                            className="p-2 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="حذف"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2 & 3: Workspace / Results */}
          <div className="md:col-span-7 h-full">
            <div className="card-base p-8 h-full min-h-[500px] flex flex-col relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] -ml-32 -mb-32 pointer-events-none" />
               
                <h2 className="text-xl font-black mb-10 flex items-center justify-between gap-3 font-cairo relative z-10 w-full">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-gold text-dark flex items-center justify-center text-sm font-black shadow-lg shadow-gold/20">2</span>
                    المساحة التفاعلية
                  </div>
                  {files.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted font-bold bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                      <FileText size={14} className="text-gold" />
                      {files[0].name.length > 20 ? files[0].name.slice(0, 20) + '...' : files[0].name}
                    </div>
                  )}
                </h2>

              <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 w-full px-4">
                {status.stage !== 'idle' ? (
                  <div className="max-w-md w-full animate-fade-in flex flex-col items-center">
                    <div className="relative mb-12">
                      <div className="w-40 h-40 rounded-full border border-white/5 flex items-center justify-center relative">
                        {/* Interactive Circle Progress */}
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="80" cy="80" r="76"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-white/5"
                          />
                          <circle
                            cx="80" cy="80" r="76"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray={477}
                            strokeDashoffset={477 - (477 * status.progress) / 100}
                            className={`transition-all duration-500 rounded-full ${status.stage === 'completed' ? 'text-green-500' : status.stage === 'error' ? 'text-red-500' : 'text-gold'}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        
                        <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-full animate-pulse-glow ${status.stage === 'completed' ? 'shadow-[0_0_40px_rgba(34,197,94,0.2)]' : ''}`}>
                          {status.stage === 'completed' ? (
                            <CheckCircle size={64} className="text-green-500 animate-scale-in" />
                          ) : status.stage === 'error' ? (
                            <AlertTriangle size={64} className="text-red-500" />
                          ) : (
                            <>
                              <div className="text-3xl font-black font-mono text-gold mb-1">{status.progress}%</div>
                              <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">جارٍ العمل</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-2xl font-black font-cairo mb-3">{status.message}</h3>
                    {status.error && (
                      <div className="text-red-400 text-sm mt-4 p-5 bg-red-500/10 rounded-2xl border border-red-500/15 w-full flex items-start gap-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{status.error}</span>
                      </div>
                    )}

                    {/* Completion Info */}
                    {status.stage === 'completed' && status.task && (
                      <div className="w-full mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
                            <div className="text-[11px] text-muted mb-2 font-black uppercase tracking-wider">الحجم الأصلي</div>
                            <div className="text-xl font-black">{(status.originalSize / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <div className="p-5 rounded-3xl bg-gold/5 border border-gold/15 backdrop-blur-md">
                            <div className="text-[11px] text-gold mb-2 font-black uppercase tracking-wider">الحجم النهائي</div>
                            <div className="text-xl font-black text-gold">
                              {status.compressedSize ? (status.compressedSize / 1024 / 1024).toFixed(2) : '—'} MB
                            </div>
                          </div>
                        </div>
                        
                        <a 
                          href={`/api/ilovepdf/download?task=${status.task}&server=${status.server}&fileName=${encodeURIComponent(status.fileName || 'document.pdf')}`}
                          className="btn-gold w-full py-6 text-xl font-black flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(245,197,24,0.3)] hover:shadow-gold/50 animate-bounce-subtle text-dark"
                        >
                          <Download size={24} /> تحميل ملفك الآن
                        </a>
                        
                        <p className="text-[10px] text-muted font-bold tracking-widest uppercase opacity-40">سيتم حذف الملف من خوادمنا تلقائياً خلال 60 دقيقة</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-sm flex flex-col items-center group/empty">
                    <div className="w-40 h-40 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-muted/20 mb-10 group-hover/empty:scale-105 group-hover/empty:bg-gold/5 group-hover/empty:border-gold/15 transition-all duration-700 relative">
                      <div className="absolute inset-0 border border-gold/5 rounded-3xl animate-ping opacity-20" />
                      <Activity size={80} className="group-hover/empty:text-gold/20 transition-colors" />
                    </div>
                    <h3 className="text-2xl font-black text-muted/80 mb-4 font-cairo">ببساطة.. ابدأ الآن</h3>
                    <p className="text-sm text-muted/60 leading-relaxed font-medium">
                      قم برفع الملفات من القائمة الجانبية، حدد الإعدادات المفضلة، ثم اضغط على زر البدء لمشاهدة السحر.
                    </p>
                  </div>
                )}
              </div>

              {/* Workspace Background Decoration */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gold/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 animate-fade-in">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={closePreview} />
          <div className="relative w-full max-w-5xl h-full bg-[#0a0f1c] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                   {previewFile.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white truncate max-w-[200px] sm:max-w-md">{previewFile.file.name}</h3>
                  <p className="text-[10px] text-muted font-bold">{(previewFile.file.size / 1024 / 1024).toFixed(2)} MB • {previewFile.type}</p>
                </div>
              </div>
              <button onClick={closePreview} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/10">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center p-4 relative group">
              {previewFile.type.startsWith('image/') ? (
                <img src={previewFile.url} alt={previewFile.file.name} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
              ) : previewFile.type === 'application/pdf' ? (
                <iframe src={previewFile.url} className="w-full h-full rounded-lg border-none" title="PDF Preview" />
              ) : (
                <div className="text-center space-y-4">
                  <EyeOff size={64} className="text-muted/20 mx-auto" />
                  <p className="text-sm text-muted">عذراً، لا يمكن معاينة هذا النوع من الملفات بصرياً.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 flex justify-end bg-white/5">
              <button onClick={closePreview} className="btn-gold px-8 py-2.5 text-xs font-black">إغلاق المعاينة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
