'use server';
// src/lib/actions.ts

import { uploadToCloudinary, isCloudinaryConfigured, getCloudinaryConfigStatus, API_SECRET, API_KEY, CLOUD_NAME } from './cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { ILovePDFClient } from './ilovepdf';

export async function testILovePDFConnectionAction() {
  return await ILovePDFClient.testConnection();
}

export async function getILovePDFStatusAction() {
  return {
    configured: ILovePDFClient.isConfigured(),
    configStatus: ILovePDFClient.getConfigStatus(),
  };
}

export async function getCloudinaryStatusAction() {
  return {
    configured: isCloudinaryConfigured(),
    configStatus: getCloudinaryConfigStatus(),
  };
}

export async function compressAndUploadPDFAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'an-academy';
    const originalFileName = formData.get('fileName') as string || file.name || 'document.pdf';
    
    if (!file) throw new Error('Missing file');

    // Log start of process
    console.log('[compressAndUploadPDFAction] Starting PDF compression:', originalFileName, 'size:', file.size);

    // 1. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Compress with iLovePDF (Server-side)
    console.log('[compressAndUploadPDFAction] Compressing with iLovePDF...');
    const compressedBuffer = await ILovePDFClient.compress(buffer);
    console.log('[compressAndUploadPDFAction] Compression complete, new size:', compressedBuffer.length);
    
    // 3. Upload the compressed buffer to Cloudinary
    console.log('[compressAndUploadPDFAction] Uploading to Cloudinary...');
    
    // Create a safe public_id from the original name
    const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const publicId = `${nameWithoutExt}_${Math.random().toString(36).substring(2, 8)}`;

    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder, 
          resource_type: 'auto',
          public_id: publicId,
          use_filename: true,
          unique_filename: true,
          display_name: originalFileName
        },
        (error, result) => {
          if (error) {
            console.error('[compressAndUploadPDFAction] Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('[compressAndUploadPDFAction] Upload successful:', result?.secure_url);
            resolve(result);
          }
        }
      );
      uploadStream.end(compressedBuffer);
    });

    return {
      success: true,
      url: result.secure_url,
      size: compressedBuffer.length,
      originalSize: file.size
    };
  } catch (error: any) {
    console.error('[compressAndUploadPDFAction] Error:', error);
    return {
      success: false,
      error: error.message || 'فشل ضغط ورفع ملف PDF.',
    };
  }
}

export async function uploadFileAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) throw new Error('Missing file');

    // Folder on Cloudinary
    const folder = path ? path.split('/')[0] : 'an-academy';
    
    const result: any = await uploadToCloudinary(file, folder);
    
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error: any) {
    console.error('Server Action Upload Error:', error);
    return {
      success: false,
      error: error.message || 'فشل رفع الملف لسبب غير معروف',
    };
  }
}

/**
 * Generates a signature for Cloudinary signed upload from client
 */
export async function getCloudinarySignature(folder: string = 'an-academy', publicId?: string) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  
  const params: any = { timestamp, folder };
  if (publicId) params.public_id = publicId;

  const signature = cloudinary.utils.api_sign_request(
    params,
    API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: API_KEY,
    cloudName: CLOUD_NAME,
  };
}


