'use strict';
// 게임 루프, 스테이지 진행, 카메라, 화면 표시
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d'); // let: 가상 패드 아이콘을 도트 버퍼에 그릴 때 잠깐 바꿔 낀다 (pixIcon)
const FONT = '"AlkiFairy","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif';
// 알키체를 미리 불러온다 (캔버스는 처음 쓸 때까지 안 불러서 첫 화면이 기본 글꼴로 나온다). 다 오면 제목 글씨 그림을 다시 만든다
if (document.fonts && document.fonts.load) Promise.all([400, 500, 700, 800].map(w => document.fonts.load(w + ' 16px AlkiFairy', '봉인의 숲'))).then(() => { if (typeof TitleArt !== 'undefined') TitleArt.logoKey = ''; }).catch(() => {});
// 세계 3개 × 스테이지 5개. 각 세계의 마지막 스테이지는 보스전.
const FINAL_STAGE = 6;            // 마지막 세계 (한 번의 모험으로 1~6)
const STAGES_PER_WORLD = 5;
const WAVES_PER_STAGE = [2, 2, 3, 3];  // 1~4스테이지의 웨이브 수
const ENEMY_COST = { demon: 2, lantern: 1, statue: 2, babydragon: 1, lion: 1, trex: 2, cyclops2: 2, lizard: 1, kappa: 1, axolot: 1, spider: 1, mollusc: 2, tadpole: 1, fish: 1, moth: 1, slime: 1, bat: 1, mushroom: 1, mole: 1, racoon: 1, bear: 3, snake: 1, owl: 1, shield: 2, skull: 2, eye: 2, flam: 1, orc: 3 }; // 웨이브 구성 점수
const WAVE_SPAWN_GAP = 0.25;           // 웨이브 안에서 마물이 나오는 간격 (초)
const DEEP_SHARD_MULT = 0.6;          // 깊은 숲(세계 4~6): 정령의 조각은 덜
const EASY_DMG_TAKEN = 1 / 3;        // 쉬움 모드: 받는 피해 배율 (1/3)
const WAVE_SIZE_MULT = 1.75;            // 웨이브 규모 (마물 수) 배율
// 회복 하트는 몬스터가 아니라 봉인석을 부술 때만 나온다 (2026-10-17)
const STAGE_DIFF_STEP = 0.2;      // 스테이지마다 적이 강해지는 정도
const stageLabelRaw = idx => `${Math.ceil(idx / STAGES_PER_WORLD)}-${(idx - 1) % STAGES_PER_WORLD + 1}`;
const stageLabel = stageLabelRaw;


// ── 배경음악: 마을 · 세계마다 · 보스 · 엔딩 (Ninja Adventure 음악, CC0). 설정에서 끌 수 있다 ──
// 오래 들어도 덜 피곤하게: 볼륨은 낮게, 곡이 바뀔 땐 천천히 겹쳐 바뀌고, 일시정지 · 설정 화면에선 작게
// 아직 곡을 고르는 중이라 꺼 둔다 (2026-10-16). true 로 바꾸면 배경음악이 나오고, 배포에도 곡 파일이 같이 올라간다.
const MUSIC_ON = true; // 2026-10-17: 사용자가 장면별로 고른 곡 (끄려면 false)
const MUSIC_DIR = 'assets/NinjaAdventure/Audio/Musics/';
const MUSIC = {
  title: '1 - Adventure Begin.ogg', village: '33 - Calm Village.ogg',
  w1: '5 - Peaceful.ogg', w2: '20 - Good Time.ogg', w3: '13 - Mystical.ogg',
  w4: '18 - Aquatic.ogg', w5: '30 - Ruins.ogg', w6: '10 - Dark Castle.ogg',
  boss: '17 - Fight.ogg', ending: '38 - Intro.ogg',
};
// 곡별 부드럽게 처리: rate = 빠르기 (음높이는 그대로), lowpass = 이 주파수 위의 날카로운 소리를 깎는다, warm = 저음 살짝 올리기(dB)
const MUSIC_FX = {
  title: { rate: 0.9, lowpass: 2200, warm: 2, gain: 0.8 },  // 시작 화면: 잔잔하게
};
const MUSIC_VOL = 0.4;    // 기본 볼륨 (효과음보다 뒤에 깔리게)
const MUSIC_FADE = 1.2;   // 새 곡이 커지는 시간 (초)
const MUSIC_FADE_OUT = 0.5; // 앞 곡이 줄어드는 시간: 다 줄어든 뒤에 새 곡을 시작한다 (두 곡이 섞이지 않게, 2026-10-17)
const MUSIC_DUCK = 0.35;  // 일시정지 · 설정 화면에서 볼륨 비율
// 소리 크기는 오디오 그래프의 gain 으로 조절한다 (아이폰은 audio.volume 을 무시해서 곡이 안 줄고 안 멈췄다, 2026-10-17)
// 오디오 그래프는 화면을 누르는 그 순간에 만든다 (안드로이드 크롬은 그 밖에서 만든 그래프를 잠가 둬서 소리가 안 났다)
const Music = (() => {
  const els = {};
  let unlocked = false, ctx = null;
  const unlock = () => {
    unlocked = true;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) { ctx = null; }
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) addEventListener(ev, unlock);
  const el = k => {
    if (els[k]) return els[k];
    const a = els[k] = Object.assign(new Audio(MUSIC_DIR + encodeURIComponent(MUSIC[k])), { loop: true, preload: 'auto' });
    a.vol = 0; // 지금 크기 (0~1). 오디오 그래프가 있으면 gain 으로, 없으면 audio.volume 으로 낸다
    const fx = MUSIC_FX[k];
    if (fx && fx.rate) { a.preservesPitch = true; a.defaultPlaybackRate = a.playbackRate = fx.rate; }
    return a;
  };
  // 곡을 오디오 그래프에 연결: 고음 깎기 · 저음 데우기(있으면) → 크기(gain) → 스피커
  const wire = (k, a) => {
    if (a.wired || !ctx || ctx.state !== 'running') return;
    try {
      const fx = MUSIC_FX[k] || {};
      let node = ctx.createMediaElementSource(a);
      if (fx.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fx.lowpass; f.Q.value = 0.5; node = node.connect(f); }
      if (fx.warm) { const f = ctx.createBiquadFilter(); f.type = 'lowshelf'; f.frequency.value = 250; f.gain.value = fx.warm; node = node.connect(f); }
      a.gainNode = ctx.createGain(); a.gainNode.gain.value = 0; a.fxGain = fx.gain || 1;
      node.connect(a.gainNode).connect(ctx.destination);
      a.volume = 1; // 크기는 이제 gain 이 맡는다
      a.wired = true;
    } catch (_) { a.wired = true; } // 연결 못 하면 audio.volume 으로
  };
  const apply = a => { if (a.gainNode) a.gainNode.gain.value = a.vol * a.fxGain; else a.volume = clamp(a.vol, 0, 1); };
  return {
    current: null, els, // els: 확인용
    update(dt, target, duck) {
      if (!MUSIC_ON) return;
      if (Input.state.device === 'gamepad' && Input.state.start) unlocked = true;
      if (ctx && ctx.state === 'suspended' && unlocked) ctx.resume().catch(() => {});
      const want = Input.settings.bgm && !document.hidden ? target : null;
      this.current = want;
      // 앞 곡이 아직 들리면 새 곡은 기다린다 (겹쳐 들리지 않게)
      const waiting = Object.keys(els).some(k => k !== want && els[k].vol > 0.01);
      for (const k in MUSIC) {
        const on = k === want;
        if (!on && !els[k]) continue;
        const a = el(k);
        const goal = on && !waiting ? MUSIC_VOL * (duck ? MUSIC_DUCK : 1) : 0, step = dt / (on ? MUSIC_FADE : MUSIC_FADE_OUT) * MUSIC_VOL;
        a.vol = clamp(a.vol + clamp(goal - a.vol, -step, step), 0, 1);
        if (on && unlocked) wire(k, a);
        apply(a);
        if (on && !waiting && a.paused && unlocked && !(a.retryT > 0)) { a.retryT = 1; a.play().catch(() => {}); }
        if (a.retryT > 0) a.retryT -= dt;
        if (!on && a.vol <= 0.001 && !a.paused) { a.pause(); a.currentTime = 0; } // 다 작아지면 멈추고 처음으로
      }
    },
    pauseAll() { for (const k in els) els[k].pause(); },
  };
})();
// 적이 바라보는 방향 (그림과 기습 판정이 같이 쓴다): 플레이어 쪽으로 정해진 속도로 돌아본다.
// 공격을 걸고 있으면 그 방향에 고정, 경직 · 넉백 중엔 못 돌아본다 → 대시로 돌아 들어가면 옆 · 뒤를 잡을 수 있다
const ENEMY_TURN = 3.5, BOSS_TURN = 2.5; // 초당 회전(라디안): 180°를 약 0.9초 · 1.3초
function trackHeading(e, x0, y0, dt) {
  if (e.type === 'shield') { e.heading = e.facing; return; }
  const p = G.player, want = Math.atan2(p.y - e.y, p.x - e.x);
  if (e.heading === undefined) { e.heading = want; return; }
  if (e.state === 'lunge' || (e.state === 'windup' && e.st <= 0.2)) { e.heading = e.lungeDir; return; }
  if ((e.state === 'charge' || e.state === 'chargeWind') && e.dir !== undefined) { e.heading = e.dir; return; }
  if (e.kvx || e.kvy || e.stun > 0 || e.frozenT > 0) return;
  const diff = angDiff(want, e.heading), turn = (e.type === 'boss' ? BOSS_TURN : ENEMY_TURN) * dt;
  e.heading += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;
}

// 지금 들려줄 곡
function musicTarget() {
  const st = G.state;
  if (st === 'title' || st === 'profiles' || (st === 'settings' && G.settingsFrom === 'title')) return 'title';
  if (st === 'village' || (st === 'settings' && G.settingsFrom === 'village')) return 'village';
  if (st === 'ending') return 'ending';
  if (st === 'over') return null;
  if (G.boss && !G.boss.dead) return 'boss';
  return 'w' + clamp(G.stage || 1, 1, 6);
}

// 배포 사이트의 시험 빌드는 'swordsman.test.' 에 따로 저장한다 (진짜 진행 · 증표 · 해금은 그대로). 조작 설정은 같이 쓴다 (input.js)
const SAVE_PREFIX = TEST_SAVE ? 'swordsman.test.' : 'swordsman.';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(SAVE_PREFIX + k)); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(SAVE_PREFIX + k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(SAVE_PREFIX + k); } catch (_) {} },
};

// 세계마다 다른 세력. 원거리(투사체) 몬스터 비중이 높다.
const ENEMY_POOLS = [
  [['slime', 30], ['bat', 10], ['mole', 15], ['mushroom', 45]],            // 세계 1 · 슬라임 대왕의 들판
  [['racoon', 25], ['bear', 15], ['snake', 30], ['owl', 30]],              // 세계 2 · 너구리 패거리
  [['shield', 20], ['skull', 25], ['eye', 25], ['flam', 30]],              // 세계 3 · 봉인의 망령들
  [['kappa', 20], ['axolot', 20], ['spider', 20], ['mollusc', 10], ['fish', 15], ['moth', 15]], // 세계 4 · 늪의 주민들 (물고기 · 나방 추가 2026-10-17)
  [['lion', 25], ['trex', 15], ['cyclops2', 30], ['lizard', 30]],          // 세계 5 · 우마왕의 투사들
  [['demon', 25], ['lantern', 25], ['statue', 20], ['babydragon', 30]],    // 세계 6 · 봉인의 수호자들
];
const NEEDS_WATER = ['fish']; // 물이 있는 지도에만 나오는 몬스터
const SPAWN_MIN_FROM_PLAYER = 100; // 웨이브 마물이 생기는 자리: 플레이어와 최소 이만큼 (2026-10-17)
// 웨이브마다 원거리 마물을 이만큼 근접 마물로 바꾼다 (세계 1~6). 봉인 등급 '빗발치는 화살' 반발이면 안 바꾼다 (2026-10-18)
const RANGED_CUT = [2, 3, 4, 5, 5, 6];
const BOSS_MINION = ['slime', 'racoon', 'flam', 'kappa', 'lizard', 'babydragon']; // 보스가 부르는 졸개 · 웨이브 남은 점수 채우기 (1점짜리)
// 루미의 조언: 같은 조언은 한 판에 한 번, 모두 합쳐 이 횟수까지만 (익숙해지면 그만 말한다)
const OWNED_EL_CHANCE = 0.145; // 스테이지를 깨고 나오는 정령: 이 확률로 이미 가진 속성 (2026-10-19 0.6 → 2026-10-20 0.145). 가진 속성 하나면 그 정령 약 25%, 나머지 5종 약 15%씩 (무작위 쪽은 최근 2개를 빼서 실제 확률이 이 값보다 높다)
const HINT_MAX = 1; // 같은 조언은 한 번만 (3 → 1, 너무 자주 나온다는 의견 2026-10-17)
const MONSTER_HINTS = {
  orc: "외눈이는 '!' 표시 뒤에 돌진해요. 부딪히기 직전에 대시해서 피해요!",
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
  fish: "물고기는 물속에 숨어 있다가 '!' 뒤에 뭍으로 튀어나와요. 물가에서 조금 떨어지고, 뭍에서 파닥일 때 잡아요!",
  moth: '나방이 뿌리는 인분은 천천히 따라와요. 맞으면 느려지니 옆으로 크게 피하고, 가까이 붙어서 잡아요!',
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
  spawnT: 0, toast: null, banner: null, hintBox: null, seen: store.get('hints') || {}, runHints: {},
  unlocks: new Set(), dialog: null, lumi: null, lumiHeals: 0,
  runShards: 0, runKills: 0, reviveLeft: 0, rerolls: 0, runEmblems: 0, runEssence: 0, village: null,
  firstWorld: 1, finalWorld: FINAL_STAGE, route: 'all',
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
    this.gotEssence = this.runEssence; // 정수는 처음 넘은 지점에서만 주므로 배율 없이 그대로
    const tn = (this.tierInfo || tierInfo(1)).n;
    Meta.data.essBest[tn] = Math.max(Meta.data.essBest[tn] || 0, this.essRunBest || 0);
    Meta.data.shards += this.gotShards; Meta.data.essence += this.gotEssence;
    Meta.data.totShards += this.gotShards; Meta.data.totEssence += this.gotEssence;
    Meta.save();
  },
  // ── 로그라이트: 런 시작 / 마을 ──
  startRun() {
    if (!tierPlayable(Meta.data.tier)) Meta.data.tier = 1;
    this.tierInfo = tierInfo(Meta.data.tier); this.tier = this.tierInfo.n; this.tierCurses = this.tierInfo.curses;
    Meta.data.runs++; Meta.save(); this.runCommitted = false;
    this.runT = 0; // 모험 진행 시간 (play 상태에서만 흐른다)
    this.runShards = 0; this.runKills = 0; this.runEmblems = 0; this.runEssence = 0; this.essFrac = 0; this.shardFrac = 0; this.essRunBest = 0;
    this.reviveLeft = Meta.lv('revive');
    this.runHints = {}; // 이번 판에 루미가 한 조언
    this.rerolls = Meta.lv('choice');
    const worlds = ROUTES[this.tierInfo.route].worlds;
    this.firstWorld = worlds[0]; this.finalWorld = worlds[worlds.length - 1]; this.route = this.tierInfo.route;
    this.startStage(DEV_BUILD && DEV_BUILD.world || this.firstWorld, 1, Meta.startStats(), true); // 시험 빌드는 정한 세계부터 (?build=swamp)
    this.curseNote = { t: 4.5 }; // 봉인의 반발 안내 (반발이 없으면 안 보인다)
    this.giftPending = Meta.lv('gift') > 0; // 정령의 첫 선물: 첫 스테이지가 열리면 축복 카드 3장 중 하나를 고르게 한다 (2026-10-17)
    if (familiarMult(this.tier) < 1) this.hintBox = { text: '여긴 이제 너무 익숙해요. 정령들이 더 깊은 곳에서 기다려요… (보상 ×0.5)', t: 5 };
  },
  goVillage() {
    Meta.save();
    World.generate((Math.random() * 1e9) | 0, 0);
    this.player = null; this.boss = null; this.enemies = []; this.totems = [];
    this.village = { tab: 0, sel: villageItems(0).length, t: 0, armed: false, axis: 0, axisX: 0, flash: {}, msg: Meta.giftNote || null, scroll: 0, drag: null };
    Meta.giftNote = null;
    this.state = 'village';
  },
  // 무기의 정수 (모든 무기 공통)
  // at: 이 정수를 주는 지점 (스테이지 번호 1~30, 완주 31). 이 등급에서 이미 넘은 지점이면 주지 않는다
  earnEssence(n, x, y, at) {
    if ((this.tierInfo || tierInfo(1)).n > ESSENCE_TIER_MAX) return; // 등급 6 부터는 정수 없음 (각성의 불씨 구간)
    if (at !== undefined) {
      const best = Meta.data.essBest[(this.tierInfo || tierInfo(1)).n] || 0;
      if (at <= best) { if (x !== undefined) this.text(x, y, '⚔ 이미 받음', '#8a8f99', 10, 0.9); return; }
      this.essRunBest = Math.max(this.essRunBest || 0, at);
    }
    if (n <= 0) return;
    this.runEssence += n;
    if (x !== undefined) this.text(x, y, '⚔' + n, '#ffcf6a', 13, 1.2);
  },
  earn(n, x, y) {
    const total = n * SHARD_RATE * (1 + 0.2 * Meta.lv('luck')) * (this.stage >= 4 ? DEEP_SHARD_MULT : 1) + (this.shardFrac || 0);
    const v = Math.floor(total); this.shardFrac = total - v; // 1이 안 되는 몫은 모아 둔다
    if (v <= 0) return;
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
  // 가진 속성 정령이 더 자주 나온다 (2026-10-19, "빌드가 매번 달라 이어 받기 힘들다"는 의견):
  //   OWNED_EL_CHANCE 확률로 이미 축복을 가진 속성 중에서 (아직 더 받을 축복이 남은 것만). 바로 앞 속성은 되도록 피한다
  pickElement() {
    const left = e => BOONS.some(b => b.el === e && !b.mergedInto && (this.boons[b.id] || 0) < boonMaxLv(b));
    const owned = Object.keys(ELEMENTS).filter(e => FX.hasEl(e) && left(e));
    const last = this.recentEls[this.recentEls.length - 1];
    let els = Object.keys(ELEMENTS).filter(e => !this.recentEls.includes(e));
    if (owned.length && Math.random() < OWNED_EL_CHANCE) els = owned.length > 1 ? owned.filter(e => e !== last) : owned;
    const el = els[(Math.random() * els.length) | 0];
    this.recentEls = [...this.recentEls, el].slice(-2);
    return el;
  },
  // upgrade: 보스 보상 — 이미 가진 축복만 (레벨 +1)
  makeOffer(el, upgrade) {
    // 어느 슬롯이든 SLOT_LOCK_LV 이상 키우면 잠긴다 → 다른 속성으로 바꾸는 카드가 안 나온다 (강화 축복도 지켜진다)
    const slotOwner = slot => BOONS.find(o => o.slot === slot && this.boons[o.id]);
    const locked = slot => { const o = slotOwner(slot); return !!o && this.boons[o.id] >= SLOT_LOCK_LV; };
    const ok = b => {
      if (b.mergedInto) return false; // 다른 축복에 합쳐진 축복은 따로 안 나온다
      if ((this.boons[b.id] || 0) >= boonMaxLv(b)) return false;
      if (upgrade && !this.boons[b.id]) return false;
      if (b.slot && !this.boons[b.id] && locked(b.slot)) return false;
      if (b.duo) return b.duo.every(e => FX.hasEl(e)) && (!el || b.duo.includes(el));
      return !b.req || b.req();
    };
    let pool = BOONS.filter(b => ok(b) && (!el || b.el === el || b.duo));
    if (pool.length < 3) pool = pool.concat(BOONS.filter(b => ok(b) && !pool.includes(b)));
    if (upgrade && !pool.length) return this.makeOffer(el); // 키울 축복이 없으면 보통 보상
    const replacing = b => b.slot && !this.boons[b.id] && slotOwner(b.slot);
    const weight = b => (b.duo ? 4 : b.rare ? 0.35 : this.boons[b.id] ? 1.3 : replacing(b) ? REPLACE_WEIGHT : 1);
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
  openBoon(el, then, upgrade) {
    const cards = this.makeOffer(el, upgrade);
    if (!cards.length) { if (then) then(); return; }
    this.offer = { el, cards, sel: 0, t: 0, then, axis: 0, armed: false, hold: 0, upgrade: !!upgrade && cards.every(c => c.lv > 1) };
    this.shake = 0;
    this.state = 'boon';
    Sfx.boon();
  },
  rerollOffer() {
    const o = this.offer;
    if (!o || this.rerolls <= 0) return;
    this.rerolls--;
    o.cards = this.makeOffer(o.el, o.upgrade);
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
    if (sub === 1) this.lumiHeals = 1; // 루미의 위기 회복: 세계마다 1번
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
    if (this.boss && this.boss.state === 'hidden') return null; // 바루 둔갑 중엔 화살표로 알려 주지 않는다 (직접 찾거나 루미가 찾아 준다)
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
    let pool = ENEMY_POOLS[Math.min(this.stage, ENEMY_POOLS.length) - 1];
    if (!World.tiles.includes(T.WATER)) pool = pool.filter(([t]) => !NEEDS_WATER.includes(t)); // 물이 없는 지도엔 물고기가 안 나온다
    let r = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [type, w] of pool) { if ((r -= w) <= 0) return type; }
    return 'slime';
  },

  spawnNear(x, y, minD, maxD, type) {
    if (this.enemies.length >= 24) return;
    const pos = World.findSpawn(x, y, minD, maxD);
    if (pos) this.enemies.push(new Enemy(type || this.pickType(), pos.x, pos.y, this.diff, this.player.lv));
  },

  chainBonus() { return 0; }, // HIT 수에 따른 피해 증가는 없앴다 (2026-10-17). HIT는 세기만 한다

  hint(key, text) {
    if (!this.lumi || this.runHints[key]) return;
    const n = this.seen[key] === true ? 1 : this.seen[key] || 0;
    if (n >= HINT_MAX) return;
    if (this.hintBox && this.hintBox.t > 1.5) return; // 다른 조언을 보여 주는 중이면 다음 기회에
    this.runHints[key] = true; this.seen[key] = n + 1; store.set('hints', this.seen);
    this.hintBox = { text, t: 6 }; // 위쪽 조언 상자 (루미 말풍선은 거슬린다는 의견, 2026-10-17)
  },
  // 플레이어가 맞았을 때: 무엇에 맞았는지 보고 그 대처법을 알려 준다
  hintHurt(src) {
    let type = src && src.type;
    if (!type && src) { // 투사체 · 장판: 그 자리에서 가장 가까운 몬스터 (보스전이면 보스)
      let best = 90;
      for (const e of this.enemies) { const d = Math.hypot(e.x - src.x, e.y - src.y); if (d < best) { best = d; type = e.type; } }
      if (!type && this.boss && !this.boss.dead) type = 'boss';
    }
    if (type === 'boss') this.hint('boss', '보스 공격은 바닥의 빨간 표시를 보고 피해요! 돌진은 벽 쪽으로 유도하면 부딪혀서 기절해요.');
    else if (type && MONSTER_HINTS[type]) this.hint(type, MONSTER_HINTS[type]);
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
      const f = info.kb * (t.heavy ? ((MOVES[info.kind] || {}).shove ? 0.7 : 0.4) : 1); // shove: 방패 밀어치기 · 돌려치기는 무거운 적도 꽤 밀어낸다
      t.kvx = info.nx * f; t.kvy = info.ny * f;
      if (p.weapon.wallSlam && info.kb >= 300 && !t.flying) t.slamT = info.kb >= 500 ? 0.5 : 0.35; // 벽꿍 (창 · 방패). 크게 날린 적은 더 오래 벽꿍 판정
    }
    this.chain++; this.chainT = 2.5; this.chainPulse = 0.15;
    this.maxChain = Math.max(this.maxChain, this.chain);

    const mv = MOVES[info.kind] || {}, big = !mv.light, ranged = !!mv.ranged;
    this.hitstop = Math.max(this.hitstop, ranged ? 0.02 : info.crit || big || info.tip ? 0.065 : 0.04);
    this.shake = Math.max(this.shake, big ? 5 : 3);
    // '반격!' 은 쌍검 받아치기 성공 때만 (2026-10-20 사용자). 저스트 회피 · 저스트 가드 · 잔영 베기의 확정 치명타는 보통 치명타처럼 보인다
    const riposte = info.counter && info.kind === 'riposte';
    const label = riposte ? '반격! ' + dmg : String(dmg);
    this.text(t.x, t.y - t.r - 6, label, riposte ? '#7fe0ff' : info.crit ? '#ffd24a' : info.tip ? '#ffe18a' : '#fff', info.crit ? 16 : info.tip ? 14 : 12);
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
    if (e.elite) this.earn(2, e.x, e.y - 10); // 정예: 정령의 조각 2개 더
    this.burst(e.x, e.y, 14, [e.color, '#fff'], 180);
    Sfx.kill();
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
    this.earnEssence(ESSENCE_STONE[Math.min(this.stage, ESSENCE_STONE.length) - 1][this.sub - 1] || 0, t.x, t.y - 34, (this.stage - 1) * STAGES_PER_WORLD + this.sub);
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
    this.earnEssence(ESSENCE_BOSS[Math.min(this.stage, ESSENCE_BOSS.length) - 1], b.x, b.y - 70, (this.stage - 1) * STAGES_PER_WORLD + this.sub);
    Meta.save();
    this.phase = 'done'; this.clearDelay = 2.2;
  },

  hurtPlayer(dmg, src) {
    const p = this.player;
    if (!p.alive) return;
    if (p.parryT > 0 && src) { p.parry(src); return; } // 쌍검 받아치기
    // 방패 돌진: 정면에서 온 공격은 막는다 (바닥 · 범위 공격과 옆 · 뒤는 못 막는다)
    let chip = 0;
    if (p.guardT > 0 && p.weapon.dashGuard && src && !src.area && p.invuln <= 0 && p.shieldFront(src)) { chip = p.shieldBlock(src); if (!chip) return; dmg = Math.max(1, Math.round(dmg * chip)); } // 저스트면 0, 일반 막기면 일부
    if ((p.dashT > 0 && !p.weapon.dashGuard) || p.invuln > 0) {
      if (src.attacking && p.dodgeT > 0 && this.has('dodge')) this.perfectDodge();
      return;
    }
    dmg = FX.playerHurt(dmg, src);
    if (dmg && Meta.data.mode === 'easy') dmg = Math.max(1, Math.round(dmg * EASY_DMG_TAKEN));
    if (!dmg) return;
    if (p.gapT > 0 && p.gapMult > 0) { dmg = Math.round(dmg * (1 + p.gapMult)); p.gapT = 0; this.text(p.x, p.y - 34, '빈틈 피격!', '#ff7a6a', 11, 0.6); } // 쌍검 받아치기 실패 빈틈: 한 번만
    p.hp -= dmg; p.invuln = p.hurtT = chip ? 0.35 : 0.8;
    this.hintHurt(src);
    if (p.momentum > 0) { p.momentum = 0; this.text(p.x, p.y - 30, '기세 끊김', '#c8b8a8', 10, 0.5); } // 쌍검: 맞으면 기세가 사라진다
    const dx = p.x - src.x, dy = p.y - src.y, d = Math.hypot(dx, dy) || 1;
    p.kvx = dx / d * (chip ? 90 : 220); p.kvy = dy / d * (chip ? 90 : 220);
    if (!chip) { p.act = null; p.charge = 0; this.chain = 0; } // 방패로 막고 받은 피해는 하던 동작을 끊지 않는다
    this.shake = chip ? 3 : 7; this.hurtFlash = chip ? 0.12 : 0.35; this.hitstop = chip ? 0.03 : 0.06;
    this.text(p.x, p.y - 20, '-' + dmg, '#ff6b6b', 14);
    Sfx.hurt(); Input.rumble(0.9, 200);
    if (p.hp > 0 && p.hp < p.maxHp * 0.25 && this.lumiHeals > 0) {
      this.lumiHeals--;
      const bond = Meta.lv('bond');
      const heal = Math.round(p.maxHp * LUMI_HEAL[Math.min(bond, LUMI_HEAL.length - 1)] * (curse('heal') ? 0.5 : 1));
      if (bond >= LUMI_GUARD_LV) p.invuln = Math.max(p.invuln, LUMI_GUARD_T);
      p.hp += heal;
      this.lumi.say('버텨요, 리안! 제 빛을 나눠 줄게요!');
      this.text(p.x, p.y - 30, '+' + heal, '#e8ff9c', 14, 1);
      this.fxRing(p.x, p.y, '#e8ff9c', 50); Sfx.heal();
    }
    if (p.hp <= 0 && this.reviveLeft > 0) {
      this.reviveLeft--;
      p.hp = Math.round(p.maxHp * 0.4); p.invuln = p.hurtT = 2;
      // 루미가 날아와 빛으로 감싸 일으켜 세운다
      const L = this.lumi;
      L.seek(p.x, p.y + 10, 1.0); L.say('리안, 일어나요! 제 빛을 전부 줄게요!', 2.2);
      for (let i = 0; i < 18; i++) { // 루미에게서 플레이어 쪽으로 흘러드는 빛
        const k = i / 18, x = L.x + (p.x - L.x) * k, y = L.y + (p.y - 8 - L.y) * k;
        this.particles.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: (p.x - L.x) * 0.6, vy: (p.y - L.y) * 0.6, life: 0.4 + k * 0.3, max: 0.7, color: i % 2 ? '#e8ff9c' : '#fffbe0', size: 2.5, grav: 0 });
      }
      for (let i = 0; i < 30; i++) { // 몸에서 위로 피어오르는 치유의 빛
        const a = rand(0, Math.PI * 2), r = rand(4, 18);
        this.particles.push({ x: p.x + Math.cos(a) * r, y: p.y + 4 + Math.sin(a) * r * 0.5, vx: rand(-10, 10), vy: rand(-70, -30), life: rand(0.7, 1.2), max: 1.2, color: i % 3 ? '#e8ff9c' : '#ffffff', size: rand(2, 3.5), grav: 0 });
      }
      this.fxRing(p.x, p.y, '#e8ff9c', 50); this.fxRing(p.x, p.y, '#fffbe0', 90);
      this.text(p.x, p.y - 30, '불굴의 의지!', '#e8ff9c', 16, 1.4);
      this.text(p.x, p.y - 46, '+' + p.hp, '#e8ff9c', 14, 1.2);
      this.slowT = 0.8; Sfx.heal(); Sfx.level();
    }
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false; this.commitRun();
      this.state = 'over'; this.overT = 0;
      this.burst(p.x, p.y, 24, ['#3b6fd6', '#f2c9a0', '#fff'], 160);
    }
  },

  perfectDodge() {
    const p = this.player;
    p.dodgeT = 0; p.counterT = 1.8; p.counterAt = G.time; // counterAt: 이보다 먼저 쏜 투사체는 반격을 안 쓴다
    p.invuln = Math.max(p.invuln, 0.5);
    p.skillCd = 0; p.specialCd = 0; p.dashStock = p.dashMax; p.specStock = p.specMax; // 저스트 회피 보상: 쿨타임 초기화
    this.slowT = 0.6;
    this.text(p.x, p.y - 28, '저스트 회피!', '#7fe0ff', 15, 1);
    // 창: 던진 창이 날아가는 중이면 바로 손으로 돌아온다 (쿨타임만 풀려서는 다시 못 던지니까)
    if (p.weapon.orbs) p.orbs = p.orbMax; // 마법봉: 마력 구슬 가득
    if (p.spearOut) { const sh = p.spearShot; sh.done = true; this.burst(sh.x, sh.y, 6, ['#7fe0ff', '#fff'], 90); this.burst(p.x, p.y - 4, 6, ['#7fe0ff', '#fff'], 90); }
    const ready = p.weapon.dodgeText;
    if (ready) this.text(p.x, p.y - 42, ready, '#bfefff', 11, 1);
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
      if (!curse('volley')) this.cutRanged(list);
      this.waves.push(list);
    }
    this.waveIdx = -1; this.waveT = 1.2; this.spawnQueue = [];
  },
  // 원거리 마물 몇 마리를 같은 세계의 근접 마물로 바꾼다 (근접이 없으면 그대로)
  cutRanged(list) {
    let pool = ENEMY_POOLS[Math.min(this.stage, ENEMY_POOLS.length) - 1].filter(([t]) => !ENEMY[t].ranged);
    if (!World.tiles.includes(T.WATER)) pool = pool.filter(([t]) => !NEEDS_WATER.includes(t));
    if (!pool.length) return;
    const total = pool.reduce((s, [, w]) => s + w, 0);
    const melee = () => { let r = Math.random() * total; for (const [t, w] of pool) { if ((r -= w) <= 0) return t; } return pool[0][0]; };
    let n = RANGED_CUT[Math.min(this.stage, RANGED_CUT.length) - 1];
    const idx = list.map((t, i) => (ENEMY[t].ranged ? i : -1)).filter(i => i >= 0);
    while (n-- > 0 && idx.length) { const k = (Math.random() * idx.length) | 0; list[idx[k]] = melee(); idx.splice(k, 1); }
  },
  // 웨이브의 마물은 플레이어에게서 SPAWN_MIN_FROM_PLAYER 이상 떨어진 곳에 나온다
  // 웨이브의 마물은 한꺼번에가 아니라 0.3초 간격으로 차례차례 나온다
  spawnWave(list) {
    const ei = curse('elite') && list.length ? (Math.random() * list.length) | 0 : -1; // 정예의 습격: 웨이브마다 한 마리
    this.spawnQueue = list.map((type, i) => ({ type, t: i * WAVE_SPAWN_GAP, elite: i === ei }));
    Sfx.roar();
  },
  updateSpawnQueue(dt) {
    if (!this.spawnQueue || !this.spawnQueue.length) return;
    const c = this.totems[0] || World.totemSpots[0];
    for (const q of this.spawnQueue) q.t -= dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= 0) {
      const { type, elite } = this.spawnQueue.shift();
      const p = this.player, av = p ? { x: p.x, y: p.y, d: SPAWN_MIN_FROM_PLAYER } : undefined; // 플레이어와 최소 거리 (2026-10-17)
      const pos = World.findSpawn(c.x, c.y, 60, 170, 14, av) || World.findSpawn(c.x, c.y, 40, 300, 14, av) || World.findSpawn(c.x, c.y, 40, 260);
      if (!pos) continue;
      const e = new Enemy(type, pos.x, pos.y, this.diff, this.player.lv);
      if (elite) { e.elite = true; e.maxHp = e.hp = Math.round(e.hp * ELITE_HP); e.r = Math.round(e.r * ELITE_SCALE); e.xp = Math.round(e.xp * 2); }
      this.enemies.push(e);
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
    for (const t of this.totems) {
      if (!t.dead && t.shielded && Math.hypot(t.x - p.x, t.y - p.y) < 70) this.hint('totem', '봉인석은 보호막이 있어서 아직 안 부서져요. 불려 나온 마물을 모두 쓰러뜨리면 보호막이 깨져요!');
    }
  },

  update(dt) {
    const p = this.player;
    this.stageTime += dt;
    if (this.giftPending && this.stageTime > 1.2) { // 정령의 첫 선물: 하늘에서 빛 구슬이 내려와 터진 뒤 카드 고르기
      this.giftPending = false; this.banner = null; // 스테이지 이름 띠는 치우고
      this.giftFx = { t: 0, burst: false };
      this.lumi.say('리안! 정령들이 출발 선물을 보냈어요!');
      Sfx.giftRise();
    }
    if (this.giftFx) { // 연출 동안 싸움은 멈춘다
      const f = this.giftFx; f.t += dt;
      if (Math.random() < 0.6) this.particles.push({ x: p.x + rand(-22, 22), y: p.y - rand(0, 70), vx: 0, vy: -rand(20, 50), life: 0.7, max: 0.7, color: Math.random() < 0.5 ? '#ffd24a' : '#fff', size: 2, grav: 0 });
      if (!f.burst && f.t >= GIFT_FX_DROP) {
        f.burst = true; this.giftFlash = 0.45;
        this.fxRing(p.x, p.y - 20, '#ffffff', 50); this.fxRing(p.x, p.y - 20, '#ffd24a', 110);
        this.burst(p.x, p.y - 20, 40, ['#ffd24a', '#fff', '#ffe08a', '#ff9a3c'], 260);
        this.shake = Math.max(this.shake, 6); Sfx.giftOpen(); Input.rumble(0.6, 200);
      }
      if (f.t >= GIFT_FX_DROP + 0.45) { this.giftFx = null; this.openBoon(null, null); if (this.offer) this.offer.gift = true; }
      return;
    }
    p.update(dt);
    this.lumi.update(dt, p);
    for (const e of this.enemies) { const x0 = e.x, y0 = e.y; e.update(dt, p); trackHeading(e, x0, y0, dt); }
    for (const t of this.totems) if (!t.dead) t.update(dt, p);
    if (this.boss && !this.boss.dead) { const b = this.boss, x0 = b.x, y0 = b.y; b.update(dt, p); trackHeading(b, x0, y0, dt); }
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
            Meta.data.clears++; this.earn(SHARD_ALL_CLEAR);
            const info = this.tierInfo || tierInfo(1);
            { // 무기별 완주 기록: 완주 횟수 · 완주한 가장 높은 봉인 등급 (무기 선택 칸에 보인다, 2026-10-18)
              const wid = this.player.weaponId, ws = Meta.data.wstats[wid] || (Meta.data.wstats[wid] = { clears: 0, best: 0 });
              ws.clears++; ws.best = Math.max(ws.best, info.n);
              const tk = runTimeKey(info.n), times = ws.times || (ws.times = {}), prev = times[tk];
              this.timePrev = prev; this.timeNew = !prev || this.runT < prev; // 신기록?
              if (this.timeNew) times[tk] = Math.round(this.runT * 100) / 100;
            }
            this.tierFirst = !Meta.data.tierCleared[info.n];
            if (this.tierFirst) {
              Meta.data.tierCleared[info.n] = true;
              if (info.emblem) { Meta.data.emblems += EMBLEM_PER_CLEAR; Meta.data.totEmblems += EMBLEM_PER_CLEAR; this.runEmblems += EMBLEM_PER_CLEAR; }
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
        // 세계 보스 보상: 가진 축복 중 하나를 강화 (최종 보스 뒤에는 바로 엔딩)
        const reward = this.stage === this.finalWorld ? done : () => this.openBoon(null, done, true);
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { autoPause(); Music.pauseAll(); } });
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
  if (G.giftFx) drawGiftFx(G.giftFx, G.player);
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

// 부활 하트: 9×8 도트 하트 (검은 테두리 · 흰 반짝임), 남은 횟수는 오른쪽 아래 둥근 배지에 크게
const HEART_PIX = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
function drawReviveHeart(cx, cy, n) {
  const on = n > 0, beat = on ? 1 + Math.max(0, Math.sin(G.time * 5)) * 0.1 : 1;
  const s = 2 * beat, ox = cx - 4.5 * s, oy = cy - 4 * s;
  const cell = (c, r) => ctx.fillRect(Math.round(ox + c * s), Math.round(oy + r * s), Math.ceil(s), Math.ceil(s));
  ctx.fillStyle = on ? '#3a0a14' : 'rgba(20,20,26,0.7)'; // 테두리: 네 방향으로 한 칸씩
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) if (HEART_PIX[r][c] === 'X') for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cell(c + dc, r + dr);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) if (HEART_PIX[r][c] === 'X') {
    ctx.fillStyle = on ? (r >= 5 || (r === 4 && (c === 1 || c === 7)) ? '#d8324a' : '#ff4f68') : 'rgba(140,140,150,0.75)';
    cell(c, r);
  }
  if (on) { ctx.fillStyle = '#ffffff'; cell(1, 1); cell(2, 1); cell(1, 2); }
  if (!on) return;
  const bx = cx + 8, by = cy + 7; // 숫자 배지
  ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.stroke();
  label(String(n), bx, by + 0.5, 11, '#ffffff', 'center', '900');
}
// 최고 기록 키: 봉인 등급 번호 (쉬움 모드는 앞에 e)
const runTimeKey = n => (Meta.data.mode === 'easy' ? 'e' : '') + n;
// 지금 무기 · 지금 봉인 등급의 최고 완주 시간 (없으면 0)
function bestRunT(wid = G.player && G.player.weaponId, n = G.tier) {
  const ws = Meta.data && Meta.data.wstats[wid];
  return (ws && ws.times && ws.times[runTimeKey(n)]) || 0;
}
function fmtRunT(t) {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = Math.floor(t) % 60, cs = Math.floor(t * 100) % 100, p2 = n => String(n).padStart(2, '0');
  return h ? `${h}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}.${p2(cs)}`;
}
function drawHud() {
  const p = G.player;
  const x = inset.l + 16, y = inset.t + 14;
  // 하트 = 남은 부활 (불굴의 의지 · 두 번째 기회). 도트 하트 + 오른쪽 아래 숫자 배지 (2026-10-18 가독성), 없으면 회색
  drawReviveHeart(x + 6, y + 7, G.reviveLeft || 0);
  const bx = x + 22, bw = clamp(W * 0.26, 120, 220);
  bar(bx, y, bw, 13, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5a5a' : '#e04848');
  label(`${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw / 2, y + 7, 10, '#fff', 'center');
  drawCooldowns(p, bx, y + 19, bw);
  drawLumiHeal(x + 6, y + 28);
  if (Meta.data.mode === 'easy') { drawModeIcon('easy', bx + bw + 4, y - 4, 20); label('쉬움', bx + bw + 26, y + 7, 10, '#8ff0b0', 'left', '800'); }
  drawBoonIcons(x, y + 52); // 루미 아이콘 아래로 한 줄 띄운다

  // 목표
  const cxm = W / 2;
  const left = G.totems.filter(t => !t.dead).length, total = G.totems.length;
  const boss = G.boss && !G.boss.dead ? G.boss : null;
  if (G.phase === 'totems') {
    const seal = G.totems[0];
    const goal = seal && seal.shielded ? `웨이브 ${Math.max(1, G.waveIdx + 1)} / ${G.waves.length}` : '봉인석을 부숴라!';
    label(`봉인 등급 ${tierNo(G.tier || 1)} · ${G.stage}-${G.sub}  ·  ${goal}` /* 상태창엔 봉인 등급만 (반발은 일시정지 · 축복 창), 2026-10-17 */, cxm, inset.t + 22, 14, '#e8d8ff', 'center', '700');
  }
  else if (boss) {
    label(boss.name, cxm, inset.t + 20, 14, boss.enraged ? '#ff8a6a' : '#ffe08a', 'center', '700');
    const hudRight = bx + bw + 16;
    const bw2 = Math.max(140, Math.min(420, W - 2 * hudRight));
    bar(cxm - bw2 / 2, inset.t + 32, bw2, 9, boss.hp / boss.maxHp, boss.enraged ? '#ff5a3c' : '#e04848');
  }

  // 모험 진행 시간 (타임어택)
  { const best = bestRunT();
    label('⏱ ' + fmtRunT(G.runT) + (best ? `   최고 ${fmtRunT(best)}` : ''), cxm, inset.t + 52, 12, best && G.runT > best ? '#ffb0a0' : '#d8e4ff', 'center', '700'); } // 최고 기록보다 늦어지면 붉게

  // 연속 타격
  if (G.chain >= 2) {
    const s = 1 + Math.max(0, G.chainPulse) * 2;
    // 축복 아이콘 줄 아래에 (아이콘이 늘어나면 그만큼 내려간다)
    const rows = Math.ceil(BOONS.filter(b => G.boons[b.id]).length / 8);
    const lx = inset.l + 16, ly = inset.t + 66 + Math.max(1, rows) * 27 + 4;
    label(`${G.chain} HIT`, lx, ly, 22 * s, '#ffd24a', 'left', '900');
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

// ── 가상 패드 도트 아이콘 (2026-10-22: 반듯한 선 → 도트 그림 느낌) ──
// 아이콘을 작은 버퍼(한 변 n 도트)에 그리고, 반투명 가장자리를 잘라 도트로 만든 뒤 어두운 1도트 테두리를 둘러 키운다.
const PAD_ICON_N = 22;
const _pib = document.createElement('canvas'), _pibG = _pib.getContext('2d', { willReadFrequently: true });
function pixIcon(b, draw, n = PAD_ICON_N, edgeCol = [14, 16, 24, 200]) { // edgeCol: 1도트 테두리 색 (어두운 무기 그림은 밝은 테두리)
  _pib.width = _pib.height = n; // 크기를 다시 정하면 버퍼가 지워진다
  const g = _pibG, k = n / (2 * b.r);
  g.imageSmoothingEnabled = false; g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = ctx.strokeStyle; g.fillStyle = ctx.fillStyle; g.lineWidth = Math.max(1.6, ctx.lineWidth * k);
  const real = ctx; ctx = g;
  try { draw({ x: n / 2, y: n / 2, r: b.r * k }, g, k); } finally { ctx = real; }
  // 도트로: 반쯤 투명한 가장자리는 잘라내고, 남은 칸은 꽉 채운다. 비어 있고 옆이 찬 칸은 어두운 테두리
  const im = g.getImageData(0, 0, n, n), d = im.data, on = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) on[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, o = i * 4;
    if (on[i]) { d[o + 3] = 255; continue; }
    const edge = (x > 0 && on[i - 1]) || (x < n - 1 && on[i + 1]) || (y > 0 && on[i - n]) || (y < n - 1 && on[i + n]);
    if (edge) { d[o] = edgeCol[0]; d[o + 1] = edgeCol[1]; d[o + 2] = edgeCol[2]; d[o + 3] = edgeCol[3]; } else d[o + 3] = 0;
  }
  g.putImageData(im, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(_pib, Math.round(b.x - b.r), Math.round(b.y - b.r), Math.round(b.r * 2), Math.round(b.r * 2));
  ctx.restore();
}
// 질주하는 사람 (오른쪽으로 달림) + 뒤의 속도선. '#' = 몸, '-' = 속도선
const DASH_RUNNER = [
  '........##...',
  '........##...',
  '.......##....',
  '-----######..',
  '.....#.##..#.',
  '-------##....',
  '......###....',
  '----.##.##...',
  '....##...##..',
  '...##.....#..',
  '..##......##.',
];
function drawRunnerIcon(b, color) {
  const rows = DASH_RUNNER.length, cols = DASH_RUNNER[0].length, g = ctx;
  const x0 = Math.round(b.x - cols / 2), y0 = Math.round(b.y - rows / 2);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = DASH_RUNNER[y][x];
    if (c === '#') { g.globalAlpha = 1; g.fillStyle = color; g.fillRect(x0 + x, y0 + y, 1, 1); }
    else if (c === '-') { g.globalAlpha = 0.6; g.fillStyle = color; g.fillRect(x0 + x, y0 + y, 1, 1); }
  }
  g.globalAlpha = 1;
}
// 공격 버튼: 지금 무기의 도트 그림 (에셋 팩 그림 그대로, 비스듬히)
const PAD_WEAPON_ART = { sword: 'swordIcon', spear: 'spear', sai: 'sai', staff: 'wand', shield: 'shield', bow: 'bow' };
function drawWeaponIcon(b, p) {
  const im = ART.img[PAD_WEAPON_ART[p.weaponId] || 'sword'];
  if (!im || !im.width) return;
  const g = ctx, flat = im.width > im.height * 1.5, round = Math.abs(im.width - im.height) < 3;
  const len = b.r * (round ? 1.15 : 1.55), sc = len / Math.max(im.width, im.height);
  g.save(); g.translate(b.x, b.y); if (!round) g.rotate(flat ? -Math.PI * 0.75 : Math.PI / 4); // 세로 그림은 끝이 오른쪽 위로, 활(가로)은 휜 쪽이 오른쪽 위로
  g.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
  g.restore();
}
function drawButtonBase(b, pressed, color = '#ffffff') {
  const a0 = ctx.globalAlpha, r = pressed ? b.r * 0.95 : b.r; // 누르면 살짝 작아진다
  ctx.save();
  // 바탕: 위가 조금 밝은 어두운 유리알 + 아래 그림자
  ctx.globalAlpha = a0 * (pressed ? 0.85 : 0.6);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  const bg = ctx.createRadialGradient(b.x, b.y - r * 0.45, r * 0.1, b.x, b.y, r);
  bg.addColorStop(0, pressed ? hexA(color, 0.5) : 'rgba(70,80,96,0.95)'); bg.addColorStop(1, 'rgba(10,13,18,0.95)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  // 테두리: 기술 색 (누르면 진하게)
  ctx.globalAlpha = a0 * (pressed ? 1 : 0.85);
  ctx.strokeStyle = hexA(color, pressed ? 1 : 0.75); ctx.lineWidth = pressed ? 3 : 2;
  ctx.beginPath(); ctx.arc(b.x, b.y, r - 1.5, 0, Math.PI * 2); ctx.stroke();
  // 위쪽 반짝임 (유리알 느낌)
  ctx.globalAlpha = a0 * 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(b.x, b.y, r - 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = a0 * (pressed ? 1 : 0.8);
}

function drawCdNumber(b, t) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 2, 0, Math.PI * 2); ctx.fill();
  label(t.toFixed(1), b.x, b.y, Math.max(11, b.r * 0.5), '#fff', 'center', '800');
}

// 키보드·게임패드용 쿨타임 표시 (체력바 아래)
// 루미 회복: 하트 아래 작은 원. 이번 세계에 남아 있으면 빛나고, 쓰면 비어 있다
function drawLumiHeal(cx, cy) {
  const ready = G.lumiHeals > 0, r = 7;
  ctx.fillStyle = 'rgba(20,26,22,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  if (ready) {
    const glow = 0.25 + Math.sin(G.time * 3) * 0.12;
    ctx.fillStyle = `rgba(232,255,156,${glow})`; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = ready ? '#e8ff9c' : 'rgba(232,255,156,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  label('✦', cx, cy + 1, 10, ready ? '#f6ffb0' : 'rgba(246,255,176,0.5)', 'center', '900');
}

function drawCooldowns(p, x, y, w) {
  const items = [
    ['특수', p.specialCdShown > 0 ? 1 - p.specialCdShown / p.specialCdBase : 1, p.specMax > 1 ? p.specStock : null, '#4fc3ff'],
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

// 가상 패드 투명도: 화면을 덜 가리게 (2026-10-17). 누르고 있는 동안은 조금 진하게
// 설정 > 기타 > 가상 패드 투명도 (진하기). 누르고 있는 동안은 +0.25
const PAD_ALPHA_OPTS = [0.3, 0.45, 0.55, 0.7, 0.85, 1];
const padAlpha = held => Math.min(1, (Input.settings.padAlpha ?? 0.55) + (held ? 0.25 : 0));
// fn 안에서 그리는 모든 것에 투명도 k 를 곱한다 (안에서 globalAlpha 를 바꿔도 그 값 × k)
function withAlpha(k, fn) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
  Object.defineProperty(ctx, 'globalAlpha', { configurable: true, get() { return d.get.call(ctx) / k; }, set(v) { d.set.call(ctx, v * k); } });
  ctx.globalAlpha = 1;
  try { fn(); } finally { delete ctx.globalAlpha; ctx.globalAlpha = 1; }
}
function drawTouchControls() {
  const j = Input.joy, B = Input.buttons, p = G.player;
  const active = j.id !== null;
  const ox = active ? j.ox : inset.l + 40 + j.radius, oy = active ? j.oy : H - inset.b - 40 - j.radius;
  const ja = ctx.globalAlpha;
  ctx.globalAlpha = ja * (active ? 0.6 : 0.32);
  const jb = ctx.createRadialGradient(ox, oy, j.radius * 0.2, ox, oy, j.radius);
  jb.addColorStop(0, 'rgba(10,13,18,0.5)'); jb.addColorStop(1, 'rgba(10,13,18,0.9)');
  ctx.fillStyle = jb; ctx.beginPath(); ctx.arc(ox, oy, j.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; // 방향 눈금 (작은 삼각형 4개)
  for (let k = 0; k < 4; k++) {
    const an = k * Math.PI / 2, rr = j.radius * 0.8, t = j.radius * 0.09;
    const cx = ox + Math.cos(an) * rr, cy = oy + Math.sin(an) * rr;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * t, cy + Math.sin(an) * t);
    ctx.lineTo(cx + Math.cos(an + 2.2) * t, cy + Math.sin(an + 2.2) * t); ctx.lineTo(cx + Math.cos(an - 2.2) * t, cy + Math.sin(an - 2.2) * t); ctx.fill();
  }
  ctx.globalAlpha = ja * (active ? 0.9 : 0.45);
  const kx = active ? j.x : ox, ky = active ? j.y : oy, kr = j.radius * 0.42;
  const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.35, kr * 0.1, kx, ky, kr);
  kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#b8c2d0');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.globalAlpha = ja;

  ctx.lineCap = 'round';
  // 공격 (큰 버튼)
  const a = B.attack, s = a.r * 0.42;
  drawButtonBase(a, a.held, '#ffd98a');
  if (p.spearOut) ctx.globalAlpha *= 0.35;
  pixIcon(a, bb => drawWeaponIcon(bb, p), 26, [255, 236, 190, 235]); // 지금 무기 도트 그림 + 밝은 테두리 (어두운 버튼 위에서 보이게)
  // 길게 누르는 중: 회전베기 충전 게이지
  if (p.charge > 0) drawArcProgress(a, p.charge, p.charge >= 1 ? '#ffd24a' : 'rgba(255,255,255,0.8)', 5);
  if (p.charge2 > 0) drawArcProgress({ x: a.x, y: a.y, r: a.r + 6 }, p.charge2, '#7fe0ff', 4); // 차지 2단

  // 특수공격 (초승달 검기)
  ctx.globalAlpha = 1;
  padButton(B.special, p.specialCdShown, p.specialCdBase, '#4fc3ff', b => {
    (p.weapon.padIcon || WEAPONS.sword.padIcon)(b, p); // 무기마다 특수 버튼 그림
  }, (p.finisherT > 0 && G.has('triple')) || p.freeSpecialT > 0); // 빛남: 삼연 · 무료 받아치기
  if (p.weapon.padLabel && B.special && B.special.visible) p.weapon.padLabel(B.special, p); // 아이콘 위 숫자 (마법봉 구슬)
  // 전용스킬 (무기에 있을 때만 보인다)
  padButton(B.skill, p.skillCd, p.skillCdBase, '#ffd24a', b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); ctx.stroke();
  });
  // 대시 (이중 화살표)
  const dashCd = p.dashStock > 0 ? 0 : p.dashRecharge;
  padButton(B.dash, dashCd, p.dashCdBase, '#8ff0b0', b => drawRunnerIcon(b, '#8ff0b0')); // 질주하는 사람
  if (p.specMax > 1 && B.special && B.special.visible) drawBadge(B.special.x + B.special.r * 0.62, B.special.y - B.special.r * 0.62, p.specStock, p.freeSpecialT > 0 ? '#ffffff' : p.specStock ? '#4fc3ff' : '#ff9a7a');
  if (p.dashMax > 1 && B.dash && B.dash.visible) drawBadge(B.dash.x + B.dash.r * 0.62, B.dash.y - B.dash.r * 0.62, p.dashStock, p.dashStock ? '#8ff0b0' : '#ff9a7a');
  ctx.globalAlpha = 1;
}

// 쿨타임이 있는 작은 버튼: 쿨타임 중엔 어둡게 + 남은 초
// 버튼 위 남은 횟수 배지 (어두운 원 + 굵은 숫자)
function drawBadge(x, y, n, color) {
  ctx.fillStyle = 'rgba(10,14,18,0.85)'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  label(String(n), x, y + 1, 13, color, 'center', '900');
}

function padButton(b, cd, cdBase, color, icon, glow) {
  if (!b || !b.visible) return;
  drawButtonBase(b, b.held, color);
  ctx.globalAlpha = cd > 0 ? 0.35 : 1;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(3, b.r * 0.12);
  pixIcon(b, icon); // 도트 아이콘 + 어두운 테두리 (풀밭 위에서도 보이게)
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
  { id: 'book', name: '📖 축복 도감' },
  { id: 'settings', name: '설정' },
  { id: 'quit', name: '포기하고 마을로' },
];
function openPause() {
  G.state = 'paused';
  G.pm = { sel: 0, view: 'menu', axis: 0, t: 0, qsel: 1 };
}
function pauseLayout() {
  // 아래쪽에 반발 줄 · 안내 줄 자리를 남기고, 좁은 화면에선 버튼을 낮춘다 (2026-10-17)
  const n = PAUSE_ITEMS.length, curseN = G.tierInfo ? wrap(curseLineText(), Math.min(W - 40, 760), 11, '600').length : 0;
  const bottom = H - inset.b - 30 - curseN * 15 - 6, top = inset.t + 70;
  const gap = 10, h = clamp(((bottom - top) - gap * (n - 1)) / n, 30, 42), w = Math.min(320, W - 40);
  const y0 = Math.max(top, Math.min(H / 2 - (n * (h + gap)) / 2 + 20, bottom - n * (h + gap) + gap));
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
  if (G.book) { handleBoonBook(dt, inp); return; } // 축복 도감
  const m = G.pm || (G.pm = { sel: 0, view: 'menu', axis: 0, t: 0, qsel: 1 });
  m.t += dt;
  if (m.t < 0.15) return;
  const { dy, dx, rep } = menuAxis(m, inp, dt);
  if (m.view === 'moves') { // 기술 · 축복: 위아래 · 휠 · 끌어서 스크롤, B · Esc · 돌아가기 버튼으로 닫기
    const L = movesLayout();
    const closeIt = () => { m.view = 'menu'; m.drag = null; Sfx.pickup(); };
    if (inp.back || inp.confirm || inp.pause) { closeIt(); return; }
    if (dy) m.scroll = (m.scroll || 0) + dy * 48;
    if (Input.wheel) { m.scroll = (m.scroll || 0) + Input.wheel * 0.6; Input.wheel = 0; }
    if (m.drag) {
      const pt = Input.pointers.get(m.drag.id);
      if (pt) m.scroll = m.drag.scroll0 - (pt.y - m.drag.y);
      else m.drag = null;
    }
    if (inp.tap) {
      if (inRectPt(inp.tap, L.close)) { closeIt(); return; }
      let id = null;
      for (const [pid, pt] of Input.pointers) if (Math.abs(pt.x - inp.tap.x) < 1 && Math.abs(pt.y - inp.tap.y) < 1) id = pid;
      if (id !== null) m.drag = { id, y: inp.tap.y, scroll0: m.scroll || 0 };
    }
    m.scroll = clamp(m.scroll || 0, 0, L.maxScroll);
    return;
  }
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
  else if (id === 'moves') { m.view = 'moves'; m.scroll = 0; m.drag = null; }
  else if (id === 'book') openBoonBook('pause');
  else if (id === 'settings') openSettings('paused');
  else if (id === 'quit') { m.view = 'quit'; m.qsel = 1; }
}

function drawPauseMenu(big, blink, tap) {
  const m = G.pm || { sel: 0, view: 'menu' };
  if (G.book) { drawBoonBook(); return; }
  if (m.view === 'moves') { drawPauseScreen(big, blink, tap); return; }
  overlay(0.6);
  if (m.view === 'quit') {
    label('이번 모험을 포기할까요?', W / 2, H / 2 - 40, 20, '#fff', 'center', '800');
    label(`포기하면 이번 런 보상(◆ ${G.runShards} · ⚔ ${G.runEssence})은 받지 못해요`, W / 2, H / 2 - 10, 13, '#ff9a7a', 'center', '700');
    label('보상은 쓰러지거나 끝까지 깼을 때 받아요', W / 2, H / 2 + 8, 11, '#ccd', 'center', '600');
    quitLayout().forEach((r, i) => {
      const sel = m.qsel === i;
      ctx.fillStyle = sel ? (i ? '#3f8a3b' : '#9a3a2a') : 'rgba(30,36,48,0.95)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
      ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke());
      label(r.name, r.x + r.w / 2, r.y + r.h / 2, 15, '#fff', 'center', '800');
    });
    return;
  }
  label('일시정지', W / 2, pauseLayout()[0].y - 40, big * 0.6, '#ffe08a', 'center', '900');
  if (G.tier) label(`봉인 등급 ${tierNo(G.tier)} · ${G.stage}-${G.sub}${Meta.data.mode === 'easy' ? ' · 쉬움' : ''}`, W / 2, pauseLayout()[0].y - 14, 12, '#ccd', 'center', '600');
  pauseLayout().forEach((r, i) => {
    const sel = m.sel === i;
    ctx.fillStyle = sel ? 'rgba(70,60,110,0.97)' : 'rgba(24,28,40,0.92)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
    ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = sel ? 2 : 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke());
    label((sel ? '▶ ' : '') + r.it.name, r.x + r.w / 2, r.y + r.h / 2, 16, r.it.id === 'quit' ? '#ffb0a0' : '#fff', 'center', '800');
  });
  const d = Input.state.device;
  const how = d === 'touch' ? '항목을 탭하세요' : d === 'gamepad' ? '↑↓ 고르기 · A 결정 · B 돌아가기' : `↑↓ 고르기 · ${menuKeys().ok} 결정 · ${menuKeys().no} 돌아가기`;
  label(how, W / 2, H - inset.b - 18, 12, '#aab', 'center', '600');
  if (G.tierInfo) drawCurseLines(H - inset.b - 38); // 이번 모험의 반발
}

// ── 설정: 키보드 · 게임패드 키 설정, 진동 · 화면 흔들림 ───────
const SETTING_TABS = ['키보드', '게임패드', '기타', '만든 사람'];
// 만든 사람 (크레딧): 외부 에셋은 모두 CC0 — 표시 의무는 없지만 만든 분들께 감사 표시 (2026-10-21)
const CREDITS = [
  ['제작', '웨폰마스터'],
  ['그래픽 · 배경음악', 'Ninja Adventure Asset Pack'],
  ['', 'Pixel-boy · AAA (CC0)  pixel-boy.itch.io'],
  ['방패 그림', 'Things — SnoopethDuckDuck (CC0)'],
  ['효과음', '직접 만든 8비트 소리'],
  ['글꼴', '알키체 (SUIT 기반 · SUNN, SIL OFL 1.1)'],
];
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
  const kd = Input.kbDev(), mouse = kd === 'km';
  if (tab === 0) return [...(Input.phone ? [] : [{ kind: 'mode', name: '조작 방식', value: mouse ? '키보드+마우스' : '키보드만' }]), // 휴대폰은 키보드만 (모드 고르기 없음)
    ...(mouse ? [{ kind: 'toggle', key: 'cursorAim', name: '마우스 조준 (공격이 커서 쪽으로)', value: S.cursorAim ? '켜짐' : '꺼짐' }] : []), ...KB_ACTIONS.filter(([a]) => !(mouse && (a === 'attack' || a === 'special'))).map(([a, n]) => ({ kind: 'key', dev: kd, action: a, name: n, value: B[kd][a].map(kbName).join(' / ') })),
    { kind: 'reset', dev: kd, name: mouse ? '키보드+마우스 기본값으로 되돌리기' : '키보드 기본값으로 되돌리기', value: '' }];
  if (tab === 3) return CREDITS.map(([n, v]) => ({ kind: 'info', name: n, value: v }));
  if (tab === 1) return [{ kind: 'padlayout', name: '패드 레이아웃', value: S.padLayout === 'switch' ? '스위치  ·  A 선택 (오른쪽) · B 취소 (아래)' : 'Xbox  ·  A 선택 (아래) · B 취소 (오른쪽)' }, ...PAD_ACTIONS.map(([a, n]) => ({ kind: 'key', dev: 'pad', action: a, name: n, value: B.pad[a].map(padName).join(' / ') })),
    { kind: 'reset', dev: 'pad', name: '게임패드 기본값으로 되돌리기', value: '' }];
  return [{ kind: 'toggle', key: 'sfx', name: '효과음', value: S.sfx ? '켜짐' : '꺼짐' },
    { kind: 'toggle', key: 'bgm', name: MUSIC_ON ? '배경음악' : '배경음악 (곧 추가돼요)', value: S.bgm ? '켜짐' : '꺼짐' },
    { kind: 'toggle', key: 'rumble', name: '진동 (게임패드 · 휴대폰)', value: S.rumble ? '켜짐' : '꺼짐' },
    { kind: 'toggle', key: 'shake', name: '화면 흔들림', value: S.shake ? '켜짐' : '꺼짐' },
    { kind: 'cycle', key: 'padAlpha', opts: PAD_ALPHA_OPTS, name: '가상 패드 투명도 (터치)', value: Math.round((S.padAlpha ?? 0.55) * 100) + '%  ▸' }];
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
  if (row.kind === 'info') return; // 만든 사람: 보기만
  if (row.kind === 'reset') { Input.resetBinds(row.dev); s.msg = '기본값으로 되돌렸어요'; Sfx.level(); return; }
  if (row.kind === 'toggle') { Input.settings[row.key] = !Input.settings[row.key]; Input.saveSettings(); Sfx.pickup(); return; }
  if (row.kind === 'cycle') { const o = row.opts, k = o.indexOf(Input.settings[row.key]); Input.settings[row.key] = o[(k + 1) % o.length]; Input.saveSettings(); Sfx.pickup(); return; } // 누를 때마다 다음 값
  if (row.kind === 'padlayout') {
    Input.settings.padLayout = Input.settings.padLayout === 'switch' ? 'xbox' : 'switch'; Input.saveSettings(); Sfx.pickup();
    s.msg = Input.settings.padLayout === 'switch' ? '스위치 레이아웃: A 선택 (오른쪽) · B 취소 (아래)' : 'Xbox 레이아웃: A 선택 (아래) · B 취소 (오른쪽)';
    s.t = 0; return;
  }
  if (row.kind === 'mode') {
    Input.settings.kbMode = Input.settings.kbMode === 'mouse' ? 'keys' : 'mouse'; Input.saveSettings(); Sfx.pickup();
    s.msg = Input.settings.kbMode === 'mouse' ? '키보드+마우스: WASD 이동 · 왼쪽 클릭 공격 · 오른쪽 클릭 특수 · Space 대시' : '키보드만: 방향키 이동 · X 공격 · Z 특수 · C 대시';
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
  ctx.fillStyle = 'rgba(40,46,60,0.95)'; (rrPath(b.x, b.y, b.w, b.h, 7), ctx.fill());
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; (rrPath(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 7), ctx.stroke());
  label('← 돌아가기', b.x + b.w / 2, b.y + b.h / 2, 12, '#fff', 'center', '700');
  L.tabs.forEach((r, i) => {
    ctx.fillStyle = i === s.tab ? '#6a3fb0' : 'rgba(40,40,60,0.9)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
    label(SETTING_TABS[i], r.x + r.w / 2, r.y + r.h / 2, 13, '#fff', 'center', '800');
  });
  L.rows.forEach((row, i) => {
    const sel = s.sel === i, r = row.r, waiting = s.waiting === r;
    ctx.fillStyle = waiting ? 'rgba(120,90,20,0.95)' : sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.88)'; (rrPath(row.x, row.y, row.w, row.h, 7), ctx.fill());
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(row.x + 1, row.y + 1, row.w - 2, row.h - 2, 7), ctx.stroke()); }
    label(r.name + (r.kind === 'mode' ? '  (A · Enter로 바꾸기)' : r.kind === 'padlayout' ? '  (A로 바꾸기)' : ''), row.x + 14, row.y + row.h / 2, 13, r.kind === 'reset' ? '#ffb0a0' : r.kind === 'mode' || r.kind === 'padlayout' ? '#ffe08a' : '#fff', 'left', '700');
    const val = waiting ? (blink ? (r.dev === 'kb' ? '새 키를 누르세요… (Esc 취소)' : '새 버튼을 누르세요… (B 취소)') : '') : r.value;
    label(val, row.x + row.w - 14, row.y + row.h / 2, 13, waiting ? '#ffe08a' : r.kind === 'toggle' ? (r.value === '켜짐' ? '#8ff0b0' : '#ff9a7a') : '#c8d8ff', 'right', '800');
  });
  const d = Input.state.device;
  const how = s.msg || (s.tab === 3 ? '멋진 에셋을 나눠 주신 분들께 감사드려요 · ←→ 탭 · 돌아가기' : s.tab === 1 ? '이동은 왼쪽 스틱 · 십자키로 고정이에요' : d === 'touch' ? '키를 바꾸려면 키보드나 게임패드를 연결하세요'
    : d === 'gamepad' ? `${padName(4)} · ${padName(5)} / ←→ 탭 · ↑↓ 고르기 · A 선택 → 바꿀 버튼 누르기 · B 취소/돌아가기 (B는 지정할 수 없어요)` : s.tab === 0 ? (Input.settings.kbMode === 'mouse' ? `키보드+마우스: 왼쪽 클릭 공격 · 오른쪽 클릭 특수 · 조준은 ${Input.settings.cursorAim ? '커서 쪽' : '보는 방향 + 자동 조준'}` : '키보드만: 공격은 보는 방향으로 · 마우스는 메뉴 클릭에만') : `←→ 탭 · ↑↓ 고르기 · ${menuKeys().ok} 바꾸기 · ${menuKeys().no} 돌아가기`);
  label(how, W / 2, H - inset.b - 18, 12, s.msg ? '#ffe08a' : '#aab', 'center', '600');
  if (s.tab === 1) { // 패드 입력 확인: 스틱 · 십자키 · 버튼이 제대로 들어오는지
    const pi = Input.padInfo;
    const arrow = pi ? (pi.ay < -0.5 ? '↑' : pi.ay > 0.5 ? '↓' : '') + (pi.ax < -0.5 ? '←' : pi.ax > 0.5 ? '→' : '') : '';
    label(pi ? `입력 확인 · 방향 ${arrow || '·'}  ·  누른 버튼 ${pi.pressed.length ? pi.pressed.map(i => `${padName(i)}(${i})`).join(' ') : '없음'}${Input.lastKey ? `  ·  키 신호 ${Input.lastKey}` : ''}${pi.mapping === 'standard' ? '' : '  (비표준 배치)'}`
      : '패드가 연결되지 않았어요 · 아무 버튼이나 눌러 보세요', W / 2, H - inset.b - 36, 11, pi ? '#8ff0b0' : '#ff9a7a', 'center', '600');
  }
}

// 마을의 '처음 화면' 버튼 (왼쪽 위, 루미 그림 자리). 패드 · 키보드에선 ⚙ 에서 ← 로 간다 (2026-10-17)
function villageHome() { return { x: inset.l + 12, y: inset.t + 12, w: 96, h: 32 }; }
function drawHome(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.85)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke()); }
  // 프로필 화면의 '← 처음 화면' 버튼과 같은 글씨
  label('← 처음 화면', r.x + r.w / 2, r.y + r.h / 2 + 1, 12, sel ? '#ffd24a' : '#ccd', 'center', '700');
}
// 마을의 '축복 도감' 버튼: ⚙ 왼쪽 (2026-10-18, 탭에서 옮김). 패드 · 키보드: ⚙ 에서 ← 로
function villageBook() { const g = villageGear(); return { x: g.x - 108, y: g.y, w: 100, h: g.h }; }
function drawBookBtn(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.85)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke()); }
  label('📖 축복 도감', r.x + r.w / 2, r.y + r.h / 2 + 1, 12, sel ? '#ffd24a' : '#ccd', 'center', '700');
}
function villageGoTitle() { Meta.save(); G.state = 'title'; G.titleT = 0; G.titleHeard = true; Sfx.pickup(); }

// 마을의 설정 버튼 (톱니)
function villageGear() { return { x: W - inset.r - 46, y: inset.t + 30, w: 34, h: 30 }; }
function drawGear(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(30,36,48,0.9)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke()); }
  label('⚙', r.x + r.w / 2, r.y + r.h / 2 + 1, 16, '#fff', 'center', '700');
  if (sel) label('설정', r.x - 6, r.y + r.h / 2, 12, '#ffe08a', 'right', '800');
}

// 메뉴 선택 · 취소 키 이름 (키보드만 = 공격 키 · 대시 키, 키보드+마우스 = Enter · Esc)
function menuKeys() {
  const B = Input.binds;
  if (Input.settings.kbMode === 'mouse') return { ok: 'Enter', no: 'Esc' };
  return { ok: kbName(B.kb.attack[0] || 'Enter'), no: kbName(B.kb.dash[0] || 'Escape') };
}
function keyNames() {
  const d = Input.state.device, B = Input.binds;
  if (d === 'touch') return { A: '공격', P: '특수', D: '대시', move: '왼쪽 조이스틱' };
  if (d === 'gamepad') return { A: padName(B.pad.attack[0]), P: padName(B.pad.special[0]), D: padName(B.pad.dash[0]), move: '왼쪽 스틱' };
  if (Input.state.mouseMode) return { A: '왼쪽 클릭', P: '오른쪽 클릭', D: kbName(B.km.dash[0]), move: B.km.up.includes('KeyW') && B.km.left.includes('KeyA') ? 'WASD' : kbName(B.km.up[0]) + kbName(B.km.left[0]) + kbName(B.km.down[0]) + kbName(B.km.right[0]) };
  const arrows = B.kb.up.includes('ArrowUp') && B.kb.left.includes('ArrowLeft');
  return { A: kbName(B.kb.attack[0]), P: kbName(B.kb.special[0]), D: kbName(B.kb.dash[0]), move: arrows ? '방향키' : [B.kb.up, B.kb.left, B.kb.down, B.kb.right].map(l => kbName(l[0])).join('') };
}

// 기술표의 조작: 기기(마우스 · 키보드 · 패드)마다 키 이름 대신 버튼 이름으로 (2026-10-18). '공격 버튼 공격 버튼 공격 버튼' → '공격 버튼 3회'
const MOVE_BTN = { A: '공격 버튼', P: '특수 버튼', D: '대시 버튼' };
const btnRepeat = s => s.replace(/(공격 버튼|특수 버튼|대시 버튼)(?: \1)+/g, (m, b) => `${b} ${m.split(b).length - 1}회`);
function moveList() {
  const { A, P, D } = MOVE_BTN;
  const Wp = G.player ? G.player.weapon : WEAPONS[Meta.data.weapon];
  const rows = Wp.rows(A, P, D).map(r => [r[0], btnRepeat(r[1]), r[2], r[3]]);
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
  ctx.fillStyle = 'rgba(10,18,14,0.92)'; (rrPath(bx, by, bw, bh, 7), ctx.fill());
  ctx.strokeStyle = sp.color; ctx.lineWidth = 2; (rrPath(bx + 1, by + 1, bw - 2, bh - 2, 7), ctx.stroke());
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
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; (rrPath(b.x - 34, b.y - 14, 68, 28, 7), ctx.fill());
    label('건너뛰기 ▶', b.x, b.y, 12, '#fff', 'center', '700');
  }
}

// 축복 아이콘: 동작 그림(칼 · 회전 · 검기 · 대시 …)을 속성 색으로 그리고, 오른쪽 아래에 레벨 숫자
// 순서: 슬롯 축복(기본 → 차지 → 특수 → 대시) → 그 강화 → 속성 패시브 → 공격 · 방어 → 듀오
const SLOT_ORDER = { basic: 0, charge: 1, special: 2, dash: 3 };
function boonSortKey(b) {
  if (b.slot) return SLOT_ORDER[b.slot];
  if (b.needs) return 10;
  if (b.duo) return 40;
  if (b.el === 'might') return 30;
  if (b.el === 'guard') return 31;
  return 20;
}
// 동작 · 속성 그림 (cx, cy 중심, s = 반 크기)
function drawBoonGlyph(b, cx, cy, s, col) {
  const g = ctx, Wg = (G.player ? G.player.weapon : WEAPONS[Meta.data.weapon] || WEAPONS.sword).glyph || {};
  g.save(); g.translate(cx, cy); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1.5, s * 0.22); g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1 * s, y1 * s); g.lineTo(x2 * s, y2 * s); g.stroke(); };
  const kind = b.slot || (b.needs ? 'plus' : b.duo ? 'duo' : b.el);
  if (Wg[kind]) Wg[kind](g, s, line); // 무기마다 다른 동작 그림 (기본 · 강화 · 차지 · 특수)
  else if (kind === 'basic' || kind === 'plus') {
    (Wg.basic || WEAPONS.sword.glyph.basic)(g, s, line);
    if (kind === 'plus') { g.lineWidth = Math.max(1.5, s * 0.2); line(0.35, 0.45, 0.85, 0.45); line(0.6, 0.2, 0.6, 0.7); }
  } else if (kind === 'charge' || kind === 'special') {
    WEAPONS.sword.glyph[kind](g, s, line);
  } else if (kind === 'dash') { // 속도선 + 꺾쇠
    line(-0.85, -0.4, -0.25, -0.4); line(-0.95, 0.05, -0.3, 0.05); line(-0.85, 0.5, -0.25, 0.5);
    g.beginPath(); g.moveTo(0.05 * s, -0.6 * s); g.lineTo(0.75 * s, 0.05 * s); g.lineTo(0.05 * s, 0.7 * s); g.stroke();
  } else if (kind === 'fire') { // 불꽃
    g.beginPath(); g.moveTo(0, -0.85 * s); g.quadraticCurveTo(0.75 * s, 0, 0.45 * s, 0.55 * s); g.quadraticCurveTo(0, 0.95 * s, -0.45 * s, 0.55 * s); g.quadraticCurveTo(-0.7 * s, 0.05 * s, 0, -0.85 * s); g.fill();
  } else if (kind === 'frost') { // 눈송이
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; line(Math.cos(a) * -0.8, Math.sin(a) * -0.8, Math.cos(a) * 0.8, Math.sin(a) * 0.8); }
  } else if (kind === 'thunder') { // 번개
    g.beginPath(); g.moveTo(0.2 * s, -0.9 * s); g.lineTo(-0.45 * s, 0.1 * s); g.lineTo(0.05 * s, 0.1 * s); g.lineTo(-0.2 * s, 0.9 * s); g.lineTo(0.5 * s, -0.15 * s); g.lineTo(0, -0.15 * s); g.closePath(); g.fill();
  } else if (kind === 'poison') { // 물방울
    g.beginPath(); g.moveTo(0, -0.9 * s); g.quadraticCurveTo(0.7 * s, 0.1 * s, 0.5 * s, 0.45 * s); g.arc(0, 0.35 * s, 0.5 * s, 0.2, Math.PI - 0.2); g.quadraticCurveTo(-0.7 * s, 0.1 * s, 0, -0.9 * s); g.fill();
  } else if (kind === 'might') { // 엇갈린 두 칼
    line(-0.7, 0.7, 0.7, -0.7); line(0.7, 0.7, -0.7, -0.7); line(-0.75, 0.3, -0.3, 0.75); line(0.75, 0.3, 0.3, 0.75);
  } else if (kind === 'guard') { // 방패
    g.beginPath(); g.moveTo(0, -0.85 * s); g.lineTo(0.7 * s, -0.55 * s); g.lineTo(0.6 * s, 0.25 * s); g.quadraticCurveTo(0.3 * s, 0.7 * s, 0, 0.9 * s); g.quadraticCurveTo(-0.3 * s, 0.7 * s, -0.6 * s, 0.25 * s); g.lineTo(-0.7 * s, -0.55 * s); g.closePath(); g.stroke();
  } else if (kind === 'duo') { // 두 속성 반반 원
    const [a, c] = b.duo.map(e => ELEMENTS[e].color);
    g.fillStyle = a; g.beginPath(); g.arc(0, 0, 0.7 * s, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(0, 0, 0.7 * s, -Math.PI / 2, Math.PI / 2); g.fill();
  }
  g.restore();
}
function drawBoonIcon(b, cx, cy, r, lv) {
  const col = boonColor(b), max = lv >= boonMaxLv(b);
  ctx.fillStyle = 'rgba(10,14,18,0.78)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  drawBoonGlyph(b, cx, cy, r * 0.62, col);
  // 레벨 숫자 (최대면 금색)
  const bx = cx + r * 0.72, by = cy + r * 0.72, br = r * 0.48;
  ctx.fillStyle = max ? '#ffd24a' : '#1a1f28'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = max ? '#fff3c0' : col; ctx.lineWidth = 1; ctx.stroke();
  label(String(lv), bx, by + 0.5, Math.round(br * 1.5), max ? '#3a2a00' : '#fff', 'center', '900');
}
function drawBoonIcons(x, y) {
  const owned = BOONS.filter(b => G.boons[b.id]).sort((a, b) => boonSortKey(a) - boonSortKey(b));
  const r = 11, step = 27, perRow = 8;
  owned.forEach((b, i) => drawBoonIcon(b, x + r + (i % perRow) * step, y + Math.floor(i / perRow) * step, r, G.boons[b.id]));
}

// 강화 카드 설명: 지금 단계와 다음 단계 설명을 비교해 바뀌는 숫자만 '전→후' 로 (예: 피해 +30% → 피해 +30→60%) (2026-10-17)
function boonDescDiff(b, lv) {
  const s0 = b.desc(lv - 1), s1 = b.desc(lv), re = /(-?\d+(?:\.\d+)?)/;
  const t0 = s0.split(re), t1 = s1.split(re);
  if (t0.length !== t1.length) return s1;
  for (let i = 0; i < t0.length; i += 2) if (t0[i] !== t1[i]) return s1; // 숫자 말고 글이 다르면 그대로
  return t1.map((t, i) => (i % 2 && t !== t0[i] ? t0[i] + '→' + t : t)).join('');
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
  L.reroll = { x: W / 2 - 110, y: last.y + last.h + 14, w: 220, h: 34 };
  return L;
}

// 둥근 사각형 경로 (축복 카드, 2026-10-21)
function rrPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// '#rrggbb' → 'rgba(r,g,b,a)'
function hexA(hex, a) { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function drawBoonScreen() {
  const o = G.offer;
  overlay(0.72);
  const head = o.el ? ELEMENTS[o.el] : null;
  const title = o.gift ? '🎁 정령의 첫 선물' : head ? `${head.icon} ${head.spirit}의 축복` : '✦ 보스 격파 보상';
  label(title, W / 2, inset.t + 30, 22, head ? head.color : '#ffd24a', 'center', '900');
  label(o.gift ? '정령들이 보낸 출발 선물이에요. 하나를 골라 모험을 시작하세요' : o.upgrade ? '가진 축복 하나를 강화해요' : '축복을 하나 고르세요', W / 2, inset.t + 56, 13, o.upgrade ? '#8ff0b0' : '#ddd', 'center', '600');
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
    const R = L.horiz ? 12 : 10; // 모서리 둥글기
    ctx.save();
    if (sel) { ctx.shadowColor = hexA(col, 0.7); ctx.shadowBlur = 18; }
    rrPath(x, y, r.w, r.h, R);
    const bg = ctx.createLinearGradient(0, y, 0, y + r.h);
    bg.addColorStop(0, sel ? 'rgba(42,48,60,0.97)' : 'rgba(30,35,44,0.94)'); bg.addColorStop(1, sel ? 'rgba(20,24,32,0.97)' : 'rgba(13,16,22,0.94)');
    ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.clip(); // 속성 색 빛: 가로 카드는 위에서, 세로 카드는 왼쪽에서 번진다
    const gl = L.horiz ? ctx.createLinearGradient(0, y, 0, y + 120) : ctx.createLinearGradient(x, 0, x + 110, 0);
    gl.addColorStop(0, hexA(col, sel ? 0.3 : 0.2)); gl.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = gl; ctx.fillRect(x, y, r.w, r.h);
    ctx.fillStyle = col; if (L.horiz) ctx.fillRect(x, y, r.w, 3); else ctx.fillRect(x, y, 3, r.h); // 속성 색 띠
    ctx.restore();
    rrPath(x + 0.5, y + 0.5, r.w - 1, r.h - 1, R);
    ctx.strokeStyle = sel ? col : 'rgba(255,255,255,0.16)'; ctx.lineWidth = sel ? 2.5 : 1; ctx.stroke();
    rrPath(x + 3.5, y + 3.5, r.w - 7, r.h - 7, R - 3); // 안쪽 얇은 빛선
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    const tag = b.duo ? '듀오 축복' : b.slot ? SLOT_NAMES[b.slot] : b.needs ? `${BOON_BY_ID[b.needs].name} 강화` : b.el === 'might' || b.el === 'guard' ? '누적 패시브' : '패시브';
    const extra = c.replaces ? BOONS.filter(o => o.needs === c.replaces.id && G.boons[o.id]).map(o => ' +' + o.name).join('') : '';
    const status = c.lv > 1 ? `강화 Lv${c.lv - 1} → Lv${c.lv}` : c.replaces ? `교체: ${c.replaces.name}${extra}` : 'NEW';
    const stCol = c.lv > 1 ? '#8ff0b0' : c.replaces ? '#ff9a7a' : '#ffd24a';
    let tx, ty, tw;
    if (L.horiz) {
      ctx.beginPath(); ctx.arc(x + r.w / 2, y + 32, 21, 0, Math.PI * 2); // 아이콘 받침
      ctx.fillStyle = hexA(col, 0.14); ctx.fill(); ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = `24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b), x + r.w / 2, y + 33);
      label(b.name, x + r.w / 2, y + 66, 16, col, 'center', '800');
      label(tag, x + r.w / 2, y + 85, 11, '#aab', 'center', '600');
      ctx.font = `700 11px ${FONT}`; const sw = ctx.measureText(status).width + 16; // 상태 알약
      rrPath(x + r.w / 2 - sw / 2, y + 93, sw, 17, 8.5); ctx.fillStyle = hexA(stCol, 0.14); ctx.fill(); ctx.strokeStyle = hexA(stCol, 0.45); ctx.lineWidth = 1; ctx.stroke();
      label(status, x + r.w / 2, y + 102, 11, stCol, 'center', '700');
      const dv = ctx.createLinearGradient(x + 14, 0, x + r.w - 14, 0); // 구분선 (가운데가 진하게)
      dv.addColorStop(0, hexA(col, 0)); dv.addColorStop(0.5, hexA(col, 0.45)); dv.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = dv; ctx.fillRect(x + 14, y + 117, r.w - 28, 1);
      tx = x + 12; ty = y + 130; tw = r.w - 24;
    } else {
      ctx.beginPath(); ctx.arc(x + 29, y + r.h / 2, 19, 0, Math.PI * 2); // 아이콘 받침
      ctx.fillStyle = hexA(col, 0.14); ctx.fill(); ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b), x + 29, y + r.h / 2 + 1);
      label(b.name, x + 56, y + 18, 15, col, 'left', '800');
      label(`${tag} · ${status}`, x + 56, y + 36, 11, stCol, 'left', '600');
      tx = x + 56; ty = y + 56; tw = r.w - 66;
    }
    const up = c.lv > 1 && !c.replaces; // 강화 카드: 바뀌는 숫자를 '전 → 후' 로
    wrap(up ? boonDescDiff(b, c.lv) : b.desc(c.lv), tw, 12, '500').forEach((l, k) => label(l, tx, ty + k * 16, 12, up ? '#d8ffe0' : '#e8e8e8', 'left', '500'));
    if (o.auto && sel) { // 시간 초과로 고른 카드: 빛나는 테두리 + 퍼지는 빛 + 테두리를 도는 반짝이
      const t = o.auto.t, on = ((t * 14) | 0) % 2 === 0, pulse = 0.5 + 0.5 * Math.sin(t * 28);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.12 * pulse})`; rrPath(x, y, r.w, r.h, R); ctx.fill(); // 카드가 번쩍
      ctx.shadowColor = on ? '#fff' : col; ctx.shadowBlur = 18 + 16 * pulse;                    // 빛 번짐
      ctx.strokeStyle = on ? '#fff' : col; ctx.lineWidth = 5;
      rrPath(x - 3, y - 3, r.w + 6, r.h + 6, R + 3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? col : '#fff'; ctx.lineWidth = 2;
      rrPath(x - 8, y - 8, r.w + 16, r.h + 16, R + 8); ctx.stroke();
      // 바깥으로 퍼지는 빛 테두리 (0.3초마다)
      const k = (t % 0.3) / 0.3, g = 8 + k * 18;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2;
      rrPath(x - g, y - g, r.w + g * 2, r.h + g * 2, R + g); ctx.stroke();
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
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; rrPath(x + 10, y + r.h - 14, r.w - 20, 6, 3); ctx.fill();
      if (k > 0) { ctx.fillStyle = col; rrPath(x + 10, y + r.h - 14, Math.max(6, (r.w - 20) * k), 6, 3); ctx.fill(); }
    }
  });
  ctx.globalAlpha = 1;
  const d = Input.state.device;
  const how = !o.armed ? (o.t < BOON_LOCK ? '…' : '버튼에서 손을 떼 주세요')
    : d === 'touch' ? '카드를 탭해서 고르고, 길게 눌러서 선택'
    : d === 'gamepad' ? `십자키로 고르고 ${keyNames().A}를 길게 눌러서 선택`
    : `← → 로 고르고 ${keyNames().A}를 길게 눌러서 선택`;
  if (!o.auto) label(how + '  ·  시간이 지나면 무작위로 결정', W / 2, H - inset.b - 16, 12, '#ddd', 'center', '600');
  drawCurseLines(H - inset.b - 34); // 이번 모험의 봉인 등급과 반발 (2026-10-17)
  const rb = L.reroll;
  if (rb && Meta.lv('choice') > 0) {
    // 다시 뽑기: 카드와 같은 어두운 판 + 금빛 테두리, 남은 횟수는 마름모, 키는 작은 키캡 (2026-10-17)
    const ok = G.rerolls > 0 && o.armed, cy = rb.y + rb.h / 2;
    ctx.fillStyle = 'rgba(18,22,28,0.94)'; (rrPath(rb.x, rb.y, rb.w, rb.h, 7), ctx.fill());
    ctx.strokeStyle = ok ? 'rgba(255,210,74,0.7)' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; (rrPath(rb.x + 0.5, rb.y + 0.5, rb.w - 1, rb.h - 1, 7), ctx.stroke());
    ctx.fillStyle = ok ? '#ffd24a' : 'rgba(255,255,255,0.15)'; (rrPath(rb.x, rb.y, 3, rb.h, 7), ctx.fill()); // 왼쪽 금빛 띠
    label('↻', rb.x + 20, cy + 1, 17, ok ? '#ffd24a' : '#666', 'center', '900');
    label('다시 뽑기', rb.x + 34, cy + 1, 13, ok ? '#fff' : '#777', 'left', '800');
    // 키캡: 패드 버튼 · 키보드만 쓸 때의 키만. 터치 · 마우스는 버튼을 바로 누르면 되니 안 보인다
    const keyTxt = d === 'gamepad' ? padName(3) : d === 'keyboard' && Input.settings.kbMode !== 'mouse' ? keyNames().P : '';
    let rx = rb.x + rb.w - 10;
    if (keyTxt) { // 키캡
      ctx.font = `700 10px ${FONT}`; const kw = Math.ceil(ctx.measureText(keyTxt).width) + 10;
      rx -= kw; ctx.fillStyle = 'rgba(255,255,255,0.08)'; (rrPath(rx, cy - 9, kw, 18, 7), ctx.fill());
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; (rrPath(rx + 0.5, cy - 8.5, kw - 1, 17, 7), ctx.stroke());
      label(keyTxt, rx + kw / 2, cy + 1, 10, ok ? '#dde' : '#777', 'center', '700');
      rx -= 8;
    }
    const max = Math.max(G.rerolls, Meta.lv('choice'));
    for (let i = max - 1; i >= 0; i--) { // 남은 횟수: 채운 마름모, 쓴 것은 빈 마름모
      const px = rx - 5 - (max - 1 - i) * 13, on = i < G.rerolls;
      ctx.beginPath(); ctx.moveTo(px, cy - 5); ctx.lineTo(px + 5, cy); ctx.lineTo(px, cy + 5); ctx.lineTo(px - 5, cy); ctx.closePath();
      if (on) { ctx.fillStyle = ok ? '#ffd24a' : '#777'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke(); }
    }
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

// 화면에 그릴 줄들: 기술 → 무기 특성 → 정령의 축복
function movesLayout() {
  const cw = Math.min(W - 32 - inset.l - inset.r, 660), x0 = (W - cw) / 2;
  const view = { x: x0, y: inset.t + 52, w: cw, h: H - inset.b - 62 - (inset.t + 52) };
  const close = { x: W / 2 - 90, y: H - inset.b - 50, w: 180, h: 38 };
  const Wp = G.player ? G.player.weapon : WEAPONS[Meta.data.weapon];
  const items = [];
  let y = 0;
  const head = (text, color) => { items.push({ t: 'head', text, color, y }); y += 26; };
  head(`기술 · ${Wp.name}`, '#ffd24a');
  for (const [name, input, desc] of moveList()) {
    const lines = wrap(desc, cw - 16, 11, '500');
    items.push({ t: 'move', name, input, lines, y }); y += 20 + lines.length * 14 + 6;
  }
  if (Wp.notes) {
    y += 6; head(Wp.notesTitle, '#ffb84a');
    for (const n of Wp.notes) { const lines = wrap(n, cw - 22, 12, '500'); items.push({ t: 'note', lines, y }); y += lines.length * 16 + 6; }
  }
  const owned = BOONS.filter(b => G.boons[b.id]);
  y += 6; head(`정령의 축복 (${owned.length})`, '#e8ff9c');
  if (!owned.length) { items.push({ t: 'note', lines: ['봉인석을 부수면 축복을 받을 수 있어요'], y, dim: true }); y += 22; }
  for (const b of owned) {
    const lv = G.boons[b.id], lines = wrap(b.desc(lv), cw - 16, 11, '500');
    items.push({ t: 'boon', b, lv, lines, y }); y += 20 + lines.length * 14 + 8;
  }
  return { view, close, items, maxScroll: Math.max(0, y - view.h + 8) };
}

function drawPauseScreen(big, blink, tap) {
  overlay(0.85);
  const m = G.pm, L = movesLayout(), v = L.view, sc = clamp(m.scroll || 0, 0, L.maxScroll);
  label('기술 · 축복', W / 2, inset.t + 26, 18, '#fff', 'center', '800');
  ctx.save(); ctx.beginPath(); ctx.rect(v.x - 4, v.y, v.w + 8, v.h); ctx.clip();
  for (const it of L.items) {
    const y = v.y + it.y - sc;
    if (y > v.y + v.h + 10 || y + 120 < v.y) continue;
    if (it.t === 'head') {
      label(it.text, v.x, y + 10, 15, it.color, 'left', '800');
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; (rrPath(v.x, y + 20, v.w, 1, 7), ctx.fill());
    } else if (it.t === 'move') {
      label(it.name, v.x + 4, y + 8, 13, '#ffd24a', 'left', '800');
      label(it.input, v.x + v.w - 4, y + 8, 12, '#fff', 'right', '700');
      it.lines.forEach((l, k) => label(l, v.x + 12, y + 24 + k * 14, 11, '#b8c8b8', 'left', '500'));
    } else if (it.t === 'note') {
      it.lines.forEach((l, k) => label((k ? '  ' : '· ') + l, v.x + 6, y + 8 + k * 16, 12, it.dim ? '#aab' : '#f0e0c8', 'left', '600'));
    } else if (it.t === 'boon') {
      const mx = boonMaxLv(it.b), full = it.lv >= mx; // 만렙 표시 (2026-10-17)
      label(`${boonIcon(it.b)} ${it.b.name} Lv${it.lv} / ${mx}${full ? ' · MAX' : ''}`, v.x + 4, y + 8, 13, boonColor(it.b), 'left', '700');
      it.lines.forEach((l, k) => label(l, v.x + 12, y + 24 + k * 14, 11, '#ccd', 'left', '500'));
    }
  }
  ctx.restore();
  // 스크롤 막대
  if (L.maxScroll > 0) {
    const bh = Math.max(30, v.h * v.h / (v.h + L.maxScroll)), by = v.y + (v.h - bh) * (sc / L.maxScroll);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; (rrPath(v.x + v.w + 6, v.y, 4, v.h, 7), ctx.fill());
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; (rrPath(v.x + v.w + 6, by, 4, bh, 7), ctx.fill());
  }
  // 돌아가기 버튼
  const c = L.close, d = Input.state.device;
  ctx.fillStyle = 'rgba(60,70,90,0.95)'; (rrPath(c.x, c.y, c.w, c.h, 7), ctx.fill());
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(c.x + 1, c.y + 1, c.w - 2, c.h - 2, 7), ctx.stroke());
  label(d === 'touch' ? '돌아가기' : d === 'gamepad' ? '돌아가기 (B)' :`돌아가기 (${menuKeys().no})`, W / 2, c.y + c.h / 2 + 1, 14, '#fff', 'center', '800');
  if (L.maxScroll > 0 && d !== 'touch') label('↑↓ 스크롤', v.x + v.w, inset.t + 26, 11, '#aab', 'right', '600');
}

// ── 마을: 영구 강화 ───────────────────────────────────────
// 탭 0: 공통 강화 + (아래에) 장착한 무기의 숙련
// 탭 1: 무기 해금 · 선택
const V_ROW = 38, V_HEAD = 30;

function villageItems(tab) {
  const md = Meta.data;
  if (tab === 0) {
    return UPGRADES.map(u => ({
      key: u.id, name: u.name, desc: u.desc, max: u.max,
      lv: () => Meta.lv(u.id), cost: () => Meta.nextCost(u), buy: () => Meta.buy(u),
    }));
  }
  const list = weaponOrder().map(id => {
    const W0 = WEAPONS[id], m = W0.moves;
    return { key: 'w.' + id, weapon: id, name: W0.name,
      desc: () => `${W0.style}  |  ${m.basic} · ${m.charged} · ${m.special}`,
      owned: md.unlocked.includes(id), unlockCost: W0.unlockCost || 0 };
  });
  for (const u of UPCOMING_WEAPONS) {
    list.push({ key: 'next', name: `🔒 ${u.name}`, desc: () => `차후 구현 · 해금: 영웅의 증표 ${u.cost}개`, locked: true });
  }
  // 지금 장착한 무기의 숙련 (무기의 정수로 강화)
  const wid = md.weapon, W0 = WEAPONS[wid];
  list.push({ header: true, name: `⚔ 무기 숙련 · ${W0.name}` }); // 가진 정수는 맨 위에 이미 보여서 뺐다 (2026-10-17)
  for (const m of W0.mastery) list.push({
    key: wid + '.' + m.id, name: m.name, desc: m.desc, max: m.max, essence: wid,
    lv: () => Meta.wlv(wid, m.id), cost: () => Meta.wNextCost(wid, m), buy: () => Meta.buyMastery(wid, m),
  });
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

// 뜨거운 열기: 봉인 등급 1 이상을 고르면 마을 화면 아래에서 붉은 기운과 불티가 올라온다. 등급이 높을수록 세다 (2026-10-18)
const heatHash = (i, k) => { const v = Math.sin(i * 91.7 + k * 47.3) * 43758.5453; return v - Math.floor(v); };
function drawHeat(lv, embers) {
  if (lv <= 0) return;
  if (embers) return drawEmbers(lv);
  const t = performance.now() / 1000, k = lv / (TIER_MAX - 1); // 0 ~ 1
  const fl = 0.85 + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1);
  // 아래에서 올라오는 붉은 기운
  const gh = H * (0.35 + 0.3 * k);
  const g = ctx.createLinearGradient(0, H, 0, H - gh);
  g.addColorStop(0, `rgba(255,80,20,${(0.22 + 0.3 * k) * fl})`);
  g.addColorStop(0.5, `rgba(220,50,10,${(0.08 + 0.14 * k) * fl})`);
  g.addColorStop(1, 'rgba(180,30,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H - gh, W, gh);
  // 양옆 가장자리도 살짝 달아오른다
  const sw = W * 0.12;
  for (const [x0, x1] of [[0, sw], [W, W - sw]]) {
    const s = ctx.createLinearGradient(x0, 0, x1, 0);
    s.addColorStop(0, `rgba(255,70,20,${(0.06 + 0.14 * k) * fl})`); s.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = s; ctx.fillRect(Math.min(x0, x1), 0, sw, H);
  }
}
// 불티: 아래에서 흔들리며 올라가다 사라진다 (도트 네모). 패널 위로 날아다니게 맨 마지막에 그린다
function drawEmbers(lv) {
  const t = performance.now() / 1000, k = lv / (TIER_MAX - 1);
  const n = 8 + lv * 6;
  for (let i = 0; i < n; i++) {
    const per = 2.6 + heatHash(i, 1) * 2.8, ph = (t / per + heatHash(i, 2)) % 1;
    const x = heatHash(i, 3) * W + Math.sin(t * (1 + heatHash(i, 4) * 2) + i) * 14;
    const y = H + 6 - ph * H * (0.55 + 0.35 * heatHash(i, 5));
    const a = (ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85) * (0.6 + 0.4 * k);
    const sz = heatHash(i, 6) < 0.3 ? 3 : 2;
    ctx.fillStyle = heatHash(i, 7) < 0.35 ? `rgba(255,220,120,${a})` : `rgba(255,${110 + ((heatHash(i, 8) * 60) | 0)},40,${a})`;
    ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
  }
}
// 봉인 등급 버튼 위로 일렁이는 작은 불꽃 (도트)
function drawHeatFlames(r, lv) {
  if (lv <= 0) return;
  const t = performance.now() / 1000, n = Math.round(r.w / 9), k = lv / (TIER_MAX - 1);
  for (let i = 0; i < n; i++) {
    const x = r.x + 4 + (i + 0.5) * (r.w - 8) / n;
    const h = (5 + 9 * k) * (0.55 + 0.45 * Math.abs(Math.sin(t * (6 + heatHash(i, 9) * 4) + i * 1.7)));
    for (let j = 0; j < h; j += 2) {
      const q = j / h, w = Math.max(1, Math.round((1 - q) * 4));
      ctx.fillStyle = q < 0.35 ? '#ffd86a' : q < 0.7 ? '#ff8a2a' : '#e0401a';
      ctx.fillRect(Math.round(x - w / 2), Math.round(r.y - 1 - j - 2), w, 2);
    }
  }
}
function drawVillage(blink) {
  const v = G.village, L = villageLayout(), md = Meta.data;
  overlay(0.7);
  drawHeat(tierNo(md.tier || 1));
  label('숲 마을 · 정령의 제단', W / 2, inset.t + 20, 22, '#ffe08a', 'center', '900');
  label(`◆ 정령의 조각 ${md.shards}    ⚔ ${WEAPONS[md.weapon].essence} ${Meta.ess(md.weapon)}    ✦ 영웅의 증표 ${md.emblems}`, W / 2, inset.t + 43, 13, '#c8a0ff', 'center', '800');
  label(`런 ${md.runs}회 · 최고 ${md.best ? stageLabel(md.best) : '-'}${md.bestEasy ? ` (쉬움 ${stageLabel(md.bestEasy)})` : ''}${md.clears ? ` · 클리어 ${md.clears}회` : ''}`, W - inset.r - 16, inset.t + 20, 11, '#aab', 'right', '600');
  drawHome(villageHome(), v.sel === -2);
  drawBookBtn(villageBook(), v.sel === -3);
  ['공통 강화', '무기 해금 · 선택'].forEach((name, i) => {
    const t = L.tabs[i], on = v.tab === i;
    ctx.fillStyle = on ? 'rgba(106,63,176,0.9)' : 'rgba(30,34,44,0.85)';
    (rrPath(t.x, t.y, t.w, t.h, 7), ctx.fill());
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
      ctx.fillStyle = 'rgba(255,210,74,0.35)'; (rrPath(r.x, r.y + r.h - 1, r.w, 1, 7), ctx.fill());
      return;
    }
    ctx.fillStyle = sel ? 'rgba(60,70,90,0.9)' : 'rgba(20,26,34,0.85)';
    (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
    if (v.flash[it.key] > 0) { ctx.fillStyle = `rgba(200,160,255,${v.flash[it.key]})`; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill()); }
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
    label(it.name, r.x + 12, r.y + r.h * 0.32, 13, it.locked ? '#99a' : '#fff', 'left', '800');
    const bx = r.x + r.w - 92, bw = 84;
    let btn, bcol, tcol;
    if (it.weapon !== undefined || it.locked) {
      // 무기 탭
      label(it.desc(), r.x + 12, r.y + r.h * 0.74, 10.5, '#b8c0cc', 'left', '500');
      const using = it.weapon === md.weapon, buy = !it.locked && !it.owned, can = buy && md.emblems >= it.unlockCost;
      if (it.owned) { // 이 무기의 완주 기록 (2026-10-18)
        const ws = md.wstats[it.weapon];
        const bt = ws && ws.times && ws.times[runTimeKey(ws.best)]; // 최고 봉인 등급의 최고 완주 시간 (같은 줄에)
        if (ws && ws.clears) label(`완주 ${ws.clears}회 · 최고 봉인 등급 ${tierNo(ws.best)}` + (bt ? ` · ⏱ ${fmtRunT(bt)}` : ''), r.x + r.w - 100, r.y + r.h * 0.32, 11, '#ffd24a', 'right', '800');
        else label('완주 기록 없음', r.x + r.w - 100, r.y + r.h * 0.32, 10.5, '#7d8a96', 'right', '600');
      }
      btn = it.locked ? '차후 구현' : buy ? `✦ ${it.unlockCost} 해금` : using ? '✓ 장착됨' : '장착하기';
      bcol = it.locked ? 'rgba(80,70,40,0.7)' : buy ? (can ? '#9a7a1a' : 'rgba(80,80,90,0.7)') : using ? 'rgba(63,138,59,0.9)' : '#6a3fb0';
      tcol = it.locked ? '#cbb' : '#fff';
    } else {
      const have = it.essence ? Meta.ess(it.essence) : md.shards, icon = it.essence ? '⚔' : '◆';
      const lv = it.lv(), cost = it.cost(), can = cost !== null && have >= cost;
      const desc = (lv < it.max ? '다음: ' : '') + it.desc(Math.max(1, lv + (lv < it.max ? 1 : 0)));
      label(desc, r.x + 12, r.y + r.h * 0.74, 10.5, '#b8c0cc', 'left', '500');
      for (let k = 0; k < it.max; k++) {
        ctx.fillStyle = k < lv ? '#c8a0ff' : 'rgba(255,255,255,0.15)';
        (rrPath(r.x + r.w - 104 - (it.max - k) * 11, r.y + r.h / 2 - 4, 8, 8, 7), ctx.fill());
      }
      btn = cost === null ? 'MAX' : `${icon} ${cost}`;
      bcol = cost === null ? 'rgba(255,255,255,0.08)' : can ? (it.essence ? '#9a6a1a' : '#6a3fb0') : 'rgba(80,80,90,0.7)';
      tcol = cost === null ? '#888' : can ? '#fff' : '#999';
    }
    ctx.fillStyle = bcol; (rrPath(bx, r.y + 3, bw, r.h - 6, 7), ctx.fill());
    label(btn, bx + bw / 2, r.y + r.h / 2, 13, tcol, 'center', '800');
  });
  ctx.restore();
  // 스크롤 막대
  if (L.maxScroll > 0) {
    const total = L.view.h + L.maxScroll, bh = L.view.h * L.view.h / total;
    const by = L.view.y + (L.view.h - bh) * (v.scroll / L.maxScroll);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; (rrPath(L.view.x + L.view.w + 4, L.view.y, 3, L.view.h, 7), ctx.fill());
    ctx.fillStyle = 'rgba(200,160,255,0.8)'; (rrPath(L.view.x + L.view.w + 4, by, 3, bh, 7), ctx.fill());
  }
  const st = L.start, ssel = v.sel === L.items.length;
  ctx.fillStyle = ssel ? '#3f8a3b' : '#2f6b2f'; (rrPath(st.x, st.y, st.w, st.h, 7), ctx.fill());
  ctx.strokeStyle = ssel && blink ? '#ffd24a' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; (rrPath(st.x + 1, st.y + 1, st.w - 2, st.h - 2, 7), ctx.stroke());
  label('모험 떠나기 ▶', st.x + st.w / 2, st.y + st.h / 2, 16, '#fff', 'center', '900');
  drawGear(villageGear(), G.village && G.village.sel === -1); // 패드 · 키보드로도 고를 수 있다 (목록 맨 위에서 ↑)
  // 난이도 버튼
  const mb = L.mode, msel = v.sel === L.items.length + 1, easy = md.mode === 'easy';
  ctx.fillStyle = easy ? 'rgba(40,110,70,0.95)' : 'rgba(40,46,60,0.95)'; (rrPath(mb.x, mb.y, mb.w, mb.h, 7), ctx.fill());
  ctx.strokeStyle = msel && blink ? '#ffd24a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; (rrPath(mb.x + 1, mb.y + 1, mb.w - 2, mb.h - 2, 7), ctx.stroke());
  drawModeIcon(easy ? 'easy' : 'normal', mb.x + 4, mb.y + 2, 34);
  const mtx = mb.x + 40 + (mb.w - 40) / 2;
  label(`난이도: ${easy ? '쉬움' : '일반'}`, mtx, mb.y + mb.h / 2 - 6, 13, easy ? '#8ff0b0' : '#ffb07a', 'center', '800');
  label(easy ? '받는 피해 1/3' : '눌러서 바꾸기', mtx, mb.y + mb.h / 2 + 9, 9, '#aab', 'center', '600');
  // 봉인 등급 버튼
  const tb = L.tier, tsel = v.sel === L.items.length + 2, ti = tierInfo(md.tier);
  drawHeatFlames(tb, tierNo(ti.n));
  ctx.fillStyle = ti.curses.length ? 'rgba(110,40,60,0.95)' : 'rgba(40,46,60,0.95)'; (rrPath(tb.x, tb.y, tb.w, tb.h, 7), ctx.fill());
  ctx.strokeStyle = tsel && blink ? '#ffd24a' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; (rrPath(tb.x + 1, tb.y + 1, tb.w - 2, tb.h - 2, 7), ctx.stroke());
  label(`봉인 등급 ${tierNo(ti.n)}`, tb.x + tb.w / 2, tb.y + tb.h / 2 - 6, 13, '#ffd0e0', 'center', '800');
  const fm = familiarMult(ti.n);
  label(`보상 ×${(ti.rewardMult * fm).toFixed(2)}${fm < 1 ? ' 익숙함' : ''} · 반발 ${ti.curses.length}${playableTiers().length > 1 ? ' ▸' : ''}`, tb.x + tb.w / 2, tb.y + tb.h / 2 + 9, 9, fm < 1 ? '#ff8a7a' : '#aab', 'center', '600');
  const d = Input.state.device;
  const how = d === 'touch' ? '목록은 위아래로 밀어서 스크롤 · 버튼을 탭해서 강화 · ⚙ 설정 · 왼쪽 위 처음 화면'
    : d === 'gamepad' ? `${padName(4)} · ${padName(5)} / ←→: 목록에선 탭 전환 · 아래 줄에선 버튼 이동 · B 아래 줄로 · A로 강화 / 장착 / 출발 · 맨 위 ⚙ 또는 ${padName(9)} 설정` : `←→ 탭 / 아래 버튼 · ↑↓ 고르고 ${menuKeys().ok}로 강화 / 장착 / 출발 · ${menuKeys().no} 아래 줄로 · 휠 스크롤 · Esc 설정`;
  label(v.msg || how, W / 2, st.y - 8, 11, v.msg ? '#ff9a7a' : '#aab', 'center', '600');
  drawHeat(tierNo(md.tier || 1), true);
  if (v.tierView) drawTierView();
  if (G.book) drawBoonBook();
}

// ── 봉인 등급 창: 왼쪽 등급 목록, 오른쪽 고른 등급의 내역 (반발 · 보상 · 증표 · 정수) (2026-10-17) ──
// 등급이 늘어나도 위아래로 고르고 스크롤한다. 패드: ↑↓ 고르기 · A 정하기 · B 닫기 (Y 바로 열기는 뺐다, 2026-10-17)
const TIER_ROW = 34;
// 숫자 뒤 조사: 끝자리 읽는 소리로 (1 일 · 2 이 · 3 삼 …, 0 은 십 · 백)
const josaEul = n => ['을', '을', '를', '을', '를', '를', '을', '을', '을', '를'][n % 10];
const josaRo = n => ['으로', '로', '로', '으로', '로', '로', '으로', '로', '로', '로'][n % 10];
function openTierView() {
  const v = G.village;
  v.tierView = { sel: Meta.data.tier - 1, t: 0, axis: 0, scroll: 0, drag: null };
  tierScrollTo(v.tierView.sel);
  v.msg = null; Sfx.pickup();
}
function tierViewLayout() {
  const w = Math.min(W - 32, 720), h = Math.min(H - inset.t - inset.b - 24, 420);
  const x = (W - w) / 2, y = Math.max(inset.t + 12, (H - h) / 2);
  const listW = Math.min(250, w * 0.42);
  const list = { x: x + 12, y: y + 44, w: listW, h: h - 100 };
  const info = { x: list.x + listW + 14, y: y + 44, w: w - listW - 38, h: h - 56 };
  const pick = { x: list.x, y: y + h - 48, w: listW, h: 36 }; // 정하기 버튼: 목록 바로 아래
  const close = { x: x + w - 74, y: y + 8, w: 64, h: 28 };
  return { x, y, w, h, list, info, pick, close, maxScroll: Math.max(0, TIER_MAX * TIER_ROW - list.h) };
}
function tierScrollTo(i) {
  const tv = G.village.tierView, L = tierViewLayout(), top = i * TIER_ROW;
  if (top < tv.scroll) tv.scroll = top;
  if (top + TIER_ROW > tv.scroll + L.list.h) tv.scroll = top + TIER_ROW - L.list.h;
  tv.scroll = clamp(tv.scroll, 0, L.maxScroll);
}
function tierPick(n) {
  const v = G.village;
  if (!tierOpen(n)) { v.tierView.msg = `봉인 등급 ${tierNo(n - 1)}${josaEul(tierNo(n - 1))} 완주하면 열려요`; Sfx.block(); return; }
  Meta.data.tier = n; Meta.save(); v.tierView = null;
  const ti = tierInfo(n);
  v.msg = `봉인 등급 ${tierNo(n)}${josaRo(tierNo(n))} 정했어요 · 보상 ×${(ti.rewardMult * familiarMult(n)).toFixed(2)} · 반발 ${ti.curses.length}개`;
  Sfx.boon();
}
function handleTierView(dt, inp) {
  const tv = G.village.tierView, L = tierViewLayout();
  tv.t += dt;
  if (tv.t < 0.15) return;
  if (inp.back || inp.pause) { G.village.tierView = null; Sfx.pickup(); return; }
  const vdir = inp.my > 0.5 ? 1 : inp.my < -0.5 ? -1 : 0, dir = axisRepeat(tv, vdir, dt);
  tv.axis = vdir;
  if (dir) { const k = clamp(tv.sel + dir, 0, TIER_MAX - 1); if (k !== tv.sel) { tv.sel = k; tv.msg = null; tierScrollTo(k); Sfx.pickup(); } }
  if (Input.wheel) { tv.scroll = clamp(tv.scroll + Input.wheel * 0.6, 0, L.maxScroll); Input.wheel = 0; }
  if (tv.drag) { // 목록 끌어서 스크롤
    const pt = Input.pointers.get(tv.drag.id);
    if (pt) { if (Math.abs(pt.y - tv.drag.y) > 6) tv.drag.moved = true; tv.scroll = clamp(tv.drag.scroll0 - (pt.y - tv.drag.y), 0, L.maxScroll); }
    else {
      if (!tv.drag.moved) { const i = Math.floor((tv.drag.y - L.list.y + tv.scroll) / TIER_ROW); if (i >= 0 && i < TIER_MAX) { if (i === tv.sel) tierPick(i + 1); else { tv.sel = i; tv.msg = null; Sfx.pickup(); } } }
      tv.drag = null;
    }
  }
  if (inp.tap) {
    if (inRectPt(inp.tap, L.close)) { G.village.tierView = null; Sfx.pickup(); return; }
    if (inRectPt(inp.tap, L.pick)) { tierPick(tv.sel + 1); return; }
    if (inRectPt(inp.tap, L.list)) {
      let id = null;
      for (const [pid, pt] of Input.pointers) if (Math.abs(pt.x - inp.tap.x) < 1 && Math.abs(pt.y - inp.tap.y) < 1) id = pid;
      if (id !== null) tv.drag = { id, y: inp.tap.y, scroll0: tv.scroll, moved: false };
      else { const i = Math.floor((inp.tap.y - L.list.y + tv.scroll) / TIER_ROW); if (i >= 0 && i < TIER_MAX) { if (i === tv.sel) tierPick(i + 1); else { tv.sel = i; Sfx.pickup(); } } }
    }
    return;
  }
  if (inp.confirm) tierPick(tv.sel + 1);
}
function drawTierView() {
  const tv = G.village.tierView, L = tierViewLayout();
  overlay(0.55);
  ctx.fillStyle = 'rgba(16,20,28,0.97)'; (rrPath(L.x, L.y, L.w, L.h, 7), ctx.fill());
  ctx.strokeStyle = 'rgba(255,208,224,0.45)'; ctx.lineWidth = 1; (rrPath(L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1, 7), ctx.stroke());
  label('봉인 등급', L.x + 16, L.y + 22, 18, '#ffd0e0', 'left', '900');
  label('등급이 오를수록 반발이 하나씩 붙고, 보상이 커져요', L.x + 110, L.y + 23, 11, '#aab', 'left', '600');
  const c = L.close;
  ctx.fillStyle = 'rgba(40,46,60,0.95)'; (rrPath(c.x, c.y, c.w, c.h, 7), ctx.fill());
  label('닫기', c.x + c.w / 2, c.y + c.h / 2 + 1, 12, '#ccd', 'center', '700');
  // 목록
  const Ls = L.list;
  ctx.save(); ctx.beginPath(); ctx.rect(Ls.x, Ls.y, Ls.w, Ls.h); ctx.clip();
  for (let i = 0; i < TIER_MAX; i++) {
    const n = i + 1, y = Ls.y + i * TIER_ROW - tv.scroll;
    if (y + TIER_ROW < Ls.y || y > Ls.y + Ls.h) continue;
    const open = tierOpen(n), cleared = !!Meta.data.tierCleared[n], cur = Meta.data.tier === n, sel = tv.sel === i, ti = tierInfo(n);
    ctx.fillStyle = sel ? 'rgba(110,40,70,0.95)' : 'rgba(30,34,46,0.9)'; (rrPath(Ls.x, y + 1, Ls.w, TIER_ROW - 3, 7), ctx.fill());
    if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(Ls.x + 1, y + 2, Ls.w - 2, TIER_ROW - 5, 7), ctx.stroke()); }
    label((open ? '' : '🔒 ') + '봉인 등급 ' + tierNo(n), Ls.x + 10, y + TIER_ROW / 2, 13, open ? (cur ? '#ffd24a' : '#fff') : '#778', 'left', '800');
    const tag = cur ? '선택됨' : cleared ? '✓ 완주' : open ? `반발 ${ti.curses.length}` : '';
    label(tag, Ls.x + Ls.w - 10, y + TIER_ROW / 2, 10, cur ? '#ffd24a' : cleared ? '#8ff0b0' : '#aab', 'right', '700');
  }
  ctx.restore();
  if (L.maxScroll > 0) { // 스크롤 막대
    const k = Ls.h / (TIER_MAX * TIER_ROW), bh = Ls.h * k, by = Ls.y + (tv.scroll / L.maxScroll) * (Ls.h - bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; (rrPath(Ls.x + Ls.w + 3, by, 3, bh, 7), ctx.fill());
  }
  // 고른 등급의 내역
  const n = tv.sel + 1, ti = tierInfo(n), I = L.info, open = tierOpen(n), fm = familiarMult(n);
  let y = I.y + 10;
  label(`봉인 등급 ${tierNo(n)}`, I.x, y, 16, open ? '#ffd0e0' : '#778', 'left', '900'); y += 24;
  label(`보상 ×${(ti.rewardMult * fm).toFixed(2)}${fm < 1 ? '  (익숙한 숲 ×0.5)' : ''}`, I.x, y, 12, fm < 1 ? '#ff8a7a' : '#c8b8ff', 'left', '700'); y += 18;
  const cleared = !!Meta.data.tierCleared[n], eb = Meta.data.essBest[n] || 0;
  if (ti.emblem) label(`✦ 영웅의 증표: ${cleared ? '받음' : '처음 완주하면 1개'}`, I.x, y, 11, cleared ? '#8ff0b0' : '#ffd24a', 'left', '600');
  else label('◈ 봉인의 핵: 무기 각성 재료 (각성과 함께 추가 예정)', I.x, y, 11, '#c8a0ff', 'left', '600');
  y += 16;
  label(n > ESSENCE_TIER_MAX ? '⚔ 무기의 정수: 이 등급은 없음 (등급 0~5 에서만)' : `⚔ 무기의 정수: ${eb > STAGES_PER_WORLD * FINAL_STAGE ? '모두 받음' : eb ? `${stageLabel(eb)}까지 받음` : '아직 안 받음'}`, I.x, y, 11, '#ccd', 'left', '600'); y += 22;
  label(ti.curses.length ? `봉인의 반발 ${ti.curses.length}개` : '봉인의 반발 없음', I.x, y, 12, ti.curses.length ? '#ff9a7a' : '#8a96a0', 'left', '800'); y += 18;
  ti.curses.forEach((id, k) => {
    const isNew = k === ti.curses.length - 1 && n > 1;
    label((isNew ? '＋ ' : '· ') + CURSES[id].name, I.x + 4, y, 12, isNew ? '#ffb0a0' : '#e8d8d8', 'left', '700');
    label(CURSES[id].desc, I.x + 120, y, 11, '#aab', 'left', '600');
    y += 17;
  });
  if (n > 1 && ti.curses.length) label('＋ 표시는 이 등급에서 새로 붙는 반발', I.x, y + 4, 10, '#889', 'left', '600');
  // 정하기 버튼
  const P = L.pick, can = open && Meta.data.tier !== n;
  ctx.fillStyle = can ? '#3f8a3b' : 'rgba(50,56,70,0.95)'; (rrPath(P.x, P.y, P.w, P.h, 7), ctx.fill());
  label(open ? '봉인 등급 선택' : '🔒 아직 잠김', P.x + P.w / 2, P.y + P.h / 2 + 1, 13, can ? '#fff' : '#99a', 'center', '800');
  const d = Input.state.device;
  const how = tv.msg || (d === 'touch' ? '등급을 탭해서 보고, 한 번 더 탭하거나 버튼으로 정해요' : d === 'gamepad' ? '↑↓ 고르기 · A 정하기 · B 닫기' : `↑↓ 고르기 · ${menuKeys().ok} 정하기 · ${menuKeys().no} 닫기`);
  label(how, L.x + L.w / 2, L.y + L.h + 12 > H - inset.b - 6 ? L.y + L.h - 8 : L.y + L.h + 12, 11, tv.msg ? '#ff9a7a' : '#aab', 'center', '600');
}

// ── 축복 도감 (2026-10-18): 속성 6가지 + 듀오. 축복마다 슬롯 · 최대 레벨 · 나오는 조건 · 레벨별 효과 ──
// 위 줄에서 무기를 고르면 그 무기 모양의 이름 · 효과로 보인다 (같은 축복도 무기마다 다르다, 2026-10-18). 마을 '축복 도감' 버튼 · 일시정지 메뉴에서 연다
const BOOK_TABS = [['fire'], ['frost'], ['thunder'], ['poison'], ['might'], ['guard'], ['duo']];
const BOOK_REQ = { fire: '화상을 거는 불 축복', frost: '냉기를 거는 얼음 축복', thunder: '감전을 거는 번개 축복', poison: '독을 거는 독 축복' };
function openBoonBook(from) { G.book = { from, tab: 0, weapon: curWeapon(), scroll: 0, t: 0, axis: 0, axisX: 0, drag: null }; Sfx.pickup(); }
// 도감이 고른 무기 기준으로 fn 을 돌린다 (축복 이름 · 설명 · 강화 조건이 그 무기 모양이 된다)
function bookAs(fn) { const prev = G.bookWeapon; G.bookWeapon = G.book && G.book.weapon; try { return fn(); } finally { G.bookWeapon = prev; } }
// 슬롯이 이 무기에선 어떤 기술인지: 숙련 이름에서 ' 숙련'을 뗀다 (combo = 기본, spin = 차지, wave = 특수, thrust = 대시 공격)
const BOOK_SLOT_SKILL = { basic: 'combo', charge: 'spin', special: 'wave', dash: 'thrust' };
function bookSlotName(slot) {
  const m = (WEAPONS[curWeapon()].mastery || []).find(x => x.id === BOOK_SLOT_SKILL[slot]);
  const skill = m ? m.name.replace(/ 숙련$/, '') : '';
  return SLOT_NAMES[slot] + (skill && slot !== 'dash' ? ` (${skill})` : '');
}
// 레벨별 설명을 한 줄로: 레벨마다 바뀌는 숫자는 "1/2/3" 처럼 모아서
function boonLevelLine(b) {
  const max = boonMaxLv(b), re = /(-?\d+(?:\.\d+)?)/;
  const all = []; for (let lv = 1; lv <= max; lv++) all.push(b.desc(lv).split(re));
  const base = all[0];
  if (max === 1 || all.some(t => t.length !== base.length || t.some((x, i) => i % 2 === 0 && x !== base[i]))) return b.desc(max);
  return base.map((x, i) => {
    if (i % 2 === 0) return x;
    const vals = all.map(t => t[i]);
    return vals.every(v => v === vals[0]) ? vals[0] : vals.join('/');
  }).join('');
}
function boonReqLine(b) {
  if (b.duo) return `나오는 조건: ${b.duo.map(e => ELEMENTS[e].icon + ' ' + ELEMENTS[e].name).join(' + ')} 축복을 모두 가지고 있을 때`;
  if (b.needs) return `나오는 조건: ${BOON_BY_ID[b.needs].name} 보유 (강화 축복)`;
  if (b.req && BOOK_REQ[b.el]) return `나오는 조건: ${BOOK_REQ[b.el]}을 하나 이상 보유`;
  if (b.slot) return `나오는 조건: 없음 · 같은 ${SLOT_NAMES[b.slot]}에는 속성 하나만 (다른 속성을 고르면 바뀌고, Lv${SLOT_LOCK_LV}부터는 고정)`;
  return b.rare ? '나오는 조건: 없음 (드물게 나와요)' : '나오는 조건: 없음';
}
function bookList(tab) {
  const k = BOOK_TABS[tab][0];
  return BOONS.filter(b => !b.mergedInto && (k === 'duo' ? !!b.duo : b.el === k && !b.duo));
}
function bookLayout() { return bookAs(bookLayoutRaw); }
function bookLayoutRaw() {
  const w = Math.min(W - 24, 760), x = (W - w) / 2, y = inset.t + 8, h = H - inset.t - inset.b - 16;
  const wo = weaponOrder(), weapons = wo.map((id, i) => { const ww = (w - 24) / wo.length; return { id, x: x + 12 + i * ww, y: y + 38, w: ww - 4, h: 24 }; });
  const tabs = BOOK_TABS.map(([k], i) => { const tw = (w - 24) / BOOK_TABS.length; return { k, x: x + 12 + i * tw, y: y + 66, w: tw - 4, h: 26 }; });
  const view = { x: x + 12, y: y + 98, w: w - 24, h: h - 98 - 22 };
  const close = { x: x + w - 74, y: y + 8, w: 64, h: 26 };
  const cards = []; let cy = 0;
  for (const b of bookList(G.book.tab)) {
    const tag = (b.slot ? bookSlotName(b.slot) : b.needs ? '강화 축복' : b.duo ? '듀오 축복' : '패시브') + ` · 최대 Lv${boonMaxLv(b)}`;
    const eff = wrap(boonLevelLine(b), view.w - 24, 12, '500'), req = wrap(boonReqLine(b), view.w - 24, 11, '600');
    const hh = 26 + req.length * 15 + eff.length * 16 + 10;
    cards.push({ b, tag, eff, req, top: cy, h: hh }); cy += hh + 6;
  }
  return { x, y, w, h, weapons, tabs, view, close, cards, maxScroll: Math.max(0, cy - view.h) };
}
function handleBoonBook(dt, inp) {
  const bk = G.book, L = bookLayout();
  bk.t += dt;
  if (bk.t < 0.15) return;
  const close = () => { G.book = null; Sfx.pickup(); if (G.village) { G.village.t = 0.3; G.village.armed = false; } };
  if (inp.back || inp.pause) { close(); return; }
  const setTab = t => { t = (t + BOOK_TABS.length) % BOOK_TABS.length; if (t !== bk.tab) { bk.tab = t; bk.scroll = 0; Sfx.pickup(); } };
  const setWeapon = id => { if (id !== bk.weapon) { bk.weapon = id; bk.scroll = 0; Sfx.pickup(); } };
  // LB · RB = 무기 바꾸기, ←→ = 속성 바꾸기
  if (inp.lb || inp.rb) { const wo = weaponOrder(), n = wo.length, i = wo.indexOf(bk.weapon); setWeapon(wo[(i + (inp.rb ? 1 : -1) + n) % n]); return; }
  const hx = inp.mx > 0.5 ? 1 : inp.mx < -0.5 ? -1 : 0;
  if (hx && hx !== bk.axisX) setTab(bk.tab + hx);
  bk.axisX = hx;
  const vdir = inp.my > 0.5 ? 1 : inp.my < -0.5 ? -1 : 0;
  if (vdir) bk.scroll += vdir * 360 * dt;
  if (Input.wheel) { bk.scroll += Input.wheel * 0.6; Input.wheel = 0; }
  if (bk.drag) { const pt = Input.pointers.get(bk.drag.id); if (pt) bk.scroll = bk.drag.scroll0 - (pt.y - bk.drag.y); else bk.drag = null; }
  if (inp.tap) {
    if (inRectPt(inp.tap, L.close)) { close(); return; }
    const wi = L.weapons.find(r => inRectPt(inp.tap, r));
    if (wi) { setWeapon(wi.id); return; }
    const ti = L.tabs.findIndex(r => inRectPt(inp.tap, r));
    if (ti >= 0) { setTab(ti); return; }
    if (inRectPt(inp.tap, L.view)) {
      let id = null;
      for (const [pid, pt] of Input.pointers) if (Math.abs(pt.x - inp.tap.x) < 1 && Math.abs(pt.y - inp.tap.y) < 1) id = pid;
      if (id !== null) bk.drag = { id, y: inp.tap.y, scroll0: bk.scroll };
    }
  }
  bk.scroll = clamp(bk.scroll, 0, L.maxScroll);
}
function drawBoonBook() { bookAs(drawBoonBookRaw); }
function drawBoonBookRaw() {
  const bk = G.book, L = bookLayoutRaw();
  overlay(0.75);
  ctx.fillStyle = 'rgba(14,18,26,0.97)'; (rrPath(L.x, L.y, L.w, L.h, 7), ctx.fill());
  ctx.strokeStyle = 'rgba(255,224,138,0.4)'; ctx.lineWidth = 1; (rrPath(L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1, 7), ctx.stroke());
  label('📖 축복 도감', L.x + 16, L.y + 22, 18, '#ffe08a', 'left', '900');
  label('같은 축복도 무기마다 이름과 효과가 달라요', L.x + 140, L.y + 23, 11, '#aab', 'left', '600');
  const mine = G.player ? G.player.weaponId : Meta.data.weapon;
  L.weapons.forEach(r => {
    const on = bk.weapon === r.id;
    ctx.fillStyle = on ? 'rgba(106,63,176,0.9)' : 'rgba(28,32,44,0.9)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
    label((r.id === mine ? '★ ' : '') + WEAPONS[r.id].name, r.x + r.w / 2, r.y + r.h / 2, 12, on ? '#fff' : '#99a', 'center', '800');
  });
  const c = L.close; ctx.fillStyle = 'rgba(40,46,60,0.95)'; (rrPath(c.x, c.y, c.w, c.h, 7), ctx.fill()); label('닫기', c.x + c.w / 2, c.y + c.h / 2 + 1, 12, '#ccd', 'center', '700');
  L.tabs.forEach((t, i) => {
    const on = bk.tab === i, el = ELEMENTS[t.k], col = t.k === 'duo' ? '#ffb8f0' : el.color;
    ctx.fillStyle = on ? 'rgba(60,52,90,0.95)' : 'rgba(28,32,44,0.9)'; (rrPath(t.x, t.y, t.w, t.h, 7), ctx.fill());
    if (on) { ctx.fillStyle = col; (rrPath(t.x, t.y + t.h - 3, t.w, 3, 7), ctx.fill()); }
    label(t.k === 'duo' ? '✨ 듀오' : `${el.icon} ${el.name}`, t.x + t.w / 2, t.y + t.h / 2, 12, on ? col : '#99a', 'center', '800');
  });
  const V = L.view;
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  for (const cd of L.cards) {
    const y = V.y + cd.top - bk.scroll;
    if (y + cd.h < V.y || y > V.y + V.h) continue;
    const b = cd.b, col = boonColor(b), own = G.player && G.boons && G.boons[b.id] && bk.weapon === G.player.weaponId;
    ctx.fillStyle = 'rgba(24,30,40,0.95)'; (rrPath(V.x, y, V.w, cd.h, 7), ctx.fill());
    ctx.fillStyle = col; (rrPath(V.x, y, 3, cd.h, 7), ctx.fill());
    ctx.font = `16px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(boonIcon(b), V.x + 10, y + 14);
    label(b.name + (own ? `  (지금 Lv${G.boons[b.id]})` : ''), V.x + 34, y + 14, 14, col, 'left', '800');
    label(cd.tag, V.x + V.w - 10, y + 14, 11, '#aab', 'right', '600');
    let ly = y + 32;
    cd.req.forEach(l => { label(l, V.x + 12, ly, 11, cd.b.duo || cd.b.needs || cd.b.req ? '#ffb07a' : '#7d8a96', 'left', '600'); ly += 15; });
    cd.eff.forEach(l => { label(l, V.x + 12, ly + 1, 12, '#e8e8e8', 'left', '500'); ly += 16; });
  }
  ctx.restore();
  if (L.maxScroll > 0) { const k = V.h / (V.h + L.maxScroll), bh = V.h * k, by = V.y + (bk.scroll / L.maxScroll) * (V.h - bh); ctx.fillStyle = 'rgba(255,255,255,0.25)'; (rrPath(V.x + V.w + 4, by, 3, bh, 7), ctx.fill()); }
  const d = Input.state.device;
  const how = d === 'touch' ? '무기 · 속성을 눌러 바꾸고, 목록은 밀어서 스크롤 · ★ 지금 무기 · "1/2/3"은 레벨별 값' : d === 'gamepad' ? 'LB · RB 무기 · ←→ 속성 · ↑↓ 스크롤 · B 닫기 · ★ 지금 무기 · "1/2/3"은 레벨별 값' : `무기는 클릭 · ←→ 속성 · ↑↓ · 휠 스크롤 · ${menuKeys().no} 닫기 · ★ 지금 무기 · "1/2/3"은 레벨별 값`;
  label(how, L.x + L.w / 2, L.y + L.h - 10, 11, '#8a96a0', 'center', '600');
}

function villageAct(i) {
  const v = G.village, items = villageItems(v.tab);
  if (i === -1) { openSettings('village'); return; } // ⚙ 설정
  if (i === -2) { villageGoTitle(); return; }        // 처음 화면
  if (i === -3) { openBoonBook('village'); return; } // 축복 도감
  if (i === items.length) { G.startRun(); return; }
  if (i === items.length + 2) { openTierView(); return; } // 봉인 등급 창 (목록 + 내역, 2026-10-17)
  if (i === items.length + 1) { // 난이도 바꾸기
    Meta.data.mode = Meta.data.mode === 'easy' ? 'normal' : 'easy'; Meta.save();
    v.msg = Meta.data.mode === 'easy' ? '쉬움 모드: 받는 피해가 1/3이에요 (보상은 같아요)' : '일반 모드로 바꿨어요';
    Sfx.pickup(); return;
  }
  const it = items[i];
  if (!it || it.header) return;
  if (it.locked) { v.msg = '차후 구현 예정인 무기예요'; Sfx.block(); return; }
  if (it.weapon !== undefined) {
    if (!it.owned) {
      if (Meta.data.emblems < it.unlockCost) { v.msg = `영웅의 증표가 ${it.unlockCost}개 필요해요 (봉인 등급 0~4를 처음 완주할 때마다 1개씩 얻어요)`; Sfx.block(); return; }
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
  if (G.book) { handleBoonBook(dt, inp); return; }
  if (v.tierView) { handleTierView(dt, inp); return; }
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
    if (inRect(inp.tap, villageHome())) { villageGoTitle(); return; }
    if (inRect(inp.tap, villageBook())) { openBoonBook('village'); return; }
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
  if (hx && hx !== v.axisX) {
    // 위쪽 줄 (왼쪽부터): 처음 화면(-2) · 축복 도감(-3) · ⚙(-1)
    const TOP = [-2, -3, -1];
    if (TOP.includes(v.sel)) { const k = clamp(TOP.indexOf(v.sel) + hx, 0, 2); if (TOP[k] !== v.sel) { v.sel = TOP[k]; Sfx.pickup(); } }
    else if (inBar) barMove(hx); else tabTo(nextTab(hx));
  }
  v.axisX = hx;
  // ↑↓: 목록 줄 이동. 아래 버튼 줄은 한 줄로 본다 (맨 아래 → 모험 떠나기, 버튼 줄에서 ↑ → 목록 마지막)
  // 순서: ⚙ → 목록 → 아래 버튼 줄 → 다시 ⚙ (길게 누르면 가속, 영역도 계속 넘어간다)
  const vdir = inp.my > 0.5 ? 1 : inp.my < -0.5 ? -1 : 0, dir = axisRepeat(v, vdir, dt);
  if (dir) {
    const rows = []; for (let k = 0; k < n; k++) if (selectable(k)) rows.push(k);
    let i;
    if (v.sel < 0) i = dir > 0 ? (rows.length ? rows[0] : n) : n;
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
  label(`◆ 정령의 조각 ${G.runShards} → +${G.gotShards ?? Math.round(G.runShards * P.total)}    ⚔ 무기의 정수 ${G.runEssence} → +${G.gotEssence ?? G.runEssence}`, W / 2, y, 15, '#c8a0ff', 'center', '800');
  label(`보상 ×${P.total.toFixed(2)}  (${parts.join(' · ')})   ·   보유 ◆ ${Meta.data.shards} · ⚔ ${Meta.data.essence}`, W / 2, y + 18, 11, P.fam < 1 ? '#ff9a7a' : '#ccd', 'center', '600');
}

// ── 프로필 고르기: 저장 칸 3개, 칸마다 지금까지의 진행 상황 (2026-10-17) ──
function openProfiles() { G.state = 'profiles'; G.pf = { sel: (Meta.slot || 1) - 1, t: 0, axis: 0, axisX: 0 }; Sfx.pickup(); }
function profileLayout() {
  const n = SAVE_SLOTS, gap = 12, avail = W - inset.l - inset.r - 32;
  const w = Math.min(230, (avail - gap * (n - 1)) / n), h = Math.min(250, H - inset.t - inset.b - 120);
  const x0 = (W - (w * n + gap * (n - 1))) / 2, y = Math.max(inset.t + 64, (H - h) / 2);
  const cards = Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), y, w, h, del: { x: x0 + i * (w + gap) + w - 28, y: y + 6, w: 22, h: 22 }, code: { x: x0 + i * (w + gap) + 6, y: y + 6, w: 40, h: 22 } }));
  const bw = 120, by = H / 2 + 20;
  cards.ask = [{ x: W / 2 - bw - 8, y: by, w: bw, h: 38, name: '지우기' }, { x: W / 2 + 8, y: by, w: bw, h: 38, name: '취소' }];
  cards.back = { x: W / 2 - 70, y: y + h + 12, w: 140, h: 30 };
  return cards;
}
const fmtPlay = t => (t < 60 ? '1분 미만' : t < 3600 ? `${Math.floor(t / 60)}분` : `${Math.floor(t / 3600)}시간 ${Math.floor((t % 3600) / 60)}분`);
// ── 저장 코드 (2026-10-18): 프로필 저장을 글자 코드로 바꿔 다른 기기에 옮긴다 ──
// 코드 = 'SEAL1.' + (압축한) 저장 JSON 의 base64url + '.' + 확인용 해시. 압축이 안 되는 브라우저는 'SEAL0.' (압축 없음)
const b64url = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const codeHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
async function zipBytes(bytes, mode) {
  const st = new Blob([bytes]).stream().pipeThrough(mode === 'in' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function makeSaveCode(slot) {
  const d = store.get(slotKey(slot));
  if (!d) return null;
  const json = JSON.stringify(d), raw = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') { try { return 'SEAL1.' + b64url(await zipBytes(raw, 'in')) + '.' + codeHash(json); } catch (_) {} }
  return 'SEAL0.' + b64url(raw) + '.' + codeHash(json);
}
async function readSaveCode(code) {
  const m = String(code || '').replace(/\s+/g, '').match(/^SEAL([01])\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/);
  if (!m) throw new Error('코드 모양이 맞지 않아요. 처음부터 끝까지 빠짐없이 붙여 넣어 주세요');
  let bytes = unb64url(m[2]);
  if (m[1] === '1') { if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저에서는 이 코드를 풀 수 없어요'); bytes = await zipBytes(bytes, 'out'); }
  const json = new TextDecoder().decode(bytes);
  if (codeHash(json) !== m[3]) throw new Error('코드 일부가 빠졌거나 바뀌었어요');
  const d = JSON.parse(json);
  if (!d || typeof d !== 'object' || !Array.isArray(d.unlocked)) throw new Error('저장 코드가 아니에요');
  return d;
}
// 코드 창: 게임 화면 위에 HTML 로 띄운다 (글자 입력 · 복사가 필요해서)
function openCodePanel(slot) {
  const m = G.pf; if (!m || m.code) return;
  m.code = true; Sfx.pickup();
  const has = !!Meta.summary(slot);
  const el = document.createElement('div');
  el.id = 'save-code';
  el.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(6,8,12,0.82);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
  el.innerHTML = '<div style="background:#141a24;border:1px solid rgba(255,224,138,.45);border-radius:6px;padding:14px;width:min(560px,100%);max-height:100%;overflow:auto;color:#e8e8e8;font-size:13px;line-height:1.5">'
    + '<div style="font-size:17px;font-weight:900;color:#ffe08a;margin-bottom:6px">프로필 ' + slot + ' · 저장 코드</div>'
    + '<div style="color:#aab4c0;margin-bottom:8px">' + (has ? '이 코드를 복사해서 다른 기기의 같은 화면에 붙여 넣으면 진행을 그대로 옮길 수 있어요. 다른 코드를 붙여 넣고 불러오면 이 프로필을 그 진행으로 바꿔요.' : '다른 기기에서 만든 저장 코드를 붙여 넣고 불러오기를 누르세요.') + '</div>'
    + '<textarea spellcheck="false" style="width:100%;height:110px;box-sizing:border-box;background:#0b0f16;color:#cfe8ff;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:8px;font-family:monospace;font-size:12px;word-break:break-all;resize:vertical" placeholder="여기에 저장 코드를 붙여 넣으세요"></textarea>'
    + '<div data-msg style="min-height:20px;margin:6px 0;color:#ffb07a;font-weight:700"></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">'
    + (has ? '<button data-act="copy">복사하기</button>' : '')
    + '<button data-act="load">이 코드로 불러오기</button><button data-act="close">닫기</button></div></div>';
  for (const b of el.querySelectorAll('button')) b.style.cssText = 'font:inherit;font-weight:800;font-size:14px;padding:9px 14px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:#28304a;color:#fff;cursor:pointer';
  const ta = el.querySelector('textarea'), msg = el.querySelector('[data-msg]');
  const say = (t, ok) => { msg.textContent = t; msg.style.color = ok ? '#8ff0b0' : '#ffb07a'; };
  let mine = '';
  if (has) makeSaveCode(slot).then(c => { mine = c || ''; ta.value = mine; });
  const stop = e => e.stopPropagation(); // 글자를 치는 동안 게임 키가 먹지 않게
  for (const ev of ['keydown', 'keyup']) el.addEventListener(ev, stop);
  let armed = false;
  const close = () => { el.remove(); m.code = false; m.t = 0; };
  // 안드로이드: 코드 버튼을 탭한 뒤 따라오는 click 이 방금 뜬 창에 떨어져 바로 닫혔다 (2026-10-18)
  // → 뜬 직후 0.5초 동안 click 은 무시하고, 바깥(어두운 곳)을 눌러서는 닫지 않는다 (닫기 버튼으로만)
  const openedAt = performance.now();
  el.addEventListener('click', async e => {
    if (performance.now() - openedAt < 500) return;
    const act = e.target && e.target.dataset && e.target.dataset.act;
    if (act === 'close') { close(); return; }
    if (act === 'copy') {
      // 입력 칸에 포커스를 주지 않는다: 휴대폰에서 키보드가 뜨지 않게 (2026-10-18)
      ta.value = mine;
      let done = false;
      try { await navigator.clipboard.writeText(mine); done = true; } catch (_) {}
      if (!done) { // 예전 방식: 화면 밖 읽기 전용 칸으로 복사 (읽기 전용이라 키보드가 안 뜬다)
        const tmp = document.createElement('textarea');
        tmp.value = mine; tmp.readOnly = true; tmp.setAttribute('inputmode', 'none');
        tmp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(tmp); tmp.select(); tmp.setSelectionRange(0, mine.length);
        try { done = document.execCommand('copy'); } catch (_) {}
        tmp.remove();
      }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      say(done ? '복사했어요! 다른 기기에서 붙여 넣으세요' : '복사가 안 되면 코드를 길게 눌러 전체 선택 후 복사해 주세요', done);
      return;
    }
    if (act === 'load') {
      const code = ta.value.trim();
      if (!code || code === mine) { say('다른 기기에서 복사한 코드를 붙여 넣어 주세요'); return; }
      let d; try { d = await readSaveCode(code); } catch (err) { say(err.message || '코드를 읽지 못했어요'); armed = false; return; }
      if (has && !armed) { armed = true; e.target.textContent = '정말 덮어쓰기'; say('지금 프로필 ' + slot + '의 진행이 이 코드의 진행으로 바뀌어요. 한 번 더 누르면 덮어써요'); return; }
      store.set(slotKey(slot), d);
      if (slot === Meta.slot) Meta.load(slot);
      Sfx.level(); m.msg = '프로필 ' + slot + '에 저장 코드를 불러왔어요'; m.sel = slot - 1;
      close();
    }
  });
  document.body.appendChild(el);
  if (!has) ta.focus();
}
function handleProfileInput(dt, inp) {
  const m = G.pf;
  if (m.code) return; // 저장 코드 창이 열려 있는 동안
  m.t += dt;
  if (m.t < 0.2) return;
  const { dx, dy } = menuAxis(m, inp, dt);
  const L = profileLayout();
  if (m.ask !== undefined) { // 프로필 지우기 확인: 기본은 취소
    if (dx) { m.askSel = m.askSel ? 0 : 1; Sfx.pickup(); }
    let pick = null;
    if (inp.tap) { const i = L.ask.findIndex(r => inRectPt(inp.tap, r)); if (i >= 0) pick = i; }
    else if (inp.confirm) pick = m.askSel;
    if (pick === 0) { Meta.wipe(m.ask + 1); Sfx.block(); m.msg = `프로필 ${m.ask + 1}${m.ask === 1 ? "를" : "을"} 지웠어요`; m.ask = undefined; }
    else if (pick === 1 || inp.back) { m.ask = undefined; Sfx.pickup(); }
    return;
  }
  if (dx || dy) { m.sel = stepSel(m.sel, dx || dy, SAVE_SLOTS); Sfx.pickup(); }
  const askDel = i => { if (!Meta.summary(i + 1)) return; m.sel = i; m.ask = i; m.askSel = 1; Sfx.pickup(); };
  if (inp.reroll) { askDel(m.sel); return; } // 키보드 특수 키 · 패드 Y
  let pick = null;
  if (inp.tap) {
    if (inRectPt(inp.tap, L.back)) { G.state = 'title'; G.titleT = 0; Sfx.pickup(); return; }
    const ci = L.findIndex(r => inRectPt(inp.tap, r.code));
    if (ci >= 0) { m.sel = ci; openCodePanel(ci + 1); return; }
    const di = L.findIndex(r => inRectPt(inp.tap, r.del));
    if (di >= 0 && Meta.summary(di + 1)) { askDel(di); return; }
    const i = L.findIndex(r => inRectPt(inp.tap, r));
    if (i >= 0) pick = i;
  } else if (inp.confirm) pick = m.sel;
  if (pick === null) { if (inp.back) { G.state = 'title'; G.titleT = 0; } return; }
  Meta.load(pick + 1); Meta.save(); Sfx.boon();
  G.goVillage();
}
function drawProfiles(blink) {
  overlay(0.62);
  const L = profileLayout(), m = G.pf;
  label('프로필 선택', W / 2, L[0].y - 34, 24, '#ffe08a', 'center', '900');
  L.forEach((r, i) => {
    const s = Meta.summary(i + 1), sel = m.sel === i, cx = r.x + r.w / 2;
    ctx.fillStyle = sel ? 'rgba(58,50,96,0.96)' : 'rgba(20,26,34,0.92)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
    ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = sel ? 2 : 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke());
    label(`프로필 ${i + 1}`, cx, r.y + 20, 16, sel ? '#ffd24a' : '#fff', 'center', '900');
    const foot = (t, c) => label(t, cx, r.y + r.h - 18, 13, sel && blink ? '#ffd24a' : c, 'center', '800');
    const cb = r.code; // 저장 코드 버튼 (내보내기 · 불러오기)
    ctx.fillStyle = 'rgba(40,60,90,0.8)'; (rrPath(cb.x, cb.y, cb.w, cb.h, 7), ctx.fill());
    ctx.strokeStyle = 'rgba(160,200,255,0.5)'; ctx.lineWidth = 1; (rrPath(cb.x + 0.5, cb.y + 0.5, cb.w - 1, cb.h - 1, 7), ctx.stroke());
    label('코드', cb.x + cb.w / 2, cb.y + cb.h / 2 + 1, 11, '#cfe8ff', 'center', '800');
    if (!s) { label('비어 있음', cx, r.y + r.h / 2, 14, '#8a96a0', 'center', '700'); foot('새 모험 시작', '#ccd'); return; }
    const stageLabel = i => (i > STAGES_PER_WORLD * FINAL_STAGE ? '완주' : stageLabelRaw(i)); // 31 = 끝까지 깸
    const db = r.del; // 지우기 버튼
    ctx.fillStyle = 'rgba(120,40,30,0.75)'; (rrPath(db.x, db.y, db.w, db.h, 7), ctx.fill());
    ctx.strokeStyle = 'rgba(255,160,140,0.6)'; ctx.lineWidth = 1; (rrPath(db.x + 0.5, db.y + 0.5, db.w - 1, db.h - 1, 7), ctx.stroke());
    label('✕', db.x + db.w / 2, db.y + db.h / 2 + 1, 12, '#ffd0c8', 'center', '900');
    const best = s.best ? stageLabel(s.best) + (s.bestEasy ? ` (쉬움 ${stageLabel(s.bestEasy)})` : '') : s.bestEasy ? `쉬움 ${stageLabel(s.bestEasy)}` : '-';
    const rows = [
      ['최고 기록', best], ['완주', `${s.clears}회`], ['도전', `${s.runs}회`], ['플레이 시간', fmtPlay(s.playT)],
      ['무기', `${s.unlocked} / ${WEAPON_ORDER.length}종`],
      null, // 구분선: 아래는 지금까지 모은 자원
      ['◆ 정령의 조각', s.totShards], ['⚔ 무기의 정수', s.totEssence], ['✦ 영웅의 증표', s.totEmblems],
    ];
    const top = r.y + 44, rh = Math.min(19, (r.h - 82) / rows.length), lx = r.x + 12, rx = r.x + r.w - 12;
    rows.forEach((row, j) => {
      const yy = top + j * rh;
      if (!row) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; (rrPath(lx, yy, r.w - 24, 1, 7), ctx.fill()); label('모은 자원', lx, yy + rh * 0.45, 10, '#8a96a0', 'left', '700'); return; }
      label(row[0], lx, yy + rh * 0.6, 11, '#aab4c0', 'left', '600');
      label(String(row[1]), rx, yy + rh * 0.6, 12, '#fff', 'right', '700');
    });
    foot(`이어하기 · 봉인 등급 ${tierNo(s.tier || 1)}${s.mode === 'easy' ? ' · 쉬움' : ''}`, '#c8b8ff');
  });
  const b = L.back;
  ctx.fillStyle = 'rgba(20,26,34,0.85)'; (rrPath(b.x, b.y, b.w, b.h, 7), ctx.fill());
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; (rrPath(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 7), ctx.stroke());
  label('← 처음 화면', b.x + b.w / 2, b.y + b.h / 2, 12, '#ccd', 'center', '700');
  if (m.msg) label(m.msg, W / 2, L[0].y - 12, 12, '#ffb0a0', 'center', '700');
  if (m.ask !== undefined) { // 지우기 확인 창
    overlay(0.88);
    label(`프로필 ${m.ask + 1}${m.ask === 1 ? "를" : "을"} 지울까요?`, W / 2, H / 2 - 36, 20, '#fff', 'center', '800');
    label('모은 자원 · 강화 · 해금 · 기록이 모두 사라지고 되돌릴 수 없어요', W / 2, H / 2 - 8, 12, '#ff9a7a', 'center', '700');
    L.ask.forEach((r, i) => {
      const sel = m.askSel === i;
      ctx.fillStyle = sel ? (i ? '#3f8a3b' : '#9a3a2a') : 'rgba(30,36,48,0.95)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
      ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke());
      label(r.name, r.x + r.w / 2, r.y + r.h / 2, 15, '#fff', 'center', '800');
    });
    return;
  }
  const d = Input.state.device;
  if (d !== 'touch' && b.y + b.h + 14 < H - inset.b - 4) label(d === 'gamepad' ? '←→ 고르기 · A 결정 · Y 지우기 · B 돌아가기' : `←→ 고르기 · ${menuKeys().ok} 결정 · 특수 키 지우기 · ${menuKeys().no} 돌아가기`, W / 2, b.y + b.h + 14, 12, '#aab', 'center', '600');
}
// 정령의 첫 선물 연출 (월드 좌표): 하늘에서 금빛 기둥이 내려오고, 그 안으로 빛 구슬이 떨어져 리안 머리 위에서 터진다
const GIFT_FX_DROP = 1.0; // 빛 구슬이 내려와 터지기까지 (초)
function drawGiftFx(f, p) {
  if (!p) return;
  const t = f.t, k = Math.min(1, t / GIFT_FX_DROP), x = p.x, top = p.y - 220, gy = p.y - 20;
  const open = Math.min(1, t / 0.25), fade = f.burst ? Math.max(0, 1 - (t - GIFT_FX_DROP) / 0.4) : 1;
  // 빛기둥
  const w = 26 * open * (0.85 + 0.15 * Math.sin(t * 20));
  const gr = ctx.createLinearGradient(0, top, 0, p.y + 6);
  gr.addColorStop(0, 'rgba(255,224,138,0)'); gr.addColorStop(0.6, `rgba(255,224,138,${0.35 * fade})`); gr.addColorStop(1, `rgba(255,255,230,${0.55 * fade})`);
  ctx.fillStyle = gr; ctx.fillRect(x - w / 2, top, w, p.y + 6 - top);
  ctx.fillStyle = `rgba(255,255,255,${0.5 * fade})`; ctx.fillRect(x - w * 0.15, top, w * 0.3, p.y + 6 - top);
  // 발밑 빛 고리
  ctx.strokeStyle = `rgba(255,210,74,${0.8 * fade})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, p.y + 4, 16 + 4 * Math.sin(t * 8), 5, 0, 0, Math.PI * 2); ctx.stroke();
  if (f.burst) return;
  // 내려오는 빛 구슬 + 도는 별빛
  const e = 1 - Math.pow(1 - k, 2), oy = top + 30 + (gy - top - 30) * e, r = 5 + 3 * k;
  const glow = ctx.createRadialGradient(x, oy, 1, x, oy, r * 4);
  glow.addColorStop(0, 'rgba(255,255,240,1)'); glow.addColorStop(0.3, 'rgba(255,210,74,0.8)'); glow.addColorStop(1, 'rgba(255,210,74,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - r * 4, oy - r * 4, r * 8, r * 8);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { // 십자 반짝임
    const a = t * 4 + i * Math.PI / 2, L = r * 2.6;
    ctx.save(); ctx.translate(x, oy); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -1.2); ctx.lineTo(L, 0); ctx.lineTo(0, 1.2); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (let i = 0; i < 6; i++) { // 둘레를 도는 작은 빛
    const a = t * 6 + i * Math.PI / 3, rr = r * 3.2 * (1 - k * 0.4);
    ctx.fillStyle = i % 2 ? '#ffd24a' : '#fff'; ctx.fillRect(Math.round(x + Math.cos(a) * rr) - 1, Math.round(oy + Math.sin(a) * rr * 0.6) - 1, 2, 2);
  }
}
function overlay(alpha) { ctx.fillStyle = `rgba(5,12,5,${alpha})`; ctx.fillRect(0, 0, W, H); }

// 이번 모험의 봉인 등급과 반발(불리한 규칙)을 아래쪽부터 위로 쌓아 쓴다: 축복 창 · 일시정지 (2026-10-17)
function curseLineText() {
  const ti = G.tierInfo || tierInfo(1);
  return ti.curses.length ? '봉인 등급 ' + tierNo(ti.n) + ' · 반발: ' + ti.curses.map(id => CURSES[id].name + ' (' + CURSES[id].desc + ')').join(' · ') : '봉인 등급 ' + tierNo(ti.n) + ' · 반발 없음';
}
function drawCurseLines(yBottom) {
  const ti = G.tierInfo || tierInfo(1), cl = wrap(curseLineText(), Math.min(W - 40, 760), 11, '600');
  cl.forEach((l, i) => label(l, W / 2, yBottom - (cl.length - 1 - i) * 15, 11, ti.curses.length ? '#ff9a7a' : '#8a96a0', 'center', '600'));
}
// 모험을 시작할 때: 첫 스테이지 이름 띠 아래에 이번 판의 반발을 몇 초 보여 준다
function drawCurseNote() {
  const n = G.curseNote;
  if (!n || n.t <= 0) return;
  n.t -= 1 / 60;
  const ti = G.tierInfo || tierInfo(1);
  if (!ti.curses.length) return;
  ctx.globalAlpha = clamp(Math.min(n.t, 0.5) * 2, 0, 1);
  const big = clamp(Math.min(W, H) * 0.075, 22, 40), y = H * 0.3 + big * 1.55;
  const lines = wrap('봉인의 반발 · ' + ti.curses.map(id => CURSES[id].name + ' (' + CURSES[id].desc + ')').join(' · '), Math.min(W - 40, 700), 12, '700');
  ctx.fillStyle = 'rgba(40,6,6,0.6)'; ctx.fillRect(0, y - 11, W, lines.length * 17 + 6);
  lines.forEach((l, i) => label(l, W / 2, y + i * 17, 12, '#ff9a7a', 'center', '700'));
  ctx.globalAlpha = 1;
}
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

// 배포 사이트 시험 빌드 표시: 진짜 저장과 따로라는 걸 알 수 있게
function drawTestMark() {
  if (!TEST_SAVE) return;
  label('🧪 시험 빌드 · 진짜 저장과 따로 저장돼요', W / 2, H - inset.b - 8, 11, '#ffb84a', 'center', '700');
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

// 숲의 군주 격노 어둠: 보이는 반경(화면 짧은 변의 비율) · 바깥 어둠 진하기
let FOREST_DARK_R = 0.36, FOREST_DARK_A = 0.94;
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = World.pal.bg; ctx.fillRect(0, 0, W, H);
  drawWorld();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textBaseline = 'middle';

  if (G.boss && !G.boss.dead && G.boss.kind === 2 && G.boss.enraged) { // 숲의 군주 격노: 숲이 시든다
    // 숲이 시들어 캄캄해진다: 리안 둘레만 조금 보이고 나머지는 거의 까맣게 (2026-10-18)
    const p = G.player, v = G.view, px = p ? (p.x - v.x) * SCALE : W / 2, py = p ? (p.y - 8 - v.y) * SCALE : H / 2;
    const R = Math.min(W, H) * FOREST_DARK_R;
    const gr = ctx.createRadialGradient(px, py, R * 0.55, px, py, R);
    gr.addColorStop(0, 'rgba(8,0,6,0)'); gr.addColorStop(1, `rgba(8,0,6,${FOREST_DARK_A})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // 보스 공격 예고(빨간 표시)는 어둠 속에서도 빛난다: 안 보이는 데서 맞는 억울함은 없게
    const k = DPR * SCALE;
    ctx.save(); ctx.setTransform(k, 0, 0, k, -v.x * k, -v.y * k); ctx.globalAlpha = 0.85;
    G.boss.drawTelegraph(ctx);
    ctx.restore(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
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
  if (G.giftFlash > 0) { ctx.fillStyle = `rgba(255,248,220,${Math.min(0.75, G.giftFlash * 1.7)})`; ctx.fillRect(0, 0, W, H); G.giftFlash -= 1 / 60; } // 첫 선물이 터질 때

  const blink = Math.sin(G.time * 4) > -0.2;
  const big = clamp(Math.min(W, H) * 0.1, 28, 54);
  const tap = Input.state.device === 'touch' ? '화면을 탭해서' : '아무 버튼이나 눌러서';
  if (G.state === 'title') {
    TitleArt.scene(G.time);
    const logoBottom = TitleArt.drawLogo(W / 2, Math.max(inset.t + 8, H * 0.08), G.time);
    // 시작 화면 이야기 (2026-10-17, A안): 두 문장, 문장마다 줄을 나눈다
    const story = ['어느 밤, 숲의 봉인석이 깨어나 마물을 불러냈다.', '불타는 마을을 뒤로하고, 견습 검사 리안은 작은 정령 루미와 함께 숲으로 향한다.'];
    const lines = story.flatMap(t => wrap(t, Math.min(W * 0.86, 620), 14, '600'));
    lines.forEach((l, i) => label(l, W / 2, logoBottom + 16 + i * 21, 14, '#e8eef8', 'center', '600'));
    if (blink) label(`${tap} 시작`, W / 2, Math.max(H * 0.88, H - inset.b - 36), 20, '#ffd24a');
    label('© 2026 웨폰마스터. All rights reserved.', W / 2, H - inset.b - 10, 10, 'rgba(220,226,240,0.7)', 'center', '600'); // 저작권 표시
  } else if (G.state === 'profiles') {
    TitleArt.scene(G.time);
    drawProfiles(blink);
  } else if (G.state === 'village' || (G.state === 'settings' && G.settingsFrom === 'village')) {
    drawVillage(blink);
    drawTestMark();
  } else if (G.state === 'settings' && G.settingsFrom === 'title') {
    overlay(0.5);
  } else {
    drawHud();
    drawBanner();
    drawCurseNote();
    drawHint();
    drawTestMark();
    if (Input.state.device === 'touch' && G.state === 'play') withAlpha(padAlpha(Input.pointers.size > 0), drawTouchControls); // 가상 패드는 반투명
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
        label(`${G.stage}-${G.sub}까지  ·  처치 ${G.runKills}  ·  축복 ${Object.keys(G.boons).length}개  ·  ⏱ ${fmtRunT(G.runT)}`, W / 2, H * 0.45, 15, '#fff', 'center', '600');
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
        label(`모험 시간 ⏱ ${fmtRunT(G.runT)}`, W / 2, H * 0.495, 13, '#d8e4ff', 'center', '700');
        label(`이번 런 ◆ ${G.runShards}  ·  ⚔ ${G.runEssence}   (끝까지 가면 보상 ×${(rp.tier * DEPTH_CLEAR_MULT * rp.fam).toFixed(2)})`, W / 2, H * 0.54, 13, '#c8a0ff', 'center', '700');
        if (G.clearT > 1.2 && blink) label(`${tap} 세계 ${G.stage + 1}로 (정령의 힘 · 체력 회복)`, W / 2, H * 0.68, 18, '#ffd24a');
      } else {
        label('삼룡을 잠재웠다!', W / 2, H * 0.26, big * 0.85, '#ffe08a');
        label('세계 1부터 6까지, 숲의 모든 봉인을 풀었어요. 축하합니다!', W / 2, H * 0.26 + big * 0.85, 15, '#e8ffd8', 'center', '600');
        label(stats, W / 2, H * 0.48, 13, '#fff', 'center', '600');
        label(`완주 시간 ⏱ ${fmtRunT(G.runT)}` + (G.timeNew ? (G.timePrev ? `   🏆 신기록! (이전 ${fmtRunT(G.timePrev)})` : '   🏆 첫 기록!') : `   (최고 ${fmtRunT(G.timePrev)})`), W / 2, H * 0.525, 15, G.timeNew ? '#ffe08a' : '#d8e4ff', 'center', '800');
        drawRewardResult(H * 0.57);
        const ti = G.tierInfo || tierInfo(1);
        if (G.tierFirst) {
          const reward = ti.emblem ? `✦ 영웅의 증표 +${EMBLEM_PER_CLEAR} (보유 ${Meta.data.emblems}) · 새 무기를 해금할 수 있어요` : '◈ 봉인의 핵은 무기 각성과 함께 받을 수 있어요';
          label(`봉인 등급 ${tierNo(ti.n)} 첫 돌파!  ${reward}`, W / 2, H * 0.57 + 20, 13, '#ffd24a', 'center', '700');
          const nx = tierInfo(ti.n + 1);
          if (ti.n < TIER_MAX) label(`다음 도전: 봉인 등급 ${tierNo(nx.n)} · ${curseText(nx)}`, W / 2, H * 0.57 + 40, 12, '#e8d8ff', 'center', '600');
        } else label(`봉인 등급 ${tierNo(ti.n)} · 이미 완주한 등급이라 첫 돌파 보상은 없어요`, W / 2, H * 0.57 + 20, 12, '#aab', 'center', '600');
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
  if (Meta.data && G.state !== 'title' && G.state !== 'profiles' && G.state !== 'paused' && G.state !== 'settings') Meta.data.playT += dt; // 플레이 시간
  if (G.state === 'play' && G.player) G.runT = (G.runT || 0) + dt; // 모험 진행 시간: 축복 선택 · 대화 · 일시정지 · 클리어 화면에선 멈춤
  Input.update();
  layoutButtons();
  Music.update(dt, musicTarget(), G.state === 'paused' || G.state === 'settings');
  const inp = Input.state;
  const slow = G.slowT > 0 ? 0.3 : 1;

  if (G.state === 'title') {
    G.cam.x = World.pw / 2 + Math.cos(G.time * 0.15) * 300;
    G.cam.y = World.ph / 2 + Math.sin(G.time * 0.2) * 200;
    // 브라우저는 처음 누른 뒤에야 소리를 낸다: 음악이 켜져 있으면 첫 입력은 시작 화면 음악을 틀고, 다음 입력에 출발
    if (inp.start) { if (MUSIC_ON && Input.settings.bgm && !G.titleHeard) { G.titleHeard = true; G.titleT = 0; } else if (!(G.titleT < 0.4)) openProfiles(); }
    G.titleT = (G.titleT || 0) + dt;
  } else if (G.state === 'profiles') {
    G.cam.x = World.pw / 2 + Math.cos(G.time * 0.15) * 300;
    G.cam.y = World.ph / 2 + Math.sin(G.time * 0.2) * 200;
    handleProfileInput(dt, inp);
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
