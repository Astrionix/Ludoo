/**
 * index.js
 * Entry point for the server-authoritative Ludo real-time multiplayer backend.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const WebSocketGateway = require('./src/WebSocketGateway');
const db = require('./src/DatabaseService');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'OK', service: 'Ludo Real-Time Server' }));
  }

  // Auth Signup Endpoint
  if (req.url === '/api/auth/signup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { name, email, password } = JSON.parse(body || '{}');
        if (!email || !password || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Name, Email, and Password are required.' }));
        }

        const result = await db.signupUser(name, email, password);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Auth Login Endpoint
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body || '{}');
        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Email and Password are required.' }));
        }

        const result = await db.loginUser(email, password);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, (err, data) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK', service: 'Ludo Real-Time Server' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
});

const wss = new WebSocketServer({ server });
const gateway = new WebSocketGateway(wss);

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` Ludo Real-Time Multiplayer Server Running`);
  console.log(` Listening on http://${HOST}:${PORT}`);
  console.log(` Web Client URL: http://192.168.29.16:${PORT}`);
  console.log(`====================================================`);
});
