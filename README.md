# 空气吉他 / Vibe Air Guitar

用摄像头手势弹空气吉他：伸出 1–5 根手指切换和弦，伴奏跟着手走。纯浏览器运行，画面不上传。

**English:** A browser-based air guitar. Hold up 1–5 fingers to pick a chord; sampled guitars and rhythm patterns follow your hand. Everything runs locally in the browser.

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

- **自由弹**：1–5 根手指各弹一个和弦（默认用当前歌里最常用的 5 个），开伴奏后跟着节奏弹；松手立刻停，也可以改成「保持和弦，握拳停」。
- **跟谱弹唱**：选一首歌（或粘贴文字谱），画面下方显示歌词和和弦。伸出手指开始弹，**每换一次手势就走到下一个和弦**，一首歌多少个和弦都行；没有摄像头就点下方「下一个」或按 → 键。
- **自动走谱**：和弦按小节自动换，只管唱。
- **导入歌曲**：在有谱么等网站打开文字版谱，复制和弦 + 歌词粘贴进「歌曲与和弦 → 导入」。支持 `[C]歌词` 和「和弦行在上、歌词行在下」两种写法，只保存在本机浏览器。有谱么没有公开接口，也不支持识别图片谱。
- **画面里的鼓开关**：右上角，手碰到就开/关，大小可调。
- 键盘：`1`–`5` 和弦，`→` `←` 跟谱时换和弦，`空格` 开始/停止，`↑` `↓` 速度，`0` 静音，`C` 摄像头，`S` 设置。
- 音色：木吉他（钢弦）、尼龙吉他、电吉他（小音箱）、钢琴、半岛铁盒、玻璃铃、星光琴、小提琴；12 种扫弦节奏（含低音扫弦、切音、3/4 华尔兹）、7 种分解（含 Travis、掐弹、Boom-chick）、14 种鼓型；升降调 ±6 个半音。

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
js/songs.js         内置歌曲（公有领域）与文字谱解析
models/             hand_landmarker.task（随站点发布，国内也能加载）
samples/v2/         压缩后的吉他采样：acoustic 1.5 MB、electric 0.7 MB、nylon 0.9 MB（只先下当前和弦要用的音）
tests/run.mjs       纯逻辑回归：node tests/run.mjs
tests/hands.html    真实手部照片跑模型的回归页（素材放 tests/fixtures/，不提交）
```

`samples/mg-nylon`、`samples/rjs-electric` 里是原始 WAV（约 184 MB），新版不再加载（尼龙吉他用 mg-nylon 转码的 m4a，rjs-electric 已不用），仅作为转码源保留。

## 技术要点

- 手势：MediaPipe Tasks Vision `HandLandmarker`（固定版本 0.10.21），GPU 推理、`requestVideoFrameCallback` 逐帧驱动；用关节角度判断手指伸直，手歪、手小也能认；连续 1/2/4 帧确认可调。
- 低延迟：`AudioContext({latencyHint: "interactive"})`；调度器在 Worker 计时、提前 120 ms 排程；换和弦时撤掉还没发声的旧和弦并立刻扫一下新和弦，节拍不乱；每根弦只保留一个发声体。
- 首屏：不再在页面加载时拉 MediaPipe；模型等点开摄像头才下载；默认音色先只下当前和弦用到的音，其余后台补齐。
- 音色真实感：逐弦采样 + 扫弦逐弦错开（越用力越快、手腕加速）、上扫只扫高音 3–4 弦；力度决定亮度（低通，代替缺失的力度层）；每次 ±3 音分和 0–3ms 起点随机，避免“机关枪”；同弦重拨约 0.1 秒自然收音，其它弦继续共鸣；闷音扫弦用真实采样的短促死音；拨片擦弦噪声；木吉他加程序生成的琴箱共鸣冲激响应，电吉他走软削波 + 1x12 音箱频响；吉他和鼓少量送进程序生成的房间混响。混响与琴箱都是旁路发送，直达声不增加延迟。

## 致谢

- 木吉他（钢弦）采样：University of Iowa Electronic Music Studios（Musical Instrument Samples），经 [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)（commit 622c2f1）整理，[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)；本项目转码为 m4a、截断到 4.6 秒
- 电吉他采样：Karoryfer Samples，经 tonejs-instruments 整理，CC BY 3.0；本项目转码为 m4a
- 尼龙吉他采样：MG Soft Nylon Guitar (Lite)，Pianobook / Mike Georgiades（沿用 V1；Pianobook 采样的再分发条款需另行确认）
- 琴箱共鸣、房间混响的冲激响应由代码生成，无第三方素材
- 钢琴 / 小提琴：gleitz/midi-js-soundfonts（FluidR3_GM）
- 手势模型：Google MediaPipe

## License

MIT
