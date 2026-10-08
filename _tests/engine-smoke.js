/* Test-only classic script shares the app's lexical scope. Never loaded by index.html. */
window.runEngineSmoke = async () => {
  const lines = [], wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, name) => { if (!condition) throw new Error(name); lines.push('PASS · ' + name); };
  const $ = id => document.getElementById(id);
  $('panicBtn').click();
  const ctx = ensureAudio(); await ctx.resume();
  const probe = ctx.createAnalyser(); probe.fftSize = 2048; masterGain.connect(probe);
  const samples = new Float32Array(probe.fftSize);
  let maximum = 0;
  const sample = setInterval(() => { probe.getFloatTimeDomainData(samples); maximum = Math.max(maximum, ...samples.map(Math.abs)); }, 10);
  try {
    await VibeStudio.chooseFinger(2); await wait(150);
    check($('centerChord').textContent === 'G', '和弦垫选择 G');
    check(maximum > .001, '首次点击有真实非静音输出，peak=' + maximum.toFixed(4));
    await VibeStudio.warmSamples();
    check(VibeStudio.samplesReady('guitar'), '本地吉他采样加载成功');
    $('recordBtn').click(); await wait(100);
    check($('recordBtn').textContent.includes('结束'), '录音启动，无麦克风');
    $('sequenceBtn').click(); await wait(300);
    check(isPlaying && $('centerChord').textContent === 'C', '和弦循环从 C 开始');
    await wait(2550);
    check($('centerChord').textContent === 'G', '下一小节切到 G');
    $('recordBtn').click(); await wait(250); $('panicBtn').click();
    const take = $('recordedTakes').querySelector('audio');
    check(Boolean(take), '生成可试听录音');
    const buffer = await ctx.decodeAudioData(await (await fetch(take.src)).arrayBuffer());
    const data = buffer.getChannelData(0);
    let energy = 0, peak = 0;
    for (const value of data) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
    check(buffer.duration > 2, '录音可解码，时长=' + buffer.duration.toFixed(2) + 's');
    check(energy / data.length > .000001, '录音包含琴声和伴奏，RMS=' + Math.sqrt(energy / data.length).toFixed(4));
    check(peak <= 1, '录音无数值溢出');
    check(!isPlaying, '停止按钮停止调度器');
    $('practiceBtn').click(); await VibeStudio.chooseFinger(1); await wait(750);
    check($('practiceTarget').textContent.includes('G'), '跟练成功后推进下一和弦');
    $('practiceBtn').click();
    const before = JSON.stringify(gestureBindings);
    clearCustomChordSamples();
    check(before === JSON.stringify(gestureBindings), '清除音频保留和弦绑定');
    bpm.value = 118; bpm.dispatchEvent(new Event('input', { bubbles: true })); await wait(500);
    const session = JSON.parse(localStorage.getItem('vibe.studio.session.v1'));
    check(session.bpm === 118 && session.instrument === 'guitar', '音色与速度自动保存在本机');
    const importFile = async value => {
      const transfer = new DataTransfer(); transfer.items.add(new File([JSON.stringify(value)], 'test-session.json', { type: 'application/json' }));
      $('sessionFile').files = transfer.files; $('sessionFile').dispatchEvent(new Event('change', { bubbles: true })); await wait(150);
    };
    await importFile({ ...session, bpm: 130, volume: 60 });
    check(Number(bpm.value) === 130 && $('masterVolume').value === '60', '配置文件导入应用节奏和音量');
    await importFile({ ...session, bpm: 9999 });
    check(Number(bpm.value) === 130 && $('studioMessage').textContent.includes('未导入'), '非法配置被拒绝且保留当前配置');
    await importFile({ ...session, bpm: 102 });
    return lines.join('\n');
  } finally { clearInterval(sample); masterGain.disconnect(probe); $('panicBtn').click(); }
};

window.runModelSmoke = async () => {
  await VibeStudio.loadCamera();
  const model = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}` });
  model.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: .5, minTrackingConfidence: .5 });
  const image = document.createElement('canvas'); image.width = 320; image.height = 240;
  let received = false;
  model.onResults(results => { if (results.multiHandLandmarks?.length) throw new Error('空白画面误检'); received = true; });
  try {
    await model.send({ image });
    if (!received) throw new Error('模型未返回识别结果');
    const realCamera = window.Camera;
    try {
      window.Camera = class { async start() { const error = new Error('test permission denied'); error.name = 'NotAllowedError'; throw error; } stop() {} };
      document.getElementById('cameraBtn').click();
      for (let i = 0; i < 50 && document.getElementById('cameraBtn').disabled; i++) await new Promise(resolve => setTimeout(resolve, 100));
      if (cameraActive || document.getElementById('cameraBtn').disabled || !document.getElementById('studioMessage').textContent.includes('权限未开启')) throw new Error('拒绝摄像头权限后的恢复失败');
      if (!document.querySelector('#cameraFallback .welcome-copy')) throw new Error('错误处理破坏了欢迎界面');
    } finally { window.Camera = realCamera; }
    return 'PASS · 固定版本 MediaPipe 模型已加载并完成空白帧推理。\nPASS · 模拟权限拒绝后恢复触控，不破坏界面；未访问真实摄像头。';
  } finally { model.close(); }
};
