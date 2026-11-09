// AI 识谱：把吉他谱图片（六线谱 / 简谱 / 和弦谱）交给 Claude 看图，转成本应用的文字谱。
// 纯前端：用户自己的 API Key 只存在本机浏览器，请求直接从浏览器发到 Anthropic。
// SDK 按需从 jsDelivr 加载（固定版本），没点 AI 识谱就不下载。

import { STYLES } from "./songs.js?v=3.2";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
const MODEL = "claude-opus-5-5";
const MAX_EDGE = 1800; // 图片最长边，够看清和弦名又不浪费 token

const STYLE_IDS = Object.keys(STYLES);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bpm", "meter", "capo", "rhythm", "style", "sheet", "notes"],
  properties: {
    title: { type: "string", description: "歌名，看不出就空字符串" },
    bpm: { type: "integer", description: "速度（每分钟拍数）。谱上有 ♩=68 之类就照写；没有就按这首歌常见速度估计；完全不知道写 0" },
    meter: { type: "integer", description: "每小节几拍：4/4 写 4，3/4 和 6/8 写 3" },
    capo: { type: "integer", description: "变调夹品位。Capo=2 或「1=D 用C调指法」都写 2；没有写 0" },
    rhythm: { type: "string", description: "主歌右手节奏型，一小节（4/4 写 8 个八分音符位置，3/4 写 6 个）。扫弦用 D U x B A -；分解用 R A 和弦号 1-6。看不出写空字符串" },
    style: { type: "string", enum: STYLE_IDS, description: "最接近的曲风" },
    sheet: { type: "string", description: "按规则写成的文字谱正文" },
    notes: { type: "string", description: "用中文简短说明拿不准的地方（看不清的和弦、估计的速度等），没有就空字符串" },
  },
};

const SYSTEM = `你是吉他谱转写助手。用户给你一页或几页吉他谱图片（六线谱 + 简谱 + 和弦图 + 歌词），你要把它转成「空气吉他」网页能直接弹的文字谱。只输出符合 JSON schema 的结果。

## sheet 正文怎么写
- 每一句歌词一行。和弦写成方括号，放在**从这个字开始换和弦**的那个字前面，例如：[C]听见冬天[G]的离开
- 用 | 分小节，每个小节都要有，和谱上的小节线一一对应：| [C]听见冬天[G]的离 | [Am]开 我在某年 |
  - 一个小节里有两个和弦就都写进去，网页会平分拍子
  - 小节里没有新和弦（沿用上一个），照样写出这个小节，里面放歌词或写 -
- 没有歌词的小节（前奏、间奏、尾奏）单独一行，前面加段落名：
  [前奏]
  | [Fmaj7] [G] | [C] [Am] | [Fmaj7] [G] | [C] [E] |
- 段落名用 [前奏] [主歌] [副歌] [间奏] [尾奏] 这类中文，独占一行
- 有反复记号、上下两行歌词（第一遍 / 第二遍）时，按演唱顺序完整写出：先第一遍整段，再第二遍整段（和弦照抄）
- 不要写简谱数字、指法、六线谱数字；只写和弦、小节线、歌词、段落名
- 和弦名照谱上写：Fmaj7、E/B、G7、Dm7、A7、Fm、Cadd9 等；小节里的空拍不用写

## 节奏型 rhythm 怎么读（看主歌部分六线谱上的右手记号）
- 箭头 = 扫弦。中国吉他谱里向上的箭头 ↑ 是**下扫** D（从低音弦扫向高音弦），向下的箭头 ↓ 是**上扫** U；带 × 的箭头或 × 在全部弦上是切音 x
- × 打在单根弦上 = 分解（拨单弦）。六线谱最上面一条线是 1 弦（最细），最下面是 6 弦
  - 小节第一下打在低音弦（4/5/6 弦）上的写 R（根音，会随和弦自动换弦），小节中间第二个低音写 A（交替低音），其它写弦号
  - 例：R3231323、R2A1R2A1
- 先打低音再扫弦的写 B，例：B-DU-UDU
- 以八分音符为一格：4/4 拍写 8 格，3/4 拍写 6 格；十六分音符合并到所在的八分格；不弹的格写 -
- 只写一个最有代表性的小节；完全看不出就留空

## 其它
- 曲风 style 从给定选项里挑最接近的（慢、分解 → ballad / fingerstyle；民谣扫弦 → folk；流行切音 → pop；三拍子 → waltz 或 waltz_fingers）
- 看不清的地方按音乐常识推断，并在 notes 里说明`;

async function imageBlock(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

/** 把 AI 返回的 JSON 拼成带谱头的文字谱 */
export function sheetTextFromResult(r) {
  const head = [];
  if (r.title) head.push(`标题: ${r.title}`);
  if (r.bpm) head.push(`速度: ${r.bpm}`);
  if (r.meter) head.push(`拍号: ${r.meter}/4`);
  if (r.capo) head.push(`变调夹: ${r.capo}`);
  if (r.rhythm) head.push(`节奏: ${r.rhythm}`);
  if (r.style) head.push(`曲风: ${r.style}`);
  return `${head.join("\n")}\n${String(r.sheet || "").trim()}\n`;
}

/**
 * @param {File[]} files 谱子图片（按页顺序）
 * @param {string} apiKey 用户自己的 Anthropic API Key
 * @param {{client?: object, onStatus?: (t: string) => void}} opts client 可注入，便于测试
 */
export async function recognizeSheetWithClaude(files, apiKey, { client, onStatus } = {}) {
  onStatus?.("正在准备图片…");
  const images = await Promise.all(files.map(imageBlock));
  if (!client) {
    onStatus?.("正在连接 Claude…");
    const { default: Anthropic } = await import(SDK_URL);
    // 纯前端网页没有服务器，只能在浏览器里直接带用户自己的 Key 调用
    client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }
  onStatus?.(`Claude 正在看谱（${files.length} 页，通常 20–60 秒）…`);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // 万一被安全分类误拦，服务器自动换模型重试
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        ...images,
        { type: "text", text: `这是同一首歌的 ${files.length} 页吉他谱，按顺序排列。请转写成文字谱。` },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("refusal"), { code: "refusal" });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("too long"), { code: "too_long" });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const result = JSON.parse(text);
  return { result, sheet: sheetTextFromResult(result), usage: response.usage };
}
