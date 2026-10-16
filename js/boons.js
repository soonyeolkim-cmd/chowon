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
const SHOCK_VULN = 0.2;     // 감전된 적이 받는 피해 +20%
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
    desc: lv => `화상 최대 중첩 +${2 * lv}, 지속 시간 +1초.` },
  { id: 'chain_burst', el: 'fire', name: '연쇄 폭발', req: () => ownsAny(BURN_SRC),
    desc: lv => `화상 상태로 쓰러진 적이 폭발해 주변에 공격력의 ${pct(0.8 + 0.4 * lv)} 피해 + 화상.` },

  // ── ❄ 얼음: 냉기 (중첩당 이동 속도 -15%, 4중첩이면 빙결) ──
  { id: 'ice_basic', el: 'frost', slot: 'basic', name: '서리 칼날',
    desc: lv => `기본공격이 냉기를 1중첩 건다. 빙결 시간 ${1 + 0.5 * lv}초.` },
  { id: 'ice_shard', el: 'frost', needs: 'ice_basic', name: '얼음 파편',
    desc: lv => `휘두를 때마다 얼음 파편 ${1 + lv}개가 부채꼴로 날아가 적을 관통하며 냉기 1중첩 (공격력의 ${pct(0.25 + 0.05 * lv)}).` },
  { id: 'ice_charge', el: 'frost', slot: 'charge', name: '빙결 회오리',
    desc: lv => `회전베기에 맞은 적에게 냉기 ${1 + lv}중첩.` },
  { id: 'ice_special', el: 'frost', slot: 'special', name: '빙창 검기',
    desc: lv => `검기에 맞은 적에게 냉기 ${1 + lv}중첩, 검기가 지나간 길이 얼어붙는다.` },
  { id: 'ice_dash', el: 'frost', slot: 'dash', name: '얼음 길',
    desc: lv => `대시한 길이 ${1.5 + 0.5 * lv}초간 얼어붙어 위에 선 적에게 냉기.` },
  { id: 'shatter', el: 'frost', name: '파쇄', req: () => ownsAny(CHILL_SRC),
    desc: lv => `빙결된 적을 때리면 얼음이 깨지며 공격력의 ${pct(1.5 + lv)} 추가 피해, 주변에 냉기 2중첩.` },
  { id: 'frostbite', el: 'frost', name: '한기', req: () => ownsAny(CHILL_SRC),
    desc: lv => `냉기·빙결 상태인 적이 주는 피해 -${20 + 10 * lv}%.` },

  // ── ⚡ 전기: 추가 대미지 (감전: 4초간 받는 피해 +20%) ──
  { id: 'elec_basic', el: 'thunder', slot: 'basic', name: '번개 칼날',
    desc: lv => `기본공격이 감전시킨다. 감전된 적은 4초 동안 받는 피해 +${20 + 10 * (lv - 1)}%. (번개가 튀는 건 연쇄 번개)` },
  { id: 'elec_chain', el: 'thunder', needs: 'elec_basic', name: '연쇄 번개',
    desc: lv => `기본공격이 맞으면 번개가 적에서 적으로 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.45 + 0.15 * lv)}) + 감전.` },
  { id: 'elec_charge', el: 'thunder', slot: 'charge', name: '뇌전 회오리',
    desc: lv => `회전베기 직후 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
  { id: 'elec_special', el: 'thunder', slot: 'special', name: '뇌격 검기',
    desc: lv => `검기에 맞은 적마다 낙뢰 (공격력의 ${pct(0.8 + 0.4 * lv)}) + 감전.` },
  { id: 'elec_dash', el: 'thunder', slot: 'dash', name: '천둥 발걸음',
    desc: lv => `대시가 끝나는 자리에 낙뢰. 주변에 공격력의 ${pct(1 + 0.5 * lv)} 피해 + 감전.` },
  { id: 'static', el: 'thunder', name: '정전기',
    desc: lv => `적을 때릴 때 ${8 + 4 * lv}% 확률로 하늘에서 낙뢰 (공격력의 150%).` },
  { id: 'overcharge', el: 'thunder', name: '과충전', req: () => ownsAny(SHOCK_SRC),
    desc: lv => `감전된 적이 받는 피해가 ${15 * lv}% 더 늘어난다 (감전 기본 +20%에 더해서).` },

  // ── ☠ 독: 중첩될수록 가속되는 피해, 죽으면 주변으로 전염 ──
  { id: 'poison_basic', el: 'poison', slot: 'basic', name: '독날 칼날',
    desc: lv => `기본공격이 독을 1중첩 건다. 독 피해 +${25 * (lv - 1)}%.` },
  { id: 'poison_spray', el: 'poison', needs: 'poison_basic', name: '독 분사',
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
  { id: 'atk_combo', el: 'might', name: '연격', desc: lv => `기본공격 속도 +${15 * lv}%, 3타째 피해 +${30 * lv}%.` },
  { id: 'atk_spin', el: 'might', name: '일섬 회전', desc: lv => `차지 시간 -${15 * lv}%, 회전베기 범위 +${15 * lv}%.` },
  { id: 'atk_multispin', el: 'might', name: '회전 연참',
    desc: lv => `회전베기가 ${1 + lv}번 몰아쳐 벤다. 추가 타격은 피해 ${pct(MULTISPIN_MULT)}, 마지막 타격에만 넉백.` },
  { id: 'atk_wave', el: 'might', name: '거대 검기', desc: lv => `검기 크기·사거리 +${25 * lv}%, 특수공격 쿨타임 -${(0.7 * lv).toFixed(1)}초.` },
  { id: 'atk_thrust', el: 'might', name: '돌진 강화', desc: lv => `대시 찌르기 피해 +${40 * lv}%, 돌진 거리 +${15 * lv}%.` },
  { id: 'sharp', el: 'might', name: '날카로운 검', desc: lv => `모든 피해 +${10 * lv}%.` },
  { id: 'vital', el: 'might', name: '급소 찌르기', desc: lv => `치명타 확률 +${8 * lv}%, 치명타 피해 +${20 * lv}%.` },
  { id: 'ambush', el: 'might', name: '기습', desc: lv => `적의 옆이나 등 뒤에서 때리면 피해 +${10 + 20 * lv}%. 기절 · 빙결된 적도 무방비로 친다.` },

  // ── 🛡 방어: 누적 패시브 (생존) ──
  { id: 'lifesteal', el: 'guard', name: '흡혈 칼날', desc: lv => `적을 쓰러뜨릴 때마다 체력 ${2 * lv} 회복.` },
  { id: 'guard_spin', el: 'guard', name: '수호의 회전', desc: lv => `회전베기 중 무적, 끝난 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50%.` },
  { id: 'heal_wave', el: 'guard', name: '치유의 검기', desc: lv => `검기에 맞은 적 하나마다 체력 ${lv} 회복.` },
  { id: 'dash_guard', el: 'guard', name: '잔상 보호막', desc: lv => `대시 후 1초간 받는 피해 -${30 + 10 * lv}%.` },
  { id: 'tough', el: 'guard', name: '강인한 체력', maxLv: 5, onPick: p => { p.maxHp += 20; p.hp += 20; },
    desc: () => '최대 체력 +20 (즉시 회복). 5번까지 겹친다.' },
  { id: 'spring', el: 'guard', name: '생명의 샘', desc: lv => `스테이지를 클리어할 때마다 최대 체력의 ${10 + 5 * lv}% 회복.` },
  { id: 'leaf', el: 'guard', name: '잎사귀 방패', desc: lv => `${20 - 4 * lv}초마다 받는 피해 1회를 막아 주는 방패가 생긴다.` },
  { id: 'skin', el: 'guard', name: '굳은 피부', desc: lv => `받는 피해 -${8 * lv}%.` },
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
  spear: {
    fire_basic:     { name: '불꽃 창날' },
    fire_bolt:      { name: '화염 관통', desc: lv => `2타째 찌르기가 앞으로 불길을 내뿜는다. 줄 위의 적에게 공격력의 ${pct(0.5 + 0.2 * lv)} 피해 + 화상, 불길이 잠시 남는다.` },
    fire_charge:    { name: '불꽃 꿰뚫기', desc: lv => `관통 찌르기에 맞은 적에게 화상 2중첩, 찌른 줄을 따라 ${1.5 + 0.5 * lv}초간 불길이 남는다.` },
    fire_special:   { name: '폭염 투척', desc: lv => `던진 창이 반환점에서 폭발한다. 주변에 공격력의 ${pct(0.8 + 0.4 * lv)} 피해 + 화상. 창에 맞은 적도 화상.` },
    ice_basic:      { name: '서리 창날' },
    ice_shard:      { name: '빙결 관통', desc: lv => `찌를 때마다 창끝에서 얼음 파편 ${1 + lv}개가 앞으로 날아간다 (공격력의 ${pct(0.25 + 0.05 * lv)} + 냉기). 뒤쪽에서 관통당한 적일수록 냉기가 더 쌓인다.` },
    ice_charge:     { name: '서리 꿰뚫기', desc: lv => `관통 찌르기에 맞은 적에게 냉기 ${1 + lv}중첩.` },
    ice_special:    { name: '서리 창', desc: lv => `창에 맞은 적에게 냉기 ${1 + lv}중첩, 반환점에 ${2 + 0.5 * lv}초간 얼음 장판이 생긴다.` },
    elec_basic:     { name: '번개 창날' },
    elec_chain:     { name: '피뢰 관통', desc: lv => `찌르기가 맞으면 번개가 적에서 적으로 ${2 + lv}번 튄다 (한 번에 공격력의 ${pct(0.45 + 0.15 * lv)}) + 감전. 관통한 적끼리도 번개로 이어진다.` },
    elec_charge:    { name: '뇌전 꿰뚫기', desc: lv => `관통 찌르기 직후 창끝 주변 적 ${2 + lv}명에게 낙뢰 (공격력의 ${pct(0.8 + 0.3 * lv)}) + 감전.` },
    elec_special:   { name: '피뢰 창', desc: lv => `반환점에 낙뢰가 떨어진다 (주변에 공격력의 ${pct(0.8 + 0.4 * lv)}) + 감전. 날아가는 창에 맞은 적도 감전.` },
    poison_basic:   { name: '독날 창날' },
    poison_spray:   { name: '독 창끝', desc: lv => `창끝으로 맞히면 독이 ${1 + lv}중첩 더 쌓인다.` },
    poison_charge:  { name: '독안개 꿰뚫기', desc: lv => `찌른 줄을 따라 ${2 + 0.5 * lv}초간 독안개가 남는다. 안에 있는 적에게 계속 독.` },
    poison_special: { name: '독창', desc: lv => `창에 맞은 적에게 독 ${1 + lv}중첩, 반환점에 ${2 + 0.5 * lv}초간 독 웅덩이가 생긴다.` },
    atk_combo:      { name: '연속 찌르기', desc: lv => `기본공격 속도 +${15 * lv}%, 2타째 피해 +${30 * lv}%.` },
    atk_multispin:  { name: '연환 꿰뚫기', desc: lv => `관통 찌르기 뒤 정령의 창이 같은 줄을 ${lv}번 더 찌른다. 추가 찌르기는 피해 ${pct(MULTISPIN_MULT)}, 마지막에만 넉백.` },
    atk_spin:       { name: '꿰뚫기 강화', desc: lv => `차지 시간 -${15 * lv}%, 관통 찌르기 길이 +${10 * lv}%.` },
    atk_wave:       { name: '투척 강화', desc: lv => `창 비거리·속도 +${20 * lv}%, 특수공격 쿨타임 -${(0.7 * lv).toFixed(1)}초.` },
    atk_thrust:     { name: '후려치기 강화', desc: lv => `후려치기 피해 +${40 * lv}%, 범위 +${10 * lv}%.` },
    sharp:          { name: '날카로운 창' },
    lifesteal:      { name: '흡혈 창날' },
    guard_spin:     { name: '수호의 자세', desc: lv => `관통 찌르기 중과 찌른 뒤 ${(0.5 + 0.5 * lv).toFixed(1)}초간 받는 피해 -50% (무적은 아님).` },
    heal_wave:      { name: '치유의 회수', desc: lv => `돌아오는 창에 맞은 적 하나마다 체력 ${2 * lv} 회복.` },
  },
};
const curWeapon = () => (G.player ? G.player.weaponId : Meta.data ? Meta.data.weapon : 'sword');
const isSpear = () => curWeapon() === 'spear';
for (const b of BOONS) {
  const base = { name: b.name, desc: b.desc };
  const form = () => (BOON_FORMS[curWeapon()] || {})[b.id] || {};
  Object.defineProperty(b, 'name', { get: () => form().name || base.name });
  Object.defineProperty(b, 'desc', { get: () => form().desc || base.desc });
}

// 기본공격 강화 축복(needs)은 그 기본공격 축복을 가지고 있을 때만 나온다
for (const b of BOONS) if (b.needs) b.req = () => !!G.boons[b.needs];
const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));
const boonColor = b => (b.duo ? '#ffb8f0' : ELEMENTS[b.el].color);
const boonIcon = b => (b.duo ? b.duo.map(e => ELEMENTS[e].icon).join('') : ELEMENTS[b.el].icon);
const boonMaxLv = b => b.maxLv || (b.duo ? 1 : 3); // 듀오는 레벨 효과가 없어서 한 번만

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
    if (this.life <= 0 || World.solidAt(this.x, this.y + 6)) { this.done = true; if (this.onEnd) this.onEnd(this); return; }
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
function offGuard(t, p) {
  if (t.stun > 0 || t.frozenT > 0) return true;
  if (t.heading === undefined) return false;
  const from = Math.atan2(p.y - t.y, p.x - t.x); // 적이 보기에 플레이어가 있는 방향
  return Math.abs(angDiff(from, t.heading)) > AMBUSH_ANGLE;
}

// ── 효과 처리 ─────────────────────────────────────────────
const FX = {
  lv(id) {
    const b = BOON_BY_ID[id];
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
  // 번개 칼날 레벨마다 +10%, 과충전 레벨마다 +15%
  shockMult(t) { return t.shockT > 0 ? 1 + SHOCK_VULN + 0.1 * Math.max(0, this.lv('elec_basic') - 1) + 0.15 * this.lv('overcharge') : 1; },

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
  strike(x, y, r, dmg) {
    this.bolt(x + rand(-10, 10), y - 150, x, y);
    G.fxRing(x, y, '#ffe14a', r);
    for (const t of this.near(x, y, r)) { this.shock(t); this.damage(t, dmg * this.lightningMult(t), '#ffe14a', 12); }
    Sfx.zap();
  },
  burn(t, n) {
    const k = this.lv('kindling'), max = 3 + 2 * k;
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
    t.chill = Math.min(4, (t.chill || 0) + n); t.chillT = 3;
    if (t.chill >= 4 && t.type !== 'boss') {
      t.frozenT = 1 + 0.5 * Math.max(1, this.lv('ice_basic'));
      t.chill = 0; t.attacking = false;
      G.text(t.x, t.y - t.r - 14, '빙결!', '#bfefff', 12, 0.7);
      Sfx.freeze();
    }
  },
  explode(x, y, r, dmg, color, burnIt) {
    G.fxRing(x, y, color, r);
    G.burst(x, y, 18, [color, '#fff'], 200);
    G.shake = Math.max(G.shake, 5);
    Sfx.boom();
    for (const t of this.near(x, y, r)) { if (burnIt) this.burn(t, 1); this.damage(t, dmg, color, 12); }
  },
  zone(x, y, kind, life) { G.zones.push({ x, y, r: 14, kind, life, max: life, tick: 0 }); },

  updateStatus(t, dt) {
    if (t.shockT > 0) t.shockT -= dt;
    if (t.overheatT > 0) t.overheatT -= dt;
    if (t.chill > 0) { t.chillT -= dt; if (t.chillT <= 0) t.chill = 0; }
    if (t.frozenT > 0) t.frozenT -= dt;
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
        const power = 0.1 + 0.03 * this.fireLv() + 0.03 * Math.max(0, this.lv('fire_basic') - 1);
        this.damage(t, this.atk() * power * b.stacks, '#ff9a4a', 10);
      }
      if (b.t <= 0) b.stacks = 0;
    }
  },

  // 플레이어 공격이 맞았을 때. kind: light/finisher/thrust = 기본공격, spin = 차지공격, wave = 특수공격
  onHit(t, info) {
    const atk = this.atk(), kind = info.kind;
    const basic = BASIC_KINDS.includes(kind);
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
      const ch = this.lv('elec_chain'), act = G.player.act;
      if (ch && act && !act.chained) { act.chained = true; this.chainJump(t, 2 + ch, this.atk() * (0.45 + 0.15 * ch)); }
      if (isSpear() && act) {
        // 피뢰 관통: 관통한 적끼리 번개로 잇는다
        if (ch && act.prevHit && !act.prevHit.dead && !t.dead) {
          this.bolt(act.prevHit.x, act.prevHit.y - 6, t.x, t.y - 6); this.shock(t);
          this.damage(t, atk * (0.45 + 0.15 * ch) * this.lightningMult(t), '#ffe14a');
        }
        act.prevHit = t;
        // 빙결 관통: 뒤쪽에서 관통당한 적일수록 냉기 추가
        const isd = this.lv('ice_shard');
        if (isd && act.pierced > 1 && !t.dead) this.chill(t, Math.min(2, act.pierced - 1));
        // 독 창끝
        const pss = this.lv('poison_spray');
        if (pss && info.tip && !t.dead) this.poison(t, 1 + pss);
      }
    } else if (kind === 'spin' || kind === 'lunge') {
      if (this.lv('fire_charge')) this.burn(t, 2);
      const ic = this.lv('ice_charge');
      if (ic) this.chill(t, 1 + ic);
      if (this.lv('poison_charge')) this.poison(t, 1);
    } else if (kind === 'spear') {
      // 던진 창: 폭발 · 장판 · 낙뢰는 반환점에서 (onSpearApex)
      if (this.lv('fire_special')) this.burn(t, 1);
      if (this.lv('elec_special')) this.shock(t);
      const is = this.lv('ice_special');
      if (is && !t.dead) this.chill(t, 1 + is);
      const pspc = this.lv('poison_special');
      if (pspc && !t.dead) this.poison(t, 1 + pspc);
      const hw = this.lv('heal_wave'), p = G.player;
      if (hw && info.back && p.alive) p.hp = Math.min(p.maxHp, p.hp + 2 * hw);
    } else if (kind === 'wave') {
      const es = this.lv('elec_special');
      if (es) this.skyBolt(t, atk * (0.8 + 0.4 * es));
      const fs = this.lv('fire_special');
      if (fs && !t.dead) this.explode(t.x, t.y, 50, atk * (0.6 + 0.3 * fs), '#ff7a3c', true);
      const is = this.lv('ice_special');
      if (is && !t.dead) this.chill(t, 1 + is);
      const pspc = this.lv('poison_special');
      if (pspc && !t.dead) this.poison(t, 1 + pspc);
      const hw = this.lv('heal_wave'), p = G.player;
      if (hw && p.alive) p.hp = Math.min(p.maxHp, p.hp + hw);
    }
    const st = this.lv('static');
    if (st && !t.dead && Math.random() < 0.08 + 0.04 * st) this.skyBolt(t, atk * 1.5);
  },

  // 기본공격을 휘두를 때
  onSwing(p, fin) {
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
      const n = 1 + is, spread = 0.7;
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

  // ── 창 ──
  // 찌를 때 (fin = 2타째)
  onPoke(p, fin) {
    const atk = p.atk, f = p.facing, c = Math.cos(f), s = Math.sin(f);
    const fb = this.lv('fire_bolt');
    if (fb && fin) {
      const len = SPEAR_REACH + 60;
      for (let d = 24; d <= len; d += 18) this.zone(p.x + c * d, p.y + s * d + 4, 'fire', 1.2 + 0.3 * fb);
      for (let i = 0; i < 14; i++) {
        const d = rand(20, len);
        G.particles.push({ x: p.x + c * d, y: p.y + s * d, vx: c * 60, vy: s * 60 - 20, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff7a3c' : '#ffd24a', size: 3, grav: 0 });
      }
      for (const t of this.near(p.x, p.y, len)) {
        const dx = t.x - p.x, dy = t.y - p.y, along = dx * c + dy * s;
        if (along < 0 || Math.abs(dx * s - dy * c) > 16 + t.r) continue;
        this.burn(t, 1);
        this.damage(t, atk * (0.5 + 0.2 * fb), '#ff9a4a', 11);
      }
      Sfx.boom();
    }
    const is = this.lv('ice_shard');
    if (is) {
      const n = 1 + is, spread = 0.24;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1);
        G.projectiles.push(new FxShot(p.x + c * 30, p.y - 4 + s * 30, f + o, {
          kind: 'ice', speed: 380, life: 0.42, r: 5, pierce: true,
          onHit: t => { this.chill(t, 1); this.damage(t, atk * (0.25 + 0.05 * is), '#bfefff', 10); },
        }));
      }
      Sfx.freeze();
    }
  },
  // 관통 찌르기를 할 때: 찌른 줄을 따라 불길 · 독안개, 수호의 자세
  onPierce(p, len) {
    const gs = this.lv('guard_spin');
    if (gs) p.spinGuardT = p.act.dur + 0.5 + 0.5 * gs; // 창은 무적 없이 피해 감소만
    const fc = this.lv('fire_charge'), pc = this.lv('poison_charge');
    if (!fc && !pc) return;
    const c = Math.cos(p.facing), s = Math.sin(p.facing);
    for (let d = 26; d <= len; d += 16) {
      if (fc) this.zone(p.x + c * d, p.y + s * d + 4, 'fire', 1.5 + 0.5 * fc);
      if (pc) this.zone(p.x + c * d, p.y + s * d + 4, 'poison', 2 + 0.5 * pc);
    }
  },
  onLungeEnd(p) {
    const ec = this.lv('elec_charge');
    if (ec) {
      const tx = p.x + Math.cos(p.facing) * p.pierceLen * 0.7, ty = p.y + Math.sin(p.facing) * p.pierceLen * 0.7;
      const list = this.near(tx, ty, 110).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
    }
  },
  // 던진 창이 가장 멀리 간 지점
  onSpearApex(sh) {
    const atk = G.player.atk, x = sh.x, y = sh.y;
    const fs = this.lv('fire_special');
    if (fs) this.explode(x, y, 60, atk * (0.8 + 0.4 * fs), '#ff7a3c', true);
    const es = this.lv('elec_special');
    if (es) this.strike(x, y, 60, atk * (0.8 + 0.4 * es));
    const is = this.lv('ice_special'), ps = this.lv('poison_special');
    if (is || ps) {
      const kind = is ? 'ice' : 'poison', life = 2 + 0.5 * (is || ps);
      this.zone(x, y + 4, kind, life);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 24, y + 4 + Math.sin(a) * 18, kind, life); }
      if (is && ps) for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; this.zone(x + Math.cos(a) * 30, y + 4 + Math.sin(a) * 22, 'poison', 2 + 0.5 * ps); }
    }
  },
  // 벽꿍: 창에 밀려난 적이 벽(나무 · 바위 · 물가 · 숲 테두리)에 부딪혔다
  wallSlam(e) {
    e.slamT = 0; e.kvx = e.kvy = 0;
    if (e.dead) return;
    e.stun = Math.max(e.stun || 0, 1.0);
    G.text(e.x, e.y - e.r - 18, '벽꿍!', '#ffb84a', 13, 0.8);
    G.burst(e.x, e.y, 10, ['#d8c8a8', '#fff'], 150);
    G.shake = Math.max(G.shake, 4); Sfx.guardBreak();
    this.damage(e, G.player.atk * WALL_SLAM_MULT, '#ffb84a', 13);
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
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        this.zone(p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34 + 4, 'fire', 1.5 + 0.5 * fc);
      }
    }
    const pc = this.lv('poison_charge');
    if (pc) {
      const life = 2 + 0.5 * pc;
      this.zone(p.x, p.y + 4, 'poison', life);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        this.zone(p.x + Math.cos(a) * 32, p.y + Math.sin(a) * 32 + 4, 'poison', life);
      }
    }
    const ec = this.lv('elec_charge');
    if (ec) {
      const list = this.near(p.x, p.y, 130).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2 + ec);
      for (const e of list) this.skyBolt(e, p.atk * (0.8 + 0.3 * ec));
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
    if (ls && p.alive) p.hp = Math.min(p.maxHp, p.hp + 2 * ls);
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
    const ds = ElFx.slot('dash');
    if (ds && Math.random() < 0.7) ElFx.spark(ds, p.x, p.y + 6);
    const fd = this.lv('fire_dash'), id = this.lv('ice_dash'), pd = this.lv('poison_dash');
    if ((fd || id || pd) && Math.hypot(p.x - p.zoneFrom.x, p.y - p.zoneFrom.y) > 12) {
      p.zoneFrom = { x: p.x, y: p.y };
      const kind = fd ? 'fire' : id ? 'ice' : 'poison';
      this.zone(p.x, p.y + 4, kind, 1.5 + 0.5 * (fd || id || pd));
    }
  },
  onDashEnd(p) {
    const ed = this.lv('elec_dash');
    if (ed) this.strike(p.x, p.y, 45, p.atk * (1 + 0.5 * ed));
    if (this.lv('dash_guard')) p.dashGuardT = 1;
  },

  // 스테이지 클리어: 생명의 샘
  onStageClear(stats) {
    const sp = this.lv('spring');
    if (sp) stats.hp = Math.min(stats.maxHp, (stats.hp || stats.maxHp) + Math.round(stats.maxHp * (0.1 + 0.05 * sp) * (curse('heal') ? 0.5 : 1)));
  },

  // 공격 쪽 배율들 (Player 가 사용)
  damageMult(p, kind, t) {
    let m = 1 + 0.1 * this.lv('sharp');
    if (kind === 'finisher' || kind === 'pokeFin') m *= (1 + 0.3 * this.lv('atk_combo')) * (1 + 0.15 * p.mastery('combo'));
    if (kind === 'thrust' || kind === 'sweep') m *= (1 + 0.4 * this.lv('atk_thrust')) * (1 + 0.2 * p.mastery('thrust'));
    if (this.lv('rally')) m *= 1 + 0.5 * (1 - p.hp / p.maxHp);
    const am = this.lv('ambush');
    if (am && t && offGuard(t, p)) { m *= 1 + 0.1 + 0.2 * am; t.ambushHit = true; } // 기습: 옆 · 뒤에서, 또는 무방비
    return m * this.shockMult(t);
  },
  critChance() { return 0.1 + 0.08 * this.lv('vital'); },
  critMult() { return 1.8 + 0.2 * this.lv('vital'); },

  updateZones(dt) {
    for (const z of G.zones) {
      z.life -= dt; z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick = 0.4;
      for (const e of this.near(z.x, z.y, z.r)) {
        if (z.kind === 'fire') this.burn(e, 1); else if (z.kind === 'poison') this.poison(e, 1); else this.chill(e, 1);
      }
    }
    G.zones = G.zones.filter(z => z.life > 0);
  },
  drawZones(g) {
    for (const z of G.zones) {
      const a = clamp(z.life / z.max, 0, 1);
      if (z.kind === 'fire') {
        g.fillStyle = `rgba(255,${110 + Math.random() * 60 | 0},40,${0.35 * a})`;
        g.beginPath(); g.arc(z.x, z.y, z.r * (0.9 + Math.random() * 0.15), 0, Math.PI * 2); g.fill();
      } else if (z.kind === 'poison') {
        g.fillStyle = `rgba(120,200,70,${0.38 * a})`;
        g.beginPath(); g.arc(z.x, z.y, z.r * (0.95 + Math.sin(G.time * 3 + z.x) * 0.08), 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = `rgba(190,235,255,${0.45 * a})`;
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill();
      }
    }
  },

  // 플레이어가 맞기 직전: 실제 받을 피해를 돌려준다 (0이면 막음)
  playerHurt(dmg, src) {
    const p = G.player;
    if (this.lv('leaf') && p.leafT <= 0) {
      p.leafT = 20 - 4 * this.lv('leaf');
      G.text(p.x, p.y - 26, '잎사귀 방패!', '#e8ff9c', 12, 0.8);
      G.fxRing(p.x, p.y, '#e8ff9c', 30);
      p.invuln = Math.max(p.invuln, 0.5);
      return 0;
    }
    const fb = this.lv('frostbite');
    if (fb && (src.chill > 0 || src.frozenT > 0)) dmg *= 1 - (0.2 + 0.1 * fb);
    if (this.lv('skin')) dmg *= 1 - 0.08 * this.lv('skin');
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
