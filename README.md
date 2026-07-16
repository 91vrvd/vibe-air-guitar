# 🎸 Vibe Air Guitar

空气吉他 — 基于浏览器的手势识别弹奏应用

通过摄像头识别手指手势（1-5号），实时切换和弦并伴奏。纯前端，无需后端。

## ✨ 功能

- 🖐️ **手势识别** — MediaPipe Hands 识别 1-5 号手势，映射到不同和弦
- 🎵 **多种音色** — 保留尼龙吉他，并新增 University of Iowa 真实木吉他采样、电吉他、钢琴、星光琴等
- 🥁 **鼓节奏** — 内置 20 种鼓节奏型
- 🎸 **吉他节奏** — 20 种扫弦/分解节奏型
- 🎶 **和弦谱编辑** — 支持自定义和弦走向，内置多种预设模板
- 🎛️ **手势触控鼓** — 在屏幕上触控打鼓
- 🌗 **亮/暗主题** — 一键切换
- 🎯 **调性切换** — 12 调可选，支持 Capo
- 📱 **三档性能模式** — 手机默认轻量省电，桌面可选平衡或演出低延迟
- ✨ **Studio 级界面** — 桌面工作台与手机抽屉式控制，核心演奏信息始终可见
- 🔔 **新增音色** — 八音盒、柔光电钢、木槌琴

## ⚡ 性能模式

| 模式 | 适用场景 | 识别策略 |
| --- | --- | --- |
| 轻量版 | 手机、长时间练习 | 低分辨率 / 18fps / 关闭面部特效，降低发热 |
| 平衡版 | 日常使用（默认） | 640×480 / 24fps，兼顾响应和续航 |
| 完全版 | 短时演出、性能较强的设备 | 720×540 / 30fps，可开启舞台特效 |

## 🌐 在线演示

👉 **https://91vrvd.github.io/vibe-air-guitar/**

直接打开即可体验，无需安装。

> 📱 **手机浏览器也可以打开使用**，但首次加载需要下载音频采样文件，加载时间较长，请耐心等待加载完成后再开始弹奏。

## 🚀 使用

1. 克隆仓库
   ```bash
   git clone https://github.com/91vrvd/vibe-air-guitar.git
   cd vibe-air-guitar
   ```

2. 启动本地服务器（需要摄像头权限，必须用 HTTP 服务）
   ```bash
   python3 -m http.server 8765
   ```

3. 打开浏览器访问 `http://localhost:8765`

4. 点击「开启摄像头识别」，对着镜头比出 1-5 号手势即可弹奏

## 📁 项目结构

```
├── index.html          # 主页面
├── app.js              # 核心逻辑（手势识别、音频引擎、和弦映射）
├── styles.css          # 样式
└── samples/            # 音频采样
    ├── chord-strums/   # 和弦扫弦采样
    ├── mg-nylon/       # 尼龙吉他采样
    └── rjs-electric/   # 电吉他采样
```

## 🛠️ 技术栈

- **MediaPipe Hands** — 手部关键点检测
- **MediaPipe Face Detection** — 面部检测（辅助）
- **Web Audio API** — 音频合成与播放
- **Canvas API** — 手部骨架绘制

## 📝 License

MIT

### 音频采样署名

“真实木吉他”使用 [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) 整理的 University of Iowa Electronic Music Studios 木吉他采样。采样依据 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) 使用；处理与整理项目代码为 MIT License。
