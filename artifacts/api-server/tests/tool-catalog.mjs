// Run after the API build. Uses a disposable database, never production.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import catalog from '../src/data/tool-catalog.json' with { type: 'json' };
assert.equal(catalog.length, 200);
assert.equal(new Set(catalog.map(tool => tool.name.toLowerCase())).size, 200);
assert.equal(new Set(catalog.map(tool => tool.websiteUrl)).size, 200);
for (const tool of catalog) {
  assert.equal(new URL(tool.websiteUrl).protocol, 'https:');
  assert(tool.shortDescription.length > 20);
}
const dir = await mkdtemp(path.join(os.tmpdir(), 'toolstack-catalog-'));
process.env.SQLITE_PATH = path.join(dir, 'catalog.sqlite');
process.env.NODE_ENV = 'test';
const entry = new URL('../dist/serverless.mjs', import.meta.url);
try {
  await import(entry.href);
  const db = new DatabaseSync(process.env.SQLITE_PATH);
  assert.equal(db.prepare('SELECT count(*) AS total FROM tools').get().total, 200);
  assert.equal(db.prepare("SELECT count(*) AS total FROM tools WHERE status = 'published'").get().total, 200);
  db.prepare("UPDATE tools SET short_description = 'Admin edited content' WHERE slug = 'chatgpt'").run();
  db.prepare("DELETE FROM tools WHERE slug = 'udio'").run();
  await import(`${entry.href}?restart=1`);
  assert.equal(db.prepare('SELECT count(*) AS total FROM tools').get().total, 199);
  assert.equal(db.prepare("SELECT short_description FROM tools WHERE slug = 'chatgpt'").get().short_description, 'Admin edited content');
  assert.equal(db.prepare("SELECT count(*) AS total FROM activity_log WHERE action = 'starter_catalog_200_v1'").get().total, 1);
  db.close();
  console.log('PASS: 200 unique tools, published listings, repeat-start safety, edits/deletions preserved');
} finally { await rm(dir, { recursive: true, force: true }); }
