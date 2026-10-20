'use strict';
// 로그라이트 영구 진행: 정령의 조각(재화), 마을 강화, 본 스토리 기록
// 이 기기(브라우저)에 저장된다.

const UPGRADES = [
  { id: 'hp',     name: '생명력',        max: 5, cost: [20, 35, 55, 80, 110], desc: lv => `최대 체력 +${15 * lv}` },
  { id: 'atk',    name: '공격력',         max: 5, cost: [25, 40, 60, 90, 130], desc: lv => `공격력 +${2 * lv}` },
  { id: 'agi',    name: '날렵한 발',      max: 3, cost: [30, 60, 100],         desc: lv => `대시 쿨타임 -${8 * lv}%` },
  { id: 'bond',   name: '루미와의 유대',  max: 2, cost: [40, 90],              desc: lv => `루미의 위기 회복량 ${Math.round(LUMI_HEAL[lv] * 100)}%${lv >= 2 ? ' + 회복할 때 1초 무적' : ''} (기본 ${Math.round(LUMI_HEAL[0] * 100)}%)` },
  { id: 'choice', name: '정령의 호감',    max: 5, cost: [40, 60, 90, 130, 180], desc: lv => `축복 다시 뽑기 ${lv}회 (런마다)` },
  { id: 'luck',   name: '조각 수집가',    max: 3, cost: [30, 60, 100],         desc: lv => `정령의 조각 획득 +${20 * lv}%` },
  { id: 'gift',   name: '정령의 첫 선물', max: 1, cost: [150],                 desc: () => '모험을 시작할 때 무작위 축복 1개(1레벨)를 받고 출발' }, // 2026-10-17
  { id: 'revive', name: '불굴의 의지',    max: 2, cost: [150, 300],            desc: lv => `런마다 ${lv === 1 ? '한' : '두'} 번, 쓰러져도 체력 40%로 다시 일어난다` }, // 2단계 추가 (2026-10-18)
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
// 루미의 위기 회복: 세계마다 1번, 체력이 25% 아래로 떨어지면 자동. 회복량(최대 체력 비율)은 루미와의 유대 단계로 오른다 (2026-10-17)
const LUMI_HEAL = [0.30, 0.45, 0.60];
const LUMI_GUARD_LV = 2, LUMI_GUARD_T = 1; // 이 단계부터 회복할 때 무적
const SHARD_RATE = 0.6;       // 정령의 조각 획득 배율 (2026-10-17: 1~6세계 한 번에 가면서 너무 많이 모여서)
const SHARD_TOTEM = 2;        // 봉인석 하나 (+ 길 안에서 뒤 세계일수록 2씩 더)
const KILL_DROP_MULT = 0.5;   // 마물 처치로 나오는 조각은 적게 (보상은 봉인석 · 보스 · 깊이로)
const SHARD_BOSS = 4;         // × 세계 번호
const SHARD_ALL_CLEAR = 15;   // 세계 3까지 완주

// 영웅의 증표: 봉인 등급 0~4 를 처음 완주(세계 6 보스)할 때 1개, 모두 5개. 새 무기를 해금하는 데 쓴다 (tiers.js EMBLEM_TIER_MAX).
const EMBLEM_PER_CLEAR = 1;
// 무기의 정수: 모든 무기의 숙련 강화에 쓰는 공통 재화 (어떤 무기로 플레이해도 모인다)
// 무기의 정수: 봉인 등급마다 '처음 넘은 지점'에서만 준다 (이미 받은 스테이지 · 보스는 다시 안 준다). 2026-10-17
// 세계마다 정해진 만큼: 세계 1 = 8개, 세계 2~6 = 10개씩 → 등급 하나 완주 58개 = 무기 하나의 숙련 전부 (2026-10-18)
//   봉인석(스테이지 1~4)과 보스에서 나눠 준다. 배율 · 소수점 없음
const ESSENCE_STONE = [            // [세계][스테이지 1~4]
  [1, 1, 1, 1],                    // 세계 1: 봉인석 4 + 보스 4 = 8
  [1, 1, 1, 2], [1, 1, 1, 2], [1, 1, 1, 2], [1, 1, 1, 2], [1, 1, 1, 2], // 세계 2~6: 봉인석 5 + 보스 5 = 10
];
const ESSENCE_BOSS = [4, 5, 5, 5, 5, 5]; // 세계 1~6 보스

// 테스트 모드: 내 컴퓨터(로컬 서버, 같은 와이파이)에서 실행할 때만 켜진다. 배포된 링크에는 적용되지 않는다.
//   'all'   — 강화·숙련 최대, 무기 전부 해금, 재화 넉넉히
//   'spear' — 처음 상태 그대로, 창만 해금 (창으로 장착해서 시작)
//   null    — 끄기
const DEV_LOCAL = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
const DEV_MODE = DEV_LOCAL ? 'spear' : null; // 로컬에서만 창 해금 (끄려면 null)
// 시험 빌드: 로컬에서 주소 뒤에 ?build=spin 을 붙이면 런을 그 축복들을 가진 채로 시작한다
const TEST_BUILDS = {
  // 공격 축복 개편 시험 (2026-10-18): 잔상 일격 · 회전 연참 · 특수 강화 · 다단히트 모두 3레벨 (?build=might_sword 등). 무기 전부 해금이라 마을에서 바꿔도 된다
  // 속성별 기본 · 차지 · 특수 · 대시 축복 모두 3레벨 (2026-10-18): ?build=el_fire / el_ice / el_elec / el_poison (무기 전부 해금)
  el_fire: { weapon: 'sword', mastery: {}, all: true, boons: { fire_basic: 3, fire_charge: 3, fire_special: 3, fire_dash: 3 } },
  el_ice: { weapon: 'sword', mastery: {}, all: true, boons: { ice_basic: 3, ice_charge: 3, ice_special: 3, ice_dash: 3 } },
  el_elec: { weapon: 'sword', mastery: {}, all: true, boons: { elec_basic: 3, elec_charge: 3, elec_special: 3, elec_dash: 3 } },
  el_poison: { weapon: 'sword', mastery: {}, all: true, boons: { poison_basic: 3, poison_charge: 3, poison_special: 3, poison_dash: 3 } },
  // 투창 반환점 속성 이펙트 시험 (2026-10-18): ?build=spear_fire / spear_elec / spear_ice / spear_poison
  spear_fire:   { weapon: 'spear', mastery: {}, all: true, boons: { fire_special: 3 } },
  spear_elec:   { weapon: 'spear', mastery: {}, all: true, boons: { elec_special: 3 } },
  spear_ice:    { weapon: 'spear', mastery: {}, all: true, boons: { ice_special: 3 } },
  spear_poison: { weapon: 'spear', mastery: {}, all: true, boons: { poison_special: 3 } },
  might_sword: { weapon: 'sword', mastery: {}, all: true, boons: { atk_combo: 3, atk_multispin: 3, atk_wave: 3, atk_thrust: 3 } },
  might_spear: { weapon: 'spear', mastery: {}, all: true, boons: { atk_combo: 3, atk_multispin: 3, atk_wave: 3, atk_thrust: 3 } },
  might_sai: { weapon: 'sai', mastery: {}, all: true, boons: { atk_combo: 3, atk_multispin: 3, atk_wave: 3, atk_thrust: 3 } },
  might_staff: { weapon: 'staff', mastery: {}, all: true, boons: { atk_combo: 3, atk_multispin: 3, atk_wave: 3, atk_thrust: 3 } },
  might_shield: { weapon: 'shield', mastery: {}, all: true, boons: { atk_combo: 3, atk_multispin: 3, atk_wave: 3, atk_thrust: 3 } },
  // 회전베기 최강: 회전 연참 · 일섬 회전 · 빙결 회오리 · 파쇄 · 수호의 회전 · 날카로운 검 · 급소 · 연속 타격 (+ 회전베기 숙련 3)
  spin: { weapon: 'sword', mastery: { spin: 3 }, boons: { atk_multispin: 3, ice_charge: 3, shatter: 3, guard_spin: 3, sharp: 3, vital: 3, ambush: 3 } },
  // 화염 팽이: 회전 연참 · 일섬 회전 · 화염 회오리(Lv5) · 불씨 · 연쇄 폭발 · 수호의 회전 · 날카로운 검 · 급소 (+ 회전베기 숙련 3)
  firespin: { weapon: 'sword', mastery: { spin: 3 }, boons: { atk_multispin: 3, fire_charge: 5, kindling: 3, chain_burst: 3, guard_spin: 3, sharp: 3, vital: 3 } },
  // 검기 최강: 거대 검기 · 벼락 검기 · 고전압 · 치유의 검기 · 날카로운 검 · 급소 (+ 섬광 검기 숙련 3)
  wave: { weapon: 'sword', mastery: { wave: 3 }, boons: { atk_wave: 3, elec_special: 3, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3 } },
  // 기본공격 번개: 번개 칼날 · 연쇄 번개 · 날벼락 · 고전압 · 연격 · 날카로운 검 · 급소 · 연속 타격 (+ 연속베기 숙련 3)
  // 창 투척: 투척 강화 · 피뢰 창 · 고전압 · 치유의 회수 · 날카로운 창 · 급소 (+ 투척 숙련 3)
  throw: { weapon: 'spear', mastery: { wave: 3 }, boons: { atk_wave: 3, elec_special: 3, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3 } },
  // 투창 마스터: 피뢰 창(Lv5) · 투척 강화 · 고전압 · 치유의 회수 · 날카로운 창 · 급소 · 기습 (+ 투척 숙련 3)
  javelin: { weapon: 'spear', mastery: { wave: 3 }, boons: { elec_special: 5, atk_wave: 3, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3, ambush: 3 } },
  // 4세계 시험: 늪(물고기 · 나방)부터 바로 (?build=swamp)
  swamp: { weapon: 'sword', mastery: {}, boons: {}, world: 4 },
  // 마법봉 첫 손맛 / 난사 빌드: 마력 증폭 · 벼락 마력탄(Lv5) · 마력탄 숙련 3 · 고전압
  staff: { weapon: 'staff', mastery: {}, boons: {} },
  // 사냥꾼의 활 (2026-10-20): ?build=bow (축복 없음) · bow_trap (덫 유인 3 · 물러서기 3 · 잔상 · 연환) — 속성은 ?build=el_fire&w=bow 처럼
  bow: { weapon: 'bow', mastery: {}, all: true, boons: {} },
  bow_trap: { weapon: 'bow', mastery: {}, all: true, boons: { atk_wave: 3, atk_thrust: 3, atk_combo: 3, atk_multispin: 3 } },
  // 방패 첫 손맛 (?build=shield)
  shield: { weapon: 'shield', mastery: {}, boons: {} },
  // 체인라이트닝 도사: 벼락 마력탄 · 연쇄 마력탄 Lv5 · 고전압 · 날벼락 · 마력 증폭 (+ 마력탄 숙련 3)
  // 화염 마법사: 화염 마력탄 · 화염구 마력탄 Lv5 · 불씨 · 연쇄 폭발 · 마력 증폭 (+ 마력탄 숙련 3)
  flame: { weapon: 'staff', mastery: { wave: 3 }, boons: { fire_special: 5, fire_bolt: 5, kindling: 3, chain_burst: 3, atk_wave: 3, sharp: 3, vital: 3 } },
  // 얼음 마법사: 서리 마력탄 · 얼음 파편 마력탄 Lv5 · 파쇄 · 한기 · 마력 증폭 (+ 마력탄 숙련 3)
  frost: { weapon: 'staff', mastery: { wave: 3 }, boons: { ice_special: 5, ice_shard: 5, shatter: 3, frostbite: 3, atk_wave: 3, sharp: 3, vital: 3 } },
  // 얼음 창: 서리 창날 · 빙결 관통 · 서리 꿰뚫기 · 서리 창 · 얼음 길 · 파쇄 · 한기
  icespear: { weapon: 'spear', mastery: { combo: 3, spin: 3 }, boons: { ice_basic: 5, ice_shard: 5, ice_charge: 5, ice_special: 5, ice_dash: 3, shatter: 3, frostbite: 3, sharp: 3 } },
  // 화염 창: 불꽃 창날 · 화염 관통 · 불꽃 꿰뚫기 · 폭염 투척 · 화염 질주 · 불씨 · 연쇄 폭발
  firespear: { weapon: 'spear', mastery: { combo: 3, spin: 3 }, boons: { fire_basic: 5, fire_bolt: 5, fire_charge: 5, fire_special: 5, fire_dash: 3, kindling: 3, chain_burst: 3, sharp: 3 } },
  // 얼음 쌍검: 서리 쌍검 · 얼음 파편 연타 · 빙결 연참 · 서리 받아치기 · 얼음 길 · 파쇄 · 한기
  icesai: { weapon: 'sai', mastery: { combo: 3, spin: 3 }, boons: { ice_basic: 5, ice_shard: 5, ice_charge: 5, ice_special: 5, ice_dash: 3, shatter: 3, frostbite: 3, sharp: 3 } },
  // 얼음 검: 서리 칼날 · 얼음 파편 · 빙결 회오리 · 빙창 검기 · 얼음 길 · 파쇄 · 한기
  icesword: { weapon: 'sword', mastery: { combo: 3, spin: 3 }, boons: { ice_basic: 5, ice_shard: 5, ice_charge: 5, ice_special: 5, ice_dash: 3, shatter: 3, frostbite: 3, sharp: 3 } },
  chain: { weapon: 'staff', mastery: { wave: 3 }, boons: { elec_special: 5, elec_chain: 5, overcharge: 3, static: 3, atk_wave: 3, sharp: 3, vital: 3 } },
  barrage: { weapon: 'staff', mastery: { wave: 3 }, boons: { atk_wave: 3, elec_special: 5, overcharge: 3, heal_wave: 3, sharp: 3, vital: 3 } },
  // 쌍검 첫 손맛: 축복 없이 무기만 (숙련도 0)
  sai: { weapon: 'sai', mastery: {}, boons: {} },
  // 쌍검 연참 빌드: 화염 연참 · 그림자 분신 · 연참 강화 · 불꽃 쌍검 · 연속 베기 · 수호의 연참
  rush: { weapon: 'sai', mastery: { spin: 3 }, boons: { fire_charge: 3, atk_multispin: 3, fire_basic: 3, atk_combo: 3, guard_spin: 3, sharp: 3 } },
  // 쌍검 받아치기 빌드: 벼락 받아치기 · 받아치기 강화 · 치유의 받아치기 · 급소
  parry: { weapon: 'sai', mastery: { wave: 3 }, boons: { elec_special: 3, atk_wave: 3, heal_wave: 3, vital: 3, overcharge: 3, sharp: 3 } },
  bolt: { weapon: 'sword', mastery: { combo: 3 }, boons: { elec_basic: 3, elec_chain: 3, static: 3, overcharge: 3, atk_combo: 3, sharp: 3, vital: 3, ambush: 3 } },
};
// 선물 링크 (?gift=코드): 프로필마다 코드 하나에 한 번만 받는다
//   sealpass: 동료용 '전체 해금' 자원 (2026-10-17) — 공통 강화 전부(조각 약 1,955) · 무기 해금(증표 4) · 숙련 전부(정수 290)를 살 수 있는 양
const GIFTS = {
  lumi1017: { emblems: 10 },
  sealpass: { shards: 2000, essence: 300, emblems: 5 },
};
// 시험 빌드 (?build=sai 등): 로컬과 배포 사이트 모두. 배포 사이트에서는 진짜 저장을 건드리지 않게 따로 저장한다 (2026-10-17, 휴대폰 시험용)
const DEV_BUILD = (() => { // &w=spear 처럼 붙이면 그 무기로 (속성 시험 빌드를 무기마다 보려고, 2026-10-18)
  const q = new URLSearchParams(location.search), b = TEST_BUILDS[q.get('build')], w = q.get('w');
  return b ? (w ? Object.assign({}, b, { weapon: w }) : b) : null;
})();
const TEST_SAVE = !!DEV_BUILD && !DEV_LOCAL;

// 프로필(저장 칸) 3개. 1번은 예전 저장 이름 그대로 'meta' (2026-10-17)
const SAVE_SLOTS = 3;
const slotKey = n => (n === 1 ? 'meta' : 'meta' + n);
// 누적 자원이 없던 예전 저장: 지금 가진 것 + 강화 · 숙련 · 해금에 쓴 것으로 어림한다
function estTotals(d) {
  const sum = (arr, lv) => arr.slice(0, lv || 0).reduce((a, b) => a + b, 0);
  let shards = d.shards || 0, essence = typeof d.essence === 'number' ? d.essence : Object.values(d.essence || {}).reduce((a, b) => a + b, 0), emblems = d.emblems || 0;
  for (const u of UPGRADES) shards += sum(u.cost, (d.up || {})[u.id]);
  for (const [w, ms] of Object.entries(d.wup || {})) {
    const W0 = WEAPONS[w === 'gauntlet' ? 'sai' : w]; if (!W0) continue;
    for (const m of W0.mastery) essence += sum(m.cost, ms[m.id]);
  }
  for (const w of d.unlocked || []) emblems += (WEAPONS[w === 'gauntlet' ? 'sai' : w] || {}).unlockCost || 0;
  return { shards, essence, emblems };
}

const Meta = {
  data: null, slot: 1,
  // 프로필 고르는 화면용: 그 칸의 진행 상황 (비었으면 null)
  summary(n) {
    const d = store.get(slotKey(n));
    if (!d) return null;
    const e = estTotals(d);
    return {
      runs: d.runs || 0, clears: d.clears || 0, best: d.best || 0, bestEasy: d.bestEasy || 0, tier: d.tier || 1, mode: d.mode,
      unlocked: (d.unlocked || ['sword']).length, playT: d.playT || 0,
      totShards: d.totShards ?? e.shards, totEssence: d.totEssence ?? e.essence, totEmblems: d.totEmblems ?? e.emblems,
    };
  },
  // 프로필 지우기: 그 칸의 저장을 없앤다. 지금 불러온 칸이면 빈 상태로 다시 불러 둔다
  wipe(n) {
    store.del(slotKey(n));
    if (n === this.slot) { this.load(n); store.del(slotKey(n)); }
  },
  load(slot) {
    this.slot = clamp(slot || +store.get('slot') || 1, 1, SAVE_SLOTS);
    let d = store.get(slotKey(this.slot)) || {};
    // 전체 해금 모드로 쓰던 저장은 다른 모드에서 처음 상태로 되돌린다
    if (DEV_LOCAL && DEV_MODE !== 'all' && (d.devAll || d.shards >= 9999)) d = {};
    // 로컬 테스트(창 해금 · 시험 빌드 숙련)로 쓰던 저장은 일반 모드로 돌아올 때 한 번 처음 상태로 (배포된 게임 저장은 건드리지 않는다)
    if (DEV_LOCAL && !DEV_MODE && !DEV_BUILD && !d.normal1) d = {};
    if (DEV_BUILD) d.normal1 = false;
    const est = estTotals(d);
    this.data = {
      shards: d.shards || 0, up: d.up || {}, seen: d.seen || {},
      runs: d.runs || 0, best: d.best || 0, clears: d.clears || 0,
      mode: d.mode === 'easy' ? 'easy' : 'normal', // 난이도: 쉬움은 받는 피해 1/3 (보상은 같다)
      bestEasy: d.bestEasy || 0,                   // 쉬움 모드 최고 기록 (일반과 따로)
      tier: d.tier || 1,                           // 고른 봉인 등급
      // 처음 깬 봉인 등급들 { 1: true, ... } (예전 저장: 한 번이라도 완주했으면 등급 1을 깬 것으로)
      tierCleared: d.tierCleared || (d.clears ? { 1: true } : {}),
      essBest: d.essBest || {}, // 봉인 등급별로 정수를 받은 가장 먼 지점 (스테이지 번호, 완주 = 31)
      midEmblem: !!d.midEmblem, // 세계 3 보스 증표를 받았나
      tiers7: !!d.tiers7,      // 7등급(1~6세계 한 번에) 구조로 옮긴 저장인가
      emblems: d.emblems || 0,
      gifts: d.gifts || [],     // 이미 쓴 선물 코드
      weapon: d.weapon || 'sword', unlocked: d.unlocked || ['sword'],
      wup: d.wup || {},          // 무기별 숙련: { sword: { combo: 2, ... } }
      wstats: d.wstats || {},    // 무기별 완주 기록: { sword: { clears: 3, best: 2 } } (best = 봉인 등급, 안에서 세는 1~8). 2026-10-18 부터 센다
      // 무기의 정수 (예전 저장의 무기별 정수 { sword: 12, spear: 3 } 은 합쳐서 옮긴다)
      normal1: d.normal1 !== false && !DEV_BUILD, // 로컬 일반 모드로 시작한 저장 표시
      essence: typeof d.essence === 'number' ? d.essence : Object.values(d.essence || {}).reduce((a, b) => a + b, 0),
      // 지금까지 모은 자원 (쓴 것 포함) · 플레이 시간(초): 프로필 화면에 보인다
      totShards: d.totShards ?? est.shards, totEssence: d.totEssence ?? est.essence, totEmblems: d.totEmblems ?? est.emblems,
      playT: d.playT || 0,
    };
    // 건틀릿은 쌍검으로 바뀌었다 (2026-10-17): 해금 · 장착 · 숙련을 그대로 옮긴다
    { const D = this.data;
      D.unlocked = D.unlocked.map(w => (w === 'gauntlet' ? 'sai' : w));
      if (D.weapon === 'gauntlet') D.weapon = 'sai';
      if (D.wup.gauntlet) { D.wup.sai = D.wup.sai || D.wup.gauntlet; delete D.wup.gauntlet; } }
    // 예전 구조(바깥 숲 1~3 / 깊은 숲 4~6, 13등급)에서 옮겨 온 저장: 등급 기록은 처음부터, 이미 받은 바깥 숲 증표는 세계 3 증표로 친다
    if (!this.data.tiers7) {
      const old = this.data.tierCleared;
      this.data.midEmblem = !!(old[1] || this.data.emblems || this.data.unlocked.length > 1);
      this.data.tierCleared = {};
      this.data.tier = 1;
      this.data.tiers7 = true;
    }
    // 선물 코드 (?gift=코드): 이 기기의 진짜 저장(지금 프로필)에 한 번만 넣는다
    const giftCode = new URLSearchParams(location.search).get('gift'), gift = GIFTS[giftCode];
    if (!TEST_SAVE && gift && !this.data.gifts.includes(giftCode)) {
      const d = this.data;
      d.gifts.push(giftCode);
      d.shards += gift.shards || 0; d.totShards += gift.shards || 0;
      d.essence += gift.essence || 0; d.totEssence += gift.essence || 0;
      d.emblems += gift.emblems || 0; d.totEmblems += gift.emblems || 0;
      const got = [gift.shards && `◆ 정령의 조각 ${gift.shards}`, gift.essence && `⚔ 무기의 정수 ${gift.essence}`, gift.emblems && `✦ 영웅의 증표 ${gift.emblems}`].filter(Boolean).join(' · ');
      this.giftNote = `선물을 받았어요! ${got}`;
      this.save();
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
    }
    if (DEV_MODE === 'all') this.unlockAll();
    if (DEV_MODE === 'spear' && !this.data.unlocked.includes('spear')) {
      this.data.unlocked.push('spear'); this.data.weapon = 'spear';
    }
    if (DEV_BUILD) { // 시험 빌드: 무기 · 숙련 맞추기
      const d = this.data;
      if (!d.unlocked.includes(DEV_BUILD.weapon)) d.unlocked.push(DEV_BUILD.weapon);
      if (DEV_BUILD.all) for (const id of WEAPON_ORDER) if (!d.unlocked.includes(id)) d.unlocked.push(id); // 무기 전부 해금: 마을에서 무기를 바꿔도 같은 축복으로 시작 (2026-10-18)
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
  save() { store.set(slotKey(this.slot), this.data); store.set('slot', this.slot); },
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
