// Shared asynchronous database API. SQLite is for local development only;
// production uses a dedicated, non-public schema in Supabase PostgreSQL.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import pg, { type PoolClient } from "pg";
import { sqliteSchema } from "./sqlite-schema";

const databaseUrl = process.env.DATABASE_URL;
if (process.env.VERCEL && !databaseUrl) {
  throw new Error(
    "DATABASE_URL is required on Vercel. Temporary SQLite storage is disabled.",
  );
}
const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_SSL_CA
          ? { ca: process.env.DATABASE_SSL_CA }
          : /\.supabase\.(com|co)$/.test(new URL(databaseUrl).hostname)
            ? { ca: fs.readFileSync(new URL("./certs/supabase-ca.crt", import.meta.url), "utf8") }
            : {}),
      },
    })
  : undefined;
const connection = new AsyncLocalStorage<PoolClient>();
const localTransaction = new AsyncLocalStorage<boolean>();
let sqlite: DatabaseSync | undefined;
if (!pool) {
  const databasePath =
    process.env.SQLITE_PATH ||
    path.join(process.cwd(), "data", "toolstack.sqlite");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  sqlite = new DatabaseSync(databasePath);
  sqlite.exec(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;",
  );
  sqlite.exec(sqliteSchema);
  const columns = sqlite
    .prepare("PRAGMA table_info(llm_providers)")
    .all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "api_key_encrypted")) {
    sqlite.exec("ALTER TABLE llm_providers ADD COLUMN api_key_encrypted TEXT");
  }
}
export type SqliteRow = Record<string, unknown>;

// SQL originates only in server source, never in an HTTP request.
export function postgresQuery(query: string) {
  let index = 0;
  // Ignore quoted literals while converting positional parameters.
  return query
    .replace(/'(?:''|[^'])*'|\?/g, (token) =>
      token === "?" ? `$${++index}` : token,
    )
    .replace(/\bAS\s+([a-z_]+[A-Z][a-zA-Z]*)/g, 'AS "$1"')
    .replace(/count\(\*\)/gi, "count(*)::integer");
}
async function queryPg(query: string, params: unknown[]) {
  const client = connection.getStore();
  if (client) return client.query(query, params);
  return transaction(() => connection.getStore()!.query(query, params));
}
export async function all<T extends SqliteRow = SqliteRow>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  if (pool) return (await queryPg(postgresQuery(query), params)).rows as T[];
  return sqlite!.prepare(query).all(...(params as never[])) as T[];
}
export async function get<T extends SqliteRow = SqliteRow>(
  query: string,
  ...params: unknown[]
): Promise<T | undefined> {
  return (await all<T>(query, ...params))[0];
}
export async function run(
  query: string,
  ...params: unknown[]
): Promise<{ changes: number; lastInsertRowid: number | string }> {
  if (!pool) {
    const result = sqlite!.prepare(query).run(...(params as never[]));
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }
  let sql = postgresQuery(query);
  if (/^INSERT OR IGNORE /i.test(sql))
    sql =
      sql.replace(/^INSERT OR IGNORE /i, "INSERT ") + " ON CONFLICT DO NOTHING";
  if (/^INSERT INTO /i.test(sql)) sql += " RETURNING *";
  const result = await queryPg(sql, params);
  return {
    changes: result.rowCount ?? 0,
    lastInsertRowid: result.rows[0]?.id ?? 0,
  };
}
let localQueue: Promise<unknown> = Promise.resolve();
export async function transaction<T>(
  callback: () => Promise<T> | T,
): Promise<T> {
  if (pool) {
    if (connection.getStore()) return callback();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path = toolstack");
      const result = await connection.run(client, callback);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  if (localTransaction.getStore()) return callback();
  const execute = () =>
    localTransaction.run(true, async () => {
      sqlite!.exec("BEGIN");
      try {
        const result = await callback();
        sqlite!.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite!.exec("ROLLBACK");
        throw error;
      }
    });
  const result = localQueue.then(execute, execute);
  localQueue = result.catch(() => undefined);
  return result;
}
export async function lockInitialization() {
  if (pool) await queryPg("SELECT pg_advisory_xact_lock(71934612)", []);
}
