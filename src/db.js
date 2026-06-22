// SQLite schema + connection. Single local file at data/dashboard.db.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
// PD_DB_PATH lets tests/CI point at an isolated database file.
const DB_PATH = process.env.PD_DB_PATH || join(ROOT, 'data', 'dashboard.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      project_name  TEXT    NOT NULL DEFAULT 'My Project',
      show_completed INTEGER NOT NULL DEFAULT 1,
      theme         TEXT    NOT NULL DEFAULT 'light',
      container_align TEXT  NOT NULL DEFAULT 'center'
    );

    CREATE TABLE IF NOT EXISTS todos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      done        INTEGER NOT NULL DEFAULT 0,
      explanation TEXT    NOT NULL DEFAULT '',
      due_date    TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      remote_url TEXT,
      cwd        TEXT,
      model      TEXT,
      effort     TEXT,
      prompt     TEXT,
      tmux_name  TEXT,
      status     TEXT    NOT NULL DEFAULT 'starting',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_todo ON sessions(todo_id);

    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      body       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id);
  `);

  // Migration: add columns introduced after the initial schema (existing DBs).
  const configCols = db.prepare('PRAGMA table_info(config)').all().map((c) => c.name);
  if (!configCols.includes('container_align')) {
    db.exec("ALTER TABLE config ADD COLUMN container_align TEXT NOT NULL DEFAULT 'center'");
  }

  // Ensure the single config row exists.
  db.prepare(`INSERT OR IGNORE INTO config (id) VALUES (1)`).run();
}

// Allow `node src/db.js --init` for the setup script.
if (process.argv.includes('--init')) {
  initSchema();
  console.log('DB initialized at', DB_PATH);
}
