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

const TOOL_MAPPING: Record<string, string> = {
  'ocr': 'pdfocr',
  'pdfoffice': 'officepdf',
};

export async function POST(req: Request) {
  try {
    const { task, server, fileName, serverFilename, serverFilenames, mode, tool: rawTool = 'compress', settings, compression_level } = await req.json();
    const tool = TOOL_MAPPING[rawTool] || rawTool;

    if (!task || !server || (!serverFilename && !serverFilenames)) {
      return NextResponse.json({ 
        success: false, 
        error: 'بيانات معالجة غير مكتملة (Missing task/server/filename)' 
      }, { status: 200 });
    }

    console.log(`[iLovePDF Process] Reconstructing task: ${task} (${tool}) (raw: ${rawTool}) on server: ${server} (Mode: ${mode || 'default'})`);
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    // @ts-ignore - access internal properties to reconstruct task
    let taskInstance: any;
    try {
      taskInstance = instance.newTask(tool as any);
    } catch (e: any) {
      if (e.name === 'TaskTypeNotExistsError' && tool === 'organize') {
        // Polyfill Organize task which is missing from SDK 0.3.1 TaskFactory
        const TaskBaseProcess = require('@ilovepdf/ilovepdf-js-core/tasks/TaskBaseProcess').default;
        // @ts-ignore - access private properties for emergency polyfill
        taskInstance = new TaskBaseProcess(instance.auth, instance.xhr);
        taskInstance.type = 'organize';
      } else {
        throw e;
      }
    }
    
    taskInstance.server = server;
    taskInstance._id = task;
    
    // Support multiple files or single file
    const filesToRegister = serverFilenames || [serverFilename];
    const s = settings || {};
    
    filesToRegister.forEach((sfn: string, index: number) => {
      taskInstance.files.push({
        serverFilename: sfn,
        filename: Array.isArray(fileName) ? fileName[index] : (index === 0 ? fileName : `file_${index}.pdf`),
        params: { rotate: 0 }
      });
    });

    // 2. Prepare process parameters based on tool and settings
    let processParams: any = {};
    
    if (tool === 'compress') {
      processParams = { compression_level: compression_level || s.compression_level || 'recommended' };
    } else if (tool === 'watermark') {
      processParams = {
        mode: s.type === 'image' ? 'image' : 'text',
        text: s.text || 'AN Academy',
        position: s.position || 'Center',
        pages: 'all',
        font_family: s.font || 'Arial',
        font_style: s.style || 'Bold',
        font_size: s.size || 40,
        font_color: s.color || '#000000',
        transparency: s.transparency || 50,
        layer: s.layer || 'above'
      };
    } else if (tool === 'pagenumber') {
      processParams = {
        position: s.position || 'Bottom Center',
        start_number: s.startNumber || 1,
        pages: 'all',
        font_family: s.font || 'Arial',
        font_style: s.style || 'Regular',
        font_size: s.size || 12,
        font_color: s.color || '#000000',
        text: s.format || '{page}'
      };
    } else if (tool === 'split') {
      processParams = {
        ranges: s.ranges || '1-end'
      };
    } else if (tool === 'merge') {
        processParams = {}; // Merge has no mandatory process params
    } else if (tool === 'rotate') {
      const rotate = s.angle || 90;
      processParams = { rotate };
      // Also apply to individual files as some SDK versions prefer it there
      taskInstance.files.forEach((f: any) => {
        f.params = f.params || {};
        f.params.rotate = rotate;
      });
    } else if (tool === 'organize') {
        processParams = {}; // Organize uses file params mostly
    } else if (tool === 'pdfocr') {
      processParams = {
        ocr_languages: Array.isArray(s.languages) ? s.languages : [s.language || 'ara']
      };
    } else if (tool === 'protect') {
      processParams = {
        password: s.password || '123456'
      };
    } else if (tool === 'pdfjpg') {
      processParams = {
        dpi: s.dpi || 150
      };
    } else if (tool === 'imagepdf') {
      processParams = {
        orientation: s.orientation || 'portrait',
        margin: s.margin || 0,
        pagesize: s.pagesize || 'fit'
      };
    } else if (tool === 'pdfoffice') {
      // PDF to Word conversion
      processParams = {
        output_type: s.outputType || 'Word', // Word, Pptx, xlsx
        try_pdf_repair: true
      };
    } else if (tool === 'unlock') {
      processParams = {
        password: s.password || ''
      };
    } else if (tool === 'editpdf') {
        // PDF dimensions reference: A4 = 595 x 842 points, origin at bottom-left
        const PDF_W = 595, PDF_H = 842;

        // Check if we have interactive editor elements (_textElements from the page)
        const interactiveElements: any[] = s._textElements || [];

        if (interactiveElements.length > 0) {
            // Map each element's percentage position → PDF coordinates
            interactiveElements.forEach((el: any) => {
                if (!el.text) return;
                const xPdf = Math.round((el.x / 100) * PDF_W);
                // PDF y-origin is bottom-left, browser y is top-left → invert
                const yPdf = Math.round(PDF_H - (el.y / 100) * PDF_H);
                if (taskInstance.elements && Array.isArray(taskInstance.elements)) {
                    taskInstance.elements.push({
                        params: {
                            type: 'text',
                            text: el.text,
                            coordinates: { x: xPdf, y: yPdf },
                            dimensions: { w: Math.round(PDF_W * 0.8), h: (el.fontSize || 14) * 2 },
                            font_size: el.fontSize || 14,
                            font_family: 'Arial',
                            font_color: el.color || '#000000',
                            pages: el.pages || 'all'
                        }
                    });
                }
            });
        } else {
            // Fallback: single text from settings (old behavior)
            const textStr = s.text || '';
            const fontSize = s.size || 14;
            const pos = s.position || 'Bottom Center';
            let x = 250, y = 30;
            if (pos === 'Top Left') { x = 30; y = 780; }
            else if (pos === 'Top Center') { x = 250; y = 780; }
            else if (pos === 'Top Right') { x = 450; y = 780; }
            else if (pos === 'Bottom Left') { x = 30; y = 30; }
            else if (pos === 'Bottom Center') { x = 250; y = 30; }
            else if (pos === 'Bottom Right') { x = 450; y = 30; }
            if (taskInstance.elements && Array.isArray(taskInstance.elements) && textStr) {
                taskInstance.elements.push({
                    params: {
                        type: 'text', text: textStr,
                        coordinates: { x, y },
                        dimensions: { w: 400, h: fontSize * 2 },
                        font_size: fontSize,
                        font_family: 'Arial',
                        font_color: s.color || '#000000',
                        pages: 'all'
                    }
                });
            }
        }
        processParams = {};
    }

    console.log(`[iLovePDF Process] SDK starting process for ${task} with params:`, JSON.stringify(processParams));
    
    // Check if process failed internally
    let processData;
    try {
        processData = await taskInstance.process(processParams);
    } catch (procErr: any) {
        console.error('[iLovePDF SDK Process Internal Error]:', procErr);
        if (procErr.response && procErr.response.data) {
            console.error('[iLovePDF SDK Process Error Detail]:', JSON.stringify(procErr.response.data));
            throw new Error(procErr.response.data.error?.message || 'فشل معالجة الملف في محرك iLovePDF');
        }
        throw procErr;
    }

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
