'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X, Download, ExternalLink, FileText, Image as ImageIcon, File } from 'lucide-react';
import { getViewerUrl } from '@/lib/utils';

interface FilePreviewModalProps {
  url: string;
  fileName?: string;
  onClose: () => void;
}

export function FilePreviewModal({ url, fileName, onClose }: FilePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [key, setKey] = useState(0); // For reloading

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Detect file type - Ensure PDF takes priority even if it's in an image folder
  const isPdf = url.match(/\.pdf$/i) || url.includes('application%2Fpdf') || url.includes('.pdf') || url.includes('/raw/upload/') || url.includes('/files/upload/');
  const isImage = (url.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i) || url.includes('image%2F') || url.includes('/image/upload/')) && !isPdf;
  const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('video%2F') || url.includes('/video/upload/');
  const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i) || url.includes('audio%2F');

  // Clean URL - ensure proper format
  const cleanUrl = url.replace(/\s+/g, '');
  
  // For Cloudinary PDFs, ensure proper access
  const getDirectUrl = (forDownload = false) => {
    // If it's a raw resource, don't try to strip transformations
    const isRaw = cleanUrl.includes('/raw/upload/') || cleanUrl.includes('/files/upload/');
    
    let processedUrl = cleanUrl;
    
    if (!isRaw) {
      processedUrl = processedUrl.replace('/upload/fl_attachment:false/', '/upload/').replace('/upload/fl_attachment/', '/upload/');
      
      // If downloading, we can try to force attachment with filename if it's Cloudinary
      if (forDownload && processedUrl.includes('cloudinary.com') && fileName) {
        // Remove existing flags and add fl_attachment
        const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
        processedUrl = processedUrl.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(safeName)}/`);
      }
    }

    return processedUrl;
  };

  const directUrl = getDirectUrl(false);
  const downloadUrl = getDirectUrl(true);
  const googleViewerUrl = getViewerUrl(directUrl);

  // Ensure fileName has .pdf extension if it's a PDF
  const displayFileName = fileName ? (isPdf && !fileName.toLowerCase().endsWith('.pdf') ? `${fileName}.pdf` : fileName) : 'file.pdf';

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="text-blue-400" size={24} />;
    if (isPdf) return <FileText className="text-red-400" size={24} />;
    return <File className="text-gold" size={24} />;
  };

  const getFileTypeLabel = () => {
    if (isImage) return 'صورة';
    if (isPdf) return 'PDF';
    if (isVideo) return 'فيديو';
    if (isAudio) return 'صوت';
    return 'ملف';
  };

  const reload = () => {
    setIsLoading(true);
    setLoadError(false);
    setKey(prev => prev + 1);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-fade-in"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center px-4 py-3 bg-white/5 border-b border-white/10 gap-3">
        <div className="flex items-center gap-3">
          {getFileIcon()}
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm md:text-base">
              معاينة {getFileTypeLabel()}
            </h3>
            {fileName && (
              <p className="text-gray-400 text-xs truncate max-w-[200px] md:max-w-md">
                {displayFileName}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={reload}
            className="p-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all border border-white/5"
            title="إعادة تحميل"
          >
            <ExternalLink size={16} />
          </button>

          <a 
            href={downloadUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            download={displayFileName}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-dark text-xs md:text-sm font-bold rounded-lg hover:brightness-110 transition-all"
          >
            <Download size={16} />
            <span className="hidden sm:inline">تحميل</span>
          </a>
          
          <button 
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs md:text-sm rounded-lg hover:bg-red-500/30 transition-all border border-red-500/10"
          >
            <X size={18} />
            <span className="hidden sm:inline">إغلاق</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-gray-900 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-gold/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-400 font-medium">جاري معالجة المحتوى...</p>
              <p className="text-xs text-gray-500 mt-2">يرجى الانتظار قليلاً أو محاولة إعادة التحميل</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-900 p-6">
            <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-md shadow-2xl">
              <AlertCircle className="mx-auto mb-4 text-red-400" size={64} />
              <h4 className="text-white font-black text-xl mb-2">عذراً، لم نتمكن من عرض الملف</h4>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                قد يكون الملف كبيراً جداً أو يحتاج للمعاينة في صفحة مستقلة أو عبر التحميل المباشر.
              </p>
              <div className="flex flex-col gap-3">
                <a 
                  href={directUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-gold flex items-center justify-center gap-2 py-3"
                >
                  <ExternalLink size={18} /> فتح في صفحة مستقلة
                </a>
                <a 
                  href={downloadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-outline flex items-center justify-center gap-2 py-3 border-white/10"
                >
                  <Download size={18} /> تحميل الملف الآن
                </a>
                <button 
                  onClick={reload}
                  className="text-gold text-xs font-bold hover:underline mt-2"
                >
                  إعادة محاولة التحميل
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewer */}
        <div className="w-full h-full">
          {isPdf ? (
            <div className="w-full h-full bg-white">
              <iframe
                key={key}
                src={googleViewerUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
                onLoad={() => {
                  // Wait a bit to ensure it actually rendered (especially for Google viewer)
                  setTimeout(() => setIsLoading(false), 800);
                }}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img 
                key={key}
                src={directUrl} 
                alt={fileName || 'معاينة الصورة'} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
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
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
              >
                المتصفح لا يدعم تشغيل هذا الفيديو
              </video>
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="bg-white/5 p-8 rounded-xl text-center border border-white/10">
                <FileText className="mx-auto mb-4 text-gold animate-bounce-subtle" size={64} />
                <p className="text-white font-bold mb-4">ملف صوتي</p>
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
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="text-center p-10 bg-white/5 rounded-2xl border border-white/10 shadow-2xl">
                <FileText className="mx-auto mb-4 text-gold" size={80} />
                <h4 className="text-white font-bold text-xl mb-2">لا يمكن عرض هذا الملف مباشرة</h4>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">
                  نوع هذا الملف يحتاج للتحميل لعرضه على جهازك الشخصي.
                </p>
                <div className="flex flex-col gap-3">
                  <a 
                    href={downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-gold flex items-center justify-center gap-2 py-3 px-8"
                  >
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

  const openPreview = (url: string, fileName?: string) => {
    setPreviewFile({ url, fileName });
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  const PreviewModal = previewFile ? (
    <FilePreviewModal
      url={previewFile.url}
      fileName={previewFile.fileName}
      onClose={closePreview}
    />
  ) : null;

  return {
    openPreview,
    closePreview,
    PreviewModal,
    isOpen: !!previewFile,
  };
}
