import {
  allChordOptions, bindingsFromProgression, defaultBindings, normalizeChord, transposeChord, voiceChord,
} from "./theory.js?v=2.9";
import { BUILTIN_SONGS, parseSheet, guessKey, topChords } from "./songs.js?v=2.9";
import { STRUM_PATTERNS, ARP_PATTERNS, DRUM_PATTERNS, DEFAULT_CUSTOM_STEPS, findById } from "./patterns.js?v=2.9";
import { Engine, INSTRUMENTS } from "./audio.js?v=2.9";
import { classifyHand, GestureStabilizer } from "./gesture.js?v=2.9";

const $ = (sel) => document.querySelector(sel);
const STORE_KEY = "airGuitar.v2";
const FINGERS = [1, 2, 3, 4, 5];
const FINGER_NAMES = { 1: "食指", 2: "食指+中指", 3: "三指", 4: "四指（收拇指）", 5: "五指张开" };

// ---------------- 设置 ----------------
const DEFAULTS = {
  transpose: 0, // 升降调（半音）
  bpm: 88,
  instrument: "acoustic",
  style: "strum",
  strumId: "folk",
  arpId: "classic",
  customSteps: DEFAULT_CUSTOM_STEPS.slice(),
  drumId: "standard",
  drumsOn: true,
  airDrum: true,
  airDrumSize: 120,
  countIn: false,
  hold: false,
  mode: "free", // free 自由弹 / song 跟谱弹唱 / auto 自动走谱
  barsPerChord: 1,
  songId: "p_pop",
  customSongs: [], // 用户导入的文字谱 {id, title, text}
  bindings: defaultBindings("C"),
  guitarVol: 85,
  drumVol: 60,
  humanize: true,
  spread: true,
  stability: 2,
  mirror: true,
  skeleton: true,
  perf: false,
  theme: null,
  introSeen: false,
  tutorialDone: false,
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const merged = { ...DEFAULTS, ...saved, bindings: { ...DEFAULTS.bindings, ...(saved.bindings || {}) } };
    for (const f of FINGERS) merged.bindings[f] = normalizeChord(merged.bindings[f]) || DEFAULTS.bindings[f];
    if (!INSTRUMENTS.some((i) => i.id === merged.instrument)) merged.instrument = DEFAULTS.instrument;
    if (!Array.isArray(merged.customSteps)) merged.customSteps = DEFAULTS.customSteps.slice();
    merged.bpm = clamp(Number(merged.bpm) || 88, 50, 180);
    // 旧版本设置迁移
    if (saved.follow && !saved.mode) merged.mode = "auto";
    if (!["free", "song", "auto"].includes(merged.mode)) merged.mode = "free";
    if (!STRUM_PATTERNS.some((p) => p.id === merged.strumId)) merged.strumId = DEFAULTS.strumId;
    if (!ARP_PATTERNS.some((p) => p.id === merged.arpId)) merged.arpId = DEFAULTS.arpId;
    if (!DRUM_PATTERNS.some((p) => p.id === merged.drumId)) merged.drumId = DEFAULTS.drumId;
    if (!Array.isArray(merged.customSongs)) merged.customSongs = [];
    merged.transpose = clamp(Math.round(Number(merged.transpose) || 0), -6, 6);
    merged.airDrumSize = clamp(Number(merged.airDrumSize) || 120, 60, 220);
    delete merged.key; delete merged.capo; delete merged.progression; delete merged.follow; delete merged.palmMute;
    return merged;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch {}
  }, 150);
}

const settings = loadSettings();
const engine = new Engine();
const customAudio = new Map(); // finger -> {buffer, name}

// ---------------- 演奏状态 ----------------
const state = {
  camFinger: null, // 摄像头稳定结果：null 无手 / 0 握拳 / 1-5
  manualFinger: null, // 按键/键盘按住
  latchedFinger: null, // 无摄像头时点一下锁定
  heldFinger: null, // 保持模式下松手后保留
  activeFinger: null,
  heardChord: null, // 自动走谱时当前听到的和弦
  heardStep: -1,
  cameraOn: false,
  lastLandmarks: null,
  airDrumSince: 0,
  airDrumCooldown: 0,
  airDrumInside: false,
  songPos: 0, // 跟谱弹唱：当前第几个和弦
  autoPos: -1, // 自动走谱：正在响的第几个和弦
  ctaFull: !settings.introSeen, // 摄像头入口：大卡片 / 画面中间的按钮
};

let tracker = null;
let stabilizer = new GestureStabilizer({ frames: settings.stability });

// ---------------- DOM ----------------
const el = {
  app: $("#app"), stage: $("#stage"), video: $("#video"), overlay: $("#overlay"),
  status: $("#status"), statusText: $("#statusText"),
  camBtn: $("#camBtn"), themeBtn: $("#themeBtn"), helpBtn: $("#helpBtn"), settingsBtn: $("#settingsBtn"),
  hudChord: $("#hudChord"), hudMeta: $("#hudMeta"), hudNext: $("#hudNext"), hudLabel: $("#hudLabel"),
  beats: $("#beats"), airDrum: $("#airDrum"), perf: $("#perf"), toast: $("#toast"),
  intro: $("#intro"), guide: $("#guide"), introCam: $("#introCam"), introSkip: $("#introSkip"), camPill: $("#camPill"),
  coach: $("#coach"), coachStep: $("#coachStep"), coachText: $("#coachText"), coachBar: $("#coachBar"), coachSkip: $("#coachSkip"),
  pads: $("#pads"), playBtn: $("#playBtn"), playLabel: $("#playLabel"),
  bpmDown: $("#bpmDown"), bpmUp: $("#bpmUp"), bpmInput: $("#bpmInput"),
  modeSeg: $("#modeSeg"), rhythmChip: $("#rhythmChip"), rhythmChipText: $("#rhythmChipText"),
  sheet: $("#sheet"), sheetClose: $("#sheetClose"), scrim: $("#scrim"),
  instrument: $("#instrument"), styleSeg: $("#styleSeg"), strumPattern: $("#strumPattern"), arpPattern: $("#arpPattern"),
  strumField: $("#strumField"), arpField: $("#arpField"), customField: $("#customField"),
  customSteps: $("#customSteps"), customKeys: $("#customKeys"), customUndo: $("#customUndo"), customReset: $("#customReset"),
  guitarVol: $("#guitarVol"), drumVol: $("#drumVol"),
  humanize: $("#humanize"), spread: $("#spread"),
  drumsOn: $("#drumsOn"), airDrumOn: $("#airDrumOn"), airDrumSize: $("#airDrumSize"), countIn: $("#countIn"), drumPattern: $("#drumPattern"),
  songSelect: $("#songSelect"), songTitle: $("#songTitle"), songText: $("#songText"), songImport: $("#songImport"), songDelete: $("#songDelete"),
  importBox: $("#importBox"), transpose: $("#transpose"),
  lyrics: $("#lyrics"), lyricNow: $("#lyricNow"), lyricNext: $("#lyricNext"),
  barsSeg: $("#barsSeg"), bindings: $("#bindings"),
  holdSeg: $("#holdSeg"), stabilitySeg: $("#stabilitySeg"),
  mirror: $("#mirror"), skeleton: $("#skeleton"), perfOn: $("#perfOn"), resetAll: $("#resetAll"),
};
const ctx2d = el.overlay.getContext("2d");

// ---------------- 工具 ----------------
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function fingersGlyph(n) {
  return `<span class="fingers" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => {
    // 1-4 指从食指开始数，5 指含拇指
    const up = n === 5 ? true : i >= 2 && i <= n + 1;
    return `<i class="${up ? "up" : ""}"></i>`;
  }).join("")}</span>`;
}
function soundingName(shape) { return transposeChord(shape, settings.transpose); }

// ---------------- 歌曲 ----------------
let song = null; // {id, title, key, lines, sequence}
function allSongs() { return [...settings.customSongs, ...BUILTIN_SONGS]; }

function loadSong(id, { rebind = true } = {}) {
  const src = allSongs().find((x) => x.id === id) || BUILTIN_SONGS.find((x) => x.id === DEFAULTS.songId);
  const parsed = parseSheet(src.text);
  song = { ...src, ...parsed, key: src.key || guessKey(parsed.sequence) };
  if (!song.sequence.length) song.sequence = [{ name: "C", line: 0 }];
  settings.songId = song.id;
  state.songPos = 0;
  state.autoPos = -1;
  if (rebind) settings.bindings = bindingsFromProgression(topChords(song.sequence, 5), song.key);
}

function songChordAt(pos) {
  const item = song.sequence[((pos % song.sequence.length) + song.sequence.length) % song.sequence.length];
  return chordObj(item.name);
}

function setSongPos(pos) {
  const n = song.sequence.length;
  state.songPos = ((pos % n) + n) % n;
}

function chordObj(shape, finger = null) {
  const name = soundingName(shape);
  return { shape, name, voicing: voiceChord(name), custom: finger ? customAudio.get(finger)?.buffer || null : null, finger };
}

let toastTimer = null;
function toast(text, ms = 3200) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms);
}

function setStatus(text, kind = "idle") {
  el.statusText.textContent = text;
  el.status.dataset.state = kind;
}

function setSeg(seg, value) {
  seg.querySelectorAll("[data-value]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === String(value))));
}

function chordFor(finger) {
  if (!finger) return null;
  if (settings.mode === "song") return songChordAt(state.songPos);
  const shape = settings.bindings[finger];
  if (!shape) return null;
  return chordObj(shape, finger);
}

function fingerOfShape(shape) {
  const f = FINGERS.find((n) => settings.bindings[n] === shape);
  return f || null;
}

// ---------------- 引擎同步 ----------------
function applyEngineSettings() {
  engine.instrument = settings.instrument;
  engine.playStyle = settings.style;
  engine.strumId = settings.strumId;
  engine.arpId = settings.arpId;
  engine.customSteps = settings.customSteps.slice();
  engine.drumId = settings.drumId;
  engine.drumsOn = settings.drumsOn;
  engine.bpm = settings.bpm;
  engine.capo = 0; // 升降调直接换和弦排布，不靠变调夹
  engine.humanize = settings.humanize;
  engine.spread = settings.spread;
  engine.countIn = settings.countIn;
  engine.followMode = settings.mode === "auto";
  engine.barsPerChord = settings.barsPerChord;
  engine.progression = progressionChords();
  engine.setVolumes(settings.guitarVol / 100, settings.drumVol / 100);
}

function progressionChords() {
  return song.sequence.map((c) => chordObj(c.name));
}

function neededMidis() {
  const shapes = new Set([...Object.values(settings.bindings), ...song.sequence.map((c) => c.name)]);
  const midis = [];
  shapes.forEach((sh) => voiceChord(soundingName(sh)).strings.forEach((m) => { if (m !== null) midis.push(m); }));
  return midis;
}

let instrumentLoad = null;
function loadInstrument() {
  instrumentLoad = engine.loadInstrument(settings.instrument, neededMidis());
  return instrumentLoad;
}

engine.onLoadState = (stateName, detail) => {
  if (stateName === "loading") {
    if (!state.cameraOn) setStatus(`加载${detail.name} ${detail.done}/${detail.total}`, "busy");
  } else if (stateName === "failed") {
    toast("音色采样没下载成功，先用合成音兜底；网络恢复后切换一次音色即可重试。");
    refreshStatus();
  } else {
    refreshStatus();
  }
};

function refreshStatus() {
  if (state.cameraOn) setStatus("识别中 · 伸出 1–5 根手指", "live");
  else setStatus(engine.running ? "伴奏中 · 用按键或数字键换和弦" : "摄像头未开启", engine.running ? "live" : "idle");
}

// ---------------- 和弦选择逻辑 ----------------
function computeFinger() {
  if (state.manualFinger) return state.manualFinger;
  if (state.camFinger && state.camFinger > 0) return state.camFinger;
  if (state.latchedFinger) return state.latchedFinger;
  if (settings.hold && state.camFinger !== 0 && state.heldFinger) return state.heldFinger;
  return null;
}

function updateChord(force = false) {
  const finger = computeFinger();
  if (finger) state.heldFinger = finger;
  if (state.camFinger === 0) state.heldFinger = null;
  if (finger === state.activeFinger && !force) return;
  state.activeFinger = finger;
  engine.setChord(chordFor(finger));
  renderLive();
}

async function pressFinger(finger, { latch = false } = {}) {
  await ensureAudioReady();
  if (latch) {
    // 伴奏中再点一次同一个和弦 = 停；没伴奏时再点 = 再扫一下
    if (engine.running && state.latchedFinger === finger && state.activeFinger === finger) {
      state.latchedFinger = null;
      state.heldFinger = null;
      updateChord();
      return;
    }
    state.latchedFinger = finger;
  } else {
    state.manualFinger = finger;
  }
  if (computeFinger() === state.activeFinger && !engine.running) {
    engine.preview(chordFor(finger));
    return;
  }
  updateChord();
}

function releaseFinger(finger) {
  if (state.manualFinger === finger) {
    state.manualFinger = null;
    updateChord();
  }
}

function muteAll() {
  state.latchedFinger = null;
  state.heldFinger = null;
  state.manualFinger = null;
  updateChord(true);
}

let audioReady = false;
async function ensureAudioReady() {
  const ok = await engine.unlock();
  if (!audioReady && ok) {
    audioReady = true;
    applyEngineSettings();
    if (!instrumentLoad) loadInstrument();
  }
  return ok;
}

// ---------------- 渲染 ----------------
function songWindowStart() {
  const pos = settings.mode === "auto" ? Math.max(0, state.autoPos) : state.songPos;
  return Math.max(0, Math.min(pos - 1, song.sequence.length - 5));
}

function renderPads() {
  if (settings.mode !== "free") {
    // 跟谱 / 自动：按键显示歌里接下来的和弦，点哪个就跳到哪个
    const start = songWindowStart();
    const cur = settings.mode === "auto" ? state.autoPos : state.songPos;
    el.pads.innerHTML = Array.from({ length: Math.min(5, song.sequence.length) }, (_, k) => {
      const pos = start + k;
      const name = soundingName(song.sequence[pos].name);
      const label = pos === cur ? "现在" : pos < cur ? "上一个" : pos === cur + 1 ? "下一个" : "之后";
      return `<button type="button" class="pad${pos === cur ? " active" : ""}" data-pos="${pos}" aria-label="${label}：${escapeHtml(name)}">
        <span class="pad-top"><span>${label}</span><span>${pos + 1}/${song.sequence.length}</span></span>
        <span class="pad-chord">${escapeHtml(name)}</span>
      </button>`;
    }).join("");
    renderLyrics();
    return;
  }
  el.pads.innerHTML = FINGERS.map((f) => {
    const name = soundingName(settings.bindings[f]);
    return `<button type="button" class="pad" data-finger="${f}" aria-label="${f} 指：${escapeHtml(name)}">
      <span class="pad-top">${fingersGlyph(f)}<span>${f}</span></span>
      <span class="pad-chord">${escapeHtml(name)}</span>
    </button>`;
  }).join("");
  renderLyrics();
}

function lyricLineHtml(li, cur) {
  const line = song.lines[li];
  if (!line) return "";
  const segs = [];
  const chords = line.chords;
  if (!chords.length) return `<span class="lyric-seg"><span class="ch"></span><span class="tx">${escapeHtml(line.text)}</span></span>`;
  if (chords[0].at > 0) segs.push(`<span class="lyric-seg"><span class="ch"></span><span class="tx">${escapeHtml(line.text.slice(0, chords[0].at))}</span></span>`);
  chords.forEach((c, k) => {
    const text = line.text.slice(c.at, k + 1 < chords.length ? chords[k + 1].at : undefined);
    const cls = c.seq === cur ? " cur" : c.seq < cur ? " past" : "";
    segs.push(`<span class="lyric-seg${cls}"><span class="ch">${escapeHtml(soundingName(c.name))}</span><span class="tx">${escapeHtml(text) || "&nbsp;"}</span></span>`);
  });
  return segs.join("");
}

function renderLyrics() {
  const show = settings.mode !== "free";
  el.lyrics.hidden = !show;
  if (!show) return;
  const cur = settings.mode === "auto" ? Math.max(0, state.autoPos) : state.songPos;
  const li = song.sequence[cur]?.line ?? 0;
  el.lyricNow.innerHTML = lyricLineHtml(li, cur);
  const nextLi = li + 1 < song.lines.length ? li + 1 : 0;
  el.lyricNext.innerHTML = song.lines.length > 1 ? lyricLineHtml(nextLi, cur) : "";
}

let lastHudName = null;
function renderLive() {
  const finger = state.activeFinger;
  const follow = settings.mode === "auto" && engine.running;
  let name = null;
  let meta = "";
  if (settings.mode === "song") {
    const next = songChordAt(state.songPos + 1).name;
    if (finger) {
      name = songChordAt(state.songPos).name;
      meta = state.cameraOn ? `换一个手势 → 下一个和弦 ${next}` : `点「下一个」或按 → 键 → ${next}`;
    } else {
      meta = state.cameraOn ? "伸出手指开始弹；每换一次手势，就走到下一个和弦" : "点下方的和弦开始弹";
    }
  } else if (follow && state.heardChord) {
    name = state.heardChord.name;
    const f = fingerOfShape(state.heardChord.shape);
    meta = f ? `比 ${f} 根手指跟着弹` : "这个和弦没绑手指，听着唱就好";
  } else if (finger) {
    const chord = chordFor(finger);
    name = chord?.name || null;
    meta = `${finger} 根手指 · ${FINGER_NAMES[finger]}`;
  } else {
    meta = state.cameraOn
      ? (state.camFinger === 0 ? "握拳：静音" : state.lastLandmarks ? "看到手了，伸出 1–5 根手指" : "把手放进画面")
      : "点下方和弦，或按数字键 1–5";
  }
  el.hudLabel.textContent = settings.mode === "song" ? `跟谱弹唱 · ${song.title}`
    : settings.mode === "auto" ? `自动走谱 · ${song.title}` : settings.hold ? "当前和弦 · 保持" : "当前和弦";
  el.hudChord.textContent = name || "—";
  el.hudChord.classList.toggle("idle", !name);
  if (name && name !== lastHudName) {
    el.hudChord.classList.remove("pop");
    void el.hudChord.offsetWidth;
    el.hudChord.classList.add("pop");
  }
  lastHudName = name;
  el.hudMeta.textContent = meta;

  // 自动走谱：只管唱，提示下一个和弦
  if (settings.mode === "auto") {
    const idx = engine.running ? Math.max(0, state.autoPos) : 0;
    const next = songChordAt(idx + (engine.running ? 1 : 0));
    el.hudNext.hidden = false;
    el.hudNext.innerHTML = `${engine.running ? "下一个" : "点「开始伴奏」从这里开始"} <b>${escapeHtml(next.name)}</b>`;
  } else {
    el.hudNext.hidden = true;
  }

  if (settings.mode === "free") {
    el.pads.querySelectorAll(".pad").forEach((pad) => {
      pad.classList.toggle("active", Number(pad.dataset.finger) === finger);
    });
  }
  checkTutorial();
}

function renderBeats(stepInfo) {
  const spb = engine.stepsPerBar;
  if (el.beats.childElementCount !== spb) {
    el.beats.innerHTML = Array.from({ length: spb }, (_, i) => `<i class="${i % 2 === 0 ? "beat" : ""}"></i>`).join("");
  }
  const nodes = el.beats.children;
  for (let i = 0; i < nodes.length; i += 1) {
    const on = stepInfo && i === stepInfo.slot;
    nodes[i].classList.toggle("on", Boolean(on && !stepInfo.countIn));
    nodes[i].classList.toggle("count", Boolean(on && stepInfo.countIn));
  }
}

function renderPlay() {
  el.playBtn.setAttribute("aria-pressed", String(engine.running));
  el.playLabel.textContent = engine.running ? "停止" : "开始伴奏";
  checkTutorial();
}

function renderRhythmChip() {
  const name = settings.style === "strum"
    ? findById(STRUM_PATTERNS, settings.strumId).name
    : settings.style === "arp" ? findById(ARP_PATTERNS, settings.arpId).name.split(" ")[0] : "自定义分解";
  el.rhythmChipText.textContent = `${name} · ${findById(DRUM_PATTERNS, settings.drumId).name}`;
}

function renderAirDrum() {
  el.airDrum.hidden = !settings.airDrum;
  el.stage.style.setProperty("--air-drum-size", `${settings.airDrumSize}px`);
  el.airDrum.setAttribute("aria-pressed", String(settings.drumsOn));
  el.drumsOn.checked = settings.drumsOn;
}

function renderGuide() {
  el.guide.innerHTML = FINGERS.map((f) => `<li>${fingersGlyph(f)}<b>${escapeHtml(soundingName(settings.bindings[f]))}</b><span>${f} 指</span></li>`).join("");
}

function renderBindings() {
  const options = allChordOptions();
  el.bindings.innerHTML = FINGERS.map((f) => {
    const cur = settings.bindings[f];
    const opts = (options.includes(cur) ? options : [cur, ...options])
      .map((c) => `<option value="${c}"${c === cur ? " selected" : ""}>${c}${settings.transpose ? `（升降后 ${soundingName(c)}）` : ""}</option>`).join("");
    const up = customAudio.get(f);
    return `<div class="binding">
      <span class="binding-finger">${fingersGlyph(f)}${f}</span>
      <select data-bind="${f}" aria-label="${f} 指和弦">${opts}</select>
      <button type="button" class="upload${up ? " has" : ""}" data-upload="${f}" title="${up ? `已用「${escapeHtml(up.name)}」，点击移除` : "上传自己的音频替代这个和弦"}" aria-label="${f} 指自定义音频">
        <svg viewBox="0 0 24 24">${up ? '<path d="M6 6l12 12M18 6 6 18"/>' : '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'}</svg>
      </button>
    </div>`;
  }).join("");
}

function renderCustom() {
  const steps = settings.customSteps;
  el.customSteps.innerHTML = steps.length
    ? steps.map((s, i) => `<span data-i="${i}">${s}</span>`).join("")
    : "<em>空 · 点下面的弦号录入</em>";
  if (!el.customKeys.childElementCount) {
    el.customKeys.innerHTML = ["R", 6, 5, 4, 3, 2, 1].map((s) => `<button type="button" data-step="${s}" title="${s === "R" ? "根音弦" : `${s} 弦`}">${s}</button>`).join("");
  }
}

function renderSettings() {
  el.instrument.value = settings.instrument;
  setSeg(el.styleSeg, settings.style);
  el.strumField.hidden = settings.style !== "strum";
  el.arpField.hidden = settings.style !== "arp";
  el.customField.hidden = settings.style !== "custom";
  el.strumPattern.value = settings.strumId;
  el.arpPattern.value = settings.arpId;
  el.guitarVol.value = settings.guitarVol;
  el.drumVol.value = settings.drumVol;
  el.humanize.checked = settings.humanize;
  el.spread.checked = settings.spread;
  el.drumsOn.checked = settings.drumsOn;
  el.airDrumOn.checked = settings.airDrum;
  el.countIn.checked = settings.countIn;
  el.drumPattern.value = settings.drumId;
  fillSongs();
  el.transpose.value = String(settings.transpose);
  el.songDelete.hidden = !settings.customSongs.some((x) => x.id === settings.songId);
  el.airDrumSize.value = settings.airDrumSize;
  setSeg(el.barsSeg, settings.barsPerChord);
  setSeg(el.holdSeg, settings.hold ? "hold" : "stop");
  setSeg(el.stabilitySeg, settings.stability);
  setSeg(el.modeSeg, settings.mode);
  el.mirror.checked = settings.mirror;
  el.skeleton.checked = settings.skeleton;
  el.perfOn.checked = settings.perf;
  el.perf.hidden = !settings.perf;
  el.stage.classList.toggle("mirror", settings.mirror);
  el.bpmInput.value = settings.bpm;
  renderBindings();
  renderCustom();
  renderRhythmChip();
  renderAirDrum();
  renderGuide();
}

function fillSelects() {
  el.instrument.innerHTML = INSTRUMENTS.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
  el.strumPattern.innerHTML = STRUM_PATTERNS.map((p) => `<option value="${p.id}">${p.name}  ·  ${p.pattern.split("").join(" ")}</option>`).join("");
  el.arpPattern.innerHTML = ARP_PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  el.drumPattern.innerHTML = DRUM_PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  el.transpose.innerHTML = Array.from({ length: 13 }, (_, k) => {
    const v = k - 6;
    const label = v === 0 ? "原调" : v > 0 ? `升 ${v} 个半音（更高）` : `降 ${-v} 个半音（更低）`;
    return `<option value="${v}">${label}</option>`;
  }).join("");
}

function fillSongs() {
  const mine = settings.customSongs.map((x) => `<option value="${escapeHtml(x.id)}">我导入的：${escapeHtml(x.title)}</option>`).join("");
  const songs = BUILTIN_SONGS.filter((x) => !x.id.startsWith("p_")).map((x) => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join("");
  const practice = BUILTIN_SONGS.filter((x) => x.id.startsWith("p_")).map((x) => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join("");
  el.songSelect.innerHTML = (mine ? `<optgroup label="我导入的歌">${mine}</optgroup>` : "")
    + `<optgroup label="内置歌曲（公有领域）">${songs}</optgroup><optgroup label="和弦练习">${practice}</optgroup>`;
  el.songSelect.value = settings.songId;
}

function useSong(id) {
  loadSong(id);
  changed({ rerenderPads: true, reload: true });
  renderSettings();
}

// ---------------- 设置变更 ----------------
function changed({ rerenderPads = false, reload = false } = {}) {
  applyEngineSettings();
  save();
  if (rerenderPads) { renderPads(); renderGuide(); renderBindings(); }
  renderLive();
  renderRhythmChip();
  if (reload && audioReady) loadInstrument();
  updateChord(true);
}

function onSeg(seg, handler) {
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-value]");
    if (!b) return;
    setSeg(seg, b.dataset.value);
    handler(b.dataset.value);
  });
}

function bindSettings() {
  el.instrument.addEventListener("change", () => {
    settings.instrument = el.instrument.value;
    changed({ reload: true });
    ensureAudioReady().then(() => {
      loadInstrument();
      const c = chordFor(state.activeFinger || 1);
      if (!engine.running && c) setTimeout(() => engine.preview(c), 60);
    });
  });
  onSeg(el.styleSeg, (v) => {
    settings.style = v;
    renderSettings();
    changed();
  });
  el.strumPattern.addEventListener("change", () => {
    settings.strumId = el.strumPattern.value;
    const p = findById(STRUM_PATTERNS, settings.strumId);
    setBpm(p.bpm);
    changed();
  });
  el.arpPattern.addEventListener("change", () => { settings.arpId = el.arpPattern.value; changed(); });
  el.customKeys.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b || settings.customSteps.length >= 16) return;
    const v = b.dataset.step === "R" ? "R" : Number(b.dataset.step);
    settings.customSteps.push(v);
    renderCustom();
    changed();
    // 录入时顺便听一下这个音
    ensureAudioReady().then(() => {
      const c = chordFor(state.activeFinger || 1);
      if (c && !engine.running) engine.pluckString(c.voicing, engine.ctx.currentTime + 0.01, v, 0.7);
    });
  });
  el.customUndo.addEventListener("click", () => { settings.customSteps.pop(); renderCustom(); changed(); });
  el.customReset.addEventListener("click", () => { settings.customSteps = DEFAULT_CUSTOM_STEPS.slice(); renderCustom(); changed(); });
  el.guitarVol.addEventListener("input", () => { settings.guitarVol = Number(el.guitarVol.value); applyEngineSettings(); save(); });
  el.drumVol.addEventListener("input", () => { settings.drumVol = Number(el.drumVol.value); applyEngineSettings(); save(); });
  el.humanize.addEventListener("change", () => { settings.humanize = el.humanize.checked; changed(); });
  el.spread.addEventListener("change", () => { settings.spread = el.spread.checked; changed(); });
  el.drumsOn.addEventListener("change", () => { setDrums(el.drumsOn.checked); });
  el.airDrumOn.addEventListener("change", () => { settings.airDrum = el.airDrumOn.checked; renderAirDrum(); save(); resizeOverlay(); });
  el.airDrumSize.addEventListener("input", () => { settings.airDrumSize = Number(el.airDrumSize.value); renderAirDrum(); save(); requestAnimationFrame(resizeOverlay); });
  el.countIn.addEventListener("change", () => { settings.countIn = el.countIn.checked; changed(); });
  el.drumPattern.addEventListener("change", () => { settings.drumId = el.drumPattern.value; changed(); });
  el.transpose.addEventListener("change", () => {
    settings.transpose = Number(el.transpose.value);
    changed({ rerenderPads: true, reload: true });
  });
  el.songSelect.addEventListener("change", () => {
    useSong(el.songSelect.value);
    toast(`已选「${song.title}」，共 ${song.sequence.length} 个和弦`);
  });
  el.songImport.addEventListener("click", () => {
    const text = el.songText.value.trim();
    const parsed = parseSheet(text);
    if (!parsed.sequence.length) {
      toast("没认出和弦。和弦要用 C、Am、G7 这样的写法，放在方括号里或单独一行在歌词上面。", 5000);
      return;
    }
    const title = el.songTitle.value.trim() || `导入的歌 ${settings.customSongs.length + 1}`;
    const id = `u_${Date.now().toString(36)}`;
    settings.customSongs.unshift({ id, title, text });
    el.songText.value = "";
    el.songTitle.value = "";
    el.importBox.open = false;
    useSong(id);
    if (settings.mode === "free") {
      settings.mode = "song";
      changed({ rerenderPads: true });
      renderSettings();
    }
    toast(`识别到 ${parsed.lines.length} 行、${parsed.sequence.length} 个和弦，已切到「跟谱弹唱」`, 4000);
  });
  el.songDelete.addEventListener("click", () => {
    const item = settings.customSongs.find((x) => x.id === settings.songId);
    if (!item || !confirm(`删除「${item.title}」？`)) return;
    settings.customSongs = settings.customSongs.filter((x) => x.id !== item.id);
    useSong(DEFAULTS.songId);
  });
  onSeg(el.barsSeg, (v) => { settings.barsPerChord = Number(v); changed(); });
  el.bindings.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-bind]");
    if (!sel) return;
    settings.bindings[sel.dataset.bind] = normalizeChord(sel.value) || settings.bindings[sel.dataset.bind];
    changed({ rerenderPads: true, reload: settings.instrument === "piano" || settings.instrument === "violin" });
  });
  el.bindings.addEventListener("click", (e) => {
    const b = e.target.closest("[data-upload]");
    if (!b) return;
    const f = Number(b.dataset.upload);
    if (customAudio.has(f)) {
      customAudio.delete(f);
      renderBindings();
      updateChord(true);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.mp3,.wav,.m4a,.aac,.ogg";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await ensureAudioReady();
        const ab = await file.arrayBuffer();
        const buffer = await new Promise((res, rej) => engine.ctx.decodeAudioData(ab, res, rej));
        customAudio.set(f, { buffer, name: file.name });
        renderBindings();
        toast(`${f} 指已换成「${file.name}」，每小节开头播放一次`);
        updateChord(true);
      } catch {
        toast("这个音频文件解不开，换个 mp3 / wav / m4a 试试");
      }
    });
    input.click();
  });
  onSeg(el.holdSeg, (v) => { settings.hold = v === "hold"; if (!settings.hold) state.heldFinger = null; save(); updateChord(true); });
  onSeg(el.stabilitySeg, (v) => { settings.stability = Number(v); stabilizer.frames = settings.stability; save(); });
  el.mirror.addEventListener("change", () => { settings.mirror = el.mirror.checked; el.stage.classList.toggle("mirror", settings.mirror); save(); });
  el.skeleton.addEventListener("change", () => { settings.skeleton = el.skeleton.checked; if (!settings.skeleton) clearOverlay(); save(); });
  el.perfOn.addEventListener("change", () => { settings.perf = el.perfOn.checked; el.perf.hidden = !settings.perf; save(); });
  el.resetAll.addEventListener("click", () => {
    if (!confirm("恢复全部默认设置？自定义的和弦绑定和走向会被清掉。")) return;
    const theme = settings.theme;
    const customSongs = settings.customSongs;
    Object.assign(settings, structuredClone(DEFAULTS), { theme, introSeen: true, tutorialDone: true, customSongs });
    customAudio.clear();
    loadSong(settings.songId);
    renderSettings();
    changed({ rerenderPads: true, reload: true });
    toast("已恢复默认设置");
  });
}

function setBpm(v) {
  settings.bpm = clamp(Math.round(Number(v) || settings.bpm), 50, 180);
  el.bpmInput.value = settings.bpm;
  engine.bpm = settings.bpm;
  save();
}

function setDrums(on) {
  settings.drumsOn = on;
  engine.drumsOn = on;
  renderAirDrum();
  save();
}

// ---------------- 面板 ----------------
const desktopMq = matchMedia("(min-width: 1100px)");
function isDesktop() { return desktopMq.matches; }
function openSheet(open) {
  if (isDesktop()) {
    el.app.classList.toggle("sheet-collapsed", !open);
    el.app.classList.remove("sheet-open");
  } else {
    el.app.classList.toggle("sheet-open", open);
    el.scrim.hidden = !open;
  }
  el.sheet.setAttribute("aria-hidden", String(!open));
  el.settingsBtn.setAttribute("aria-expanded", String(open));
  requestAnimationFrame(resizeOverlay);
}
function sheetIsOpen() {
  return isDesktop() ? !el.app.classList.contains("sheet-collapsed") : el.app.classList.contains("sheet-open");
}
desktopMq.addEventListener?.("change", () => openSheet(isDesktop()));

// ---------------- 主题 ----------------
function applyTheme() {
  const theme = settings.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
  accentColor = getComputedStyle(document.documentElement).getPropertyValue("--stage-highlight").trim() || accentColor;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#FFFFFF";
}

// ---------------- 摄像头 ----------------
async function toggleCamera() {
  if (state.cameraOn) return stopCamera();
  return startCamera();
}

async function startCamera() {
  ensureAudioReady();
  el.camBtn.disabled = true;
  el.introCam.disabled = true;
  el.camPill.disabled = true;
  el.introCam.querySelector("span").textContent = "正在打开…";
  try {
    if (!tracker) {
      const { HandTracker } = await import("./hands.js?v=2.9");
      tracker = new HandTracker(el.video, {
        onResult: onHands,
        onStatus: (s) => {
          if (s === "camera") setStatus("等待摄像头授权…", "busy");
          if (s === "model") setStatus("加载手势模型…", "busy");
        },
      });
    }
    await tracker.start();
    state.cameraOn = true;
    el.stage.classList.add("live");
    el.camBtn.classList.add("on");
    el.camBtn.setAttribute("aria-label", "关闭摄像头");
    stabilizer = new GestureStabilizer({ frames: settings.stability });
    state.latchedFinger = null;
    hideIntro();
    if (tut.active && tut.track === "keys") { tut.track = "camera"; tut.i = 1; }
    resizeOverlay();
    refreshStatus();
    checkTutorial();
    if (tracker.delegate === "CPU") toast("设备不支持 GPU 加速，识别会稍慢一些");
  } catch (error) {
    const messages = {
      denied: "摄像头权限被拒绝了。在浏览器地址栏旁的权限设置里允许摄像头，再点一次。",
      nocamera: "没找到摄像头。可以用下方按键或数字键 1–5 来弹。",
      insecure: "摄像头需要 https 或 localhost 打开页面。",
      unsupported: "这个浏览器不支持摄像头，换 Chrome / Safari / Edge 试试。",
      model: "手势模型没下载下来，检查网络后再点一次摄像头按钮。",
    };
    setStatus("摄像头未开启", "error");
    toast(messages[error.code] || "摄像头没能打开，稍后再试。", 6000);
  } finally {
    el.camBtn.disabled = false;
    el.introCam.disabled = false;
    el.camPill.disabled = false;
    updateCta();
  }
}

function stopCamera() {
  tracker?.stop();
  state.cameraOn = false;
  state.camFinger = null;
  state.lastLandmarks = null;
  stabilizer.reset();
  el.stage.classList.remove("live");
  el.camBtn.classList.remove("on");
  el.camBtn.setAttribute("aria-label", "开启摄像头");
  clearOverlay();
  refreshStatus();
  updateChord();
  updateCta();
}

function onHands(result, now) {
  const lm = result.landmarks?.[0] || null;
  state.lastLandmarks = lm;
  const vw = el.video.videoWidth || 640;
  const vh = el.video.videoHeight || 480;
  const count = lm ? classifyHand(lm, vw / vh).count : undefined;
  const changedNow = stabilizer.push(count, now);
  if (changedNow) {
    const prev = state.camFinger;
    state.camFinger = stabilizer.stable;
    // 跟谱弹唱：从一个手势换成另一个手势（都是伸着手指）= 走到下一个和弦
    if (settings.mode === "song" && prev > 0 && state.camFinger > 0 && prev !== state.camFinger) {
      setSongPos(state.songPos + 1);
      updateChord(true);
      renderPads();
    } else {
      updateChord();
    }
    renderLive();
  }
  if (settings.skeleton) drawHand(lm, vw, vh);
  if (settings.airDrum && lm) checkAirDrum(lm, vw, vh, now);
  else el.airDrum.classList.remove("armed");
  if (!changedNow && !lm !== !lastHadHand) renderLive();
  lastHadHand = Boolean(lm);
}
let lastHadHand = false;

// 画面坐标换算：video 是 object-fit: cover，可能镜像
function mapPoint(p, vw, vh, cw, ch) {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const x = (settings.mirror ? 1 - p.x : p.x) * dw + (cw - dw) / 2;
  const y = p.y * dh + (ch - dh) / 2;
  return [x, y];
}

let overlaySize = { w: 0, h: 0, dpr: 1 };
let airDrumBox = null; // 相对舞台的坐标，缩放时更新，避免每帧读布局
let accentColor = "#ABD1C6";
function resizeOverlay() {
  const rect = el.stage.getBoundingClientRect();
  const z = el.airDrum.getBoundingClientRect();
  airDrumBox = { l: z.left - rect.left, t: z.top - rect.top, r: z.right - rect.left, b: z.bottom - rect.top };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  overlaySize = { w: rect.width, h: rect.height, dpr };
  el.overlay.width = Math.round(rect.width * dpr);
  el.overlay.height = Math.round(rect.height * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(() => resizeOverlay()).observe(el.stage);

function clearOverlay() {
  ctx2d.clearRect(0, 0, overlaySize.w, overlaySize.h);
}

const BONES = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
function drawHand(lm, vw, vh) {
  clearOverlay();
  if (!lm) return;
  const { w, h } = overlaySize;
  const pts = lm.map((p) => mapPoint(p, vw, vh, w, h));
  ctx2d.lineCap = "round";
  ctx2d.lineJoin = "round";
  ctx2d.strokeStyle = "rgba(255,255,255,0.7)";
  ctx2d.lineWidth = 2.5;
  ctx2d.beginPath();
  for (const chain of BONES) {
    chain.forEach((idx, i) => {
      const [x, y] = pts[idx];
      if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
    });
  }
  ctx2d.stroke();
  ctx2d.fillStyle = accentColor;
  for (const idx of [4, 8, 12, 16, 20]) {
    const [x, y] = pts[idx];
    ctx2d.beginPath();
    ctx2d.arc(x, y, 5, 0, Math.PI * 2);
    ctx2d.fill();
  }
}

// 手（任意指尖）一碰到「鼓」就切换，不用停留；手要先离开再碰才会再次切换，避免来回闪
function checkAirDrum(lm, vw, vh, now) {
  if (!airDrumBox) return;
  const pad = 8;
  const z = airDrumBox;
  const inside = [4, 8, 12, 16, 20].some((i) => {
    const [x, y] = mapPoint(lm[i], vw, vh, overlaySize.w, overlaySize.h);
    return x >= z.l - pad && x <= z.r + pad && y >= z.t - pad && y <= z.b + pad;
  });
  el.airDrum.classList.toggle("armed", inside);
  if (inside && !state.airDrumInside && now > state.airDrumCooldown) {
    setDrums(!settings.drumsOn);
    state.airDrumCooldown = now + 600;
    el.airDrum.classList.remove("hit");
    void el.airDrum.offsetWidth;
    el.airDrum.classList.add("hit");
    toast(settings.drumsOn ? "鼓：开" : "鼓：关", 1000);
  }
  state.airDrumInside = inside;
}

// 跟谱弹唱：点按键 / 键盘跳到某个和弦并弹出来
async function jumpSong(pos) {
  await ensureAudioReady();
  setSongPos(pos);
  if (!state.cameraOn) state.latchedFinger = 1;
  const chord = chordFor(1);
  state.activeFinger = computeFinger() || 1;
  if (engine.running) engine.setChord(chord);
  else { engine.chord = chord; engine.preview(chord); }
  renderPads();
  renderLive();
}

// ---------------- 伴奏 ----------------
let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {}
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch {}
  wakeLock = null;
}

async function togglePlay() {
  if (engine.running) {
    engine.stop();
    state.heardChord = null;
    state.heardStep = -1;
    state.autoPos = -1;
    releaseWakeLock();
    renderPlay();
    renderBeats(null);
    refreshStatus();
    renderLive();
    return;
  }
  const ok = await ensureAudioReady();
  if (!ok) {
    toast("浏览器没允许播放声音，再点一次试试");
    return;
  }
  if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) tut.track = "keys"; }
  applyEngineSettings();
  engine.chord = chordFor(state.activeFinger);
  await engine.start();
  requestWakeLock();
  renderPlay();
  refreshStatus();
  renderLive();
}

// 每帧：节拍灯、自动走谱 HUD、性能信息
let perfTick = 0;
function frame(now) {
  if (engine.running) {
    const info = engine.drainUI();
    if (info) {
      renderBeats(info);
      if (!info.countIn) {
        state.heardStep = info.i;
        if (settings.mode === "auto") {
          const prog = engine.progression;
          const bar = Math.floor(info.i / engine.stepsPerBar);
          const idx = Math.floor(bar / settings.barsPerChord) % prog.length;
          if (idx !== state.autoPos) {
            state.autoPos = idx;
            state.heardChord = prog[idx];
            renderPads();
            renderLive();
          }
        }
      }
    }
  }
  if (settings.perf && now - perfTick > 500) {
    perfTick = now;
    const parts = [];
    if (tracker?.active) parts.push(`识别 ${tracker.stats.fps}fps`, `推理 ${tracker.stats.inferMs.toFixed(1)}ms`, tracker.delegate);
    const lat = engine.latencyMs;
    if (lat !== null) parts.push(`音频 ${lat}ms`);
    el.perf.textContent = parts.join(" · ") || "未开始";
  }
  requestAnimationFrame(frame);
}

// ---------------- 摄像头入口 ----------------
function updateCta() {
  const full = !state.cameraOn && state.ctaFull;
  el.intro.hidden = !full;
  el.camPill.hidden = state.cameraOn || full;
  el.introCam.querySelector("span").textContent = "开启摄像头";
}

function hideIntro() {
  state.ctaFull = false;
  if (!settings.introSeen) { settings.introSeen = true; save(); }
  updateCta();
}

// ---------------- 新手教程 ----------------
// 每一步都等用户真的做到了才往下走，做到的那一刻自动跳到下一步
const tut = { active: false, track: "camera", i: 0 };

function tutorialSteps() {
  const n = (f) => `<b>${escapeHtml(soundingName(settings.bindings[f]))}</b>`;
  if (tut.track === "keys") {
    return [
      { text: `点下方的 ${n(1)} 键，听一下`, done: () => state.activeFinger === 1 },
      { text: `再点 ${n(2)} 键换个和弦（电脑上也能按数字键 1–5）`, done: () => state.activeFinger === 2 },
      { text: "点左下角「开始伴奏」，鼓和节奏会跟上", done: () => engine.running },
      { text: "想用手势弹？点画面中间的「开启摄像头」", done: () => state.cameraOn },
    ];
  }
  return [
    { text: "点画面中间的「开启摄像头」，浏览器问权限时点「允许」", done: () => state.cameraOn },
    { text: `<span class="big">☝️</span>对着镜头伸出 1 根食指，会弹出 ${n(1)}`, done: () => state.camFinger === 1 },
    { text: `<span class="big">✌️</span>换成 2 根手指，和弦变成 ${n(2)}`, done: () => state.camFinger === 2 },
    { text: '<span class="big">✊</span>握拳，声音就停了', done: () => state.camFinger === 0 },
    { text: "点左下角「开始伴奏」，鼓点响起后边换手势边弹", done: () => engine.running },
  ];
}

function startTutorial() {
  tut.active = true;
  tut.track = "camera";
  tut.i = 0;
  checkTutorial();
}

function finishTutorial(completed) {
  tut.active = false;
  el.coach.hidden = true;
  settings.tutorialDone = true;
  save();
  if (completed) toast("教程完成！以后想再看，点右上角的「?」", 3600);
}

function checkTutorial() {
  if (!tut.active) return;
  const steps = tutorialSteps();
  const before = tut.i;
  while (tut.i < steps.length && steps[tut.i].done()) tut.i += 1;
  if (tut.i >= steps.length) { finishTutorial(true); return; }
  el.coach.hidden = false;
  el.coachStep.textContent = `新手教程 ${tut.i + 1}/${steps.length}`;
  el.coachText.innerHTML = steps[tut.i].text;
  el.coachBar.style.width = `${(tut.i / steps.length) * 100}%`;
  if (tut.i !== before) {
    el.coach.classList.remove("done-flash");
    void el.coach.offsetWidth;
    el.coach.classList.add("done-flash");
  }
}

// ---------------- 事件 ----------------
function bindUi() {
  el.camBtn.addEventListener("click", toggleCamera);
  el.introCam.addEventListener("click", startCamera);
  el.camPill.addEventListener("click", startCamera);
  el.introSkip.addEventListener("click", () => {
    hideIntro();
    ensureAudioReady();
    if (tut.active && tut.i === 0) { tut.track = "keys"; tut.i = 0; }
    checkTutorial();
  });
  el.coachSkip.addEventListener("click", () => finishTutorial(false));
  el.helpBtn.addEventListener("click", () => {
    renderGuide();
    if (!state.cameraOn) state.ctaFull = true;
    updateCta();
    startTutorial();
  });
  el.themeBtn.addEventListener("click", () => {
    settings.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme();
    save();
  });
  el.settingsBtn.addEventListener("click", () => openSheet(!sheetIsOpen()));
  el.sheetClose.addEventListener("click", () => openSheet(false));
  el.scrim.addEventListener("click", () => openSheet(false));
  el.rhythmChip.addEventListener("click", () => {
    openSheet(true);
    (settings.style === "strum" ? el.strumPattern : settings.style === "arp" ? el.arpPattern : el.customKeys).scrollIntoView({ block: "center", behavior: "smooth" });
  });

  el.playBtn.addEventListener("click", togglePlay);
  el.bpmDown.addEventListener("click", () => setBpm(settings.bpm - (settings.bpm > 60 ? 2 : 1)));
  el.bpmUp.addEventListener("click", () => setBpm(settings.bpm + 2));
  el.bpmInput.addEventListener("change", () => setBpm(el.bpmInput.value));
  onSeg(el.modeSeg, (v) => {
    settings.mode = v;
    state.heardChord = null;
    state.autoPos = -1;
    if (v !== "free" && engine.running && v === "song") state.songPos = 0;
    changed({ rerenderPads: true });
    const tips = {
      free: "自由弹：1–5 根手指各弹一个和弦",
      song: `跟谱弹唱「${song.title}」：伸出手指开始弹，每换一次手势走到下一个和弦（没摄像头就点下方「下一个」）`,
      auto: `自动走谱「${song.title}」：和弦每小节自动换，点「开始伴奏」跟着唱`,
    };
    toast(tips[v], 4200);
  });

  // 按键：摄像头开着时按住才响；没开摄像头时点一下锁定
  el.pads.addEventListener("pointerdown", (e) => {
    const pad = e.target.closest(".pad");
    if (!pad) return;
    e.preventDefault();
    if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) tut.track = "keys"; }
    if (pad.dataset.pos !== undefined) {
      if (settings.mode === "song") jumpSong(Number(pad.dataset.pos));
      return;
    }
    const f = Number(pad.dataset.finger);
    if (state.cameraOn) {
      pad.setPointerCapture?.(e.pointerId);
      pressFinger(f);
    } else {
      pressFinger(f, { latch: true });
    }
  });
  const padUp = (e) => {
    const pad = e.target.closest(".pad");
    if (pad && pad.dataset.finger && state.cameraOn) releaseFinger(Number(pad.dataset.finger));
  };
  el.pads.addEventListener("pointerup", padUp);
  el.pads.addEventListener("pointercancel", padUp);
  el.pads.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const pad = e.target.closest(".pad");
      if (pad?.dataset.pos !== undefined) { e.preventDefault(); e.stopPropagation(); if (settings.mode === "song") jumpSong(Number(pad.dataset.pos)); }
      else if (pad) { e.preventDefault(); e.stopPropagation(); pressFinger(Number(pad.dataset.finger), { latch: true }); }
    }
  });
  el.airDrum.addEventListener("click", () => setDrums(!settings.drumsOn));

  const held = new Set();
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (settings.mode === "song" && (/^[1-5]$/.test(k) || k === "ArrowRight" || k === "ArrowLeft")) {
      e.preventDefault();
      if (e.repeat) return;
      jumpSong(state.songPos + (k === "ArrowLeft" ? -1 : state.activeFinger ? 1 : 0));
      return;
    }
    if (/^[1-5]$/.test(k)) {
      e.preventDefault();
      if (held.has(k)) return;
      held.add(k);
      const f = Number(k);
      if (state.cameraOn) pressFinger(f); else pressFinger(f, { latch: true });
    } else if (k === "0" || k === "Backspace") {
      muteAll();
    } else if (k === " ") {
      e.preventDefault();
      togglePlay();
    } else if (k === "ArrowUp") {
      e.preventDefault();
      setBpm(settings.bpm + 2);
    } else if (k === "ArrowDown") {
      e.preventDefault();
      setBpm(settings.bpm - 2);
    } else if (k === "c" || k === "C") {
      toggleCamera();
    } else if (k === "s" || k === "S") {
      openSheet(!sheetIsOpen());
    } else if (k === "Escape") {
      if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) { tut.track = "keys"; checkTutorial(); } } else if (!isDesktop()) openSheet(false);
    }
  });
  document.addEventListener("keyup", (e) => {
    if (!/^[1-5]$/.test(e.key)) return;
    held.delete(e.key);
    if (state.cameraOn && settings.mode === "free") releaseFinger(Number(e.key));
  });
  window.addEventListener("blur", () => { held.clear(); if (state.manualFinger) { state.manualFinger = null; updateChord(); } });

  // iOS 来电、切后台后音频会被挂起：下一次触屏时恢复
  document.addEventListener("pointerdown", () => {
    if (engine.ctx && engine.ctx.state !== "running") engine.unlock();
  }, { passive: true, capture: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && engine.running) requestWakeLock();
  });
}

// ---------------- 启动 ----------------
function init() {
  loadSong(settings.songId, { rebind: false });
  applyTheme();
  fillSelects();
  renderSettings();
  renderPads();
  renderLive();
  renderBeats(null);
  renderPlay();
  bindSettings();
  bindUi();
  openSheet(isDesktop());
  applyEngineSettings();
  updateCta();
  if (!settings.tutorialDone) startTutorial();
  refreshStatus();
  requestAnimationFrame(frame);
  // 空闲时预先下载默认音色（不到 1MB），首次出声不用等
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  idle(() => { if (!instrumentLoad) { try { loadInstrument(); } catch {} } }, { timeout: 2500 });
}

init();

// 调试/测试入口
window.airGuitar = { engine, settings, state, jumpSong, get song() { return song; }, classifyHand, pressFinger, releaseFinger, togglePlay, muteAll, get tracker() { return tracker; } };
