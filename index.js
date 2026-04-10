const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/api/realtime-chat' });

// Configuration
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-f2c50037b1e5407f8f1a1680244edd2f'; 
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_local_secret'; 
const QWEN_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'; 

app.get('/', (req, res) => {
    res.status(200).send('Antigravity AI Maker Gateway is running.');
});

wss.on('connection', (clientWs, req) => {
    console.log('🔗 [Gateway] Frontend client connected.');
    
    let token;
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        token = url.searchParams.get('token');
        
        if (!token) throw new Error("Missing Token");
        jwt.verify(token, JWT_SECRET);
        console.log('✅ [Gateway] Auth passed.');
    } catch (err) {
        console.error('❌ [Gateway] Auth failed, closing connection:', err.message);
        clientWs.close(4001, 'Unauthorized');
        return;
    }

    const qwenWs = new WebSocket(QWEN_WS_URL, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    qwenWs.on('open', () => {
        console.log('🚀 [Gateway] Connected to Qwen API.');
        clientWs.send(JSON.stringify({ type: 'sys', message: 'model_ready' }));
    });

    clientWs.on('message', (data, isBinary) => {
        if (qwenWs.readyState === WebSocket.OPEN) {
            qwenWs.send(data, { binary: isBinary });
        }
    });

    qwenWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
        }
    });

    clientWs.on('close', () => {
        console.log('🔌 Frontend client disconnected.');
        if (qwenWs.readyState === WebSocket.OPEN) qwenWs.close();
    });

    qwenWs.on('close', () => {
        console.log('🛰️ Qwen API connection closed.');
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });

    qwenWs.on('error', (err) => {
        console.error('❌ Qwen WS Error:', err);
    });

    clientWs.on('error', (err) => {
        console.error('❌ Client WS Error:', err);
    });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ Antigravity Gateway listening on port ${PORT}`);
});
