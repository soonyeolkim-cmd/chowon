'use strict';
// ── 정령의 마법봉: 마법형 · 약한 2연타, 마력 구슬 탄창 · 연사, 마법진, 마력 파동 ──

// 마법봉 수치 (2026-10-17)
const ORB_BASE = 3;             // 마력 구슬 기본 최대 개수 (마력 증폭 레벨마다 +1)
const ORB_RECHARGE = 0.5;       // 구슬 1개 충전 시간 (1.0 → 0.4 → 0.5, 2026-10-17)
const ORB_INTERVAL = 0.12;      // 누르고 있을 때 연사 간격
const ORB_REFUND = 0.25;        // 기본공격이 맞으면 충전이 이만큼 빨라진다
const ORB_RANGE = 136;          // 마력탄 사거리 (220 → 170 → 136, 2026-10-17)
const STAFF_REACH = 34;         // 마법봉 휘두르기 사거리
const CIRCLE_R = 55;            // 마법진 반경
const CIRCLE_DELAY = 0.5;       // 마법진이 터지기까지
const PULSE_R = 50;             // 마력 파동 반경
const STAFF_FIRE_EVERY = 4; // 화염구 마력탄: 이 발수마다 화염구
const ORB_AIM = { range: 136, half: AIM_HALF_ANGLE, moveHalf: 25 * Math.PI / 180 };

Object.assign(MOVES, {
// 마법봉: 기본공격은 약하고, 마력탄 한 발도 약하지만 여러 발을 쏟아 낸다
bonk:    { mult: 0.8, kb: 160, guardBreak: false, role: 'basic', light: true, orbRefund: true },
bonkFin: { mult: 1.2, kb: 300, guardBreak: true, role: 'fin', orbRefund: true },    // 2타째
orb:     { mult: 0.8, kb: 60, guardBreak: false, role: 'special', light: true, ranged: true },    // 마력탄 한 발 (0.6 → 0.8, 2026-10-17)
circle:  { mult: 2.4, kb: 260, guardBreak: true, role: 'charge' },    // 마법진 폭발 (차지)
pulse:   { mult: 1.0, kb: 340, guardBreak: false, role: 'dash' },   // 마력 파동 (대시 공격)
});

// 마법봉: 기본공격은 약하지만 마력 구슬을 모아 쏜다. 키울수록 구슬이 늘어 난사가 된다 (2026-10-17)
// 특수공격은 쿨타임 대신 탄창(마력 구슬). specialCd 는 연사 간격으로만 쓴다
addWeapon('staff', {
  name: '정령의 마법봉',
  style: '마법형 · 기본공격은 약하지만 마력 구슬을 모아 난사, 키울수록 탄막',
  essence: '무기의 정수',
  unlockCost: 1,             // 영웅의 증표 1개 (2026-10-17)
  moves: { basic: '2연타', charged: '마법진', special: '마력탄', dashAttack: '마력 파동' },
  chargeTime: 0.55,
  specialCd: 0.12,     // = ORB_INTERVAL (아래 상수는 이 표보다 뒤에 있어서 숫자로)
  cdPerLv: 0, cdPerMastery: 0, cdFloor: 0.12,
  notesTitle: '마법봉 특성 · 마력 구슬',
  notes: [
    '마력 구슬은 마력탄의 탄창이에요. 캐릭터 머리 위에 떠서 도는 구슬로 보여요.',
    '충전: 기본 3개까지, 0.5초마다 1개씩 차요. 휘두르기가 적에게 맞으면 충전이 0.25초 빨라져요.',
    '쏘기: 특수 버튼을 누르면 구슬 1개로 마력탄 1발. 누르고 있으면 구슬이 남는 만큼 연달아 쏴요.',
    '성장: 마력 증폭 축복(레벨마다)과 마력탄 숙련(단계마다)으로 최대 개수가 1개씩 늘어요. 다 키우면 9개. 속성 축복은 구슬 한 발 한 발에 붙어요.',
    '저스트 회피에 성공하면 구슬이 가득 차요.',
  ],
  orbs: true,          // 마력 구슬을 쓰는 무기
  holdSpecial: true,   // 특수 버튼을 누르고 있으면 연사
  comboLen: 2,
  skillCd: 0,
  basic: (p, mag) => p.startBonk(mag),
  basicAfterDash: p => p.startPulse(),
  charged: (p, mag) => p.startCircle(mag),
  special: (p, mag) => p.castOrb(mag),
  skill: null,
  rows: (A, P, D) => [
    ['기본 · 2연타', `${A} ${A}`, '약하고 짧다 · 맞힐 때마다 구슬 충전이 빨라짐'],
    ['마력 구슬', `최대 ${ORB_BASE}개 · ${ORB_RECHARGE}초마다 1개`, '머리 위에 떠 있는 탄창 · 마력 증폭 축복으로 늘어난다'],
    ['특수 · 마력탄', `${P} (누르고 있으면 연사)`, '구슬 1개로 살짝 유도되는 마력탄 · 사거리 136'],
    ['차지 · 마법진', `${A} 길게 눌렀다 떼기`, '앞쪽(가까운 적 발밑)에 마법진 · 0.5초 뒤 폭발'],
    ['대시', `${D} (쿨타임 ${DASH_CD}초)`, '짧은 무적 이동'],
    ['마력 파동', `${D} → ${A}`, '주변을 크게 밀어낸다', 'thrust'],
    ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타 + 구슬 가득', 'dodge'],
    ['삼연 마력탄', `2타째 직후 ${P}`, '구슬 1개로 세 발이 부채꼴로', 'triple'],
  ],
  shieldHint: '저 방패병은 정면 공격을 막아요! 2타째 휘두르기나 마법진은 방패를 깨요. 마력탄으로 등 뒤를 노려도 돼요.',
  mastery: [
    { id: 'combo',  name: '휘두르기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `2타째 피해 +${15 * lv}%` },
    { id: 'spin',   name: '마법진 숙련',     max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 마법진 범위 +${8 * lv}%` },
    { id: 'wave',   name: '마력탄 숙련',     max: 3, cost: [3, 5, 8], desc: lv => `마력 구슬 최대 개수 +${lv}` },
    { id: 'thrust', name: '마력 파동 숙련',  max: 3, cost: [2, 4, 7], desc: lv => `마력 파동 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.staff, {
  draw: (p, g, x, y) => p.drawStaff(g, x, y),
  dodgeText: '대시 · 구슬 가득!',
  enhanceSlot: 'special', // 강화 축복(연쇄 번개 · 화염구 …)과 번개 감전 강화가 기본공격 대신 특수(마력탄)에 붙는다
  padIcon(b, p) { // 마력탄: 구슬 안에 남은 구슬 개수
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); ctx.stroke();
    label(String(p.orbs), b.x, b.y + 1, Math.round(b.r * 0.5), p.orbs ? '#bff4ff' : '#ff9a7a', 'center', '900');
  },
  glyph: {
    basic(g, s, line) { line(-0.7, 0.7, 0.45, -0.45); g.beginPath(); g.arc(0.6 * s, -0.6 * s, 0.25 * s, 0, Math.PI * 2); g.fill(); }, // 마법봉
    plus(g, s, line) { // 강화 축복: 마력탄 + 더하기
      for (const [ox, oy, r] of [[-0.45, 0.35, 0.3], [0.1, -0.1, 0.3], [-0.6, -0.5, 0.22]]) { g.beginPath(); g.arc(ox * s, oy * s, r * s, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = Math.max(1.5, s * 0.2); line(0.35, 0.45, 0.85, 0.45); line(0.6, 0.2, 0.6, 0.7);
    },
    charge(g, s) { g.beginPath(); g.ellipse(0, 0.1 * s, 0.85 * s, 0.6 * s, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(0, 0.1 * s, 0.45 * s, 0.3 * s, 0, 0, Math.PI * 2); g.stroke(); }, // 마법진
    special(g, s) { for (const [ox, oy, r] of [[-0.45, 0.35, 0.3], [0.1, -0.1, 0.3], [0.55, -0.5, 0.22]]) { g.beginPath(); g.arc(ox * s, oy * s, r * s, 0, Math.PI * 2); g.fill(); } }, // 마력탄 셋
  },
});
// 마법봉: 기본 = 2연타, 차지 = 마법진, 특수 = 마력탄(구슬마다), 대시 공격 = 마력 파동
BOON_FORMS.staff = {
  fire_basic:     { name: '불꽃 마법봉' },
  fire_bolt:      { name: '화염구 마력탄', needs: 'fire_special', desc: lv => `마력탄 ${STAFF_FIRE_EVERY}발마다 큰 화염구가 함께 날아가 폭발한다 (공격력의 ${pct(0.8 + 0.3 * lv)} + 화상).` },
  fire_charge:    { name: '화염 마법진', desc: lv => `마법진 폭발에 맞은 적에게 화상 2중첩, 그 자리에 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  fire_special:   { name: '화염 마력탄', desc: lv => `마력탄이 맞으면 작게 폭발한다 (주변에 공격력의 ${pct(0.25 + 0.1 * lv)} + 화상).` },
  ice_basic:      { name: '서리 마법봉' },
  ice_shard:      { name: '얼음 파편 마력탄', needs: 'ice_special', desc: lv => `마력탄이 맞으면 얼음 파편 ${1 + lv}개가 사방으로 튄다 (공격력의 ${pct(0.2 + 0.05 * lv)} + 냉기 1중첩).` },
  ice_charge:     { name: '빙결 마법진', desc: lv => `마법진 폭발에 맞은 적에게 냉기 ${iceBig(lv)}중첩.` },
  ice_special:    { name: '서리 마력탄', desc: lv => `마력탄에 맞은 적에게 냉기 ${lv >= 3 ? 2 : 1}중첩.` },
  elec_basic:     { name: '번개 마법봉' },
  elec_chain:     { name: '연쇄 마력탄', needs: 'elec_special', desc: lv => `마력탄이 맞으면 번개가 옆 적에게 ${1 + lv}번 튄다 (한 번에 공격력의 ${pct(0.25 + 0.1 * lv)}) + 감전.` },
  poison_spray:   { name: '독 웅덩이 마력탄', needs: 'poison_special', desc: lv => `마력탄이 맞은 자리에 ${1 + 0.5 * lv}초간 독 웅덩이가 남는다.` },
  elec_charge:    { name: '뇌전 마법진', desc: lv => `마법진이 터진 자리 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  elec_special:   { name: '뇌격 마력탄', desc: lv => `마력탄이 감전시킨다. 감전된 적은 4초 동안 받는 피해 +${20 + 10 * (lv - 1)}%. (번개가 튀는 건 연쇄 마력탄)` },
  poison_basic:   { name: '독 마법봉' },
  poison_charge:  { name: '독안개 마법진', desc: lv => `마법진이 터진 자리에 ${2 + 0.5 * lv}초간 독안개. 안에 있는 적에게 계속 독.` },
  poison_special: { name: '독 마력탄', desc: lv => `마력탄에 맞은 적에게 독 ${1 + Math.floor(lv / 2)}중첩.` },
  atk_combo:      { name: '연속 휘두르기', desc: lv => `기본공격 속도 +${15 * lv}%, 2타째 피해 +${30 * lv}%.` },
  atk_spin:       { name: '마법진 강화', desc: lv => `차지 시간 -${15 * lv}%, 마법진 범위 +${15 * lv}%.` },
  atk_multispin:  { name: '연쇄 마법진', desc: lv => `마법진이 터진 뒤 주변에 작은 마법진 ${lv}개가 이어서 터진다 (피해 ${pct(MULTISPIN_MULT)}).` },
  atk_wave:       { name: '마력 증폭', desc: lv => `마력 구슬 최대 개수 +${lv} (기본 ${ORB_BASE}개).` },
  atk_thrust:     { name: '마력 파동 강화', desc: lv => `마력 파동 피해 +${40 * lv}%, 범위 +${10 * lv}%.` },
  sharp:          { name: '예리한 마력' },
  lifesteal:      { name: '흡혈 마법봉' },
  guard_spin:     { name: '수호의 마법진', desc: lv => `마법진을 그릴 때 잠깐 무적, 그 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  heal_wave:      { name: '치유의 마력탄', desc: lv => `마력탄이 적에게 맞을 때마다 체력 ${+(0.1 + 0.1 * lv).toFixed(1)} 회복.` },
};

extendPlayer({
  // 최대 구슬: 기본 + 마력 증폭 축복 레벨 + 마력탄 숙련 단계 (2026-10-17: 숙련은 충전 시간 → 최대 개수)
  get orbMax() { return this.weapon.orbs ? ORB_BASE + FX.lv('atk_wave') + this.mastery('wave') : 0; },
  get orbRecharge() { return ORB_RECHARGE; },
  // ── 마법봉 ──
  // 2연타: 약하고 짧다. 맞히면 마력 구슬 충전이 빨라진다
  startBonk(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 2 : 0;
    this.aim(mag);
    const fin = this.combo === 1;
    this.act = { kind: fin ? 'bonkFin' : 'bonk', t: 0, dur: fin ? 0.2 : 0.16, hit: new Set(), range: STAFF_REACH * (fin ? 1.1 : 1), half: fin ? 1.2 : 1.0, swingDir: fin ? -1 : 1 };
    this.act.noStep = mag < STEP_MIN || this.enemyInReach(this.act.range, this.act.half);
    this.atkCd = (fin ? 0.42 : 0.28) * (1 - 0.15 * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    this.finisherT = fin ? 0.6 : 0; // 이 안에 바로 특수공격 → 삼연 마력탄
    this.atkBuffer = 0;
    Sfx.swing(fin);
    FX.onSwing(this, fin);
  },
  // 마력탄: 구슬 1개를 써서 살짝 유도되는 탄을 쏜다 (누르고 있으면 연사)
  castOrb(mag) {
    this.aim(mag, ORB_AIM);
    const triple = this.finisherT > 0 && G.has('triple');
    const dirs = triple ? [-0.3, 0, 0.3] : [this.specialBuffer > 0 ? 0 : rand(-0.06, 0.06)];
    for (const o of dirs) G.projectiles.push(new MagicOrb(this, this.facing + o));
    this.orbs--; this.specialBuffer = 0;
    FX.onOrbCast(this);
    if (triple) G.text(this.x, this.y - 24, '삼연 마력탄!', '#7fe0ff', 13, 0.7);
    this.finisherT = 0;
    this.act = { kind: 'cast', t: 0, dur: 0.1, hit: new Set(), orbCast: true };
    Sfx.orb();
  },
  // 마법진 (차지): 앞쪽(가까운 적 발밑)에 깔고 잠시 뒤 폭발
  get circleR() { return CIRCLE_R * (1 + 0.15 * FX.lv('atk_spin') + 0.08 * this.mastery('spin')); },
  startCircle(mag) {
    this.finisherT = 0;
    this.aim(mag, ORB_AIM);
    const t = this.aimTarget && !this.aimTarget.dead && Math.hypot(this.aimTarget.x - this.x, this.aimTarget.y - this.y) < 150 ? this.aimTarget : null;
    const cx = t ? t.x : this.x + Math.cos(this.facing) * 80, cy = t ? t.y : this.y + Math.sin(this.facing) * 80;
    G.projectiles.push(new MagicCircle(cx, cy, this.circleR, FX.lv('atk_multispin')));
    this.act = { kind: 'cast', t: 0, dur: 0.25, hit: new Set(), circleCast: true };
    this.atkCd = 0.4; this.charge = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '마법진', '#ffd24a', 12, 0.6);
    Sfx.charged();
    FX.onCircleCast(this);
  },
  // 마력 파동 (대시 직후 공격): 내 주변을 크게 밀어낸다
  get pulseR() { return PULSE_R * (1 + 0.1 * FX.lv('atk_thrust')); },
  startPulse() {
    this.finisherT = 0;
    this.act = { kind: 'pulse', t: 0, dur: 0.22, hit: new Set() };
    this.atkCd = 0.4; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    this.hitArc(this.act, this.pulseR, Math.PI);
    G.fxRing(this.x, this.y, '#cfe8ff', this.pulseR);
    G.text(this.x, this.y - 24, '마력 파동', '#9cdcff', 11, 0.5);
    Sfx.wave(false);
  },
  // 마법봉: 휘두르기 · 마력탄 쏘기 · 마법진 · 머리 위 마력 구슬
  drawStaff(g, x, y) {
    const cy = y - 1, a = this.act, f = this.facing, c = Math.cos(f), s = Math.sin(f);
    if (a && (a.kind === 'bonk' || a.kind === 'bonkFin')) {
      const pr = a.t / a.dur, e = 1 - Math.pow(1 - pr, 3);
      const a0 = f - a.half * a.swingDir, ang = a0 + 2 * a.half * a.swingDir * e;
      const bs = ElFx.slot('basic');
      if (bs) ElFx.arc(g, bs, x, cy, a.range - 8, Math.min(a0, ang), Math.max(a0, ang), 3, 0.6 * (1 - pr));
      else { g.strokeStyle = `rgba(207,232,255,${0.5 * (1 - pr)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, cy, a.range - 8, Math.min(a0, ang), Math.max(a0, ang)); g.stroke(); }
      wandSprite(g, x, cy, ang, 4);
    } else if (a && a.kind === 'cast' && a.orbCast) {
      wandSprite(g, x, cy, f, 6);
      const tx = x + c * 22, ty = cy + s * 22 - 4, ss = ElFx.slot('special');
      g.fillStyle = ss ? ElFx.rgba(ss.el, 0.6) : 'rgba(170,240,255,0.6)'; g.beginPath(); g.arc(tx, ty, 5 * (1 - a.t / a.dur) + 2, 0, Math.PI * 2); g.fill();
    } else if (a && a.kind === 'cast' && a.circleCast) {
      wandSprite(g, x + 2, cy - 4, -Math.PI / 2 + 0.25, 2); // 높이 든다
    } else if (a && a.kind === 'pulse') {
      const pr = a.t / a.dur;
      wandSprite(g, x, cy, -Math.PI / 2, 2);
      const ds = ElFx.slot('dash');
      if (ds) ElFx.arc(g, ds, x, cy, this.pulseR * pr, 0, Math.PI * 2, 4, 0.8 * (1 - pr));
      else { g.strokeStyle = `rgba(207,232,255,${0.8 * (1 - pr)})`; g.lineWidth = 4; g.beginPath(); g.arc(x, cy, this.pulseR * pr, 0, Math.PI * 2); g.stroke(); }
    } else wandSprite(g, x + c * 3, cy + 5, f + 0.9, -2);
    // 마력 구슬: 머리 위에 떠서 천천히 돈다 (빈 자리는 흐리게, 차오르는 자리는 커지며)
    const n = this.orbMax;
    for (let i = 0; i < n; i++) {
      const q = G.time * 1.6 + i / n * Math.PI * 2, bx = x + Math.cos(q) * 11, by = y - 27 + Math.sin(q) * 3;
      const ss = ElFx.slot('special'), col = ss ? EL_STYLE[ss.el].main : '#7fe0ff';
      if (i < this.orbs) {
        g.fillStyle = ss ? ElFx.rgba(ss.el, 0.3) : 'rgba(127,224,255,0.3)'; g.beginPath(); g.arc(bx, by, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(bx, by, 2.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(bx - 0.7, by - 0.7, 0.9, 0, Math.PI * 2); g.fill();
      } else {
        const k = i === this.orbs ? 1 - clamp(this.orbT / this.orbRecharge, 0, 1) : 0;
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(bx, by, 2.2, 0, Math.PI * 2); g.fill();
        if (k > 0) { g.fillStyle = 'rgba(127,224,255,0.7)'; g.beginPath(); g.arc(bx, by, 2.2 * k, 0, Math.PI * 2); g.fill(); }
      }
    }
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
    if (a.kind === 'bonk' || a.kind === 'bonkFin') {
      if (a.t < a.dur * 0.5 && !a.noStep && this.inMag >= STEP_MIN) World.move(this, fx * 90 * dt, fy * 90 * dt);
      this.hitArc(a, a.range, a.half);
      return true;
    }
    if (a.kind === 'pulse') return true;
});

Object.assign(FX, {
  // ── 마법봉 ──
  // 마력탄 한 발이 맞았을 때 (구슬이 많으니 한 발의 속성 효과는 작게)
  onOrbHit(t) {
    const atk = G.player.atk;
    const fs = this.lv('fire_special');
    if (fs && !t.dead) { this.burn(t, 1); for (const e of this.near(t.x, t.y, 30, t)) { this.burn(e, 1); this.damage(e, atk * (0.25 + 0.1 * fs), '#ff9a4a', 10); } G.burst(t.x, t.y, 6, ['#ff7a3c', '#ffd24a'], 110); }
    const is = this.lv('ice_special');
    if (is && !t.dead) this.chill(t, is >= 3 ? 2 : 1);
    if (this.lv('elec_special')) this.shock(t); // 뇌격 마력탄: 감전만 (번개가 튀는 건 연쇄 마력탄 몫, 2026-10-17)
    const ps = this.lv('poison_special');
    if (ps && !t.dead) this.poison(t, 1 + Math.floor(ps / 2));
    const hw = this.lv('heal_wave'), p = G.player;
    if (hw && p.alive) p.hp = Math.min(p.maxHp, p.hp + 0.1 + 0.1 * hw); // 한 발 0.2 · 0.3 · 0.4 (2026-10-17)
    // ── 마력탄 강화 축복 (특수 슬롯이 있어야 나온다) ──
    const ch = this.lv('elec_chain');
    if (ch) this.chainJump(t, 1 + ch, atk * (0.25 + 0.1 * ch)); // 연쇄 마력탄
    const isd = this.lv('ice_shard');
    if (isd) { // 얼음 파편 마력탄: 사방으로
      const n = 1 + isd, a0 = rand(0, Math.PI * 2);
      for (let i = 0; i < n; i++) G.projectiles.push(new FxShot(t.x, t.y - 4, a0 + i / n * Math.PI * 2, {
        kind: 'ice', speed: 300, life: 0.35, r: 5, pierce: true, hit: new Set([t]),
        onHit: e => { if (e === t) return; this.chill(e, 1); this.damage(e, atk * (0.2 + 0.05 * isd), '#bfefff', 10); },
      }));
    }
    const psp = this.lv('poison_spray');
    if (psp) this.zone(t.x, t.y + 4, 'poison', 1 + 0.5 * psp); // 독 웅덩이 마력탄
  },
  // 마력탄을 쏠 때: 화염구 마력탄 (몇 발마다 큰 화염구)
  onOrbCast(p) {
    const fb = this.lv('fire_bolt');
    if (!fb) return;
    p.orbShots = (p.orbShots || 0) + 1;
    if (p.orbShots % STAFF_FIRE_EVERY) return;
    const atk = p.atk;
    G.projectiles.push(new FxShot(p.x, p.y - 4, p.facing, {
      kind: 'fire', speed: 240, life: 0.9, r: 8, pierce: false,
      onHit: t => this.explode(t.x, t.y, 50, atk * (0.8 + 0.3 * fb), '#ff7a3c', true),
    }));
    Sfx.boom();
  },
  // 마법진을 그릴 때: 수호의 마법진
  onCircleCast(p) {
    const gs = this.lv('guard_spin');
    if (gs) { p.invuln = Math.max(p.invuln, 0.3); p.spinGuardT = 0.3 + 0.5 + 0.5 * gs; }
  },
  // 마법진이 터졌을 때: 불길 · 독안개 · 낙뢰
  onCircle(p, x, y, r) {
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (fc || pc) {
      if (pc) this.zone(x, y + 4, 'poison', 2 + 0.5 * pc);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, d = r * 0.55;
        if (fc) this.zone(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 + 4, 'fire', 1.5 + 0.5 * fc);
        if (pc) this.zone(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 + 4, 'poison', 2 + 0.5 * pc);
      }
    }
    const ec = this.lv('elec_charge');
    if (ec) {
      const list = this.near(x, y, r + 50).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
    }
  },
});

// 창 그림: 손잡이 위치(x, y)에서 각도 a 로, ext 만큼 앞으로 내민다
// 마법봉 하나: 끝(보석)이 a 방향을 향하게
function wandSprite(g, x, y, a, ext) {
  const im = ART.img.wand, w = im.width * PIX, h = im.height * PIX;
  g.save();
  g.translate(x + Math.cos(a) * ext, y + Math.sin(a) * ext);
  g.rotate(a + Math.PI / 2);
  g.drawImage(im, -w / 2, -h + 8, w, h);
  g.restore();
}

// 마력탄: 살짝 유도되며 날아가 처음 닿은 적에게 맞는다
class MagicOrb {
  constructor(p, dir) {
    this.x = p.x + Math.cos(dir) * 14; this.y = p.y - 4 + Math.sin(dir) * 14; this.dir = dir;
    this.speed = 300; this.dist = 0; this.t = 0; this.done = false; this.r = 6;
  }
  update(dt) {
    this.t += dt;
    // 앞쪽 가까운 적에게 조금씩 방향을 튼다
    let best = null, bd = 100;
    for (const t of G.targets()) {
      const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
      if (d < bd && Math.abs(angDiff(Math.atan2(dy, dx), this.dir)) < 1.0) { bd = d; best = t; }
    }
    if (best) { const want = angDiff(Math.atan2(best.y - this.y, best.x - this.x), this.dir), turn = 4 * dt; this.dir += clamp(want, -turn, turn); }
    const step = this.speed * dt;
    this.x += Math.cos(this.dir) * step; this.y += Math.sin(this.dir) * step; this.dist += step;
    if (this.dist > ORB_RANGE || World.shotBlockedAt(this.x, this.y + 6)) { this.pop(); return; } // 나무 · 바위에 막힌다 (물 위로는 날아간다, 2026-10-18)
    for (const t of G.targets()) {
      if (Math.hypot(t.x - this.x, t.y - this.y) > t.r + this.r) continue;
      G.player.deal(t, 'orb', Math.cos(this.dir), Math.sin(this.dir));
      FX.onOrbHit(t);
      this.pop(); return;
    }
  }
  pop() {
    this.done = true;
    const ss = ElFx.slot('special');
    if (ss) ElFx.spark(ss, this.x, this.y, 3); else G.burst(this.x, this.y, 5, ['#aaf0ff', '#fff'], 90);
  }
  draw(g) {
    const ss = ElFx.slot('special'), base = ART.img.orb, img = ss ? ElFx.tinted(base, ss.el) : base, fr = (Math.floor(this.t * 14) % 4) * 16;
    g.save(); g.translate(this.x, this.y); g.rotate(this.dir + Math.PI / 2);
    g.drawImage(img, fr, 0, 16, 16, -10, -10, 20, 20);
    g.restore();
    if (ss && Math.random() < 0.4) ElFx.spark(ss, this.x, this.y);
  }
}

// 마법진: 바닥에 그려졌다가 CIRCLE_DELAY 초 뒤 폭발. 연쇄 마법진이면 주변에 작은 마법진이 이어서 터진다
class MagicCircle {
  constructor(x, y, r, chain, small) {
    this.x = x; this.y = y; this.r = r; this.chain = chain || 0; this.small = !!small;
    this.t = 0; this.delay = small ? 0.22 : CIRCLE_DELAY; this.done = false; this.boomT = -1;
  }
  update(dt) {
    this.t += dt;
    if (this.boomT < 0 && this.t >= this.delay) {
      this.boomT = 0;
      const p = G.player, mult = this.small ? MULTISPIN_MULT : 1;
      for (const t of G.targets()) {
        const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (d > this.r + t.r) continue;
        p.deal(t, 'circle', dx / d, dy / d, { mult, kb: this.small ? 60 : undefined });
      }
      G.fxRing(this.x, this.y, '#cfe8ff', this.r);
      G.burst(this.x, this.y, this.small ? 8 : 16, ['#cfe8ff', '#fff', '#aaf0ff'], 170);
      G.shake = Math.max(G.shake, this.small ? 2 : 5); Sfx.boom();
      if (!this.small) FX.onCircle(p, this.x, this.y, this.r);
      for (let i = 0; i < this.chain; i++) { // 연쇄 마법진
        const a = i / this.chain * Math.PI * 2 + rand(-0.3, 0.3), d = this.r * 0.9;
        const c = new MagicCircle(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.8, this.r * 0.6, 0, true);
        c.delay += 0.12 * i; G.projectiles.push(c);
      }
    }
    if (this.boomT >= 0 && (this.boomT += dt) > 0.25) this.done = true;
  }
  draw(g) {
    const cs = ElFx.slot('charge'), base = ART.img.magicCircle, img = cs ? ElFx.tinted(base, cs.el) : base;
    const k = clamp(this.t / this.delay, 0, 1), fade = this.boomT >= 0 ? 1 - this.boomT / 0.25 : 0.5 + 0.5 * k;
    const fr = this.boomT >= 0 ? 3 : Math.min(2, Math.floor(k * 3)), size = this.r * 2 * (this.boomT >= 0 ? 1 + this.boomT : 0.6 + 0.4 * k);
    const a0 = g.globalAlpha; g.globalAlpha = a0 * fade;
    g.save(); g.translate(this.x, this.y); g.scale(1, 0.75); // 바닥에 누운 원
    g.drawImage(img, fr * 32, 0, 32, 32, -size / 2, -size / 2, size, size);
    g.restore(); g.globalAlpha = a0;
  }
}
