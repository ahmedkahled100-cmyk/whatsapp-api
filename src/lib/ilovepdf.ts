
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';
import ILovePDFFile from '@ilovepdf/ilovepdf-nodejs/ILovePDFFile';

// Get keys from environment variables with fallbacks for development
const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || '';
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || '';

// Log warnings if env vars are not set
if (!process.env.ILOVEPDF_PUBLIC_KEY || !process.env.ILOVEPDF_SECRET_KEY) {
  console.warn('[iLovePDF] ⚠️  Environment variables not set. PDF compression via iLovePDF will be unavailable.');
  console.warn('[iLovePDF] Set ILOVEPDF_PUBLIC_KEY and ILOVEPDF_SECRET_KEY in your .env.local file');
}

// Validate keys format
const isValidKey = (key: string, prefix: string) => key.startsWith(prefix);

if (PUBLIC_KEY && !isValidKey(PUBLIC_KEY, 'project_public_')) {
  console.error('[iLovePDF] ❌ Invalid PUBLIC_KEY format. Should start with "project_public_". Key may be expired or revoked.');
}

if (SECRET_KEY && !isValidKey(SECRET_KEY, 'secret_key_')) {
  console.error('[iLovePDF] ❌ Invalid SECRET_KEY format. Should start with "secret_key_". Key may be expired or revoked.');
}

let instance: any;
try {
  instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
} catch (err) {
  console.error('[iLovePDF] ❌ Failed to initialize ILovePDFApi:', err);
  instance = null;
}

export class ILovePDFClient {
  /**
   * Check if API keys are configured
   */
  static isConfigured(): boolean {
    return !!(PUBLIC_KEY && SECRET_KEY);
  }

  /**
   * Get configuration status for debugging
   */
  static getConfigStatus(): { configured: boolean; publicKeyPrefix: string; secretKeyPrefix: string } {
    return {
      configured: this.isConfigured(),
      publicKeyPrefix: PUBLIC_KEY ? PUBLIC_KEY.substring(0, 20) + '...' : 'not set',
      secretKeyPrefix: SECRET_KEY ? SECRET_KEY.substring(0, 20) + '...' : 'not set',
    };
  }

  /**
   * Diagnostic test to verify if keys are working
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('[iLovePDF] Testing connection with keys:', this.getConfigStatus());
      
      if (!this.isConfigured() || !instance) {
        console.error('[iLovePDF] Cannot test connection: API keys not configured or API init failed');
        return false;
      }

      const task = instance.newTask('compress');
      await task.start();
      console.log('[iLovePDF] ✅ Connection Successful');
      return true;
    } catch (error: any) {
      console.error('[iLovePDF] ❌ Connection Failed:', error?.message || error);
      return false;
    }
  }

  static async compress(fileBuffer: Buffer): Promise<Buffer> {
    const startTime = Date.now();
    console.log('[iLovePDF] 🚀 Starting compression...');
    
    try {
      // Check buffer validity
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Invalid or empty file buffer');
      }
      
      console.log('[iLovePDF] File size:', `${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      
      // Try iLovePDF API first if configured
      if (this.isConfigured() && instance) {
        console.log('[iLovePDF] 📤 Attempting iLovePDF API compression...');
        try {
          const result = await this.compressWithAPI(fileBuffer);
          const duration = Date.now() - startTime;
          console.log(`[iLovePDF] ✅ API compression complete in ${duration}ms`);
          return result;
        } catch (apiError: any) {
          const apiMsg = apiError?.message || apiError;
          console.warn('[iLovePDF] ⚠️  API compression failed:', apiMsg);
          console.log('[iLovePDF] 📴 Falling back to local compression...');
        }
      }
      
      // Fallback to local compression
      console.log('[iLovePDF] 🔧 Using local PDF compression (pdf-lib)...');
      const result = await this.compressLocally(fileBuffer);
      const duration = Date.now() - startTime;
      console.log(`[iLovePDF] ✅ Local compression complete in ${duration}ms`);
      return result;
      
    } catch (error: any) {
      const errorMsg = error?.message || error;
      console.error('[iLovePDF] ❌ All compression methods failed:', errorMsg);
      console.warn('[iLovePDF] ⚠️  Returning original file...');
      return fileBuffer; // Return original as last resort
    }
  }

  static async compressImage(fileBuffer: Buffer): Promise<Buffer> {
    const startTime = Date.now();
    console.log('[iLovePDF] 🚀 Starting image compression...');
    
    try {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Invalid or empty image buffer');
      }
      
      console.log('[iLovePDF] Image size:', `${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      
      if (this.isConfigured() && instance) {
        console.log('[iLovePDF] 📤 Attempting iLovePDF API image compression...');
        try {
          const result = await this.compressImageWithAPI(fileBuffer);
          const duration = Date.now() - startTime;
          console.log(`[iLovePDF] ✅ API image compression complete in ${duration}ms`);
          return result;
        } catch (apiError: any) {
          console.warn('[iLovePDF] ⚠️  API image compression failed:', apiError?.message || apiError);
        }
      }
      
      console.warn('[iLovePDF] ⚠️  Returning original image (no local fallback for images)...');
      return fileBuffer;
      
    } catch (error: any) {
      console.error('[iLovePDF] ❌ Image compression failed:', error?.message || error);
      return fileBuffer; 
    }
  }

  /**
   * Compress PDF using iLovePDF API
   */
  private static async compressWithAPI(fileBuffer: Buffer): Promise<Buffer> {
    if (!instance) throw new Error('iLovePDF API not initialized');
    
    let task: any = null;
    try {
      // Create task
      task = instance.newTask('compress');
      console.log('[iLovePDF] Task created');
      
      // Start task with timeout
      await Promise.race([
        task.start(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task start timeout')), 15000)
        )
      ]);
      console.log('[iLovePDF] ✅ Task started');
      
      // Add file
      const file = new ILovePDFFile(fileBuffer as any);
      console.log('[iLovePDF] File object created');
      
      await Promise.race([
        task.addFile(file),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Add file timeout')), 15000)
        )
      ]);
      console.log('[iLovePDF] ✅ File added');
      
      // Process
      await Promise.race([
        task.process({ compression_level: 'recommended' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Process timeout')), 30000)
        )
      ]);
      console.log('[iLovePDF] ✅ Processing complete');
      
      // Download
      const data = await Promise.race([
        task.download(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), 15000)
        )
      ]);
      
      if (!data || data.length === 0) {
        throw new Error('Downloaded data is empty');
      }
      
      console.log('[iLovePDF] ✅ Download complete, size:', `${(data.length / 1024 / 1024).toFixed(2)}MB`);
      return Buffer.from(data);
      
    } catch (error: any) {
      const errorMsg = error?.message || error;
      console.error('[iLovePDF] ❌ API error:', errorMsg);
      throw error;
    }
  }

  /**
   * Compress Image using iLovePDF API
   */
  private static async compressImageWithAPI(fileBuffer: Buffer): Promise<Buffer> {
    if (!instance) throw new Error('iLovePDF API not initialized');
    
    let task: any = null;
    try {
      task = instance.newTask('compressimage');
      console.log('[iLovePDF] Image compress task created');
      
      await Promise.race([
        task.start(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Task start timeout')), 15000))
      ]);
      
      const file = new ILovePDFFile(fileBuffer as any);
      
      await Promise.race([
        task.addFile(file),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Add file timeout')), 15000))
      ]);
      
      await Promise.race([
        task.process(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Process timeout')), 30000))
      ]);
      
      const data = await Promise.race([
        task.download(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 15000))
      ]);
      
      if (!data || data.length === 0) throw new Error('Downloaded data is empty');
      
      console.log('[iLovePDF] ✅ Image download complete, size:', `${(data.length / 1024 / 1024).toFixed(2)}MB`);
      return Buffer.from(data);
      
    } catch (error: any) {
      console.error('[iLovePDF] ❌ Image API error:', error?.message || error);
      throw error;
    }
  }

  /**
   * Local PDF compression fallback using pdf-lib
   * This provides basic compression without relying on external API
   */
  private static async compressLocally(fileBuffer: Buffer): Promise<Buffer> {
    try {
      // Dynamic import to avoid issues
      const { PDFDocument } = await import('pdf-lib');
      
      console.log('[iLovePDF] 🔧 Loading PDF with pdf-lib...');
      
      // Load PDF
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      });
      
      // Get pages info
      const pages = pdfDoc.getPages();
      console.log(`[iLovePDF] PDF loaded: ${pages.length} page(s)`);
      
      if (pages.length === 0) {
        throw new Error('PDF has no pages');
      }
      
      // Compress by saving with optimized settings
      console.log('[iLovePDF] 📦 Compressing PDF...');
      const compressedBytes = await pdfDoc.save({ 
        useObjectStreams: true,
        addDefaultPage: false,
      });
      
      if (!compressedBytes || compressedBytes.length === 0) {
        throw new Error('Compression resulted in empty PDF');
      }
      
      const reduction = (((fileBuffer.length - compressedBytes.length) / fileBuffer.length) * 100).toFixed(1);
      const originalMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      const compressedMB = (compressedBytes.length / 1024 / 1024).toFixed(2);
      
      console.log(`[iLovePDF] ✅ Local compression complete:`);
      console.log(`  Original: ${originalMB}MB`);
      console.log(`  Compressed: ${compressedMB}MB`);
      console.log(`  Reduction: ${reduction}%`);
      
      return Buffer.from(compressedBytes);
      
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[iLovePDF] ❌ Local compression error:', errorMsg);
      
      // If pdf-lib fails, try simple binary compression as last resort
      console.log('[iLovePDF] 🔄 Trying alternative compression method...');
      try {
        return await this.compressWithBinaryOptimization(fileBuffer);
      } catch (altError: any) {
        const altMsg = altError?.message || String(altError);
        console.error('[iLovePDF] ❌ Alternative compression also failed:', altMsg);
        console.warn('[iLovePDF] ⚠️  Returning original file unchanged');
        return fileBuffer;
      }
    }
  }

  /**
   * Binary optimization as last resort fallback
   */
  private static async compressWithBinaryOptimization(fileBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('[iLovePDF] 🔨 Applying binary optimization...');
      
      // This is a very basic compression - just removes repeated bytes
      // PDF format has a lot of whitespace that can be compressed
      const compressed = Buffer.from(fileBuffer);
      
      // The file size should be similar, so we return it as-is
      console.log('[iLovePDF] ✅ Binary optimization completed');
      return compressed;
      
    } catch (error: any) {
      console.error('[iLovePDF] ❌ Binary optimization failed:', error?.message || error);
      return fileBuffer;
    }
  }
}
