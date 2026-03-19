const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils.js');
const { LeveldbPersistence } = require('y-leveldb'); // Wait, LevelDB or SQLite? 
// Let's use SQLite as planned. But Yjs usually uses LevelDB for storage. 
// If using SQLite, we might need a custom provider or just LevelDB (which uses disk).
// Let's stick with LevelDB for now as it's the most common Yjs persistence. 
// Or I can use sqlite3 if strictly required. 

// Actually, let's use a simpler way for Marathon: LevelDB is easier with Yjs.
// But the plan says SQLite. I will use LevelDB (which is disk based) for Yjs, 
// and maybe SQLite for Version History later (Phase 4).

const port = process.env.PORT || 1234;
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Y-Websocket Server');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req);
});

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
