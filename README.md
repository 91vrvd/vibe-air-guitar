# 空气吉他 / Vibe Air Guitar

用摄像头手势弹空气吉他：对着镜头伸出 1–5 根手指切换和弦，经典分解与鼓点自动跟着你的手走。纯浏览器运行，画面不上传。

**English:** A browser-based air guitar. Hold up 1–5 fingers to switch chords; sampled guitars and rhythm patterns follow your hand. Everything runs locally in the browser.

👉 在线体验：**https://91vrvd.github.io/vibe-air-guitar/**

## 怎么玩（零基础 3 秒上手）

1. **第 1 步**：点画面中间的 **「开启摄像头」**（浏览器询问时点“允许”）。
2. **第 2 步**：对着镜头伸出 **1–5 根手指**，每种手势弹响一个和弦，**握拳 ✊ 静音**。
3. **第 3 步**：点左下角 **「开始伴奏」**，经典分解吉他与鼓点会自动跟着你的手势走。

| 手势 | 默认和弦（原调 C） | 听感特点 |
|---|---|---|
| 1 指（食指） | C | 主音 · 稳重 |
| 2 指（食指 + 中指） | G | 明亮 · 推进 |
| 3 指 | Am | 柔和 · 抒情 |
| 4 指（收拇指） | F | 温暖 · 铺垫 |
| 5 指张开 | Em | 悠扬 · 过渡 |
| 握拳 | 静音 | 立即止音 |

- **默认配置**：原调（C 调）、木吉他（钢弦）、分解弹法（经典分解 `R3231323`）。
- **自定义和弦**：在右上角「设置 → 和弦配置」中，可直接下拉修改 1–5 根手指分别对应的和弦（支持三和弦、七和弦、挂留、增减、扩展音及斜线和弦），也可调节升降调（±6 半音）或给某根手指上传自定义音频。
- **12 种音色**：木吉他（钢弦）、温暖指弹木吉他（J-45 风格）、十二弦木吉他（双弦共鸣）、古典尼龙吉他、清音电吉他（小音箱）、爵士半空心电吉他、复古过载电吉他（Blues Crunch）、三角钢琴、半岛铁盒、玻璃铃、星光琴、独奏小提琴。
- **丰富的节奏型**：9 种分解指弹（经典分解、慢歌分解、Travis 交替低音、掐弹、民谣双音、波萨诺瓦等）、15 种扫弦节奏、14 种鼓型，支持自定义录入分解走向。
- **手机流畅 / 省流模式**：自动识别手机与低配设备，开启低分辨率快速手势推理与按需精简音频加载，多 CDN 自动回退，弱网下自动使用合成吉他兜底，零等待出声。
- **快捷键**：`1`–`5` 和弦，`0` 静音，`空格` 开始/停止伴奏，`↑` `↓` 速度，`C` 摄像头，`S` 设置。

## 本地运行与测试

摄像头需要 `https` 或 `localhost`：

```bash
python3 -m http.server 8765
```

打开 http://localhost:8765 。

运行逻辑回归测试：

```bash
node tests/run.mjs
```

## 致谢

- 木吉他（钢弦）采样：University of Iowa Electronic Music Studios（Musical Instrument Samples），经 [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) 整理，[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- 电吉他采样：Karoryfer Samples，经 tonejs-instruments 整理，CC BY 3.0
- 尼龙吉他采样：MG Soft Nylon Guitar (Lite)，Pianobook / Mike Georgiades
- 琴箱共鸣、房间混响的冲激响应由代码生成，无第三方素材
- 钢琴 / 小提琴：gleitz/midi-js-soundfonts（FluidR3_GM）
- 手势模型：Google MediaPipe Tasks Vision (`0.10.21`)

## License

MIT
