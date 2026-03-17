import { NextResponse } from 'next/server';
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY || '';
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const { task, server, fileName, serverFilename, serverFilenames, mode, tool = 'compress' } = await req.json();

    if (!task || !server || (!serverFilename && !serverFilenames)) {
      return NextResponse.json({ 
        success: false, 
        error: 'بيانات معالجة غير مكتملة (Missing task/server/filename)' 
      }, { status: 200 });
    }

    console.log(`[iLovePDF Process] Reconstructing task: ${task} (${tool}) on server: ${server} (Mode: ${mode || 'default'})`);
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    // @ts-ignore - access internal properties to reconstruct task
    const taskInstance = instance.newTask(tool as any) as any;
    taskInstance.server = server;
    taskInstance._id = task;
    
    // Support multiple files or single file
    const filesToRegister = serverFilenames || [serverFilename];
    
    filesToRegister.forEach((sfn: string, index: number) => {
      taskInstance.files.push({
        serverFilename: sfn,
        filename: Array.isArray(fileName) ? fileName[index] : (index === 0 ? fileName : `file_${index}.pdf`),
        params: { rotate: 0 }
      });
    });

    console.log(`[iLovePDF Process] SDK starting process for ${serverFilename}`);
    const processData = await taskInstance.process();

    // If mode is download, we don't need to download buffer and upload to Cloudinary
    // We just return success so the client can trigger a direct download from iLovePDF
    if (mode === 'download') {
      console.log('[iLovePDF Process] Download mode: Skipping Cloudinary, returning processed status');
      return NextResponse.json({
        success: true,
        task: task,
        server: server,
        downloadName: processData.download_filename || fileName,
        size: processData.output_filesize
      });
    }
    
    console.log(`[iLovePDF Process] SDK starting download for ${task}`);
    const buffer = await taskInstance.download();

    // 3. Upload to Cloudinary
    console.log('[iLovePDF Process] Uploading to Cloudinary...');
    
    // Sanitize fileName for public_id
    const nameWithoutExt = (fileName || 'document').replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const publicId = `${nameWithoutExt}_compressed_${Date.now().toString().slice(-6)}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const upload_stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto', // 'auto' is better for previews as it detects PDF as image/document
          public_id: publicId,
          folder: 'course-materials', // default folder
          use_filename: true,
          unique_filename: true,
          display_name: fileName || 'Compressed PDF'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      upload_stream.end(buffer);
    });

    const finalResult = uploadResult as any;
    console.log('[iLovePDF Process] Success! URL:', finalResult.secure_url);

    return NextResponse.json({
      success: true,
      url: finalResult.secure_url,
      size: finalResult.bytes,
    });

  } catch (error: any) {
    console.error('[iLovePDF Process Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل معالجة الملف',
      details: typeof error === 'object' ? JSON.stringify(error) : error
    }, { status: 200 });
  }
}
