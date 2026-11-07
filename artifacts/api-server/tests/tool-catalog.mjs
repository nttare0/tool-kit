// Run after the API build. Uses a disposable database, never production.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import catalog from '../src/data/tool-catalog.json' with { type: 'json' };
import supplement from '../src/data/additional-tool-catalog.json' with { type: 'json' };
const slug = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const identity = value => { const url = new URL(value); return url.hostname.replace(/^www\./, '').toLowerCase() + url.pathname.replace(/\/$/, '').toLowerCase(); };
const combined = [...catalog, ...supplement.tools];
assert.equal(supplement.tools.length, 1000);
assert.equal(new Set(combined.map(tool => slug(tool.name))).size, 1200);
assert.equal(new Set(combined.map(tool => identity(tool.websiteUrl))).size, 1200);
for (const tool of supplement.tools) {
  const url = new URL(tool.websiteUrl);
  assert(['http:', 'https:'].includes(url.protocol));
  assert(!url.username && !url.password);
  assert(tool.shortDescription.length > 20);
  assert(tool.sourceUrl.startsWith(supplement.source + '/blob/' + supplement.sourceCommit + '/software/'));
}
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
  assert.equal(db.prepare('SELECT count(*) AS total FROM tools').get().total, 1200);
  assert.equal(db.prepare("SELECT count(*) AS total FROM tools WHERE status = 'published'").get().total, 1200);
  assert.equal(db.prepare('SELECT count(*) AS total FROM categories').get().total, 13);
  const added = db.prepare('SELECT slug FROM tools WHERE name = ?').get(supplement.tools[0].name);
  assert(added);
  assert(db.prepare('SELECT description FROM tools WHERE slug = ?').get(added.slug).description.includes('CC BY-SA 3.0'));
  db.prepare("UPDATE tools SET short_description = 'Admin edited content' WHERE slug = 'chatgpt'").run();
  db.prepare("DELETE FROM tools WHERE slug = 'udio'").run();
  db.prepare('DELETE FROM tools WHERE slug = ?').run(added.slug);
  await import(`${entry.href}?restart=1`);
  assert.equal(db.prepare('SELECT count(*) AS total FROM tools').get().total, 1198);
  assert.equal(db.prepare("SELECT short_description FROM tools WHERE slug = 'chatgpt'").get().short_description, 'Admin edited content');
  assert.equal(db.prepare("SELECT count(*) AS total FROM activity_log WHERE action = 'starter_catalog_200_v1'").get().total, 1);
  assert.equal(db.prepare("SELECT count(*) AS total FROM activity_log WHERE action = 'additional_catalog_1000_v1'").get().total, 1);
  assert.equal(db.prepare('SELECT count(*) AS total FROM tools WHERE slug = ?').get(added.slug).total, 0);
  db.close();
  console.log('PASS: 1,200 unique tools, 13 categories, attribution, published listings, repeat-start safety, edits/deletions preserved');
} finally { await rm(dir, { recursive: true, force: true }); }
