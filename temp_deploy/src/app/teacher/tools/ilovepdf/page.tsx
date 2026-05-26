'use client';
// src/app/teacher/tools/ilovepdf/page.tsx

import { useState, useEffect, useRef } from 'react';
import { useILovePDFStore } from '@/lib/ilovepdf-store';
import { showToast } from '@/lib/toast';
import {
  Download, FileText, Upload, X, Activity, CheckCircle, AlertTriangle, Send,
  ChevronDown, BookOpen, ClipboardList, Bot, Layout, Zap,
  Split, Image as ImageIcon, FileImage, Stamp, Hash, RotateCw, Lock,
  Languages, Settings2, Info, Eye, EyeOff, Type,
  AlignCenter, AlignLeft, AlignRight, RefreshCw, Sparkles,
  ArrowRight, ChevronUp, Move, MousePointer, Plus, Trash2, Edit3,
  ZoomIn, ZoomOut, Maximize2, Copy, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────
interface TextElement {
  id: string;
  text: string;
  x: number; // % of preview width
  y: number; // % of preview height
  fontSize: number;
  color: string;
  pages: string;
  pdfX?: number; // PDF coordinate (set at process time)
  pdfY?: number;
}

function MergeIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="m9 9 6 6" /><path d="m15 9-6 6" />
    </svg>
  );
}

const TOOLS = [
  { id: 'compress', label: 'ضغط PDF', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', desc: 'تقليل حجم الملف مع الحفاظ على الجودة العالية' },
  { id: 'merge', label: 'دمج PDF', icon: MergeIcon, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', desc: 'دمج ملفات PDF متعددة في مستند واحد مرتب' },
  { id: 'split', label: 'تقسيم PDF', icon: Split, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30', desc: 'استخراج صفحات معينة أو تقسيم الملف إلى أجزاء' },
  { id: 'editpdf', label: 'تعديل PDF', icon: Type, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/30', desc: 'انقر على الملف لإضافة نصوص وعناصر تفاعلية' },
  { id: 'watermark', label: 'علامة مائية', icon: Stamp, color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/30', desc: 'إضافة نص أو صورة كعلامة مائية لحماية الملكية' },
  { id: 'pagenumber', label: 'ترقيم الصفحات', icon: Hash, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/30', desc: 'إضافة أرقام الصفحات بتنسيقات احترافية' },
  { id: 'pdfoffice', label: 'PDF إلى Word', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', desc: 'تحويل ملف PDF إلى مستند Word قابل للتعديل باحترافية' },
  { id: 'pdfocr', label: 'OCR نصوص', icon: Languages, color: 'text-lime-400', bg: 'bg-lime-400/10', border: 'border-lime-400/30', desc: 'تحويل النصوص الممسوحة ضوئياً إلى نصوص قابلة للبحث' },
  { id: 'organize', label: 'تنظيم PDF', icon: Activity, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', desc: 'إعادة ترتيب الصفحات، حذفها، أو تدويرها' },
  { id: 'rotate', label: 'تدوير PDF', icon: RotateCw, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', desc: 'تدوير صفحات الملف في اتجاهات محددة' },
  { id: 'pdfjpg', label: 'PDF إلى صور', icon: ImageIcon, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', desc: 'تحويل صفحات الملف إلى صور JPG عالية الدقة' },
  { id: 'imagepdf', label: 'صور إلى PDF', icon: FileImage, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', desc: 'تحويل الصور والمستندات الورقية إلى PDF' },
  { id: 'protect', label: 'حماية PDF', icon: Lock, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', desc: 'تشفير وحماية الملف بكلمة مرور قوية' },
];

const TRANSFER_DESTINATIONS = [
  { label: 'إضافة كمادة بالكورسات', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-400/10', path: `/teacher/courses?prefillUrl={{URL}}&prefillName={{NAME}}&prefillType=pdf` },
  { label: 'إضافة كواجب جديد', icon: ClipboardList, color: 'text-purple-400', bg: 'bg-purple-400/10', path: `/teacher/assignments?prefillUrl={{URL}}&prefillTitle={{NAME}}` },
  { label: 'تلخيص بالذكاء الاصطناعي', icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-400/10', path: `/teacher/ai?prefillUrl={{URL}}&prefillName={{NAME}}&mode=summary` },
  { label: 'بنك الأسئلة (QBank)', icon: Layout, color: 'text-yellow-400', bg: 'bg-yellow-400/10', path: `/teacher/qbank?prefillUrl={{URL}}` },
];

function formatBytes(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getSavingsPercent(orig?: number, comp?: number) {
  if (!orig || !comp || orig === 0) return 0;
  return Math.max(0, Math.round(((orig - comp) / orig) * 100));
}

// ── PDF Interactive Editor Component ──────────────────────────────────────────
function PDFInteractiveEditor({
  file, textElements, onChange, activeSettings
}: {
  file: File;
  textElements: TextElement[];
  onChange: (elements: TextElement[]) => void;
  activeSettings: any;
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [zoom, setZoom] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingId) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const defaultText = activeSettings.text || 'نص جديد';
    const newEl: TextElement = {
      id: `el-${Date.now()}`,
      text: defaultText,
      x: xPct,
      y: yPct,
      fontSize: activeSettings.size || 14,
      color: activeSettings.color || '#FFD700',
      pages: 'all',
    };
    onChange([...textElements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(textElements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (id: string, currentText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditText(currentText);
    setSelectedId(id);
  };

  const commitEdit = (id: string) => {
    onChange(textElements.map(el => el.id === id ? { ...el, text: editText } : el));
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-muted hover:text-white transition-colors">
              <ZoomIn size={13} />
            </button>
            <span className="text-[10px] font-black text-muted/70 px-2">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-muted hover:text-white transition-colors">
              <ZoomOut size={13} />
            </button>
          </div>
          <button onClick={() => setZoom(1)} className="text-[10px] text-muted/60 hover:text-white transition-colors font-bold px-2">إعادة ضبط</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-black">
            <MousePointer size={11} />
            <span>انقر على الملف لإضافة نص</span>
          </div>
          {textElements.length > 0 && (
            <span className="bg-indigo-400/10 border border-indigo-400/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full">
              {textElements.length} عنصر
            </span>
          )}
        </div>
      </div>

      {/* PDF Canvas Area */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-[#1a1a2e] relative"
        style={{ minHeight: 400 }}>
        <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: 'top right', minWidth: '100%' }}>
          {/* PDF iframe */}
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full block pointer-events-none select-none"
            style={{ minHeight: 500, height: 700, border: 'none' }}
            title="PDF Preview"
          />

          {/* Click overlay */}
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="absolute inset-0 cursor-crosshair"
            style={{ zIndex: 10 }}
          >
            {/* Text Elements */}
            {textElements.map(el => (
              <div
                key={el.id}
                onClick={e => { e.stopPropagation(); setSelectedId(el.id); setEditingId(null); }}
                className={`absolute group transition-all select-none ${selectedId === el.id ? 'outline outline-2 outline-indigo-400/60 outline-offset-2' : ''}`}
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                  maxWidth: '80%',
                }}
              >
                {editingId === el.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => commitEdit(el.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(el.id); if (e.key === 'Escape') setEditingId(null); }}
                    className="border-0 outline-none bg-white/10 backdrop-blur-sm rounded px-2 py-1 font-cairo text-white"
                    style={{ fontSize: el.fontSize, color: el.color, minWidth: 80 }}
                  />
                ) : (
                  <div
                    className="relative px-2 py-1 rounded bg-black/20 backdrop-blur-sm border border-white/10 cursor-move"
                    style={{ fontSize: el.fontSize, color: el.color, whiteSpace: 'nowrap', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
                    onDoubleClick={e => startEdit(el.id, el.text, e)}
                  >
                    {el.text}

                    {/* Action buttons on hover/select */}
                    {selectedId === el.id && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1a1f2e] border border-white/15 rounded-lg px-1 py-1 shadow-xl whitespace-nowrap z-50">
                        <button onClick={e => startEdit(el.id, el.text, e)}
                          className="w-6 h-6 rounded-md hover:bg-indigo-400/20 flex items-center justify-center text-indigo-400 transition-colors" title="تعديل">
                          <Edit3 size={11} />
                        </button>
                        <button onClick={e => handleDelete(el.id, e)}
                          className="w-6 h-6 rounded-md hover:bg-red-400/20 flex items-center justify-center text-red-400 transition-colors" title="حذف">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend: elements list */}
      {textElements.length > 0 && (
        <div className="shrink-0 bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] font-black text-muted/50 uppercase tracking-wider mb-2">العناصر المضافة ({textElements.length})</p>
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {textElements.map((el, i) => (
              <div key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedId === el.id ? 'bg-indigo-400/10 border border-indigo-400/20' : 'hover:bg-white/5'}`}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: el.color }} />
                <span className="text-xs font-bold flex-1 truncate">{el.text}</span>
                <span className="text-[9px] text-muted/40">صـ {el.pages}</span>
                <button onClick={e => handleDelete(el.id, e)} className="text-muted/30 hover:text-red-400 transition-colors">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ILovePDFPage() {
  const {
    files, addFiles, removeFile, setFiles, tool, setTool,
    toolSettings, setToolSettings, status, setStatus,
    startTask, reset, saveToCloud
  } = useILovePDFStore();

  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStep, setTransferStep] = useState<'idle' | 'uploading' | 'preparing' | 'redirecting'>('idle');
  const [targetName, setTargetName] = useState('');
  const [showTransferMenu, setShowTransferMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const transferMenuRef = useRef<HTMLDivElement>(null);
  
  // OCR Text Extraction State
  const [extractedText, setExtractedText] = useState<string>('');
  const [isExtractingText, setIsExtractingText] = useState(false);

  // PDF Editor specific state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const router = useRouter();

  const currentTool = TOOLS.find(t => t.id === tool) || TOOLS[0];
  const CurrentToolIcon = currentTool.icon;
  const settings = toolSettings[tool] || {};
  const isEditMode = tool === 'editpdf' && files.length > 0 && status.stage === 'idle';

  useEffect(() => {
    setMounted(true);
    useILovePDFStore.persist.rehydrate();
  }, []);

  // Reset text elements when tool changes or files reset
  useEffect(() => {
    if (tool !== 'editpdf') setTextElements([]);
  }, [tool]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (transferMenuRef.current && !transferMenuRef.current.contains(e.target as Node)) {
        setShowTransferMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Logic to extract text after OCR is completed
  useEffect(() => {
    const { stage, task, server, fileName } = status;
    if (stage === 'completed' && tool === 'pdfocr' && task && server && !extractedText && !isExtractingText) {
      const fetchExtractedText = async () => {
        setIsExtractingText(true);
        try {
          // Must use POST since extract-text route only accepts POST
          const res = await fetch('/api/ilovepdf/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, server, fileName: fileName || 'ocr_result.pdf' }),
          });
          if (!res.ok) throw new Error('Failed to extract text');
          const data = await res.json();
          if (data.success && data.text) {
            setExtractedText(data.text);
            showToast(`✨ تم استخراج ${data.wordCount || 0} كلمة من ${data.pageCount || 0} صفحة`);
          } else if (!data.success) {
            throw new Error(data.error || 'فشل استخراج النصوص');
          }
        } catch (err: any) {
          console.error('OCR Extraction error:', err);
          showToast('⚠️ ' + (err.message || 'فشل استخراج النصوص للعرض المباشر'));
        } finally {
          setIsExtractingText(false);
        }
      };
      fetchExtractedText();
    }
    // Reset extracted text if tool changes back from OCR or if reset
    if (stage === 'idle' && extractedText) {
      setExtractedText('');
    }
  }, [status, tool, extractedText, isExtractingText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const valid = selected.filter(f =>
      tool === 'imagepdf' ? f.type.startsWith('image/') : f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (valid.length !== selected.length) showToast(tool === 'imagepdf' ? 'يرجى اختيار صور فقط' : 'يرجى اختيار ملفات PDF فقط');
    if (valid.length > 0) {
      addFiles(valid);
      setStatus({ stage: 'idle', progress: 0, message: '', originalSize: [...files, ...valid].reduce((s, f) => s + f.size, 0) });
      if (tool === 'editpdf') setTextElements([]); // reset elements for new file
    }
    e.target.value = '';
  };

  const handleTransfer = async (dest: typeof TRANSFER_DESTINATIONS[0]) => {
    setShowTransferMenu(false);
    setIsTransferring(true);
    setTargetName(dest.label);
    setTransferStep('uploading');
    const url = await saveToCloud();
    if (!url) {
      setIsTransferring(false);
      setTransferStep('idle');
      showToast('فشل الرفع السحابي. يرجى المحاولة مجدداً.');
      return;
    }
    setTransferStep('preparing');
    await new Promise(r => setTimeout(r, 900));
    setTransferStep('redirecting');
    await new Promise(r => setTimeout(r, 600));
    const jump = dest.path.replace('{{URL}}', encodeURIComponent(url)).replace('{{NAME}}', encodeURIComponent(status.fileName || 'ملف'));
    router.push(jump);
  };

  // When starting editpdf task, inject textElements into settings
  const handleStartTask = () => {
    if (tool === 'editpdf' && textElements.length > 0) {
      setToolSettings({ ...settings, _textElements: textElements });
    }
    startTask();
  };

  // ── Settings Panels ────────────────────────────────────────────────────────
  const renderSettings = () => {
    if (tool === 'compress') return (
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">مستوى الضغط</p>
        {[{ id: 'extreme', label: 'ضغط فائق', desc: 'أصغر حجم ممكن', icon: '🔥' },
          { id: 'recommended', label: 'ضغط مستحسن', desc: 'توازن مثالي', icon: '⭐' },
          { id: 'low', label: 'ضغط منخفض', desc: 'جودة عالية', icon: '🎯' }
        ].map(lv => (
          <button key={lv.id} onClick={() => setToolSettings({ ...settings, compression_level: lv.id })}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all ${settings.compression_level === lv.id ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}>
            <span className="text-lg">{lv.icon}</span>
            <div><div className="text-xs font-black">{lv.label}</div><div className="text-[10px] opacity-60">{lv.desc}</div></div>
            {settings.compression_level === lv.id && <CheckCircle size={14} className="mr-auto text-amber-400" />}
          </button>
        ))}
      </div>
    );

    if (tool === 'watermark') return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">النص</label>
          <input type="text" value={settings.text || ''} onChange={e => setToolSettings({ ...settings, text: e.target.value })}
            className="input-base text-sm h-10 w-full" placeholder="مثال: AN Academy" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">الشفافية ({settings.transparency || 50}%)</label>
            <input type="range" min="10" max="100" step="10" value={settings.transparency || 50}
              onChange={e => setToolSettings({ ...settings, transparency: parseInt(e.target.value) })} className="w-full accent-amber-400" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">حجم الخط ({settings.size || 40})</label>
            <input type="number" value={settings.size || 40} onChange={e => setToolSettings({ ...settings, size: parseInt(e.target.value) })}
              className="input-base text-sm h-8 w-full" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">الموضع</label>
          <div className="grid grid-cols-3 gap-1 bg-black/30 p-1.5 rounded-xl border border-white/5">
            {[{ id: 'Top Left', icon: AlignLeft }, { id: 'Top Center', icon: AlignCenter }, { id: 'Top Right', icon: AlignRight },
              { id: 'Center Left', icon: AlignLeft }, { id: 'Center', icon: AlignCenter }, { id: 'Center Right', icon: AlignRight },
              { id: 'Bottom Left', icon: AlignLeft }, { id: 'Bottom Center', icon: AlignCenter }, { id: 'Bottom Right', icon: AlignRight }]
            .map((p, idx) => {
              const Icon = p.icon;
              return (
                <button key={idx} onClick={() => setToolSettings({ ...settings, position: p.id })} title={p.id}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all ${settings.position === p.id ? 'bg-amber-400 text-dark' : 'bg-white/5 text-muted hover:bg-white/15'}`}>
                  <Icon size={11} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

    if (tool === 'pagenumber') return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">تنسيق النص</label>
          <input type="text" value={settings.format || '{page}'} onChange={e => setToolSettings({ ...settings, format: e.target.value })}
            className="input-base text-sm h-10 w-full" placeholder="صفحة {page} من {total}" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">البداية من</label>
            <input type="number" value={settings.startNumber || 1} onChange={e => setToolSettings({ ...settings, startNumber: parseInt(e.target.value) })}
              className="input-base text-sm h-10 w-full" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">الموضع</label>
            <select value={settings.position || 'Bottom Center'} onChange={e => setToolSettings({ ...settings, position: e.target.value })}
              className="input-base text-sm h-10 w-full appearance-none bg-dark/40">
              {['Top Left','Top Center','Top Right','Bottom Left','Bottom Center','Bottom Right'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>
    );

    if (tool === 'protect') return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">كلمة المرور</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={settings.password || ''}
              onChange={e => setToolSettings({ ...settings, password: e.target.value })}
              className="input-base text-sm h-11 w-full pl-10" placeholder="كلمة مرور قوية..." />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-amber-400 transition-colors">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-[10px] text-red-400/70 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> احفظ كلمة المرور جيداً!</p>
        </div>
      </div>
    );

    if (tool === 'pdfocr') {
      const selectedLangs = settings.languages || ['ara'];
      const toggleLang = (lang: string) => {
        const next = selectedLangs.includes(lang) ? selectedLangs.filter((l: string) => l !== lang) : [...selectedLangs, lang];
        setToolSettings({ ...settings, languages: next.length > 0 ? next : ['ara'] });
      };
      return (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">لغات التعرف</p>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'ara', label: 'العربية', flag: '🇸🇦' }, { id: 'eng', label: 'الإنجليزية', flag: '🇺🇸' },
              { id: 'fra', label: 'الفرنسية', flag: '🇫🇷' }, { id: 'deu', label: 'الألمانية', flag: '🇩🇪' }
            ].map((ln) => {
              const isActive = selectedLangs.includes(ln.id);
              return (
                <button key={ln.id} onClick={() => toggleLang(ln.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all ${isActive ? 'bg-lime-400/10 border-lime-400/40 text-lime-300' : 'bg-white/5 border-white/10 text-muted hover:border-white/20'}`}>
                  <span>{ln.flag}</span>
                  <span>{ln.label}</span>
                  {isActive && <CheckCircle size={12} className="mr-auto" />}
                </button>
              );
            })}
          </div>
          <div className="bg-lime-400/5 border border-lime-400/10 rounded-xl p-3 flex gap-2">
            <Info size={13} className="text-lime-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted/70 leading-relaxed">اختر اللغات الموجودة فعلاً في الملف لضمان أعلى دقة. بعد الانتهاء سيظهر النص مباشرة.</p>
          </div>
        </div>
      );
    }

    if (tool === 'pdfoffice') return (
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">صيغة الملف الناتج</p>
        <div className="space-y-2">
          {[
            { id: 'Word', label: 'مستند Word', desc: 'ملف .docx قابل للتعديل', icon: '📝', available: true },
            { id: 'Pptx', label: 'عرض PowerPoint', desc: 'ملف .pptx للعروض', icon: '📊', available: false },
            { id: 'xlsx', label: 'جدول Excel', desc: 'ملف .xlsx للجداول', icon: '📈', available: false },
          ].map((fmt) => {
            const isSelected = settings.outputType === fmt.id || (!settings.outputType && fmt.id === 'Word');
            return (
              <button key={fmt.id}
                disabled={!fmt.available}
                onClick={() => setToolSettings({ ...settings, outputType: fmt.id })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isSelected ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}>
                <span className="text-xl">{fmt.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-black">{fmt.label}</div>
                  <div className="text-[10px] opacity-60">{fmt.desc}{!fmt.available ? ' — قريباً' : ''}</div>
                </div>
                {isSelected && fmt.available && <CheckCircle size={14} className="text-blue-400" />}
              </button>
            );
          })}
        </div>
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex gap-2">
          <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted/70 leading-relaxed">سيتم تحويل ملف PDF إلى مستند Word يمكن فتحه وتعديله في Microsoft Word أو Google Docs.</p>
        </div>
      </div>
    );

    if (tool === 'rotate') return (
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">زاوية التدوير</p>
        <div className="grid grid-cols-3 gap-2">
          {[90, 180, 270].map(deg => (
            <button key={deg} onClick={() => setToolSettings({ ...settings, angle: deg })}
              className={`py-4 rounded-xl border text-sm font-black transition-all ${settings.angle === deg ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-300' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}>
              {deg}°
            </button>
          ))}
        </div>
      </div>
    );

    if (tool === 'pdfjpg') return (
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">دقة الصور (DPI)</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ v: 96, label: 'منخفض', icon: '📱' }, { v: 150, label: 'متوسط', icon: '🖥️' }, { v: 300, label: 'عالي', icon: '🖨️' }].map(d => (
            <button key={d.v} onClick={() => setToolSettings({ ...settings, dpi: d.v })}
              className={`py-3 rounded-xl border text-center transition-all ${settings.dpi === d.v ? 'bg-emerald-400/10 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'}`}>
              <div className="text-base mb-0.5">{d.icon}</div>
              <div className="text-[10px] font-black">{d.v} DPI</div>
            </button>
          ))}
        </div>
      </div>
    );

    if (tool === 'imagepdf') return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">الاتجاه</label>
            <select value={settings.orientation || 'portrait'} onChange={e => setToolSettings({ ...settings, orientation: e.target.value })}
              className="input-base text-sm h-10 w-full appearance-none bg-dark/40">
              <option value="portrait">طولي</option><option value="landscape">عرضي</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">الهوامش</label>
            <select value={settings.margin || 0} onChange={e => setToolSettings({ ...settings, margin: parseInt(e.target.value) })}
              className="input-base text-sm h-10 w-full appearance-none bg-dark/40">
              <option value="0">بدون</option><option value="10">ضيقة</option><option value="20">واسعة</option>
            </select>
          </div>
        </div>
      </div>
    );

    if (tool === 'split') return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">نطاق الصفحات</label>
          <input type="text" value={settings.ranges || '1-end'} onChange={e => setToolSettings({ ...settings, ranges: e.target.value })}
            className="input-base text-sm h-10 w-full" placeholder="مثال: 1, 2-5, 8" />
        </div>
      </div>
    );

    if (tool === 'editpdf') return (
      <div className="space-y-4">
        <div className="bg-indigo-400/5 border border-indigo-400/15 rounded-xl p-3 flex gap-2">
          <MousePointer size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-indigo-300/80 leading-relaxed font-bold">
            انقر على أي مكان في الملف لوضع نص. انقر مرتين على النص لتعديله.
          </p>
        </div>
        <div>
          <label className="text-xs font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">النص الافتراضي للعنصر الجديد</label>
          <input type="text" value={settings.text || ''} onChange={e => setToolSettings({ ...settings, text: e.target.value })}
            className="input-base text-sm h-10 w-full" placeholder="اكتب نصاً ثم انقر على الملف..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">حجم الخط ({settings.size || 14})</label>
            <input type="number" min="8" max="72" value={settings.size || 14}
              onChange={e => setToolSettings({ ...settings, size: parseInt(e.target.value) })}
              className="input-base text-sm h-10 w-full" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted/70 mb-1.5 block uppercase tracking-wider">لون النص</label>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.color || '#FFD700'}
                onChange={e => setToolSettings({ ...settings, color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              <input type="text" value={settings.color || '#FFD700'}
                onChange={e => setToolSettings({ ...settings, color: e.target.value })}
                className="input-base text-sm h-10 flex-1 font-mono text-xs" />
            </div>
          </div>
        </div>
        {textElements.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted/60">{textElements.length} عنصر نصي مضاف</span>
            <button onClick={() => setTextElements([])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              <Trash2 size={11} /> مسح الكل
            </button>
          </div>
        )}
      </div>
    );

    return (
      <div className="flex flex-col items-center justify-center text-center p-6 bg-white/3 rounded-xl border border-dashed border-white/10">
        <CheckCircle size={20} className="text-muted/30 mb-2" />
        <p className="text-xs text-muted/50 font-medium">تعمل تلقائياً بدون إعدادات إضافية</p>
      </div>
    );
  };

  // ── Workspace Panel ────────────────────────────────────────────────────────
  const renderWorkspace = () => {
    const { stage, progress, message, originalSize, compressedSize, fileName, error } = status;
    const savings = getSavingsPercent(originalSize, compressedSize);

    if (stage === 'idle') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-10">
          <div className={`w-24 h-24 rounded-full ${currentTool.bg} border ${currentTool.border} flex items-center justify-center`}>
            <CurrentToolIcon size={36} className={`${currentTool.color} opacity-60`} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white/60 mb-1">{currentTool.label}</h3>
            <p className="text-sm text-muted/50 max-w-xs leading-relaxed">{currentTool.desc}</p>
          </div>
          <p className="text-xs text-muted/30 mt-2">
            {tool === 'editpdf' && files.length > 0 ? 'انتقل لتبويب المحرر التفاعلي' : 'ارفع ملفك من اليسار لبدء المعالجة'}
          </p>
        </div>
      );
    }

    if (stage === 'error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-10">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={40} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-red-400 mb-2">فشلت العملية</h3>
            <p className="text-sm text-muted/60 max-w-xs">{error || message}</p>
          </div>
          <button
            onClick={() => setStatus({ stage: 'idle', error: undefined })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all">
            <RefreshCw size={14} />
            <span>المحاولة مجدداً</span>
          </button>
        </div>
      );
    }


    if (stage === 'completed') {
      return (
      <div className="flex-1 flex flex-col gap-4">
        {/* Status Row */}
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle size={22} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-emerald-400">اكتملت المعالجة! ✅</h3>
            <p className="text-[11px] text-muted/60 truncate">{fileName}</p>
          </div>
        </div>

        {/* PDF Preview Toggle */}
        {status.task && status.server && tool !== 'pdfjpg' && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <button onClick={() => setShowPreview(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-sm font-black">
              <span className="flex items-center gap-2 text-indigo-300">
                <Eye size={15} /> معاينة الملف قبل التحميل
              </span>
              <ChevronDown size={14} className={`text-muted/60 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showPreview && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 380, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden bg-white">
                     <iframe
                    src={status.fileName?.toLowerCase().endsWith('.docx') ? 
                      'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(window.location.origin + '/api/ilovepdf/download?task=' + status.task + '&server=' + status.server + '&fileName=' + encodeURIComponent(status.fileName || '')) :
                      `/api/ilovepdf/download?task=${status.task}&server=${status.server}&fileName=${encodeURIComponent(status.fileName || 'document.pdf')}&inline=true`}
                    className="w-full h-full"
                    style={{ height: 380, border: 'none', display: 'block' }}
                    title="معاينة الملف"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* OCR Extracted Text Panel */}
        {tool === 'pdfocr' && (extractedText || isExtractingText) && (
          <div className="bg-[#1a1f2e] border border-lime-400/20 rounded-2xl p-5 mb-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-lime-400/10 pb-3">
              <div className="flex items-center gap-2 text-lime-400">
                <FileText size={18} />
                <h3 className="text-sm font-black">النصوص المستخرجة (OCR)</h3>
              </div>
              {extractedText && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(extractedText);
                    showToast('✅ تم نسخ النص إلى الحافظة');
                  }}
                  className="text-[10px] font-bold bg-lime-400/10 text-lime-400 px-3 py-1.5 rounded-lg hover:bg-lime-400/20 transition-all flex items-center gap-1.5 border border-lime-400/20"
                >
                  <Copy size={12} /> نسخ النص
                </button>
              )}
            </div>
            
            {isExtractingText ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 opacity-50">
                <Loader2 size={24} className="animate-spin text-lime-400" />
                <p className="text-xs font-bold">جاري قراءة واستخراج النصوص...</p>
              </div>
            ) : (
              <div className="relative group">
                <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar text-right leading-relaxed text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {extractedText}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1a1f2e] to-transparent pointer-events-none group-hover:opacity-0 transition-opacity duration-500" />
              </div>
            )}
            
            <p className="mt-4 text-[10px] text-muted/40 italic">
              * يمكنك نسخ النص أعلاه لاستخدامه في إعداد الدروس أو الواجبات.
            </p>
          </div>
        )}

        {/* Stats */}
        {(originalSize > 0 || compressedSize) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-[9px] text-muted/60 font-bold uppercase mb-0.5">الأصلي</div>
              <div className="text-sm font-black">{formatBytes(originalSize)}</div>
            </div>
            <div className={`${savings > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'} border rounded-xl p-3 text-center`}>
              <div className="text-[9px] text-muted/60 font-bold uppercase mb-0.5">الجديد</div>
              <div className={`text-sm font-black ${savings > 0 ? 'text-emerald-400' : 'text-white'}`}>{formatBytes(compressedSize) || '✅'}</div>
            </div>
            <div className={`${savings > 0 ? 'bg-amber-400/10 border-amber-400/20' : 'bg-white/5 border-white/10'} border rounded-xl p-3 text-center`}>
              <div className="text-[9px] text-muted/60 font-bold uppercase mb-0.5">التوفير</div>
              <div className={`text-sm font-black ${savings > 0 ? 'text-amber-400' : 'text-muted'}`}>{savings > 0 ? `${savings}%` : '—'}</div>
            </div>
          </div>
        )}

        {savings > 0 && (
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${savings}%` }} transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <a href={`/api/ilovepdf/download?task=${status.task}&server=${status.server}&fileName=${encodeURIComponent(status.fileName || 'document.pdf')}`}
            className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-dark font-black text-sm transition-all shadow-lg shadow-amber-400/20">
            <Download size={17} /> تحميل الملف المعالج
          </a>

          <div className="relative" ref={transferMenuRef}>
            <button onClick={() => setShowTransferMenu(prev => !prev)} disabled={isTransferring}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/20">
              <Send size={17} /> نقل ذكي للمنصة
              <ChevronDown size={14} className={`transition-transform ${showTransferMenu ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showTransferMenu && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-2 border-b border-white/5">
                    <p className="text-[10px] text-muted/60 font-bold uppercase tracking-wider text-center px-3 py-1">اختر الوجهة</p>
                  </div>
                  {TRANSFER_DESTINATIONS.map((dest, i) => {
                    const Icon = dest.icon;
                    return (
                      <button key={i} onClick={() => handleTransfer(dest)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-right border-b border-white/5 last:border-0">
                        <div className={`w-9 h-9 rounded-xl ${dest.bg} border border-white/10 flex items-center justify-center shrink-0`}>
                          <Icon size={16} className={dest.color} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white">{dest.label}</div>
                          <div className="text-[9px] text-muted/50">يفتح الصفحة بملء تلقائي</div>
                        </div>
                        <ArrowRight size={14} className="mr-auto text-muted/40" />
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => { reset(); setTextElements([]); setShowTransferMenu(false); }}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-muted hover:bg-white/10 text-sm font-bold transition-all">
            <RefreshCw size={14} /> ملف جديد
          </button>
        </div>
      </div>
    );
    }

    // In-progress
    const stageLabel = stage === 'preparing' ? 'جاري التجهيز...' : stage === 'uploading' ? 'جاري الرفع...' : 'جاري المعالجة...';

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
            <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <motion.circle cx="72" cy="72" r="60" fill="none" strokeWidth="8" strokeLinecap="round"
              stroke="url(#prog-grad)" strokeDasharray={`${2 * Math.PI * 60}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - (progress / 100)) }}
              transition={{ duration: 0.5, ease: 'easeInOut' }} />
            <defs>
              <linearGradient id="prog-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-amber-400">{progress}</span>
            <span className="text-xs text-muted/60 font-bold">%</span>
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-black text-muted/60 uppercase tracking-wider">{stageLabel}</span>
          </div>
          <p className="text-lg font-black">{message}</p>
          {fileName && <p className="text-sm text-muted/50 mt-1">{fileName}</p>}
        </div>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in" dir="rtl">
      {/* ── Header ── */}
      <div className="card-base p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${currentTool.bg} border ${currentTool.border} flex items-center justify-center ${currentTool.color} shadow-lg shrink-0`}>
              <CurrentToolIcon size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black font-cairo gold-text">محرر iLovePDF الذكي</h1>
              <p className="text-muted text-sm mt-0.5">{currentTool.desc}</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-2xl border text-[11px] font-black tracking-wider ${
            status.stage === 'idle' ? 'bg-white/5 border-white/10 text-muted' :
            status.stage === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            status.stage === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            'bg-amber-400/10 border-amber-400/20 text-amber-400'}`}>
            {status.stage === 'idle' ? '⚡ جاهز للعمل' : status.stage === 'error' ? '❌ فشل' : status.stage === 'completed' ? '✅ اكتمل' : '⏳ جاري المعالجة...'}
          </div>
        </div>
      </div>

      {/* ── Body: EditPDF mode gets full-width editor ── */}
      {isEditMode ? (
        // ═══════════════════════════════════════════
        // FULL-WIDTH PDF INTERACTIVE EDITOR LAYOUT
        // ═══════════════════════════════════════════
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tools Sidebar */}
          <div className="lg:col-span-2">
            <div className="card-base p-2 sticky top-4">
              <p className="text-[9px] font-black text-muted/40 uppercase tracking-widest px-2 mb-2">الأدوات</p>
              <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
                {TOOLS.map(t => {
                  const Icon = t.icon; const active = tool === t.id;
                  return (
                    <button key={t.id} onClick={() => { setTool(t.id); if (status.stage === 'completed') reset(); }}
                      className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-xl border transition-all text-right ${active ? `${t.bg} ${t.border} ${t.color}` : 'bg-transparent border-transparent text-muted hover:bg-white/5'}`}>
                      <Icon size={14} className={active ? t.color : 'text-muted/60'} />
                      <span className="text-[10px] font-black">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="card-base p-5">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">
                <Settings2 size={14} className="text-muted/60" /> الإعدادات
              </h2>
              {renderSettings()}
            </div>

            {/* File info */}
            {files.length > 0 && (
              <div className="card-base p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-400/10 flex items-center justify-center">
                    <FileText size={14} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{files[0].name}</p>
                    <p className="text-[9px] text-muted/50">{formatBytes(files[0].size)}</p>
                  </div>
                  <button onClick={() => { removeFile(0); setTextElements([]); }} className="text-muted hover:text-red-400 transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <button onClick={handleStartTask} disabled={textElements.length === 0 && tool === 'editpdf'}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${textElements.length > 0 || tool !== 'editpdf' ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border border-white/10 text-muted/50 cursor-not-allowed'}`}>
                  <Zap size={15} />
                  {tool === 'editpdf'
                    ? textElements.length > 0 ? `تطبيق ${textElements.length} عناصر` : 'أضف نصاً أولاً'
                    : 'بدء المعالجة'}
                </button>
              </div>
            )}
          </div>

          {/* PDF Interactive Editor - takes most space */}
          <div className="lg:col-span-7">
            <div className="card-base p-5" style={{ minHeight: 600 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Edit3 size={16} className="text-indigo-400" /> المحرر التفاعلي
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2.5 py-1 rounded-full font-black">
                    {textElements.length} عنصر نصي
                  </span>
                </div>
              </div>
              <div style={{ height: 560 }}>
                <PDFInteractiveEditor
                  file={files[0]}
                  textElements={textElements}
                  onChange={setTextElements}
                  activeSettings={settings}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ═══════════════════════════════════════════
        // STANDARD LAYOUT for all other tools
        // ═══════════════════════════════════════════
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tools Sidebar */}
          <div className="lg:col-span-3">
            <div className="card-base p-3 sticky top-4">
              <p className="text-[10px] font-black text-muted/50 uppercase tracking-widest px-2 mb-3">الأدوات المتاحة</p>
              <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
                {TOOLS.map(t => {
                  const Icon = t.icon; const active = tool === t.id;
                  return (
                    <button key={t.id} onClick={() => { setTool(t.id); if (status.stage === 'completed') reset(); }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-right ${active ? `${t.bg} ${t.border} ${t.color}` : 'bg-transparent border-transparent text-muted hover:bg-white/5 hover:border-white/10'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? t.bg : 'bg-white/5'}`}>
                        <Icon size={16} className={active ? t.color : 'text-muted/60'} />
                      </div>
                      <span className="text-xs font-black">{t.label}</span>
                      {active && <ChevronUp size={12} className="mr-auto rotate-90" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Setup Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card-base p-5">
              <h2 className="text-base font-black mb-4 flex items-center gap-2">
                <Upload size={16} className="text-amber-400" /> رفع الملفات
              </h2>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-2xl p-8 cursor-pointer hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group">
                <Upload size={28} className="text-muted/40 group-hover:text-amber-400 transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-black">{files.length > 0 ? 'إضافة المزيد' : 'اضغط لاختيار الملفات'}</p>
                  <p className="text-xs text-muted/50 mt-1">{tool === 'imagepdf' ? 'صور (PNG, JPG, WEBP)' : 'ملفات PDF'}</p>
                </div>
                <input type="file" className="hidden" multiple accept={tool === 'imagepdf' ? 'image/*' : '.pdf,application/pdf'} onChange={handleFileChange} />
              </label>
              {files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                        {f.type.startsWith('image/') ? <ImageIcon size={14} className="text-amber-400" /> : <FileText size={14} className="text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate">{f.name}</p>
                        <p className="text-[9px] text-muted/50">{formatBytes(f.size)}</p>
                      </div>
                      <button onClick={() => removeFile(i)} className="p-1.5 text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-base p-5">
              <h2 className="text-base font-black mb-4 flex items-center gap-2">
                <Settings2 size={16} className="text-muted/60" /> إعدادات الأداة
              </h2>
              {renderSettings()}
            </div>

            {files.length > 0 && (status.stage === 'idle' || status.stage === 'error') && (
              <button onClick={handleStartTask}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-dark font-black text-sm transition-all shadow-xl shadow-amber-400/20 animate-in fade-in slide-in-from-bottom-2">
                <Zap size={18} /> بدء المعالجة الذكية
              </button>
            )}
          </div>

          {/* Workspace */}
          <div className="lg:col-span-5">
            <div className="card-base p-6 min-h-[520px] flex flex-col sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" /> المساحة التفاعلية
                </h2>
                {status.stage === 'completed' && (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <CheckCircle size={11} /> مكتمل
                  </span>
                )}
              </div>
              {renderWorkspace()}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Overlay */}
      <AnimatePresence>
        {transferStep !== 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="text-center p-10 bg-[#1a1f2e] border border-white/10 rounded-[2rem] shadow-2xl max-w-sm w-full mx-6">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center mx-auto mb-6">
                {transferStep === 'redirecting'
                  ? <ArrowRight size={36} className="text-blue-400" />
                  : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Upload size={32} className="text-blue-400" />
                    </motion.div>
                }
              </div>
              <h3 className="text-xl font-black mb-2 font-cairo">
                {transferStep === 'uploading' ? 'جاري الرفع للسحابة...' : transferStep === 'preparing' ? 'جاري تجهيز الوجهة...' : 'جاري الانتقال...'}
              </h3>
              <p className="text-sm text-muted/60 font-bold">الوجهة: {targetName}</p>
              <div className="mt-6 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: transferStep === 'uploading' ? '40%' : transferStep === 'preparing' ? '75%' : '100%' }}
                  transition={{ duration: 0.5 }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
