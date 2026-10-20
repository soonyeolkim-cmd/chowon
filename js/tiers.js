'use strict';
// 봉인 등급: 한 번의 모험으로 세계 1~6을 모두 지나야 완주. 처음 완주하면 다음 등급이 열린다.
// 등급이 오를수록 '봉인의 반발'(불리한 규칙)이 하나씩 더 붙는다. 대신 보상 배율이 오른다.
//   등급 0 = 반발 없음, 등급 7 = 반발 7개 전부
//   화면에 보이는 번호는 0부터 (tierNo). 안에서는 1~8로 그대로 센다 (세이브 호환, 2026-10-18)
//   영웅의 증표: 봉인 등급 0~4 를 처음 완주할 때마다 1개 (모두 5개, 2026-10-18). 등급 5 부터는 봉인의 핵 (무기 각성, 예정)
// 쉬움 모드로 깨도 모두 인정된다.

const ROUTES = {
  all: { name: '봉인의 숲', ready: true, worlds: [1, 2, 3, 4, 5, 6] },
};

const CURSES = {
  hp:    { name: '단단한 마물',   desc: '마물 체력 +20%' },
  wave:  { name: '끝없는 부름',   desc: '봉인석 웨이브 +1' },
  dmg:   { name: '날카로운 이빨', desc: '마물 공격력 +15%' },
  volley: { name: '빗발치는 화살', desc: '원거리 마물이 줄지 않고 모두 나온다' },
  swift: { name: '성난 사수',     desc: '원거리 마물 공격 간격 -20%' },
  rage:  { name: '분노한 주인',   desc: '보스가 처음부터 격노' },
  heal:  { name: '메마른 숲',     desc: '회복량 절반' },
  // 등급 8 ~ 10 (2026-10-20): 무기 6종 각성(봉인의 핵 6개)에 맞춰 3단계 추가. 조금씩만 어려워지게
  fast:  { name: '재빠른 마물',   desc: '근접 마물 이동속도 +15%' },
  elite: { name: '정예의 습격',   desc: '웨이브마다 정예 마물 1마리 (체력 2.5배)' },
  guard: { name: '깨어난 수호자', desc: '보스 체력 +25% · 공격 예고 -15%' },
};
const CURSE_ORDER = ['hp', 'wave', 'dmg', 'volley', 'swift', 'rage', 'heal', 'fast', 'elite', 'guard']; // volley 추가 2026-10-18 · fast · elite · guard 추가 2026-10-20 (등급 0 ~ 10)
const TIER_MAX = 1 + CURSE_ORDER.length; // 11 (화면 번호 0 ~ 10)

// 영웅의 증표는 봉인 등급 0~4 (안에서 세는 1~5) 첫 완주에서만: 모두 5개 = 무기 5종 해금에 딱 맞게 (2026-10-18)
// 그보다 높은 등급의 첫 완주 보상은 무기 각성 재료 '봉인의 핵' (각성과 함께 넣을 예정 — 그때 tierCleared 를 보고 이미 깬 등급 몫을 소급해서 준다)
const EMBLEM_TIER_MAX = 5;
// 무기의 정수는 봉인 등급 0~5 (안에서 세는 1~6) 에서만: 등급당 58 × 6 = 348 = 무기 6종 숙련 전부, 남는 정수 0 (2026-10-20)
const ESSENCE_TIER_MAX = 6;
function tierInfo(n) {
  const curses = CURSE_ORDER.slice(0, n - 1);
  return { n, route: 'all', curses, emblem: n <= EMBLEM_TIER_MAX, bonusShards: 0, rewardMult: 1 + 0.3 * (n - 1) };
}

// 익숙한 숲: 내가 처음 깬 가장 높은 등급보다 2단계 이상 낮은 등급을 돌면 보상 절반
const FAMILIAR_MULT = 0.5;
const maxClearedTier = () => Object.keys(Meta.data.tierCleared).reduce((m, k) => Math.max(m, +k), 0);
const familiarMult = n => (maxClearedTier() - n >= 2 ? FAMILIAR_MULT : 1);
// 깊이 보너스: 이번 런에서 멀리 갈수록 (세계 1 ~ 6, 완주)
const DEPTH_MULT = [1.0, 1.15, 1.3, 1.45, 1.6, 1.75];
const DEPTH_CLEAR_MULT = 2.0;

// 등급이 열렸는가: 바로 아래 등급을 완주했을 때
function tierOpen(n) {
  if (n <= 1) return true;
  if (n > TIER_MAX) return false;
  return !!Meta.data.tierCleared[n - 1];
}
const tierPlayable = n => tierOpen(n);
// 고를 수 있는 등급 목록
function playableTiers() {
  const list = [];
  for (let n = 1; n <= TIER_MAX; n++) if (tierPlayable(n)) list.push(n);
  return list;
}
const tierNo = n => n - 1; // 화면에 보이는 봉인 등급 번호 (0부터)
const curse = id => !!(G.tierCurses && G.tierCurses.includes(id));
const curseText = info => (info.curses.length ? info.curses.map(id => `${CURSES[id].name}(${CURSES[id].desc})`).join(', ') : '반발 없음');
