'use strict';
// ── 용사의 검: 난전형 · 빠른 3연타, 회전베기, 섬광 검기 ──
// 기본 축복 이름 · 설명은 검 기준이라 BOON_FORMS 가 없다 (다른 무기는 검 축복을 자기 모양으로 바꿔 쓴다)

const WAVE_AIM = { range: 340, half: AIM_HALF_ANGLE, moveHalf: 25 * Math.PI / 180 };

Object.assign(MOVES, {
light:    { mult: 1.0, kb: 220, guardBreak: false, role: 'basic', light: true },
finisher: { mult: 1.6, kb: 380, guardBreak: false, role: 'fin' },
thrust:   { mult: 1.7, kb: 260, guardBreak: true, role: 'dash' },
spin:     { mult: 2.2, kb: 320, guardBreak: true, role: 'charge' },
wave:     { mult: 1.8, kb: 160, guardBreak: false, role: 'special', light: true, ranged: true },
});

addWeapon('sword', {
  name: '용사의 검',
  style: '난전형 · 빠른 연타와 회전베기, 포위에 강함',
  essence: '무기의 정수',   // 숙련 강화 재화 (모든 무기 공통)
  unlockCost: 0,
  moves: { basic: '3연타', charged: '회전베기', special: '섬광 검기', dashAttack: '대시 찌르기' },
  chargeTime: 0.55,
  specialCd: 5.0,
  // 특수공격 쿨타임 감소: 거대 검기 레벨당 · 숙련 단계당 (초), 이 아래로는 안 내려간다
  cdPerLv: 0.6, cdPerMastery: 0.5, cdFloor: 1.5, // 거대 검기 레벨당 0.7 → 0.5 → 0.6 (2026-10-18)
  skillCd: 0,
  basic: (p, mag) => p.startAttack(mag),
  basicAfterDash: p => p.startThrust(),
  charged: (p, mag) => p.startSpin(mag),
  special: (p, mag) => p.castWave(mag),
  skill: null,
  // 기술표 (일시정지 화면)
  rows: (A, P, D) => [
    ['기본 · 3연타', `${A} ${A} ${A}`, '3타째는 넓고 강한 마무리'],
    ['차지 · 회전베기', `${A} 길게 눌렀다 떼기`, '주변 전체 · 가드 브레이크'],
    ['특수 · 섬광 검기', `${P} (쿨타임 5초)`, '관통하는 큰 검기'],
    ['대시', `${D} (쿨타임 ${DASH_CD}초)`, '짧은 무적 이동'],
    ['대시 찌르기', `${D} → ${A}`, '돌진 관통 · 가드 브레이크', 'thrust'],
    ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
    ['삼연 검기', `3타째 직후 ${P}`, '세 갈래 검기', 'triple'],
  ],
  shieldHint: '저 방패병은 정면 공격을 막아요! 공격을 길게 눌렀다 떼는 회전베기로 방패를 깨거나, 뒤로 돌아가서 공격해요.',
  // 무기 숙련 (마을에서 무기의 정수로 강화)
  mastery: [
    { id: 'combo',  name: '연속베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `3타째 피해 +${15 * lv}%` },
    { id: 'spin',   name: '회전베기 숙련',   max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 회전베기 범위 +${8 * lv}%` },
    { id: 'wave',   name: '섬광 검기 숙련',  max: 3, cost: [3, 5, 8], desc: lv => `섬광 검기 쿨타임 -${(0.5 * lv).toFixed(1)}초 (최소 1.5초)` },
    { id: 'thrust', name: '대시 찌르기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `대시 찌르기 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.sword, {
  draw: (p, g, x, y) => p.drawSword(g, x, y),
  dodgeText: '대시 · 검기 준비!',
  // 가상 패드 특수 버튼: 초승달 검기 (다른 무기가 그림을 안 정하면 이것)
  padIcon(b) { ctx.beginPath(); ctx.arc(b.x - b.r * 0.2, b.y, b.r * 0.45, -1, 1); ctx.stroke(); },
  // 축복 아이콘 동작 그림 (다른 무기가 안 정한 칸은 이것)
  glyph: {
    basic(g, s, line) { line(-0.6, 0.6, 0.75, -0.75); line(-0.55, 0.15, -0.15, 0.55); line(-0.8, 0.8, -0.55, 0.55); }, // 칼날 · 손잡이 가드
    charge(g, s, line) { // 회전 화살표
      g.beginPath(); g.arc(0, 0, 0.62 * s, -Math.PI * 0.15, Math.PI * 1.45); g.stroke();
      const a = -Math.PI * 0.15, ax = Math.cos(a) * 0.62 * s, ay = Math.sin(a) * 0.62 * s;
      g.beginPath(); g.moveTo(ax + 0.32 * s, ay - 0.1 * s); g.lineTo(ax - 0.05 * s, ay - 0.35 * s); g.lineTo(ax - 0.05 * s, ay + 0.2 * s); g.closePath(); g.fill();
    },
    special(g, s) { g.beginPath(); g.arc(-0.45 * s, 0, 0.95 * s, -0.95, 0.95); g.stroke(); g.lineWidth *= 0.6; g.beginPath(); g.arc(-0.8 * s, 0, 0.95 * s, -0.8, 0.8); g.stroke(); }, // 초승달 검기
  },
  // 검기에 맞았을 때의 속성 축복
  onSpecialHit(fx, t, info, atk) {

    const es = fx.lv('elec_special');
    if (es) fx.skyBolt(t, atk * (0.8 + 0.4 * es));
    const fs = fx.lv('fire_special');
    if (fs && !t.dead) fx.explode(t.x, t.y, 50, atk * (0.6 + 0.3 * fs), '#ff7a3c', true);
    const is = fx.lv('ice_special');
    if (is && !t.dead) fx.chill(t, iceBig(is));
    const pspc = fx.lv('poison_special');
    if (pspc && !t.dead) fx.poison(t, 1 + pspc);
    const hw = fx.lv('heal_wave'), p = G.player;
    const cast = info.src && info.src.cast; // 검기를 한 번 쏠 때 처음 맞힌 적에서만 (여러 마리 · 삼연 검기여도 한 번, 2026-10-17)
    if (hw && p.alive && cast && !cast.healed) { cast.healed = true; p.hp = Math.min(p.maxHp, p.hp + 0.5 + 0.5 * hw); }
  },
});

extendPlayer({
  startAttack(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.aim(mag);
    const fin = this.combo === 2;
    this.act = {
      kind: fin ? 'finisher' : 'light', t: 0, dur: fin ? 0.22 : 0.15, hit: new Set(),
      range: fin ? 46 : 37, half: fin ? 1.4 : 1.05, swingDir: this.combo === 1 ? -1 : 1,
    };
    this.act.noStep = mag < STEP_MIN || this.enemyInReach(this.act.range, this.act.half);
    this.atkCd = (fin ? 0.42 : 0.24) * (1 - COMBO_SPEED * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    this.finisherT = fin ? 0.6 : 0; // 이 안에 바로 특수공격 → 삼연 검기 (다른 행동을 하면 끊긴다)
    this.atkBuffer = 0;
    Sfx.swing(fin);
    FX.onSwing(this, fin);
  },
  startThrust() {
    this.finisherT = 0;
    this.aim(Math.hypot(Input.state.mx, Input.state.my));
    this.act = { kind: 'thrust', t: 0, dur: 0.22, hit: new Set() };
    this.atkCd = 0.35; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '대시 찌르기', '#9cdcff', 11, 0.5);
    Sfx.thrust();
  },
  startSpin(mag) {
    this.finisherT = 0;
    this.aim(mag);
    const ms = FX.lv('atk_multispin'); // 회전 연참: 레벨마다 한 바퀴 더 (조금 길어진다)
    this.act = { kind: 'spin', t: 0, dur: 0.36 + 0.06 * ms, hit: new Set(), hits: 1 + ms, wave: 0 };
    this.atkCd = 0.4; this.charge = 0; this.comboT = 0;
    this.invuln = Math.max(this.invuln, 0.15);
    G.text(this.x, this.y - 24, ms ? `회전베기 ×${1 + ms}` : '회전베기', '#ffd24a', 12, 0.6);
    Sfx.spin();
    FX.onSpin(this);
  },
  // 섬광 검기: 관통하는 큰 검기 (3타째 직후엔 세 갈래)
  castWave(mag) {
    this.aim(mag, WAVE_AIM);
    const triple = this.finisherT > 0 && G.has('triple');
    const dirs = triple ? [-0.35, 0, 0.35] : [0];
    const cast = { healed: false }; // 치유의 검기: 한 번 쏠 때 한 번만 (삼연 검기 세 갈래도 함께)
    for (const o of dirs) { const w = new Wave(this.x, this.y - 2, this.facing + o, triple); w.cast = cast; G.projectiles.push(w); }
    if (triple) G.text(this.x, this.y - 24, '삼연 검기!', '#7fe0ff', 13, 0.7);
    this.finisherT = 0;
    this.act = { kind: 'cast', t: 0, dur: 0.16, hit: new Set() };
    Sfx.wave(triple);
  },
  get spinRange() { return 56 * (1 + 0.15 * FX.lv('atk_spin') + 0.08 * this.mastery('spin')); },
  drawSword(g, x, y) {
    const cy = y - 1, a = this.act;
    if (a && (a.kind === 'light' || a.kind === 'finisher')) {
      const p = a.t / a.dur, e = 1 - Math.pow(1 - p, 3);
      const a0 = this.facing - a.half * a.swingDir, a1 = this.facing + a.half * a.swingDir;
      const ang = a0 + (a1 - a0) * e;
      this.blade(g, x, cy, ang);
      // 베기 이펙트 (32x32 프레임 4장)
      const fin = a.kind === 'finisher', k = fin ? 2.6 : 2.1, d = fin ? 20 : 16;
      g.save();
      g.translate(x + Math.cos(this.facing) * d, cy + Math.sin(this.facing) * d);
      g.rotate(this.facing);
      if (a.swingDir < 0) g.scale(1, -1);
      g.globalAlpha *= 0.95;
      const bs = ElFx.slot('basic'), img = bs ? ElFx.tinted(ART.img.slash, bs.el) : ART.img.slash, fr = Math.min(3, Math.floor(p * 4)) * 32;
      if (bs && bs.max) { const a0 = g.globalAlpha; g.globalAlpha = a0 * 0.35; g.drawImage(img, fr, 0, 32, 32, -19 * k, -19 * k, 38 * k, 38 * k); g.globalAlpha = a0; }
      g.drawImage(img, fr, 0, 32, 32, -16 * k, -16 * k, 32 * k, 32 * k);
      g.restore();
      if (bs && Math.random() < 0.6) ElFx.spark(bs, x + Math.cos(ang) * 24, cy + Math.sin(ang) * 24);
    } else if (a && a.kind === 'spin') {
      const p = a.t / a.dur, ang = this.facing + p * Math.PI * 2.2;
      const sr = this.spinRange, cs = ElFx.slot('charge');
      if (cs) {
        ElFx.arc(g, cs, x, cy, sr - 12, ang - 2.4, ang, 10, 0.65 * (1 - p));
        if (Math.random() < 0.8) ElFx.spark(cs, x + Math.cos(ang) * (sr - 12), cy + Math.sin(ang) * (sr - 12), 2);
      } else {
        g.strokeStyle = `rgba(255,220,120,${0.6 * (1 - p)})`; g.lineWidth = 10;
        g.beginPath(); g.arc(x, cy, sr - 12, ang - 2.4, ang); g.stroke();
      }
      this.blade(g, x, cy, ang);
    } else if (a && a.kind === 'thrust') {
      const p = a.t / a.dur;
      const ds = ElFx.slot('dash');
      g.fillStyle = ds ? ElFx.rgba(ds.el, (ds.max ? 0.65 : 0.5) * (1 - p)) : `rgba(156,220,255,${0.5 * (1 - p)})`;
      const c = Math.cos(this.facing), s = Math.sin(this.facing);
      if (ds && Math.random() < 0.7) ElFx.spark(ds, x + c * rand(10, 50), cy + s * rand(10, 50));
      g.beginPath(); g.moveTo(x - s * 8, cy + c * 8); g.lineTo(x + c * 54, cy + s * 54); g.lineTo(x + s * 8, cy - c * 8); g.closePath(); g.fill();
      this.blade(g, x, cy, this.facing);
    } else {
      this.blade(g, x + Math.cos(this.facing) * 4, cy + 6, this.facing + 1.1);
    }
  },
  // 도트 검 (칼끝이 위를 향한 그림을 각도에 맞춰 돌린다)
  blade(g, x, y, a) {
    const im = ART.img.sword, w = im.width * PIX, h = im.height * PIX;
    g.save();
    g.translate(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    g.rotate(a + Math.PI / 2);
    g.drawImage(im, -w / 2, -h + 6, w, h);
    g.restore();
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
    if (a.kind === 'light' || a.kind === 'finisher') {
      if (a.t < a.dur * 0.5 && !a.noStep && this.inMag >= STEP_MIN) World.move(this, fx * 130 * dt, fy * 130 * dt);
      this.hitArc(a, a.range, a.half);
    } else if (a.kind === 'thrust') {
      const sp = 300 * (1 + 0.15 * FX.lv('atk_thrust'));
      World.move(this, fx * sp * dt, fy * sp * dt);
      this.hitLine(a, 46, 15);
    } else if (a.kind === 'spin') {
      const hits = a.hits || 1, k = Math.min(hits - 1, Math.floor(a.t / a.dur * hits));
      if (k !== a.wave) { a.wave = k; a.hit = new Set(); Sfx.spin(); } // 다음 타격: 같은 적을 다시 벤다
      // 추가 타격은 피해 절반, 넉백은 마지막 타격에만 (적이 밀려나 다음 타격을 놓치지 않게)
      a.opts = { mult: k === 0 ? 1 : MULTISPIN_MULT, kb: k < hits - 1 ? 40 : undefined };
      this.hitArc(a, this.spinRange, Math.PI);
    }
});

// 검기: 관통하는 초승달 모양 투사체
class Wave {
  constructor(x, y, dir, small) {
    const big = 1 + 0.25 * FX.lv('atk_wave');
    this.x = x; this.y = y; this.dir = dir; this.life = (small ? 0.6 : 0.75) * big;
    this.max = this.life; this.hit = new Set(); this.done = false; this.size = (small ? 16 : 22) * big;
  }
  update(dt) {
    const c = Math.cos(this.dir), s = Math.sin(this.dir);
    this.x += c * 360 * dt; this.y += s * 360 * dt;
    this.life -= dt;
    if (this.life <= 0) this.done = true;
    if (World.shotBlockedAt(this.x, this.y + 6)) { this.done = true; G.burst(this.x, this.y, 8, ['#bff4ff', '#fff'], 120); return; } // 나무 · 바위에 막힌다 (물 위로는 날아간다)
    FX.onWaveMove(this);
    clearShotsNear(this.x, this.y, this.size);
    for (const t of G.targets()) {
      if (this.hit.has(t)) continue;
      if (Math.hypot(t.x - this.x, t.y - this.y) < t.r + this.size * 0.8) {
        this.hit.add(t);
        G.player.deal(t, 'wave', c, s, { src: this });
      }
    }
  }
  draw(g) {
    g.globalAlpha = clamp(this.life / this.max * 2, 0, 1);
    g.lineCap = 'round';
    const ss = ElFx.slot('special'), ox = this.x - Math.cos(this.dir) * 8, oy = this.y - Math.sin(this.dir) * 8;
    if (ss) {
      ElFx.arc(g, ss, ox, oy, this.size, this.dir - 1.1, this.dir + 1.1, 8, 0.6);
      if (Math.random() < 0.7) { const a = this.dir + rand(-1, 1); ElFx.spark(ss, ox + Math.cos(a) * this.size, oy + Math.sin(a) * this.size); }
    } else {
      g.strokeStyle = 'rgba(127,224,255,0.5)'; g.lineWidth = 8;
      g.beginPath(); g.arc(ox, oy, this.size, this.dir - 1.1, this.dir + 1.1); g.stroke();
    }
    g.strokeStyle = ss ? EL_STYLE[ss.el].light : '#fff'; g.lineWidth = 3;
    g.beginPath(); g.arc(this.x - Math.cos(this.dir) * 8, this.y - Math.sin(this.dir) * 8, this.size, this.dir - 1, this.dir + 1); g.stroke();
    g.globalAlpha = 1;
  }
}
