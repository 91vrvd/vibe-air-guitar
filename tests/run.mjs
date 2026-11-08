// 纯逻辑回归：node tests/run.mjs
import assert from "node:assert/strict";
import { classifyHand, GestureStabilizer } from "../js/gesture.js";
import { voiceChord, bindingsFromProgression, splitProgression, normalizeChord, transposeProgression, defaultBindings } from "../js/theory.js";
import { STRUM_PATTERNS, DRUM_PATTERNS } from "../js/patterns.js";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log("✓", name); }

// 合成手：手腕在下，四指向上；rot 为整只手旋转角（弧度），模拟歪手
function hand(up, { thumb = false, rot = 0, scale = 1 } = {}) {
  const pts = [];
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  const rotate = (p) => {
    const dx = (p.x - wrist.x) * scale, dy = (p.y - wrist.y) * scale;
    return { x: wrist.x + dx * Math.cos(rot) - dy * Math.sin(rot), y: wrist.y + dx * Math.sin(rot) + dy * Math.cos(rot), z: p.z || 0 };
  };
  pts[0] = wrist;
  // 拇指 1-4
  const tb = [{ x: 0.44, y: 0.76 }, { x: 0.40, y: 0.72 }];
  if (thumb) pts.push(...tb, { x: 0.36, y: 0.68 }, { x: 0.32, y: 0.64 });
  else pts.push(...tb, { x: 0.43, y: 0.67 }, { x: 0.47, y: 0.66 });
  const xs = [0.45, 0.49, 0.53, 0.57];
  xs.forEach((x, i) => {
    const mcp = { x, y: 0.62 };
    if (up[i]) pts.push(mcp, { x, y: 0.54 }, { x, y: 0.49 }, { x, y: 0.45 });
    else pts.push(mcp, { x, y: 0.56 }, { x, y: 0.6 }, { x, y: 0.64 });
  });
  return pts.map(rotate);
}

test("手指计数：1-5 和握拳", () => {
  assert.equal(classifyHand(hand([1, 0, 0, 0])).count, 1);
  assert.equal(classifyHand(hand([1, 1, 0, 0])).count, 2);
  assert.equal(classifyHand(hand([1, 1, 1, 0])).count, 3);
  assert.equal(classifyHand(hand([1, 1, 1, 1])).count, 4);
  assert.equal(classifyHand(hand([1, 1, 1, 1], { thumb: true })).count, 5);
  assert.equal(classifyHand(hand([0, 0, 0, 0])).count, 0);
  assert.equal(classifyHand(hand([0, 0, 0, 0], { thumb: true })).count, null, "点赞不触发");
});

test("手歪 35° 和离镜头远（缩小一半）也能认", () => {
  for (const rot of [-0.6, 0.6]) {
    assert.equal(classifyHand(hand([1, 1, 0, 0], { rot })).count, 2);
    assert.equal(classifyHand(hand([1, 1, 1, 1], { rot, thumb: true })).count, 5);
  }
  assert.equal(classifyHand(hand([1, 1, 1, 0], { scale: 0.5 })).count, 3);
});

test("去抖：连续 2 帧才确认，丢手 160ms 后才算松手", () => {
  const s = new GestureStabilizer({ frames: 2, lostGraceMs: 160 });
  assert.equal(s.push(3, 0), false);
  assert.equal(s.push(3, 33), true);
  assert.equal(s.stable, 3);
  assert.equal(s.push(4, 66), false, "单帧抖动不切换");
  assert.equal(s.push(3, 99), false);
  assert.equal(s.stable, 3);
  assert.equal(s.push(undefined, 150), false, "短暂丢帧保持");
  assert.equal(s.push(undefined, 300), true);
  assert.equal(s.stable, null);
});

test("和弦排布像真吉他", () => {
  const frets = (name) => voiceChord(name).strings.map((m, i) => (m === null ? "x" : m - [40, 45, 50, 55, 59, 64][i])).join("");
  assert.equal(frets("C"), "x32010");
  assert.equal(frets("G"), "320003");
  assert.equal(frets("Am"), "x02210");
  assert.equal(frets("Em"), "022000");
  assert.equal(frets("D"), "xx0232");
  assert.equal(frets("E"), "022100");
  assert.equal(frets("Dm"), "xx0231");
  assert.equal(frets("A"), "x02220");
});

test("和弦名解析与移调", () => {
  assert.equal(normalizeChord("am7"), "Am7");
  assert.equal(normalizeChord("Bb"), "A#");
  assert.equal(normalizeChord("CM7"), "Cmaj7");
  assert.equal(normalizeChord("H"), "");
  assert.equal(transposeProgression("C G Am F", 2), "D A Bm G");
  assert.deepEqual(splitProgression("C, G | Am，F"), ["C", "G", "Am", "F"]);
});

test("和弦谱分配手指：调内级数优先", () => {
  assert.deepEqual(bindingsFromProgression(["C", "G", "Am", "F"], "C"), defaultBindings("C"));
  const b = bindingsFromProgression(["G", "D", "Em", "C"], "G");
  assert.equal(b[1], "G"); assert.equal(b[2], "D"); assert.equal(b[3], "Em"); assert.equal(b[4], "C");
  const jazz = bindingsFromProgression(["Dm7", "G7", "Cmaj7"], "C");
  assert.ok(Object.values(jazz).includes("Dm7") && Object.values(jazz).includes("G7") && Object.values(jazz).includes("Cmaj7"));
});

test("节奏型数据合法", () => {
  for (const p of STRUM_PATTERNS) {
    assert.match(p.pattern, /^[DUx-]+$/);
    assert.equal(p.pattern.length, (p.meter || 4) * 2, p.id);
  }
  for (const d of DRUM_PATTERNS) {
    let hits = 0;
    for (let s = 0; s < 8; s += 1) d.play(s, 0, () => { hits += 1; });
    assert.ok(hits > 0, d.id);
  }
});

console.log(`\n${passed} 组通过`);
