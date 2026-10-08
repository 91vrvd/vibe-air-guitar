const test = require('node:test');
const assert = require('node:assert/strict');
const { fingerCount, StableGesture, StrumDetector, tappedTempo, validateSession } = require('../studio-core.js');

function hand(count) {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .75 }));
  p[0] = { x: .5, y: .9 };
  for (let f = 0; f < 4; f++) {
    const i = 5 + f * 4, x = .36 + f * .09;
    p[i] = { x, y: .65 }; p[i + 1] = { x, y: .5 };
    p[i + 2] = { x, y: f < count ? .4 : .62 }; p[i + 3] = { x, y: f < count ? .3 : .72 };
  }
  p[4] = count === 5 ? { x: .12, y: .6 } : { x: .43, y: .66 };
  return p;
}
test('finger counting recognizes 1–5, fist and missing hand', () => {
  for (let n = 1; n <= 5; n++) assert.equal(fingerCount(hand(n)), n);
  assert.equal(fingerCount(hand(0)), null); assert.equal(fingerCount([]), null);
});
test('finger counts survive rotation, mirroring and scale', () => {
  for (const angle of [Math.PI / 2, Math.PI, -Math.PI / 3]) for (let n = 1; n <= 5; n++) {
    const points = hand(n).map(p => ({ x: .6 + (p.x * Math.cos(angle) - p.y * Math.sin(angle)) * .4, y: .2 + (p.x * Math.sin(angle) + p.y * Math.cos(angle)) * .4 }));
    assert.equal(fingerCount(points), n);
    assert.equal(fingerCount(points.map(p => ({ x: 1 - p.x, y: p.y }))), n);
  }
});
test('stable selection rejects flicker and clears on sustained loss', () => {
  const s = new StableGesture(100);
  assert.equal(s.update(1, 0), null); assert.equal(s.update(1, 101), 1);
  assert.equal(s.update(3, 110), 1); assert.equal(s.update(1, 150), 1);
  assert.equal(s.update(2, 200), 1); assert.equal(s.update(2, 301), 2);
  s.update(null, 350); assert.equal(s.update(null, 451), null);
  s.reset(); assert.equal(s.value, null);
});
test('sweep uses travel, velocity, cooldown and reacquisition guard', () => {
  const d = new StrumDetector();
  assert.equal(d.update(.2, 0), null);
  assert.equal(d.update(.21, 20), null);
  assert.equal(d.update(.35, 90).direction, 'down');
  assert.equal(d.update(.2, 120), null);
  assert.equal(d.update(.1, 300).direction, 'up');
  d.update(null, 340); assert.equal(d.update(.8, 400), null);
  assert.equal(d.update(.1, 1000), null);
});
test('single-hand sweep uses a shorter travel without repeated false hits', () => {
  const d = new StrumDetector({ travel: .065, minVelocity: .2, cooldownMs: 110 });
  assert.equal(d.update(.35, 0), null);
  assert.equal(d.update(.42, 40).direction, 'down');
  assert.equal(d.update(.50, 80), null);
  assert.equal(d.update(.40, 170).direction, 'up');
  d.update(null, 190);
  assert.equal(d.update(.8, 210), null);
});
test('tap tempo requires three taps, ignores outliers, respects limits', () => {
  assert.equal(tappedTempo([0, 500]), null);
  assert.equal(tappedTempo([0, 500, 1000, 1510]), 120);
  assert.equal(tappedTempo([0, 500, 1000, 2000]), 120);
  assert.equal(tappedTempo([0, 250, 500]), 200);
});
const options = { chords: ['C', 'G', 'Am', 'F', 'Em'], enums: { instrument: ['guitar'], mode: ['strum'] } };
const good = { version: 1, instrument: 'guitar', mode: 'strum', bpm: 100, capo: 0, volume: 75, progression: ['C', 'G'], bindings: { 1: 'C', 2: 'G', 3: 'Am', 4: 'F', 5: 'Em' }, drums: true };
test('session accepts known music values and drops arbitrary fields', () => {
  const s = validateSession({ ...good, injected: '<script>' }, options);
  assert.equal(s.drums, true); assert.equal(s.injected, undefined);
});
test('session rejects executable strings, oversized progressions and bad values', () => {
  for (const patch of [{ bpm: NaN }, { volume: 101 }, { capo: -1 }, { instrument: 'evil' }, { progression: ['<img>'] }, { progression: Array(65).fill('C') }, { bindings: null }, { version: 2 }]) {
    assert.throws(() => validateSession({ ...good, ...patch }, options));
  }
});
