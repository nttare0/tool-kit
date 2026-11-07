// Run after the API build. All writes target a disposable SQLite database.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'toolstack-repositories-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');
process.env.NODE_ENV = 'test';
let server;
let db;
try {
  const { default: app } = await import('../dist/serverless.mjs');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  db = new DatabaseSync(process.env.SQLITE_PATH);
  const base = `http://127.0.0.1:${server.address().port}`;
  const list = async () => {
    const response = await fetch(base + '/api/repositories');
    assert.equal(response.status, 200);
    return response.json();
  };
  const repos = await list();
  assert(repos.length >= 990);
  assert.equal(new Set(repos.map(repo => repo.repositoryUrl.toLowerCase())).size, repos.length);
  assert(repos.some(repo => repo.host === 'gitlab.com'));
  assert(repos.some(repo => repo.host === 'github.com'));
  for (const repo of repos) {
    const url = new URL(repo.repositoryUrl);
    assert.equal(url.protocol, 'https:');
    assert(!url.username && !url.password);
    assert(url.pathname.split('/').filter(Boolean).length >= 2);
    assert(Array.isArray(repo.licenses) && Array.isArray(repo.tags));
    assert(!('api_key' in repo));
  }
  const first = repos[0];
  db.prepare("UPDATE tools SET status = 'draft' WHERE id = ?").run(first.id);
  assert(!(await list()).some(repo => repo.id === first.id));
  db.prepare("UPDATE tools SET status = 'published', website_url = 'https://example.com/changed' WHERE id = ?").run(first.id);
  assert(!(await list()).some(repo => repo.id === first.id));
  db.prepare("UPDATE tools SET website_url = 'https://github.com/example/changed' WHERE id = ?").run(first.id);
  const manual = (await list()).find(repo => repo.id === first.id);
  assert.equal(manual.repositoryUrl, 'https://github.com/example/changed');
  assert.deepEqual(manual.licenses, []);
  db.prepare("DELETE FROM tools WHERE id = ?").run(first.id);
  assert(!(await list()).some(repo => repo.id === first.id));
  const sitemap = await (await fetch(base + '/api/sitemap.xml')).text();
  assert(sitemap.includes('/repositories</loc>'));
  assert.equal((await fetch(base + '/repositories')).status, 200);
  console.log(`PASS: ${repos.length} unique repositories, native host links, licenses/topics, published-only access, stale metadata guard, manual repository links, deletion safety, sitemap and page route`);
} finally {
  db?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
