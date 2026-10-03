(function () {
  'use strict';

  // Guard against double-injection (e.g. popup fallback re-injects on a tab that
  // already has the script running via content_scripts declaration)
  if (window.__SF_LOADED__) return;
  window.__SF_LOADED__ = true;

  /* ══════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════ */
  const STEP    = 0.25;
  const MIN     = 0.25;
  const MAX     = 10.0;
  const LS_KEY  = 'sf_speed';
  const WIDGET_ID = 'sf-widget';
  const STYLE_ID  = 'sf-style';

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */
  let speed       = 1.0;
  let hostEl      = null;   // widget root <div>
  let dispEl      = null;   // speed <span>
  let navTimer    = 0;      // debounce handle for SPA navigation
  let mountTimer  = 0;      // debounce handle for mount retries
  let lastHref    = location.href;

  const watched   = new WeakSet();   // videos already patched

  /* ── Restore persisted speed ─────────────────────────────
     Strict validation: finite, in-range, not ±Infinity, not NaN
  ════════════════════════════════════════════════════════ */
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= MIN && n <= MAX) speed = n;
    }
  } catch (_) {}

  /* ══════════════════════════════════════════════════════════
     PURE UTILS  (no side-effects, easily unit-tested)
  ══════════════════════════════════════════════════════════ */

  /** Clamp n to [MIN, MAX], round to 2 decimal places. */
  function clamp(n) {
    return Math.min(MAX, Math.max(MIN, Math.round(n * 100) / 100));
  }

  /** Format speed as "1.0×", "1.5×", "2×" etc. */
  function fmt(n) {
    return (n % 1 === 0
      ? n.toFixed(1)
      : parseFloat(n.toFixed(2)).toString()
    ) + '\xd7';
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS — native feel global hotkeys
  ══════════════════════════════════════════════════════════ */
  window.addEventListener('keydown', e => {
    // Ignore hotkeys inside text fields to allow normal typing
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable ||
      active.closest('[contenteditable="true"]')
    )) {
      return;
    }

    // ] to speed up, [ to slow down, \ to reset to 1x
    if (e.key === ']') {
      const n = clamp(speed + STEP);
      playTick(n);
      setSpeed(n);
    } else if (e.key === '[') {
      const n = clamp(speed - STEP);
      playTick(n);
      setSpeed(n);
    } else if (e.key === '\\') {
      playTick(1.0);
      setSpeed(1.0);
    }
  }, { passive: true });

  /* ══════════════════════════════════════════════════════════
     VIDEO ENFORCEMENT
     Guards speed playback with ad-detection bypass filters
  ══════════════════════════════════════════════════════════ */
  function watchVideo(v) {
    if (watched.has(v)) return;
    watched.add(v);

    // Synchronous guard: re-apply our speed if YouTube resets it
    let busy = false;
    v.addEventListener('ratechange', () => {
      if (busy) return;

      // Skip speed enforcement during ad breaks to prevent detection/stuttering
      const player = v.closest('.html5-video-player');
      if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
        return;
      }

      if (Math.abs(v.playbackRate - speed) <= 0.01) return;
      busy = true;
      v.playbackRate = speed;
      busy = false;
    }, { passive: true });

    // Re-apply on lifecycle events (seek, buffer, ad transition)
    const reapply = () => {
      const player = v.closest('.html5-video-player');
      if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
        return;
      }
      if (Math.abs(v.playbackRate - speed) > 0.01) v.playbackRate = speed;
    };
    v.addEventListener('loadeddata', reapply, { passive: true });
    v.addEventListener('play',       reapply, { passive: true });
    v.addEventListener('canplay',    reapply, { passive: true });
    v.addEventListener('seeked',     reapply, { passive: true });
  }

  function applyToAllVideos(n) {
    document.querySelectorAll('video').forEach(v => {
      watchVideo(v);
      v.playbackRate = n;
    });
  }

  function setSpeed(n) {
    n = clamp(n);
    speed = n;
    applyToAllVideos(n);

    // Persist — write only if the tab's localStorage is accessible
    try { localStorage.setItem(LS_KEY, String(n)); } catch (_) {}

    // Update widget
    if (dispEl) dispEl.textContent = fmt(n);
    if (hostEl) hostEl.dataset.modified = (n !== 1.0) ? '1' : '';
  }

  /* ══════════════════════════════════════════════════════════
     AUDIO — ultra-soft sine tick
     Single oscillator, gain 0.045 (barely audible over video).
     No noise, no sub-thump — just a clean 70ms sine decay.
  ══════════════════════════════════════════════════════════ */
  let audioCtx = null;

  function playTick(n) {
    try {
      if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const ctx = audioCtx;
      const t   = ctx.currentTime;

      // Frequency range 490–580 Hz — inaudible shift, just haptic-feel variety
      const hz   = 490 + ((n - MIN) / (MAX - MIN)) * 90;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type          = 'sine';
      osc.frequency.value = hz;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 0.004);   // 4ms attack
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065); // 65ms decay

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════════
     CSS INJECTION — single concatenated string (fastest parse)
  ══════════════════════════════════════════════════════════ */
  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;

    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      /* ─── Widget wrapper: invisible inline container ──────────────────── */
      `#sf-widget{` +
        `display:inline-flex!important;align-items:center!important;` +
        `vertical-align:top!important;height:100%!important;` +
        `pointer-events:all!important;` +
        `font-family:'Roboto','YouTube Sans',Arial,sans-serif!important;` +
        `-webkit-user-select:none!important;user-select:none!important;` +
        `animation:sf-in .15s cubic-bezier(0,0,.2,1) both!important}` +

      `@keyframes sf-in{from{opacity:0}to{opacity:1}}` +

      /* ─── Each button: identical to YouTube's .ytp-button ────────────── */
      /* YT uses 48px-height buttons with white icons at 0.9 opacity        */
      `#sf-widget .sf-btn{` +
        `all:unset!important;` +
        `display:inline-flex!important;align-items:center!important;justify-content:center!important;` +
        `width:40px!important;height:48px!important;` +
        `cursor:pointer!important;` +
        `color:#fff!important;opacity:1!important;` +   /* full white — same as YT native */
        `flex-shrink:0!important;position:relative!important;` +
        `transition:opacity .1s cubic-bezier(0,0,.2,1)!important}` +
      `#sf-widget .sf-btn::before{` +
        `content:''!important;position:absolute!important;inset:8px!important;` +
        `border-radius:50%!important;background:rgba(255,255,255,0)!important;` +
        `transition:background .1s cubic-bezier(0,0,.2,1)!important}` +
      `#sf-widget .sf-btn:hover{opacity:1!important}` +
      `#sf-widget .sf-btn:hover::before{background:rgba(255,255,255,.1)!important}` +
      `#sf-widget .sf-btn:active::before{background:rgba(255,255,255,.2)!important}` +
      `#sf-widget .sf-btn svg{position:relative;z-index:1}` +

      /* ─── Speed readout: native control-bar text style ───────────────── */
      /* Matches the timecode font weight & brightness */
      `#sf-widget .sf-disp{` +
        `font-size:13px!important;font-weight:500!important;` + // Medium-bold weight matching timeline text
        `letter-spacing:.3px!important;font-variant-numeric:tabular-nums!important;` +
        `color:#f1f1f1!important;min-width:32px!important;` +   // YouTube's exact timeline white color
        `text-align:center!important;line-height:1!important;` +
        `cursor:default!important;flex-shrink:0!important;` +
        `padding:0 2px!important}` +

      /* ─── Separator: hidden (native layout has no dividers) ──────────── */
      `#sf-widget .sf-sep{display:none!important}` +

      /* ─── Reset: appears as a ghosted speed-badge beside the buttons ─── */
      /* Only visible when speed ≠ 1×. No heavy styling — just a faint tag  */
      `#sf-widget .sf-rst{` +
        `all:unset!important;display:none!important;` +
        `align-items:center!important;justify-content:center!important;` +
        `height:18px!important;padding:0 6px!important;margin:0 2px!important;` +
        `border-radius:3px!important;cursor:pointer!important;` +
        `font-size:11px!important;font-weight:500!important;` + // Bold/thick weight
        `font-family:'Roboto',Arial,sans-serif!important;letter-spacing:.3px!important;` +
        `color:#f1f1f1!important;` +                            // Brighter/thick reset badge
        `border:1px solid rgba(255,255,255,.30)!important;` +
        `transition:color .1s,border-color .1s,background .1s!important;` +
        `flex-shrink:0!important}` +
      `#sf-widget[data-modified="1"] .sf-rst{display:inline-flex!important}` +
      `#sf-widget .sf-rst:hover{` +
        `color:rgba(255,255,255,1)!important;` +
        `border-color:rgba(255,255,255,.60)!important;` +
        `background:rgba(255,255,255,.12)!important}`;

    document.head.appendChild(el);
  }

  /* ══════════════════════════════════════════════════════════
     SVG BUILDER — no innerHTML, no XSS surface
  ══════════════════════════════════════════════════════════ */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeSVG(d) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width',   '20');   // matches YT native icon footprint
    svg.setAttribute('height',  '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill',    'currentColor'); // Filled shapes match YouTube native icons!
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d',      d);
    svg.appendChild(path);
    return svg;
  }

  /* ══════════════════════════════════════════════════════════
     WIDGET MOUNT
  ══════════════════════════════════════════════════════════ */
  function mountWidget() {
    const controls = document.querySelector('.ytp-chrome-controls');
    if (!controls || hostEl) return;   // use cached ref, not querySelector

    hostEl = document.createElement('div');
    hostEl.id = WIDGET_ID;
    hostEl.setAttribute('role',        'group');
    hostEl.setAttribute('aria-label',  'SpeedFlow');
    if (speed !== 1.0) hostEl.dataset.modified = '1';

    /* Buttons using thick filled paths matching YouTube's solid control icon styles */
    const dec = document.createElement('button');
    dec.className = 'sf-btn';
    dec.title = 'Slower \u22120.25\xd7';
    dec.setAttribute('aria-label', 'Decrease speed');
    dec.appendChild(makeSVG('M6 10h12c1.1 0 2 .9 2 2s-.9 2-2 2H6c-1.1 0-2-.9-2-2s.9-2 2-2z'));

    dispEl = document.createElement('span');
    dispEl.className = 'sf-disp';
    dispEl.setAttribute('aria-live',  'polite');
    dispEl.setAttribute('aria-label', 'Current speed');
    dispEl.textContent = fmt(speed);

    const inc = document.createElement('button');
    inc.className = 'sf-btn';
    inc.title = 'Faster +0.25\xd7';
    inc.setAttribute('aria-label', 'Increase speed');
    inc.appendChild(makeSVG('M6 10h12c1.1 0 2 .9 2 2s-.9 2-2 2H6c-1.1 0-2-.9-2-2s.9-2 2-2z M10 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z'));

    const rst = document.createElement('button');
    rst.className = 'sf-rst';
    rst.title = 'Reset to 1\xd7';
    rst.setAttribute('aria-label', 'Reset speed to 1×');
    rst.textContent = '1\xd7';

    /* Children go directly into hostEl — no pill wrapper needed.
       We place rst on the far left (first) so that when it appears,
       the dec, dispEl, and inc elements (anchored on the right in the
       player's flexbar) do not shift position, completely preventing misclicks! */
    hostEl.append(rst, dec, dispEl, inc);

    /* ── Placement: first child of .ytp-right-controls ──────────────────
       This puts our controls at the LEFT edge of the right group:
         [1×reset] [−] [1.0×] [+]  |  [CC] [Settings] [MiniPlayer] [Theater] [FS]
       — perfectly inline with YouTube's native right-side icon buttons.
       Features dynamic class fallback to future-proof against player layout updates. */
    let rightControls = controls.querySelector('.ytp-right-controls');
    if (!rightControls) {
      rightControls = controls.querySelector('[class*="right-controls"]') ||
                      controls.querySelector('.ytp-chrome-controls > div:last-child');
    }

    if (rightControls) {
      rightControls.insertBefore(hostEl, rightControls.firstChild);
    } else {
      controls.appendChild(hostEl);
    }

    /* Re-enforce saved speed without re-triggering observers */
    if (speed !== 1.0) setTimeout(() => applyToAllVideos(speed), 500);

    /* Block all events from reaching YouTube's player layer */
    const stopAll = e => e.stopPropagation();
    const BLOCK_EVENTS = ['click', 'mousedown', 'dblclick'];
    for (const el of [hostEl, dec, inc, rst]) {
      for (const ev of BLOCK_EVENTS) el.addEventListener(ev, stopAll);
      el.addEventListener('touchstart', stopAll, { passive: true });
    }

    dec.addEventListener('click', e => { stopAll(e); const n = clamp(speed - STEP); playTick(n); setSpeed(n); });
    inc.addEventListener('click', e => { stopAll(e); const n = clamp(speed + STEP); playTick(n); setSpeed(n); });
    rst.addEventListener('click', e => { stopAll(e); playTick(1.0); setSpeed(1.0); });
  }

  /* ══════════════════════════════════════════════════════════
     TEARDOWN — clean up on navigation
  ══════════════════════════════════════════════════════════ */
  function teardown() {
    clearTimeout(navTimer);
    if (mountTimer) {
      cancelAnimationFrame(mountTimer);
      mountTimer = 0;
    }
    hostEl?.remove();
    hostEl  = null;
    dispEl  = null;
  }

  /* ══════════════════════════════════════════════════════════
     MUTATION OBSERVER
     Optimized: debounced mount checks, cached host ref,
     skips processing if no childList mutations are relevant
  ══════════════════════════════════════════════════════════ */
  new MutationObserver(mutations => {
    /* ── SPA navigation ─────────────────────────────────── */
    if (location.href !== lastHref) {
      lastHref = location.href;
      teardown();
      navTimer = setTimeout(init, 1200);
      // Don't return — still process new nodes in this batch
    }

    /* ── Scan for new <video> elements ──────────────────── */
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== 1) continue;   // elements only
        if (node.tagName === 'VIDEO') {
          watchVideo(node);
          if (speed !== 1.0) node.playbackRate = speed;
        } else if (node.childElementCount > 0) {
          // querySelectorAll only when the node has children
          node.querySelectorAll('video').forEach(v => {
            watchVideo(v);
            if (speed !== 1.0) v.playbackRate = speed;
          });
        }
      }
    }

    /* ── Re-mount if widget was removed (e.g. YT re-renders) */
    if (!hostEl && !mountTimer) {
      mountTimer = requestAnimationFrame(() => {
        mountWidget();
        mountTimer = 0;
      });
    }

  }).observe(document.body, {
    childList: true,
    subtree: true,
    // attributes: false, characterData: false — defaults, listed for clarity
  });

  /* ══════════════════════════════════════════════════════════
     PING HANDLER — validates sender is our own extension
  ══════════════════════════════════════════════════════════ */
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      // Only respond to messages from this extension's own popup
      if (sender.id !== chrome.runtime.id) return false;
      if (msg?.type === 'sf_ping') {
        sendResponse({ alive: true, speed });
        return false;   // synchronous — no async sendResponse needed
      }
    });
  } catch (_) {}

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  function init() {
    injectCSS();
    mountWidget();
  }

  // document_idle fires after DOMContentLoaded + subresources start loading.
  // YouTube's player renders asynchronously, so a brief wait is still needed —
  // but 400ms is enough; 900ms was over-conservative.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400), { once: true });
  } else {
    setTimeout(init, 400);
  }

})();
