const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { setupWSConnection, docs } = require('y-websocket/bin/utils');
const { LeveldbPersistence } = require('y-leveldb');
const Y = require('yjs');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 1234;
const persistenceDir = './yjs-storage';
const ldb = new LeveldbPersistence(persistenceDir);

// SQLite for version history
const db = new sqlite3.Database('./versions.db');
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      docName TEXT,
      content TEXT,
      state BLOB,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  console.log('New connection:', req.url);
  setupWSConnection(conn, req, {
    gc: true,
    persistence: ldb
  });
});

// Version Saving Logic (Background Job)
const saveInterval = 3000; // Save every 3 seconds if changed
const lastSavedContents = new Map();

setInterval(async () => {
  for (const [docName, doc] of docs.entries()) {
    const currentText = doc.getText('quill').toString();
    const lastSaved = lastSavedContents.get(docName);

    if (currentText && currentText !== lastSaved) {
      console.log(`Saving version for doc: ${docName}`);
      const state = Y.encodeStateAsUpdate(doc);
      
      db.run(
        'INSERT INTO versions (docName, content, state) VALUES (?, ?, ?)',
        [docName, currentText, Buffer.from(state)],
        function(err) {
          if (err) console.error('SQLite save error:', err);
          else {
            lastSavedContents.set(docName, currentText);
            // Limit to 50 versions (Test-C4)
            db.run(`
              DELETE FROM versions 
              WHERE docName = ? AND id NOT IN (
                SELECT id FROM versions WHERE docName = ? ORDER BY timestamp DESC LIMIT 50
              )
            `, [docName, docName]);
          }
        }
      );
    }
  }
}, saveInterval);

// API Endpoints for Version History
app.get('/api/versions/:docName', (req, res) => {
  const { docName } = req.params;
  db.all(
    'SELECT id, timestamp, content FROM versions WHERE docName = ? ORDER BY timestamp DESC LIMIT 50',
    [docName],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/versions/:docName/:id', (req, res) => {
  const { docName, id } = req.params;
  db.get(
    'SELECT * FROM versions WHERE id = ? AND docName = ?',
    [id, docName],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Version not found' });
      res.json(row);
    }
  );
});

app.post('/api/rollback/:docName/:id', async (req, res) => {
  const { docName, id } = req.params;
  
  db.get(
    'SELECT state FROM versions WHERE id = ? AND docName = ?',
    [id, docName],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Version not found' });

      const doc = docs.get(docName);
      if (doc) {
        // Apply the historical state as an update to current doc
        // In Yjs, applying an old state as update will merge it. 
        // To truly "rollback", we might want to clear current text and insert the old text.
        // But the requirement says "Other users see rolled back content in real time".
        
        // A cleaner rollback for text:
        const oldYdoc = new Y.Doc();
        Y.applyUpdate(oldYdoc, row.state);
        const oldText = oldYdoc.getText('quill').toString();
        
        doc.transact(() => {
          const currentText = doc.getText('quill');
          currentText.delete(0, currentText.length);
          currentText.insert(0, oldText);
        });
        
        console.log(`Rolled back doc ${docName} to version ${id}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Document not currently active on server' });
      }
    }
  );
});

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
