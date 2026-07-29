const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=========================================================');
console.log('      AN-Academy - Standalone WhatsApp Server');
console.log('=========================================================');
console.log('');

const targetDir = path.join(__dirname, 'whatsapp-server');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const pkgPath = path.join(targetDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
    console.log('[SETUP] Creating package.json...');
    const pkgContent = {
        "name": "whatsapp-server",
        "version": "1.0.0",
        "main": "index.js",
        "scripts": {
            "start": "node index.js"
        },
        "dependencies": {
            "cors": "^2.8.6",
            "dotenv": "^17.4.2",
            "express": "^5.2.1",
            "qrcode-terminal": "^0.12.0",
            "whatsapp-web.js": "^1.34.7"
        }
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkgContent, null, 2), 'utf-8');
}

const indexPath = path.join(targetDir, 'index.js');
if (!fs.existsSync(indexPath)) {
    console.log('[SETUP] Creating index.js...');
    const indexContent = `const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

const puppeteerOptions = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
};

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerOptions
});

let isClientReady = false;
let currentQrCode = null;

client.on('qr', (qr) => {
    console.log('QR RECEIVED!');
    currentQrCode = qr;
    try {
        qrcode.generate(qr, { small: true });
    } catch (e) {
        console.log('QR Code generated (Length: ' + qr.length + ')');
    }
});

process.on('uncaughtException', (err) => {
    console.error('[SERVER ERROR] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[SERVER ERROR] Unhandled Rejection:', reason);
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
    currentQrCode = null;
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    isClientReady = false;
    currentQrCode = null;
    try { client.initialize(); } catch (e) { console.error('Error re-initializing:', e); }
});

client.initialize();

app.get('/', (req, res) => res.json({ status: "WhatsApp Microservice is running" }));

app.post('/send', async (req, res) => {
    try {
        if (!isClientReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp client is not ready yet. Please scan the QR code.' });
        }
        const { number, message } = req.body;
        if (!number || !message) {
            return res.status(400).json({ success: false, error: 'number and message are required.' });
        }
        const formattedNumber = number.includes('@c.us') ? number : \`\${number}@c.us\`;
        const response = await client.sendMessage(formattedNumber, message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

app.get('/status', (req, res) => {
    res.json({ isConnected: isClientReady, qrCode: currentQrCode });
});

app.get('/api/status', (req, res) => {
    res.json({ success: true, status: isClientReady ? 'Connected' : 'Disconnected / Waiting for QR Scan' });
});

app.listen(port, () => {
    console.log(\`WhatsApp API server is running on http://localhost:\${port}\`);
});
`;
    fs.writeFileSync(indexPath, indexContent, 'utf-8');
}

const nodeModulesPath = path.join(targetDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('[INSTALL] Installing WhatsApp microservice dependencies for the first time (may take ~1 min)...');
    execSync('npm install --quiet --no-progress', { cwd: targetDir, stdio: 'ignore' });
    console.log('[SUCCESS] Package installation completed successfully!');
    console.log('');
}

console.log('[START] Starting WhatsApp Server on http://localhost:3001 ...');
console.log('');

require(indexPath);
