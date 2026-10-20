'use strict';
// ── 무기 공통 틀 ── 무기 하나 = js/weapons/<무기>.js 파일 하나 (2026-10-17 정리)
// 무기마다 기본공격 · 차지공격 · 특수공격 · 대시 공격이 다르다. 무기는 상위 호환이 아니라 다른 플레이: 서로 강한 곳과 약한 곳이 있어야 한다.
//
// ■ 새 무기를 만들 때 할 일 (체크리스트)
//  1. js/weapons/<id>.js 를 만든다 (spear.js 를 본보기로). index.html 에 boons.js 다음, game.js 앞에 <script> 한 줄 추가
//     → 마을 무기고 순서는 무기 파일을 불러오는 순서다
//  2. addWeapon('<id>', { name, style, essence, unlockCost, moves, chargeTime, specialCd, cdPerLv, cdPerMastery, cdFloor,
//       basic(p, mag) · charged(p, mag) · special(p, mag) · basicAfterDash(p), rows(A, P, D) 기술표, shieldHint, mastery 4종,
//       comboLen(마무리 타 순서, 기본 3), 필요하면 speedMult · dashCharges · dashSpeed · dashCdMult })
//  3. Object.assign(WEAPONS.<id>, { draw(p, g, x, y) 무기 그림, padIcon(b, p) 특수 버튼 그림, glyph { basic, plus, charge, special } 축복 아이콘,
//       dodgeText 저스트 회피 문구, 선택: enhanceSlot('special' 이면 강화 축복이 특수에 붙음), wallSlam, onBasicHit, onSpecialHit, notes · notesTitle 기술 화면 설명 })
//  4. Object.assign(MOVES, { 기술: { mult, kb, guardBreak, role } }) — role 이 축복 · 숙련 · 타격감을 정한다
//       role: 'basic' 기본 · 'fin' 마무리(연격 · 3타 숙련) · 'charge' 차지(속성 차지 축복) · 'special' 특수(onSpecialHit) · 'dash' 대시 공격(돌진 강화 · 대시 숙련)
//       표시: light(가벼운 타격, 멈춤 짧게) · ranged(원거리) · momentum(맞으면 쌍검 기세) · orbRefund(맞으면 마력 구슬 충전)
//  5. extendPlayer({ startXxx(mag) {…} }) 로 기술 시작 함수를, ACT_HANDLERS.push(function (a, dt, fx, fy) {…}) 로 기술 진행(맞히기 · 이동)을 넣는다
//       진행 함수는 자기 기술(a.kind)이면 처리하고 true 를 돌려준다
//  6. BOON_FORMS.<id> = { 축복id: { name, desc, needs } } — 축복 이름 · 설명을 이 무기 모양으로 (없으면 검 이름 그대로)
//     무기 전용 축복 동작은 Object.assign(FX, { onXxx(…) {…} }) 로 넣고 기술에서 부른다
//  7. 효과음: Sfx.swing() 같은 공통 소리를 쓰거나, Sfx.register('<id>.<소리>', 8비트 정의) 로 새 소리를 만들어 Sfx['<id>.<소리>']() 로 부른다
//  8. 그림 파일은 art.js 의 ART_FILES 에 (빌드가 거기 적힌 것만 올린다), 시험 빌드는 meta.js 의 TEST_BUILDS 에
//  9. 확인: test-harness.js 로 다른 무기 숫자가 그대로인지, 새 무기로 보스 · 무리전이 도는지

const WEAPONS = {};
const WEAPON_ORDER = [];      // 마을 무기고에 보이는 순서 (addWeapon 순서)
const UPCOMING_WEAPONS = []; // 아직 만들지 않은 무기: { name, cost } → 무기고에 '차후 구현' (활은 2026-10-20 완성)
const ACT_HANDLERS = [];      // 기술 진행 처리기 (무기 파일들이 넣는다)
function addWeapon(id, def) { WEAPONS[id] = def; WEAPON_ORDER.push(id); return def; }
// 화면에 보이는 무기 순서 (2026-10-20): 해금한 순서대로(저장의 unlocked 순서), 그 뒤에 아직 안 연 무기는 원래 순서.
//   무기고 · 축복 도감 무기 탭 · LB/RB 무기 넘기기가 모두 이 순서를 쓴다
function weaponOrder() {
  const got = ((typeof Meta !== 'undefined' && Meta.data && Meta.data.unlocked) || []).filter(id => WEAPONS[id]);
  const seen = new Set(got);
  return [...seen, ...WEAPON_ORDER.filter(id => !seen.has(id))];
}
// 플레이어에 기술 함수 · 계산값(get)을 붙인다
function extendPlayer(obj) { Object.defineProperties(Player.prototype, Object.getOwnPropertyDescriptors(obj)); }
