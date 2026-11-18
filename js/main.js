import {
  allChordOptions, defaultBindings, normalizeChord, transposeChord, voiceChord,
} from "./theory.js?v=4.3";
import { STRUM_PATTERNS, ARP_PATTERNS, DRUM_PATTERNS, DEFAULT_CUSTOM_STEPS, findById } from "./patterns.js?v=4.3";
import { Engine, INSTRUMENTS } from "./audio.js?v=4.3";
import { classifyHand, GestureStabilizer } from "./gesture.js?v=4.3";
import { detectLowEndDevice } from "./hands.js?v=4.3";

const $ = (sel) => document.querySelector(sel);
const STORE_KEY = "airGuitar.v3";
const FINGERS = [1, 2, 3, 4, 5];
const FINGER_NAMES = { 1: "伸 1 根食指", 2: "伸 2 根手指", 3: "伸 3 根手指", 4: "伸 4 根手指", 5: "5 指张开" };
const FINGER_FEEL_LABELS = { 1: "主音 · 稳重", 2: "明亮 · 推进", 3: "柔和 · 抒情", 4: "温暖 · 铺垫", 5: "悠扬 · 过渡" };

// ---------------- 设置（默认原调 + 分解 + 经典分解） ----------------
const DEFAULTS = {
  transpose: 0, // 默认原调
  bpm: 84,
  instrument: "acoustic",
  style: "arp", // 默认分解
  arpId: "classic", // 默认经典分解 R3231323
  strumId: "folk",
  customSteps: DEFAULT_CUSTOM_STEPS.slice(),
  drumId: "ballad",
  drumsOn: true,
  airDrum: true,
  airDrumSize: 88,
  hold: false,
  bindings: defaultBindings("C"), // 1–5 指对应 C G Am F Em
  liteMode: detectLowEndDevice(), // 手机或低配设备自动开启省流防卡顿
  guitarVol: 85,
  drumVol: 55,
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
    // 清理旧版本可能遗留的高调/扫弦缓存，统一使用新版纯净配置
    try { localStorage.removeItem("airGuitar.v2"); } catch {}
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const merged = {
      ...DEFAULTS,
      ...saved,
      bindings: { ...DEFAULTS.bindings, ...(saved.bindings || {}) },
    };
    if (saved.liteMode === undefined) merged.liteMode = detectLowEndDevice();
    for (const f of FINGERS) {
      merged.bindings[f] = normalizeChord(merged.bindings[f]) || DEFAULTS.bindings[f];
    }
    if (!INSTRUMENTS.some((i) => i.id === merged.instrument)) merged.instrument = DEFAULTS.instrument;
    if (!["arp", "strum", "custom"].includes(merged.style)) merged.style = DEFAULTS.style;
    if (!Array.isArray(merged.customSteps)) merged.customSteps = DEFAULTS.customSteps.slice();
    merged.bpm = clamp(Number(merged.bpm) || 84, 50, 180);
    if (!STRUM_PATTERNS.some((p) => p.id === merged.strumId)) merged.strumId = DEFAULTS.strumId;
    if (!ARP_PATTERNS.some((p) => p.id === merged.arpId)) merged.arpId = DEFAULTS.arpId;
    if (!DRUM_PATTERNS.some((p) => p.id === merged.drumId)) merged.drumId = DEFAULTS.drumId;
    merged.transpose = clamp(Math.round(Number(merged.transpose) || 0), -6, 6);
    merged.airDrumSize = clamp(Number(merged.airDrumSize) || 88, 60, 220);
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
const customAudio = new Map();

// ---------------- 演奏状态 ----------------
const state = {
  camFinger: null,
  manualFinger: null,
  latchedFinger: null,
  heldFinger: null,
  activeFinger: null,
  cameraOn: false,
  lastLandmarks: null,
  airDrumInside: false,
  airDrumCooldown: 0,
  ctaFull: !settings.introSeen,
};

let tracker = null;
let stabilizer = new GestureStabilizer({ frames: settings.stability });

// ---------------- DOM ----------------
const el = {
  app: $("#app"), stage: $("#stage"), video: $("#video"), overlay: $("#overlay"),
  status: $("#status"), statusText: $("#statusText"),
  camBtn: $("#camBtn"), themeBtn: $("#themeBtn"), helpBtn: $("#helpBtn"), settingsBtn: $("#settingsBtn"),
  hudChord: $("#hudChord"), hudMeta: $("#hudMeta"), hudLabel: $("#hudLabel"),
  beats: $("#beats"), airDrum: $("#airDrum"), perf: $("#perf"), toast: $("#toast"),
  intro: $("#intro"), guide: $("#guide"), introCam: $("#introCam"), introSkip: $("#introSkip"), camPill: $("#camPill"),
  coach: $("#coach"), coachStep: $("#coachStep"), coachText: $("#coachText"), coachBar: $("#coachBar"), coachSkip: $("#coachSkip"),
  liteMode: $("#liteMode"),
  pads: $("#pads"), playBtn: $("#playBtn"), playLabel: $("#playLabel"),
  bpmDown: $("#bpmDown"), bpmUp: $("#bpmUp"), bpmInput: $("#bpmInput"),
  rhythmChip: $("#rhythmChip"), rhythmChipText: $("#rhythmChipText"),
  sheet: $("#sheet"), sheetClose: $("#sheetClose"), scrim: $("#scrim"),
  instrument: $("#instrument"), styleSeg: $("#styleSeg"), strumPattern: $("#strumPattern"), arpPattern: $("#arpPattern"),
  strumField: $("#strumField"), arpField: $("#arpField"), customField: $("#customField"),
  customSteps: $("#customSteps"), customKeys: $("#customKeys"), customUndo: $("#customUndo"), customReset: $("#customReset"),
  guitarVol: $("#guitarVol"), drumVol: $("#drumVol"),
  drumsOn: $("#drumsOn"), airDrumOn: $("#airDrumOn"), drumPattern: $("#drumPattern"),
  transpose: $("#transpose"), bindings: $("#bindings"),
  holdSeg: $("#holdSeg"), stabilitySeg: $("#stabilitySeg"),
  mirror: $("#mirror"), skeleton: $("#skeleton"), perfOn: $("#perfOn"),
  resetAll: $("#resetAll"),
};
const ctx2d = el.overlay.getContext("2d");

// ---------------- 工具 ----------------
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function fingersGlyph(n) {
  return `<span class="fingers" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => {
    const up = n === 5 ? true : i >= 2 && i <= n + 1;
    return `<i class="${up ? "up" : ""}"></i>`;
  }).join("")}</span>`;
}
function soundingName(shape) { return transposeChord(shape, settings.transpose); }

function chordObj(shape, finger = null) {
  const name = soundingName(shape);
  return { shape, name, voicing: voiceChord(name), custom: finger ? customAudio.get(finger)?.buffer || null : null, finger };
}

let toastTimer = null;
function toast(text, ms = 2800) {
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
  if (!seg) return;
  seg.querySelectorAll("[data-value]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === String(value))));
}

function chordFor(finger) {
  if (!finger) return null;
  const shape = settings.bindings[finger];
  if (!shape) return null;
  return chordObj(shape, finger);
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
  engine.capo = 0;
  engine.humanize = true;
  engine.spread = true;
  engine.countIn = false;
  engine.followMode = false;
  engine.songStrum = null;
  engine.songArp = null;
  engine.setVolumes(settings.guitarVol / 100, settings.drumVol / 100);
  if (tracker) tracker.setLite(settings.liteMode);
}

function neededMidis() {
  const shapes = new Set(Object.values(settings.bindings));
  const midis = [];
  shapes.forEach((sh) => voiceChord(soundingName(sh)).strings.forEach((m) => { if (m !== null) midis.push(m); }));
  return midis;
}

let instrumentLoad = null;
function loadInstrument() {
  instrumentLoad = engine.loadInstrument(settings.instrument, neededMidis(), { lite: settings.liteMode });
  return instrumentLoad;
}

engine.onLoadState = (stateName, detail) => {
  if (stateName === "loading") {
    if (!state.cameraOn) setStatus(`正在加载${detail.name} (${detail.done}/${detail.total})`, "busy");
  } else if (stateName === "failed") {
    toast("网络较慢，已自动启用内置合成吉他音色，可直接使用！");
    refreshStatus();
  } else {
    refreshStatus();
  }
};

function refreshStatus() {
  if (state.cameraOn) {
    setStatus("摄像头已开启 · 对着镜头伸 1–5 根手指即可弹奏", "live");
  } else {
    setStatus(engine.running ? "伴奏播放中 · 点下方 1–5 号键或开摄像头换和弦" : "先点画面中间「开启摄像头」或下方 1–5 号按键", engine.running ? "live" : "idle");
  }
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
  if (engine.ctx) engine.dampAll(engine.ctx.currentTime, 0.04);
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
function renderPads() {
  el.pads.innerHTML = FINGERS.map((f) => {
    const name = soundingName(settings.bindings[f]);
    const feel = `${f} 根手指 · ${FINGER_FEEL_LABELS[f]}`;
    return `<button type="button" class="pad" data-finger="${f}" aria-label="伸 ${f} 根手指：${escapeHtml(name)}">
      <span class="pad-top">${fingersGlyph(f)}<span>${f} 指</span></span>
      <span class="pad-chord">${escapeHtml(name)}</span>
      <span class="pad-feel">${escapeHtml(feel)}</span>
    </button>`;
  }).join("");
}

function renderLive() {
  const finger = state.activeFinger;
  let name = null;
  let meta = "";
  if (finger) {
    const chord = chordFor(finger);
    name = chord?.name || null;
    meta = `${FINGER_NAMES[finger]} · ${FINGER_FEEL_LABELS[finger] || "正在发声"}`;
  } else {
    meta = state.cameraOn
      ? (state.camFinger === 0 ? "已握拳：静音中" : state.lastLandmarks ? "识别到手了 · 伸出 1–5 根手指" : "把手放到镜头前，伸 1–5 根手指")
      : "点下方 1–5 号大按键，或开启摄像头";
  }
  el.hudLabel.textContent = settings.hold ? "当前和弦 · 保持" : "当前和弦";
  el.hudChord.textContent = name || "—";
  el.hudChord.classList.toggle("idle", !name);
  el.hudMeta.textContent = meta;

  el.pads.querySelectorAll(".pad").forEach((pad) => {
    pad.classList.toggle("active", Number(pad.dataset.finger) === finger);
  });
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
  el.playLabel.textContent = engine.running ? "停止伴奏" : "开始伴奏";
  checkTutorial();
}

function renderRhythmChip() {
  const instName = INSTRUMENTS.find((i) => i.id === settings.instrument)?.name.split("（")[0] || "木吉他";
  const rName = settings.style === "strum"
    ? findById(STRUM_PATTERNS, settings.strumId).name.split("（")[0]
    : settings.style === "arp" ? findById(ARP_PATTERNS, settings.arpId).name.split(" ")[0] : "自定义";
  el.rhythmChipText.textContent = `${instName} · ${rName}`;
}

function renderAirDrum() {
  el.airDrum.hidden = !settings.airDrum;
  el.stage.style.setProperty("--air-drum-size", `${settings.airDrumSize}px`);
  el.airDrum.setAttribute("aria-pressed", String(settings.drumsOn));
  el.drumsOn.checked = settings.drumsOn;
}

function renderGuide() {
  el.guide.innerHTML = FINGERS.map((f) => `<li>${fingersGlyph(f)}<b>${escapeHtml(soundingName(settings.bindings[f]))}</b><span>伸 ${f} 指</span></li>`).join("");
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
  if (el.liteMode) el.liteMode.checked = settings.liteMode;
  el.strumField.hidden = settings.style !== "strum";
  el.arpField.hidden = settings.style !== "arp";
  el.customField.hidden = settings.style !== "custom";
  el.strumPattern.value = settings.strumId;
  el.arpPattern.value = settings.arpId;
  el.guitarVol.value = settings.guitarVol;
  el.drumVol.value = settings.drumVol;
  el.drumsOn.checked = settings.drumsOn;
  el.airDrumOn.checked = settings.airDrum;
  el.drumPattern.value = settings.drumId;
  el.transpose.value = String(settings.transpose);
  setSeg(el.holdSeg, settings.hold ? "hold" : "stop");
  setSeg(el.stabilitySeg, settings.stability);
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
    const label = v === 0 ? "原调（默认）" : v > 0 ? `升 ${v} 个半音（更高）` : `降 ${-v} 个半音（更低）`;
    return `<option value="${v}">${label}</option>`;
  }).join("");
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
  if (!seg) return;
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
  el.liteMode?.addEventListener("change", () => {
    settings.liteMode = el.liteMode.checked;
    applyEngineSettings();
    save();
    toast(settings.liteMode ? "已开启手机流畅/省流模式" : "已切换为标准高清模式", 2400);
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
    ensureAudioReady().then(() => {
      const c = chordFor(state.activeFinger || 1);
      if (c && !engine.running) engine.pluckString(c.voicing, engine.ctx.currentTime + 0.01, v, 0.7);
    });
  });
  el.customUndo.addEventListener("click", () => { settings.customSteps.pop(); renderCustom(); changed(); });
  el.customReset.addEventListener("click", () => { settings.customSteps = DEFAULT_CUSTOM_STEPS.slice(); renderCustom(); changed(); });
  el.guitarVol.addEventListener("input", () => { settings.guitarVol = Number(el.guitarVol.value); applyEngineSettings(); save(); });
  el.drumVol.addEventListener("input", () => { settings.drumVol = Number(el.drumVol.value); applyEngineSettings(); save(); });
  el.drumsOn.addEventListener("change", () => { setDrums(el.drumsOn.checked); });
  el.airDrumOn.addEventListener("change", () => { settings.airDrum = el.airDrumOn.checked; renderAirDrum(); save(); resizeOverlay(); });
  el.drumPattern.addEventListener("change", () => { settings.drumId = el.drumPattern.value; changed(); });
  el.transpose.addEventListener("change", () => {
    settings.transpose = Number(el.transpose.value);
    changed({ rerenderPads: true, reload: true });
  });

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
        toast(`${f} 指已换成「${file.name}」`);
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
    if (!confirm("恢复全部默认设置？")) return;
    const theme = settings.theme;
    Object.assign(settings, structuredClone(DEFAULTS), { theme, introSeen: true, tutorialDone: true });
    customAudio.clear();
    renderSettings();
    changed({ rerenderPads: true, reload: true });
    toast("已恢复默认设置（原调 · 经典分解）");
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

// ---------------- 设置抽屉 ----------------
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

// ---------------- 主题 ----------------
function applyTheme() {
  const theme = settings.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
  accentColor = getComputedStyle(document.documentElement).getPropertyValue("--stage-highlight").trim() || accentColor;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0f1012";
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
  el.introCam.querySelector("span").textContent = "正在开启摄像头…";
  try {
    if (!tracker) {
      const { HandTracker } = await import("./hands.js?v=4.3");
      tracker = new HandTracker(el.video, {
        numHands: 1,
        lite: settings.liteMode,
        onResult: onHands,
        onStatus: (s) => {
          if (s === "camera") setStatus("请在浏览器弹窗点「允许」使用摄像头…", "busy");
          if (s === "model") setStatus("正在准备手势识别（首次约需几秒）…", "busy");
        },
      });
    } else {
      tracker.setLite(settings.liteMode);
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
    if (tracker.delegate === "CPU" && !settings.liteMode) {
      settings.liteMode = true;
      tracker.setLite(true);
      if (el.liteMode) el.liteMode.checked = true;
      toast("已自动为你开启手机流畅模式");
    }
  } catch (error) {
    const messages = {
      denied: "摄像头权限未开启。请在浏览器地址栏旁允许摄像头权限，或者直接点下方 1–5 号按键弹奏。",
      nocamera: "没有检测到摄像头。你可以直接点下方 1–5 号按键弹奏。",
      insecure: "摄像头需要 https 或 localhost 打开页面。",
      unsupported: "当前浏览器不支持开启摄像头，请换 Safari / Chrome，或直接点下方 1–5 号按键弹奏。",
      model: "手势组件加载较慢，请先用下方 1–5 号按键弹奏，稍后再试摄像头。",
    };
    setStatus("可点下方 1–5 号按键直接弹奏", "error");
    toast(messages[error.code] || "未能打开摄像头，可先用下方 1–5 号按键弹奏。", 5000);
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
    state.camFinger = stabilizer.stable;
    updateChord();
    renderLive();
  }
  if (settings.skeleton) drawHand(lm, vw, vh);
  if (settings.airDrum && lm) checkAirDrum(lm, vw, vh, now);
  else el.airDrum.classList.remove("armed");
  if (!changedNow && !lm !== !lastHadHand) renderLive();
  lastHadHand = Boolean(lm);
}
let lastHadHand = false;

function mapPoint(p, vw, vh, cw, ch) {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const x = (settings.mirror ? 1 - p.x : p.x) * dw + (cw - dw) / 2;
  const y = p.y * dh + (ch - dh) / 2;
  return [x, y];
}

let overlaySize = { w: 0, h: 0, dpr: 1 };
let airDrumBox = null;
let accentColor = "#ffb547";
function resizeOverlay() {
  const rect = el.stage.getBoundingClientRect();
  const z = el.airDrum.getBoundingClientRect();
  airDrumBox = { l: z.left - rect.left, t: z.top - rect.top, r: z.right - rect.left, b: z.bottom - rect.top };
  const dpr = Math.min(settings.liteMode ? 1.25 : 2, window.devicePixelRatio || 1);
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
  ctx2d.strokeStyle = "rgba(255,255,255,0.68)";
  ctx2d.lineWidth = 2.2;
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
    ctx2d.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx2d.fill();
  }
}

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
    toast(settings.drumsOn ? "鼓伴奏：已开启" : "鼓伴奏：已关闭", 1000);
  }
  state.airDrumInside = inside;
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
    releaseWakeLock();
    renderPlay();
    renderBeats(null);
    refreshStatus();
    renderLive();
    return;
  }
  const ok = await ensureAudioReady();
  if (!ok) {
    toast("请再点一次允许播放声音");
    return;
  }
  if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) tut.track = "keys"; }
  if (!state.activeFinger) {
    state.latchedFinger = 1;
    state.activeFinger = 1;
  }
  applyEngineSettings();
  engine.chord = chordFor(state.activeFinger || 1);
  await engine.start();
  requestWakeLock();
  renderPads();
  renderPlay();
  refreshStatus();
  renderLive();
}

let perfTick = 0;
function frame(now) {
  if (engine.running) {
    const info = engine.drainUI();
    if (info) renderBeats(info);
  }
  if (settings.perf && now - perfTick > 500) {
    perfTick = now;
    const parts = [];
    if (tracker?.active) parts.push(`识别 ${tracker.stats.fps}fps`, `耗时 ${tracker.stats.inferMs.toFixed(0)}ms`, tracker.delegate);
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
  el.introCam.querySelector("span").textContent = "第 1 步：点这里开启摄像头";
}

function hideIntro() {
  state.ctaFull = false;
  if (!settings.introSeen) { settings.introSeen = true; save(); }
  updateCta();
}

// ---------------- 新手一步步引导 ----------------
const tut = { active: false, track: "camera", i: 0 };

function tutorialSteps() {
  const n = (f) => `<b>${escapeHtml(soundingName(settings.bindings[f]))}</b>`;
  if (tut.track === "keys") {
    return [
      { text: `第 1 步：点下方第 1 个大按键 ${n(1)}，听听吉他的声音`, done: () => state.activeFinger === 1 },
      { text: `第 2 步：再点第 2 个按键 ${n(2)} 换个和弦`, done: () => state.activeFinger === 2 },
      { text: "第 3 步：点左下角橙色「开始伴奏」，经典分解与鼓点会自动跟上！", done: () => engine.running },
    ];
  }
  return [
    { text: "第 1 步：点画面中间的「开启摄像头」，浏览器询问时点「允许」", done: () => state.cameraOn },
    { text: `<span class="big">☝️</span>第 2 步：对着镜头伸出 1 根食指，弹响 ${n(1)}`, done: () => state.camFinger === 1 },
    { text: `<span class="big">✌️</span>第 3 步：换成 2 根手指，声音切换到 ${n(2)}（握拳✊即可静音）`, done: () => state.camFinger === 2 },
    { text: "第 4 步：点左下角「开始伴奏」，边伸手指边享受弹吉他的感觉！", done: () => engine.running },
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
  if (completed) toast("太棒了，你已经学会了！想换音色或节奏可点右上角设置图标", 3600);
}

function checkTutorial() {
  if (!tut.active) return;
  const steps = tutorialSteps();
  while (tut.i < steps.length && steps[tut.i].done()) tut.i += 1;
  if (tut.i >= steps.length) { finishTutorial(true); return; }
  el.coach.hidden = false;
  el.coachStep.textContent = `新手引导 ${tut.i + 1}/${steps.length}`;
  el.coachText.innerHTML = steps[tut.i].text;
  el.coachBar.style.width = `${(tut.i / steps.length) * 100}%`;
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
  el.rhythmChip.addEventListener("click", () => openSheet(!sheetIsOpen()));

  el.playBtn.addEventListener("click", togglePlay);
  el.bpmDown.addEventListener("click", () => setBpm(settings.bpm - (settings.bpm > 60 ? 2 : 1)));
  el.bpmUp.addEventListener("click", () => setBpm(settings.bpm + 2));
  el.bpmInput.addEventListener("change", () => setBpm(el.bpmInput.value));

  el.pads.addEventListener("pointerdown", (e) => {
    const pad = e.target.closest(".pad");
    if (!pad) return;
    e.preventDefault();
    if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) tut.track = "keys"; }
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
      if (pad) { e.preventDefault(); e.stopPropagation(); pressFinger(Number(pad.dataset.finger), { latch: true }); }
    }
  });
  el.airDrum.addEventListener("click", () => setDrums(!settings.drumsOn));

  const held = new Set();
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
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
      if (!el.intro.hidden) { hideIntro(); if (tut.active && tut.i === 0) { tut.track = "keys"; checkTutorial(); } } else openSheet(false);
    }
  });
  document.addEventListener("keyup", (e) => {
    if (!/^[1-5]$/.test(e.key)) return;
    held.delete(e.key);
    if (state.cameraOn) releaseFinger(Number(e.key));
  });
  window.addEventListener("blur", () => { held.clear(); if (state.manualFinger) { state.manualFinger = null; updateChord(); } });

  document.addEventListener("pointerdown", () => {
    if (engine.ctx && engine.ctx.state !== "running") engine.unlock();
  }, { passive: true, capture: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && engine.running) requestWakeLock();
  });
}

// ---------------- 启动 ----------------
function init() {
  applyTheme();
  fillSelects();
  renderSettings();
  renderPads();
  renderLive();
  renderBeats(null);
  renderPlay();
  bindSettings();
  bindUi();
  openSheet(false);
  applyEngineSettings();
  updateCta();
  if (!settings.tutorialDone) startTutorial();
  refreshStatus();
  requestAnimationFrame(frame);
  const preloadSoon = () => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
    idle(() => { if (!instrumentLoad) { try { loadInstrument(); } catch {} } }, { timeout: 1500 });
  };
  if (document.readyState === "complete") preloadSoon();
  else window.addEventListener("load", preloadSoon, { once: true });
}

init();

window.airGuitar = {
  engine, settings, state, classifyHand, pressFinger, releaseFinger, togglePlay, muteAll,
  get tracker() { return tracker; },
};
