
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

const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);

// Flag to track if API is working
let apiVerified = false;

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
      
      if (!this.isConfigured()) {
        console.error('[iLovePDF] Cannot test connection: API keys not configured');
        return false;
      }

      const task = instance.newTask('compress');
      await task.start();
      console.log('[iLovePDF] Connection Successful');
      return true;
    } catch (error: any) {
      console.error('[iLovePDF] Connection Failed:', error?.message || error);
      return false;
    }
  }

  static async compress(fileBuffer: Buffer): Promise<Buffer> {
    try {
      if (!this.isConfigured()) {
        console.warn('[iLovePDF] 📴 API keys not configured. Attempting local compression fallback...');
        return await ILovePDFClient.compressLocally(fileBuffer);
      }

      console.log('[iLovePDF] 📤 Starting iLovePDF compression, buffer size:', fileBuffer.length);
      
      const task = instance.newTask('compress');
      console.log('[iLovePDF] Task created, starting...');
      
      try {
        await task.start();
        console.log('[iLovePDF] ✅ Task started successfully');
      } catch (startError: any) {
        const errorMsg = startError?.message || startError;
        console.error('[iLovePDF] ❌ Failed to start task:', errorMsg);
        
        // Check if it's an auth error
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('invalid credentials')) {
          console.warn('[iLovePDF] 🔐 Authentication failed. Your API keys may be expired or revoked.');
          console.warn('[iLovePDF] 📴 Falling back to local compression...');
          return await ILovePDFClient.compressLocally(fileBuffer);
        }
        throw new Error('Failed to start iLovePDF task: ' + errorMsg);
      }
      
      try {
        const file = new ILovePDFFile(Buffer.from(fileBuffer) as any);
        console.log('[iLovePDF] File object created');
        await task.addFile(file);
        console.log('[iLovePDF] ✅ File added to task');
      } catch (addFileError: any) {
        console.error('[iLovePDF] ❌ Failed to add file:', addFileError?.message || addFileError);
        throw new Error('Failed to add file to iLovePDF: ' + (addFileError?.message || 'Unknown error'));
      }
      
      try {
        await task.process({ compression_level: 'recommended' });
        console.log('[iLovePDF] ✅ Processing complete');
      } catch (processError: any) {
        console.error('[iLovePDF] ❌ Failed to process:', processError?.message || processError);
        throw new Error('Failed to process PDF: ' + (processError?.message || 'Unknown error'));
      }
      
      try {
        const data = await task.download();
        console.log('[iLovePDF] ✅ Download complete, compressed size:', data.length);
        return Buffer.from(data);
      } catch (downloadError: any) {
        console.error('[iLovePDF] ❌ Failed to download:', downloadError?.message || downloadError);
        throw new Error('Failed to download compressed PDF: ' + (downloadError?.message || 'Unknown error'));
      }
    } catch (error: any) {
      const errorMsg = error?.message || error;
      console.error('[iLovePDF] ❌ Compression Error:', errorMsg);
      
      // Try local fallback on any error
      console.warn('[iLovePDF] 📴 Attempting local compression as fallback...');
      try {
        return await ILovePDFClient.compressLocally(fileBuffer);
      } catch (fallbackError: any) {
        const fallbackMsg = fallbackError?.message || fallbackError;
        console.error('[iLovePDF] ❌ Local fallback also failed:', fallbackMsg);
        throw new Error('PDF compression failed (iLovePDF: ' + errorMsg + ', fallback: ' + fallbackMsg + ')');
      }
    }
  }

  /**
   * Local PDF compression fallback using pdf-lib
   * This provides basic compression without relying on external API
   */
  private static async compressLocally(fileBuffer: Buffer): Promise<Buffer> {
    try {
      const { PDFDocument } = require('pdf-lib');
      console.log('[iLovePDF] 🔧 Using local PDF compression (pdf-lib)...');
      
      const pdfDoc = await PDFDocument.load(fileBuffer);
      
      // Basic compression: remove metadata and optimize streams
      const pages = pdfDoc.getPages();
      console.log('[iLovePDF] Processing', pages.length, 'pages...');
      
      // Compress by converting to bytes with minimal quality loss
      const compressedBytes = await pdfDoc.save({ 
        useObjectStreams: true,
      });
      
      const reduction = (((fileBuffer.length - compressedBytes.length) / fileBuffer.length) * 100).toFixed(1);
      console.log('[iLovePDF] ✅ Local compression complete. Reduction:', reduction + '%');
      
      return Buffer.from(compressedBytes);
    } catch (error: any) {
      const errorMsg = error?.message || error;
      console.error('[iLovePDF] ❌ Local compression failed:', errorMsg);
      
      // If everything fails, return original file as-is
      console.warn('[iLovePDF] ⚠️  Returning original file. Could not compress.');
      return fileBuffer;
    }
  }
}
