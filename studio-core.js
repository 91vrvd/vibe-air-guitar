/* Pure musical/gesture helpers, shared by the browser and node:test. */
(function (root) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function fingerCount(points) {
    if (!Array.isArray(points) || points.length !== 21 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
    const wrist = points[0], palm = points[9], scale = Math.max(.025, distance(wrist, palm));
    const extended = [[8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17]].map(([tip, pip, mcp]) => {
      const a = { x: points[pip].x - points[mcp].x, y: points[pip].y - points[mcp].y };
      const b = { x: points[tip].x - points[pip].x, y: points[tip].y - points[pip].y };
      const straight = (a.x * b.x + a.y * b.y) / Math.max(.00001, Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
      return straight > .35 && distance(points[tip], wrist) > distance(points[pip], wrist) + scale * .12;
    });
    const count = extended.filter(Boolean).length;
    const thumb = distance(points[4], points[5]) > scale * .65 && distance(points[4], points[17]) > scale * 1.2;
    return count === 4 && thumb ? 5 : count || null;
  }
  class StableGesture {
    constructor(delay = 100) { this.delay = delay; this.reset(); }
    reset() { this.candidate = null; this.since = 0; this.value = null; }
    update(candidate, time) {
      if (candidate !== this.candidate) { this.candidate = candidate; this.since = time; }
      if (time - this.since >= this.delay) this.value = candidate;
      return this.value;
    }
  }
  class StrumDetector {
    constructor({ travel = .09, minVelocity = .25, cooldownMs = 140 } = {}) {
      this.travel = travel; this.minVelocity = minVelocity; this.cooldownMs = cooldownMs;
      this.reset();
    }
    reset() { this.previous = null; this.lastHit = -Infinity; this.anchor = null; this.direction = 0; }
    update(y, time) {
      if (!Number.isFinite(y)) { this.reset(); return null; }
      const prev = this.previous;
      this.previous = { y, time };
      if (!prev || time - prev.time > 250) { this.anchor = y; this.direction = 0; return null; }
      const dy = y - prev.y, direction = Math.sign(dy), velocity = Math.abs(dy) / Math.max(1, time - prev.time) * 1000;
      if (Math.abs(dy) < .003) return null;
      if (direction !== this.direction) { this.anchor = prev.y; this.direction = direction; }
      if (Math.abs(y - this.anchor) < this.travel || velocity < this.minVelocity || time - this.lastHit < this.cooldownMs) return null;
      this.lastHit = time; this.anchor = y;
      return { direction: direction > 0 ? 'down' : 'up', velocity: clamp(velocity / 2, .35, 1) };
    }
  }
  function tappedTempo(times) {
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter(n => n >= 250 && n <= 1500);
    if (gaps.length < 2) return null;
    gaps.sort((a, b) => a - b);
    return clamp(Math.round(60000 / gaps[Math.floor(gaps.length / 2)]), 40, 200);
  }
  function validateSession(value, options) {
    if (!value || value.version !== 1 || typeof value !== 'object') throw new Error('不是 Vibe 演奏配置文件');
    const result = { version: 1 };
    for (const [key, choices] of Object.entries(options.enums)) {
      if (!choices.includes(value[key])) throw new Error('配置选项无效：' + key);
      result[key] = value[key];
    }
    for (const [key, range] of Object.entries({ bpm: [40, 200], capo: [0, 5], volume: [0, 100] })) {
      if (!Number.isFinite(value[key]) || value[key] < range[0] || value[key] > range[1]) throw new Error('配置数值无效：' + key);
      result[key] = Math.round(value[key]);
    }
    if (!Array.isArray(value.progression) || value.progression.length > 64 || value.progression.some(c => !options.chords.includes(c))) throw new Error('和弦谱无效');
    result.progression = value.progression;
    if (!value.bindings || [1, 2, 3, 4, 5].some(i => !options.chords.includes(value.bindings[i]))) throw new Error('手势和弦无效');
    result.bindings = Object.fromEntries([1, 2, 3, 4, 5].map(i => [i, value.bindings[i]]));
    for (const key of ['drums', 'metronome', 'spread', 'humanize', 'muted']) result[key] = value[key] === true;
    return result;
  }
  const api = { clamp, fingerCount, StableGesture, StrumDetector, tappedTempo, validateSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudioCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
