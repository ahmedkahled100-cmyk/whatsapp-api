'use client';
import { X, ZoomIn, ZoomOut, Download, RotateCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ImageModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageModal({ src, alt, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="modal-overlay !z-[200] !bg-black/95 !p-4 sm:!p-10" >
      {/* Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
        <button 
          onClick={() => setScale(s => Math.min(s + 0.25, 3))}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          title="تكبير"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          title="تصغير"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={() => setRotation(r => r + 90)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          title="تدوير"
        >
          <RotateCw size={18} />
        </button>
        <a 
          href={src} 
          download 
          target="_blank"
          className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all"
          title="تحميل"
        >
          <Download size={18} />
        </a>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 hover:rotate-90 transition-all shadow-lg shadow-red-500/20"
          title="إغلاق"
        >
          <X size={24} />
        </button>
      </div>

      {/* Image Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <img 
          src={src} 
          alt={alt || 'صورة'} 
          className="max-w-full max-h-full transition-transform duration-300 pointer-events-none"
          style={{ 
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Info */}
      {alt && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/5 border border-white/10 px-6 py-2 rounded-full backdrop-blur-sm">
          <p className="text-sm font-bold text-white">{alt}</p>
        </div>
      )}
    </div>
  );
}
