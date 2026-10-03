(function () {
  'use strict';
  // Private to the extension's isolated world, so page scripts cannot disable this guard.
  if (globalThis.__speedflowInstance) return;
  globalThis.__speedflowInstance = true;
  const C = globalThis.SpeedFlowCore;
  const extension = globalThis.browser || globalThis.chrome;
  const controllers = new Map();
  const originalRates = new WeakMap();
  let prefs = { ...C.DEFAULTS }, speed = 1, initialized = false;
  let scheduled = 0, saveTimer = 0, storageNotice = false, activeController = null;
  const lifetime = new AbortController();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, label, text) {
    const node = element('button', className, text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.title = label;
    return node;
  }
  function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    return svg;
  }
  const supportedRoute = () => location.pathname === '/watch' || /^\/(embed|live)\//.test(location.pathname);
  function announce(message, visible = false) {
    const controller = activeController || controllers.values().next().value;
    if (controller) controller.notify(message, visible);
  }
  function persistSpeed() {
    clearTimeout(saveTimer);
    if (!prefs.sfRemember) return;
    // Coalesce slider/held-key changes rather than writing on every event.
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      prefs.sfSpeed = speed;
      extension.storage.local.set({ sfSpeed: speed }).catch(() => {
        announce('Speed could not be saved. It will still work in this tab.', true);
        storageNotice = true;
      });
    }, 160);
  }
  function changeSpeed(next, source, report = true) {
    if (!C.validSpeed(next)) return { ok: false, error: 'Choose a speed from 0.25× to 10×.' };
    if (!prefs.sfEnabled) return { ok: false, error: 'Enable SpeedFlow first.' };
    if (source?.adPlaying()) {
      announce('Speed controls are paused during ads. Your speed will resume afterward.');
      return { ok: false, error: 'Speed controls are paused during ads.' };
    }
    const previous = speed;
    speed = C.clamp(next);
    let rejected = false;
    for (const controller of controllers.values()) if (!controller.apply()) rejected = true;
    if (rejected) {
      speed = previous;
      for (const controller of controllers.values()) { controller.apply(); controller.update(); }
      announce('This browser or video cannot play at that speed. Try a lower value.', true);
      return { ok: false, error: 'This browser or video rejected that playback speed.' };
    }
    persistSpeed();
    for (const controller of controllers.values()) controller.update();
    if (report) announce(`Playback speed ${C.format(speed)}.`);
    return { ok: true, speed };
  }

  class PlayerController {
    constructor(player, controls, target) {
      Object.assign(this, { player, controls, target, video: null, expectedRate: null, originalRate: 1, mediaSource: '', wasAd: false });
      this.wasAd = this.adPlaying();
      this.abort = new AbortController();
      this.signal = this.abort.signal;
      this.root = element('div', 'sf-controls');
      this.root.setAttribute('role', 'group');
      this.root.setAttribute('aria-label', 'Playback speed');
      this.minus = button('ytp-button sf-control sf-step', 'Decrease playback speed ([)');
      this.minus.append(icon('M5 11h14v2H5z'));
      this.trigger = button('ytp-button sf-control sf-trigger', 'Playback speed: 1×. Open speed options.');
      this.readout = element('span', 'sf-readout', '1×');
      this.trigger.append(this.readout);
      this.plus = button('ytp-button sf-control sf-step', 'Increase playback speed (])');
      this.plus.append(icon('M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'));
      this.root.append(this.minus, this.trigger, this.plus);
      target.insertBefore(this.root, target.firstChild);
      this.panel = element('section', 'sf-panel');
      this.panel.id = `sf-panel-${PlayerController.nextID++}`;
      this.panel.hidden = true;
      this.panel.setAttribute('role', 'dialog');
      this.panel.setAttribute('aria-label', 'Playback speed options');
      this.trigger.setAttribute('aria-haspopup', 'dialog');
      this.trigger.setAttribute('aria-controls', this.panel.id);
      this.trigger.setAttribute('aria-expanded', 'false');
      this.trigger.setAttribute('aria-keyshortcuts', 'ArrowDown');
      const heading = element('div', 'sf-heading');
      heading.append(element('h2', 'sf-title', 'Playback speed'));
      this.closeButton = button('sf-option sf-close', 'Close speed options', '×');
      heading.append(this.closeButton);
      this.panel.append(heading);
      const presets = element('div', 'sf-presets');
      presets.setAttribute('role', 'group');
      presets.setAttribute('aria-label', 'Speed presets');
      this.presetButtons = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map(value => {
        const node = button('sf-option sf-preset', `Set playback speed to ${C.format(value)}`, C.format(value));
        node.dataset.speed = String(value);
        node.setAttribute('aria-pressed', 'false');
        node.addEventListener('click', () => changeSpeed(value, this), { signal: this.signal });
        presets.append(node);
        return node;
      });
      this.panel.append(presets);
      const rangeRow = element('div', 'sf-range-row');
      const label = element('label', 'sf-range-label', 'Fine tune');
      this.slider = element('input', 'sf-slider');
      Object.assign(this.slider, { type: 'range', id: `${this.panel.id}-range`, min: String(C.MIN), max: String(C.MAX), step: String(C.STEP) });
      label.htmlFor = this.slider.id;
      this.output = element('span', 'sf-range-value', '1×');
      rangeRow.append(label, this.output);
      this.panel.append(rangeRow, this.slider);
      const endpoints = element('div', 'sf-endpoints');
      endpoints.setAttribute('aria-hidden', 'true');
      endpoints.append(element('span', '', '0.25×'), element('span', '', '10×'));
      this.reset = button('sf-option sf-reset', 'Reset playback speed to normal (\\)', 'Reset to normal');
      this.hint = element('p', 'sf-hint', '[ slower · ] faster · \\ reset');
      this.note = element('p', 'sf-note');
      this.panel.append(endpoints, this.reset, this.hint, this.note);
      this.status = element('span', 'sf-sr-only');
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      this.status.setAttribute('aria-atomic', 'true');
      player.append(this.panel, this.status);

      this.minus.addEventListener('click', () => {
        if (this.minus.getAttribute('aria-disabled') !== 'true') changeSpeed(C.clamp(speed - C.STEP), this);
      }, { signal: this.signal });
      this.plus.addEventListener('click', () => {
        if (this.plus.getAttribute('aria-disabled') !== 'true') changeSpeed(C.clamp(speed + C.STEP), this);
      }, { signal: this.signal });
      this.trigger.addEventListener('click', () => this.panel.hidden ? this.open() : this.close(true), { signal: this.signal });
      this.trigger.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); this.open(); }
      }, { signal: this.signal });
      this.closeButton.addEventListener('click', () => this.close(true), { signal: this.signal });
      this.reset.addEventListener('click', () => changeSpeed(1, this), { signal: this.signal });
      this.slider.addEventListener('input', () => changeSpeed(Number(this.slider.value), this), { signal: this.signal });
      for (const node of [this.root, this.panel]) {
        for (const name of ['click', 'dblclick', 'pointerdown', 'mousedown', 'touchstart']) {
          node.addEventListener(name, event => { activeController = this; event.stopPropagation(); }, { signal: this.signal });
        }
        node.addEventListener('keydown', event => {
          if (event.key === 'Escape' && !this.panel.hidden) { event.preventDefault(); this.close(true); }
          // Preserve Tab navigation; prevent Enter/Space/range keys reaching the player.
          const isolate = node === this.panel || ['Enter', ' ', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key);
          if (isolate && !['[', ']', '\\', 'Tab'].includes(event.key)) event.stopPropagation();
        }, { signal: this.signal });
        node.addEventListener('keyup', event => {
          if (node === this.panel || ['Enter', ' ', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.stopPropagation();
        }, { signal: this.signal });
      }
      this.panel.addEventListener('focusout', () => queueMicrotask(() => {
        if (!this.panel.contains(document.activeElement) && document.activeElement !== this.trigger) this.close(false);
      }), { signal: this.signal });
      document.addEventListener('pointerdown', event => {
        if (!this.panel.hidden && !this.panel.contains(event.target) && !this.root.contains(event.target)) this.close(false);
      }, { capture: true, signal: this.signal });
      player.addEventListener('focusin', () => { activeController = this; }, { signal: this.signal });
      player.addEventListener('pointerenter', () => { activeController = this; }, { signal: this.signal });
      player.addEventListener('click', event => {
        if (event.target.closest?.('.ytp-settings-button')) this.close(false);
      }, { signal: this.signal });
      this.attributes = new MutationObserver(() => {
        const ad = this.adPlaying();
        if (this.wasAd && !ad) this.apply();
        this.wasAd = ad;
        this.update();
      });
      this.attributes.observe(player, { attributes: true, attributeFilter: ['class'] });
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.layout());
        this.resize.observe(player);
        this.resize.observe(controls);
      }
      document.addEventListener('fullscreenchange', () => this.layout(), { signal: this.signal });
      this.bindVideo();
      this.layout();
      this.update();
    }
    adPlaying() { return this.player.classList.contains('ad-showing') || this.player.classList.contains('ad-interrupting'); }
    bindVideo() {
      const video = this.player.querySelector('video.html5-main-video') || this.player.querySelector('video');
      if (video === this.video) return;
      this.mediaAbort?.abort();
      this.video = video;
      this.expectedRate = null;
      if (!video) { this.update(); return; }
      if (!originalRates.has(video)) originalRates.set(video, C.validSpeed(video.playbackRate) ? video.playbackRate : 1);
      this.originalRate = originalRates.get(video);
      this.mediaSource = video.currentSrc || video.src;
      this.mediaAbort = new AbortController();
      const signal = this.mediaAbort.signal;
      const reapply = () => { this.mediaSource = video.currentSrc || video.src; this.apply(); this.update(); };
      for (const name of ['loadedmetadata', 'loadeddata', 'canplay', 'play']) video.addEventListener(name, reapply, { signal });
      video.addEventListener('ratechange', () => {
        if (this.adPlaying() || !prefs.sfEnabled || !this.video) return;
        if (this.expectedRate !== null && Math.abs(video.playbackRate - this.expectedRate) < 0.001) {
          this.expectedRate = null;
          return;
        }
        this.expectedRate = null;
        if (this.mediaSource !== (video.currentSrc || video.src)) return;
        // Accept native speed changes rather than fighting YouTube's Settings menu.
        if (C.validSpeed(video.playbackRate) && Math.abs(video.playbackRate - speed) > 0.001) {
          this.originalRate = video.playbackRate;
          originalRates.set(video, video.playbackRate);
          changeSpeed(video.playbackRate, this);
        }
      }, { signal });
      if (!this.apply()) {
        speed = C.validSpeed(video.playbackRate) ? video.playbackRate : 1;
        persistSpeed();
        this.notify('The saved speed was unavailable for this video. Playback speed has been adjusted.', true);
      }
    }
    apply() {
      if (!this.video || this.adPlaying() || !prefs.sfEnabled) return true;
      const video = this.video;
      if (Math.abs(video.playbackRate - speed) < 0.001) return true;
      try {
        this.expectedRate = speed;
        video.playbackRate = speed;
        if (Math.abs(video.playbackRate - speed) > 0.001) { this.expectedRate = null; return false; }
        return true;
      } catch { this.expectedRate = null; return false; }
    }
    notify(message, visible) {
      clearTimeout(this.noticeTimer);
      this.status.textContent = message;
      this.status.classList.toggle('sf-toast', visible);
      if (visible) this.noticeTimer = setTimeout(() => this.status.classList.remove('sf-toast'), 4000);
    }
    update() {
      const value = C.format(speed), ad = this.adPlaying(), unavailable = ad || !this.video;
      this.readout.textContent = value;
      this.trigger.setAttribute('aria-label', `Playback speed: ${value}. Open speed options.`);
      this.trigger.title = `Playback speed ${value} · Click for options`;
      this.minus.setAttribute('aria-disabled', String(unavailable || speed <= C.MIN));
      this.plus.setAttribute('aria-disabled', String(unavailable || speed >= C.MAX));
      this.slider.disabled = unavailable;
      this.slider.value = String(speed);
      this.slider.setAttribute('aria-valuetext', `${value} playback speed`);
      this.output.textContent = value;
      for (const node of this.presetButtons) {
        node.setAttribute('aria-pressed', String(Number(node.dataset.speed) === speed));
        node.disabled = unavailable;
      }
      this.reset.disabled = unavailable;
      this.root.classList.toggle('sf-unavailable', unavailable);
      this.hint.hidden = !prefs.sfShortcuts;
      this.note.textContent = ad ? 'Paused during ads. Your speed resumes afterward.' :
        'At high speeds, some browsers may mute audio.';
      this.note.hidden = !ad && speed <= 4;
      if (!this.panel.hidden) this.layout();
    }
    layout() {
      const reference = this.target.querySelector('.ytp-settings-button') || this.target.querySelector('.ytp-button:not(.sf-control)');
      const rect = this.player.getBoundingClientRect();
      if (reference) {
        const css = getComputedStyle(reference), height = reference.getBoundingClientRect().height;
        this.root.style.setProperty('--sf-control-height', `${Math.max(32, Math.min(56, height || 40))}px`);
        this.root.style.fontFamily = css.fontFamily;
        this.root.style.color = css.color;
        this.panel.style.fontFamily = css.fontFamily;
      }
      this.root.classList.toggle('sf-compact', rect.width < 640);
      const left = this.controls.querySelector('.ytp-left-controls');
      if (left && this.target !== this.controls) {
        const nativeGroups = [...this.target.children].filter(node => node !== this.root && node.getBoundingClientRect().width > 0);
        const gap = parseFloat(getComputedStyle(this.target).gap) || 0;
        const controlGap = parseFloat(getComputedStyle(this.controls).gap) || 0;
        const nativeWidth = nativeGroups.reduce((total, node) => total + node.getBoundingClientRect().width, 0);
        const needed = nativeWidth + this.root.getBoundingClientRect().width + gap * nativeGroups.length;
        const available = this.controls.clientWidth - left.getBoundingClientRect().width - controlGap;
        // Keep all three speed controls in front, even when native buttons fill the row.
        this.root.classList.toggle('sf-overflow', rect.width > 0 && rect.width < 700 && this.controls.clientWidth > 0 && needed > available);
      }
      if (this.panel.hidden) return;
      const trigger = this.trigger.getBoundingClientRect();
      const width = Math.min(280, Math.max(180, rect.width - 16));
      this.panel.style.width = `${width}px`;
      this.panel.style.right = `${Math.max(8, Math.min(rect.width - width - 8, rect.right - trigger.right))}px`;
      const bottom = Math.max(48, rect.bottom - trigger.top + 8);
      this.panel.style.bottom = `${bottom}px`;
      this.panel.style.maxHeight = `${Math.max(100, rect.height - bottom - 8)}px`;
    }
    open() {
      for (const controller of controllers.values()) if (controller !== this) controller.close(false);
      activeController = this;
      // Use the real native button instead of undocumented player methods.
      this.controls.querySelector('.ytp-settings-button[aria-expanded="true"]')?.click();
      this.panel.hidden = false;
      this.trigger.setAttribute('aria-expanded', 'true');
      this.player.classList.add('sf-options-open');
      this.layout();
      (this.presetButtons.find(node => node.getAttribute('aria-pressed') === 'true' && !node.disabled) || this.closeButton).focus({ preventScroll: true });
    }
    close(restoreFocus) {
      this.panel.hidden = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      this.player.classList.remove('sf-options-open');
      if (restoreFocus && this.trigger.isConnected) this.trigger.focus({ preventScroll: true });
    }
    destroy(restoreRate = false) {
      this.close(false);
      this.abort.abort();
      this.mediaAbort?.abort();
      this.attributes.disconnect();
      this.resize?.disconnect();
      clearTimeout(this.noticeTimer);
      if (restoreRate && this.video && !this.adPlaying()) {
        try { this.video.playbackRate = this.originalRate; } catch { /* The media may reject a write. */ }
      }
      if (restoreRate && this.video) originalRates.delete(this.video);
      this.root.remove(); this.panel.remove(); this.status.remove();
      if (activeController === this) activeController = null;
    }
  }
  PlayerController.nextID = 1;

  function reconcile() {
    scheduled = 0;
    if (!initialized) return;
    const allowed = prefs.sfEnabled && supportedRoute();
    for (const [player, controller] of controllers) {
      const controls = player.querySelector('.ytp-chrome-controls');
      const target = controls?.querySelector('.ytp-right-controls') || controls;
      if (!allowed || !player.isConnected || controls !== controller.controls || target !== controller.target || controller.root.parentElement !== target || !controller.panel.isConnected) {
        controller.destroy(!prefs.sfEnabled);
        controllers.delete(player);
      } else controller.bindVideo();
    }
    if (!allowed) return;
    for (const player of document.querySelectorAll('.html5-video-player')) {
      if (controllers.has(player)) continue;
      const controls = player.querySelector('.ytp-chrome-controls');
      const target = controls?.querySelector('.ytp-right-controls') || controls;
      if (target && player.querySelector('video')) controllers.set(player, new PlayerController(player, controls, target));
    }
  }
  function schedule() { if (!scheduled) scheduled = requestAnimationFrame(reconcile); }
  const relevant = '.html5-video-player, .ytp-chrome-controls, .ytp-right-controls, video, .sf-controls, .sf-panel';
  const observer = new MutationObserver(records => {
    if (!initialized || !prefs.sfEnabled) return;
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === 1 && (node.matches(relevant) || node.querySelector(relevant))))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return; // The existing controllers survive a back/forward cache restore.
    observer.disconnect();
    lifetime.abort();
    cancelAnimationFrame(scheduled);
    if (saveTimer && prefs.sfRemember) {
      extension.storage.local.set({ sfSpeed: speed }).catch(() => {});
    }
    clearTimeout(saveTimer);
    for (const controller of controllers.values()) controller.destroy();
    controllers.clear();
  }, { signal: lifetime.signal });
  for (const event of ['yt-navigate-finish', 'yt-page-data-updated', 'popstate', 'pageshow']) window.addEventListener(event, schedule, { signal: lifetime.signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }, { signal: lifetime.signal });
  window.addEventListener('keydown', event => {
    if (!prefs.sfEnabled || !prefs.sfShortcuts) return;
    const action = C.shortcut(event);
    if (!action) return;
    const controller = activeController?.player.isConnected ? activeController : [...controllers.values()].find(item => item.player.getBoundingClientRect().width > 0);
    if (!controller || controller.adPlaying()) return;
    event.preventDefault(); event.stopPropagation();
    changeSpeed(action === 'reset' ? 1 : C.clamp(speed + (action === 'increase' ? C.STEP : -C.STEP)), controller);
  }, { signal: lifetime.signal });
  extension.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== extension.runtime.id || !message || !['sf:state', 'sf:set-speed'].includes(message.type)) return false;
    if (!initialized) { respond({ ok: false, loading: true, error: 'SpeedFlow is loading. Try again in a moment.' }); return false; }
    if (message.type === 'sf:set-speed') {
      const controller = activeController || controllers.values().next().value;
      respond(controller ? changeSpeed(message.speed, controller) : { ok: false, error: 'Open a regular YouTube video first.' });
    } else respond({ ok: true, speed, enabled: prefs.sfEnabled, mounted: controllers.size > 0, ad: [...controllers.values()].some(controller => controller.adPlaying()) });
    return false;
  });
  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.keys(C.DEFAULTS).some(key => key in changes)) return;
    const updated = { ...prefs };
    for (const key of Object.keys(C.DEFAULTS)) if (key in changes) updated[key] = changes[key].newValue;
    const previous = prefs;
    prefs = C.preferences(updated);
    if (!prefs.sfRemember) clearTimeout(saveTimer);
    const nextSpeed = prefs.sfRemember && 'sfSpeed' in changes ? prefs.sfSpeed : speed;
    if (!previous.sfRemember && prefs.sfRemember) persistSpeed();
    reconcile();
    if (prefs.sfEnabled && nextSpeed !== speed) {
      const result = changeSpeed(nextSpeed, null, false);
      if (!result.ok) persistSpeed();
    } else if (!prefs.sfEnabled) speed = nextSpeed;
    for (const controller of controllers.values()) { controller.apply(); controller.update(); }
  });
  extension.storage.local.get(Object.keys(C.DEFAULTS)).then(raw => {
    prefs = C.preferences(raw);
    speed = prefs.sfRemember ? prefs.sfSpeed : 1;
  }).catch(() => { storageNotice = true; }).finally(() => {
    initialized = true;
    reconcile();
    if (storageNotice) announce('Preferences could not be loaded. Speed controls still work in this tab.', true);
  });
})();
