# 🎸 Air Guitar · 空气吉他

用摄像头手势弹空气吉他：伸出 1–5 根手指切换和弦，伴奏跟着手走。纯浏览器运行，画面不上传。

👉 在线体验：**https://91vrvd.github.io/vibe-air-guitar/**

## 怎么玩

| 手势 | 默认和弦（C 调） |
|---|---|
| 1 指（食指） | C |
| 2 指（食指 + 中指） | G |
| 3 指 | Am |
| 4 指（收拇指） | F |
| 5 指张开 | Em |
| 握拳 | 静音 |

- **手势换和弦**：开伴奏后，比几根手指就弹哪个和弦；松手立刻停（也可以改成「保持和弦，握拳停」）。
- **自动走谱**：按和弦谱每小节自动换和弦，适合边弹边唱；画面会提示下一个和弦该比几根手指。
- **没有摄像头**：点下方五个和弦键，或键盘数字键 `1`–`5`；`空格` 开始/停止，`↑` `↓` 调速度，`0` 静音，`C` 开关摄像头，`S` 设置。
- 设置里可换音色（尼龙吉他、清音电吉他、钢琴、半岛铁盒、玻璃铃、星光琴、小提琴）、20 种扫弦节奏、分解/自定义指弹、20 种鼓型、调和变调夹、每根手指绑定的和弦，或给手指上传自己的音频。

## 本地运行

摄像头需要 `https` 或 `localhost`：

```bash
python3 -m http.server 8765
```

打开 http://localhost:8765 。

## 结构

```
index.html          页面骨架
styles.css          主题（深浅色 token）
js/main.js          界面、状态、摄像头接入
js/audio.js         音频引擎：采样/合成音色、逐弦发声、鼓、前瞻调度
js/gesture.js       手指计数与去抖（纯函数）
js/hands.js         摄像头 + MediaPipe HandLandmarker（按需加载，GPU 优先）
js/theory.js        和弦解析、吉他式排布、移调、手指绑定
js/patterns.js      扫弦/分解/鼓节奏数据
models/             hand_landmarker.task（随站点发布，国内也能加载）
samples/v2/         压缩后的吉他采样（约 2 MB）
tests/run.mjs       纯逻辑回归：node tests/run.mjs
tests/hands.html    真实手部照片跑模型的回归页（素材放 tests/fixtures/，不提交）
```

`samples/mg-nylon`、`samples/rjs-electric` 里是原始 WAV（约 184 MB），新版不再加载，仅作为转码源保留。

## 技术要点

- 手势：MediaPipe Tasks Vision `HandLandmarker`（固定版本 0.10.21），GPU 推理、`requestVideoFrameCallback` 逐帧驱动；用关节角度判断手指伸直，手歪、手小也能认；连续 1/2/4 帧确认可调。
- 低延迟：`AudioContext({latencyHint: "interactive"})`；调度器在 Worker 计时、提前 120 ms 排程；换和弦时撤掉还没发声的旧和弦并立刻扫一下新和弦，节拍不乱；每根弦只保留一个发声体。
- 首屏：不再在页面加载时拉 MediaPipe；模型等点开摄像头才下载；默认音色 0.9 MB，空闲时预取。

## 致谢

- 尼龙吉他采样：MG Soft Nylon Guitar (Lite)，Pianobook / Mike Georgiades
- 电吉他采样：RJS Guitar
- 钢琴 / 小提琴：gleitz/midi-js-soundfonts（FluidR3_GM）
- 手势模型：Google MediaPipe

## License

MIT
