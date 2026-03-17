
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');

// Get keys from arguments or environment
const PUBLIC_KEY = process.argv[2] || process.env.ILOVEPDF_PUBLIC_KEY;
const SECRET_KEY = process.argv[3] || process.env.ILOVEPDF_SECRET_KEY;

if (!PUBLIC_KEY || !SECRET_KEY) {
  console.error('Usage: node test_ilovepdf_direct.js <PUBLIC_KEY> <SECRET_KEY>');
  process.exit(1);
}

const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);

async function test() {
  try {
    console.log('Testing connection with Public Key:', PUBLIC_KEY.substring(0, 20) + '...');
    const task = instance.newTask('compress');
    await task.start();
    console.log('SUCCESS: iLovePDF connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('FAILURE: iLovePDF connection failed:', error.message || error);
    process.exit(1);
  }
}

test();
