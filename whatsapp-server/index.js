const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'my-super-secret-key-123';

// Setup WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

let isClientReady = false;

let currentQrCode = null;

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED!');
    currentQrCode = qr; // Store it so the API can return it
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
    currentQrCode = null; // Clear QR code when connected
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    isClientReady = false;
    currentQrCode = null;
});

client.initialize();

// Middleware to check API KEY (Optional, currently disabled to match Next.js code)
const authenticateAPI = (req, res, next) => {
    // const apiKey = req.headers['x-api-key'];
    // if (!apiKey || apiKey !== API_KEY) {
    //     return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    // }
    next();
};

app.get('/', (req, res) => {
    res.json({ status: "WhatsApp Microservice is running" });
});

// API Endpoint to send a message
app.post('/send', authenticateAPI, async (req, res) => {
    try {
        if (!isClientReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp client is not ready yet. Please scan the QR code.' });
        }

        const { number, message } = req.body;

        if (!number || !message) {
            return res.status(400).json({ success: false, error: 'number and message are required.' });
        }

        // Format the phone number (assuming it's given without + or @c.us)
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

        // Send the message
        const response = await client.sendMessage(formattedNumber, message);

        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// The endpoint the frontend expects: /status
app.get('/status', (req, res) => {
    res.json({
        isConnected: isClientReady,
        qrCode: currentQrCode
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: isClientReady ? 'Connected' : 'Disconnected / Waiting for QR Scan'
    });
});

app.listen(port, () => {
    console.log(`WhatsApp API server is running on http://localhost:${port}`);
});
