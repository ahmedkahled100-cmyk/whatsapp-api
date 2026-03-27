'use client';
import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, Eye, X, CheckCircle2 } from 'lucide-react';
import { useFilePreview } from './FilePreviewModal';

interface GlobalFileUploadProps {
  id?: string;
  accept?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  label?: React.ReactNode;
  uploadedUrl?: string; // If already uploaded
  currentFile?: File | null; // For controlled state
  isUploading?: boolean;
  uploadProgress?: number;
  variant?: 'normal' | 'compact';
  onDelete?: () => void;
}

export function GlobalFileUpload({ 
  id, accept, onChange, disabled, className, label, uploadedUrl, currentFile, isUploading, uploadProgress, variant = 'normal', onDelete
}: GlobalFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const { openPreview, PreviewModal } = useFilePreview();

  // Sync with controlled currentFile
  useEffect(() => {
    if (currentFile !== undefined) {
      setInternalFile(currentFile);
    }
  }, [currentFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInternalFile(file);
    } else {
      setInternalFile(null);
    }
    onChange(e);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setInternalFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Call the parent's onDelete if provided
    if (onDelete) {
      onDelete();
    } else {
      // Fallback: trigger onChange with a null event or mock
      onChange({ target: { files: null } } as any);
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (internalFile) {
      const url = URL.createObjectURL(internalFile);
      openPreview(url, internalFile.name);
    } else if (uploadedUrl) {
      openPreview(uploadedUrl, 'الملف المرفق');
    }
  };

  const activeFile = internalFile || uploadedUrl;
  const isPdf = internalFile?.type === 'application/pdf' || uploadedUrl?.toLowerCase().includes('.pdf');
  const isImage = internalFile?.type.startsWith('image/') || uploadedUrl?.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i);

  const wrapperClass = variant === 'compact' 
    ? `w-full h-full flex flex-col items-center justify-center border-dashed border-white/20 rounded-xl cursor-pointer hover:border-gold hover:bg-white/5 transition-all outline-none ${(disabled || isUploading) ? 'opacity-50 pointer-events-none' : ''}`
    : `btn-outline w-full border-dashed border-white/20 py-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover:border-purple-500 hover:text-purple-400 outline-none ${(disabled || isUploading) ? 'opacity-50 pointer-events-none' : ''}`;

  return (
    <div className={`relative w-full ${variant === 'compact' ? 'h-full' : ''} ${className || ''}`}>
      <div 
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        className={wrapperClass}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <div className="flex items-center gap-2 text-sm">
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          ) : activeFile ? (
            isImage ? <ImageIcon size={24} className="text-blue-400" /> : <FileText size={24} className="text-red-400" />
          ) : (
            <Upload size={24} />
          )}
        </div>
        
        <span className="text-sm font-medium text-center px-2">
          {label ? label : (internalFile ? internalFile.name : uploadedUrl ? 'يوجد ملف مرفوع (انقر لتغييره)' : 'اضغط لاختيار ملف')}
        </span>
        
        {/* Size Badge */}
        {internalFile && (
          <div className="text-[10px] text-gray-500">
            {(internalFile.size / (1024 * 1024)).toFixed(2)} MB
            {internalFile.size > 10 * 1024 * 1024 && <span className="text-orange-400 mr-1">(سيتم ضغطه)</span>}
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full max-w-[200px] mt-2">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 text-center mt-1">{uploadProgress}%</div>
          </div>
        )}

        {/* Success Indicator */}
        {uploadedUrl && !isUploading && !internalFile && (
          <div className="text-[10px] text-green-400 text-center flex items-center gap-1">
            <CheckCircle2 size={12} /> تم الرفع بنجاح
          </div>
        )}

        {/* Hidden Input */}
        <input 
          id={id}
          type="file" 
          accept={accept} 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleChange} 
          disabled={disabled || isUploading} 
        />
      </div>

      {/* Actions Overlay */}
      {activeFile && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={handlePreview}
            className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-all shadow-lg border border-white/10 flex items-center gap-2 text-xs font-bold"
            title="معاينة الملف"
          >
            <Eye size={16} />
            <span className="hidden sm:inline">معاينة</span>
          </button>
          
          {!disabled && !isUploading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 bg-red-500/50 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-all shadow-lg border border-white/10"
              title="حذف الملف"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      
      {PreviewModal}
    </div>
  );
}
