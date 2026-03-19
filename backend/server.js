const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { LeveldbPersistence } = require('y-leveldb');

const port = process.env.PORT || 1234;
const persistenceDir = './yjs-storage';
const ldb = new LeveldbPersistence(persistenceDir);

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Y-Websocket Server');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  console.log('New connection:', req.url);
  setupWSConnection(conn, req, {
    gc: true,
    persistence: ldb
  });
});

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
