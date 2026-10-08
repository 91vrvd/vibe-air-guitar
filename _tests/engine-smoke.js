/* Test-only classic script shares the app's lexical scope. Never loaded by index.html. */
window.runEngineSmoke = async () => {
  const lines = [], wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, name) => { if (!condition) throw new Error(name); lines.push('PASS · ' + name); };
  const $ = id => document.getElementById(id);
  $('panicBtn').click();
  const ctx = ensureAudio(); await ctx.resume();
  const probe = ctx.createAnalyser(); probe.fftSize = 2048; masterGain.connect(probe);
  const samples = new Float32Array(probe.fftSize);
  let maximum = 0, firstOnsetAt = null;
  const sample = setInterval(() => {
    probe.getFloatTimeDomainData(samples);
    for (let i = 0; i < samples.length; i++) maximum = Math.max(maximum, Math.abs(samples[i]));
    if (maximum > .001 && firstOnsetAt === null) firstOnsetAt = performance.now();
  }, 10);
  try {
    const firstActionAt = performance.now();
    await VibeStudio.chooseFinger(2); await wait(150);
    check($('centerChord').textContent === 'G', '和弦垫选择 G');
    check(maximum > .001, '首次点击有真实非静音输出，peak=' + maximum.toFixed(4));
    check(firstOnsetAt - firstActionAt < 180, '首弹本机出声延迟低于 180ms，实测=' + Math.round(firstOnsetAt - firstActionAt) + 'ms');
    const makeHand = (count, offset = 0) => {
      const points = Array.from({ length: 21 }, () => ({ x: .5, y: .75 + offset }));
      points[0] = { x: .5, y: .9 + offset };
      for (let finger = 0; finger < 4; finger++) {
        const index = 5 + finger * 4, x = .36 + finger * .09;
        points[index] = { x, y: .65 + offset };
        points[index + 1] = { x, y: .5 + offset };
        points[index + 2] = { x, y: (finger < count ? .4 : .62) + offset };
        points[index + 3] = { x, y: (finger < count ? .3 : .72) + offset };
      }
      points[4] = count === 5 ? { x: .12, y: .6 + offset } : { x: .43, y: .66 + offset };
      return points;
    };
    $('gestureMode').value = 'single';
    $('gestureMode').dispatchEvent(new Event('change', { bubbles: true }));
    VibeStudio.handleHands({ multiHandLandmarks: [makeHand(2)] });
    await wait(90);
    VibeStudio.handleHands({ multiHandLandmarks: [makeHand(2)] });
    check(currentFinger === 2, '单手伸指选和弦');
    $('strings').classList.remove('strummed');
    VibeStudio.handleHands({ multiHandLandmarks: [makeHand(2, .1)] });
    await wait(30);
    check($('strings').classList.contains('strummed'), '同一只手挥动即可扫弦，无需伴奏或第二只手');
    await VibeStudio.warmSamples();
    check(VibeStudio.samplesReady('guitar'), '本地吉他采样加载成功');
    check(localGuitarBuffers.size >= 5, '尼龙吉他优先采样已解码');
    for (const instrument of ['steelguitar', 'electric']) {
      instrumentSelect.value = instrument;
      instrumentSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await VibeStudio.warmSamples();
      const bank = realGuitarBank(instrument);
      check(bank.buffers.size >= 4, sampleInstruments[instrument].label + '本地采样已解码');
      maximum = 0;
      await VibeStudio.chooseFinger(1); await wait(150);
      check(maximum > .001, sampleInstruments[instrument].label + '实测非静音输出');
    }
    instrumentSelect.value = 'guitar';
    instrumentSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
    await importFile({ ...session, instrument: 'celeste' });
    check(instrumentSelect.value === 'guitar' && Number(bpm.value) === 118, '旧实验音色配置安全迁移到尼龙吉他');
    await importFile({ ...session, gestureMode: 'strum', gestureControlVersion: undefined });
    check($('gestureMode').value === 'single', '旧双手默认配置迁移到单手演奏');
    await importFile({ ...session, bpm: 9999 });
    check(Number(bpm.value) === 118 && $('studioMessage').textContent.includes('未导入'), '非法配置被拒绝且保留当前配置');
    await importFile({ ...session, bpm: 102 });
    return lines.join('\n');
  } finally { clearInterval(sample); masterGain.disconnect(probe); $('panicBtn').click(); }
};

window.runModelSmoke = async () => {
  await VibeStudio.loadCamera();
  const model = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}` });
  model.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .5, minTrackingConfidence: .5 });
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
