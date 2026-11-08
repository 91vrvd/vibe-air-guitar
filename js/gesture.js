// 手势判定（纯函数，可在 Node 里测试）。
// 用关节弯曲角度 + 伸展距离判断每根手指，手腕倾斜、手掌侧转时比只比较 y 坐标稳。

function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }; }
function len(v) { return Math.hypot(v.x, v.y, v.z) || 1e-6; }
function dist(a, b) { return len(sub(a, b)); }
function cos(a, b) { return (a.x * b.x + a.y * b.y + a.z * b.z) / (len(a) * len(b)); }

const FINGERS = [
  // [mcp, pip, dip, tip]
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

/**
 * @param landmarks 21 个归一化关键点 {x,y,z}
 * @param aspect 视频宽/高，用来把 x 换算成和 y 同一尺度
 * @returns {{count:number|null, fingers:boolean[]}} count: 0=握拳, 1-5=手指数, null=无法判定
 */
export function classifyHand(landmarks, aspect = 4 / 3) {
  if (!landmarks || landmarks.length < 21) return { count: null, fingers: [] };
  const p = landmarks.map((l) => ({ x: l.x * aspect, y: l.y, z: (l.z || 0) * aspect }));
  const wrist = p[0];
  const palm = Math.max(1e-3, dist(wrist, p[9]));

  const fingers = FINGERS.map(([mcp, pip, dip, tip]) => {
    const proximal = sub(p[pip], p[mcp]);
    const middle = sub(p[dip], p[pip]);
    const distal = sub(p[tip], p[dip]);
    const straight = cos(proximal, middle) > 0.55 && cos(middle, distal) > 0.35;
    const reach = dist(p[tip], wrist) > dist(p[pip], wrist) + palm * 0.12;
    const fold = dist(p[tip], p[mcp]) > palm * 0.42;
    return straight && reach && fold;
  });

  // 拇指：指尖远离食指根和小指根，并且基本伸直
  const thumbTip = p[4];
  const thumbIp = p[3];
  const thumbMcp = p[2];
  const thumbStraight = cos(sub(thumbIp, thumbMcp), sub(thumbTip, thumbIp)) > 0.45;
  const awayFromIndex = dist(thumbTip, p[5]) > palm * 0.5;
  const awayFromPinky = dist(thumbTip, p[17]) > dist(thumbIp, p[17]) + palm * 0.05;
  const thumb = thumbStraight && awayFromIndex && awayFromPinky;

  const n = fingers.filter(Boolean).length;
  let count;
  if (n === 4) count = thumb ? 5 : 4;
  else if (n >= 1) count = n; // 1-3 指时忽略拇指，拇指最容易误判
  else count = thumb ? null : 0; // 只伸拇指（点赞）不触发
  return { count, fingers: [thumb, ...fingers] };
}

/** 去抖：同一结果连续出现 frames 帧才确认；丢手有宽限期 */
export class GestureStabilizer {
  constructor({ frames = 2, lostGraceMs = 160 } = {}) {
    this.frames = frames;
    this.lostGraceMs = lostGraceMs;
    this.candidate = undefined;
    this.hits = 0;
    this.stable = null; // 已确认：null=无手, 0=握拳, 1-5
    this.lastSeen = 0;
  }

  /** @param count 本帧结果；undefined 表示画面里没手 */
  push(count, now) {
    if (count === undefined) {
      if (this.stable !== null && now - this.lastSeen > this.lostGraceMs) {
        this.stable = null;
        this.candidate = undefined;
        this.hits = 0;
        return true;
      }
      return false;
    }
    this.lastSeen = now;
    if (count === null) return false; // 判定不了：保持原样
    if (count === this.candidate) this.hits += 1;
    else { this.candidate = count; this.hits = 1; }
    if (this.hits >= this.frames && this.stable !== count) {
      this.stable = count;
      return true;
    }
    return false;
  }

  reset() {
    this.candidate = undefined;
    this.hits = 0;
    this.stable = null;
  }
}
