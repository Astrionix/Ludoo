/**
 * index.js
 * Entry point for the server-authoritative Ludo real-time multiplayer backend.
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocketGateway = require('./src/WebSocketGateway');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'OK', service: 'Ludo Real-Time Server' }));
});

const wss = new WebSocketServer({ server });
const gateway = new WebSocketGateway(wss);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Ludo Real-Time Multiplayer Server Running`);
  console.log(` Listening on ws://localhost:${PORT}`);
  console.log(`====================================================`);
});
