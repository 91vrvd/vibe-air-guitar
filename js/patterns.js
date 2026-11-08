// 节奏型数据。每一步 = 八分音符；D=下扫 U=上扫 x=闷音 -=空拍。
// 分解/自定义弹法里用相对弦号：R=根音弦，其余为绝对弦号（1=高音 e … 6=低音 E）。

export const STRUM_PATTERNS = [
  { id: "cardigan", name: "卡农电吉他", pattern: "D-UD-UxU", bpm: 96, swing: 0.008 },
  { id: "folk_soft", name: "民谣轻扫", pattern: "D-DU-UDU", bpm: 84, swing: 0.012 },
  { id: "8beat", name: "8 Beat 下上扫", pattern: "D-DU-UDU", bpm: 92, swing: 0 },
  { id: "slow_sad", name: "忧伤慢板", pattern: "D--U-D-U", bpm: 76, swing: 0.02 },
  { id: "ballad_warm", name: "抒情慢扫", pattern: "D--UD-U-", bpm: 74, swing: 0.018 },
  { id: "story_folk", name: "叙事民谣推进", pattern: "D-D-DUDU", bpm: 92, swing: 0.01 },
  { id: "train", name: "英文民谣火车", pattern: "D-DUD-DU", bpm: 102, swing: 0.014 },
  { id: "bright", name: "明亮流行", pattern: "DUxUDUxU", bpm: 108, swing: 0 },
  { id: "pop_chop", name: "流行切分", pattern: "DxDU-UxU", bpm: 104, swing: 0.004 },
  { id: "open_pop", name: "明亮开放 Pop", pattern: "DUD-DUDU", bpm: 112, swing: 0 },
  { id: "chorus_lift", name: "副歌抬升", pattern: "D-DUDUDU", bpm: 116, swing: 0 },
  { id: "drive", name: "推进副歌", pattern: "DUDUDUDU", bpm: 126, swing: 0 },
  { id: "rock", name: "摇滚八分", pattern: "DDxUDDxU", bpm: 118, swing: 0 },
  { id: "rock_down", name: "摇滚下扫推进", pattern: "DDDUDDDU", bpm: 122, swing: 0 },
  { id: "ballad", name: "抒情稀疏", pattern: "D-U-D-U-", bpm: 82, swing: 0.015 },
  { id: "soft_arc", name: "软弧线抒情", pattern: "D-U--UD-", bpm: 78, swing: 0.02 },
  { id: "breathy", name: "气声慢歌", pattern: "D--U-UD-", bpm: 72, swing: 0.022 },
  { id: "reggae", name: "反拍雷鬼", pattern: "-U-x-U-x", bpm: 96, swing: 0.01 },
  { id: "funk", name: "律动切分", pattern: "xUDx-UxU", bpm: 104, swing: 0.018 },
  { id: "waltz", name: "三拍华尔兹", pattern: "D-UD-U", bpm: 88, swing: 0.025, meter: 3 },
];

export const ARP_PATTERNS = [
  { id: "classic", name: "经典分解 R3231323", steps: ["R", 3, 2, 3, 1, 3, 2, 3] },
  { id: "travis", name: "Travis 交替低音", steps: ["R", 3, "A", 2, "R", 1, "A", 3] },
  { id: "rise", name: "上行琶音", steps: ["R", 4, 3, 2, 1, 2, 3, 4] },
  { id: "ballad_pick", name: "抒情指弹 R321", steps: ["R", 3, 2, 1, "R", 3, 2, 1] },
];

export const DEFAULT_CUSTOM_STEPS = ["R", 3, 2, 3, 1, 3, 2, 3];

// 鼓：hit(type, offsetIn16th, level)；slot = 小节内八分音符序号
export const DRUM_PATTERNS = [
  { id: "standard", name: "标准四四拍", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 1); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.6 : 0.9); } },
  { id: "pop_kick", name: "流行底鼓", play(s, b, hit) { if ([0, 3, 4, 6].includes(s)) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.55 : 0.85); } },
  { id: "ballad", name: "抒情慢歌", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.6); if (s === 6) hit("snare", 0, 0.6); if (s % 2 === 0) hit("hat", 0, 0.4); } },
  { id: "light_hat", name: "轻拍镲帽", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.6); if (s === 6) hit("snare", 0, 0.5); hit("hat", 0, s % 2 ? 0.35 : 0.6); } },
  { id: "folk", name: "乡村民谣", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.85); if (s === 2 || s === 6) hit("snare", 0, 0.7); hit("hat", 0, s % 2 ? 0.45 : 0.7); if (s === 1 || s === 5) hit("hat", 1, 0.3); } },
  { id: "britpop", name: "英伦摇滚", play(s, b, hit) { if ([0, 3, 4].includes(s)) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 1.1); hit("hat", 0, s % 2 ? 0.65 : 0.9); } },
  { id: "indie", name: "独立摇滚", play(s, b, hit) { if ([0, 4, 7].includes(s)) hit("kick", 0, 1); if (s === 2 || s === 6) hit("snare", 0, 1); if (![3, 7].includes(s)) hit("hat", 0, 0.75); } },
  { id: "heavy", name: "摇滚重型", play(s, b, hit) { if ([0, 1, 3, 4, 5, 7].includes(s)) hit("kick", 0, 1); if (s === 2 || s === 6) hit("snare", 0, 1.15); hit("hat", 0, s % 2 ? 0.7 : 0.95); if (b % 4 === 0 && s === 0) hit("crash", 0, 0.8); } },
  { id: "funk", name: "Funk 碎拍", play(s, b, hit) { if (s === 0 || s === 5) hit("kick", 0, 0.95); if (s === 2 || s === 6) hit("snare", 0, 1); hit("hat", 0, s % 2 ? 0.4 : 0.75); if ([1, 4, 7].includes(s)) hit("hat", 1, 0.35); } },
  { id: "soul", name: "灵魂 R&B", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.85); if (s === 5) hit("kick", 0.18, 0.8); if (s === 2 || s === 6) hit("snare", 0.12, 0.85); if (s % 2 === 0) hit("hat", 0, 0.5); if (s === 3 || s === 7) hit("hat", 1, 0.32); } },
  { id: "hiphop", name: "Hip-Hop 慢鼓", play(s, b, hit) { if (s === 0 || s === 5) hit("kick", 0, 1); if (s === 2) hit("snare", 0, 0.95); if (s === 6) hit("snare", 0.25, 0.95); if (s % 2 === 0) hit("hat", 0, 0.55); } },
  { id: "trap", name: "电子 Trap", play(s, b, hit) { if (s === 0) hit("kick", 0, 1.15); if (s === 4) hit("snare", 0, 1.05); hit("hat", 0, 0.48); if ([2, 3, 6, 7].includes(s)) hit("hat", 0.5, 0.32); if (s === 7) hit("hat", 0.75, 0.26); } },
  { id: "reggae", name: "雷鬼反拍", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.75); if (s === 1 || s === 5) hit("snare", 0, 0.85); if (s % 2) hit("hat", 0, 0.7); } },
  { id: "bossa", name: "拉丁 Bossa Nova", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.7); if ([0, 3, 5].includes(s)) hit("rim", 0, 0.8); if ([2, 6, 7].includes(s)) hit("rim", 1, 0.6); hit("hat", 0, s % 2 ? 0.4 : 0.65); } },
  { id: "samba", name: "拉丁桑巴", play(s, b, hit) { if ([0, 3, 4, 7].includes(s)) hit("kick", 0, 0.75); if ([1, 2, 5, 6].includes(s)) hit("rim", 0, 0.7); hit("hat", 0, s % 2 ? 0.5 : 0.75); } },
  { id: "jazz", name: "爵士摇摆", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.45); if (s === 2 || s === 6) hit("snare", 0.18, 0.55); if (![2, 6].includes(s)) hit("ride", s % 2 ? 0.22 : 0, 0.65); } },
  { id: "march", name: "军鼓进行曲", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.7); if ([0, 2, 3, 4, 6, 7].includes(s)) hit("snare", 0, s % 4 === 0 ? 0.9 : 0.65); if (s % 2 === 0) hit("hat", 0, 0.45); } },
  { id: "dream", name: "梦幻流行", play(s, b, hit) { if (s === 0 || s === 4) hit("kick", 0, 0.7); if (s === 6) hit("snare", 0, 0.7); hit("hat", 0, s % 2 ? 0.38 : 0.6); } },
  { id: "ambient", name: "后摇氛围", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.65); if (s === 6) hit("snare", 0.25, 0.5); if (s % 2 === 0) hit("hat", 0, 0.35); } },
  { id: "soft_piano", name: "钢琴伴奏轻鼓", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.5); if (s === 4) hit("snare", 0, 0.42); if (s % 2 === 0) hit("hat", 0, 0.3); } },
];

// 三拍子统一用这个鼓型（华尔兹节奏选择时自动切换）
export const WALTZ_DRUM = { id: "waltz", name: "华尔兹", play(s, b, hit) { if (s === 0) hit("kick", 0, 0.8); if (s === 2 || s === 4) hit("snare", 0, 0.55); hit("hat", 0, s % 2 ? 0.35 : 0.55); } };

export function findById(list, id) {
  return list.find((item) => item.id === id) || list[0];
}
