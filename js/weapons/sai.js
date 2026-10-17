'use strict';
// ── 정령의 쌍검: 연타형 · 가장 빠른 연타와 기세, 그림자 연참, 받아치기 ──

// 쌍검 수치 (2026-10-17)
const SAI_REACH = 32;           // 찌르기 사거리 (검 37 · 창 74) — 가장 짧다
const SAI_FIN_REACH = 36;       // 3타째 X자 베기
const MOMENTUM_MAX = 5;         // 기세 최대 칸
const MOMENTUM_SPEED = 0.05;    // 기세 한 칸마다 공격 · 이동 속도 +5%
const MOMENTUM_TIME = 1.5;      // 이 시간 동안 기본공격을 못 맞히면 기세가 사라진다
const MOMENTUM_RUSH = 0.2;      // 그림자 연참이 기세를 다 써서 한 칸마다 피해 +20%
const RUSH_LEN = 89;            // 그림자 연참 거리 (110 → 99 → 89, 2026-10-17)
const RUSH_TIME = 0.16;         // 그림자 연참으로 지나가는 시간 (무적)
const RUSH_WIDTH = 16;          // 연참 판정 폭
const PARRY_TIME = 0.4;         // 받아치기 막는 시간
const PARRY_TRIPLE = 0.6;       // 3타째 직후 교차 받아치기
const PARRY_STUN = 0.8;         // 반격에 맞은 적 기절 (보스 제외)
const PARRY_WIDE_R = 70;        // 교차 받아치기: 주변 적도 함께 벤다
const RIPOSTE_TIME = 0.14;      // 반격으로 베고 지나가는 시간 (무적)
const RIPOSTE_SAFE = 0.35;      // 도착한 뒤에도 이만큼 무적
const RIPOSTE_PAST = 30;        // 적을 지나 이만큼 더 간다
const RIPOSTE_MAX = 150;        // 반격 돌진 최대 거리
const RUSH_FREE_T = 2.0;        // 그림자 연참이 적을 맞히면 이 시간 안의 받아치기는 충전 · 쿨타임 없이 (2026-10-17)
const PURSUIT_LEN = 100;        // 잔영 베기: 연참 적중 뒤 평타로, 보는 방향으로 반격처럼 베고 지나가는 거리 (2026-10-17)
const PARRY_CHAIN_T = 2.0;      // 연속 반격: 이 안에 또 받아치면 연속으로 친다 (성공할 때마다 충전 한 칸을 돌려받는다, 2026-10-17)
const WHIRL_R = 40;             // 선풍 베기 반경
const RUSH_AIM = { range: 140, half: AIM_HALF_ANGLE, moveHalf: 20 * Math.PI / 180 };

Object.assign(MOVES, {
// 쌍검: 한 방은 약하지만 가장 빠르다
saiJab:  { mult: 0.75, kb: 110, guardBreak: false, role: 'basic', light: true, momentum: true },
saiFin:  { mult: 1.3, kb: 280, guardBreak: true, role: 'fin', momentum: true },    // 3타째 X자 교차 베기
rush:    { mult: 2.2, kb: 160, guardBreak: true, role: 'charge' },    // 그림자 연참 (차지), 기세 한 칸마다 +20%
riposte: { mult: 2.5, kb: 300, guardBreak: true, role: 'special' },    // 받아치기 반격 (특수): 언제나 반격 치명타
whirl:   { mult: 1.3, kb: 220, guardBreak: false, role: 'dash', momentum: true },   // 선풍 베기 (대시 공격)
});

// 쌍검(사이): 가장 빠른 연타 + 기세. 사거리가 가장 짧고, 강한 한 방은 받아치기 타이밍에 달렸다 (2026-10-17, 건틀릿을 대신함)
addWeapon('sai', {
  name: '정령의 쌍검',
  style: '연타형 · 가장 빠른 쌍검 연타와 기세, 받아치기 · 사거리가 가장 짧음',
  essence: '무기의 정수',
  unlockCost: 2,             // 영웅의 증표: 창 1 · 쌍검 2 · 마법봉 3 (뒤 무기일수록 하나씩 더, 2026-10-17)
  moves: { basic: '3연타', charged: '그림자 연참', special: '받아치기', dashAttack: '선풍 베기' },
  chargeTime: 0.25, // 쌍검은 빠르게 모은다 (0.55 → 0.25, 누르고 0.22초 뒤부터 모으니 전체 0.77초 → 0.47초, 2026-10-17)
  specialCd: 3.0,
  cdPerLv: 0.4, cdPerMastery: 0.3, cdFloor: 1.5,
  speedMult: 1,
  dashCharges: 3,
  dashSpeed: 300,
  dashCdMult: 0.8 / DASH_CD, // 대시 1칸 충전 0.8초 · 3회 · 거리는 짧다
  skillCd: 0,
  basic: (p, mag) => p.freeSpecialT > 0 ? p.startPursuit(mag) : p.startJab(mag), // 연참 적중 뒤엔 잔영 베기
  basicAfterDash: p => p.startWhirl(),
  charged: (p, mag) => p.startRush(mag),
  special: (p, mag) => p.startParry(mag),
  skill: null,
  rows: (A, P, D) => [
    ['기본 · 3연타', `${A} ${A} ${A}`, '아주 빠르지만 짧다 · 3타째 X자 베기 · 가드 브레이크'],
    ['기세', '기본공격을 맞힐 때마다 +1 (최대 5)', `한 칸마다 공격 · 이동 속도 +5% · ${MOMENTUM_TIME}초 못 때리거나 맞으면 0`],
    ['차지 · 그림자 연참', `${A} 길게 눌렀다 떼기`, '앞으로 순식간에 지나가며 베기 · 무적 · 기세를 다 써서 한 칸마다 +20% · 맞히면 2초 안의 받아치기는 충전 소모 없음, 평타를 누르면 잔영 베기'],
    ['잔영 베기', `연참 적중 뒤 2초 안에 ${A}`, '보는 방향으로 베고 지나가며 반격 치명타 + 기절 · 무적'],
    ['특수 · 받아치기', `${P} (쿨타임 3초)`, '0.4초 막는 자세 · 그 사이 맞으면 막고 반격 치명타 + 기절 + 기세 +2 · 성공하면 쿨타임이 바로 풀려 연속 반격'],
    ['대시', `${D} (쿨타임 ${+(DASH_CD * WEAPONS.sai.dashCdMult).toFixed(2)}초 · 3회)`, '짧고 빠른 연속 대시'],
    ['선풍 베기', `${D} → ${A}`, '한 바퀴 돌며 주변을 벤다', 'thrust'],
    ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
    ['교차 받아치기', `3타째 직후 ${P}`, '막는 시간 0.6초 · 반격이 주변 적 모두에게', 'triple'],
  ],
  notesTitle: '쌍검 특성 · 기세와 받아치기',
  notes: [
    '기세는 쌍검만 쓰는 전투 자원이에요. 캐릭터 머리 위 주황색 점 5개로 보여요.',
    '쌓기: 기본공격(찌르기 · X자 베기 · 선풍 베기)이 맞으면 동작마다 1칸, 받아치기에 성공하면 2칸. 최대 5칸이에요.',
    '효과: 쌓인 1칸마다 공격 속도와 이동 속도 +5% (5칸이면 +25%).',
    '쓰기: 그림자 연참이 기세를 모두 써서 1칸마다 피해 +20% (5칸이면 2배).',
    '사라짐: 1.5초 동안 기본공격을 못 맞히거나, 적에게 맞으면 0이 돼요. 꺼지기 직전엔 점이 흐려져요.',
    '받아치기: 막는 자세(0.4초) 중에 공격을 받으면 피해 없이 그 적을 향해 베고 지나가요. 지나가는 동안과 도착 직후는 무적, 길 위의 적은 모두 반격 치명타 + 기절.',
  ],
  comboLen: 3,
  shieldHint: '저 방패병은 정면 공격을 막아요! 3타째 X자 베기나 그림자 연참은 방패를 깨요. 받아치기로 공격을 막아도 기절해요.',
  mastery: [
    { id: 'combo',  name: '교차 베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `3타째 X자 베기 피해 +${15 * lv}%` },
    { id: 'spin',   name: '그림자 연참 숙련', max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 연참 거리 +${3 * lv}%` },
    { id: 'wave',   name: '받아치기 숙련',    max: 3, cost: [3, 5, 8], desc: lv => `받아치기 쿨타임 -${(0.3 * lv).toFixed(1)}초 (최소 1.5초)` },
    { id: 'thrust', name: '선풍 베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `선풍 베기 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.sai, {
  draw: (p, g, x, y) => p.drawSai(g, x, y),
  dodgeText: '대시 · 받아치기 준비!',
  padIcon(b) { // 받아치기: 교차한 두 칼 + 막는 호
    const q = b.r * 0.4;
    ctx.beginPath(); ctx.moveTo(b.x - q, b.y + q); ctx.lineTo(b.x + q, b.y - q); ctx.moveTo(b.x + q, b.y + q); ctx.lineTo(b.x - q, b.y - q); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y + q * 0.4, q * 1.5, -2.4, -0.7); ctx.stroke();
  },
  glyph: {
    basic(g, s, line) { line(-0.7, 0.7, 0.7, -0.7); line(0.7, 0.7, -0.7, -0.7); line(-0.65, 0.25, -0.25, 0.65); line(0.65, 0.25, 0.25, 0.65); }, // 교차한 쌍검
    charge(g, s, line) { line(-0.9, 0, 0.55, 0); g.beginPath(); g.moveTo(0.9 * s, 0); g.lineTo(0.45 * s, -0.3 * s); g.lineTo(0.45 * s, 0.3 * s); g.closePath(); g.fill(); line(-0.8, -0.45, -0.2, -0.45); line(-0.8, 0.45, -0.2, 0.45); }, // 그림자 연참
    special(g, s, line) { g.beginPath(); g.arc(0, 0.25 * s, 0.75 * s, -2.5, -0.65); g.stroke(); line(-0.45, 0.6, 0.45, -0.2); line(0.45, 0.6, -0.45, -0.2); }, // 받아치기
  },
});
// 쌍검: 기본 = 3연타, 차지 = 그림자 연참, 특수 = 받아치기, 대시 공격 = 선풍 베기
BOON_FORMS.sai = {
  fire_basic:     { name: '불꽃 쌍검' },
  fire_bolt:      { name: '화염구 연타', desc: lv => `찌를 때마다 화염구가 날아가 처음 닿은 적 자리에서 폭발 (공격력의 ${pct(0.5 + 0.2 * lv)} + 화상). 3타째는 3발.` },
  fire_charge:    { name: '화염 연참', desc: lv => `연참에 베인 적에게 화상 2중첩, 지나간 길에 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  fire_special:   { name: '작열 받아치기', desc: lv => `받아치기 · 잔영 베기 때 주변이 폭발한다. 공격력의 ${pct(0.8 + 0.4 * lv)} 피해 + 화상.` },
  ice_basic:      { name: '서리 쌍검' },
  ice_shard:      { name: '얼음 파편 연타', desc: lv => `찌를 때마다 얼음 파편 ${1 + lv}개가 부채꼴로 날아가 적을 관통하며 냉기 1중첩 (공격력의 ${pct(0.25 + 0.05 * lv)}).` },
  ice_charge:     { name: '빙결 연참', desc: lv => `연참에 베인 적에게 냉기 ${iceBig(lv)}중첩.` },
  ice_special:    { name: '서리 받아치기', desc: lv => `받아치기 · 잔영 베기 때 주변 적에게 냉기 ${iceBig(lv)}중첩, 발밑이 얼어붙는다.` },
  elec_basic:     { name: '번개 쌍검' },
  elec_chain:     { name: '연쇄 번개 쌍검' },
  elec_charge:    { name: '뇌전 연참', desc: lv => `연참이 끝난 자리 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  elec_special:   { name: '뇌격 받아치기', desc: lv => `받아치기 · 잔영 베기 때 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.4 * lv)}) + 감전.` },
  poison_basic:   { name: '독날 쌍검' },
  poison_charge:  { name: '독안개 연참', desc: lv => `지나간 길에 ${2 + 0.5 * lv}초간 독안개. 안에 있는 적에게 계속 독.` },
  poison_special: { name: '독 받아치기', desc: lv => `받아치기 · 잔영 베기 때 주변 적에게 독 ${1 + lv}중첩.` },
  atk_combo:      { name: '연속 베기' },
  atk_spin:       { name: '연참 강화', desc: lv => `차지 시간 -${15 * lv}%, 연참 거리 +${15 * lv}%.` },
  atk_multispin:  { name: '그림자 분신', desc: lv => `연참 뒤 그림자가 같은 길을 ${lv}번 더 벤다. 그림자 베기는 피해 ${pct(MULTISPIN_MULT)}, 마지막에만 넉백.` },
  atk_wave:       { name: '받아치기 강화', desc: lv => `막는 시간 +${(0.1 * lv).toFixed(1)}초, 쿨타임 -${(0.4 * lv).toFixed(1)}초 (최소 1.5초).` },
  atk_thrust:     { name: '선풍 강화', desc: lv => `선풍 베기 피해 +${40 * lv}%, 범위 +${10 * lv}%.` },
  sharp:          { name: '날카로운 쌍검' },
  lifesteal:      { name: '흡혈 쌍검' },
  guard_spin:     { name: '수호의 연참', desc: lv => `연참이 끝난 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  heal_wave:      { name: '치유의 받아치기', desc: lv => `받아치기 · 잔영 베기마다 체력 ${3 * lv} 회복.` },
};

extendPlayer({
  get momSpeed() { return 1 + MOMENTUM_SPEED * this.momentum; }, // 기세: 공격 · 이동 속도
  // ── 쌍검 ──
  // 3연타: 왼손 찌르기 · 오른손 찌르기 · X자 교차 베기. 가장 빠르고 가장 짧다
  startJab(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.aim(mag);
    const fin = this.combo === 2, spd = this.momSpeed;
    this.act = {
      kind: fin ? 'saiFin' : 'saiJab', t: 0, dur: (fin ? 0.16 : 0.12) / spd, hit: new Set(),
      range: fin ? SAI_FIN_REACH : SAI_REACH, half: fin ? 1.1 : 0.85, hand: this.combo === 1 ? -1 : 1,
    };
    this.act.noStep = mag < STEP_MIN || this.enemyInReach(this.act.range, this.act.half);
    this.atkCd = (fin ? 0.34 : 0.17) * (1 - 0.15 * FX.lv('atk_combo')) / spd;
    this.comboT = this.atkCd + 0.3;
    this.finisherT = fin ? 0.6 : 0; // 이 안에 바로 특수공격 → 교차 받아치기
    this.atkBuffer = 0;
    Sfx.swing(fin);
    FX.onSwing(this, fin);
  },
  // 그림자 연참 (차지): 앞으로 순식간에 지나가며 길 위의 적을 모두 벤다. 지나가는 동안 무적. 기세를 다 써서 한 칸마다 +20%
  get rushLen() { return RUSH_LEN * (1 + 0.15 * FX.lv('atk_spin') + 0.03 * this.mastery('spin')); }, // 숙련 거리 +8% → +3% (2026-10-17)
  startRush(mag) {
    this.finisherT = 0;
    this.aim(mag, RUSH_AIM);
    const ms = FX.lv('atk_multispin'), mom = this.momentum; // 그림자 분신: 레벨마다 같은 길을 한 번 더
    this.act = { kind: 'rush', t: 0, dur: RUSH_TIME + 0.14 + 0.1 * ms, dur0: RUSH_TIME, hit: new Set(), x0: this.x, y0: this.y, px: this.x, py: this.y, mom, extra: ms, cuts: 0, len: this.rushLen };
    this.invuln = Math.max(this.invuln, RUSH_TIME + 0.1);
    this.atkCd = 0.45 + 0.1 * ms; this.charge = 0; this.comboT = 0;
    this.momentum = 0;
    G.text(this.x, this.y - 24, mom ? `그림자 연참 · 기세 ${mom}` : '그림자 연참', '#ffd24a', 12, 0.6);
    Sfx.dash();
  },
  // 선분(x0,y0)-(x1,y1) 근처의 적을 벤다
  hitPath(a, x0, y0, x1, y1, mult, kb) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const k = clamp(((t.x - x0) * dx + (t.y - y0) * dy) / L2, 0, 1);
      if (Math.hypot(t.x - (x0 + dx * k), t.y - (y0 + dy * k)) > RUSH_WIDTH + t.r) continue;
      a.hit.add(t);
      this.deal(t, 'rush', fx, fy, { mult, kb });
      if (!a.freed) { // 첫 적중: 반짝 + 푸른 원, 받아치기 무료
        a.freed = true; this.freeSpecialT = RUSH_FREE_T;
        G.fxRing(this.x, this.y, '#7fe0ff', 40); G.fxRing(this.x, this.y, '#ffffff', 22);
        G.burst(this.x, this.y - 4, 14, ['#ffffff', '#bff4ff', '#7fe0ff'], 200);
        G.text(this.x, this.y - 34, '반격 준비!', '#7fe0ff', 12, 0.8); Sfx.charged();
      }
      G.burst(t.x, t.y - 4, 6, ['#fff', '#cfe8ff'], 140);
    }
  },
  // 받아치기 (특수): 잠깐 막는 자세. 그 사이 공격을 받으면 G.hurtPlayer 가 parry() 를 부른다
  startParry(mag) {
    this.aim(mag);
    const wide = this.finisherT > 0 && G.has('triple');
    const win = (wide ? PARRY_TRIPLE : PARRY_TIME) + 0.1 * FX.lv('atk_wave');
    this.parryT = win; this.parryWide = wide;
    this.finisherT = 0;
    this.act = { kind: 'parry', t: 0, dur: win, hit: new Set() };
    if (wide) G.text(this.x, this.y - 24, '교차 받아치기', '#7fe0ff', 12, 0.6);
    Sfx.swing(false);
  },
  // 막았다: 피해 없이 반격. 공격한 적을 향해 직선으로 베고 지나간다 (지나가는 동안 · 도착한 뒤 잠깐 무적)
  // 길 위의 적은 모두 반격 치명타 + 기절, 기세 +2. 교차 받아치기는 주변 적도 함께 벤다
  // 잔영 베기: 연참이 맞은 뒤 (무료 받아치기 대신) 평타를 누르면 보는 방향으로 바로 반격 돌진. 반격처럼 치명타 + 기절
  startPursuit(mag) {
    this.freeSpecialT = 0; this.aim(mag);
    this.invuln = Math.max(this.invuln, RIPOSTE_TIME + RIPOSTE_SAFE);
    this.act = { kind: 'riposte', t: 0, dur: RIPOSTE_TIME + 0.3, dash: RIPOSTE_TIME, hit: new Set(), x0: this.x, y0: this.y, px: this.x, py: this.y, len: PURSUIT_LEN, marks: [], wide: false };
    this.atkBuffer = 0; this.atkCd = 0.3; this.comboT = 0; this.finisherT = 0;
    G.text(this.x, this.y - 30, '잔영 베기!', '#c8b4ff', 16, 0.9);
    G.fxRing(this.x, this.y, '#ffffff', 22); G.burst(this.x, this.y - 4, 12, ['#ffffff', '#c8b4ff', '#7fe0ff'], 200);
    G.shake = Math.max(G.shake, 4); Sfx.dash(); Input.rumble(0.5, 120);
    FX.onParry(this); // 받아치기 축복(폭발 · 냉기 · 낙뢰 · 독 · 치유)이 잔영 베기에도 그대로
  },
  parry(src) {
    this.parryT = 0;
    let target = null, bd = 120;
    for (const t of G.targets()) { const d = t === src ? -1 : Math.hypot(t.x - this.x, t.y - this.y) - t.r; if (d < bd) { bd = d; target = t; } }
    const dir = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facing;
    const len = target ? clamp(Math.hypot(target.x - this.x, target.y - this.y) + target.r + RIPOSTE_PAST, 50, RIPOSTE_MAX) : 50;
    this.facing = dir;
    this.invuln = Math.max(this.invuln, RIPOSTE_TIME + RIPOSTE_SAFE);
    this.act = { kind: 'riposte', t: 0, dur: RIPOSTE_TIME + 0.3, dash: RIPOSTE_TIME, hit: new Set(), x0: this.x, y0: this.y, px: this.x, py: this.y, len, marks: [], wide: this.parryWide };
    if (this.parryWide) for (const t of G.targets()) { if (Math.hypot(t.x - this.x, t.y - this.y) < PARRY_WIDE_R + t.r) this.riposteHit(t); }
    this.momentum = Math.min(MOMENTUM_MAX, this.momentum + 2); this.momT = MOMENTUM_TIME;
    // 연속 반격: 성공하면 쓴 충전을 돌려받아 바로 다음 받아치기로 이어 간다
    if (this.specMax > 1) this.specStock = Math.min(this.specMax, this.specStock + 1);
    else this.specialCd = 0; // 한 칸짜리: 쿨타임을 바로 풀어 준다 (쌍검 충전 2 → 1, 2026-10-17)
    this.parryChain = G.time - (this.parryLastT ?? -99) < PARRY_CHAIN_T ? (this.parryChain || 1) + 1 : 1; this.parryLastT = G.time;
    G.text(this.x, this.y - 30, this.parryChain > 1 ? '연속 반격 ×' + this.parryChain + '!' : '받아치기!', this.parryChain > 1 ? '#ffe18a' : '#7fe0ff', 16 + Math.min(6, this.parryChain - 1), 0.9);
    G.fxRing(this.x, this.y, '#ffffff', 26); G.fxRing(this.x, this.y, '#7fe0ff', this.parryWide ? PARRY_WIDE_R : 44);
    G.burst(this.x, this.y - 4, 18, ['#ffffff', '#bff4ff', '#7fe0ff'], 220);
    G.hitstop = Math.max(G.hitstop, 0.08); G.shake = Math.max(G.shake, 6);
    Sfx.guardBreak(); Sfx.dodge(); Input.rumble(0.7, 160);
    FX.onParry(this);
  },
  riposteHit(t) {
    const a = this.act;
    if (a.hit.has(t)) return;
    a.hit.add(t);
    const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
    this.counterT = 1; // 반격은 언제나 치명타 (deal 이 쓰고 지운다)
    this.deal(t, 'riposte', dx / d, dy / d);
    if (!t.dead && t.type !== 'boss' && !t.superArmor) t.stun = Math.max(t.stun || 0, PARRY_STUN);
    a.marks.push({ x: t.x, y: t.y - 4, t: a.t, ang: this.facing + rand(-0.5, 0.5) });
    G.burst(t.x, t.y - 4, 12, ['#ffffff', '#bff4ff', '#ffe18a'], 200);
  },
  // 선풍 베기 (대시 직후 공격): 쌍검으로 한 바퀴 돌며 주변을 벤다
  get whirlR() { return WHIRL_R * (1 + 0.1 * FX.lv('atk_thrust')); },
  startWhirl() {
    this.finisherT = 0;
    this.act = { kind: 'whirl', t: 0, dur: 0.24, hit: new Set() };
    this.atkCd = 0.4; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '선풍 베기', '#9cdcff', 11, 0.5);
    Sfx.spin();
  },
  // 쌍검: 양손의 사이 + 기세 칸
  drawSai(g, x, y) {
    if (this.freeSpecialT > 0) { // 무료 받아치기 준비: 몸을 두른 푸른 원 (끝나 갈수록 깜빡임)
      if (this.freeSpecialT > 0.5 || Math.sin(G.time * 30) > 0) {
        g.globalAlpha = 0.5 + 0.25 * Math.sin(G.time * 12); g.strokeStyle = '#7fe0ff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y - 4, 12, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      }
    }
    const cy = y - 1, a = this.act, f = this.facing, c = Math.cos(f), s = Math.sin(f), px = -s, py = c;
    const at = (fwd, side) => [x + c * fwd + px * side, cy + s * fwd + py * side];
    const idle = side => { const [hx, hy] = at(3, side * 7); saiSprite(g, hx, hy, f + side * 0.9 + (side > 0 ? 0.4 : -0.4), 0); };
    const slashFx = (key, fwd, k, frac, flip) => { // 에셋 베기 효과 (32x32 4장)
      const bs = ElFx.slot(key === 'circSlash' ? 'dash' : 'basic'), base = ART.img[key];
      const img = bs ? ElFx.tinted(base, bs.el) : base, fr = Math.min(3, Math.floor(frac * 4)) * 32;
      g.save(); g.translate(x + c * fwd, cy + s * fwd); g.rotate(f); if (flip) g.scale(1, -1);
      g.drawImage(img, fr, 0, 32, 32, -16 * k, -16 * k, 32 * k, 32 * k); g.restore();
    };
    if (a && a.kind === 'saiJab') {
      const pr = a.t / a.dur, ext = pr < 0.4 ? pr / 0.4 : 1 - (pr - 0.4) / 0.6, side = a.hand > 0 ? 6 : -6;
      const [hx, hy] = at(4 + ext * (a.range - 14), side * (1 - ext * 0.8));
      saiSprite(g, hx, hy, f, 0);
      idle(-Math.sign(side));
      if (ext > 0.5) { // 찌르기 궤적
        const bs = ElFx.slot('basic'), tx = x + c * a.range, ty = cy + s * a.range;
        if (bs) { ElFx.line(g, bs, hx, hy, tx, ty, 3, 0.8 * ext); if (Math.random() < 0.5) ElFx.spark(bs, tx, ty); }
        else { g.strokeStyle = `rgba(255,255,255,${0.6 * ext})`; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke(); }
      }
    } else if (a && a.kind === 'saiFin') {
      const pr = a.t / a.dur, e = 1 - Math.pow(1 - pr, 3);
      for (const side of [-1, 1]) { const ang = f + side * a.half * (1 - 2 * e); const [hx, hy] = at(6, side * 4); saiSprite(g, hx, hy, ang, 4); }
      slashFx('cutX', 20, 1.6, pr, false);
    } else if (a && a.kind === 'rush') {
      const cs = ElFx.slot('charge');
      if (!a.ended) { for (const side of [-1, 1]) { const [hx, hy] = at(8, side * 5); saiSprite(g, hx, hy, f + side * 0.15, 4); } }
      else { idle(1); idle(-1); }
      // 지나간 길: 베인 자국
      const x0 = a.x0, y0 = a.y0 - 1, x1 = a.ended ? a.x1 : x, y1 = a.ended ? a.y1 - 1 : cy, fade = clamp(1 - (a.t - a.dur0) / 0.3, 0, 1);
      if (cs) ElFx.line(g, cs, x0, y0, x1, y1, 5, 0.8 * fade);
      else { g.strokeStyle = `rgba(207,232,255,${0.75 * fade})`; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      if (a.cutAt !== undefined && a.t - a.cutAt < 0.1) { // 그림자 분신이 다시 벤다
        const q = 1 - (a.t - a.cutAt) / 0.1;
        g.strokeStyle = `rgba(127,224,255,${0.9 * q})`; g.lineWidth = 3; g.beginPath(); g.moveTo(a.x0, a.y0 - 1); g.lineTo(a.x1, a.y1 - 1); g.stroke();
      }
    } else if (a && a.kind === 'parry') {
      // 막는 자세: 쌍검을 앞으로 교차 + 푸른 빛
      for (const side of [-1, 1]) { const [hx, hy] = at(7, side * 3); saiSprite(g, hx, hy, f - side * 0.7, 2); }
      const k = 0.55 + Math.sin(G.time * 30) * 0.15, ss = ElFx.slot('special');
      if (ss) ElFx.arc(g, ss, x, cy, 16, f - 1.1, f + 1.1, 3, k);
      else { g.strokeStyle = `rgba(127,224,255,${k})`; g.lineWidth = 3; g.beginPath(); g.arc(x, cy, 16, f - 1.1, f + 1.1); g.stroke(); }
    } else if (a && a.kind === 'riposte') {
      const moving = !a.ended, fade = moving ? 1 : clamp(1 - (a.t - a.dash) / 0.3, 0, 1);
      for (const side of [-1, 1]) { const [hx, hy] = at(moving ? 10 : 6, side * 4); saiSprite(g, hx, hy, f + side * (moving ? 0.12 : 0.9), moving ? 6 : 0); }
      // 베고 지나간 길: 넓은 빛 + 가운데 흰 선
      const x0 = a.x0, y0 = a.y0 - 1, x1 = moving ? x : a.x1, y1 = moving ? cy : a.y1 - 1, ss = ElFx.slot('special');
      g.lineCap = 'round';
      g.strokeStyle = ss ? ElFx.rgba(ss.el, 0.35 * fade) : `rgba(127,224,255,${0.35 * fade})`; g.lineWidth = 14;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = ss ? ElFx.rgba(ss.el, 0.8 * fade) : `rgba(191,244,255,${0.8 * fade})`; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${fade})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (ss && Math.random() < 0.8) { const k = Math.random(); ElFx.spark(ss, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 2); }
      // 맞은 자리마다 X자 베기
      for (const m of a.marks) {
        const q = (a.t - m.t) / 0.28;
        if (q < 0 || q >= 1) continue;
        const img = ss ? ElFx.tinted(ART.img.cutX, ss.el) : ART.img.cutX, fr = Math.min(3, Math.floor(q * 4)) * 32;
        g.save(); g.translate(m.x, m.y); g.rotate(m.ang); g.drawImage(img, fr, 0, 32, 32, -40, -40, 80, 80); g.restore();
      }
    } else if (a && a.kind === 'whirl') {
      const pr = a.t / a.dur, ang = f + pr * Math.PI * 2;
      for (const side of [-1, 1]) { const q = ang + (side > 0 ? 0 : Math.PI); saiSprite(g, x + Math.cos(q) * 10, cy + Math.sin(q) * 10, q, 6); }
      g.save(); g.globalAlpha *= 0.9; slashFx('circSlash', 0, this.whirlR / 14, pr, false); g.restore();
    } else { idle(1); idle(-1); }
    // 기세 칸: 머리 위 작은 점 다섯 개
    if (this.momentum > 0) {
      const n = MOMENTUM_MAX, full = this.momentum >= n, by = y - 30, fade = clamp(this.momT / 0.5, 0.35, 1);
      for (let i = 0; i < n; i++) {
        const bx = x + (i - (n - 1) / 2) * 6, on = i < this.momentum;
        if (on && full) { g.fillStyle = `rgba(255,184,74,${0.35 + Math.sin(G.time * 12) * 0.15})`; g.beginPath(); g.arc(bx, by, 3.6, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = on ? `rgba(255,184,74,${fade})` : 'rgba(255,255,255,0.25)';
        g.beginPath(); g.arc(bx, by, 2, 0, Math.PI * 2); g.fill();
      }
    }
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
    if (a.kind === 'saiJab' || a.kind === 'saiFin') {
      if (a.t < a.dur * 0.5 && !a.noStep && this.inMag >= STEP_MIN) World.move(this, fx * 100 * dt, fy * 100 * dt);
      if (a.t > a.dur * 0.25) this.hitArc(a, a.range, a.half);
      return true;
    }
    if (a.kind === 'rush') {
      if (a.t <= a.dur0 + dt) { // 지나가는 중
        const sp = a.len / a.dur0;
        World.move(this, fx * sp * dt, fy * sp * dt);
        this.trail.push({ x: this.x, y: this.y, life: 0.22 });
        this.hitPath(a, a.px, a.py, this.x, this.y, 1 + MOMENTUM_RUSH * a.mom);
        a.px = this.x; a.py = this.y;
      } else if (!a.ended) { a.ended = true; a.x1 = this.x; a.y1 = this.y; FX.onRush(this, a.x0, a.y0, a.x1, a.y1); }
      // 그림자 분신: 지나간 길을 그림자가 다시 벤다 (피해 절반, 마지막에만 넉백)
      if (a.ended && a.cuts < (a.extra || 0) && a.t >= a.dur0 + 0.1 * (a.cuts + 1)) {
        a.cuts++; a.hit = new Set(); a.cutAt = a.t;
        this.hitPath(a, a.x0, a.y0, a.x1, a.y1, MULTISPIN_MULT, a.cuts < a.extra ? 40 : undefined);
        Sfx.swing(true);
      }
      return true;
    }
    if (a.kind === 'whirl') {
      if (a.t > a.dur * 0.15) this.hitArc(a, this.whirlR, Math.PI);
      return true;
    }
    if (a.kind === 'riposte') { // 반격: 직선으로 베고 지나간다
      if (a.t <= a.dash + dt) {
        const sp = a.len / a.dash;
        World.move(this, fx * sp * dt, fy * sp * dt);
        this.trail.push({ x: this.x, y: this.y, life: 0.3 });
        const x0 = a.px, y0 = a.py, x1 = this.x, y1 = this.y, ddx = x1 - x0, ddy = y1 - y0, L2 = ddx * ddx + ddy * ddy || 1;
        for (const t of G.targets()) {
          const k = clamp(((t.x - x0) * ddx + (t.y - y0) * ddy) / L2, 0, 1);
          if (Math.hypot(t.x - (x0 + ddx * k), t.y - (y0 + ddy * k)) <= RUSH_WIDTH + 4 + t.r) this.riposteHit(t);
        }
        a.px = this.x; a.py = this.y;
      } else if (!a.ended) { // 도착: 한 번 더 번쩍
        a.ended = true; a.x1 = this.x; a.y1 = this.y;
        G.fxRing(this.x, this.y, '#bff4ff', 30); G.burst(this.x, this.y - 4, 10, ['#ffffff', '#7fe0ff'], 160);
        G.slowT = Math.max(G.slowT, 0.2); // 도착한 순간 잠깐 느리게
        Sfx.swing(true);
      }
      return true;
    }
    if (a.kind === 'parry') return true;
});

Object.assign(FX, {
  // ── 쌍검 ──
  // 그림자 연참이 끝났을 때: 지나간 길에 불길 · 독안개, 끝난 자리 낙뢰, 수호의 연참
  onRush(p, x0, y0, x1, y1) {
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (fc || pc) {
      const L = Math.hypot(x1 - x0, y1 - y0) || 1;
      for (let d = 0; d <= L; d += 16) {
        const zx = x0 + (x1 - x0) * d / L, zy = y0 + (y1 - y0) * d / L + 4;
        if (fc) this.zone(zx, zy, 'fire', 1.5 + 0.5 * fc);
        if (pc) this.zone(zx, zy, 'poison', 2 + 0.5 * pc);
      }
    }
    const ec = this.lv('elec_charge');
    if (ec) {
      const list = this.near(x1, y1, 110).sort((a, b) => Math.hypot(a.x - x1, a.y - y1) - Math.hypot(b.x - x1, b.y - y1)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
    }
    const gs = this.lv('guard_spin');
    if (gs) p.spinGuardT = 0.5 + 0.5 * gs;
  },
  // 받아치기에 성공했을 때: 주변 폭발 · 냉기 · 낙뢰 · 독, 치유
  onParry(p) {
    const atk = p.atk, x = p.x, y = p.y;
    const fs = this.lv('fire_special');
    if (fs) this.explode(x, y, 70, atk * (0.8 + 0.4 * fs), '#ff7a3c', true);
    const is = this.lv('ice_special');
    if (is) { for (const e of this.near(x, y, 70)) this.chill(e, iceBig(is)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 22, y + 4 + Math.sin(a) * 16, 'ice', 1.5 + 0.5 * is); } }
    const es = this.lv('elec_special');
    if (es) { const list = this.near(x, y, 120).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 2 + es); for (const e of list) this.skyBolt(e, atk * (0.8 + 0.4 * es)); }
    const ps = this.lv('poison_special');
    if (ps) for (const e of this.near(x, y, 70)) this.poison(e, 1 + ps);
    const hw = this.lv('heal_wave');
    if (hw && p.alive) p.hp = Math.min(p.maxHp, p.hp + 3 * hw);
  },
});

// 사이 하나: 칼끝이 a 방향을 향하게 (ext = 앞으로 내민 정도)
function saiSprite(g, x, y, a, ext) {
  const im = ART.img.sai, w = im.width * PIX * 0.85, h = im.height * PIX * 0.85;
  g.save();
  g.translate(x + Math.cos(a) * ext, y + Math.sin(a) * ext);
  g.rotate(a + Math.PI / 2);
  g.drawImage(im, -w / 2, -h + 5, w, h);
  g.restore();
}
