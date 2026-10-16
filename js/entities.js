'use strict';
// 플레이어, 적, 봉인석, 보스, 투사체
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
// 자동 조준 (방향 입력 없이 공격할 때): 거리 120 · 보는 방향 좌우 60°(앞쪽 120°) 안 · 정면 쪽 적을 조금 더 우선
const AIM_RANGE = 120, AIM_HALF_ANGLE = Math.PI / 3, AIM_FRONT_BIAS = 40;

function applyKnockback(e, dt) {
  if (!e.kvx && !e.kvy) return;
  if (e.flying) World.fly(e, e.kvx * dt, e.kvy * dt);
  else {
    const want = Math.hypot(e.kvx, e.kvy) * dt, got = World.move(e, e.kvx * dt, e.kvy * dt);
    if (e.slamT > 0 && want > 1.5 && got < want * 0.4) FX.wallSlam(e);
  }
  if (e.slamT > 0) e.slamT -= dt;
  const k = Math.pow(0.0005, dt);
  e.kvx *= k; e.kvy *= k;
  if (Math.abs(e.kvx) + Math.abs(e.kvy) < 5) e.kvx = e.kvy = 0;
}

function drawHpBar(g, e, yOff) {
  if (e.hp >= e.maxHp) return;
  const w = e.r * 2 + 4, bx = e.x - w / 2, by = e.y - e.r - yOff;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 1, by - 1, w + 2, 5);
  g.fillStyle = '#e04848'; g.fillRect(bx, by, w * Math.max(0, e.hp) / e.maxHp, 3);
}

// 기술 정의: 배율, 넉백, 가드 브레이크 여부
const MOVES = {
  light:    { mult: 1.0, kb: 220, guardBreak: false },
  finisher: { mult: 1.6, kb: 380, guardBreak: false },
  thrust:   { mult: 1.7, kb: 260, guardBreak: true },
  spin:     { mult: 2.2, kb: 320, guardBreak: true },
  wave:     { mult: 1.8, kb: 160, guardBreak: false },
  // 창
  poke:     { mult: 1.15, kb: 140, guardBreak: false },
  pokeFin:  { mult: 1.75, kb: 340, guardBreak: true },
  lunge:    { mult: 1.7, kb: 320, guardBreak: true },   // 관통 찌르기 (차지)
  spear:    { mult: 1.25, kb: 120, guardBreak: false },   // 창 투척 (갈 때·올 때 한 번씩)
  sweep:    { mult: 1.0, kb: 240, guardBreak: true },   // 후려치기 (창 대시 공격)
};
const BASIC_KINDS = ['light', 'finisher', 'thrust', 'poke', 'pokeFin', 'sweep'];
const DASH_CD = 0.7;        // 대시 1회 충전 시간 (초, 모든 무기 공통)
const DASH_CHARGES = 2;     // 기본 대시 충전 횟수 (연속 대시)
const DASH_TIME = 0.16;     // 대시 지속 시간
const INPUT_BUFFER = 0.25;  // 버튼을 이만큼 일찍 눌러도 다음 동작으로 이어진다
// 세계를 클리어할 때 받는 정령의 힘 (레벨 대신)
const STAGE_ATK_MULT = 1.5;
const STAGE_HP_BONUS = 30;

class Player {
  constructor(x, y, s) {
    this.x = x; this.y = y; this.r = 9;
    this.speed = 118;
    this.facing = Math.PI / 2;
    this.lv = s ? s.lv : 1; this.xp = s ? s.xp : 0;
    this.maxHp = s ? s.maxHp : 100; this.atk = s ? s.atk : 10;
    this.hp = s && s.hp ? Math.min(s.hp, this.maxHp) : this.maxHp; // 스테이지 사이엔 체력이 이어진다
    this.weaponId = Meta.data.weapon in WEAPONS ? Meta.data.weapon : 'sword';
    this.weapon = WEAPONS[this.weaponId];
    this.speed *= this.weapon.speedMult || 1;
    this.specialCd = 0; this.skillCd = 0;
    this.alive = true;
    this.act = null;                 // 진행 중인 기술
    this.atkCd = 0; this.combo = 0; this.comboT = 0; this.finisherT = 0;
    this.atkBuffer = 0; this.specialBuffer = 0; this.skillBuffer = 0; this.dashBuffer = 0;
    this.holdT = 0; this.charge = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 0; this.postDashT = 0;
    this.dashStock = this.dashMax; this.dashRecharge = 0; this.leafT = 0;
    this.dashGuardT = 0; this.spinGuardT = 0;
    this.dashHits = new Set(); this.zoneFrom = { x, y };
    this.dodgeT = 0; this.counterT = 0;
    this.invuln = 0; this.hurtT = 0;
    this.kvx = 0; this.kvy = 0;
    this.walk = 0; this.moving = false;
    this.trail = [];
  }

  stats() { return { lv: this.lv, xp: this.xp, hp: this.hp, maxHp: this.maxHp, atk: this.atk, boons: { ...G.boons } }; }
  get dashMax() { return this.weapon.dashCharges || DASH_CHARGES; }
  get dashSpeed() { return this.weapon.dashSpeed || 340; }
  get spearOut() { return !!this.spearShot && !this.spearShot.done; } // 창을 던져서 손이 빈 상태
  get dashCdBase() { return DASH_CD * (this.weapon.dashCdMult || 1) * (1 - 0.08 * Meta.lv('agi')); }
  mastery(id) { return Meta.wlv(this.weaponId, id); }
  get specialCdBase() { return Math.max(Math.min(1.5, this.weapon.specialCd * 0.6), this.weapon.specialCd - 0.7 * FX.lv('atk_wave') - 0.5 * this.mastery('wave')); }
  get skillCdBase() { return this.weapon.skillCd || 1; }
  get chargeTime() { return this.weapon.chargeTime * (1 - 0.15 * FX.lv('atk_spin')) * (1 - 0.1 * this.mastery('spin')); }

  update(dt) {
    const inp = Input.state;
    for (const k of ['atkCd', 'dashCd', 'invuln', 'hurtT', 'comboT', 'finisherT', 'atkBuffer',
      'specialBuffer', 'skillBuffer', 'dashBuffer', 'postDashT', 'dodgeT', 'counterT', 'leafT', 'specialCd', 'skillCd',
      'dashGuardT', 'spinGuardT', 'slowT', 'noDashT']) this[k] -= dt;
    if (this.dashStock < this.dashMax) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) { this.dashStock++; this.dashRecharge = this.dashCdBase; }
    }
    this.bufferInput(inp);
    applyKnockback(this, dt);
    const mag = Math.min(1, Math.hypot(inp.mx, inp.my));

    // 차지: 기본공격을 누르고 있으면 기를 모으고, 다 모은 뒤 떼면 차지공격 (검: 회전베기)
    if (inp.attackHeld && this.weapon.charged && !this.spearOut) {
      this.holdT += dt;
      if (this.holdT > 0.22 && !this.act && this.dashT <= 0) {
        const before = this.charge;
        this.charge = Math.min(1, this.charge + dt / this.chargeTime);
        if (before < 1 && this.charge >= 1) { Sfx.charged(); G.ring(this.x, this.y, '#ffd24a', 30); }
      }
    } else {
      if (this.charge >= 1 && this.dashT <= 0) this.weapon.charged(this, mag);
      this.holdT = 0; this.charge = 0;
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      World.move(this, Math.cos(this.dashDir) * this.dashSpeed * dt, Math.sin(this.dashDir) * this.dashSpeed * dt);
      this.trail.push({ x: this.x, y: this.y, life: 0.18 });
      if (Math.random() < 0.6) G.dust(this.x, this.y + 8);
      FX.onDashMove(this);
      const farEnough = this.dashT < DASH_TIME * 0.4; // 대시 거리를 대부분 간 뒤에 찌르기로 연결
      if (this.atkBuffer > 0 && farEnough && G.has('thrust') && this.weapon.basicAfterDash && !this.spearOut) { this.dashT = 0; FX.onDashEnd(this); this.weapon.basicAfterDash(this); }
      else if (this.dashT <= 0) { this.postDashT = INPUT_BUFFER; FX.onDashEnd(this); }
    } else {
      this.moving = mag > 0.05;
      if (this.moving) {
        if (!this.act) this.facing = Math.atan2(inp.my, inp.mx);
        const mul = (this.act ? 0.25 : this.charge > 0 ? 0.45 : 1) * (this.slowT > 0 ? 0.6 : 1) * G.slowAt(this.x, this.y);
        const l = Math.hypot(inp.mx, inp.my), spd = this.speed * mag * mul;
        World.move(this, inp.mx / l * spd * dt, inp.my / l * spd * dt);
        this.walk += dt * mag;
      }
      const lateInAct = !this.act || this.act.t > this.act.dur * 0.6;
      const W = this.weapon;
      if (this.dashBuffer > 0 && this.dashStock > 0 && !(this.noDashT > 0)) this.startDash(mag);
      else if (W.skill && this.skillBuffer > 0 && this.skillCd <= 0 && lateInAct) {
        this.skillBuffer = 0; this.skillCd = this.skillCdBase; W.skill(this, mag);
      } else if (this.specialBuffer > 0 && this.specialCd <= 0 && lateInAct && !this.spearOut) {
        this.specialBuffer = 0; this.specialCd = this.specialCdBase; W.special(this, mag);
      } else if (this.atkBuffer > 0 && this.atkCd <= 0 && !this.act && !this.spearOut) {
        // 기본공격. 대시 직후엔 대시 공격.
        if (this.postDashT > 0 && G.has('thrust') && W.basicAfterDash) W.basicAfterDash(this);
        else W.basic(this, mag);
      }
    }

    if (this.act) {
      this.act.t += dt;
      this.updateAct(dt);
      if (this.act && this.act.t >= this.act.dur) this.act = null;
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);
  }

  // 누른 버튼을 잠시 기억해 둔다. 게임이 멈춰 있는 순간(히트스톱)에도 매 프레임 불린다.
  bufferInput(inp) {
    if (inp.attack) this.atkBuffer = INPUT_BUFFER;
    if (inp.special) this.specialBuffer = INPUT_BUFFER;
    if (inp.skill) this.skillBuffer = INPUT_BUFFER;
    if (inp.dash) this.dashBuffer = INPUT_BUFFER;
  }

  aim(mag) {
    // 마우스로 하는 중이면 커서 쪽으로
    const ms = Input.state;
    if (ms.mouseAim && ms.mouse && G.view) {
      const wx = G.view.x + ms.mouse.x / SCALE, wy = G.view.y + ms.mouse.y / SCALE;
      this.facing = Math.atan2(wy - this.y, wx - this.x);
      return;
    }
    // 방향 입력 없이 공격하면 가까운 적을 자동 조준 (모바일 편의)
    // 보는 방향 앞쪽 부채꼴 안의 적만 (뒤로 홱 돌지 않게), 정면에 가까울수록 우선
    if (mag >= 0.2) return;
    let best = null, bs = Infinity;
    for (const t of G.targets()) {
      if (t.spawnT > 0.2) continue;
      const d = Math.hypot(t.x - this.x, t.y - this.y) - t.r;
      if (d > AIM_RANGE) continue;
      const off = Math.abs(angDiff(Math.atan2(t.y - this.y, t.x - this.x), this.facing));
      if (off > AIM_HALF_ANGLE) continue;
      const score = d + AIM_FRONT_BIAS * off / AIM_HALF_ANGLE;
      if (score < bs) { bs = score; best = t; }
    }
    if (best) this.facing = Math.atan2(best.y - this.y, best.x - this.x);
  }

  startDash(mag) {
    const inp = Input.state;
    this.dashDir = mag > 0.05 ? Math.atan2(inp.my, inp.mx) : this.facing;
    this.facing = this.dashDir;
    this.act = null; this.charge = 0; this.holdT = 0;
    this.dashT = DASH_TIME; this.dashBuffer = 0;
    if (this.dashStock >= this.dashMax) this.dashRecharge = this.dashCdBase;
    this.dashStock--;
    FX.onDashStart(this);
    this.invuln = Math.max(this.invuln, 0.2);
    this.dodgeT = 0.22;
    Sfx.dash();
  }

  startAttack(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.aim(mag);
    const fin = this.combo === 2;
    this.act = {
      kind: fin ? 'finisher' : 'light', t: 0, dur: fin ? 0.22 : 0.15, hit: new Set(),
      range: fin ? 46 : 37, half: fin ? 1.4 : 1.05, swingDir: this.combo === 1 ? -1 : 1,
    };
    this.atkCd = (fin ? 0.42 : 0.24) * (1 - 0.15 * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    if (fin) this.finisherT = 0.6; // 이 안에 스킬을 쓰면 삼연 검기
    this.atkBuffer = 0;
    Sfx.swing(fin);
    FX.onSwing(this, fin);
  }

  startThrust() {
    this.aim(Math.hypot(Input.state.mx, Input.state.my));
    this.act = { kind: 'thrust', t: 0, dur: 0.22, hit: new Set() };
    this.atkCd = 0.35; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '대시 찌르기', '#9cdcff', 11, 0.5);
    Sfx.thrust();
  }

  startSpin(mag) {
    this.aim(mag);
    this.act = { kind: 'spin', t: 0, dur: 0.36, hit: new Set() };
    this.atkCd = 0.4; this.charge = 0; this.comboT = 0;
    this.invuln = Math.max(this.invuln, 0.15);
    G.text(this.x, this.y - 24, '회전베기', '#ffd24a', 12, 0.6);
    Sfx.spin();
    FX.onSpin(this);
  }

  // 섬광 검기: 관통하는 큰 검기 (3타째 직후엔 세 갈래)
  castWave(mag) {
    this.aim(mag);
    const triple = this.finisherT > 0 && G.has('triple');
    const dirs = triple ? [-0.35, 0, 0.35] : [0];
    for (const o of dirs) G.projectiles.push(new Wave(this.x, this.y - 2, this.facing + o, triple));
    if (triple) G.text(this.x, this.y - 24, '삼연 검기!', '#7fe0ff', 13, 0.7);
    this.finisherT = 0;
    this.act = { kind: 'cast', t: 0, dur: 0.16, hit: new Set() };
    Sfx.wave(triple);
  }

  // ── 창 ──
  // 2연 찌르기: 길고 좁은 직선, 최대 3명 관통. 창끝 ×1.8, 창대(가까이) ×0.6
  startPoke(mag) {
    this.combo = this.comboT > 0 ? (this.combo + 1) % 2 : 0;
    this.aim(mag);
    const fin = this.combo === 1;
    this.act = { kind: fin ? 'pokeFin' : 'poke', t: 0, dur: fin ? 0.18 : 0.15, hit: new Set(), pierced: 0, len: SPEAR_REACH * (fin ? 1.1 : 1) };
    this.atkCd = (fin ? 0.46 : 0.3) * (1 - 0.15 * FX.lv('atk_combo'));
    this.comboT = this.atkCd + 0.3;
    this.atkBuffer = 0;
    Sfx.thrust();
    if (fin) this.finisherT = 0.6; // 이 안에 특수공격 → 삼연 투척
    FX.onPoke(this, fin);
  }

  // 관통 찌르기 (차지): 제자리에서 기본공격보다 조금 더 길게 찔러 줄 위의 적을 모두 관통
  get pierceLen() { return SPEAR_PIERCE_LEN * (1 + 0.1 * FX.lv('atk_spin') + 0.05 * this.mastery('spin')); }
  startLunge(mag) {
    this.aim(mag);
    this.act = { kind: 'lunge', t: 0, dur: 0.24, hit: new Set(), pierced: 0, len: this.pierceLen };
    this.atkCd = 0.5; this.charge = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '관통 찌르기', '#ffd24a', 12, 0.6);
    Sfx.thrust();
    FX.onPierce(this, this.act.len);
  }

  // 창 투척: 갔다가 자동으로 돌아온다. 돌아올 때까지 공격할 수 없다
  // 2타째 직후에 던지면 정령의 힘으로 만든 창 두 자루가 함께 날아간다 (삼연 투척)
  throwSpear(mag) {
    this.aim(mag);
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
  }

  // 후려치기 (대시 직후 공격): 창 자루로 앞쪽 120도를 휩쓴다. 바깥쪽(창끝)일수록 아프고, 옆으로 쳐낸다
  startSweep() {
    this.aim(Math.hypot(Input.state.mx, Input.state.my));
    this.act = { kind: 'sweep', t: 0, dur: 0.24, hit: new Set(), half: SWEEP_HALF, len: this.sweepLen };
    this.atkCd = 0.6; this.atkBuffer = 0; this.postDashT = 0; this.comboT = 0;
    G.text(this.x, this.y - 24, '후려치기', '#9cdcff', 11, 0.5);
    Sfx.swing(true);
  }
  get sweepLen() { return SPEAR_REACH * (1 + 0.1 * FX.lv('atk_thrust')); }

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
  }

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
      if (a.kind === 'lunge') { this.deal(t, a.kind, fx, fy); continue; }
      const tip = along > len * SPEAR_TIP, haft = along < SPEAR_HAFT;
      if (tip) G.burst(t.x - fx * t.r, t.y - fy * t.r, 6, ['#fff', '#ffe18a'], 160);
      this.deal(t, a.kind, fx, fy, { mult: tip ? SPEAR_TIP_MULT : haft ? SPEAR_HAFT_MULT : 1, tip });
    }
  }

  updateAct(dt) {
    const a = this.act, fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    if (a.kind === 'poke' || a.kind === 'pokeFin') {
      if (a.t < a.dur * 0.4) World.move(this, fx * 60 * dt, fy * 60 * dt);
      if (a.t > a.dur * 0.2) this.hitSpear(a, a.len, SPEAR_WIDTH, SPEAR_PIERCE);
      return;
    }
    if (a.kind === 'lunge') {
      if (a.t > a.dur * 0.15 && a.t < a.dur * 0.7) this.hitSpear(a, a.len, SPEAR_WIDTH + 2, 0);
      else if (a.t >= a.dur * 0.7 && !a.ended) { a.ended = true; FX.onLungeEnd(this); }
      return;
    }
    if (a.kind === 'sweep') {
      if (a.t < a.dur * 0.4) World.move(this, fx * 90 * dt, fy * 90 * dt); // 대시 기세로 살짝 미끄러진다
      this.hitSweep(a);
      return;
    }
    if (a.kind === 'light' || a.kind === 'finisher') {
      if (a.t < a.dur * 0.5) World.move(this, fx * 130 * dt, fy * 130 * dt);
      this.hitArc(a, a.range, a.half);
    } else if (a.kind === 'thrust') {
      const sp = 300 * (1 + 0.15 * FX.lv('atk_thrust'));
      World.move(this, fx * sp * dt, fy * sp * dt);
      this.hitLine(a, 46, 15);
    } else if (a.kind === 'spin') {
      this.hitArc(a, this.spinRange, Math.PI);
    }
  }

  get spinRange() { return 56 * (1 + 0.15 * FX.lv('atk_spin') + 0.08 * this.mastery('spin')); }

  hitArc(a, range, half) {
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
      if (d > range + t.r) continue;
      if (half < Math.PI && d > t.r + 6 && Math.abs(angDiff(Math.atan2(dy, dx), this.facing)) > half) continue;
      a.hit.add(t);
      this.deal(t, a.kind, dx / d, dy / d);
    }
  }

  hitLine(a, len, width) {
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    for (const t of G.targets()) {
      if (a.hit.has(t)) continue;
      const dx = t.x - this.x, dy = t.y - this.y;
      const along = dx * fx + dy * fy, perp = Math.abs(dx * fy - dy * fx);
      if (along < -8 || along > len + t.r || perp > width + t.r) continue;
      a.hit.add(t);
      this.deal(t, a.kind, fx, fy);
    }
  }

  deal(t, kind, nx, ny, o = {}) {
    const m = MOVES[kind];
    let dmg = this.atk * m.mult * (o.mult || 1) * rand(0.9, 1.1) * (1 + G.chainBonus()) * FX.damageMult(this, kind, t);
    const kb = m.kb;
    let crit = Math.random() < FX.critChance(), counter = false;
    if (this.counterT > 0) { crit = true; counter = true; this.counterT = 0; }
    if (crit) dmg *= FX.critMult();
    if (counter) dmg *= 1.3;
    G.hit(t, { dmg: Math.round(dmg), nx, ny, kb, guardBreak: m.guardBreak, crit, counter, kind, tip: o.tip, back: o.back });
  }

  draw(g) {
    // 차지 표시
    if (this.charge > 0) {
      const full = this.charge >= 1, cs = ElFx.slot('charge'), a1 = -Math.PI / 2 + Math.PI * 2 * this.charge;
      if (cs) {
        ElFx.arc(g, cs, this.x, this.y + 2, 16, -Math.PI / 2, a1, full ? 3 : 2, full ? 0.7 + Math.sin(G.time * 30) * 0.3 : 0.55);
        if (full && Math.random() < 0.45) ElFx.spark(cs, this.x + rand(-14, 14), this.y + rand(-10, 10));
      } else {
        g.strokeStyle = full ? `rgba(255,210,74,${0.6 + Math.sin(G.time * 30) * 0.3})` : 'rgba(255,255,255,0.6)';
        g.lineWidth = full ? 3 : 2;
        g.beginPath(); g.arc(this.x, this.y + 2, 16, -Math.PI / 2, a1); g.stroke();
      }
    }
    // 대시 잔상
    const ds = ElFx.slot('dash');
    for (const t of this.trail) {
      g.globalAlpha = t.life / 0.18 * (ds && ds.max ? 0.5 : 0.35);
      g.fillStyle = ds ? EL_STYLE[ds.el].main : '#9cc4ff';
      g.beginPath(); g.arc(t.x, t.y - 3, 9, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = this.alive ? 1 : 0.5;
    if (this.hurtT > 0 && ((G.time * 20) | 0) % 2 === 0) g.globalAlpha *= 0.3;

    const bob = this.moving ? Math.abs(Math.sin(this.walk * 14)) * 1.5 : 0;
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    const x = this.x, y = this.y - bob;

    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(this.x, this.y + 9, 9, 4, 0, 0, Math.PI * 2); g.fill();

    // 반격 준비 상태: 푸른 오라
    if (this.counterT > 0) {
      g.fillStyle = `rgba(127,224,255,${0.25 + Math.sin(G.time * 20) * 0.1})`;
      g.beginPath(); g.arc(x, y - 2, 15, 0, Math.PI * 2); g.fill();
    }

    // 시트: 열 = 방향, 0~3행 = 걷기, 4행 = 공격, 5행 = 점프(대시)
    const col = dirCol(this.facing);
    const busy = this.act && this.act.kind !== 'cast';
    const row = this.dashT > 0 ? 5 : busy || this.charge > 0 ? 4 : this.moving ? Math.floor(this.walk * 9) % 4 : 0;
    const swordBehind = col === 1;
    const weapon = (gg, wx, wy) => (this.weaponId === 'spear' ? this.drawSpear(gg, wx, wy) : this.drawSword(gg, wx, wy));
    if (swordBehind) weapon(g, x, y);
    drawCell(g, 'hero', col, row, x, y + 13);
    if (!swordBehind) weapon(g, x, y);
    g.globalAlpha = 1;
  }

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
  }

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
    } else if (a && a.kind === 'lunge') {
      const p = a.t / a.dur, e = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      spearSprite(g, x, cy, f, -12 + e * 46);
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
  }

  // 도트 검 (칼끝이 위를 향한 그림을 각도에 맞춰 돌린다)
  blade(g, x, y, a) {
    const im = ART.img.sword, w = im.width * PIX, h = im.height * PIX;
    g.save();
    g.translate(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    g.rotate(a + Math.PI / 2);
    g.drawImage(im, -w / 2, -h + 6, w, h);
    g.restore();
  }
}

// 창 그림: 손잡이 위치(x, y)에서 각도 a 로, ext 만큼 앞으로 내민다
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
    this.range = SPEAR_THROW_RANGE * k; this.speed = 520 * k; this.backSpeed = 640 * k;
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
      if (this.dist >= this.range) { this.back = true; this.hit = new Set(); FX.onSpearApex(this); }
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
      p.deal(t, 'spear', nx, ny, { back: this.back });
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
    FX.onWaveMove(this);
    clearShotsNear(this.x, this.y, this.size);
    for (const t of G.targets()) {
      if (this.hit.has(t)) continue;
      if (Math.hypot(t.x - this.x, t.y - this.y) < t.r + this.size * 0.8) {
        this.hit.add(t);
        G.player.deal(t, 'wave', c, s);
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

// 적 피해 배율: 높을수록 어렵다. 플레이어 레벨이 오르면 적 피해도 레벨당 5%씩 오른다.
const ENEMY_DMG_MULT = 2.6;
// 몬스터 체력: 처음부터 단단하게(기본 배율 ↑), 뒤로 갈수록 덜 오르게(상승폭 ↓)
// → 초반엔 어렵고, 축복이 잘 붙을수록 후반이 쉬워진다고 느껴지게. 세계 3 후반 체력은 예전과 비슷.
const ENEMY_HP_MULT = 1.5;
const ENEMY_HP_STEP = 0.10;   // 난이도 1 오를 때마다 체력 +10% (예전 +25%)

// shot: 투사체 피해(배율 전), keep: 유지하려는 거리, rate: 공격 간격(초), wind: 쏘기 전 예고(초)
const ENEMY = {
  // 세계 1 · 슬라임 대왕의 들판
  slime:    { hp: 26, speed: 55, dmg: 8, xp: 4, r: 10, color: '#5ccf6a' },
  bigslime: { hp: 85, speed: 50, dmg: 11, xp: 10, r: 15, color: '#7ad8ff' },   // 말랑이 분열할 때
  stump:    { hp: 1, speed: 0, dmg: 0, xp: 0, r: 14, color: '#a88a52', decoy: true }, // 바루의 가짜 그루터기
  bat:      { hp: 14, speed: 88, dmg: 6, xp: 5, r: 8, color: '#7a5bb5', flying: true },
  mushroom: { hp: 22, speed: 32, dmg: 6, xp: 5, r: 10, color: '#c86a8a', ranged: true, shot: 7, keep: 140, rate: 2.6, wind: 0.6 },
  mole:     { hp: 30, speed: 70, dmg: 9, xp: 6, r: 10, color: '#c0504a' },
  // 세계 2 · 너구리 패거리
  racoon:   { hp: 34, speed: 92, dmg: 8, xp: 6, r: 10, color: '#a87a4a' },
  bear:     { hp: 90, speed: 42, dmg: 13, xp: 15, r: 13, color: '#8a5a3a', heavy: true },
  snake:    { hp: 26, speed: 48, dmg: 6, xp: 6, r: 9, color: '#6ab04a', ranged: true, shot: 7, keep: 125, rate: 2.2, wind: 0.5 },
  owl:      { hp: 20, speed: 70, dmg: 6, xp: 6, r: 9, color: '#b89a6a', flying: true, ranged: true, shot: 6, keep: 165, rate: 3.0, wind: 0.7 },
  // 세계 3 · 봉인의 망령들
  shield:   { hp: 50, speed: 46, dmg: 10, xp: 12, r: 11, color: '#d8d2c0' },
  skull:    { hp: 28, speed: 45, dmg: 7, xp: 7, r: 9, color: '#a88ad8', flying: true, ranged: true, shot: 9, keep: 175, rate: 3.2, wind: 0.6 },
  eye:      { hp: 32, speed: 36, dmg: 6, xp: 8, r: 10, color: '#ff6a5a', ranged: true, shot: 12, keep: 200, rate: 3.6, wind: 1.0 },
  flam:     { hp: 24, speed: 55, dmg: 8, xp: 7, r: 9, color: '#ff9a3c', ranged: true, shot: 9, keep: 140, rate: 2.4, wind: 0.45 },
  orc:      { hp: 70, speed: 50, dmg: 12, xp: 15, r: 13, color: '#7a8f3a', heavy: true },
  // 세계 4 · 늪의 주민들
  kappa:    { hp: 40, speed: 72, dmg: 11, xp: 7, r: 10, color: '#6ac87a', swim: true },
  axolot:   { hp: 26, speed: 44, dmg: 6, xp: 7, r: 9, color: '#ff9ad0', ranged: true, shot: 7, keep: 150, rate: 2.4, wind: 0.5 },
  spider:   { hp: 24, speed: 50, dmg: 6, xp: 7, r: 9, color: '#d84a4a', ranged: true, shot: 5, keep: 165, rate: 2.8, wind: 0.6 },
  mollusc:  { hp: 110, speed: 24, dmg: 10, xp: 12, r: 12, color: '#c8b8a0', heavy: true },
  tadpole:  { hp: 10, speed: 96, dmg: 5, xp: 1, r: 6, color: '#2a3a30' },      // 개굴대왕이 부르는 올챙이
  // 세계 5 · 우마왕의 투사들
  lion:     { hp: 38, speed: 80, dmg: 12, xp: 8, r: 11, color: '#d8a050' },
  trex:     { hp: 64, speed: 52, dmg: 13, xp: 12, r: 12, color: '#7ab04a', heavy: true },
  cyclops2: { hp: 52, speed: 34, dmg: 10, xp: 10, r: 12, color: '#8a6ad8', ranged: true, shot: 13, keep: 190, rate: 3.2, wind: 0.8 },
  lizard:   { hp: 26, speed: 50, dmg: 6, xp: 7, r: 9, color: '#6ad8a0', ranged: true, shot: 6, keep: 145, rate: 2.6, wind: 0.45 },
  // 세계 6 · 봉인의 수호자들
  demon:      { hp: 44, speed: 58, dmg: 13, xp: 10, r: 10, color: '#e04848' },
  lantern:    { hp: 30, speed: 48, dmg: 6, xp: 8, r: 9, color: '#ff8a3c', flying: true, ranged: true, shot: 7, keep: 150, rate: 3.0, wind: 0.8 },
  statue:     { hp: 95, speed: 0, dmg: 8, xp: 12, r: 12, color: '#a8a8b8', heavy: true, turret: true, ranged: true, shot: 11, keep: 160, rate: 2.8, wind: 0.9 },
  babydragon: { hp: 30, speed: 64, dmg: 7, xp: 8, r: 9, color: '#ffd24a', flying: true, ranged: true, shot: 7, keep: 95, rate: 2.4, wind: 0.55 },
};

class Enemy {
  constructor(type, x, y, stage, lv) {
    const d = ENEMY[type];
    this.type = type; this.x = x; this.y = y;
    this.r = d.r; this.speed = d.speed; this.xp = d.xp;
    this.dmg = Math.round(d.dmg * ENEMY_DMG_MULT * (1 + 0.25 * (stage - 1)) * (1 + 0.05 * (lv - 1)));
    this.color = d.color; this.flying = !!d.flying; this.heavy = !!d.heavy;
    this.maxHp = this.hp = Math.round(d.hp * ENEMY_HP_MULT * (1 + ENEMY_HP_STEP * (stage - 1)) * (1 + 0.08 * (lv - 1)) * (curse('hp') ? 1.2 : 1));
    if (curse('dmg')) this.dmg = Math.round(this.dmg * 1.15);
    this.flash = 0; this.stun = 0; this.kvx = 0; this.kvy = 0;
    this.t = Math.random() * 10; this.hop = 0;
    this.state = 'chase'; this.st = 0; this.lungeDir = 0; this.attacking = false;
    this.wander = Math.random() * Math.PI * 2;
    this.facing = 0; this.guard = type === 'shield'; this.brokenT = 0;
    this.spawnT = 0.5; this.dead = false;
    this.def = d; this.ranged = !!d.ranged;
    this.shotDmg = Math.round((d.shot || 0) * ENEMY_DMG_MULT * (1 + 0.25 * (stage - 1)) * (1 + 0.05 * (lv - 1)) * (curse('dmg') ? 1.15 : 1));
    this.cd = rand(1.0, 2.2); this.aimDir = 0; this.strafe = Math.random() < 0.5 ? 1 : -1;
    if (type === 'mole') { this.state = 'up'; this.st = 0.8; }
    if (d.turret) this.superArmor = true; // 석상: 밀리지 않는다
  }

  update(dt, p) {
    this.t += dt; this.flash -= dt; this.stun -= dt; this.spawnT -= dt;
    if (this.def.decoy) return; // 가짜 그루터기: 가만히 있는다
    applyKnockback(this, dt);
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    if (this.type === 'shield' && !this.guard) {
      this.brokenT -= dt;
      if (this.brokenT <= 0) this.guard = true;
    }
    if (this.stun > 0 || this.frozenT > 0) { this.attacking = false; if (this.state !== 'chase') { this.state = 'recover'; this.st = 0.3; } return; }
    const slow = 1 - 0.15 * (this.chill || 0);
    const mv = (vx, vy) => this.flying ? World.fly(this, vx * slow * dt, vy * slow * dt) : this.steer(vx * slow, vy * slow, dt);
    const chase = p.alive && d < 420;
    if (!chase && Math.random() < dt * 0.5) this.wander = Math.random() * Math.PI * 2;
    this.st -= dt;

    if (this.type === 'slime' || this.type === 'bigslime') {
      const ph = this.t % 1;
      this.hop = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI) : 0;
      if (ph < 0.5) {
        const a = chase ? Math.atan2(dy, dx) : this.wander, s = this.speed * 1.7 * (chase ? 1 : 0.4);
        mv(Math.cos(a) * s, Math.sin(a) * s);
      }
    } else if (this.type === 'bat') {
      const a = chase ? Math.atan2(dy, dx) + Math.sin(this.t * 4) * 0.9 : this.wander;
      const s = this.speed * (chase ? 1 : 0.4);
      mv(Math.cos(a) * s, Math.sin(a) * s);
    } else if (this.type === 'orc') {
      this.lungeAI(dt, p, dx, dy, d, chase, mv, 85, 0.55, 280, 0.28);
    } else if (this.type === 'kappa') {
      // 물을 헤엄쳐 다가온다. 물속에선 맞지 않고, 뭍에 올라와야 싸울 수 있다
      const swim = (vx, vy) => this.swim(vx * slow, vy * slow, dt);
      this.burrowed = World.inWater(this.x, this.y + 4);
      if (this.burrowed && Math.random() < dt * 6) G.particles.push({ x: this.x + rand(-6, 6), y: this.y + 4, vx: 0, vy: -10, life: 0.5, max: 0.5, color: '#bfefff', size: 2, grav: 0 });
      // 거리와 상관없이 늘 쫓아온다 → 물속에 숨어 안 나오는 갓파가 생기지 않게
      this.lungeAI(dt, p, dx, dy, d, p.alive, swim, 60, 0.4, 300, 0.18);
    } else if (this.type === 'mollusc') {
      if (chase) mv(dx / d * this.speed, dy / d * this.speed);
      // 지나간 자리에 미끄덩한 점액
      if (!this.trailFrom || Math.hypot(this.x - this.trailFrom.x, this.y - this.trailFrom.y) > 18) {
        this.trailFrom = { x: this.x, y: this.y };
        G.slows.push({ x: this.x, y: this.y + 4, r: 16, life: 4, max: 4, kind: 'slime', mul: 0.6 });
      }
    } else if (this.type === 'tadpole') {
      const a = chase ? Math.atan2(dy, dx) + Math.sin(this.t * 10) * 0.6 : this.wander;
      mv(Math.cos(a) * this.speed, Math.sin(a) * this.speed);
    } else if (this.type === 'demon') {
      this.demonAI(dt, p, dx, dy, d, chase, mv);
    } else if (this.type === 'lion') {
      this.lionAI(dt, p, dx, dy, d, chase, mv);
    } else if (this.type === 'trex') {
      // 돌진 뒤에 꼬리 휘두르기
      if (this.state === 'tail') {
        if (this.st <= 0) {
          G.burst(this.x, this.y, 10, ['#c9b48a', '#fff'], 140);
          if (p.alive && d < TREX_TAIL_R + p.r) G.hurtPlayer(this.dmg, { x: this.x, y: this.y, attacking: true });
          this.state = 'recover'; this.st = 0.6;
        }
      } else {
        const before = this.state;
        this.lungeAI(dt, p, dx, dy, d, chase, mv, 150, 0.6, 360, 0.35);
        if (before === 'lunge' && this.state === 'recover') { this.state = 'tail'; this.st = 0.35; }
      }
    } else if (this.type === 'racoon') {
      // 치고 빠지기: 짧게 달려들고, 빈틈 동안 뒤로 물러난다
      if (this.state === 'recover') mv(-dx / d * this.speed * 0.9, -dy / d * this.speed * 0.9);
      this.lungeAI(dt, p, dx, dy, d, chase, mv, 70, 0.3, 320, 0.16);
    } else if (this.type === 'bear') {
      this.lungeAI(dt, p, dx, dy, d, chase, mv, 90, 0.6, 260, 0.3);
    } else if (this.type === 'mole') {
      this.moleAI(dt, p, dx, dy, d, chase, mv);
    } else if (this.type === 'flam' && this.state !== 'aim' && (this.state === 'rage' || this.state === 'boom' || this.hp < this.maxHp * 0.5)) {
      this.flamRage(dt, p, dx, dy, d, mv);
    } else if (this.ranged) {
      this.rangedAI(dt, p, dx, dy, d, chase, mv);
    } else if (this.type === 'shield') {
      // 방패는 천천히 플레이어 쪽으로 돈다 → 옆이나 뒤로 돌아가면 뚫린다
      const want = Math.atan2(dy, dx), turn = (this.state === 'chase' ? 2.2 : 0.6) * dt;
      this.facing += clamp(angDiff(want, this.facing), -turn, turn);
      this.lungeAI(dt, p, dx, dy, d, chase, mv, 50, 0.4, 200, 0.18);
    }

    // 넉백 등으로 숲 · 물 위에 떠 있게 되면 플레이어 쪽으로 천천히 돌아온다
    if (this.flying && !World.reachable(this.x, this.y)) World.fly(this, dx / d * 70 * dt, dy / d * 70 * dt);
    if (p.alive && this.spawnT <= 0 && !this.burrowed && d < this.r + p.r - 1) {
      G.hurtPlayer(this.attacking ? Math.round(this.dmg * 1.5) : this.dmg, this);
    }
  }

  // 원거리: 일정 거리를 유지하며 맴돌다가, 예고 후 쏜다
  rangedAI(dt, p, dx, dy, d, chase, mv) {
    const D = this.def;
    if (this.state === 'aim') {
      if (this.type === 'statue') { if (!this.beamAngles) this.beamAngles = (this.cross = !this.cross) ? [0, 1, 2, 3].map(k => k * Math.PI / 2) : [0, 1, 2, 3].map(k => Math.PI / 4 + k * Math.PI / 2); }
      else if (this.st > 0.2) this.aimDir = Math.atan2(dy, dx); // 마지막 순간엔 방향 고정 → 피할 수 있다
      if (this.st <= 0) {
        this.fire();
        if (this.type === 'eye' || this.type === 'statue') { this.state = 'beam'; this.st = 0.28; this.beamHit = false; }
        else { this.state = 'chase'; this.cd = D.rate * rand(0.85, 1.15) * (curse('swift') ? 0.8 : 1); }
      }
      return;
    }
    if (this.state === 'beam') {
      this.beamCheck(p);
      if (this.st <= 0) { this.state = 'chase'; this.beamAngles = null; this.cd = D.rate * rand(0.85, 1.15) * (curse('swift') ? 0.8 : 1); }
      return;
    }
    this.cd -= dt;
    if (!chase) { mv(Math.cos(this.wander) * 20, Math.sin(this.wander) * 20); return; }
    const ux = dx / d, uy = dy / d, s = this.speed, ox = this.x, oy = this.y;
    // 멀면 다가오고, 사거리 안이면 옆으로 맴돈다. 뒤로 도망가지는 않는다 → 다가가면 잡을 수 있다
    if (d > D.keep + 30) mv(ux * s, uy * s);
    else mv(-uy * s * 0.5 * this.strafe, ux * s * 0.5 * this.strafe);
    // 나는 몬스터도 걸어서 갈 수 없는 곳(숲 · 물 위)으로는 물러나지 않는다 → 못 잡는 몹이 생기지 않게
    if (this.flying && !World.reachable(this.x, this.y) && World.reachable(ox, oy)) { this.x = ox; this.y = oy; this.strafe *= -1; }
    if (Math.random() < dt * 0.3) this.strafe *= -1;
    if (this.cd <= 0 && d < D.keep + 140 && this.spawnT <= 0) {
      this.state = 'aim'; this.st = D.wind; this.aimDir = Math.atan2(dy, dx);
    }
  }

  fire() {
    const a = this.aimDir, x = this.x, y = this.y - (this.flying ? 10 : 4), dmg = this.shotDmg;
    const shot = (dir, o) => G.eshots.push(new EnemyShot(x, y, dir, Object.assign({ dmg }, o)));
    if (this.type === 'mushroom') for (const o of [-0.35, 0, 0.35]) shot(a + o, { kind: 'spore', speed: 95, r: 6, life: 3.2 });
    else if (this.type === 'owl') for (let i = 0; i < 5; i++) shot(a - 0.5 + i * 0.25, { kind: 'feather', speed: 175, r: 4, life: 1.9 });
    else if (this.type === 'snake') shot(a, { kind: 'dart', speed: 230, r: 4, life: 1.6, slow: 1.0 });
    else if (this.type === 'skull') shot(a, { kind: 'orb', speed: 105, r: 7, life: 4.5, homing: 1.4, breakable: true });
    else if (this.type === 'flam') shot(a, { kind: 'fire', speed: 185, r: 6, life: 2.2 });
    else if (this.type === 'axolot') { shot(a, { kind: 'spit', speed: 160, r: 6, life: 2, nodash: 1.6 }); shot(a + 0.25, { kind: 'spit', speed: 140, r: 5, life: 2, nodash: 1.6 }); }
    else if (this.type === 'spider') shot(a, { kind: 'web', speed: 150, r: 6, life: 1.4, web: true });
    else if (this.type === 'cyclops2') { const p = G.player; G.eshots.push(new EnemyShot(x, y, a, { kind: 'boulder', r: BOULDER_R, dmg, life: 1.1, lob: { x0: x, y0: y, tx: p.x, ty: p.y, dur: 1.1 } })); }
    else if (this.type === 'lizard') for (const sp of [210, 175, 140]) shot(a, { kind: 'rock', speed: sp, r: 5, life: 1.8 });
    else if (this.type === 'lantern') for (let i = 0; i < 8; i++) shot(i / 8 * Math.PI * 2 + this.t, { kind: 'fire', speed: 115, r: 6, life: 2.4 });
    else if (this.type === 'babydragon') for (let i = 0; i < 5; i++) shot(a - 0.35 + i * 0.175, { kind: 'fire', speed: rand(150, 190), r: 5, life: 0.55 });
    if (this.type !== 'eye') Sfx.wave(false); else Sfx.zap();
  }

  // 눈알 광선: 직선 위에 있으면 한 번 맞는다 (지형을 뚫는다)
  beamCheck(p) {
    if (this.beamHit || !p.alive) return;
    const dx = p.x - this.x, dy = p.y - this.y, len = this.type === 'statue' ? STATUE_BEAM_LEN : EYE_BEAM_LEN;
    for (const a of this.beamAngles || [this.aimDir]) {
      const c = Math.cos(a), s = Math.sin(a), along = dx * c + dy * s, perp = Math.abs(dx * s - dy * c);
      if (along > 0 && along < len && perp < 9 + p.r) {
        this.beamHit = true;
        G.hurtPlayer(this.shotDmg, { x: this.x, y: this.y, attacking: true });
        return;
      }
    }
  }

  // 두더지: 땅속으로 다가가 발밑에서 튀어나온다 (땅속에선 맞지 않는다)
  moleAI(dt, p, dx, dy, d, chase, mv) {
    if (this.state !== 'up' && this.state !== 'under' && this.state !== 'emerge') { this.state = 'up'; this.st = 1.0; }
    if (this.state === 'up') {
      this.burrowed = false;
      if (this.st < 1.6) this.attacking = false;
      if (chase) mv(dx / d * this.speed * 0.35, dy / d * this.speed * 0.35);
      if (this.st <= 0) { this.state = 'under'; this.st = 3; this.burrowed = true; G.burst(this.x, this.y + 6, 8, ['#8a6a4a', '#c8a878'], 80); }
    } else if (this.state === 'under') {
      this.burrowed = true;
      if (chase) mv(dx / d * this.speed, dy / d * this.speed); else mv(Math.cos(this.wander) * 25, Math.sin(this.wander) * 25);
      if (Math.random() < dt * 8) G.particles.push({ x: this.x + rand(-6, 6), y: this.y + 6, vx: rand(-15, 15), vy: rand(-30, -10), life: 0.4, max: 0.4, color: '#a8865a', size: 2.5, grav: 60 });
      // 가까이 가거나, 3초가 지나면 (물에 막혀 못 다가가도) 그 자리에서 튀어나온다
      if ((chase && d < 26) || this.st <= 0) { this.state = 'emerge'; this.st = 0.6; }
    } else if (this.state === 'emerge') {
      if (this.st <= 0) {
        this.state = 'up'; this.st = 1.8; this.burrowed = false; this.attacking = true;
        G.burst(this.x, this.y + 4, 14, ['#8a6a4a', '#c8a878', '#fff'], 150); G.shake = Math.max(G.shake, 3);
        if (p.alive && d < MOLE_POP_R + p.r) G.hurtPlayer(Math.round(this.dmg * 1.3), { x: this.x, y: this.y, attacking: true });      }
    }
  }

  // 도깨비불: 약해지면 달려와서 터진다
  flamRage(dt, p, dx, dy, d, mv) {
    if (this.state !== 'rage' && this.state !== 'boom') { this.state = 'rage'; this.st = 2.2; G.text(this.x, this.y - 18, '!', '#ff5a3c', 14, 0.6); }
    if (this.state === 'rage') {
      mv(dx / d * 150, dy / d * 150);
      if (d < 34 || this.st <= 0) { this.state = 'boom'; this.st = 0.4; }
    } else if (this.st <= 0) {
      G.burst(this.x, this.y, 22, ['#ff9a3c', '#ffd24a', '#fff'], 220); G.fxRing(this.x, this.y, '#ff7a3c', FLAM_BOOM_R); G.shake = Math.max(G.shake, 6); Sfx.boom();
      if (p.alive && Math.hypot(p.x - this.x, p.y - this.y) < FLAM_BOOM_R + p.r) G.hurtPlayer(Math.round(this.shotDmg * 1.6), { x: this.x, y: this.y, attacking: true });
      this.hp = 0; G.killEnemy(this);
    }
  }

  // 붉은 도깨비: 사라졌다가 등 뒤에 나타나 벤다 (나타날 자리에 그림자 예고)
  demonAI(dt, p, dx, dy, d, chase, mv) {
    if (this.state === 'vanish') {
      this.burrowed = true;
      if (this.st <= 0) {
        const bx = p.x - Math.cos(p.facing) * 38, by = p.y - Math.sin(p.facing) * 38;
        if (World.reachable(bx, by) && !World.blocked(bx, by, this.r)) { this.x = bx; this.y = by; }
        this.state = 'mark'; this.st = 0.6;
      }
      return;
    }
    if (this.state === 'mark') {
      if (this.st <= 0) {
        this.state = 'slash'; this.st = 0.25; this.burrowed = false; this.attacking = true;
        G.burst(this.x, this.y, 12, ['#ff5a5a', '#2a0a0a'], 160); Sfx.swing(true);
        if (p.alive && Math.hypot(p.x - this.x, p.y - this.y) < DEMON_SLASH_R + p.r) G.hurtPlayer(Math.round(this.dmg * 1.2), { x: this.x, y: this.y, attacking: true });
      }
      return;
    }
    if (this.state === 'slash') { if (this.st <= 0) { this.attacking = false; this.state = 'recover'; this.st = 0.7; this.cd = rand(3, 4); } return; }
    if (this.state === 'recover') { if (this.st <= 0) this.state = 'chase'; return; }
    this.cd -= dt;
    if (chase) mv(dx / d * this.speed, dy / d * this.speed); else mv(Math.cos(this.wander) * 20, Math.sin(this.wander) * 20);
    if (chase && this.cd <= 0 && d < 240 && this.spawnT <= 0) { this.state = 'vanish'; this.st = 0.4; G.burst(this.x, this.y, 14, ['#3a1a2a', '#ff5a5a'], 140); }
  }

  // 동굴사자: 웅크렸다가 멀리서 덮친다 (착지 지점 예고)
  lionAI(dt, p, dx, dy, d, chase, mv) {
    if (this.state === 'crouch') {
      if (this.st > 0.2) this.leapTo = { x: p.x, y: p.y };
      if (this.st <= 0) { this.state = 'leap'; this.st = 0.42; this.leapFrom = { x: this.x, y: this.y }; this.attacking = true; Sfx.dash(); }
      return;
    }
    if (this.state === 'leap') {
      const k = clamp(1 - this.st / 0.42, 0, 1), tg = this.leapTo;
      const nx = this.leapFrom.x + (tg.x - this.leapFrom.x) * k, ny = this.leapFrom.y + (tg.y - this.leapFrom.y) * k;
      World.move(this, nx - this.x, ny - this.y);
      this.air = Math.sin(k * Math.PI) * 26;
      if (this.st <= 0) {
        this.air = 0; this.attacking = false; this.state = 'recover'; this.st = 0.8; this.cd = rand(2.2, 3);
        G.burst(this.x, this.y + 6, 10, ['#c9b48a', '#fff'], 130);
        if (p.alive && Math.hypot(p.x - this.x, p.y - this.y) < LION_POUNCE_R + p.r) G.hurtPlayer(Math.round(this.dmg * 1.2), { x: this.x, y: this.y, attacking: true });
      }
      return;
    }
    if (this.state === 'recover') { if (this.st <= 0) this.state = 'chase'; return; }
    this.cd -= dt;
    if (chase) mv(dx / d * this.speed, dy / d * this.speed); else mv(Math.cos(this.wander) * 20, Math.sin(this.wander) * 20);
    if (chase && this.cd <= 0 && d < 180 && d > 50 && this.spawnT <= 0) { this.state = 'crouch'; this.st = 0.7; this.leapTo = { x: p.x, y: p.y }; }
  }

  // 헤엄 이동 (물 통과, 나무 · 바위에 막히면 옆으로 비킨다)
  swim(vx, vy, dt) {
    let a = Math.atan2(vy, vx);
    const want = Math.hypot(vx, vy) * dt;
    if (this.detourT > 0) { this.detourT -= dt; a += this.detour; }
    const x0 = this.x, y0 = this.y, step = Math.ceil(want / 8) || 1, sx = Math.cos(a) * want / step, sy = Math.sin(a) * want / step;
    for (let i = 0; i < step; i++) {
      if (!World.swimBlocked(this.x + sx, this.y, this.r)) this.x += sx;
      if (!World.swimBlocked(this.x, this.y + sy, this.r)) this.y += sy;
    }
    if (want > 0.3 && Math.hypot(this.x - x0, this.y - y0) < want * 0.3 && !(this.detourT > 0)) { this.detour = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; this.detourT = rand(0.4, 0.8); }
  }

  // 장애물에 막히면 잠깐 옆으로 비켜 걷는다
  steer(vx, vy, dt) {
    let a = Math.atan2(vy, vx);
    const want = Math.hypot(vx, vy) * dt;
    if (this.detourT > 0) { this.detourT -= dt; a += this.detour; }
    const moved = World.move(this, Math.cos(a) * want, Math.sin(a) * want);
    if (want > 0.3 && moved < want * 0.3 && !(this.detourT > 0)) {
      this.detour = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      this.detourT = rand(0.4, 0.8);
    }
  }

  // 예고 → 돌진 → 빈틈 패턴 (외눈이, 방패병 공용)
  lungeAI(dt, p, dx, dy, d, chase, mv, range, wind, speed, dur) {
    if (this.state === 'chase') {
      if (chase) mv(dx / d * this.speed, dy / d * this.speed);
      else mv(Math.cos(this.wander) * 20, Math.sin(this.wander) * 20);
      if (chase && d < range && this.st <= 0) { this.state = 'windup'; this.st = wind; }
    } else if (this.state === 'windup') {
      if (this.st > 0.2) this.lungeDir = Math.atan2(dy, dx); // 마지막 순간엔 방향 고정 → 피할 수 있다
      if (this.st <= 0) { this.state = 'lunge'; this.st = dur; this.attacking = true; Sfx.lunge(); }
    } else if (this.state === 'lunge') {
      mv(Math.cos(this.lungeDir) * speed, Math.sin(this.lungeDir) * speed);
      if (this.st <= 0) { this.state = 'recover'; this.st = 0.6; this.attacking = false; }
    } else if (this.st <= 0) { this.state = 'chase'; this.st = 0.8; }
  }

  drawTelegraph(g) {
    const blink = 0.15 + Math.sin(this.t * 30) * 0.08;
    if (this.type === 'statue' && (this.state === 'aim' || this.state === 'beam') && this.beamAngles) {
      const beam = this.state === 'beam';
      for (const a of this.beamAngles) {
        const c = Math.cos(a), s = Math.sin(a);
        g.strokeStyle = beam ? 'rgba(255,220,120,0.9)' : `rgba(255,200,80,${0.3 + blink})`; g.lineWidth = beam ? 10 : 1.5;
        g.beginPath(); g.moveTo(this.x, this.y - 6); g.lineTo(this.x + c * STATUE_BEAM_LEN, this.y - 6 + s * STATUE_BEAM_LEN); g.stroke();
        if (beam) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
      }
      return;
    }
    if (this.type === 'demon' && this.state === 'mark') {
      g.fillStyle = `rgba(120,0,30,${0.35 + blink})`;
      g.beginPath(); g.ellipse(this.x, this.y + 6, DEMON_SLASH_R, DEMON_SLASH_R * 0.6, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.type === 'eye' && (this.state === 'aim' || this.state === 'beam')) {
      const c = Math.cos(this.aimDir), s = Math.sin(this.aimDir), beam = this.state === 'beam';
      g.strokeStyle = beam ? 'rgba(255,90,70,0.9)' : `rgba(255,60,40,${0.35 + blink})`; g.lineWidth = beam ? 10 : 1.5;
      g.beginPath(); g.moveTo(this.x, this.y - 4); g.lineTo(this.x + c * EYE_BEAM_LEN, this.y - 4 + s * EYE_BEAM_LEN); g.stroke();
      if (beam) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
      return;
    }
    if (this.type === 'lion' && this.state === 'crouch' && this.leapTo) {
      g.fillStyle = `rgba(255,60,40,${blink + 0.1})`;
      g.beginPath(); g.ellipse(this.leapTo.x, this.leapTo.y + 4, LION_POUNCE_R, LION_POUNCE_R * 0.65, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.type === 'trex' && this.state === 'tail') {
      g.fillStyle = `rgba(255,60,40,${blink + 0.1})`;
      g.beginPath(); g.ellipse(this.x, this.y + 4, TREX_TAIL_R, TREX_TAIL_R * 0.7, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.type === 'mole' && this.state === 'emerge') {
      g.fillStyle = `rgba(255,60,40,${blink + 0.1})`;
      g.beginPath(); g.ellipse(this.x, this.y + 6, MOLE_POP_R, MOLE_POP_R * 0.6, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.type === 'flam' && this.state === 'boom') {
      g.fillStyle = `rgba(255,80,30,${blink + 0.15})`;
      g.beginPath(); g.ellipse(this.x, this.y + 4, FLAM_BOOM_R, FLAM_BOOM_R * 0.7, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.state !== 'windup') return;
    const len = this.type === 'orc' || this.type === 'bear' ? 80 : this.type === 'trex' ? 140 : 45, w = this.r;
    const c = Math.cos(this.lungeDir), s = Math.sin(this.lungeDir);
    g.fillStyle = `rgba(255,60,40,${0.15 + Math.sin(this.t * 30) * 0.08})`;
    g.beginPath();
    g.moveTo(this.x - s * w, this.y + c * w); g.lineTo(this.x + c * len - s * w, this.y + s * len + c * w);
    g.lineTo(this.x + c * len + s * w, this.y + s * len - c * w); g.lineTo(this.x + s * w, this.y - c * w);
    g.closePath(); g.fill();
  }

  draw(g) {
    g.globalAlpha = clamp(1 - this.spawnT / 0.5, 0, 1);
    const white = this.flash > 0;
    const p = G.player;
    const look = Math.atan2(p.y - this.y, p.x - this.x);
    const lx = Math.cos(look), ly = Math.sin(look);

    if (this.type === 'stump') {
      drawStump(g, this.x, this.y, this.t);
    } else if (this.type === 'tadpole') {
      const a = this.t * 12, x = this.x, y = this.y;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y + 5, 6, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = white ? '#fff' : '#1f2a24'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = white ? '#fff' : '#1f2a24'; g.lineWidth = 2;
      const lk = Math.atan2(p.y - y, p.x - x) + Math.PI;
      g.beginPath(); g.moveTo(x + Math.cos(lk) * 4, y + Math.sin(lk) * 4);
      g.quadraticCurveTo(x + Math.cos(lk) * 8 + Math.sin(a) * 3, y + Math.sin(lk) * 8 + Math.cos(a) * 3, x + Math.cos(lk) * 12, y + Math.sin(lk) * 12); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(x - 2, y - 2, 1.5, 1.5); g.fillRect(x + 1, y - 2, 1.5, 1.5);
    } else if (this.type === 'slime' || this.type === 'bigslime') {
      const big = this.type === 'bigslime' ? 1.6 : 1;
      const h = this.hop, x = this.x, y = this.y - h * 9 * big;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(this.x, this.y + 8 * big, (10 - h * 3) * big, (4 - h) * big, 0, 0, Math.PI * 2); g.fill();
      const ph = this.t % 1, row = h > 0.6 ? 2 : h > 0 ? 1 : ph > 0.5 && ph < 0.62 ? 3 : 0;
      drawCell(g, 'slime', dirCol(look), row, x, y + 11 * big, { white, scale: PIX * big });
    } else if (this.type === 'bat') {
      const x = this.x, y = this.y - 10 + Math.sin(this.t * 6) * 2;
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath(); g.ellipse(this.x, this.y + 6, 7, 3, 0, 0, Math.PI * 2); g.fill();
      drawCell(g, 'bat', dirCol(look), Math.floor(this.t * 10) % 4, x, y + 12, { white });
    } else if (this.type === 'orc') {
      const x = this.x, y = this.y, wind = this.state === 'windup';
      const shake = wind ? Math.sin(this.t * 60) * 1.2 : 0;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(x, y + 11, 13, 5, 0, 0, Math.PI * 2); g.fill();
      const dir = this.state === 'lunge' || wind ? dirCol(this.lungeDir) : dirCol(look);
      const red = wind ? (((this.t * 16) | 0) % 2 ? 0.6 : 0.2) : this.state === 'lunge' ? 0.35 : 0;
      drawCell(g, 'cyclope', dir, this.state === 'chase' ? Math.floor(this.t * 7) % 4 : 0, x + shake, y + 14, { white, red, scale: 2.3 });
      if (wind) this.bang(g, x, y - this.r - 6);
    } else if (MONSTER_ART[this.type]) {
      this.drawMonster(g, white, look);
    } else if (this.type === 'shield') {
      const x = this.x, y = this.y, fx = Math.cos(this.facing), fy = Math.sin(this.facing);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(x, y + 10, 11, 4, 0, 0, Math.PI * 2); g.fill();
      const drawShield = () => {
        if (!this.guard) return;
        const sx = x + fx * 11, sy = y + fy * 8;
        g.save(); g.translate(sx, sy); g.rotate(this.facing);
        g.fillStyle = white ? '#fff' : '#7a4f28'; g.fillRect(-3, -11, 6, 22);
        g.fillStyle = '#c0c4cc'; g.fillRect(-3, -11, 6, 2); g.fillRect(-3, 9, 6, 2); g.fillRect(1, -2, 3, 4);
        g.restore();
      };
      if (fy < 0) drawShield();
      const row = this.state === 'chase' ? Math.floor(this.t * 7) % 4 : this.state === 'windup' || this.state === 'lunge' ? 4 : 0;
      drawCell(g, 'skeleton', dirCol(this.facing), row, x, y + 13, { white, red: this.state === 'windup' ? 0.4 : 0 });
      if (fy >= 0) drawShield();
      if (!this.guard) { // 가드가 깨진 상태: 머리 위에 별
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + i * 2.1;
          g.fillStyle = '#ffd24a'; g.fillRect(x + Math.cos(a) * 9 - 1.5, y - 18 + Math.sin(a) * 3 - 1.5, 3, 3);
        }
      }
      if (this.state === 'windup') this.bang(g, x, y - this.r - 10);
    }
    FX.drawStatus(g, this);
    drawHpBar(g, this, this.flying ? 22 : 14);
    g.globalAlpha = 1;
  }

  // 새 몬스터 공용 그리기 (4방향 × 4프레임 시트)
  drawMonster(g, white, look) {
    const A = MONSTER_ART[this.type], x = this.x;
    if (this.burrowed && this.type === 'demon') return; // 사라짐
    if (this.burrowed && this.type === 'kappa') { // 물속: 머리 접시와 물결만 보인다
      g.strokeStyle = 'rgba(200,240,255,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, this.y + 4, 10 + Math.sin(this.t * 6) * 2, 4, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#6ac87a'; g.beginPath(); g.ellipse(x, this.y + 1, 6, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c8f0e0'; g.beginPath(); g.ellipse(x, this.y, 3.5, 1.5, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    if (this.burrowed) { // 땅속: 흙 둔덕만 보인다
      g.fillStyle = '#7a5a3a'; g.beginPath(); g.ellipse(x, this.y + 6, 9, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a8865a'; g.beginPath(); g.ellipse(x, this.y + 5, 6, 2.5, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    const fly = (this.flying ? 10 + Math.sin(this.t * 5) * 2 : 0) + (this.air || 0), y = this.y - fly;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, this.y + 8, this.r * 0.9, this.r * 0.4, 0, 0, Math.PI * 2); g.fill();
    const busy = this.state === 'aim' || this.state === 'windup' || this.state === 'boom' || this.state === 'beam' || this.state === 'crouch' || this.state === 'tail' || this.state === 'slash';
    const dir = busy || this.state === 'lunge' ? dirCol(this.state === 'aim' || this.state === 'beam' ? this.aimDir : this.lungeDir) : dirCol(look);
    const row = busy ? 0 : Math.floor(this.t * (this.type === 'racoon' ? 10 : 7)) % 4;
    const red = this.state === 'aim' || this.state === 'windup' || this.state === 'crouch' || this.state === 'tail' ? (((this.t * 16) | 0) % 2 ? 0.55 : 0.2)
      : this.state === 'rage' || this.state === 'boom' ? (((this.t * 20) | 0) % 2 ? 0.7 : 0.25) : 0;
    const puff = this.type === 'mushroom' && this.state === 'aim' ? 1 + (1 - this.st / this.def.wind) * 0.25 : 1;
    drawCell(g, this.type, dir, row, x, y + 12, { white, red, scale: A.scale, sx: puff, sy: puff });
    if (this.state === 'windup' || this.state === 'boom') this.bang(g, x, y - this.r - 10);
  }

  bang(g, x, y) {
    g.fillStyle = '#ff5a3c'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
    g.fillText('!', x, y);
  }
}

// 새 몬스터 그림 크기
const MONSTER_ART = {
  mushroom: { scale: 2 }, mole: { scale: 2 }, racoon: { scale: 2 }, bear: { scale: 2.4 }, snake: { scale: 2 },
  owl: { scale: 2 }, skull: { scale: 2 }, eye: { scale: 2 }, flam: { scale: 2 },
  kappa: { scale: 2 }, axolot: { scale: 2 }, spider: { scale: 2 }, mollusc: { scale: 2.2 },
  lion: { scale: 2.2 }, trex: { scale: 2.4 }, cyclops2: { scale: 2.4 }, lizard: { scale: 2 },
  demon: { scale: 2.2 }, lantern: { scale: 2 }, statue: { scale: 2.5 }, babydragon: { scale: 2 },
};
const DEMON_SLASH_R = 36;     // 도깨비 기습 범위
const STATUE_BEAM_LEN = 300;  // 석상 광선 길이
const LION_POUNCE_R = 32;  // 사자 덮치기 범위
const TREX_TAIL_R = 46;    // 티렉스 꼬리 범위
const BOULDER_R = 30;      // 외눈 거인 바위 범위
const EYE_BEAM_LEN = 340;  // 눈알 광선 길이
const MOLE_POP_R = 28;     // 두더지가 튀어나올 때 범위
const FLAM_BOOM_R = 48;    // 도깨비불 자폭 범위

// 몬스터가 쏘는 투사체. 지형에 막히고, 검기 · 던진 창에 지워진다. 해골 구슬은 공격으로 부술 수 있다.
class EnemyShot {
  constructor(x, y, dir, o) {
    Object.assign(this, { x, y, dir, t: 0, done: false }, o);
    this.max = this.life;
  }
  update(dt) {
    const p = G.player;
    this.t += dt; this.life -= dt;
    if (this.lob) {
      const L = this.lob, k = clamp(this.t / L.dur, 0, 1);
      this.x = L.x0 + (L.tx - L.x0) * k; this.y = L.y0 + (L.ty - L.y0) * k; this.h = Math.sin(k * Math.PI) * 90;
      if (k >= 1) {
        G.burst(this.x, this.y, 16, ['#8a6a4a', '#c9b48a', '#fff'], 180); G.shake = Math.max(G.shake, 4); Sfx.slam();
        if (p.alive && Math.hypot(p.x - this.x, p.y - this.y) < this.r + p.r) G.hurtPlayer(this.dmg, { x: this.x, y: this.y, attacking: true });
        this.done = true;
      }
      return;
    }
    if (this.homing && p.alive) {
      const want = Math.atan2(p.y - this.y, p.x - this.x);
      this.dir += clamp(angDiff(want, this.dir), -this.homing * dt, this.homing * dt);
    }
    this.x += Math.cos(this.dir) * this.speed * dt;
    this.y += Math.sin(this.dir) * this.speed * dt;
    if (this.life <= 0 || World.solidAt(this.x, this.y + 6)) { this.pop(); return; }
    if (p.alive && Math.hypot(p.x - this.x, p.y - 4 - this.y) < this.r + p.r) {
      const before = p.hp;
      G.hurtPlayer(this.dmg, { x: this.x, y: this.y, attacking: true });
      if (this.slow && p.hp < before) p.slowT = this.slow;
      if (this.nodash && p.hp < before) { p.noDashT = this.nodash; G.text(p.x, p.y - 30, '대시 봉인!', '#ff9ad0', 12, 0.8); }
      this.pop();
    }
  }
  pop() {
    this.done = true;
    if (this.web) G.slows.push({ x: this.x, y: this.y + 4, r: 34, life: 5, max: 5, kind: 'web', mul: 0.45 });
    if (this.puddle) G.slows.push({ x: this.x, y: this.y + 4, r: 26, life: 4, max: 4, kind: 'venom', mul: 0.6 });
    G.burst(this.x, this.y, 5, [SHOT_COLOR[this.kind], '#fff'], 80);
  }
  draw(g) {
    if (this.lob) { // 바위 포격: 떨어질 자리 그림자 + 날아가는 바위
      const L = this.lob, k = clamp(this.t / L.dur, 0, 1);
      g.fillStyle = `rgba(255,50,30,${0.15 + k * 0.25})`;
      g.beginPath(); g.ellipse(L.tx, L.ty, this.r, this.r * 0.65, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(L.tx, L.ty, this.r * k, this.r * 0.65 * k, 0, 0, Math.PI * 2); g.fill();
      const by = this.y - this.h;
      g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(this.x, by, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a8865a'; g.beginPath(); g.arc(this.x - 3, by - 3, 4, 0, Math.PI * 2); g.fill();
      return;
    }
    const a = clamp(this.life / 0.3, 0, 1), c = Math.cos(this.dir), s = Math.sin(this.dir);
    g.globalAlpha = a;
    if (this.kind === 'rock') {
      g.save(); g.translate(this.x, this.y); g.rotate(this.t * 16);
      g.fillStyle = '#8a7a6a'; g.fillRect(-4, -4, 8, 8); g.fillStyle = '#b8a890'; g.fillRect(-4, -4, 4, 4);
      g.restore();
    } else if (this.kind === 'feather' || this.kind === 'dart' || this.kind === 'leaf') {
      g.save(); g.translate(this.x, this.y); g.rotate(this.dir);
      if (this.kind === 'leaf') g.rotate(this.t * 14);
      g.fillStyle = this.kind === 'dart' ? '#7ad84a' : this.kind === 'leaf' ? '#8ad84a' : '#e8dcc0';
      g.fillRect(-7, -1.5, 12, 3);
      g.fillStyle = this.kind === 'dart' ? '#c8ff8a' : '#8a6a4a'; g.fillRect(3, -2, 4, 4);
      g.restore();
    } else {
      const col = SHOT_COLOR[this.kind], pulse = 1 + Math.sin(this.t * 14) * 0.12;
      g.fillStyle = col; g.globalAlpha = a * 0.35;
      g.beginPath(); g.arc(this.x, this.y, this.r * 1.9 * pulse, 0, Math.PI * 2); g.fill();
      g.globalAlpha = a;
      g.beginPath(); g.arc(this.x, this.y, this.r * pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(this.x - c, this.y - s, this.r * 0.4, 0, Math.PI * 2); g.fill();
      if (Math.random() < 0.4) G.particles.push({ x: this.x, y: this.y, vx: -c * 20, vy: -s * 20, life: 0.3, max: 0.3, color: col, size: 2, grav: 0 });
    }
    g.globalAlpha = 1;
  }
}
const SHOT_COLOR = { spore: '#c86ad8', feather: '#e8dcc0', dart: '#7ad84a', orb: '#a070ff', fire: '#ff8a3c', leaf: '#8ad84a', spit: '#ff9ad0', web: '#e8e8f0', rock: '#b8a890', boulder: '#8a6a4a', venom: '#9be15d' };

// 플레이어의 검기 · 던진 창이 지나가며 적 투사체를 지운다
function clearShotsNear(x, y, r) {
  for (const s of G.eshots) if (!s.done && Math.hypot(s.x - x, s.y - y) < r + s.r) s.pop();
}

// 봉인석 모양·색: 세계마다 다르다 (돌 색, 빛 색, 룬 모양)
const SEAL_THEMES = [
  { name: '황금 봉인석', stone: '#7a7468', lit: '#a29a88', glow: [255, 206, 74],  hex: '#ffd24a', rune: 'cross' },   // 초록 들판
  { name: '청옥 봉인석', stone: '#4a3a30', lit: '#6e5646', glow: [80, 220, 230],  hex: '#50dce6', rune: 'diamond' }, // 단풍 숲
  { name: '핏빛 봉인석', stone: '#1e1a24', lit: '#3a3244', glow: [255, 70, 90],   hex: '#ff4a5a', rune: 'eye' },     // 어둠의 숲
  { name: '이끼 봉인석', stone: '#34463c', lit: '#4e6656', glow: [120, 240, 190], hex: '#78f0be', rune: 'diamond' }, // 안개 늪
  { name: '불꽃 봉인석', stone: '#5a2a1a', lit: '#7a3e26', glow: [255, 150, 60],  hex: '#ff963c', rune: 'cross' },   // 바위 협곡
  { name: '용의 봉인석', stone: '#2a1a3a', lit: '#46305e', glow: [255, 90, 210],  hex: '#ff5ad2', rune: 'eye' },     // 봉인의 근원
];
const sealTheme = () => SEAL_THEMES[((G.stage || 1) - 1) % SEAL_THEMES.length];

// 봉인석: 부수는 것이 스테이지 목표. 가까이 가면 몬스터를 불러낸다.
class Totem {
  constructor(x, y, stage) {
    this.type = 'totem'; this.x = x; this.y = y; this.r = 15;
    this.maxHp = this.hp = Math.round(60 + stage * 40);
    this.shielded = true; this.crack = 0;   // 웨이브를 모두 정리하면 보호막이 깨진다
    this.superArmor = true; this.flash = 0; this.stun = 0; this.kvx = 0; this.kvy = 0;
    this.t = Math.random() * 5; this.summonT = 1.5; this.dead = false; this.stage = stage;
    this.theme = sealTheme();
  }
  update(dt, p) {
    this.t += dt; this.flash -= dt;
  }
  draw(g) {
    const x = this.x, y = this.y, pulse = 0.5 + Math.sin(this.t * 3) * 0.5, white = this.flash > 0;
    const th = this.theme, [cr, cg, cb] = th.glow, glow = a => `rgba(${cr},${cg},${cb},${a})`;
    g.fillStyle = glow(0.12 + pulse * 0.12);
    g.beginPath(); g.ellipse(x, y + 10, 30, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(x, y + 12, 14, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = white ? '#fff' : th.stone;
    g.beginPath(); g.moveTo(x - 12, y + 12); g.lineTo(x - 9, y - 26); g.lineTo(x, y - 34); g.lineTo(x + 9, y - 26); g.lineTo(x + 12, y + 12); g.closePath(); g.fill();
    g.fillStyle = white ? '#fff' : th.lit;
    g.beginPath(); g.moveTo(x - 12, y + 12); g.lineTo(x - 9, y - 26); g.lineTo(x, y - 34); g.lineTo(x - 2, y + 12); g.closePath(); g.fill();
    // 룬
    g.fillStyle = glow(0.6 + pulse * 0.4);
    if (th.rune === 'cross') {
      g.fillRect(x - 1.5, y - 22, 3, 14); g.fillRect(x - 5, y - 17, 10, 3);
    } else if (th.rune === 'diamond') {
      g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 6, y - 15); g.lineTo(x, y - 6); g.lineTo(x - 6, y - 15); g.closePath(); g.fill();
      g.fillStyle = th.stone; g.fillRect(x - 1.5, y - 17, 3, 4); g.fillStyle = glow(0.6 + pulse * 0.4);
    } else {
      g.beginPath(); g.ellipse(x, y - 15, 7, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = th.stone; g.beginPath(); g.arc(x, y - 15, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = glow(0.6 + pulse * 0.4); g.fillRect(x - 0.75, y - 24, 1.5, 4); g.fillRect(x - 0.75, y - 10, 1.5, 4);
    }
    g.beginPath(); g.arc(x, y - 1, 3, 0, Math.PI * 2); g.fill();
    if (Math.random() < 0.1) G.particles.push({ x: x + rand(-8, 8), y: y - rand(0, 25), vx: 0, vy: -30, life: 0.8, max: 0.8, color: th.hex, size: 2, grav: 0 });
    const w = 36, bx = x - w / 2, by = y - 44;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 1, by - 1, w + 2, 6);
    g.fillStyle = th.hex; g.fillRect(bx, by, w * Math.max(0, this.hp) / this.maxHp, 4);
    FX.drawStatus(g, this);
    // 보호막과 금
    if (this.shielded) {
      const a = 0.25 + Math.sin(this.t * 4) * 0.08;
      g.strokeStyle = glow(a + 0.35); g.lineWidth = 2;
      g.fillStyle = glow(a * 0.6);
      g.beginPath(); g.ellipse(x, y - 12, 26, 32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
      for (let i = 0; i < this.crack; i++) {
        const ang = i * 2.1 + 0.4, ox = Math.cos(ang) * 14, oy = Math.sin(ang) * 18 - 12;
        g.beginPath(); g.moveTo(x + ox * 0.3, y + oy * 0.3); g.lineTo(x + ox * 0.7 + 3, y + oy * 0.7); g.lineTo(x + ox, y + oy); g.stroke();
      }
    }
  }
}

const BOSS_NAMES = ['슬라임 대왕 말랑', '숲지기 너구리 바루', '숲의 군주', '늪의 왕 개굴대왕', '도끼황소 우마왕', '삼룡'];
const BOSS_COLORS = [['#8a6d3b', '#a88a52'], ['#6a7a8a', '#8b9aa8'], ['#4b2f6b', '#6d4a92'], ['#2a6a5a', '#4a9a7a'], ['#8a2a1a', '#c84a2a'], ['#5a1a4a', '#a84a8a']];

// 보스: 세계마다 고유 패턴. 공통으로 체력 절반 이하에서 격노, 벽에 부딪히는 돌진은 기절(반격 기회).
//  말랑(슬라임): 통통 점프 연타 · 내려찍기 · 슬라임 소환 / 격노 시 분열(큰 슬라임 둘)
//  바루(너구리): 배 두드리기 충격파 · 나뭇잎 표창 · 배치기 돌진 / 격노 후 둔갑술(그루터기 사이에 숨기)
//  숲의 군주(대나무): 뿌리 솟구침 · 대나무 창비 · 망령 소환 · 내려찍기 / 격노 시 숲이 시든다(시야 어두워짐)
class Boss {
  constructor(x, y, stage) {
    this.type = 'boss'; this.x = x; this.y = y; this.r = 28; this.stage = stage;
    const i = this.kind = Math.min(stage, BOSS_NAMES.length) - 1;
    this.name = BOSS_NAMES[i];
    this.colors = BOSS_COLORS[i];
    this.maxHp = this.hp = Math.round(450 * 1.1 * (1 + 0.5 * (stage - 1)));
    this.dmg = Math.round(16 * ENEMY_DMG_MULT * (1 + 0.3 * (stage - 1)) * (1 + 0.05 * (G.player.lv - 1)));
    this.speed = 46; this.superArmor = true; this.scale = 1;
    this.flash = 0; this.stun = 0; this.kvx = 0; this.kvy = 0;
    this.state = 'intro'; this.st = 1.5; this.t = 0; this.dir = 0;
    this.enraged = false; this.attacking = false; this.dead = false;
    this.hz = [];            // 예고 후 터지는 공격들 (원 · 직선)
    this.decoys = [];        // 바루의 가짜 그루터기
    this.disguiseCd = 0;
    if (i === 5) { // 삼룡: 용 셋이 체력을 나눠 가진다. 보스 자신은 맞지 않는다
      this.untargetable = true; this.each = Math.round(this.maxHp * 0.42); this.maxHp = this.hp = this.each * 3;
    }
    if (curse('hp')) this.maxHp = this.hp = Math.round(this.hp * 1.2);
    if (curse('dmg')) this.dmg = Math.round(this.dmg * 1.15);
    if (curse('rage')) { this.enraged = true; this.speed *= 1.3; } // 분노한 주인: 처음부터 격노
  }
  get vulnerable() { return this.state === 'stun'; }
  get fast() { return this.enraged ? 0.7 : 1; }

  // 다음 패턴 고르기
  choose(d) {
    const r = Math.random();
    if (this.kind === 0) {
      if (r < 0.2 && G.enemies.length < 6) return 'summon';
      if (r < 0.65) return 'hop';
      return d < 120 ? 'slamWind' : 'chargeWind';
    }
    if (this.kind === 1) {
      if (this.enraged && this.disguiseCd <= 0 && r < 0.3) return 'disguise';
      if (r < 0.4) return 'drumWind';
      if (r < 0.7) return 'leafWind';
      return 'chargeWind';
    }
    if (this.kind === 4) { // 우마왕
      if (r < 0.14 && G.enemies.length < 6) return 'summon';
      if (r < 0.48) return 'chargeWind';
      if (r < 0.76) return 'axeWind';
      return 'splitWind';
    }
    if (this.kind === 3) { // 개굴대왕
      if (r < 0.18 && G.enemies.length < 8) return 'summon';
      if (r < 0.55) return 'tongueWind';
      return 'hop';
    }
    if (r < 0.18 && G.enemies.length < 5) return 'summon';
    if (r < 0.5) return 'rootWind';
    if (r < 0.8) return 'bamboo';
    return d < 120 ? 'slamWind' : 'rootWind';
  }

  enrage() {
    this.enraged = true; this.speed *= 1.3;
    G.text(this.x, this.y - 40, '격노!', '#ff5a3c', 20, 1.2); G.shake = 8; Sfx.roar();
    if (this.kind === 0) { // 분열: 큰 슬라임 둘을 떼어 내고 작고 빨라진다
      this.scale = 0.8; this.r = 22; this.speed *= 1.15;
      for (const o of [-1, 1]) {
        const e = new Enemy('bigslime', this.x + o * 40, this.y + 10, G.diff, G.player.lv);
        e.kvx = o * 260; G.enemies.push(e);
      }
      G.burst(this.x, this.y, 30, ['#7ad8ff', '#fff'], 240);
      G.text(this.x, this.y - 58, '분열!', '#9fd8ff', 18, 1.2);
      G.lumi.say('갈라졌어요! 작은 쪽이 진짜 대왕이에요!');
    } else if (this.kind === 1) {
      G.lumi.say('둔갑술을 쓸지도 몰라요! 진짜 바루를 찾아요!');
    } else if (this.kind === 2) {
      G.lumi.say('숲이 시들고 있어요… 어두워도 정신 차려요!');
    } else if (this.kind === 4) {
      G.lumi.say('콧김을 뿜어요! 이제 돌진이 두 번 이어져요!');
    } else if (this.kind === 3) { // 늪이 차오른다: 진흙 웅덩이
      G.lumi.say('늪 물이 차올라요! 진흙에 빠지면 느려져요!');
      this.mudT = 0;
    }
  }

  // 원형 예고 공격: delay 뒤 반경 r 안이면 맞는다
  hzCircle(x, y, r, delay, dmg, look) { this.hz.push({ kind: 'circle', x, y, r, t: delay, max: delay, dmg, look, fired: false, life: 0.4 }); }
  // 직선 예고 공격: (x, y)에서 a 방향으로 len, 폭 w
  hzLine(x, y, a, len, w, delay, dmg, look) { this.hz.push({ kind: 'line', x, y, a, len, w, t: delay, max: delay, dmg, look, fired: false, life: 0.5 }); }
  updateHazards(dt, p) {
    for (const h of this.hz) {
      if (!h.fired) {
        h.t -= dt;
        if (h.t > 0) continue;
        h.fired = true;
        let hit = false;
        if (h.kind === 'circle') hit = Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r;
        else {
          const c = Math.cos(h.a), s = Math.sin(h.a), dx = p.x - h.x, dy = p.y - h.y, along = dx * c + dy * s;
          hit = along > -10 && along < h.len && Math.abs(dx * s - dy * c) < h.w + p.r;
        }
        if (h.look === 'bamboo') { G.burst(h.x, h.y, 8, ['#8ad84a', '#d8f0a0'], 120); Sfx.thrust(); }
        else if (h.look === 'root') { G.shake = Math.max(G.shake, 5); Sfx.slam(); }
        else { G.burst(h.x, h.y + 6, 14, ['#c9b48a', '#fff'], 180); G.shake = Math.max(G.shake, 6); Sfx.slam(); }
        if (hit && p.alive) G.hurtPlayer(h.dmg, { x: h.x, y: h.y, attacking: true });
      } else h.life -= dt;
    }
    this.hz = this.hz.filter(h => !h.fired || h.life > 0);
  }

  update(dt, p) {
    if (this.kind === 5) { this.updateTrio(dt, p); return; }
    this.t += dt; this.flash -= dt; this.st -= dt; this.disguiseCd -= dt;
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    const fast = this.fast;
    if (!this.enraged && this.hp < this.maxHp / 2 && this.state !== 'hidden') this.enrage();
    this.updateHazards(dt, p);
    this.attacking = false;
    switch (this.state) {
      case 'intro':
        if (this.st <= 0) { this.state = 'chase'; this.st = 1.2; }
        break;
      case 'chase':
        if (p.alive) { const sl = 1 - 0.075 * (this.chill || 0); this.steer(dx / d * this.speed * sl, dy / d * this.speed * sl, dt); }
        if (this.st <= 0 && p.alive) this.begin(this.choose(d), p, dx, dy, d);
        break;

      // ── 공통: 돌진 · 내려찍기 · 소환 ──
      case 'chargeWind':
        if (this.st > 0.22) this.dir = Math.atan2(dy, dx);
        if (this.st <= 0) { this.state = 'charge'; this.st = 1.0; Sfx.lunge(); }
        break;
      case 'charge': {
        this.attacking = true;
        const want = 360 * dt;
        const moved = World.move(this, Math.cos(this.dir) * want, Math.sin(this.dir) * want);
        if (Math.random() < 0.7) G.dust(this.x, this.y + 18);
        if (moved < want * 0.4) { // 벽에 부딪힘 → 기절 (반격 기회)
          this.state = 'stun'; this.st = 1.6;
          G.shake = 10; G.text(this.x, this.y - 40, this.kind === 4 ? '뿔이 박혔다!' : '기절!', '#ffd24a', 18, 1.2);
          this.recharged = false;
          G.burst(this.x, this.y, 16, ['#ddd', '#a88a52'], 160); Sfx.slam(); Input.rumble(0.6, 200);
          G.lumi.say('지금이에요! 공격해요!', 1.6);
        } else if (this.st <= 0) {
          if (this.kind === 4 && this.enraged && !this.recharged) { this.recharged = true; this.state = 'chargeWind'; this.st = 0.45; }
          else { this.recharged = false; this.state = 'recover'; this.st = 0.6; }
        }
        break;
      }
      // ── 우마왕: 도끼 회전베기 · 땅 가르기 ──
      case 'axeWind':
        if (this.st <= 0) { this.state = 'axeSpin'; this.st = 1.0; this.spinHit = false; Sfx.spin(); }
        break;
      case 'axeSpin':
        this.attacking = true;
        if (this.enraged && p.alive) this.steer(dx / d * this.speed * 1.4, dy / d * this.speed * 1.4, dt);
        if (!this.spinHit && p.alive && d < AXE_SPIN_R + p.r) { this.spinHit = true; G.hurtPlayer(Math.round(this.dmg * 1.1), this); }
        if (Math.random() < 0.5) G.dust(this.x + rand(-30, 30), this.y + 18);
        if (this.st <= 0) { this.state = 'recover'; this.st = 0.8; }
        break;
      case 'splitWind':
        if (this.st <= 0) { this.state = 'recover'; this.st = 0.9; }
        break;
      case 'slamWind':
        if (this.st <= 0) {
          G.shake = 9; Sfx.slam(); Input.rumble(0.7, 180);
          G.burst(this.x, this.y + 10, 20, ['#c9b48a', '#fff'], 200);
          this.attacking = true;
          if (d < 84 + p.r) G.hurtPlayer(Math.round(this.dmg * 1.3), this);
          if (this.enraged) G.rings.push({ x: this.x, y: this.y, r: 30, max: 240, dmg: Math.round(this.dmg * 0.8), hit: false });
          this.state = 'recover'; this.st = 0.7;
        }
        break;
      case 'summon':
        if (this.st <= 0) {
          const kinds = BOSS_SUMMON[this.kind];
          for (let i = 0; i < 3; i++) G.spawnNear(this.x, this.y, 40, 90, kinds[i % kinds.length]);
          Sfx.roar(); this.state = 'recover'; this.st = 0.5;
        }
        break;

      // ── 말랑: 통통 점프 연타 ──
      case 'hopWind':
        if (this.st <= 0) { this.state = 'hopAir'; this.st = 0.38; this.hopFrom = { x: this.x, y: this.y }; Sfx.dash(); }
        break;
      case 'hopAir': {
        const k = clamp(1 - this.st / 0.38, 0, 1), tg = this.hopTo;
        const nx = this.hopFrom.x + (tg.x - this.hopFrom.x) * k, ny = this.hopFrom.y + (tg.y - this.hopFrom.y) * k;
        World.move(this, nx - this.x, ny - this.y);
        this.air = Math.sin(k * Math.PI) * 40;
        if (this.st <= 0) {
          this.air = 0; this.hops--;
          if (this.hops > 0) this.startHop(p, 0.32 * fast);
          else { this.state = 'recover'; this.st = 0.9; }
        }
        break;
      }

      // ── 바루: 배 두드리기 · 나뭇잎 표창 · 둔갑술 ──
      case 'drumWind':
        if (this.st <= 0) { this.state = 'drum'; this.st = 0; this.beats = this.enraged ? 4 : 3; }
        break;
      case 'drum':
        if (this.st <= 0) {
          G.rings.push({ x: this.x, y: this.y, r: 30, max: 280, dmg: Math.round(this.dmg * 0.7), hit: false });
          G.shake = Math.max(G.shake, 4); Sfx.slam(); G.text(this.x, this.y - 46, '둥!', '#ffd28a', 14, 0.5);
          this.beats--; this.st = 0.42;
          if (this.beats <= 0) { this.state = 'recover'; this.st = 0.8; }
        }
        break;
      case 'leafWind':
        if (this.st > 0.15) this.dir = Math.atan2(dy, dx);
        if (this.st <= 0) { this.state = 'leaves'; this.st = 0; this.volleys = this.enraged ? 3 : 2; }
        break;
      case 'leaves':
        if (this.st <= 0) {
          const a = Math.atan2(dy, dx), n = 5;
          for (let i = 0; i < n; i++) G.eshots.push(new EnemyShot(this.x, this.y - 10, a - 0.6 + i * 0.3, { kind: 'leaf', speed: 170, r: 5, life: 2.4, dmg: Math.round(this.dmg * 0.5) }));
          Sfx.wave(false); this.volleys--; this.st = 0.38;
          if (this.volleys <= 0) { this.state = 'recover'; this.st = 0.7; }
        }
        break;
      case 'hidden':
        // 진짜 바루를 때리면 들킨다 → 기절. 시간이 다 되면 튀어나와 내려찍는다
        if (this.struck) {
          this.reveal(); this.state = 'stun'; this.st = 1.4;
          G.text(this.x, this.y - 40, '찾았다!', '#ffd24a', 18, 1.2); G.lumi.say('진짜를 찾았어요! 지금이에요!', 1.4);
        } else if (this.st <= 0) { this.reveal(); this.state = 'slamWind'; this.st = 0.45; }
        break;

      // ── 개굴대왕: 혀 낚아채기 ──
      case 'tongueWind':
        if (this.st > 0.22) this.dir = Math.atan2(dy, dx);
        if (this.st <= 0) { this.state = 'tongue'; this.st = 0.5; this.tongueHit = false; Sfx.lunge(); }
        break;
      case 'tongue': {
        const k = 1 - this.st / 0.5, ext = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
        this.tongueLen = TONGUE_LEN * ext;
        if (!this.tongueHit && ext > 0.2 && p.alive) {
          const c = Math.cos(this.dir), s = Math.sin(this.dir), ox = this.x + c * 14, oy = this.y - 6 + s * 14;
          const ddx = p.x - ox, ddy = p.y - oy, along = ddx * c + ddy * s;
          if (along > 0 && along < this.tongueLen && Math.abs(ddx * s - ddy * c) < 10 + p.r && !(p.dashT > 0 || p.invuln > 0)) {
            this.tongueHit = true;
            G.hurtPlayer(Math.round(this.dmg * 0.7), { x: this.x, y: this.y, attacking: true });
            // 끌어당긴다
            p.kvx = -c * 620; p.kvy = -s * 620;
            G.text(p.x, p.y - 30, '꿀꺽!', '#ff9ad0', 16, 0.8);
          }
        }
        if (this.st <= 0) { this.tongueLen = 0; if (this.tongueHit) { this.state = 'slamWind'; this.st = 0.55; } else { this.state = 'recover'; this.st = 0.6; } }
        break;
      }

      // ── 숲의 군주: 뿌리 · 대나무 창비 ──
      case 'rootWind':
        if (this.st <= 0) { this.state = 'recover'; this.st = 1.0; }
        break;
      case 'cast':
        if (this.st <= 0) { this.state = 'recover'; this.st = 0.8; }
        break;

      case 'stun':
      case 'recover':
        if (this.st <= 0) { this.state = 'chase'; this.st = rand(0.8, 1.6) * fast; }
        break;
    }
    // 개굴대왕 격노: 진흙 웅덩이가 계속 생긴다
    if (this.kind === 3 && this.enraged) {
      this.mudT = (this.mudT || 0) - dt;
      if (this.mudT <= 0) {
        this.mudT = 2.2;
        for (let i = 0; i < 2; i++) { const s = World.findSpawn(p.x, p.y, 40, 200); if (s) G.slows.push({ x: s.x, y: s.y, r: 30, life: 7, max: 7, kind: 'mud', mul: 0.5 }); }
      }
    }
    const noTouch = this.state === 'intro' || this.state === 'hopAir' || this.state === 'hidden';
    if (p.alive && !noTouch && d < this.r + p.r - 2) {
      G.hurtPlayer(this.attacking ? this.dmg : Math.round(this.dmg * 0.6), this);
    }
  }

  begin(pat, p, dx, dy, d) {
    const fast = this.fast;
    if (pat === 'hop') { this.hops = this.enraged ? 4 : 3; this.startHop(p, 0.45 * fast); return; }
    if (pat === 'disguise') { this.disguise(); return; }
    if (pat === 'splitWind') { // 도끼로 땅을 내려쳐 일직선으로 가른다
      const a = Math.atan2(dy, dx), spread = this.enraged ? [-0.5, 0, 0.5] : [0];
      for (const o of spread) this.hzLine(this.x, this.y, a + o, 420, 18, 0.75 * fast, Math.round(this.dmg * 1.0), 'split');
      this.state = 'splitWind'; this.st = 0.75 * fast; return;
    }
    if (pat === 'rootWind') {
      const a = Math.atan2(dy, dx), spread = this.enraged ? [-0.55, -0.27, 0, 0.27, 0.55] : [-0.4, 0, 0.4];
      for (const o of spread) this.hzLine(this.x, this.y, a + o, 340, 14, 0.9 * fast, Math.round(this.dmg * 0.9), 'root');
      this.state = 'rootWind'; this.st = 0.9 * fast; Sfx.roar(); return;
    }
    if (pat === 'bamboo') {
      const n = this.enraged ? 9 : 6;
      this.hzCircle(p.x, p.y, 26, 1.0 * fast, Math.round(this.dmg * 0.8), 'bamboo');
      for (let i = 1; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = rand(30, 130);
        this.hzCircle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 26, (0.9 + i * 0.08) * fast, Math.round(this.dmg * 0.8), 'bamboo');
      }
      this.state = 'cast'; this.st = 0.6; return;
    }
    const st = { slamWind: 0.9, chargeWind: 0.8, summon: 0.7, drumWind: 0.8, leafWind: 0.5, axeWind: 0.8 }[pat] || 0.8;
    this.state = pat; this.st = st * (pat === 'summon' ? 1 : fast);
  }

  startHop(p, wind) {
    // 착지 지점: 플레이어가 있는 곳 (걸어갈 수 있는 곳으로)
    let tx = p.x, ty = p.y;
    if (!World.reachable(tx, ty)) { tx = this.x; ty = this.y; }
    this.hopTo = { x: tx, y: ty };
    this.hzCircle(tx, ty, 58, wind + 0.38, Math.round(this.dmg * 1.1), 'hop');
    this.state = 'hopWind'; this.st = wind;
  }

  disguise() {
    // 연기와 함께 사라지고, 그루터기 셋 중 하나로 숨는다
    G.burst(this.x, this.y, 26, ['#ddd', '#a88a52', '#fff'], 200); Sfx.dash();
    const spots = [];
    for (let i = 0; i < 3; i++) {
      const s = World.findSpawn(G.player.x, G.player.y, 110, 230);
      if (s) spots.push(s);
    }
    if (spots.length < 2) { this.state = 'drumWind'; this.st = 0.8; return; }
    const me = spots.pop();
    this.x = me.x; this.y = me.y;
    for (const s of spots) { const e = new Enemy('stump', s.x, s.y, G.diff, 1); e.spawnT = 0; this.decoys.push(e); G.enemies.push(e); G.burst(s.x, s.y, 14, ['#ddd', '#a88a52'], 160); }
    this.state = 'hidden'; this.st = 5; this.flash = 0; this.struck = false; this.disguiseCd = 9;
    G.text(G.player.x, G.player.y - 40, '둔갑술!', '#e0b070', 16, 1.0);
  }
  reveal() {
    for (const e of this.decoys) if (!e.dead) { e.dead = true; G.burst(e.x, e.y, 10, ['#ddd', '#a88a52'], 120); }
    this.decoys = [];
    G.burst(this.x, this.y, 22, ['#ddd', '#e0b070', '#fff'], 200);
  }

  drawTelegraph(g) {
    const pulse = 0.18 + Math.sin(this.t * 25) * 0.07;
    // 예고 공격들
    for (const h of this.hz) {
      if (!h.fired) {
        const prog = clamp(1 - h.t / h.max, 0, 1);
        g.fillStyle = `rgba(255,50,30,${pulse})`; g.strokeStyle = 'rgba(255,80,50,0.85)'; g.lineWidth = 2;
        if (h.kind === 'circle') {
          g.beginPath(); g.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(h.x, h.y, h.r * prog, h.r * 0.7 * prog, 0, 0, Math.PI * 2); g.stroke();
        } else {
          const c = Math.cos(h.a), s = Math.sin(h.a);
          g.beginPath();
          g.moveTo(h.x - s * h.w, h.y + c * h.w); g.lineTo(h.x + c * h.len - s * h.w, h.y + s * h.len + c * h.w);
          g.lineTo(h.x + c * h.len + s * h.w, h.y + s * h.len - c * h.w); g.lineTo(h.x + s * h.w, h.y - c * h.w);
          g.closePath(); g.fill();
          g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.x + c * h.len * prog, h.y + s * h.len * prog); g.stroke();
        }
      } else if (h.look === 'bamboo') { // 땅에 꽂힌 대나무 창
        g.globalAlpha = clamp(h.life / 0.4, 0, 1);
        g.fillStyle = '#6ab040'; g.fillRect(h.x - 2, h.y - 22, 4, 24); g.fillStyle = '#c8f08a'; g.fillRect(h.x - 2, h.y - 26, 4, 5);
        g.fillStyle = '#3a6a20'; g.fillRect(h.x - 2, h.y - 12, 4, 1);
        g.globalAlpha = 1;
      } else if (h.look === 'icicle') { // 꽂힌 고드름
        g.globalAlpha = clamp(h.life / 0.4, 0, 1);
        g.fillStyle = '#bfefff'; g.beginPath(); g.moveTo(h.x - 6, h.y); g.lineTo(h.x, h.y - 30); g.lineTo(h.x + 6, h.y); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(h.x - 1, h.y - 22, 2, 12);
        g.globalAlpha = 1;
      } else if (h.look === 'split') { // 갈라진 땅
        g.globalAlpha = clamp(h.life / 0.5, 0, 1);
        const c = Math.cos(h.a), s = Math.sin(h.a);
        g.strokeStyle = '#3a2010'; g.lineWidth = 4; g.beginPath(); g.moveTo(h.x, h.y);
        for (let k = 20; k < h.len; k += 20) g.lineTo(h.x + c * k + (k % 40 ? 5 : -5) * -s, h.y + s * k + (k % 40 ? 5 : -5) * c);
        g.stroke();
        g.fillStyle = '#c84a2a'; for (let k = 30; k < h.len; k += 40) g.fillRect(h.x + c * k - 3, h.y + s * k - 3, 6, 6);
        g.globalAlpha = 1;
      } else if (h.look === 'root') { // 솟구친 뿌리 가시
        g.globalAlpha = clamp(h.life / 0.5, 0, 1);
        const c = Math.cos(h.a), s = Math.sin(h.a);
        for (let k = 20; k < h.len; k += 18) {
          const x = h.x + c * k, y = h.y + s * k, hgt = 12 + (k % 36 ? 6 : 0);
          g.fillStyle = '#5a3a1e'; g.beginPath(); g.moveTo(x - 5, y + 4); g.lineTo(x, y - hgt); g.lineTo(x + 5, y + 4); g.fill();
          g.fillStyle = '#8ab04a'; g.fillRect(x - 1, y - hgt + 2, 2, 3);
        }
        g.globalAlpha = 1;
      }
    }
    if (this.state === 'axeWind' || this.state === 'axeSpin') {
      g.fillStyle = this.state === 'axeWind' ? `rgba(255,50,30,${pulse})` : 'rgba(255,200,120,0.18)';
      g.beginPath(); g.ellipse(this.x, this.y + 6, AXE_SPIN_R, AXE_SPIN_R * 0.75, 0, 0, Math.PI * 2); g.fill();
    }
    if (this.state === 'tongueWind') {
      const c = Math.cos(this.dir), s = Math.sin(this.dir), w = 10, len = TONGUE_LEN, ox = this.x, oy = this.y - 6;
      g.fillStyle = `rgba(255,80,150,${pulse + 0.05})`;
      g.beginPath();
      g.moveTo(ox - s * w, oy + c * w); g.lineTo(ox + c * len - s * w, oy + s * len + c * w);
      g.lineTo(ox + c * len + s * w, oy + s * len - c * w); g.lineTo(ox + s * w, oy - c * w);
      g.closePath(); g.fill();
    }
    if (this.state === 'slamWind') {
      const prog = 1 - this.st / (0.9 * this.fast);
      g.fillStyle = `rgba(255,50,30,${pulse})`;
      g.beginPath(); g.arc(this.x, this.y, 84, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,80,50,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, 84 * clamp(prog, 0, 1), 0, Math.PI * 2); g.stroke();
    } else if (this.state === 'chargeWind') {
      const c = Math.cos(this.dir), s = Math.sin(this.dir), w = this.r, len = 300;
      g.fillStyle = `rgba(255,50,30,${pulse})`;
      g.beginPath();
      g.moveTo(this.x - s * w, this.y + c * w); g.lineTo(this.x + c * len - s * w, this.y + s * len + c * w);
      g.lineTo(this.x + c * len + s * w, this.y + s * len - c * w); g.lineTo(this.x + s * w, this.y - c * w);
      g.closePath(); g.fill();
    } else if (this.state === 'drumWind') {
      g.strokeStyle = `rgba(255,120,60,${0.4 + pulse})`; g.lineWidth = 3;
      g.beginPath(); g.arc(this.x, this.y, 40 + (1 - this.st / 0.8) * 20, 0, Math.PI * 2); g.stroke();
    }
  }

  draw(g) {
    if (this.kind === 5) return; // 삼룡: 용 셋(Dragon)이 따로 그려진다
    const x = this.x, y = this.y, white = this.flash > 0 && this.state !== 'hidden';
    if (this.state === 'hidden') { drawStump(g, x, y, this.t); FX.drawStatus(g, this); return; }
    const winds = ['slamWind', 'chargeWind', 'summon', 'hopWind', 'drumWind', 'leafWind', 'rootWind', 'cast', 'tongueWind', 'axeWind', 'splitWind'];
    const wind = winds.includes(this.state);
    const shake = wind ? Math.sin(this.t * 50) * 1.5 : 0;
    const lift = (this.state === 'slamWind' ? 6 * (1 - this.st) : 0) + (this.air || 0);
    g.globalAlpha = this.state === 'intro' ? clamp(1.5 - this.st, 0, 1) : 1;
    const sh = 1 - (this.air || 0) / 80;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(x, y + 20, 24 * this.scale * sh, 8 * this.scale * sh, 0, 0, Math.PI * 2); g.fill();
    const bx = x + shake, by = y - lift;
    const art = BOSS_ART[this.kind];
    if (art.custom === 'trio') { g.globalAlpha = 1; return; }
    if (art.custom === 'bull') { this.drawBull(g, bx, by, white, wind, x, y); FX.drawStatus(g, this); g.globalAlpha = 1; return; }
    let key = art.idle, fr = Math.floor(this.t * 8);
    if (this.state === 'chase') key = art.move;
    else if (wind && this.state !== 'slamWind') key = art.wind;
    else if (this.state === 'slamWind') {
      key = art.attack;
      fr = Math.min(stripFrames(key, art.fw) - 1, Math.floor((1 - this.st / (0.9 * this.fast)) * stripFrames(key, art.fw)));
    } else if (this.state === 'hopAir' && art.air) key = art.air;
    else if (['charge', 'hopAir', 'drum', 'leaves', 'tongue'].includes(this.state)) key = art.attack;
    else if (this.state === 'stun') key = art.hit;
    const red = wind ? (((this.t * 14) | 0) % 2 ? 0.45 : 0.15) : this.enraged ? 0.15 : 0;
    drawStrip(g, key, art.fw, fr, bx, by + 22 + art.foot, { white, red, scale: PIX * this.scale * (art.scale || 1) });
    if (this.tongueLen > 2) { // 개굴대왕의 혀
      const c = Math.cos(this.dir), s = Math.sin(this.dir), ox = bx + c * 10, oy = by - 8 + s * 10;
      g.strokeStyle = '#ff6a9a'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + c * this.tongueLen, oy + s * this.tongueLen); g.stroke();
      g.fillStyle = '#ff8ab0'; g.beginPath(); g.arc(ox + c * this.tongueLen, oy + s * this.tongueLen, 6, 0, Math.PI * 2); g.fill();
      g.lineCap = 'butt';
    }
    if (this.state === 'stun') {
      for (let i = 0; i < 4; i++) {
        const a = this.t * 4 + i * 1.57;
        g.fillStyle = '#ffd24a'; g.fillRect(x + Math.cos(a) * 18 - 2, y - 34 + Math.sin(a) * 5 - 2, 4, 4);
      }
    }
    if (wind) {
      g.fillStyle = '#ff5a3c'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center';
      g.fillText('!', x, y - 40 - lift);
    }
    FX.drawStatus(g, this);
    g.globalAlpha = 1;
  }
}

// 우마왕 그리기: 황소 마귀 시트를 크게 + 손에 든 거대한 도끼
Boss.prototype.drawBull = function (g, bx, by, white, wind, x, y) {
  const p = G.player, look = this.state === 'charge' || this.state === 'chargeWind' ? this.dir : Math.atan2(p.y - this.y, p.x - this.x);
  const col = dirCol(look), moving = this.state === 'chase' || this.state === 'charge' || this.state === 'axeSpin';
  const row = moving ? Math.floor(this.t * (this.state === 'charge' ? 14 : 7)) % 4 : 0;
  const red = wind ? (((this.t * 14) | 0) % 2 ? 0.45 : 0.15) : this.enraged ? 0.2 : 0;
  // 도끼 (회전베기 중엔 빙글빙글, 평소엔 옆에 끌고 다닌다)
  const ax = this.state === 'axeSpin' ? this.t * 22 : this.state === 'axeWind' ? -1.6 : look + 1.2;
  const drawAxe = () => {
    const im = ART.img.axe, s = 5.5;
    g.save(); g.translate(bx + Math.cos(ax) * 34, by - 14 + Math.sin(ax) * 22); g.rotate(ax + Math.PI / 2);
    g.drawImage(im, -im.width * s / 2, -im.height * s, im.width * s, im.height * s); g.restore();
  };
  if (Math.sin(ax) < 0) drawAxe();
  drawCell(g, 'beast', col, row, bx, by + 26, { white, red, scale: 5.2 });
  if (Math.sin(ax) >= 0) drawAxe();
  if (this.enraged && Math.random() < 0.3) { // 콧김
    G.particles.push({ x: bx + rand(-8, 8), y: by - 18, vx: rand(-30, 30), vy: -40, life: 0.5, max: 0.5, color: '#f0f0f0', size: 3, grav: 0 });
  }
  if (this.state === 'stun') for (let i = 0; i < 4; i++) {
    const a = this.t * 4 + i * 1.57;
    g.fillStyle = '#ffd24a'; g.fillRect(x + Math.cos(a) * 22 - 2, y - 52 + Math.sin(a) * 5 - 2, 4, 4);
  }
  if (wind) { g.fillStyle = '#ff5a3c'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('!', x, y - 60); }
};
const AXE_SPIN_R = 92;   // 우마왕 도끼 회전베기 범위

// 바루의 둔갑술 그루터기 (진짜도 가짜도 똑같이 보인다)
function drawStump(g, x, y, t) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 12, 20, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6a4424'; g.fillRect(x - 16, y - 10, 32, 22);
  g.fillStyle = '#7a5230'; g.fillRect(x - 16, y - 10, 6, 22); g.fillRect(x + 4, y - 10, 4, 22);
  g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x, y - 10, 16, 6, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a6a40'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(x, y - 10, 10, 3.5, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(x, y - 10, 4, 1.5, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a9a3a'; g.fillRect(x + 8, y - 16 + Math.sin(t * 3) * 1, 4, 5); // 새싹
}
const BOSS_SUMMON = [['slime'], ['racoon'], ['skull', 'eye'], ['tadpole'], ['lion']];
const TONGUE_LEN = 250; // 개굴대왕 혀 길이

Boss.prototype.steer = Enemy.prototype.steer;

// ───────── 최종 보스: 삼룡 ─────────
// 세 마리의 긴 용(화룡 · 빙룡 · 독룡). 각자 체력이 따로이고, 셋을 모두 쓰러뜨리면 끝난다.
// 처음엔 화룡만 싸우고, 앞의 용이 지치면(체력 55% 이하) 다음 용이 합류한다.
// 머리만 맞는다. 브레스를 다 뿜은 뒤 머리를 숙이는 '빈틈'에 1.5배 피해.
const DRAGON_ELEMS = {
  fire:   { name: '화룡', key: 'dragonRed',   color: '#ff6a3c' },
  ice:    { name: '빙룡', key: 'dragonBlue',  color: '#7fd8ff' },
  poison: { name: '독룡', key: 'dragonGreen', color: '#9be15d' },
};
const DRAGON_SEG = 22;       // 몸통 마디 간격
const DRAGON_SEGS = 6;       // 몸통 마디 수
const FIRE_CONE_R = 175, FIRE_CONE_HALF = 0.5;
const ICE_BEAM_LEN = 380;

class Dragon {
  constructor(el, x, y, hp, dmg, owner) {
    this.type = 'dragon'; this.el = el; this.E = DRAGON_ELEMS[el]; this.owner = owner;
    this.x = x; this.y = y; this.r = 20; this.hp = this.maxHp = hp; this.dmg = dmg;
    this.def = {}; this.color = this.E.color; this.flying = true; this.superArmor = true; this.noPush = true; this.keep = true;
    this.flash = 0; this.stun = 0; this.kvx = 0; this.kvy = 0; this.spawnT = 0; this.dead = false;
    this.t = Math.random() * 5; this.trail = [{ x, y }]; this.state = 'lurk'; this.st = 0; this.active = false; this.burrowed = true;
    this.dir = Math.PI / 2; this.orbit = Math.random() * Math.PI * 2;
  }
  get vulnerable() { return this.state === 'rest'; }
  get fast() { return this.owner.enraged ? 0.75 : 1; }

  activate() {
    this.active = true; this.burrowed = false; this.state = 'roam'; this.st = 1.2;
    G.text(this.x, this.y - 40, this.E.name + ' 합류!', this.E.color, 18, 1.4); G.shake = 10; Sfx.roar();
  }

  update(dt, p) {
    this.t += dt; this.flash -= dt; this.st -= dt;
    const cx = World.pw / 2, cy = World.ph / 2;
    if (!this.active) { // 아레나 가장자리를 맴돈다 (아직 싸우지 않음)
      this.orbit += dt * 0.5;
      this.moveTo(cx + Math.cos(this.orbit) * World.pw * 0.42, cy + Math.sin(this.orbit) * World.ph * 0.4, 140, dt);
      this.pushTrail();
      return;
    }
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    switch (this.state) {
      case 'roam': {
        if (!this.wp || Math.hypot(this.wp.x - this.x, this.wp.y - this.y) < 20) {
          const a = Math.random() * Math.PI * 2, r = rand(110, 200);
          this.wp = { x: clamp(p.x + Math.cos(a) * r, 90, World.pw - 90), y: clamp(p.y + Math.sin(a) * r, 90, World.ph - 90) };
        }
        this.moveTo(this.wp.x, this.wp.y, 150 / this.fast, dt);
        if (this.st <= 0) { this.state = 'aim'; this.st = 0.9 * this.fast; }
        break;
      }
      case 'aim':
        if (this.st > 0.2) this.dir = Math.atan2(dy, dx);
        if (this.st <= 0) this.breathe(p);
        break;
      case 'breath':
        if (this.el === 'ice') this.beamCheck(p);
        if (this.st <= 0) { this.state = 'rest'; this.st = 1.1; }
        break;
      case 'rest':
        if (this.st <= 0) { this.state = 'roam'; this.st = rand(1.4, 2.4) * this.fast; this.wp = null; }
        break;
    }
    this.pushTrail();
    // 머리 · 몸통에 부딪히면 아프다
    if (p.alive) {
      const segs = this.segments();
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (Math.hypot(p.x - s.x, p.y - s.y) < (i ? 13 : 18) + p.r) { G.hurtPlayer(Math.round(this.dmg * 0.5), { x: s.x, y: s.y }); break; }
      }
    }
  }

  moveTo(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    // S자로 꿈틀거리며 간다
    const a = Math.atan2(dy, dx) + Math.sin(this.t * 3) * 0.5, step = Math.min(d, speed * dt);
    this.x += Math.cos(a) * step; this.y += Math.sin(a) * step;
    this.x = clamp(this.x, 60, World.pw - 60); this.y = clamp(this.y, 60, World.ph - 60);
  }
  pushTrail() {
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 3) this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 120) this.trail.length = 120;
  }
  // 머리가 지나간 길을 따라 놓인 몸통 마디들 (0 = 머리)
  segments() {
    const out = [{ x: this.x, y: this.y }];
    let need = DRAGON_SEG, acc = 0;
    for (let i = 1; i < this.trail.length && out.length <= DRAGON_SEGS; i++) {
      const a = this.trail[i - 1], b = this.trail[i], l = Math.hypot(b.x - a.x, b.y - a.y);
      acc += l;
      if (acc >= need) { out.push({ x: b.x, y: b.y }); need += DRAGON_SEG; }
    }
    while (out.length <= DRAGON_SEGS) { const l = out[out.length - 1]; out.push({ x: l.x, y: l.y - 4 }); }
    return out;
  }

  breathe(p) {
    this.state = 'breath'; this.st = 0.7; Sfx.roar();
    const c = Math.cos(this.dir), s = Math.sin(this.dir);
    if (this.el === 'fire') { // 부채꼴 불길
      for (let i = 0; i < 40; i++) {
        const a = this.dir + rand(-FIRE_CONE_HALF, FIRE_CONE_HALF), sp = rand(150, 320);
        G.particles.push({ x: this.x + c * 20, y: this.y + s * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, max: 0.55, color: Math.random() < 0.5 ? '#ff7a3c' : '#ffd24a', size: 4, grav: 0 });
      }
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      if (p.alive && d < FIRE_CONE_R && Math.abs(angDiff(Math.atan2(dy, dx), this.dir)) < FIRE_CONE_HALF) {
        G.hurtPlayer(Math.round(this.dmg * 1.1), { x: this.x, y: this.y, attacking: true });
      }
      G.shake = Math.max(G.shake, 6);
    } else if (this.el === 'ice') { // 냉기 광선 + 고드름
      this.beamHit = false;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, r = rand(20, 110);
        this.owner.hzCircle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 24, 0.9 + i * 0.12, Math.round(this.dmg * 0.8), 'icicle');
      }
    } else { // 따라오는 독 거품
      for (let i = 0; i < 5; i++) G.eshots.push(new EnemyShot(this.x + c * 16, this.y + s * 16, this.dir - 0.6 + i * 0.3, { kind: 'venom', speed: 95, r: 7, life: 4, homing: 0.9, breakable: true, dmg: Math.round(this.dmg * 0.6), puddle: true }));
    }
  }
  beamCheck(p) {
    if (this.beamHit || !p.alive) return;
    const c = Math.cos(this.dir), s = Math.sin(this.dir), dx = p.x - this.x, dy = p.y - this.y;
    const along = dx * c + dy * s;
    if (along > 0 && along < ICE_BEAM_LEN && Math.abs(dx * s - dy * c) < 14 + p.r) {
      this.beamHit = true; G.hurtPlayer(Math.round(this.dmg * 1.0), { x: this.x, y: this.y, attacking: true });
      p.slowT = 1.5; G.text(p.x, p.y - 30, '꽁꽁!', '#bfefff', 13, 0.8);
    }
  }

  drawTelegraph(g) {
    if (!this.active || (this.state !== 'aim' && this.state !== 'breath')) return;
    const pulse = 0.18 + Math.sin(this.t * 25) * 0.07, c = Math.cos(this.dir), s = Math.sin(this.dir);
    if (this.el === 'fire' && this.state === 'aim') {
      g.fillStyle = `rgba(255,60,30,${pulse + 0.05})`;
      g.beginPath(); g.moveTo(this.x, this.y); g.arc(this.x, this.y, FIRE_CONE_R, this.dir - FIRE_CONE_HALF, this.dir + FIRE_CONE_HALF); g.closePath(); g.fill();
    } else if (this.el === 'ice') {
      const beam = this.state === 'breath';
      g.strokeStyle = beam ? 'rgba(170,230,255,0.9)' : `rgba(120,200,255,${0.3 + pulse})`; g.lineWidth = beam ? 16 : 2;
      g.beginPath(); g.moveTo(this.x, this.y); g.lineTo(this.x + c * ICE_BEAM_LEN, this.y + s * ICE_BEAM_LEN); g.stroke();
      if (beam) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); }
    }
  }

  draw(g) {
    const segs = this.segments(), key = this.E.key, white = this.flash > 0;
    const img = k => (white && ART.white[key + k]) ? ART.white[key + k] : ART.img[key + k];
    g.globalAlpha = this.active ? 1 : 0.55;
    const put = (k, x, y, sx = 1) => {
      const im = img(k), w = im.width * PIX, h = im.height * PIX;
      g.save(); g.translate(x, y); g.scale(sx, 1); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
    };
    // 그림자
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (const s of segs) { g.beginPath(); g.ellipse(s.x, s.y + 30, 16, 6, 0, 0, Math.PI * 2); g.fill(); }
    // 꼬리 → 몸통 → 날개 → 머리 순서로 (머리가 맨 위)
    for (let i = segs.length - 1; i >= 1; i--) {
      const s = segs[i];
      if (i === segs.length - 1) put('End', s.x, s.y);
      else put(i % 2 ? 'Body1' : 'Body2', s.x, s.y);
      if (i === 1) { // 날개
        const flap = 1 + Math.sin(this.t * 8) * 0.12;
        put('Wing', s.x - 34, s.y - 18, -flap); put('Wing', s.x + 34, s.y - 18, flap);
      }
    }
    const hy = this.y + (this.state === 'rest' ? 10 : 0);
    put('Head', this.x, hy);
    if (this.state === 'rest') { // 빈틈: 반짝임
      g.fillStyle = '#ffd24a';
      for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * 2.1; g.fillRect(this.x + Math.cos(a) * 26 - 2, hy - 40 + Math.sin(a) * 6 - 2, 4, 4); }
    }
    if (this.state === 'aim') { g.fillStyle = '#ff5a3c'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('!', this.x, hy - 52); }
    g.globalAlpha = 1;
    if (this.active) {
      FX.drawStatus(g, this);
      // 머리 위 작은 체력바
      const w = 44, bx = this.x - w / 2, by = hy - 62;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 1, by - 1, w + 2, 6);
      g.fillStyle = this.E.color; g.fillRect(bx, by, w * Math.max(0, this.hp) / this.maxHp, 4);
    }
  }
}

// 삼룡 지휘: 보스 막대는 셋의 체력 합. 보스 자체는 맞지 않는다.
Boss.prototype.updateTrio = function (dt, p) {
  this.t += dt; this.st -= dt;
  this.updateHazards(dt, p);
  if (this.state === 'intro') {
    if (this.st <= 0) {
      const W2 = World.pw, H2 = World.ph;
      this.dragons = [
        new Dragon('fire', W2 / 2, 80, this.each, this.dmg, this),
        new Dragon('ice', 80, H2 / 2, this.each, this.dmg, this),
        new Dragon('poison', W2 - 80, H2 / 2, this.each, this.dmg, this),
      ];
      for (const d of this.dragons) G.enemies.push(d);
      this.dragons[0].activate();
      this.state = 'fight'; this.triT = 8;
      G.lumi.say('화룡부터 와요! 브레스 뒤에 머리를 숙일 때가 기회예요!');
    }
    return;
  }
  const ds = this.dragons;
  for (let i = 1; i < ds.length; i++) {
    const prev = ds[i - 1];
    if (!ds[i].active && !ds[i].dead && (prev.dead || prev.hp < prev.maxHp * 0.55)) ds[i].activate();
  }
  this.hp = ds.reduce((s, d) => s + Math.max(0, d.dead ? 0 : d.hp), 0);
  if (!this.enraged && this.hp < this.maxHp * 0.4) {
    this.enraged = true; G.shake = 12; Sfx.roar();
    G.text(p.x, p.y - 50, '삼룡이 분노했다!', '#ff5a3c', 20, 1.4);
    G.lumi.say('세 마리가 한꺼번에 브레스를 뿜어요! 빨간 표시 사이로 피해요!');
    for (const d of ds) if (!d.active && !d.dead) d.activate();
  }
  if (this.enraged) { // 삼룡 브레스: 살아 있는 용이 동시에 겨눈다
    this.triT -= dt;
    if (this.triT <= 0) {
      this.triT = 8;
      G.banner = { title: '삼룡 브레스!', sub: '세 방향을 피해라', t: 1.5 };
      for (const d of ds) if (d.active && !d.dead) { d.state = 'aim'; d.st = 1.1; }
    }
  }
  if (this.hp <= 0 && !this.dead) { this.hp = 0; G.checkDeath(this); }
};


class Pickup {
  constructor(kind, x, y, value) {
    this.kind = kind; this.x = x; this.y = y; this.value = value;
    const a = Math.random() * Math.PI * 2, s = rand(40, 110);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.t = 0; this.done = false; this.homing = false;
  }

  update(dt, p) {
    this.t += dt;
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    if (p.alive && this.t > 0.3 && d < 75) this.homing = true;
    if (this.homing) {
      const s = 160 + this.t * 200;
      this.x += dx / d * s * dt; this.y += dy / d * s * dt;
    } else {
      this.x += this.vx * dt; this.y += this.vy * dt;
      const k = Math.pow(0.02, dt); this.vx *= k; this.vy *= k;
    }
    if (p.alive && d < p.r + 6) { this.done = true; G.collect(this); }
    if (this.t > 30) this.done = true;
  }

  draw(g) {
    const bob = Math.sin(this.t * 5) * 2, x = this.x, y = this.y - 4 + bob;
    if (this.t > 26 && ((this.t * 8) | 0) % 2) return; // 사라지기 직전 깜빡임
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.ellipse(this.x, this.y + 4, 4, 2, 0, 0, Math.PI * 2); g.fill();
    if (this.kind === 'xp') {
      const big = this.value >= 10, s = big ? 6 : 4;
      g.fillStyle = big ? '#ffd24a' : '#5ad1ff';
      g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 1, y - s * 0.6, 1.5, s * 0.6);
    } else {
      g.fillStyle = '#ff4d6d';
      g.beginPath(); g.arc(x - 3, y - 2, 3.5, 0, Math.PI * 2); g.arc(x + 3, y - 2, 3.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - 6.4, y - 1); g.lineTo(x + 6.4, y - 1); g.lineTo(x, y + 6); g.closePath(); g.fill();
    }
  }
}
