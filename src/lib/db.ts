import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

declare global {
  var __briefingDb: DatabaseSync | undefined;
}

function openDb(): DatabaseSync {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(/* turbopackIgnore: true */ dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new DatabaseSync(path.join(dataDir, "app.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER
    );
  `);
  return db;
}

// Lazily open a single connection on first use, reused across hot reloads /
// route handler invocations. Must stay lazy: importing this module happens
// during `next build`'s page-data collection, and eagerly opening the DB
// there would create a stray data file baked into the build output.
function getDb(): DatabaseSync {
  if (!globalThis.__briefingDb) {
    globalThis.__briefingDb = openDb();
  }
  return globalThis.__briefingDb;
}

export function getKV<T>(key: string): T | null {
  const row = getDb()
    .prepare("SELECT value, expires_at FROM kv WHERE key = ?")
    .get(key) as { value: string; expires_at: number | null } | undefined;

  if (!row) return null;
  if (row.expires_at !== null && row.expires_at < Date.now()) {
    deleteKV(key);
    return null;
  }
  return JSON.parse(row.value) as T;
}

export function setKV(key: string, value: unknown, ttlSeconds?: number): void {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  getDb()
    .prepare(
      `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
    )
    .run(key, JSON.stringify(value), expiresAt);
}

export function deleteKV(key: string): void {
  getDb().prepare("DELETE FROM kv WHERE key = ?").run(key);
}
