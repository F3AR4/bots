/**
 * Database Connection & Migration Engine.
 * 
 * Uses Node's built-in node:sqlite DatabaseSync for zero native compilation dependencies.
 * Supports persistent file-based SQLite and in-memory execution for tests/replays.
 */

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseManager {
  private db: DatabaseSync;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'copy_trading.db');
    
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    // Enforce foreign keys and WAL mode for reliability
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
  }

  public getDatabase(): DatabaseSync {
    return this.db;
  }

  public migrate(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schemaSql);
    } else {
      // Fallback relative to project root
      const fallbackPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
      const schemaSql = fs.readFileSync(fallbackPath, 'utf8');
      this.db.exec(schemaSql);
    }

    // Safely migrate existing databases with new columns
    try {
      this.db.exec("ALTER TABLE rule_sets ADD COLUMN parameter_metadata_json TEXT;");
    } catch {
      // Column already exists or table not yet created
    }

    try {
      this.db.exec("ALTER TABLE decision_journals ADD COLUMN market_snapshot_id TEXT;");
    } catch {
      // Column already exists or table not yet created
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }
}

// Singleton helper for application default instance
let defaultManager: DatabaseManager | null = null;

export function getDatabaseManager(dbPath?: string): DatabaseManager {
  if (dbPath && dbPath === ':memory:') {
    const manager = new DatabaseManager(':memory:');
    manager.migrate();
    return manager;
  }
  if (!defaultManager) {
    defaultManager = new DatabaseManager(dbPath);
    defaultManager.migrate();
  }
  return defaultManager;
}
