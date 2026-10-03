const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const tick = (ms = 45) => new Promise(resolve => setTimeout(resolve, ms));
const playerHTML = `<div id="movie_player" class="html5-video-player"><video class="html5-main-video" src="https://example.test/video.mp4"></video><div class="ytp-chrome-bottom"><div class="ytp-chrome-controls"><div class="ytp-left-controls"><button class="ytp-button ytp-play-button">Play</button><span class="ytp-time-current" style="font-size:12px;font-weight:400">0:00</span></div><div class="ytp-right-controls"><div class="ytp-right-controls-left"><button class="ytp-button ytp-settings-button" aria-expanded="false">Settings</button></div><div class="ytp-right-controls-right"><button class="ytp-button">Fullscreen</button></div></div></div></div></div>`;
function storageMock(initial = {}, reject = false) {
  const values = { ...initial }, listeners = [], writes = [];
  return {
    values, writes,
    onChanged: {
      addListener(listener) { listeners.push(listener); },
      removeListener(listener) { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); },
      hasListeners() { return listeners.length > 0; },
    },
    local: {
      async get() { if (reject) throw Error('storage blocked'); return { ...values }; },
      async set(patch) {
        if (reject) throw Error('storage blocked');
        writes.push(patch);
        const changes = {};
        for (const [key, value] of Object.entries(patch)) {
          if (values[key] !== value) { changes[key] = { oldValue: values[key], newValue: value }; values[key] = value; }
        }
        for (const listener of listeners) listener(changes, 'local');
      },
    },
  };
}
async function contentFixture(options = {}) {
  const dom = new JSDOM(`<html><body>${options.html ?? playerHTML}<input id="search"><input id="range" type="range"><div id="editor" contenteditable="true"><span>text</span></div></body></html>`, {
    url: options.url || 'https://www.youtube.com/watch?v=test', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, messages = [];
  const storage = storageMock(options.prefs, options.rejectStorage);
  const extension = { storage, runtime: { id: 'speedflow-test', onMessage: { addListener(fn) { messages.push(fn); } } } };
  options.configure?.({ w, storage, extension });
  w[options.api || 'chrome'] = extension;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const width = this.classList.contains('html5-video-player') ? (options.width || 800) : 48;
    return { x: 0, y: 0, left: 0, right: width, top: 400, bottom: 440, width, height: this.classList.contains('html5-video-player') ? 450 : 40 };
  };
  w.eval(read('core.js')); w.eval(read('content.js'));
  await tick();
  return {
    dom, w, storage, extension, messages,
    query: selector => w.document.querySelector(selector),
    click: selector => w.document.querySelector(selector).click(),
    key: (key, target = w.document.body, extra = {}) => target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })),
    close: () => { w.dispatchEvent(new w.PageTransitionEvent('pagehide')); w.close(); },
  };
}
module.exports = { contentFixture, storageMock, tick, read, playerHTML, JSDOM };
