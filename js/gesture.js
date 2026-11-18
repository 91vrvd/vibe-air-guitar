// 手势判定与扫弦动作识别（纯函数 + 状态机，可在 Node 里测试）。
// 1. 用关节弯曲角度 + 伸展距离判断每根手指，手腕倾斜、手掌侧转时比只比较 y 坐标稳。
// 2. 支持拇指切换 A/B 扩展和弦页（点赞手势：仅伸出拇指，其余四指收起）。
// 3. 支持单手挥动扫弦（StrumMotionDetector）与双手分工（一手按弦、另一手扫弦）。

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
 * @returns {{count:number|null, fingers:boolean[], thumbOnly:boolean, center:{x:number,y:number}}}
 *   count: 0=握拳, 1-5=手指数, null=无法判定（如仅伸拇指点赞时 count=null 且 thumbOnly=true）
 */
export function classifyHand(landmarks, aspect = 4 / 3) {
  if (!landmarks || landmarks.length < 21) return { count: null, fingers: [], thumbOnly: false, center: { x: 0.5, y: 0.5 } };
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
  else count = thumb ? null : 0; // 只伸拇指（点赞）不触发和弦，用作切换 A/B 页手势

  // 掌心/拨弦参考点（食指根与中指根中点，比指尖更稳，适合挥动扫弦检测）
  const center = {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x) / 3,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y) / 3,
  };
  return { count, fingers: [thumb, ...fingers], thumbOnly: n === 0 && thumb, center };
}

/** 去抖：同一结果连续出现 frames 帧才确认；丢手有宽限期；支持相邻手势过渡缓冲 */
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

/**
 * 挥手扫弦检测器（适用于「挥手扫弦」与「双手演奏」模式）
 * 通过追踪手部纵向位移与速度，识别向下扫（D）和向上扫（U），并根据挥动速度计算力度（velocity）。
 */
export class StrumMotionDetector {
  constructor({ minTravel = 0.055, minSpeed = 0.42, cooldownMs = 115 } = {}) {
    this.minTravel = minTravel;
    this.minSpeed = minSpeed;
    this.cooldownMs = cooldownMs;
    this.lastY = null;
    this.lastT = 0;
    this.anchorY = null;
    this.dir = 0; // 1 = 下移, -1 = 上移
    this.lastFireAt = -1e9;
    this.reentryUntil = 0;
  }

  reset() {
    this.lastY = null;
    this.lastT = 0;
    this.anchorY = null;
    this.dir = 0;
  }

  /**
   * @param {number|undefined} y 归一化纵坐标 (0=顶, 1=底)，undefined 表示丢手
   * @param {number} now 毫秒时间戳
   * @returns {{dir: "D"|"U", velocity: number}|null}
   */
  push(y, now) {
    if (y === undefined || y === null) {
      this.reset();
      this.reentryUntil = now + 90;
      return null;
    }
    if (this.lastY === null || now - this.lastT > 220) {
      this.lastY = y;
      this.lastT = now;
      this.anchorY = y;
      this.dir = 0;
      return null;
    }
    const dt = Math.max(4, now - this.lastT) / 1000;
    const dy = y - this.lastY;
    const speed = Math.abs(dy) / dt;
    const stepDir = dy > 0.004 ? 1 : dy < -0.004 ? -1 : this.dir;

    if (stepDir !== 0 && stepDir !== this.dir) {
      // 换向：重新设定起点
      this.anchorY = this.lastY;
      this.dir = stepDir;
    }
    this.lastY = y;
    this.lastT = now;

    if (now < this.reentryUntil || now - this.lastFireAt < this.cooldownMs || this.dir === 0) {
      return null;
    }
    const travel = Math.abs(y - (this.anchorY ?? y));
    if (travel >= this.minTravel && speed >= this.minSpeed) {
      this.lastFireAt = now;
      this.anchorY = y;
      const velocity = Math.max(0.45, Math.min(1, 0.45 + (speed - this.minSpeed) * 0.35 + (travel - this.minTravel) * 1.8));
      return { dir: this.dir > 0 ? "D" : "U", velocity };
    }
    return null;
  }
}

/**
 * 双手分工分配器：当画面中有两只手时，根据画面位置（及镜像设置）将两只手分为「按弦手（fretHand）」和「扫弦手（strumHand）」
 * 默认：左手（镜像画面左侧）按和弦，右手（镜像画面右侧）挥动扫弦；若只有一只手，则兼任按弦与扫弦。
 */
export function splitHands(landmarksList, { mirror = true, swapHands = false } = {}) {
  if (!landmarksList || !landmarksList.length) return { fretHand: null, strumHand: null };
  if (landmarksList.length === 1) {
    return { fretHand: landmarksList[0], strumHand: landmarksList[0], single: true };
  }
  const scored = landmarksList.slice(0, 2).map((lm) => {
    const rawX = lm[0]?.x ?? 0.5;
    const screenX = mirror ? 1 - rawX : rawX;
    return { lm, screenX };
  });
  scored.sort((a, b) => a.screenX - b.screenX);
  const [left, right] = scored;
  return swapHands
    ? { fretHand: right.lm, strumHand: left.lm, single: false }
    : { fretHand: left.lm, strumHand: right.lm, single: false };
}
