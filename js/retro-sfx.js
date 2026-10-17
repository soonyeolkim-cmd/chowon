'use strict';
// 8비트 칩 효과음 합성기 (파일 없이 코드로): 옛날 게임기처럼 네모파 · 톱니파 · 삼각파 · 노이즈를 낮은 샘플레이트와 거친 음량 단계로 만든다
// 정의 하나 = { wave, f0, f1, dur, ... } 또는 { layers: [정의, ...] } 또는 { notes: [[Hz, 초], ...], wave } (짧은 멜로디)
//   wave: 'sq' 네모 (duty 0.125 · 0.25 · 0.5) / 'saw' 톱니 / 'tri' 삼각 / 'noise' 노이즈 (f0 → f1 은 노이즈의 거칠기)
//   f0 → f1: 시작 · 끝 주파수, curve 'exp' 면 지수로 미끄러진다 / dur: 길이(초) / vol: 음량
//   att: 올라오는 시간, sus: 이 비율까지 유지한 뒤 줄어든다 / vib: [빠르기 Hz, 깊이 반음] / arp: [반음, 이 시간부터]
//   bits: 음량 단계 (4 = 아주 거칠게) / delay: 레이어 시작 시간
const RetroSfx = (() => {
  const SR = 22050;
  function tone(p, out, off) {
    const n = Math.floor(p.dur * SR);
    let ph = 0, lfsr = 0x7fff, hold = 0, hv = 1;
    const step = p.bits ? 2 / (1 << p.bits) : 0, a = p.att ?? 0.004, s = (p.sus ?? 0.15) * p.dur, vol = p.vol ?? 0.4;
    for (let i = 0; i < n && off + i < out.length; i++) {
      const t = i / SR, k = i / n;
      let f = p.curve === 'exp' ? p.f0 * Math.pow((p.f1 ?? p.f0) / p.f0, k) : p.f0 + ((p.f1 ?? p.f0) - p.f0) * k;
      if (p.arp && t >= p.arp[1]) f *= Math.pow(2, p.arp[0] / 12);
      if (p.vib) f *= Math.pow(2, Math.sin(2 * Math.PI * p.vib[0] * t) * p.vib[1] / 12);
      let v;
      if (p.wave === 'noise') { // 옛 게임기식 노이즈: 정해진 빠르기로만 값이 바뀐다
        hold += f / SR;
        while (hold >= 1) { hold -= 1; const b = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (b << 14); hv = lfsr & 1 ? 1 : -1; }
        v = hv;
      } else {
        ph += f / SR; ph -= Math.floor(ph);
        v = p.wave === 'saw' ? 2 * ph - 1 : p.wave === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : ph < (p.duty ?? 0.5) ? 1 : -1;
      }
      const e = t < a ? t / a : t < s ? 1 : Math.max(0, 1 - (t - s) / Math.max(0.001, p.dur - s));
      v *= e * vol;
      if (step) v = Math.round(v / step) * step;
      out[off + i] += v;
    }
  }
  // 정의를 레이어 목록으로 펼친다 (멜로디는 음 하나하나를 레이어로)
  function flat(d) {
    if (d.layers) return d.layers.flatMap(flat);
    if (d.notes) {
      let t = d.delay || 0;
      return d.notes.map(([f, len]) => { const L = { ...d, notes: undefined, f0: f, f1: f, dur: len, delay: t, sus: d.sus ?? 0.5 }; t += len * (d.gap ?? 1); return L; });
    }
    return [d];
  }
  function render(d) {
    const ls = flat(d), len = Math.max(...ls.map(l => (l.delay || 0) + l.dur)) + 0.01;
    const out = new Float32Array(Math.ceil(len * SR));
    for (const l of ls) tone(l, out, Math.floor((l.delay || 0) * SR));
    for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
    return out;
  }
  const cache = new Map();
  return {
    SR, render,
    // ac: AudioContext, d: 정의, gain: 음량 배율
    play(ac, d, gain = 1, dest) {
      let buf = cache.get(d);
      if (!buf) { const data = render(d); buf = ac.createBuffer(1, data.length, SR); buf.copyToChannel(data, 0); cache.set(d, buf); }
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; g.gain.value = gain;
      src.connect(g).connect(dest || ac.destination); src.start();
      return src;
    },
  };
})();
if (typeof module !== 'undefined') module.exports = RetroSfx;
