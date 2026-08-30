const test = require('node:test');
const assert = require('node:assert/strict');
const { NEAR_END_RATIO, isNearEnd } = require('../dest/modules/playback/nearEnd.js');

const DURATION = 1000;

test('exposes the single near-end ratio definition', () => {
    assert.equal(NEAR_END_RATIO, 0.98);
});

test('treats a missing or invalid duration as not near end', () => {
    assert.equal(isNearEnd(500, 0), false);
    assert.equal(isNearEnd(500, -1), false);
    assert.equal(isNearEnd(0, 0), false);
});

test('is false below the near-end threshold', () => {
    assert.equal(isNearEnd(0, DURATION), false);
    assert.equal(isNearEnd(0.97 * DURATION, DURATION), false);
    assert.equal(isNearEnd(DURATION * NEAR_END_RATIO - 0.001, DURATION), false);
});

test('is true at and above the near-end threshold', () => {
    assert.equal(isNearEnd(DURATION * NEAR_END_RATIO, DURATION), true);
    assert.equal(isNearEnd(DURATION, DURATION), true);
});
