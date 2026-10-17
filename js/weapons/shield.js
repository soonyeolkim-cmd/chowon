'use strict';
// ── 수호의 방패: 수호형 · 방패 돌진으로 막고 밀어내기. 묵직하고 느리다 (2026-10-17) ──
// 저스트 회피가 없다. 대신 대시(방패 돌진)가 정면 공격을 막고, 막으면 쿨타임이 풀리고 다음 밀치기가 강해진다.
// 약점: 바닥 · 범위 공격과 옆 · 뒤는 못 막는다, 돌진은 적을 통과하지 못하고 부딪혀 멈춘다, 대시 1회.
// 그림: Things by SnoopethDuckDuck (CC0) 의 청동 원형 방패, 막기 보호막은 에셋 팩 FX/Magic/Shield

// 방패 수치
const SHIELD_REACH = 34;        // 밀치기 거리
const SHIELD_FIN_REACH = 52;    // 3타째 몸으로 밀어치기 (40 → 52, 2026-10-17)
const SHIELD_BODY_LUNGE = 190;  // 몸으로 밀어치기: 앞으로 뛰어드는 속도 (동작 앞쪽 45% 동안)
const SHIELD_GUARD_AFTER = 0.15; // 돌진이 끝난 뒤에도 이만큼 정면을 막는다
const SHIELD_FRONT = 1.6;       // 막을 수 있는 각도 (정면에서 좌우 약 90°)
const SHIELD_BLOCK_INV = 0.3;   // 막은 뒤 잠깐 무적 (같은 공격에 두 번 맞지 않게)
const SHIELD_COUNTER_MULT = 1.6; // 막은 뒤 다음 밀치기 피해 배율
const SHIELD_SPIN_R = 62;       // 돌려치기 반경 (46 → 62, 2026-10-17)
const SHIELD_QUAKE_R = 72;      // 방패 강타 충격파 거리
const SHIELD_QUAKE_HALF = 0.8;  // 충격파 부채꼴 반각 (약 ±46°)
const SHIELD_QUAKE_STUN = 0.6;  // 강타에 맞은 적 기절 (보스 제외)
const SHIELD_SLAM_R = 40;       // 후려치기 범위
const SHIELD_SLAM_STUN = 0.5;
const SHIELD_BUMP = 14;         // 돌진 중 이 거리 안의 적에 부딪히면 멈춘다
const SHIELD_SIZE = 0.75;       // 방패 그림 크기 (16픽셀 × PIX × 이 값)

Object.assign(MOVES, {
// 방패: 한 방이 무겁고 크게 밀어낸다
bash:       { mult: 1.0, kb: 150, guardBreak: false, role: 'basic', light: true }, // 1 · 2타: 가볍게 툭
bashFin:    { mult: 1.95, kb: 760, guardBreak: true, role: 'fin', shove: true },  // 3타: 몸으로 밀어치기 (넉백 440 → 760, 약 100 날아감, 무거운 적도 꽤 밀림)
quake:      { mult: 2.6, kb: 260, guardBreak: true, role: 'charge' },   // 방패 강타 (차지): 앞쪽 부채꼴 충격파 + 기절
shieldSpin: { mult: 1.1, kb: 760, guardBreak: true, role: 'special', shove: true },  // 돌려치기 (특수): 넓은 둘레를 사방으로 날린다
shieldSlam: { mult: 1.6, kb: 200, guardBreak: true, role: 'dash' },     // 후려치기 (대시 공격)
shieldBump: { mult: 0.4, kb: 260, guardBreak: false, role: 'dash', light: true }, // 돌진하다 부딪힘
});

addWeapon('shield', {
  name: '수호의 방패',
  style: '수호형 · 방패 돌진으로 막고 밀어내기, 묵직하고 느림 · 범위 공격과 포위에 약함',
  essence: '무기의 정수',
  unlockCost: 1,             // 영웅의 증표 1개
  moves: { basic: '3연 밀치기', charged: '방패 강타', special: '돌려치기', dashAttack: '후려치기' },
  chargeTime: 0.6,
  specialCd: 2.8, // 3.5 → 2.8 (2026-10-17)
  cdPerLv: 0.4, cdPerMastery: 0.3, cdFloor: 1.5,
  speedMult: 0.88,           // 묵직하다: 가장 느린 무기
  dashCharges: 1,
  dashSpeed: 280,
  dashCdMult: 0.9 / DASH_CD, // 대시 1회 · 0.9초 충전
  dashGuard: SHIELD_GUARD_AFTER, // 대시 = 방패 돌진 (무적 · 저스트 회피 대신 정면 막기, entities.js · game.js hurtPlayer)
  wallSlam: true,            // 3타째 밀치기 · 돌려치기로 벽에 밀면 벽꿍
  skillCd: 0,
  basic: (p, mag) => p.startBash(mag),
  basicAfterDash: p => p.startShieldSlam(),
  charged: (p, mag) => p.startQuake(mag),
  special: (p, mag) => p.startShieldSpin(mag),
  skill: null,
  rows: (A, P, D) => [
    ['기본 · 3연 밀치기', `${A} ${A} ${A}`, '밀치기를 이어 가는 동안 정면을 막는다 · 1 · 2타는 가볍게 툭, 3타째는 몸으로 뛰어들어 넓게 밀어치기 (크게 날리고 가드 브레이크) · 벽에 밀면 벽꿍'],
    ['차지 · 방패 강타', `${A} 길게 눌렀다 떼기`, '땅을 내려찍어 앞쪽 부채꼴 충격파 · 가드 브레이크 + 기절 · 땅속에 숨은 적도 끌어내 때린다'],
    ['특수 · 돌려치기', `${P} (쿨타임 2.8초)`, '방패를 크게 한 바퀴 휘둘러 둘레의 적을 사방으로 멀리 날린다 · 벽에 부딪히면 벽꿍'],
    ['대시 · 방패 돌진', `${D} (쿨타임 ${+(DASH_CD * WEAPONS.shield.dashCdMult).toFixed(2)}초 · 1회)`, '무적이 아니라 정면을 막는다 · 막으면 쿨타임이 모두 풀리고 다음 밀치기 강화 · 적에 부딪히면 멈춘다'],
    ['후려치기', `${D} → ${A}`, '돌진 뒤 방패로 내려찍기 · 기절 · 땅속에 숨은 적도 끌어내 때린다', 'thrust'],
  ],
  notesTitle: '방패 특성 · 막기',
  notes: [
    '방패는 저스트 회피가 없어요. 대시가 방패 돌진이에요.',
    '방패 돌진 중 · 끝난 직후 잠깐 · 밀치는 동안, 정면에서 오는 공격과 탄을 막아요. 막으면 피해가 없고, 특수 · 대시 쿨타임이 바로 풀리고, 다음 밀치기가 반격 밀치기(피해 ×1.6, 가드 브레이크)가 돼요.',
    '못 막는 것: 바닥에서 터지는 범위 공격(빨간 원 · 뿌리 · 폭발)과 옆 · 뒤에서 오는 공격. 이건 위치로 피해야 해요.',
    '돌진은 적을 통과하지 못하고 부딪혀 멈춰요. 포위당하면 돌려치기로 밀어내세요.',
  ],
  comboLen: 3,
  shieldHint: '저 방패병은 정면 공격을 막아요! 3타째 밀치기나 방패 강타는 방패를 깨요.',
  mastery: [
    { id: 'combo',  name: '3연 밀치기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `3타째 밀치기 피해 +${15 * lv}%` },
    { id: 'spin',   name: '방패 강타 숙련',  max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 강타 거리 +${5 * lv}%` },
    { id: 'wave',   name: '돌려치기 숙련',   max: 3, cost: [3, 5, 8], desc: lv => `돌려치기 쿨타임 -${(0.3 * lv).toFixed(1)}초 (최소 1.5초)` },
    { id: 'thrust', name: '후려치기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `후려치기 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.shield, {
  draw: (p, g, x, y) => p.drawShieldWeapon(g, x, y),
  dodgeText: '방패 막기!',
  padIcon(b) { // 돌려치기: 원형 방패 + 도는 화살표
    const q = b.r * 0.32;
    ctx.beginPath(); ctx.arc(b.x, b.y, q, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, q * 1.75, -2.6, 0.4); ctx.stroke();
    const ax = b.x + Math.cos(0.4) * q * 1.75, ay = b.y + Math.sin(0.4) * q * 1.75;
    ctx.beginPath(); ctx.moveTo(ax - q * 0.5, ay - q * 0.15); ctx.lineTo(ax, ay); ctx.lineTo(ax + q * 0.1, ay - q * 0.55); ctx.stroke();
  },
  glyph: {
    basic(g, s, line) { g.beginPath(); g.arc(-0.1 * s, 0, 0.5 * s, 0, Math.PI * 2); g.stroke(); line(0.5, -0.4, 0.9, -0.4); line(0.5, 0.4, 0.9, 0.4); }, // 밀치기
    charge(g, s, line) { g.beginPath(); g.arc(-0.55 * s, 0, 0.3 * s, 0, Math.PI * 2); g.fill(); for (const r of [0.55, 0.85]) { g.beginPath(); g.arc(-0.55 * s, 0, r * s * 1.3, -0.7, 0.7); g.stroke(); } }, // 강타 충격파
    special(g, s, line) { g.beginPath(); g.arc(0, 0, 0.35 * s, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(0, 0, 0.75 * s, -2.6, 1.2); g.stroke(); }, // 돌려치기
  },
  // 돌진 중: 앞에 적이 있으면 부딪혀 멈춘다 (통과 못 함). 부딪힌 적은 조금 밀려난다
  dashMove(p) {
    const fx = Math.cos(p.dashDir), fy = Math.sin(p.dashDir);
    for (const t of G.targets()) {
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d > t.r + SHIELD_BUMP || dx * fx + dy * fy < 0) continue;
      if (!p.dashBumped) { p.dashBumped = true; p.deal(t, 'shieldBump', fx, fy); G.burst(p.x + fx * 12, p.y - 6 + fy * 12, 6, ['#ffd28a', '#fff'], 120); Sfx.block(); }
      return true;
    }
    return false;
  },
  // 돌려치기에 맞았을 때: 속성 특수 축복 · 치유
  onSpecialHit(fx, t, info, atk) {
    if (fx.lv('fire_special')) fx.burn(t, 2);
    const is = fx.lv('ice_special');
    if (is && !t.dead) fx.chill(t, iceBig(is));
    if (fx.lv('elec_special')) fx.shock(t);
    const ps = fx.lv('poison_special');
    if (ps && !t.dead) fx.poison(t, 1 + ps);
    const hw = fx.lv('heal_wave'), p = G.player, a = p.act;
    if (hw && p.alive && a && a.kind === 'shieldSpin' && !a.healed) { a.healed = true; p.hp = Math.min(p.maxHp, p.hp + 0.5 + 0.5 * hw); }
  },
});
// 방패: 기본 = 3연 밀치기, 차지 = 방패 강타, 특수 = 돌려치기, 대시 공격 = 후려치기
BOON_FORMS.shield = {
  fire_basic:     { name: '불꽃 방패' },
  fire_bolt:      { name: '화염 밀치기', desc: lv => `밀칠 때마다 화염구가 날아가 처음 닿은 적 자리에서 폭발 (공격력의 ${pct(0.5 + 0.2 * lv)} + 화상). 3타째는 3발.` },
  fire_charge:    { name: '화염 강타', desc: lv => `방패 강타에 맞은 적에게 화상 2중첩, 충격파가 지나간 땅에 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  fire_special:   { name: '화염 돌려치기', desc: lv => `돌려치기에 맞은 적에게 화상 2중첩, 돌고 나면 주변이 폭발한다 (공격력의 ${pct(0.8 + 0.4 * lv)}).` },
  ice_basic:      { name: '서리 방패' },
  ice_shard:      { name: '얼음 파편 밀치기', desc: lv => `밀칠 때마다 얼음 파편 ${1 + lv}개가 부채꼴로 날아가 적을 관통하며 냉기 1중첩 (공격력의 ${pct(0.25 + 0.05 * lv)}).` },
  ice_charge:     { name: '빙결 강타', desc: lv => `방패 강타에 맞은 적에게 냉기 ${iceBig(lv)}중첩.` },
  ice_special:    { name: '서리 돌려치기', desc: lv => `돌려치기에 맞은 적에게 냉기 ${iceBig(lv)}중첩, 돌고 나면 발밑이 얼어붙는다.` },
  elec_basic:     { name: '번개 방패' },
  elec_chain:     { name: '연쇄 번개 방패' },
  elec_charge:    { name: '뇌전 강타', desc: lv => `방패 강타 직후 충격파 끝 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  elec_special:   { name: '뇌격 돌려치기', desc: lv => `돌려치기에 맞은 적은 감전, 돌고 나면 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.4 * lv)}).` },
  poison_basic:   { name: '독 방패' },
  poison_charge:  { name: '독안개 강타', desc: lv => `충격파가 지나간 땅에 ${2 + 0.5 * lv}초간 독안개. 안에 있는 적에게 계속 독.` },
  poison_special: { name: '독 돌려치기', desc: lv => `돌려치기에 맞은 적에게 독 ${1 + lv}중첩.` },
  atk_combo:      { name: '연속 밀치기' },
  atk_spin:       { name: '강타 강화', desc: lv => `차지 시간 -${15 * lv}%, 강타 거리 +${10 * lv}%.` },
  atk_multispin:  { name: '여진', desc: lv => `방패 강타 뒤 땅이 ${lv}번 더 울린다. 여진은 피해 ${pct(MULTISPIN_MULT)}, 마지막에만 넉백.` },
  atk_wave:       { name: '돌려치기 강화', desc: lv => `돌려치기 범위 +${10 * lv}%, 쿨타임 -${(0.4 * lv).toFixed(1)}초 (최소 1.5초).` },
  atk_thrust:     { name: '후려치기 강화', desc: lv => `후려치기 피해 +${40 * lv}%, 범위 +${10 * lv}%.` },
  sharp:          { name: '날 선 방패' },
  lifesteal:      { name: '흡혈 방패' },
  guard_spin:     { name: '굳건한 강타', desc: lv => `방패 강타 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  heal_wave:      { name: '치유의 돌려치기', desc: lv => `돌려치기가 적을 맞히면 체력 ${0.5 + 0.5 * lv} 회복 (한 번 돌 때 한 번).` },
};

extendPlayer({
  // ── 방패 ──
  // 정면에서 온 공격인가 (막을 수 있나)
  shieldFront(src) {
    const f = this.dashT > 0 ? this.dashDir : this.facing;
    return Math.abs(angDiff(Math.atan2(src.y - this.y, src.x - this.x), f)) < SHIELD_FRONT;
  },
  // 막았다: 피해 없음 · 특수 · 대시 쿨타임 초기화 · 다음 밀치기 강화 · 때린 적은 밀려난다
  shieldBlock(src) {
    const f = this.dashT > 0 ? this.dashDir : this.facing, c = Math.cos(f), s = Math.sin(f);
    this.invuln = Math.max(this.invuln, SHIELD_BLOCK_INV);
    this.specialCd = 0; this.dashStock = this.dashMax; this.dashRecharge = this.dashCdBase;
    this.bashReady = true; this.guardFxT = 0.3;
    this.kvx -= c * 120; this.kvy -= s * 120; // 막은 힘에 조금 밀린다
    if (src && src.type && src.type !== 'boss' && !src.dead && src.kvx !== undefined) { src.kvx += c * 220; src.kvy += s * 220; src.stun = Math.max(src.stun || 0, 0.35); }
    const bx = this.x + c * 14, by = this.y - 8 + s * 14;
    G.text(this.x, this.y - 30, '막기!', '#ffd28a', 15, 0.8);
    G.burst(bx, by, 12, ['#ffffff', '#ffd28a', '#9fdcff'], 180); G.fxRing(bx, by, '#9fdcff', 30);
    G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 4);
    Sfx.block(); Input.rumble(0.6, 120);
  },
  // 3연 밀치기: 짧은 앞쪽 부채꼴. 막은 뒤 첫 밀치기는 반격 밀치기
  startBash(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.aim(mag);
    const fin = this.combo === 2, counter = !!this.bashReady;
    this.bashReady = false;
    this.act = { kind: fin ? 'bashFin' : 'bash', t: 0, dur: fin ? 0.24 : 0.15, hit: new Set(), range: fin ? SHIELD_FIN_REACH : SHIELD_REACH, half: fin ? 1.25 : 0.85,
      opts: counter ? { mult: SHIELD_COUNTER_MULT } : undefined, counter };
    this.act.noStep = mag < STEP_MIN || this.enemyInReach(this.act.range, this.act.half);
    this.atkCd = (fin ? 0.6 : 0.28) * (1 - 0.15 * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.35;
    this.finisherT = 0; this.atkBuffer = 0;
    this.guardT = Math.max(this.guardT, this.atkCd + 0.1); // 밀치기를 이어 가는 동안 내내 정면을 막는다 (동작 사이 빈틈 없이, 2026-10-17)
    if (counter) G.text(this.x, this.y - 26, '반격 밀치기!', '#ffd28a', 12, 0.6);
    Sfx.swing(fin || counter);
    FX.onSwing(this, fin);
  },
  // 방패 강타 (차지): 방패로 땅을 내려쳐 앞쪽 부채꼴로 충격파
  get quakeR() { return SHIELD_QUAKE_R * (1 + 0.1 * FX.lv('atk_spin') + 0.05 * this.mastery('spin')); },
  startQuake(mag) {
    this.finisherT = 0;
    this.aim(mag);
    const ms = FX.lv('atk_multispin');
    this.act = { kind: 'quake', t: 0, dur: 0.34 + 0.12 * ms, dur0: 0.34, hit: new Set(), r: this.quakeR, extra: ms, shocks: 0 };
    this.atkCd = 0.55 + 0.12 * ms; this.charge = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '방패 강타', '#ffd24a', 12, 0.6);
    Sfx.swing(true);
  },
  // 돌려치기 (특수): 크게 한 바퀴 휘둘러 넓은 둘레의 적을 바깥으로 날린다
  get spinR() { return SHIELD_SPIN_R * (1 + 0.1 * FX.lv('atk_wave')); },
  startShieldSpin(mag) {
    this.aim(mag);
    this.act = { kind: 'shieldSpin', t: 0, dur: 0.32, hit: new Set(), r: this.spinR, a0: this.facing };
    this.finisherT = 0; this.combo = 0; this.comboT = 0; this.charge = 0;
    Sfx.spin();
  },
  // 후려치기 (대시 공격): 방패를 들어 앞을 내려찍는다
  startShieldSlam() {
    this.finisherT = 0;
    this.aim(Math.hypot(Input.state.mx, Input.state.my));
    this.act = { kind: 'shieldSlam', t: 0, dur: 0.3, hit: new Set(), r: SHIELD_SLAM_R * (1 + 0.1 * FX.lv('atk_thrust')) };
    this.atkCd = 0.55; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '후려치기', '#9cdcff', 11, 0.5);
    Sfx.swing(true);
  },
  // 방패 강타 · 후려치기: 내려찍은 자리 안, 땅속에 숨은 적(두더지)을 강제로 튀어나오게 하고 잠깐 기절시킨다 → 바로 맞는다 (2026-10-17)
  unearth(r, half, cx = this.x, cy = this.y) {
    for (const e of G.enemies) {
      if (e.dead || !e.burrowed || e.type !== 'mole') continue;
      const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy) || 1;
      if (d > r + e.r || (half < Math.PI && d > e.r + 6 && Math.abs(angDiff(Math.atan2(dy, dx), this.facing)) > half)) continue;
      e.state = 'up'; e.st = 1.6; e.burrowed = false; e.attacking = false;
      e.stun = Math.max(e.stun || 0, SHIELD_QUAKE_STUN + 0.4);
      G.burst(e.x, e.y + 4, 14, ['#8a6a4a', '#c8a878', '#fff'], 160);
      G.text(e.x, e.y - e.r - 14, '튀어나옴!', '#ffd28a', 11, 0.7);
    }
  },
  // 앞쪽 부채꼴(또는 원) 안의 적을 한 번씩. stun: 보스 · 슈퍼아머 말고 기절
  hitFan(a, cx, cy, r, half, kind, stun, opts) {
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy) || 1;
      if (d > r + t.r) continue;
      if (half < Math.PI && d > t.r + 6 && Math.abs(angDiff(Math.atan2(dy, dx), this.facing)) > half) continue;
      a.hit.add(t);
      this.deal(t, kind, dx / d, dy / d, opts);
      if (stun && !t.dead && t.type !== 'boss' && !t.superArmor) t.stun = Math.max(t.stun || 0, stun);
    }
  },
  drawShieldWeapon(g, x, y) {
    const cy = y - 6, a = this.act, f = this.dashT > 0 ? this.dashDir : this.facing, c = Math.cos(f), s = Math.sin(f);
    const glow = this.bashReady; // 반격 밀치기 준비: 방패가 금빛으로 반짝
    if (this.dashT > 0 || (this.guardT > 0 && !a)) { // 방패 돌진: 앞에 크게 들고 정면 막기
      shieldSprite(g, x + c * 13, cy + s * 9, 1.15, glow);
      const k = 0.4 + 0.2 * Math.sin(G.time * 40);
      g.strokeStyle = `rgba(159,220,255,${k})`; g.lineWidth = 2;
      g.beginPath(); g.arc(x, cy, 20, f - 0.9, f + 0.9); g.stroke();
    } else if (a && a.kind === 'bashFin') { // 몸으로 밀어치기: 방패를 몸에 붙이고 어깨로 들이받는다
      const p = a.t / a.dur, e = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      shieldSprite(g, x + c * (11 + e * 4), cy + s * (8 + e * 3), 1.15, glow || a.counter);
      if (e > 0.3) { g.strokeStyle = `rgba(255,240,210,${0.75 * e})`; g.lineWidth = 4; g.beginPath(); g.arc(x, cy, a.range - 6, f - a.half * 0.7, f + a.half * 0.7); g.stroke(); }
    } else if (a && a.kind === 'bash') {
      const p = a.t / a.dur, e = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
      shieldSprite(g, x + c * (9 + e * (a.range - 18)), cy + s * (6 + e * (a.range - 18)), 1, glow || a.counter);
      if (e > 0.5) { const bs = ElFx.slot('basic'); if (bs) ElFx.arc(g, bs, x, cy, a.range - 4, f - a.half * 0.6, f + a.half * 0.6, 4, 0.7 * e); else { g.strokeStyle = `rgba(255,240,210,${0.7 * e})`; g.lineWidth = 3; g.beginPath(); g.arc(x, cy, a.range - 4, f - a.half * 0.6, f + a.half * 0.6); g.stroke(); } }
    } else if (a && a.kind === 'shieldSpin') {
      const p = clamp(a.t / a.dur, 0, 1), ang = a.a0 + Math.PI * 2 * p;
      const ss = ElFx.slot('special');
      if (ss) ElFx.arc(g, ss, x, cy, a.r * 0.6, ang - 2.2, ang, 6, 0.8);
      else { g.strokeStyle = 'rgba(255,240,210,0.75)'; g.lineWidth = 6; g.beginPath(); g.arc(x, cy, a.r * 0.6, ang - 2.2, ang); g.stroke(); }
      shieldSprite(g, x + Math.cos(ang) * 16, cy + Math.sin(ang) * 11, 1, glow);
    } else if (a && a.kind === 'quake') {
      const p = clamp(a.t / a.dur0, 0, 1), lift = p < 0.3 ? p / 0.3 : 0, down = p >= 0.3;
      shieldSprite(g, x + c * (down ? 14 : 8), cy + s * (down ? 10 : 6) - lift * 14, 1.1, glow);
      if (down) { // 충격파: 앞쪽 부채꼴로 퍼진다
        const q = clamp((p - 0.3) / 0.7, 0, 1), cs = ElFx.slot('charge');
        for (const r of [a.r * q, a.r * q * 0.7]) {
          if (cs) ElFx.arc(g, cs, x, y, r, f - SHIELD_QUAKE_HALF, f + SHIELD_QUAKE_HALF, 4, 0.8 * (1 - q));
          else { g.strokeStyle = `rgba(255,220,140,${0.8 * (1 - q)})`; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r, f - SHIELD_QUAKE_HALF, f + SHIELD_QUAKE_HALF); g.stroke(); }
        }
      }
      if (a.shockAt !== undefined && a.t - a.shockAt < 0.12) { // 여진
        const q = (a.t - a.shockAt) / 0.12;
        g.strokeStyle = `rgba(127,224,255,${0.8 * (1 - q)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, a.r * (0.4 + 0.6 * q), f - SHIELD_QUAKE_HALF, f + SHIELD_QUAKE_HALF); g.stroke();
      }
    } else if (a && a.kind === 'shieldSlam') {
      const p = clamp(a.t / a.dur, 0, 1), lift = p < 0.4 ? p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.12);
      shieldSprite(g, x + c * (10 + 6 * (1 - lift)), cy + s * 8 - lift * 16, 1.1, glow);
      if (p > 0.45 && p < 0.9) { const q = (p - 0.45) / 0.45; g.strokeStyle = `rgba(255,240,180,${1 - q})`; g.lineWidth = 3; g.beginPath(); g.ellipse(x + c * 16, y + s * 10, 6 + q * a.r * 0.6, 3 + q * 8, 0, 0, Math.PI * 2); g.stroke(); }
    } else {
      shieldSprite(g, x + c * 9, cy + s * 6 + 2, 1, glow); // 평소: 앞쪽에 든다
    }
    if (this.guardFxT > 0) { // 막기 성공: 보호막 이펙트
      const fr = Math.min(5, Math.floor((0.3 - this.guardFxT) / 0.05)), im = ART.img.guardFx;
      g.save(); g.translate(x + c * 16, cy + s * 12); g.rotate(f + Math.PI / 2);
      g.drawImage(im, fr * 24, 0, 24, 26, -24, -30, 48, 52); g.restore();
      this.guardFxT -= 1 / 60;
    }
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
    if (a.kind === 'bash' || a.kind === 'bashFin') {
      if (a.kind === 'bashFin') { if (a.t < a.dur * 0.45) World.move(this, fx * SHIELD_BODY_LUNGE * dt, fy * SHIELD_BODY_LUNGE * dt); } // 3타: 몸째로 뛰어든다
      else if (a.t < a.dur * 0.45 && !a.noStep && this.inMag >= STEP_MIN) World.move(this, fx * 70 * dt, fy * 70 * dt);
      if (a.t > a.dur * 0.3) this.hitArc(a, a.range, a.half);
      return true;
    }
    if (a.kind === 'quake') {
      if (!a.hitDone && a.t >= a.dur0 * 0.3) { // 내려친 순간
        a.hitDone = true;
        this.unearth(a.r, SHIELD_QUAKE_HALF); // 땅속에 숨은 적을 끌어낸다
        this.hitFan(a, this.x, this.y, a.r, SHIELD_QUAKE_HALF, 'quake', SHIELD_QUAKE_STUN, a.extra ? { kb: 60 } : undefined);
        G.shake = Math.max(G.shake, 6); Sfx.slam();
        G.burst(this.x + fx * 16, this.y + fy * 10, 12, ['#d8c8a8', '#ffe08a', '#fff'], 160);
        FX.onQuake(this, this.x + fx * a.r * 0.6, this.y + fy * a.r * 0.6);
      }
      // 여진: 같은 부채꼴을 다시 울린다
      if (a.hitDone && a.shocks < (a.extra || 0) && a.t >= a.dur0 * 0.3 + 0.12 * (a.shocks + 1)) {
        a.shocks++; a.hit = new Set(); a.shockAt = a.t;
        this.hitFan(a, this.x, this.y, a.r, SHIELD_QUAKE_HALF, 'quake', 0, { mult: MULTISPIN_MULT, kb: a.shocks < a.extra ? 40 : undefined });
        G.shake = Math.max(G.shake, 3); Sfx.slam();
      }
      return true;
    }
    if (a.kind === 'shieldSpin') {
      if (a.t > a.dur * 0.1) this.hitFan(a, this.x, this.y, a.r, Math.PI, 'shieldSpin', 0);
      if (!a.ended && a.t >= a.dur * 0.9) { a.ended = true; FX.onShieldSpinEnd(this); }
      return true;
    }
    if (a.kind === 'shieldSlam') {
      if (a.t < a.dur * 0.35) World.move(this, fx * 80 * dt, fy * 80 * dt);
      if (!a.hitDone && a.t >= a.dur * 0.45) {
        a.hitDone = true;
        this.unearth(a.r, Math.PI, this.x + fx * 14, this.y + fy * 10); // 땅속에 숨은 적도 끌어낸다
        this.hitFan(a, this.x + fx * 14, this.y + fy * 10, a.r, Math.PI, 'shieldSlam', SHIELD_SLAM_STUN);
        G.shake = Math.max(G.shake, 5); Sfx.slam();
      }
      return true;
    }
});

Object.assign(FX, {
  // ── 방패 ──
  // 방패 강타: 충격파 끝 쪽(cx, cy)에 불길 · 독안개 · 낙뢰, 굳건한 강타
  onQuake(p, cx, cy) {
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (fc || pc) {
      const f = p.facing;
      for (const o of [-0.5, 0, 0.5]) for (const d of [30, 50, 70]) {
        const zx = p.x + Math.cos(f + o) * d * p.quakeR / SHIELD_QUAKE_R, zy = p.y + Math.sin(f + o) * d * p.quakeR / SHIELD_QUAKE_R + 4;
        if (fc) this.zone(zx, zy, 'fire', 1.5 + 0.5 * fc);
        if (pc) this.zone(zx, zy, 'poison', 2 + 0.5 * pc);
      }
    }
    const ec = this.lv('elec_charge');
    if (ec) {
      const list = this.near(cx, cy, 110).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
    }
    const gs = this.lv('guard_spin');
    if (gs) p.spinGuardT = 0.5 + 0.5 * gs;
  },
  // 돌려치기가 끝날 때: 주변 폭발 · 얼음 · 낙뢰
  onShieldSpinEnd(p) {
    const atk = p.atk, x = p.x, y = p.y, R = p.spinR;
    const fs = this.lv('fire_special');
    if (fs) this.explode(x, y, R + 14, atk * (0.8 + 0.4 * fs), '#ff7a3c', true);
    const is = this.lv('ice_special');
    if (is) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 24, y + 4 + Math.sin(a) * 16, 'ice', 1.5 + 0.5 * is); }
    const es = this.lv('elec_special');
    if (es) { const list = this.near(x, y, 120).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 2 + es); for (const e of list) this.skyBolt(e, atk * (0.8 + 0.4 * es)); }
  },
});

// 방패 그림: 16픽셀 원형 방패 (glow 면 금빛 테두리)
function shieldSprite(g, x, y, scale = 1, glow) {
  const im = ART.img.shield, w = 16 * PIX * SHIELD_SIZE * scale;
  if (glow) {
    const k = 0.5 + 0.3 * Math.sin(G.time * 12);
    g.fillStyle = `rgba(255,210,120,${k * 0.55})`; g.beginPath(); g.arc(x, y, w * 0.62, 0, Math.PI * 2); g.fill();
  }
  g.drawImage(im, Math.round(x - w / 2), Math.round(y - w / 2), w, w);
}
