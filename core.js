(function (root) {
  'use strict';
  const MIN = 0.25, MAX = 10, STEP = 0.25;
  const DEFAULTS = Object.freeze({ sfSpeed: 1, sfEnabled: true, sfShortcuts: true, sfRemember: true });
  const validSpeed = value => typeof value === 'number' && Number.isFinite(value) && value >= MIN && value <= MAX;
  function clamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    return Math.round(Math.min(MAX, Math.max(MIN, value)) * 100) / 100;
  }
  const format = value => `${Number(clamp(value).toFixed(2))}×`;
  function preferences(raw = {}) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key,
      key === 'sfSpeed' ? (validSpeed(raw[key]) ? clamp(raw[key]) : fallback) : (typeof raw[key] === 'boolean' ? raw[key] : fallback)
    ]));
  }
  function editable(event) {
    return event.composedPath().some(node => node?.nodeType === 1 && (node.isContentEditable ||
      node.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"]')));
  }
  function shortcut(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || editable(event)) return null;
    return ({ ']': 'increase', '[': 'decrease', '\\': 'reset' })[event.key] || null;
  }
  function youtubeURL(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && (parsed.hostname === 'www.youtube.com' ||
        (parsed.hostname === 'www.youtube-nocookie.com' && parsed.pathname.startsWith('/embed/')));
    } catch { return false; }
  }
  const api = Object.freeze({ MIN, MAX, STEP, DEFAULTS, validSpeed, clamp, format, preferences, editable, shortcut, youtubeURL });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpeedFlowCore = api;
})(globalThis);
