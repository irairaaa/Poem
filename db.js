const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use a persistent directory if available (Railway volume), otherwise local file
const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'poetry.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS poems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    likes INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poem_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
  );
`);

module.exports = db;
