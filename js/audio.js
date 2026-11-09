// 音频引擎：采样/合成音色、逐弦发声、鼓、前瞻调度器。
// 关键设计：
// 1. 调度器在后台 Worker 计时，提前 ~120ms 排程，主线程卡顿也不断拍。
// 2. 换和弦时取消尚未发声的旧和弦、重排新和弦，并按需立刻扫一下，所以既跟手又不乱拍。
// 3. 每根弦只保留一个发声体：新音会切掉同弦旧音，像真吉他一样，也让同时发声数有上限。

import { voiceChord, midiToFreq, OPEN_STRINGS } from "./theory.js?v=3.2";
import { STRUM_PATTERNS, ARP_PATTERNS, DRUM_PATTERNS, WALTZ_DRUM, DEFAULT_CUSTOM_STEPS, findById } from "./patterns.js?v=3.2";

export const INSTRUMENTS = [
  { id: "acoustic", name: "木吉他（钢弦）", kind: "sampler" },
  { id: "nylon", name: "尼龙吉他", kind: "sampler" },
  { id: "electric", name: "电吉他（小音箱）", kind: "sampler" },
  { id: "piano", name: "钢琴", kind: "soundfont" },
  { id: "tinbox", name: "半岛铁盒", kind: "synth" },
  { id: "glassbell", name: "玻璃铃", kind: "synth" },
  { id: "celeste", name: "星光琴", kind: "synth" },
  { id: "violin", name: "小提琴", kind: "soundfont" },
];

const range = (a, b, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);

// bright: 力度 0→1 时每个音的低通截止频率范围（模拟轻弹发闷、重弹发亮，代替缺少的力度层）
const SAMPLERS = {
  acoustic: {
    // University of Iowa MIS 钢弦木吉他，逐半音 E2–D5（经 tonejs-instruments 整理，CC BY 3.0）
    base: "samples/v2/acoustic/",
    zones: range(40, 74),
    file: (zone) => `a${zone}.m4a`,
    gain: 1.75,
    bright: [1700, 11000],
  },
  nylon: {
    base: "samples/v2/nylon/",
    zones: [40, 43, 49, 52, 55, 58, 61, 64, 67],
    layers: [1, 2],
    file: (zone, layer) => `n${zone}_${layer}.m4a`,
    gain: 1.05,
    bright: [1400, 7000],
  },
  electric: {
    // Karoryfer 电吉他，每小三度一个音 C#2–C6（经 tonejs-instruments 整理，CC BY 3.0）
    base: "samples/v2/electric/",
    zones: [37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
    file: (zone) => `k${zone}.m4a`,
    gain: 0.95,
    bright: [2400, 8000],
  },
};

// 每种音色走哪条声音链：dry 直出、body 琴箱共鸣、amp 音箱模拟、verb 房间混响
const TONES = {
  acoustic: { dry: 1, body: 0.3, amp: 0, verb: 0.14 },
  nylon: { dry: 1, body: 0.25, amp: 0, verb: 0.15 },
  electric: { dry: 0, body: 0, amp: 1, verb: 0.22 },
  piano: { dry: 1, body: 0, amp: 0, verb: 0.18 },
  violin: { dry: 1, body: 0, amp: 0, verb: 0.22 },
  synth: { dry: 1, body: 0, amp: 0, verb: 0.08 },
};

const SOUNDFONT_BASE = {
  piano: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/",
  violin: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/violin-mp3/",
};
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const SYNTH_VOICES = {
  tinbox: { body: "sine", over: "triangle", ratio: 2.003, filter: 2450, q: 0.7, attack: 0.012, decay: 0.9, overGain: 0.28, subGain: 0.3, wet: 0.16 },
  glassbell: { body: "triangle", over: "sine", ratio: 2.414, filter: 4300, q: 2.1, attack: 0.008, decay: 1.2, overGain: 0.4, subGain: 0.08, wet: 0.24 },
  celeste: { body: "triangle", over: "sine", ratio: 2.006, filter: 3900, q: 1.05, attack: 0.01, decay: 0.85, overGain: 0.32, subGain: 0.1, wet: 0.2, detune: 8 },
};

const LOOKAHEAD = 0.12; // 秒
const TICK_MS = 20;

function makeTicker(callback) {
  try {
    const src = "let id=null;onmessage=e=>{if(e.data==='start'){if(!id)id=setInterval(()=>postMessage(0)," + TICK_MS + ")}else{clearInterval(id);id=null}}";
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    worker.onmessage = callback;
    return { start: () => worker.postMessage("start"), stop: () => worker.postMessage("stop") };
  } catch {
    let id = null;
    return {
      start: () => { if (!id) id = setInterval(callback, TICK_MS); },
      stop: () => { clearInterval(id); id = null; },
    };
  }
}

export class Engine {
  constructor() {
    this.ctx = null;
    this._instrument = "acoustic";
    this.playStyle = "strum"; // strum | arp | custom
    this.strumId = STRUM_PATTERNS[0].id;
    this.arpId = ARP_PATTERNS[0].id;
    this.customSteps = DEFAULT_CUSTOM_STEPS.slice();
    this.drumId = DRUM_PATTERNS[0].id;
    this.drumsOn = true;
    this.bpm = 96;
    this.capo = 0;
    this.humanize = true;
    this.spread = true;
    this.countIn = false;
    this.followMode = false; // true = 按和弦谱自动走
    this.barsPerChord = 1;
    this.progression = []; // [{name, voicing, beats?}]：beats 是这个和弦弹几拍（来自谱上的小节线）
    this.songStrum = null; // 谱上写的扫弦节奏 {pattern, meter}
    this.songArp = null; // 谱上写的分解 {steps, meter}
    this.guitarVolume = 0.85;
    this.drumVolume = 0.6;

    this.chord = null; // 当前手势和弦 {name, voicing, custom}
    this.running = false;
    this.step = 0;
    this.nextTime = 0;
    this.stepLog = []; // 已排程但可能未发声的步：{i, t, voices}
    this.uiQueue = [];
    this.voices = [];
    this.stringVoices = new Array(6).fill(null);
    this.buffers = new Map(); // url -> AudioBuffer（已解码）
    this.loading = new Map(); // url -> Promise
    this.onsets = new WeakMap();
    this.peaks = new WeakMap(); // 外部音源（钢琴/小提琴）录得很轻，按峰值补齐响度
    this.pluckCache = new Map();
    this.rr = 0;
    this.onLoadState = null; // (state, detail) 回调
    this.ticker = makeTicker(() => this.tick());
  }

  // ---------- 基础 ----------
  ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "interactive" });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -9;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master = ctx.createGain();
    this.master.gain.value = 0.92;
    this.master.connect(comp).connect(ctx.destination);
    this.guitarBus = ctx.createGain();
    this.guitarBus.gain.value = this.guitarVolume;
    this.guitarBus.connect(this.master);
    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = this.drumVolume;
    this.drumBus.connect(this.master);
    // 声音链：每根弦 → 声像 → guitarIn → {直出 | 琴箱共鸣 | 音箱模拟} → guitarBus(音量) → master
    //                                                              ↘ 房间混响（发送）
    this.guitarIn = ctx.createGain();
    this.stringPans = OPEN_STRINGS.map((_, idx) => {
      const node = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (node.pan) node.pan.value = (idx - 2.5) * 0.08;
      node.connect(this.guitarIn);
      return node;
    });
    this.dryGain = ctx.createGain();
    this.guitarIn.connect(this.dryGain).connect(this.guitarBus);
    // 琴箱：短冲激响应，几个箱体共振峰（Helmholtz ~100Hz、面板 ~200/400Hz 等）
    this.bodyConv = ctx.createConvolver();
    this.bodyConv.buffer = makeBodyIR(ctx);
    this.bodyGain = ctx.createGain();
    this.guitarIn.connect(this.bodyConv).connect(this.bodyGain).connect(this.guitarBus);
    // 电吉他（干净音色）：压缩器拉长余音（原始采样 1 秒内就衰减 25dB，听着发干）
    // → 很轻的电子管式温暖 → 1x12 音箱频响。不用重失真：多根弦叠进失真会互相调制，扫弦发糊。
    this.ampIn = ctx.createGain();
    const pre = biquad(ctx, "highpass", 90, 0.5);
    const ampComp = ctx.createDynamicsCompressor();
    ampComp.threshold.value = -30;
    ampComp.knee.value = 12;
    ampComp.ratio.value = 5;
    ampComp.attack.value = 0.012; // 让拨弦起音先过去
    ampComp.release.value = 0.3;
    const drive = ctx.createGain();
    drive.gain.value = 1.4;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDriveCurve(1.2);
    shaper.oversample = "2x";
    const cabHp = biquad(ctx, "highpass", 80, 0.7);
    const cabMid = biquad(ctx, "peaking", 420, 1, -1.5);
    const cabPres = biquad(ctx, "peaking", 2500, 0.8, 2.5);
    const cabLp = biquad(ctx, "lowpass", 6500, 0.7);
    const cabLp2 = biquad(ctx, "lowpass", 9500, 0.5);
    const ampOut = ctx.createGain();
    ampOut.gain.value = 0.7;
    this.guitarIn.connect(this.ampIn).connect(pre).connect(ampComp).connect(drive).connect(shaper)
      .connect(cabHp).connect(cabMid).connect(cabPres).connect(cabLp).connect(cabLp2).connect(ampOut).connect(this.guitarBus);
    // 房间混响：程序生成的冲激响应（无版权问题），吉他和鼓少量发送
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeRoomIR(ctx);
    const verbReturn = ctx.createGain();
    verbReturn.gain.value = 0.9;
    this.reverb.connect(verbReturn).connect(this.master);
    this.verbSend = ctx.createGain();
    this.guitarBus.connect(this.verbSend).connect(this.reverb);
    const drumVerb = ctx.createGain();
    drumVerb.gain.value = 0.07;
    this.drumBus.connect(drumVerb).connect(this.reverb);
    // 共享回声（合成音色用），避免每个音建一套 delay
    this.fxSend = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = 0.19;
    feedback.gain.value = 0.24;
    wet.gain.value = 0.5;
    this.fxSend.connect(delay).connect(feedback).connect(delay);
    delay.connect(wet).connect(this.guitarIn);
    // 预生成噪声，鼓和闷音复用
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.applyTone(true);
    return ctx;
  }

  get instrument() { return this._instrument; }
  set instrument(id) {
    if (id === this._instrument) return;
    this._instrument = id;
    this.applyTone();
  }

  applyTone(immediate = false) {
    if (!this.ctx) return;
    const inst = INSTRUMENTS.find((i) => i.id === this._instrument);
    const tone = TONES[this._instrument] || (inst?.kind === "synth" ? TONES.synth : TONES.acoustic);
    const t = this.ctx.currentTime;
    for (const [node, v] of [[this.dryGain, tone.dry], [this.bodyGain, tone.body], [this.ampIn, tone.amp], [this.verbSend, tone.verb]]) {
      if (immediate) node.gain.value = v;
      else node.gain.setTargetAtTime(v, t, 0.03);
    }
  }

  async unlock() {
    const ctx = this.ensure();
    try {
      // iOS：静音键打开时也让网页出声
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch {}
    if (ctx.state !== "running") {
      try { await ctx.resume(); } catch {}
    }
    return ctx.state === "running";
  }

  get latencyMs() {
    if (!this.ctx) return null;
    return Math.round(((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000);
  }

  setVolumes(guitar, drums) {
    this.guitarVolume = guitar;
    this.drumVolume = drums;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.guitarBus.gain.setTargetAtTime(guitar, t, 0.02);
    this.drumBus.gain.setTargetAtTime(drums, t, 0.02);
  }

  // ---------- 采样加载 ----------
  loadBuffer(url) {
    if (this.buffers.has(url)) return Promise.resolve(this.buffers.get(url));
    if (this.loading.has(url)) return this.loading.get(url);
    const ctx = this.ensure();
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.arrayBuffer();
      })
      .then((ab) => new Promise((resolve, reject) => ctx.decodeAudioData(ab, resolve, reject)))
      .then((buffer) => {
        this.onsets.set(buffer, detectOnset(buffer));
        this.peaks.set(buffer, peakOf(buffer));
        this.buffers.set(url, buffer);
        this.loading.delete(url);
        return buffer;
      })
      .catch(() => {
        this.loading.delete(url); // 允许下次重试
        return null;
      });
    this.loading.set(url, promise);
    return promise;
  }

  /** 预加载当前音色：先下当前和弦要用的音，再在后台补齐其余。没加载完也能弹（合成拨弦兜底）。 */
  async loadInstrument(id = this.instrument, neededMidis = []) {
    this.ensure();
    const inst = INSTRUMENTS.find((i) => i.id === id);
    const needed = [];
    const rest = [];
    const wanted = new Set(neededMidis);
    if (inst?.kind === "sampler") {
      const s = SAMPLERS[id];
      const neededZones = new Set([...wanted].map((m) => nearestZone(s.zones, m)));
      s.zones.forEach((z) => (s.layers || [0]).forEach((l) => (neededZones.has(z) ? needed : rest).push(s.base + s.file(z, l))));
    } else if (inst?.kind === "soundfont") {
      wanted.forEach((m) => needed.push(this.soundfontUrl(id, m)));
    }
    // 释放其它音色已解码的采样（每个约 0.8MB 内存），手机上来回切音色也不会越占越多
    const keepPrefix = inst?.kind === "sampler" ? SAMPLERS[id].base : SOUNDFONT_BASE[id] || null;
    for (const url of [...this.buffers.keys()]) {
      if (keepPrefix && url.startsWith(keepPrefix)) continue;
      this.buffers.delete(url);
    }
    const pending = needed.filter((u) => !this.buffers.has(u));
    const later = rest.filter((u) => !this.buffers.has(u));
    if (!pending.length) {
      this.onLoadState?.("ready", inst?.name);
      later.forEach((u) => this.loadBuffer(u));
      return true;
    }
    let done = 0;
    this.onLoadState?.("loading", { name: inst?.name, done, total: pending.length });
    const results = await Promise.all(pending.map((u) => this.loadBuffer(u).then((b) => {
      done += 1;
      this.onLoadState?.("loading", { name: inst?.name, done, total: pending.length });
      return b;
    })));
    const ok = results.filter(Boolean).length;
    this.onLoadState?.(ok === pending.length ? "ready" : ok ? "partial" : "failed", inst?.name);
    later.forEach((u) => this.loadBuffer(u));
    return ok > 0;
  }

  soundfontUrl(id, midi) {
    return SOUNDFONT_BASE[id] + FLAT_NAMES[midi % 12] + (Math.floor(midi / 12) - 1) + ".mp3";
  }

  // ---------- 单音 ----------
  /**
   * 弹一个音。dur 为空 = 让它自然延音到采样结束（被同弦新音或止音打断）；
   * dead = 闷音/死音：极短 + 发闷。
   */
  playNote(midi, t, vel, { string = null, dur = null, dead = false, soft = 0 } = {}) {
    const ctx = this.ctx;
    const inst = INSTRUMENTS.find((i) => i.id === this.instrument) || INSTRUMENTS[0];
    const out = string !== null ? this.stringPans[string] : this.guitarIn;
    // 同一根弦再响：旧音约 0.1 秒内收掉（真吉他重新拨弦也是这样），不是一刀切
    if (string !== null) this.dampString(string, t, dead ? 0.01 : 0.03);

    if (inst.kind === "synth") return this.track(this.playSynth(midi, t, vel, dur || 2.4, out), string);

    let buffer = null;
    let rate = 1;
    let gainScale = 1;
    let bright = null;
    if (inst.kind === "sampler") {
      const s = SAMPLERS[inst.id];
      const zone = nearestZone(s.zones, midi);
      const layer = s.layers ? s.layers[(this.rr++) % s.layers.length] : 0;
      buffer = this.buffers.get(s.base + s.file(zone, layer));
      rate = 2 ** ((midi - zone) / 12);
      gainScale = s.gain;
      bright = s.bright;
    } else {
      const url = this.soundfontUrl(inst.id, midi);
      buffer = this.buffers.get(url);
      if (!buffer) this.loadBuffer(url);
      gainScale = inst.id === "violin" ? 0.6 : 0.85;
    }
    if (buffer && inst.kind === "soundfont") gainScale *= Math.min(8, 0.7 / Math.max(0.02, this.peaks.get(buffer) || 0.7));
    if (!buffer) return this.track(this.playPluck(midi, t, vel, dur || 2.4, out), string);

    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    // 每次轻微不同（音高 ±3 音分、起点 0–3ms），代替真实采样的轮换层，避免“机关枪”感
    if (this.humanize) rate *= 2 ** (((Math.random() - 0.5) * 6) / 1200);
    src.playbackRate.value = rate;
    let node = src;
    if (bright) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.4;
      lp.frequency.value = dead ? 900 : bright[0] + (bright[1] - bright[0]) * vel ** 1.6;
      node = node.connect(lp);
    }
    const level = (dead ? 0.26 : 0.32) * vel * gainScale;
    // soft：扫弦里的弦——跳过单独拨弦那一下“叮”的起音，再用几毫秒淡入。
    // 逐个独立拨弦的采样直接叠在一起会像竖琴/琶音，扫弦的“刷”感靠拨片声统一给出。
    if (soft) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + soft * 0.6);
    } else {
      g.gain.setValueAtTime(level, t);
    }
    const offset = (this.onsets.get(buffer) || 0) + soft + (this.humanize ? Math.random() * 0.003 : 0);
    const natural = (buffer.duration - offset) / rate;
    const length = dur ? Math.min(dur, natural) : natural;
    if (dur) g.gain.setTargetAtTime(0, t + length, dead ? 0.008 : 0.03);
    node.connect(g).connect(out);
    src.start(t, offset);
    const end = t + length + (dur ? 0.25 : 0.02);
    src.stop(end);
    src.onended = () => { g.disconnect(); if (node !== src) node.disconnect(); };
    return this.track({ src, g, start: t, end }, string);
  }

  /** 拨片蹭过琴弦的沙沙声：真吉他扫弦“有手感”的关键之一 */
  pickNoise(t, length, level, dir = "D") {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = dir === "D" ? 1900 : 2600;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.002);
    g.gain.setTargetAtTime(0, t + length, 0.012);
    src.connect(f).connect(g).connect(this.guitarIn);
    src.start(t, Math.random() * 0.8);
    const end = t + length + 0.08;
    src.stop(end);
    src.onended = () => g.disconnect();
    return { src, g, start: t, end };
  }

  track(voice, string) {
    if (!voice) return null;
    voice.string = string;
    this.voices.push(voice);
    if (string !== null) this.stringVoices[string] = voice;
    return voice;
  }

  dampString(string, t, tc) {
    const prev = this.stringVoices[string];
    if (prev && prev.end > t) this.damp(prev, t, tc);
  }

  damp(voice, t, tc = 0.03) {
    if (voice.dampedAt !== undefined && voice.dampedAt <= t) return;
    voice.dampedAt = t;
    try {
      voice.g.gain.cancelScheduledValues(t);
      voice.g.gain.setTargetAtTime(0, Math.max(t, voice.start), tc);
      const stopAt = Math.max(t, voice.start) + tc * 8;
      if (stopAt < voice.end) {
        voice.end = stopAt;
        voice.src.stop(stopAt);
      }
    } catch {}
  }

  dampAll(t, tc = 0.03) {
    for (const v of this.voices) if (v.end > t && v.start <= t) this.damp(v, t, tc);
  }

  playPluck(midi, t, vel, dur, out) {
    const ctx = this.ctx;
    let buffer = this.pluckCache.get(midi);
    if (!buffer) {
      buffer = karplus(ctx, midiToFreq(midi));
      this.pluckCache.set(midi, buffer);
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    g.gain.setValueAtTime(0.36 * vel, t);
    g.gain.setTargetAtTime(0, t + Math.min(dur, buffer.duration - 0.2), 0.1);
    src.connect(g).connect(out);
    src.start(t);
    const end = t + Math.min(dur + 0.6, buffer.duration);
    src.stop(end);
    src.onended = () => g.disconnect();
    return { src, g, start: t, end };
  }

  playSynth(midi, t, vel, dur, out) {
    const ctx = this.ctx;
    const v = SYNTH_VOICES[this.instrument] || SYNTH_VOICES.tinbox;
    const freq = midiToFreq(midi);
    const body = ctx.createOscillator();
    const over = ctx.createOscillator();
    const overGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    body.type = v.body;
    over.type = v.over;
    body.frequency.value = freq;
    if (v.detune) body.detune.value = v.detune;
    over.frequency.value = freq * v.ratio;
    filter.type = "lowpass";
    filter.frequency.value = v.filter;
    filter.Q.value = v.q;
    const level = 0.2 * vel;
    const length = Math.min(dur, 1.6) * v.decay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + v.attack);
    g.gain.setTargetAtTime(0, t + v.attack, length / 3);
    overGain.gain.setValueAtTime(v.overGain, t);
    overGain.gain.setTargetAtTime(0, t, 0.12);
    body.connect(filter);
    over.connect(overGain).connect(filter);
    filter.connect(g).connect(out);
    const sendLevel = ctx.createGain();
    sendLevel.gain.value = v.wet;
    g.connect(sendLevel).connect(this.fxSend);
    const end = t + length * 2.4 + 0.1;
    body.start(t); over.start(t);
    body.stop(end); over.stop(end);
    body.onended = () => { g.disconnect(); sendLevel.disconnect(); filter.disconnect(); overGain.disconnect(); };
    return { src: body, g, start: t, end, extra: over };
  }

  // ---------- 和弦动作 ----------
  shift(midi) { return midi + this.capo; }

  strum(voicing, t, dir, accent = 1, { short = false } = {}) {
    const strings = voicing.strings;
    const order = [];
    if (dir === "D") {
      for (let i = voicing.bassString; i < 6; i += 1) if (strings[i] !== null) order.push(i);
    } else {
      // 上扫通常只扫到高音 3–4 根弦
      const reach = accent > 0.85 ? 4 : 3;
      for (let i = 5; i >= Math.max(voicing.bassString, 6 - reach); i -= 1) if (strings[i] !== null) order.push(i);
    }
    // 真人扫一下 6 根弦大约 25–45ms：越用力越快，手腕在加速，弦间隔逐渐变短
    let gap = this.spread ? (dir === "D" ? 0.0085 - 0.003 * accent : 0.006 - 0.002 * accent) : 0.002;
    const voices = [];
    let at = t;
    const isGuitar = INSTRUMENTS.find((i) => i.id === this.instrument)?.kind === "sampler";
    if (isGuitar) {
      const span = Math.max(0.012, gap * order.length);
      voices.push(this.pickNoise(t, span, (short ? 0.018 : 0.03) * accent, dir));
    }
    // 多根弦同时响，单根力度要比单音拨弦小，不然一扫就把总线压缩器顶得一抽一抽
    const stack = 0.7;
    order.forEach((idx, n) => {
      const jitter = this.humanize ? (Math.random() - 0.5) * 0.002 : 0;
      const velJitter = this.humanize ? 0.92 + Math.random() * 0.14 : 1;
      // 下扫：先碰到的低音弦最实，往后略轻；上扫：最先碰到的高音弦最实
      const shape = dir === "D" ? 1 - n * 0.04 : 0.9 - n * 0.07;
      const vel = Math.max(0.1, Math.min(1, accent * shape * velJitter * stack));
      // 第一根弦保留一点起音（拨片碰到的瞬间），后面的弦越来越“刷”
      const soft = isGuitar ? (n === 0 ? 0.002 : 0.006 + Math.min(n, 4) * 0.0015) : 0;
      const v = this.playNote(this.shift(strings[idx]), Math.max(t, at + jitter), vel, { string: idx, dur: short ? 0.18 : null, soft });
      if (v) voices.push(v);
      at += gap * (this.humanize ? 0.85 + Math.random() * 0.3 : 1);
      gap *= 0.93;
    });
    return voices;
  }

  /** 闷音扫弦：左手虚按，所有弦发出短促的“咔” */
  chuck(t, accent = 1, voicing = null) {
    for (let s = 0; s < 6; s += 1) this.dampString(s, t, 0.008);
    const voices = [];
    const inst = INSTRUMENTS.find((i) => i.id === this.instrument);
    if (voicing && inst?.kind === "sampler") {
      voices.push(this.pickNoise(t, 0.03, 0.06 * accent, "D"));
      let at = t;
      for (let i = voicing.bassString; i < 6; i += 1) {
        if (voicing.strings[i] === null) continue;
        const v = this.playNote(this.shift(voicing.strings[i]), at, 0.55 * accent, { string: i, dur: 0.04, dead: true });
        if (v) voices.push(v);
        at += 0.004;
      }
      return voices;
    }
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1400;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * accent, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f).connect(g).connect(this.guitarIn);
    src.start(t, Math.random() * 0.5, 0.09);
    const end = t + 0.1;
    src.stop(end);
    src.onended = () => g.disconnect();
    return [{ src, g, start: t, end }];
  }

  pluckString(voicing, t, spec, vel) {
    if (Array.isArray(spec)) {
      // 几根弦同时拨（掐弹、和弦拨），每根稍轻
      return spec.flatMap((one, n) => this.pluckString(voicing, t + n * 0.003, one, vel * (spec.length > 1 ? 0.8 : 1)));
    }
    const root = voicing.bassString; // 索引：0 = 6 弦
    let idx;
    if (spec === "R") idx = root;
    else if (spec === "A") idx = Math.min(root + (root === 0 ? 2 : 1), 3);
    else idx = 6 - Number(spec);
    if (idx < root) idx = root + ((idx + 6 - root) % (6 - root)); // 根音以下的弦不弹，折回
    let note = voicing.strings[idx];
    if (note === null) note = voicing.strings.find((n) => n !== null);
    const v = this.playNote(this.shift(note), t, vel, { string: idx });
    const out = v ? [v] : [];
    if (INSTRUMENTS.find((i) => i.id === this.instrument)?.kind === "sampler") out.push(this.pickNoise(t, 0.004, 0.012 * vel, "U"));
    return out;
  }

  // ---------- 调度 ----------
  get strumPattern() {
    if (this.songStrum) return { id: "song", name: "谱上的节奏", pattern: this.songStrum.pattern, meter: this.songStrum.meter === 3 ? 3 : undefined, swing: 0 };
    return findById(STRUM_PATTERNS, this.strumId);
  }
  get arpPattern() {
    if (this.songArp) return { id: "song", name: "谱上的分解", steps: this.songArp.steps, meter: this.songArp.meter === 3 ? 3 : undefined };
    return findById(ARP_PATTERNS, this.arpId);
  }
  // 一小节几步：扫弦看节奏型拍号，分解看分解方式拍号
  get stepsPerBar() {
    const meter = this.playStyle === "arp" ? this.arpPattern.meter : this.playStyle === "strum" ? this.strumPattern.meter : null;
    return (meter || 4) * 2;
  }

  stepDuration() { return 60 / this.bpm / 2; }

  /** 自动走谱：第 i 步（八分音符）弹第几个和弦。谱上有小节线就按每个和弦的拍数走，否则每个和弦 barsPerChord 小节 */
  progressIndex(i) {
    const prog = this.progression;
    if (!prog.length) return -1;
    if (prog.some((c) => c.beats)) {
      const steps = prog.map((c) => Math.max(1, Math.round((c.beats || this.stepsPerBar / 2) * 2)));
      const total = steps.reduce((a, b) => a + b, 0);
      let pos = ((i % total) + total) % total;
      for (let k = 0; k < steps.length; k += 1) {
        if (pos < steps[k]) return k;
        pos -= steps[k];
      }
      return 0;
    }
    const bar = Math.floor(i / this.stepsPerBar);
    return Math.floor(bar / this.barsPerChord) % prog.length;
  }

  chordForStep(i) {
    if (this.followMode && this.progression.length) return this.progression[this.progressIndex(i)];
    return this.chord;
  }

  renderGuitar(chord, i, t) {
    if (!chord) return [];
    const slot = ((i % this.stepsPerBar) + this.stepsPerBar) % this.stepsPerBar;
    const accent = slot === 0 ? 1 : slot % 2 === 0 ? 0.86 : 0.7;
    if (chord.custom) {
      if (slot !== 0) return [];
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = chord.custom;
      g.gain.value = 0.8;
      src.connect(g).connect(this.guitarBus);
      src.start(t);
      const end = t + Math.min(chord.custom.duration, this.stepDuration() * this.stepsPerBar + 0.2);
      g.gain.setTargetAtTime(0, end - 0.15, 0.04);
      src.stop(end);
      return [{ src, g, start: t, end }];
    }
    if (this.playStyle === "strum") {
      const pattern = this.strumPattern.pattern;
      const stroke = pattern[slot % pattern.length];
      if (stroke === "-") return [];
      if (stroke === "x") return this.chuck(t, accent, chord.voicing);
      // B / A：只弹根音 / 交替低音，后面的扫弦接上（低音扫弦）
      if (stroke === "B" || stroke === "A") return this.pluckString(chord.voicing, t, stroke === "B" ? "R" : "A", 0.85 * accent);
      return this.strum(chord.voicing, t, stroke, accent * (stroke === "U" ? 0.82 : 1), { short: Boolean(this.strumPattern.short) });
    }
    const steps = this.playStyle === "custom" && this.customSteps.length
      ? this.customSteps
      : this.arpPattern.steps;
    const spec = steps[((i % steps.length) + steps.length) % steps.length];
    const humanVel = this.humanize ? 0.88 + Math.random() * 0.2 : 1;
    return this.pluckString(chord.voicing, t, spec, 0.62 * accent * humanVel);
  }

  renderDrums(i, t) {
    if (!this.drumsOn) return;
    const spb = this.stepsPerBar;
    const slot = ((i % spb) + spb) % spb;
    const bar = Math.floor(i / spb);
    const pattern = spb === 6 ? WALTZ_DRUM : findById(DRUM_PATTERNS, this.drumId);
    const sixteenth = this.stepDuration() / 2;
    pattern.play(slot, bar, (type, offset, level) => {
      const jitter = this.humanize ? (Math.random() - 0.5) * 0.004 : 0;
      this.drum(type, t + offset * sixteenth + jitter, level * (this.humanize ? 0.92 + Math.random() * 0.14 : 1));
    });
  }

  drum(type, t, level = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.drumBus);
    let src;
    let end;
    if (type === "kick") {
      src = ctx.createOscillator();
      src.frequency.setValueAtTime(150, t);
      src.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.75 * level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      src.connect(g);
      end = t + 0.3;
    } else if (type === "click") {
      src = ctx.createOscillator();
      src.frequency.value = level > 0.9 ? 1760 : 1320;
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(g);
      end = t + 0.06;
    } else {
      src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      const spec = {
        snare: ["bandpass", 1900, 0.7, 0.42, 0.17],
        rim: ["bandpass", 2600, 3, 0.3, 0.05],
        hat: ["highpass", 7200, 0.7, 0.14, 0.045],
        ride: ["highpass", 5200, 0.5, 0.12, 0.32],
        crash: ["highpass", 4200, 0.4, 0.22, 1.1],
      }[type] || ["highpass", 7000, 0.7, 0.1, 0.05];
      f.type = spec[0];
      f.frequency.value = spec[1];
      f.Q.value = spec[2];
      g.gain.setValueAtTime(spec[3] * level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec[4]);
      src.connect(f).connect(g);
      end = t + spec[4] + 0.02;
      src.start(t, Math.random() * 0.6);
      if (type === "snare") {
        const body = ctx.createOscillator();
        const bg = ctx.createGain();
        body.type = "triangle";
        body.frequency.setValueAtTime(220, t);
        body.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        bg.gain.setValueAtTime(0.32 * level, t);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        body.connect(bg).connect(this.drumBus);
        body.start(t);
        body.stop(t + 0.12);
        body.onended = () => bg.disconnect();
      }
      src.stop(end);
      src.onended = () => g.disconnect();
      return;
    }
    src.start(t);
    src.stop(end);
    src.onended = () => g.disconnect();
  }

  scheduleStep(i, t) {
    const spb = this.stepsPerBar;
    if (i < 0) {
      if ((i + spb) % 2 === 0) this.drum("click", t, (i + spb) === 0 ? 1 : 0.5);
      this.uiQueue.push({ t, i, slot: (i + spb), countIn: true });
      return;
    }
    this.renderDrums(i, t);
    const chord = this.chordForStep(i);
    const voices = this.renderGuitar(chord, i, t);
    this.stepLog.push({ i, t, voices, chordName: chord?.name || null });
    this.uiQueue.push({ t, i, slot: i % spb, chord: chord?.name || null });
  }

  tick() {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;
    // 主线程长时间卡住后，跳过已经过去的拍子，避免一次性补一堆音
    if (this.nextTime < now - 0.05) {
      const dur = this.stepDuration();
      const skip = Math.ceil((now - this.nextTime) / dur);
      this.step += skip;
      this.nextTime += skip * dur;
    }
    while (this.nextTime < now + LOOKAHEAD) {
      this.scheduleStep(this.step, this.nextTime);
      // swing：后半拍推迟的比例（0.3 左右就是三连音式的摇摆）
      const swing = this.playStyle === "strum" ? this.strumPattern.swing || 0 : 0;
      this.nextTime += this.stepDuration() * (1 + (this.step % 2 === 0 ? swing : -swing));
      this.step += 1;
    }
    if (this.uiQueue.length > 64) this.uiQueue.splice(0, this.uiQueue.length - 16);
    if (this.stepLog.length > 32) this.stepLog = this.stepLog.filter((s) => s.t > now - 0.3);
    if (this.voices.length > 24) this.voices = this.voices.filter((v) => v.end > now);
  }

  async start() {
    await this.unlock();
    if (this.running) return;
    const ctx = this.ctx;
    this.running = true;
    this.step = this.countIn ? -this.stepsPerBar : 0;
    this.nextTime = ctx.currentTime + 0.04;
    this.stepLog = [];
    this.uiQueue = [];
    this.tick();
    this.ticker.start();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.ticker.stop();
    const now = this.ctx.currentTime;
    this.cancelFuture(now, true);
    this.dampAll(now, 0.06);
    this.uiQueue = [];
  }

  /** 取消尚未发声的吉他音；rerender=true 时不重排 */
  cancelFuture(now, dropOnly = false) {
    const future = this.stepLog.filter((s) => s.t > now + 0.002);
    for (const s of future) {
      for (const v of s.voices) {
        try { v.src.stop(); } catch {}
        try { v.extra?.stop(); } catch {}
        v.end = now;
      }
      s.voices = [];
    }
    if (dropOnly) return [];
    return future;
  }

  /** 设定手势和弦。null = 松手。 */
  setChord(next) {
    const prevName = this.chord?.name || null;
    const prevCustom = this.chord?.custom || null;
    this.chord = next;
    if (!this.ctx || this.ctx.state !== "running") return;
    const nextName = next?.name || null;
    if (prevName === nextName && prevCustom === (next?.custom || null)) return;
    const now = this.ctx.currentTime;

    if (!this.running || this.followMode) {
      if (this.running) return; // 自动走谱时手势只做提示
      if (next) {
        this.preview(next);
      } else {
        this.dampAll(now, 0.07);
      }
      return;
    }

    const future = this.cancelFuture(now);
    if (!next) {
      this.dampAll(now, 0.06);
      return;
    }
    let firstStroke = null;
    for (const s of future) {
      s.voices = this.renderGuitar(next, s.i, s.t);
      s.chordName = next.name;
      if (s.voices.length && firstStroke === null) firstStroke = s.t;
    }
    // 下一下扫弦还远：立刻补一下，手一动就有声
    if (firstStroke === null || firstStroke - now > 0.09) {
      this.dampAll(now + 0.002, 0.02);
      if (next.custom) this.renderGuitar(next, 0, now + 0.004);
      else if (this.playStyle === "strum") this.strum(next.voicing, now + 0.004, "D", 0.92, { short: Boolean(this.strumPattern.short) });
      else this.pluckString(next.voicing, now + 0.004, "R", 0.7);
    }
  }

  /** 从 UI 线程取出已经“听到”的步，用于节拍灯同步 */
  drainUI() {
    if (!this.ctx || !this.uiQueue.length) return null;
    const heard = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    let last = null;
    while (this.uiQueue.length && this.uiQueue[0].t <= heard) last = this.uiQueue.shift();
    return last;
  }

  /** 不在伴奏时弹一下这个和弦（手势切换、点按键时用） */
  preview(chord) {
    if (!this.ctx || !chord) return;
    const now = this.ctx.currentTime;
    this.dampAll(now + 0.002, 0.02);
    if (chord.custom) {
      for (const v of this.customVoices || []) this.damp(v, now, 0.02);
      this.customVoices = this.renderGuitar(chord, 0, now + 0.004);
    } else if (this.playStyle === "strum") {
      this.strum(chord.voicing, now + 0.004, "D", 0.95);
    } else {
      // 分解模式：快速琶音一下，听得出是什么和弦
      const steps = ["R", 3, 2, 1];
      steps.forEach((spec, n) => this.pluckString(chord.voicing, now + 0.004 + n * 0.07, spec, 0.7));
    }
  }
}

export function makeChord(shapeName, capoShift = 0) {
  const voicing = voiceChord(shapeName);
  return { shape: voicing.name, name: voicing.name, voicing, capoShift };
}

function biquad(ctx, type, freq, q, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

function makeDriveCurve(drive) {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    // 轻微不对称，像电子管那样多一点偶次谐波
    curve[i] = Math.tanh(drive * (x + 0.08 * x * x)) / norm;
  }
  return curve;
}

/** 琴箱共鸣冲激响应：几个衰减正弦（箱体共振峰）+ 一点点初始噪声 */
function makeBodyIR(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.14);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const modes = [[98, 0.07, 1], [196, 0.05, 0.75], [385, 0.035, 0.5], [620, 0.025, 0.3], [1150, 0.016, 0.22], [2500, 0.009, 0.12]];
  for (let i = 0; i < len; i += 1) {
    const t = i / sr;
    let v = (Math.random() * 2 - 1) * Math.exp(-t / 0.004) * 0.5;
    for (const [f, decay, amp] of modes) v += amp * Math.exp(-t / decay) * Math.sin(2 * Math.PI * f * t);
    d[i] = v;
  }
  return buf;
}

/** 小房间混响冲激响应：早期反射 + 指数衰减的噪声尾巴，越往后越暗 */
function makeRoomIR(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 1.6);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i += 1) {
      const t = i / sr;
      const k = 0.15 + 0.8 * Math.min(1, t / 1.2); // 时间越长滤得越狠
      lp += (1 - k) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t / 0.32) * (t < 0.012 ? t / 0.012 : 1);
    }
    for (const [ms, amp] of [[7, 0.5], [13, 0.35], [19, 0.3], [27, 0.22], [38, 0.16]]) {
      const idx = Math.floor((ms + ch * 1.7) * sr / 1000);
      if (idx < len) d[idx] += amp * (ch ? -1 : 1);
    }
  }
  return buf;
}

function nearestZone(zones, midi) {
  let best = zones[0];
  let diff = Infinity;
  for (const z of zones) {
    // 同样距离时优先用低一点的采样向上移调（向下移调更容易发闷）
    const d = Math.abs(midi - z) + (z > midi ? 0.4 : 0);
    if (d < diff) { diff = d; best = z; }
  }
  return best;
}

function peakOf(buffer) {
  const d = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  return peak;
}

function detectOnset(buffer) {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.35));
  let peak = 0;
  for (let i = 0; i < limit; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  const threshold = Math.max(0.004, peak * 0.06);
  for (let i = 0; i < limit; i += 1) {
    if (Math.abs(data[i]) >= threshold) return Math.max(0, i / buffer.sampleRate - 0.0015);
  }
  return 0;
}

function karplus(ctx, freq) {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * 2.2);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i += 1) ring[i] = Math.random() * 2 - 1;
  const decay = 0.996 - Math.min(freq / 20000, 0.012);
  let lp = 0;
  for (let i = 0; i < length; i += 1) {
    const idx = i % period;
    const nextIdx = (idx + 1) % period;
    const value = (ring[idx] + ring[nextIdx]) * 0.5 * decay;
    ring[idx] = value;
    lp = lp * 0.55 + value * 0.45;
    out[i] = lp * 0.8;
  }
  return buffer;
}
