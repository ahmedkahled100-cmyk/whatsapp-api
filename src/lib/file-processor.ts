
import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';
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
    if (!fileData) return;

    try {
      store.updateFile(id, { status: 'compressing', progress: 0 });
      await updateQueuedFileStatus(id, { status: 'compressing' });

      let processedBlob: Blob = fileData.blob;

      // Always attempt local optimization to reduce bandwidth/costs
      if (fileData.fileType.startsWith('image/')) {
        processedBlob = await this.compressImage(fileData.blob, (p) => {
          store.updateFile(id, { progress: Math.round(p) });
        });
      } else if (fileData.fileType === 'application/pdf' || fileData.fileName.toLowerCase().endsWith('.pdf')) {
        processedBlob = await this.optimizePDF(fileData.blob, (p) => {
          store.updateFile(id, { progress: Math.round(p) });
        });
      }

      // Final size check
      if (processedBlob.size > LIMIT_100MB) {
        throw new Error('حجم الملف كبير جداً حتى بعد الضغط (>100MB).');
      }

      // Move to upload phase
      store.updateFile(id, { status: 'uploading', progress: 0, blob: processedBlob });
      await updateQueuedFileStatus(id, { status: 'uploading', blob: processedBlob });

      // The actual upload will be triggered by the UI or a background worker
      // For now, we'll let the upload logic handle it.
      // We can call uploadFileToStorage here directly if we want it truly background.
      
    } catch (err: any) {
      console.error('Processing error:', err);
      store.updateFile(id, { status: 'failed', error: err.message || 'فشل معالجة الملف' });
      await updateQueuedFileStatus(id, { status: 'failed', error: err.message || 'فشل معالجة الملف' });
    }
  }

  /**
   * Compresses an image file
   */
  private static async compressImage(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
    const file = new File([blob], 'temp', { type: blob.type });
    const options = {
      maxSizeMB: 9.5, // Aim for just under 10MB
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      onProgress: (p: number) => onProgress?.(p),
    };

    try {
      return await imageCompression(file, options);
    } catch (err) {
      console.error('Image compression failed', err);
      throw new Error('فشل ضغط الصورة. حاول تقليل جودتها يدوياً.');
    }
  }

  /**
   * Optimizes a PDF file
   */
  private static async optimizePDF(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
    try {
      onProgress?.(10);
      const arrayBuffer = await blob.arrayBuffer();
      onProgress?.(30);
      
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      onProgress?.(60);
      const attempt1 = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false,
      });
      onProgress?.(80);

      let result = new Blob([attempt1 as any], { type: 'application/pdf' });
      if (result.size > LIMIT_10MB) {
        const pdfDoc2 = await PDFDocument.load(attempt1, { ignoreEncryption: true });
        const attempt2 = await pdfDoc2.save({
          useObjectStreams: true,
          addDefaultPage: false,
          updateFieldAppearances: false,
        });
        result = new Blob([attempt2 as any], { type: 'application/pdf' });
      }
      onProgress?.(90);
      
      onProgress?.(100);
      
      const reduction = ((blob.size - result.size) / blob.size * 100).toFixed(1);
      console.log(`[FileProcessor] PDF Optimized: ${blob.size} -> ${result.size} (${reduction}% reduction)`);
      
      return result;
    } catch (err: any) {
      console.error('PDF optimization failed', err);
      // If pdf-lib fails, we return the original blob and let the server-side iLovePDF handle it if large
      return blob;
    }
  }
}
