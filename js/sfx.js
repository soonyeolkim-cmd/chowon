'use strict';
// ── 효과음 (Web Audio로 직접 합성, 파일 없음) ──────────────────
const Sfx = (() => {
  let ac = null;
  const unlock = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    if (ac && ac.state === 'suspended') ac.resume();
  };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    if (!ac || ac.state !== 'running' || !Input.settings.sfx) return; // 설정에서 효과음 끄기
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  }
  return {
    swing: fin => tone(fin ? 380 : 520, 0.08, 'triangle', 0.05, -260),
    thrust: () => tone(700, 0.1, 'triangle', 0.06, -400),
    spin: () => { tone(300, 0.25, 'triangle', 0.07, 400); tone(450, 0.2, 'sawtooth', 0.03, -200, 0.05); },
    charged: () => tone(1200, 0.12, 'sine', 0.05, 200),
    wave: triple => { tone(900, 0.15, 'sine', 0.05, -500); if (triple) tone(1200, 0.15, 'sine', 0.04, -600, 0.04); },
    hit: crit => tone(crit ? 260 : 180, 0.09, 'square', 0.07, -90),
    block: () => tone(1500, 0.06, 'square', 0.04, -300),
    guardBreak: () => { tone(200, 0.15, 'sawtooth', 0.07, -120); tone(1000, 0.1, 'square', 0.04, -600, 0.03); },
    kill: () => { tone(330, 0.07, 'square', 0.06); tone(220, 0.12, 'square', 0.05, -100, 0.05); },
    hurt: () => tone(140, 0.2, 'sawtooth', 0.09, -80),
    dash: () => tone(300, 0.1, 'sine', 0.05, 300),
    dodge: () => { tone(1400, 0.25, 'sine', 0.06, -900); tone(700, 0.3, 'triangle', 0.04, 300, 0.05); },
    lunge: () => tone(110, 0.15, 'sawtooth', 0.05, 60),
    slam: () => tone(70, 0.35, 'sawtooth', 0.12, -30),
    roar: () => tone(90, 0.5, 'sawtooth', 0.08, 40),
    totem: () => [400, 300, 200, 120].forEach((f, i) => tone(f, 0.18, 'square', 0.06, -50, i * 0.07)),
    pickup: () => tone(880, 0.06, 'sine', 0.04, 300),
    heal: () => { tone(660, 0.08, 'sine', 0.05); tone(990, 0.12, 'sine', 0.05, 0, 0.07); },
    level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.08)),
    clear: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)),
    zap: () => tone(1800, 0.08, 'sawtooth', 0.035, -1200),
    orb: () => tone(1100, 0.06, 'sine', 0.035, 500),
    freeze: () => tone(2000, 0.12, 'sine', 0.04, -800),
    shatter: () => { tone(2400, 0.08, 'square', 0.04, -1500); tone(1200, 0.1, 'triangle', 0.04, -600, 0.03); },
    boom: () => tone(90, 0.25, 'sawtooth', 0.07, -40),
    boon: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.2, 'sine', 0.05, 0, i * 0.06)),
    // 8비트 칩 효과음 한 번 (retro-sfx.js)
    chip(def) { if (!ac || ac.state !== 'running' || !Input.settings.sfx) return; RetroSfx.play(ac, def, SFX_CHIP_GAIN); },
  };
})();
// 8비트 칩 효과음: 사용자가 듣기 페이지에서 고른 후보 (A · B · C, js/sfx-cands.js). 여기 없는 소리는 위의 삑 소리 그대로 (2026-10-17)
const SFX_PICK = {
  spin: 'A', wave: 'C', orb: 'C', charged: 'C', hit: 'B', kill: 'C', hurt: 'A', block: 'B', guardBreak: 'C',
  dash: 'C', dodge: 'B', boom: 'B', zap: 'B', freeze: 'C', shatter: 'A', slam: 'A', lunge: 'B', roar: 'B',
  totem: 'A', pickup: 'A', heal: 'B', level: 'A', boon: 'C',
};
const SFX_CHIP_GAIN = 0.5;   // 칩 소리 전체 크기 (삑 소리와 맞춤)
const SFX_MIN_GAP = 35;      // 같은 소리가 한꺼번에 겹치지 않게 (밀리초)
// 8비트 효과음 등록: 이름 하나에 소리 하나. 무기 파일에서도 Sfx.register('<무기>.<소리>', 정의) 로 새 소리를 만들 수 있다
Sfx.register = (key, def) => {
  let last = 0;
  Sfx[key] = () => { const now = performance.now(); if (now - last < SFX_MIN_GAP) return; last = now; Sfx.chip(def); };
};
for (const [k, c] of Object.entries(SFX_PICK)) Sfx.register(k, SFX_CANDS[k][c.charCodeAt(0) - 65]);
// 정령의 첫 선물 (2026-10-17): 내려오는 빛 · 터지는 팡파르
Sfx.register('giftRise', { layers: [
  { wave: 'sq', duty: 0.125, f0: 330, f1: 1760, curve: 'exp', dur: 0.85, vol: 0.06, vib: [14, 0.25], sus: 0.8 },
  { wave: 'tri', notes: [[523, 0.11], [659, 0.11], [784, 0.11], [1047, 0.11], [1319, 0.11], [1568, 0.16]], vol: 0.24, sus: 0.6 },
] });
Sfx.register('giftOpen', { layers: [
  { wave: 'sq', duty: 0.5, notes: [[784, 0.07], [1047, 0.07], [1319, 0.07], [1568, 0.32]], vol: 0.11 },
  { wave: 'tri', notes: [[392, 0.07], [523, 0.07], [659, 0.07], [784, 0.32]], vol: 0.3 },
  { wave: 'noise', f0: 3000, f1: 9000, dur: 0.3, vol: 0.07, delay: 0.21 },
] });
