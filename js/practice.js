// ── 연습실 (2026-10-24) ─────────────────────────────────────
// 마을의 '🎯 연습실'에서 들어간다. 보상 · 런 기록 · 봉인 등급과 상관없는 빈 경기장.
// 더미(작은 · 보통 · 보스 크기)를 불러 때리며 피해를 잰다. 축복은 아무거나 레벨을 골라 달고 뺄 수 있다.
// 일시정지 메뉴가 연습실 메뉴로 바뀐다 (더미 · 축복 달기 · 측정 초기화 · 설정 · 마을로). '더미' 안에서 부르기 · 움직임 · 모두 치우기

const PRACTICE_RECENT = 3;   // '최근 DPS' 구간 (초)
const PRACTICE_MAX_DUMMY = 12;
const PRACTICE_REGEN = 0.25; // 연습실: 맞은 뒤 체력이 초당 최대 체력의 25%씩 다시 찬다
const PRACTICE_MOVES = [['still', '가만히'], ['knock', '밀렸다 돌아오기'], ['chase', '다가오기'], ['attack', '공격하기']];
const PRACTICE_MOVE_TIP = {
  still: '맞아도 꿈쩍하지 않아요 (피해 측정용)',
  knock: '맞으면 밀려났다가 제자리로 돌아와요',
  chase: '천천히 다가와요',
  attack: '빨간 원으로 예고한 뒤 휘둘러요 · 받아치기 · 막기 · 저스트 회피 연습',
};
// 피해 갈래: 무기 기술은 MOVES 의 role 로, 축복이 따로 주는 피해는 FX.damage 에서
const PRACTICE_CATS = [
  { id: 'basic',   name: '기본공격', col: '#ffd24a' },
  { id: 'charge',  name: '차지공격', col: '#ff8a4a' },
  { id: 'special', name: '특수공격', col: '#6ab8ff' },
  { id: 'dash',    name: '대시공격', col: '#e8e8f0' },
  { id: 'fx',      name: '축복 효과', col: '#c8a0ff' },
  { id: 'burn',    name: '화상', col: '#ff5a3c' },
  { id: 'poison',  name: '독', col: '#9be15d' },
  { id: 'other',   name: '기타', col: '#8a96a0' },
];
const practiceCat = kind => {
  const r = (MOVES[kind] || {}).role;
  return r === 'basic' || r === 'fin' ? 'basic' : r === 'charge' || r === 'special' || r === 'dash' ? r : 'other';
};
const PRACTICE_ITEMS = [
  { id: 'resume', name: '계속하기' },   { id: 'dummy', name: '더미' },
  { id: 'boons', name: '축복 달기' },   { id: 'reset', name: '측정 초기화' },
  { id: 'settings', name: '설정' },     { id: 'leave', name: '마을로 돌아가기' },
];

Object.assign(G, {
  practice: null,
  startPractice() {
    Meta.save();
    this.practice = { move: 'still', msg: null };
    this.practiceReset();
    this.tierInfo = tierInfo(1); this.tier = this.tierInfo.n; this.tierCurses = [];
    this.runT = 0; this.runShards = 0; this.runEssence = 0; this.runKills = 0; this.runEmblems = 0; this.runEmbers = 0; this.runCores = 0;
    this.essFrac = 0; this.shardFrac = 0; this.gotShards = 0; this.gotEssence = 0;
    this.reviveLeft = 0; this.runHints = {}; this.rerolls = 0; this.runCommitted = true; // 보상 계산이 돌지 않게
    this.firstWorld = 1; this.finalWorld = 6;
    this.stage = 1; this.sub = 1; this.diff = 1; this.lumiHeals = 1;
    this.boons = {}; this.zones = []; this.bolts = []; this.offer = null;
    World.generate((Math.random() * 1e9) | 0, 0, { boss: true }); // 보스 아레나: 가운데가 넓게 트여 있다
    this.stageStats = Meta.startStats();
    this.player = new Player(World.startPos.x, World.startPos.y, this.stageStats);
    this.enemies = []; this.pickups = []; this.particles = []; this.texts = [];
    this.projectiles = []; this.eshots = []; this.rings = []; this.fxRings = []; this.slows = [];
    this.totems = []; this.setupWaves(0);
    this.boss = null; this.phase = 'practice'; this.clearDelay = 0;
    this.stageTime = 0; this.stageKills = 0; this.chain = 0; this.maxChain = 0;
    this.spawnT = 2; this.slowT = 0; this.hitstop = 0;
    this.giftPending = false; this.giftFx = null; this.curseNote = null; this.hintBox = null;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.lumi = new Lumi(this.player.x, this.player.y);
    this.state = 'play';
    this.practiceSpawn('mid');
    this.banner = { title: '🎯 연습실', sub: '일시정지 메뉴에서 더미를 부르고 축복을 달아 보세요', t: 3 };
    Sfx.pickup();
  },
  practiceReset() {
    const P = this.practice; if (!P) return;
    Object.assign(P, { total: 0, hits: 0, first: null, last: 0, cat: {}, recent: [] });
  },
  practiceLog(t, dmg, cat) {
    const P = this.practice; if (!P || !t || t.type !== 'dummy') return;
    const now = this.stageTime;
    if (P.first === null) P.first = now;
    P.last = now; P.total += dmg; P.hits++;
    P.cat[cat] = (P.cat[cat] || 0) + dmg;
    P.recent.push([now, dmg]);
    while (P.recent.length && P.recent[0][0] < now - PRACTICE_RECENT) P.recent.shift();
  },
  // 플레이어 앞쪽 빈자리에 더미를 부른다
  practiceSpawn(size) {
    const p = this.player, D = DUMMY[size];
    if (this.enemies.length >= PRACTICE_MAX_DUMMY) { this.practice.msg = `더미는 ${PRACTICE_MAX_DUMMY}개까지 부를 수 있어요`; return false; }
    const f = p.facing || 0, dist = 60 + D.r * 1.5;
    const pos = World.findSpawn(p.x + Math.cos(f) * dist, p.y + Math.sin(f) * dist, 0, 120, D.r + 4, { x: p.x, y: p.y, d: D.r + 30 })
      || World.findSpawn(p.x, p.y, D.r + 40, 260, D.r + 4);
    if (!pos) { this.practice.msg = '더미를 둘 빈자리가 없어요'; return false; }
    for (const e of this.enemies) if (Math.hypot(e.x - pos.x, e.y - pos.y) < e.r + D.r + 4) { pos.x += D.r * 2 + 8; }
    this.enemies.push(new Dummy(size, pos.x, pos.y));
    this.burst(pos.x, pos.y - 8, 10, ['#d8b878', '#fff'], 120);
    this.practice.msg = `${D.name}를 불렀어요 (지금 ${this.enemies.length}개)`;
    return true;
  },
  // 축복을 바꾸면 처음 상태의 캐릭터에 지금 축복을 다시 단다 (강인한 체력 같은 즉시 효과까지). 측정도 새로
  practiceRebuild() {
    const old = this.player, s = Meta.startStats();
    const p = new Player(old.x, old.y, s);
    p.facing = old.facing;
    this.player = p;
    for (const b of BOONS) if (this.boons[b.id] && b.onPick && b.id !== 'second') for (let i = 0; i < this.boons[b.id]; i++) b.onPick(p);
    p.hp = p.maxHp;
    for (const e of this.enemies) { e.burn = null; e.poison = null; e.chill = 0; e.frozenT = 0; e.shockT = 0; }
    this.zones = []; this.projectiles = [];
    this.practiceReset();
  },
  // 축복 레벨 정하기 — 실제 게임에서 나올 수 없는 조합은 막는다 (2026-10-24 사용자)
  //  · 같은 칸(기본 · 차지 · 특수 · 대시)은 하나만 → 다른 걸 달면 바꿔 단다
  //  · 강화 축복은 딸린 칸 축복이 있어야 한다 → 없으면 그 칸 축복을 Lv1로 같이 단다
  //  · 속성 패시브(불씨 · 맹독 …)는 그 속성의 칸 축복이 있어야, 듀오는 두 속성 축복이 모두 있어야 단다
  //  · 칸 축복을 빼면 강화 축복은 같이 빠지고, 속성 패시브 · 듀오는 실전처럼 잠든다 (회색 · 잠듦)
  practiceSetBoon(b, lv) {
    const B = this.boons, max = boonMaxLv(b);
    lv = clamp(lv, 0, max);
    if (lv > 0 && !B[b.id]) { const why = practiceBlock(b); if (why) { this.practice.msg = why; return false; } }
    if (lv > 0) {
      if (b.slot) for (const o of BOONS) if (o !== b && o.slot === b.slot && B[o.id]) delete B[o.id];
      if (b.needs && !B[b.needs]) { const nb = BOON_BY_ID[b.needs]; if (nb.slot) for (const o of BOONS) if (o.slot === nb.slot && B[o.id]) delete B[o.id]; B[b.needs] = 1; }
      B[b.id] = lv;
    } else delete B[b.id];
    practicePrune();
    this.practiceRebuild();
    return true;
  },
});

// 연습실: 맞고 나서 체력이 다시 찬다 (쓰러지지 않는 건 hurtPlayer 에서)
{ const upd = G.update;
  G.update = function (dt) {
    upd.call(this, dt);
    const p = this.practice && this.player;
    if (p && p.hurtT <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * PRACTICE_REGEN * dt);
  }; }

// 지금 이 축복을 새로 달 수 없는 까닭 (달 수 있으면 null). 강화 축복은 칸 축복을 같이 달아 주므로 막지 않는다
function practiceBlock(b) {
  if (b.duo && !b.duo.every(e => FX.hasEl(e))) return `${b.duo.map(e => ELEMENTS[e].name).join(' · ')} 축복을 모두 가져야 달 수 있어요`;
  if (!b.needs && b.req && !b.req()) return `${ELEMENTS[b.el].name} 속성의 기본 · 차지 · 특수 · 대시 칸 축복이 있어야 달 수 있어요`;
  return null;
}
// 칸 축복이 빠지면 거기 딸린 강화 축복도 빠진다 (실전 교체와 같다)
function practicePrune() {
  const B = G.boons;
  for (let changed = true; changed;) {
    changed = false;
    for (const b of BOONS) if (B[b.id] && b.needs && !B[b.needs]) { delete B[b.id]; changed = true; } // 강화 축복만 같이 빠지고, 속성 패시브 · 듀오는 실전처럼 잠든 채 남는다
  }
}

// ── 마을의 연습실 버튼 (축복 도감 왼쪽) ──
function villagePractice() { const b = villageBook(); return { x: b.x - 98, y: b.y, w: 90, h: b.h }; }
function drawPracticeBtn(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.85)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke()); }
  label('🎯 연습실', r.x + r.w / 2, r.y + r.h / 2 + 1, 12, sel ? '#ffd24a' : '#ccd', 'center', '700');
}

// ── 화면 위: 연습실 표시 + 피해 측정판 ──
const fmtNum = n => Math.round(n).toLocaleString('ko-KR');
function drawPracticeHud() {
  const P = G.practice, p = G.player;
  const mv = PRACTICE_MOVES.find(m => m[0] === P.move)[1];
  if (G.state !== 'paused') { // 메뉴가 열리면 메뉴 제목과 겹치지 않게 숨긴다
    label('🎯 연습실', W / 2, inset.t + 20, 15, '#ffe08a', 'center', '800');
    label(`공격력 ${p.atk} · 더미 ${G.enemies.length}개 · 움직임: ${mv}`, W / 2, inset.t + 40, 11, '#d8e4ff', 'center', '700');
  }
  if (G.state === 'paused' && G.pm && G.pm.view !== 'menu') return; // 더미 · 축복 메뉴 안에서는 측정판을 가린다 (버튼과 겹치지 않게)
  // 측정판 (오른쪽 위, 일시정지 버튼 아래). 낮은 화면(휴대폰 가로)은 줄 간격을 좁혀 오른쪽 아래 버튼과 겹치지 않게
  const w = Math.min(196, W * 0.3), x = W - inset.r - 12 - w, y = inset.t + 52;
  let cats = PRACTICE_CATS.filter(c => P.cat[c.id] > 0).map(c => ({ ...c, v: P.cat[c.id] }));
  if (H < 450 && cats.length > 4) { // 낮은 화면: 큰 갈래 3개 + 나머지는 '그 외'
    cats.sort((a, b) => b.v - a.v);
    cats = cats.slice(0, 3).concat([{ id: 'rest', name: '그 외', col: '#8a96a0', v: cats.slice(3).reduce((s, c) => s + c.v, 0) }]);
  }
  const k = H < 450 ? 0.78 : 1, row = 18 * k, crow = 17 * k, ry = i => y + 14 + i * row;
  const h = 14 + 4 * row + cats.length * crow + 2;
  ctx.fillStyle = 'rgba(14,18,26,0.78)'; (rrPath(x, y, w, h, 8), ctx.fill());
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; (rrPath(x + 0.5, y + 0.5, w - 1, h - 1, 8), ctx.stroke());
  const lx = x + 10, rx = x + w - 10;
  label('피해 측정', lx, ry(0), 12, '#ffe08a', 'left', '800');
  const span = P.first === null ? 0 : Math.max(1, P.last - P.first);
  label(P.first === null ? '더미를 때리면 시작' : `${span.toFixed(1)}초`, rx, ry(0), 10, '#aab', 'right', '700');
  label('총 피해', lx, ry(1), 11, '#ccd', 'left', '700'); label(fmtNum(P.total), rx, ry(1), 13, '#fff', 'right', '800');
  label('평균 DPS', lx, ry(2), 11, '#ccd', 'left', '700'); label(span ? fmtNum(P.total / span) : '-', rx, ry(2), 13, '#ffd24a', 'right', '800');
  const now = G.stageTime, rec = P.recent.filter(r => r[0] >= now - PRACTICE_RECENT).reduce((s, r) => s + r[1], 0);
  const win = P.first === null ? 0 : Math.min(PRACTICE_RECENT, Math.max(0.5, now - P.first));
  label(`최근 ${PRACTICE_RECENT}초 DPS`, lx, ry(3), 11, '#ccd', 'left', '700'); label(win ? fmtNum(rec / win) : '-', rx, ry(3), 13, '#8ff0b0', 'right', '800');
  // 갈래별 비중
  cats.forEach((c, i) => {
    const yy = ry(4) + 2 + i * crow, f = c.v / P.total, bh = Math.round(12 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(lx, yy - bh / 2, rx - lx, bh);
    ctx.fillStyle = c.col; ctx.globalAlpha = 0.45; ctx.fillRect(lx, yy - bh / 2, (rx - lx) * f, bh); ctx.globalAlpha = 1;
    label(c.name, lx + 4, yy, 10, '#fff', 'left', '700');
    label(`${Math.round(f * 100)}% · ${fmtNum(c.v)}`, rx - 4, yy, 10, '#fff', 'right', '700');
  });
}

// ── 일시정지 = 연습실 메뉴 (두 줄 칸) ──
function practiceLayout() {
  const cols = 2, rows = Math.ceil(PRACTICE_ITEMS.length / cols), gap = 8;
  const top = inset.t + 64, bottom = H - inset.b - 40;
  const h = clamp((bottom - top - gap * (rows - 1)) / rows, 28, 44), w = Math.min(230, (W - 40 - gap) / 2);
  const x0 = W / 2 - w - gap / 2, y0 = Math.max(top, (top + bottom) / 2 - (rows * (h + gap) - gap) / 2);
  const n = PRACTICE_ITEMS.length;
  return PRACTICE_ITEMS.map((it, i) => ({ it, x: i === n - 1 && n % cols ? W / 2 - w / 2 : x0 + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap), w, h })); // 마지막 한 칸은 가운데
}
// 메뉴 칸 하나 그리기 (on: 지금 고른 값 표시)
function practiceBtn(r, text, sel, on, col = '#fff', size = 14) {
  ctx.fillStyle = sel ? 'rgba(70,60,110,0.97)' : on ? 'rgba(40,70,52,0.95)' : 'rgba(24,28,40,0.92)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  ctx.strokeStyle = sel ? '#ffd24a' : on ? '#8ff0b0' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = sel || on ? 2 : 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke());
  label(text, r.x + r.w / 2, r.y + r.h / 2, size, col, 'center', '800');
}
function drawPracticeMenu() {
  const m = G.pm;
  if (m.view === 'boons') { drawPracticeBoons(); return; }
  if (m.view === 'dummy') { drawPracticeDummy(); return; }
  overlay(0.6);
  const L = practiceLayout();
  label('🎯 연습실', W / 2, L[0].y - 34, 22, '#ffe08a', 'center', '900');
  label(G.practice.msg || '보상도 기록도 없는 연습 공간이에요', W / 2, L[0].y - 12, 12, G.practice.msg ? '#8ff0b0' : '#ccd', 'center', '700');
  L.forEach((r, i) => practiceBtn(r, (m.sel === i ? '▶ ' : '') + r.it.name, m.sel === i, false, r.it.id === 'leave' ? '#ffb0a0' : '#fff'));
  const d = Input.state.device;
  const how = d === 'touch' ? '항목을 탭하세요' : d === 'gamepad' ? '↑↓←→ 고르기 · A 결정 · B 돌아가기' : `방향키 고르기 · ${menuKeys().ok} 결정 · ${menuKeys().no} 돌아가기`;
  label(how, W / 2, H - inset.b - 18, 12, '#aab', 'center', '600');
}
function handlePracticeMenu(dt, inp) {
  const m = G.pm, P = G.practice;
  if (m.view === 'boons') { handlePracticeBoons(dt, inp); return; }
  if (m.view === 'dummy') { handlePracticeDummy(dt, inp); return; }
  const { dy, dx } = menuAxis(m, inp, dt), n = PRACTICE_ITEMS.length;
  if (dy) { const rows = Math.ceil(n / 2), r = (Math.floor(m.sel / 2) + dy + rows) % rows; m.sel = Math.min(n - 1, r * 2 + m.sel % 2); Sfx.pickup(); } // 마지막 줄이 한 칸뿐이면 그 칸으로
  if (dx) { const k = m.sel % 2 ? m.sel - 1 : Math.min(n - 1, m.sel + 1); if (k !== m.sel) { m.sel = k; Sfx.pickup(); } }
  let pick = null;
  if (inp.tap) { const i = practiceLayout().findIndex(r => inRectPt(inp.tap, r)); if (i >= 0) { m.sel = i; pick = i; } }
  else if (inp.confirm) pick = m.sel;
  if ((inp.back || inp.pause) && pick === null) { G.state = 'play'; P.msg = null; return; }
  if (pick === null) return;
  const id = PRACTICE_ITEMS[pick].id;
  Sfx.pickup();
  if (id === 'resume') { G.state = 'play'; P.msg = null; }
  else if (id === 'dummy') { P.msg = null; m.view = 'dummy'; m.dr = 0; m.dc = 1; }
  else if (id === 'reset') { G.practiceReset(); P.msg = '측정을 처음부터 다시 해요'; }
  else if (id === 'boons') { P.msg = null; m.view = 'boons'; m.bsel = practiceBoonRows().findIndex(r => r.b || r.act); m.bscroll = 0; m.drag = null; }
  else if (id === 'settings') openSettings('paused');
  else if (id === 'leave') { G.practice = null; G.goVillage(); }
}

// ── 더미 메뉴: 부르기(종류 4) · 움직임(4) · 모두 치우기 · 돌아가기 ──
const PD_KINDS = ['small', 'mid', 'boss', 'dev'];
function practiceDummyLayout() {
  const gap = 8, w = Math.min(150, (W - 40 - gap * 3) / 4), h = clamp((H - inset.t - inset.b - 170) / 3, 30, 42);
  const x0 = W / 2 - (w * 4 + gap * 3) / 2, top = inset.t + 70;
  const rowY = i => top + i * (h + 26);
  const rows = [
    PD_KINDS.map((k, i) => ({ id: 'spawn', k, x: x0 + i * (w + gap), y: rowY(0), w, h })),
    PRACTICE_MOVES.map((mv, i) => ({ id: 'move', k: mv[0], x: x0 + i * (w + gap), y: rowY(1), w, h })),
    [{ id: 'clear', x: W / 2 - w - gap / 2, y: rowY(2), w, h }, { id: 'back', x: W / 2 + gap / 2, y: rowY(2), w, h }],
  ];
  return { rows, heads: [rowY(0) - 12, rowY(1) - 12] };
}
function drawPracticeDummy() {
  const m = G.pm, P = G.practice, L = practiceDummyLayout();
  overlay(0.65);
  label('더미', W / 2, inset.t + 26, 20, '#ffe08a', 'center', '900');
  label(P.msg || `지금 ${G.enemies.length}개 · 최대 ${PRACTICE_MAX_DUMMY}개`, W / 2, inset.t + 46, 11, P.msg ? '#8ff0b0' : '#aab', 'center', '700');
  const x0 = L.rows[0][0].x;
  label('부르기 (누를 때마다 하나씩)', x0, L.heads[0], 11, '#ccd', 'left', '700');
  label('움직임 · ' + PRACTICE_MOVE_TIP[P.move], x0, L.heads[1], 11, '#ccd', 'left', '700');
  L.rows.forEach((row, ri) => row.forEach((b, ci) => {
    const sel = m.dr === ri && m.dc === ci, on = b.id === 'move' && P.move === b.k;
    const text = b.id === 'spawn' ? DUMMY[b.k].name : b.id === 'move' ? PRACTICE_MOVES.find(mv => mv[0] === b.k)[1] : b.id === 'clear' ? '모두 치우기' : '돌아가기';
    practiceBtn(b, text, sel, on, b.id === 'clear' ? '#ffb0a0' : '#fff', 13);
  }));
  const d = Input.state.device;
  const how = d === 'touch' ? '항목을 탭하세요' : d === 'gamepad' ? '↑↓←→ 고르기 · A 결정 · B 돌아가기' : `방향키 고르기 · ${menuKeys().ok} 결정 · ${menuKeys().no} 돌아가기`;
  label(how, W / 2, H - inset.b - 18, 12, '#aab', 'center', '600');
}
function handlePracticeDummy(dt, inp) {
  const m = G.pm, P = G.practice, L = practiceDummyLayout();
  const back = () => { m.view = 'menu'; P.msg = null; Sfx.pickup(); };
  if (inp.back || inp.pause) { back(); return; }
  const { dy, dx } = menuAxis(m, inp, dt);
  if (dy) { m.dr = (m.dr + dy + L.rows.length) % L.rows.length; m.dc = Math.min(m.dc, L.rows[m.dr].length - 1); Sfx.pickup(); }
  if (dx) { const n = L.rows[m.dr].length; m.dc = (m.dc + dx + n) % n; Sfx.pickup(); }
  let b = null;
  if (inp.tap) { L.rows.forEach((row, ri) => row.forEach((r, ci) => { if (inRectPt(inp.tap, r)) { m.dr = ri; m.dc = ci; b = r; } })); }
  else if (inp.confirm) b = L.rows[m.dr][m.dc];
  if (!b) return;
  Sfx.pickup();
  if (b.id === 'spawn') G.practiceSpawn(b.k);
  else if (b.id === 'move') {
    P.move = b.k; P.msg = '움직임: ' + PRACTICE_MOVES.find(mv => mv[0] === b.k)[1];
    for (const e of G.enemies) { e.home = { x: e.x, y: e.y }; e.cd = 1; }
  }
  else if (b.id === 'clear') { G.enemies = []; G.practiceReset(); P.msg = '더미를 모두 치웠어요'; }
  else back();
}

// ── 축복 달기: 모든 축복을 속성별로. ←→ 로 레벨, 같은 칸 축복은 하나만 ──
const PB_ROW = 30, PB_HEAD = 24;
// 패시브 축복이 무엇을 강화하는지 (2026-10-24 사용자: "공격 칸은 뭘 강화시키는지 적어 줘야지")
const PRACTICE_TAG = {
  atk_combo: '기본공격 강화', atk_multispin: '차지공격 강화', atk_wave: '특수공격 강화', atk_thrust: '대시공격 강화',
  sharp: '모든 피해', vital: '치명타', ambush: '옆 · 뒤 공격',
  lifesteal: '처치 회복', guard_spin: '차지 중 보호', heal_wave: '특수 적중 회복', dash_guard: '대시 뒤 보호',
  tough: '최대 체력', spring: '클리어 회복', leaf: '피격 1회 막기', skin: '받는 피해 감소', second: '부활',
  kindling: '화상 강화', chain_burst: '화상 처치 폭발', shatter: '빙결 깨기', frostbite: '냉기 적 피해 감소',
  static: '적중 시 벼락', overcharge: '감전 강화', virulence: '독 강화', venom_burst: '독 가득 폭발',
};
function practiceBoonRows() {
  const rows = [{ act: 'none', name: '축복 모두 빼기' }];
  const tag = b => (b.slot ? SLOT_NAMES[b.slot].replace(' 슬롯', '') : b.needs ? '강화 축복' : b.duo ? '듀오' : PRACTICE_TAG[b.id] || '패시브');
  for (const el of Object.keys(ELEMENTS)) {
    const list = BOONS.filter(b => b.el === el && !b.mergedInto && !b.duo);
    if (!list.length) continue;
    rows.push({ header: `${ELEMENTS[el].icon} ${ELEMENTS[el].name}`, col: ELEMENTS[el].color });
    for (const b of list) rows.push({ b, tag: tag(b) });
  }
  rows.push({ header: '✦ 듀오', col: '#ffb8f0' });
  for (const b of BOONS.filter(b => b.duo && !b.mergedInto)) rows.push({ b, tag: tag(b) });
  return rows;
}
function practiceBoonLayout() {
  const w = Math.min(600, W - 32), x = W / 2 - w / 2;
  const view = { x, y: inset.t + 48, w, h: H - inset.b - 92 - (inset.t + 48) };
  const rows = practiceBoonRows(), m = G.pm;
  let y = 0;
  const out = rows.map(r => { const h = r.header ? PB_HEAD : PB_ROW; const o = { ...r, x, y: view.y + y - (m.bscroll || 0), w, h: h - 3, top: y }; y += h; return o; });
  const close = { x: W / 2 - 60, y: H - inset.b - 34, w: 120, h: 28 };
  return { rows: out, view, close, maxScroll: Math.max(0, y - view.h) };
}
// 레벨 조절 버튼 자리 (− / +)
const pbMinus = r => ({ x: r.x + r.w - 118, y: r.y + 2, w: 30, h: r.h - 4 });
const pbPlus = r => ({ x: r.x + r.w - 34, y: r.y + 2, w: 30, h: r.h - 4 });
function drawPracticeBoons() {
  const m = G.pm, L = practiceBoonLayout(), V = L.view;
  overlay(0.75);
  label('축복 달기', W / 2, inset.t + 22, 18, '#ffe08a', 'center', '900');
  const msg = G.practice.msg;
  label(msg || `단 축복 ${Object.keys(G.boons).length}개 · 바꾸면 측정이 처음부터`, W / 2, inset.t + 40, 11, msg ? '#ffb07a' : '#aab', 'center', '700');
  ctx.save(); ctx.beginPath(); ctx.rect(V.x - 4, V.y, V.w + 8, V.h); ctx.clip();
  L.rows.forEach((r, i) => {
    if (r.y + r.h < V.y || r.y > V.y + V.h) return;
    if (r.header) { label(r.header, r.x + 4, r.y + r.h / 2 + 2, 13, r.col, 'left', '900'); return; }
    const sel = m.bsel === i;
    ctx.fillStyle = sel ? 'rgba(70,60,110,0.97)' : 'rgba(24,30,40,0.92)'; (rrPath(r.x, r.y, r.w, r.h, 6), ctx.fill());
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 6), ctx.stroke()); }
    if (r.act) { label(r.name, r.x + r.w / 2, r.y + r.h / 2, 13, '#ffb0a0', 'center', '800'); return; }
    const b = r.b, lv = G.boons[b.id] || 0, max = boonMaxLv(b), col = boonColor(b), blocked = !lv && !!practiceBlock(b);
    if (lv) { ctx.fillStyle = col; (rrPath(r.x, r.y, 4, r.h, 3), ctx.fill()); }
    label(boonIcon(b) + ' ' + b.name, r.x + 12, r.y + r.h / 2, 13, lv ? col : blocked ? '#667' : '#dde', 'left', '800');
    const sleep = lv && boonDormant(b);
    label(blocked ? '🔒 조건 부족' : sleep ? '💤 잠듦' : r.tag, r.x + r.w - 128, r.y + r.h / 2, 10, blocked ? '#c08a6a' : sleep ? '#9ab' : '#8a96a0', 'right', '700');
    const mi = pbMinus(r), pl = pbPlus(r);
    for (const [bt, s, on] of [[mi, '−', lv > 0], [pl, '+', lv < max && !blocked]]) {
      ctx.fillStyle = on ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'; (rrPath(bt.x, bt.y, bt.w, bt.h, 5), ctx.fill());
      label(s, bt.x + bt.w / 2, bt.y + bt.h / 2, 15, on ? '#fff' : '#556', 'center', '900');
    }
    label(lv ? `Lv ${lv}/${max}` : `- /${max}`, (mi.x + mi.w + pl.x) / 2, r.y + r.h / 2, 11, lv ? '#ffd24a' : '#778', 'center', '800');
  });
  ctx.restore();
  // 고른 축복 설명
  const cur = L.rows[m.bsel];
  if (cur && cur.b) {
    const b = cur.b, lv = Math.max(1, G.boons[b.id] || 0), why = (!G.boons[b.id] && practiceBlock(b)) || (G.boons[b.id] && boonDormant(b) && boonDormantWhy(b));
    const lines = wrap(why ? `${G.boons[b.id] ? '💤' : '🔒'} ${why}` : `${b.name} Lv${lv}: ${b.desc(lv)}`, Math.min(W - 40, 700), 11, '600').slice(0, 2);
    lines.forEach((l, k) => label(l, W / 2, H - inset.b - 78 + k * 15, 11, why ? '#ffb07a' : '#e8e8e8', 'center', '600'));
  }
  const c = L.close;
  ctx.fillStyle = 'rgba(30,36,48,0.95)'; (rrPath(c.x, c.y, c.w, c.h, 7), ctx.fill());
  label('닫기', c.x + c.w / 2, c.y + c.h / 2, 13, '#fff', 'center', '800');
  const d = Input.state.device;
  const how = d === 'touch' ? '− · + 로 레벨 · 밀어서 스크롤' : d === 'gamepad' ? '↑↓ 고르기 · ←→ 레벨 · B 닫기' : `↑↓ 고르기 · ←→ 레벨 · ${menuKeys().no} 닫기`;
  label(how, W / 2, H - inset.b - 46, 10, '#8a96a0', 'center', '600');
}
function handlePracticeBoons(dt, inp) {
  const m = G.pm, L = practiceBoonLayout(), rows = L.rows;
  const closeIt = () => { m.view = 'menu'; m.drag = null; Sfx.pickup(); };
  if (inp.back || inp.pause) { closeIt(); return; }
  const pickable = i => rows[i] && !rows[i].header;
  const scrollTo = i => { const r = rows[i]; if (!r) return; const top = r.top, bot = r.top + r.h; if (top < m.bscroll) m.bscroll = top; if (bot > m.bscroll + L.view.h) m.bscroll = bot - L.view.h; };
  const { dy, dx } = menuAxis(m, inp, dt);
  if (dy) { let i = m.bsel; do { i = (i + dy + rows.length) % rows.length; } while (!pickable(i)); m.bsel = i; scrollTo(i); Sfx.pickup(); }
  const cur = rows[m.bsel];
  const change = d => {
    if (!cur) return;
    if (cur.act) { if (d > 0) { G.boons = {}; G.practiceRebuild(); G.practice.msg = '축복을 모두 뺐어요'; Sfx.pickup(); } return; }
    const lv = G.boons[cur.b.id] || 0, nl = clamp(lv + d, 0, boonMaxLv(cur.b));
    G.practice.msg = null;
    if (nl !== lv && G.practiceSetBoon(cur.b, nl)) Sfx.pickup(); // 막힌 조합이면 까닭이 위에 뜬다
  };
  if (dx) change(dx);
  else if (inp.confirm) change(cur && cur.b && (G.boons[cur.b.id] || 0) >= boonMaxLv(cur.b) ? -99 : 1); // 결정: +1, 만렙이면 빼기
  if (Input.wheel) { m.bscroll += Input.wheel * 0.6; Input.wheel = 0; }
  if (m.drag) {
    const pt = Input.pointers.get(m.drag.id);
    if (pt) { if (Math.abs(pt.y - m.drag.y) > 6) m.drag.moved = true; if (m.drag.moved) m.bscroll = m.drag.scroll0 - (pt.y - m.drag.y); }
    else {
      if (!m.drag.moved) { // 끌지 않고 뗐으면 누른 것
        const pos = { x: m.drag.x, y: m.drag.y }, i = rows.findIndex(r => !r.header && inRectPt(pos, r) && pos.y >= L.view.y && pos.y <= L.view.y + L.view.h);
        if (i >= 0) {
          m.bsel = i; const r = rows[i];
          if (r.act) change(1);
          else if (inRectPt(pos, pbMinus(r))) change(-1);
          else if (inRectPt(pos, pbPlus(r))) change(1);
          else Sfx.pickup();
        }
      }
      m.drag = null;
    }
  }
  if (inp.tap) {
    if (inRectPt(inp.tap, L.close)) { closeIt(); return; }
    let id = null;
    for (const [pid, pt] of Input.pointers) if (Math.abs(pt.x - inp.tap.x) < 1 && Math.abs(pt.y - inp.tap.y) < 1) id = pid;
    if (id !== null) m.drag = { id, x: inp.tap.x, y: inp.tap.y, scroll0: m.bscroll, moved: false };
    else { // 마우스 클릭 (끌기 없음)
      const pos = inp.tap, i = rows.findIndex(r => !r.header && inRectPt(pos, r) && pos.y >= L.view.y && pos.y <= L.view.y + L.view.h);
      if (i >= 0) { m.bsel = i; const r = rows[i]; if (r.act) change(1); else if (inRectPt(pos, pbMinus(r))) change(-1); else if (inRectPt(pos, pbPlus(r))) change(1); }
    }
  }
  m.bscroll = clamp(m.bscroll || 0, 0, L.maxScroll);
}
