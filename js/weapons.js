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
      { id: 'wave',   name: '섬광 검기 숙련',  max: 3, cost: [3, 5, 8], desc: lv => `섬광 검기 쿨타임 -${(0.5 * lv).toFixed(1)}초` },
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
    chargeTime: 0.8,
    specialCd: 1.18, // 1.3 → 10% 빠르게 (2026-10-16)
    // 민첩하지 않은 무기: 이동이 조금 느리고, 대시는 짧은 거리 · 긴 쿨타임
    speedMult: 0.92,
    dashCharges: 2,
    dashSpeed: 270,
    dashCdMult: 1.5,
    skillCd: 0,
    basic: (p, mag) => p.startPoke(mag),
    basicAfterDash: p => p.startSweep(),
    charged: (p, mag) => p.startLunge(mag),
    special: (p, mag) => p.throwSpear(mag),
    skill: null,
    rows: (A, P, D) => [
      ['기본 · 2연 찌르기', `${A} ${A}`, '창끝 ×1.8 · 붙으면 ×0.6 · 최대 3명 관통'],
      ['차지 · 관통 찌르기', `${A} 길게 눌렀다 떼기`, '조금 더 긴 찌르기 · 전부 관통 · 가드 브레이크'],
      ['특수 · 창 투척', `${P} (쿨타임 1.2초)`, '갔다 돌아오며 관통 · 그동안 공격 불가'],
      ['대시', `${D} (쿨타임 ${+(DASH_CD * 1.5).toFixed(2)}초 · 2회)`, '짧은 무적 이동 · 검보다 짧고 느리다'],
      ['후려치기', `${D} → ${A}`, '앞쪽 120도를 휩쓸기 · 바깥쪽일수록 아픔 · 가드 브레이크', 'thrust'],
      ['저스트 회피', `공격 직전에 ${D}`, '슬로우 + 반격 치명타', 'dodge'],
      ['삼연 투척', `2타째 직후 ${P}`, '창 세 자루가 부채꼴로', 'triple'],
      ['벽꿍', '2타째 · 관통 찌르기로 벽에 밀기', '추가 피해 + 기절'],
    ],
    shieldHint: '저 방패병은 정면 공격을 막아요! 2타째 찌르기나 관통 찌르기는 방패를 뚫어요. 뒤로 돌아가도 돼요.',
    mastery: [
      { id: 'combo',  name: '연속 찌르기 숙련', max: 3, cost: [2, 4, 7], desc: lv => `2타째 찌르기 피해 +${15 * lv}%` },
      { id: 'spin',   name: '관통 찌르기 숙련', max: 3, cost: [3, 5, 8], desc: lv => `차지 시간 -${10 * lv}%, 관통 찌르기 길이 +${5 * lv}%` },
      { id: 'wave',   name: '투척 숙련',        max: 3, cost: [3, 5, 8], desc: lv => `창 투척 쿨타임 -${(0.5 * lv).toFixed(1)}초` },
      { id: 'thrust', name: '후려치기 숙련',    max: 3, cost: [2, 4, 7], desc: lv => `후려치기 피해 +${20 * lv}%` },
    ],
  },
};

// 창 수치
const SPEAR_REACH = 74;        // 찌르기 길이 (검 3타째 46)
const SPEAR_WIDTH = 9;         // 찌르기 판정 폭 (좁다)
const SPEAR_PIERCE = 3;        // 찌르기 한 번에 관통하는 최대 수
const SPEAR_TIP = 0.62;        // 길이의 이 비율보다 먼 곳 = 창끝
const SPEAR_TIP_MULT = 1.8;
const SPEAR_HAFT = 30;         // 이보다 가까우면 창대에 맞음
const SPEAR_HAFT_MULT = 0.6;
const SWEEP_HALF = Math.PI / 3;  // 후려치기 범위: 앞쪽 120도
const SPEAR_PIERCE_LEN = 96;   // 관통 찌르기 길이 (기본 찌르기 74)
const SPEAR_THROW_RANGE = 100; // 투척 비거리
const SPEAR_SPEED = 1.1;       // 창 공격 속도 배율 (찌르기 · 투척 · 후려치기, 1.1 = 10% 빠르게)
const WALL_SLAM_MULT = 0.8;    // 벽꿍 추가 피해 (공격력 배율)

// 마을 무기고에 보이는 순서. 아직 만들지 않은 무기는 '준비 중'으로 표시된다.
const WEAPON_ORDER = ['sword', 'spear'];
const UPCOMING_WEAPONS = [{ name: '다음 무기', cost: 1 }]; // 해금 비용: 영웅의 증표
