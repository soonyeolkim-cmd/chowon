'use strict';
// 봉인의 숲 메인 테마 — 직접 작곡 · 슈퍼패미컴 풍 (코드로 연주, 파일 없음)
// 악기: 금관(멜로디) · 현악 패드 · 하프 아르페지오 · 저음 현 · 팀파니 · 스네어 · 심벌
// 공간감: 홀 잔향(컨볼버) + 메아리, 악기마다 좌우 배치
// 구성: 팡파르 도입 4마디 → A 8마디 (주제) → B 8마디 (고조, 멜로디 옥타브 겹침) → A로 돌아가 반복
//
// 음표: ['D5', 길이] — 길이는 16분음표 칸 수 (한 마디 = 16칸). '-' 는 쉼표.

const THEME_BPM = 96;
const CHORDS = {
  Dm: ['D', 'F', 'A'], Bb: ['Bb', 'D', 'F'], F: ['F', 'A', 'C'], C: ['C', 'E', 'G'],
  A: ['A', 'C#', 'E'], Gm: ['G', 'Bb', 'D'], D: ['D', 'F#', 'A'],
};
const THEME = {
  // 팡파르: 따-따-따 따아앙 (금관 옥타브 · 팀파니 · 심벌)
  intro: [
    { ch: 'Dm', m: [['D5', 2], ['D5', 2], ['D5', 2], ['A5', 10]], fan: 1, crash: 1 },
    { ch: 'Bb', m: [['G5', 2], ['F5', 2], ['G5', 2], ['Bb5', 10]], fan: 1 },
    { ch: 'C',  m: [['A5', 2], ['G5', 2], ['A5', 2], ['C6', 6], ['Bb5', 2], ['A5', 2]], fan: 1 },
    { ch: 'D',  m: [['D6', 12], ['-', 4]], fan: 1, roll: 1 },
  ],
  // A: 주제 (하프 8분 아르페지오, 잔잔한 행진)
  A: [
    { ch: 'Dm', m: [['D5', 6], ['A4', 2], ['D5', 2], ['E5', 2], ['F5', 4]], crash: 1 },
    { ch: 'Bb', m: [['G5', 6], ['F5', 2], ['E5', 2], ['D5', 2], ['F5', 4]] },
    { ch: 'F',  m: [['A5', 8], ['G5', 2], ['F5', 2], ['E5', 2], ['F5', 2]] },
    { ch: 'C',  m: [['G5', 12], ['-', 4]] },
    { ch: 'Dm', m: [['D5', 6], ['A4', 2], ['D5', 2], ['E5', 2], ['F5', 4]] },
    { ch: 'Bb', m: [['G5', 6], ['A5', 2], ['Bb5', 2], ['A5', 2], ['G5', 4]] },
    { ch: 'C',  m: [['E5', 4], ['G5', 4], ['C6', 4], ['Bb5', 2], ['A5', 2]] },
    { ch: 'A',  m: [['A5', 8], ['E5', 4], ['C#5', 4]], roll: 1 },
  ],
  // B: 고조 (멜로디 옥타브 겹침, 하프 16분, 현악 크게) → 마지막에 D장조로 밝게
  B: [
    { ch: 'Gm', m: [['Bb5', 6], ['A5', 2], ['G5', 4], ['D5', 4]], big: 1, crash: 1 },
    { ch: 'Dm', m: [['F5', 6], ['E5', 2], ['D5', 4], ['A4', 4]], big: 1 },
    { ch: 'Bb', m: [['D5', 4], ['F5', 4], ['Bb5', 4], ['D6', 4]], big: 1 },
    { ch: 'F',  m: [['C6', 12], ['A5', 4]], big: 1 },
    { ch: 'Gm', m: [['Bb5', 4], ['A5', 4], ['G5', 4], ['Bb5', 4]], big: 1 },
    { ch: 'A',  m: [['A5', 4], ['G5', 2], ['F5', 2], ['E5', 4], ['C#5', 4]], big: 1 },
    { ch: ['Bb', 'C'], m: [['D5', 4], ['F5', 4], ['E5', 4], ['G5', 4]], big: 1 },
    { ch: 'D',  m: [['F#5', 4], ['A5', 4], ['D6', 8]], big: 1, roll: 1, crash: 1 },
  ],
};

const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const noteFreq = (name, oct) => {
  const m = /^([A-G][b#]?)(\d)?$/.exec(name);
  const o = m[2] !== undefined ? +m[2] : oct;
  return 440 * Math.pow(2, (NOTE_IDX[m[1]] + 12 * (o + 1) - 69) / 12);
};

const ThemePlayer = (() => {
  let ac = null, master = null, verb = null, echo = null, timer = null, bars = [], barI = 0, nextT = 0, noise = null;
  const STEP = 60 / THEME_BPM / 4;

  function setup(ctx, dest) {
    ac = ctx;
    // 마스터 → 컴프레서 (소리가 커져도 찌그러지지 않게)
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = 0.9;
    master.connect(comp).connect(dest);
    // 홀 잔향: 지수적으로 줄어드는 노이즈로 만든 울림 (2.6초)
    const len = Math.floor(ac.sampleRate * 2.6), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = ac.createConvolver(); conv.buffer = ir;
    verb = ac.createGain(); verb.gain.value = 0.38;
    verb.connect(conv).connect(master);
    // 슈퍼패미컴식 메아리 (멜로디용)
    echo = ac.createDelay(1); echo.delayTime.value = STEP * 3;
    const fb = ac.createGain(); fb.gain.value = 0.3;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const wet = ac.createGain(); wet.gain.value = 0.18;
    echo.connect(lp).connect(fb).connect(echo); lp.connect(wet).connect(master);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // 출력 연결: 좌우 배치 + 잔향 · 메아리 보내기
  function route(node, pan, rev, ech) {
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const last = p ? (p.pan.value = pan, node.connect(p), p) : node;
    last.connect(master);
    if (rev) { const s = ac.createGain(); s.gain.value = rev; last.connect(s).connect(verb); }
    if (ech) { const s = ac.createGain(); s.gain.value = ech; last.connect(s).connect(echo); }
  }
  // 음량 모양: 올라오기 → 유지 → 사라지기
  function env(g, t, dur, vol, a, sus, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.linearRampToValueAtTime(vol * sus, t + a + 0.12);
    g.gain.setValueAtTime(vol * sus, Math.max(t + a + 0.12, t + dur - rel));
    g.gain.linearRampToValueAtTime(0, t + dur);
  }

  // 금관: 톱니파 두 개를 살짝 어긋나게 + 필터가 열리며 "빠앙" + 비브라토
  function brass(freq, t, dur, vol, pan = 0) {
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + 0.07); f.frequency.linearRampToValueAtTime(1900, t + 0.3);
    for (const det of [-7, 7]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      if (dur > 0.45) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(12, t + 0.4); l.connect(lg).connect(o.detune); l.start(t); l.stop(t + dur + 0.05); }
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
    env(g, t, dur, vol, 0.03, 0.8, 0.1);
    f.connect(g); route(g, pan, 0.35, 0.5);
  }
  // 현악 패드: 천천히 올라오는 화음
  function strings(freq, t, dur, vol, pan) {
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1700;
    for (const det of [-11, 0, 11]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
    env(g, t, dur, vol, 0.28, 0.9, 0.35);
    f.connect(g); route(g, pan, 0.5, 0);
  }
  // 하프: 튕기는 소리 (빨리 사라짐)
  function harp(freq, t, vol, pan) {
    const g = ac.createGain();
    for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.35]]) { const o = ac.createOscillator(); o.type = type; o.frequency.value = freq * mul; const og = ac.createGain(); og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + 0.9); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.85);
    route(g, pan, 0.45, 0);
  }
  // 저음 현 (콘트라베이스)
  function bass(freq, t, dur, vol) {
    const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = o2.frequency.value = freq;
    const g2 = ac.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2).connect(f);
    [o1, o2].forEach(o => { o.start(t); o.stop(t + dur + 0.05); });
    env(g, t, dur, vol, 0.02, 0.85, 0.08);
    f.connect(g); route(g, 0, 0.15, 0);
  }
  // 팀파니: 둥 (음높이가 살짝 내려가며 울림)
  function timpani(freq, t, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.35, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g); o.start(t); o.stop(t + 1.15);
    const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = noise; nf.type = 'lowpass'; nf.frequency.value = 900;
    ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(nf).connect(ng); n.start(t); n.stop(t + 0.13);
    const mix = ac.createGain(); g.connect(mix); ng.connect(mix); route(mix, -0.15, 0.45, 0);
  }
  function snare(t, vol) {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f).connect(g); n.start(t, Math.random()); n.stop(t + 0.17);
    route(g, 0.2, 0.4, 0);
  }
  function crash(t, vol) {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noise; f.type = 'highpass'; f.frequency.value = 4500;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(f).connect(g); n.start(t, Math.random()); n.stop(t + 1.85);
    route(g, 0.35, 0.6, 0);
  }

  function scheduleBar(bar, t0) {
    const loud = bar.fan || bar.big;
    // 멜로디: 금관. 팡파르 · 고조 구간은 한 옥타브 아래를 겹쳐 두껍게
    let s = 0;
    for (const [n, len] of bar.m) {
      if (n !== '-') {
        const f = noteFreq(n), t = t0 + s * STEP, d = len * STEP * 0.96;
        brass(f, t, d, loud ? 0.075 : 0.07, 0.08);
        if (loud) brass(f / 2, t, d, 0.05, -0.25);
      }
      s += len;
    }
    // 화음: 반 마디마다 (한 코드면 전체)
    const chs = Array.isArray(bar.ch) ? bar.ch : [bar.ch, bar.ch];
    for (let half = 0; half < 2; half++) {
      const tones = CHORDS[chs[half]], th = t0 + half * 8 * STEP, hd = 8 * STEP;
      // 현악 패드 (좌우로 벌려서)
      if (half === 0 || chs[0] !== chs[1]) {
        const dur = chs[0] === chs[1] ? hd * 2 : hd;
        tones.forEach((nm, k) => strings(noteFreq(nm, 4), th, dur, loud ? 0.022 : 0.016, [-0.5, 0, 0.5][k]));
      }
      // 하프: 주제는 8분, 고조는 16분으로 빠르게. 팡파르엔 하프 대신 금관 화음 끊어 치기
      if (bar.fan) {
        for (const i of [0, 4]) tones.forEach((nm, k) => brass(noteFreq(nm, 4), th + i * STEP, STEP * 2.6, 0.022, [-0.4, 0.1, 0.4][k]));
      } else {
        const per = bar.big ? 1 : 2, seq = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let i = 0; i < 8; i += per) {
          const k = seq[(i / per) % seq.length], oct = 4 + ((i / per) % 4 === 3 ? 1 : 0);
          harp(noteFreq(tones[k], oct), th + i * STEP, bar.big ? 0.05 : 0.065, 0.45);
        }
      }
      // 저음 현: 근음 (2박마다) + 5음
      bass(noteFreq(tones[0], 2), th, STEP * 3.6, 0.2);
      bass(noteFreq(tones[2], 2), th + 4 * STEP, STEP * 3.6, 0.16);
    }
    // 타악기
    const root = CHORDS[Array.isArray(bar.ch) ? bar.ch[0] : bar.ch][0];
    if (bar.crash) crash(t0, 0.07);
    timpani(noteFreq(root, 2), t0, 0.45);
    timpani(noteFreq(root, 2), t0 + 8 * STEP, loud ? 0.38 : 0.28);
    if (!bar.fan) { snare(t0 + 4 * STEP, 0.1); snare(t0 + 12 * STEP, 0.1); if (bar.big) snare(t0 + 14 * STEP, 0.06); }
    if (bar.roll) for (let st = 12; st < 16; st++) for (const h of [0, 0.5]) timpani(noteFreq(root, 2), t0 + (st + h) * STEP, 0.16 + (st - 12) * 0.06); // 다음 구간으로 넘어가는 팀파니 롤
  }

  function tick() {
    while (nextT < ac.currentTime + 0.3) {
      scheduleBar(bars[barI], nextT);
      nextT += STEP * 16;
      barI++;
      if (barI >= bars.length) barI = THEME.intro.length; // 도입은 한 번만, 그 뒤로 A · B 반복
    }
  }

  return {
    playing: false,
    play(ctx, dest) {
      if (this.playing) return;
      if (!ac) setup(ctx, dest || ctx.destination);
      bars = [...THEME.intro, ...THEME.A, ...THEME.B];
      barI = 0; nextT = ac.currentTime + 0.12;
      master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(this.vol ?? 0.9, ac.currentTime);
      tick(); timer = setInterval(tick, 60);
      this.playing = true;
    },
    stop() {
      if (!this.playing) return;
      clearInterval(timer); timer = null;
      master.gain.setTargetAtTime(0, ac.currentTime, 0.2); // 이미 예약된 음은 부드럽게 줄인다
      this.playing = false;
    },
    vol: 0.9,
    setVolume(v) { this.vol = 0.9 * v; if (master && this.playing) master.gain.setValueAtTime(this.vol, ac.currentTime); },
  };
})();
