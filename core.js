(function (root) {
  'use strict';
  const MIN = 0.25, MAX = 10, STEP = 0.25;
  const DEFAULTS = Object.freeze({ sfSpeed: 1 });
  const validSpeed = value => typeof value === 'number' && Number.isFinite(value) && value >= MIN && value <= MAX;
  function clamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    return Math.round(Math.min(MAX, Math.max(MIN, value)) * 100) / 100;
  }
  const format = value => `${clamp(value) % 1 === 0 ? clamp(value).toFixed(1) : Number(clamp(value).toFixed(2))}×`;
  function preferences(raw = {}) {
    return { sfSpeed: validSpeed(raw?.sfSpeed) ? clamp(raw.sfSpeed) : 1 };
  }
  function editable(event) {
    return event.composedPath().some(node => node?.nodeType === 1 && (node.isContentEditable ||
      node.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"]')));
  }
  function shortcut(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || editable(event)) return null;
    return ({ ']': 'increase', '[': 'decrease', '\\': 'reset' })[event.key] || null;
  }
  const api = Object.freeze({ MIN, MAX, STEP, DEFAULTS, validSpeed, clamp, format, preferences, editable, shortcut });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpeedFlowCore = api;
})(globalThis);
