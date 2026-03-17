
'use client';

import React, { useEffect, useState } from 'react';
import { useFileProcessingStore } from '@/lib/store';
import { uploadFileToStorage } from '@/lib/db';
import { testILovePDFConnectionAction } from '@/lib/actions';
import { updateQueuedFileStatus, QueuedFile } from '@/lib/idb';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from 'lucide-react';

export const FileProcessingCenter = () => {
  const { queue, updateFile, removeFile, loadQueue } = useFileProcessingStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      try {
        await loadQueue();
      } catch (err) {
        console.error('Error loading queue:', err);
      }
      
      // Test iLovePDF Connection silently with timeout
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        await Promise.race([testILovePDFConnectionAction(), timeoutPromise]);
      } catch (err) {
        console.warn('iLovePDF connection test failed (will use fallback):', err);
      }

      // Resume any stale processes
      try {
        const store = useFileProcessingStore.getState();
        if (store && store.queue) {
          store.queue.forEach(file => {
            if (file.status === 'pending' || file.status === 'compressing') {
              import('@/lib/file-processor').then(({ FileProcessor }) => {
                FileProcessor.process(file.id).catch((err: any) => {
                  console.error('Error processing file:', file.id, err);
                });
              }).catch((err: any) => {
                console.error('Error importing FileProcessor:', err);
              });
            }
          });
        }
      } catch (err) {
        console.error('Error resuming processes:', err);
      }
    };
    init();
  }, [loadQueue]);

  // Background Upload Worker
  useEffect(() => {
    const processQueue = async () => {
      const uploadingFiles = queue.filter(f => f.status === 'uploading' && !f.url);
      
      for (const fileData of uploadingFiles) {
        try {
          // Prevent multiple concurrent uploads for the same file if effect re-runs
          if (fileData.progress > 0) continue; 

          const url = await uploadFileToStorage(
            fileData.blob,
            fileData.path,
            (p, s) => updateFile(fileData.id, { progress: p, statusText: s }),
            fileData.fileName
          );

          updateFile(fileData.id, { status: 'completed', url, progress: 100 });
          await updateQueuedFileStatus(fileData.id, { status: 'completed', url, progress: 100 });
          
          // Emit a custom event so pages can listen for completion
          window.dispatchEvent(new CustomEvent('fileUploaded', { 
            detail: { id: fileData.id, url, fileName: fileData.fileName, path: fileData.path } 
          }));

        } catch (err: any) {
          console.error('Upload failed for', fileData.fileName, err);
          updateFile(fileData.id, { status: 'failed', error: err.message || 'فشل الرفع' });
          await updateQueuedFileStatus(fileData.id, { status: 'failed', error: err.message || 'فشل الرفع' });
        }
      }
    };

    if (mounted) processQueue();
  }, [queue, updateFile, mounted]);

  if (!mounted || queue.length === 0) return null;

  const activeCount = queue.filter(f => f.status !== 'completed' && f.status !== 'failed').length;
  const completedCount = queue.filter(f => f.status === 'completed').length;
  const failedCount = queue.filter(f => f.status === 'failed').length;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div 
          className="bg-blue-600 p-3 flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-white">
            <Loader2 className={`w-5 h-5 ${activeCount > 0 ? 'animate-spin' : ''}`} />
            <span className="font-bold text-sm">
              {activeCount > 0 ? `جاري معالجة ${activeCount} ملف...` : 'معالجة الملفات'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {completedCount} ✓
              </span>
            )}
            {failedCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {failedCount} !
              </span>
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronUp className="w-4 h-4 text-white" />}
          </div>
        </div>

        {/* List */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="max-h-80 overflow-y-auto"
            >
              <div className="p-2 space-y-2">
                {queue.slice().reverse().map((file) => (
                  <div key={file.id} className="p-2 rounded-lg border border-gray-100 bg-gray-50 text-right" dir="rtl">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {file.fileType.includes('pdf') ? <FileText className="w-4 h-4 text-red-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                          <p className="text-xs font-medium truncate text-gray-700">{file.fileName}</p>
                        </div>
                        
                        {/* Status Label */}
                        <div className="flex items-center gap-2 text-[10px]">
                          {file.status === 'compressing' && <span className="text-orange-500 font-medium">{file.statusText || 'جاري الضغط...'}</span>}
                          {file.status === 'uploading' && <span className="text-blue-500 font-medium">{file.statusText || 'جاري الرفع...'}</span>}
                          {file.status === 'completed' && <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> اكتمل الرفع</span>}
                          {file.status === 'failed' && <span className="text-red-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {file.error || 'فشل'}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {(file.status === 'compressing' || file.status === 'uploading') && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <motion.div 
                          className={`h-1.5 rounded-full ${file.status === 'compressing' ? 'bg-orange-500' : 'bg-blue-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
