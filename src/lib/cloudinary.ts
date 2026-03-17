import { v2 as cloudinary } from 'cloudinary';

// Get configuration from environment variables
export const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

// Log warning if env vars are not set
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[Cloudinary] Warning: Environment variables not set. Uploads will fail.');
  console.warn('[Cloudinary] Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Check if Cloudinary is properly configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && API_KEY && API_SECRET);
}

/**
 * Get configuration status for debugging
 */
export function getCloudinaryConfigStatus(): { configured: boolean; cloudName: string; apiKeyPrefix: string } {
  return {
    configured: isCloudinaryConfigured(),
    cloudName: CLOUD_NAME || 'not set',
    apiKeyPrefix: API_KEY ? API_KEY.substring(0, 5) + '...' : 'not set',
  };
}

export async function uploadToCloudinary(file: File, folder: string = 'an-academy') {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
    }

    console.log('[Cloudinary] Starting upload, file size:', file.size, 'type:', file.type);
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
      // Use 'auto' to let Cloudinary decide. For PDFs, this allows inline viewing.
      const resourceType = 'auto';

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resourceType,
          // Make files publicly accessible (no signed URLs needed)
          access_mode: 'public',
          // Don't use specific delivery types that might restrict access
          type: 'upload',
          // Ensure PDFs are NOT forced as attachments so they can be previewed
          // flags: isPdf ? 'attachment' : undefined, 
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Upload error:', error);
            return reject(error);
          }
          console.log('[Cloudinary] Upload successful:', result?.secure_url);
          resolve(result);
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error('[Cloudinary] uploadToCloudinary error:', error);
    throw error;
  }
}
