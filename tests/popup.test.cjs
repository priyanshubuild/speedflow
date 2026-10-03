const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM, storageMock, read, tick } = require('./helpers.cjs');
async function fixture(t, options = {}) {
  const dom = new JSDOM(read('popup.html'), { url: 'https://extension.test/popup.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, calls = [], storage = storageMock(options.prefs, options.rejectStorage);
  let speed = 1, injected = false;
  const extension = {
    storage,
    tabs: {
      async query() { return [{ id: 42, url: options.url || 'https://www.youtube.com/watch?v=test' }]; },
      async sendMessage(id, message) {
        calls.push(message.type);
        if (options.disconnected && !injected) throw Error('missing script');
        if (message.type === 'sf:state') return { ok: true, speed, mounted: true, ad: !!options.ad };
        if (options.rejectSpeed) return { ok: false, error: 'The video rejected that speed.' };
        speed = message.speed; return { ok: true, speed };
      },
    },
    scripting: {
      async insertCSS(request) { calls.push(request.files[0]); },
      async executeScript(request) { calls.push(...request.files); injected = true; },
    },
  };
  w[options.api || 'chrome'] = extension;
  w.eval(read('core.js')); w.eval(read('popup.js')); await tick();
  t.after(() => w.close());
  return { w, calls, storage, query: id => w.document.getElementById(id) };
}
test('popup remains open and sends speed changes to the active player', async t => {
  const f = await fixture(t);
  f.query('faster').click(); await tick();
  assert.equal(f.query('speed').textContent, '1.25×');
  assert.match(f.query('status').textContent, /Playback speed 1.25/);
  f.query('reset').click(); await tick(); assert.equal(f.query('speed').textContent, '1×');
});
test('popup does not message or inject code into unrelated websites', async t => {
  const f = await fixture(t, { url: 'https://example.test' });
  assert.equal(f.calls.length, 0); assert.equal(f.query('faster').disabled, true);
  assert.match(f.query('status').textContent, /Open a YouTube video/);
});
test('fallback injects CSS and both isolated-world scripts for an existing YouTube tab', async t => {
  const f = await fixture(t, { disconnected: true, api: 'browser' });
  assert.ok(f.calls.includes('content.css')); assert.ok(f.calls.includes('core.js')); assert.ok(f.calls.includes('content.js'));
  assert.equal(f.query('faster').disabled, false);
});
test('ad state disables speed actions and explains why', async t => {
  const f = await fixture(t, { ad: true });
  assert.equal(f.query('faster').disabled, true); assert.equal(f.query('reset').disabled, true);
  assert.match(f.query('status').textContent, /ad is playing/);
});
test('popup surfaces media failures instead of claiming success', async t => {
  const f = await fixture(t, { rejectSpeed: true });
  f.query('faster').click(); await tick();
  assert.equal(f.query('speed').textContent, '1×'); assert.match(f.query('status').textContent, /rejected/);
});
test('preference save failures restore the switch and show feedback', async t => {
  const f = await fixture(t, { rejectStorage: true });
  f.query('enabled').click(); await tick();
  assert.equal(f.query('enabled').checked, true); assert.equal(f.query('enabled').disabled, false);
  assert.match(f.query('status').textContent, /Could not save/);
});
