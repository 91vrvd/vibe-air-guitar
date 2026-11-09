// 歌曲：内置几首公有领域的歌 + 和弦练习走向，以及把用户粘贴的“文字谱”解析成 歌词 + 和弦。
// 不内置受版权保护的歌词；用户可以从有谱么等网站复制自己看到的文字谱粘贴进来（只存在本机浏览器）。
//
// 支持三种写法：
// 1. 方括号嵌在歌词里：[C]长亭外 [F]古道[C]边
// 2. 和弦行在上、歌词行在下（吉他谱网站最常见）：
//      C        F    C
//      长亭外    古道边
// 3. 只有和弦：C G Am F（用来练和弦走向）

import { normalizeChord, parseChord, NOTE_NAMES } from "./theory.js?v=3.3";

// 曲风：选歌或导入时自动配好速度、弹法、节奏型和鼓（用户之后仍可在设置里改）
// 字段：bpm 速度；style 弹法 strum 扫弦 / arp 分解；strumId / arpId 见 patterns.js；drumsOn 是否开鼓；drumId 鼓型
export const STYLES = {
  ballad: { name: "抒情慢歌", bpm: 72, style: "arp", arpId: "slow", drumsOn: true, drumId: "ballad" },
  folk: { name: "民谣弹唱", bpm: 88, style: "strum", strumId: "bass_folk", drumsOn: true, drumId: "folk" },
  pop: { name: "流行", bpm: 100, style: "strum", strumId: "chop", drumsOn: true, drumId: "pop" },
  rock: { name: "摇滚", bpm: 124, style: "strum", strumId: "rock", drumsOn: true, drumId: "rock" },
  kids: { name: "儿歌", bpm: 96, style: "strum", strumId: "quarters", drumsOn: true, drumId: "light" },
  waltz: { name: "三拍子（华尔兹）", bpm: 100, style: "strum", strumId: "waltz", drumsOn: true, drumId: "standard" },
  waltz_fingers: { name: "三拍子指弹", bpm: 80, style: "arp", arpId: "waltz_arp", drumsOn: false, drumId: "light" },
  fingerstyle: { name: "安静指弹", bpm: 76, style: "arp", arpId: "travis", drumsOn: false, drumId: "light" },
  blues: { name: "布鲁斯", bpm: 90, style: "strum", strumId: "shuffle", drumsOn: true, drumId: "shuffle" },
  reggae: { name: "雷鬼", bpm: 92, style: "strum", strumId: "ska", drumsOn: true, drumId: "reggae" },
};

export const BUILTIN_SONGS = [
  {
    id: "songbie",
    style: "ballad",
    title: "送别（李叔同词，公有领域）",
    key: "C",
    text: `[C]长亭外，[F]古道[C]边，芳草碧连[G]天。
[C]晚风拂柳[F]笛声[C]残，夕阳[G]山外[C]山。
[F]天之涯，[C]地之角，[Dm]知交半零[G]落。
[C]一壶浊酒[F]尽余[C]欢，今宵[G]别梦[C]寒。`,
  },
  {
    id: "birthday",
    style: "waltz",
    title: "生日快乐（公有领域）",
    key: "C",
    text: `[C]祝你生日[G]快乐，
祝你生日[C]快乐，
祝你生[F]日快乐，
[C]祝你[G]生日[C]快乐。`,
  },
  {
    id: "twinkle",
    style: "kids",
    title: "小星星（传统儿歌）",
    key: "C",
    text: `[C]一闪一闪[F]亮晶[C]晶，
[F]满天[C]都是[G]小星[C]星。
[C]挂在[F]天上[C]放光[G]明，
[C]好像[F]许多[C]小眼[G]睛。
[C]一闪一闪[F]亮晶[C]晶，
[F]满天[C]都是[G]小星[C]星。`,
  },
  {
    id: "amazing_grace",
    style: "waltz_fingers",
    title: "Amazing Grace（公有领域）",
    key: "G",
    text: `A[G]mazing grace, how [C]sweet the [G]sound
That saved a wretch like [D]me
I [G]once was lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see`,
  },
  { id: "p_pop", style: "pop", title: "和弦练习：流行 1-5-6-4（C G Am F）", key: "C", text: "C G Am F" },
  { id: "p_canon", style: "ballad", title: "和弦练习：卡农（C G Am Em F C F G）", key: "C", text: "C G Am Em F C F G" },
  { id: "p_50s", style: "folk", title: "和弦练习：50 年代（C Am F G）", key: "C", text: "C Am F G" },
  { id: "p_sad", style: "ballad", title: "和弦练习：小调抒情（Am F C G）", key: "C", text: "Am F C G" },
  { id: "p_jpop", style: "pop", title: "和弦练习：日系 4-5-3-6（F G Em Am）", key: "C", text: "F G Em Am" },
  { id: "p_folk", style: "folk", title: "和弦练习：民谣 G 调（G D Em C）", key: "G", text: "G D Em C" },
  { id: "p_251", style: "fingerstyle", title: "和弦练习：爵士 2-5-1（Dm7 G7 Cmaj7）", key: "C", text: "Dm7 G7 Cmaj7" },
  { id: "p_blues", style: "blues", title: "和弦练习：12 小节布鲁斯（A 调）", key: "A", text: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7" },
];

// 和弦记号：支持 C、C#m7、Bbmaj7、Dsus4、G/B（斜线低音按根音处理）
const CHORD_TOKEN = /^[A-G][#b♯♭]?(maj7|M7|m7|min7|m|min|7|sus2|sus4|sus|dim|aug|add9|6|9|M)?(\/[A-G][#b♯♭]?)?$/;

/** 把各种写法变成本应用支持的和弦名；不认识的扩展（add9、6、9）退回到基本三和弦 */
export function chordToken(raw) {
  const t = String(raw || "").trim().replace(/[()（）]/g, "");
  if (!CHORD_TOKEN.test(t)) return "";
  const base = t.split("/")[0].replace(/(add9|6|9)$/, "");
  return normalizeChord(base);
}

function isChordLine(line) {
  const tokens = line.trim().split(/[\s|｜]+/).filter((x) => x && !/^[-–—.:：%]+$/.test(x));
  return tokens.length > 0 && tokens.every((x) => chordToken(x));
}

// 等宽排版里中文占 2 格，用来把和弦行的列位置对到歌词的字上
function charIndexAtColumn(text, col) {
  let w = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (w >= col) return i;
    w += /[⺀-￿]/.test(text[i]) ? 2 : 1;
  }
  return text.length;
}

// 谱头信息：标题 / 速度 / 拍号 / 变调夹 / 节奏，以及常见写法 1=D 4/4、Capo=2、♩=68
const META_LINE = /^\s*(标题|歌名|title|速度|拍速|bpm|拍号|meter|变调夹|capo|节奏|rhythm|曲风|style)\s*[:：=]\s*(.+)$/i;

function parseMetaLine(line, meta) {
  let hit = false;
  const m = line.match(META_LINE);
  if (m) {
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (["标题", "歌名", "title"].includes(k)) meta.title = v;
    else if (["速度", "拍速", "bpm"].includes(k)) { const n = Number(v.match(/\d{2,3}/)?.[0]); if (n) meta.bpm = n; }
    else if (["拍号", "meter"].includes(k)) { const n = Number(v.match(/(\d)\s*\/\s*\d/)?.[1]); if (n) meta.meter = n === 6 ? 3 : n; }
    else if (["变调夹", "capo"].includes(k)) { const n = Number(v.match(/\d+/)?.[0]); if (!Number.isNaN(n)) meta.capo = n; }
    else if (["节奏", "rhythm"].includes(k)) meta.rhythm = v.replace(/\s+/g, "");
    else if (["曲风", "style"].includes(k)) meta.style = v;
    return true;
  }
  // 简谱 / 六线谱谱头：1=D 4/4、Capo=2、♩=68
  const key = line.match(/1\s*=\s*([A-G][#b]?)/);
  if (key) { meta.key = key[1]; hit = true; }
  const meter = line.match(/(?:^|\s)([2346])\s*\/\s*(4|8)(?:\s|$)/);
  if (meter && (key || /拍/.test(line) || line.trim().length < 12)) { meta.meter = Number(meter[1]) === 6 ? 3 : Number(meter[1]); hit = true; }
  const capo = line.match(/capo\s*[=:：]?\s*(\d+)/i);
  if (capo) { meta.capo = Number(capo[1]); hit = true; }
  const bpm = line.match(/[♩=]\s*=?\s*(\d{2,3})\b/);
  if (bpm && /♩/.test(line)) { meta.bpm = Number(bpm[1]); hit = true; }
  return hit && !/[\[\]]/.test(line) && line.replace(/1\s*=\s*[A-G][#b]?|[2346]\s*\/\s*[48]|capo\s*[=:：]?\s*\d+|♩\s*=\s*\d+|[,，;；\s]|用.?调指法|拍号|拍速/gi, "").length < 4;
}

/** 把谱上写的节奏变成引擎能用的：扫弦 D/U/x/B/A/-，或分解 R/A/弦号 */
export function parseRhythm(text) {
  const t = String(text || "").replace(/[\s|｜,，]/g, "").replace(/↓/g, "D").replace(/↑/g, "U").replace(/×/g, "x");
  if (!t) return null;
  if (/^[DUXxBA-]+$/.test(t) && /[DU]/.test(t)) {
    const pattern = t.replace(/X/g, "x");
    return pattern.length === 6 || pattern.length === 8 ? { type: "strum", pattern, meter: pattern.length / 2 } : null;
  }
  if (/^[RA1-6]+$/i.test(t)) {
    const steps = [...t.toUpperCase()].map((c) => (/\d/.test(c) ? Number(c) : c));
    return steps.length === 6 || steps.length === 8 ? { type: "arp", steps, meter: steps.length / 2 } : null;
  }
  return null;
}

/**
 * 解析文字谱
 * - 和弦：[C] 写在歌词里，或者和弦行在上、歌词行在下
 * - 小节线：| 分小节；同一小节里的几个和弦平分拍子；只有歌词或写 - / % 的小节沿用上一个和弦
 *   （整首没写 | 时，每个和弦默认一小节）
 * - 谱头：速度、拍号、变调夹、节奏（见 parseMetaLine）
 * @returns {{lines, sequence: {name, line, beats?}[], meta}}
 */
export function parseSheet(input) {
  const raw = String(input || "").replace(/\r/g, "").replace(/\t/g, "    ").split("\n");
  const lines = [];
  const meta = {};
  const events = []; // {t:"chord"} | {t:"bar"} | {t:"text"} | {t:"hold"}
  const pushLine = (text, chords) => lines.push({ text, chords });

  for (let i = 0; i < raw.length; i += 1) {
    const line = raw[i].replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (parseMetaLine(line, meta)) continue;

    // 写法 1：[C] 嵌在歌词里（可带 | 小节线）
    if (/\[[^\]]+\]/.test(line) || /\|/.test(line) && !isChordLine(line)) {
      let text = "";
      const chords = [];
      const re = /\[([^\]]+)\]|\|/g;
      let last = 0;
      let m;
      const addText = (seg) => {
        if (!seg) return;
        if (/^[\s\-–—%]+$/.test(seg)) { if (/[-–—%]/.test(seg)) events.push({ t: "hold" }); text += seg.replace(/[-–—%]/g, " "); return; }
        events.push({ t: "text" });
        text += seg;
      };
      while ((m = re.exec(line))) {
        addText(line.slice(last, m.index));
        if (m[0] === "|") {
          events.push({ t: "bar" });
        } else {
          const name = chordToken(m[1]);
          if (name) { chords.push({ at: text.length, name }); events.push({ t: "chord" }); }
          else text += m[1] ? `【${m[1]}】` : ""; // [主歌] 之类的段落名原样保留
        }
        last = re.lastIndex;
      }
      addText(line.slice(last));
      const clean = text.replace(/\s+$/, "");
      const lead = clean.length - clean.trimStart().length;
      chords.forEach((c) => { c.at = Math.max(0, Math.min(clean.trim().length, c.at - lead)); });
      if (chords.length || clean.trim()) pushLine(clean.trim(), chords);
      continue;
    }

    // 写法 2：和弦行 + 歌词行
    if (isChordLine(line)) {
      const next = raw[i + 1] !== undefined ? raw[i + 1].replace(/\s+$/, "") : "";
      const hasLyric = next.trim() && !isChordLine(next) && !/\[[^\]]+\]/.test(next) && !META_LINE.test(next);
      const chords = [];
      const re = /\||[^\s|｜]+/g;
      let m;
      while ((m = re.exec(line))) {
        if (m[0] === "|") { events.push({ t: "bar" }); continue; }
        if (/^[-–—%]+$/.test(m[0])) { events.push({ t: "hold" }); continue; }
        const name = chordToken(m[0]);
        if (!name) continue;
        chords.push({ at: hasLyric ? charIndexAtColumn(next, m.index) : 0, name });
        events.push({ t: "chord" });
      }
      if (hasLyric) {
        pushLine(next.trim() ? next : "", chords);
        i += 1;
      } else {
        pushLine("", chords);
      }
      continue;
    }

    // 只有歌词（这一行沿用前面的和弦）
    events.push({ t: "text" });
    pushLine(line.trim(), []);
  }

  const sequence = [];
  lines.forEach((ln, li) => {
    ln.chords.forEach((c) => {
      c.seq = sequence.length;
      sequence.push({ name: c.name, line: li });
    });
  });

  // 按小节线算每个和弦弹几拍
  const meter = meta.meter || 4;
  if (events.some((e) => e.t === "bar")) {
    let seq = 0;
    let bar = { chords: [], filler: false };
    const close = () => {
      if (bar.chords.length) {
        const each = meter / bar.chords.length;
        bar.chords.forEach((k) => { sequence[k].beats = (sequence[k].beats || 0) + each; });
      } else if (bar.filler && seq > 0) {
        sequence[seq - 1].beats = (sequence[seq - 1].beats || meter) + meter;
      }
      bar = { chords: [], filler: false };
    };
    for (const e of events) {
      if (e.t === "chord") bar.chords.push(seq++);
      else if (e.t === "bar") close();
      else bar.filler = true;
    }
    close();
    sequence.forEach((c) => { if (!c.beats) c.beats = meter; });
  }
  return { lines, sequence, meta };
}

/** 猜调：第一个和弦是大调就用它的根音，是小调就取关系大调 */
export function guessKey(sequence) {
  const first = parseChord(sequence[0]?.name || "C");
  if (!first) return "C";
  const minor = first.quality === "m" || first.quality === "m7";
  return NOTE_NAMES[(first.root + (minor ? 3 : 0)) % 12];
}

/** 出现最多的几个和弦（按首次出现顺序），给“自由弹”分配手指用 */
export function topChords(sequence, n = 5) {
  const count = new Map();
  sequence.forEach((c) => count.set(c.name, (count.get(c.name) || 0) + 1));
  const order = [...count.keys()];
  return order.sort((a, b) => count.get(b) - count.get(a) || order.indexOf(a) - order.indexOf(b)).slice(0, n);
}


/**
 * 给导入的歌猜曲风：先看谱里写没写拍号 / 速度 / 风格字样，再看小调和弦多不多。
 * @returns {{styleId: string, bpm: number|null, reason: string}}
 */
export function detectStyle(text, sequence) {
  const raw = String(text || "");
  const bpmMatch = raw.match(/(?:BPM|bpm|拍速|速度|♩\s*=)\s*[:：=]?\s*(\d{2,3})/);
  const bpm = bpmMatch ? Math.max(50, Math.min(180, Number(bpmMatch[1]))) : null;
  const pick = (styleId, reason) => ({ styleId, bpm, reason });
  if (/(3\/4|6\/8|三拍)/.test(raw)) return pick("waltz", "谱里写了三拍子");
  const words = [
    [/摇滚|rock/i, "rock", "谱里写了摇滚"],
    [/布鲁斯|blues/i, "blues", "谱里写了布鲁斯"],
    [/雷鬼|reggae/i, "reggae", "谱里写了雷鬼"],
    [/儿歌|童谣/, "kids", "谱里写了儿歌"],
    [/指弹|分解/, "fingerstyle", "谱里写了指弹/分解"],
    [/民谣|folk/i, "folk", "谱里写了民谣"],
    [/抒情|慢歌|ballad/i, "ballad", "谱里写了抒情"],
    [/流行|pop/i, "pop", "谱里写了流行"],
  ];
  for (const [re, id, reason] of words) if (re.test(raw)) return pick(id, reason);
  const names = (sequence || []).map((c) => c.name);
  const minor = names.filter((n) => /m(?!aj)/.test(n)).length / Math.max(1, names.length);
  if (bpm && bpm < 80) return pick("ballad", `速度 ${bpm}，偏慢`);
  if (bpm && bpm > 116) return pick("pop", `速度 ${bpm}，偏快`);
  if (minor >= 0.4) return pick("ballad", "小调和弦多，偏抒情");
  return pick("folk", "没写风格，按民谣弹唱处理");
}

// ---------- 截图识别结果 → 文字谱 ----------
// OCR 常把 m 认成 rn、把 C 认成小写
function fixChordOcr(t) {
  return String(t || "").trim().replace(/rn/g, "m").replace(/^([a-g])(?=$|[#bm7s])/, (c) => c.toUpperCase()).replace(/[|｜]/g, "");
}

function ocrWords(line) {
  return (line.words || []).map((w) => ({ text: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, symbols: w.symbols || [] })).filter((w) => w.text);
}

function ocrIsChordLine(line) {
  const words = ocrWords(line);
  return words.length > 0 && words.every((w) => chordToken(fixChordOcr(w.text)));
}

function joinCjk(text) {
  // 中文 OCR 常在字之间插空格
  return text.replace(/([\u2e80-\uffff])\s+(?=[\u2e80-\uffff])/g, "$1").trim();
}

/**
 * 把 Tesseract 的行/词/字符坐标转成 [C] 方括号文字谱：和弦行里每个和弦按横坐标落到下一行最近的字前面。
 * @param lines Tesseract result.data.lines
 */
export function sheetFromOcrLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.text || !line.text.trim()) continue;
    if (!ocrIsChordLine(line)) { out.push(joinCjk(line.text)); continue; }
    const chords = ocrWords(line).map((w) => ({ name: chordToken(fixChordOcr(w.text)), x: w.x0 }));
    const next = lines[i + 1];
    if (!next || !next.text?.trim() || ocrIsChordLine(next)) {
      out.push(chords.map((c) => `[${c.name}]`).join(" "));
      continue;
    }
    const symbols = ocrWords(next).flatMap((w) => (w.symbols.length ? w.symbols.map((sy) => ({ t: sy.text, x0: sy.bbox.x0, x1: sy.bbox.x1 })) : [{ t: w.text, x0: w.x0, x1: w.x1 }]));
    const inserts = new Map();
    for (const c of chords) {
      let idx = symbols.findIndex((sy) => (sy.x0 + sy.x1) / 2 >= c.x - 2);
      if (idx < 0) idx = symbols.length;
      inserts.set(idx, (inserts.get(idx) || "") + `[${c.name}]`);
    }
    let text = "";
    symbols.forEach((sy, k) => { text += (inserts.get(k) || "") + sy.t; });
    text += inserts.get(symbols.length) || "";
    out.push(text);
    i += 1;
  }
  return out.join("\n");
}
