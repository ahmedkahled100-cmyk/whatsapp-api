'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, X, Download, ExternalLink, FileText, Image as ImageIcon, File, Eye, RefreshCw } from 'lucide-react';
import {
  inferPdfFromUrl,
  preferExternalPdfViewer,
  getGoogleDocsViewerUrl,
  getPdfJsViewerUrl,
  getNativePdfEmbedUrl,
  normalizeCloudinaryInlineUrl,
  toAbsoluteUrl,
} from '@/lib/pdf-viewer';

interface FilePreviewModalProps {
  url: string;
  fileName?: string;
  onClose: () => void;
}

type PdfMode = 'native' | 'google' | 'pdfjs';

export function FilePreviewModal({ url, fileName, onClose }: FilePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>(() =>
    typeof window !== 'undefined' ? (preferExternalPdfViewer(url) ? 'google' : 'native') : 'google'
  );
  const [key, setKey] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);
    const initial: PdfMode = preferExternalPdfViewer(url) ? 'google' : 'native';
    setPdfMode(initial);
    setKey((k) => k + 1);
  }, [url]);

  const cleanUrl = url.trim().replace(/\s+/g, '%20');
  const lower = cleanUrl.toLowerCase().split('?')[0];
  const isPdf = inferPdfFromUrl(cleanUrl, fileName);
  const isImage =
    !isPdf &&
    (lower.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/) !== null ||
      cleanUrl.includes('image%2F') ||
      (cleanUrl.includes('/image/upload/') && !cleanUrl.includes('/raw/')));
  const isVideo =
    lower.match(/\.(mp4|webm|ogg|mov)$/) !== null || cleanUrl.includes('video%2F') || cleanUrl.includes('/video/upload/');
  const isAudio =
    lower.match(/\.(mp3|wav|ogg|m4a)$/) !== null || cleanUrl.includes('audio%2F');

  const getDirectUrl = useCallback(
    (forDownload = false) => {
      let processed = cleanUrl;
      if (!cleanUrl.includes('/raw/upload/') && !cleanUrl.includes('/files/upload/')) {
        processed = processed.replace('/upload/fl_attachment:false/', '/upload/').replace(/\/upload\/fl_attachment:[^/]+\//, '/upload/');
        if (forDownload && processed.includes('cloudinary.com') && fileName) {
          const safe = fileName.replace(/[/\\?%*:|"<>]/g, '_');
          processed = processed.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(safe)}/`);
        }
      }
      return normalizeCloudinaryInlineUrl(processed);
    },
    [cleanUrl, fileName]
  );

  const directUrl = getDirectUrl(false);
  const downloadUrl = getDirectUrl(true);
  const displayFileName = fileName
    ? isPdf && !fileName.toLowerCase().endsWith('.pdf')
      ? `${fileName}.pdf`
      : fileName
    : 'ملف';

  const pdfIframeSrc =
    pdfMode === 'native'
      ? getNativePdfEmbedUrl(directUrl)
      : pdfMode === 'google'
        ? getGoogleDocsViewerUrl(directUrl)
        : getPdfJsViewerUrl(directUrl);

  const reload = () => {
    setIsLoading(true);
    setLoadError(false);
    setKey((k) => k + 1);
  };

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="text-blue-400" size={24} />;
    if (isPdf) return <FileText className="text-red-400" size={24} />;
    return <File className="text-gold" size={24} />;
  };

  const getTypeLabel = () => {
    if (isImage) return 'صورة';
    if (isPdf) return 'PDF';
    if (isVideo) return 'فيديو';
    if (isAudio) return 'صوت';
    return 'ملف';
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-fade-in min-h-[100dvh] pt-[env(safe-area-inset-top)]" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center px-4 py-3 bg-white/5 border-b border-white/10 gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {getFileIcon()}
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm">معاينة {getTypeLabel()}</h3>
            {fileName && <p className="text-gray-400 text-xs truncate max-w-[200px] sm:max-w-sm">{displayFileName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="p-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all border border-white/5"
            title="إعادة تحميل"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {isPdf && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPdfMode('native');
                  reload();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border ${pdfMode === 'native' ? 'bg-gold/20 text-gold border-gold/40' : 'bg-white/5 text-white border-white/10'}`}
              >
                مباشر
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfMode('google');
                  reload();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border ${pdfMode === 'google' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-white/5 text-white border-white/10'}`}
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfMode('pdfjs');
                  reload();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border ${pdfMode === 'pdfjs' ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-white/5 text-white border-white/10'}`}
              >
                PDF.js
              </button>
            </>
          )}

          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={displayFileName}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-dark text-xs sm:text-sm font-bold rounded-lg hover:brightness-110 transition-all"
          >
            <Download size={16} />
            <span className="hidden sm:inline">تحميل</span>
          </a>

          <a
            href={toAbsoluteUrl(directUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white/10 text-white text-xs rounded-lg border border-white/10"
            title="فتح الرابط الأصلي"
          >
            <ExternalLink size={14} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs sm:text-sm rounded-lg hover:bg-red-500/30 transition-all border border-red-500/10"
          >
            <X size={18} />
            <span className="hidden sm:inline">إغلاق</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-[#111] relative min-h-0">
        {isLoading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111]/90">
            <div className="text-center px-4">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-gold/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-400 text-sm">جاري تحميل المعاينة...</p>
              {isPdf && (
                <p className="text-xs text-gray-600 mt-2 max-w-sm mx-auto">
                  إن لم يظهر الملف، جرّب أزرار «مباشر» أو «Google» أو «PDF.js» أعلى الشاشة.
                </p>
              )}
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#111] p-6">
            <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-md shadow-2xl">
              <AlertCircle className="mx-auto mb-4 text-red-400" size={64} />
              <h4 className="text-white font-black text-xl mb-2">تعذر عرض المعاينة</h4>
              <p className="text-gray-400 text-sm mb-6">
                قد يكون السبب قيود الحماية في المتصفح أو حجم الملف. يرجى تجربة الفتح المباشر.
              </p>
              <div className="flex flex-col gap-3">
                <a 
                  href={toAbsoluteUrl(directUrl)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-gold text-dark py-3 px-6 rounded-xl font-black flex items-center justify-center gap-2 hover:brightness-110"
                >
                  <ExternalLink size={20} /> فتح في تبويب جديد
                </a>
                <a 
                  href={downloadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-white/10 text-white py-3 px-6 rounded-xl font-bold border border-white/10 flex items-center justify-center gap-2"
                >
                  <Download size={20} /> تحميل الملف
                </a>
                <button 
                  type="button" 
                  onClick={() => { setPdfMode(pdfMode === 'google' ? 'pdfjs' : 'google'); reload(); }} 
                  className="text-gold text-xs font-bold mt-4 underline decoration-gold/30 underline-offset-4"
                >
                  تجربة محرك معاينة آخر
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full min-h-[50vh] sm:min-h-0">
          {isPdf ? (
            <div className="w-full h-full bg-neutral-200 relative">
              <iframe
                key={`${key}-${pdfMode}`}
                src={pdfIframeSrc}
                className="w-full h-full border-0 absolute inset-0 min-h-[70vh]"
                title="PDF Preview"
                allow="fullscreen"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => window.setTimeout(() => setIsLoading(false), 400)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
              />
              {pdfMode === 'native' && (
                <object
                  data={getNativePdfEmbedUrl(directUrl)}
                  type="application/pdf"
                  className="hidden"
                  aria-hidden
                >
                  {/* احتياطي لمحركات تتجاهل iframe */}
                </object>
              )}
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 bg-black min-h-[50vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={key}
                src={directUrl}
                alt={displayFileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
                style={{ display: isLoading ? 'none' : 'block' }}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-4 min-h-[50vh]">
              <video
                key={key}
                src={directUrl}
                controls
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onLoadedData={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
              >
                المتصفح لا يدعم تشغيل هذا الفيديو
              </video>
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center p-4 min-h-[50vh]">
              <div className="bg-white/5 p-8 rounded-xl text-center border border-white/10">
                <FileText className="mx-auto mb-4 text-gold" size={64} />
                <p className="text-white font-bold mb-4">{displayFileName}</p>
                <audio
                  key={key}
                  src={directUrl}
                  controls
                  className="w-full max-w-md"
                  onLoadedData={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setLoadError(true);
                  }}
                >
                  المتصفح لا يدعم تشغيل هذا الملف الصوتي
                </audio>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 min-h-[50vh]">
              <div className="text-center p-10 bg-white/5 rounded-2xl border border-white/10 shadow-2xl">
                <FileText className="mx-auto mb-4 text-gold" size={80} />
                <h4 className="text-white font-bold text-xl mb-2">لا يمكن عرض هذا الملف مباشرة</h4>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">نوع هذا الملف يحتاج للتحميل لعرضه.</p>
                <div className="flex flex-col gap-3">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-gold flex items-center justify-center gap-2 py-3 px-8">
                    <Download size={18} /> تحميل الملف
                  </a>
                  <button type="button" onClick={onClose} className="text-gray-500 text-xs hover:text-white transition-colors">
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName?: string } | null>(null);

  const openPreview = useCallback((openUrl: string, openName?: string) => {
    if (!openUrl) return;
    setPreviewFile({ url: openUrl, fileName: openName });
  }, []);

  const closePreview = useCallback(() => setPreviewFile(null), []);

  const PreviewModal = previewFile ? (
    <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} onClose={closePreview} />
  ) : null;

  return { openPreview, closePreview, PreviewModal, isOpen: !!previewFile };
}
