/**
 * أدوات معاينة PDF عبر الشبكة — عناوين مطلقة، ومعرفة نوع الملف، ومشغلات بديلة
 * (مباشر / Google Docs / Mozilla pdf.js) لتفادي حظر iframe وملفات attachment.
 */

export function toAbsoluteUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith('//')) {
    if (typeof window !== 'undefined') return `${window.location.protocol}${u}`;
    return `https:${u}`;
  }
  if (/^https?:\/\//i.test(u)) return u;
  if (typeof window !== 'undefined' && u.startsWith('/')) {
    return `${window.location.origin}${u}`;
  }
  return u;
}

/** روابط تخزين شائعة تعرض غالباً X-Frame-Options أو attachment — الأفضل عارض خارجي */
export function preferExternalPdfViewer(url: string): boolean {
  const abs = toAbsoluteUrl(url).toLowerCase();
  if (
    abs.includes('cloudinary.com') ||
    abs.includes('supabase.co') ||
    abs.includes('firebasestorage.googleapis.com') ||
    abs.includes('googleusercontent.com') ||
    abs.includes('amazonaws.com') ||
    abs.includes('/storage/v1/object')
  ) {
    return true;
  }
  try {
    if (typeof window === 'undefined') return true;
    const o = new URL(toAbsoluteUrl(url));
    return o.origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function inferPdfFromUrl(url: string, fileName?: string): boolean {
  const raw = url.trim();
  const lowerPath = raw.toLowerCase().split(/[?#]/)[0];
  const fn = (fileName || '').toLowerCase();
  if (fn.endsWith('.pdf')) return true;
  if (lowerPath.endsWith('.pdf')) return true;
  if (raw.includes('application%2Fpdf') || raw.toLowerCase().includes('application/pdf')) return true;
  if (raw.includes('/raw/upload/') && raw.toLowerCase().includes('pdf')) return true;
  if (raw.includes('cloudinary') && raw.toLowerCase().includes('pdf')) return true;
  if (raw.includes('fl_attachment') && raw.toLowerCase().includes('pdf')) return true;
  if ((raw.includes('supabase') || raw.includes('storage')) && (lowerPath.endsWith('.pdf') || fn.endsWith('.pdf'))) {
    return true;
  }
  return false;
}

export function normalizeCloudinaryInlineUrl(url: string): string {
  let u = url.trim();
  // Remove download attachment flag if present
  u = u.replace('/upload/fl_attachment:false/', '/upload/');
  u = u.replace(/\/upload\/fl_attachment:[^/]+\//, '/upload/');
  
  // Ensure we are using 'image' resource type if it's a PDF stored in the 'image' bucket (better for browsing)
  // but keep 'raw' if that's what's returned.
  return u;
}

export function getGoogleDocsViewerUrl(url: string): string {
  const abs = normalizeCloudinaryInlineUrl(toAbsoluteUrl(url));
  return `https://docs.google.com/gview?url=${encodeURIComponent(abs)}&embedded=true`;
}

/** يعمل عندما يوفّر الخادم CORS للملف؛ مفيد كخيار ثالث */
export function getPdfJsViewerUrl(url: string): string {
  const abs = normalizeCloudinaryInlineUrl(toAbsoluteUrl(url));
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(abs)}`;
}

/** رابط مباشر للعرض في iframe/object (Chrome يتعامل مع #view) */
export function getNativePdfEmbedUrl(url: string): string {
  const base = normalizeCloudinaryInlineUrl(toAbsoluteUrl(url));
  if (/#/.test(base)) return base;
  return `${base}#view=FitH`;
}
