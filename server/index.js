/**
 * index.js
 * Entry point for the server-authoritative Ludo real-time multiplayer backend.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const WebSocketGateway = require('./src/WebSocketGateway');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'OK', service: 'Ludo Real-Time Server' }));
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
