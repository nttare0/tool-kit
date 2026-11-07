// Run after pnpm --filter @workspace/api-server build.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'toolstack-auth-'));
process.env.SQLITE_PATH = path.join(dir, 'test.sqlite');
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const password = crypto.randomBytes(24).toString('base64url');
const salt = crypto.randomBytes(16).toString('hex');
process.env.ADMIN_BOOTSTRAP = Buffer.from(JSON.stringify({
  email: 'owner@example.com', salt,
  hash: crypto.scryptSync(password, salt, 64).toString('hex'),
})).toString('base64');
const { default: app } = await import('../dist/serverless.mjs');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
try {
  assert.equal((await (await fetch(`${base}/auth/status`)).json()).configured, true);
  const login = async p => fetch(`${base}/auth/login`, {method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'owner@example.com', password: p})});
  assert.equal((await login('wrong')).status, 401);
  const response = await login(password);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const status = await (await fetch(`${base}/auth/status`, {headers: {cookie}})).json();
  assert.equal(status.authenticated, true);
  assert.equal(status.admin.email, 'owner@example.com');
  assert.equal((await fetch(`${base}/admin/users`, {headers: {cookie}})).status, 200);
  assert.equal((await fetch(`${base}/admin/users`)).status, 401);
  await fetch(`${base}/auth/logout`, {method:'POST',headers:{cookie}});
  assert.equal((await (await fetch(`${base}/auth/status`, {headers:{cookie}})).json()).authenticated, false);
  console.log('PASS: provision, reject wrong password, login, protected dashboard, logout');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(dir, {recursive:true, force:true});
}
