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
    assert.match(p.pattern, /^[DUxBA-]+$/);
    assert.equal(p.pattern.length, (p.meter || 4) * 2, p.id);
  }
  for (const d of DRUM_PATTERNS) {
    let hits = 0;
    for (let s = 0; s < 8; s += 1) d.play(s, 0, () => { hits += 1; });
    assert.ok(hits > 0, d.id);
  }
});

console.log(`\n${passed} 组通过`);

// ---- 歌曲解析 ----
const { parseSheet, BUILTIN_SONGS, chordToken, guessKey, topChords } = await import("../js/songs.js");
test("文字谱：方括号写法", () => {
  const r = parseSheet("[C]长亭外，[F]古道[C]边");
  assert.deepEqual(r.sequence.map((c) => c.name), ["C", "F", "C"]);
  assert.equal(r.lines[0].text, "长亭外，古道边");
  assert.deepEqual(r.lines[0].chords.map((c) => c.at), [0, 4, 6]);
});
test("文字谱：和弦行在上、歌词在下", () => {
  const r = parseSheet("C       G\n我曾经  跨过山和大海\nAm  F\n");
  assert.deepEqual(r.sequence.map((c) => c.name), ["C", "G", "Am", "F"]);
  assert.equal(r.lines[0].text[r.lines[0].chords[1].at], "跨", "G 对到“跨”字（中文占 2 格）");
  assert.equal(r.lines[1].text, "");
});
test("文字谱：斜线和弦、扩展和弦、段落名", () => {
  assert.equal(chordToken("G/B"), "G");
  assert.equal(chordToken("Cadd9"), "C");
  assert.equal(chordToken("Bbmaj7"), "A#maj7");
  assert.equal(chordToken("我"), "");
  const r = parseSheet("[Verse]\n[Am]hello");
  assert.deepEqual(r.sequence.map((c) => c.name), ["Am"]);
});
test("内置歌曲都能解析，猜调和常用和弦合理", () => {
  for (const s of BUILTIN_SONGS) assert.ok(parseSheet(s.text).sequence.length >= 3, s.id);
  assert.equal(guessKey(parseSheet("Am F C G").sequence), "C");
  assert.deepEqual(topChords(parseSheet(BUILTIN_SONGS[0].text).sequence, 3), ["C", "F", "G"]);
});
console.log(`\n${passed} 组通过（含歌曲）`);

const { detectStyle, sheetFromOcrLines, STYLES } = await import("../js/songs.js");
test("每首内置歌都有有效曲风；导入时能猜曲风", () => {
  for (const s of BUILTIN_SONGS) assert.ok(STYLES[s.style], s.id);
  assert.equal(detectStyle("拍号：3/4 拍速：90", []).styleId, "waltz");
  assert.equal(detectStyle("拍速：68", parseSheet("C G").sequence).bpm, 68);
  assert.equal(detectStyle("", parseSheet("Am Em F G Am Dm").sequence).styleId, "ballad");
  assert.equal(detectStyle("", parseSheet("C G F C").sequence).styleId, "folk");
});
test("截图识别：和弦按横坐标落到歌词的字上", () => {
  const sym = (t, x) => ({ text: t, bbox: { x0: x, x1: x + 18 } });
  const lines = [
    { text: "C  Arn", words: [{ text: "C", bbox: { x0: 10, x1: 20 } }, { text: "Arn", bbox: { x0: 82, x1: 110 } }] },
    { text: "长 亭 外 古 道 边", words: [{ text: "长亭外古道边", bbox: { x0: 10, x1: 130 }, symbols: [sym("长", 10), sym("亭", 30), sym("外", 50), sym("古", 70), sym("道", 90), sym("边", 110)] }] },
    { text: "晚 风 拂 柳", words: [{ text: "晚风拂柳", bbox: { x0: 10, x1: 90 } }] },
  ];
  assert.equal(sheetFromOcrLines(lines), "[C]长亭外古[Am]道边\n晚风拂柳");
});
console.log(`\n${passed} 组通过（含曲风/截图）`);

const { parseRhythm } = await import("../js/songs.js");
test("小节线算拍数、谱头信息、谱上的节奏", () => {
  const r = parseSheet(`标题: 测试
1=D 4/4
Capo=2
速度: 68
节奏: R3231323
[前奏]
| [C] [G] | [Am] | [Fmaj7] [G] | [C] |
| [C]听见冬天[G]的离 | [Am]开 | 我在某年 | [F]醒来 | - |`);
  assert.equal(r.meta.title, "测试");
  assert.equal(r.meta.capo, 2);
  assert.equal(r.meta.bpm, 68);
  assert.equal(r.meta.meter, 4);
  assert.deepEqual(r.sequence.map((c) => `${c.name}:${c.beats}`), ["C:2", "G:2", "Am:4", "Fmaj7:2", "G:2", "C:4", "C:2", "G:2", "Am:8", "F:8"]);
  assert.equal(r.lines[1].text, "【前奏】".length ? r.lines[1].text : "");
  assert.deepEqual(parseRhythm("R3231323"), { type: "arp", steps: ["R", 3, 2, 3, 1, 3, 2, 3], meter: 4 });
  assert.equal(parseRhythm("↓ ↓↑ ↑↓↑".replace(/ /g, "-")).pattern, "D-DU-UDU");
  assert.equal(parseRhythm("B-DUDU").meter, 3);
  const plain = parseSheet("C G Am F");
  assert.equal(plain.sequence[0].beats, undefined, "没写小节线时不带拍数");
});
console.log(`\n${passed} 组通过（含小节）`);
