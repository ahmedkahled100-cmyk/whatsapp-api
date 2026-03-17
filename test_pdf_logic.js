
const { getViewerUrl } = require('./src/lib/utils_cjs'); // I'll create a temp CJS version for testing

const testUrls = [
  'https://res.cloudinary.com/demo/image/upload/v12345/sample.pdf',
  'https://res.cloudinary.com/demo/raw/upload/v12345/sample.pdf',
  'https://res.cloudinary.com/demo/files/upload/v12345/sample.pdf',
  'https://example.com/somefile.pdf'
];

console.log('--- Testing getViewerUrl Logic ---');
testUrls.forEach(url => {
  const viewerUrl = getViewerUrl(url);
  console.log(`Original: ${url}`);
  console.log(`Viewer:   ${viewerUrl}`);
  console.log('---');
});

// Manual simplified check for isPdf logic from component
const isPdfCheck = (url) => {
  return url.match(/\.pdf$/i) || url.includes('application%2Fpdf') || url.includes('.pdf') || url.includes('/raw/upload/') || url.includes('/files/upload/');
};

console.log('\n--- Testing isPdf Logic ---');
testUrls.forEach(url => {
  console.log(`${url} -> isPdf: ${isPdfCheck(url)}`);
});
