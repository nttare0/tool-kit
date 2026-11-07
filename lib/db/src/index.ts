import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// DATABASE_URL is only required when the Postgres-backed `db` is actually used.
// The Toolstack production app uses `node:sqlite` (artifacts/api-server/src/lib/sqlite.ts)
// and does NOT need this. We keep this package for workspace compatibility but
// defer the env check to runtime so `import { db }` doesn't crash builds and
// local dev when DATABASE_URL is absent.
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database? This workspace package (@workspace/db) needs Postgres, but the Toolstack API uses SQLite and does not require it.",
    );
  }
  return url;
}

let _pool: InstanceType<typeof Pool> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: getDatabaseUrl() });
  return _pool;
}

export function getDb() {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

// Backwards-compat lazy getters — accessing `pool`/`db` will now throw with a
// clearer message only at use-time, not at import time.
export const pool = new Proxy({} as InstanceType<typeof Pool>, {
  get(_t, prop) {
    const p = getPool() as any;
    return p[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    const d = getDb() as any;
    return d[prop];
  },
});

export * from "./schema";
