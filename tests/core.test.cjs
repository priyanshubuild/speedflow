const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
test('rejects corrupt stored speeds and normalizes preferences', () => {
  for (const value of [NaN, Infinity, -Infinity, '2', null, -1, 0, 10.1]) assert.equal(C.preferences({ sfSpeed: value }).sfSpeed, 1);
  assert.deepEqual(C.preferences({ sfSpeed: 1.75, sfEnabled: false, sfShortcuts: false, sfRemember: false }), { sfSpeed: 1.75 });
  assert.deepEqual(C.preferences(null), C.DEFAULTS);
  assert.deepEqual(C.preferences({ sfEnabled: false }), { sfSpeed: 1 });
});
test('clamps boundary speeds without losing native custom values', () => {
  assert.equal(C.clamp(-2), .25); assert.equal(C.clamp(200), 10);
  assert.equal(C.clamp(1.17), 1.17); assert.equal(C.clamp(NaN), 1);
  assert.equal(C.format(1), '1.0×'); assert.equal(C.format(1.25), '1.25×'); assert.equal(C.format(10), '10.0×');
});
