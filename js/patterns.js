// 节奏型数据。每一步 = 八分音符（4/4 拍一小节 8 步，3/4 拍 6 步）。
// 扫弦符号：D=下扫 U=上扫 x=切音（闷音） B=只弹根音 A=只弹交替低音 -=空拍（让前面的音继续响）
// 分解符号：R=根音弦 A=交替低音弦 数字=弦号（1=最细的高音 e … 6=最粗的低音 E），数组=几根弦同时弹
//
// 2026-11 复核：按国内吉他教学和“自动挡”弹唱 App 常用的节奏型整理，去掉重复和名不副实的条目。
// swing 是“后半拍推迟”的比例（0=平均八分，0.33≈三连音摇摆）。

export const STRUM_PATTERNS = [
  { id: "folk", name: "民谣万能（下 下上 上下上）", pattern: "D-DU-UDU", bpm: 88, swing: 0 },
  { id: "bass_folk", name: "低音 + 民谣扫弦", pattern: "B-DU-UDU", bpm: 84, swing: 0 },
  { id: "quarters", name: "四分下扫（最简单）", pattern: "D-D-D-D-", bpm: 80, swing: 0 },
  { id: "eighths", name: "均匀八分（下上下上）", pattern: "DUDUDUDU", bpm: 96, swing: 0 },
  { id: "ballad", name: "抒情慢歌（低音-扫）", pattern: "B-D-A-DU", bpm: 72, swing: 0.04 },
  { id: "chop", name: "切音（流行常用）", pattern: "DUxUDUxU", bpm: 100, swing: 0 },
  { id: "chorus", name: "副歌推进", pattern: "D-DUDUDU", bpm: 112, swing: 0 },
  { id: "country", name: "乡村低音交替", pattern: "B-DUA-DU", bpm: 104, swing: 0.06 },
  { id: "rock", name: "摇滚八分下扫", pattern: "DDDDDDDD", bpm: 124, swing: 0, short: true },
  { id: "ska", name: "雷鬼 / 斯卡反拍", pattern: "-U-U-U-U", bpm: 96, swing: 0.05, short: true },
  { id: "shuffle", name: "布鲁斯摇摆", pattern: "DUDUDUDU", bpm: 90, swing: 0.3 },
  { id: "waltz", name: "华尔兹 3/4（低音 扫 扫）", pattern: "B-DUDU", bpm: 96, swing: 0, meter: 3 },
];

export const ARP_PATTERNS = [
  { id: "classic", name: "经典分解 R3231323", steps: ["R", 3, 2, 3, 1, 3, 2, 3] },
  { id: "slow", name: "慢歌分解 R321 2323", steps: ["R", 3, 2, 1, 2, 3, 2, 3] },
  { id: "updown", name: "上行下行 R4321234", steps: ["R", 4, 3, 2, 1, 2, 3, 4] },
  { id: "travis", name: "交替低音（Travis 指弹）", steps: ["R", 2, "A", 1, "R", 2, "A", 1] },
  { id: "pinch", name: "掐弹（低音和高音一起）", steps: [["R", 1], 3, 2, 3, ["A", 1], 3, 2, 3] },
  { id: "boom_chuck", name: "低音 + 和弦拨（Boom-chick）", steps: ["R", [3, 2, 1], "A", [3, 2, 1], "R", [3, 2, 1], "A", [3, 2, 1]] },
  { id: "waltz_arp", name: "3/4 分解 R32123", steps: ["R", 3, 2, 1, 2, 3], meter: 3 },
];

export const DEFAULT_CUSTOM_STEPS = ["R", 3, 2, 3, 1, 3, 2, 3];

// 鼓：hit(type, offsetIn16th, level)；s = 小节内八分音符序号 0–7（0,2,4,6 是第 1-4 拍）
export const DRUM_PATTERNS = [
  { id: "standard", name: "标准流行（1、3 底鼓，2、4 军鼓）", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 1); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.6 : 0.9); } },
  { id: "pop", name: "流行律动（多一个底鼓）", play(s, b, hit) { if ([0, 3, 4].includes(s)) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.55 : 0.85); } },
  { id: "ballad", name: "抒情慢歌（边击）", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.65); if (s === 5) hit("kick", 0, 0.45); if (s === 2 || s === 6) hit("rim", 0, 0.6); if (s % 2 === 0) hit("hat", 0, 0.4); } },
  { id: "light", name: "轻柔镲帽（安静伴唱）", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.55); if (s === 4) hit("kick", 0, 0.4); if (s === 2 || s === 6) hit("rim", 0, 0.4); hit("hat", 0, s % 2 ? 0.3 : 0.5); } },
  { id: "folk", name: "民谣（八分镲 + 后半拍点缀）", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.85); if (s === 2 || s === 6) hit("snare", 0, 0.7); hit("hat", 0, s % 2 ? 0.45 : 0.7); if (s === 1 || s === 5) hit("hat", 1, 0.3); } },
  { id: "rock", name: "摇滚（重底鼓 + 镲片）", play(s, b, hit) { if ([0, 1, 4, 5].includes(s)) hit("kick", 0, 1); if (s === 2 || s === 6) hit("snare", 0, 1.15); hit("hat", 0, s % 2 ? 0.7 : 0.95); if (b % 4 === 0 && s === 0) hit("crash", 0, 0.8); } },
  { id: "disco", name: "迪斯科（四踩 + 反拍开镲）", play(s, b, hit) { if (s % 2 === 0) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 0.9); if (s % 2) hit("ride", 0, 0.6); else hit("hat", 0, 0.5); } },
  { id: "funk", name: "放克（十六分碎拍）", play(s, b, hit) { if (s === 0 || s === 5) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.4 : 0.75); hit("hat", 1, 0.3); } },
  { id: "hiphop", name: "嘻哈（慢、底鼓切分）", play(s, b, hit) { if (s === 0) hit("kick", 0, 1); if (s === 3) hit("kick", 1, 0.8); if (s === 5) hit("kick", 0, 0.9); if (s === 2 || s === 6) hit("snare", 0, 0.95); hit("hat", 0, s % 2 ? 0.4 : 0.6); } },
  { id: "halftime", name: "半速 / Trap（军鼓在第 3 拍）", play(s, b, hit) { if (s === 0) hit("kick", 0, 1.1); if (s === 3) hit("kick", 1, 0.7); if (s === 4) hit("snare", 0, 1.05); hit("hat", 0, 0.48); if (s % 2) hit("hat", 1, 0.3); } },
  { id: "reggae", name: "雷鬼 One Drop（第 3 拍一起落）", play(s, b, hit) { if (s === 4) { hit("kick", 0, 0.9); hit("rim", 0, 0.85); } if (s % 2) hit("hat", 0, 0.65); else hit("hat", 0, 0.3); } },
  { id: "bossa", name: "波萨诺瓦（拉丁）", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.7); if (s === 3 || s === 7) hit("kick", 0, 0.45); const clave = b % 2 === 0 ? [0, 3, 6] : [2, 4]; if (clave.includes(s)) hit("rim", 0, 0.75); hit("hat", 0, s % 2 ? 0.35 : 0.55); } },
  { id: "shuffle", name: "布鲁斯摇摆（叮-嗒叮）", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.7); if (s === 2 || s === 6) hit("snare", 0, 0.75); hit("ride", 0, s % 2 ? 0.45 : 0.7); } },
  { id: "march", name: "进行曲（军鼓滚奏）", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.75); if ([0, 2, 3, 4, 6, 7].includes(s)) hit("snare", 0, s % 4 === 0 ? 0.9 : 0.6); } },
];

// 三拍子统一用这个鼓型（选了 3/4 节奏时自动切换）
export const WALTZ_DRUM = { id: "waltz", name: "华尔兹（嘭-嚓-嚓）", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.8); if (s === 2 || s === 4) hit("rim", 0, 0.55); hit("hat", 0, s % 2 ? 0.3 : 0.5); } };

export function findById(list, id) {
  return list.find((item) => item.id === id) || list[0];
}
