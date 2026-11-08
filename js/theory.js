// 乐理工具：和弦解析、吉他式排布、移调、手势默认绑定。纯函数，无 DOM 依赖。

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_OFFSETS = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
export const KEYS = NOTE_NAMES.slice();

export const QUALITY_INTERVALS = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  7: [0, 4, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};
export const QUALITIES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "dim", "aug"];

// 标准调弦空弦 MIDI：6 弦(低 E) → 1 弦(高 E)
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];

// 手势 → 调内级数（V1 约定：1=I, 2=V, 3=vi, 4=IV, 5=iii）
const FINGER_DEGREES = { 1: [0, ""], 2: [7, ""], 3: [9, "m"], 4: [5, ""], 5: [4, "m"] };

export const PROGRESSION_PRESETS = [
  ["C G Am F", "流行 1-5-6-4"],
  ["C G Am Em F C F G", "卡农万用"],
  ["C Am F G", "50 年代 / 民谣经典"],
  ["Am F C G", "悲伤小调"],
  ["F G Em Am", "日系 / K-Pop 标配"],
  ["C Dm7 Em7 Fmaj7", "日本流行"],
  ["G D Em C", "民谣抒情"],
  ["C F G C", "摇滚力量"],
  ["E A B A", "经典摇滚"],
  ["G C D G", "乡村民谣"],
  ["Dm7 G7 Cmaj7", "爵士 2-5-1"],
  ["Am7 Dm7 G7 Cmaj7", "R&B 灵魂"],
  ["Am7 Em7 Dm7 Cmaj7", "Lo-fi"],
  ["C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7", "Blues 12 小节"],
];

const SUFFIX_ALIASES = {
  "": "", M: "", maj: "", major: "",
  m: "m", min: "m", minor: "m", "-": "m",
  M7: "maj7", maj7: "maj7", Maj7: "maj7", MAJ7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  m7: "m7", min7: "m7", "-7": "m7",
  7: "7", dom7: "7",
  sus: "sus4", sus4: "sus4", sus2: "sus2",
  dim: "dim", o: "dim", "°": "dim",
  aug: "aug", "+": "aug",
};

/** 把各种写法归一成 "C#m7" 这种标准名；无法识别返回 "" */
export function normalizeChord(raw) {
  const match = String(raw || "").trim().match(/^([A-Ga-g])([#b♯♭]?)(.*)$/);
  if (!match) return "";
  const acc = match[2].replace("♯", "#").replace("♭", "b");
  const rootRaw = match[1].toUpperCase() + acc;
  if (NOTE_OFFSETS[rootRaw] === undefined) return "";
  const root = NOTE_NAMES[NOTE_OFFSETS[rootRaw]];
  const suffixRaw = match[3].replace(/\s+/g, "");
  const suffix = Object.prototype.hasOwnProperty.call(SUFFIX_ALIASES, suffixRaw) ? SUFFIX_ALIASES[suffixRaw] : null;
  if (suffix === null) return "";
  return root + suffix;
}

export function parseChord(name) {
  const clean = normalizeChord(name);
  if (!clean) return null;
  const m = clean.match(/^([A-G]#?)(.*)$/);
  return { name: clean, root: NOTE_OFFSETS[m[1]], rootName: m[1], quality: m[2] };
}

export function transposeChord(name, semitones) {
  const c = parseChord(name);
  if (!c) return String(name || "");
  return NOTE_NAMES[(((c.root + semitones) % 12) + 12) % 12] + c.quality;
}

export function keyInterval(fromKey, toKey) {
  return (NOTE_OFFSETS[toKey] ?? 0) - (NOTE_OFFSETS[fromKey] ?? 0);
}

export function splitProgression(text) {
  return String(text || "")
    .split(/[\s,，|｜]+/)
    .map(normalizeChord)
    .filter(Boolean);
}

export function transposeProgression(text, semitones) {
  return splitProgression(text).map((c) => transposeChord(c, semitones)).join(" ");
}

/**
 * 像真吉他一样排布和弦：根音落在 6/5/4 弦，其余每根弦在 0-4 品内取最低的和弦内音。
 * 返回每根弦的 MIDI（低→高），未弹的弦为 null。
 */
export function voiceChord(name) {
  const c = parseChord(name) || parseChord("C");
  const intervals = QUALITY_INTERVALS[c.quality] || QUALITY_INTERVALS[""];
  const pcs = new Set(intervals.map((i) => (c.root + i) % 12));
  const fretOf = (open) => (((c.root - open) % 12) + 12) % 12;
  let bassString = 2; // 默认 4 弦（D/D#）
  if (fretOf(OPEN_STRINGS[0]) <= 4) bassString = 0;
  else if (fretOf(OPEN_STRINGS[1]) <= 4) bassString = 1;
  const strings = OPEN_STRINGS.map((open, idx) => {
    if (idx < bassString) return null;
    if (idx === bassString) return open + fretOf(open);
    for (let fret = 0; fret <= 4; fret += 1) {
      if (pcs.has((open + fret) % 12)) return open + fret;
    }
    return null;
  });
  // 七和弦确保七音出现：没出现就把最高的重复根音替换掉
  if (intervals.length === 4) {
    const seventh = (c.root + intervals[3]) % 12;
    if (!strings.some((n) => n !== null && n % 12 === seventh)) {
      for (let i = strings.length - 1; i > bassString; i -= 1) {
        if (strings[i] !== null && strings[i] % 12 === c.root) {
          for (let f = 0; f <= 5; f += 1) {
            if ((OPEN_STRINGS[i] + f) % 12 === seventh) { strings[i] = OPEN_STRINGS[i] + f; break; }
          }
          break;
        }
      }
    }
  }
  return { name: c.name, root: c.root, quality: c.quality, strings, bassString };
}

export function defaultBindings(key) {
  const k = NOTE_OFFSETS[key] ?? 0;
  const out = {};
  for (const [finger, [offset, quality]] of Object.entries(FINGER_DEGREES)) {
    out[finger] = NOTE_NAMES[(k + offset) % 12] + quality;
  }
  return out;
}

/** 在当前调里给和弦找最自然的手指号（按级数匹配，同根音也算） */
export function fingerForChordInKey(chordName, key) {
  const c = parseChord(chordName);
  if (!c) return null;
  const k = NOTE_OFFSETS[key] ?? 0;
  for (const [finger, [offset]] of Object.entries(FINGER_DEGREES)) {
    if ((k + offset) % 12 === c.root) return Number(finger);
  }
  return null;
}

/** 由和弦谱推出 1-5 指绑定：调内级数优先，其余依次补空位 */
export function bindingsFromProgression(tokens, key) {
  const next = defaultBindings(key);
  const used = new Set();
  const pending = [];
  for (const token of [...new Set(tokens)]) {
    const finger = fingerForChordInKey(token, key);
    if (finger && !used.has(finger)) {
      next[finger] = token;
      used.add(finger);
    } else {
      pending.push(token);
    }
  }
  for (const token of pending) {
    const free = [1, 2, 3, 4, 5].find((f) => !used.has(f));
    if (!free) break;
    next[free] = token;
    used.add(free);
  }
  return next;
}

export function allChordOptions() {
  return NOTE_NAMES.flatMap((root) => QUALITIES.map((q) => root + q));
}

export function midiToName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
