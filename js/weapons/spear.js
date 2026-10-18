'use strict';
// ── 바람의 창: 결투형 · 긴 찌르기와 창끝, 관통 찌르기, 투척, 벽꿍 ──

// 창 수치
const SPEAR_REACH = 74;        // 찌르기 길이 (검 3타째 46)
const SPEAR_WIDTH = 12;        // 찌르기 판정 폭 (좁다, 9 → 12)
const SPEAR_PIERCE = 3;        // 찌르기 한 번에 관통하는 최대 수
const SPEAR_TIP = 0.62;        // 길이의 이 비율보다 먼 곳 = 창끝
// 보스전 시험(2026-10-17): 창 단일 대상 피해가 검의 2.7배 → 창끝 1.8 → 1.25, 투척 약화 (E안). 이제 검의 약 1.2배
const SPEAR_TIP_MULT = 1.25;
const SPEAR_BACK_MULT = 0.5;   // 돌아오는 창의 피해 배율 (갈 때 한 번 · 올 때 절반)
const SPEAR_HAFT = 30;         // 이보다 가까우면 창대에 맞음
const SPEAR_HAFT_MULT = 0.6;
const SWEEP_HALF = Math.PI / 3;  // 후려치기 범위: 앞쪽 120도
const SPEAR_PIERCE_LEN = 96;   // 관통 찌르기 길이 (기본 찌르기 74)
const SPEAR_THROW_RANGE = 100; // 투척 비거리
const SPEAR_SPEED = 1.1;       // 창 공격 속도 배율 (찌르기 · 투척 · 후려치기, 1.1 = 10% 빠르게)
const WALL_SLAM_MULT = 0.8;
const SPEAR_BEAM_LEN = 220;     // 창기 일섬 (차지 2단): 창끝에서 일직선으로 뻗는 빛 (기본 찌르기의 3배, 2026-10-18)
const SPEAR_BEAM_WIDTH = 15;    // 벽꿍 추가 피해 (공격력 배율)
const SPEAR_AIM = { range: 110, half: AIM_HALF_ANGLE, moveHalf: 20 * Math.PI / 180 };
const THROW_AIM = { range: 200, half: AIM_HALF_ANGLE, moveHalf: 20 * Math.PI / 180 };

Object.assign(MOVES, {
// 창
poke:     { mult: 1.15, kb: 140, guardBreak: false, role: 'basic', light: true },
pokeFin:  { mult: 1.75, kb: 340, guardBreak: true, role: 'fin' },
lunge:    { mult: 2.6, kb: 320, guardBreak: true, role: 'charge' },
spearBeam: { mult: 3.0, kb: 280, guardBreak: true, role: 'charge' }, // 창기 일섬 (차지 2단): 멀리 한 줄 전부 관통   // 관통 찌르기 (차지): 한 줄만 맞히는 대신 회전베기(2.2)보다 세다
spear:    { mult: 0.7, kb: 120, guardBreak: false, role: 'special', light: true, ranged: true },   // 창 투척 (갈 때 한 번 · 올 때 절반), 1.25 → 0.7 (2026-10-17)
sweep:    { mult: 1.0, kb: 240, guardBreak: true, role: 'dash' },   // 후려치기 (창 대시 공격)
});

// 결투형: 길고 좁은 찌르기. 창끝으로 맞히면 강하고, 붙거나 둘러싸이면 약하다. 360° 공격이 없다.
addWeapon('spear', {
  name: '바람의 창',
  style: '결투형 · 긴 사거리와 창끝 치명타, 포위에 약함',
  essence: '무기의 정수',
  unlockCost: 1,             // 영웅의 증표
  moves: { basic: '2연 찌르기', charged: '관통 찌르기', special: '창 투척', dashAttack: '후려치기' },
  chargeTime: 0.55, // 검과 같은 차지 시간 (0.8 → 0.55, 2026-10-16)
  specialCd: 2.0, // 1.3 → 1.18 (2026-10-16) → 2.0 (2026-10-17, 투척만 던져도 검보다 세서)
  // 투척 쿨타임 감소는 창 기준 숫자로 (검의 -0.7초를 그대로 쓰면 Lv1에서 바닥에 닿았다). 바닥 0.5초 > 창이 돌아오는 0.32초 (2026-10-17)
  cdPerLv: 0.15, cdPerMastery: 0.1, cdFloor: 0.5,
  // 민첩하지 않은 무기: 이동이 조금 느리고, 대시는 짧은 거리 · 긴 쿨타임
  speedMult: 0.92,
  dashCharges: 2,
  dashSpeed: 270,
  dashCdMult: 0.85 / DASH_CD, // 대시 1칸 충전 0.85초 (검 0.7초 · 예전 1.05초)
  skillCd: 0,
  basic: (p, mag) => p.startPoke(mag),
  basicAfterDash: p => p.startSweep(),
  charged: (p, mag, full2) => (full2 ? p.startSpearBeam(mag) : p.startLunge(mag)), // 2단까지 모으면 창기 일섬
  charge2Time: 0.45, // 차지 2단: 1단을 다 모은 뒤 0.45초 더
  special: (p, mag) => p.throwSpear(mag),
  skill: null,
  rows: (A, P, D) => [
    ['기본 · 2연 찌르기', `${A} ${A}`, '창끝 ×1.25 · 붙으면 ×0.6 · 최대 3명 관통'],
    ['차지 · 관통 찌르기', `${A} 길게 눌렀다 떼기`, '강하고 긴 찌르기 · 전부 관통 · 가드 브레이크'],
    ['차지 2단 · 창기 일섬', `${A} 더 길게 (푸른 고리까지) 눌렀다 떼기`, '창끝에서 빛의 창기가 일직선으로 약 220까지 뻗는다 · 줄 위 전부 관통 · 가장 센 한 방 · 가드 브레이크'],
    ['특수 · 창 투척', `${P} (쿨타임 2초)`, '갔다 돌아오며 관통 (돌아올 땐 절반) · 그동안 공격 불가'],
    ['대시', `${D} (쿨타임 ${+(DASH_CD * WEAPONS.spear.dashCdMult).toFixed(2)}초 · 2회)`, '짧은 무적 이동 · 검보다 짧고 느리다'],
    ['후려치기', `${D} → ${A}`, '앞쪽 120도를 휩쓸기 · 바깥쪽일수록 아픔 · 가드 브레이크', 'thrust'],
    ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
    ['삼연 투척', `2타째 직후 ${P}`, '창 세 자루가 부채꼴로', 'triple'],
    ['벽꿍', '2타째 · 관통 찌르기로 벽에 밀기', '추가 피해 + 기절'],
  ],
  notesTitle: '창 특성',
  notes: [
    '창끝(먼 쪽)으로 맞히면 피해 ×1.25, 너무 붙어서 창대에 맞으면 ×0.6이에요. 거리를 두고 싸워요.',
    '던진 창이 돌아올 때까지는 공격할 수 없어요. 돌아오는 창에 맞은 적은 절반 피해를 받아요.',
    '2타째 찌르기나 관통 찌르기로 적을 벽에 밀면 벽꿍: 추가 피해 + 기절.',
    '저스트 회피에 성공하면 날아가던 창이 바로 손으로 돌아와요.',
  ],
  comboLen: 2,
  shieldHint: '저 방패병은 정면 공격을 막아요! 2타째 찌르기나 관통 찌르기는 방패를 뚫어요. 뒤로 돌아가도 돼요.',
  mastery: [
    { id: 'combo',  name: '연속 찌르기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `2타째 찌르기 피해 +${15 * lv}%` },
    { id: 'spin',   name: '관통 찌르기 숙련', max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 관통 찌르기 길이 +${5 * lv}%` },
    { id: 'wave',   name: '투척 숙련',        max: 3, cost: [3, 5, 8], desc: lv => `창 투척 쿨타임 -${(0.1 * lv).toFixed(1)}초 (최소 0.5초)` },
    { id: 'thrust', name: '후려치기 숙련',    max: 3, cost: [2, 4, 7], desc: lv => `후려치기 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.spear, {
  draw: (p, g, x, y) => p.drawSpear(g, x, y),
  dodgeText: '대시 · 투척 준비!',
  wallSlam: true, // 2타째 · 관통 찌르기로 벽에 밀면 벽꿍
  padIcon(b) { // 창 투척: 화살표
    const q = b.r * 0.45;
    ctx.beginPath(); ctx.moveTo(b.x - q, b.y + q); ctx.lineTo(b.x + q, b.y - q);
    ctx.moveTo(b.x + q * 0.1, b.y - q); ctx.lineTo(b.x + q, b.y - q); ctx.lineTo(b.x + q, b.y - q * 0.1); ctx.stroke();
  },
  glyph: {
    basic(g, s, line) { line(-0.75, 0.75, 0.55, -0.55); g.beginPath(); g.moveTo(0.8 * s, -0.8 * s); g.lineTo(0.3 * s, -0.55 * s); g.lineTo(0.55 * s, -0.3 * s); g.closePath(); g.fill(); },
    special(g, s, line) { line(-0.8, 0.1, 0.5, 0.1); g.beginPath(); g.moveTo(0.85 * s, 0.1 * s); g.lineTo(0.4 * s, -0.2 * s); g.lineTo(0.4 * s, 0.4 * s); g.closePath(); g.fill(); line(-0.8, -0.35, -0.3, -0.35); line(-0.8, 0.55, -0.4, 0.55); },
  },
  // 찌르기가 맞았을 때: 피뢰 관통 · 빙결 관통 · 독 창끝
  onBasicHit(fx, t, info, act, atk) {
    const ch = fx.lv('elec_chain');
      // 피뢰 관통: 관통한 적끼리 번개로 잇는다
      if (ch && act.prevHit && !act.prevHit.dead && !t.dead) {
        fx.bolt(act.prevHit.x, act.prevHit.y - 6, t.x, t.y - 6); fx.shock(t);
        fx.damage(t, atk * (0.45 + 0.15 * ch) * fx.lightningMult(t), '#ffe14a');
      }
      act.prevHit = t;
      // 빙결 관통: 뒤쪽에서 관통당한 적일수록 냉기 추가
      const isd = fx.lv('ice_shard');
      if (isd && act.pierced > 1 && !t.dead) fx.chill(t, Math.min(2, act.pierced - 1));
      // 독 창끝
      const pss = fx.lv('poison_spray');
      if (pss && info.tip && !t.dead) fx.poison(t, 1 + pss);
  },
  // 던진 창에 맞았을 때 (폭발 · 장판 · 벼락은 반환점에서: onSpearApex)
  onSpecialHit(fx, t, info, atk) {

    // 던진 창: 폭발 · 장판 · 벼락은 반환점에서 (onSpearApex)
    if (fx.lv('fire_special')) fx.burn(t, 1);
    if (fx.lv('elec_special')) fx.shock(t);
    const is = fx.lv('ice_special');
    if (is && !t.dead) fx.chill(t, iceBig(is));
    const pspc = fx.lv('poison_special');
    if (pspc && !t.dead) fx.poison(t, 1 + pspc);
    const hw = fx.lv('heal_wave'), p = G.player;
    // 치유의 회수: 돌아오는 진짜 창이 처음 맞힐 때 투척마다 한 번 (여러 마리 · 삼연 투척이어도 한 번, 2026-10-17)
    const sh = info.src;
    if (hw && info.back && p.alive && sh && !sh.phantom && !sh.healed) { sh.healed = true; p.hp = Math.min(p.maxHp, p.hp + 0.5 + 0.5 * hw); }
  },
});
BOON_FORMS.spear = {
  fire_basic:     { name: '불꽃 창날' },
  fire_bolt:      { name: '화염 관통', desc: lv => `2타째 찌르기가 앞으로 불길을 내뿜는다. 줄 위의 적에게 공격력의 ${pct(0.5 + 0.2 * lv)} 피해 + 화상, 불길이 잠시 남는다.` },
  fire_charge:    { name: '불꽃 꿰뚫기', desc: lv => `관통 찌르기 · 창기 일섬에 맞은 적에게 화상 2중첩, 찌른 줄을 따라 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  fire_special:   { name: '폭염 투척', desc: lv => `던진 창이 반환점에서 폭발한다. 주변에 공격력의 ${pct(0.8 + 0.4 * lv)} 피해 + 화상. 창에 맞은 적도 화상.` },
  ice_basic:      { name: '서리 창날' },
  ice_shard:      { name: '빙결 관통', desc: lv => `찌를 때마다 창끝에서 얼음 파편 ${1 + lv}개가 앞으로 날아간다 (공격력의 ${pct(0.25 + 0.05 * lv)} + 냉기). 뒤쪽에서 관통당한 적일수록 냉기가 더 쌓인다.` },
  ice_charge:     { name: '서리 꿰뚫기', desc: lv => `관통 찌르기 · 창기 일섬에 맞은 적에게 냉기 ${iceBig(lv)}중첩.` },
  ice_special:    { name: '서리 창', desc: lv => `창에 맞은 적에게 냉기 ${iceBig(lv)}중첩, 반환점에 ${2 + 0.5 * lv}초간 얼음 장판이 생긴다.` },
  elec_basic:     { name: '번개 창날' },
  elec_chain:     { name: '피뢰 관통', desc: lv => `찌르기가 맞으면 번개가 적에서 적으로 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.45 + 0.15 * lv)}) + 감전. 관통한 적끼리도 번개로 이어진다.` },
  elec_charge:    { name: '벼락 꿰뚫기', desc: lv => `관통 찌르기 · 창기 일섬 직후 창끝 주변 적 ${2 + lv}명에게 벼락 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  elec_special:   { name: '피뢰 창', desc: lv => `반환점에 벼락이 떨어진다 (주변에 공격력의 ${pct(0.8 + 0.4 * lv)}) + 감전. 날아가는 창에 맞은 적도 감전.` },
  poison_basic:   { name: '독날 창날' },
  poison_spray:   { name: '독 창끝', desc: lv => `창끝으로 맞히면 독이 ${1 + lv}중첩 더 쌓인다.` },
  poison_charge:  { name: '독안개 꿰뚫기', desc: lv => `찌른 줄을 따라 ${2 + 0.5 * lv}초간 독안개가 남는다. 안에 있는 적에게 계속 독.` },
  poison_special: { name: '독창', desc: lv => `창에 맞은 적에게 독 ${1 + lv}중첩, 반환점에 ${2 + 0.5 * lv}초간 독 웅덩이가 생긴다.` },
  atk_combo:      { name: '연속 찌르기', desc: lv => `기본공격 속도 +${15 * lv}%, 2타째 피해 +${30 * lv}%.` },
  atk_multispin:  { name: '연환 꿰뚫기', desc: lv => `관통 찌르기 · 창기 일섬 뒤 정령의 창이 같은 줄을 ${lv}번 더 찌른다. 추가 찌르기는 피해 ${pct(MULTISPIN_MULT)}, 마지막에만 넉백.` },
  atk_spin:       { name: '꿰뚫기 강화', desc: lv => `차지 시간 -${15 * lv}%, 관통 찌르기 · 창기 일섬 길이 +${10 * lv}%.` },
  atk_wave:       { name: '투척 강화', desc: lv => `창 비거리·속도 +${20 * lv}%, 투척 쿨타임 -${(0.15 * lv).toFixed(2)}초 (최소 0.5초).` },
  atk_thrust:     { name: '후려치기 강화', desc: lv => `후려치기 피해 +${40 * lv}%, 범위 +${10 * lv}%.` },
  sharp:          { name: '날카로운 창' },
  lifesteal:      { name: '흡혈 창날' },
  guard_spin:     { name: '수호의 자세', desc: lv => `관통 찌르기 · 창기 일섬 중과 찌른 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50% (무적은 아님).` },
  heal_wave:      { name: '치유의 회수', desc: lv => `돌아오는 창이 적을 맞히면 투척마다 체력 ${0.5 + 0.5 * lv} 회복 (여러 마리 · 삼연 투척이어도 한 번).` },
};

extendPlayer({
  // ── 창 ──
  // 2연 찌르기: 길고 좁은 직선, 최대 3명 관통. 창끝 ×1.8, 창대(가까이) ×0.6
  startPoke(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 2 : 0;
    this.aim(mag, SPEAR_AIM);
    const fin = this.combo === 1;
    this.act = { kind: fin ? 'pokeFin' : 'poke', t: 0, dur: (fin ? 0.18 : 0.15) / SPEAR_SPEED, hit: new Set(), pierced: 0, len: SPEAR_REACH * (fin ? 1.1 : 1) };
    this.act.noStep = mag < STEP_MIN || this.enemyInReach(this.act.len, 0.35);
    this.atkCd = (fin ? 0.46 : 0.3) / SPEAR_SPEED * (1 - 0.15 * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    this.atkBuffer = 0;
    Sfx.thrust();
    this.finisherT = fin ? 0.6 : 0; // 이 안에 바로 특수공격 → 삼연 투척 (다른 행동을 하면 끊긴다)
    FX.onPoke(this, fin);
  },
  // 관통 찌르기 (차지): 제자리에서 기본공격보다 조금 더 길게 찔러 줄 위의 적을 모두 관통
  get pierceLen() { return SPEAR_PIERCE_LEN * (1 + 0.1 * FX.lv('atk_spin') + 0.05 * this.mastery('spin')); },
  startLunge(mag) {
    this.finisherT = 0;
    this.aim(mag, SPEAR_AIM);
    // 연환 꿰뚫기(공격 축복): 찌른 뒤 정령의 창이 같은 줄을 레벨만큼 더 찌른다 (0.1초 간격)
    const ms = FX.lv('atk_multispin');
    this.act = { kind: 'lunge', t: 0, dur: 0.24 + 0.1 * ms, dur0: 0.24, hit: new Set(), pierced: 0, len: this.pierceLen, extra: ms, stabs: 0, opts: ms ? { kb: 40 } : undefined };
    this.atkCd = 0.5 + 0.1 * ms; this.charge = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '관통 찌르기', '#ffd24a', 12, 0.6);
    Sfx.thrust();
    FX.onPierce(this, this.act.len);
  },
  // 창기 일섬 (차지 2단): 창끝에서 빛의 창기가 일직선으로 멀리 뻗는다. 줄 위의 적을 모두 관통, 먼 쪽은 창끝 보너스
  get beamLen() { return SPEAR_BEAM_LEN * (1 + 0.1 * FX.lv('atk_spin') + 0.05 * this.mastery('spin')); },
  startSpearBeam(mag) {
    this.finisherT = 0;
    this.aim(mag, THROW_AIM);
    const ms = FX.lv('atk_multispin');
    this.act = { kind: 'spearBeam', t: 0, dur: 0.42 + 0.1 * ms, dur0: 0.42, hit: new Set(), pierced: 0, len: this.beamLen, extra: ms, stabs: 0 };
    this.atkCd = 0.6 + 0.1 * ms; this.charge = 0; this.comboT = 0;
    G.text(this.x, this.y - 26, '창기 일섬!', '#7fe0ff', 14, 0.7);
    Sfx.thrust(); Sfx.wave(true);
    FX.onPierce(this, this.act.len); // 속성 꿰뚫기 축복: 줄을 따라 불길 · 독안개, 수호의 자세
  },
  // 창 투척: 갔다가 자동으로 돌아온다. 돌아올 때까지 공격할 수 없다
  // 2타째 직후에 던지면 정령의 힘으로 만든 창 두 자루가 함께 날아간다 (삼연 투척)
  throwSpear(mag) {
    this.aim(mag, THROW_AIM);
    this.spearShot = new SpearShot(this, this.facing);
    G.projectiles.push(this.spearShot);
    const triple = this.finisherT > 0 && G.has('triple');
    if (triple) {
      for (const o of [-0.32, 0.32]) G.projectiles.push(new SpearShot(this, this.facing + o, true));
      G.text(this.x, this.y - 24, '삼연 투척!', '#7fe0ff', 13, 0.7);
    }
    this.finisherT = 0;
    this.act = { kind: 'cast', t: 0, dur: 0.14, hit: new Set() };
    this.charge = 0; this.holdT = 0; this.combo = 0; this.comboT = 0;
    Sfx.wave(triple);
  },
  // 후려치기 (대시 직후 공격): 창 자루로 앞쪽 120도를 휩쓴다. 바깥쪽(창끝)일수록 아프고, 옆으로 쳐낸다
  startSweep() {
    this.finisherT = 0;
    this.aim(Math.hypot(Input.state.mx, Input.state.my));
    this.act = { kind: 'sweep', t: 0, dur: 0.24 / SPEAR_SPEED, hit: new Set(), half: SWEEP_HALF, len: this.sweepLen };
    this.atkCd = 0.6 / SPEAR_SPEED; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '후려치기', '#9cdcff', 11, 0.5);
    Sfx.swing(true);
  },
  get sweepLen() { return SPEAR_REACH * (1 + 0.1 * FX.lv('atk_thrust')); },
  // 후려치기 판정: 오른쪽에서 왼쪽으로 쓸고 지나간 각도까지만 맞는다
  hitSweep(a) {
    const prog = clamp(a.t / (a.dur * 0.7), 0, 1), cur = -a.half + 2 * a.half * prog;
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
      if (d > a.len + t.r) continue;
      const ang = angDiff(Math.atan2(dy, dx), this.facing);
      if (d > t.r + 6 && (ang < -a.half - 0.15 || ang > cur)) continue;
      a.hit.add(t);
      const tip = d > a.len * SPEAR_TIP, haft = d < SPEAR_HAFT;
      // 쓸고 가는 방향(옆)으로 쳐낸다
      const side = Math.atan2(dy, dx) + Math.PI / 2;
      const nx = Math.cos(side) * 0.7 + dx / d * 0.3, ny = Math.sin(side) * 0.7 + dy / d * 0.3, nl = Math.hypot(nx, ny) || 1;
      if (tip) G.burst(t.x, t.y, 6, ['#fff', '#ffe18a'], 160);
      this.deal(t, 'sweep', nx / nl, ny / nl, { mult: tip ? SPEAR_TIP_MULT : haft ? SPEAR_HAFT_MULT : 1, tip });
    }
  },
  // 직선 판정 + 관통 제한 + 창끝/창대 배율
  hitSpear(a, len, width, maxN) {
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing), list = [];
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const dx = t.x - this.x, dy = t.y - this.y;
      const along = dx * fx + dy * fy, perp = Math.abs(dx * fy - dy * fx);
      if (along < -6 || along > len + t.r || perp > width + t.r) continue;
      list.push([along, t]);
    }
    list.sort((p, q) => p[0] - q[0]);
    for (const [along, t] of list) {
      if (maxN && a.pierced >= maxN) break;
      a.hit.add(t); a.pierced++;
      if (a.kind === 'lunge' || (a.kind === 'spearBeam' && a.opts)) { this.deal(t, a.kind, fx, fy, a.opts); continue; }
      const tip = along > len * SPEAR_TIP, haft = along < SPEAR_HAFT;
      if (tip) G.burst(t.x - fx * t.r, t.y - fy * t.r, 6, ['#fff', '#ffe18a'], 160);
      this.deal(t, a.kind, fx, fy, { mult: tip ? SPEAR_TIP_MULT : haft ? SPEAR_HAFT_MULT : 1, tip });
    }
  },
  drawSpear(g, x, y) {
    if (this.spearOut) return; // 던져서 손에 없다
    const cy = y - 1, a = this.act, f = this.facing, c = Math.cos(f), s = Math.sin(f);
    if (a && a.kind === 'sweep') {
      const p = clamp(a.t / (a.dur * 0.7), 0, 1), e = 1 - Math.pow(1 - p, 2);
      const ang = f - a.half + 2 * a.half * e;
      const ds = ElFx.slot('dash');
      if (ds) {
        ElFx.arc(g, ds, x, cy, a.len - 14, f - a.half, ang, 8, 0.6 * (1 - p * 0.6));
        if (Math.random() < 0.7) ElFx.spark(ds, x + Math.cos(ang) * (a.len - 14), cy + Math.sin(ang) * (a.len - 14));
      } else {
        g.strokeStyle = `rgba(255,240,200,${0.55 * (1 - p * 0.6)})`; g.lineWidth = 8;
        g.beginPath(); g.arc(x, cy, a.len - 14, f - a.half, ang); g.stroke();
      }
      spearSprite(g, x, cy, ang, 2);
    } else if (a && (a.kind === 'poke' || a.kind === 'pokeFin')) {
      const p = a.t / a.dur, e = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
      spearSprite(g, x, cy, f, -12 + e * 40);
      if (e > 0.4) { // 찌르기 궤적
        const bs = ElFx.slot('basic');
        if (bs) {
          ElFx.line(g, bs, x + c * 30, cy + s * 30, x + c * a.len, cy + s * a.len, a.kind === 'pokeFin' ? 4 : 3, 0.8 * e);
          if (Math.random() < 0.5) ElFx.spark(bs, x + c * a.len, cy + s * a.len);
        } else {
          g.strokeStyle = `rgba(255,255,255,${0.7 * e})`; g.lineWidth = a.kind === 'pokeFin' ? 3 : 2;
          g.beginPath(); g.moveTo(x + c * 30, cy + s * 30); g.lineTo(x + c * a.len, cy + s * a.len); g.stroke();
        }
      }
    } else if (a && a.kind === 'spearBeam') {
      const p = clamp(a.t / a.dur0, 0, 1), e = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      spearSprite(g, x, cy, f, -12 + 30 * Math.min(1, p / 0.15));
      const L = a.len * Math.min(1, p / 0.12), cs = ElFx.slot('charge');
      if (cs) ElFx.line(g, cs, x + c * 26, cy + s * 26, x + c * L, cy + s * L, 10, 0.8 * e);
      else { g.strokeStyle = `rgba(127,224,255,${0.55 * e})`; g.lineWidth = 12; g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * L, cy + s * L); g.stroke(); }
      g.strokeStyle = `rgba(255,255,255,${0.95 * e})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * L, cy + s * L); g.stroke();
      if (Math.random() < 0.8 * e) G.particles.push({ x: x + c * rand(30, L), y: cy + s * rand(30, L), vx: rand(-20, 20), vy: rand(-30, -5), life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#bff4ff' : '#fff', size: 2, grav: 0 });
      if (a.phantomAt !== undefined && a.t - a.phantomAt < 0.1) {
        const q = 1 - (a.t - a.phantomAt) / 0.1;
        g.strokeStyle = `rgba(127,224,255,${0.8 * q})`; g.lineWidth = 5; g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * a.len, cy + s * a.len); g.stroke();
      }
    } else if (a && a.kind === 'lunge') {
      const p = Math.min(1, a.t / (a.dur0 || a.dur)), e = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      spearSprite(g, x, cy, f, -12 + e * 46);
      if (a.phantomAt !== undefined && a.t - a.phantomAt < 0.1) { // 연환 꿰뚫기: 정령의 창 잔상
        const q = (a.t - a.phantomAt) / 0.1, ga = g.globalAlpha;
        g.globalAlpha = ga * 0.65 * (1 - q);
        spearSprite(g, x, cy, f, -12 + 46 * (1 - q * 0.4));
        g.strokeStyle = 'rgba(127,224,255,0.9)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * a.len, cy + s * a.len); g.stroke();
        g.globalAlpha = ga;
      }
      if (e > 0.2) { // 관통 궤적
        const cs = ElFx.slot('charge');
        if (cs) {
          ElFx.line(g, cs, x + c * 26, cy + s * 26, x + c * a.len, cy + s * a.len, 5, 0.85 * e);
          if (Math.random() < 0.8) ElFx.spark(cs, x + c * rand(26, a.len), cy + s * rand(26, a.len), 2);
        } else {
          g.strokeStyle = `rgba(255,220,120,${0.8 * e})`; g.lineWidth = 5;
          g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * a.len, cy + s * a.len); g.stroke();
        }
        g.strokeStyle = `rgba(255,255,255,${0.9 * e})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + c * 26, cy + s * 26); g.lineTo(x + c * a.len, cy + s * a.len); g.stroke();
      }
    } else {
      spearSprite(g, x + c * 2, cy + 5, f - 0.45, -14);
    }
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
    if (a.kind === 'poke' || a.kind === 'pokeFin') {
      if (a.t < a.dur * 0.4 && !a.noStep && this.inMag >= STEP_MIN) World.move(this, fx * 60 * dt, fy * 60 * dt);
      if (a.t > a.dur * 0.2) this.hitSpear(a, a.len, SPEAR_WIDTH, SPEAR_PIERCE);
      return true;
    }
    if (a.kind === 'lunge') {
      const d0 = a.dur0 || a.dur;
      if (a.t > d0 * 0.15 && a.t < d0 * 0.7) this.hitSpear(a, a.len, SPEAR_WIDTH + 2, 0);
      else if (a.t >= d0 * 0.7 && !a.ended) { a.ended = true; FX.onLungeEnd(this); }
      // 연환 꿰뚫기: 정령의 창이 같은 줄을 다시 찌른다 (한 번에 줄 전체 판정)
      if (a.stabs < (a.extra || 0) && a.t >= d0 * 0.7 + 0.1 * a.stabs) {
        a.stabs++; a.hit = new Set(); a.phantomAt = a.t;
        a.opts = { mult: MULTISPIN_MULT, kb: a.stabs < a.extra ? 40 : undefined };
        this.hitSpear(a, a.len, SPEAR_WIDTH + 2, 0);
        G.burst(this.x + fx * a.len, this.y - 1 + fy * a.len, 5, ['#7fe0ff', '#fff'], 120); Sfx.thrust();
      }
      return true;
    }
    if (a.kind === 'spearBeam') {
      const d0 = a.dur0;
      if (a.t > 0.06 && !a.fired) { // 쏜 순간 줄 전체를 한 번에
        a.fired = true;
        const wb = World.shotLineBlock(this.x, this.y, this.x + fx * a.len, this.y + fy * a.len);
        if (wb >= 0) a.len = Math.max(30, wb + 6); // 나무 · 바위에 막히면 거기까지 (2026-10-18)
        this.hitSpear(a, a.len, SPEAR_BEAM_WIDTH, 0);
        G.shake = Math.max(G.shake, 6); G.hitstop = Math.max(G.hitstop, 0.05); Input.rumble(0.7, 160);
        G.burst(this.x + fx * a.len, this.y - 2 + fy * a.len, 12, ['#bff4ff', '#fff', '#7fe0ff'], 200);
        FX.onLungeEnd(this, a.len); // 벼락 꿰뚫기: 끝 쪽 벼락
      }
      if (a.fired && a.stabs < (a.extra || 0) && a.t >= 0.06 + 0.1 * (a.stabs + 1)) { // 연환: 창기가 다시 뻗는다
        a.stabs++; a.hit = new Set(); a.phantomAt = a.t;
        a.opts = { mult: MULTISPIN_MULT, kb: a.stabs < a.extra ? 40 : undefined };
        this.hitSpear(a, a.len, SPEAR_BEAM_WIDTH, 0); Sfx.thrust();
      }
      return true;
    }
    if (a.kind === 'sweep') {
      if (a.t < a.dur * 0.4) World.move(this, fx * 90 * dt, fy * 90 * dt); // 대시 기세로 살짝 미끄러진다
      this.hitSweep(a);
      return true;
    }
});

Object.assign(FX, {
  // ── 창 ──
  // 찌를 때 (fin = 2타째)
  onPoke(p, fin) {
    const atk = p.atk, f = p.facing, c = Math.cos(f), s = Math.sin(f);
    const fb = this.lv('fire_bolt');
    if (fb && fin) {
      const len = SPEAR_REACH + 60;
      for (let d = 24; d <= len; d += 18) this.zone(p.x + c * d, p.y + s * d + 4, 'fire', 1.2 + 0.3 * fb);
      for (let i = 0; i < 14; i++) {
        const d = rand(20, len);
        G.particles.push({ x: p.x + c * d, y: p.y + s * d, vx: c * 60, vy: s * 60 - 20, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff7a3c' : '#ffd24a', size: 3, grav: 0 });
      }
      for (const t of this.near(p.x, p.y, len)) {
        const dx = t.x - p.x, dy = t.y - p.y, along = dx * c + dy * s;
        if (along < 0 || Math.abs(dx * s - dy * c) > 16 + t.r) continue;
        this.burn(t, 1);
        this.damage(t, atk * (0.5 + 0.2 * fb), '#ff9a4a', 11);
      }
      Sfx.boom();
    }
    const is = this.lv('ice_shard');
    if (is) {
      const n = 1 + is, spread = 0.24;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1);
        G.projectiles.push(new FxShot(p.x + c * 30, p.y - 4 + s * 30, f + o, {
          kind: 'ice', speed: 380, life: 0.42, r: 5, pierce: true,
          onHit: t => { this.chill(t, 1); this.damage(t, atk * (0.25 + 0.05 * is), '#bfefff', 10); },
        }));
      }
      Sfx.freeze();
    }
  },
  // 관통 찌르기를 할 때: 찌른 줄을 따라 불길 · 독안개, 수호의 자세
  onPierce(p, len) {
    const gs = this.lv('guard_spin');
    if (gs) p.spinGuardT = p.act.dur + 0.5 + 0.5 * gs; // 창은 무적 없이 피해 감소만
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (!fc && !pc) return;
    const c = Math.cos(p.facing), s = Math.sin(p.facing);
    for (let d = 26; d <= len; d += 16) {
      if (fc) this.zone(p.x + c * d, p.y + s * d + 4, 'fire', 1.5 + 0.5 * fc);
      if (pc) this.zone(p.x + c * d, p.y + s * d + 4, 'poison', 2 + 0.5 * pc);
    }
  },
  onLungeEnd(p, len) {
    const ec = this.lv('elec_charge');
    if (ec) {
      const L = (len || p.pierceLen) * 0.7, tx = p.x + Math.cos(p.facing) * L, ty = p.y + Math.sin(p.facing) * L;
      const list = this.near(tx, ty, 110).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
    }
  },
  // 던진 창이 가장 멀리 간 지점
  onSpearApex(sh) {
    const atk = G.player.atk, x = sh.x, y = sh.y;
    const fs = this.lv('fire_special');
    if (fs) this.explode(x, y, 60, atk * (0.8 + 0.4 * fs), '#ff7a3c', true);
    const es = this.lv('elec_special');
    if (es) this.strike(x, y, 60, atk * (0.8 + 0.4 * es));
    const is = this.lv('ice_special'), ps = this.lv('poison_special');
    if (is || ps) {
      const kind = is ? 'ice' : 'poison', life = 2 + 0.5 * (is || ps);
      this.zone(x, y + 4, kind, life);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 24, y + 4 + Math.sin(a) * 18, kind, life); }
      if (is && ps) for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 30, y + 4 + Math.sin(a) * 22, 'poison', 2 + 0.5 * ps); }
    }
  },
  // 벽꿍: 창에 밀려난 적이 벽(나무 · 바위 · 물가 · 숲 테두리)에 부딪혔다
  wallSlam(e) {
    e.slamT = 0; e.kvx = e.kvy = 0;
    if (e.dead) return;
    const sb = G.player.weapon.slamBoon ? this.lv(G.player.weapon.slamBoon) : 0; // 벽꿍 강화 (방패: 기습 자리)
    e.stun = Math.max(e.stun || 0, 1.0 + 0.3 * sb);
    G.text(e.x, e.y - e.r - 18, '벽꿍!', '#ffb84a', 13, 0.8);
    G.burst(e.x, e.y, 10, ['#d8c8a8', '#fff'], 150);
    G.shake = Math.max(G.shake, 4); Sfx.guardBreak();
    this.damage(e, G.player.atk * WALL_SLAM_MULT * (1 + 0.6 * sb), '#ffb84a', sb ? 15 : 13);
  },
});

function spearSprite(g, x, y, a, ext) {
  const im = ART.img.spear, w = im.width * PIX, h = im.height * PIX;
  g.save();
  g.translate(x + Math.cos(a) * ext, y + Math.sin(a) * ext);
  g.rotate(a + Math.PI / 2);
  g.drawImage(im, -w / 2, -h * 0.72, w, h);
  g.restore();
}

// 던진 창: 정해진 거리까지 날아갔다가 플레이어에게 돌아온다. 가는 길 · 오는 길 모두 관통
class SpearShot {
  constructor(p, dir, phantom) {
    const k = 1 + 0.2 * FX.lv('atk_wave');
    this.phantom = !!phantom; // 삼연 투척의 정령 창: 돌아오면 사라진다 (손이 비는 건 진짜 창만)
    this.x = p.x; this.y = p.y - 2; this.dir = dir;
    this.range = SPEAR_THROW_RANGE * k; this.speed = 520 * k * SPEAR_SPEED; this.backSpeed = 640 * k * SPEAR_SPEED;
    this.dist = 0; this.back = false; this.hit = new Set(); this.done = false; this.t = 0;
  }
  update(dt) {
    const p = G.player;
    this.t += dt;
    let nx, ny;
    if (!this.back) {
      nx = Math.cos(this.dir); ny = Math.sin(this.dir);
      const step = this.speed * dt;
      this.x += nx * step; this.y += ny * step; this.dist += step;
      const wall = World.shotBlockedAt(this.x, this.y + 6); // 나무 · 바위에 꽂히면 거기가 반환점 (2026-10-18)
      if (wall) { this.x -= nx * step; this.y -= ny * step; G.burst(this.x, this.y, 6, ['#d8c8a8', '#fff'], 120); Sfx.block(); }
      if (wall || this.dist >= this.range) { this.back = true; this.hit = new Set(); FX.onSpearApex(this); }
    } else {
      const dx = p.x - this.x, dy = p.y - 2 - this.y, d = Math.hypot(dx, dy) || 1;
      nx = dx / d; ny = dy / d;
      const step = Math.min(d, this.backSpeed * dt);
      this.x += nx * step; this.y += ny * step;
      if (d < 16 || this.t > 3) { this.done = true; if (!this.phantom) Sfx.pickup(); else G.burst(this.x, this.y, 5, ['#7fe0ff', '#fff'], 60); return; }
    }
    clearShotsNear(this.x, this.y, 14);
    for (const t of G.targets()) {
      if (this.hit.has(t) || Math.hypot(t.x - this.x, t.y - this.y) > t.r + 12) continue;
      this.hit.add(t);
      p.deal(t, 'spear', nx, ny, { back: this.back, mult: this.back ? SPEAR_BACK_MULT : 1, src: this });
    }
  }
  draw(g) {
    const c = Math.cos(this.dir), s = Math.sin(this.dir);
    const a = g.globalAlpha;
    if (this.phantom) g.globalAlpha = a * 0.6;
    const ss = ElFx.slot('special');
    if (ss) {
      ElFx.line(g, ss, this.x - c * 30, this.y - s * 30, this.x + c * 10, this.y + s * 10, 3, this.phantom ? 0.5 : 0.7);
      if (Math.random() < 0.6) ElFx.spark(ss, this.x - c * 12, this.y - s * 12);
    } else {
      g.strokeStyle = this.phantom ? 'rgba(127,224,255,0.6)' : 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(this.x - c * 30, this.y - s * 30); g.lineTo(this.x + c * 10, this.y + s * 10); g.stroke();
    }
    spearSprite(g, this.x, this.y, this.dir, -14);
    g.globalAlpha = a;
  }
}
