// Node 24+: node --experimental-strip-types artifacts/toolstack/tests/tool-previews.mjs
import assert from 'node:assert/strict';
import { loadFirstPreview, forgetPreview } from '../src/lib/preview-loader.ts';
import { previewSources } from '../src/lib/tool-previews.ts';

function fakeImages(behavior, requests) {
  return () => {
    let timer;
    const image = {
      onload: null, onerror: null, referrerPolicy: '', naturalWidth: 1280, naturalHeight: 800,
      removeAttribute() { clearTimeout(timer); },
      set src(value) {
        requests.push(value);
        const config = behavior[value] || { type: 'stall' };
        if (config.type === 'stall') return;
        timer = setTimeout(() => {
          if (config.type === 'tiny') { image.naturalWidth = 1; image.naturalHeight = 1; }
          if (config.type === 'error') image.onerror?.(); else image.onload?.();
        }, config.delay || 1);
      },
    };
    return image;
  };
}
let sources = previewSources(null, 'https://user:pass@example.com/page?token=secret#private');
assert.equal(sources.length, 3);
assert(sources.every(source => !/user|pass|secret|private/.test(source)));
assert(sources.some(source => source.startsWith('https://s.wordpress.com/mshots/')));
assert.equal(new Set(sources).size, sources.length);
assert.deepEqual(previewSources('javascript:alert(1)', 'invalid'), []);
assert.equal(previewSources('https://cdn.example.com/preview.png', 'https://example.com')[0], 'https://cdn.example.com/preview.png');

let requests = [];
let options = { staggerMs: 10, timeoutMs: 50, createImage: fakeImages({ a: { type: 'stall' }, b: { type: 'load' } }, requests) };
assert.equal(await loadFirstPreview('race', ['a', 'b', 'c'], options).promise, 'b');
assert.deepEqual(requests, ['a', 'b']); // Third source is canceled before starting.
requests = [];
assert.equal(await loadFirstPreview('race', ['a', 'b', 'c'], { ...options, createImage: fakeImages({ b: { type: 'load' } }, requests) }).promise, 'b');
assert.deepEqual(requests, ['b']); // Session success is tried first next time.
forgetPreview('race');
requests = [];
assert.equal(await loadFirstPreview('errors', ['a', 'b', 'c'], { ...options, staggerMs: 100, createImage: fakeImages({ a: { type: 'error' }, b: { type: 'tiny' }, c: { type: 'load' } }, requests) }).promise, 'c');
assert.deepEqual(requests, ['a', 'b', 'c']); // Errors advance immediately; tiny tracking images rejected.
requests = [];
assert.equal(await loadFirstPreview('exhausted', ['a', 'b', 'c', 'd', 'e'], { staggerMs: 1, timeoutMs: 5, createImage: fakeImages({}, requests) }).promise, null);
assert.equal(requests.length, 4); // Bounded attempts and total wait, even if all providers hang.
requests = [];
const canceled = loadFirstPreview('cancel', ['a', 'b'], { ...options, createImage: fakeImages({}, requests) });
canceled.cancel();
assert.equal(await canceled.promise, null);
await new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(requests, ['a']);
assert.equal(await loadFirstPreview('empty', [], options).promise, null);
console.log('PASS: three screenshot providers, safe URLs, staggered fallback, cached winner, error recovery, tiny-image rejection, timeout bounds and cancellation');
