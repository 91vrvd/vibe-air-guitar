let chordMap = {};

const modeLabels = {
  strum: "扫弦",
  arp: "分解",
  custom: "自定义",
};

function makeStepPattern(steps) {
  const pattern = Array(16).fill("-");
  steps.forEach((step) => { pattern[step - 1] = "D"; });
  return pattern;
}

const baseRhythmProfiles = [
  { id: "cardigan", name: "卡农电吉他", pattern: ["D", "-", "U", "D", "-", "U", "x", "U"], bpm: 96, swing: 0.008 },
  { id: "8beat_downup", name: "8beat_downup", pattern: ["D", "-", "D", "U", "-", "U", "D", "U"], bpm: 92, swing: 0 },
  { id: "slow_sad", name: "忧伤慢板", pattern: ["D", "-", "-", "U", "-", "D", "-", "U"], bpm: 76, swing: 0.02 },
  { id: "bright", name: "明亮流行", pattern: ["D", "U", "x", "U", "D", "U", "x", "U"], bpm: 108, swing: 0 },
  { id: "rock", name: "摇滚八分", pattern: ["D", "D", "x", "U", "D", "D", "x", "U"], bpm: 118, swing: 0 },
  { id: "ballad", name: "抒情分解", pattern: ["D", "-", "U", "-", "D", "-", "U", "-"], bpm: 82, swing: 0.015 },
  { id: "reggae", name: "反拍雷鬼", pattern: ["-", "U", "-", "x", "-", "U", "-", "x"], bpm: 96, swing: 0.01 },
  { id: "funk", name: "律动切分", pattern: ["x", "U", "D", "x", "-", "U", "x", "U"], bpm: 104, swing: 0.018 },
  { id: "waltz", name: "三拍摇摆", pattern: ["D", "-", "U", "D", "-", "U"], bpm: 88, swing: 0.025 },
  { id: "drive", name: "推进副歌", pattern: ["D", "U", "D", "U", "D", "U", "D", "U"], bpm: 126, swing: 0 },
  { id: "cn_folk_soft", name: "中文民谣轻扫", pattern: ["D", "-", "D", "U", "-", "U", "D", "U"], bpm: 84, swing: 0.012 },
  { id: "cn_ballad_warm", name: "中文抒情慢扫", pattern: ["D", "-", "-", "U", "D", "-", "U", "-"], bpm: 74, swing: 0.018 },
  { id: "cn_story_folk", name: "叙事民谣推进", pattern: ["D", "-", "D", "-", "D", "U", "D", "U"], bpm: 92, swing: 0.01 },
  { id: "dylan_train", name: "英文民谣火车", pattern: ["D", "-", "D", "U", "D", "-", "D", "U"], bpm: 102, swing: 0.014 },
  { id: "singer_writer", name: "唱作人通用", pattern: ["D", "-", "D", "U", "-", "U", "D", "U"], bpm: 96, swing: 0.006 },
  { id: "ed_pop_chop", name: "英文流行切分", pattern: ["D", "x", "D", "U", "-", "U", "x", "U"], bpm: 104, swing: 0.004 },
  { id: "open_pop", name: "明亮开放 Pop", pattern: ["D", "U", "D", "-", "D", "U", "D", "U"], bpm: 112, swing: 0 },
  { id: "chorus_lift", name: "副歌抬升扫弦", pattern: ["D", "-", "D", "U", "D", "U", "D", "U"], bpm: 116, swing: 0 },
  { id: "rock_down_drive", name: "摇滚下扫推进", pattern: ["D", "D", "D", "U", "D", "D", "D", "U"], bpm: 122, swing: 0 },
  { id: "soft_arc_strum", name: "软弧线抒情", pattern: ["D", "-", "U", "-", "-", "U", "D", "-"], bpm: 78, swing: 0.02 },
  { id: "breathy_ballad", name: "气声慢歌扫弦", pattern: ["D", "-", "-", "U", "-", "U", "D", "-"], bpm: 72, swing: 0.022 },
];
const rhythmProfiles = baseRhythmProfiles;
const drumRhythmProfiles = [
  { id: "drum_standard", name: "标准四四拍" },
  { id: "drum_pop_kick", name: "流行底鼓" },
  { id: "drum_funk_break", name: "Funk 碎拍" },
  { id: "drum_hiphop_slow", name: "HIP-HOP 慢鼓" },
  { id: "drum_reggae", name: "雷鬼反拍" },
  { id: "drum_light_hat", name: "轻拍镲帽" },
  { id: "drum_march", name: "军鼓进行曲" },
  { id: "drum_trap", name: "电子 Trap" },
  { id: "drum_heavy_rock", name: "摇滚重型" },
  { id: "drum_bossa", name: "拉丁 Bossanova" },
  { id: "drum_ballad_slow", name: "抒情慢歌" },
  { id: "drum_country_folk", name: "乡村民谣" },
  { id: "drum_britpop", name: "英伦摇滚" },
  { id: "drum_soul_rnb", name: "灵魂 R&B" },
  { id: "drum_indie_rock", name: "独立摇滚" },
  { id: "drum_post_ambient", name: "后摇氛围" },
  { id: "drum_jazz_swing", name: "爵士摇摆" },
  { id: "drum_samba", name: "拉丁桑巴" },
  { id: "drum_dream_pop", name: "梦幻流行" },
  { id: "drum_soft_piano", name: "情感钢琴伴奏鼓" },
];
const arpPattern = [0, 2, 5, 1, 2, 5];

const noteOffsets = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const majorScale = [0, 2, 4, 5, 7, 9, 11];
const chordQualityIntervals = {
  "": [0, 4, 7, 12, 16, 19],
  m: [0, 3, 7, 12, 15, 19],
  maj7: [0, 4, 7, 11, 12, 16],
  m7: [0, 3, 7, 10, 12, 15],
  7: [0, 4, 7, 10, 12, 16],
  sus4: [0, 5, 7, 12, 17, 19],
  sus2: [0, 2, 7, 12, 14, 19],
  dim: [0, 3, 6, 12, 15, 18],
  aug: [0, 4, 8, 12, 16, 20],
};
const chordQualityList = ["", "m", "maj7", "m7", "7", "sus4", "sus2", "dim", "aug"];
const fingerDegreeOffsets = { 1: 0, 2: 7, 3: 9, 4: 5, 5: 4 };
const fingerQualityMap = {
  1: ["", "maj7", "7", "sus4", "sus2", "dim", "aug"],
  2: ["", "7", "maj7", "sus4", "sus2", "dim", "aug"],
  3: ["m", "m7", "dim", "aug"],
  4: ["", "maj7", "7", "sus4", "sus2", "dim", "aug"],
  5: ["m", "m7", "dim", "aug"],
};

function noteByOffset(root, semitones) {
  return noteNames[((noteOffsets[root] + semitones) % 12 + 12) % 12];
}

function buildChordName(root, quality) {
  return root + quality;
}

function buildChordStrings(root, quality) {
  const rootMidi = 48 + noteOffsets[root];
  const intervals = chordQualityIntervals[quality] || chordQualityIntervals[""];
  return intervals.map((interval) => midiToNote(rootMidi + interval));
}

function buildChordMap() {
  return Object.fromEntries(noteNames.map((key) => {
    const rows = [];
    for (const finger of [1, 2, 3, 4, 5]) {
      const root = noteByOffset(key, fingerDegreeOffsets[finger]);
      for (const quality of fingerQualityMap[finger]) {
        const chord = buildChordName(root, quality);
        rows.push({ finger, chord, quality, root, strings: buildChordStrings(root, quality) });
      }
    }
    return [key, rows];
  }));
}

chordMap = buildChordMap();
const sampleInstruments = {
  guitar: {
    label: "吉他",
    soundfont: "acoustic_guitar_nylon",
    base: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3",
  },
  electric: {
    label: "电吉他",
    soundfont: "electric_guitar_clean",
    base: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_guitar_clean-mp3",
  },
  piano: {
    label: "钢琴",
    soundfont: "acoustic_grand_piano",
    base: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3",
  },
  tinbox: {
    label: "半岛铁盒",
    synth: true,
  },
  glassbell: {
    label: "玻璃铃",
    synth: true,
    voice: "glassbell",
  },
  celeste: {
    label: "星光琴",
    synth: true,
    voice: "celeste",
  },
  violin: {
    label: "小提琴",
    soundfont: "violin",
    base: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/violin-mp3",
  },
};
const sharpToFlat = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };

// MG Soft Nylon Guitar (Lite) - Pianobook, DecentSampler 解析得到的 zone 映射
const LOCAL_GUITAR_BASE = "samples/mg-nylon";
const LOCAL_GUITAR_ZONES = [
  { rootNote: 40, loNote: 38, hiNote: 40, file: "MG_NylonGuitar_E1" },
  { rootNote: 43, loNote: 41, hiNote: 43, file: "MG_NylonGuitar_G1" },
  { rootNote: 49, loNote: 44, hiNote: 49, file: "MG_NylonGuitar_C%232" },
  { rootNote: 52, loNote: 50, hiNote: 52, file: "MG_NylonGuitar_E2" },
  { rootNote: 55, loNote: 53, hiNote: 55, file: "MG_NylonGuitar_G2" },
  { rootNote: 58, loNote: 56, hiNote: 58, file: "MG_NylonGuitar_A%232" },
  { rootNote: 61, loNote: 59, hiNote: 61, file: "MG_NylonGuitar_C%233" },
  { rootNote: 64, loNote: 62, hiNote: 64, file: "MG_NylonGuitar_E3" },
  { rootNote: 67, loNote: 65, hiNote: 67, file: "MG_NylonGuitar_G3" },
];
let rrIndex = 0;
let localGuitarReady = false;
const localGuitarCache = new Map();
const RJS_ELECTRIC_BASE = "samples/rjs-electric";
const RJS_ELECTRIC_ZONES = [
  { rootNote: 40, loNote: 38, hiNote: 41, file: "E2" },
  { rootNote: 43, loNote: 42, hiNote: 44, file: "G2" },
  { rootNote: 45, loNote: 45, hiNote: 47, file: "A2" },
  { rootNote: 48, loNote: 48, hiNote: 49, file: "C3" },
  { rootNote: 50, loNote: 50, hiNote: 51, file: "D3" },
  { rootNote: 52, loNote: 52, hiNote: 54, file: "E3" },
  { rootNote: 55, loNote: 55, hiNote: 57, file: "G3" },
  { rootNote: 57, loNote: 58, hiNote: 69, file: "A3" },
];
let rjsElectricReady = false;
const rjsElectricCache = new Map();
const CHORD_STRUM_BASE = "samples/chord-strums";
const CHORD_STRUM_FILES = {};
const chordStrumCache = new Map();
const customChordSamples = new Map();
const customFingerSamples = new Map();
let chordSearchQuery = "";
let warmupPromise = null;
let chordSwitchDelayMs = 150;
let switchTimerId = null;
let drumTouchEnabled = true;
let drumTouchInsideSince = 0;
let drumTouchCooldownUntil = 0;
let drumTouchSizePx = Number(localStorage.getItem("airGuitarDrumTouchSize") || 80);

function noteToMidi(note) {
  const match = note.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return 60;
  const [, name, octaveText] = match;
  return (Number(octaveText) + 1) * 12 + noteOffsets[name];
}

function findLocalZone(midi) {
  const exact = LOCAL_GUITAR_ZONES.find((z) => midi >= z.loNote && midi <= z.hiNote);
  if (exact) return exact;
  let closest = LOCAL_GUITAR_ZONES[0];
  let bestDiff = Math.abs(midi - closest.rootNote);
  for (const zone of LOCAL_GUITAR_ZONES) {
    const diff = Math.abs(midi - zone.rootNote);
    if (diff < bestDiff) { bestDiff = diff; closest = zone; }
  }
  return closest;
}

function findRjsElectricZone(midi) {
  const exact = RJS_ELECTRIC_ZONES.find((z) => midi >= z.loNote && midi <= z.hiNote);
  if (exact) return exact;
  let closest = RJS_ELECTRIC_ZONES[0];
  let bestDiff = Math.abs(midi - closest.rootNote);
  for (const zone of RJS_ELECTRIC_ZONES) {
    const diff = Math.abs(midi - zone.rootNote);
    if (diff < bestDiff) { bestDiff = diff; closest = zone; }
  }
  return closest;
}

async function loadRjsElectricSample(zone, velocitySlot) {
  const slot = Math.max(1, Math.min(7, velocitySlot));
  const cacheKey = `${zone.file}_vel${slot}`;
  if (rjsElectricCache.has(cacheKey)) return rjsElectricCache.get(cacheKey);
  const ctx = ensureAudio();
  const promise = fetch(`${RJS_ELECTRIC_BASE}/${zone.file}_vel${slot}.wav`)
    .then((response) => {
      if (!response.ok) throw new Error(`rjs electric ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer));
  rjsElectricCache.set(cacheKey, promise);
  return promise;
}

async function loadLocalGuitarSample(zone, rrSlot) {
  const cacheKey = `${zone.file}_RR${rrSlot}`;
  if (localGuitarCache.has(cacheKey)) return localGuitarCache.get(cacheKey);
  const ctx = ensureAudio();
  const url = `${LOCAL_GUITAR_BASE}/${zone.file}_RR${rrSlot}.wav`;
  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`local ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer));
  localGuitarCache.set(cacheKey, promise);
  return promise;
}

async function loadChordStrumSample(chordName, kind = "strum") {
  const custom = customChordSamples.get(chordName);
  if (custom) return custom.buffer;
  const entry = CHORD_STRUM_FILES[chordName]?.[kind] || CHORD_STRUM_FILES[chordName]?.strum;
  if (!entry) return null;
  const cacheKey = `${chordName}:${kind}`;
  if (chordStrumCache.has(cacheKey)) return chordStrumCache.get(cacheKey);
  const ctx = ensureAudio();
  const promise = fetch(`${CHORD_STRUM_BASE}/${entry}`)
    .then((response) => {
      if (!response.ok) throw new Error(`chord strum ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer));
  chordStrumCache.set(cacheKey, promise);
  return promise;
}

let audioContext;
let masterGain;
let isPlaying = false;
let currentFinger = null;
let pendingFinger = null;
let selectedKey = "C";
let selectedInstrument = "guitar";
let playMode = "strum";
let selectedRhythm = "cardigan";
let selectedDrumRhythm = "drum_standard";
let capoSemitones = 0;
let drumsEnabled = true;
let mutedStrum = false;
let spreadEnabled = true;
let randomVelocity = true;
let activeProgression = [];
let schedulerId = null;
let stepIndex = 0;
let nextStepTime = 0;
let lastStableCandidate = null;
let stableSince = 0;
let lastGestureSeenAt = 0;
let handCamera = null;
let handsModel = null;
let faceModel = null;
let faceFrameCounter = 0;
let faceBusy = false;
let rhythmUrl = null;
let autoHoldEnabled = false;
let cameraActive = false;
let stageFxEnabled = false;
let glassTheme = "dark";
let lastConfirmedFinger = null;
let lastConfirmedAt = 0;
let customMelodyEnabled = false; // 用户自定义走向开关

// ── 吉他标准调弦空弦音（弦号 1=高音E .. 6=低音E）──
const OPEN_STRINGS = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

// 从弦位直接取该和弦在该弦上的实际音
// 逻辑：从空弦音往上找第一个属于和弦构成音的音
function getStringNoteForChord(chord, stringNumber) {
  const strings = chord.strings || [];
  if (!strings.length) return OPEN_STRINGS[stringNumber - 1] || 'C4';
  // 和弦构成音的音名集合（不含八度）
  const chordPitchClasses = new Set(strings.map(n => noteToMidi(n) % 12));
  const openNote = OPEN_STRINGS[stringNumber - 1];
  const openMidi = noteToMidi(openNote);
  // 从空弦音往上找第一个属于和弦的音（半音递增，最多3个八度）
  for (let midi = openMidi; midi <= openMidi + 24; midi++) {
    if (chordPitchClasses.has(midi % 12)) {
      return midiToNote(midi);
    }
  }
  // fallback：从 chord.strings 里找最接近空弦音的
  let best = strings[0];
  let bestDiff = Infinity;
  for (const n of strings) {
    const diff = Math.abs(noteToMidi(n) - openMidi);
    if (diff < bestDiff) { bestDiff = diff; best = n; }
  }
  return best;
}

// 默认自定义走向：第一个元素是"根音键"语义，其余是绝对弦号。
const defaultStringProgression = [5, 3, 2, 3, 1, 3, 2, 3];
let customProgression = defaultStringProgression.slice();
let customEditing = false;

// ── 开放和弦根音弦号速查表（吉他标准调弦 EADGBE，弦号 1=高音e .. 6=低音E）──
// 洞察：53231323 里的 "5" 是根音弦，不是绝对弦号
//   C/Cm → 5弦, D/Dm → 4弦, E/Em/F/Fm/G/Gm → 6弦, A/Am/B/Bm → 5弦
const CHORD_ROOT_STRING = {
  'C': 5, 'Cm': 5, 'C7': 5, 'Cmaj7': 5,
  'D': 4, 'Dm': 4, 'D7': 4, 'Dsus4': 4,
  'E': 6, 'Em': 6, 'E7': 6,
  'F': 6, 'Fm': 6, 'Fmaj7': 6, 'F#m': 6,
  'G': 6, 'Gm': 6, 'G7': 6,
  'A': 5, 'Am': 5, 'A7': 5,
  'B': 5, 'Bm': 5, 'B7': 5,
};
function getRootStringForChord(chordName) {
  var clean = String(chordName || 'C').trim();
  // 先精确匹配
  if (CHORD_ROOT_STRING[clean] !== undefined) return CHORD_ROOT_STRING[clean];
  // 取根音匹配（Cmaj7 → C, Dm7 → Dm → D）
  var rootMatch = clean.match(/^([A-G][#b]?)/);
  var root = rootMatch ? (noteNames[noteOffsets[rootMatch[1]]] || rootMatch[1]) : 'C';
  if (CHORD_ROOT_STRING[root] !== undefined) return CHORD_ROOT_STRING[root];
  if (root === 'C' || root === 'C#' || root === 'A' || root === 'A#' || root === 'B') return 5;
  if (root === 'D' || root === 'D#') return 4;
  if (root === 'E' || root === 'F' || root === 'F#' || root === 'G' || root === 'G#') return 6;
  // 再试 root+m
  var rootM = clean.match(/^([A-G][#b]?m)/);
  if (rootM && CHORD_ROOT_STRING[rootM[1]] !== undefined) return CHORD_ROOT_STRING[rootM[1]];
  return 5;
}

// 相对偏移模板：相对于根音弦的偏移量
// 基准：根音弦=5 → [5,3,2,3,1,3,2,3]
// 根音弦=4 → [4,2,1,2,1(clamp),2,1,2]
// 根音弦=6 → [6,4,3,4,2,4,3,4]
function adaptProgressionToChord(prog, chordName) {
  var root = getRootStringForChord(chordName);
  return prog.map(function(stringNumber) {
    return stringNumber === 5 ? root : Math.max(1, Math.min(6, stringNumber));
  });
}
let scoreTrack = {
  enabled: false,
  events: [],
  chords: [],
  title: "",
};
const sampleCache = new Map();

const lookaheadMs = 8;
const scheduleAheadSeconds = 0.015;
const gestureStabilityMs = 10;
const releaseSeconds = 0.08;
const chordFadeSeconds = 0.018;
const gestureDropoutGraceMs = 120;
const autoHoldMs = 7000;

const camera = document.querySelector("#camera");
const videoWrap = document.querySelector(".video-wrap");
const cameraFallback = document.querySelector("#cameraFallback");
const handCanvas = document.querySelector("#handCanvas");
const faceCanvas = document.querySelector("#faceCanvas");
const gestureName = document.querySelector("#gestureName");
const activeChord = document.querySelector("#activeChord");
const detectStatus = document.querySelector("#detectStatus");
const gestureButtons = document.querySelector("#gestureButtons");
const clearCustomAudioBtn = document.querySelector("#clearCustomAudioBtn");
const modeButtons = document.querySelector("#patternButtons");
const playBtn = document.querySelector("#playBtn");
const cameraBtn = document.querySelector("#cameraBtn");
const autoBtn = document.querySelector("#autoBtn");
const sparkBtn = document.querySelector("#sparkBtn");
const themeSwitch = document.querySelector("#themeSwitch");
const bpm = document.querySelector("#bpm");
const bpmValue = document.querySelector("#bpmValue");
const keySelect = document.querySelector("#keySelect");
const keyLabel = document.querySelector("#keyLabel");
const instrumentSelect = document.querySelector("#instrumentSelect");
const sampleStatus = document.querySelector("#sampleStatus");
const capo = document.querySelector("#capo");
const capoValue = document.querySelector("#capoValue");
const rhythmSelect = document.querySelector("#rhythmSelect");
const drumRhythmSelect = document.querySelector("#drumRhythmSelect");
const drumToggle = document.querySelector("#drumToggle");
const muteToggle = document.querySelector("#muteToggle");
const spreadToggle = document.querySelector("#spreadToggle");
const randomToggle = document.querySelector("#randomToggle");
const humanizeLabel = document.querySelector("#humanizeLabel");
const drumTouchToggle = document.querySelector("#drumTouchToggle");
const drumTouchZone = document.querySelector("#drumTouchZone");
const chordSwitchDelay = document.querySelector("#chordSwitchDelay");
const chordSwitchDelayValue = document.querySelector("#chordSwitchDelayValue");
const drumTouchSize = document.querySelector("#drumTouchSize");
const settingsFab = document.querySelector("#settingsFab");
const controlsOverlay = document.querySelector("#controlsOverlay");
const sixMinorBtn = document.querySelector("#sixMinorBtn");
const sevenDimBtn = document.querySelector("#sevenDimBtn");
const progressionInput = document.querySelector("#progressionInput");
const progressionStrip = document.querySelector("#progressionStrip");
const quickChordRows = document.querySelector("#quickChordRows");
const clearProgressionBtn = document.querySelector("#clearProgressionBtn");
const progressionPresetSelect = document.querySelector("#progressionPresetSelect");
const mappingText = document.querySelector("#mappingText");
const bindingPanel = document.querySelector(".binding-panel");
const rhythmUpload = document.querySelector("#rhythmUpload");
const rhythmAudio = document.querySelector("#rhythmAudio");
const rhythmBtn = document.querySelector("#rhythmBtn");
const clearRhythmBtn = document.querySelector("#clearRhythmBtn");
const rhythmStatus = document.querySelector("#rhythmStatus");
const chordImageUpload = document.querySelector("#chordImageUpload");
const chordImageStatus = document.querySelector("#chordImageStatus");
const scoreImageUpload = document.querySelector("#scoreImageUpload");
const scoreImageStatus = document.querySelector("#scoreImageStatus");
const scorePlayBtn = document.querySelector("#scorePlayBtn");
const scoreClearBtn = document.querySelector("#scoreClearBtn");
const liveGesturePalette = document.querySelector("#liveGesturePalette");
const beatMeter = document.querySelector("#beatMeter");
const effectsLayer = document.querySelector("#effectsLayer");
const canvasCtx = handCanvas.getContext("2d");
const faceCtx = faceCanvas?.getContext("2d");
document.body.dataset.theme = glassTheme;

function setSampleStatus(text) {
  if (sampleStatus) sampleStatus.textContent = text;
}

function updateThemeSwitch() {
  themeSwitch?.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeChoice === glassTheme);
  });
}

const STORAGE_KEY = "airGuitarGestureBindings.v5";
const chordOptionRoots = [...noteNames, "Db", "Eb", "Gb", "Ab", "Bb"];
const CHORD_OPTIONS = ["", ...chordOptionRoots.flatMap((root) => chordQualityList.map((quality) => root + quality))];
const QUICK_CHORD_ROWS = [
  ["C", "Cm", "D", "Dm", "E", "Em", "F", "Fm", "G", "Gm", "A", "Am"],
  ["C7", "Cmaj7", "D7", "Dm7", "E7", "Em7", "F7", "Fmaj7", "G7", "Gmaj7", "A7", "Am7"],
];
const PROGRESSION_PRESETS = [
  ["", "选择模板"],
  ["C G Am Em F C F G", "卡农万用"],
  ["C G Am F", "流行 1-5-6-4"],
  ["C Am F G", "民谣经典"],
  ["C F G C", "摇滚力量"],
  ["Am F C G", "悲伤小调"],
  ["Dm G7 Cmaj7", "爵士 2-5-1"],
  ["C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7", "Blues 12 小节"],
  ["C G Am F", "雷鬼反拍"],
  ["Am7 Dm7 G7 Cmaj7", "R&B 灵魂"],
  ["G D Em C", "民谣抒情"],
  ["E A B A", "经典摇滚"],
  ["F G Em Am", "K-Pop 标配"],
  ["G C D G", "乡村民谣"],
  ["C Am F G", "50年代 doo-wop"],
  ["C Dm7 Em7 Fmaj7", "日本流行"],
  ["Am7 Em7 Dm7 Cmaj7", "Lofi 嘻哈"],
];
const DEFAULT_GESTURE_BINDINGS = {
  1: "C",
  2: "G",
  3: "Am",
  4: "F",
  5: "Em",
};
const GESTURE_GUIDE = [
  { id: 1, name: "食指", detail: "伸出食指" },
  { id: 2, name: "二", detail: "食指 + 中指" },
  { id: 3, name: "三", detail: "食指 + 中指 + 无名指" },
  { id: 4, name: "四", detail: "四指伸开，拇指收" },
  { id: 5, name: "五", detail: "五指张开" },
];
let gestureBindings = loadGestureBindings();

function transposeChordName(name, semitones) {
  const clean = String(name || "").trim();
  const match = normalizeChordSymbol(clean).match(/^([A-G][b#]?)(.*)$/);
  if (!match) return clean;
  const root = noteOffsets[match[1]];
  if (root === undefined) return clean;
  return noteNames[((root + semitones) % 12 + 12) % 12] + match[2];
}

function transposeChord(chordName, fromKey, toKey) {
  const from = noteOffsets[fromKey] ?? 0;
  const to = noteOffsets[toKey] ?? 0;
  return transposeChordName(chordName, to - from);
}

function transposeProgressionText(text, fromKey, toKey) {
  return String(text || "")
    .split(/(\s+|[,，|]+)/)
    .map((part) => {
      const chord = normalizeChordSymbol(part);
      return chord ? transposeChord(chord, fromKey, toKey) : part;
    })
    .join("")
    .trim();
}

function defaultBindingsForKey(key) {
  const rows = chordMap[key] || chordMap.C || [];
  return Object.fromEntries([1, 2, 3, 4, 5].map((finger) => [
    finger,
    rows.find((item) => item.finger === finger)?.chord || DEFAULT_GESTURE_BINDINGS[finger],
  ]));
}

function resetGestureBindingsForKey() {
  gestureBindings = defaultBindingsForKey(selectedKey);
  saveGestureBindings();
}

function effectiveKeyName() {
  return transposeChordName(selectedKey, capoSemitones);
}

function effectiveChordName(shapeName) {
  return transposeChordName(shapeName, capoSemitones);
}

function defaultProgressionForBindings() {
  return [1, 2, 3, 4].map((id) => gestureBindings[id]).filter(Boolean).join(" ");
}

function refreshProgressionForKey() {
  if (progressionInput) progressionInput.value = defaultProgressionForBindings();
}

function normalizeChordSymbol(raw) {
  const match = String(raw || "").trim().match(/^([A-G])([#b]?)(.*)$/i);
  if (!match) return "";
  const rawRoot = match[1].toUpperCase() + match[2];
  const root = noteNames[noteOffsets[rawRoot]] || rawRoot;
  const suffixRaw = match[3].replace(/\s+/g, "");
  const suffixMap = {
    M7: "maj7",
    MAJ7: "maj7",
    Maj7: "maj7",
    m7: "m7",
    M: "",
    m: "m",
    MIN: "m",
    min: "m",
    DIM: "dim",
    dim: "dim",
    AUG: "aug",
    aug: "aug",
    "7": "7",
    sus2: "sus2",
    sus4: "sus4",
  };
  const suffix = Object.prototype.hasOwnProperty.call(suffixMap, suffixRaw) ? suffixMap[suffixRaw] : suffixRaw;
  return root + suffix;
}

function extractChordsFromText(text) {
  const normalized = String(text || "")
    .replace(/[｜|]/g, " ")
    .replace(/[（）()[\]{}]/g, " ")
    .replace(/([A-G])\s+(m|m7|maj7|M7|7|dim|aug|sus2|sus4)\b/gi, "$1$2");
  const chordPattern = /(^|[^A-Za-z0-9#b])([A-G](?:#|b)?(?:maj7|M7|m7|m|dim|aug|sus2|sus4|7)?)(?=$|[^A-Za-z0-9#b])/g;
  const found = [];
  let match;
  while ((match = chordPattern.exec(normalized))) {
    const chord = normalizeChordSymbol(match[2]);
    if (CHORD_OPTIONS.includes(chord) && !found.includes(chord)) found.push(chord);
  }
  return found.slice(0, 5);
}

function applyRecognizedChords(chords) {
  if (!chords.length) return;
  chords.slice(0, 5).forEach((chord, index) => {
    gestureBindings[index + 1] = chord;
  });
  saveGestureBindings();
  if (progressionInput) progressionInput.value = chords.join(" ");
  renderControls();
  updateStatus();
  renderLyrics();
}

function parseScoreMeta(text) {
  const raw = String(text || "");
  const bpmMatch = raw.match(/(?:拍速|BPM|速度)\s*[:：]?\s*(\d{2,3})/i);
  const selectedMatch = raw.match(/(?:选调|调性)\s*[:：]?\s*([A-G][#b]?)/i) || raw.match(/([A-G][#b]?)\s*调/);
  const originalMatch = raw.match(/原唱调\s*[:：]?\s*([A-G][#b]?)/i);
  return {
    bpm: bpmMatch ? Math.max(50, Math.min(160, Number(bpmMatch[1]))) : null,
    selectedKey: selectedMatch ? selectedMatch[1].toUpperCase() : null,
    originalKey: originalMatch ? originalMatch[1].toUpperCase() : null,
  };
}

function applyScoreMeta(meta) {
  if (meta.selectedKey && noteOffsets[meta.selectedKey] !== undefined) {
    selectedKey = meta.selectedKey;
    if (keySelect) keySelect.value = selectedKey;
  }
  if (meta.originalKey && noteOffsets[meta.originalKey] !== undefined && meta.selectedKey && noteOffsets[meta.selectedKey] !== undefined) {
    capoSemitones = (noteOffsets[meta.originalKey] - noteOffsets[meta.selectedKey] + 12) % 12;
    capoSemitones = Math.min(5, capoSemitones);
    if (capo) capo.value = String(capoSemitones);
  }
  if (meta.bpm && bpm && bpmValue) {
    bpm.value = String(meta.bpm);
    bpmValue.textContent = bpm.value;
  }
}

function extractScoreNotes(text) {
  const musicText = String(text || "")
    .split(/\n+/)
    .filter((line) => !/(拍号|拍速|选调|原唱调|Captured|Longshot|http|www)/i.test(line))
    .join("\n");
  const cleaned = musicText
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[A-G](?:#|b)?(?:maj7|M7|m7|m|dim|sus2|sus4|add9|7|6|9)?/g, " ")
    .replace(/拍号|拍速|选调|原唱调|主歌|副歌|前奏|结尾|编|唱/g, " ");
  const tokens = cleaned.match(/[0-7]|[-－—]/g) || [];
  const events = [];
  tokens.forEach((token) => {
    if (events.length >= 192) return;
    if (token === "-" || token === "－" || token === "—") events.push({ type: "hold" });
    else if (token === "0") events.push({ type: "rest" });
    else events.push({ type: "note", degree: Number(token) });
  });
  return events;
}

function noteFromScaleDegree(degree, octave = 4) {
  const rootMidi = (octave + 1) * 12 + (noteOffsets[selectedKey] || 0);
  return midiToNote(rootMidi + majorScale[Math.max(1, Math.min(7, degree)) - 1]);
}

function applyRecognizedScore(text) {
  const chords = extractChordsFromText(text);
  const events = extractScoreNotes(text);
  const meta = parseScoreMeta(text);
  if (chords.length) applyRecognizedChords(chords);
  applyScoreMeta(meta);
  scoreTrack = {
    enabled: Boolean(events.length),
    events,
    chords,
    title: "上传谱子",
  };
  if (scorePlayBtn) {
    scorePlayBtn.disabled = !events.length;
    scorePlayBtn.classList.toggle("active", scoreTrack.enabled);
    scorePlayBtn.textContent = scoreTrack.enabled ? "谱子模式开" : "谱子模式";
  }
  if (scoreClearBtn) scoreClearBtn.disabled = !events.length;
  renderControls();
  updateStatus();
  renderLyrics();
  return { chords, events, meta };
}

function loadGestureBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(
      GESTURE_GUIDE.map((gesture) => [
        gesture.id,
        Object.prototype.hasOwnProperty.call(saved, gesture.id) ? saved[gesture.id] : defaultBindingsForKey(selectedKey)[gesture.id],
      ])
    );
  } catch {
    return defaultBindingsForKey(selectedKey);
  }
}

function saveGestureBindings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(
    GESTURE_GUIDE.map((gesture) => [gesture.id, gestureBindings[gesture.id]])
  )));
}

function chordNameToMidi(name) {
  const match = String(name).trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return 48;
  return 48 + noteOffsets[match[1]];
}

function chordNameToNotes(name) {
  const clean = normalizeChordSymbol(name);
  const match = clean.match(/^([A-G][b#]?)(maj7|m7|sus4|sus2|dim|aug|m|7)?(?:\/([A-G][b#]?))?$/);
  if (!match) return chordNameToNotes("C");
  const [, root, quality = "", bass] = match;
  const rootMidi = 48 + noteOffsets[root];
  const strings = (chordQualityIntervals[quality] || chordQualityIntervals[""]).map((interval) => midiToNote(rootMidi + interval));
  if (bass && noteOffsets[bass] !== undefined) strings[0] = midiToNote(36 + noteOffsets[bass]);
  return strings;
}

function getChordByName(name) {
  const chord = normalizeChordSymbol(name) || "C";
  return { chord, token: chord, strings: chordNameToNotes(chord) };
}

function chordParts(chordName) {
  const clean = normalizeChordSymbol(chordName);
  const match = clean.match(/^([A-G][#b]?)(maj7|m7|sus4|sus2|dim|aug|m|7)?/);
  if (!match) return null;
  return { root: noteNames[noteOffsets[match[1]]], quality: match[2] || "", chord: clean };
}

function compatibleChordQuality(inputQuality, mapQuality) {
  if (inputQuality === mapQuality) return true;
  if (["maj7", "7", "sus4", "sus2", "dim", "aug"].includes(inputQuality) && mapQuality === "") return true;
  if (["m7", "dim", "aug"].includes(inputQuality) && mapQuality === "m") return true;
  return false;
}

function findChordFingerInKey(chordName, key = selectedKey) {
  const wanted = chordParts(chordName);
  if (!wanted) return null;
  const rows = chordMap[key] || [];
  const exact = rows.find((item) => item.chord === wanted.chord);
  if (exact) return exact.finger;
  const fallback = rows.find((item) => (
    item.root === wanted.root && compatibleChordQuality(wanted.quality, item.quality)
  ));
  return fallback ? fallback.finger : null;
}

function findGestureForChord(chordName) {
  const wanted = normalizeChordSymbol(chordName).toLowerCase();
  const found = Object.entries(gestureBindings).find(([, chord]) => normalizeChordSymbol(chord).toLowerCase() === wanted);
  if (found) return Number(found[0]);
  return findChordFingerInKey(chordName);
}

function syncGestureBindingsFromProgression() {
  const tokens = (progressionInput?.value || "").split(/[\s,，|]+/).map(normalizeChordSymbol).filter(Boolean);
  const next = { ...defaultBindingsForKey(selectedKey) };
  const used = new Set();
  tokens.forEach((token) => {
    const finger = findChordFingerInKey(token);
    if (finger && finger <= 5) {
      next[finger] = token;
      used.add(finger);
      return;
    }
    const fallbackFinger = [1, 2, 3, 4, 5].find((id) => !used.has(id));
    if (fallbackFinger) {
      next[fallbackFinger] = token;
      used.add(fallbackFinger);
    }
  });
  gestureBindings = next;
  saveGestureBindings();
}

function renderControls() {
  gestureButtons.innerHTML = [1, 2, 3, 4, 5, 6, 7].map((degree) => {
    const item = getDiatonicChord(degree);
    const gesture = degree <= 5 ? `${degree} 指` : "辅助";
    return `<button data-finger="${degree}"><span>${degree} 级</span><small>${gesture} · ${item.chord}</small></button>`;
  }).join("");

  if (sixMinorBtn) {
    const chord = getDiatonicChord(6);
    sixMinorBtn.innerHTML = `6m <small>${chord.chord}</small>`;
  }
  if (sevenDimBtn) {
    const chord = getDiatonicChord(7);
    sevenDimBtn.innerHTML = `7dim <small>${chord.chord}</small>`;
  }

  renderProgression();

  modeButtons.innerHTML = Object.entries(modeLabels).map(([id, label]) => (
    `<button class="secondary ${id === playMode ? "active" : ""}" data-mode="${id}">${label}</button>`
  )).join("");
  if (rhythmSelect && !rhythmSelect.children.length) {
    rhythmSelect.innerHTML = rhythmProfiles.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    rhythmSelect.value = selectedRhythm;
  }
  if (mappingText) {
    mappingText.textContent = [1, 2, 3, 4, 5, 6, 7]
      .map((degree) => `${degree}级 ${getDiatonicChord(degree).chord}`)
      .join(" · ");
  }
  if (keyLabel) keyLabel.textContent = `${selectedKey}调`;
  if (sampleStatus) setSampleStatus(sampleInstruments[selectedInstrument].label);
  if (capoValue) capoValue.textContent = String(capoSemitones);
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

async function warmupSamples() {
  const notes = [...new Set([
    ...[1, 2, 3, 4, 5, 6, 7].flatMap((degree) => getDiatonicChord(degree).strings),
    ...activeProgression.flatMap((item) => item.chord.strings),
  ].map(applyCapo))];
  if (selectedInstrument === "guitar") {
    setSampleStatus("加载本地尼龙吉他采样...");
    try {
      await Promise.all(
        LOCAL_GUITAR_ZONES.flatMap((zone) => [1, 2].map((rr) => loadLocalGuitarSample(zone, rr))),
      );
      localGuitarReady = true;
      setSampleStatus("本地尼龙吉他采样");
      return;
    } catch (err) {
      setSampleStatus("本地采样加载失败，回退 SoundFont");
    }
  }
  if (selectedInstrument === "electric") {
    setSampleStatus("加载 RJS 电吉他采样...");
    try {
      await Promise.all(RJS_ELECTRIC_ZONES.flatMap((zone) => [2, 4, 6].map((vel) => loadRjsElectricSample(zone, vel))));
      rjsElectricReady = true;
      setSampleStatus("RJS 电吉他采样");
      return;
    } catch {
      setSampleStatus("RJS 采样加载失败，回退 SoundFont");
    }
  }
  if (sampleInstruments[selectedInstrument]?.synth) {
    setSampleStatus(sampleInstruments[selectedInstrument].label + "合成音色");
    return;
  }
  setSampleStatus(`加载${sampleInstruments[selectedInstrument].label}采样...`);
  await Promise.all(notes.slice(0, 12).map((note) => loadSample(note, selectedInstrument).catch(() => null)));
  setSampleStatus(`${sampleInstruments[selectedInstrument].label}采样`);
}

function noteToFrequency(note) {
  const match = note.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return 440;
  const [, name, octaveText] = match;
  const octave = Number(octaveText);
  const midi = (octave + 1) * 12 + noteOffsets[name];
  return 440 * (2 ** ((midi - 69) / 12));
}

function frequencyToNote(freq) {
  const midi = Math.round(69 + (12 * Math.log2(freq / 440)));
  return midiToNote(midi);
}

function midiToNote(midi) {
  return `${noteNames[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function shiftOctave(note, octaves) {
  const match = String(note).match(/^([A-G][b#]?)(\d)$/);
  if (!match) return note;
  return match[1] + (Number(match[2]) + octaves);
}

function transposeNote(note, semitones) {
  if (!semitones) return note;
  return frequencyToNote(noteToFrequency(note) * (2 ** (semitones / 12)));
}

function applyCapo(note) {
  return transposeNote(note, capoSemitones);
}

function sampleNoteName(note) {
  const match = note.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return note;
  const [, name, octave] = match;
  return `${sharpToFlat[name] || name}${octave}`;
}

function playDecodedBuffer(buffer, start, gainValue = 0.72, duration = null) {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const t = Math.max(start, now + 0.004);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const playDuration = Math.min(duration || buffer.duration, buffer.duration);
  source.buffer = buffer;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.min(0.85, gainValue), t + 0.012);
  gain.gain.setTargetAtTime(0.0001, t + Math.max(0.1, playDuration * 0.88), 0.12);
  source.connect(gain).connect(masterGain);
  source.start(t);
  source.stop(t + playDuration + 0.18);
}

async function loadSample(note, instrument = selectedInstrument) {
  const ctx = ensureAudio();
  if (sampleInstruments[instrument]?.synth) return null;
  const sfNote = sampleNoteName(note);
  const cacheKey = `${instrument}:${sfNote}`;
  if (sampleCache.has(cacheKey)) return sampleCache.get(cacheKey);

  const source = sampleInstruments[instrument];
  const url = `${source.base}/${sfNote}.mp3`;
  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`sample ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer));
  sampleCache.set(cacheKey, promise);
  return promise;
}

function getChordForFinger(finger) {
  const progressionChord = activeProgression.find((item) => item.gestureDegree === finger);
  return progressionChord?.chord || getDiatonicChord(finger);
}

function getDiatonicChord(degree) {
  return degreeToChord({ token: String(degree), degree, quality: defaultQualityForDegree(degree), bassDegree: null });
}

function parseDegree(token) {
  const clean = token.trim();
  const match = clean.match(/^([1-7])([^\s/]*)?(?:\/([1-7b#]+))?/i);
  if (!match) return null;
  const degree = Number(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  let quality = defaultQualityForDegree(degree);
  if (suffix.includes("dim")) quality = "dim";
  else if (suffix.includes("maj7") || suffix.includes("ma7") || suffix.includes("ma")) quality = "maj7";
  else if (suffix.includes("m")) quality = "m";
  else if (suffix.includes("7")) quality = "7";
  return { token: clean, degree, quality, bassDegree: match[3] || null };
}

function defaultQualityForDegree(degree) {
  if ([2, 3, 6].includes(degree)) return "m";
  if (degree === 7) return "dim";
  return "";
}

function degreeToChord(parsed) {
  const rootMidi = 48 + noteOffsets[selectedKey];
  const degreeIndex = parsed.degree - 1;
  const chordRoot = rootMidi + majorScale[degreeIndex];
  const intervalsByQuality = {
    "": [0, 4, 7, 12, 16, 19],
    m: [0, 3, 7, 12, 15, 19],
    dim: [0, 3, 6, 12, 15, 18],
    7: [0, 4, 7, 10, 12, 16],
    maj7: [0, 4, 7, 11, 12, 16],
  };
  const intervals = intervalsByQuality[parsed.quality] || intervalsByQuality[defaultQualityForDegree(parsed.degree)];
  const strings = intervals.map((interval) => frequencyToNote(440 * (2 ** (((chordRoot + interval) - 69) / 12))));
  if (parsed.bassDegree) {
    const bass = degreeBassToNote(parsed.bassDegree);
    if (bass) strings[0] = bass;
  }
  const rootName = strings[0].replace(/\d$/, "");
  const chordRootName = midiToNote(chordRoot).replace(/\d$/, "");
  const qualityLabel = parsed.quality === "m" ? "m" : parsed.quality === "dim" ? "dim" : parsed.quality === "maj7" ? "maj7" : parsed.quality === "7" ? "7" : "";
  return {
    finger: parsed.degree,
    degree: parsed.degree,
    token: parsed.token,
    chord: `${chordRootName}${qualityLabel}${parsed.bassDegree ? "/" + rootName : ""}`,
    strings,
  };
}

function degreeBassToNote(raw) {
  const match = String(raw).match(/^([1-7])/);
  if (!match) return null;
  const rootMidi = 36 + noteOffsets[selectedKey];
  return midiToNote(rootMidi + majorScale[Number(match[1]) - 1]);
}

function parseProgression() {
  const tokens = (progressionInput?.value || "1 5 6m 4 5").split(/[\s,，|]+/).filter(Boolean);
  activeProgression = tokens.map(parseDegree).filter(Boolean).map((parsed, index) => ({
    ...parsed,
    index,
    gestureDegree: parsed.degree,
    chord: degreeToChord(parsed),
  }));
  if (!activeProgression.length) {
    activeProgression = ["1", "5", "6m", "4", "5"].map(parseDegree).map((parsed, index) => ({
      ...parsed,
      index,
      gestureDegree: parsed.degree,
      chord: degreeToChord(parsed),
    }));
  }
}

function renderProgression() {
  parseProgression();
  if (!progressionStrip) return;
  const activeDegree = currentFinger || pendingFinger;
  progressionStrip.innerHTML = activeProgression.map((item) => (
    `<span class="${item.gestureDegree === activeDegree ? "active" : ""}">
      <strong>${item.token}</strong>
      <em>摆${item.gestureDegree}</em>
      <small>${item.chord.chord}</small>
    </span>`
  )).join("");
}

function setPendingFinger(finger) {
  if (finger == null && autoHoldEnabled && lastConfirmedFinger && performance.now() - lastConfirmedAt < autoHoldMs) {
    pendingFinger = lastConfirmedFinger;
    currentFinger = lastConfirmedFinger;
    updateStatus();
    return;
  }
  pendingFinger = finger;
  if (finger == null) {
    if (switchTimerId) {
      clearTimeout(switchTimerId);
      switchTimerId = null;
    }
    currentFinger = null;
    stopChordLoop();
  } else if (isPlaying && currentFinger !== finger) {
    if (switchTimerId) clearTimeout(switchTimerId);
    if (chordSwitchDelayMs <= 0) switchFingerNow(finger);
    else {
      switchTimerId = setTimeout(() => {
        switchTimerId = null;
        if (pendingFinger === finger && isPlaying) switchFingerNow(finger);
      }, chordSwitchDelayMs);
    }
  }
  updateStatus();
}

function switchFingerNow(finger) {
  const ctx = ensureAudio();
  currentFinger = finger;
  pendingFinger = finger;
  lastConfirmedFinger = finger;
  lastConfirmedAt = performance.now();
  stopChordLoop();
  nextStepTime = Math.min(nextStepTime, ctx.currentTime + 0.004);
  const chord = getChordForFinger(finger);
  if (!chord) return;
  const customFinger = customFingerSamples.get(finger);
  if (customFinger) {
    playDecodedBuffer(customFinger.buffer, ctx.currentTime + 0.003, 0.76);
    return;
  }
  const profile = getRhythmProfile();
  if (scoreTrack.enabled && scoreTrack.events.length) {
    scheduleScoreStep(chord, ctx.currentTime + 0.003, stepIndex, (60 / Number(bpm.value)) / 4);
    return;
  }
  if (playMode === "strum") {
    if (!playChordStrum(chord, ctx.currentTime, "strum")) {
      scheduleStrum(chord, ctx.currentTime + 0.003, stepIndex);
    }
  } else if (playMode === "arp") {
    if (!playChordStrum(chord, ctx.currentTime, "arp", 0.54)) {
      const stepDuration = (60 / Number(bpm.value)) / 2;
      scheduleArp(chord, ctx.currentTime + 0.003, stepIndex, stepDuration);
    }
  }
}

function applyPendingFinger() {
  if (currentFinger === pendingFinger) return;
  const profile = getRhythmProfile();
  currentFinger = pendingFinger;
  stopChordLoop();
  updateStatus();
}

function updateStatus() {
  const chord = getChordForFinger(currentFinger || pendingFinger);
  gestureName.textContent = currentFinger ? `${currentFinger} 级手势` : pendingFinger ? `${pendingFinger} 级待切换` : "无手势";
  activeChord.textContent = chord?.chord || "--";
  document.querySelectorAll("[data-finger]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.finger) === (currentFinger || pendingFinger));
  });
  renderProgression();
}

async function togglePlay() {
  const ctx = ensureAudio();
  if (ctx.state === "suspended") {
    setSampleStatus("正在开启音频...");
    await ctx.resume();
  }

  if (!isPlaying) {
    playBtn.disabled = true;
    playBtn.textContent = "采样加载中...";
    setSampleStatus("采样加载中...");
    try {
      warmupPromise ||= warmupSamples();
      await warmupPromise;
    } catch {
      setSampleStatus("采样失败/兜底");
    } finally {
      warmupPromise = null;
      playBtn.disabled = false;
    }
    isPlaying = true;
    stepIndex = 0;
    nextStepTime = ctx.currentTime + 0.05;
    if (!currentFinger && !pendingFinger) setPendingFinger(lastConfirmedFinger || 1);
    schedulerId = setInterval(scheduleAudio, lookaheadMs);
    playBtn.textContent = "停止演奏";
  } else {
    isPlaying = false;
    clearInterval(schedulerId);
    schedulerId = null;
    currentFinger = null;
    pendingFinger = null;
    stopChordLoop();
    fadeMaster(ctx.currentTime, releaseSeconds);
    playBtn.textContent = "开始演奏";
    updateStatus();
  }
}

function fadeMaster(start, duration) {
  if (!masterGain) return;
  masterGain.gain.cancelScheduledValues(start);
  masterGain.gain.setTargetAtTime(0.0001, start, duration / 3);
  masterGain.gain.setTargetAtTime(0.9, start + duration + 0.03, 0.04);
}

function humanizeStep(step, baseGain, options = {}) {
  if (!randomVelocity) {
    return { gain: baseGain, timeOffset: 0, ghost: false };
  }
  const modulo = options.modulo || 8;
  const downbeat = step % 4 === 0;
  const weak = step % modulo === 3 || step % modulo === 7;
  const contour = 1 + Math.sin(step * 0.22) * 0.08;
  const velocity = 0.85 + Math.random() * 0.3;
  const ghost = !downbeat && Math.random() < 0.12;
  const accent = downbeat ? 1.2 : weak ? 0.9 : 1;
  const timeOffset = (Math.random() - 0.5) * 0.03;
  return {
    gain: Math.min(0.85, baseGain * velocity * contour * accent * (ghost ? 0.26 : 1)),
    timeOffset,
    ghost,
  };
}

function playLayeredNote(note, start, gainValue, duration) {
  playSample(note, start, gainValue, duration);
  if (selectedInstrument === "piano" || selectedInstrument === "electric") {
    playSample(transposeNote(note, 12), start + 0.006, gainValue * 0.42, duration * 0.92);
    playSample(transposeNote(note, 7), start + 0.011, gainValue * 0.28, duration * 0.86);
  }
  if (selectedInstrument === "electric" && rjsElectricReady) {
    playSample(note, start + 0.005, gainValue * 0.24, duration * 0.72, 1.004);
  }
}

function scheduleAudio() {
  const ctx = ensureAudio();
  const profile = getRhythmProfile();
  const division = scoreTrack.enabled && scoreTrack.events.length ? 16 : (profile.division || 8);
  const stepDuration = (60 / Number(bpm.value)) / (division / 4);
  while (nextStepTime < ctx.currentTime + scheduleAheadSeconds) {
    applyPendingFinger();
    renderLyrics();

    if (currentFinger) {
      const chord = getChordForFinger(currentFinger);
      if (chord) {
        const customFinger = customFingerSamples.get(currentFinger);
        if (customFinger) {
          if (stepIndex % division === 0) playDecodedBuffer(customFinger.buffer, nextStepTime, 0.72);
        } else if (scoreTrack.enabled && scoreTrack.events.length) scheduleScoreStep(chord, nextStepTime, stepIndex, stepDuration); 
        else {
          if (playMode === "strum") scheduleStrum(chord, nextStepTime, stepIndex);
          if (playMode === "arp") scheduleArp(chord, nextStepTime, stepIndex, stepDuration);
  // 所有模式都走 scheduleTinboxMelody（内部判断 custom/半岛/关闭）
          scheduleCustomMelody(chord, nextStepTime, stepIndex, stepDuration);
        }
        if (stepIndex % (division === 16 ? 4 : 2) === 0) burstStageFx(chord.chord);
      }
    }
    if (drumsEnabled) scheduleDrums(nextStepTime, stepIndex, profile);
    updateBeatMeter(stepIndex);

    stepIndex += 1;
    nextStepTime += stepDuration + ((stepIndex % 2) ? profile.swing : -profile.swing);
  }
}

function getRhythmProfile() {
  return rhythmProfiles.find((item) => item.id === selectedRhythm) || rhythmProfiles[0];
}

function getDrumRhythmProfile() {
  return drumRhythmProfiles.find((item) => item.id === selectedDrumRhythm) || drumRhythmProfiles[0];
}

const synthVoices = {
  tinbox: { style: "tinbox", label: "半岛铁盒", body: "sine", overtone: "triangle", ratio: 2.003, filter: 2450, q: 0.7, presence: 820, boost: 3.5, delay: 0.145, feedback: 0.22, wet: 0.14, attack: 0.018, decay: 0.58, toneGain: 0.055, subGain: 0.08 },
  musicbox: { style: "musicbox", label: "八音盒", body: "sine", overtone: "square", ratio: 3.02, filter: 7200, q: 1.6, presence: 2600, boost: 6.8, delay: 0.21, feedback: 0.14, wet: 0.2, attack: 0.004, decay: 0.22, toneGain: 0.16, subGain: 0 },
  glassbell: { style: "glassbell", label: "玻璃铃", body: "triangle", overtone: "sine", ratio: 2.414, filter: 4300, q: 2.1, presence: 2200, boost: 6.5, delay: 0.23, feedback: 0.26, wet: 0.2, attack: 0.012, decay: 0.72, toneGain: 0.1, subGain: 0.025 },
  celeste: { style: "celeste", label: "星光琴", body: "triangle", overtone: "sine", ratio: 2.006, filter: 3900, q: 1.05, presence: 1450, boost: 4.8, delay: 0.18, feedback: 0.2, wet: 0.18, attack: 0.014, decay: 0.48, toneGain: 0.09, subGain: 0.025, detune: 8 },
  softpad: { style: "softpad", label: "柔光电钢", body: "sine", overtone: "triangle", ratio: 1.5, filter: 1350, q: 0.45, presence: 520, boost: 1.8, delay: 0.31, feedback: 0.36, wet: 0.2, attack: 0.038, decay: 1.05, toneGain: 0.075, subGain: 0.13, detune: -6 },
  mallet: { style: "mallet", label: "木槌琴", body: "triangle", overtone: "square", ratio: 2.01, filter: 3100, q: 0.8, presence: 980, boost: 3.8, delay: 0.12, feedback: 0.12, wet: 0.09, attack: 0.008, decay: 0.34, toneGain: 0.04, subGain: 0.055 },
};

function currentSynthVoice() {
  return synthVoices[sampleInstruments[selectedInstrument]?.voice || selectedInstrument] || synthVoices.tinbox;
}

function isTinboxFamilyInstrument() {
  return Boolean(sampleInstruments[selectedInstrument]?.synth);
}

function playSample(note, start, gainValue = 0.22, duration = 1.7, playbackRateOffset = 1) {
  const ctx = ensureAudio();

  if (sampleInstruments[selectedInstrument]?.synth) {
    playTinbox(note, start, gainValue, duration, currentSynthVoice());
    return;
  }

  const playSoundfont = () => {
    loadSample(note).then((buffer) => {
      const now = ctx.currentTime;
      if (start < now - 0.08) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const t = Math.max(start, now);
      source.buffer = buffer;
      source.playbackRate.value = playbackRateOffset;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(selectedInstrument === "electric" ? 3000 : selectedInstrument === "guitar" ? 5200 : 7600, t);
      filter.Q.setValueAtTime(selectedInstrument === "electric" ? 0.35 : 0.1, t);
      const velocity = randomVelocity ? (0.9 + Math.random() * 0.12) : 1;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(gainValue * velocity * (selectedInstrument === "electric" ? 0.76 : 1), t + 0.012);
      gain.gain.setTargetAtTime(0.0001, t + duration * (selectedInstrument === "electric" ? 0.58 : 0.52), duration * 0.2);
      if (selectedInstrument === "electric") {
        const warmth = ctx.createBiquadFilter();
        const soften = ctx.createBiquadFilter();
        warmth.type = "lowshelf";
        warmth.frequency.setValueAtTime(360, t);
        warmth.gain.setValueAtTime(2.5, t);
        soften.type = "highshelf";
        soften.frequency.setValueAtTime(2600, t);
        soften.gain.setValueAtTime(-5, t);
        source.connect(filter).connect(warmth).connect(soften).connect(gain).connect(masterGain);
      } else {
        source.connect(filter).connect(gain).connect(masterGain);
      }
      source.start(t);
      source.stop(t + duration + 0.4);
    }).catch(() => {
      playPluck(note, start, gainValue, duration);
    });
  };

  if (selectedInstrument !== "guitar") {
    if (selectedInstrument === "electric") {
      const midi = noteToMidi(note);
      const zone = findRjsElectricZone(midi);
      const velocitySlot = Math.max(1, Math.min(7, Math.round((gainValue / 0.24) * 5) + (randomVelocity ? Math.floor(Math.random() * 2) : 0)));
      loadRjsElectricSample(zone, velocitySlot).then((buffer) => {
        const now = ctx.currentTime;
        if (start < now - 0.08) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const warmth = ctx.createBiquadFilter();
        const t = Math.max(start, now);
        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, (midi - zone.rootNote) / 12) * playbackRateOffset;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3800, t);
        filter.Q.setValueAtTime(0.25, t);
        warmth.type = "lowshelf";
        warmth.frequency.setValueAtTime(320, t);
        warmth.gain.setValueAtTime(1.8, t);
        const velocity = randomVelocity ? (0.88 + Math.random() * 0.14) : 1;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(gainValue * 0.95 * velocity, t + 0.01);
        gain.gain.setTargetAtTime(0.0001, t + duration * 0.62, duration * 0.22);
        source.connect(filter).connect(warmth).connect(gain).connect(masterGain);
        source.start(t);
        source.stop(t + duration + 0.8);
        if (!rjsElectricReady) {
          rjsElectricReady = true;
          if (sampleStatus) setSampleStatus("RJS 电吉他采样");
        }
      }).catch(() => playSoundfont());
      return;
    }
    playSoundfont();
    return;
  }

  const midi = noteToMidi(note);
  const zone = findLocalZone(midi);
  const rrSlot = (rrIndex++ % 2) + 1;
  loadLocalGuitarSample(zone, rrSlot).then((buffer) => {
    const now = ctx.currentTime;
    if (start < now - 0.08) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, (midi - zone.rootNote) / 12) * playbackRateOffset;
    const t = Math.max(start, now);
    const velocity = randomVelocity ? (0.86 + Math.random() * 0.16) : 1;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainValue * velocity, t + 0.008);
    gain.gain.setTargetAtTime(0.0001, t + duration * 0.55, duration * 0.2);
    source.connect(gain).connect(masterGain);
    source.start(t);
    source.stop(t + duration + 0.4);
    if (!localGuitarReady) {
      localGuitarReady = true;
      if (sampleStatus) setSampleStatus("本地尼龙吉他采样");
    }
  }).catch(() => {
    playSoundfont();
  });
}

function makeDriveCurve(amount = 24) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const k = amount;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function playTinbox(note, start, gainValue = 0.22, duration = 1.4, voice = currentSynthVoice()) {
  const ctx = ensureAudio();
  const t = Math.max(start, ctx.currentTime);
  const freq = noteToFrequency(note);
  const body = ctx.createOscillator();
  const tine = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const gain = ctx.createGain();
  const tineGain = ctx.createGain();
  const subGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const presence = ctx.createBiquadFilter();
  const delay = ctx.createDelay();
  const feedback = ctx.createGain();
  const delayGain = ctx.createGain();

  body.type = voice.body;
  tine.type = voice.overtone;
  sub.type = "sine";
  body.frequency.setValueAtTime(freq, t);
  body.detune.setValueAtTime(voice.detune || 0, t);
  tine.frequency.setValueAtTime(freq * voice.ratio, t);
  sub.frequency.setValueAtTime(freq * 0.5, t);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(voice.filter, t);
  filter.Q.setValueAtTime(voice.q, t);
  presence.type = "peaking";
  presence.frequency.setValueAtTime(voice.presence, t);
  presence.Q.setValueAtTime(1.4, t);
  presence.gain.setValueAtTime(voice.boost, t);

  const velocity = randomVelocity ? (0.86 + Math.random() * 0.14) : 1;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(gainValue * 0.52 * velocity, t + voice.attack);
  gain.gain.setTargetAtTime(0.0001, t + Math.max(0.38, duration * voice.decay), 0.22);
  tineGain.gain.setValueAtTime(gainValue * voice.toneGain, t);
  tineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
  subGain.gain.setValueAtTime(gainValue * voice.subGain, t);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.82);

  delay.delayTime.setValueAtTime(voice.delay, t);
  feedback.gain.setValueAtTime(voice.feedback, t);
  delayGain.gain.setValueAtTime(voice.wet, t);

  body.connect(filter).connect(presence).connect(gain).connect(masterGain);
  tine.connect(tineGain).connect(presence);
  sub.connect(subGain).connect(filter);
  gain.connect(delay).connect(feedback).connect(delay);
  delay.connect(delayGain).connect(masterGain);

  body.start(t);
  tine.start(t);
  sub.start(t);
  body.stop(t + duration + 0.55);
  tine.stop(t + 0.5);
  sub.stop(t + 0.85);
}

function startTinboxChord(chord, gainValue = 0.32, voice = currentSynthVoice()) {
  const kind = "synth:" + selectedInstrument;
  if (!chord?.chord || chordLoopState.chord === chord.chord && chordLoopState.kind === kind && chordLoopState.source) {
    return;
  }
  stopChordLoop();
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const presence = ctx.createBiquadFilter();
  const delay = ctx.createDelay();
  const feedback = ctx.createGain();
  const delayGain = ctx.createGain();
  const sources = [];

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(1200, voice.filter * 0.82), now);
  filter.Q.setValueAtTime(voice.q, now);
  presence.type = "peaking";
  presence.frequency.setValueAtTime(voice.presence, now);
  presence.Q.setValueAtTime(1.2, now);
  presence.gain.setValueAtTime(voice.boost * 0.9, now);
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(gainValue, now + 0.08);
  delay.delayTime.setValueAtTime(voice.delay, now);
  feedback.gain.setValueAtTime(voice.feedback * 0.82, now);
  delayGain.gain.setValueAtTime(voice.wet * 0.85, now);

  chord.strings.slice(0, 4).forEach((note, index) => {
    const freq = noteToFrequency(applyCapo(note));
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = index === 0 ? "sine" : voice.body;
    osc.frequency.setValueAtTime(freq * (index === 0 ? 0.5 : 1), now);
    osc.detune.setValueAtTime((voice.detune || 0) + index * 1.5, now);
    noteGain.gain.setValueAtTime(index === 0 ? 0.18 : 0.13, now);
    osc.connect(noteGain).connect(filter);
    osc.start(now);
    sources.push(osc);
  });

  filter.connect(presence).connect(output).connect(masterGain);
  output.connect(delay).connect(feedback).connect(delay);
  delay.connect(delayGain).connect(masterGain);

  chordLoopState.chord = chord.chord;
  chordLoopState.kind = kind;
  chordLoopState.source = { stop: (when) => sources.forEach((source) => source.stop(when)) };
  chordLoopState.gainNode = output;
  chordLoopState.loading = false;
  chordLoopState.shouldLoop = true;
  chordLoopState.generation += 1;
  if (sampleStatus) setSampleStatus(voice.label + "持续和弦：" + chord.chord);
}

function playChordStrum(chord, start, kind = "strum", gainValue = 0.62) {
  if (sampleInstruments[selectedInstrument]?.synth) {
    startTinboxChord(chord, 0.28, currentSynthVoice());
    return true;
  }
  if (
    selectedInstrument !== "guitar" ||
    !chord?.chord ||
    (!customChordSamples.has(chord.chord) && !CHORD_STRUM_FILES[chord.chord])
  ) return false;
  // 单实例 loop：合弦不变就不要重复触发，由同一个音频源内部循环
  if (chordLoopState.chord === chord.chord && chordLoopState.kind === kind && (chordLoopState.source || chordLoopState.loading)) {
    return true;
  }
  startChordLoop(chord.chord, kind, gainValue);
  return true;
}

const chordLoopState = {
  chord: null,
  kind: null,
  source: null,
  sources: new Set(),
  gainNode: null,
  timerId: null,
  loading: false,
  shouldLoop: false,
  generation: 0,
};

function startChordLoop(chordName, kind, gainValue) {
  if (!customChordSamples.has(chordName) && !CHORD_STRUM_FILES[chordName]) return;
  stopChordLoop();
  const generation = ++chordLoopState.generation;
  chordLoopState.chord = chordName;
  chordLoopState.kind = kind;
  chordLoopState.loading = true;
  chordLoopState.shouldLoop = true;
  setSampleStatus(customChordSamples.has(chordName)
    ? `自定义和弦音频：${chordName}`
    : `真实整和弦采样：${chordName}`);
  playChordLoopSource(chordName, kind, gainValue, generation, null);
}

function playChordLoopSource(chordName, kind, gainValue, generation, buffer) {
  if (generation !== chordLoopState.generation) return;
  const loadBuffer = buffer ? Promise.resolve(buffer) : loadChordStrumSample(chordName, kind);
  loadBuffer.then((buffer) => {
    chordLoopState.loading = false;
    if (!buffer) return;
    if (generation !== chordLoopState.generation) return;
    if (!chordLoopState.shouldLoop) return;
    const ctx = ensureAudio();
    const overlap = Math.min(0.12, Math.max(0.025, buffer.duration * 0.1));
    const playDuration = Math.max(0.08, buffer.duration);
    const leadTime = 0.28;

    const scheduleSegment = (startAt) => {
      if (generation !== chordLoopState.generation) return;
      if (!chordLoopState.shouldLoop || chordLoopState.chord !== chordName || chordLoopState.kind !== kind) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const velocity = randomVelocity ? (0.92 + Math.random() * 0.1) : 1;
      const stopAt = startAt + playDuration;
      const nextAt = Math.max(startAt + 0.03, stopAt - overlap);
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(gainValue * velocity, startAt + Math.min(0.02, overlap * 0.5));
      gain.gain.setValueAtTime(gainValue * velocity, Math.max(startAt + 0.025, stopAt - overlap));
      gain.gain.linearRampToValueAtTime(0.0001, stopAt);
      source.connect(gain).connect(masterGain);
      source.onended = () => chordLoopState.sources.delete(source);
      chordLoopState.sources.add(source);
      chordLoopState.source = {
        stop: (when) => {
          chordLoopState.sources.forEach((activeSource) => {
            try { activeSource.stop(when); } catch (err) {}
          });
        },
      };
      chordLoopState.gainNode = gain;
      source.start(Math.max(startAt, ctx.currentTime + 0.004));
      source.stop(stopAt + 0.01);

      if (chordLoopState.timerId) clearTimeout(chordLoopState.timerId);
      chordLoopState.timerId = setTimeout(() => {
        scheduleSegment(nextAt);
      }, Math.max(1, (nextAt - ctx.currentTime - leadTime) * 1000));
    };

    scheduleSegment(ctx.currentTime + 0.012);
  }).catch(() => {
    if (generation === chordLoopState.generation) chordLoopState.loading = false;
  });
}

function stopChordLoop() {
  chordLoopState.generation += 1;
  chordLoopState.shouldLoop = false;
  chordLoopState.chord = null;
  chordLoopState.kind = null;
  const source = chordLoopState.source;
  const gainNode = chordLoopState.gainNode;
  const timerId = chordLoopState.timerId;
  const sources = Array.from(chordLoopState.sources);
  chordLoopState.source = null;
  chordLoopState.sources.clear();
  chordLoopState.gainNode = null;
  chordLoopState.timerId = null;
  chordLoopState.loading = false;
  if (timerId) clearTimeout(timerId);
  if (source) {
    try {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      if (gainNode) {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setTargetAtTime(0.0001, now, chordFadeSeconds / 2);
      }
      source.onended = null;
      source.stop(now + chordFadeSeconds + 0.02);
    } catch (err) {}
  }
  sources.forEach((activeSource) => {
    try {
      activeSource.onended = null;
      activeSource.stop(ensureAudio().currentTime + chordFadeSeconds + 0.02);
    } catch (err) {}
  });
}

function scheduleFallbackChord(chord, start) {
  const strings = chord.strings || [];
  strings.forEach((note, index) => {
    playSample(applyCapo(note), start + index * 0.016, 0.13 + index * 0.01, 1.45);
  });
}

function createPluckBuffer(freq, duration = 1.35) {
  const ctx = ensureAudio();
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(duration * sampleRate);
  const period = Math.max(2, Math.floor(sampleRate / freq));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const ring = Array.from({ length: period }, () => Math.random() * 2 - 1);
  let lowpass = 0;

  for (let i = 0; i < length; i += 1) {
    const current = ring[i % period];
    const next = ring[(i + 1) % period];
    const decay = 0.996 - Math.min(freq / 16000, 0.02);
    const value = ((current + next) * 0.5) * decay;
    ring[i % period] = value;
    lowpass = (lowpass * 0.64) + (current * 0.36);
    data[i] = lowpass;
  }
  return buffer;
}

function playPluck(note, start, gainValue = 0.22, duration = 1.25) {
  const ctx = ensureAudio();
  const freq = noteToFrequency(note);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  source.buffer = createPluckBuffer(freq, duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600 + Math.random() * 900, start);
  filter.Q.value = 0.55;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue * (0.86 + Math.random() * 0.16), start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.playbackRate.value = freq / noteToFrequency(note);
  source.connect(filter).connect(gain).connect(masterGain);
  source.start(start);
  source.stop(start + duration + 0.03);
}

function scheduleStrum(chord, start, step) {
  const profile = getRhythmProfile();
  const stroke = profile.pattern[step % profile.pattern.length];
  if (stroke === "-") return;
  if (stroke === "x" || mutedStrum) {
    scheduleMute(start);
    if (stroke === "x") return;
  }
  if (playChordStrum(chord, start, "strum")) return;

  const strings = stroke === "D" ? chord.strings : [...chord.strings].reverse();
  const gap = spreadEnabled ? (stroke === "D" ? 0.022 : 0.016) : 0.002;
  strings.forEach((note, index) => {
    const stringGain = selectedInstrument === "piano" ? 0.18 : selectedInstrument === "electric" ? 0.13 + index * 0.009 : 0.15 + index * 0.012;
    const duration = selectedInstrument === "piano" ? 2.3 : selectedInstrument === "electric" ? 1.75 : 1.55;
    const feel = humanizeStep(step + index, stringGain);
    const noteStart = start + (index * gap) + feel.timeOffset * 0.45;
    const playedNote = applyCapo(note);
    playLayeredNote(playedNote, noteStart, feel.gain, duration);
    if (randomVelocity && (selectedInstrument === "guitar" || selectedInstrument === "electric")) {
      const cents = selectedInstrument === "electric" ? 4 + Math.random() * 3 : 3 + Math.random() * 5;
      const detuneRatio = 2 ** (cents / 1200);
      const layerDelay = 0.003 + Math.random() * 0.005;
      playSample(playedNote, noteStart + layerDelay, stringGain * 0.24, duration * 0.92, detuneRatio);
    }
  });
}

function scheduleArp(chord, start, step, stepDuration) {
  if (!sampleInstruments[selectedInstrument]?.synth && playChordStrum(chord, start, "arp", 0.54)) return;
  // 用根音感知的弦位取音，而不是硬编码 arpPattern 索引
  var chordName = (chord.chord || chord.token || 'C').replace(/\d+$/, '');
  var stringNum = adaptProgressionToChord(defaultStringProgression, chordName)[step % 8];
  var note = applyCapo(getStringNoteForChord(chord, stringNum));
  const duration = Math.max(0.75, stepDuration * 2.2);
  if (selectedInstrument === "piano" || selectedInstrument === "electric") {
    const feel = humanizeStep(step, selectedInstrument === "piano" ? 0.22 : 0.2);
    playLayeredNote(note, start + feel.timeOffset, feel.gain, duration);
    return;
  }
  const feel = humanizeStep(step, 0.24);
  playSample(note, start + feel.timeOffset, feel.gain, duration);
}

function scheduleCustomMelody(chord, start, step, stepDuration) {
  if (scoreTrack.enabled) return;
  if (playMode === 'custom' && customMelodyEnabled && customProgression.length > 0) {
    var chordName = (chord.chord || chord.token || 'C').replace(/\d+$/, '');
    var realProgression = adaptProgressionToChord(customProgression, chordName);
    var stringNum = realProgression[step % realProgression.length];
    var note = applyCapo(getStringNoteForChord(chord, stringNum));
    const feel = humanizeStep(step, 0.13);
    const noteStart = Math.max(start, start + stepDuration * 0.12 + feel.timeOffset);
    const mainGain = Math.min(0.18, feel.gain);
    const duration = Math.max(0.42, stepDuration * 1.6);
    playLayeredNote(note, noteStart, mainGain, duration);
    return;
  }
}

function scheduleScoreStep(chord, start, step, stepDuration) {
  const event = scoreTrack.events[step % scoreTrack.events.length];
  if (!event || event.type === "rest" || event.type === "hold") return;
  const melodyNote = applyCapo(noteFromScaleDegree(event.degree, 4));
  const root = applyCapo(shiftOctave(chord.strings?.[0] || "C3", -1));
  const isBeat = step % 4 === 0;
  const melodyGain = selectedInstrument === "piano" ? 0.28 : selectedInstrument === "electric" ? 0.2 : 0.22;
  playSample(melodyNote, start, melodyGain, Math.max(0.32, stepDuration * 1.8));
  if (isBeat) playSample(root, start, 0.12, Math.max(0.45, stepDuration * 2.4));
  if (isBeat && playMode === "strum") {
    const guideNotes = (chord.strings || []).slice(2, 5);
    guideNotes.forEach((note, index) => {
      playSample(applyCapo(note), start + 0.012 + index * 0.01, 0.055, Math.max(0.38, stepDuration * 1.6));
    });
  }
}

function schedulePianoPattern(chord, start, step, profile, stepDuration) {
  const stepInBar = (step % 16) + 1;
  const events = profile.pianoEvents?.filter((event) => event.step === stepInBar) || [];
  events.forEach((event) => {
    const delay = event.lazy ? stepDuration * 0.18 : 0;
    const durationMap = { stab: 0.16, short: 0.32, medium: 0.72, long: 1.85 };
    const duration = durationMap[event.length || "short"] || 0.42;
    const gain = event.accent ? 0.32 : event.soft ? 0.18 : 0.24;
    event.parts.forEach((part) => playPianoPart(chord, part, start + delay, gain, duration));
  });
}

function pianoVoices(chord) {
  // 根音感知：从弦位取实际音
  var bassNote = getStringNoteForChord(chord, 6);
  var bassLow = shiftOctave(bassNote, -1);
  var rootNote = getStringNoteForChord(chord, 5);
  var thirdNote = getStringNoteForChord(chord, 4);
  var fifthNote = getStringNoteForChord(chord, 3);
  var highNote = getStringNoteForChord(chord, 2);
  return {
    bass: applyCapo(bassNote),
    bassLow: applyCapo(bassLow),
    bassHigh: applyCapo(rootNote),
    root: applyCapo(rootNote),
    third: applyCapo(thirdNote),
    fifth: applyCapo(fifthNote),
    high: applyCapo(highNote),
  };
}

function playPianoPart(chord, part, start, gainValue, duration) {
  const voices = pianoVoices(chord);
  if (part === "chord") {
    [voices.root, voices.third, voices.fifth].forEach((note, index) => {
      playSample(note, start + index * 0.006, gainValue * (index === 0 ? 0.95 : 0.82), duration);
    });
    return;
  }
  const note = voices[part] || voices.root;
  playSample(note, start, part.startsWith("bass") ? gainValue * 1.08 : gainValue, duration);
}

function scheduleMute(start) {
  const ctx = ensureAudio();
  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  noise.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 1200;
  gain.gain.setValueAtTime(0.16, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start(start);
}

function scheduleDrums(start, step) {
  if (!drumsEnabled || !drumToggle?.checked) return;
  const profile = getDrumRhythmProfile();
  const slot = step % 8;
  const bar = Math.floor(step / 8);
  const sixteenth = (60 / Number(bpm.value)) / 4;

  if (profile.id === "drum_pop_kick") {
    if ([0, 3, 4, 6].includes(slot)) playDrum("kick", start, 0.22);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.23);
    playDrum("hat", start + 0.005, slot % 2 ? 0.055 : 0.085);
    return;
  }

  if (profile.id === "drum_funk_break") {
    if ([0, 5].includes(slot)) playDrum("kick", start, 0.22);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.22);
    playDrum("hat", start + 0.004, slot % 2 ? 0.04 : 0.075);
    if ([1, 4, 7].includes(slot)) playDrum("hat", start + sixteenth, 0.035);
    return;
  }

  if (profile.id === "drum_hiphop_slow") {
    if ([0, 5].includes(slot)) playDrum("kick", start, 0.24);
    if ([2, 6].includes(slot)) playDrum("snare", start + (slot === 6 ? sixteenth * 0.25 : 0), 0.22);
    if (slot % 2 === 0) playDrum("hat", start + 0.006, 0.055);
    return;
  }

  if (profile.id === "drum_reggae") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.18);
    if ([1, 5].includes(slot)) playDrum("snare", start, 0.2);
    if ([1, 3, 5, 7].includes(slot)) playDrum("hat", start + 0.005, 0.07);
    return;
  }

  if (profile.id === "drum_light_hat") {
    if (slot === 0) playDrum("kick", start, 0.14);
    if (slot === 6) playDrum("snare", start, 0.11);
    playDrum("hat", start + 0.005, slot % 2 ? 0.035 : 0.06);
    return;
  }

  if (profile.id === "drum_march") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.16);
    if ([0, 2, 3, 4, 6, 7].includes(slot)) playDrum("snare", start, slot % 4 === 0 ? 0.2 : 0.15);
    if (slot % 2 === 0) playDrum("hat", start + 0.004, 0.045);
    return;
  }

  if (profile.id === "drum_trap") {
    if (slot === 0) playDrum("kick", start, 0.28);
    if (slot === 4) playDrum("snare", start, 0.24);
    playDrum("hat", start + 0.004, 0.048);
    if ([2, 3, 6, 7].includes(slot)) playDrum("hat", start + sixteenth * 0.5, 0.032);
    if (slot === 7) playDrum("hat", start + sixteenth * 0.75, 0.026);
    return;
  }

  if (profile.id === "drum_heavy_rock") {
    if ([0, 1, 3, 4, 5, 7].includes(slot)) playDrum("kick", start, 0.24);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.26);
    playDrum("hat", start + 0.005, slot % 2 ? 0.07 : 0.095);
    if (bar % 4 === 0 && slot === 0) playDrum("hat", start + 0.002, 0.18);
    return;
  }

  if (profile.id === "drum_bossa") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.17);
    if ([0, 3, 5].includes(slot)) playDrum("snare", start + 0.006, 0.13);
    if ([2, 6, 7].includes(slot)) playDrum("snare", start + sixteenth, 0.1);
    playDrum("hat", start + 0.005, slot % 2 ? 0.04 : 0.065);
    return;
  }

  if (profile.id === "drum_ballad_slow") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.13);
    if (slot === 6) playDrum("snare", start, 0.13);
    if (slot % 2 === 0) playDrum("hat", start + 0.006, 0.04);
    return;
  }

  if (profile.id === "drum_country_folk") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.2);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.16);
    playDrum("hat", start + 0.004, slot % 2 ? 0.045 : 0.07);
    if ([1, 5].includes(slot)) playDrum("hat", start + sixteenth * 0.5, 0.03);
    return;
  }

  if (profile.id === "drum_britpop") {
    if ([0, 3, 4].includes(slot)) playDrum("kick", start, 0.22);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.25);
    playDrum("hat", start + 0.003, slot % 2 ? 0.065 : 0.09);
    return;
  }

  if (profile.id === "drum_soul_rnb") {
    if ([0, 5].includes(slot)) playDrum("kick", start + (slot === 5 ? sixteenth * 0.18 : 0), 0.2);
    if ([2, 6].includes(slot)) playDrum("snare", start + sixteenth * 0.12, 0.2);
    if (slot % 2 === 0) playDrum("hat", start + 0.006, 0.05);
    if ([3, 7].includes(slot)) playDrum("hat", start + sixteenth * 0.5, 0.032);
    return;
  }

  if (profile.id === "drum_indie_rock") {
    if ([0, 4, 7].includes(slot)) playDrum("kick", start, 0.23);
    if ([2, 6].includes(slot)) playDrum("snare", start, 0.23);
    if ([0, 1, 2, 4, 5, 6].includes(slot)) playDrum("hat", start + 0.004, 0.075);
    return;
  }

  if (profile.id === "drum_post_ambient") {
    if (slot === 0) playDrum("kick", start, 0.16);
    if (slot === 6) playDrum("snare", start + sixteenth * 0.25, 0.12);
    if ([0, 2, 4, 6].includes(slot)) playDrum("hat", start + 0.008, 0.035);
    return;
  }

  if (profile.id === "drum_jazz_swing") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.11);
    if ([2, 6].includes(slot)) playDrum("snare", start + sixteenth * 0.18, 0.14);
    if ([0, 1, 3, 4, 5, 7].includes(slot)) playDrum("hat", start + (slot % 2 ? sixteenth * 0.22 : 0.004), 0.065);
    return;
  }

  if (profile.id === "drum_samba") {
    if ([0, 3, 4, 7].includes(slot)) playDrum("kick", start, 0.18);
    if ([1, 2, 5, 6].includes(slot)) playDrum("snare", start + 0.005, 0.12);
    playDrum("hat", start + 0.004, slot % 2 ? 0.05 : 0.075);
    return;
  }

  if (profile.id === "drum_dream_pop") {
    if ([0, 4].includes(slot)) playDrum("kick", start, 0.17);
    if (slot === 6) playDrum("snare", start, 0.16);
    playDrum("hat", start + 0.006, slot % 2 ? 0.038 : 0.06);
    return;
  }

  if (profile.id === "drum_soft_piano") {
    if (slot === 0) playDrum("kick", start, 0.12);
    if (slot === 4) playDrum("snare", start, 0.1);
    if ([0, 2, 4, 6].includes(slot)) playDrum("hat", start + 0.008, 0.03);
    return;
  }

  if ([0, 4].includes(slot)) playDrum("kick", start);
  if ([2, 6].includes(slot)) playDrum("snare", start);
  playDrum("hat", start + 0.005, slot % 2 ? 0.06 : 0.09);
}

function playDrum(type, start, level = 0.18) {
  if (!drumsEnabled || !drumToggle?.checked) return;
  const ctx = ensureAudio();
  const gain = ctx.createGain();
  gain.connect(masterGain);
  if (type === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.11);
    gain.gain.setValueAtTime(0.24, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + 0.18);
    return;
  }
  const src = ctx.createBufferSource();
  const len = Math.floor(ctx.sampleRate * (type === "snare" ? 0.14 : 0.04));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const filter = ctx.createBiquadFilter();
  filter.type = type === "snare" ? "bandpass" : "highpass";
  filter.frequency.value = type === "snare" ? 1800 : 6500;
  src.buffer = buf;
  gain.gain.setValueAtTime(type === "snare" ? 0.22 : level, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + (type === "snare" ? 0.16 : 0.05));
  src.connect(filter).connect(gain);
  src.start(start);
}

async function startCamera() {
  if (!window.Hands || !window.Camera) throw new Error("手势识别模型还没加载完成，请稍后再点一次");
  if (!handsModel) {
    handsModel = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    handsModel.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.42, minTrackingConfidence: 0.34 });
    handsModel.onResults(onHandResults);
  }
  if (!faceModel && window.FaceDetection) {
    faceModel = new FaceDetection({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}` });
    faceModel.setOptions({ model: "short", minDetectionConfidence: 0.45 });
    faceModel.onResults(drawFaceFx);
  }
  if (!handCamera) {
    handCamera = new Camera(camera, {
      onFrame: async () => {
        await handsModel.send({ image: camera });
        if (faceModel && stageFxEnabled && !faceBusy && faceFrameCounter++ % 5 === 0) {
          faceBusy = true;
          faceModel.send({ image: camera })
            .catch(() => null)
            .finally(() => { faceBusy = false; });
        }
      },
      width: 720,
      height: 540,
    });
  }
  await handCamera.start();
  cameraActive = true;
  cameraBtn.classList.add("active");
  cameraBtn.textContent = "关闭摄像头";
  cameraFallback.classList.add("hidden");
  detectStatus.textContent = "识别中：比 1/2/3/4/5 根手指";
  handCanvas.style.display = "";
  if (faceCanvas) faceCanvas.style.display = "";
}

function stopCamera() {
  if (handCamera?.stop) {
    try { handCamera.stop(); } catch (error) {}
  }
  const stream = camera.srcObject;
  if (stream?.getTracks) {
    stream.getTracks().forEach((track) => track.stop());
  }
  camera.srcObject = null;
  cameraActive = false;
  lastStableCandidate = null;
  stableSince = 0;
  currentFinger = null;
  pendingFinger = null;
  cameraBtn.classList.remove("active");
  cameraBtn.textContent = "开启摄像头识别";
  cameraFallback.classList.remove("hidden");
  detectStatus.textContent = "手势识别已关闭";
  canvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  faceCtx?.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  handCanvas.style.display = "none";
  if (faceCanvas) faceCanvas.style.display = "none";
  stopChordLoop();
  updateStatus();
}

function onHandResults(results) {
  drawHand(results);
  updateDrumTouchZone(results);
  const landmarks = results.multiHandLandmarks?.[0];
  const candidate = landmarks ? countExtendedFingers(landmarks) : null;
  const now = performance.now();

  if (!candidate) {
    const canHold = autoHoldEnabled && lastConfirmedFinger && now - lastConfirmedAt < autoHoldMs;
    if (canHold) {
      if (currentFinger !== lastConfirmedFinger || pendingFinger !== lastConfirmedFinger) {
        pendingFinger = lastConfirmedFinger;
        currentFinger = lastConfirmedFinger;
        updateStatus();
      }
      detectStatus.textContent = "自动保持：" + lastConfirmedFinger + " 号手势";
    } else if (now - lastGestureSeenAt > gestureDropoutGraceMs) {
      lastStableCandidate = null;
      stableSince = 0;
      if (pendingFinger !== null) setPendingFinger(null);
      detectStatus.textContent = "无手 / 不稳定：静音";
    } else {
      detectStatus.textContent = "短暂丢帧：保持当前和弦";
    }
    return;
  }
  lastGestureSeenAt = now;

  if (candidate !== lastStableCandidate) {
    lastStableCandidate = candidate;
    stableSince = now;
  }

  const stableMs = now - stableSince;
  detectStatus.textContent = `识别到：${candidate} 指（稳定 ${Math.min(Math.round(stableMs), gestureStabilityMs)}/${gestureStabilityMs}ms）`;
  if (stableMs >= gestureStabilityMs) setPendingFinger(candidate);
}

function setDrumTouchDrumState(enabled) {
  if (!drumTouchEnabled || !drumToggle) return;
  if (drumToggle.checked === enabled) return;
  drumToggle.checked = enabled;
  drumsEnabled = enabled;
  drumTouchZone?.classList.toggle("active", enabled);
}

function updateDrumTouchZone(results) {
  if (!drumTouchZone) return;
  if (!drumTouchEnabled) {
    drumTouchZone.classList.remove("armed");
    return;
  }
  const tip = results.multiHandLandmarks?.[0]?.[8];
  const now = performance.now();
  if (!tip) {
    drumTouchInsideSince = 0;
    drumTouchZone.classList.remove("armed");
    return;
  }
  const wrapRect = videoWrap.getBoundingClientRect();
  const zoneRect = drumTouchZone.getBoundingClientRect();
  const x = wrapRect.left + (1 - tip.x) * wrapRect.width;
  const y = wrapRect.top + tip.y * wrapRect.height;
  const inside = x >= zoneRect.left && x <= zoneRect.right && y >= zoneRect.top && y <= zoneRect.bottom;
  drumTouchZone.classList.toggle("armed", inside);
  if (inside) {
    if (!drumTouchInsideSince) drumTouchInsideSince = now;
    if (now >= drumTouchCooldownUntil && now - drumTouchInsideSince >= 300) {
      setDrumTouchDrumState(!drumToggle.checked);
      drumTouchCooldownUntil = now + 1000;
      drumTouchInsideSince = 0;
    }
  } else {
    drumTouchInsideSince = 0;
  }
}

function drawHand(results) {
  const rect = camera.getBoundingClientRect();
  handCanvas.width = Math.max(1, Math.floor(rect.width));
  handCanvas.height = Math.max(1, Math.floor(rect.height));
  canvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  const hands = results.multiHandLandmarks || [];
  if (!hands.length) return;
  canvasCtx.save();
  canvasCtx.lineCap = "round";
  canvasCtx.lineJoin = "round";
  const chains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16],
    [0, 17, 18, 19, 20],
    [5, 9, 13, 17, 5],
  ];
  hands.forEach((landmarks) => {
    canvasCtx.strokeStyle = "rgba(255,255,255,0.72)";
    canvasCtx.lineWidth = 2.4;
    chains.forEach((chain) => {
      canvasCtx.beginPath();
      chain.forEach((idx, pointIndex) => {
        const point = landmarks[idx];
        const x = point.x * handCanvas.width;
        const y = point.y * handCanvas.height;
        if (pointIndex === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      });
      canvasCtx.stroke();
    });
    canvasCtx.fillStyle = "rgba(255,209,102,0.9)";
    landmarks.forEach((point) => {
      canvasCtx.beginPath();
      canvasCtx.arc(point.x * handCanvas.width, point.y * handCanvas.height, 3.2, 0, Math.PI * 2);
      canvasCtx.fill();
    });
  });
  canvasCtx.restore();
}

function drawFaceFx(results) {
  if (!faceCanvas || !faceCtx) return;
  const rect = camera.getBoundingClientRect();
  faceCanvas.width = Math.max(1, Math.floor(rect.width));
  faceCanvas.height = Math.max(1, Math.floor(rect.height));
  faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  if (!stageFxEnabled) return;

  const detection = results.detections?.[0];
  const box = detection?.locationData?.relativeBoundingBox;
  if (!box) return;

  const x = box.xMin * faceCanvas.width;
  const y = box.yMin * faceCanvas.height;
  const w = box.width * faceCanvas.width;
  const h = box.height * faceCanvas.height;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const t = performance.now() / 1000;

  faceCtx.save();
  faceCtx.lineCap = "round";
  faceCtx.lineJoin = "round";

  drawCuteEar(cx - w * 0.28, y + h * 0.04, w * 0.22, -0.18);
  drawCuteEar(cx + w * 0.28, y + h * 0.04, w * 0.22, 0.18);

  const blushY = cy + h * 0.16;
  drawBlush(cx - w * 0.26, blushY, w * 0.12);
  drawBlush(cx + w * 0.26, blushY, w * 0.12);

  faceCtx.strokeStyle = "rgba(255, 230, 180, 0.88)";
  faceCtx.lineWidth = Math.max(2, w * 0.014);
  faceCtx.beginPath();
  faceCtx.arc(cx, cy + h * 0.02, w * 0.56 + Math.sin(t * 3) * 2, 0.08, Math.PI - 0.08);
  faceCtx.stroke();

  for (let i = 0; i < 7; i += 1) {
    const angle = t * 0.7 + i * 0.9;
    const sx = cx + Math.cos(angle) * w * 0.62;
    const sy = cy + Math.sin(angle * 1.3) * h * 0.48;
    drawStar(sx, sy, Math.max(5, w * 0.035), i % 2 ? "#ffd166" : "#ffffff");
  }

  faceCtx.restore();

  function drawCuteEar(ex, ey, size, lean) {
    faceCtx.save();
    faceCtx.translate(ex, ey);
    faceCtx.rotate(lean);
    faceCtx.fillStyle = "rgba(255,255,255,0.88)";
    faceCtx.strokeStyle = "rgba(255, 159, 189, 0.92)";
    faceCtx.lineWidth = Math.max(2, size * 0.08);
    faceCtx.beginPath();
    faceCtx.moveTo(0, -size);
    faceCtx.quadraticCurveTo(size * 0.8, size * 0.1, size * 0.22, size * 0.72);
    faceCtx.quadraticCurveTo(-size * 0.55, size * 0.2, 0, -size);
    faceCtx.closePath();
    faceCtx.fill();
    faceCtx.stroke();
    faceCtx.fillStyle = "rgba(255, 159, 189, 0.46)";
    faceCtx.beginPath();
    faceCtx.moveTo(size * 0.02, -size * 0.46);
    faceCtx.quadraticCurveTo(size * 0.35, size * 0.08, size * 0.08, size * 0.34);
    faceCtx.quadraticCurveTo(-size * 0.22, size * 0.08, size * 0.02, -size * 0.46);
    faceCtx.fill();
    faceCtx.restore();
  }

  function drawBlush(bx, by, r) {
    const gradient = faceCtx.createRadialGradient(bx, by, 0, bx, by, r);
    gradient.addColorStop(0, "rgba(255, 118, 156, 0.62)");
    gradient.addColorStop(1, "rgba(255, 118, 156, 0)");
    faceCtx.fillStyle = gradient;
    faceCtx.beginPath();
    faceCtx.ellipse(bx, by, r * 1.45, r, 0, 0, Math.PI * 2);
    faceCtx.fill();
  }

  function drawStar(sx, sy, size, color) {
    faceCtx.fillStyle = color;
    faceCtx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const radius = i % 2 ? size * 0.36 : size;
      const angle = -Math.PI / 2 + i * Math.PI / 4;
      const px = sx + Math.cos(angle) * radius;
      const py = sy + Math.sin(angle) * radius;
      if (i === 0) faceCtx.moveTo(px, py);
      else faceCtx.lineTo(px, py);
    }
    faceCtx.closePath();
    faceCtx.fill();
  }
}

function isFingerOpen(points, tip, pip) {
  return points[tip].y < points[pip].y - 0.025;
}

function countExtendedFingers(points) {
  const fingers = [
    isThumbOpen(points),
    isFingerOpen(points, 8, 6),
    isFingerOpen(points, 12, 10),
    isFingerOpen(points, 16, 14),
    isFingerOpen(points, 20, 18),
  ];
  const count = fingers.filter(Boolean).length;
  return count >= 1 && count <= 5 ? count : null;
}

function isThumbOpen(points) {
  const wrist = points[0];
  const thumbTip = points[4];
  const thumbIp = points[3];
  const indexMcp = points[5];
  const thumbAwayFromPalm = Math.hypot(thumbTip.x - indexMcp.x, thumbTip.y - indexMcp.y) > 0.12;
  const thumbAwayFromWrist = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > Math.hypot(thumbIp.x - wrist.x, thumbIp.y - wrist.y) + 0.025;
  return thumbAwayFromPalm && thumbAwayFromWrist;
}

function renderLyrics() {
  return;
}

function availableRhythmProfiles() {
  return rhythmProfiles;
}

function ensureSelectedRhythmForInstrument() {
  const options = availableRhythmProfiles();
  if (!options.some((item) => item.id === selectedRhythm)) {
    selectedRhythm = options[0].id;
    const profile = getRhythmProfile();
    if (bpm && bpmValue) {
      bpm.value = String(profile.bpm);
      bpmValue.textContent = bpm.value;
    }
  }
}

function renderRhythmOptions() {
  ensureSelectedRhythmForInstrument();
  if (rhythmSelect) {
    rhythmSelect.innerHTML = availableRhythmProfiles()
      .map((item) => '<option value="' + item.id + '">' + item.name + '</option>')
      .join("");
    rhythmSelect.value = selectedRhythm;
  }
  if (drumRhythmSelect) {
    drumRhythmSelect.innerHTML = drumRhythmProfiles
      .map((item) => '<option value="' + item.id + '">' + item.name + '</option>')
      .join("");
    drumRhythmSelect.value = selectedDrumRhythm;
  }
}

function updateHumanizeLabel() {
  if (humanizeLabel) humanizeLabel.textContent = randomVelocity ? "💡 人性化演奏" : "🔧 精确演奏";
}

function applyDrumTouchSize(size) {
  drumTouchSizePx = Math.max(40, Math.min(180, Number(size) || 80));
  if (drumTouchZone) {
    drumTouchZone.style.width = drumTouchSizePx + "px";
    drumTouchZone.style.height = drumTouchSizePx + "px";
  }
  if (drumTouchSize) drumTouchSize.value = String(drumTouchSizePx);
}

function setControlsDrawer(open) {
  document.body.classList.toggle("controls-open", open);
}

function chordSelectOptions(currentChord) {
  const normalizedCurrent = normalizeChordSymbol(currentChord);
  const query = chordSearchQuery.trim().toLowerCase();
  let options = CHORD_OPTIONS.filter(Boolean);
  if (query) options = options.filter((chord) => chord.toLowerCase().includes(query));
  if (normalizedCurrent && !options.includes(normalizedCurrent)) options.unshift(normalizedCurrent);
  if (!options.length) options = normalizedCurrent ? [normalizedCurrent] : ["C"];
  return options.map((chord) => (
    '<option value="' + chord + '"' + (chord === normalizedCurrent ? " selected" : "") + '>' + chord + '</option>'
  )).join("");
}

function renderGestureBindingsEditor() {
  if (!mappingText) return;
  mappingText.innerHTML =
    '<input id="bindingSearchInput" class="binding-search" type="text" placeholder="搜索和弦..." value="' + chordSearchQuery.replace(/"/g, "&quot;") + '">' +
    GESTURE_GUIDE.map((item) => {
    const currentChord = gestureBindings[item.id] || defaultBindingsForKey(selectedKey)[item.id] || "C";
    const hasUpload = customFingerSamples.has(item.id);
    return (
      '<label class="gesture-binding-row">' +
        '<span><strong>' + item.id + '</strong><em>指</em></span>' +
        '<select class="gesture-binding-select" data-bind-finger="' + item.id + '">' +
          chordSelectOptions(currentChord) +
        '</select>' +
        '<button type="button" class="finger-upload-btn ' + (hasUpload ? "has-upload" : "") + '" data-upload-trigger="' + item.id + '" title="上传自定义音频">📁</button>' +
        '<input class="finger-upload-input" type="file" accept="audio/*,.mp3,.wav,.m4a" data-finger-upload="' + item.id + '">' +
      '</label>'
    );
  }).join("");
}

function renderControls() {
  renderProgression();
  modeButtons.innerHTML = Object.entries(modeLabels).map(([id, label]) => (
    '<button class="secondary ' + (id === playMode ? "active" : "") + '" data-mode="' + id + '">' + label + '</button>'
  )).join("");
  renderRhythmOptions();
  renderGestureBindingsEditor();
  if (keyLabel) keyLabel.textContent = selectedKey + "调 / 实际" + effectiveKeyName() + "调";
  if (capoValue) capoValue.textContent = capoSemitones + "品 -> " + effectiveKeyName() + "调";
  // 自定义走向编辑区显示/隐藏
  var customSection = document.getElementById("customMelodySection");
  if (customSection) customSection.style.display = playMode === "custom" ? "grid" : "none";
  if (typeof window.renderCustomProgression === "function") window.renderCustomProgression();
}

async function warmupSamples() {
  const notes = [...new Set([
    ...Object.values(gestureBindings).flatMap((chord) => getChordByName(chord).strings),
    ...activeProgression.flatMap((item) => item.chord.strings),
  ].map(applyCapo))];
  if (selectedInstrument === "guitar") {
    setSampleStatus("加载本地尼龙吉他采样...");
    try {
      await Promise.all(LOCAL_GUITAR_ZONES.flatMap((zone) => [1, 2].map((rr) => loadLocalGuitarSample(zone, rr))));
      localGuitarReady = true;
      setSampleStatus("本地尼龙吉他采样");
      return;
    } catch {
      setSampleStatus("本地采样加载失败，回退 SoundFont");
    }
  }
  if (sampleInstruments[selectedInstrument]?.synth) {
    setSampleStatus(sampleInstruments[selectedInstrument].label + "合成音色");
    return;
  }
  setSampleStatus("加载" + sampleInstruments[selectedInstrument].label + "采样...");
  await Promise.all(notes.slice(0, 12).map((note) => loadSample(note, selectedInstrument).catch(() => null)));
  setSampleStatus(sampleInstruments[selectedInstrument].label + "采样");
}

function getChordForFinger(finger) {
  if (!finger) return null;
  const chordName = gestureBindings[finger];
  if (!chordName) return null;
  return {
    ...getChordByName(chordName),
    shapeChord: chordName,
    chord: effectiveChordName(chordName),
  };
}

function parseProgression() {
  const tokens = getProgressionTokens();
  activeProgression = tokens.map((token, index) => ({
    token,
    index,
    gestureDegree: findGestureForChord(token),
    chord: {
      ...getChordByName(token),
      shapeChord: token,
      chord: effectiveChordName(token),
    },
  }));
}

function renderProgression() {
  parseProgression();
  if (!progressionStrip) return;
  const activeGesture = currentFinger || pendingFinger;
  progressionStrip.innerHTML = activeProgression.map((item) => (
    '<span class="' + (item.gestureDegree === activeGesture ? "active" : "") + '">' +
      '<strong>' + item.token + '</strong>' +
      '<em>' + (item.gestureDegree ? "摆" + item.gestureDegree : "未绑定") + '</em>' +
      '<small>实际 ' + item.chord.chord + '</small>' +
    '</span>'
  )).join("");
}

function updateStatus() {
  const gesture = currentFinger || pendingFinger;
  const chord = getChordForFinger(gesture);
  gestureName.textContent = currentFinger ? currentFinger + " 号手势" : pendingFinger ? pendingFinger + " 号待切换" : "无手势";
  activeChord.textContent = chord?.chord || "--";
  document.querySelectorAll("[data-finger]").forEach((node) => {
    const id = Number(node.dataset.finger);
    node.classList.toggle("active", id === gesture);
  });
  renderProgression();
  renderLiveGesturePalette();
  if (typeof window.renderCustomProgression === "function") window.renderCustomProgression();
}

function renderLiveGesturePalette() {
  if (!liveGesturePalette) return;
  const active = currentFinger || pendingFinger || lastConfirmedFinger;
  liveGesturePalette.innerHTML = GESTURE_GUIDE.map((item) => {
    const chord = gestureBindings[item.id] || "--";
    return '<button type="button" class="' + (item.id === active ? "active" : "") + '" data-finger="' + item.id + '">' +
      '<strong>' + effectiveChordName(chord) + '</strong><span>' + chord + ' · ' + item.id + '</span>' +
    '</button>';
  }).join("");
}

function updateBeatMeter(step) {
  if (!beatMeter) return;
  beatMeter.innerHTML = Array.from({ length: 8 }, (_, index) => (
    '<i class="' + (index === step % 8 ? "active" : "") + '"></i>'
  )).join("");
}

function burstStageFx(chordName) {
  if (!effectsLayer || !stageFxEnabled) return;
  const icons = ["♪", "♫", "✦", "♡", "☆", "·"];
  for (let i = 0; i < 8; i += 1) {
    const node = document.createElement("span");
    node.className = "fx-pop";
    node.textContent = icons[(stepIndex + i) % icons.length];
    node.style.left = (24 + Math.random() * 52) + "%";
    node.style.top = (18 + Math.random() * 52) + "%";
    node.style.setProperty("--dx", ((Math.random() - 0.5) * 240) + "px");
    node.style.setProperty("--dy", ((Math.random() - 0.5) * 180) + "px");
    node.style.setProperty("--rot", ((Math.random() - 0.5) * 120) + "deg");
    node.style.color = ["#24e778", "#ffd166", "#ffffff", "#8bd3dd"][i % 4];
    if (i === 0 && chordName) node.textContent = chordName;
    effectsLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 920);
  }
}

function classifyGesture(points) {
  const wrist = points[0];
  const palm = points[9];
  const scale = Math.max(0.05, distance(wrist, palm));
  const open = (tip, pip, mcp) => {
    const tipFar = distance(points[tip], wrist) > distance(points[pip], wrist) + scale * 0.1;
    const awayFromPalm = distance(points[tip], palm) > distance(points[mcp], palm) + scale * 0.18;
    const aboveJoint = points[tip].y < points[pip].y - scale * 0.1;
    return (tipFar && awayFromPalm) || aboveJoint;
  };

  const index = open(8, 6, 5);
  const middle = open(12, 10, 9);
  const ring = open(16, 14, 13);
  const pinky = open(20, 18, 17);
  const thumb = isThumbOpen(points) || distance(points[4], points[17]) > scale * 1.2;

  if (index && !middle && !ring && !pinky) return 1;
  if (index && middle && !ring && !pinky) return 2;
  if (index && middle && ring && !pinky) return 3;
  if (index && middle && ring && pinky) return thumb ? 5 : 4;

  const noThumbCount = [index, middle, ring, pinky].filter(Boolean).length;
  if (noThumbCount >= 1 && noThumbCount <= 4) return noThumbCount;
  if (thumb && noThumbCount === 4) return 5;
  return null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function countExtendedFingers(points) {
  return classifyGesture(points);
}

function renderLyrics() {
  return;
}

function triggerManualFinger(finger) {
  setPendingFinger(finger);
  if (!isPlaying) {
    const ctx = ensureAudio();
    ctx.resume().then(() => switchFingerNow(finger)).catch(() => null);
  }
}

gestureButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-finger]");
  if (button) triggerManualFinger(Number(button.dataset.finger));
});

liveGesturePalette?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-finger]");
  if (button) triggerManualFinger(Number(button.dataset.finger));
});

gestureButtons?.addEventListener("change", (event) => {
  const upload = event.target.closest("[data-chord-upload]");
  if (upload) {
    handleChordUpload(upload).catch(() => {
      if (sampleStatus) setSampleStatus("和弦音频上传失败");
    });
    return;
  }
  const select = event.target.closest("[data-binding]");
  if (!select) return;
  gestureBindings[select.dataset.binding] = select.value;
  saveGestureBindings();
  renderControls();
  updateStatus();
});

async function handleChordUpload(input) {
  const gestureId = Number(input.dataset.chordUpload);
  const chordName = gestureBindings[gestureId];
  const file = input.files?.[0];
  if (!file) return;
  if (!chordName) {
    input.value = "";
    if (sampleStatus) setSampleStatus("请先给这个手势绑定和弦");
    return;
  }
  const ctx = ensureAudio();
  await ctx.resume();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  customChordSamples.set(chordName, { buffer, name: file.name });
  chordStrumCache.delete(chordName + ":strum");
  if (sampleStatus) setSampleStatus("已上传 " + chordName + " 音频：" + file.name);
  renderControls();
  updateStatus();
}

function clearCustomChordSamples() {
  customChordSamples.clear();
  chordStrumCache.clear();
  gestureBindings = defaultBindingsForKey(selectedKey);
  saveGestureBindings();
  stopChordLoop();
  document.querySelectorAll("[data-chord-upload]").forEach((input) => {
    input.value = "";
  });
  refreshProgressionForKey();
  if (sampleStatus) setSampleStatus("已清除上传音频和所有手势绑定");
  renderControls();
  updateStatus();
}

modeButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  playMode = button.dataset.mode;
  // 切到自定义模式时自动开启自定义走向
  if (playMode === "custom") customMelodyEnabled = true;
  renderControls();
  updateStatus();
  // 更新状态提示
  var hint = document.getElementById("customMelodyHint");
  if (hint) hint.textContent = playMode === "custom"
    ? "自定义走向已生效，根音弦自动随和弦变化。"
    : "选择“自定义”演奏方式后，任何音色都可用自定义走向。";
});

clearCustomAudioBtn?.addEventListener("click", clearCustomChordSamples);

playBtn.addEventListener("click", togglePlay);
cameraBtn.addEventListener("click", () => {
  if (cameraActive) {
    stopCamera();
    return;
  }
  startCamera().catch(() => {
    cameraFallback.textContent = "摄像头或模型未就绪，继续使用模拟手势";
    detectStatus.textContent = "识别启动失败，可刷新或稍后再试";
  });
});

autoBtn?.addEventListener("click", () => {
  autoHoldEnabled = !autoHoldEnabled;
  autoBtn.classList.toggle("active", autoHoldEnabled);
  autoBtn.textContent = autoHoldEnabled ? "自动保持和弦" : "松手即停";
});

sparkBtn?.addEventListener("click", () => {
  stageFxEnabled = !stageFxEnabled;
  sparkBtn.classList.toggle("active", stageFxEnabled);
  videoWrap?.classList.toggle("fx-off", !stageFxEnabled);
  sparkBtn.textContent = stageFxEnabled ? "可爱滤镜" : "关闭滤镜";
});

themeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-choice]");
  if (!button) return;
  glassTheme = button.dataset.themeChoice === "light" ? "light" : "dark";
  document.body.dataset.theme = glassTheme;
  updateThemeSwitch();
});

function getProgressionTokens() {
  return (progressionInput?.value || "").split(/[\s,，|]+/).map(normalizeChordSymbol).filter(Boolean);
}

function setProgressionTokens(tokens) {
  if (!progressionInput) return;
  progressionInput.value = tokens.map(normalizeChordSymbol).filter(Boolean).join(" ");
  syncGestureBindingsFromProgression();
  renderControls();
  updateStatus();
}

function appendChordToProgression(chord) {
  const tokens = getProgressionTokens();
  tokens.push(normalizeChordSymbol(chord));
  setProgressionTokens(tokens);
}

function renderChordPicker() {
  if (quickChordRows) {
    quickChordRows.innerHTML = QUICK_CHORD_ROWS.map((row) => (
      '<div class="quick-chord-row">' + row.map((chord) => (
        '<button type="button" class="quick-chord-btn" data-chord="' + chord + '">' +
          '<span>' + chord + '</span>' +
          '<small>' + (findChordFingerInKey(chord) ? findChordFingerInKey(chord) + "指" : "-") + '</small>' +
        '</button>'
      )).join("") + '</div>'
    )).join("");
  }
  if (progressionPresetSelect && !progressionPresetSelect.children.length) {
    progressionPresetSelect.innerHTML = PROGRESSION_PRESETS.map(([value, label]) => (
      '<option value="' + value + '">' + label + '</option>'
    )).join("");
    progressionPresetSelect.value = "";
  }
}

quickChordRows?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chord]");
  if (!button) return;
  appendChordToProgression(button.dataset.chord);
});

clearProgressionBtn?.addEventListener("click", () => {
  setProgressionTokens([]);
  if (progressionPresetSelect) progressionPresetSelect.value = "";
});

progressionPresetSelect?.addEventListener("change", () => {
  if (!progressionPresetSelect.value) return;
  setProgressionTokens(progressionPresetSelect.value.split(/\s+/));
});

mappingText?.addEventListener("change", (event) => {
  const upload = event.target.closest("[data-finger-upload]");
  if (upload) {
    handleFingerAudioUpload(upload).catch(() => {
      if (sampleStatus) setSampleStatus("手指音频上传失败");
    });
    return;
  }
  const select = event.target.closest("[data-bind-finger]");
  if (!select) return;
  const finger = Number(select.dataset.bindFinger);
  const chord = normalizeChordSymbol(select.value);
  if (!finger || !chord) return;
  gestureBindings[finger] = chord;
  saveGestureBindings();
  chordSearchQuery = "";
  renderControls();
  updateStatus();
  renderLyrics();
  warmupSamples().catch(() => null);
});

mappingText?.addEventListener("input", (event) => {
  const input = event.target.closest("#bindingSearchInput");
  if (!input) return;
  chordSearchQuery = input.value;
  renderGestureBindingsEditor();
  const nextInput = document.querySelector("#bindingSearchInput");
  if (nextInput) {
    nextInput.focus();
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  }
});

mappingText?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upload-trigger]");
  if (!button) return;
  const input = mappingText.querySelector('[data-finger-upload="' + button.dataset.uploadTrigger + '"]');
  input?.click();
});

async function handleFingerAudioUpload(input) {
  const finger = Number(input.dataset.fingerUpload);
  const file = input.files?.[0];
  if (!finger || !file) return;
  const ctx = ensureAudio();
  if (ctx.state === "suspended") await ctx.resume();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  customFingerSamples.set(finger, { buffer, name: file.name });
  if (sampleStatus) setSampleStatus("已上传 " + finger + " 指音频：" + file.name);
  renderControls();
  updateStatus();
}

// ── 自定义走向编辑 ──
(function() {
  var container = document.getElementById("customStringButtons");
  var display = document.getElementById("customProgressionDisplay");
  var rootHint = document.getElementById("customRootHint");
  var editBtn = document.getElementById("customEditBtn");
  var saveBtn = document.getElementById("customSaveBtn");
  var clearBtn = document.getElementById("customClearBtn");
  if (!container) return;

  // 生成 6 个弦号按钮
  for (var i = 1; i <= 6; i++) {
    (function(num) {
      var btn = document.createElement("button");
      btn.className = "custom-string-btn";
      btn.dataset.customString = String(num);
      btn.innerHTML = '<span>' + num + '</span><small>弦</small>';
      btn.addEventListener("click", function() {
        if (!customEditing) return;
        customProgression.push(num);
        renderCustomDisplay();
        btn.classList.add("flash");
        window.setTimeout(function() { btn.classList.remove("flash"); }, 160);
      });
      container.appendChild(btn);
    })(i);
  }

  function renderCustomDisplay() {
    if (!display) return;
    var chord = getChordForFinger(currentFinger || pendingFinger || lastConfirmedFinger || 1);
    var chordName = (chord?.chord || chord?.token || "C").replace(/\d+$/, "");
    var realProgression = adaptProgressionToChord(customProgression, chordName);
    if (customProgression.length === 0) {
      display.textContent = "(空) 点弦号录入";
      if (rootHint) rootHint.textContent = "根音自适应已开启";
      return;
    }
    display.innerHTML = customProgression.map(function(stringNumber, index) {
      var real = realProgression[index];
      var extra = stringNumber === real ? "" : '<small>→' + real + '</small>';
      return '<span class="custom-tag">' + stringNumber + extra + '</span>';
    }).join("");
    if (rootHint) rootHint.textContent = "根音自适应已开启 · 当前 " + chordName + " 根音弦 " + getRootStringForChord(chordName);
  }

  window.renderCustomProgression = renderCustomDisplay;

  editBtn?.addEventListener("click", function() {
    customEditing = true;
    customProgression = [];
    container.classList.add("editing");
    renderCustomDisplay();
    editBtn.textContent = "录入中…";
  });

  saveBtn?.addEventListener("click", function() {
    customEditing = false;
    if (customProgression.length === 0) customProgression = defaultStringProgression.slice();
    customMelodyEnabled = true;
    container.classList.remove("editing");
    renderCustomDisplay();
    if (editBtn) editBtn.textContent = "编辑";
    var hint = document.getElementById("customMelodyHint");
    if (hint) hint.textContent = "走向已保存（" + customProgression.length + " 步），根音弦自动随和弦变化。";
  });

  clearBtn?.addEventListener("click", function() {
    customEditing = false;
    customProgression = [];
    container.classList.remove("editing");
    renderCustomDisplay();
    if (editBtn) editBtn.textContent = "编辑";
  });

  renderCustomDisplay();
})();

bpm.addEventListener("input", () => {
  bpmValue.textContent = bpm.value;
});

keySelect?.addEventListener("change", () => {
  const previousKey = selectedKey;
  selectedKey = keySelect.value;
  if (progressionInput?.value) {
    progressionInput.value = transposeProgressionText(progressionInput.value, previousKey, selectedKey);
  }
  currentFinger = null;
  pendingFinger = null;
  resetGestureBindingsForKey();
  renderChordPicker();
  renderControls();
  updateStatus();
  warmupSamples().catch(() => null);
});

progressionInput?.addEventListener("input", () => {
  syncGestureBindingsFromProgression();
  renderControls();
  updateStatus();
});

instrumentSelect?.addEventListener("change", () => {
  selectedInstrument = instrumentSelect.value;
  stopChordLoop();
  ensureSelectedRhythmForInstrument();
  renderControls();
  warmupSamples().catch(() => {
    setSampleStatus("采样失败/兜底");
  });
});

capo?.addEventListener("input", () => {
  capoSemitones = Number(capo.value);
  renderControls();
  updateStatus();
  renderLyrics();
});

rhythmSelect?.addEventListener("change", () => {
  selectedRhythm = rhythmSelect.value;
  const profile = getRhythmProfile();
  bpm.value = String(profile.bpm);
  bpmValue.textContent = bpm.value;
});

drumRhythmSelect?.addEventListener("change", () => {
  selectedDrumRhythm = drumRhythmSelect.value;
});

drumToggle?.addEventListener("change", () => {
  drumsEnabled = drumToggle.checked;
  drumTouchZone?.classList.toggle("active", drumsEnabled);
});
muteToggle?.addEventListener("change", () => { mutedStrum = muteToggle.checked; });
spreadToggle?.addEventListener("change", () => { spreadEnabled = spreadToggle.checked; });
randomToggle?.addEventListener("change", () => {
  randomVelocity = randomToggle.checked;
  updateHumanizeLabel();
});
drumTouchToggle?.addEventListener("change", () => {
  drumTouchEnabled = drumTouchToggle.checked;
  drumTouchZone?.classList.toggle("disabled", !drumTouchEnabled);
});
drumTouchSize?.addEventListener("input", () => {
  applyDrumTouchSize(drumTouchSize.value);
  localStorage.setItem("airGuitarDrumTouchSize", String(drumTouchSizePx));
});
chordSwitchDelay?.addEventListener("input", () => {
  chordSwitchDelayMs = Number(chordSwitchDelay.value);
  if (chordSwitchDelayValue) chordSwitchDelayValue.textContent = chordSwitchDelayMs + "ms";
});
settingsFab?.addEventListener("click", () => setControlsDrawer(true));
controlsOverlay?.addEventListener("click", () => setControlsDrawer(false));
sixMinorBtn?.addEventListener("click", () => {
  pendingFinger = null;
  currentFinger = null;
  const chord = getDiatonicChord(6);
  activeChord.textContent = chord.chord;
  gestureName.textContent = "6m 辅助";
  chord.strings.forEach((note, index) => playSample(applyCapo(note), ensureAudio().currentTime + index * 0.018, 0.17, 1.4));
});
sevenDimBtn?.addEventListener("click", () => {
  pendingFinger = null;
  currentFinger = null;
  const chord = getDiatonicChord(7);
  activeChord.textContent = chord.chord;
  gestureName.textContent = "7dim 辅助";
  chord.strings.forEach((note, index) => playSample(applyCapo(note), ensureAudio().currentTime + index * 0.016, 0.14, 1.1));
});

renderChordPicker();
syncGestureBindingsFromProgression();
renderControls();
updateStatus();
updateThemeSwitch();
updateHumanizeLabel();
if (chordSwitchDelayValue) chordSwitchDelayValue.textContent = chordSwitchDelayMs + "ms";
drumTouchZone?.classList.toggle("active", drumsEnabled);
applyDrumTouchSize(drumTouchSizePx);

// === LoopModule bridge: 把现有 app 的当前手势/和弦/调性暴露给新板块（只读快照）===
window.airGuitarBridge = {
  getCurrentChord() {
    const finger = currentFinger || pendingFinger || lastConfirmedFinger || 1;
    try {
      const chord = getChordForFinger(finger);
      return (chord && chord.chord) || "C";
    } catch { return "C"; }
  },
  getCurrentKey() { return selectedKey || "C"; },
  getCurrentFinger() { return currentFinger || pendingFinger || lastConfirmedFinger || null; },
  getCurrentInstrument() { return selectedInstrument || "guitar"; },
  // 让新板块能复用现有的真实采样播放（吉他用 mg-nylon、电吉他用 rjs，钢琴/铁盒等用合成器）
  triggerNote(note, durationSec = 0.9, gainValue = 0.22) {
    try {
      const ctx = ensureAudio();
      playSample(applyCapo(note), ctx.currentTime + 0.005, gainValue, durationSec);
    } catch (e) { console.warn("airGuitarBridge.triggerNote failed", e); }
  },
};
