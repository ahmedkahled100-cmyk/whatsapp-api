
const { ILovePDFClient } = require('./src/lib/ilovepdf.ts');
require('dotenv').config({ path: '.env.local' });

async function test() {
  console.log('Testing iLovePDF connection...');
  const isWorking = await ILovePDFClient.testConnection();
  console.log('Connection working:', isWorking);
  process.exit(isWorking ? 0 : 1);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
