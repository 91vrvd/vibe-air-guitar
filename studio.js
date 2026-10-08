/* Studio UI: built on the original sample/scheduler engine; no backend or microphone. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = window.StudioCore;
  const storageKey = 'vibe.studio.session.v1';
  const ready = new Set(), loading = new Map(), retryAfter = new Map();
  const stable = new core.StableGesture(70), sweep = new core.StrumDetector();
  const singleSweep = new core.StrumDetector({ travel: .065, minVelocity: .2, cooldownMs: 110 });
  let output, analyser, capture, meterFrame, recorder, recordStarted = 0, recordTimer, recordingStarting = false;
  let sequence = false, sequenceIndex = -1, practice = false, practiceIndex = 0, practiceCount = 0, practiceLocked = false;
  let clickOn = false, clickNext = 0, clickBeat = 0, tapTimes = [], lastStrumTime = 0;
  let lastHandAt = 0, audioStarting = null, savingTimer, importing = false, cameraLoading;
  let strumFrame = 0;
  const pluckFrames = new WeakMap();
  const takeUrls = new Set();
  const currentChord = () => sequence && isPlaying && activeProgression.length
    ? activeProgression[Math.max(0, sequenceIndex) % activeProgression.length].chord
    : getChordForFinger(currentFinger || pendingFinger || lastConfirmedFinger || 1);
  const notify = (message) => { $('studioMessage').textContent = message; };
  const safeStorage = { get() { try { return localStorage.getItem(storageKey); } catch { return null; } }, set(value) { try { localStorage.setItem(storageKey, value); } catch { notify('浏览器未允许本地保存，可导出配置文件。'); } } };

  async function audioReady() {
    const ctx = ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    if (!samplesReady(selectedInstrument) && !loading.has(selectedInstrument)) warmSamples();
    return ctx;
  }

  function attachAudio(ctx, master) {
    output = ctx.createGain(); output.gain.value = Number($('masterVolume').value) / 100;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 8; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .15;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    capture = ctx.createMediaStreamDestination();
    master.connect(output).connect(limiter);
    limiter.connect(ctx.destination); limiter.connect(capture); limiter.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let lastMeterAt = 0;
    const meter = (now) => {
      meterFrame = requestAnimationFrame(meter);
      if (now - lastMeterAt < 40) return;
      lastMeterAt = now;
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
      peak /= 128;
      $('outputLevel').style.transform = `scaleX(${Math.min(1, peak * 2)})`;
    };
    meterFrame = requestAnimationFrame(meter);
  }

  function samplesReady(instrument) { return Boolean(sampleInstruments[instrument]?.synth) || ready.has(instrument); }
  function warmSamples() {
    const instrument = selectedInstrument;
    if (samplesReady(instrument)) { setSampleStatus(sampleInstruments[instrument].label + ' · 已就绪'); return Promise.resolve(); }
    if (Date.now() < (retryAfter.get(instrument) || 0)) return Promise.resolve();
    if (loading.has(instrument)) return loading.get(instrument);
    setSampleStatus('加载音色 · 已可使用合成拨弦');
    const task = (async () => {
      try {
        if (instrument === 'guitar') {
          // Only the default C chord's nearest zones are critical. Other notes load on demand.
          await Promise.all([2, 3, 4, 6, 7].map(index => loadLocalGuitarSample(LOCAL_GUITAR_ZONES[index], 1)));
          localGuitarReady = true;
        } else if (instrument === 'electric') {
          await Promise.all([0, 2, 5, 7].map(index => loadRjsElectricSample(RJS_ELECTRIC_ZONES[index], 4)));
          rjsElectricReady = true;
        } else if (instrument === 'steelguitar') {
          await Promise.all([0, 2, 3, 4, 6].map(index => loadSteelGuitarSample(STEEL_GUITAR_ZONES[index])));
        } else {
          const notes = [...new Set(Object.values(gestureBindings).flatMap(name => guitarVoicingForChord(getChordByName(name))).map(applyCapo))];
          await Promise.all(notes.map(note => loadSample(note, instrument)));
        }
        ready.add(instrument);
        if (instrument === selectedInstrument) setSampleStatus(sampleInstruments[instrument].label + ' · 已就绪');
      } catch {
        retryAfter.set(instrument, Date.now() + 30000);
        if (instrument === selectedInstrument) setSampleStatus('音色加载受限 · 合成拨弦可用');
      } finally { loading.delete(instrument); }
    })();
    loading.set(instrument, task);
    return task;
  }

  function selectFinger(finger) {
    if (!gestureBindings[finger]) return;
    currentFinger = pendingFinger = lastConfirmedFinger = finger;
    lastConfirmedAt = performance.now();
    updateStatus();
  }
  async function chooseFinger(finger) {
    if (sequence) setSequence(false);
    selectFinger(finger);
    if (!isPlaying) await strum('down', .7);
  }
  async function strum(direction = 'down', velocity = .75) {
    const ctx = await audioReady();
    const chord = currentChord();
    if (!chord) return;
    const notes = guitarVoicingForChord(chord);
    if (direction === 'up') notes.reverse();
    const gain = mutedStrum ? .055 : .16 * core.clamp(velocity, .2, 1);
    notes.forEach((note, index) => playSample(applyCapo(note), ctx.currentTime + .006 + index * (spreadEnabled ? .014 : .003), gain, mutedStrum ? .14 : 1.4));
    const strings = $('strings');
    strings.classList.remove('strummed');
    if (strumFrame) cancelAnimationFrame(strumFrame);
    strumFrame = requestAnimationFrame(() => { strings.classList.add('strummed'); strumFrame = 0; });
    lastStrumTime = performance.now();
    checkPractice(chord);
  }
  function stringNote(index) {
    const chord = currentChord();
    const voicing = GUITAR_VOICINGS[chord.shapeChord || chord.chord];
    return voicing ? voicing[index] : getStringNoteForChord(chord, 6 - index);
  }
  async function pluck(index) {
    const ctx = await audioReady(), note = stringNote(index);
    if (note) playSample(applyCapo(note), ctx.currentTime + .006, .2, mutedStrum ? .15 : 1.2);
    const button = $('strings').children[index];
    button.classList.remove('plucked');
    const previousFrame = pluckFrames.get(button);
    if (previousFrame) cancelAnimationFrame(previousFrame);
    pluckFrames.set(button, requestAnimationFrame(() => { button.classList.add('plucked'); pluckFrames.delete(button); }));
    checkPractice(currentChord());
  }
  $('strings').innerHTML = Array.from({ length: 6 }, (_, i) => `<button type="button" data-string="${i}" aria-label="拨动第 ${6 - i} 弦"><span>${6 - i}</span><i></i><small></small></button>`).join('');
  const pointers = new Map();
  const stringAt = y => {
    const rect = $('strings').getBoundingClientRect();
    return core.clamp(Math.floor((y - rect.top) / (rect.height / 6)), 0, 5);
  };
  $('strings').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const index = stringAt(event.clientY);
    pointers.set(event.pointerId, index); $('strings').setPointerCapture(event.pointerId);
    pluck(index).catch(audioError);
  });
  $('strings').addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const before = pointers.get(event.pointerId), after = stringAt(event.clientY);
    if (before === after) return;
    for (let i = before + Math.sign(after - before); i !== after + Math.sign(after - before); i += Math.sign(after - before)) pluck(i).catch(audioError);
    pointers.set(event.pointerId, after);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('strings').addEventListener(name, e => pointers.delete(e.pointerId));
  $('strings').addEventListener('click', event => { if (event.detail === 0) { const target = event.target.closest('[data-string]'); if (target) pluck(Number(target.dataset.string)).catch(audioError); } });
  function audioError() { notify('音频暂未开启，请再点一次琴弦，并检查浏览器音量。'); }

  function statusChanged() {
    const chord = currentChord();
    if (chord) {
      $('centerChord').textContent = chord.chord;
      $('activeChord').textContent = chord.chord;
      $('centerGesture').textContent = sequence && isPlaying ? '和弦谱循环' : cameraActive ? '手势选和弦' : '点击下方和弦切换';
      Array.from($('strings').children).forEach((button, index) => { const note = stringNote(index); button.querySelector('small').textContent = note ? applyCapo(note) : '×'; });
    }
    if (!practice) $('practiceTarget').textContent = getProgressionTokens().join(' → ') || '在和弦页写下你的和弦谱';
    syncTempo();
  }
  function syncTempo() { $('tempoReadout').textContent = bpm.value; bpmValue.textContent = bpm.value; }
  function click(time, accent) {
    if (!clickOn || !audioContext) return;
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.frequency.value = accent ? 1100 : 780;
    gain.gain.setValueAtTime(.06 * Number($('masterVolume').value) / 100, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .045);
    // Cue click is intentionally excluded from recorded music.
    osc.connect(gain).connect(audioContext.destination); osc.start(time); osc.stop(time + .05);
    setTimeout(() => $('metronomeBtn').classList.toggle('beat', accent), Math.max(0, (time - audioContext.currentTime) * 1000));
  }
  function scheduledStep(step, division, time) {
    if (step % (division / 4) === 0) click(time, step % division === 0);
    if (!sequence || !activeProgression.length) return null;
    const index = Math.floor(step / division) % activeProgression.length;
    if (index !== sequenceIndex) {
      const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
      setTimeout(() => {
        if (!sequence || !isPlaying) return;
        sequenceIndex = index; statusChanged();
        $('practiceLabel').textContent = `和弦循环 · ${index + 1} / ${activeProgression.length}`;
        [...progressionStrip.children].forEach((node, i) => node.classList.toggle('active', i === index));
      }, delay);
    }
    return activeProgression[index].chord;
  }
  const clickTimer = setInterval(() => {
    if (!clickOn || isPlaying || !audioContext || audioContext.state !== 'running') return;
    if (clickNext < audioContext.currentTime) clickNext = audioContext.currentTime + .02;
    while (clickNext < audioContext.currentTime + .1) { click(clickNext, clickBeat++ % 4 === 0); clickNext += 60 / Number(bpm.value); }
  }, 25);
  function transportChanged(playing) {
    $('transportPlay').innerHTML = playing ? 'Ⅱ <span>暂停</span>' : '▶ <span>伴奏</span>';
    $('transportPlay').setAttribute('aria-label', playing ? '暂停伴奏' : '开始伴奏');
    $('transportPlay').classList.toggle('active', playing);
    playBtn.textContent = playing ? '停止伴奏' : '开始伴奏';
    if (!playing) { sequenceIndex = -1; clickNext = 0; $('practiceLabel').textContent = practice ? '和弦跟练' : '自由演奏'; }
  }
  async function toggleTransport() {
    if (audioStarting) return;
    audioStarting = togglePlay().catch(audioError).finally(() => { audioStarting = null; });
    await audioStarting;
  }
  $('transportPlay').addEventListener('click', toggleTransport);
  $('tapBtn').addEventListener('click', () => {
    const time = performance.now();
    if (time - (tapTimes.at(-1) || 0) > 1800) tapTimes = [];
    tapTimes.push(time); tapTimes = tapTimes.slice(-8);
    const tempo = core.tappedTempo(tapTimes);
    if (tempo) { bpm.value = tempo; bpm.dispatchEvent(new Event('input', { bubbles: true })); notify(`已设为 ${tempo} BPM。`); }
    else notify('按你心中的节奏，再点几下。');
  });
  $('metronomeBtn').addEventListener('click', async () => {
    try { await audioReady(); clickOn = !clickOn; clickNext = 0; clickBeat = 0; syncClick(); saveSoon(); } catch { audioError(); }
  });
  function syncClick() { $('metronomeBtn').classList.toggle('active', clickOn); $('metronomeBtn').setAttribute('aria-pressed', String(clickOn)); }
  function setSequence(on) {
    parseProgression();
    if (on && !activeProgression.length) { notify('先在“和弦”页添加和弦谱。'); return false; }
    sequence = on; sequenceIndex = -1;
    $('sequenceBtn').classList.toggle('active', on); $('sequenceBtn').setAttribute('aria-pressed', String(on));
    if (!on) $('practiceLabel').textContent = '自由演奏';
    return true;
  }
  $('sequenceBtn').addEventListener('click', async () => {
    if (practice) stopPractice();
    if (!setSequence(!sequence)) return;
    if (sequence && !isPlaying) await toggleTransport();
    if (sequence) notify('每小节自动切换一个和弦；修改和弦谱即可换一段旋律。');
  });
  function stopPractice() { practice = false; practiceLocked = false; $('practiceBtn').textContent = '和弦跟练'; $('practiceLabel').textContent = '自由演奏'; statusChanged(); }
  function renderPractice() {
    parseProgression();
    if (!activeProgression.length) { stopPractice(); return; }
    practiceIndex %= activeProgression.length;
    const target = activeProgression[practiceIndex];
    $('practiceLabel').textContent = `和弦跟练 · 已完成 ${practiceCount} 次`;
    $('practiceTarget').textContent = `请弹 ${target.chord.chord}${target.gestureDegree ? ' · 按 ' + target.gestureDegree + ' / 伸 ' + target.gestureDegree + ' 指' : ' · 先在和弦页绑定到一个手势'}`;
  }
  function checkPractice(chord) {
    if (!practice || practiceLocked) return;
    const target = activeProgression[practiceIndex];
    if (target?.chord.chord !== chord.chord) { notify('下一和弦是 ' + (target?.chord.chord || '—') + '，选好后再拨弦。'); return; }
    practiceLocked = true; practiceCount++;
    notify(`✓ ${chord.chord}，换下一个和弦。`);
    setTimeout(() => { if (!practice) return; practiceIndex++; practiceLocked = false; renderPractice(); }, 700);
  }
  $('practiceBtn').addEventListener('click', async () => {
    if (practice) { stopPractice(); return; }
    parseProgression();
    if (!activeProgression.length) { notify('先在和弦页添加和弦谱。'); return; }
    if (isPlaying) await toggleTransport();
    setSequence(false); practice = true; practiceIndex = 0; practiceCount = 0;
    $('practiceBtn').textContent = '结束跟练'; renderPractice();
  });

  async function loadScript(url, symbol) {
    if (window[symbol]) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = url;
      const timer = setTimeout(() => { script.remove(); reject(new Error('模型加载超时')); }, 20000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('模型加载失败')); };
      document.head.append(script);
    });
  }
  async function loadCamera() {
    cameraLoading ||= Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js', 'Hands'),
      loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js', 'Camera'),
    ]).catch(error => { cameraLoading = null; throw error; });
    await cameraLoading;
    if (performanceMode === 'stage') {
      try { await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/face_detection.js', 'FaceDetection'); }
      catch { notify('面部特效暂不可用，不影响手势演奏。'); }
    }
  }
  function cameraChanged(on) {
    document.body.classList.toggle('camera-active', on);
    $('cameraMode').classList.toggle('active', on); $('touchMode').classList.toggle('active', !on);
    $('cameraInstructions').hidden = !on;
    $('inputHint').textContent = on ? '单手比 1–5 指选和弦，上下挥动扫弦' : '选一个和弦，划过琴弦。';
    stable.reset(); sweep.reset(); singleSweep.reset(); lastHandAt = 0;
    syncGestureInstructions();
    if (!on) $('detectStatus').textContent = '触控已就绪';
  }
  const manualCamera = () => cameraActive && ['single', 'strum'].includes($('gestureMode').value) && !sequence;
  function syncGestureInstructions() {
    const mode = $('gestureMode').value;
    const title = $('cameraInstructions').querySelector('strong');
    const detail = $('cameraInstructions').querySelector('span');
    if (mode === 'single') {
      title.textContent = '只需一只手';
      detail.innerHTML = '伸出 1–5 指选和弦<br>同一只手上下挥动扫弦';
    } else if (mode === 'strum') {
      title.textContent = '让双手完整入镜';
      detail.innerHTML = '一手伸指选和弦<br>另一只手上下挥动扫弦';
    } else {
      title.textContent = '一只手选和弦';
      detail.innerHTML = '伸出 1–5 指选和弦<br>开启伴奏后自动弹奏';
    }
  }
  function handleHands(results) {
    const hands = results.multiHandLandmarks || [], time = performance.now();
    const mode = $('gestureMode').value;
    const twoHand = mode === 'strum';
    const leftSide = $('chordSide').value === 'left';
    // Coordinates are camera-space; the on-screen video is mirrored.
    const chordHand = twoHand ? hands.find(p => leftSide ? p[0].x > .5 : p[0].x <= .5) : hands[0];
    const strumHand = twoHand ? hands.find(p => leftSide ? p[0].x <= .5 : p[0].x > .5) : null;
    const count = chordHand ? core.fingerCount(chordHand) : null;
    stable.delay = (mode === 'single' ? 70 : 100) + chordSwitchDelayMs;
    const confirmed = stable.update(count, time);
    if (count) lastHandAt = time;
    if (confirmed && confirmed !== currentFinger) { selectFinger(confirmed); }
    const holding = !twoHand && !chordHand && autoHoldEnabled && time - lastHandAt < autoHoldMs;
    if (!count && !holding && (chordHand || time - lastHandAt > 250)) {
      if (currentFinger) { currentFinger = pendingFinger = null; stopChordLoop(); updateStatus(); }
    }
    if (mode === 'single') {
      // The same hand selects a chord with finger count and plays it with a palm sweep.
      // Ignore movement during a gesture change so the old chord cannot sound by accident.
      const hit = singleSweep.update(count && confirmed === count && currentFinger === count ? chordHand[9].y : null, time);
      if (hit) strum(hit.direction, hit.velocity).catch(audioError);
    } else singleSweep.reset();
    if (twoHand) {
      const hit = sweep.update(strumHand && count && confirmed ? strumHand[9].y : null, time);
      if (hit && currentFinger) strum(hit.direction, hit.velocity).catch(audioError);
    }
    $('detectStatus').textContent = holding ? '自动保持和弦 · 最长 7 秒' : !chordHand ? '请让演奏手入镜' : !count ? '握拳 · 已静音' : !confirmed ? '保持手势…' : `${confirmed} 指 · ${mode === 'single' ? '上下挥动这只手扫弦' : twoHand ? strumHand ? '上下挥动另一只手扫弦' : '等待扫弦手入镜' : '开启伴奏即可连续演奏'}`;
    return true;
  }
  $('cameraMode').addEventListener('click', () => { if (!cameraActive && !cameraBtn.disabled) cameraBtn.click(); });
  $('touchMode').addEventListener('click', () => { if (cameraActive) stopCamera(); });
  $('gestureMode').addEventListener('change', () => {
    stable.reset(); sweep.reset(); singleSweep.reset(); syncGestureInstructions();
    handsModel?.setOptions({ maxNumHands: $('gestureMode').value === 'strum' ? 2 : 1 });
    notify($('gestureMode').value === 'single' ? '单手演奏：伸指选和弦，同一只手上下挥动扫弦。' : $('gestureMode').value === 'strum' ? '双手扫弦：一手选和弦，另一手扫弦。' : '单手伴奏：伸指选和弦后开启伴奏。');
  });

  async function toggleRecording() {
    if (recordingStarting) return;
    if (recorder?.state === 'recording') { $('recordBtn').disabled = true; recorder.stop(); return; }
    if (!window.MediaRecorder) { notify('当前浏览器不支持录音下载，请使用新版 Chrome、Edge 或 Safari。'); return; }
    if (takeUrls.size >= 5) { notify('当前页面已有 5 段录音，请下载并移除一段后继续录制。'); return; }
    recordingStarting = true;
    try {
      await audioReady();
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(capture.stream, mime ? { mimeType: mime } : {});
      const chunks = [], instance = recorder;
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => { notify('录音中断，请检查浏览器权限与可用内存。'); resetRecordUI(); };
      instance.onstop = () => {
        resetRecordUI();
        const type = instance.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (!blob.size) { notify('这段录音没有生成，请重新录制。'); return; }
        const url = URL.createObjectURL(blob); takeUrls.add(url);
        const row = document.createElement('div'); row.className = 'take';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const audio = document.createElement('audio'); audio.controls = true; audio.src = url; audio.preload = 'metadata';
        const link = document.createElement('a'); link.href = url; link.download = `vibe-${stamp}.${extension}`; link.textContent = '下载录音';
        const open = document.createElement('a'); open.href = url; open.target = '_blank'; open.rel = 'noopener'; open.textContent = '打开音频';
        open.title = '下载无响应时，可打开后使用浏览器的保存或分享功能';
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除';
        remove.onclick = () => { if (!confirm('从当前页面移除这段录音？请先确认已下载。')) return; audio.pause(); URL.revokeObjectURL(url); takeUrls.delete(url); row.remove(); };
        row.append(audio, link, open, remove); $('recordedTakes').prepend(row);
        notify('录音已完成。打开控制台 → 演奏 → 我的录音，试听并下载。');
      };
      instance.start(1000); recordStarted = Date.now();
      $('recordBtn').textContent = '■ 结束'; $('recordBtn').classList.add('recording');
      recordTimer = setInterval(() => {
        const seconds = Math.floor((Date.now() - recordStarted) / 1000);
        $('recordTime').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        if (seconds >= 300 && instance.state === 'recording') instance.stop();
      }, 500);
      notify('正在录音，最长 5 分钟。只录琴声和鼓点，不录节拍器与麦克风。');
    } catch { notify('无法开始录音，可继续演奏；请尝试新版浏览器。'); resetRecordUI(); }
    finally { recordingStarting = false; }
  }
  function resetRecordUI() { clearInterval(recordTimer); $('recordBtn').disabled = false; $('recordBtn').textContent = '● 录音'; $('recordBtn').classList.remove('recording'); }
  $('recordBtn').addEventListener('click', toggleRecording);
  function panic() {
    if (isPlaying) { isPlaying = false; clearInterval(schedulerId); schedulerId = null; }
    stopChordLoop(); currentFinger = pendingFinger = null;
    if (audioContext) fadeMaster(audioContext.currentTime, .03);
    clickOn = false; syncClick(); transportChanged(false);
    if (recorder?.state === 'recording') recorder.stop();
    stable.reset(); sweep.reset(); updateStatus(); notify('已停止。点击琴弦可继续演奏。');
  }
  $('panicBtn').addEventListener('click', panic);

  function configOptions() {
    return { chords: CHORD_OPTIONS, enums: {
      instrument: Array.from(instrumentSelect.options, o => o.value), key: Array.from(keySelect.options, o => o.value),
      rhythm: rhythmProfiles.map(r => r.id), drumRhythm: drumRhythmProfiles.map(r => r.id), mode: Object.keys(modeLabels),
      gestureMode: ['single', 'strum', 'chords'], chordSide: ['left', 'right'], theme: ['dark', 'light'], performance: Object.keys(PERFORMANCE_PROFILES),
    } };
  }
  function snapshot() {
    return { version: 1, instrument: selectedInstrument, key: selectedKey, rhythm: selectedRhythm, drumRhythm: selectedDrumRhythm, mode: playMode,
      gestureMode: $('gestureMode').value, gestureControlVersion: 2, chordSide: $('chordSide').value, theme: glassTheme, performance: performanceMode,
      bpm: Number(bpm.value), capo: capoSemitones, volume: Number($('masterVolume').value), progression: getProgressionTokens(), bindings: { ...gestureBindings },
      drums: drumsEnabled, metronome: clickOn, spread: spreadEnabled, humanize: randomVelocity, muted: mutedStrum };
  }
  function saveSoon() { if (importing) return; clearTimeout(savingTimer); savingTimer = setTimeout(() => safeStorage.set(JSON.stringify(snapshot())), 400); }
  function restore(data) {
    const supported = Array.from(instrumentSelect.options, o => o.value);
    const migrated = data ? { ...data } : data;
    if (migrated && !supported.includes(migrated.instrument) && Object.prototype.hasOwnProperty.call(sampleInstruments, migrated.instrument)) migrated.instrument = 'guitar';
    // Existing sessions used two-hand as the only manual gesture mode. New sessions
    // remember an explicit two-hand choice; legacy ones open with the requested one-hand flow.
    if (migrated?.gestureMode === 'strum' && !migrated.gestureControlVersion) migrated.gestureMode = 'single';
    const s = core.validateSession(migrated, configOptions());
    importing = true;
    try {
      selectedInstrument = instrumentSelect.value = s.instrument; selectedKey = keySelect.value = s.key;
      selectedRhythm = s.rhythm; selectedDrumRhythm = s.drumRhythm; playMode = s.mode; customMelodyEnabled = playMode === 'custom';
      gestureBindings = s.bindings; saveGestureBindings(); progressionInput.value = s.progression.join(' ');
      bpm.value = s.bpm; capoSemitones = s.capo; capo.value = s.capo;
      $('masterVolume').value = s.volume; applyVolume();
      $('gestureMode').value = s.gestureMode; $('chordSide').value = s.chordSide; syncGestureInstructions();
      glassTheme = s.theme; document.body.dataset.theme = s.theme; updateThemeSwitch(); applyPerformanceMode(s.performance);
      drumsEnabled = drumToggle.checked = s.drums; spreadEnabled = spreadToggle.checked = s.spread;
      randomVelocity = randomToggle.checked = s.humanize; mutedStrum = muteToggle.checked = s.muted;
      clickOn = s.metronome; syncClick(); renderControls(); updateStatus(); updateHumanizeLabel();
      setDrumTouchDrumState(s.drums);
    } finally { importing = false; }
  }
  function downloadJSON() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vibe-session.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000); notify('配置已导出，不含录音和上传的音频。');
  }
  $('exportSession').addEventListener('click', downloadJSON);
  $('importSession').addEventListener('click', () => $('sessionFile').click());
  $('sessionFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 32000) throw new Error('配置文件过大');
      const data = JSON.parse(await file.text());
      panic(); setSequence(false); if (practice) stopPractice(); restore(data); saveSoon(); warmSamples(); notify('演奏配置已导入。');
    } catch (error) { notify('未导入：' + error.message); }
    finally { event.target.value = ''; }
  });
  function applyVolume() { const value = Number($('masterVolume').value); $('volumeValue').textContent = value + '%'; if (output) output.gain.setTargetAtTime(value / 100, audioContext.currentTime, .02); }
  $('masterVolume').addEventListener('input', applyVolume);
  document.addEventListener('input', () => { syncTempo(); saveSoon(); });
  document.addEventListener('change', () => { statusChanged(); if (practice) renderPractice(); saveSoon(); });
  document.addEventListener('click', event => { if (event.target.closest('[data-mode], [data-theme-choice], [data-control-tab], [data-bind-finger], .quick-chord-btn')) saveSoon(); });

  $('guideBtn').addEventListener('click', () => $('guideDialog').showModal());
  $('fullscreenBtn').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else notify('当前浏览器不支持网页全屏，可将网页添加到主屏幕。'); }
    catch { notify('浏览器未允许全屏，可继续在当前窗口演奏。'); }
  });
  function drawerChanged(open) {
    const mobile = matchMedia('(max-width: 900px)').matches;
    const controls = document.querySelector('.controls'); controls.inert = mobile && !open;
    document.querySelector('.stage').inert = mobile && open;
    controls.setAttribute('aria-hidden', String(mobile && !open));
    document.querySelector('.stage').setAttribute('aria-hidden', String(mobile && open));
    if (mobile) { if (open) $('controlsClose').focus(); else $('settingsFab').focus(); }
    $('settingsFab').setAttribute('aria-expanded', String(open));
  }
  matchMedia('(max-width: 900px)').addEventListener('change', () => drawerChanged(document.body.classList.contains('controls-open')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (document.body.classList.contains('controls-open')) setControlsDrawer(false); else if (!$('guideDialog').open) panic(); return; }
    if (document.body.classList.contains('controls-open') && event.key === 'Tab' && matchMedia('(max-width: 900px)').matches) {
      const focusable = [...document.querySelector('.controls').querySelectorAll('button,input,select,textarea,a')].filter(el => el.offsetParent !== null && !el.disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if ($('guideDialog').open || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable || event.repeat) return;
    if (/^[1-5]$/.test(event.key)) { event.preventDefault(); chooseFinger(Number(event.key)).catch(audioError); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); strum(event.key === 'ArrowDown' ? 'down' : 'up').catch(audioError); }
    if (event.code === 'Space' && !/BUTTON|A/.test(event.target.tagName)) { event.preventDefault(); toggleTransport(); }
  });
  window.addEventListener('beforeunload', event => { if (takeUrls.size || recorder?.state === 'recording') { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { panic(); if (cameraActive) stopCamera(); });

  window.VibeStudio = { attachAudio, samplesReady, warmSamples, chooseFinger, statusChanged, scheduledStep, transportChanged, manualCamera, loadCamera, cameraChanged, handleHands, drawerChanged, notify };
  try { const saved = safeStorage.get(); if (saved) restore(JSON.parse(saved)); } catch { notify('旧配置无法恢复，已使用默认设置。'); }
  selectFinger(1); cameraChanged(false); transportChanged(false); drawerChanged(false); statusChanged();
  setSampleStatus(sampleInstruments[selectedInstrument].label + ' · 点按即可演奏');
})();
