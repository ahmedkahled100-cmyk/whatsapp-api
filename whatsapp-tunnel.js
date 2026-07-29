const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const urlFilePath = path.join(__dirname, 'whatsapp-tunnel.url');

async function startTunnel() {
  try {
    console.log('[TUNNEL] Connecting WhatsApp tunnel for port 3001...');
    // Attempt fixed subdomain first
    let tunnel;
    try {
      tunnel = await localtunnel({ port: 3001, subdomain: 'an-academy-whatsapp' });
    } catch (e) {
      tunnel = await localtunnel({ port: 3001 });
    }
    
    console.log('[TUNNEL SUCCESS] Public URL:', tunnel.url);
    fs.writeFileSync(urlFilePath, tunnel.url, 'utf8');

    // Keep-alive ping every 20 seconds to prevent 503 Tunnel Unavailable & 408 Timeout
    const keepAliveInterval = setInterval(() => {
      if (tunnel && tunnel.url) {
        const client = tunnel.url.startsWith('https') ? https : http;
        client.get(tunnel.url + '/status', { headers: { 'bypass-tunnel-reminder': 'true' } }, (res) => {
          res.resume();
        }).on('error', () => {});
      }
    }, 20000);

    tunnel.on('close', () => {
      clearInterval(keepAliveInterval);
      console.log('[TUNNEL] Closed. Reconnecting in 3 seconds...');
      if (fs.existsSync(urlFilePath)) {
        try { fs.unlinkSync(urlFilePath); } catch (e) {}
      }
      setTimeout(startTunnel, 3000);
    });

    process.on('SIGINT', () => {
      clearInterval(keepAliveInterval);
      if (fs.existsSync(urlFilePath)) { try { fs.unlinkSync(urlFilePath); } catch (e) {} }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      clearInterval(keepAliveInterval);
      if (fs.existsSync(urlFilePath)) { try { fs.unlinkSync(urlFilePath); } catch (e) {} }
      process.exit(0);
    });

  } catch (err) {
    console.error('[TUNNEL ERROR]', err);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
