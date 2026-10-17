'use strict';
// 무기 정의: 무기마다 기본공격 · 차지공격 · 특수공격 · 전용스킬이 다르다.
// 새 무기를 만들 땐 이 표에 항목을 하나 더 추가하고, 동작을 정의하면 된다.
//   basic(p, mag)    — 기본공격 버튼을 눌렀을 때
//   charged(p, mag)  — 기본공격 버튼을 chargeTime 초 동안 누르고 있다가 뗐을 때
//   special(p, mag)  — 특수공격 버튼 (specialCd 쿨타임)
//   skill(p, mag)    — 전용스킬 버튼 (skillCd 쿨타임). null 이면 버튼이 나오지 않는다.
// 대시는 모든 무기 공통이다. 대시 직후 기본공격은 basicAfterDash 로 바뀔 수 있다.
// 무기는 상위 호환이 아니라 다른 플레이: 서로 강한 곳과 약한 곳이 있어야 한다.
// 숙련 id(combo · spin · wave · thrust)는 무기마다 기본 2타 · 차지 · 특수 · 대시공격 자리에 쓴다.

const WEAPONS = {
  sword: {
    name: '용사의 검',
    style: '난전형 · 빠른 연타와 회전베기, 포위에 강함',
    essence: '무기의 정수',   // 숙련 강화 재화 (모든 무기 공통)
    unlockCost: 0,
    moves: { basic: '3연타', charged: '회전베기', special: '섬광 검기', dashAttack: '대시 찌르기' },
    chargeTime: 0.55,
    specialCd: 5.0,
    // 특수공격 쿨타임 감소: 거대 검기 레벨당 · 숙련 단계당 (초), 이 아래로는 안 내려간다
    cdPerLv: 0.7, cdPerMastery: 0.5, cdFloor: 1.5,
    skillCd: 0,
    basic: (p, mag) => p.startAttack(mag),
    basicAfterDash: p => p.startThrust(),
    charged: (p, mag) => p.startSpin(mag),
    special: (p, mag) => p.castWave(mag),
    skill: null,
    // 기술표 (일시정지 화면)
    rows: (A, P, D) => [
      ['기본 · 3연타', `${A} ${A} ${A}`, '3타째는 넓고 강한 마무리'],
      ['차지 · 회전베기', `${A} 길게 눌렀다 떼기`, '주변 전체 · 가드 브레이크'],
      ['특수 · 섬광 검기', `${P} (쿨타임 5초)`, '관통하는 큰 검기'],
      ['대시', `${D} (쿨타임 ${DASH_CD}초)`, '짧은 무적 이동'],
      ['대시 찌르기', `${D} → ${A}`, '돌진 관통 · 가드 브레이크', 'thrust'],
      ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
      ['삼연 검기', `3타째 직후 ${P}`, '세 갈래 검기', 'triple'],
    ],
    shieldHint: '저 방패병은 정면 공격을 막아요! 공격을 길게 눌렀다 떼는 회전베기로 방패를 깨거나, 뒤로 돌아가서 공격해요.',
    // 무기 숙련 (마을에서 무기의 정수로 강화)
    mastery: [
      { id: 'combo',  name: '연속베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `3타째 피해 +${15 * lv}%` },
      { id: 'spin',   name: '회전베기 숙련',   max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 회전베기 범위 +${8 * lv}%` },
      { id: 'wave',   name: '섬광 검기 숙련',  max: 3, cost: [3, 5, 8], desc: lv => `섬광 검기 쿨타임 -${(0.5 * lv).toFixed(1)}초 (최소 1.5초)` },
      { id: 'thrust', name: '대시 찌르기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `대시 찌르기 피해 +${20 * lv}%` },
    ],
  },

  // 결투형: 길고 좁은 찌르기. 창끝으로 맞히면 강하고, 붙거나 둘러싸이면 약하다. 360° 공격이 없다.
  spear: {
    name: '바람의 창',
    style: '결투형 · 긴 사거리와 창끝 치명타, 포위에 약함',
    essence: '무기의 정수',
    unlockCost: 1,             // 영웅의 증표
    moves: { basic: '2연 찌르기', charged: '관통 찌르기', special: '창 투척', dashAttack: '후려치기' },
    chargeTime: 0.55, // 검과 같은 차지 시간 (0.8 → 0.55, 2026-10-16)
    specialCd: 2.0, // 1.3 → 1.18 (2026-10-16) → 2.0 (2026-10-17, 투척만 던져도 검보다 세서)
    // 투척 쿨타임 감소는 창 기준 숫자로 (검의 -0.7초를 그대로 쓰면 Lv1에서 바닥에 닿았다). 바닥 0.5초 > 창이 돌아오는 0.32초 (2026-10-17)
    cdPerLv: 0.15, cdPerMastery: 0.1, cdFloor: 0.5,
    // 민첩하지 않은 무기: 이동이 조금 느리고, 대시는 짧은 거리 · 긴 쿨타임
    speedMult: 0.92,
    dashCharges: 2,
    dashSpeed: 270,
    dashCdMult: 0.85 / DASH_CD, // 대시 1칸 충전 0.85초 (검 0.7초 · 예전 1.05초)
    skillCd: 0,
    basic: (p, mag) => p.startPoke(mag),
    basicAfterDash: p => p.startSweep(),
    charged: (p, mag) => p.startLunge(mag),
    special: (p, mag) => p.throwSpear(mag),
    skill: null,
    rows: (A, P, D) => [
      ['기본 · 2연 찌르기', `${A} ${A}`, '창끝 ×1.25 · 붙으면 ×0.6 · 최대 3명 관통'],
      ['차지 · 관통 찌르기', `${A} 길게 눌렀다 떼기`, '강하고 긴 찌르기 (회전베기보다 셈) · 전부 관통 · 가드 브레이크'],
      ['특수 · 창 투척', `${P} (쿨타임 2초)`, '갔다 돌아오며 관통 (돌아올 땐 절반) · 그동안 공격 불가'],
      ['대시', `${D} (쿨타임 ${+(DASH_CD * WEAPONS.spear.dashCdMult).toFixed(2)}초 · 2회)`, '짧은 무적 이동 · 검보다 짧고 느리다'],
      ['후려치기', `${D} → ${A}`, '앞쪽 120도를 휩쓸기 · 바깥쪽일수록 아픔 · 가드 브레이크', 'thrust'],
      ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
      ['삼연 투척', `2타째 직후 ${P}`, '창 세 자루가 부채꼴로', 'triple'],
      ['벽꿍', '2타째 · 관통 찌르기로 벽에 밀기', '추가 피해 + 기절'],
    ],
    notesTitle: '창 특성',
    notes: [
      '창끝(먼 쪽)으로 맞히면 피해 ×1.25, 너무 붙어서 창대에 맞으면 ×0.6이에요. 거리를 두고 싸워요.',
      '던진 창이 돌아올 때까지는 공격할 수 없어요. 돌아오는 창에 맞은 적은 절반 피해를 받아요.',
      '2타째 찌르기나 관통 찌르기로 적을 벽에 밀면 벽꿍: 추가 피해 + 기절.',
      '저스트 회피에 성공하면 날아가던 창이 바로 손으로 돌아와요.',
    ],
    comboLen: 2,
    shieldHint: '저 방패병은 정면 공격을 막아요! 2타째 찌르기나 관통 찌르기는 방패를 뚫어요. 뒤로 돌아가도 돼요.',
    mastery: [
      { id: 'combo',  name: '연속 찌르기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `2타째 찌르기 피해 +${15 * lv}%` },
      { id: 'spin',   name: '관통 찌르기 숙련', max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 관통 찌르기 길이 +${5 * lv}%` },
      { id: 'wave',   name: '투척 숙련',        max: 3, cost: [3, 5, 8], desc: lv => `창 투척 쿨타임 -${(0.1 * lv).toFixed(1)}초 (최소 0.5초)` },
      { id: 'thrust', name: '후려치기 숙련',    max: 3, cost: [2, 4, 7], desc: lv => `후려치기 피해 +${20 * lv}%` },
    ],
  },

  // 쌍검(사이): 가장 빠른 연타 + 기세. 사거리가 가장 짧고, 강한 한 방은 받아치기 타이밍에 달렸다 (2026-10-17, 건틀릿을 대신함)
  sai: {
    name: '정령의 쌍검',
    style: '연타형 · 가장 빠른 쌍검 연타와 기세, 받아치기 · 사거리가 가장 짧음',
    essence: '무기의 정수',
    unlockCost: 2,             // 영웅의 증표: 창 1 · 쌍검 2 · 마법봉 3 (뒤 무기일수록 하나씩 더, 2026-10-17)
    moves: { basic: '3연타', charged: '그림자 연참', special: '받아치기', dashAttack: '선풍 베기' },
    chargeTime: 0.55,
    specialCd: 3.0,
    cdPerLv: 0.4, cdPerMastery: 0.3, cdFloor: 1.5,
    speedMult: 1,
    dashCharges: 3,
    dashSpeed: 300,
    dashCdMult: 0.8 / DASH_CD, // 대시 1칸 충전 0.8초 · 3회 · 거리는 짧다
    skillCd: 0,
    basic: (p, mag) => p.startJab(mag),
    basicAfterDash: p => p.startWhirl(),
    charged: (p, mag) => p.startRush(mag),
    special: (p, mag) => p.startParry(mag),
    skill: null,
    rows: (A, P, D) => [
      ['기본 · 3연타', `${A} ${A} ${A}`, '아주 빠르지만 짧다 · 3타째 X자 베기 · 가드 브레이크'],
      ['기세', '기본공격을 맞힐 때마다 +1 (최대 5)', `한 칸마다 공격 · 이동 속도 +5% · ${MOMENTUM_TIME}초 못 때리거나 맞으면 0`],
      ['차지 · 그림자 연참', `${A} 길게 눌렀다 떼기`, '앞으로 순식간에 지나가며 베기 · 무적 · 기세를 다 써서 한 칸마다 +20%'],
      ['특수 · 받아치기', `${P} (쿨타임 3초)`, '0.4초 막는 자세 · 그 사이 맞으면 막고 반격 치명타 + 기절 + 기세 +2'],
      ['대시', `${D} (쿨타임 ${+(DASH_CD * WEAPONS.sai.dashCdMult).toFixed(2)}초 · 3회)`, '짧고 빠른 연속 대시'],
      ['선풍 베기', `${D} → ${A}`, '한 바퀴 돌며 주변을 벤다', 'thrust'],
      ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
      ['교차 받아치기', `3타째 직후 ${P}`, '막는 시간 0.6초 · 반격이 주변 적 모두에게', 'triple'],
    ],
    notesTitle: '쌍검 특성 · 기세와 받아치기',
    notes: [
      '기세는 쌍검만 쓰는 전투 자원이에요. 캐릭터 머리 위 주황색 점 5개로 보여요.',
      '쌓기: 기본공격(찌르기 · X자 베기 · 선풍 베기)이 맞으면 동작마다 1칸, 받아치기에 성공하면 2칸. 최대 5칸이에요.',
      '효과: 쌓인 1칸마다 공격 속도와 이동 속도 +5% (5칸이면 +25%).',
      '쓰기: 그림자 연참이 기세를 모두 써서 1칸마다 피해 +20% (5칸이면 2배).',
      '사라짐: 1.5초 동안 기본공격을 못 맞히거나, 적에게 맞으면 0이 돼요. 꺼지기 직전엔 점이 흐려져요.',
      '받아치기: 막는 자세(0.4초) 중에 공격을 받으면 피해 없이 그 적을 향해 베고 지나가요. 지나가는 동안과 도착 직후는 무적, 길 위의 적은 모두 반격 치명타 + 기절.',
    ],
    comboLen: 3,
    shieldHint: '저 방패병은 정면 공격을 막아요! 3타째 X자 베기나 그림자 연참은 방패를 깨요. 받아치기로 공격을 막아도 기절해요.',
    mastery: [
      { id: 'combo',  name: '교차 베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `3타째 X자 베기 피해 +${15 * lv}%` },
      { id: 'spin',   name: '그림자 연참 숙련', max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 연참 거리 +${3 * lv}%` },
      { id: 'wave',   name: '받아치기 숙련',    max: 3, cost: [3, 5, 8], desc: lv => `받아치기 쿨타임 -${(0.3 * lv).toFixed(1)}초 (최소 1.5초)` },
      { id: 'thrust', name: '선풍 베기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `선풍 베기 피해 +${20 * lv}%` },
    ],
  },

  // 마법봉: 기본공격은 약하지만 마력 구슬을 모아 쏜다. 키울수록 구슬이 늘어 난사가 된다 (2026-10-17)
  // 특수공격은 쿨타임 대신 탄창(마력 구슬). specialCd 는 연사 간격으로만 쓴다
  staff: {
    name: '정령의 마법봉',
    style: '마법형 · 기본공격은 약하지만 마력 구슬을 모아 난사, 키울수록 탄막',
    essence: '무기의 정수',
    unlockCost: 3,
    moves: { basic: '2연타', charged: '마법진', special: '마력탄', dashAttack: '마력 파동' },
    chargeTime: 0.55,
    specialCd: 0.12,     // = ORB_INTERVAL (아래 상수는 이 표보다 뒤에 있어서 숫자로)
    cdPerLv: 0, cdPerMastery: 0, cdFloor: 0.12,
    notesTitle: '마법봉 특성 · 마력 구슬',
    notes: [
      '마력 구슬은 마력탄의 탄창이에요. 캐릭터 머리 위에 떠서 도는 구슬로 보여요.',
      '충전: 기본 3개까지, 0.4초마다 1개씩 차요. 휘두르기가 적에게 맞으면 충전이 0.25초 빨라져요.',
      '쏘기: 특수 버튼을 누르면 구슬 1개로 마력탄 1발. 누르고 있으면 구슬이 남는 만큼 연달아 쏴요.',
      '성장: 마력 증폭 축복(레벨마다)과 마력탄 숙련(단계마다)으로 최대 개수가 1개씩 늘어요. 다 키우면 9개. 속성 축복은 구슬 한 발 한 발에 붙어요.',
      '저스트 회피에 성공하면 구슬이 가득 차요.',
    ],
    orbs: true,          // 마력 구슬을 쓰는 무기
    holdSpecial: true,   // 특수 버튼을 누르고 있으면 연사
    comboLen: 2,
    skillCd: 0,
    basic: (p, mag) => p.startBonk(mag),
    basicAfterDash: p => p.startPulse(),
    charged: (p, mag) => p.startCircle(mag),
    special: (p, mag) => p.castOrb(mag),
    skill: null,
    rows: (A, P, D) => [
      ['기본 · 2연타', `${A} ${A}`, '약하고 짧다 · 맞힐 때마다 구슬 충전이 빨라짐'],
      ['마력 구슬', `최대 ${ORB_BASE}개 · ${ORB_RECHARGE}초마다 1개`, '머리 위에 떠 있는 탄창 · 마력 증폭 축복으로 늘어난다'],
      ['특수 · 마력탄', `${P} (누르고 있으면 연사)`, '구슬 1개로 살짝 유도되는 마력탄 · 사거리 220'],
      ['차지 · 마법진', `${A} 길게 눌렀다 떼기`, '앞쪽(가까운 적 발밑)에 마법진 · 0.5초 뒤 폭발'],
      ['대시', `${D} (쿨타임 ${DASH_CD}초)`, '짧은 무적 이동'],
      ['마력 파동', `${D} → ${A}`, '주변을 크게 밀어낸다', 'thrust'],
      ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타 + 구슬 가득', 'dodge'],
      ['삼연 마력탄', `2타째 직후 ${P}`, '구슬 1개로 세 발이 부채꼴로', 'triple'],
    ],
    shieldHint: '저 방패병은 정면 공격을 막아요! 2타째 휘두르기나 마법진은 방패를 깨요. 마력탄으로 등 뒤를 노려도 돼요.',
    mastery: [
      { id: 'combo',  name: '휘두르기 숙련',   max: 3, cost: [2, 4, 7], desc: lv => `2타째 피해 +${15 * lv}%` },
      { id: 'spin',   name: '마법진 숙련',     max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 마법진 범위 +${8 * lv}%` },
      { id: 'wave',   name: '마력탄 숙련',     max: 3, cost: [3, 5, 8], desc: lv => `마력 구슬 최대 개수 +${lv}` },
      { id: 'thrust', name: '마력 파동 숙련',  max: 3, cost: [2, 4, 7], desc: lv => `마력 파동 피해 +${20 * lv}%` },
    ],
  },
};

// 마법봉 수치 (2026-10-17)
const ORB_BASE = 3;             // 마력 구슬 기본 최대 개수 (마력 증폭 레벨마다 +1)
const ORB_RECHARGE = 0.4;       // 구슬 1개 충전 시간 (1.0 → 0.4: 멀리서 쏘기만 하면 너무 약했다, 2026-10-17)
const ORB_INTERVAL = 0.12;      // 누르고 있을 때 연사 간격
const ORB_REFUND = 0.25;        // 기본공격이 맞으면 충전이 이만큼 빨라진다
const ORB_RANGE = 220;          // 마력탄 사거리
const STAFF_REACH = 34;         // 마법봉 휘두르기 사거리
const CIRCLE_R = 55;            // 마법진 반경
const CIRCLE_DELAY = 0.5;       // 마법진이 터지기까지
const PULSE_R = 50;             // 마력 파동 반경

// 쌍검 수치 (2026-10-17)
const SAI_REACH = 32;           // 찌르기 사거리 (검 37 · 창 74) — 가장 짧다
const SAI_FIN_REACH = 36;       // 3타째 X자 베기
const MOMENTUM_MAX = 5;         // 기세 최대 칸
const MOMENTUM_SPEED = 0.05;    // 기세 한 칸마다 공격 · 이동 속도 +5%
const MOMENTUM_TIME = 1.5;      // 이 시간 동안 기본공격을 못 맞히면 기세가 사라진다
const MOMENTUM_RUSH = 0.2;      // 그림자 연참이 기세를 다 써서 한 칸마다 피해 +20%
const RUSH_LEN = 89;            // 그림자 연참 거리 (110 → 99 → 89, 2026-10-17)
const RUSH_TIME = 0.16;         // 그림자 연참으로 지나가는 시간 (무적)
const RUSH_WIDTH = 16;          // 연참 판정 폭
const PARRY_TIME = 0.4;         // 받아치기 막는 시간
const PARRY_TRIPLE = 0.6;       // 3타째 직후 교차 받아치기
const PARRY_STUN = 0.8;         // 반격에 맞은 적 기절 (보스 제외)
const PARRY_WIDE_R = 70;        // 교차 받아치기: 주변 적도 함께 벤다
const RIPOSTE_TIME = 0.14;      // 반격으로 베고 지나가는 시간 (무적)
const RIPOSTE_SAFE = 0.35;      // 도착한 뒤에도 이만큼 무적
const RIPOSTE_PAST = 30;        // 적을 지나 이만큼 더 간다
const RIPOSTE_MAX = 150;        // 반격 돌진 최대 거리
const WHIRL_R = 40;             // 선풍 베기 반경

// 창 수치
const SPEAR_REACH = 74;        // 찌르기 길이 (검 3타째 46)
const SPEAR_WIDTH = 12;        // 찌르기 판정 폭 (좁다, 9 → 12)
const SPEAR_PIERCE = 3;        // 찌르기 한 번에 관통하는 최대 수
const SPEAR_TIP = 0.62;        // 길이의 이 비율보다 먼 곳 = 창끝
// 보스전 시험(2026-10-17): 창 단일 대상 피해가 검의 2.7배 → 창끝 1.8 → 1.25, 투척 약화 (E안). 이제 검의 약 1.2배
const SPEAR_TIP_MULT = 1.25;
const SPEAR_BACK_MULT = 0.5;   // 돌아오는 창의 피해 배율 (갈 때 한 번 · 올 때 절반)
const SPEAR_HAFT = 30;         // 이보다 가까우면 창대에 맞음
const SPEAR_HAFT_MULT = 0.6;
const SWEEP_HALF = Math.PI / 3;  // 후려치기 범위: 앞쪽 120도
const SPEAR_PIERCE_LEN = 96;   // 관통 찌르기 길이 (기본 찌르기 74)
const SPEAR_THROW_RANGE = 100; // 투척 비거리
const SPEAR_SPEED = 1.1;       // 창 공격 속도 배율 (찌르기 · 투척 · 후려치기, 1.1 = 10% 빠르게)
const WALL_SLAM_MULT = 0.8;    // 벽꿍 추가 피해 (공격력 배율)

// 마을 무기고에 보이는 순서. 아직 만들지 않은 무기는 '준비 중'으로 표시된다.
const WEAPON_ORDER = ['sword', 'spear', 'sai', 'staff'];
const UPCOMING_WEAPONS = []; // 해금 비용: 영웅의 증표
