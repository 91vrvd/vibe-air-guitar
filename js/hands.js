// 摄像头 + MediaPipe HandLandmarker（tasks-vision，GPU 优先）。
// 只在用户点「开启摄像头」时才下载模型，首屏不背这几 MB。

const TASKS_VERSION = "0.10.21";
const CDN_BASES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`,
  `https://unpkg.com/@mediapipe/tasks-vision@${TASKS_VERSION}`,
];
const MODEL_URL = new URL("../models/hand_landmarker.task", import.meta.url).href;

let visionPromise = null;

async function loadVision() {
  if (visionPromise) return visionPromise;
  visionPromise = (async () => {
    let lastError;
    for (const base of CDN_BASES) {
      try {
        const mod = await import(/* webpackIgnore: true */ `${base}/vision_bundle.mjs`);
        const fileset = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
        return { mod, fileset };
      } catch (error) {
        lastError = error;
      }
    }
    visionPromise = null;
    throw lastError || new Error("vision load failed");
  })();
  return visionPromise;
}

export class HandTracker {
  constructor(video, { onResult, onStatus } = {}) {
    this.video = video;
    this.onResult = onResult;
    this.onStatus = onStatus;
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.delegate = null;
    this.frameHandle = null;
    this.stats = { fps: 0, inferMs: 0 };
    this.frameTimes = [];
  }

  get active() { return this.running; }

  async createLandmarker() {
    if (this.landmarker) return this.landmarker;
    this.onStatus?.("model");
    const { mod, fileset } = await loadVision();
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await mod.HandLandmarker.createFromOptions(fileset, options("GPU"));
      this.delegate = "GPU";
    } catch {
      this.landmarker = await mod.HandLandmarker.createFromOptions(fileset, options("CPU"));
      this.delegate = "CPU";
    }
    // 预热：GPU 首帧要编译着色器（桌面实测约 3 秒），放在加载阶段做，开摄像头后就不会卡一下
    try {
      const c = document.createElement("canvas");
      c.width = 96;
      c.height = 96;
      c.getContext("2d").fillRect(0, 0, 96, 96);
      this.landmarker.detectForVideo(c, performance.now());
    } catch {}
    return this.landmarker;
  }

  async start() {
    if (this.running) return;
    if (!window.isSecureContext) throw Object.assign(new Error("insecure"), { code: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
    this.onStatus?.("camera");
    const streamPromise = navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 60 },
      },
    });
    // 摄像头授权和模型下载并行
    const modelPromise = this.createLandmarker();
    let stream;
    try {
      stream = await streamPromise;
    } catch (error) {
      modelPromise.catch(() => null);
      throw Object.assign(error, { code: error.name === "NotAllowedError" ? "denied" : error.name === "NotFoundError" ? "nocamera" : "camera" });
    }
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    try { await this.video.play(); } catch {}
    try {
      await modelPromise;
    } catch (error) {
      this.stopStream();
      throw Object.assign(error, { code: "model" });
    }
    this.running = true;
    this.lastVideoTime = -1;
    this.onStatus?.("running");
    this.scheduleFrame();
  }

  scheduleFrame() {
    if (!this.running) return;
    if (this.video.requestVideoFrameCallback) {
      this.frameHandle = this.video.requestVideoFrameCallback(() => this.process());
    } else {
      this.frameHandle = requestAnimationFrame(() => this.process());
    }
  }

  process() {
    if (!this.running) return;
    const video = this.video;
    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime && !document.hidden) {
      this.lastVideoTime = video.currentTime;
      const t0 = performance.now();
      let result = null;
      try {
        result = this.landmarker.detectForVideo(video, t0);
      } catch {
        result = null;
      }
      const t1 = performance.now();
      this.stats.inferMs = this.stats.inferMs * 0.85 + (t1 - t0) * 0.15;
      this.frameTimes.push(t1);
      while (this.frameTimes.length && t1 - this.frameTimes[0] > 1000) this.frameTimes.shift();
      this.stats.fps = this.frameTimes.length;
      if (result) this.onResult?.(result, t1);
    }
    this.scheduleFrame();
  }

  stopStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  stop() {
    this.running = false;
    if (this.frameHandle !== null) {
      if (this.video.cancelVideoFrameCallback) {
        try { this.video.cancelVideoFrameCallback(this.frameHandle); } catch {}
      }
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.stopStream();
    this.onStatus?.("stopped");
  }
}
