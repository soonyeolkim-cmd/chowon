'use strict';
// 게임 루프, 스테이지 진행, 카메라, 화면 표시
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif';
// 세계 3개 × 스테이지 5개. 각 세계의 마지막 스테이지는 보스전.
const FINAL_STAGE = 3;            // 마지막 세계
const STAGES_PER_WORLD = 5;
const WAVES_PER_STAGE = [2, 2, 3, 3];  // 1~4스테이지의 웨이브 수
const ENEMY_COST = { demon: 2, lantern: 1, statue: 2, babydragon: 1, lion: 1, trex: 2, cyclops2: 2, lizard: 1, kappa: 1, axolot: 1, spider: 1, mollusc: 2, tadpole: 1, slime: 1, bat: 1, mushroom: 1, mole: 1, racoon: 1, bear: 3, snake: 1, owl: 1, shield: 2, skull: 2, eye: 2, flam: 1, orc: 3 }; // 웨이브 구성 점수
const WAVE_SPAWN_GAP = 0.25;           // 웨이브 안에서 마물이 나오는 간격 (초)
const DEEP_SHARD_MULT = 0.6;          // 깊은 숲: 정령의 조각은 덜
const DEEP_ESSENCE_MULT = 2;          // 깊은 숲: 무기의 정수는 두 배
const EASY_DMG_TAKEN = 1 / 3;        // 쉬움 모드: 받는 피해 배율 (1/3)
const WAVE_SIZE_MULT = 1.75;            // 웨이브 규모 (마물 수) 배율
const HEART_DROP = 0.035;              // 처치 시 하트 확률
const STAGE_DIFF_STEP = 0.2;      // 스테이지마다 적이 강해지는 정도
const stageLabel = idx => `${Math.ceil(idx / STAGES_PER_WORLD)}-${(idx - 1) % STAGES_PER_WORLD + 1}`;

// ── 효과음 (Web Audio로 직접 합성, 파일 없음) ──────────────────
const Sfx = (() => {
  let ac = null;
  const unlock = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    if (ac && ac.state === 'suspended') ac.resume();
  };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  }
  return {
    swing: fin => tone(fin ? 380 : 520, 0.08, 'triangle', 0.05, -260),
    thrust: () => tone(700, 0.1, 'triangle', 0.06, -400),
    spin: () => { tone(300, 0.25, 'triangle', 0.07, 400); tone(450, 0.2, 'sawtooth', 0.03, -200, 0.05); },
    charged: () => tone(1200, 0.12, 'sine', 0.05, 200),
    wave: triple => { tone(900, 0.15, 'sine', 0.05, -500); if (triple) tone(1200, 0.15, 'sine', 0.04, -600, 0.04); },
    hit: crit => tone(crit ? 260 : 180, 0.09, 'square', 0.07, -90),
    block: () => tone(1500, 0.06, 'square', 0.04, -300),
    guardBreak: () => { tone(200, 0.15, 'sawtooth', 0.07, -120); tone(1000, 0.1, 'square', 0.04, -600, 0.03); },
    kill: () => { tone(330, 0.07, 'square', 0.06); tone(220, 0.12, 'square', 0.05, -100, 0.05); },
    hurt: () => tone(140, 0.2, 'sawtooth', 0.09, -80),
    dash: () => tone(300, 0.1, 'sine', 0.05, 300),
    dodge: () => { tone(1400, 0.25, 'sine', 0.06, -900); tone(700, 0.3, 'triangle', 0.04, 300, 0.05); },
    lunge: () => tone(110, 0.15, 'sawtooth', 0.05, 60),
    slam: () => tone(70, 0.35, 'sawtooth', 0.12, -30),
    roar: () => tone(90, 0.5, 'sawtooth', 0.08, 40),
    totem: () => [400, 300, 200, 120].forEach((f, i) => tone(f, 0.18, 'square', 0.06, -50, i * 0.07)),
    pickup: () => tone(880, 0.06, 'sine', 0.04, 300),
    heal: () => { tone(660, 0.08, 'sine', 0.05); tone(990, 0.12, 'sine', 0.05, 0, 0.07); },
    level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.08)),
    clear: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)),
    zap: () => tone(1800, 0.08, 'sawtooth', 0.035, -1200),
    freeze: () => tone(2000, 0.12, 'sine', 0.04, -800),
    shatter: () => { tone(2400, 0.08, 'square', 0.04, -1500); tone(1200, 0.1, 'triangle', 0.04, -600, 0.03); },
    boom: () => tone(90, 0.25, 'sawtooth', 0.07, -40),
    boon: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.2, 'sine', 0.05, 0, i * 0.06)),
  };
})();

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('swordsman.' + k)); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem('swordsman.' + k, JSON.stringify(v)); } catch (_) {} },
};

// 세계마다 다른 세력. 원거리(투사체) 몬스터 비중이 높다.
const ENEMY_POOLS = [
  [['slime', 30], ['bat', 10], ['mole', 15], ['mushroom', 45]],            // 세계 1 · 슬라임 대왕의 들판
  [['racoon', 25], ['bear', 15], ['snake', 30], ['owl', 30]],              // 세계 2 · 너구리 패거리
  [['shield', 20], ['skull', 25], ['eye', 25], ['flam', 30]],              // 세계 3 · 봉인의 망령들
  [['kappa', 25], ['axolot', 30], ['spider', 30], ['mollusc', 15]],         // 세계 4 · 늪의 주민들
  [['lion', 25], ['trex', 15], ['cyclops2', 30], ['lizard', 30]],          // 세계 5 · 우마왕의 투사들
  [['demon', 25], ['lantern', 25], ['statue', 20], ['babydragon', 30]],    // 세계 6 · 봉인의 수호자들
];
const BOSS_MINION = ['slime', 'racoon', 'flam', 'kappa', 'lizard', 'babydragon']; // 보스가 부르는 졸개 · 웨이브 남은 점수 채우기 (1점짜리)
const MONSTER_HINTS = {
  mushroom: '버섯이 몸을 부풀리면 곧 포자를 뿜어요! 포자 사이로 비켜서 다가가요. 검기나 던진 창은 날아오는 투사체를 지워요.',
  mole: '흙이 들썩이는 건 땅속 두더지예요. 빨간 표시가 보이면 그 자리를 벗어나요!',
  racoon: '너구리는 치고 빠져요. 물러날 때가 공격할 기회예요!',
  bear: "곰은 '!' 표시 뒤에 크게 돌진해요. 옆으로 피해요!",
  snake: '뱀의 독침에 맞으면 잠깐 느려져요. 정면에 서지 마요!',
  owl: '부엉이는 깃털을 넓게 흩뿌려요. 가까이 붙으면 피하기 쉬워요!',
  skull: '해골의 저주 구슬은 천천히 따라와요. 공격으로 부술 수 있어요!',
  eye: '눈알이 붉은 선을 그으면 곧 광선이 나가요. 선 밖으로 비켜요!',
  flam: '도깨비불은 약해지면 달려와서 터져요. 붉게 깜빡이면 떨어져요!',
  kappa: '갓파는 물속을 헤엄쳐 다가와요. 물속에선 안 맞으니 뭍으로 올라올 때를 노려요!',
  axolot: '도롱뇽의 분홍 침에 맞으면 잠깐 대시를 못 해요!',
  spider: '거미줄이 깔린 곳에 들어가면 느려져요. 돌아가요!',
  mollusc: '달팽이는 단단해요. 지나간 점액 위에서는 느려져요!',
  lion: '동굴사자가 웅크리면 곧 덮쳐요! 빨간 원 밖으로 피해요!',
  trex: "티렉스는 '!' 뒤에 길게 돌진하고, 멈추면 꼬리를 휘둘러요!",
  cyclops2: '외눈 거인이 바위를 던지면 떨어질 자리에 그림자가 생겨요. 바위 뒤에 숨어도 넘어와요!',
  lizard: '도마뱀은 돌을 세 번 연달아 던져요. 옆으로 크게 피해요!',
  demon: '붉은 도깨비가 사라지면 곧 등 뒤에 나타나요! 바닥의 붉은 그림자에서 벗어나요!',
  lantern: '등불 정령은 불덩이를 사방으로 흩뿌려요. 불덩이 사이 틈을 노려요!',
  statue: '수호 석상은 십자(+)와 대각선(×)으로 번갈아 광선을 쏴요. 선 사이에 서요!',
  babydragon: '꼬마 용의 불 브레스는 짧아요. 거리를 두면 안 닿아요!',
  dragon: '용은 머리만 맞아요! 브레스를 피하고, 머리를 숙일 때(반짝일 때) 공격해요!',
};

// ── 게임 상태 ────────────────────────────────────────────
const G = {
  state: 'title', time: 0, overT: 0, clearT: 0,
  stage: 1, sub: 1, diff: 1, waves: [], waveIdx: -1, waveT: 0, phase: 'totems', stageStats: null, stageTime: 0, stageKills: 0, clearEl: null,
  player: null, enemies: [], totems: [], boss: null, projectiles: [], eshots: [], rings: [],
  pickups: [], particles: [], texts: [], fxRings: [],
  cam: { x: 0, y: 0 }, view: { x: 0, y: 0, w: 1, h: 1 },
  shake: 0, hitstop: 0, slowT: 0, hurtFlash: 0, clearDelay: 0,
  chain: 0, chainT: 0, maxChain: 0, chainPulse: 0,
  spawnT: 0, toast: null, banner: null, hintBox: null, seen: store.get('hints') || {},
  unlocks: new Set(), dialog: null, lumi: null, lumiHeals: 0,
  runShards: 0, runKills: 0, reviveLeft: 0, rerolls: 0, runEmblems: 0, runEssence: 0, village: null,
  firstWorld: 1, finalWorld: FINAL_STAGE, route: 'outer',
  tier: 1, tierInfo: null, tierCurses: [], tierFirst: false,

  // 이번 런 보상을 영구 재화로 옮긴다 (게임오버 · 완주 때 한 번만). 포기하거나 그냥 끄면 받지 못한다.
  // 런 보상 배율 = 등급 × 깊이 × 익숙함. 화면 곳곳에 보여준다.
  rewardParts(cleared) {
    const ti = this.tierInfo || tierInfo(1);
    const depth = cleared ? DEPTH_CLEAR_MULT : DEPTH_MULT[clamp(this.stage - this.firstWorld, 0, DEPTH_MULT.length - 1)];
    const fam = familiarMult(ti.n);
    return { tier: ti.rewardMult, depth, fam, total: ti.rewardMult * depth * fam };
  },
  commitRun(cleared) {
    if (this.runCommitted) return;
    this.runCommitted = true;
    this.runParts = this.rewardParts(cleared);
    this.gotShards = Math.round(this.runShards * this.runParts.total);
    this.gotEssence = Math.round(this.runEssence * this.runParts.total);
    Meta.data.shards += this.gotShards; Meta.data.essence += this.gotEssence;
    Meta.save();
  },
  // ── 로그라이트: 런 시작 / 마을 ──
  startRun() {
    if (!tierPlayable(Meta.data.tier)) Meta.data.tier = 1;
    this.tierInfo = tierInfo(Meta.data.tier); this.tier = this.tierInfo.n; this.tierCurses = this.tierInfo.curses;
    Meta.data.runs++; Meta.save(); this.runCommitted = false;
    this.runShards = 0; this.runKills = 0; this.runEmblems = 0; this.runEssence = 0;
    this.reviveLeft = Meta.lv('revive');
    this.rerolls = Meta.lv('choice');
    const worlds = ROUTES[this.tierInfo.route].worlds;
    this.firstWorld = worlds[0]; this.finalWorld = worlds[worlds.length - 1]; this.route = this.tierInfo.route;
    this.startStage(this.firstWorld, 1, Meta.startStats(), true);
    if (familiarMult(this.tier) < 1) this.hintBox = { text: '여긴 이제 너무 익숙해요. 정령들이 더 깊은 곳에서 기다려요… (보상 ×0.5)', t: 5 };
  },
  goVillage() {
    Meta.save();
    World.generate((Math.random() * 1e9) | 0, 0);
    this.player = null; this.boss = null; this.enemies = []; this.totems = [];
    this.village = { tab: 0, sel: villageItems(0).length, t: 0, armed: false, axis: 0, axisX: 0, flash: {}, msg: null, scroll: 0, drag: null };
    this.state = 'village';
  },
  // 무기의 정수 (모든 무기 공통)
  earnEssence(n, x, y) {
    n = Math.max(1, Math.round(n * (this.route === 'deep' ? DEEP_ESSENCE_MULT : 1)));
    this.runEssence += n;
    if (x !== undefined) this.text(x, y, '⚔' + n, '#ffcf6a', 13, 1.2);
  },
  earn(n, x, y) {
    const v = Math.max(1, Math.round(n * (1 + 0.2 * Meta.lv('luck')) * (this.route === 'deep' ? DEEP_SHARD_MULT : 1)));
    this.runShards += v; // 런이 끝날 때(쓰러짐 · 완주) 한꺼번에 받는다
    if (x !== undefined) this.text(x + rand(-6, 6), y - 14, '◆' + v, '#c8a0ff', 10, 0.8);
  },
  // 한 번 본 스토리는 다음 런부터 건너뛴다
  storyOnce(n, key, then) {
    const lines = STORY[n] && STORY[n][key], id = n + '.' + key;
    if (!lines || Meta.data.seen[id]) { if (then) then(); return; }
    Meta.data.seen[id] = 1; Meta.save();
    this.talk(lines, then);
  },
  boons: {}, offer: null, zones: [], bolts: [], recentEls: [], slows: [],
  slowAt(x, y) { let m = 1; for (const s of this.slows) if (Math.hypot(x - s.x, (y - s.y) * 1.4) < s.r) m = Math.min(m, s.mul); return m; },

  // 기본기는 레벨로 해금
  // 레벨 해금이 필요한 기술인지 확인 (UNLOCK_LV 에 없는 기술은 처음부터 사용 가능)
  has(k) { return !(k in UNLOCK_LV) || (!!this.player && this.player.lv >= UNLOCK_LV[k]); },

  // ── 정령의 축복 ──
  pickElement() {
    const els = Object.keys(ELEMENTS).filter(e => !this.recentEls.includes(e));
    const el = els[(Math.random() * els.length) | 0];
    this.recentEls = [...this.recentEls, el].slice(-2);
    return el;
  },
  makeOffer(el) {
    // 기본공격 슬롯은 최대 강화되면 잠긴다 → 다른 원소로 바꾸는 카드가 안 나온다 (강화 기본기도 지켜진다)
    const basicLocked = BOONS.some(b => b.slot === 'basic' && (this.boons[b.id] || 0) >= boonMaxLv(b));
    const ok = b => {
      if ((this.boons[b.id] || 0) >= boonMaxLv(b)) return false;
      if (basicLocked && b.slot === 'basic') return false;
      if (b.duo) return b.duo.every(e => FX.hasEl(e)) && (!el || b.duo.includes(el));
      return !b.req || b.req();
    };
    let pool = BOONS.filter(b => ok(b) && (!el || b.el === el || b.duo));
    if (pool.length < 3) pool = pool.concat(BOONS.filter(b => ok(b) && !pool.includes(b)));
    const weight = b => (b.duo ? 4 : b.rare ? 0.35 : this.boons[b.id] ? 1.3 : 1);
    const picks = [];
    const count = 3;
    while (picks.length < count && pool.length) {
      let r = Math.random() * pool.reduce((t, b) => t + weight(b), 0);
      const i = pool.findIndex(b => (r -= weight(b)) <= 0);
      picks.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
    }
    return picks.map(b => {
      const owner = b.slot && BOONS.find(o => o.slot === b.slot && o.id !== b.id && this.boons[o.id]);
      return { boon: b, lv: (this.boons[b.id] || 0) + 1, replaces: owner || null };
    });
  },
  openBoon(el, then) {
    const cards = this.makeOffer(el);
    if (!cards.length) { if (then) then(); return; }
    this.offer = { el, cards, sel: 0, t: 0, then, axis: 0, armed: false, hold: 0 };
    this.shake = 0;
    this.state = 'boon';
    Sfx.boon();
  },
  rerollOffer() {
    const o = this.offer;
    if (!o || this.rerolls <= 0) return;
    this.rerolls--;
    o.cards = this.makeOffer(o.el);
    o.sel = 0; o.hold = 0; o.t = BOON_LOCK; // 바로 다시 고를 수 있게
    Sfx.boon();
  },
  chooseBoon(i) {
    const o = this.offer, c = o.cards[i];
    if (c.replaces) {
      delete this.boons[c.replaces.id];
      // 그 기본공격 축복에 딸린 강화 축복도 함께 빠진다
      for (const b of BOONS) if (b.needs === c.replaces.id) delete this.boons[b.id];
    }
    this.boons[c.boon.id] = c.lv;
    if (c.boon.onPick) c.boon.onPick(this.player);
    const p = this.player;
    this.fxRing(p.x, p.y, boonColor(c.boon), 70);
    this.burst(p.x, p.y, 24, [boonColor(c.boon), '#fff'], 180);
    this.text(p.x, p.y - 30, c.boon.name + (c.lv > 1 ? ' Lv' + c.lv : ''), boonColor(c.boon), 14, 1.2);
    Sfx.level();
    this.offer = null;
    this.state = 'play';
    if (o.then) o.then();
  },

  // ── 대화 ──
  talk(lines, then) {
    this.dialog = { lines, i: 0, chars: 0, total: 1, then };
    this.shake = 0;
    this.state = 'story';
    this.showLine();
  },
  showLine() {
    const l = this.dialog.lines[this.dialog.i];
    this.dialog.chars = 0;
    if (l[2]) this.learn(l[2]);
  },
  learn(k) {
    if (this.unlocks.has(k)) return;
    this.unlocks.add(k);
    Sfx.level();
    if (this.player) { this.fxRing(this.player.x, this.player.y, '#e8ff9c', 70); this.burst(this.player.x, this.player.y, 20, ['#e8ff9c', '#fff'], 160); }
  },
  advanceDialog() {
    const d = this.dialog;
    if (d.chars < d.total) { d.chars = d.total; return; }
    d.i++;
    if (d.i >= d.lines.length) this.endDialog(); else this.showLine();
  },
  skipDialog() {
    const d = this.dialog;
    if (!d) return;
    for (let i = d.i; i < d.lines.length; i++) if (d.lines[i][2]) this.learn(d.lines[i][2]);
    this.endDialog();
  },
  endDialog() {
    const then = this.dialog.then;
    this.dialog = null;
    this.state = 'play';
    if (then) then();
  },

  // world: 세계 (1~3), sub: 그 세계의 스테이지 (1~5, 5는 보스전)
  startStage(world, sub, stats, newRun) {
    const n = world;
    this.stage = world; this.sub = sub;
    this.diff = world + (sub - 1) * STAGE_DIFF_STEP;
    const reached = (world - 1) * STAGES_PER_WORLD + sub;
    if (Meta.data.mode === 'easy') Meta.data.bestEasy = Math.max(Meta.data.bestEasy, reached);
    else Meta.data.best = Math.max(Meta.data.best, reached);
    Meta.save();
    this.boons = stats && stats.boons ? { ...stats.boons } : {};
    if (newRun && DEV_BUILD) Object.assign(this.boons, DEV_BUILD.boons); // 로컬 시험 빌드 (?build=spin)
    this.zones = []; this.bolts = []; this.offer = null;
    if (sub === 1) this.lumiHeals = 1 + Meta.lv('bond'); // 루미의 위기 회복은 세계마다
    this.stageStats = stats;
    World.generate((Math.random() * 1e9) | 0, world - 1, { boss: sub === STAGES_PER_WORLD });
    this.player = new Player(World.startPos.x, World.startPos.y, stats);
    this.enemies = []; this.pickups = []; this.particles = []; this.texts = [];
    this.projectiles = []; this.eshots = []; this.rings = []; this.fxRings = []; this.slows = [];
    const isBoss = sub === STAGES_PER_WORLD;
    this.totems = isBoss ? [] : World.totemSpots.map(s => new Totem(s.x, s.y, this.diff));
    this.setupWaves(isBoss ? 0 : WAVES_PER_STAGE[sub - 1] + (curse('wave') ? 1 : 0));
    this.boss = null; this.phase = isBoss ? 'boss' : 'totems'; this.clearDelay = 0;
    this.stageTime = 0; this.stageKills = 0; this.chain = 0; this.maxChain = 0;
    this.spawnT = 2; this.slowT = 0; this.hitstop = 0;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.lumi = new Lumi(this.player.x, this.player.y);
    this.state = 'play';
    const begin = () => {
      this.banner = { title: `${world}-${sub} · ${World.pal.name}`, sub: isBoss ? '보스전 · 세계의 주인을 쓰러뜨려라' : `봉인석이 부르는 마물 ${this.waves.length}웨이브를 막고 봉인석을 부숴라`, t: 3 };
      if (isBoss) this.spawnBoss();
    };
    if (newRun && Meta.data.runs > 1) this.hintBox = { text: RETRY_LINES[(Math.random() * RETRY_LINES.length) | 0], t: 6 };
    this.storyOnce(n, sub === 1 ? 'start' : '', begin);
  },

  spawnBoss() {
    const p = this.player;
    const c = World.totemSpots[0];
    this.boss = new Boss(c.x, c.y - TILE, this.stage);
    this.phase = 'boss';
    this.banner = { title: `${this.boss.name} 등장!`, sub: '봉인석의 힘을 품은 이 세계의 주인', t: 3 };
    this.shake = 12; Sfx.roar();
    if (STORY[this.stage]) this.storyOnce(this.stage, 'bossIntro');
    else this.hint('boss', '보스는 바닥의 빨간 표시를 피하고, 돌진을 벽으로 유도해서 기절시키세요!');
  },

  targets() {
    const list = this.enemies.filter(e => !e.dead && !e.burrowed);
    for (const t of this.totems) if (!t.dead && !t.shielded) list.push(t);
    if (this.boss && !this.boss.dead && this.boss.state !== 'intro' && !this.boss.untargetable) list.push(this.boss);
    return list;
  },

  nearestTarget(x, y, maxD) {
    let best = null, bd = maxD;
    for (const e of this.targets()) {
      if (e.spawnT > 0.2) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  objective() {
    if (this.boss && !this.boss.dead) return this.boss;
    let best = null, bd = Infinity;
    for (const t of this.totems) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - this.player.x, t.y - this.player.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  },

  pickType() {
    const pool = ENEMY_POOLS[Math.min(this.stage, ENEMY_POOLS.length) - 1];
    let r = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [type, w] of pool) { if ((r -= w) <= 0) return type; }
    return 'slime';
  },

  spawnNear(x, y, minD, maxD, type) {
    if (this.enemies.length >= 24) return;
    const pos = World.findSpawn(x, y, minD, maxD);
    if (pos) this.enemies.push(new Enemy(type || this.pickType(), pos.x, pos.y, this.diff, this.player.lv));
  },

  chainBonus() { return Math.min(FX.chainCap(), this.chain * 0.02); },

  hint(key, text) {
    if (this.seen[key]) return;
    this.seen[key] = true; store.set('hints', this.seen);
    this.hintBox = { text, t: 6 };
  },

  hit(t, info) {
    const p = this.player;
    if (t.type === 'shield' && t.guard) {
      const from = Math.atan2(-info.ny, -info.nx); // 공격이 들어온 방향
      const frontal = Math.abs(angDiff(from, t.facing)) < 1.25;
      if (frontal && !info.guardBreak) {
        this.text(t.x, t.y - 22, '막힘!', '#c0c4cc', 12, 0.5);
        this.burst(t.x + Math.cos(t.facing) * 10, t.y + Math.sin(t.facing) * 8, 5, ['#fff', '#c0c4cc'], 120);
        if (info.kind !== 'wave') { p.kvx = -info.nx * 170; p.kvy = -info.ny * 170; }
        this.hitstop = 0.03; Sfx.block();
        this.hint('shield', p.weapon.shieldHint);
        return;
      }
      if (frontal) {
        t.guard = false; t.brokenT = 2.5; t.stun = 1.2;
        this.text(t.x, t.y - 30, '가드 브레이크!', '#ffd24a', 14, 0.9);
        this.shake = Math.max(this.shake, 5); Sfx.guardBreak();
      }
    }
    let dmg = info.dmg;
    t.struck = true;
    if (t.vulnerable) dmg = Math.round(dmg * 1.5);
    t.hp -= dmg; t.flash = 0.1;
    const armored = t.superArmor || (t.heavy && (t.state === 'windup' || t.state === 'lunge'));
    if (!armored) {
      t.stun = Math.max(t.stun, 0.15);
      const f = info.kb * (t.heavy ? 0.4 : 1);
      t.kvx = info.nx * f; t.kvy = info.ny * f;
      if (p.weaponId === 'spear' && info.kb >= 300 && !t.flying) t.slamT = 0.35;
    }
    this.chain++; this.chainT = 2.5; this.chainPulse = 0.15;
    this.maxChain = Math.max(this.maxChain, this.chain);

    const big = !['light', 'wave', 'poke', 'spear'].includes(info.kind);
    const ranged = info.kind === 'wave' || info.kind === 'spear';
    this.hitstop = Math.max(this.hitstop, ranged ? 0.02 : info.crit || big || info.tip ? 0.065 : 0.04);
    this.shake = Math.max(this.shake, big ? 5 : 3);
    const label = info.counter ? '반격! ' + dmg : String(dmg);
    this.text(t.x, t.y - t.r - 6, label, info.counter ? '#7fe0ff' : info.crit ? '#ffd24a' : info.tip ? '#ffe18a' : '#fff', info.crit ? 16 : info.tip ? 14 : 12);
    this.burst(t.x, t.y, 6, ['#fff', '#ffe9a8'], 140);
    Sfx.hit(info.crit); Input.rumble(big ? 0.5 : 0.25, big ? 90 : 50);

    FX.onHit(t, info);
    this.checkDeath(t);
  },

  checkDeath(t) {
    if (t.hp > 0 || t.dead) return;
    if (t.type === 'totem') this.destroyTotem(t);
    else if (t.type === 'boss') this.bossDefeated(t);
    else this.killEnemy(t);
  },


  killEnemy(e) {
    if (e.def && e.def.decoy) {
      e.dead = true;
      this.burst(e.x, e.y, 14, ['#ddd', '#a88a52'], 160); this.text(e.x, e.y - 24, '가짜!', '#e0b070', 14, 0.8);
      const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x);
      for (const o of [-0.3, 0, 0.3]) this.eshots.push(new EnemyShot(e.x, e.y - 8, a + o, { kind: 'leaf', speed: 160, r: 5, life: 2, dmg: Math.round((this.boss ? this.boss.dmg : 30) * 0.4) }));
      return;
    }
    e.dead = true; this.stageKills++; this.runKills++;
    if (Math.random() < (SHARD_DROP[e.type] || 0.2) * KILL_DROP_MULT) this.earn(1, e.x, e.y);
    this.burst(e.x, e.y, 14, [e.color, '#fff'], 180);
    Sfx.kill();
    if (Math.random() < HEART_DROP) this.pickups.push(new Pickup('heart', e.x, e.y, curse('heal') ? 10 : 20));
    FX.onKill(e);
  },

  destroyTotem(t) {
    t.dead = true;
    this.burst(t.x, t.y - 10, 36, [sealTheme().hex, '#fff', sealTheme().lit], 240);
    this.fxRing(t.x, t.y, sealTheme().hex, 90);
    this.shake = 9; this.hitstop = 0.12; Sfx.totem(); Input.rumble(0.8, 250);
    this.earn(SHARD_TOTEM + 2 * Math.max(0, this.stage - this.firstWorld), t.x, t.y - 20);
    this.pickups.push(new Pickup('heart', t.x, t.y, curse('heal') ? 12 : 25));
    const left = this.totems.filter(x => !x.dead).length;
    if (left > 0) { this.banner = { title: '봉인석 파괴!', sub: `남은 봉인석 ${left}개`, t: 2.2 }; return; }
    // 마지막 봉인석 → 스테이지 클리어. 갇혀 있던 정령이 축복을 준다.
    this.clearEl = this.pickElement();
    this.earnEssence(ESSENCE_STAGE, t.x, t.y - 34);
    this.banner = { title: `${this.stage}-${this.sub} 클리어!`, sub: `${ELEMENTS[this.clearEl].spirit}이 풀려났다`, t: 2.4 };
    for (const e of this.enemies) if (!e.dead) { e.dead = true; this.burst(e.x, e.y, 10, [e.color, '#fff'], 150); }
    this.phase = 'done'; this.clearDelay = 1.4; this.slowT = 0.5;
  },

  bossDefeated(b) {
    b.dead = true;
    this.burst(b.x, b.y, 60, [b.colors[0], b.colors[1], '#fff', '#ffd24a'], 300);
    this.fxRing(b.x, b.y, '#ffd24a', 160);
    this.shake = 14; this.slowT = 1.2; Sfx.clear(); Input.rumble(1, 400);
    this.text(b.x, b.y - 40, '격파!', '#ffd24a', 24, 1.6);
    for (const e of this.enemies) if (!e.dead) this.killEnemy(e);
    this.earn(SHARD_BOSS * this.stage, b.x, b.y - 50);
    this.earnEssence(ESSENCE_BOSS[Math.min(this.stage, ESSENCE_BOSS.length) - 1], b.x, b.y - 70);
    Meta.save();
    this.phase = 'done'; this.clearDelay = 2.2;
  },

  hurtPlayer(dmg, src) {
    const p = this.player;
    if (!p.alive) return;
    if (p.dashT > 0 || p.invuln > 0) {
      if (src.attacking && p.dodgeT > 0 && this.has('dodge')) this.perfectDodge();
      return;
    }
    dmg = FX.playerHurt(dmg, src);
    if (dmg && Meta.data.mode === 'easy') dmg = Math.max(1, Math.round(dmg * EASY_DMG_TAKEN));
    if (!dmg) return;
    p.hp -= dmg; p.invuln = p.hurtT = 0.8;
    const dx = p.x - src.x, dy = p.y - src.y, d = Math.hypot(dx, dy) || 1;
    p.kvx = dx / d * 220; p.kvy = dy / d * 220;
    p.act = null; p.charge = 0;
    this.chain = 0;
    this.shake = 7; this.hurtFlash = 0.35; this.hitstop = 0.06;
    this.text(p.x, p.y - 20, '-' + dmg, '#ff6b6b', 14);
    Sfx.hurt(); Input.rumble(0.9, 200);
    if (p.hp > 0 && p.hp < p.maxHp * 0.25 && this.lumiHeals > 0) {
      this.lumiHeals--;
      const heal = Math.round(p.maxHp * 0.35 * (curse('heal') ? 0.5 : 1));
      p.hp += heal;
      this.lumi.say('버텨요, 리안! 제 빛을 나눠 줄게요!');
      this.text(p.x, p.y - 30, '+' + heal, '#e8ff9c', 14, 1);
      this.fxRing(p.x, p.y, '#e8ff9c', 50); Sfx.heal();
    }
    if (p.hp <= 0 && this.reviveLeft > 0) {
      this.reviveLeft--;
      p.hp = Math.round(p.maxHp * 0.4); p.invuln = p.hurtT = 2;
      this.text(p.x, p.y - 30, '불굴의 의지!', '#ffd24a', 16, 1.4);
      this.fxRing(p.x, p.y, '#ffd24a', 80); this.slowT = 0.8; Sfx.level();
    }
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false; this.commitRun();
      this.state = 'over'; this.overT = 0;
      this.burst(p.x, p.y, 24, ['#3b6fd6', '#f2c9a0', '#fff'], 160);
    }
  },

  perfectDodge() {
    const p = this.player;
    p.dodgeT = 0; p.counterT = 1.8;
    p.invuln = Math.max(p.invuln, 0.5);
    p.skillCd = 0; p.specialCd = 0; p.dashStock = p.dashMax; // 저스트 회피 보상: 쿨타임 초기화
    this.slowT = 0.6;
    this.text(p.x, p.y - 28, '저스트 회피!', '#7fe0ff', 15, 1);
    this.fxRing(p.x, p.y, '#7fe0ff', 60);
    Sfx.dodge(); Input.rumble(0.4, 120);
  },

  collect(it) {
    const p = this.player;
    if (it.kind === 'heart') {
      p.hp = Math.min(p.maxHp, p.hp + it.value);
      this.text(p.x, p.y - 22, '+' + it.value, '#7dff9a', 13); Sfx.heal();
      return;
    }
  },

  // 다음 스테이지로: 레벨 대신 '정령의 힘'으로 강해진다
  nextStage() {
    const s = this.player.stats();
    if (this.sub < STAGES_PER_WORLD) { FX.onStageClear(s); this.startStage(this.stage, this.sub + 1, s); return; }
    // 세계 클리어: 정령의 힘 + 체력 회복
    s.atk = Math.round(s.atk * STAGE_ATK_MULT);
    s.maxHp += STAGE_HP_BONUS; s.hp = s.maxHp;
    this.startStage(this.stage + 1, 1, s);
    this.hintBox = { text: `정령의 힘이 깃들었어요! 공격력 ${s.atk} · 최대 체력 ${s.maxHp} (체력 회복)`, t: 6 };
  },

  text(x, y, s, color, size, life = 0.7) { this.texts.push({ x, y, s, color, size, life, max: life }); },
  ring(x, y, color, r) { this.fxRing(x, y, color, r); },
  fxRing(x, y, color, max) { this.fxRings.push({ x, y, r: 4, max, color, life: 0.4 }); },
  burst(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.3, 0.6), max: 0.6,
        color: colors[(Math.random() * colors.length) | 0], size: rand(1.5, 3.5), grav: 300 });
    }
  },
  dust(x, y) {
    this.particles.push({ x: x + rand(-4, 4), y, vx: rand(-20, 20), vy: rand(-30, -10), life: 0.35, max: 0.35,
      color: 'rgba(230,220,190,0.8)', size: rand(2, 4), grav: 0 });
  },

  // ── 봉인석 웨이브: 정해진 수의 마물만 나온다 (무한 리젠 없음) ──
  setupWaves(n) {
    this.waves = [];
    for (let i = 0; i < n; i++) {
      let budget = Math.round((3 + this.diff * 2 + i * 2) * WAVE_SIZE_MULT);
      const list = [];
      while (budget > 0) {
        let t = this.pickType();
        if (ENEMY_COST[t] > budget) t = BOSS_MINION[Math.min(this.stage, BOSS_MINION.length) - 1]; // 남은 점수가 적으면 그 세계의 1점짜리
        list.push(t); budget -= ENEMY_COST[t];
      }
      this.waves.push(list);
    }
    this.waveIdx = -1; this.waveT = 1.2; this.spawnQueue = [];
  },
  // 웨이브의 마물은 한꺼번에가 아니라 0.3초 간격으로 차례차례 나온다
  spawnWave(list) {
    this.spawnQueue = list.map((type, i) => ({ type, t: i * WAVE_SPAWN_GAP }));
    Sfx.roar();
  },
  updateSpawnQueue(dt) {
    if (!this.spawnQueue || !this.spawnQueue.length) return;
    const c = this.totems[0] || World.totemSpots[0];
    for (const q of this.spawnQueue) q.t -= dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= 0) {
      const { type } = this.spawnQueue.shift();
      const pos = World.findSpawn(c.x, c.y, 60, 170) || World.findSpawn(c.x, c.y, 40, 260);
      if (!pos) continue;
      this.enemies.push(new Enemy(type, pos.x, pos.y, this.diff, this.player.lv));
      this.burst(pos.x, pos.y, 8, [sealTheme().hex, '#fff'], 90);
    }
  },
  updateWaves(dt) {
    const seal = this.totems[0];
    if (this.phase !== 'totems' || !seal || seal.dead || !seal.shielded) return;
    this.updateSpawnQueue(dt);
    if (this.spawnQueue.length || this.enemies.some(e => !e.dead)) return;
    this.waveT -= dt;
    if (this.waveT > 0) return;
    if (this.waveIdx + 1 < this.waves.length) {
      this.waveIdx++;
      seal.crack = this.waveIdx;
      this.spawnWave(this.waves[this.waveIdx]);
      this.banner = { title: `웨이브 ${this.waveIdx + 1} / ${this.waves.length}`, sub: '봉인석이 마물을 불러낸다', t: 1.6 };
      this.waveT = 1.2;
    } else {
      seal.shielded = false;
      this.fxRing(seal.x, seal.y - 12, sealTheme().hex, 60);
      this.burst(seal.x, seal.y - 12, 24, [sealTheme().hex, '#fff'], 200);
      this.banner = { title: '보호막이 깨졌다!', sub: '지금 봉인석을 부숴라', t: 2 };
      this.shake = 6; Sfx.guardBreak();
    }
  },

  checkHints() {
    const p = this.player;
    for (const e of this.enemies) {
      if (Math.hypot(e.x - p.x, e.y - p.y) > 240) continue;
      if (e.type === 'shield') this.hint('shield', this.player.weapon.shieldHint);
      if (e.type === 'orc') this.hint('orc', "외눈이는 '!' 표시 뒤에 돌진해요. 부딪히기 직전에 대시해서 피해요!");
      if (MONSTER_HINTS[e.type]) this.hint(e.type, MONSTER_HINTS[e.type]);
    }
    for (const t of this.totems) {
      if (!t.dead && Math.hypot(t.x - p.x, t.y - p.y) < 360) this.hint('totem', '봉인석의 보호막은 불려 나온 마물을 모두 쓰러뜨리면 깨져요. 그다음에 봉인석을 부숴요!');
    }
  },

  update(dt) {
    const p = this.player;
    this.stageTime += dt;
    p.update(dt);
    this.lumi.update(dt, p);
    for (const e of this.enemies) e.update(dt, p);
    for (const t of this.totems) if (!t.dead) t.update(dt, p);
    if (this.boss && !this.boss.dead) this.boss.update(dt, p);
    for (const t of this.targets()) FX.updateStatus(t, dt);
    FX.updateZones(dt);
    for (const w of this.projectiles) w.update(dt);
    this.projectiles = this.projectiles.filter(w => !w.done);
    for (const s of this.eshots) s.update(dt);
    for (const s of this.slows) s.life -= dt;
    this.slows = this.slows.filter(s => s.life > 0);
    if (p.act && MOVES[p.act.kind]) {
      const fx = Math.cos(p.facing), fy = Math.sin(p.facing), reach = p.act.len || 50;
      for (const s of this.eshots) {
        if (!s.breakable || s.done) continue;
        const dx = s.x - p.x, dy = s.y - p.y, along = dx * fx + dy * fy;
        if (Math.hypot(dx, dy) < 22 || (along > 0 && along < reach && Math.abs(dx * fy - dy * fx) < 24)) { s.pop(); this.text(s.x, s.y - 8, '파괴!', '#c8a0ff', 10, 0.5); }
      }
    }
    this.eshots = this.eshots.filter(s => !s.done);
    for (const r of this.rings) {
      r.r += 230 * dt;
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (!r.hit && Math.abs(d - r.r) < 12) { r.hit = true; this.hurtPlayer(r.dmg, { x: r.x, y: r.y, attacking: true }); }
    }
    this.rings = this.rings.filter(r => r.r < r.max);

    // 적끼리 겹치지 않게 밀어내기
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.flying !== b.flying || a.burrowed || b.burrowed || a.noPush || b.noPush) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) {
        const push = (m - d) / 2, nx = dx / d * push, ny = dy / d * push;
        if (a.flying) { World.fly(a, -nx, -ny); World.fly(b, nx, ny); }
        else { World.move(a, -nx, -ny); World.move(b, nx, ny); }
      }
    }
    this.enemies = es.filter(e => !e.dead && (e.keep || Math.hypot(e.x - p.x, e.y - p.y) < 900));
    this.chainT -= dt;
    if (this.chainT <= 0) this.chain = 0;
    this.updateWaves(dt);
    this.checkHints();

    if (this.phase === 'done') {
      this.clearDelay -= dt;
      if (this.clearDelay <= 0 && this.sub < STAGES_PER_WORLD) {
        // 일반 스테이지: (스토리) → 축복 → 다음 스테이지
        this.phase = 'ended';
        const key = { 1: 'totem1', 3: 'totem2' }[this.sub] || '';
        this.storyOnce(this.stage, key, () => this.openBoon(this.clearEl, () => this.nextStage()));
      } else if (this.clearDelay <= 0) {
        // 보스전: 대사 → 축복 → 세계 클리어 화면
        this.phase = 'ended';
        const done = () => {
          this.state = this.stage === this.finalWorld ? 'ending' : 'clear';
          this.clearT = 0;
          if (this.stage === this.finalWorld) {
            Meta.data.clears++; this.earn(SHARD_ALL_CLEAR); this.earnEssence(ESSENCE_ALL_CLEAR);
            const info = this.tierInfo || tierInfo(1);
            this.tierFirst = !Meta.data.tierCleared[info.n];
            if (this.tierFirst) {
              Meta.data.tierCleared[info.n] = true;
              if (info.emblem) { Meta.data.emblems += EMBLEM_PER_CLEAR; this.runEmblems += EMBLEM_PER_CLEAR; }
              else if (info.bonusShards) this.earn(info.bonusShards);
              // 다음에 고를 등급을 새로 열린 등급으로
              const next = playableTiers().filter(n => n > info.n)[0];
              if (next) Meta.data.tier = next;
            }
            this.commitRun(true);
          }
          Meta.save();
        };
        const story = STORY[this.stage];
        // 최종 보스 뒤에는 이어지는 스테이지가 없으니 축복 없이 바로 엔딩
        const reward = this.stage === this.finalWorld ? done : () => this.openBoon(null, done);
        this.storyOnce(this.stage, 'bossDown', reward);
      }
    }
  },

  updateFx(dt) {
    if (this.player) for (const it of this.pickups) it.update(dt, this.player);
    this.pickups = this.pickups.filter(it => !it.done);
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.96; }
    this.particles = this.particles.filter(q => q.life > 0).slice(-400);
    for (const t of this.texts) { t.life -= dt; t.y -= 28 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const r of this.fxRings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); }
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    this.fxRings = this.fxRings.filter(r => r.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash -= dt; this.chainPulse -= dt;
    for (const k of ['toast', 'banner', 'hintBox']) {
      if (this[k]) { this[k].t -= dt; if (this[k].t <= 0) this[k] = null; }
    }
  },
};

// ── 화면 크기 / 레이아웃 ────────────────────────────────────
let W = 0, H = 0, DPR = 1, SCALE = 2, statusBand = 0;
const inset = { t: 0, r: 0, b: 0, l: 0 };

// 터치 기기를 세로로 들고 있으면 게임을 시계 방향으로 90도 돌려 그린다.
// 휴대폰을 왼쪽으로 눕히면 바로 가로 화면이 된다 (회전 잠금이 켜져 있어도, 아이폰에서도).
const TOUCH_DEVICE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
let ROTATED = false;

function resize() {
  // 아이폰은 화면 밀도가 3배라서 3까지 써야 도트가 흐려지지 않는다
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  let pw = innerWidth, ph = innerHeight;
  // 아이폰 홈 화면 앱: innerHeight 가 아래 홈 바 영역만큼 짧게 나오는 경우가 있어 화면 크기로 채운다
  if (navigator.standalone && screen.width && screen.height) {
    const portrait = ph >= pw;
    pw = portrait ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    ph = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  }
  ROTATED = TOUCH_DEVICE && ph > pw;
  W = ROTATED ? ph : pw; H = ROTATED ? pw : ph;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = ROTATED ? `translateX(${pw}px) rotate(90deg)` : '';
  Input.rot = ROTATED; Input.physW = pw; Input.viewW = W;
  SCALE = clamp(Math.min(W, H) / 330, 1.2, 4);
  const cs = getComputedStyle(document.documentElement);
  const phys = {};
  for (const k of ['t', 'r', 'b', 'l']) phys[k] = parseFloat(cs.getPropertyValue('--sa' + k)) || 0;
  // 돌려 그릴 땐 화면 가장자리 여백도 돌아간다 (게임의 위 = 휴대폰의 오른쪽)
  if (ROTATED) { inset.t = phys.r; inset.r = phys.b; inset.b = phys.l; inset.l = phys.t; }
  else Object.assign(inset, phys);
  // 아이폰 홈 화면 앱은 세로일 때 시계(상태바)를 숨길 수 없다 → 그 줄을 어두운 테두리로 칠한다
  statusBand = phys.t > 20 ? phys.t : 0;
}

// 안드로이드: 첫 터치 때 전체화면 + 가로 고정을 요청한다 (지원 안 되면 조용히 넘어감)
let landscapeTried = false;
function tryLandscapeLock() {
  if (landscapeTried || !TOUCH_DEVICE) return;
  landscapeTried = true;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || !(screen.orientation && screen.orientation.lock)) return;
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation.lock('landscape'))
    .catch(() => {});
}
canvas.addEventListener('pointerdown', tryLandscapeLock);
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));

function layoutButtons() {
  const touch = Input.state.device === 'touch' && G.state === 'play';
  const m = 22;
  const r = clamp(Math.min(W, H) * 0.12, 38, 58);
  const ax = W - inset.r - m - r - 8, ay = H - inset.b - m - r - 8;
  const d = r * 1.95, sr = r * 0.64;
  Input.setButton('attack', ax, ay, r, touch);
  const hasSkill = !!(G.player && G.player.weapon.skill);
  Input.setButton('dash', ax - r * 1.85, ay + r * 0.15, r * 0.8, touch);      // 왼쪽 (크게, 공격 버튼 가까이)
  Input.setButton('special', ax - d * 0.74, ay - d * 0.74, sr, touch);        // 왼쪽 위
  Input.setButton('skill', ax + r * 0.1, ay - d, sr, touch && hasSkill);      // 위 (전용스킬이 있는 무기만)
  Input.joy.radius = clamp(Math.min(W, H) * 0.12, 44, 70);
  const ty = inset.t + 30, rx = W - inset.r - 30;
  Input.setButton('pause', rx, ty, 18, G.state === 'play' || G.state === 'paused');
  Input.setButton('skip', W - inset.r - 52, ty, 26, G.state === 'story');
  const canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  Input.setButton('fullscreen', rx - 46, ty, 18, !!canFs && Input.state.device === 'touch' && (G.state === 'play' || G.state === 'paused'));
}

function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    return;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}

Input.onUi = id => {
  if (id === 'skip') G.skipDialog();
  else if (id === 'fullscreen') toggleFullscreen();
  else if (id === 'pause') { if (G.state === 'play') openPause(); else if (G.state === 'paused') G.state = 'play'; }
};
Input.onPadConnect = () => { G.toast = { s: '🎮 게임패드 연결됨', t: 2.5 }; };
// 화면을 떠나면(전화 · 앱 전환 · 다른 창) 자동으로 일시정지
const autoPause = () => { if (G.state === 'play') openPause(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
addEventListener('blur', autoPause);
addEventListener('pagehide', autoPause);

// ── 그리기: 월드 ────────────────────────────────────────────
function drawWorld() {
  canvas.style.cursor = G.state === 'play' && Input.state.mouseAim ? 'crosshair' : '';
  const vw = W / SCALE, vh = H / SCALE;
  let cx = G.cam.x - vw / 2, cy = G.cam.y - vh / 2;
  cx = World.pw > vw ? clamp(cx, 0, World.pw - vw) : (World.pw - vw) / 2;
  cy = World.ph > vh ? clamp(cy, 0, World.ph - vh) : (World.ph - vh) / 2;
  G.view = { x: cx, y: cy, w: vw, h: vh };
  const sh = G.state === 'play' && Input.settings.shake ? G.shake : 0; // 축복 선택·대화·일시정지 화면에서는 흔들지 않는다
  const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
  const k = DPR * SCALE;
  const ox = Math.round((-cx + sx) * k) / k, oy = Math.round((-cy + sy) * k) / k;
  ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
  ctx.imageSmoothingEnabled = false;

  const x0 = Math.max(0, Math.floor(cx) - 2), y0 = Math.max(0, Math.floor(cy) - 2);
  const w = Math.min(World.pw - x0, Math.ceil(vw) + 4), h = Math.min(World.ph - y0, Math.ceil(vh) + 4);
  if (w > 0 && h > 0) ctx.drawImage(World.layer, x0, y0, w, h, x0, y0, w, h);

  if (!G.player || G.state === 'title') return;
  const boss = G.boss && !G.boss.dead ? G.boss : null;
  FX.drawZones(ctx);
  for (const s of G.slows) { // 거미줄 · 점액 · 진흙
    const a = clamp(s.life / s.max * 3, 0, 1);
    ctx.globalAlpha = a;
    if (s.kind === 'web') {
      ctx.strokeStyle = 'rgba(235,235,245,0.75)'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const ang = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(ang) * s.r, s.y + Math.sin(ang) * s.r * 0.7); ctx.stroke(); }
      for (const k of [0.35, 0.65, 0.95]) { ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * k, s.r * k * 0.7, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.fillStyle = s.kind === 'mud' ? 'rgba(90,70,40,0.55)' : 'rgba(200,230,170,0.35)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 바닥 예고 표시
  for (const e of G.enemies) e.drawTelegraph(ctx);
  if (boss) boss.drawTelegraph(ctx);
  for (const r of G.rings) {
    ctx.strokeStyle = `rgba(255,120,60,${0.9 * (1 - r.r / r.max)})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (const it of G.pickups) it.draw(ctx);
  const list = [...G.enemies, ...G.totems.filter(t => !t.dead), G.player];
  if (boss) list.push(boss);
  list.sort((a, b) => a.y - b.y);
  for (const e of list) e.draw(ctx);
  for (const wv of G.projectiles) wv.draw(ctx);
  for (const s of G.eshots) s.draw(ctx);
  G.lumi.draw(ctx);
  for (const q of G.particles) {
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  FX.drawBolts(ctx);
  for (const r of G.fxRings) {
    ctx.globalAlpha = clamp(r.life / 0.4, 0, 1);
    ctx.strokeStyle = r.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const t of G.texts) {
    ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1);
    ctx.font = `bold ${t.size}px ${FONT}`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(t.s, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.s, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (G.state === 'play') G.lumi.drawBubble(ctx);
}

// ── 그리기: 화면 UI ─────────────────────────────────────────
function label(s, x, y, size, color = '#fff', align = 'center', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineJoin = 'round';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function wrap(s, maxW, size, weight = '600') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function bar(x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = bg; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawHud() {
  const p = G.player;
  const x = inset.l + 16, y = inset.t + 14;
  label('♥', x, y + 7, 16, '#ff6b6b', 'left');
  const bx = x + 22, bw = clamp(W * 0.26, 120, 220);
  bar(bx, y, bw, 13, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5a5a' : '#e04848');
  label(`${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw / 2, y + 7, 10, '#fff', 'center');
  drawCooldowns(p, bx, y + 19, bw);
  if (Meta.data.mode === 'easy') { drawModeIcon('easy', bx + bw + 4, y - 4, 20); label('쉬움', bx + bw + 26, y + 7, 10, '#8ff0b0', 'left', '800'); }
  drawBoonIcons(x, y + 42);

  // 목표
  const cxm = W / 2;
  const left = G.totems.filter(t => !t.dead).length, total = G.totems.length;
  const boss = G.boss && !G.boss.dead ? G.boss : null;
  if (G.phase === 'totems') {
    const seal = G.totems[0];
    const goal = seal && seal.shielded ? `웨이브 ${Math.max(1, G.waveIdx + 1)} / ${G.waves.length}` : '봉인석을 부숴라!';
    label(`${G.tier > 1 ? `등급 ${G.tier} · ` : ''}${G.stage}-${G.sub}  ·  ${goal}`, cxm, inset.t + 22, 14, '#e8d8ff', 'center', '700');
  }
  else if (boss) {
    label(boss.name, cxm, inset.t + 20, 14, boss.enraged ? '#ff8a6a' : '#ffe08a', 'center', '700');
    const hudRight = bx + bw + 16;
    const bw2 = Math.max(140, Math.min(420, W - 2 * hudRight));
    bar(cxm - bw2 / 2, inset.t + 32, bw2, 9, boss.hp / boss.maxHp, boss.enraged ? '#ff5a3c' : '#e04848');
  }

  // 연속 타격
  if (G.chain >= 2) {
    const s = 1 + Math.max(0, G.chainPulse) * 2;
    const lx = inset.l + 16, ly = inset.t + 84;
    label(`${G.chain} HIT`, lx, ly, 22 * s, '#ffd24a', 'left', '900');
    label(`피해 +${Math.round(G.chainBonus() * 100)}%`, lx, ly + 20, 11, '#fff', 'left', '600');
  }
  { // 이번 런에서 모은 조각 (끝나야 받는다)과 지금 받을 배율
    const rp = G.rewardParts(false);
    label(`◆ ${G.runShards}`, W - inset.r - 112, inset.t + 30, 14, '#c8a0ff', 'right', '800');
    label(`보상 ×${rp.total.toFixed(2)}`, W - inset.r - 112, inset.t + 48, 10, rp.fam < 1 ? '#ff8a7a' : '#c8b8ff', 'right', '700');
    if (rp.fam < 1) label('익숙한 숲', W - inset.r - 112, inset.t + 62, 10, '#ff8a7a', 'right', '700');
  }
  drawObjectiveArrow();
}

function drawObjectiveArrow() {
  const t = G.objective();
  if (!t) return;
  const v = G.view;
  const sx = (t.x - v.x) * SCALE, sy = (t.y - v.y) * SCALE;
  if (sx > 30 && sx < W - 30 && sy > 60 && sy < H - 30) return; // 화면 안에 보이면 생략
  const dx = sx - W / 2, dy = sy - H / 2;
  const mx = W / 2 - 46, my = H / 2 - 64;
  const k = Math.min(mx / Math.abs(dx || 1e-6), my / Math.abs(dy || 1e-6));
  const ax = W / 2 + dx * k, ay = H / 2 + dy * k, a = Math.atan2(dy, dx);
  const color = t.type === 'boss' ? '#ff5a3c' : '#ffd24a';
  const bob = Math.sin(G.time * 6) * 3;
  ctx.save(); ctx.translate(ax + Math.cos(a) * bob, ay + Math.sin(a) * bob); ctx.rotate(a);
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
  ctx.stroke(); ctx.fill();
  ctx.restore();
  const dist = Math.round(Math.hypot(t.x - G.player.x, t.y - G.player.y) / TILE);
  label(`${dist}m`, ax - Math.cos(a) * 26, ay - Math.sin(a) * 22, 11, color, 'center', '700');
}

function drawButtonBase(b, pressed) {
  ctx.globalAlpha = pressed ? 0.75 : 0.45;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = pressed ? 1 : 0.8;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1, 0, Math.PI * 2); ctx.stroke();
}

function drawCdNumber(b, t) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 2, 0, Math.PI * 2); ctx.fill();
  label(t.toFixed(1), b.x, b.y, Math.max(11, b.r * 0.5), '#fff', 'center', '800');
}

// 키보드·게임패드용 쿨타임 표시 (체력바 아래)
function drawCooldowns(p, x, y, w) {
  const items = [
    ['특수', p.specialCd > 0 ? 1 - p.specialCd / p.specialCdBase : 1, null, '#4fc3ff'],
    ['대시', p.dashStock > 0 ? 1 : 1 - p.dashRecharge / p.dashCdBase, p.dashMax > 1 ? p.dashStock : null, '#8ff0b0'],
  ];
  if (p.weapon.skill) items.splice(1, 0, ['스킬', p.skillCd > 0 ? 1 - p.skillCd / p.skillCdBase : 1, null, '#ffd24a']);
  const iw = (w - 4 * (items.length - 1)) / items.length;
  items.forEach(([name, frac, n, col], i) => {
    const ix = x + i * (iw + 4), ready = frac >= 1;
    bar(ix, y, iw, 8, frac, ready ? col : 'rgba(180,190,200,0.6)');
    label(name + (n !== null ? ' ×' + n : ''), ix + iw / 2, y + 4, 9, ready ? '#fff' : '#bbb', 'center', '700');
  });
}

function drawArcProgress(b, frac, color, width = 4) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
}

function drawTouchControls() {
  const j = Input.joy, B = Input.buttons, p = G.player;
  const active = j.id !== null;
  const ox = active ? j.ox : inset.l + 40 + j.radius, oy = active ? j.oy : H - inset.b - 40 - j.radius;
  ctx.globalAlpha = active ? 0.5 : 0.22;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ox, oy, j.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalAlpha = active ? 0.85 : 0.35;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(active ? j.x : ox, active ? j.y : oy, j.radius * 0.42, 0, Math.PI * 2); ctx.fill();

  ctx.lineCap = 'round';
  // 공격 (큰 버튼)
  const a = B.attack, s = a.r * 0.42;
  drawButtonBase(a, a.held);
  if (p.spearOut) ctx.globalAlpha *= 0.35;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, a.r * 0.1);
  ctx.beginPath();
  ctx.moveTo(a.x - s, a.y + s); ctx.lineTo(a.x + s, a.y - s);
  ctx.moveTo(a.x - s * 0.9, a.y + s * 0.2); ctx.lineTo(a.x - s * 0.2, a.y + s * 0.9);
  ctx.stroke();
  // 길게 누르는 중: 회전베기 충전 게이지
  if (p.charge > 0) drawArcProgress(a, p.charge, p.charge >= 1 ? '#ffd24a' : 'rgba(255,255,255,0.8)', 5);

  // 특수공격 (초승달 검기)
  ctx.globalAlpha = 1;
  padButton(B.special, p.specialCd, p.specialCdBase, '#4fc3ff', b => {
    if (p.weaponId === 'spear') { // 창 투척: 화살표
      const q = b.r * 0.45;
      ctx.beginPath(); ctx.moveTo(b.x - q, b.y + q); ctx.lineTo(b.x + q, b.y - q);
      ctx.moveTo(b.x + q * 0.1, b.y - q); ctx.lineTo(b.x + q, b.y - q); ctx.lineTo(b.x + q, b.y - q * 0.1); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(b.x - b.r * 0.2, b.y, b.r * 0.45, -1, 1); ctx.stroke(); }
  }, p.finisherT > 0 && G.has('triple'));
  // 전용스킬 (무기에 있을 때만 보인다)
  padButton(B.skill, p.skillCd, p.skillCdBase, '#ffd24a', b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); ctx.stroke();
  });
  // 대시 (이중 화살표)
  const dashCd = p.dashStock > 0 ? 0 : p.dashRecharge;
  padButton(B.dash, dashCd, p.dashCdBase, '#8ff0b0', b => {
    const ds = b.r * 0.42;
    ctx.beginPath();
    for (const o of [-0.45, 0.35]) {
      ctx.moveTo(b.x + ds * (o - 0.3), b.y - ds * 0.6); ctx.lineTo(b.x + ds * (o + 0.3), b.y); ctx.lineTo(b.x + ds * (o - 0.3), b.y + ds * 0.6);
    }
    ctx.stroke();
  });
  if (p.dashMax > 1) label(String(p.dashStock), B.dash.x + B.dash.r * 0.75, B.dash.y - B.dash.r * 0.75, 11, '#8ff0b0');
  ctx.globalAlpha = 1;
}

// 쿨타임이 있는 작은 버튼: 쿨타임 중엔 어둡게 + 남은 초
function padButton(b, cd, cdBase, color, icon, glow) {
  if (!b || !b.visible) return;
  drawButtonBase(b, b.held);
  ctx.globalAlpha = cd > 0 ? 0.35 : 1;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, b.r * 0.12);
  icon(b);
  ctx.globalAlpha = 1;
  if (cd > 0) {
    drawArcProgress(b, 1 - cd / cdBase, color, 3);
    drawCdNumber(b, cd);
  }
  if (glow) { // 연계 타이밍 (3타째 직후 스킬 → 삼연 검기)
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawUiButton(b, kind) {
  if (!b || !b.visible) return;
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  if (kind === 'pause') {
    ctx.fillRect(b.x - 5, b.y - 6, 3.5, 12); ctx.fillRect(b.x + 1.5, b.y - 6, 3.5, 12);
  } else {
    const s = 6, c = 3;
    ctx.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(b.x + dx * s, b.y + dy * (s - c)); ctx.lineTo(b.x + dx * s, b.y + dy * s); ctx.lineTo(b.x + dx * (s - c), b.y + dy * s);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── 키 이름 ─────────────────────────────────────────────
const KEY_NAMES = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Escape: 'Esc', Enter: 'Enter',
  ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt',
  ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', Tab: 'Tab', Backspace: '←Back', CapsLock: 'Caps',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
};
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L스틱', 'R스틱', '십자↑', '십자↓', '십자←', '십자→', '홈'];
const PAD_NAMES_SWITCH = ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L스틱', 'R스틱', '십자↑', '십자↓', '십자←', '십자→', '홈'];
const kbName = c => KEY_NAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, '키패드 ');
const padName = i => (Input.settings.padLayout === 'switch' ? PAD_NAMES_SWITCH : PAD_NAMES)[i] || '버튼' + i;

// ── 일시정지 메뉴 (패키지 게임처럼) ─────────────────────────
// 일시정지 키(Esc · P · START · ⏸)를 누르면 열린다
const PAUSE_ITEMS = [
  { id: 'resume', name: '계속하기' },
  { id: 'moves', name: '기술 · 축복 보기' },
  { id: 'settings', name: '설정' },
  { id: 'quit', name: '포기하고 마을로' },
];
function openPause() {
  G.state = 'paused';
  G.pm = { sel: 0, view: 'menu', axis: 0, t: 0, qsel: 1 };
}
function pauseLayout() {
  const w = Math.min(320, W - 40), h = 42, gap = 10, n = PAUSE_ITEMS.length;
  const y0 = H / 2 - (n * (h + gap)) / 2 + 20;
  return PAUSE_ITEMS.map((it, i) => ({ it, x: W / 2 - w / 2, y: y0 + i * (h + gap), w, h }));
}
function quitLayout() {
  const w = Math.min(200, (W - 60) / 2), h = 42;
  return [{ id: 'yes', name: '포기하기', x: W / 2 - w - 8, y: H / 2 + 36, w, h }, { id: 'no', name: '계속하기', x: W / 2 + 8, y: H / 2 + 36, w, h }];
}
const inRectPt = (pt, r) => pt && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
// 위아래 / 좌우 입력을 한 번씩만 받는다
// 위아래를 길게 누르면 반복: 0.35초 뒤부터, 점점 빨라진다 (0.13초 → 0.04초 간격)
// 반복 중에도 다른 영역으로 넘어가고, 맨 위 ↔ 맨 아래로 돈다
const REPEAT_DELAY = 0.35, REPEAT_GAP = 0.13, REPEAT_MIN = 0.04, REPEAT_ACCEL = 0.82;
function axisRepeat(o, v, dt) {
  if (!v) { o.rpRep = false; return 0; }
  if (v !== o.axis) { o.rpT = REPEAT_DELAY; o.rpGap = REPEAT_GAP; o.rpRep = false; return v; }
  o.rpT -= dt;
  if (o.rpT > 0) return 0;
  o.rpT += o.rpGap; o.rpGap = Math.max(REPEAT_MIN, o.rpGap * REPEAT_ACCEL); o.rpRep = true;
  return v;
}
function menuAxis(o, inp, dt = 0) {
  const v = inp.my > 0.5 ? 1 : inp.my < -0.5 ? -1 : 0, h = inp.mx > 0.5 ? 1 : inp.mx < -0.5 ? -1 : 0;
  const dy = axisRepeat(o, v, dt), dx = h && h !== o.axisX ? h : 0;
  o.axis = v; o.axisX = h;
  return { dy, dx, rep: !!(dy && o.rpRep) };
}
// 목록 이동: 끝에서 반대쪽 끝으로
const stepSel = (sel, dy, len) => (sel + dy + len) % len;

function handlePauseInput(dt, inp) {
  const m = G.pm || (G.pm = { sel: 0, view: 'menu', axis: 0, t: 0, qsel: 1 });
  m.t += dt;
  if (m.t < 0.15) return;
  const { dy, dx, rep } = menuAxis(m, inp, dt);
  if (m.view === 'moves') { if (inp.back || inp.confirm || inp.tap) { m.view = 'menu'; Sfx.pickup(); } return; }
  if (m.view === 'quit') {
    if (dx) { m.qsel = m.qsel ? 0 : 1; Sfx.pickup(); }
    const L = quitLayout();
    let pick = null;
    if (inp.tap) { const i = L.findIndex(r => inRectPt(inp.tap, r)); if (i >= 0) pick = i; }
    else if (inp.confirm) pick = m.qsel;
    if (pick === 0) { G.goVillage(); return; }
    if (pick === 1 || inp.back) { m.view = 'menu'; Sfx.pickup(); }
    return;
  }
  if (dy) { const k = stepSel(m.sel, dy, PAUSE_ITEMS.length, rep); if (k !== m.sel) { m.sel = k; Sfx.pickup(); } }
  let pick = null;
  if (inp.tap) { const i = pauseLayout().findIndex(r => inRectPt(inp.tap, r)); if (i >= 0) { m.sel = i; pick = i; } }
  else if (inp.confirm) pick = m.sel;
  if ((inp.back || inp.pause) && pick === null) { G.state = 'play'; return; }
  if (pick === null) return;
  const id = PAUSE_ITEMS[pick].id;
  Sfx.pickup();
  if (id === 'resume') G.state = 'play';
  else if (id === 'moves') m.view = 'moves';
  else if (id === 'settings') openSettings('paused');
  else if (id === 'quit') { m.view = 'quit'; m.qsel = 1; }
}

function drawPauseMenu(big, blink, tap) {
  const m = G.pm || { sel: 0, view: 'menu' };
  if (m.view === 'moves') { drawPauseScreen(big, blink, tap); return; }
  overlay(0.6);
  if (m.view === 'quit') {
    label('이번 모험을 포기할까요?', W / 2, H / 2 - 40, 20, '#fff', 'center', '800');
    label(`포기하면 이번 런 보상(◆ ${G.runShards} · ⚔ ${G.runEssence})은 받지 못해요`, W / 2, H / 2 - 10, 13, '#ff9a7a', 'center', '700');
    label('보상은 쓰러지거나 끝까지 깼을 때 받아요', W / 2, H / 2 + 8, 11, '#ccd', 'center', '600');
    quitLayout().forEach((r, i) => {
      const sel = m.qsel === i;
      ctx.fillStyle = sel ? (i ? '#3f8a3b' : '#9a3a2a') : 'rgba(30,36,48,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      label(r.name, r.x + r.w / 2, r.y + r.h / 2, 15, '#fff', 'center', '800');
    });
    return;
  }
  label('일시정지', W / 2, pauseLayout()[0].y - 40, big * 0.6, '#ffe08a', 'center', '900');
  if (G.tier) label(`봉인 등급 ${G.tier} · ${G.stage}-${G.sub}${Meta.data.mode === 'easy' ? ' · 쉬움' : ''}`, W / 2, pauseLayout()[0].y - 14, 12, '#ccd', 'center', '600');
  pauseLayout().forEach((r, i) => {
    const sel = m.sel === i;
    ctx.fillStyle = sel ? 'rgba(70,60,110,0.97)' : 'rgba(24,28,40,0.92)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    label((sel ? '▶ ' : '') + r.it.name, r.x + r.w / 2, r.y + r.h / 2, 16, r.it.id === 'quit' ? '#ffb0a0' : '#fff', 'center', '800');
  });
  const d = Input.state.device;
  const how = d === 'touch' ? '항목을 탭하세요' : d === 'gamepad' ? '↑↓ 고르기 · A 결정 · B 돌아가기' : '↑↓ 고르기 · Enter/Z 결정 · Esc 돌아가기';
  label(how, W / 2, H - inset.b - 18, 12, '#aab', 'center', '600');
}

// ── 설정: 키보드 · 게임패드 키 설정, 진동 · 화면 흔들림 ───────
const SETTING_TABS = ['키보드', '게임패드', '기타'];
const KB_ACTIONS = [['up', '위로 이동'], ['down', '아래로 이동'], ['left', '왼쪽으로 이동'], ['right', '오른쪽으로 이동'],
  ['attack', '공격 (길게 누르면 차지)'], ['dash', '대시'], ['special', '특수공격'], ['pause', '일시정지 · 메뉴']];
const PAD_ACTIONS = [['attack', '공격 (길게 누르면 차지)'], ['dash', '대시'], ['special', '특수공격'], ['pause', '일시정지 · 메뉴']];
function openSettings(from) {
  G.settingsFrom = from; G.state = 'settings';
  G.su = { tab: Input.state.device === 'gamepad' ? 1 : 0, sel: 0, axis: 0, axisX: 0, t: 0, waiting: null, msg: null };
}
function closeSettings() {
  Input.capture = null; Input.captureDev = null;
  G.state = G.settingsFrom === 'village' ? 'village' : G.settingsFrom === 'title' ? 'title' : 'paused';
  if (G.state === 'paused' && G.pm) G.pm.t = 0;
  if (G.state === 'village' && G.village) { G.village.t = 0.3; G.village.armed = false; }
}
function settingsRows(tab) {
  const B = Input.binds, S = Input.settings;
  if (tab === 0) return [{ kind: 'mode', name: '조작 방식', value: S.kbMode === 'mouse' ? '키보드+마우스' : '키보드만' },
    ...(S.kbMode === 'mouse' ? [{ kind: 'toggle', key: 'cursorAim', name: '마우스 조준 (공격이 커서 쪽으로)', value: S.cursorAim ? '켜짐' : '꺼짐' }] : []), ...KB_ACTIONS.map(([a, n]) => ({ kind: 'key', dev: 'kb', action: a, name: n, value: B.kb[a].map(kbName).join(' / ') })),
    { kind: 'reset', dev: 'kb', name: '키보드 기본값으로 되돌리기', value: '' }];
  if (tab === 1) return [{ kind: 'padlayout', name: '패드 레이아웃', value: S.padLayout === 'switch' ? '스위치  ·  A 선택 (오른쪽) · B 취소 (아래)' : 'Xbox  ·  A 선택 (아래) · B 취소 (오른쪽)' }, ...PAD_ACTIONS.map(([a, n]) => ({ kind: 'key', dev: 'pad', action: a, name: n, value: B.pad[a].map(padName).join(' / ') })),
    { kind: 'reset', dev: 'pad', name: '게임패드 기본값으로 되돌리기', value: '' }];
  return [{ kind: 'toggle', key: 'rumble', name: '진동 (게임패드 · 휴대폰)', value: S.rumble ? '켜짐' : '꺼짐' },
    { kind: 'toggle', key: 'shake', name: '화면 흔들림', value: S.shake ? '켜짐' : '꺼짐' }];
}
function settingsLayout() {
  const s = G.su, rows = settingsRows(s.tab);
  const w = Math.min(560, W - 40), x = W / 2 - w / 2, top = inset.t + 92, rh = clamp((H - inset.b - 60 - top) / Math.max(rows.length, 6), 26, 38);
  const tw = w / SETTING_TABS.length;
  return {
    tabs: SETTING_TABS.map((n, i) => ({ x: x + i * tw, y: inset.t + 52, w: tw - 4, h: 30 })),
    rows: rows.map((r, i) => ({ r, x, y: top + i * rh, w, h: rh - 4 })),
    back: { x: inset.l + 12, y: inset.t + 10, w: 96, h: 30 },
  };
}
function settingsAct(row) {
  const s = G.su;
  if (row.kind === 'reset') { Input.resetBinds(row.dev); s.msg = '기본값으로 되돌렸어요'; Sfx.level(); return; }
  if (row.kind === 'toggle') { Input.settings[row.key] = !Input.settings[row.key]; Input.saveSettings(); Sfx.pickup(); return; }
  if (row.kind === 'padlayout') {
    Input.settings.padLayout = Input.settings.padLayout === 'switch' ? 'xbox' : 'switch'; Input.saveSettings(); Sfx.pickup();
    s.msg = Input.settings.padLayout === 'switch' ? '스위치 레이아웃: A 선택 (오른쪽) · B 취소 (아래)' : 'Xbox 레이아웃: A 선택 (아래) · B 취소 (오른쪽)';
    s.t = 0; return;
  }
  if (row.kind === 'mode') {
    Input.settings.kbMode = Input.settings.kbMode === 'mouse' ? 'keys' : 'mouse'; Input.saveSettings(); Sfx.pickup();
    s.msg = Input.settings.kbMode === 'mouse' ? '키보드+마우스: WASD 이동 · 왼쪽 클릭 공격 · 오른쪽 클릭 특수 · Space 대시' : '키보드만: 방향키 이동 · Z 공격 · X 대시 · C 특수';
    return;
  }
  s.waiting = row; s.msg = null; s.wt = 0; Sfx.pickup();
  Input.captureDev = row.dev;
  Input.capture = (kind, code) => {
    s.waiting = null; Input.clearKeys(); Input.captureDev = null;
    if (kind === 'cancel') { s.msg = '취소했어요'; s.t = 0; return; }
    if (kind === 'kb' && code === 'Escape') { s.msg = '취소했어요'; return; }
    if (kind !== row.dev) { s.msg = row.dev === 'kb' ? '키보드 키를 눌러야 해요' : '게임패드 버튼을 눌러야 해요'; return; }
    if (kind === 'pad' && code >= 12 && code <= 15) { s.msg = '십자키는 이동 전용이에요'; return; }
    Input.bind(row.dev, row.action, code);
    s.msg = `${row.name} → ${kind === 'kb' ? kbName(code) : `${padName(code)} (버튼 ${code})`}`; Sfx.level();
    s.t = 0; // 방금 누른 키가 바로 메뉴 결정으로 이어지지 않게
  };
}
function handleSettingsInput(dt, inp) {
  const s = G.su; s.t += dt;
  if (s.waiting) { // 키 입력 기다리는 중 (화면을 탭하면 취소)
    s.wt = (s.wt || 0) + dt;
    if (inp.tap || s.wt > 8) { Input.capture = null; Input.captureDev = null; s.waiting = null; s.msg = inp.tap ? '취소했어요' : '시간이 지나 취소했어요'; }
    return;
  }
  if (s.t < 0.2) { menuAxis(s, inp); return; }
  const L = settingsLayout(), { dy, dx, rep } = menuAxis(s, inp, dt);
  if (inp.tap) {
    if (inRectPt(inp.tap, L.back)) { closeSettings(); return; }
    const ti = L.tabs.findIndex(r => inRectPt(inp.tap, r));
    if (ti >= 0) { s.tab = ti; s.sel = 0; s.msg = null; Sfx.pickup(); return; }
    const ri = L.rows.findIndex(r => inRectPt(inp.tap, r));
    if (ri >= 0) { s.sel = ri; settingsAct(L.rows[ri].r); }
    return;
  }
  if (inp.back) { closeSettings(); return; }
  const tx = dx || (inp.rb ? 1 : inp.lb ? -1 : 0); // 탭 이동: ←→ 또는 LB · RB
  if (tx) { s.tab = (s.tab + tx + SETTING_TABS.length) % SETTING_TABS.length; s.sel = 0; s.msg = null; Sfx.pickup(); return; }
  if (dy) { const k = stepSel(s.sel, dy, L.rows.length, rep); if (k !== s.sel) { s.sel = k; Sfx.pickup(); } }
  if (inp.confirm && L.rows[s.sel]) settingsAct(L.rows[s.sel].r);
}
function drawSettings(blink) {
  const s = G.su, L = settingsLayout();
  overlay(0.85);
  label('설정', W / 2, inset.t + 26, 22, '#ffe08a', 'center', '900');
  // 뒤로 버튼
  const b = L.back;
  ctx.fillStyle = 'rgba(40,46,60,0.95)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  label('← 돌아가기', b.x + b.w / 2, b.y + b.h / 2, 12, '#fff', 'center', '700');
  L.tabs.forEach((r, i) => {
    ctx.fillStyle = i === s.tab ? '#6a3fb0' : 'rgba(40,40,60,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    label(SETTING_TABS[i], r.x + r.w / 2, r.y + r.h / 2, 13, '#fff', 'center', '800');
  });
  L.rows.forEach((row, i) => {
    const sel = s.sel === i, r = row.r, waiting = s.waiting === r;
    ctx.fillStyle = waiting ? 'rgba(120,90,20,0.95)' : sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.88)'; ctx.fillRect(row.x, row.y, row.w, row.h);
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(row.x + 1, row.y + 1, row.w - 2, row.h - 2); }
    label(r.name + (r.kind === 'mode' ? '  (A · Enter로 바꾸기)' : r.kind === 'padlayout' ? '  (A로 바꾸기)' : ''), row.x + 14, row.y + row.h / 2, 13, r.kind === 'reset' ? '#ffb0a0' : r.kind === 'mode' || r.kind === 'padlayout' ? '#ffe08a' : '#fff', 'left', '700');
    const val = waiting ? (blink ? (r.dev === 'kb' ? '새 키를 누르세요… (Esc 취소)' : '새 버튼을 누르세요… (B 취소)') : '') : r.value;
    label(val, row.x + row.w - 14, row.y + row.h / 2, 13, waiting ? '#ffe08a' : r.kind === 'toggle' ? (r.value === '켜짐' ? '#8ff0b0' : '#ff9a7a') : '#c8d8ff', 'right', '800');
  });
  const d = Input.state.device;
  const how = s.msg || (s.tab === 1 ? '이동은 왼쪽 스틱 · 십자키로 고정이에요' : d === 'touch' ? '키를 바꾸려면 키보드나 게임패드를 연결하세요'
    : d === 'gamepad' ? `${padName(4)} · ${padName(5)} / ←→ 탭 · ↑↓ 고르기 · A 선택 → 바꿀 버튼 누르기 · B 취소/돌아가기 (B는 지정할 수 없어요)` : s.tab === 0 ? (Input.settings.kbMode === 'mouse' ? `키보드+마우스: 왼쪽 클릭 공격 · 오른쪽 클릭 특수 · 조준은 ${Input.settings.cursorAim ? '커서 쪽' : '보는 방향 + 자동 조준'}` : '키보드만: 공격은 보는 방향으로 · 마우스는 메뉴 클릭에만') : '←→ 탭 · ↑↓ 고르기 · Enter 바꾸기 · Esc 돌아가기');
  label(how, W / 2, H - inset.b - 18, 12, s.msg ? '#ffe08a' : '#aab', 'center', '600');
  if (s.tab === 1) { // 패드 입력 확인: 스틱 · 십자키 · 버튼이 제대로 들어오는지
    const pi = Input.padInfo;
    const arrow = pi ? (pi.ay < -0.5 ? '↑' : pi.ay > 0.5 ? '↓' : '') + (pi.ax < -0.5 ? '←' : pi.ax > 0.5 ? '→' : '') : '';
    label(pi ? `입력 확인 · 방향 ${arrow || '·'}  ·  누른 버튼 ${pi.pressed.length ? pi.pressed.map(i => `${padName(i)}(${i})`).join(' ') : '없음'}${Input.lastKey ? `  ·  키 신호 ${Input.lastKey}` : ''}${pi.mapping === 'standard' ? '' : '  (비표준 배치)'}`
      : '패드가 연결되지 않았어요 · 아무 버튼이나 눌러 보세요', W / 2, H - inset.b - 36, 11, pi ? '#8ff0b0' : '#ff9a7a', 'center', '600');
  }
}

// 마을의 설정 버튼 (톱니)
function villageGear() { return { x: W - inset.r - 46, y: inset.t + 30, w: 34, h: 30 }; }
function drawGear(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(30,36,48,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); }
  label('⚙', r.x + r.w / 2, r.y + r.h / 2 + 1, 16, '#fff', 'center', '700');
  if (sel) label('설정', r.x - 6, r.y + r.h / 2, 12, '#ffe08a', 'right', '800');
}

function keyNames() {
  const d = Input.state.device, B = Input.binds;
  if (d === 'touch') return { A: '공격', P: '특수', D: '대시', move: '왼쪽 조이스틱' };
  if (d === 'gamepad') return { A: padName(B.pad.attack[0]), P: padName(B.pad.special[0]), D: padName(B.pad.dash[0]), move: '왼쪽 스틱' };
  if (Input.state.mouseMode) return { A: '왼쪽 클릭', P: '오른쪽 클릭', D: kbName(B.kb.dash.includes('Space') ? 'Space' : B.kb.dash[0]), move: B.kb.up.includes('KeyW') ? 'WASD' : kbName(B.kb.up[0]) + kbName(B.kb.left[0]) + kbName(B.kb.down[0]) + kbName(B.kb.right[0]) };
  const arrows = B.kb.up.includes('ArrowUp') && B.kb.left.includes('ArrowLeft');
  return { A: kbName(B.kb.attack[0]), P: kbName(B.kb.special[0]), D: kbName(B.kb.dash[0]), move: arrows ? '방향키' : [B.kb.up, B.kb.left, B.kb.down, B.kb.right].map(l => kbName(l[0])).join('') };
}

function moveList() {
  const { A, P, D } = keyNames();
  const Wp = G.player ? G.player.weapon : WEAPONS[Meta.data.weapon];
  const rows = Wp.rows(A, P, D);
  return rows.map(r => (!r[3] || G.has(r[3]) ? r : ['???', `Lv.${UNLOCK_LV[r[3]]}에 해금`, '레벨을 올려서 배우기']));
}

function drawMoveList(top, cx = W / 2, narrow = W < 640) {
  const rows = moveList();
  const lh = narrow ? 28 : 22;
  rows.forEach(([name, input, desc], i) => {
    const y = top + i * lh;
    if (narrow) {
      label(name, cx - 8, y, 13, '#ffd24a', 'right');
      label(input, cx + 8, y, 13, '#fff', 'left', '600');
      label(desc, cx, y + 13, 10, '#b8c8b8', 'center', '500');
    } else {
      label(name, cx - 120, y, 14, '#ffd24a', 'right');
      label(input, cx - 100, y, 14, '#fff', 'left', '600');
      label(desc, cx + 70, y, 13, '#b8c8b8', 'left', '500');
    }
  });
  return top + rows.length * lh;
}

function drawDialog() {
  const d = G.dialog;
  if (!d) return;
  const [who, text] = d.lines[d.i];
  const sys = who === 'system', sp = SPEAKERS[who];
  overlay(0.3);
  const bw = Math.min(W - 32 - inset.l - inset.r, 760), bh = clamp(H * 0.34, 104, 150);
  const bx = (W - bw) / 2, by = H - inset.b - bh - 12;
  ctx.fillStyle = 'rgba(10,18,14,0.92)'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = sp.color; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  let tx = bx + 18, ty = by + 24;
  if (sys) {
    label('✦ 새 기술 습득', tx, ty, 15, sp.color, 'left', '800');
  } else {
    const ps = bh - 30;
    drawPortrait(ctx, who, bx + 14 + ps / 2, by + bh / 2, ps);
    tx = bx + 30 + ps;
    label(sp.name, tx, ty, 15, sp.color, 'left', '800');
  }
  ty += 26;
  const lines = wrap(text, bx + bw - tx - 20, 15, '600');
  d.total = lines.reduce((n, l) => n + l.length, 0);
  let remain = Math.floor(d.chars);
  lines.forEach((l, i) => {
    if (remain <= 0) return;
    label(l.slice(0, remain), tx, ty + i * 22, 15, '#fff', 'left', '600');
    remain -= l.length;
  });
  if (d.chars >= d.total && Math.sin(G.time * 6) > 0) label('▼', bx + bw - 20, by + bh - 16, 12, sp.color);
  const b = Input.buttons.skip;
  if (b && b.visible) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(b.x - 34, b.y - 14, 68, 28);
    label('건너뛰기 ▶', b.x, b.y, 12, '#fff', 'center', '700');
  }
}

function drawBoonIcons(x, y) {
  const owned = BOONS.filter(b => G.boons[b.id]);
  owned.forEach((b, i) => {
    const cx = x + 10 + (i % 8) * 22, cy = y + Math.floor(i / 8) * 22;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = boonColor(b); ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b).slice(0, 2), cx, cy + 1);
    if (G.boons[b.id] > 1) label(String(G.boons[b.id]), cx + 8, cy + 7, 9, '#ffd24a');
  });
}

function boonLayout() {
  const n = G.offer.cards.length, gap = 14;
  const horiz = W >= 560;
  const L = { horiz, cards: [] };
  if (horiz) {
    const cw = Math.min(230, (W - inset.l - inset.r - 40 - (n - 1) * gap) / n);
    const ch = Math.min(H - 180, 236);
    const x0 = (W - (n * cw + (n - 1) * gap)) / 2, y0 = Math.max(76, (H - ch - 44) / 2 + 10);
    for (let i = 0; i < n; i++) L.cards.push({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch });
  } else {
    const cw = Math.min(W - 32, 440), ch = Math.min((H - 196 - (n - 1) * 10) / n, 130);
    for (let i = 0; i < n; i++) L.cards.push({ x: (W - cw) / 2, y: 96 + i * (ch + 10), w: cw, h: ch });
  }
  const last = L.cards[n - 1];
  L.reroll = { x: W / 2 - 75, y: last.y + last.h + 12, w: 150, h: 30 };
  return L;
}

function drawBoonScreen() {
  const o = G.offer;
  overlay(0.72);
  const head = o.el ? ELEMENTS[o.el] : null;
  const title = head ? `${head.icon} ${head.spirit}의 축복` : '✦ 보스 격파 보상';
  label(title, W / 2, inset.t + 30, 22, head ? head.color : '#ffd24a', 'center', '900');
  label('축복을 하나 고르세요', W / 2, inset.t + 56, 13, '#ddd', 'center', '600');
  const L = boonLayout();
  const appear = clamp(o.t / BOON_LOCK, 0, 1);
  const left = o.auto ? 0 : Math.max(0, BOON_TIME - Math.max(0, o.t - BOON_LOCK)), urgent = left <= 3;
  const tcx = W - inset.r - 40, tcy = inset.t + 34;
  ctx.beginPath(); ctx.arc(tcx, tcy, 20, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(tcx, tcy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / BOON_TIME));
  ctx.strokeStyle = urgent ? '#ff5a4a' : '#ffd24a'; ctx.lineWidth = 4; ctx.stroke();
  label(String(Math.ceil(left)), tcx, tcy + 1, urgent ? 18 + (left % 1) * 4 : 16, urgent ? '#ff8a7a' : '#fff', 'center', '900');
  o.cards.forEach((c, i) => {
    const r = L.cards[i], b = c.boon, col = boonColor(b), sel = i === o.sel;
    const lift = sel ? -6 : 0, x = r.x, y = r.y + lift + (1 - appear) * 20;
    ctx.globalAlpha = appear;
    ctx.fillStyle = sel ? 'rgba(30,36,44,0.97)' : 'rgba(18,22,28,0.92)';
    ctx.fillRect(x, y, r.w, r.h);
    ctx.fillStyle = col; ctx.fillRect(x, y, r.w, 4);
    ctx.strokeStyle = sel ? col : 'rgba(255,255,255,0.15)'; ctx.lineWidth = sel ? 3 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, r.w - 1, r.h - 1);
    const tag = b.duo ? '듀오 축복' : b.slot ? SLOT_NAMES[b.slot] : b.needs ? `${BOON_BY_ID[b.needs].name} 강화` : b.el === 'might' || b.el === 'guard' ? '누적 패시브' : '패시브';
    const extra = c.replaces ? BOONS.filter(o => o.needs === c.replaces.id && G.boons[o.id]).map(o => ' +' + o.name).join('') : '';
    const status = c.lv > 1 ? `강화 Lv${c.lv - 1} → Lv${c.lv}` : c.replaces ? `교체: ${c.replaces.name}${extra}` : 'NEW';
    const stCol = c.lv > 1 ? '#8ff0b0' : c.replaces ? '#ff9a7a' : '#ffd24a';
    let tx, ty, tw;
    if (L.horiz) {
      ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b), x + r.w / 2, y + 32);
      label(b.name, x + r.w / 2, y + 64, 16, col, 'center', '800');
      label(tag, x + r.w / 2, y + 84, 11, '#aab', 'center', '600');
      label(status, x + r.w / 2, y + 101, 11, stCol, 'center', '700');
      tx = x + 12; ty = y + 124; tw = r.w - 24;
    } else {
      ctx.font = `24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b), x + 28, y + r.h / 2);
      label(b.name, x + 56, y + 18, 15, col, 'left', '800');
      label(`${tag} · ${status}`, x + 56, y + 36, 11, stCol, 'left', '600');
      tx = x + 56; ty = y + 56; tw = r.w - 66;
    }
    wrap(b.desc(c.lv), tw, 12, '500').forEach((l, k) => label(l, tx, ty + k * 16, 12, '#e8e8e8', 'left', '500'));
    if (o.auto && sel) { // 시간 초과로 고른 카드: 빛나는 테두리 + 퍼지는 빛 + 테두리를 도는 반짝이
      const t = o.auto.t, on = ((t * 14) | 0) % 2 === 0, pulse = 0.5 + 0.5 * Math.sin(t * 28);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.12 * pulse})`; ctx.fillRect(x, y, r.w, r.h); // 카드가 번쩍
      ctx.shadowColor = on ? '#fff' : col; ctx.shadowBlur = 18 + 16 * pulse;                    // 빛 번짐
      ctx.strokeStyle = on ? '#fff' : col; ctx.lineWidth = 5;
      ctx.strokeRect(x - 3, y - 3, r.w + 6, r.h + 6);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? col : '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 8, y - 8, r.w + 16, r.h + 16);
      // 바깥으로 퍼지는 빛 테두리 (0.3초마다)
      const k = (t % 0.3) / 0.3, g = 8 + k * 18;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.strokeRect(x - g, y - g, r.w + g * 2, r.h + g * 2);
      // 테두리를 따라 도는 반짝이
      ctx.globalAlpha = 1;
      const per = 2 * (r.w + r.h);
      for (let s = 0; s < 6; s++) {
        let d = ((t * 520 + s * per / 6) % per + per) % per, px, py;
        if (d < r.w) { px = x + d; py = y - 3; }
        else if ((d -= r.w) < r.h) { px = x + r.w + 3; py = y + d; }
        else if ((d -= r.h) < r.w) { px = x + r.w - d; py = y + r.h + 3; }
        else { d -= r.w; px = x - 3; py = y + r.h - d; }
        ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px + 2, py); ctx.lineTo(px, py + 6); ctx.lineTo(px - 2, py); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px, py + 2); ctx.lineTo(px + 6, py); ctx.lineTo(px, py - 2); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = appear;
    }
    if (sel && o.armed && !o.auto) {
      const k = clamp(o.hold / BOON_HOLD, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 8, y + r.h - 14, r.w - 16, 6);
      ctx.fillStyle = col; ctx.fillRect(x + 8, y + r.h - 14, (r.w - 16) * k, 6);
    }
  });
  ctx.globalAlpha = 1;
  const d = Input.state.device;
  const how = !o.armed ? (o.t < BOON_LOCK ? '…' : '버튼에서 손을 떼 주세요')
    : d === 'touch' ? '카드를 탭해서 고르고, 길게 눌러서 선택'
    : d === 'gamepad' ? `십자키로 고르고 ${keyNames().A}를 길게 눌러서 선택`
    : `← → 로 고르고 ${keyNames().A}를 길게 눌러서 선택`;
  if (!o.auto) label(how + '  ·  시간이 지나면 무작위로 결정', W / 2, H - inset.b - 16, 12, '#ddd', 'center', '600');
  const rb = L.reroll;
  if (rb && Meta.lv('choice') > 0) {
    const ok = G.rerolls > 0 && o.armed;
    ctx.fillStyle = ok ? 'rgba(106,63,176,0.9)' : 'rgba(60,60,70,0.8)'; ctx.fillRect(rb.x, rb.y, rb.w, rb.h);
    const key = d === 'touch' ? '' : d === 'gamepad' ? ` [${padName(3)}]` : ` [${keyNames().P}]`;
    label(`↻ 다시 뽑기 ${G.rerolls}${key}`, rb.x + rb.w / 2, rb.y + rb.h / 2, 12, ok ? '#fff' : '#999', 'center', '800');
  }
}

const BOON_LOCK = 0.6;   // 화면이 열린 뒤 입력을 무시하는 시간
const BOON_HOLD = 0.6;   // 이만큼 길게 눌러야 선택된다
const BOON_TIME = 10;    // 선택 제한 시간. 지나면 룰렛을 돌려 무작위로 결정

// 시간 초과: 무작위 카드를 고르고, 그 카드 테두리를 잠깐 반짝여 보여 준 뒤 결정
const AUTO_PICK_SHOW = 0.9;
function startBoonRoulette(o) {
  o.sel = (Math.random() * o.cards.length) | 0;
  o.auto = { t: 0 }; o.hold = 0;
  Sfx.level();
}
function boonRoulette(o, dt) {
  o.auto.t += dt;
  if (o.auto.t >= AUTO_PICK_SHOW) G.chooseBoon(o.sel);
}

function handleBoonInput(dt, inp) {
  const o = G.offer;
  o.t += dt;
  if (o.t < BOON_LOCK) return;
  if (o.auto) { boonRoulette(o, dt); return; }
  const left = BOON_TIME - (o.t - BOON_LOCK);
  if (left <= 0) { startBoonRoulette(o); return; }
  if (Math.ceil(left) !== Math.ceil(left + dt) && left < 3) Sfx.pickup(); // 마지막 3초 째깍
  // 화면이 열리기 전부터 누르고 있던 버튼·손가락은 한 번 떼야 인식한다
  if (!o.armed) {
    if (inp.attackHeld || Input.pointers.size) return;
    o.armed = true;
  }
  const L = boonLayout();
  const cardAt = pt => L.cards.findIndex(r => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y - 8 && pt.y <= r.y + r.h);
  // 다시 뽑기: 버튼 탭 또는 특수공격 키(C / X)
  const rb = L.reroll;
  const tapReroll = inp.tap && inp.tap.x >= rb.x && inp.tap.x <= rb.x + rb.w && inp.tap.y >= rb.y && inp.tap.y <= rb.y + rb.h;
  if ((tapReroll || inp.reroll) && Meta.lv('choice') > 0) { G.rerollOffer(); return; }
  if (inp.tap) {
    const i = cardAt(inp.tap);
    if (i >= 0 && i !== o.sel) { o.sel = i; o.hold = 0; Sfx.pickup(); }
  }
  const axis = L.horiz ? inp.mx : inp.my;
  const dir = axis > 0.5 ? 1 : axis < -0.5 ? -1 : 0;
  if (inp.lb || inp.rb) { o.sel = (o.sel + (inp.rb ? 1 : -1) + o.cards.length) % o.cards.length; o.hold = 0; Sfx.pickup(); }
  if (dir && dir !== o.axis) { o.sel = (o.sel + dir + o.cards.length) % o.cards.length; o.hold = 0; Sfx.pickup(); }
  o.axis = dir;

  let holding = inp.attackHeld || inp.padA; // 패드는 A를 길게 눌러도 선택
  for (const pt of Input.pointers.values()) if (cardAt(pt) === o.sel) holding = true;
  if (holding) {
    o.hold += dt;
    if (o.hold >= BOON_HOLD) G.chooseBoon(o.sel);
  } else o.hold = Math.max(0, o.hold - dt * 3);
}

function drawPauseScreen(big, blink, tap) {
  overlay(0.78);
  label('일시정지', W / 2, inset.t + 26, big * 0.55);
  const owned = BOONS.filter(b => G.boons[b.id]);
  const two = W >= 700;
  const leftCx = two ? W * 0.27 : W / 2;
  label('기술', leftCx, inset.t + 58, 14, '#ffd24a', 'center', '800');
  const end = drawMoveList(inset.t + 80, leftCx, true);
  if (two) {
    const x0 = W * 0.52, maxW = W * 0.44;
    label(`정령의 축복 (${owned.length})`, x0, inset.t + 58, 14, '#e8ff9c', 'left', '800');
    let y = inset.t + 80;
    if (!owned.length) label('봉인석을 부수면 축복을 받을 수 있어요', x0, y, 12, '#aab', 'left', '500');
    for (const b of owned) {
      if (y > H - 50) { label('…', x0, y, 12, '#aab', 'left'); break; }
      const lv = G.boons[b.id];
      label(`${boonIcon(b)} ${b.name} Lv${lv}`, x0, y, 13, boonColor(b), 'left', '700');
      const lines = wrap(b.desc(lv), maxW, 11, '500');
      lines.forEach((l, k) => label(l, x0, y + 15 + k * 14, 11, '#ccd', 'left', '500'));
      y += 22 + lines.length * 14;
    }
  } else if (owned.length) {
    const names = owned.map(b => `${boonIcon(b)}${b.name}${G.boons[b.id] > 1 ? G.boons[b.id] : ''}`).join('  ');
    wrap(names, W - 40, 12).forEach((l, k) => label(l, W / 2, end + 10 + k * 16, 12, '#e8ff9c', 'center', '600'));
  }
  if (blink) label(`${tap} 계속`, W / 2, H - inset.b - 18, 15, '#ffd24a');
}

// ── 마을: 영구 강화 ───────────────────────────────────────
// 탭 0: 공통 강화 + (아래에) 장착한 무기의 숙련
// 탭 1: 무기 해금 · 선택
const V_ROW = 38, V_HEAD = 30;

function villageItems(tab) {
  const md = Meta.data;
  if (tab === 0) {
    const list = UPGRADES.map(u => ({
      key: u.id, name: u.name, desc: u.desc, max: u.max,
      lv: () => Meta.lv(u.id), cost: () => Meta.nextCost(u), buy: () => Meta.buy(u),
    }));
    const wid = md.weapon, W0 = WEAPONS[wid];
    list.push({ header: true, name: `⚔ 무기 숙련 · ${W0.name}  (${W0.essence} ${Meta.ess(wid)})` });
    for (const m of W0.mastery) list.push({
      key: wid + '.' + m.id, name: m.name, desc: m.desc, max: m.max, essence: wid,
      lv: () => Meta.wlv(wid, m.id), cost: () => Meta.wNextCost(wid, m), buy: () => Meta.buyMastery(wid, m),
    });
    return list;
  }
  const list = WEAPON_ORDER.map(id => {
    const W0 = WEAPONS[id], m = W0.moves;
    return { key: 'w.' + id, weapon: id, name: W0.name,
      desc: () => `${W0.style}  |  ${m.basic} · ${m.charged} · ${m.special}`,
      owned: md.unlocked.includes(id), unlockCost: W0.unlockCost || 0 };
  });
  for (const u of UPCOMING_WEAPONS) {
    list.push({ key: 'next', name: `🔒 ${u.name}`, desc: () => `준비 중 · 해금: 영웅의 증표 ${u.cost}개`, locked: true });
  }
  return list;
}

function villageLayout() {
  const v = G.village, items = villageItems(v.tab);
  const rw = Math.min(W - 32 - inset.l - inset.r, 660), x0 = (W - rw) / 2;
  const view = { x: x0, y: inset.t + 92, w: rw, h: H - inset.b - 68 - (inset.t + 92) };
  let y = 0;
  const rows = items.map(it => {
    const h = it.header ? V_HEAD : V_ROW;
    const r = { x: x0, y: view.y + y - v.scroll, w: rw, h: h - 4, it, top: y };
    y += h;
    return r;
  });
  const contentH = y;
  const tw = rw / 2;
  const tabs = [0, 1].map(i => ({ x: x0 + i * tw, y: inset.t + 58, w: tw - 4, h: 28 }));
  const start = { x: W / 2 - 110, y: H - inset.b - 48, w: 220, h: 38 };
  const mode = { x: start.x - 152, y: start.y, w: 140, h: 38 };
  const tier = { x: start.x + start.w + 12, y: start.y, w: 132, h: 38 };
  return { rows, tabs, start, mode, tier, items, view, maxScroll: Math.max(0, contentH - view.h) };
}

function drawVillage(blink) {
  const v = G.village, L = villageLayout(), md = Meta.data;
  overlay(0.7);
  label('숲 마을 · 정령의 제단', W / 2, inset.t + 20, 22, '#ffe08a', 'center', '900');
  label(`◆ 정령의 조각 ${md.shards}    ⚔ ${WEAPONS[md.weapon].essence} ${Meta.ess(md.weapon)}    ✦ 영웅의 증표 ${md.emblems}`, W / 2, inset.t + 43, 13, '#c8a0ff', 'center', '800');
  label(`런 ${md.runs}회 · 최고 ${md.best ? stageLabel(md.best) : '-'}${md.bestEasy ? ` (쉬움 ${stageLabel(md.bestEasy)})` : ''}${md.clears ? ` · 클리어 ${md.clears}회` : ''}`, W - inset.r - 16, inset.t + 20, 11, '#aab', 'right', '600');
  drawPortrait(ctx, 'lumi', inset.l + 34, inset.t + 32, 40);
  ['공통 강화', '무기 해금 · 선택'].forEach((name, i) => {
    const t = L.tabs[i], on = v.tab === i;
    ctx.fillStyle = on ? 'rgba(106,63,176,0.9)' : 'rgba(30,34,44,0.85)';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    label(name, t.x + t.w / 2, t.y + t.h / 2, 13, on ? '#fff' : '#99a', 'center', '800');
  });
  // 목록 (스크롤 영역)
  ctx.save();
  ctx.beginPath(); ctx.rect(L.view.x - 2, L.view.y - 2, L.view.w + 4, L.view.h + 4); ctx.clip();
  L.rows.forEach((r, i) => {
    if (r.y + r.h < L.view.y - 4 || r.y > L.view.y + L.view.h + 4) return;
    const it = r.it, sel = v.sel === i;
    if (it.header) {
      label(it.name, r.x + 4, r.y + r.h / 2 + 2, 13, '#ffd24a', 'left', '800');
      ctx.fillStyle = 'rgba(255,210,74,0.35)'; ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      return;
    }
    ctx.fillStyle = sel ? 'rgba(60,70,90,0.9)' : 'rgba(20,26,34,0.85)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (v.flash[it.key] > 0) { ctx.fillStyle = `rgba(200,160,255,${v.flash[it.key]})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
    label(it.name, r.x + 12, r.y + r.h * 0.32, 13, it.locked ? '#99a' : '#fff', 'left', '800');
    const bx = r.x + r.w - 92, bw = 84;
    let btn, bcol, tcol;
    if (it.weapon !== undefined || it.locked) {
      // 무기 탭
      label(it.desc(), r.x + 12, r.y + r.h * 0.74, 10.5, '#b8c0cc', 'left', '500');
      const using = it.weapon === md.weapon, buy = !it.locked && !it.owned, can = buy && md.emblems >= it.unlockCost;
      btn = it.locked ? '준비 중' : buy ? `✦ ${it.unlockCost} 해금` : using ? '✓ 장착됨' : '장착하기';
      bcol = it.locked ? 'rgba(80,70,40,0.7)' : buy ? (can ? '#9a7a1a' : 'rgba(80,80,90,0.7)') : using ? 'rgba(63,138,59,0.9)' : '#6a3fb0';
      tcol = it.locked ? '#cbb' : '#fff';
    } else {
      const have = it.essence ? Meta.ess(it.essence) : md.shards, icon = it.essence ? '⚔' : '◆';
      const lv = it.lv(), cost = it.cost(), can = cost !== null && have >= cost;
      const desc = (lv < it.max ? '다음: ' : '') + it.desc(Math.max(1, lv + (lv < it.max ? 1 : 0)));
      label(desc, r.x + 12, r.y + r.h * 0.74, 10.5, '#b8c0cc', 'left', '500');
      for (let k = 0; k < it.max; k++) {
        ctx.fillStyle = k < lv ? '#c8a0ff' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(r.x + r.w - 104 - (it.max - k) * 11, r.y + r.h / 2 - 4, 8, 8);
      }
      btn = cost === null ? 'MAX' : `${icon} ${cost}`;
      bcol = cost === null ? 'rgba(255,255,255,0.08)' : can ? (it.essence ? '#9a6a1a' : '#6a3fb0') : 'rgba(80,80,90,0.7)';
      tcol = cost === null ? '#888' : can ? '#fff' : '#999';
    }
    ctx.fillStyle = bcol; ctx.fillRect(bx, r.y + 3, bw, r.h - 6);
    label(btn, bx + bw / 2, r.y + r.h / 2, 13, tcol, 'center', '800');
  });
  ctx.restore();
  // 스크롤 막대
  if (L.maxScroll > 0) {
    const total = L.view.h + L.maxScroll, bh = L.view.h * L.view.h / total;
    const by = L.view.y + (L.view.h - bh) * (v.scroll / L.maxScroll);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(L.view.x + L.view.w + 4, L.view.y, 3, L.view.h);
    ctx.fillStyle = 'rgba(200,160,255,0.8)'; ctx.fillRect(L.view.x + L.view.w + 4, by, 3, bh);
  }
  const st = L.start, ssel = v.sel === L.items.length;
  ctx.fillStyle = ssel ? '#3f8a3b' : '#2f6b2f'; ctx.fillRect(st.x, st.y, st.w, st.h);
  ctx.strokeStyle = ssel && blink ? '#ffd24a' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(st.x + 1, st.y + 1, st.w - 2, st.h - 2);
  label('모험 떠나기 ▶', st.x + st.w / 2, st.y + st.h / 2, 16, '#fff', 'center', '900');
  drawGear(villageGear(), G.village && G.village.sel === -1); // 패드 · 키보드로도 고를 수 있다 (목록 맨 위에서 ↑)
  // 난이도 버튼
  const mb = L.mode, msel = v.sel === L.items.length + 1, easy = md.mode === 'easy';
  ctx.fillStyle = easy ? 'rgba(40,110,70,0.95)' : 'rgba(40,46,60,0.95)'; ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
  ctx.strokeStyle = msel && blink ? '#ffd24a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(mb.x + 1, mb.y + 1, mb.w - 2, mb.h - 2);
  drawModeIcon(easy ? 'easy' : 'normal', mb.x + 4, mb.y + 2, 34);
  const mtx = mb.x + 40 + (mb.w - 40) / 2;
  label(`난이도: ${easy ? '쉬움' : '일반'}`, mtx, mb.y + mb.h / 2 - 6, 13, easy ? '#8ff0b0' : '#ffb07a', 'center', '800');
  label(easy ? '받는 피해 1/3' : '눌러서 바꾸기', mtx, mb.y + mb.h / 2 + 9, 9, '#aab', 'center', '600');
  // 봉인 등급 버튼
  const tb = L.tier, tsel = v.sel === L.items.length + 2, ti = tierInfo(md.tier);
  ctx.fillStyle = ti.curses.length ? 'rgba(110,40,60,0.95)' : 'rgba(40,46,60,0.95)'; ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
  ctx.strokeStyle = tsel && blink ? '#ffd24a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(tb.x + 1, tb.y + 1, tb.w - 2, tb.h - 2);
  label(`봉인 등급 ${ti.n}`, tb.x + tb.w / 2, tb.y + tb.h / 2 - 6, 13, '#ffd0e0', 'center', '800');
  const fm = familiarMult(ti.n);
  label(`보상 ×${(ti.rewardMult * fm).toFixed(2)}${fm < 1 ? ' 익숙함' : ''} · 반발 ${ti.curses.length}${playableTiers().length > 1 ? ' ▸' : ''}`, tb.x + tb.w / 2, tb.y + tb.h / 2 + 9, 9, fm < 1 ? '#ff8a7a' : '#aab', 'center', '600');
  const d = Input.state.device;
  const how = d === 'touch' ? '목록은 위아래로 밀어서 스크롤 · 버튼을 탭해서 강화 · ⚙ 설정'
    : d === 'gamepad' ? `${padName(4)} · ${padName(5)} / ←→: 목록에선 탭 전환 · 아래 줄에선 버튼 이동 · B 아래 줄로 · A로 강화 / 장착 / 출발 · 맨 위 ⚙ 또는 ${padName(9)} 설정` : `←→ 탭 / 아래 버튼 · ↑↓ 고르고 Enter(${keyNames().A})로 강화 / 장착 / 출발 · 휠 스크롤 · Esc 설정`;
  label(v.msg || how, W / 2, st.y - 8, 11, v.msg ? '#ff9a7a' : '#aab', 'center', '600');
}

function villageAct(i) {
  const v = G.village, items = villageItems(v.tab);
  if (i === -1) { openSettings('village'); return; } // ⚙ 설정
  if (i === items.length) { G.startRun(); return; }
  if (i === items.length + 2) { // 봉인 등급 바꾸기 (열린 등급을 차례로)
    const list = playableTiers(), k = list.indexOf(Meta.data.tier);
    Meta.data.tier = list[(k + 1) % list.length]; Meta.save();
    const ti = tierInfo(Meta.data.tier);
    v.msg = list.length < 2 ? '바깥 숲을 끝까지 깨면 다음 등급이 열려요'
      : `봉인 등급 ${ti.n} · ${ROUTES[ti.route].name} · 보상 ×${(ti.rewardMult * familiarMult(ti.n)).toFixed(2)}${familiarMult(ti.n) < 1 ? ' (익숙한 숲 ×0.5)' : ''} · ${curseText(ti)}`;
    Sfx.pickup(); return;
  }
  if (i === items.length + 1) { // 난이도 바꾸기
    Meta.data.mode = Meta.data.mode === 'easy' ? 'normal' : 'easy'; Meta.save();
    v.msg = Meta.data.mode === 'easy' ? '쉬움 모드: 받는 피해가 1/3이에요 (보상은 같아요)' : '일반 모드로 바꿨어요';
    Sfx.pickup(); return;
  }
  const it = items[i];
  if (!it || it.header) return;
  if (it.locked) { v.msg = '아직 준비 중인 무기예요'; Sfx.block(); return; }
  if (it.weapon !== undefined) {
    if (!it.owned) {
      if (Meta.data.emblems < it.unlockCost) { v.msg = `영웅의 증표가 ${it.unlockCost}개 필요해요 (최종 보스를 쓰러뜨리면 얻어요)`; Sfx.block(); return; }
      Meta.data.emblems -= it.unlockCost; Meta.data.unlocked.push(it.weapon);
      Meta.data.weapon = it.weapon; Meta.save();
      v.flash[it.key] = 0.8; v.msg = `${it.name} 해금! 바로 장착했어요`; Sfx.level();
      return;
    }
    if (Meta.data.weapon === it.weapon) { v.msg = `이미 ${it.name}을(를) 쓰고 있어요`; return; }
    Meta.data.weapon = it.weapon; Meta.save();
    v.flash[it.key] = 0.6; v.msg = `${it.name}(으)로 바꿨어요!`; Sfx.level();
    return;
  }
  if (it.buy()) { v.flash[it.key] = 0.6; v.msg = null; Sfx.level(); }
  else {
    v.msg = it.cost() === null ? '이미 최대 단계예요' : it.essence ? `${WEAPONS[it.essence].essence}가 부족해요 (스테이지와 보스를 깨면 모여요)` : '정령의 조각이 부족해요';
    Sfx.block();
  }
}

// 선택한 줄이 보이도록 스크롤
function villageScrollTo(i) {
  const v = G.village, L = villageLayout(), r = L.rows[i];
  if (!r) return;
  if (r.top < v.scroll) v.scroll = r.top;
  else if (r.top + r.h > v.scroll + L.view.h) v.scroll = r.top + r.h - L.view.h + 4;
  v.scroll = clamp(v.scroll, 0, L.maxScroll);
}

function handleVillageInput(dt, inp) {
  const v = G.village;
  v.t += dt;
  for (const k in v.flash) v.flash[k] = Math.max(0, v.flash[k] - dt);
  if (v.t < 0.5) { Input.wheel = 0; return; }
  if (!v.armed) { if (inp.attackHeld || Input.pointers.size) return; v.armed = true; }
  let L = villageLayout();
  const n = L.items.length;
  const inRect = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
  const selectable = i => i === n || i === n + 1 || i === n + 2 || (L.items[i] && !L.items[i].header);
  const setTab = t => { if (t !== v.tab) { v.tab = t; v.sel = villageItems(t).length; v.scroll = 0; v.msg = null; Sfx.pickup(); } };

  // 휠 스크롤
  if (Input.wheel) { v.scroll = clamp(v.scroll + Input.wheel * 0.6, 0, L.maxScroll); Input.wheel = 0; }

  // 목록 드래그: 누른 채 움직이면 스크롤, 움직이지 않고 떼면 탭
  if (v.drag) {
    const pt = Input.pointers.get(v.drag.id);
    if (pt) {
      const dy = pt.y - v.drag.y;
      if (Math.abs(dy) > 8) v.drag.moved = true;
      if (v.drag.moved) v.scroll = clamp(v.drag.scroll0 - dy, 0, L.maxScroll);
    } else {
      if (!v.drag.moved) {
        const pos = { x: v.drag.x, y: v.drag.y };
        L = villageLayout();
        const i = L.rows.findIndex(r => !r.it.header && inRect(pos, r));
        if (i >= 0) { v.sel = i; if (pos.x >= L.rows[i].x + L.rows[i].w - 96) villageAct(i); }
      }
      v.drag = null;
    }
  }
  if (inp.pause) { openSettings('village'); return; }
  if (inp.tap) {
    if (inRect(inp.tap, villageGear())) { openSettings('village'); return; }
    const ti = L.tabs.findIndex(r => inRect(inp.tap, r));
    if (ti >= 0) { setTab(ti); return; }
    if (inRect(inp.tap, L.start)) { villageAct(n); return; }
    if (inRect(inp.tap, L.mode)) { v.sel = n + 1; villageAct(n + 1); return; }
    if (inRect(inp.tap, L.tier)) { v.sel = n + 2; villageAct(n + 2); return; }
    if (inRect(inp.tap, L.view)) {
      let id = null;
      for (const [pid, pt] of Input.pointers) if (Math.abs(pt.x - inp.tap.x) < 1 && Math.abs(pt.y - inp.tap.y) < 1) id = pid;
      if (id !== null) v.drag = { id, x: inp.tap.x, y: inp.tap.y, scroll0: v.scroll, moved: false };
    }
    return;
  }
  // 아래 버튼 줄: 화면 순서대로 난이도 · 모험 떠나기 · 봉인 등급
  const BAR = [n + 1, n, n + 2], inBar = v.sel >= n;
  const barMove = d => {
    const k = BAR.indexOf(v.sel), nk = k < 0 ? 1 : (k + d + 3) % 3; // 목록에 있었으면 '모험 떠나기'로, 끝에서는 반대쪽 끝으로
    if (BAR[nk] !== v.sel) { v.sel = BAR[nk]; v.msg = null; Sfx.pickup(); }
  };
  // 패드: LB · RB로 아래 버튼 줄을 넘긴다
  // LB · RB 와 ←→ 는 같은 규칙: 목록(또는 ⚙)에 있으면 탭 전환, 아래 버튼 줄에 있으면 버튼 사이 이동
  // 탭을 바꿔도 커서는 새 탭 목록의 첫 줄에 둔다 (계속 LB · RB로 탭을 오갈 수 있게)
  const tabTo = t => {
    if (t === v.tab) return;
    setTab(t);
    const k = villageItems(t).findIndex(it => !it.header);
    if (k >= 0) v.sel = k;
  };
  // B(취소): 위쪽(목록 · ⚙)에 있으면 아래 버튼 줄의 '모험 떠나기'로 내려간다
  if (inp.back && !inBar) { v.sel = n; v.msg = null; Sfx.pickup(); return; }
  const nextTab = d => (v.tab + d + 2) % 2; // 탭도 끝에서 반대쪽 끝으로
  if (inp.lb || inp.rb) { const d = inp.rb ? 1 : -1; if (inBar) barMove(d); else tabTo(nextTab(d)); return; }
  // ←→: 아래 버튼 줄에선 버튼 사이 이동, 목록에선 탭 전환
  const hx = inp.mx > 0.5 ? 1 : inp.mx < -0.5 ? -1 : 0;
  if (hx && hx !== v.axisX) { if (inBar) barMove(hx); else tabTo(nextTab(hx)); }
  v.axisX = hx;
  // ↑↓: 목록 줄 이동. 아래 버튼 줄은 한 줄로 본다 (맨 아래 → 모험 떠나기, 버튼 줄에서 ↑ → 목록 마지막)
  // 순서: ⚙ → 목록 → 아래 버튼 줄 → 다시 ⚙ (길게 누르면 가속, 영역도 계속 넘어간다)
  const vdir = inp.my > 0.5 ? 1 : inp.my < -0.5 ? -1 : 0, dir = axisRepeat(v, vdir, dt);
  if (dir) {
    const rows = []; for (let k = 0; k < n; k++) if (selectable(k)) rows.push(k);
    let i;
    if (v.sel === -1) i = dir > 0 ? (rows.length ? rows[0] : n) : n;
    else if (inBar) i = dir < 0 ? (rows.length ? rows[rows.length - 1] : -1) : -1;
    else {
      const k = rows.indexOf(v.sel) + dir;
      i = k >= rows.length ? n : k < 0 ? -1 : rows[k]; // 목록 끝을 넘으면 모험 떠나기, 맨 위를 넘으면 ⚙ 설정
    }
    if (i !== v.sel) { v.sel = i; v.msg = null; Sfx.pickup(); if (i < n) villageScrollTo(i); }
  }
  v.axis = vdir;
  if (inp.confirm || (inp.attack && Input.state.device !== 'gamepad')) villageAct(v.sel); // 패드는 A로만 선택
}

// 난이도 아이콘 — 쉬움: 윙크하며 메롱하는 킹받는 꼬마 / 일반: 백열하는 지옥불
// 작은 캔버스(24x24)에 그린 뒤 픽셀 그대로 키워서 도트 느낌을 낸다
const MODE_ICON = (() => { const c = document.createElement('canvas'); c.width = c.height = 24; return { c, g: c.getContext('2d') }; })();
function drawModeIcon(kind, x, y, size) {
  const { c, g } = MODE_ICON, t = G.time;
  g.clearRect(0, 0, 24, 24);
  g.lineWidth = 1;
  if (kind === 'easy') {
    const bob = Math.round(Math.abs(Math.sin(t * 10)) * 1.5);   // 낄낄 들썩
    const tilt = Math.sin(t * 5) * 0.12;                         // 고개 까딱
    g.save(); g.translate(12, 13 - bob); g.rotate(tilt); g.translate(-12, -13);
    // 얼굴
    g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(12, 13, 8.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5a3418'; g.stroke();
    // 거꾸로 쓴 빨간 모자 (챙이 뒤로)
    g.fillStyle = '#e83a3a'; g.beginPath(); g.arc(12, 9, 7.5, Math.PI, 0); g.fill();
    g.fillRect(3, 7, 4, 2);
    g.fillStyle = '#fff'; g.fillRect(11, 3, 2, 2);
    // 윙크: 왼쪽은 꽉 감은 >, 오른쪽은 반짝이는 눈
    g.strokeStyle = '#3a2010';
    g.beginPath(); g.moveTo(6, 10); g.lineTo(9, 11.5); g.lineTo(6, 13); g.stroke();
    g.fillStyle = '#3a2010'; g.fillRect(14, 10, 3, 3);
    g.fillStyle = '#fff'; g.fillRect(15, 10, 1, 1);
    // 비웃는 눈썹 (오른쪽만 높이)
    g.beginPath(); g.moveTo(13, 8); g.lineTo(18, 6.5); g.stroke();
    // 볼 터치
    g.fillStyle = '#ff7a8a'; g.fillRect(5, 14, 2, 1); g.fillRect(17, 14, 2, 1);
    // 한쪽으로 쭉 찢어진 썩소 + 이빨 + 흔들리는 메롱
    g.fillStyle = '#6a1010';
    g.beginPath(); g.moveTo(8, 15); g.quadraticCurveTo(13, 20, 19, 14); g.lineTo(18, 16); g.quadraticCurveTo(13, 22, 8, 15); g.fill();
    g.fillStyle = '#fff'; g.fillRect(10, 15, 7, 1);
    const wag = Math.round(Math.sin(t * 14) * 1.5);
    g.fillStyle = '#ff6a8a'; g.fillRect(13 + wag, 17, 3, 4); g.fillStyle = '#d84a6a'; g.fillRect(14 + wag, 18, 1, 2);
    g.restore();
    // 화면을 가리키는 손가락 (너 말이야 ㅋ)
    const poke = Math.round(Math.sin(t * 8) * 1);
    g.fillStyle = '#ffd36a'; g.strokeStyle = '#5a3418';
    g.fillRect(1, 18 + poke, 5, 4); g.strokeRect(1.5, 18.5 + poke, 4, 3);
    g.fillRect(5, 19 + poke, 4, 2); g.strokeRect(5.5, 19.5 + poke, 3, 1);
  } else {
    // 지옥불: 검붉은 겉불 → 빨강 → 주황 → 노랑 → 백열(하양) 속불. 크게 일렁이고 불똥이 튄다
    const flame = (w, h, col, ph, base = 23) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(12 - w, base);
      for (let i = 0; i <= 5; i++) {
        const fx = 12 - w + (2 * w) * i / 5;
        const tip = base - h * (i % 2 ? 0.7 : 1) - Math.sin(t * 15 + i * 1.9 + ph) * 2.2 - Math.sin(t * 7 + i) * 1;
        g.quadraticCurveTo(fx - w / 5, base - h * 0.35, fx, tip);
      }
      g.lineTo(12 + w, base); g.closePath(); g.fill();
    };
    flame(11, 22, '#4a0000', 0);
    flame(10, 19, '#a80a0a', 1);
    flame(8.5, 16, '#ff3010', 2);
    flame(6.5, 12, '#ff8a10', 3);
    flame(4.5, 8, '#ffe03a', 4);
    flame(2.5, 5, '#ffffff', 5);
    // 불길 속 해골 그림자
    const sk = 0.35 + Math.sin(t * 3) * 0.15;
    g.globalAlpha = sk; g.fillStyle = '#3a0000';
    g.fillRect(9, 12, 6, 4); g.fillRect(10, 16, 4, 2);
    g.fillStyle = '#ffe03a'; g.fillRect(10, 13, 1, 1); g.fillRect(13, 13, 1, 1);
    g.globalAlpha = 1;
    // 불똥
    for (let i = 0; i < 6; i++) {
      const k = (t * 1.8 + i / 6) % 1;
      g.fillStyle = k < 0.5 ? '#ffffff' : k < 0.8 ? '#ffd04a' : '#ff5a1a';
      g.fillRect(3 + (i * 7) % 18 + Math.sin(t * 6 + i) * 2, 21 - k * 21, 1, 1);
    }
  }
  const prev = ctx.imageSmoothingEnabled;
  if (kind === 'normal') { // 뜨거운 빛 번짐
    const gr = ctx.createRadialGradient(x + size / 2, y + size * 0.65, 0, x + size / 2, y + size * 0.65, size * 0.7);
    gr.addColorStop(0, `rgba(255,120,30,${0.45 + Math.sin(t * 9) * 0.1})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - size * 0.2, y - size * 0.2, size * 1.4, size * 1.4);
  }
  ctx.imageSmoothingEnabled = false;
  const sx = kind === 'normal' ? Math.sin(t * 40) * size * 0.015 : 0; // 열기로 흔들림
  ctx.drawImage(c, x + sx, y, size, size);
  ctx.imageSmoothingEnabled = prev;
  if (kind === 'easy' && size >= 30) { // 킹받는 ㅋㅋㅋ
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.3 + i * 0.5) % 1;
      ctx.globalAlpha = 1 - k;
      label(i ? 'ㅋㅋㅋ' : 'ㅋㅋ', x + size - 4 + i * 6, y + 8 - k * 12, 10 + i * 2, i ? '#ff9ad0' : '#ffe08a', 'left', '900');
    }
    ctx.globalAlpha = 1;
  }
}

// 결과 화면 보상 내역: 모은 양 × 등급 × 깊이 × 익숙함 = 받은 양
function drawRewardResult(y) {
  const P = G.runParts || G.rewardParts(G.state === 'ending');
  const parts = [`등급 ×${P.tier.toFixed(2)}`, `깊이 ×${P.depth.toFixed(2)}`];
  if (P.fam < 1) parts.push(`익숙한 숲 ×${P.fam}`);
  label(`◆ 정령의 조각 ${G.runShards} → +${G.gotShards ?? Math.round(G.runShards * P.total)}    ⚔ 무기의 정수 ${G.runEssence} → +${G.gotEssence ?? Math.round(G.runEssence * P.total)}`, W / 2, y, 15, '#c8a0ff', 'center', '800');
  label(`보상 ×${P.total.toFixed(2)}  (${parts.join(' · ')})   ·   보유 ◆ ${Meta.data.shards} · ⚔ ${Meta.data.essence}`, W / 2, y + 18, 11, P.fam < 1 ? '#ff9a7a' : '#ccd', 'center', '600');
}

function overlay(alpha) { ctx.fillStyle = `rgba(5,12,5,${alpha})`; ctx.fillRect(0, 0, W, H); }

function drawBanner() {
  const b = G.banner;
  if (!b) return;
  const a = clamp(Math.min(b.t, 0.5) * 2, 0, 1);
  ctx.globalAlpha = a;
  const y = H * 0.3, big = clamp(Math.min(W, H) * 0.075, 22, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y - big, W, big * 2.1);
  label(b.title, W / 2, y - big * 0.15, big, '#ffe08a');
  label(b.sub, W / 2, y + big * 0.7, 13, '#e8e8e8', 'center', '600');
  ctx.globalAlpha = 1;
}

function drawHint() {
  const h = G.hintBox;
  if (!h) return;
  const maxW = Math.min(W * 0.6, 500);
  const lines = wrap(h.text, maxW - 52, 13);
  const top = inset.t + (G.boss && !G.boss.dead ? 58 : 42);
  const bh = Math.max(40, lines.length * 18 + 14), bx = W / 2 - maxW / 2;
  ctx.globalAlpha = clamp(h.t, 0, 1);
  ctx.fillStyle = 'rgba(12,24,18,0.82)';
  ctx.fillRect(bx, top, maxW, bh);
  drawPortrait(ctx, 'lumi', bx + 20, top + bh / 2, 30);
  lines.forEach((l, i) => label(l, bx + 42, top + 16 + i * 18, 13, '#fff', 'left', '600'));
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = World.pal.bg; ctx.fillRect(0, 0, W, H);
  drawWorld();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textBaseline = 'middle';

  if (G.boss && !G.boss.dead && G.boss.kind === 2 && G.boss.enraged) { // 숲의 군주 격노: 숲이 시든다
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.55);
    gr.addColorStop(0, 'rgba(30,0,10,0)'); gr.addColorStop(1, 'rgba(30,0,10,0.6)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (World.pal === PALETTES[3]) { // 안개 늪: 가장자리에 짙은 안개, 천천히 흐른다
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62);
    gr.addColorStop(0, 'rgba(190,230,220,0)'); gr.addColorStop(1, 'rgba(190,230,220,0.5)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(210,240,230,0.07)';
    for (let i = 0; i < 4; i++) { const yy = ((G.time * 8 + i * H / 4) % (H + 80)) - 40; ctx.fillRect(0, yy, W, 26 + i * 6); }
  }
  if (World.pal === PALETTES[2]) { // 어둠의 숲: 시야를 좁힌다
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.65);
    gr.addColorStop(0, 'rgba(0,0,10,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (G.hurtFlash > 0) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,30,30,${G.hurtFlash * 1.2})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (G.slowT > 0) { ctx.fillStyle = `rgba(127,224,255,${Math.min(0.12, G.slowT * 0.2)})`; ctx.fillRect(0, 0, W, H); }

  const blink = Math.sin(G.time * 4) > -0.2;
  const big = clamp(Math.min(W, H) * 0.1, 28, 54);
  const tap = Input.state.device === 'touch' ? '화면을 탭해서' : '아무 버튼이나 눌러서';
  if (G.state === 'title') {
    overlay(0.5);
    label('봉인의 숲', W / 2, H * 0.2, big, '#ffe08a');
    const story = '마물에게 습격당한 숲 마을. 견습 검사 리안은 숲의 정령 루미와 함께 봉인석의 비밀을 쫓는다.';
    wrap(story, Math.min(W * 0.8, 560), 14, '500').forEach((l, i) => label(l, W / 2, H * 0.2 + big * 0.9 + i * 20, 14, '#d8e8d0', 'center', '500'));
    const md = Meta.data;
    label(`로그라이트 · 쓰러지면 처음부터 · 정령의 조각으로 영구 강화${md.best ? `   (최고 기록: ${stageLabel(md.best)})` : ''}${md.bestEasy ? `  (쉬움: ${stageLabel(md.bestEasy)})` : ''}`, W / 2, H * 0.45, 12, '#c8b8ff', 'center', '600');
    label(`봉인 등급 ${md.tier} · ${ROUTES[tierInfo(md.tier).route].name}   ·   난이도: ${md.mode === 'easy' ? '쉬움 (받는 피해 1/3)' : '일반'}  ·  마을에서 바꿀 수 있어요`, W / 2, H * 0.45 + 18, 12, md.mode === 'easy' ? '#8ff0b0' : '#aab', 'center', '600');
    const { move, A, P, D } = keyNames();
    label(`이동: ${move}   공격: ${A} (길게: ${WEAPONS[Meta.data.weapon].moves.charged})   대시: ${D}   특수: ${P}`, W / 2, H * 0.56, 13, '#fff', 'center', '600');
    if (Input.state.device === 'keyboard') label(`조작 방식: ${Input.settings.kbMode === 'mouse' ? '키보드+마우스' : '키보드만'}  ·  마을의 ⚙ 설정 > 키보드에서 바꿀 수 있어요`, W / 2, H * 0.56 + 38, 11, '#9aa', 'center', '500');
    label('봉인석의 정령에게 축복을 받고, 스테이지를 넘을 때마다 정령의 힘으로 강해지세요', W / 2, H * 0.56 + 20, 12, '#b8c8b8', 'center', '500');
    if (blink) label(`${tap} 시작`, W / 2, H * 0.78, 20, '#ffd24a');
  } else if (G.state === 'village' || (G.state === 'settings' && G.settingsFrom === 'village')) {
    drawVillage(blink);
  } else if (G.state === 'settings' && G.settingsFrom === 'title') {
    overlay(0.5);
  } else {
    drawHud();
    drawBanner();
    drawHint();
    if (Input.state.device === 'touch' && G.state === 'play') drawTouchControls();
    if (G.state === 'story') drawDialog();
    if (G.state === 'boon') drawBoonScreen();
    drawUiButton(Input.buttons.pause, 'pause');
    drawUiButton(Input.buttons.fullscreen, 'fullscreen');
    if (G.state === 'paused') {
      drawPauseMenu(big, blink, tap);
    } else if (G.state === 'over') {
      overlay(clamp(G.overT, 0, 0.65));
      if (G.overT > 0.5) {
        const p = G.player;
        label('쓰러졌다...', W / 2, H * 0.32, big * 0.85, '#ff8a8a');
        label(`${G.stage}-${G.sub}까지  ·  처치 ${G.runKills}  ·  축복 ${Object.keys(G.boons).length}개`, W / 2, H * 0.45, 15, '#fff', 'center', '600');
        drawRewardResult(H * 0.54);
        if (G.overT > 1.2 && blink) label(`${tap} 마을로 돌아가기`, W / 2, H * 0.7, 17, '#ffd24a');
      }
    } else if (G.state === 'clear' || G.state === 'ending') {
      overlay(clamp(G.clearT, 0, 0.65));
      const t = Math.floor(G.stageTime), p = G.player;
      const stats = `시간 ${Math.floor(t / 60)}분 ${t % 60}초  ·  처치 ${G.stageKills}  ·  최대 ${G.maxChain} HIT`;
      if (G.state === 'clear') {
        label(`세계 ${G.stage} 클리어!`, W / 2, H * 0.3, big * 0.85, '#ffe08a');
        label(stats, W / 2, H * 0.45, 14, '#fff', 'center', '600');
        const rp = G.rewardParts(false);
        label(`이번 런 ◆ ${G.runShards}  ·  ⚔ ${G.runEssence}   (끝까지 가면 보상 ×${(rp.tier * DEPTH_CLEAR_MULT * rp.fam).toFixed(2)})`, W / 2, H * 0.54, 13, '#c8a0ff', 'center', '700');
        if (G.clearT > 1.2 && blink) label(`${tap} 세계 ${G.stage + 1}로 (정령의 힘 · 체력 회복)`, W / 2, H * 0.68, 18, '#ffd24a');
      } else {
        const deep = G.route === 'deep';
        label(deep ? (G.finalWorld < 6 ? '깊은 숲의 봉인을 풀었다!' : '삼룡을 잠재웠다!') : '숲에 평화가 돌아왔다!', W / 2, H * 0.26, big * 0.85, '#ffe08a');
        label(deep ? (G.finalWorld < 6 ? `깊은 숲 세계 ${G.finalWorld}까지 클리어했어요. (세계 ${G.finalWorld + 1}부터는 준비 중)` : '깊은 숲을 모두 클리어했어요!') : '모든 스테이지를 클리어했어요. 축하합니다!', W / 2, H * 0.26 + big * 0.85, 15, '#e8ffd8', 'center', '600');
        label(stats, W / 2, H * 0.48, 13, '#fff', 'center', '600');
        drawRewardResult(H * 0.57);
        const ti = G.tierInfo || tierInfo(1);
        if (G.tierFirst) {
          const reward = G.runEmblems ? `✦ 영웅의 증표 +${G.runEmblems} (보유 ${Meta.data.emblems}) · 새 무기를 해금할 수 있어요` : `◆ 등급 보너스 +${ti.bonusShards}`;
          label(`봉인 등급 ${ti.n} 첫 돌파!  ${reward}`, W / 2, H * 0.57 + 20, 13, '#ffd24a', 'center', '700');
          const nx = tierInfo(ti.n + 1);
          if (ti.n < TIER_MAX) label(ROUTES[nx.route].ready ? `다음 도전: 봉인 등급 ${nx.n} · ${ROUTES[nx.route].name}` : `다음 도전: 봉인 등급 ${nx.n} · ${ROUTES[nx.route].name} (준비 중)`, W / 2, H * 0.57 + 40, 12, '#e8d8ff', 'center', '600');
        } else label(`봉인 등급 ${ti.n} · 이미 깬 등급이라 증표는 없어요`, W / 2, H * 0.57 + 20, 12, '#aab', 'center', '600');
        if (G.clearT > 1.5 && blink) label(`${tap} 마을로 돌아가기`, W / 2, H * 0.7, 17, '#ffd24a');
      }
    }
  }
  if (G.toast) {
    ctx.globalAlpha = clamp(G.toast.t, 0, 1);
    label(G.toast.s, W / 2, H - inset.b - 24, 15, '#fff', 'center', '600');
    ctx.globalAlpha = 1;
  }
  if (G.state === 'settings') drawSettings(blink);
  drawStatusBand();
}

// 휴대폰 상태바(시계) 자리: 게임 화면을 그 안쪽에만 보이게 테두리를 칠한다
function drawStatusBand() {
  if (!statusBand) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const s = statusBand;
  ctx.fillStyle = '#0b120b';
  if (ROTATED) ctx.fillRect(0, 0, s, H); else ctx.fillRect(0, 0, W, s);
  ctx.fillStyle = 'rgba(160,200,120,0.18)'; // 안쪽 경계선
  if (ROTATED) ctx.fillRect(s - 1, 0, 1, H); else ctx.fillRect(0, s - 1, W, 1);
}

// ── 메인 루프 ────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  Input.update();
  layoutButtons();
  const inp = Input.state;
  const slow = G.slowT > 0 ? 0.3 : 1;

  if (G.state === 'title') {
    G.cam.x = World.pw / 2 + Math.cos(G.time * 0.15) * 300;
    G.cam.y = World.ph / 2 + Math.sin(G.time * 0.2) * 200;
    if (inp.start) G.goVillage();
  } else if (G.state === 'play') {
    if (inp.pause) openPause();
    else {
      if (G.player) G.player.bufferInput(inp);
      G.slowT -= dt;
      if (G.hitstop > 0) G.hitstop -= dt;
      else G.update(dt * slow);
    }
  } else if (G.state === 'story') {
    G.dialog.chars += dt * 40;
    if (inp.pause) G.skipDialog();
    else if (inp.start) G.advanceDialog();
  } else if (G.state === 'boon') {
    handleBoonInput(dt, inp);
  } else if (G.state === 'paused') {
    handlePauseInput(dt, inp);
  } else if (G.state === 'settings') {
    handleSettingsInput(dt, inp);
  } else if (G.state === 'over') {
    G.overT += dt;
    if (G.overT > 1.2 && inp.start) G.goVillage();
  } else if (G.state === 'clear' || G.state === 'ending') {
    G.clearT += dt;
    if (G.clearT > 1.2 && inp.start) {
      if (G.state === 'ending') G.goVillage();
      else G.nextStage();
    }
  } else if (G.state === 'village') {
    G.cam.x = World.pw / 2 + Math.cos(G.time * 0.12) * 200;
    G.cam.y = World.ph / 2 + Math.sin(G.time * 0.17) * 140;
    handleVillageInput(dt, inp);
  }
  if (G.state !== 'paused' && G.state !== 'settings' && G.state !== 'story' && G.state !== 'boon') G.updateFx(dt * slow);
  if (G.player && G.state !== 'title' && G.state !== 'village') {
    const k = 1 - Math.pow(0.0001, dt);
    G.cam.x += (G.player.x - G.cam.x) * k;
    G.cam.y += (G.player.y - G.cam.y) * k;
  }
  render();
  requestAnimationFrame(frame);
}

resize();
// 아이폰은 첫 화면 크기·여백을 늦게 알려주는 경우가 있어서 한 번 더 맞춘다
setTimeout(resize, 300);
addEventListener('pageshow', () => setTimeout(resize, 100));
Input.init(canvas);
// 그림 파일을 모두 불러온 뒤 시작한다
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
ctx.fillStyle = '#0f1a0f'; ctx.fillRect(0, 0, W, H);
label('불러오는 중…', W / 2, H / 2, 16, '#ddd', 'center', '600');
Meta.load();
ART.load().then(() => {
  World.generate(12345, 0);
  requestAnimationFrame(t => { last = t; frame(t); });
}).catch(err => {
  ctx.fillStyle = '#0f1a0f'; ctx.fillRect(0, 0, W, H);
  label(err.message, W / 2, H / 2, 14, '#ff8a8a', 'center', '600');
});
