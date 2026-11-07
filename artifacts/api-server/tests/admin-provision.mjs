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
const nativeFetch = globalThis.fetch;
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
  const request = (route, body) => nativeFetch(`${base}${route}`, {
    method: 'POST', headers: {cookie, 'content-type':'application/json'}, body: JSON.stringify(body),
  });
  assert.equal((await request('/ai/chat', {messages:[{role:'user',content:'Hello'}]})).status, 503);
  let lastRequest;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url, options);
    lastRequest = {url:String(url), options, body:options.body ? JSON.parse(options.body) : null};
    if (new URL(url).pathname.endsWith('/models')) return Response.json({data:[{id:'test-model'},{id:'text-embedding-fixture'}]});
    return Response.json({candidates:[{content:{parts:[{text:'{"reply":"Connected","draft":null}'}]}}],
      choices:[{message:{content:'{"reply":"Connected","draft":null}'}}],
      output:[{content:[{type:'output_text',text:'{"reply":"Connected","draft":null}'}]}],
      content:[{type:'text',text:'{"reply":"Connected","draft":null}'}]});
  };
  for (const [adapter, baseUrl] of [
    ['gemini','https://generativelanguage.googleapis.com/v1beta'],
    ['openai-compatible','https://llm.example.com/v1'],
    ['openai-responses','https://api.openai.com/v1'],
    ['anthropic','https://api.anthropic.com/v1'],
  ]) {
    const created = await request('/admin/llm-providers', {
      name:adapter, adapter, baseUrl, model:'test-model', apiKey:'test-only-not-a-real-key',
    });
    assert.equal(created.status,201);
    const provider = await created.json();
    assert.equal(provider.configured,true);
    assert.equal(JSON.stringify(provider).includes('test-only-not-a-real-key'),false);
    const response = await request('/ai/chat', {providerId:provider.id,messages:[{role:'user',content:'Hello'}]});
    assert.equal(response.status,200);
    assert.equal((await response.json()).reply,'Connected');
    if (adapter === 'gemini') {
      assert.equal(lastRequest.options.headers['x-goog-api-key'],'test-only-not-a-real-key');
      assert.equal(lastRequest.url.includes('key='),false);
    }
    if (adapter === 'anthropic') assert.equal(lastRequest.url,'https://api.anthropic.com/v1/messages');
    if (adapter === 'openai-compatible') assert.equal(lastRequest.body.response_format,undefined);
    if (adapter === 'openai-responses') {
      assert.match(lastRequest.url,/\/responses$/);
      assert.equal(lastRequest.body.input[1].role,'user');
      assert.equal(lastRequest.body.messages,undefined);
    }
    assert.equal((await request(`/admin/llm-providers/${provider.id}/test`,{})).status,200);
    if (adapter === 'openai-compatible') {
      const models = await (await nativeFetch(`${base}/admin/llm-providers/${provider.id}/models`,{headers:{cookie}})).json();
      assert.deepEqual(models.models,['test-model']);
      assert.equal((await nativeFetch(`${base}/admin/llm-providers/${provider.id}/models`)).status,401);
      const patch = body => nativeFetch(`${base}/admin/llm-providers/${provider.id}`,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});
      assert.equal((await patch({name:'Renamed compatible',model:'test-model'})).status,200);
      assert.equal((await patch({baseUrl:'https://other.example.com/v1'})).status,400);
      assert.equal((await patch({})).status,400);
      assert.equal((await patch({model:'auto'})).status,200);
      assert.equal((await request(`/admin/llm-providers/${provider.id}/test`,{})).status,200);
      const meta = await (await nativeFetch(`${base}/admin/llm-providers`,{headers:{cookie}})).json();
      assert.equal(meta.find(item=>item.id === provider.id).configured,true);
    }

  }
  let generated = 0;
  let listed = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url,options);
    assert.equal(options.headers['x-goog-api-key'],'test-only-not-a-real-key');
    if (new URL(url).pathname.endsWith('/models')) {
      listed++;
      return Response.json({models:[
        {name:'models/gemini-9.0-flash',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-9.0-image',supportedGenerationMethods:['generateContent']},
      ]});
    }
    generated++;
    if (generated === 1) return Response.json({error:{}},{status:404});
    assert.match(String(url),/models\/gemini-9.0-flash:generateContent/);
    return Response.json({candidates:[{content:{parts:[{text:'{"reply":"Recovered","draft":null}'}]}}]});
  };
  const recovered = await request('/ai/chat', {providerId:'gemini',messages:[{role:'user',content:'Hello'}]});
  assert.equal(recovered.status,200);
  assert.equal((await recovered.json()).reply,'Recovered');
  assert.equal(listed,1);
  assert.equal(generated,2);
  const providers = await (await nativeFetch(`${base}/admin/llm-providers`,{headers:{cookie}})).json();
  assert.equal(providers.find(provider=>provider.id==='gemini').model,'gemini-9.0-flash');
  console.log('PASS: retired Gemini model discovery, single retry, text-model filtering, persisted replacement');
  globalThis.fetch = async (url, options) => String(url).startsWith('http://127.0.0.1:')
    ? nativeFetch(url,options) : Response.json({error:{}},{status:401});
  const denied = await request('/ai/chat', {providerId:'gemini',messages:[{role:'user',content:'Hello'}]});
  assert.equal(denied.status,502);
  assert.match((await denied.json()).error,/Admin → Settings/);
  globalThis.fetch = nativeFetch;
  console.log('PASS: AI missing-provider handling, encrypted provider API, Gemini/Anthropic/compatible/Responses adapters, model discovery, safe editing, connection tests, rejected API key');
  await fetch(`${base}/auth/logout`, {method:'POST',headers:{cookie}});
  assert.equal((await (await fetch(`${base}/auth/status`, {headers:{cookie}})).json()).authenticated, false);
  console.log('PASS: provision, reject wrong password, login, protected dashboard, logout');
} finally {
  globalThis.fetch = nativeFetch;
  await new Promise(resolve => server.close(resolve));
  await rm(dir, {recursive:true, force:true});
}
