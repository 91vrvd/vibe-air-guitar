// 歌曲：内置几首公有领域的歌 + 和弦练习走向，以及把用户粘贴的“文字谱”解析成 歌词 + 和弦。
// 不内置受版权保护的歌词；用户可以从有谱么等网站复制自己看到的文字谱粘贴进来（只存在本机浏览器）。
//
// 支持三种写法：
// 1. 方括号嵌在歌词里：[C]长亭外 [F]古道[C]边
// 2. 和弦行在上、歌词行在下（吉他谱网站最常见）：
//      C        F    C
//      长亭外    古道边
// 3. 只有和弦：C G Am F（用来练和弦走向）

import { normalizeChord, parseChord, NOTE_NAMES } from "./theory.js?v=2.9";

export const BUILTIN_SONGS = [
  {
    id: "songbie",
    title: "送别（李叔同词，公有领域）",
    key: "C",
    text: `[C]长亭外，[F]古道[C]边，芳草碧连[G]天。
[C]晚风拂柳[F]笛声[C]残，夕阳[G]山外[C]山。
[F]天之涯，[C]地之角，[Dm]知交半零[G]落。
[C]一壶浊酒[F]尽余[C]欢，今宵[G]别梦[C]寒。`,
  },
  {
    id: "birthday",
    title: "生日快乐（公有领域）",
    key: "C",
    text: `[C]祝你生日[G]快乐，
祝你生日[C]快乐，
祝你生[F]日快乐，
[C]祝你[G]生日[C]快乐。`,
  },
  {
    id: "twinkle",
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
    title: "Amazing Grace（公有领域）",
    key: "G",
    text: `A[G]mazing grace, how [C]sweet the [G]sound
That saved a wretch like [D]me
I [G]once was lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see`,
  },
  { id: "p_pop", title: "和弦练习：流行 1-5-6-4（C G Am F）", key: "C", text: "C G Am F" },
  { id: "p_canon", title: "和弦练习：卡农（C G Am Em F C F G）", key: "C", text: "C G Am Em F C F G" },
  { id: "p_50s", title: "和弦练习：50 年代（C Am F G）", key: "C", text: "C Am F G" },
  { id: "p_sad", title: "和弦练习：小调抒情（Am F C G）", key: "C", text: "Am F C G" },
  { id: "p_jpop", title: "和弦练习：日系 4-5-3-6（F G Em Am）", key: "C", text: "F G Em Am" },
  { id: "p_folk", title: "和弦练习：民谣 G 调（G D Em C）", key: "G", text: "G D Em C" },
  { id: "p_251", title: "和弦练习：爵士 2-5-1（Dm7 G7 Cmaj7）", key: "C", text: "Dm7 G7 Cmaj7" },
  { id: "p_blues", title: "和弦练习：12 小节布鲁斯（A 调）", key: "A", text: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7" },
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
  const tokens = line.trim().split(/[\s|｜]+/).filter((x) => x && !/^[-–—.:：]+$/.test(x));
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

/**
 * 解析文字谱
 * @returns {{lines: {text:string, chords:{at:number, name:string, seq:number}[]}[], sequence: {name:string, line:number}[]}}
 */
export function parseSheet(input) {
  const raw = String(input || "").replace(/\r/g, "").replace(/\t/g, "    ").split("\n");
  const lines = [];
  const pushLine = (text, chords) => lines.push({ text, chords });

  for (let i = 0; i < raw.length; i += 1) {
    const line = raw[i].replace(/\s+$/, "");
    if (!line.trim()) continue;

    // 写法 1：[C] 嵌在歌词里
    if (/\[[^\]]+\]/.test(line)) {
      let text = "";
      const chords = [];
      const re = /\[([^\]]+)\]/g;
      let last = 0;
      let m;
      while ((m = re.exec(line))) {
        text += line.slice(last, m.index);
        const name = chordToken(m[1]);
        if (name) chords.push({ at: text.length, name });
        else text += m[1] ? `【${m[1]}】` : ""; // [Verse] 之类的段落名原样保留
        last = re.lastIndex;
      }
      text += line.slice(last);
      if (chords.length || text.trim()) pushLine(text.trim() ? text : "", chords);
      continue;
    }

    // 写法 2：和弦行 + 歌词行
    if (isChordLine(line)) {
      const next = raw[i + 1] !== undefined ? raw[i + 1].replace(/\s+$/, "") : "";
      const hasLyric = next.trim() && !isChordLine(next) && !/\[[^\]]+\]/.test(next);
      const chords = [];
      const re = /\S+/g;
      let m;
      while ((m = re.exec(line))) {
        const name = chordToken(m[0]);
        if (!name) continue;
        chords.push({ at: hasLyric ? charIndexAtColumn(next, m.index) : 0, name });
      }
      if (hasLyric) {
        pushLine(next, chords);
        i += 1;
      } else {
        pushLine("", chords);
      }
      continue;
    }

    // 只有歌词（这一行沿用前面的和弦）
    pushLine(line.trim(), []);
  }

  const sequence = [];
  lines.forEach((ln, li) => {
    ln.chords.sort((a, b) => a.at - b.at);
    ln.chords.forEach((c) => {
      c.seq = sequence.length;
      sequence.push({ name: c.name, line: li });
    });
  });
  return { lines, sequence };
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
