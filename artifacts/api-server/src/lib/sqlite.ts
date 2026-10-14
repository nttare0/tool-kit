import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const databasePath =
  process.env.SQLITE_PATH || path.join(process.cwd(), "data", "toolstack.sqlite");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const sqlite = new DatabaseSync(databasePath);

sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    accent TEXT NOT NULL DEFAULT '#D8FF63'
  );

  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    how_it_works TEXT NOT NULL,
    best_for TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL,
    logo_url TEXT,
    preview_url TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    pricing TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    profession TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS tool_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    how_it_works TEXT NOT NULL,
    best_for TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL,
    logo_url TEXT,
    preview_url TEXT,
    pricing TEXT NOT NULL,
    suggested_categories TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT,
    published_tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_type TEXT NOT NULL,
    actor_id INTEGER,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    adapter TEXT NOT NULL,
    base_url TEXT NOT NULL,
    model TEXT NOT NULL,
    api_key_secret_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tool_id)
  );

  CREATE TABLE IF NOT EXISTS user_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collection_tools (
    collection_id INTEGER NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (collection_id, tool_id)
  );
`);

export type SqliteRow = Record<string, unknown>;

export function all<T extends SqliteRow = SqliteRow>(
  query: string,
  ...params: unknown[]
): T[] {
  return sqlite.prepare(query).all(...(params as never[])) as T[];
}

export function get<T extends SqliteRow = SqliteRow>(
  query: string,
  ...params: unknown[]
): T | undefined {
  return sqlite.prepare(query).get(...(params as never[])) as T | undefined;
}

export function run(query: string, ...params: unknown[]) {
  return sqlite.prepare(query).run(...(params as never[]));
}

export function transaction<T>(callback: () => T): T {
  sqlite.exec("BEGIN");
  try {
    const result = callback();
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}