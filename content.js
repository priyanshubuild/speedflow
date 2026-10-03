(function () {
  'use strict';
  // Private to the extension's isolated world, so page scripts cannot disable this guard.
  if (globalThis.__speedflowInstance) return;
  globalThis.__speedflowInstance = true;
  const C = globalThis.SpeedFlowCore;
  const extension = globalThis.browser || globalThis.chrome;
  const controllers = new Map();
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
    // Coalesce held-key changes rather than writing on every event.
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
    for (const controller of controllers.values()) { controller.error = ''; controller.update(); }
    if (report) announce(`Playback speed ${C.format(speed)}.`);
    return { ok: true, speed };
  }

  class PlayerController {
    constructor(player, controls, target) {
      Object.assign(this, { player, controls, target, video: null, expectedRate: null, mediaSource: '', wasAd: false });
      this.wasAd = this.adPlaying();
      this.abort = new AbortController();
      this.signal = this.abort.signal;
      this.root = element('div', 'sf-controls');
      this.root.setAttribute('role', 'group');
      this.root.setAttribute('aria-label', 'Playback speed');
      this.reset = button('ytp-button sf-control sf-reset', 'Reset playback speed to 1× (\\)');
      this.reset.append(element('span', 'sf-reset-label', '1×'));
      this.minus = button('ytp-button sf-control sf-step', 'Decrease playback speed ([)');
      this.minus.append(icon('M6 10h12c1.1 0 2 .9 2 2s-.9 2-2 2H6c-1.1 0-2-.9-2-2s.9-2 2-2z'));
      this.readout = element('span', 'sf-readout', C.format(speed));
      this.readout.setAttribute('aria-label', 'Current playback speed');
      this.plus = button('ytp-button sf-control sf-step', 'Increase playback speed (])');
      this.plus.append(icon('M6 10h12c1.1 0 2 .9 2 2s-.9 2-2 2H6c-1.1 0-2-.9-2-2s.9-2 2-2z M10 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z'));
      this.root.append(this.reset, this.minus, this.readout, this.plus);
      target.insertBefore(this.root, target.firstChild);
      this.status = element('span', 'sf-sr-only');
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      this.status.setAttribute('aria-atomic', 'true');
      player.append(this.status);

      this.minus.addEventListener('click', () => {
        if (this.minus.getAttribute('aria-disabled') !== 'true') changeSpeed(C.clamp(speed - C.STEP), this);
      }, { signal: this.signal });
      this.plus.addEventListener('click', () => {
        if (this.plus.getAttribute('aria-disabled') !== 'true') changeSpeed(C.clamp(speed + C.STEP), this);
      }, { signal: this.signal });
      this.reset.addEventListener('click', () => {
        if (this.reset.getAttribute('aria-disabled') !== 'true') {
          changeSpeed(1, this);
        }
      }, { signal: this.signal });
      for (const name of ['click', 'dblclick', 'pointerdown', 'mousedown', 'touchstart']) {
        this.root.addEventListener(name, event => { activeController = this; event.stopPropagation(); }, { signal: this.signal });
      }
      for (const name of ['keydown', 'keyup']) {
        this.root.addEventListener(name, event => {
          // Let YouTube hotkeys and Tab work; prevent button activation from toggling playback.
          if (['Enter', ' '].includes(event.key)) event.stopPropagation();
        }, { signal: this.signal });
      }
      player.addEventListener('focusin', () => { activeController = this; }, { signal: this.signal });
      player.addEventListener('pointerenter', () => { activeController = this; }, { signal: this.signal });
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
      this.mediaSource = video.currentSrc || video.src;
      this.mediaAbort = new AbortController();
      const signal = this.mediaAbort.signal;
      const reapply = () => { this.mediaSource = video.currentSrc || video.src; this.apply(); this.update(); };
      for (const name of ['loadedmetadata', 'loadeddata', 'canplay', 'play']) video.addEventListener(name, reapply, { signal });
      video.addEventListener('ratechange', () => {
        if (this.adPlaying() || !this.video) return;
        if (this.expectedRate !== null && Math.abs(video.playbackRate - this.expectedRate) < 0.001) {
          this.expectedRate = null;
          return;
        }
        this.expectedRate = null;
        if (this.mediaSource !== (video.currentSrc || video.src)) return;
        // Accept native speed changes rather than fighting YouTube's Settings menu.
        if (C.validSpeed(video.playbackRate) && Math.abs(video.playbackRate - speed) > 0.001) {
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
      if (!this.video || this.adPlaying()) return true;
      const video = this.video;
      if (Math.abs(video.playbackRate - speed) < 0.001) return true;
      try {
        this.expectedRate = speed;
        video.playbackRate = speed;
        if (Math.abs(video.playbackRate - speed) > 0.001) { this.expectedRate = null; return false; }
        return true;
      } catch { this.expectedRate = null; return false; }
    }
    notify(message, error) {
      this.status.textContent = message;
      // Errors use the existing controls' native tooltip, never an extra overlay.
      if (error) { this.error = message; this.root.title = message; }
    }
    update() {
      const value = C.format(speed), unavailable = this.adPlaying() || !this.video;
      this.readout.textContent = value;
      this.readout.setAttribute('aria-label', `Current playback speed: ${value}`);
      this.readout.title = `Playback speed ${value}`;
      this.minus.setAttribute('aria-disabled', String(unavailable || speed <= C.MIN));
      this.plus.setAttribute('aria-disabled', String(unavailable || speed >= C.MAX));
      this.reset.setAttribute('aria-disabled', String(unavailable));
      if (speed === 1 && document.activeElement === this.reset) this.minus.focus({ preventScroll: true });
      this.reset.hidden = speed === 1;
      this.root.title = unavailable ? 'Speed controls pause during ads or while the video is unavailable.' : (this.error || '');
      this.layout();
    }
    layout() {
      const reference = this.target.querySelector('.ytp-settings-button') || this.target.querySelector('.ytp-button:not(.sf-control)');
      const rect = this.player.getBoundingClientRect();
      if (reference) {
        const css = getComputedStyle(reference), height = reference.getBoundingClientRect().height;
        this.root.style.setProperty('--sf-control-height', `${Math.max(32, Math.min(56, height || 40))}px`);
        this.root.style.fontFamily = css.fontFamily;
        this.root.style.color = css.color;
        const time = this.controls.querySelector('.ytp-time-current, .ytp-time-display');
        if (time) {
          const text = getComputedStyle(time);
          this.root.style.setProperty('--sf-text-size', `${Math.max(12, Math.min(14, parseFloat(text.fontSize) || 13))}px`);
          this.root.style.setProperty('--sf-text-weight', text.fontWeight);
        }
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
        // Keep the speed controls in front, even when native buttons fill the row.
        this.root.classList.toggle('sf-overflow', rect.width > 0 && rect.width < 700 && this.controls.clientWidth > 0 && needed > available);
      }
    }
    destroy() {
      this.abort.abort();
      this.mediaAbort?.abort();
      this.attributes.disconnect();
      this.resize?.disconnect();
      this.root.remove(); this.status.remove();
      if (activeController === this) activeController = null;
    }
  }

  function reconcile() {
    scheduled = 0;
    if (!initialized) return;
    const allowed = supportedRoute();
    for (const [player, controller] of controllers) {
      const controls = player.querySelector('.ytp-chrome-controls');
      const target = controls?.querySelector('.ytp-right-controls') || controls;
      if (!allowed || !player.isConnected || controls !== controller.controls || target !== controller.target || controller.root.parentElement !== target || !controller.status.isConnected) {
        controller.destroy();
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
  const relevant = '.html5-video-player, .ytp-chrome-controls, .ytp-right-controls, video, .sf-controls, .sf-sr-only';
  const observer = new MutationObserver(records => {
    if (!initialized) return;
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === 1 && (node.matches(relevant) || node.querySelector(relevant))))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return; // The existing controllers survive a back/forward cache restore.
    observer.disconnect();
    lifetime.abort();
    cancelAnimationFrame(scheduled);
    if (saveTimer) {
      extension.storage.local.set({ sfSpeed: speed }).catch(() => {});
    }
    clearTimeout(saveTimer);
    for (const controller of controllers.values()) controller.destroy();
    controllers.clear();
  }, { signal: lifetime.signal });
  for (const event of ['yt-navigate-finish', 'yt-page-data-updated', 'popstate', 'pageshow']) window.addEventListener(event, schedule, { signal: lifetime.signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }, { signal: lifetime.signal });
  window.addEventListener('keydown', event => {
    const action = C.shortcut(event);
    if (!action) return;
    const controller = activeController?.player.isConnected ? activeController : [...controllers.values()].find(item => item.player.getBoundingClientRect().width > 0);
    if (!controller || controller.adPlaying()) return;
    event.preventDefault(); event.stopPropagation();
    changeSpeed(action === 'reset' ? 1 : C.clamp(speed + (action === 'increase' ? C.STEP : -C.STEP)), controller);
  }, { signal: lifetime.signal });
  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.keys(C.DEFAULTS).some(key => key in changes)) return;
    const updated = { ...prefs };
    for (const key of Object.keys(C.DEFAULTS)) if (key in changes) updated[key] = changes[key].newValue;
    prefs = C.preferences(updated);
    const nextSpeed = prefs.sfSpeed;
    reconcile();
    if (nextSpeed !== speed) {
      const result = changeSpeed(nextSpeed, null, false);
      if (!result.ok) persistSpeed();
    }
    for (const controller of controllers.values()) { controller.apply(); controller.update(); }
  });
  extension.storage.local.get(Object.keys(C.DEFAULTS)).then(raw => {
    prefs = C.preferences(raw);
    speed = prefs.sfSpeed;
  }).catch(() => { storageNotice = true; }).finally(() => {
    initialized = true;
    reconcile();
    if (storageNotice) announce('Preferences could not be loaded. Speed controls still work in this tab.', true);
  });
})();
