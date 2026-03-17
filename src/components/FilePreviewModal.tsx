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
  const getDirectUrl = () => {
    // If it's a raw resource, don't try to strip transformations
    const isRaw = cleanUrl.includes('/raw/upload/') || cleanUrl.includes('/files/upload/');
    if (isRaw) return cleanUrl;

    return cleanUrl.replace('/upload/fl_attachment:false/', '/upload/').replace('/upload/fl_attachment/', '/upload/');
  };

  const directUrl = getDirectUrl();

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

  // For images, show directly. For PDFs use direct iframe.
  // Other files will show an error with download option

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-fade-in"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {getFileIcon()}
          <div>
            <h3 className="text-white font-bold text-sm md:text-base">
              معاينة {getFileTypeLabel()}
            </h3>
            {fileName && (
              <p className="text-gray-400 text-xs truncate max-w-[200px] md:max-w-md">
                {fileName}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <a 
            href={directUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-dark text-xs md:text-sm font-bold rounded-lg hover:brightness-110 transition-all"
          >
            <Download size={16} />
            <span className="hidden sm:inline">تحميل</span>
          </a>
          
          {/* Open in New Tab */}
          <a 
            href={directUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-xs md:text-sm rounded-lg hover:bg-white/20 transition-all"
            title="فتح في نافذة جديدة"
          >
            <ExternalLink size={16} />
          </a>
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs md:text-sm rounded-lg hover:bg-red-500/30 transition-all"
          >
            <X size={18} />
            <span className="hidden sm:inline">إغلاق</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-gray-900 relative">
        {isLoading && !isImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
              <p className="text-gray-400">جاري تحميل الملف...</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6 bg-white/5 rounded-xl max-w-md">
              <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
              <p className="text-white font-bold mb-2">تعذر عرض الملف</p>
              <p className="text-gray-400 text-sm mb-4">
                قد يكون الملف كبيراً جداً أو غير متاح للعرض المباشر
              </p>
              <a 
                href={directUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-gold inline-flex items-center gap-2 px-4 py-2"
              >
                <Download size={16} />
                تحميل الملف مباشرة
              </a>
            </div>
          </div>
        )}

        {/* Viewer */}
        <div className="w-full h-full">
          {isPdf ? (
            <div className="w-full h-full">
              <iframe
                src={getViewerUrl(directUrl)}
                className="w-full h-full border-0"
                title="PDF Preview"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
                // Allow a bit more freedom for Google Viewer
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img 
                src={directUrl} 
                alt={fileName || 'معاينة الصورة'} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onLoad={() => setIsLoading(false)}
                onError={() => setLoadError(true)}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <video 
                src={directUrl} 
                controls 
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onLoadedData={() => setIsLoading(false)}
                onError={() => setLoadError(true)}
              >
                المتصفح لا يدعم تشغيل هذا الفيديو
              </video>
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="bg-white/5 p-8 rounded-xl text-center">
                <FileText className="mx-auto mb-4 text-gold" size={64} />
                <p className="text-white font-bold mb-4">ملف صوتي</p>
                <audio 
                  src={directUrl} 
                  controls 
                  className="w-full max-w-md"
                  onLoadedData={() => setIsLoading(false)}
                  onError={() => setLoadError(true)}
                >
                  المتصفح لا يدعم تشغيل هذا الملف الصوتي
                </audio>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="text-center p-6 bg-white/5 rounded-xl">
                <FileText className="mx-auto mb-4 text-gold" size={64} />
                <p className="text-white font-bold mb-2">لا يمكن عرض هذا الملف مباشرة</p>
                <p className="text-gray-400 text-sm mb-4">
                  يمكنك تحميل الملف وعرضه على جهازك
                </p>
                <a 
                  href={directUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-gold inline-flex items-center gap-2 px-4 py-2"
                >
                  <Download size={16} />
                  تحميل الملف
                </a>
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
