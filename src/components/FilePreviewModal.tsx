'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, X, Download, ExternalLink, FileText, Image as ImageIcon, File, Eye, RefreshCw } from 'lucide-react';
import { getViewerUrl } from '@/lib/utils';

interface FilePreviewModalProps {
  url: string;
  fileName?: string;
  onClose: () => void;
}

export function FilePreviewModal({ url, fileName, onClose }: FilePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);
  const [key, setKey] = useState(0);

  // Keyboard & scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = 'unset'; window.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  // Reset on URL change
  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);
    setUseGoogleViewer(false);
    setKey(k => k + 1);
  }, [url]);

  // File type detection
  const cleanUrl = url.trim().replace(/\s+/g, '%20');
  const lower = cleanUrl.toLowerCase().split('?')[0];
  const isPdf = lower.endsWith('.pdf') || cleanUrl.includes('application%2Fpdf') || cleanUrl.includes('/raw/upload/') || (cleanUrl.includes('cloudinary') && lower.includes('.pdf'));
  const isImage = !isPdf && (lower.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/) !== null || cleanUrl.includes('image%2F') || (cleanUrl.includes('/image/upload/') && !cleanUrl.includes('/raw/')));
  const isVideo = lower.match(/\.(mp4|webm|ogg|mov)$/) !== null || cleanUrl.includes('video%2F') || cleanUrl.includes('/video/upload/');
  const isAudio = lower.match(/\.(mp3|wav|ogg|m4a)$/) !== null || cleanUrl.includes('audio%2F');

  const getDirectUrl = useCallback((forDownload = false) => {
    let processed = cleanUrl;
    if (!cleanUrl.includes('/raw/upload/') && !cleanUrl.includes('/files/upload/')) {
      processed = processed.replace('/upload/fl_attachment:false/', '/upload/').replace('/upload/fl_attachment/', '/upload/');
      if (forDownload && processed.includes('cloudinary.com') && fileName) {
        const safe = fileName.replace(/[/\\?%*:"|<>]/g, '_');
        processed = processed.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(safe)}/`);
      }
    }
    return processed;
  }, [cleanUrl, fileName]);

  const directUrl = getDirectUrl(false);
  const downloadUrl = getDirectUrl(true);
  const googleViewerUrl = getViewerUrl(directUrl);
  const displayFileName = fileName ? (isPdf && !fileName.toLowerCase().endsWith('.pdf') ? `${fileName}.pdf` : fileName) : 'ملف';

  // Auto-fallback for PDF: switch to Google Viewer after 12s if still loading
  useEffect(() => {
    if (isPdf && !useGoogleViewer && isLoading && !loadError) {
      const t = setTimeout(() => { setUseGoogleViewer(true); setKey(k => k + 1); setIsLoading(true); }, 12000);
      return () => clearTimeout(t);
    }
  }, [isPdf, useGoogleViewer, isLoading, loadError, key]);

  const reload = () => { setIsLoading(true); setLoadError(false); setKey(k => k + 1); };

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
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center px-4 py-3 bg-white/5 border-b border-white/10 gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {getFileIcon()}
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm">معاينة {getTypeLabel()}</h3>
            {fileName && <p className="text-gray-400 text-xs truncate max-w-[200px] sm:max-w-sm">{displayFileName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={reload} className="p-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all border border-white/5" title="إعادة تحميل">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {isPdf && (
            <button
              onClick={() => { setUseGoogleViewer(!useGoogleViewer); setKey(k => k + 1); setIsLoading(true); setLoadError(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all border ${useGoogleViewer ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-white border-white/10'}`}
            >
              <Eye size={16} />
              <span className="hidden sm:inline">{useGoogleViewer ? 'عرض مباشر' : 'عرض Google'}</span>
            </button>
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

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs sm:text-sm rounded-lg hover:bg-red-500/30 transition-all border border-red-500/10"
          >
            <X size={18} />
            <span className="hidden sm:inline">إغلاق</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-[#111] relative">
        {/* Loading */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111]/90">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-gold/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-400">جاري تحميل الملف...</p>
              {isPdf && <p className="text-xs text-gray-600 mt-2">سيتم التبديل تلقائياً لعرض Google إذا تأخر التحميل</p>}
            </div>
          </div>
        )}

        {/* Error */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#111] p-6">
            <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-md">
              <AlertCircle className="mx-auto mb-4 text-red-400" size={64} />
              <h4 className="text-white font-black text-xl mb-2">لم نتمكن من عرض الملف</h4>
              <p className="text-gray-400 text-sm mb-6">قد يكون الملف كبيراً جداً أو يحتاج للمعاينة خارجياً.</p>
              <div className="flex flex-col gap-3">
                {isPdf && !useGoogleViewer && (
                  <button onClick={() => { setUseGoogleViewer(true); reload(); }} className="btn-gold flex items-center justify-center gap-2 py-3">
                    <Eye size={18} /> محاولة عبر Google Viewer
                  </button>
                )}
                <a href={directUrl} target="_blank" rel="noopener noreferrer" className="btn-gold flex items-center justify-center gap-2 py-3">
                  <ExternalLink size={18} /> فتح في نافذة مستقلة
                </a>
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-outline flex items-center justify-center gap-2 py-3 border-white/10">
                  <Download size={18} /> تحميل الملف
                </a>
                <button onClick={reload} className="text-gold text-xs font-bold hover:underline mt-2">إعادة المحاولة</button>
              </div>
            </div>
          </div>
        )}

        {/* Viewer */}
        <div className="w-full h-full">
          {isPdf ? (
            <div className="w-full h-full bg-white relative">
              <iframe
                key={key}
                src={useGoogleViewer ? googleViewerUrl : directUrl}
                className="w-full h-full border-0 absolute inset-0"
                title="PDF Preview"
                onLoad={() => setTimeout(() => setIsLoading(false), 800)}
                onError={() => { setIsLoading(false); if (!useGoogleViewer) { setLoadError(false); setUseGoogleViewer(true); setKey(k => k + 1); } else { setLoadError(true); } }}
              />
              {!useGoogleViewer && isLoading && (
                <div className="absolute inset-x-0 bottom-4 px-4 text-center z-20 pointer-events-none">
                  <p className="text-[10px] text-gray-500 bg-black/70 py-1 px-3 rounded-full inline-block">
                    إذا لم يظهر الملف، سيتم التبديل تلقائياً لعرض Google
                  </p>
                </div>
              )}
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={key}
                src={directUrl}
                alt={displayFileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onLoad={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setLoadError(true); }}
                style={{ display: isLoading ? 'none' : 'block' }}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <video
                key={key}
                src={directUrl}
                controls
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onLoadedData={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setLoadError(true); }}
              >
                المتصفح لا يدعم تشغيل هذا الفيديو
              </video>
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="bg-white/5 p-8 rounded-xl text-center border border-white/10">
                <FileText className="mx-auto mb-4 text-gold" size={64} />
                <p className="text-white font-bold mb-4">{displayFileName}</p>
                <audio key={key} src={directUrl} controls className="w-full max-w-md" onLoadedData={() => setIsLoading(false)} onError={() => { setIsLoading(false); setLoadError(true); }}>
                  المتصفح لا يدعم تشغيل هذا الملف الصوتي
                </audio>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="text-center p-10 bg-white/5 rounded-2xl border border-white/10 shadow-2xl">
                <FileText className="mx-auto mb-4 text-gold" size={80} />
                <h4 className="text-white font-bold text-xl mb-2">لا يمكن عرض هذا الملف مباشرة</h4>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">نوع هذا الملف يحتاج للتحميل لعرضه.</p>
                <div className="flex flex-col gap-3">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-gold flex items-center justify-center gap-2 py-3 px-8">
                    <Download size={18} /> تحميل الملف
                  </a>
                  <button onClick={onClose} className="text-gray-500 text-xs hover:text-white transition-colors">إغلاق</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to use the file preview
export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName?: string } | null>(null);

  const openPreview = useCallback((url: string, fileName?: string) => {
    if (!url) return;
    setPreviewFile({ url, fileName });
  }, []);

  const closePreview = useCallback(() => setPreviewFile(null), []);

  const PreviewModal = previewFile ? (
    <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} onClose={closePreview} />
  ) : null;

  return { openPreview, closePreview, PreviewModal, isOpen: !!previewFile };
}
