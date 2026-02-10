import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import * as schema from './schema';
import { getDbPath } from './path';

let db: BetterSQLite3Database<typeof schema> | null = null;
let rawDb: Database.Database | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function getRawDb(): Database.Database | null {
  return rawDb;
}

export function initDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db;

  const BetterSqlite3 = require('better-sqlite3');
  const dbPath = getDbPath();

  rawDb = new BetterSqlite3(dbPath) as Database.Database;

  // Set pragmas
  rawDb.pragma('journal_mode = WAL');
  rawDb.pragma('busy_timeout = 5000');
  rawDb.pragma('foreign_keys = ON');

  db = drizzle(rawDb, { schema });
  return db;
}
