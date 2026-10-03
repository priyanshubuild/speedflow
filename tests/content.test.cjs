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
  assert.equal(f.query('.sf-panel'), null);
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
  for (const selector of ['#search', '#editor span', '#range']) f.key(']', f.query(selector));
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) f.key(']', f.w.document.body, extra);
  assert.equal(f.query('video').playbackRate, 1);
  f.key(']'); assert.equal(f.query('video').playbackRate, 1.25);
  f.key('\\'); assert.equal(f.query('video').playbackRate, 1);
});
test('reset stays on the left, readout opens nothing, and focus survives reset', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 1.5 } });
  const root = f.query('.sf-controls');
  assert.deepEqual([...root.children].map(n => n.className), ['ytp-button sf-control sf-reset', 'ytp-button sf-control sf-step', 'sf-readout', 'ytp-button sf-control sf-step']);
  assert.equal(f.query('.sf-readout').tagName, 'SPAN');
  f.click('.sf-readout'); assert.equal(f.query('[role=dialog], .sf-panel, .sf-trigger'), null);
  f.query('.sf-reset').focus(); f.click('.sf-reset');
  assert.equal(f.query('video').playbackRate, 1);
  assert.equal(f.query('.sf-reset').hidden, true);
  assert.equal(f.w.document.activeElement, f.query('.sf-step'));
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
  assert.equal(f.query('.sf-readout').textContent, '2.0×');
});
test('restores saved speed after the same video element changes source', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  f.query('video').src = 'https://example.test/next.mp4';
  f.query('video').playbackRate = 1;
  f.query('video').dispatchEvent(new f.w.Event('ratechange'));
  assert.equal(f.query('.sf-readout').textContent, '2.0×');
  f.query('video').dispatchEvent(new f.w.Event('loadedmetadata'));
  assert.equal(f.query('video').playbackRate, 2);
});
test('recovers removed widget, removed status, and complete control replacement', async t => {
  const f = await setup(t);
  for (const selector of ['.sf-controls', '.sf-sr-only']) {
    f.query(selector).remove(); await tick();
    assert.equal(f.w.document.querySelectorAll('.sf-controls').length, 1);
    assert.equal(f.w.document.querySelectorAll('.sf-sr-only').length, 1);
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

test('legacy popup preferences do not disable the simplified controls', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2, sfEnabled: false, sfRemember: false, sfShortcuts: false } });
  assert.equal(f.query('video').playbackRate, 2); f.key(']');
  assert.equal(f.query('video').playbackRate, 2.25);
  await tick(190); assert.equal(f.storage.values.sfSpeed, 2.25);
});
test('cross-tab speed changes update the inline controls', async t => {
  const f = await setup(t);
  await f.storage.local.set({ sfSpeed: 1.5 });
  assert.equal(f.query('video').playbackRate, 1.5);
  assert.equal(f.query('.sf-readout').textContent, '1.5×');
  assert.equal(f.query('.sf-reset').hidden, false);
});
test('re-injecting never creates duplicate controls or message listeners', async t => {
  const f = await setup(t);
  f.w.eval(read('content.js')); await tick();
  assert.equal(f.messages.length, 0); assert.equal(f.w.document.querySelectorAll('.sf-controls').length, 1);
});
test('storage failures still mount a usable widget with an accessible notice', async t => {
  const f = await setup(t, { rejectStorage: true });
  assert.ok(f.query('.sf-controls')); f.click('.sf-controls button:last-child');
  await tick(190); assert.equal(f.query('video').playbackRate, 1.25);
  assert.match(f.query('[role=status]').textContent, /saved|loaded/);
});
test('unsupported media speeds roll back without adding an overlay', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 4 } });
  let actual = 4;
  Object.defineProperty(f.query('video'), 'playbackRate', { get: () => actual, set(value) { if (value > 4) throw Error('unsupported'); actual = value; } });
  f.click('.sf-controls button:last-child');
  assert.equal(actual, 4); assert.equal(f.query('.sf-readout').textContent, '4.0×');
  assert.match(f.query('.sf-controls').title, /cannot play/);
  assert.equal(f.query('.sf-toast, .sf-panel'), null);
});
test('compact geometry and embed routes use the same accessible widget', async t => {
  const f = await setup(t, { width: 420, url: 'https://www.youtube-nocookie.com/embed/test' });
  assert.ok(f.query('.sf-controls').classList.contains('sf-compact'));
  assert.equal(f.query('.sf-controls').getAttribute('role'), 'group');
});
test('an ad already playing at mount restores the saved rate afterward', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 }, html: playerHTML.replace('class="html5-video-player"', 'class="html5-video-player ad-showing"') });
  assert.equal(f.query('video').playbackRate, 1);
  f.query('#movie_player').classList.remove('ad-showing'); await tick();
  assert.equal(f.query('video').playbackRate, 2);
});
test('rebuilding controls preserves speed and the inline reset', async t => {
  const f = await setup(t, { prefs: { sfSpeed: 2 } });
  f.query('.sf-controls').remove(); await tick();
  assert.equal(f.query('.sf-readout').textContent, '2.0×');
  f.click('.sf-reset'); assert.equal(f.query('video').playbackRate, 1);
});
test('a rejected cross-tab speed rolls back and gives a visible accessible notice', async t => {
  const f = await setup(t);
  let actual = 1;
  Object.defineProperty(f.query('video'), 'playbackRate', { get: () => actual, set(value) { if (value > 4) throw Error('unsupported'); actual = value; } });
  await f.storage.local.set({ sfSpeed: 10 });
  assert.equal(actual, 1); assert.equal(f.query('.sf-readout').textContent, '1.0×');
  assert.match(f.query('[role=status]').textContent, /cannot play/);
  assert.match(f.query('.sf-controls').title, /cannot play/);
  await tick(190); assert.equal(f.storage.values.sfSpeed, 1);
});
test('native player hotkeys still bubble from the front controls', async t => {
  const f = await setup(t);
  let received = 0;
  f.query('#movie_player').addEventListener('keydown', event => { if(event.key === 'k') received++; });
  f.key('k', f.query('.sf-step'));
  assert.equal(received, 1);
});
test('speed typography inherits the native player time font weight and size', async t => {
  const f = await setup(t);
  assert.equal(f.query('.sf-controls').style.getPropertyValue('--sf-text-weight'), '400');
  assert.equal(f.query('.sf-controls').style.getPropertyValue('--sf-text-size'), '12px');
});
