'use strict';
// 로그라이트 영구 진행: 정령의 조각(재화), 마을 강화, 본 스토리 기록
// 이 기기(브라우저)에 저장된다.

const UPGRADES = [
  { id: 'hp',     name: '생명력',        max: 5, cost: [20, 35, 55, 80, 110], desc: lv => `최대 체력 +${15 * lv}` },
  { id: 'atk',    name: '공격력',         max: 5, cost: [25, 40, 60, 90, 130], desc: lv => `공격력 +${2 * lv}` },
  { id: 'agi',    name: '날렵한 발',      max: 3, cost: [30, 60, 100],         desc: lv => `대시 쿨타임 -${8 * lv}%` },
  { id: 'bond',   name: '루미와의 유대',  max: 2, cost: [40, 90],              desc: lv => `위기 때 루미의 회복 +${lv}회 (세계마다)` },
  { id: 'choice', name: '정령의 호감',    max: 5, cost: [40, 60, 90, 130, 180], desc: lv => `축복 다시 뽑기 ${lv}회 (런마다)` },
  { id: 'luck',   name: '조각 수집가',    max: 3, cost: [30, 60, 100],         desc: lv => `정령의 조각 획득 +${20 * lv}%` },
  { id: 'revive', name: '불굴의 의지',    max: 1, cost: [150],                 desc: () => '런마다 한 번, 쓰러져도 체력 40%로 다시 일어난다' },
];

// 런 시작 기본 능력치 (레벨이 없으니 처음부터 이만큼)
const BASE_HP = 100;
const BASE_ATK = 14;

// 정령의 조각 보상 — 강화 전체(1,385)를 모으려면 조각 수집가를 포함해도 10번 이상 완주하도록 맞춘 값
// 적 처치: 종류별 확률로 1개
const SHARD_DROP = { // 마물이 많은 만큼 확률은 낮게
  slime: 0.055, bat: 0.055, mushroom: 0.06, mole: 0.06,
  racoon: 0.06, bear: 0.16, snake: 0.06, owl: 0.06,
  shield: 0.11, skull: 0.07, eye: 0.1, flam: 0.07, orc: 0.18,
  kappa: 0.07, axolot: 0.07, spider: 0.07, mollusc: 0.14, tadpole: 0.02, bigslime: 0.1,
  lion: 0.08, trex: 0.14, cyclops2: 0.12, lizard: 0.07,
  demon: 0.12, lantern: 0.08, statue: 0.14, babydragon: 0.08, dragon: 1,
};
const SHARD_TOTEM = 2;        // 봉인석 하나 (+ 길 안에서 뒤 세계일수록 2씩 더)
const KILL_DROP_MULT = 0.5;   // 마물 처치로 나오는 조각은 적게 (보상은 봉인석 · 보스 · 깊이로)
const SHARD_BOSS = 4;         // × 세계 번호
const SHARD_ALL_CLEAR = 15;   // 세계 3까지 완주

// 영웅의 증표: 최종 보스(세계 3)를 쓰러뜨릴 때마다 1개. 새 무기를 해금하는 데 쓴다.
const EMBLEM_PER_CLEAR = 1;
// 무기의 정수: 모든 무기의 숙련 강화에 쓰는 공통 재화 (어떤 무기로 플레이해도 모인다)
const ESSENCE_RATE = 0.1;           // 무기의 정수 획득 배율 (2026-10-17: 10분의 1로). 소수점은 모아 뒀다가 1이 되면 준다
const ESSENCE_STAGE = 1;            // 스테이지 클리어
const ESSENCE_BOSS = [3, 5, 8, 8, 11, 15]; // 세계 1~6 보스
const ESSENCE_ALL_CLEAR = 5;        // 완주 보너스

// 테스트 모드: 내 컴퓨터(로컬 서버, 같은 와이파이)에서 실행할 때만 켜진다. 배포된 링크에는 적용되지 않는다.
//   'all'   — 강화·숙련 최대, 무기 전부 해금, 재화 넉넉히
//   'spear' — 처음 상태 그대로, 창만 해금 (창으로 장착해서 시작)
//   null    — 끄기
const DEV_LOCAL = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
const DEV_MODE = DEV_LOCAL ? 'spear' : null; // 로컬에서만 창 해금 (끄려면 null)
// 시험 빌드: 로컬에서 주소 뒤에 ?build=spin 을 붙이면 런을 그 축복들을 가진 채로 시작한다
const TEST_BUILDS = {
  // 회전베기 최강: 회전 연참 · 일섬 회전 · 빙결 회오리 · 파쇄 · 수호의 회전 · 날카로운 검 · 급소 · 연속 타격 (+ 회전베기 숙련 3)
  spin: { weapon: 'sword', mastery: { spin: 3 }, boons: { atk_multispin: 3, atk_spin: 3, ice_charge: 3, shatter: 3, guard_spin: 3, sharp: 3, vital: 3, ambush: 3 } },
  // 검기 최강: 거대 검기 · 뇌격 검기 · 과충전 · 치유의 검기 · 날카로운 검 · 급소 (+ 섬광 검기 숙련 3)
  wave: { weapon: 'sword', mastery: { wave: 3 }, boons: { atk_wave: 3, elec_special: 3, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3 } },
  // 기본공격 번개: 번개 칼날 · 연쇄 번개 · 정전기 · 과충전 · 연격 · 날카로운 검 · 급소 · 연속 타격 (+ 연속베기 숙련 3)
  // 창 투척: 투척 강화 · 피뢰 창 · 과충전 · 치유의 회수 · 날카로운 창 · 급소 (+ 투척 숙련 3)
  throw: { weapon: 'spear', mastery: { wave: 3 }, boons: { atk_wave: 3, elec_special: 3, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3 } },
  bolt: { weapon: 'sword', mastery: { combo: 3 }, boons: { elec_basic: 3, elec_chain: 3, static: 3, overcharge: 3, atk_combo: 3, sharp: 3, vital: 3, ambush: 3 } },
};
const DEV_BUILD = DEV_LOCAL ? TEST_BUILDS[new URLSearchParams(location.search).get('build')] || null : null;

const Meta = {
  data: null,
  load() {
    let d = store.get('meta') || {};
    // 전체 해금 모드로 쓰던 저장은 다른 모드에서 처음 상태로 되돌린다
    if (DEV_LOCAL && DEV_MODE !== 'all' && (d.devAll || d.shards >= 9999)) d = {};
    // 로컬 테스트(창 해금 · 시험 빌드 숙련)로 쓰던 저장은 일반 모드로 돌아올 때 한 번 처음 상태로 (배포된 게임 저장은 건드리지 않는다)
    if (DEV_LOCAL && !DEV_MODE && !DEV_BUILD && !d.normal1) d = {};
    if (DEV_BUILD) d.normal1 = false;
    this.data = {
      shards: d.shards || 0, up: d.up || {}, seen: d.seen || {},
      runs: d.runs || 0, best: d.best || 0, clears: d.clears || 0,
      mode: d.mode === 'easy' ? 'easy' : 'normal', // 난이도: 쉬움은 받는 피해 1/3 (보상은 같다)
      bestEasy: d.bestEasy || 0,                   // 쉬움 모드 최고 기록 (일반과 따로)
      tier: d.tier || 1,                           // 고른 봉인 등급
      // 처음 깬 봉인 등급들 { 1: true, ... } (예전 저장: 한 번이라도 완주했으면 등급 1을 깬 것으로)
      tierCleared: d.tierCleared || (d.clears ? { 1: true } : {}),
      emblems: d.emblems || 0,
      weapon: d.weapon || 'sword', unlocked: d.unlocked || ['sword'],
      wup: d.wup || {},          // 무기별 숙련: { sword: { combo: 2, ... } }
      // 무기의 정수 (예전 저장의 무기별 정수 { sword: 12, spear: 3 } 은 합쳐서 옮긴다)
      normal1: d.normal1 !== false && !DEV_BUILD, // 로컬 일반 모드로 시작한 저장 표시
      essence: typeof d.essence === 'number' ? d.essence : Object.values(d.essence || {}).reduce((a, b) => a + b, 0),
    };
    if (DEV_MODE === 'all') this.unlockAll();
    if (DEV_MODE === 'spear' && !this.data.unlocked.includes('spear')) {
      this.data.unlocked.push('spear'); this.data.weapon = 'spear';
    }
    if (DEV_BUILD) { // 시험 빌드: 무기 · 숙련 맞추기
      const d = this.data;
      if (!d.unlocked.includes(DEV_BUILD.weapon)) d.unlocked.push(DEV_BUILD.weapon);
      d.weapon = DEV_BUILD.weapon;
      Object.assign(d.wup[DEV_BUILD.weapon] || (d.wup[DEV_BUILD.weapon] = {}), DEV_BUILD.mastery);
    }
  },
  // 테스트용: 강화·숙련 최대, 무기 전부 해금, 재화 넉넉히
  unlockAll() {
    const d = this.data;
    for (const u of UPGRADES) d.up[u.id] = u.max;
    for (const id of WEAPON_ORDER) {
      if (!d.unlocked.includes(id)) d.unlocked.push(id);
      const w = d.wup[id] || (d.wup[id] = {});
      for (const m of WEAPONS[id].mastery) w[m.id] = m.max;

    }
    d.shards = Math.max(d.shards, 9999);
    d.emblems = Math.max(d.emblems, 99);
    d.essence = Math.max(d.essence, 999);
    d.devAll = true;
  },
  // 무기 숙련 단계
  wlv(weapon, id) { return (this.data.wup[weapon] && this.data.wup[weapon][id]) || 0; },
  wNextCost(weapon, m) { const lv = this.wlv(weapon, m.id); return lv >= m.max ? null : m.cost[lv]; },
  ess() { return this.data.essence; },
  buyMastery(weapon, m) {
    const c = this.wNextCost(weapon, m);
    if (c === null || this.ess(weapon) < c) return false;
    this.data.essence -= c;
    const w = this.data.wup[weapon] || (this.data.wup[weapon] = {});
    w[m.id] = (w[m.id] || 0) + 1;
    this.save();
    return true;
  },
  save() { store.set('meta', this.data); },
  lv(id) { return this.data.up[id] || 0; },
  nextCost(u) { const lv = this.lv(u.id); return lv >= u.max ? null : u.cost[lv]; },
  buy(u) {
    const c = this.nextCost(u);
    if (c === null || this.data.shards < c) return false;
    this.data.shards -= c;
    this.data.up[u.id] = this.lv(u.id) + 1;
    this.save();
    return true;
  },
  // 런 시작 능력치
  startStats() {
    return { lv: 1, xp: 0, maxHp: BASE_HP + 15 * this.lv('hp'), atk: BASE_ATK + 2 * this.lv('atk'), boons: {} };
  },
};
