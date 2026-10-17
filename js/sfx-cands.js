'use strict';
// 효과음 후보 (A · B · C) — 8비트 칩 소리. 정의 형식은 retro-sfx.js 참고
const SFX_CANDS = (() => {
  const N = (w, notes, o = {}) => ({ wave: w, notes, ...o });
  return {
    swing: [
      { wave: 'noise', f0: 9000, f1: 2500, curve: 'exp', dur: 0.09, sus: 0.1, vol: 0.3 },
      { wave: 'sq', duty: 0.25, f0: 900, f1: 300, curve: 'exp', dur: 0.07, vol: 0.22 },
      { layers: [{ wave: 'noise', f0: 7000, f1: 3000, dur: 0.06, vol: 0.22 }, { wave: 'sq', duty: 0.125, f0: 600, f1: 350, dur: 0.05, vol: 0.15 }] },
    ],
    thrust: [
      { wave: 'sq', duty: 0.125, f0: 1200, f1: 400, curve: 'exp', dur: 0.08, vol: 0.22 },
      { wave: 'noise', f0: 12000, f1: 4000, curve: 'exp', dur: 0.07, vol: 0.28 },
      { wave: 'saw', f0: 700, f1: 250, curve: 'exp', dur: 0.09, vol: 0.2, bits: 5 },
    ],
    spin: [
      { layers: [{ wave: 'noise', f0: 2500, f1: 8000, curve: 'exp', dur: 0.14, vol: 0.25 }, { wave: 'noise', f0: 8000, f1: 2000, curve: 'exp', dur: 0.14, vol: 0.25, delay: 0.13 }] },
      { wave: 'sq', duty: 0.25, f0: 400, f1: 900, dur: 0.24, vib: [28, 1.5], vol: 0.2 },
      { layers: [{ wave: 'saw', f0: 300, f1: 900, curve: 'exp', dur: 0.2, vol: 0.16, bits: 5 }, { wave: 'noise', f0: 5000, f1: 9000, dur: 0.2, vol: 0.14 }] },
    ],
    wave: [
      { wave: 'sq', duty: 0.5, f0: 1300, f1: 300, curve: 'exp', dur: 0.18, vib: [20, 0.5], vol: 0.2 },
      { layers: [{ wave: 'tri', f0: 1600, f1: 600, curve: 'exp', dur: 0.2, vol: 0.35 }, { wave: 'noise', f0: 9000, f1: 5000, dur: 0.08, vol: 0.12 }] },
      { wave: 'saw', f0: 400, f1: 1300, curve: 'exp', dur: 0.15, vol: 0.18, bits: 5 },
    ],
    orb: [
      { wave: 'sq', duty: 0.25, f0: 1400, f1: 1900, dur: 0.05, vol: 0.14 },
      { wave: 'tri', f0: 1000, f1: 1600, dur: 0.06, vol: 0.3 },
      { wave: 'sq', duty: 0.125, f0: 2000, f1: 1200, curve: 'exp', dur: 0.045, vol: 0.13 },
    ],
    charged: [
      { wave: 'sq', duty: 0.25, f0: 880, dur: 0.13, arp: [7, 0.05], vol: 0.18 },
      { wave: 'tri', f0: 1200, f1: 1700, dur: 0.11, vol: 0.32 },
      N('sq', [[988, 0.045], [1319, 0.08]], { duty: 0.25, vol: 0.16 }),
    ],
    hit: [
      { layers: [{ wave: 'noise', f0: 3000, f1: 800, curve: 'exp', dur: 0.07, vol: 0.3 }, { wave: 'sq', f0: 220, f1: 110, dur: 0.06, vol: 0.18 }] },
      { wave: 'noise', f0: 1600, f1: 500, curve: 'exp', dur: 0.07, vol: 0.35, bits: 4 },
      { wave: 'sq', duty: 0.5, f0: 320, f1: 80, curve: 'exp', dur: 0.08, vol: 0.26 },
    ],
    kill: [
      { layers: [{ wave: 'noise', f0: 2200, f1: 200, curve: 'exp', dur: 0.18, vol: 0.3 }, { wave: 'sq', f0: 420, f1: 80, curve: 'exp', dur: 0.15, vol: 0.16 }] },
      N('sq', [[440, 0.05], [330, 0.05], [220, 0.09]], { duty: 0.5, vol: 0.18 }),
      { wave: 'noise', f0: 1300, f1: 100, curve: 'exp', dur: 0.25, vol: 0.35, bits: 4 },
    ],
    hurt: [
      { wave: 'sq', duty: 0.5, f0: 320, f1: 100, curve: 'exp', dur: 0.18, vib: [22, 2], vol: 0.25 },
      { layers: [{ wave: 'saw', f0: 220, f1: 80, dur: 0.2, vol: 0.22, bits: 5 }, { wave: 'noise', f0: 2000, f1: 600, dur: 0.08, vol: 0.2 }] },
      { wave: 'sq', duty: 0.25, f0: 200, f1: 100, dur: 0.16, arp: [-5, 0.06], vol: 0.25 },
    ],
    block: [
      { wave: 'sq', duty: 0.125, f0: 2200, f1: 1800, dur: 0.06, vol: 0.18 },
      { layers: [{ wave: 'tri', f0: 1800, dur: 0.05, vol: 0.32 }, { wave: 'noise', f0: 12000, dur: 0.03, vol: 0.12 }] },
      N('sq', [[1500, 0.03], [1500, 0.04]], { duty: 0.25, vol: 0.15, gap: 1.6 }),
    ],
    guardBreak: [
      { layers: [{ wave: 'noise', f0: 4000, f1: 300, curve: 'exp', dur: 0.25, vol: 0.3 }, { wave: 'sq', f0: 600, f1: 150, curve: 'exp', dur: 0.2, vol: 0.16 }] },
      N('saw', [[784, 0.05], [392, 0.05], [196, 0.12]], { vol: 0.18, bits: 5 }),
      { layers: [{ wave: 'noise', f0: 2500, f1: 150, curve: 'exp', dur: 0.3, vol: 0.32, bits: 4 }, { wave: 'tri', f0: 320, f1: 100, dur: 0.25, vol: 0.3 }] },
    ],
    dash: [
      { wave: 'noise', f0: 2000, f1: 7000, curve: 'exp', dur: 0.1, vol: 0.22 },
      { wave: 'sq', duty: 0.25, f0: 300, f1: 700, curve: 'exp', dur: 0.08, vol: 0.16 },
      { wave: 'tri', f0: 200, f1: 800, curve: 'exp', dur: 0.1, vol: 0.35 },
    ],
    dodge: [
      N('sq', [[1047, 0.05], [1319, 0.05], [1568, 0.09]], { duty: 0.25, vol: 0.15 }),
      { wave: 'tri', f0: 800, f1: 2000, curve: 'exp', dur: 0.22, vib: [10, 0.6], vol: 0.32 },
      { wave: 'sq', duty: 0.125, f0: 1600, f1: 800, dur: 0.22, vib: [12, 1], vol: 0.15 },
    ],
    boom: [
      { wave: 'noise', f0: 1400, f1: 60, curve: 'exp', dur: 0.4, sus: 0.05, vol: 0.4, bits: 4 },
      { layers: [{ wave: 'noise', f0: 900, f1: 100, curve: 'exp', dur: 0.35, vol: 0.32 }, { wave: 'sq', f0: 130, f1: 40, curve: 'exp', dur: 0.3, vol: 0.2 }] },
      { wave: 'noise', f0: 600, f1: 40, curve: 'exp', dur: 0.5, vol: 0.4, bits: 3 },
    ],
    zap: [
      { layers: [{ wave: 'saw', f0: 2000, f1: 400, curve: 'exp', dur: 0.1, vol: 0.16, bits: 5 }, { wave: 'noise', f0: 9000, dur: 0.06, vol: 0.12 }] },
      { wave: 'sq', duty: 0.125, f0: 3000, f1: 900, curve: 'exp', dur: 0.09, vib: [60, 3], vol: 0.14 },
      { layers: [{ wave: 'noise', f0: 12000, f1: 5000, dur: 0.08, vol: 0.2 }, { wave: 'sq', duty: 0.25, f0: 1800, dur: 0.05, vol: 0.1 }] },
    ],
    freeze: [
      { wave: 'tri', f0: 2400, f1: 3200, dur: 0.13, arp: [5, 0.06], vol: 0.3 },
      { wave: 'sq', duty: 0.125, f0: 3000, f1: 2000, dur: 0.11, vib: [40, 0.5], vol: 0.12 },
      N('tri', [[2093, 0.04], [2637, 0.04], [3136, 0.07]], { vol: 0.28 }),
    ],
    shatter: [
      { layers: [{ wave: 'noise', f0: 14000, f1: 4000, curve: 'exp', dur: 0.12, vol: 0.25, bits: 5 }, { wave: 'tri', f0: 2200, f1: 1100, dur: 0.1, vol: 0.25 }] },
      { layers: [{ wave: 'sq', duty: 0.125, f0: 2600, f1: 600, curve: 'exp', dur: 0.1, vol: 0.14 }, { wave: 'noise', f0: 8000, dur: 0.06, vol: 0.18 }] },
      N('tri', [[3136, 0.03], [2637, 0.03], [2093, 0.03], [1568, 0.06]], { vol: 0.28 }),
    ],
    slam: [
      { layers: [{ wave: 'noise', f0: 700, f1: 50, curve: 'exp', dur: 0.35, vol: 0.38, bits: 4 }, { wave: 'sq', f0: 90, f1: 40, dur: 0.3, vol: 0.2 }] },
      { wave: 'tri', f0: 160, f1: 40, curve: 'exp', dur: 0.3, sus: 0.05, vol: 0.55 },
      { wave: 'noise', f0: 350, f1: 40, curve: 'exp', dur: 0.4, vol: 0.42 },
    ],
    lunge: [
      { wave: 'saw', f0: 120, f1: 240, dur: 0.15, vol: 0.18, bits: 5 },
      { wave: 'noise', f0: 1000, f1: 3500, curve: 'exp', dur: 0.12, vol: 0.22 },
      { wave: 'sq', duty: 0.5, f0: 100, f1: 200, dur: 0.12, vol: 0.18 },
    ],
    roar: [
      { layers: [{ wave: 'saw', f0: 95, f1: 60, dur: 0.6, vib: [8, 2], vol: 0.22, bits: 5 }, { wave: 'noise', f0: 300, f1: 200, dur: 0.6, vol: 0.18, bits: 4 }] },
      { wave: 'sq', duty: 0.5, f0: 130, f1: 70, dur: 0.5, vib: [6, 3], vol: 0.22 },
      { wave: 'noise', f0: 450, f1: 100, dur: 0.7, vol: 0.38, bits: 3 },
    ],
    totem: [
      N('sq', [[400, 0.07], [300, 0.07], [200, 0.07], [120, 0.16]], { duty: 0.5, vol: 0.18 }),
      { layers: [{ wave: 'noise', f0: 1500, f1: 80, curve: 'exp', dur: 0.5, vol: 0.32, bits: 4 }, N('tri', [[523, 0.08], [392, 0.08], [262, 0.16]], { vol: 0.3, delay: 0.05 })] },
      { wave: 'saw', f0: 600, f1: 60, curve: 'exp', dur: 0.5, vol: 0.2, bits: 4 },
    ],
    pickup: [
      { wave: 'sq', duty: 0.5, f0: 1320, dur: 0.03, vol: 0.12 },
      { wave: 'sq', duty: 0.25, f0: 880, f1: 1760, dur: 0.04, vol: 0.12 },
      { wave: 'tri', f0: 1200, dur: 0.035, vol: 0.28 },
    ],
    heal: [
      N('tri', [[660, 0.06], [880, 0.06], [1320, 0.12]], { vol: 0.3 }),
      { wave: 'sq', duty: 0.25, f0: 880, f1: 1320, dur: 0.25, vib: [10, 1], vol: 0.13 },
      N('sq', [[523, 0.05], [784, 0.05], [1047, 0.13]], { duty: 0.25, vol: 0.14 }),
    ],
    level: [
      N('sq', [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.18]], { duty: 0.5, vol: 0.15 }),
      N('sq', [[523, 0.04], [659, 0.04], [784, 0.04], [1047, 0.04], [1319, 0.12]], { duty: 0.25, vol: 0.14 }),
      N('tri', [[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.22]], { vol: 0.32 }),
    ],
    boon: [
      { layers: [N('tri', [[659, 0.08], [880, 0.08], [1175, 0.18]], { vol: 0.3 }), N('sq', [[659, 0.08], [880, 0.08], [1175, 0.18]], { duty: 0.125, vol: 0.06, delay: 0.03 })] },
      N('sq', [[784, 0.06], [988, 0.06], [1175, 0.06], [1568, 0.16]], { duty: 0.25, vol: 0.14 }),
      N('tri', [[1568, 0.04], [2093, 0.04], [2637, 0.04], [3136, 0.12]], { vol: 0.26 }),
    ],
    clear: [
      N('sq', [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]], { duty: 0.5, vol: 0.16 }),
      N('sq', [[784, 0.09], [784, 0.09], [784, 0.09], [1047, 0.36]], { duty: 0.25, vol: 0.15, gap: 1.15 }),
      { layers: [N('tri', [[523, 0.1], [784, 0.1], [1047, 0.1], [1568, 0.4]], { vol: 0.3 }), N('sq', [[262, 0.2], [392, 0.2], [523, 0.4]], { duty: 0.5, vol: 0.08 })] },
    ],
  };
})();
if (typeof module !== 'undefined') module.exports = SFX_CANDS;
