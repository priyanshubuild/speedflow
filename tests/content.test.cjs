const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contentFixture, tick, read, playerHTML } = require('./helpers.cjs');
async function setup(t, options) { const f = await contentFixture(options); t.after(f.close); return f; }
test('mounts three visible controls outside Settings on modern nested player', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 1.75 } });
  assert.equal(f.query('.sf-controls').parentElement.className, 'ytp-right-controls');
  assert.equal(f.query('.sf-controls').querySelectorAll('button').length, 3);
  assert.equal(f.query('.sf-readout').textContent, '1.75×');
  assert.equal(f.query('video').playbackRate, 1.75);
  assert.equal(f.query('.sf-panel').hidden, true);
});
test('works with the Firefox browser namespace', async t => {
  const f = await setup(t, { api: 'browser' }); f.click('.sf-controls button:last-child');
  assert.equal(f.query('video').playbackRate, 1.25);
});
test('bounds speed and saves changes in extension storage', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 9.75 } });
  f.click('.sf-controls button:last-child'); f.click('.sf-controls button:last-child');
  assert.equal(f.query('video').playbackRate, 10);
  assert.equal(f.query('.sf-controls button:last-child').getAttribute('aria-disabled'), 'true');
  await tick(190); assert.equal(f.storage.values.sfSpeed, 10);
  assert.equal(f.w.localStorage.length, 0);
});
test('keyboard shortcuts ignore typing, modifiers, composition and sliders', async t => {
  const f = await setup(t);
  for (const selector of ['#search', '#editor span', '.sf-slider']) f.key(']', f.query(selector));
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) f.key(']', f.w.document.body, extra);
  assert.equal(f.query('video').playbackRate, 1);
  f.key(']'); assert.equal(f.query('video').playbackRate, 1.25);
  f.key('\\'); assert.equal(f.query('video').playbackRate, 1);
});
test('panel exposes labels, slider value and correct keyboard focus recovery', async t => {
  const f = await setup(t);
  f.click('.sf-trigger');
  assert.equal(f.query('.sf-panel').hidden, false);
  assert.equal(f.query('.sf-trigger').getAttribute('aria-expanded'), 'true');
  assert.equal(f.w.document.activeElement.dataset.speed, '1');
  assert.equal(f.query('.sf-slider').labels[0].textContent, 'Fine tune');
  f.key('Escape', f.w.document.activeElement);
  assert.equal(f.query('.sf-panel').hidden, true);
  assert.equal(f.w.document.activeElement, f.query('.sf-trigger'));
  f.key('ArrowDown', f.query('.sf-trigger'));
  assert.equal(f.query('.sf-panel').hidden, false);
});
test('native playback changes update SpeedFlow without a ratechange loop', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  await tick();
  f.query('video').playbackRate = 1.75;
  f.query('video').dispatchEvent(new f.w.Event('ratechange'));
  assert.equal(f.query('.sf-readout').textContent, '1.75×');
  await tick(190); assert.equal(f.storage.values.sfSpeed, 1.75);
});
test('pauses controls and leaves rates untouched during an ad, then restores speed', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  f.query('#movie_player').classList.add('ad-showing'); await tick();
  f.query('video').playbackRate = 1;
  f.query('video').dispatchEvent(new f.w.Event('ratechange'));
  f.click('.sf-controls button:last-child');
  assert.equal(f.query('video').playbackRate, 1);
  assert.equal(f.query('.sf-controls button:last-child').getAttribute('aria-disabled'), 'true');
  f.query('#movie_player').classList.remove('ad-showing'); await tick();
  assert.equal(f.query('video').playbackRate, 2);
  assert.equal(f.query('.sf-readout').textContent, '2×');
});
test('restores saved speed after the same video element changes source', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  f.query('video').src = 'https://example.test/next.mp4';
  f.query('video').playbackRate = 1;
  f.query('video').dispatchEvent(new f.w.Event('ratechange'));
  assert.equal(f.query('.sf-readout').textContent, '2×');
  f.query('video').dispatchEvent(new f.w.Event('loadedmetadata'));
  assert.equal(f.query('video').playbackRate, 2);
});
test('recovers removed widget, removed panel, and complete control replacement', async t => {
  const f = await setup(t);
  for (const selector of ['.sf-controls', '.sf-panel']) {
    f.query(selector).remove(); await tick();
    assert.equal(f.w.document.querySelectorAll('.sf-controls').length, 1);
    assert.equal(f.w.document.querySelectorAll('.sf-panel').length, 1);
  }
  f.query('.ytp-chrome-controls').outerHTML = '<div class="ytp-chrome-controls"><div class="ytp-right-controls"><button class="ytp-button ytp-settings-button">Settings</button></div></div>';
  await tick(); f.click('.sf-controls button:last-child');
  assert.equal(f.query('video').playbackRate, 1.25);
  assert.equal(f.w.document.querySelectorAll('.sf-controls').length, 1);
});
test('rebinds replacement video and does not speed up unrelated previews', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 }, html: playerHTML + '<video id="preview"></video>' });
  assert.equal(f.query('#preview').playbackRate, 1);
  f.query('.html5-main-video').outerHTML = '<video class="html5-main-video"></video>';
  await tick(); assert.equal(f.query('.html5-main-video').playbackRate, 2);
});
test('navigation removes stale controls and mounts on the next watch page', async t => {
  const f = await setup(t);
  f.w.history.pushState({}, '', '/'); f.w.dispatchEvent(new f.w.Event('yt-navigate-finish')); await tick();
  assert.equal(f.query('.sf-controls'), null);
  f.w.history.pushState({}, '', '/watch?v=next'); f.w.dispatchEvent(new f.w.Event('yt-navigate-finish')); await tick();
  assert.ok(f.query('.sf-controls'));
});
test('disabling restores original rate, removes UI and stops shortcut handling', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  await f.storage.local.set({ sfEnabled: false });
  assert.equal(f.query('.sf-controls'), null); assert.equal(f.query('video').playbackRate, 1);
  f.key(']'); assert.equal(f.query('video').playbackRate, 1);
  await f.storage.local.set({ sfEnabled: true });
  assert.ok(f.query('.sf-controls')); assert.equal(f.query('video').playbackRate, 2);
});
test('remember off keeps the speed local and starts new pages at normal speed', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2, sfRemember: false } });
  assert.equal(f.query('video').playbackRate, 1); f.click('.sf-controls button:last-child');
  await tick(190); assert.equal(f.storage.writes.length, 0);
  await f.storage.local.set({ sfSpeed: 3 });
  assert.equal(f.query('video').playbackRate, 1.25);
});
test('shortcut preference and cross-tab speed changes update live controllers', async t => {
  const f = await setup(t);
  await f.storage.local.set({ sfShortcuts: false, sfSpeed: 1.5 }); f.key(']');
  assert.equal(f.query('video').playbackRate, 1.5);
  f.click('.sf-trigger'); assert.equal(f.query('.sf-hint').hidden, true);
});
test('re-injecting never creates duplicate controls or message listeners', async t => {
  const f = await setup(t);
  f.w.eval(read('content.js')); await tick();
  assert.equal(f.messages.length, 1); assert.equal(f.w.document.querySelectorAll('.sf-controls').length, 1);
});
test('storage failures still mount a usable widget with an accessible notice', async t => {
  const f = await setup(t, { rejectStorage: true });
  assert.ok(f.query('.sf-controls')); f.click('.sf-controls button:last-child');
  await tick(190); assert.equal(f.query('video').playbackRate, 1.25);
  assert.match(f.query('[role=status]').textContent, /saved|loaded/);
});
test('rejects untrusted messages and unsupported media speeds', async t => {
  const f = await setup(t);
  assert.equal(f.message({ type: 'sf:set-speed', speed: 2 }, { id: 'another-extension' }), undefined);
  assert.equal(f.message({ type: 'sf:set-speed', speed: Infinity }).ok, false);
  let actual = 1;
  Object.defineProperty(f.query('video'), 'playbackRate', { get: () => actual, set(value) { if (value > 4) throw Error('unsupported'); actual = value; } });
  assert.equal(f.message({ type: 'sf:set-speed', speed: 10 }).ok, false);
  assert.equal(actual, 1); assert.equal(f.query('.sf-readout').textContent, '1×');
});
test('compact geometry and embed routes use the same accessible widget', async t => {
  const f = await setup(t, { width: 420, url: 'https://www.youtube-nocookie.com/embed/test' });
  assert.ok(f.query('.sf-controls').classList.contains('sf-compact'));
  assert.ok(f.message({ type: 'sf:state' }).mounted);
});
test('an ad already playing at mount restores the saved rate afterward', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 }, html: playerHTML.replace('class="html5-video-player"', 'class="html5-video-player ad-showing"') });
  assert.equal(f.query('video').playbackRate, 1);
  f.query('#movie_player').classList.remove('ad-showing'); await tick();
  assert.equal(f.query('video').playbackRate, 2);
});
test('rebuilding controls preserves the original rate for later disable', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  f.query('.sf-controls').remove(); await tick();
  await f.storage.local.set({ sfEnabled: false });
  assert.equal(f.query('video').playbackRate, 1);
});
test('a rejected cross-tab speed rolls back and gives a visible accessible notice', async t => {
  const f = await setup(t);
  let actual = 1;
  Object.defineProperty(f.query('video'), 'playbackRate', { get: () => actual, set(value) { if (value > 4) throw Error('unsupported'); actual = value; } });
  await f.storage.local.set({ sfSpeed: 10 });
  assert.equal(actual, 1); assert.equal(f.query('.sf-readout').textContent, '1×');
  assert.ok(f.query('[role=status]').classList.contains('sf-toast'));
  await tick(190); assert.equal(f.storage.values.sfSpeed, 1);
});
test('native player hotkeys still bubble from the front controls', async t => {
  const f = await setup(t);
  let received = 0;
  f.query('#movie_player').addEventListener('keydown', event => { if(event.key === 'k') received++; });
  f.key('k', f.query('.sf-trigger'));
  assert.equal(received, 1);
});
test('re-enabling captures speed choices made while the extension was disabled', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  await f.storage.local.set({ sfEnabled: false });
  f.query('video').playbackRate = 1.75;
  await f.storage.local.set({ sfEnabled: true });
  assert.equal(f.query('video').playbackRate, 2);
  await f.storage.local.set({ sfEnabled: false });
  assert.equal(f.query('video').playbackRate, 1.75);
});
