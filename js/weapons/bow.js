'use strict';
// ── 사냥꾼의 활: 사냥형 · 빠른 연사, 꿰뚫는 화살, 덫, 덫 던지기 (2026-10-20) ──
// 멀리서 쏘되 원거리 마물 절반보다는 사거리가 짧아서, 덫을 깔고 몰아넣으며 계속 자리를 잡는 무기.
// 덫은 근접 마물이 밟고, 원거리 마물 · 보스는 덫 근처로 몰아 화살로 쏴서 터뜨린다.

const BOW_RANGE = 150;          // 기본 연사 사거리 (마법봉 136 보다 조금 길고, 원거리 마물 절반보다 짧게)
const ARROW_SPEED = 380;        // 화살 속도 (휘지 않는다)
const BOW_INTERVAL = 0.22;      // 연사 간격
const PIERCE_RANGE = 230;       // 꿰뚫는 화살 사거리 (창 일섬 220 과 비슷)
const PIERCE_SPEED = 560;
const TRAP_MAX = 3;             // 동시에 깔 수 있는 덫
const TRAP_LIFE = 12;           // 덫이 남아 있는 시간
const TRAP_R = 16;              // 밟는 판정
const TRAP_BOOM_R = 40;         // 마물이 밟으면 바로 터지는 범위
const TRAP_SHOT_R = 64;         // 화살로 쏴서 터뜨리면 더 크게 (연계 보너스)
const TRAP_FRONT = 28;          // 덫을 놓는 거리 (발밑 ~ 바로 앞)
const TRAP_ARROW_RANGE = 110;   // 덫 던지기 덫 화살 사거리 (기본 연사 150 보다 짧게, 2026-10-20)
const DASH_SHOT_RECOIL = 15;    // 덫 던지기 반동: 쏘는 순간 화살 반대쪽으로 튕겨난다 (2026-10-20, 예전엔 앞으로 22 미끄러짐 → 들어가서 박고 빠지기)
const DASH_SHOT_AIM = 45 * Math.PI / 180; // 덫 던지기 조준: 대시 방향 좌우 45° 안의 적 쪽으로 꺾여 나간다 (옆으로 스치며 박기)
const DASH_SHOT_SLIDE_OLD = 22;     // 덫 던지기 (예전 이름 대시 사격, 2026-10-20 이름만 바꿈: 화살에 덫을 달아 날린다): 대시하던 쪽으로 조금 더 미끄러진다 (물러서기는 적응이 어렵다는 의견으로 바꿈, 2026-10-20)
const LURE_R = [0, 60, 80, 100]; // 덫 유인 (특수 강화) 레벨별 끌어당기는 범위
const LURE_PULL = 55;           // 끌어당기는 속도 (초당 거리, 마물 걸음보다 조금 느리게)
const BOW_AIM = { range: 160, half: AIM_HALF_ANGLE, moveHalf: 20 * Math.PI / 180 };
const PIERCE_AIM = { range: 240, half: AIM_HALF_ANGLE, moveHalf: 20 * Math.PI / 180 };

Object.assign(MOVES, {
shot:       { mult: 0.55, kb: 60, guardBreak: false, role: 'basic', light: true, ranged: true },   // 연사 한 발
shotFin:    { mult: 0.8, kb: 120, guardBreak: false, role: 'fin', light: true, ranged: true },     // 3발째
pierceShot: { mult: 2.4, kb: 200, guardBreak: true, role: 'charge', ranged: true },                // 꿰뚫는 화살 (차지)
trap:       { mult: 1.6, kb: 180, guardBreak: true, role: 'special', passive: true },   // passive: 저절로 터지는 피해 → 저스트 회피 반격을 안 쓴다                               // 덫이 물었을 때
trapBoom:   { mult: 2.2, kb: 240, guardBreak: true, role: 'special', passive: true },   // 화살로 쏴서 터뜨림: 더 크고 더 아프게                            // 덫을 화살로 쏴서 터뜨렸을 때
backShot:   { mult: 1.2, kb: 60, guardBreak: false, role: 'dash', ranged: true },                  // 덫 던지기 덫 화살 (맞으면 그 자리에서 덫이 터진다)
});

addWeapon('bow', {
  name: '사냥꾼의 활',
  style: '사냥형 · 빠른 연사와 덫, 거리를 두고 몰아넣기',
  essence: '무기의 정수',
  unlockCost: 1,
  moves: { basic: '연사', charged: '꿰뚫는 화살', special: '덫 놓기', dashAttack: '덫 던지기' },
  chargeTime: 0.6,
  dashSpeed: 225,     // 대시 거리 36 (기본 340 · 약 54): 덫 던지기를 노리기 쉽게 짧게 (2026-10-20, 42 → 36)
  specialCd: 3.5,
  cdPerLv: 0, cdPerMastery: 0.3, cdFloor: 2.0,
  comboLen: 3,
  skillCd: 0,
  notesTitle: '활 특성 · 덫',
  notes: [
    `연사 사거리는 ${BOW_RANGE}. 멀리 있는 원거리 마물(부엉이 · 해골 · 눈알 …)보다는 짧아서 다가가야 해요.`,
    `덫은 동시에 ${TRAP_MAX}개까지, ${TRAP_LIFE}초 동안 남아요. 마물이 밟으면 바로 터져요 (범위 ${TRAP_BOOM_R}).`,
    `깔린 덫을 화살로 맞히면 더 크게 터져요 (범위 ${TRAP_SHOT_R}, 피해도 더 큼). 안 밟는 원거리 마물 · 보스에게 써요.`,
    `덫 던지기는 대시하던 쪽으로 덫 화살을 쏴요 (사거리 ${TRAP_ARROW_RANGE}). 맞은 적 자리에서 덫이 바로 터지고, 빗나가면 떨어진 곳에 덫이 꽂혀요.`,
    '화살은 대시 쪽 축복(덫 던지기 강화 · 숙련)으로, 그 덫은 덫 놓기와 똑같은 덫이라 특수 쪽 축복(덫 속성 · 덫 유인)으로 강해져요. 덫 개수도 함께 세요.',
  ],
  basic: (p, mag) => p.startShot(mag),
  basicAfterDash: p => p.startBackShot(),
  charged: (p, mag) => p.startPierce(mag),
  special: (p, mag) => p.startTrap(mag),
  skill: null,
  rows: (A, P, D) => [
    ['기본 · 연사', `${A} ${A} ${A}`, `빠르게 쏜다 (사거리 ${BOW_RANGE}) · 3발째는 조금 강함 · 덫을 맞히면 터짐`],
    ['차지 · 꿰뚫는 화살', `${A} 길게 눌렀다 떼기`, `일직선 관통 (사거리 ${PIERCE_RANGE}) · 기절 · 빙결된 적에게 더 아픔`],
    ['특수 · 덫 놓기', `${P} (쿨타임 3.5초)`, `발밑에 덫 · 동시에 ${TRAP_MAX}개 · 밟으면 터짐 · 화살로 쏘면 더 크게 터짐`],
    ['대시', `${D} (쿨타임 ${DASH_CD}초)`, '짧은 무적 이동'],
    ['덫 던지기', `${D} → ${A}`, `덫 화살 (사거리 ${TRAP_ARROW_RANGE}) · 맞으면 그 자리에서 덫이 터지고, 빗나가면 떨어진 곳에 덫`, 'thrust'],
    ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 확정 치명타', 'dodge'],
  ],
  shieldHint: '저 방패병은 정면 화살을 막아요! 꿰뚫는 화살이나 덫 폭발은 방패를 깨요.',
  mastery: [
    { id: 'combo',  name: '연사 숙련',           max: 3, cost: [2, 4, 7], desc: lv => `3발째 피해 +${15 * lv}%` },
    { id: 'spin',   name: '꿰뚫는 화살 숙련',    max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 사거리 +${8 * lv}%` },
    { id: 'wave',   name: '덫 숙련',             max: 3, cost: [3, 5, 8], desc: lv => `덫 쿨타임 -${(0.3 * lv).toFixed(1)}초 (최소 2초)` },
    { id: 'thrust', name: '덫 던지기 숙련',     max: 3, cost: [2, 4, 7], desc: lv => `덫 던지기 화살 피해 +${20 * lv}%` },
  ],
});

Object.assign(WEAPONS.bow, {
  draw: (p, g, x, y) => p.drawBow(g, x, y),
  dodgeText: '대시 · 덫 준비!',
  padIcon(b) { // 덫: 이빨 달린 고리
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.38, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * b.r * 0.38, b.y + Math.sin(a) * b.r * 0.38); ctx.lineTo(b.x + Math.cos(a) * b.r * 0.2, b.y + Math.sin(a) * b.r * 0.2); ctx.stroke(); }
  },
  glyph: {
    basic(g, s, line) { g.beginPath(); g.arc(-0.35 * s, 0, 0.75 * s, -1.1, 1.1); g.stroke(); line(-0.05, -0.68, -0.05, 0.68); line(-0.6, 0, 0.85, 0); }, // 활 + 화살
    charge(g, s, line) { line(-0.9, 0, 0.6, 0); g.beginPath(); g.moveTo(0.9 * s, 0); g.lineTo(0.5 * s, -0.3 * s); g.lineTo(0.5 * s, 0.3 * s); g.closePath(); g.fill(); line(-0.5, -0.4, -0.5, 0.4); line(0, -0.4, 0, 0.4); }, // 꿰뚫는 화살
    special(g, s, line) { g.beginPath(); g.arc(0, 0, 0.55 * s, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(Math.cos(a) * 0.55, Math.sin(a) * 0.55, Math.cos(a) * 0.25, Math.sin(a) * 0.25); } }, // 덫
  },
});

// 활: 기본 = 연사, 차지 = 꿰뚫는 화살, 특수 = 덫, 대시 공격 = 덫 던지기
BOON_FORMS.bow = {
  fire_basic:     { name: '불꽃 화살' },
  fire_bolt:      { name: '화염구 사격', desc: lv => `쏠 때마다 화염구가 날아가 처음 닿은 적 자리에서 폭발 (공격력의 ${pct(0.5 + 0.2 * lv)} + 화상). 3발째는 3발.` },
  fire_charge:    { name: '불길 화살', desc: lv => `꿰뚫는 화살에 맞은 적에게 화상 2중첩, 지나간 줄에 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  fire_special:   { name: '불꽃 덫', desc: lv => `덫이 터지면 그 자리에 ${1.5 + 0.5 * lv}초간 불길 + 화상.` },
  ice_basic:      { name: '서리 화살' },
  ice_shard:      { name: '얼음 파편 사격', desc: lv => `쏠 때마다 얼음 파편 ${1 + lv}개가 부채꼴로 날아가 적을 관통하며 냉기 1중첩 (공격력의 ${pct(0.25 + 0.05 * lv)}).` },
  ice_charge:     { name: '빙결 화살', desc: lv => `꿰뚫는 화살에 맞은 적에게 냉기 ${iceBig(lv)}중첩.` },
  ice_special:    { name: '얼음 덫', desc: lv => `덫이 터지면 둘레의 적에게 냉기 ${iceBig(lv)}중첩.` },
  elec_basic:     { name: '번개 화살' },
  elec_chain:     { name: '연쇄 번개 사격', desc: lv => `화살이 맞으면 번개가 적에서 적으로 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.45 + 0.15 * lv)}) + 감전.` },
  elec_charge:    { name: '벼락 화살', desc: lv => `꿰뚫는 화살이 끝나는 곳 주변 적 ${2 + lv}명에게 벼락 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  elec_special:   { name: '번개 덫', desc: lv => `덫이 터지면 번개가 옆 적에게 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.4 + 0.15 * lv)}) + 감전.` },
  poison_basic:   { name: '독 화살' },
  poison_spray:   { name: '독 분사 사격', desc: lv => `3발째에 앞쪽으로 독을 뿜어 부채꼴 안의 적에게 독 ${3 + lv}중첩 + 공격력의 ${pct(0.4 + 0.1 * lv)} 피해.` },
  poison_charge:  { name: '독안개 화살', desc: lv => `꿰뚫는 화살이 지나간 줄에 ${2 + 0.5 * lv}초간 독안개.` },
  poison_special: { name: '독 덫', desc: lv => `덫이 터지면 독 ${1 + lv}중첩 + 그 자리에 독안개.` },
  atk_combo:      { name: '잔상 사격', desc: lv => `3발째를 잔상 화살이 ${COMBO_ECHO_HITS}번 더 쏜다 (잔상 한 번에 3발째 피해의 ${pct(ECHO_MULT)}).` + (lv > 1 ? ` 3발째 피해 +${Math.round(COMBO_FIN * 100 * (lv - 1))}%.` : '') },
  atk_spin:       { name: '꿰뚫는 화살 강화', desc: lv => `차지 시간 -${15 * lv}%, 꿰뚫는 화살 사거리 +${10 * lv}%.` }, // 예전엔 검 설명(회전베기 범위)이 그대로 나왔다
  atk_multispin:  { name: '연환 관통', desc: lv => `꿰뚫는 화살 뒤 정령의 화살이 같은 줄을 ${lv}번 더 꿰뚫는다 (피해 ${pct(MULTISPIN_MULT)}).` },
  atk_wave:       { name: '덫 유인', desc: lv => `덫이 둘레 ${LURE_R[Math.min(lv, 3)]} 안의 마물을 천천히 끌어당긴다 (보스 제외).` + (lv >= 2 ? ` 동시에 깔 수 있는 덫 +1.` : '') },
  atk_thrust:     { name: '덫 던지기 강화', desc: lv => ['', '사거리 +10% · 1명 관통.', '사거리 +20% · 1명 관통 · 맞히면 대시 충전.', '사거리 +30% · 2명 관통 · 맞히면 대시 충전.'][Math.min(lv, 3)] + ' (덫은 덫 놓기 축복을 따름)' },
  sharp:          { name: '예리한 화살촉' },
  lifesteal:      { name: '흡혈 화살' },
  guard_spin:     { name: '버티는 시위', desc: lv => `꿰뚫는 화살을 쏠 때 잠깐 무적, 그 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  heal_wave:      { name: '치유의 덫', desc: lv => `덫이 마물에게 터질 때마다 체력 ${(0.5 + 0.5 * lv).toFixed(1)} 회복.` },
};

const bowTraps = () => G.projectiles.filter(o => o instanceof BowTrap && !o.done);
const bowTrapMax = () => TRAP_MAX + (FX.lv('atk_wave') >= 2 ? 1 : 0);

extendPlayer({
  get bowPierceLen() { return PIERCE_RANGE * (1 + 0.1 * FX.lv('atk_spin') + 0.08 * this.mastery('spin')); },
  // 연사: 한 번 누를 때 한 발. 3발째는 조금 강하고, 잔상 사격이면 잔상 화살이 한 번 더
  startShot(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.aim(mag, BOW_AIM);
    const fin = this.combo === 2, kind = fin ? 'shotFin' : 'shot';
    G.projectiles.push(new BowArrow(this, this.facing, { kind, slot: 'basic' }));
    if (fin && FX.lv('atk_combo')) for (let k = 1; k <= COMBO_ECHO_HITS; k++) G.projectiles.push(new BowArrow(this, this.facing, { kind, slot: 'basic', ghost: true, mult: ECHO_MULT, delay: ECHO_DELAY * k }));
    this.act = { kind, t: 0, dur: 0.12, hit: new Set(), bowShot: true };
    this.atkCd = (fin ? 0.3 : BOW_INTERVAL) * (1 - COMBO_SPEED * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    this.finisherT = 0; this.atkBuffer = 0;
    Sfx.swing(false);
    FX.onSwing(this, fin); // 화염구 · 얼음 파편 · 독 분사 사격 같은 기본공격 강화 축복. fin = 3발째 (2026-10-20: false 로 넘겨 독 분사 · 화염구 3발이 안 나가던 버그)
  },
  // 꿰뚫는 화살 (차지): 일직선 관통. 연환 관통이면 정령의 화살이 같은 줄을 더
  startPierce(mag) {
    this.finisherT = 0;
    this.aim(mag, PIERCE_AIM);
    const ms = FX.lv('atk_multispin'), len = this.bowPierceLen;
    G.projectiles.push(new PierceArrow(this, this.facing, len, 1));
    for (let i = 1; i <= ms; i++) { const a = new PierceArrow(this, this.facing, len, MULTISPIN_MULT, true); a.delay = 0.12 * i; G.projectiles.push(a); }
    this.act = { kind: 'bowCast', t: 0, dur: 0.2, hit: new Set(), pierceCast: true };
    this.atkCd = 0.4; this.charge = 0; this.comboT = 0;
    const gs = FX.lv('guard_spin');
    if (gs) { this.invuln = Math.max(this.invuln, 0.3); this.spinGuardT = 0.3 + 0.5 + 0.5 * gs; }
    G.text(this.x, this.y - 24, ms ? `꿰뚫는 화살 ×${1 + ms}` : '꿰뚫는 화살', '#ffd24a', 12, 0.6);
    Sfx.lunge();
  },
  // 덫 놓기 (특수): 발밑 ~ 바로 앞. 최대 개수를 넘으면 가장 오래된 덫이 사라진다
  startTrap(mag) {
    this.aim(mag, BOW_AIM);
    const x = this.x + Math.cos(this.facing) * TRAP_FRONT, y = this.y + 4 + Math.sin(this.facing) * TRAP_FRONT * 0.8;
    placeTrap(x, y, 'special');
    this.act = { kind: 'bowCast', t: 0, dur: 0.18, hit: new Set(), trapCast: true };
    Sfx.block();
  },
  // 덫 던지기 (대시 공격): 대시하던 쪽으로 덫 화살. 맞으면 그 적을 덫이 바로 물고, 빗나가면 떨어진 곳에 덫이 꽂힌다 (2026-10-20)
  startBackShot() {
    this.finisherT = 0;
    const tl = FX.lv('atk_thrust'), range = TRAP_ARROW_RANGE * (1 + 0.1 * tl);
    this.trapShotAim(range); // 덫 던지기 강화: 사거리 +10%/레벨 · 1레벨 1명 관통 · 2레벨 맞히면 대시 1회 충전 · 3레벨 2명 관통 (피해는 공통 대시 공격 배율)
    G.projectiles.push(new BowArrow(this, this.facing, { kind: 'backShot', slot: 'dash', trapArrow: true, range, pierce: tl >= 3 ? 2 : tl >= 1 ? 1 : 0, dashRefund: tl >= 2 }));
    this.act = { kind: 'backShot', t: 0, dur: 0.18, hit: new Set(), dir: this.facing + Math.PI }; // dir = 반동으로 밀려나는 쪽 (화살 반대)
    this.atkCd = 0.3; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '덫 던지기', '#9cdcff', 11, 0.5);
    Sfx.swing(false); Sfx.block();
  },
  // 덫 던지기 조준: 마우스 조준이면 커서 쪽. 아니면 누르는 방향(없으면 대시 방향) 좌우 DASH_SHOT_AIM 안에서 가까운 적 (정면에 가까울수록 우선)
  trapShotAim(range) {
    const ms = Input.state;
    if (ms.mouseAim && ms.mouse && G.view) { this.aim(0, BOW_AIM); return; }
    // 기준 방향: 지금 누르는 방향 (대시 중 반대로 꺾어 뒤로 쏘기 가능, 2026-10-20 사용자), 안 누르면 대시 방향
    const im = Input.state, held = Math.hypot(im.mx, im.my) >= 0.2;
    const base = held ? Math.atan2(im.my, im.mx) : this.dashDir != null ? this.dashDir : this.facing;
    let best = null, bs = Infinity;
    for (const t of G.targets()) {
      if (t.dead || t.spawnT > 0.2) continue;
      const d = Math.hypot(t.x - this.x, t.y - this.y) - (t.r || 8);
      if (d > range + 10) continue;
      const off = Math.abs(angDiff(Math.atan2(t.y - this.y, t.x - this.x), base));
      if (off > DASH_SHOT_AIM) continue;
      const score = d + 40 * off / DASH_SHOT_AIM;
      if (score < bs) { bs = score; best = t; }
    }
    this.facing = best ? Math.atan2(best.y - this.y, best.x - this.x) : base;
  },
  // 활 그림: 보는 쪽으로 활을 들고, 쏠 때 시위를 당겼다 놓는다
  drawBow(g, x, y) {
    const cy = y - 2, a = this.act, f = this.facing;
    let pull = 0, ang = f;
    if (a && (a.bowShot || a.kind === 'backShot')) pull = 1 - a.t / a.dur;
    else if (a && a.pierceCast) pull = 1 - a.t / a.dur;
    else if (a && a.trapCast) ang = f + 1.2; // 덫을 놓을 때는 활을 옆으로 내린다
    else if (!a && this.charge > 0) pull = this.charge; // 차지: 시위를 당기고 있다
    else if (!a) ang = f + 0.9; // 평소: 비스듬히
    bowSprite(g, x + Math.cos(ang) * 10, cy + 2 + Math.sin(ang) * 8, ang, pull);
    if (a && a.trapCast) { const k = a.t / a.dur; g.globalAlpha = 1 - k; g.fillStyle = slotCol('special', FX_WHITE); g.fillRect(Math.round(x + Math.cos(f) * TRAP_FRONT * k) - 1, Math.round(y + 4 + Math.sin(f) * TRAP_FRONT * 0.8 * k) - 1, 3, 3); g.globalAlpha = 1; }
  },
});

ACT_HANDLERS.push(function (a, dt, fx, fy) {
  if (a.bowShot || a.pierceCast || a.trapCast) return true;
  if (a.kind === 'backShot') { // 쏘는 순간 화살 반대쪽으로 튕겨난다 (반동, 처음에 세게 · 점점 약하게)
    const k = 2 * (1 - a.t / a.dur), sp = DASH_SHOT_RECOIL / a.dur;
    World.move(this, Math.cos(a.dir) * sp * k * dt, Math.sin(a.dir) * sp * k * dt);
    if (Math.random() < 0.4) G.dust(this.x, this.y + 8);
    return true;
  }
});

// 덫 하나 놓기 (최대 개수를 넘으면 가장 오래된 것부터 사라진다)
function placeTrap(x, y, slot) {
  const list = bowTraps();
  while (list.length >= bowTrapMax()) { const old = list.shift(); old.done = true; G.burst(old.x, old.y, 4, ['#8a8f99'], 60); }
  G.projectiles.push(new BowTrap(x, y, slot));
}

// 활 그림 (에셋 Bow 15x7: 맨 윗줄이 시위, 아래로 휜 쪽이 활 몸통). 휜 쪽이 ang(쏘는 쪽)을 향하게 세워 들고,
//   pull 만큼 시위 가운데를 뒤로(플레이어 쪽으로) 당긴다
function bowSprite(g, x, y, ang, pull) {
  const im = ART.img.bow; if (!im || !im.width) return;
  const w = im.width * PIX, h = im.height * PIX;
  g.save(); g.translate(x, y); g.rotate(ang - Math.PI / 2);
  g.drawImage(im, -w / 2, -h / 2, w, h);
  if (pull > 0) { // 당긴 시위: 양 끝에서 뒤로 모이는 2픽셀 선 + 걸린 화살
    const back = 2 + pull * 7, ex = w / 2 - 2, sy = -h / 2 + 1;
    g.fillStyle = '#f4eee0';
    for (const sd of [-1, 1]) for (let k = 0; k <= 1; k += 0.2) g.fillRect(Math.round(sd * ex * (1 - k)) - 1, Math.round(sy - back * k) - 1, 2, 2);
    g.restore(); g.save(); g.translate(x, y); g.rotate(ang);
    const nock = -(2 + pull * 7); arrowSprite(g, nock + 18, 0, 0, 1, null);
  }
  g.restore();
}

// 화살 (연사 · 덫 던지기): 곧게 날아가 처음 닿은 적에게 꽂힌다. 덫을 맞히면 덫이 터진다
class BowArrow {
  constructor(p, dir, o) {
    Object.assign(this, { dir, kind: o.kind, slot: o.slot, ghost: !!o.ghost, mult: o.mult || 1, delay: o.delay || 0, pierce: o.pierce || 0, dashRefund: !!o.dashRefund, trapped: false, hit: new Set(), born: G.time, t: 0, dist: 0, done: false, r: 4, range: o.range || BOW_RANGE, trapArrow: !!o.trapArrow });
    this.x = p.x + Math.cos(dir) * 10; this.y = p.y - 4 + Math.sin(dir) * 10;
  }
  update(dt) {
    if (this.delay > 0) { this.delay -= dt; if (this.delay <= 0) { const p = G.player; this.x = p.x + Math.cos(this.dir) * 10; this.y = p.y - 4 + Math.sin(this.dir) * 10; } return; }
    this.t += dt;
    const step = ARROW_SPEED * dt, c = Math.cos(this.dir), s = Math.sin(this.dir);
    this.x += c * step; this.y += s * step; this.dist += step;
    if (this.dist > this.range) { this.done = true; if (this.trapArrow && !this.trapped) placeTrap(this.x, this.y + 4, 'special'); return; } // 덫 화살: 떨어진 곳에 덫 (덫 놓기와 같은 덫)
    if (World.shotBlockedAt(this.x, this.y + 6)) { this.done = true; if (this.trapArrow && !this.trapped) placeTrap(this.x - c * 8, this.y + 4 - s * 8, 'special'); else G.burst(this.x, this.y, 4, ['#a88a52', '#fff'], 80); return; } // 나무 · 바위에 꽂힌다
    for (const tr of bowTraps()) if (tr.armed && Math.hypot(tr.x - this.x, tr.y - 4 - this.y) < 10) { tr.detonate(); this.done = true; return; }
    for (const t of G.targets()) {
      if (this.hit.has(t) || Math.hypot(t.x - this.x, t.y - this.y) > t.r + this.r) continue;
      this.hit.add(t);
      G.player.deal(t, this.kind, c, s, { mult: this.mult, src: this });
      G.burst(this.x, this.y, 3, slotBurst(this.slot, ['#ffffff', '#e8e8e8']), 70);
      if (this.trapArrow && !this.trapped) { // 덫 화살: 처음 맞은 적 자리에서 덫이 바로 터진다
        this.trapped = true;
        placeTrap(t.x, t.y + 4, 'special');
        const tr = bowTraps().pop(); if (tr && !t.dead) { tr.armed = true; tr.spring(t); }
        const p = G.player; // 덫 던지기 강화 2레벨: 맞히면 대시 1회 바로 충전
        if (this.dashRefund && p.dashStock < p.dashMax) { p.dashStock++; G.text(p.x, p.y - 30, '대시 +1', '#9cdcff', 11, 0.6); }
      }
      if (this.pierce-- > 0) continue; // 덫 던지기 강화: 덫을 박고도 뒤의 적까지 꿰뚫는다
      this.done = true; return;
    }
  }
  draw(g) {
    if (this.delay > 0) return;
    const col = this.ghost ? ECHO_COLOR : slotCol(this.slot, FX_WHITE), c = Math.cos(this.dir), s = Math.sin(this.dir);
    const a0 = g.globalAlpha; g.globalAlpha = a0 * (this.ghost ? 0.75 : 1);
    // 도트 빛꼬리: 꿰뚫는 화살과 같은 도트 줄기(Cut)를 짧고 가늘게, 그 칸 속성 색 (없으면 흰색). 작은 점 꼬리는 안 보여서 바꿈 (2026-10-20)
    const L = Math.min(40, this.dist + 6);
    if (L > 8) cutFx(g, this.x - c * (L + 4), this.y - s * (L + 4), this.dir, L, 0, 0.75, col, 0.85);
    for (let d = 6; d < L; d += 2) { // 가운데 도트 줄: 화살 바로 뒤가 진하고 멀어질수록 흐려진다
      g.globalAlpha = a0 * (this.ghost ? 0.6 : 0.9) * (1 - d / L);
      g.fillStyle = col; g.fillRect(Math.round(this.x - c * d) - 1, Math.round(this.y - s * d) - 1, 2, 2);
    }
    g.globalAlpha = a0 * (this.ghost ? 0.75 : 1);
    if (!this.ghost) { const sl = ElFx.slot(this.slot); if (sl && Math.random() < 0.5) ElFx.spark(sl, this.x - c * 10, this.y - s * 10); } // 속성 불티
    arrowSprite(g, this.x, this.y, this.dir, 1, this.ghost ? ECHO_COLOR : null);
    if (this.trapArrow) { // 덫 화살: 촉 뒤에 매단 작은 쇠 고리
      const mx = Math.round(this.x - c * 5), my = Math.round(this.y - s * 5);
      g.fillStyle = '#2a2d33'; g.fillRect(mx - 3, my - 3, 6, 6);
      g.fillStyle = '#c8ccd4'; g.fillRect(mx - 2, my - 2, 4, 4);
      g.fillStyle = slotCol('special', FX_WHITE); g.fillRect(mx - 1, my - 1, 2, 2);
    }
    g.globalAlpha = a0;
  }
}

// 화살 그림 (에셋 Arrow 13x5: 촉이 오른쪽)
function arrowSprite(g, x, y, dir, scale, tint) {
  const base = ART.img.arrow; if (!base || !base.width) return;
  const im = tint ? tintedBy(base, tint) : base, w = base.width * PIX * scale, h = base.height * PIX * scale;
  g.save(); g.translate(x, y); g.rotate(dir);
  g.drawImage(im, -w * 0.7, -h / 2, w, h);
  g.restore();
}

// 꿰뚫는 화살 (차지): 일직선으로 관통. 지나간 줄에 차지 칸 속성 (불길 · 독안개), 끝에서 벼락
class PierceArrow {
  constructor(p, dir, len, mult, ghost) {
    Object.assign(this, { dir, len, mult, ghost: !!ghost, delay: 0, born: G.time, t: 0, dist: 0, done: false, hit: new Set(), zoneAt: 0, started: false });
    this.x0 = p.x; this.y0 = p.y - 4; this.x = this.x0; this.y = this.y0;
  }
  update(dt) {
    if (this.delay > 0) { this.delay -= dt; return; }
    if (!this.started) { this.started = true; if (this.ghost) Sfx.thrust(); }
    this.t += dt;
    const step = PIERCE_SPEED * dt, c = Math.cos(this.dir), s = Math.sin(this.dir);
    this.x += c * step; this.y += s * step; this.dist += step;
    const blocked = World.shotBlockedAt(this.x, this.y + 6);
    if (!this.ghost && this.dist - this.zoneAt > 22) { this.zoneAt = this.dist; FX.onPierceMove(this.x, this.y + 4); }
    for (const tr of bowTraps()) if (tr.armed && Math.hypot(tr.x - this.x, tr.y - 4 - this.y) < 12) tr.detonate();
    for (const t of G.targets()) {
      if (this.hit.has(t)) continue;
      if (Math.hypot(t.x - this.x, t.y - this.y) > t.r + 8) continue;
      this.hit.add(t);
      const bound = t.stun > 0 || t.frozenT > 0; // 기절 · 빙결된 적에게 더 아프게
      G.player.deal(t, 'pierceShot', c, s, { mult: this.mult * (bound ? 1.3 : 1), kb: this.ghost ? 40 : undefined, src: this });
    }
    if (this.dist >= this.len || blocked) {
      this.done = true;
      if (blocked) G.burst(this.x, this.y, 6, ['#a88a52', '#fff'], 100);
      if (!this.ghost) FX.onPierceEnd(G.player, this.x, this.y);
    }
  }
  draw(g) {
    if (this.delay > 0 || !this.started) return;
    const c = Math.cos(this.dir), s = Math.sin(this.dir), col = this.ghost ? ECHO_COLOR : slotCol('charge', FX_WHITE);
    const a0 = g.globalAlpha; g.globalAlpha = a0 * (this.ghost ? 0.7 : 1);
    cutFx(g, this.x - c * 46, this.y - s * 46, this.dir, 50, 0, 0.6, col, 0.7); // 뒤로 끄는 도트 빛줄기
    arrowSprite(g, this.x, this.y, this.dir, 1.5, this.ghost ? ECHO_COLOR : null);
    g.globalAlpha = a0;
  }
}

// 덫: 놓은 지 0.25초 뒤부터 동작. 밟히면 바로 터지고, 화살에 맞으면 더 크게 터진다. slot: 'special' (덫 놓기 · 덫 화살이 놓는 덫 모두)
class BowTrap {
  constructor(x, y, slot) { Object.assign(this, { x, y, slot, t: 0, life: TRAP_LIFE, done: false, armed: false, seed: Math.random() * 10 }); }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.t > 0.25) this.armed = true;
    // 연쇄 폭발: 옆 덫의 폭발에 휘말리면 잠깐 뒤 같은 크기로 터진다 (2026-10-20)
    if (this.chainT !== undefined) { this.chainT -= dt; if (this.chainT <= 0) this.boom(this.chainShot, null, true); return; }
    if (this.life <= 0) { this.done = true; return; }
    if (!this.armed) return;
    // 덫 유인 (특수 강화): 둘레의 마물을 천천히 끌어당긴다 (보스 · 단단히 선 적 제외)
    const lure = this.slot === 'special' ? LURE_R[Math.min(FX.lv('atk_wave'), 3)] : 0;
    for (const t of G.targets()) {
      if (t.dead || t.hidden || t.spawnT > 0) continue;
      const dx = this.x - t.x, dy = this.y - 4 - t.y, d = Math.hypot(dx, dy) || 1;
      if (d < TRAP_R + (t.r || 8) * 0.6) { this.spring(t); return; }
      if (lure && d < lure && t.type !== 'boss' && !t.superArmor && !(t.stun > 0)) { const vx = dx / d * LURE_PULL * dt, vy = dy / d * LURE_PULL * dt; if (t.flying) World.fly(t, vx, vy); else World.move(t, vx, vy); if (Math.random() < dt * 6) G.dust(t.x, t.y + 6); }
    }
  }
  // 마물이 밟으면 바로 폭발 (반경 ${TRAP_BOOM_R}). 묶지는 않는다 (2026-10-20: 묶기 → 즉시 폭발)
  spring(victim) { this.boom(false, victim); }
  // 화살로 쏴서 터뜨리면 더 큰 폭발 (반경 TRAP_SHOT_R, 피해 더 큼) — 활의 연계 보너스
  detonate() { this.boom(true, null); }
  boom(shot, victim, chained) {
    if (this.done) return;
    this.done = true;
    const p = G.player, kind = shot ? 'trapBoom' : 'trap', R = shot ? TRAP_SHOT_R : TRAP_BOOM_R, cx = this.x, cy = this.y - 4;
    let first = victim && !victim.dead ? victim : null;
    for (const t of G.targets()) {
      if (t.dead) continue;
      const dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy) || 1;
      if (d > R + (t.r || 8) && t !== victim) continue;
      p.deal(t, kind, dx / d, dy / d);
      first = first || t;
    }
    trapFx(this.x, this.y, this.slot, shot ? (chained ? 72 : 90) : 56);
    if (shot && !chained) pixRing(this.x, this.y, slotCol(this.slot, FX_WHITE), R); // 큰 흰 고리는 처음 터진 덫에만 (연쇄 때 화면을 덮지 않게, 2026-10-20)
    FX.onTrap(p, this, first, shot);
    G.shake = Math.max(G.shake, shot ? 6 : 4); Sfx.boom();
    if (shot && !chained) G.text(this.x, this.y - 20, '덫 폭발!', '#ffd24a', 12, 0.6);
    // 폭발 범위 안의 다른 덫도 터진다 (깔린 지 얼마 안 된 덫 포함). 화살로 쏴서 시작한 연쇄는 끝까지 큰 폭발
    let n = 0;
    for (const tr of bowTraps()) {
      if (tr === this || tr.chainT !== undefined) continue;
      if (Math.hypot(tr.x - this.x, tr.y - this.y) > R + 6) continue;
      tr.chainT = 0.12 + 0.06 * n++; tr.chainShot = shot;
    }
    if (n && !chained) G.text(this.x, this.y - 32, '연쇄!', '#ffb84a', 12, 0.6);
  }
  // 그림: 바닥에 놓인 도트 덫 (이빨 달린 고리) + 가운데 빛. 사라질 때가 되면 깜빡인다
  draw(g) {
    const a0 = g.globalAlpha, col = slotCol(this.slot, FX_WHITE);
    const fadeIn = clamp(this.t / 0.25, 0, 1), blink = this.life < 2 && Math.sin(this.life * 20) < 0 ? 0.35 : 1;
    g.globalAlpha = a0 * fadeIn * blink;
    const x = Math.round(this.x), y = Math.round(this.y);
    // 덫 유인 범위: 천천히 도는 도트 점선
    const lure = this.slot === 'special' ? LURE_R[Math.min(FX.lv('atk_wave'), 3)] : 0;
    if (lure && this.armed) {
      for (let i = 0; i < 24; i++) { // 안쪽으로 조금씩 흘러드는 점 (끌려온다는 느낌)
        const a = i / 24 * Math.PI * 2 + G.time * 0.6, k = ((G.time * 0.5 + i * 0.37) % 1), r = lure * (1 - 0.25 * k);
        const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * 0.7);
        g.globalAlpha = a0 * fadeIn * blink * (1 - k * 0.7); // 밖에서 생겨 안으로 흘러들며 흐려진다
        g.fillStyle = '#2a2d33'; g.fillRect(px - 2, py - 2, 4, 4); // 풀밭에서도 보이게 진한 테두리
        g.fillStyle = col; g.fillRect(px - 1, py - 1, 2, 2);
      }
      g.globalAlpha = a0 * fadeIn * blink;
    }
    // 쇠 덫 (도트): 진한 그림자 위에 밝은 쇠 고리 + 안쪽으로 난 이빨. 풀밭에서도 잘 보이게 테두리를 진하게
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 10, y - 4, 20, 9);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, px = x + Math.round(Math.cos(a) * 9), py = y + Math.round(Math.sin(a) * 5);
      g.fillStyle = '#2a2d33'; g.fillRect(px - 2, py - 2, 4, 4);
    }
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, px = x + Math.round(Math.cos(a) * 9), py = y + Math.round(Math.sin(a) * 5);
      g.fillStyle = i % 4 < 2 ? '#c8ccd4' : '#8a8f99'; g.fillRect(px - 1, py - 1, 2, 2);
    }
    g.fillStyle = '#e8ecf2'; for (const ox of [-6, -2, 2, 6]) { g.fillRect(x + ox - 1, y - 3, 2, 2); g.fillRect(x + ox - 1, y + 2, 2, 2); } // 이빨
    const pulse = 0.6 + 0.4 * Math.sin(G.time * 5 + this.seed);
    g.globalAlpha = a0 * fadeIn * blink * pulse; g.fillStyle = col; g.fillRect(x - 1, y - 1, 3, 3);
    g.globalAlpha = a0;
  }
}

// 덫이 무는 · 터지는 그림: 방패 밀치기처럼 도트 흙먼지(FX/Smoke)가 둘레로 퍼진다 (바위 가시는 이질적이라 바꿈, 2026-10-20)
//   속성이 없으면 흰색, 있으면 그 칸 속성 색. size = 퍼지는 둘레
function trapFx(x, y, slot, size) {
  const tint = slotCol(slot, null);
  G.projectiles.push(new DustRing(x, y - 4, size * 0.6, size > 40 ? 8 : 6, tint));
  G.burst(x, y - 4, 6, slotBurst(slot, ['#ffffff', '#c8ccd4']), 110);
}

Object.assign(FX, {
  // ── 활 ──
  // 꿰뚫는 화살이 지나가는 길: 불길 · 독안개 (차지 칸)
  onPierceMove(x, y) {
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (fc) this.zone(x, y, 'fire', 1.5 + 0.5 * fc);
    if (pc) this.zone(x, y, 'poison', 2 + 0.5 * pc);
  },
  // 꿰뚫는 화살이 끝난 곳: 벼락 화살
  onPierceEnd(p, x, y) {
    const ec = this.lv('elec_charge');
    if (!ec) return;
    const list = this.near(x, y, 110).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 2 + ec);
    for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
  },
  // 덫이 물거나 터졌을 때: 그 칸(특수 = 덫 놓기, 덫 던지기 덫 화살이 놓는 덫도 특수)에 붙은 속성
  onTrap(p, trap, t, boom) {
    const s = ElFx.slot(trap.slot), atk = p.atk;
    if (trap.slot === 'special') { const hw = this.lv('heal_wave'); if (hw && p.alive && !boom) p.hp = Math.min(p.maxHp, p.hp + 0.5 + 0.5 * hw); }
    if (!s) return;
    const lv = s.lv, x = trap.x, y = trap.y;
    if (s.el === 'fire') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; this.zone(x + Math.cos(a) * 14, y + Math.sin(a) * 10, 'fire', 1.5 + 0.5 * lv); } if (t && !t.dead) this.burn(t, 2); }
    else if (s.el === 'frost') { for (const e of this.near(x, y, boom ? TRAP_SHOT_R : TRAP_BOOM_R)) this.chill(e, iceBig(lv)); }
    else if (s.el === 'thunder') { if (t && !t.dead) { this.shock(t); this.chainJump(t, 2 + lv, atk * (0.4 + 0.15 * lv)); } }
    else if (s.el === 'poison') { this.zone(x, y, 'poison', 2 + 0.5 * lv); if (t && !t.dead) this.poison(t, 1 + lv); }
  },
});
