'use strict';
// 정령의 축복 (하데스식 강화) 과 상태이상 효과
//
// 속성 6개
//  · 불 · 얼음 · 전기 · 독 : 슬롯 축복(기본공격 · 차지공격 · 특수공격 · 대시) + 패시브
//  · 공격 · 방어      : 누적 패시브만 (슬롯을 차지하지 않고 계속 쌓인다)
// 슬롯에는 축복이 하나만 들어간다. 다른 속성을 고르면 교체된다.
// 같은 축복을 다시 고르면 강화 (maxLv 까지, 기본 3).
// 듀오 축복: 두 속성을 함께 가졌을 때만 등장한다.

const ELEMENTS = {
  fire:    { name: '불',   spirit: '불꽃 정령', color: '#ff7a3c', icon: '🔥' },
  frost:   { name: '얼음', spirit: '얼음 정령', color: '#7fd8ff', icon: '❄' },
  thunder: { name: '전기', spirit: '번개 정령', color: '#ffe14a', icon: '⚡' },
  poison:  { name: '독',   spirit: '이끼 정령', color: '#9be15d', icon: '☠' },
  might:   { name: '공격', spirit: '검의 정령', color: '#ff6b8a', icon: '⚔' },
  guard:   { name: '방어', spirit: '수호 정령', color: '#8fd0ff', icon: '🛡' },
};
const SLOT_NAMES = { basic: '기본공격 슬롯', charge: '차지공격 슬롯', special: '특수공격 슬롯', dash: '대시 슬롯' };

// 레벨 해금 없음: 모든 기술을 처음부터 쓸 수 있다 (나중에 무기별 해금이 필요하면 여기에)
const UNLOCK_LV = {};
const SKILL_INFO = {};

const pct = n => Math.round(n * 100) + '%';
const ownsAny = ids => ids.some(id => G.boons[id]);
const BURN_SRC = ['fire_basic', 'fire_bolt', 'fire_charge', 'fire_special', 'fire_dash'];
const CHILL_SRC = ['ice_basic', 'ice_shard', 'ice_charge', 'ice_special', 'ice_dash'];
const SHOCK_SRC = ['elec_basic', 'elec_chain', 'elec_charge', 'elec_special', 'elec_dash', 'static'];
const POISON_SRC = ['poison_basic', 'poison_spray', 'poison_charge', 'poison_special', 'poison_dash'];

// 상태이상 기본 수치
const SHOCK_VULN = 0.2;
const BURN_POWER_MAX = 0.35;  // 화상 한 중첩이 0.5초마다 주는 피해의 상한 (공격력 배율). 불 축복을 모아도 곱으로 폭주하지 않게 (2026-10-18)     // 감전된 적이 받는 피해 +20%
// 얼음 (2026-10-17: 너무 강해서 낮춤) — 빙결 4 → 6중첩, 빙결 시간 1+0.5×Lv → 1+0.25×Lv초, 녹은 뒤 3초는 다시 안 얼고, 큰 냉기(차지 · 특수) 1+Lv → 1+⌈Lv/2⌉
// 2026-10-18 얼음 버프: 빙결 6 → 4중첩, 다시 안 어는 시간 3 → 2초, 동상(냉기 중첩마다 받는 피해 +5%), 보스는 빙결 대신 얼음 균열
const FREEZE_AT = 4;
const FREEZE_IMMUNE = 2;
const FROSTBITE_VULN = 0.05;   // 동상: 냉기 1중첩마다 받는 피해 +5% (빙결 중이면 최대치)
const ICE_CRACK_VULN = 0.25;   // 보스 얼음 균열: 받는 피해 +25%
const ICE_CRACK_T = 3;         // 얼음 균열 지속
const ICE_CRACK_STAGGER = 0.5; // 얼음 균열: 보스가 잠깐 멈춘다
const freezeTime = lv => 1 + 0.25 * Math.max(1, lv);
const iceBig = lv => 1 + Math.ceil(lv / 2);
// 공격 축복 개편 (2026-10-18): 슬롯마다 공격 축복 하나 — 기본 = 연격, 차지 = 회전 연참(일섬 회전 합침), 특수 = 거대 검기, 대시 = 돌진 강화
// 연격 → '잔상 일격' (2026-10-18): 숫자 대신 콤보 마지막 타를 잔상이 레벨마다 한 번씩 더 친다. 속도 · 마지막 타 배율은 없앴다 (0)
// 잔상 일격 (2026-10-18 다시): 다단히트처럼 1레벨부터 잔상 1번(고정), 2 · 3레벨은 마지막 타 피해만 레벨마다 +15%
const COMBO_SPEED = 0;
const COMBO_FIN = 0.15;
const COMBO_ECHO_HITS = 1; // 마지막 타를 잔상이 1번 더 (2 → 1, 2026-10-18)
const ECHO_MULT = 0.5;      // 잔상 한 번의 피해 (마지막 타의 50%)
const ECHO_DELAY = 0.16;    // 처음 잔상이 치기까지 · 잔상 사이 간격 (초)
const ECHO_FLASH = 0.12;    // 잔상 그림(도트 4장)이 넘어가는 시간: 빠르게 휙 (2026-10-18)
const ECHO_COLOR = '#8fd8ff'; // 잔상 색: 방패 막기 이펙트 같은 푸른빛
// 그림을 한 색으로 물들여 둔다 (그림 · 색마다 한 번만 만든다)
const _tintCache = new Map();
// 속성이 없을 때 무기 이펙트의 기본 색 = 흰색 (2026-10-20): 에셋 그림 원래 색(흰색 → 노랑 · 주황)은 번개 · 불과 헷갈려서,
//   색을 빼고 밝힌 흰색 그림으로 모든 무기 · 모든 칸을 통일한다. 속성을 받으면 그 칸의 속성 색으로 바뀐다. (잔상 · 다단히트의 푸른빛은 그대로)
const FX_WHITE = '#ffffff';
function whiteFx(img) {
  const key = img.src + '#white'; let cv = _tintCache.get(key);
  if (cv || !img.width) return cv || img;
  cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const v = Math.min(255, (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.85 + 60); p[i] = p[i + 1] = p[i + 2] = v; } // 명암은 남기고 밝게
  x.putImageData(d, 0, 0);
  _tintCache.set(key, cv); return cv;
}
function tintedBy(img, color) {
  if (color === FX_WHITE) return whiteFx(img);
  const key = img.src + color; let cv = _tintCache.get(key);
  if (cv || !img.width) return cv || img;
  cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.7; x.fillStyle = color; x.fillRect(0, 0, cv.width, cv.height);
  _tintCache.set(key, cv); return cv;
}
const WAVE_DMG = 0.1;       // 거대 검기(무기마다 특수 강화): 레벨마다 특수공격 피해 +10% (2026-10-18 추가)
// 돌진 강화(무기마다 대시 공격 강화) = 다단히트 (2026-10-18): 1레벨부터 1번 더 몰아친다(고정), 2 · 3레벨은 대시 공격 피해만 조금씩
const DASH_ECHO_HITS = 1;   // 대시 공격이 1번 더 (2 → 1, 2026-10-18)
const THRUST_DMG = 0.15;    // 2레벨부터 레벨마다 대시 공격 피해 +15%
const POISON_MAX = 8;       // 독 최대 중첩
const POISON_TIME = 5;      // 마지막으로 독을 건 뒤 사라지기까지
const POISON_RAMP_MAX = 2;  // 독이 계속 걸려 있으면 피해가 최대 2배까지 가속

const BOONS = [
  // ── 🔥 불: 화상 (3초 동안 0.5초마다 피해, 최대 3중첩) ──
  { id: 'fire_basic', el: 'fire', slot: 'basic', name: '불꽃 칼날',
    desc: lv => `기본공격이 화상을 1중첩 건다. 화상 피해 +${30 * (lv - 1)}%.` },
  { id: 'fire_bolt', el: 'fire', needs: 'fire_basic', name: '화염구 베기',
    desc: lv => `휘두를 때마다 화염구가 날아가 처음 닿은 적 자리에서 폭발 (공격력의 ${pct(0.5 + 0.2 * lv)} + 화상). 3타째는 3발.` },
  { id: 'fire_charge', el: 'fire', slot: 'charge', name: '화염 회오리',
    desc: lv => `회전베기에 맞은 적에게 화상 2중첩, 주변에 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
  { id: 'fire_special', el: 'fire', slot: 'special', name: '작열 검기',
    desc: lv => `검기에 맞은 적이 폭발한다. 주변에 공격력의 ${pct(0.6 + 0.3 * lv)} 피해 + 화상.` },
  { id: 'fire_dash', el: 'fire', slot: 'dash', name: '화염 질주',
    desc: lv => `대시한 길에 ${1.5 + 0.5 * lv}초간 불길이 남아 밟은 적에게 화상.` },
  { id: 'kindling', el: 'fire', name: '불씨', req: () => ownsAny(BURN_SRC),
    desc: lv => `화상 최대 중첩 +${lv}, 지속 시간 +1초.` },
  { id: 'chain_burst', el: 'fire', name: '연쇄 폭발', req: () => ownsAny(BURN_SRC),
    desc: lv => `화상 상태로 쓰러진 적이 폭발해 주변에 공격력의 ${pct(0.8 + 0.4 * lv)} 피해 + 화상.` },

  // ── ❄ 얼음: 냉기 (중첩당 이동 속도 -10% · 받는 피해 +5%, 4중첩이면 빙결 · 보스는 얼음 균열) ──
  { id: 'ice_basic', el: 'frost', slot: 'basic', name: '서리 칼날',
    desc: lv => `기본공격이 냉기를 1중첩 건다. 냉기 1중첩마다 받는 피해 +${FROSTBITE_VULN * 100}%, ${FREEZE_AT}중첩이면 빙결 (보스는 얼음 균열: 잠깐 멈추고 받는 피해 +${ICE_CRACK_VULN * 100}%). 빙결 시간 ${freezeTime(lv)}초.` },
  { id: 'ice_shard', el: 'frost', needs: 'ice_basic', name: '얼음 파편 베기',
    desc: lv => `휘두를 때마다 얼음 파편 ${1 + lv}개가 부채꼴로 날아가 적을 관통하며 냉기 1중첩 (공격력의 ${pct(0.25 + 0.05 * lv)}).` },
  { id: 'ice_charge', el: 'frost', slot: 'charge', name: '빙결 회오리',
    desc: lv => `회전베기에 맞은 적에게 냉기 ${iceBig(lv)}중첩.` },
  { id: 'ice_special', el: 'frost', slot: 'special', name: '빙창 검기',
    desc: lv => `검기에 맞은 적에게 냉기 ${iceBig(lv)}중첩, 검기가 지나간 길이 얼어붙는다.` },
  { id: 'ice_dash', el: 'frost', slot: 'dash', name: '얼음 길',
    desc: lv => `대시한 길이 ${1.5 + 0.5 * lv}초간 얼어붙어 위에 선 적에게 냉기.` },
  { id: 'shatter', el: 'frost', name: '파쇄', req: () => ownsAny(CHILL_SRC),
    desc: lv => `빙결된 적을 때리면 얼음이 깨지며 공격력의 ${pct(1.5 + lv)} 추가 피해, 주변에 냉기 2중첩.` },
  { id: 'frostbite', el: 'frost', name: '한기', req: () => ownsAny(CHILL_SRC),
    desc: lv => `냉기·빙결 상태인 적이 주는 피해 -${20 + 10 * lv}%.` },

  // ── ⚡ 전기: 추가 대미지 (감전: 4초간 받는 피해 +20%) ──
  { id: 'elec_basic', el: 'thunder', slot: 'basic', name: '번개 칼날',
    desc: lv => `기본공격이 감전시킨다. 감전된 적은 4초 동안 받는 피해 +${20 + 10 * (lv - 1)}%. (번개가 튀는 건 연쇄 번개)` },
  { id: 'elec_chain', el: 'thunder', needs: 'elec_basic', name: '연쇄 번개 베기',
    desc: lv => `기본공격이 맞으면 번개가 적에서 적으로 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.45 + 0.15 * lv)}) + 감전.` },
  { id: 'elec_charge', el: 'thunder', slot: 'charge', name: '벼락 회오리',
    desc: lv => `회전베기 직후 주변 적 ${2 + lv}명에게 벼락 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  { id: 'elec_special', el: 'thunder', slot: 'special', name: '벼락 검기',
    desc: lv => `검기에 맞은 적마다 벼락 (공격력의 ${pct(0.8 + 0.4 * lv)}) + 감전.` },
  { id: 'elec_dash', el: 'thunder', slot: 'dash', name: '벼락 발자국',
    desc: lv => `대시가 끝나는 자리에 벼락. 주변에 공격력의 ${pct(1 + 0.5 * lv)} 피해 + 감전.` },
  { id: 'static', el: 'thunder', name: '날벼락',
    desc: lv => `적을 때릴 때 ${8 + 4 * lv}% 확률로 하늘에서 벼락 (공격력의 150%).` },
  { id: 'overcharge', el: 'thunder', name: '고전압', req: () => ownsAny(SHOCK_SRC),
    desc: lv => `감전된 적이 받는 피해가 ${15 * lv}% 더 늘어난다 (감전 기본 +20%에 더해서).` },

  // ── ☠ 독: 중첩될수록 가속되는 피해, 죽으면 주변으로 전염 ──
  { id: 'poison_basic', el: 'poison', slot: 'basic', name: '독 칼날',
    desc: lv => `기본공격이 독을 1중첩 건다. 독 피해 +${25 * (lv - 1)}%.` },
  { id: 'poison_spray', el: 'poison', needs: 'poison_basic', name: '독 분사 베기',
    desc: lv => `3타째에 앞쪽으로 독을 뿜어 부채꼴 안의 적에게 독 ${3 + lv}중첩 + 공격력의 ${pct(0.4 + 0.1 * lv)} 피해.` },
  { id: 'poison_charge', el: 'poison', slot: 'charge', name: '독안개 회오리',
    desc: lv => `회전베기 후 주변에 ${2 + 0.5 * lv}초간 독안개. 안에 있는 적에게 계속 독.` },
  { id: 'poison_special', el: 'poison', slot: 'special', name: '독침 검기',
    desc: lv => `검기에 맞은 적에게 독 ${1 + lv}중첩.` },
  { id: 'poison_dash', el: 'poison', slot: 'dash', name: '독 발자국',
    desc: lv => `대시한 길에 ${1.5 + 0.5 * lv}초간 독 웅덩이가 남는다.` },
  { id: 'virulence', el: 'poison', name: '맹독', req: () => ownsAny(POISON_SRC),
    desc: lv => `독 최대 중첩 +${5 * lv}, 독 피해 +${20 * lv}%.` },
  { id: 'venom_burst', el: 'poison', name: '독 폭발', req: () => ownsAny(POISON_SRC),
    desc: lv => `독이 최대 중첩에 닿으면 터져 주변에 공격력의 ${pct(1 + 0.5 * lv)} 피해 (독은 절반 남음).` },

  // ── ⚔ 공격: 누적 패시브 (위력 · 범위 · 속도) ──
  { id: 'atk_combo', el: 'might', name: '잔상 일격', desc: lv => `3타째를 잔상이 ${COMBO_ECHO_HITS}번 더 친다 (잔상 한 번에 3타째 피해의 ${pct(ECHO_MULT)}).` + (lv > 1 ? ` 3타째 피해 +${Math.round(COMBO_FIN * 100 * (lv - 1))}%.` : '') },
  // 일섬 회전: 따로 나오지 않는다. 효과는 회전 연참 레벨을 그대로 따른다 (mergedInto, 2026-10-18)
  { id: 'atk_spin', el: 'might', name: '일섬 회전', mergedInto: 'atk_multispin', desc: lv => `차지 시간 -${15 * lv}%, 회전베기 범위 +${15 * lv}%.` },
  { id: 'atk_multispin', el: 'might', name: '회전 연참',
    desc: lv => `회전베기가 ${1 + lv}번 몰아쳐 벤다. 추가 타격은 피해 ${pct(MULTISPIN_MULT)}, 마지막 타격에만 넉백.` },
  { id: 'atk_wave', el: 'might', name: '거대 검기', desc: lv => `검기 크기·사거리 +${25 * lv}%, 특수공격 쿨타임 -${(0.6 * lv).toFixed(1)}초.` },
  { id: 'atk_thrust', el: 'might', name: '돌진 강화', desc: lv => `돌진 거리 +${15 * lv}%.` },
  { id: 'sharp', el: 'might', name: '날카로운 검', desc: lv => `모든 피해 +${10 * lv}%.` },
  { id: 'vital', el: 'might', name: '급소 노리기', desc: lv => `치명타 확률 +${8 * lv}%, 치명타 피해 +${20 * lv}%.` },
  { id: 'ambush', el: 'might', name: '기습', desc: lv => `적의 옆이나 등 뒤에서 때리면 피해 +${10 + 20 * lv}%. 기절 · 빙결된 적도 무방비로 친다.` },

  // ── 🛡 방어: 누적 패시브 (생존) ──
  { id: 'lifesteal', el: 'guard', name: '흡혈 칼날', desc: lv => `적을 쓰러뜨릴 때마다 체력 ${1.5 + 0.5 * lv} 회복.` },
  { id: 'guard_spin', el: 'guard', name: '수호의 회전', desc: lv => `회전베기 중 무적, 끝난 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  { id: 'heal_wave', el: 'guard', name: '치유의 검기', desc: lv => `검기가 적을 맞히면 쏠 때마다 체력 ${0.5 + 0.5 * lv} 회복 (여러 마리 · 삼연 검기여도 한 번).` },
  { id: 'dash_guard', el: 'guard', name: '잔상 보호막', desc: lv => `대시 후 1초간 받는 피해 -${30 + 10 * lv}%.` },
  { id: 'tough', el: 'guard', name: '강인한 체력', maxLv: 5, onPick: p => { p.maxHp += 15; p.hp += 15; },
    desc: () => '최대 체력 +15 (즉시 회복). 5번까지 겹친다.' },
  { id: 'spring', el: 'guard', name: '생명의 샘', desc: lv => `스테이지를 클리어할 때마다 체력 ${5 + 5 * lv} 회복.` },
  { id: 'leaf', el: 'guard', name: '잎사귀 방패', desc: lv => `${20 - 4 * lv}초마다 받는 피해 1회를 막아 주는 방패가 생긴다.` },
  { id: 'skin', el: 'guard', name: '굳은 피부', desc: lv => `받는 피해 -${4 + 4 * lv}%.` },
  { id: 'second', el: 'guard', name: '두 번째 기회', maxLv: 1, rare: true, onPick: () => { G.reviveLeft++; },
    desc: () => '이번 런에서 한 번 더 부활할 수 있다 (체력 40%).' },

  // ── 듀오: 두 속성을 함께 가졌을 때만 등장 ──
  { id: 'steam', duo: ['fire', 'frost'], name: '증기 폭발',
    desc: () => '화상과 냉기가 함께 걸린 적을 때리면 증기 폭발 (주변에 공격력의 250% 피해).' },
  { id: 'superconduct', duo: ['frost', 'thunder'], name: '초전도',
    desc: () => '냉기·빙결 상태인 적에게 번개 피해 2배.' },
  { id: 'overheat', duo: ['fire', 'thunder'], name: '과열',
    desc: () => '화상 걸린 적이 감전되면 작게 폭발한다 (주변에 공격력의 120% 피해).' },
  { id: 'frozen_toxin', duo: ['poison', 'frost'], name: '냉동 독소',
    desc: () => '냉기·빙결 상태인 적에게 독이 2배로 쌓인다.' },
  { id: 'rally', duo: ['might', 'guard'], name: '역전의 검사',
    desc: () => '체력이 낮을수록 주는 피해가 늘어난다 (최대 +50%).' },
];
// ── 무기별 축복 모양 ──
// 같은 축복이라도 들고 있는 무기에 따라 이름과 효과가 달라진다. 여기 없는 축복은 모든 무기 공통.
// name 만 있으면 설명은 원래 것을 그대로 쓴다.
const BOON_FORMS = {
};
// 축복 도감에서 다른 무기를 볼 때는 G.bookWeapon 이 잠깐 그 무기를 가리킨다 (도감 그리는 동안만)
const curWeapon = () => (typeof G !== 'undefined' && G.bookWeapon ? G.bookWeapon : typeof G !== 'undefined' && G.player ? G.player.weaponId : typeof Meta !== 'undefined' && Meta.data ? Meta.data.weapon : 'sword'); // 파일을 불러오는 중엔 G · Meta 가 아직 없다
const curWeaponDef = () => WEAPONS[curWeapon()] || WEAPONS.sword;
const enhanceSlot = () => curWeaponDef().enhanceSlot || 'basic'; // 강화 축복 · 번개 감전 강화가 붙는 칸
for (const b of BOONS) {
  const base = { name: b.name, desc: b.desc };
  const form = () => (BOON_FORMS[curWeapon()] || {})[b.id] || {};
  Object.defineProperty(b, 'name', { get: () => form().name || base.name });
  Object.defineProperty(b, 'desc', { get: () => form().desc || base.desc });
  const baseNeeds = b.needs; delete b.needs;
  Object.defineProperty(b, 'needs', { get: () => form().needs || baseNeeds, configurable: true });
}

// 강화 축복(needs)은 그 슬롯 축복을 가지고 있을 때만 나온다 (보통 기본공격, 마법봉은 특수공격)
for (const b of BOONS) if (b.needs) b.req = () => !!G.boons[b.needs];
const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));
// 특수 강화 축복: 무기마다 설명이 달라도 '특수공격 피해 +n%' 를 이어 붙인다 (2026-10-18)
{ const w = BOON_BY_ID.atk_wave, g = Object.getOwnPropertyDescriptor(w, 'desc').get;
  Object.defineProperty(w, 'desc', { get: () => { const a = g(); return lv => a(lv) + ` 특수공격 피해 +${Math.round(WAVE_DMG * 100 * lv)}%.`; } }); }
{ const w = BOON_BY_ID.atk_thrust, g = Object.getOwnPropertyDescriptor(w, 'desc').get;
  Object.defineProperty(w, 'desc', { get: () => { const a = g(); return lv => `다단히트: 대시 공격이 ${DASH_ECHO_HITS}번 더 몰아친다 (추가 타격 피해 ${pct(ECHO_MULT)}).` + (lv > 1 ? ` 대시 공격 피해 +${Math.round(THRUST_DMG * 100 * (lv - 1))}%.` : '') + ' ' + a(lv); } }); }
// 합쳐진 축복: 설명에 합쳐진 쪽 효과를 이어 붙인다 (회전 연참 = 회전 연참 + 일섬 회전)
for (const b of BOONS) if (b.mergedInto) {
  const host = BOON_BY_ID[b.mergedInto], hostDesc = Object.getOwnPropertyDescriptor(host, 'desc').get;
  Object.defineProperty(host, 'desc', { get: () => { const a = hostDesc(), c = b.desc; return lv => a(lv) + ' ' + c(lv); } });
}
const boonColor = b => (b.duo ? '#ffb8f0' : ELEMENTS[b.el].color);
const boonIcon = b => (b.duo ? b.duo.map(e => ELEMENTS[e].icon).join('') : ELEMENTS[b.el].icon);
// 최대 레벨: 슬롯 축복 · 그 강화 축복은 5 (1~6세계 동안 키울 거리), 패시브는 3, 듀오는 1 (2026-10-17)
const boonMaxLv = b => b.maxLv || (b.duo ? 1 : (b.slot || b.needs) ? 5 : 3);
// 이 레벨 이상 키운 슬롯은 잠긴다: 다른 속성으로 바꾸는 카드가 안 나온다
const SLOT_LOCK_LV = 3;
// 다른 속성이 차지한 슬롯을 바꾸는 카드가 나올 확률 가중치 (낮을수록 덜 나온다)
const REPLACE_WEIGHT = 0.35;

// ── 도트 그림 이펙트: 에셋 팩 시트(가로로 프레임)를 한 번 재생하고 사라진다 (2026-10-18) ──
// 예: new SpriteFx('fxBoom', 40, 40, 9, x, y, 96, 0.45) — (x, y) = 그림 가운데
class SpriteFx {
  constructor(key, fw, fh, n, x, y, size, dur, tint) { Object.assign(this, { key, fw, fh, n, x, y, size, dur, tint, t: 0, done: false }); }
  update(dt) { this.t += dt; if (this.t >= this.dur) this.done = true; }
  draw(g) {
    const im = this.tint ? tintedBy(ART.img[this.key], this.tint) : ART.img[this.key], fr = Math.min(this.n - 1, Math.floor(this.t / this.dur * this.n));
    const w = this.size, h = this.size * this.fh / this.fw;
    g.drawImage(im, fr * this.fw, 0, this.fw, this.fh, Math.round(this.x - w / 2), Math.round(this.y - h / 2), w, h);
  }
}
// 도트 번개 그림: 가운데 큰 번개 + 둘레에 작은 번개 (벼락 · 속성 번개 공통)
function thunderPix(x, y, r) {
  G.projectiles.push(new SpriteFx('fxThunder', 20, 28, 8, x, y - 10, 34, 0.35));
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; G.projectiles.push(new SpriteFx('fxThunder', 20, 28, 8, x + Math.cos(a) * r * 0.6, y - 8 + Math.sin(a) * r * 0.45, 22, 0.3)); }
}
// 뭉개진 도트 번개 (2026-10-18): 에셋 번개가 다른 그림(폭발 · 얼음)보다 선이 너무 깔끔해서 튄다
//   → 장마다 2/3 해상도(20x28 → 14x20)로 줄였다가 알파를 끊어 거친 도트로 만들고, 따뜻한 노랑으로 살짝 물들인다
function softThunder() {
  if (ART.img.fxThunderSoft) return true;
  const src = ART.img.fxThunder; if (!src || !src.width) return false;
  const W = 14 * 8, H = 20, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = true;
  for (let i = 0; i < 8; i++) x.drawImage(src, i * 20, 0, 20, 28, i * 14, 0, 14, 20);
  const d = x.getImageData(0, 0, W, H), p = d.data;
  for (let i = 0; i < p.length; i += 4) p[i + 3] = p[i + 3] > 55 ? 255 : 0;
  x.putImageData(d, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.45; x.fillStyle = '#ffc83a'; x.fillRect(0, 0, W, H);
  ART.img.fxThunderSoft = cv; return true;
}
function softThunderPix(x, y, r) {
  if (!softThunder()) return;
  G.projectiles.push(new SpriteFx('fxThunderSoft', 14, 20, 8, x, y - 10, 30, 0.35));
  for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2); G.projectiles.push(new SpriteFx('fxThunderSoft', 14, 20, 8, x + Math.cos(a) * r * 0.5, y - 6 + Math.sin(a) * r * 0.35, 18, 0.3)); }
}
// 도트 고리: 동그란 선 고리(G.fxRing) 대신 쓰는 도트 고리 그림 (무기 기술 공통, 2026-10-18)
function pixRing(x, y, color, r) { G.projectiles.push(new SpriteFx('fxRingPx', 32, 32, 6, x, y - 4, r * 2, 0.3, color)); }
// (예전 이름: 창 반환점에서 쓰던 것)
const explodePix = (x, y, r, dmg, burnIt) => FX.explode(x, y, r, dmg, '#ff7a3c', burnIt);
const strikePix = (x, y, r, dmg) => FX.strike(x, y, r, dmg);

// ── 잔상 일격: 잠시 뒤 같은 자리에서 같은 모양으로 한 번 더 친다 (2026-10-18) ──
class EchoStrike {
  // o.dash: 칠 때 자리 · 모양을 정하는 함수 (대시 공격 다단히트: 그때 플레이어 자리 기준)
  constructor(p, kind, shape, delay, o = {}) {
    Object.assign(this, { x: p.x, y: p.y, dir: p.facing, kind, shape, delay, t: 0, done: false, fired: false, hit: new Set(), o });
  }
  update(dt) {
    this.t += dt;
    // o.follow: 잔상 일격은 플레이어를 따라간다 (앞으로 걸으며 치면 잔상이 뒤에 남지 않게, 2026-10-18)
    if (this.o.follow) { this.x = G.player.x; this.y = G.player.y; }
    // 대시 공격 다단히트: 대시 공격이 진행되는 동안만 플레이어 자리를 따라가고, 끝나면 그 자리에 고정 (끝난 뒤 걸어가도 자리가 안 바뀐다, 2026-10-18)
    if (this.o.act && G.player.act === this.o.act) { this.o.px = G.player.x; this.o.py = G.player.y; this.o.pf = G.player.facing; }
    if (!this.fired && this.t >= this.delay) {
      this.fired = true;
      if (this.o.dash) { const P = G.player, at = Object.create(P, { x: { value: this.o.px ?? P.x }, y: { value: this.o.py ?? P.y }, facing: { value: this.o.pf ?? P.facing } }); Object.assign(this, this.o.dash(at, this)); }
      // 원래 공격(this.src = 그 동작의 맞힌 적 목록)에 맞은 적만 다시 친다. 빗나갔으면 아무도 안 맞는다 (2026-10-18 버그 고침)
      const p = G.player, src = this.o.src;
      let any = false;
      for (const t of G.targets()) {
        if (!src || !src.has(t) || t.dead) continue;
        const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
        p.deal(t, this.kind, dx / d, dy / d, { mult: ECHO_MULT, kb: 80 }); any = true;
      }
      if (!any) { this.done = true; return; } // 맞은 적이 없으면 그림도 없이 끝
      Sfx.swing(false);
    }
    if (this.t >= this.delay + ECHO_FLASH) this.done = true;
  }
  // 그림: 에셋 팩 도트 베기 그림(SlashCurved · CircularSlash)을 방패 막기 이펙트 같은 푸른빛으로, 4장을 빠르게 넘기고 끝 (2026-10-18)
  //   잔상 일격은 기본공격 칸, 대시 다단히트는 대시 칸에 속성이 붙어 있으면 그 색으로 (o.slot)
  draw(g) {
    if (!this.fired || !this.shape) return;
    const k = clamp((this.t - this.delay) / ECHO_FLASH, 0, 0.999), fr = Math.floor(k * 4) * 32, S = this.shape, cy = this.y - 4, col = slotCol(this.o.slot, ECHO_COLOR);
    g.save(); g.globalAlpha = 0.95;
    if (!S.line && S.half >= Math.PI) { // 둘레 (선풍 베기 · 마력 파동 · 후려치기)
      const img = tintedBy(ART.img.circSlash, col), sz = S.range * 2;
      g.drawImage(img, fr, 0, 32, 32, Math.round(this.x - sz / 2), Math.round(cy - sz / 2), sz, sz);
    } else {
      const img = tintedBy(ART.img.slash, col);
      g.translate(this.x, cy); g.rotate(this.dir);
      if (S.line) g.drawImage(img, fr, 0, 32, 32, 8, -12, S.line, 24); // 찌르기 · 돌진 길: 길게 늘인 베기
      else { const s = S.range * 1.1; g.drawImage(img, fr, 0, 32, 32, S.range * 0.45 - s / 2, -s / 2, s, s); }
    }
    g.restore();
  }
}

// ── 축복이 쏘는 발사체 (화염구 · 얼음 파편) ─────────────────────
class FxShot {
  constructor(x, y, dir, o) {
    Object.assign(this, { x, y, dir, hit: new Set(), done: false, t: 0 }, o);
    this.max = this.life;
  }
  update(dt) {
    this.t += dt;
    this.x += Math.cos(this.dir) * this.speed * dt;
    this.y += Math.sin(this.dir) * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0 || World.shotBlockedAt(this.x, this.y + 6)) { this.done = true; if (this.onEnd) this.onEnd(this); return; }
    for (const t of G.targets()) {
      if (this.hit.has(t) || Math.hypot(t.x - this.x, t.y - this.y) > t.r + this.r) continue;
      this.hit.add(t);
      this.onHit(t, this);
      if (!this.pierce) { this.done = true; return; }
    }
  }
  draw(g) {
    g.globalAlpha = clamp(this.life / this.max * 3, 0, 1);
    if (this.kind === 'fire') {
      g.fillStyle = 'rgba(255,140,40,0.35)';
      g.beginPath(); g.arc(this.x, this.y, this.r * 1.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(this.x, this.y, this.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(this.x, this.y, this.r * 0.45, 0, Math.PI * 2); g.fill();
      if (Math.random() < 0.6) G.particles.push({ x: this.x, y: this.y, vx: rand(-20, 20), vy: rand(-30, -5), life: 0.25, max: 0.25, color: '#ff7a3c', size: 2.5, grav: 0 });
    } else {
      g.save(); g.translate(this.x, this.y); g.rotate(this.dir);
      g.fillStyle = '#d8f4ff'; g.strokeStyle = '#7fd8ff'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, 0); g.lineTo(0, -3); g.lineTo(-6, 0); g.lineTo(0, 3); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }
}


// ── 속성 연출: 축복이 붙은 칸(기본 · 차지 · 특수 · 대시)을 그 속성 색 · 입자로 그린다 ──
//  불 = 위로 튀는 불티 · 얼음 = 흩날리는 가루 · 전기 = 지글거리는 테두리와 스파크 · 독 = 떨어지는 방울
//  축복이 최대 레벨(3)이면 빛 번짐이 생기고 입자가 더 많아진다.
const EL_STYLE = {
  fire:    { rgb: [255, 122, 60],  main: '#ff7a3c', light: '#ffd24a', dark: '#d8402a' },
  frost:   { rgb: [127, 216, 255], main: '#7fd8ff', light: '#e8faff', dark: '#3a9ad8' },
  thunder: { rgb: [255, 225, 74],  main: '#ffe14a', light: '#fffbe0', dark: '#d8a020' },
  poison:  { rgb: [155, 225, 93],  main: '#9be15d', light: '#d8ff9c', dark: '#4f9a2a' },
};
const EL_MAX_LV = 3;
// 그 칸(basic · charge · special · dash)에 속성 축복이 붙어 있으면 그 속성 색, 없으면 fallback (2026-10-18: 무기 이펙트 색을 칸 속성에 맞춘다)
function slotCol(slot, fallback) { const s = ElFx.slot(slot); return s ? EL_STYLE[s.el].main : fallback; }
function slotBurst(slot, fallback) { const s = ElFx.slot(slot); return s ? ['#ffffff', EL_STYLE[s.el].light, EL_STYLE[s.el].main] : fallback; }
const ElFx = {
  // 그 칸에 붙은 속성 축복: { el, lv, max } 또는 null
  slot(slot) {
    for (const b of BOONS) if (b.slot === slot && G.boons[b.id]) return { el: b.el, lv: G.boons[b.id], max: G.boons[b.id] >= EL_MAX_LV };
    return null;
  },
  rgba(el, a) { const c = EL_STYLE[el].rgb; return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`; },
  spark(s, x, y, n = 1) {
    if (!s) return;
    const S = EL_STYLE[s.el];
    if (s.max) n = Math.ceil(n * 1.8);
    for (let i = 0; i < n; i++) {
      let q;
      if (s.el === 'fire') q = { vx: rand(-25, 25), vy: rand(-70, -30), life: rand(0.25, 0.45), size: rand(2, 3.5), grav: 0 };
      else if (s.el === 'frost') q = { vx: rand(-20, 20), vy: rand(5, 30), life: rand(0.35, 0.6), size: rand(1.5, 2.5), grav: 0 };
      else if (s.el === 'thunder') { const a = rand(0, Math.PI * 2), sp = rand(90, 160); q = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.08, 0.16), size: 2, grav: 0 }; }
      else q = { vx: rand(-15, 15), vy: rand(-20, 0), life: rand(0.4, 0.6), size: rand(2, 3), grav: 160 };
      const color = s.el === 'poison' ? (Math.random() < 0.5 ? S.main : S.dark) : (Math.random() < 0.5 ? S.main : S.light);
      G.particles.push(Object.assign({ x: x + rand(-3, 3), y: y + rand(-3, 3), max: q.life, color }, q));
    }
  },
  // 호 궤적
  arc(g, s, x, y, r, a0, a1, w, alpha) {
    if (s.max) { g.strokeStyle = this.rgba(s.el, alpha * 0.3); g.lineWidth = w * 2.2; g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); }
    g.strokeStyle = this.rgba(s.el, alpha); g.lineWidth = w;
    g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke();
    if (s.el === 'thunder') {
      const n = Math.max(4, Math.round(Math.abs(a1 - a0) * 5));
      g.strokeStyle = `rgba(255,251,224,${clamp(alpha * 1.2, 0, 1)})`; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, rr = r + w * 0.5 + (i % 2 ? 3 : -2) * Math.random(); i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.stroke();
    }
  },
  // 직선 궤적 (찌르기 · 관통 · 던진 창 꼬리)
  line(g, s, x1, y1, x2, y2, w, alpha) {
    if (s.max) { g.strokeStyle = this.rgba(s.el, alpha * 0.3); g.lineWidth = w * 2.4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    g.strokeStyle = this.rgba(s.el, alpha); g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    if (s.el === 'thunder') {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / 10));
      g.strokeStyle = `rgba(255,251,224,${clamp(alpha * 1.2, 0, 1)})`; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : rand(-1, 1) * (w * 0.5 + 3); const px = x1 + dx * k + nx * j, py = y1 + dy * k + ny * j; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
  },
  // 베기 그림을 속성 색으로 물들인 사본 (한 번 만들어 둔다)
  tinted(img, el) {
    const c = this._tint || (this._tint = {});
    if (c[el] && c[el].src === img) return c[el].cv;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.65; x.fillStyle = EL_STYLE[el].main; x.fillRect(0, 0, cv.width, cv.height);
    c[el] = { src: img, cv };
    return cv;
  },
};

// 기습 판정: 적이 바라보는(움직이는) 방향에서 AMBUSH_ANGLE 이상 벗어난 쪽에서 때리면 옆 · 뒤. 기절 · 빙결이면 무방비.
const AMBUSH_ANGLE = 70 * Math.PI / 180;
const AMBUSH_STUN = 0.2; // 맞을 때마다 붙는 짧은 경직(0.15초)은 무방비로 치지 않는다
function offGuard(t, p) {
  if (t.stun > AMBUSH_STUN || t.frozenT > 0) return true;
  if (t.heading === undefined) return false;
  const from = Math.atan2(p.y - t.y, p.x - t.x); // 적이 보기에 플레이어가 있는 방향
  return Math.abs(angDiff(from, t.heading)) > AMBUSH_ANGLE;
}

// ── 효과 처리 ─────────────────────────────────────────────
const FX = {
  lv(id) {
    const b = BOON_BY_ID[id];
    if (b && b.mergedInto) return this.lv(b.mergedInto); // 일섬 회전 = 회전 연참 레벨
    if (b && b.needs && !G.boons[b.needs]) return 0; // 기본 축복이 빠지면 강화도 꺼진다
    return G.boons[id] || 0;
  },
  hasEl(el) { return BOONS.some(b => b.el === el && G.boons[b.id]); },
  fireLv() { return BURN_SRC.concat(['chain_burst', 'kindling']).reduce((s, id) => s + this.lv(id), 0); },
  atk() { return G.player.atk; },

  near(x, y, r, except) {
    return G.targets().filter(t => t !== except && t.type !== 'totem' && !t.dead && Math.hypot(t.x - x, t.y - y) < r + t.r);
  },

  damage(t, dmg, color, size = 11) {
    if (t.dead) return;
    dmg = Math.max(1, Math.round(dmg));
    if (t.vulnerable) dmg = Math.round(dmg * 1.5);
    t.hp -= dmg; t.flash = Math.max(t.flash, 0.06);
    G.text(t.x + rand(-6, 6), t.y - t.r - 4, String(dmg), color, size, 0.55);
    G.checkDeath(t);
  },

  bolt(x1, y1, x2, y2) { G.bolts.push({ x1, y1, x2, y2, life: 0.2 }); },
  lightningMult(t) { return this.lv('superconduct') && (t.chill > 0 || t.frozenT > 0) ? 2 : 1; },
  shock(t) {
    if (t.type === 'totem' || t.dead) return;
    // 과열: 화상 걸린 적이 감전되면 작은 폭발 (적마다 1초에 한 번)
    if (this.lv('overheat') && t.burn && t.burn.stacks > 0 && !(t.overheatT > 0)) {
      t.overheatT = 1;
      this.explode(t.x, t.y, 45, this.atk() * 1.2, '#ffb84a');
    }
    t.shockT = 4;
  },
  // 감전된 적이 받는 피해 배율
  // 번개 칼날 레벨마다 +10%, 고전압 레벨마다 +15%
  shockMult(t) { return t.shockT > 0 ? 1 + SHOCK_VULN + 0.1 * Math.max(0, this.lv('elec_' + enhanceSlot()) - 1) + 0.15 * this.lv('overcharge') : 1; },

  skyBolt(t, dmg) {
    this.bolt(t.x + rand(-12, 12), t.y - 150, t.x, t.y);
    this.shock(t);
    this.damage(t, dmg * this.lightningMult(t), '#ffe14a', 13);
    Sfx.zap();
  },
  chainFrom(src, n, dmg) {
    const list = this.near(src.x, src.y, 110, src)
      .sort((a, b) => Math.hypot(a.x - src.x, a.y - src.y) - Math.hypot(b.x - src.x, b.y - src.y)).slice(0, n);
    for (const e of list) {
      this.bolt(src.x, src.y, e.x, e.y);
      this.shock(e);
      this.damage(e, dmg * this.lightningMult(e), '#ffe14a');
    }
    if (list.length) Sfx.zap();
  },
  // 벼락: 내리꽂는 번개 + 도트 번개 그림 (고리 선 → 도트, 2026-10-18)
  // quiet: 번개 그림 없이 노란 도트 장판 색만 잠깐 (전기 대시, 2026-10-18)
  strike(x, y, r, dmg, quiet) {
    if (quiet) this.elecMark(x, y, 0.6); // 다른 장판과 같은 크기 (예전엔 피해 범위 45만큼 커서 혼자 커 보였다)
    else { this.bolt(x + rand(-10, 10), y - 150, x, y); softThunderPix(x, y, r); } // 벼락(창 반환점): 내리꽂는 번개 + 뭉갠 도트 번개 살짝
    for (const t of this.near(x, y, r)) { this.shock(t); this.damage(t, dmg * this.lightningMult(t), '#ffe14a', 12); }
    Sfx.zap();
  },
  burn(t, n) {
    const k = this.lv('kindling'), max = 3 + k; // 불씨: 레벨당 +1중첩 (2 → 1, 2026-10-18: 불 빌드 폭주)
    const b = t.burn || (t.burn = { stacks: 0, t: 0, tick: 0.5 });
    b.stacks = Math.min(max, b.stacks + n); b.t = 3 + (k ? 1 : 0);
  },
  poisonLv() { return POISON_SRC.concat(['virulence', 'venom_burst']).reduce((s, id) => s + this.lv(id), 0); },
  poison(t, n) {
    if (t.type === 'totem' || t.dead) return;
    if (this.lv('frozen_toxin') && (t.chill > 0 || t.frozenT > 0)) n *= 2;
    const max = POISON_MAX + 5 * this.lv('virulence');
    const p = t.poison || (t.poison = { stacks: 0, t: 0, tick: 0.5, ramp: 1 });
    p.stacks = Math.min(max, p.stacks + n); p.t = POISON_TIME;
    const vb = this.lv('venom_burst');
    if (vb && p.stacks >= max) {
      p.stacks = Math.floor(max / 2);
      this.explode(t.x, t.y, 55, this.atk() * (1 + 0.5 * vb), '#9be15d');
    }
  },
  chill(t, n) {
    if (t.type === 'totem' || t.frozenT > 0) return;
    // 막 녹은 적은 잠깐 다시 얼지 않는다 (냉기는 쌓이지만 빙결 직전에서 멈춘다)
    t.chill = Math.min(t.thawT > 0 ? FREEZE_AT - 1 : FREEZE_AT, (t.chill || 0) + n); t.chillT = 3;
    if (t.chill >= FREEZE_AT && (t.type === 'boss' || t.type === 'dragon')) { // 얼음 균열: 보스는 얼지 않는 대신 잠깐 멈추고 약해진다
      t.chill = 0; t.thawT = FREEZE_IMMUNE; t.crackT = ICE_CRACK_T; t.iceStagger = ICE_CRACK_STAGGER;
      G.text(t.x, t.y - (t.r || 20) - 18, '얼음 균열!', '#bfefff', 14, 0.9);
      G.burst(t.x, t.y - 6, 18, ['#bfefff', '#ffffff', '#7fd8ff'], 200); G.projectiles.push(new SpriteFx('fxIce', 32, 32, 10, t.x, t.y - 8, 70, 0.45)); // 도트 얼음
      Sfx.shatter ? Sfx.shatter() : Sfx.freeze();
      return;
    }
    if (t.chill >= FREEZE_AT && t.type !== 'boss') {
      t.frozenT = freezeTime(this.lv('ice_basic'));
      t.thawT = t.frozenT + FREEZE_IMMUNE;
      t.chill = 0; t.attacking = false;
      G.text(t.x, t.y - t.r - 14, '빙결!', '#bfefff', 12, 0.7);
      Sfx.freeze();
    }
  },
  // 폭발: 도트 폭발 그림 (불은 원래 색, 다른 속성은 그 색으로 물들인다). 고리 선 → 도트 (2026-10-18)
  explode(x, y, r, dmg, color, burnIt) {
    G.projectiles.push(new SpriteFx('fxBoom', 40, 40, 9, x, y - 4, r * 1.9, 0.5, color === '#ff7a3c' || color === '#ffb84a' ? null : color));
    G.burst(x, y, 18, [color, '#fff'], 200);
    G.shake = Math.max(G.shake, 5);
    Sfx.boom();
    for (const t of this.near(x, y, r)) { if (burnIt) this.burn(t, 1); this.damage(t, dmg, color, 12); }
  },
  // 장판 하나: 깔리는 자리 · 크기 · 남는 시간을 조금씩 흩뜨린다 — 원 · 줄 모양으로 너무 가지런해 보이지 않게 (2026-10-18)
  zone(x, y, kind, life) {
    const L = life * rand(0.85, 1.15);
    const z = { x: x + rand(-7, 7), y: y + rand(-5, 5), r: rand(10, 18), kind, life: L, max: L, tick: rand(0, 0.3) };
    G.zones.push(z); return z;
  },
  // 보이기만 하는 전기 장판 (노란 도트 덩어리, 피해 없음) — 전기 대시 · 회전베기 모양을 불과 같게 (2026-10-18)
  elecMark(x, y, life) { this.zone(x, y, 'elec', life).look = true; },

  updateStatus(t, dt) {
    if (t.shockT > 0) t.shockT -= dt;
    if (t.overheatT > 0) t.overheatT -= dt;
    if (t.chill > 0) { t.chillT -= dt; if (t.chillT <= 0) t.chill = 0; }
    if (t.frozenT > 0) t.frozenT -= dt;
    if (t.thawT > 0) t.thawT -= dt;
    if (t.crackT > 0) t.crackT -= dt;
    const ps = t.poison;
    if (ps && ps.stacks > 0) {
      ps.t -= dt; ps.tick -= dt;
      if (Math.random() < dt * 6) G.particles.push({ x: t.x + rand(-t.r, t.r), y: t.y - rand(0, t.r * 1.2), vx: 0, vy: -18,
        life: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#9be15d' : '#5fae3a', size: 2.5, grav: 0 });
      if (ps.tick <= 0) {
        ps.tick = 0.5;
        ps.ramp = Math.min(POISON_RAMP_MAX, ps.ramp + 0.08);   // 걸려 있을수록 점점 아프다
        const power = (0.04 + 0.01 * this.poisonLv()) * (1 + 0.25 * Math.max(0, this.lv('poison_basic') - 1)) * (1 + 0.2 * this.lv('virulence'));
        this.damage(t, this.atk() * power * ps.stacks * ps.ramp, '#9be15d', 10);
      }
      if (ps.t <= 0) { ps.stacks = 0; ps.ramp = 1; }
    }
    const b = t.burn;
    if (b && b.stacks > 0) {
      b.t -= dt; b.tick -= dt;
      if (Math.random() < dt * 10) G.particles.push({ x: t.x + rand(-t.r, t.r), y: t.y - rand(0, t.r), vx: 0, vy: -40,
        life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff9a3c' : '#ffd24a', size: 2.5, grav: 0 });
      if (b.tick <= 0) {
        b.tick = 0.5;
        const power = Math.min(BURN_POWER_MAX, 0.1 + 0.03 * this.fireLv() + 0.03 * Math.max(0, this.lv('fire_basic') - 1)); // 한 중첩 세기 상한
        this.damage(t, this.atk() * power * b.stacks, '#ff9a4a', 10);
      }
      if (b.t <= 0) b.stacks = 0;
    }
  },

  // 플레이어 공격이 맞았을 때. kind: light/finisher/thrust = 기본공격, spin = 차지공격, wave = 특수공격
  onHit(t, info) {
    const atk = this.atk(), kind = info.kind;
    const basic = isBasicKind(kind), W = curWeaponDef();
    const burning = t.burn && t.burn.stacks > 0;
    if (this.lv('shatter') && t.frozenT > 0) {
      t.frozenT = 0;
      G.burst(t.x, t.y, 16, ['#bfefff', '#fff'], 200);
      Sfx.shatter();
      for (const e of this.near(t.x, t.y, 55, t)) this.chill(e, 2);
      this.damage(t, atk * (1.5 + this.lv('shatter')), '#bfefff', 14);
      if (t.dead) return;
    }
    if (this.lv('steam') && burning && t.chill > 0) {
      t.burn.stacks = 0; t.chill = 0;
      this.explode(t.x, t.y, 60, atk * 2.5, '#e8e8f0');
      if (t.dead) return;
    }
    if (basic) {
      const eb = this.lv('elec_basic');
      if (eb) this.shock(t); // 번개 칼날: 감전만 건다 (번개가 튀는 건 연쇄 번개 몫)
      if (this.lv('fire_basic')) this.burn(t, 1);
      if (this.lv('ice_basic')) this.chill(t, 1);
      if (this.lv('poison_basic')) this.poison(t, 1);
      const ch = enhanceSlot() === 'basic' ? this.lv('elec_chain') : 0, act = G.player.act;
      if (ch && act && !act.chained) { act.chained = true; this.chainJump(t, 2 + ch, this.atk() * (0.45 + 0.15 * ch)); }
      if (act) W.onBasicHit?.(this, t, info, act, atk);
    } else if (MOVES[kind] && MOVES[kind].role === 'charge') {
      if (this.lv('fire_charge')) this.burn(t, 2);
      const ic = this.lv('ice_charge');
      if (ic) this.chill(t, iceBig(ic));
      if (this.lv('poison_charge')) this.poison(t, 1);
    } else if (MOVES[kind] && MOVES[kind].role === 'special') {
      W.onSpecialHit?.(this, t, info, atk); // 무기마다 다르다 (검기 · 던진 창 …)
    }
    const st = this.lv('static');
    if (st && !t.dead && Math.random() < 0.08 + 0.04 * st) this.skyBolt(t, atk * 1.5);
  },

  // 잔상 일격: 마지막 타를 그 자리 · 그 방향으로 잔상이 다시 친다 (레벨 수만큼)
  queueEcho(p) {
    const n = this.lv('atk_combo'), a = p.act;
    if (!n || !a) return;
    const shape = a.len ? { line: a.len } : { range: a.range, half: a.half };
    for (let k = 1; k <= COMBO_ECHO_HITS; k++) G.projectiles.push(new EchoStrike(p, a.kind, shape, ECHO_DELAY * k, { follow: true, src: a.hit, slot: 'basic' }));
  },
  // 대시 공격 다단히트 (돌진 강화): 대시 공격이 끝난 뒤 같은 곳을 1번 더 친다 (DASH_ECHO_HITS). 모양은 무기마다 weapon.dashEcho
  queueDashEcho(p) {
    const lv = this.lv('atk_thrust'), a = p.act, sh = p.weapon.dashEcho;
    if (!lv || !a || !sh) return;
    for (let k = 1; k <= DASH_ECHO_HITS; k++) G.projectiles.push(new EchoStrike(p, a.kind, null, (a.dur || 0.2) + ECHO_DELAY * (k - 1) + 0.04, { dash: sh, x0: p.x, y0: p.y, src: a.hit, act: a, slot: 'dash' }));
  },
  // 기본공격을 휘두를 때
  onSwing(p, fin) {
    if (fin) this.queueEcho(p);
    if (enhanceSlot() !== 'basic') return; // 강화 축복이 다른 칸에 붙는 무기 (마법봉: 마력탄)
    const atk = p.atk, f = p.facing;
    const fb = this.lv('fire_bolt');
    if (fb) {
      const dirs = fin ? [-0.3, 0, 0.3] : [0];
      for (const o of dirs) G.projectiles.push(new FxShot(p.x, p.y - 4, f + o, {
        kind: 'fire', speed: 260, life: 0.65, r: 6, pierce: false,
        onHit: t => this.explode(t.x, t.y, 36, atk * (0.5 + 0.2 * fb), '#ff7a3c', true),
      }));
    }
    const is = this.lv('ice_shard');
    if (is) {
      const n = 1 + is, spread = 0.35; // 부채꼴 0.7 → 0.35 (약 40° → 20°, 2026-10-17)
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1);
        G.projectiles.push(new FxShot(p.x, p.y - 4, f + o, {
          kind: 'ice', speed: 330, life: 0.42, r: 5, pierce: true,
          onHit: t => { this.chill(t, 1); this.damage(t, atk * (0.25 + 0.05 * is), '#bfefff', 10); },
        }));
      }
      Sfx.freeze();
    }
    const ps = this.lv('poison_spray');
    if (ps && fin) {
      for (let i = 0; i < 18; i++) {
        const a = f + rand(-0.7, 0.7), sp = rand(80, 200);
        G.particles.push({ x: p.x, y: p.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, color: Math.random() < 0.5 ? '#9be15d' : '#5fae3a', size: 3.5, grav: 0 });
      }
      for (const t of this.near(p.x, p.y, 85)) {
        if (Math.abs(angDiff(Math.atan2(t.y - p.y, t.x - p.x), f)) > 0.75) continue;
        this.poison(t, 3 + ps);
        this.damage(t, atk * (0.4 + 0.1 * ps), '#9be15d', 11);
      }
    }
  },




  // 연쇄 번개: 맞은 적에서 시작해 가장 가까운 다음 적으로 차례차례 튄다
  chainJump(src, jumps, dmg) {
    const visited = new Set([src]);
    let cur = src;
    for (let i = 0; i < jumps; i++) {
      let next = null, best = 140;
      for (const e of this.near(cur.x, cur.y, 140)) {
        if (visited.has(e)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < best) { best = d; next = e; }
      }
      if (!next) break;
      visited.add(next);
      this.bolt(cur.x, cur.y - 6, next.x, next.y - 6);
      this.shock(next);
      this.damage(next, dmg * this.lightningMult(next), '#ffe14a', 11);
      cur = next;
    }
    this.shock(src);
    Sfx.zap();
  },

  // 회전베기를 시작할 때
  onSpin(p) {
    const fc = this.lv('fire_charge');
    if (fc) {
      const a0 = rand(0, Math.PI * 2); // 회전마다 시작 각도 · 거리를 흩뜨린다 (2026-10-18)
      for (let i = 0; i < 8; i++) {
        const a = a0 + i / 8 * Math.PI * 2 + rand(-0.25, 0.25), d = rand(22, 42);
        this.zone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + 4, 'fire', 1.5 + 0.5 * fc);
      }
    }
    const pc = this.lv('poison_charge');
    if (pc) {
      const life = 2 + 0.5 * pc;
      this.zone(p.x, p.y + 4, 'poison', life);
      const a0 = rand(0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = a0 + i / 8 * Math.PI * 2 + rand(-0.25, 0.25), d = rand(20, 40);
        this.zone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + 4, 'poison', life);
      }
    }
    const ec = this.lv('elec_charge');
    if (ec) {
      const list = this.near(p.x, p.y, 130).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2 + ec);
      for (const e of list) { this.shock(e); this.damage(e, p.atk * (0.8 + 0.3 * ec) * this.lightningMult(e), '#ffe14a', 13); this.elecMark(e.x, e.y + 4, 0.6); }
      const a0 = rand(0, Math.PI * 2);
      for (let i = 0; i < 8; i++) { const a = a0 + i / 8 * Math.PI * 2 + rand(-0.25, 0.25), d = rand(22, 42); this.elecMark(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + 4, 0.8 + 0.2 * ec); }
      Sfx.zap();
    }
    const gs = this.lv('guard_spin');
    if (gs) { p.invuln = Math.max(p.invuln, 0.4); p.spinGuardT = 0.4 + 0.5 + 0.5 * gs; }
  },

  // 검기가 날아가는 동안 (얼음: 지나간 길을 얼린다)
  onWaveMove(w) {
    const is = this.lv('ice_special');
    if (!is) return;
    if (!w.lastZone || Math.hypot(w.x - w.lastZone.x, w.y - w.lastZone.y) > 20) {
      w.lastZone = { x: w.x, y: w.y };
      this.zone(w.x, w.y + 6, 'ice', 1.5 + 0.5 * is);
    }
  },

  onKill(e) {
    const p = G.player;
    const ls = this.lv('lifesteal');
    if (ls && p.alive) p.hp = Math.min(p.maxHp, p.hp + 1.5 + 0.5 * ls); // 2 · 2.5 · 3
    const cb = this.lv('chain_burst');
    if (cb && e.burn && e.burn.stacks > 0) this.explode(e.x, e.y, 55, p.atk * (0.8 + 0.4 * cb), '#ff7a3c', true);
    // 독의 기본 성질: 독에 걸린 적이 죽으면 주변 2명에게 절반만큼 전염
    if (e.poison && e.poison.stacks > 1) {
      const n = Math.ceil(e.poison.stacks / 2);
      const list = this.near(e.x, e.y, 80, e).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
      for (const o of list) { this.poison(o, n); G.burst(o.x, o.y, 5, ['#9be15d'], 70); }
    }
  },

  onDashStart(p) { p.dashHits = new Set(); p.zoneFrom = { x: p.x, y: p.y }; },
  onDashMove(p) {
    const fd = this.lv('fire_dash'), id = this.lv('ice_dash'), pd = this.lv('poison_dash'), ed = this.lv('elec_dash');
    if ((fd || id || pd || ed) && Math.hypot(p.x - p.zoneFrom.x, p.y - p.zoneFrom.y) > 12) {
      p.zoneFrom = { x: p.x, y: p.y };
      if (ed) { this.elecMark(p.x, p.y + 4, 0.8); return; } // 전기: 지나간 길에 노란 덩어리 (보이기만)
      const kind = fd ? 'fire' : id ? 'ice' : 'poison';
      this.zone(p.x, p.y + 4, kind, 1.5 + 0.5 * (fd || id || pd));
    }
  },
  onDashEnd(p) {
    const ed = this.lv('elec_dash');
    if (ed) this.strike(p.x, p.y, 45, p.atk * (1 + 0.5 * ed), true); // 전기 대시: 색깔만 (2026-10-18)
    if (this.lv('dash_guard')) p.dashGuardT = 1;
  },

  // 스테이지 클리어: 생명의 샘
  onStageClear(stats) {
    const sp = this.lv('spring');
    if (sp) stats.hp = Math.min(stats.maxHp, (stats.hp || stats.maxHp) + Math.round((5 + 5 * sp) * (curse('heal') ? 0.5 : 1))); // 10 · 15 · 20 (비율 → 고정값, 2026-10-17)
  },

  // 공격 쪽 배율들 (Player 가 사용)
  damageMult(p, kind, t) {
    let m = 1 + 0.1 * this.lv('sharp');
    const role = MOVES[kind] && MOVES[kind].role;
    if (role === 'fin') m *= (1 + COMBO_FIN * Math.max(0, this.lv('atk_combo') - 1)) * (1 + 0.15 * p.mastery('combo'));
    if (role === 'special') m *= 1 + WAVE_DMG * this.lv('atk_wave'); // 특수 강화 축복: 특수공격 피해도 조금
    if (role === 'dash') m *= (1 + THRUST_DMG * Math.max(0, this.lv('atk_thrust') - 1)) * (1 + 0.2 * p.mastery('thrust'));
    if (this.lv('rally')) m *= 1 + 0.5 * (1 - p.hp / p.maxHp);
    const am = p.weapon.slamBoon === 'ambush' ? 0 : this.lv('ambush'); // 방패: 기습 대신 벽꿍 강화 (FX.wallSlam)
    if (am && t && offGuard(t, p)) { m *= 1 + 0.1 + 0.2 * am; t.ambushHit = true; } // 기습: 옆 · 뒤에서, 또는 무방비
    return m * this.shockMult(t) * this.iceMult(t);
  },
  // 동상: 냉기 중첩만큼 (빙결 중이면 최대치), 얼음 균열 중이면 더
  iceMult(t) {
    if (!t) return 1;
    const st = t.frozenT > 0 ? FREEZE_AT : (t.chill || 0);
    return (1 + FROSTBITE_VULN * st) * (t.crackT > 0 ? 1 + ICE_CRACK_VULN : 1);
  },
  critChance() { return 0.1 + 0.08 * this.lv('vital'); },
  critMult() { return 1.8 + 0.2 * this.lv('vital'); },

  updateZones(dt) {
    for (const z of G.zones) {
      z.life -= dt; z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick = 0.4;
      for (const e of this.near(z.x, z.y, z.r)) {
        if (z.look) break; // 보이기만 하는 장판 (전기 대시)
        if (z.kind === 'fire') this.burn(e, 1); else if (z.kind === 'poison') this.poison(e, 1); else this.chill(e, 1);
      }
    }
    G.zones = G.zones.filter(z => z.life > 0);
  },
  // 장판(불길 · 얼음길 · 독안개): 그림 없이 속성 색깔만, 자로 잰 동그라미 대신 3픽셀 도트 덩어리 (2026-10-18)
  //   가장자리 칸은 장판마다 다르게 들쭉날쭉(고정된 무작위), 안쪽은 두 가지 색이 섞여 깜빡인다. 불은 빠르게, 얼음은 느리게 반짝
  drawZones(g) {
    const ga = g.globalAlpha, P = 3;
    const hash = (a, b, c) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return v - Math.floor(v); };
    const COL = { fire: [[255, 120, 40], [255, 186, 70], 0.42, 9], poison: [[110, 196, 64], [160, 222, 90], 0.42, 3], ice: [[180, 230, 255], [235, 250, 255], 0.5, 1.5], elec: [[255, 214, 60], [255, 248, 170], 0.55, 14] };
    for (const z of G.zones) {
      const [c1, c2, al, speed] = COL[z.kind] || COL.ice, life = clamp(z.life / z.max, 0, 1);
      const seed = (z.x * 0.37 + z.y * 0.71) | 0, R = z.r, n = Math.ceil(R / P), tick = Math.floor(G.time * speed);
      const x0 = Math.round(z.x / P) * P, y0 = Math.round(z.y / P) * P;
      g.globalAlpha = ga * al * Math.min(1, life * 3);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const d = Math.hypot(i * P, j * P * 1.25) / R; // 땅 위라 위아래로 조금 납작하게
        if (d > 1) continue;
        if (d > 0.7 && hash(seed, i, j) < (d - 0.7) / 0.3) continue; // 가장자리는 들쭉날쭉
        const c = hash(seed + tick, i, j) < 0.3 ? c2 : c1;
        g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        g.fillRect(x0 + i * P, y0 + j * P, P, P);
      }
    }
    g.globalAlpha = ga;
  },

  // 플레이어가 맞기 직전: 실제 받을 피해를 돌려준다 (0이면 막음)
  playerHurt(dmg, src) {
    const p = G.player;
    if (this.lv('leaf') && p.leafT <= 0) {
      p.leafT = 20 - 4 * this.lv('leaf');
      G.text(p.x, p.y - 26, '잎사귀 방패!', '#e8ff9c', 12, 0.8);
      pixRing(p.x, p.y, '#e8ff9c', 30);
      p.invuln = Math.max(p.invuln, 0.5);
      return 0;
    }
    const fb = this.lv('frostbite');
    if (fb && (src.chill > 0 || src.frozenT > 0)) dmg *= 1 - (0.2 + 0.1 * fb);
    if (this.lv('skin')) dmg *= 1 - (0.04 + 0.04 * this.lv('skin')); // -8 · -12 · -16%
    if (p.dashGuardT > 0) dmg *= 1 - (0.3 + 0.1 * this.lv('dash_guard'));
    if (p.spinGuardT > 0) dmg *= 0.5;
    return Math.max(1, Math.round(dmg));
  },

  drawStatus(g, e) {
    if (e.dead) return;
    if (e.frozenT > 0) { // 빙결: 각진 얼음 덩어리
      const l = e.x - e.r - 4, r = e.x + e.r + 4, t = e.y - e.r - 8, b = e.y + e.r + 5, w = r - l;
      g.fillStyle = 'rgba(180,230,255,0.55)'; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(l + w * 0.2, t); g.lineTo(l + w * 0.75, t + 2); g.lineTo(r, t + (b - t) * 0.3); g.lineTo(r - 2, b - 3);
      g.lineTo(l + w * 0.55, b); g.lineTo(l + 2, b - 4); g.lineTo(l, t + (b - t) * 0.35); g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(l + w * 0.25, t + 4); g.lineTo(l + w * 0.12, t + (b - t) * 0.45); g.moveTo(l + w * 0.4, t + 3); g.lineTo(l + w * 0.32, t + 9); g.stroke();
    } else if (e.chill > 0) {
      g.strokeStyle = 'rgba(127,216,255,0.8)'; g.lineWidth = e.chill;
      g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.7, e.r + 2, e.r * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    if (e.poison && e.poison.stacks > 0) {
      g.fillStyle = '#9be15d'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
      g.fillText('☠' + e.poison.stacks, e.x, e.y + e.r + 12);
      if (Math.random() < 0.08 + 0.02 * e.poison.stacks) // 올라가는 독 기포
        G.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-4, 6), vx: rand(-5, 5), vy: rand(-28, -14), life: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#9be15d' : '#c8f59a', size: 2, grav: 0 });
    }
    if (e.burn && e.burn.stacks > 0) { // 화상: 머리 위 불꽃 (중첩이 많을수록 크게) + 몸이 붉게 깜빡임
      const k = Math.min(1.6, 0.7 + 0.25 * e.burn.stacks), fl = Math.sin(G.time * 22 + e.x) * 1.2;
      const fx = e.x, fy = e.y - e.r - 7;
      g.fillStyle = 'rgba(255,90,40,0.85)';
      g.beginPath(); g.ellipse(fx, fy, 3.2 * k, 5 * k + fl, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,214,74,0.95)';
      g.beginPath(); g.ellipse(fx, fy + 1.5 * k, 1.6 * k, 2.8 * k + fl * 0.5, 0, 0, Math.PI * 2); g.fill();
      if (((G.time * 8) | 0) % 2 === 0) { g.fillStyle = 'rgba(255,80,40,0.18)'; g.beginPath(); g.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2); g.fill(); }
      if (Math.random() < 0.12) G.particles.push({ x: e.x + rand(-e.r, e.r) * 0.6, y: e.y - e.r * 0.3, vx: rand(-10, 10), vy: rand(-50, -25), life: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#ff7a3c' : '#ffd24a', size: 2, grav: 0 });
    }
    if (e.shockT > 0 && ((G.time * 14) | 0) % 2 === 0) {
      g.strokeStyle = '#ffe14a'; g.lineWidth = 1.5;
      for (const s of [-1, 1]) {
        const x = e.x + s * (e.r + 2), y = e.y - e.r * 0.5;
        g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + s * 3, y - 1); g.lineTo(x - s * 1, y + 1); g.lineTo(x + s * 2, y + 6); g.stroke();
      }
    }
  },

  drawBolts(g) {
    for (const b of G.bolts) {
      g.globalAlpha = clamp(b.life / 0.2, 0, 1);
      const n = 6, pts = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n, j = i === 0 || i === n ? 0 : rand(-7, 7);
        pts.push([b.x1 + (b.x2 - b.x1) * k + j, b.y1 + (b.y2 - b.y1) * k + j * 0.4]);
      }
      for (const [w, c] of [[4, 'rgba(255,225,74,0.6)'], [1.5, '#fff']]) {
        g.strokeStyle = c; g.lineWidth = w;
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
    }
    g.globalAlpha = 1;
  },
};
