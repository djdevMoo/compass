// A small, durable document store on SQLite (Node's built-in driver).
//
// Every module in the app (finance, diet, fitness, ...) keeps its records as JSON
// documents grouped by `collection`. New modules need no schema changes here, and
// the whole database is one file that is easy to back up.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_VERSION = 1;
const BACKUPS_TO_KEEP = 14;
const BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000;
const EXPORT_APP_TAG = 'compass';

const isName = (s) => typeof s === 'string' && s.length > 0 && s.length <= 128;

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export class Store {
  /** @param {string} dbPath @param {string} backupDir */
  constructor(dbPath, backupDir) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });
    this.backupDir = backupDir;
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 3000;
    `);
    this.migrate();
    this.putStmt = this.db.prepare(
      `INSERT INTO docs (collection, id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    );
    this.delStmt = this.db.prepare('DELETE FROM docs WHERE collection = ? AND id = ?');
    this.kvStmt = this.db.prepare(
      `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    );
  }

  migrate() {
    const { user_version: version } = this.db.prepare('PRAGMA user_version').get();
    if (version < 1) {
      this.tx(() => {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS docs (
            collection TEXT NOT NULL,
            id         TEXT NOT NULL,
            data       TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (collection, id)
          ) WITHOUT ROWID;
          CREATE TABLE IF NOT EXISTS kv (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          ) WITHOUT ROWID;
          PRAGMA user_version = 1;
        `);
      });
    }
    // Future schema changes go here as `if (version < 2) { ... }` blocks.
  }

  /** Runs `fn` in a transaction: everything lands, or nothing does. */
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  loadAll() {
    const docs = [];
    for (const row of this.db.prepare('SELECT collection, id, data FROM docs ORDER BY collection, updated_at').all()) {
      try {
        docs.push({ collection: row.collection, id: row.id, data: JSON.parse(row.data) });
      } catch {
        // A row that fails to parse is skipped rather than taking the whole app down.
      }
    }
    const kv = {};
    for (const row of this.db.prepare('SELECT key, value FROM kv').all()) {
      try {
        kv[row.key] = JSON.parse(row.value);
      } catch {
        /* skip */
      }
    }
    return { docs, kv };
  }

  /** @param {Array<{op:string, collection?:string, id?:string, key?:string, data?:unknown, value?:unknown}>} ops */
  apply(ops) {
    if (!Array.isArray(ops)) throw new Error('ops must be an array');
    const ts = Date.now();
    this.tx(() => {
      for (const o of ops) {
        if (o?.op === 'put' && isName(o.collection) && isName(o.id)) {
          this.putStmt.run(o.collection, o.id, JSON.stringify(o.data ?? null), ts);
        } else if (o?.op === 'delete' && isName(o.collection) && isName(o.id)) {
          this.delStmt.run(o.collection, o.id);
        } else if (o?.op === 'kv' && isName(o.key)) {
          this.kvStmt.run(o.key, JSON.stringify(o.value ?? null), ts);
        } else {
          throw new Error('Invalid write operation');
        }
      }
    });
  }

  exportTo(file) {
    const { docs, kv } = this.loadAll();
    const payload = { app: EXPORT_APP_TAG, format: SCHEMA_VERSION, exportedAt: new Date().toISOString(), docs, kv };
    // Write to a temp file first so a crash mid-write never leaves a half file behind.
    const tmp = `${file}.compass-tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  /** Replaces everything with the contents of an export file. A backup is taken first. */
  importFrom(file) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`Not a Compass export file (${e.message})`);
    }
    if (parsed?.app !== EXPORT_APP_TAG || !Array.isArray(parsed.docs) || typeof parsed.kv !== 'object') {
      throw new Error('Not a Compass export file');
    }
    if (parsed.format > SCHEMA_VERSION) throw new Error('This export was made by a newer version of Compass');
    this.backup('pre-import');
    const ts = Date.now();
    this.tx(() => {
      this.db.exec('DELETE FROM docs; DELETE FROM kv;');
      for (const d of parsed.docs) {
        if (isName(d?.collection) && isName(d?.id)) this.putStmt.run(d.collection, d.id, JSON.stringify(d.data ?? null), ts);
      }
      for (const [k, v] of Object.entries(parsed.kv ?? {})) {
        if (isName(k)) this.kvStmt.run(k, JSON.stringify(v ?? null), ts);
      }
    });
  }

  /** Empties everything (callers take a backup first). */
  clearAll() {
    this.tx(() => this.db.exec('DELETE FROM docs; DELETE FROM kv;'));
  }

  /** Writes a consistent copy of the database into the backups folder. */
  backup(label) {
    const file = path.join(this.backupDir, `compass_${stamp()}_${label}.db`);
    if (fs.existsSync(file)) fs.rmSync(file);
    this.db.prepare('VACUUM INTO ?').run(file);
    this.pruneBackups();
    return file;
  }

  backupIfDue() {
    const newest = this.listBackups()
      .map((f) => fs.statSync(f).mtimeMs)
      .reduce((a, b) => Math.max(a, b), 0);
    const hasData = !!this.db.prepare('SELECT 1 AS x FROM docs LIMIT 1').get();
    if (hasData && Date.now() - newest >= BACKUP_INTERVAL_MS) this.backup('auto');
  }

  listBackups() {
    // Names start with a sortable timestamp, so name order is age order.
    return fs
      .readdirSync(this.backupDir)
      .filter((n) => n.startsWith('compass_') && n.endsWith('.db'))
      .sort()
      .map((n) => path.join(this.backupDir, n));
  }

  pruneBackups() {
    const all = this.listBackups();
    for (const old of all.slice(0, Math.max(0, all.length - BACKUPS_TO_KEEP))) {
      try {
        fs.rmSync(old);
      } catch {
        /* a locked old backup is not worth failing over */
      }
    }
  }

  close() {
    try {
      this.db.close();
    } catch {
      /* already closed */
    }
  }
}
