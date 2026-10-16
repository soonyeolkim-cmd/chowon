'use strict';
// 봉인 등급: 처음 깨면 다음 등급이 열린다. 바깥 숲과 깊은 숲을 번갈아 오르고,
// 등급이 오를수록 '봉인의 반발'(불리한 규칙)이 하나씩 더 붙는다. 대신 보상 배율이 오른다.
//   홀수 등급 = 바깥 숲(세계 1~3), 짝수 등급 = 깊은 숲(세계 4~6)
//   영웅의 증표는 '처음 깰 때만': 등급 1(바깥 숲)과 모든 깊은 숲 등급. 나머지 바깥 숲 등급은 조각 보너스.
// 쉬움 모드로 깨도 모두 인정된다.

const ROUTES = {
  outer: { name: '바깥 숲', ready: true },
  deep:  { name: '깊은 숲', ready: false }, // 세계 4~6을 만들면 true
};

const CURSES = {
  hp:    { name: '단단한 마물',   desc: '마물 체력 +20%' },
  wave:  { name: '끝없는 부름',   desc: '봉인석 웨이브 +1' },
  dmg:   { name: '날카로운 이빨', desc: '마물 공격력 +15%' },
  swift: { name: '성난 사수',     desc: '원거리 마물 공격 간격 -20%' },
  rage:  { name: '분노한 주인',   desc: '보스가 처음부터 격노' },
  heal:  { name: '메마른 숲',     desc: '회복량 절반' },
};
const CURSE_ORDER = ['hp', 'wave', 'dmg', 'swift', 'rage', 'heal'];
const TIER_MAX = 1 + 2 * CURSE_ORDER.length; // 13

function tierInfo(n) {
  const route = n % 2 === 1 ? 'outer' : 'deep';
  const curses = CURSE_ORDER.slice(0, Math.floor((n - 1) / 2));
  const emblem = n === 1 || route === 'deep';
  return { n, route, curses, emblem, bonusShards: emblem ? 0 : 20 + 10 * n, rewardMult: 1 + 0.15 * (n - 1) };
}

// 등급이 열렸는가: 바로 아래 등급을 깼거나, 아래가 아직 준비 중인 깊은 숲이면 그 아래를 깼을 때
function tierOpen(n) {
  if (n <= 1) return true;
  if (n > TIER_MAX) return false;
  const c = Meta.data.tierCleared;
  if (c[n - 1]) return true;
  return !ROUTES[tierInfo(n - 1).route].ready && !!c[n - 2];
}
const tierPlayable = n => tierOpen(n) && ROUTES[tierInfo(n).route].ready;
// 고를 수 있는 등급 목록 (열렸고, 길이 준비된 것)
function playableTiers() {
  const list = [];
  for (let n = 1; n <= TIER_MAX; n++) if (tierPlayable(n)) list.push(n);
  return list;
}
const curse = id => !!(G.tierCurses && G.tierCurses.includes(id));
const curseText = info => (info.curses.length ? info.curses.map(id => `${CURSES[id].name}(${CURSES[id].desc})`).join(', ') : '반발 없음');
