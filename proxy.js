const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-freepik-api-key');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- Route 1: /upload → https://upload.iismedika.online/ ---
    if (req.url === '/upload' && req.method === 'POST') {
        const options = {
            hostname: 'upload.iismedika.online',
            port: 443,
            path: '/',
            method: 'POST',
            headers: {}
        };

        // Forward content-type (important for multipart/form-data boundary)
        if (req.headers['content-type']) {
            options.headers['Content-Type'] = req.headers['content-type'];
        }
        if (req.headers['content-length']) {
            options.headers['Content-Length'] = req.headers['content-length'];
        }

        const proxyReq = https.request(options, (proxyRes) => {
            // Remove CORS headers from upstream, we set our own
            const headers = { ...proxyRes.headers };
            delete headers['access-control-allow-origin'];
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Upload proxy error:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Upload proxy error: ' + err.message }));
        });

        // Pipe raw request body directly (preserves multipart/form-data)
        req.pipe(proxyReq);
        return;
    }

    // --- Route 2: /api/* → https://api.freepik.com/* ---
    if (req.url.startsWith('/api/')) {
        const targetPath = req.url.replace('/api', '');
        const parsedUrl = url.parse(`https://api.freepik.com${targetPath}`);

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.path,
                method: req.method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            };

            if (req.headers['x-freepik-api-key']) {
                options.headers['x-freepik-api-key'] = req.headers['x-freepik-api-key'];
            }
            if (body) {
                options.headers['Content-Length'] = Buffer.byteLength(body);
            }

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('API proxy error:', err.message);
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
            });

            if (body) proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    // Fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use /api/ or /upload' }));
});

server.listen(PORT, () => {
    console.log(`\n  🚀 CORS Proxy running at http://localhost:${PORT}`);
    console.log(`  /api/*   → https://api.freepik.com/*`);
    console.log(`  /upload  → https://upload.iismedika.online/\n`);
});
