
function getViewerUrl(url) {
  if (!url) return '';
  const cleanUrl = url.trim();

  if (cleanUrl.includes('cloudinary.com')) {
    const isRawResource = cleanUrl.includes('/raw/upload/') || cleanUrl.includes('/files/upload/');
    let viewableUrl = cleanUrl;
    if (!isRawResource) {
      viewableUrl = cleanUrl.replace('/upload/', '/upload/fl_attachment:false/');
    }
    return `https://docs.google.com/viewer?url=${encodeURIComponent(viewableUrl)}&embedded=true`;
  }
  return `https://docs.google.com/viewer?url=${encodeURIComponent(cleanUrl)}&embedded=true`;
}

module.exports = { getViewerUrl };
