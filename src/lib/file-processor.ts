
import imageCompression from 'browser-image-compression';
import { saveQueuedFile, updateQueuedFileStatus, QueuedFile } from './idb';
import { useFileProcessingStore } from './store';
import { generateId } from './utils';

const LIMIT_10MB = 10 * 1024 * 1024;
const LIMIT_100MB = 100 * 1024 * 1024;

/**
 * Advanced File Processor for handling large images and PDFs with persistence
 */
export class FileProcessor {
  /**
   * Main entry point to queue a file for processing and upload
   */
  static async queueFile(file: File, path: string): Promise<string> {
    const id = generateId('file');
    const queuedFile: QueuedFile = {
      id,
      fileName: file.name,
      fileType: file.type,
      blob: file,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      path
    };

    // Save to IndexedDB for persistence
    await saveQueuedFile(queuedFile);
    
    // Add to Zustand store for UI
    useFileProcessingStore.getState().addFile(queuedFile);

    // Start processing in background (don't await)
    this.process(id);

    return id;
  }

  static async compressPdfFileLocally(file: File, onProgress?: (p: number) => void): Promise<File> {
    if (file.type !== 'application/pdf' || file.size <= LIMIT_10MB) return file;
    const optimizedBlob = await this.optimizePDF(file, onProgress);
    return new File([optimizedBlob], file.name, { type: 'application/pdf' });
  }

  /**
   * Processes a single file from the queue
   */
  public static async process(id: string) {
    const store = useFileProcessingStore.getState();
    const fileData = store.queue.find(f => f.id === id);
    if (!fileData) {
      console.error('[FileProcessor] File not found in queue:', id);
      return;
    }

    try {
      store.updateFile(id, { status: 'compressing', progress: 0 });
      await updateQueuedFileStatus(id, { status: 'compressing' });

      let processedBlob: Blob = fileData.blob;

      // Always attempt local optimization to reduce bandwidth/costs
      if (fileData.fileType.startsWith('image/')) {
        console.log('[FileProcessor] Compressing image:', fileData.fileName);
        processedBlob = await this.compressImage(fileData.blob, (p) => {
          store.updateFile(id, { progress: Math.round(p), statusText: '🖼️ ضغط الصورة...' });
        });
      } else if (fileData.fileType === 'application/pdf' || fileData.fileName.toLowerCase().endsWith('.pdf')) {
        console.log('[FileProcessor] Optimizing PDF:', fileData.fileName);
        processedBlob = await this.optimizePDF(fileData.blob, (p) => {
          store.updateFile(id, { progress: Math.round(p), statusText: '📄 ضغط الملف...' });
        });
      }

      // Final size check
      if (processedBlob.size > LIMIT_100MB) {
        throw new Error('حجم الملف كبير جداً حتى بعد الضغط (>100MB).');
      }

      // Move to upload phase
      store.updateFile(id, { status: 'uploading', progress: 0, blob: processedBlob });
      await updateQueuedFileStatus(id, { status: 'uploading', blob: processedBlob });

      console.log('[FileProcessor] File ready for upload:', fileData.fileName);
      
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('[FileProcessor] Processing error:', fileData.fileName, errorMsg);
      store.updateFile(id, { status: 'failed', error: errorMsg || 'فشل معالجة الملف' });
      await updateQueuedFileStatus(id, { status: 'failed', error: errorMsg || 'فشل معالجة الملف' });
    }
  }

  /**
   * Compresses an image file
   */
  private static async compressImage(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
    try {
      const file = new File([blob], 'temp', { type: blob.type });
      const options = {
        maxSizeMB: 9.5, // Aim for just under 10MB
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        onProgress: (p: number) => onProgress?.(p),
      };

      return await imageCompression(file, options);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('[FileProcessor] Image compression failed:', errMsg);
      // Return original if compression fails
      return blob;
    }
  }

  /**
   * Optimizes a PDF file
   */
  private static async optimizePDF(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
    try {
      onProgress?.(10);
      console.log('[FileProcessor] Starting PDF optimization...');
      
      const arrayBuffer = await blob.arrayBuffer();
      onProgress?.(30);
      
      // Dynamically import PDFDocument to avoid initialization issues
      let PDFDocument: any;
      try {
        const pdfLib = await import('pdf-lib');
        PDFDocument = pdfLib.PDFDocument;
        console.log('[FileProcessor] pdf-lib imported successfully');
      } catch (importErr) {
        console.error('[FileProcessor] Failed to import pdf-lib:', importErr);
        console.log('[FileProcessor] Returning original PDF...');
        onProgress?.(100);
        return blob;
      }
      
      if (!PDFDocument) {
        console.warn('[FileProcessor] PDFDocument not available');
        onProgress?.(100);
        return blob;
      }
      
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
      });
      onProgress?.(60);
      console.log('[FileProcessor] PDF loaded successfully, optimizing...');
      
      const optimized = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false,
      });
      onProgress?.(80);

      let result = new Blob([optimized as any], { type: 'application/pdf' });
      
      // If still too large, try more aggressive optimization
      if (result.size > LIMIT_10MB && result.size < blob.size) {
        console.log('[FileProcessor] Second compression pass...');
        try {
          const pdfDoc2 = await PDFDocument.load(optimized, { ignoreEncryption: true });
          const attempt2 = await pdfDoc2.save({
            useObjectStreams: true,
            addDefaultPage: false,
            updateFieldAppearances: false,
          });
          result = new Blob([attempt2 as any], { type: 'application/pdf' });
        } catch (err) {
          console.error('[FileProcessor] Second pass failed, using first optimization:', err);
        }
      }
      
      onProgress?.(90);
      const reduction = ((blob.size - result.size) / blob.size * 100).toFixed(1);
      const originalMB = (blob.size / 1024 / 1024).toFixed(2);
      const resultMB = (result.size / 1024 / 1024).toFixed(2);
      console.log(`[FileProcessor] ✅ PDF Optimized: ${originalMB}MB → ${resultMB}MB (${reduction}% reduction)`);
      
      onProgress?.(100);
      return result;
      
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('[FileProcessor] PDF optimization failed:', errMsg);
      console.log('[FileProcessor] Returning original PDF, will use API compression if needed');
      onProgress?.(100);
      // Return original blob - server-side will handle compression
      return blob;
    }
  }
}
