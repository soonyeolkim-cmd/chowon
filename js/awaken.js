'use strict';
// ── 무기 각성 오로라 (2026-10-22 미리보기) ──
// 각성 단계가 오를수록 캐릭터 둘레가 화려해진다. 그림은 모두 에셋 팩 도트 그림을 보라색으로 물들여 쓴다.
//   각성: 몸 둘레로 반짝이 알갱이가 천천히 피어오른다
//   강화 1: + 발밑에 도는 오로라 고리 / 강화 2: + 둘레를 도는 정령 꼬리 2개 / 강화 3: + 등 뒤 오라 불꽃 + 오로라 리본
//   각성 기술이 나가는 순간 · 각성 차지를 모으는 동안에는 오로라가 크게 밝아진다 (released)
// 오로라만 미리보기: ?aura=1 ~ 4 (5 = 밝아진 모습). 각성 전체 미리보기는 ?awaken=0 ~ 3.
// 오로라 색: 모든 무기 보라색 하나로 통일 (2026-10-22 사용자) — 속성 색(불 · 서리 · 번개 · 독 · 공격 · 방어 · 흰색)과 겹치지 않고, 각성 재료 '봉인의 핵'(◈ 보라)과 이어진다
const AWAKEN_PURPLE = ['#a874ff', '#ead8ff']; // [바탕 색, 밝은 색]
const AWAKEN_RELEASE_SPARK = '#ffffff';      // 해방 상태: 반짝이에 흰빛을 섞는다
// ── 각성 수치 (각성_설계.md, 2026-10-23) ──
// 단계 lv: 0 = 없음, 1 = 각성 (봉인의 핵), 2 ~ 4 = 강화 1 ~ 3 (각성의 불씨 1 · 2 · 3개). 표의 값은 [각성, 강화1, 강화2, 강화3]
const AWAKEN_DMG = [0.03, 0.05, 0.07, 0.10];         // 공통: 기본 · 차지 · 특수 피해
const AWAKEN_SKILL_DMG = [0.05, 0.10, 0.15, 0.20];   // 각성 기술 피해
const AWAKEN_SMALL = [0.03, 0.04, 0.06, 0.08];       // 공격 속도 · 기본 사거리
const AWAKEN_MID = [0.05, 0.08, 0.11, 0.15];         // 범위 · 거리 · 차지 시간 · 충전
const AWAKEN_DEF = {
  sword:  { skill: '사연 검기',       skillDesc: '삼연 검기가 네 갈래',            stats: { atkSpeed: AWAKEN_SMALL, spinRange: [0.03, 0.05, 0.07, 0.10], waveSize: AWAKEN_MID } }, // 회전베기 범위는 조금 더 낮게 (2026-10-23 사용자)
  spear:  { skill: '심안 일섬',       skillDesc: '3단 차지 · 숨은 적 · 장애물까지 꿰뚫는다',    stats: { reach: AWAKEN_SMALL, chargeTime: AWAKEN_MID } },
  sai:    { skill: '그림자 반격',     skillDesc: '받아치기 뒤 분신이 한 번 더',     stats: { atkSpeed: AWAKEN_SMALL, rushLen: AWAKEN_MID, parryWin: [0.02, 0.03, 0.05, 0.07] } },
  staff:  { skill: '대마법진',        skillDesc: '더 모으면 더 큰 마법진',          stats: { reach: AWAKEN_SMALL, circleR: [0.01, 0.02, 0.03, 0.05], orbRecharge: AWAKEN_MID } }, // 마법진 범위는 낮게 (2026-10-24 사용자: 마법진이 너무 크다)
  shield: { skill: '막을 때 충격파',  skillDesc: '막으면 둘레로 충격파',            stats: { knock: AWAKEN_MID, quakeR: AWAKEN_MID, guardWaveR: [32, 35, 38, 42] } },
  bow:    { skill: '폭발 화살',       skillDesc: '연사 3발째가 터진다 (덫도 함께)', stats: { reach: AWAKEN_SMALL, chargeTime: AWAKEN_MID, trapCd: [0.15, 0.2, 0.3, 0.45] } },
};
const AWAKEN_CHARGE_T = 0.5; // 각성 차지: 앞 단계 뒤 더 모으는 시간
const AWAKEN_STAGE_NAME = ['', '각성', '강화 1', '강화 2', '강화 3'];
// 미리보기: 주소 끝 ?awaken=0 ~ 3 → 모든 무기가 각성(0) · 강화 1 ~ 3 상태 (저장은 안 바뀐다)
const AWAKEN_PREVIEW = (() => { try { const v = new URLSearchParams(location.search).get('awaken'); return v === null ? -1 : clamp(+v || 0, 0, 3); } catch (_) { return -1; } })();
const AURA_PREVIEW = (() => { try { return +new URLSearchParams(location.search).get('aura') || 0; } catch (_) { return 0; } })();

const Awaken = {
  _tint: new Map(),
  // ── 단계 · 재료 ──
  lv(wid) {
    if (AWAKEN_PREVIEW >= 0) return AWAKEN_PREVIEW + 1;
    return (Meta.data && Meta.data.awaken[wid]) || 0;
  },
  // 이 무기 지금 단계의 수치 (각성 전이면 0)
  val(wid, key) { const n = this.lv(wid), a = n && AWAKEN_DEF[wid] && AWAKEN_DEF[wid].stats[key]; return a ? a[n - 1] : 0; },
  dmg(wid) { const n = this.lv(wid); return n ? AWAKEN_DMG[n - 1] : 0; },
  skillDmg(wid) { const n = this.lv(wid); return n ? AWAKEN_SKILL_DMG[n - 1] : 0; },
  // 다음 단계에 드는 재료: { core: 1 } 또는 { ember: n } (끝이면 null)
  nextCost(wid) { const n = (Meta.data.awaken[wid] || 0); return n === 0 ? { core: 1 } : n < 4 ? { ember: n } : null; },
  canNext(wid) {
    const c = Meta.data.unlocked.includes(wid) && this.nextCost(wid);
    return !!c && (c.core ? Meta.data.cores >= c.core : Meta.data.embers >= c.ember);
  },
  anyCan() { return Meta.data.unlocked.some(w => this.canNext(w)); },
  // 각성 · 강화하기. 성공하면 안내 문구, 아니면 null + 이유
  advance(wid) {
    const c = this.nextCost(wid), D = Meta.data;
    if (!c) return { ok: false, msg: '이미 강화 3단계까지 마쳤어요' };
    if (c.core && D.cores < c.core) return { ok: false, msg: '◈ 봉인의 핵이 필요해요 (봉인 등급 4~9를 처음 완주할 때마다 1개)' };
    if (c.ember && D.embers < c.ember) return { ok: false, msg: `🔥 각성의 불씨가 ${c.ember}개 필요해요 (봉인 등급 5~10의 세계 보스마다 1개)` };
    if (c.core) D.cores -= c.core; else D.embers -= c.ember;
    D.awaken[wid] = (D.awaken[wid] || 0) + 1; Meta.save();
    const n = D.awaken[wid], W0 = WEAPONS[wid];
    return { ok: true, msg: n === 1 ? `${W0.name} 각성! 각성 기술 '${AWAKEN_DEF[wid].skill}'이(가) 생겼어요` : `${W0.name} ${AWAKEN_STAGE_NAME[n]}! 각성 능력이 더 강해졌어요` };
  },
  // 마을 설명 한 줄: 이 단계(n)에서 무엇이 붙는지
  summary(wid, n) {
    const d = AWAKEN_DEF[wid]; if (!d || !n) return '';
    const pc = v => Math.round(v * 100);
    return `각성 기술 ${d.skill} · 기본·차지·특수 피해 +${pc(AWAKEN_DMG[n - 1])}% · 기술 피해 +${pc(AWAKEN_SKILL_DMG[n - 1])}% · 무기 특성 강화`;
  },
  // 에셋 그림을 한 가지 색으로 물들인 사본 (색마다 한 번만 만든다)
  tint(key, color) {
    const im = ART.img[key], k = key + color;
    if (!im || !im.width) return null;
    let c = this._tint.get(k);
    if (!c) { c = tinted(im, color); this._tint.set(k, c); }
    return c;
  },
  // 도트 그림 한 장을 어두운 1도트 테두리와 함께 (밝은 풀밭 위에서도 보이게)
  outlined(g, key, color, sx, sy, sw, sh, dx, dy, dw, dh) {
    const im = this.tint(key, color), dark = this.tint(key, '#16181f'); if (!im) return;
    const a = g.globalAlpha; g.globalAlpha = a * a * 0.8; // 테두리는 더 빨리 옅어진다 (사라질 때 회색 점이 남지 않게)
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(dark, sx, sy, sw, sh, dx + ox, dy + oy, dw, dh);
    g.globalAlpha = a; g.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
  },
  // 지금 단계 (0 = 없음, 1 ~ 3) 와 해방 상태
  stage(p) {
    if (AURA_PREVIEW) return Math.min(4, AURA_PREVIEW);
    return this.lv(p.weaponId);
  },
  // 오로라가 크게 밝아지는 때: 각성 기술이 나간 직후(번쩍) · 각성 차지를 모으는 동안
  released(p) { return AURA_PREVIEW >= 5 || (p.awakenFlashT || 0) > 0 || (p.chargeA || 0) > 0.15; },
  // 각성 기술이 나갔다: 오로라 번쩍 (0.45초)
  flash(p) { p.awakenFlashT = 0.45; },

  // 캐릭터 그림보다 먼저 (뒤쪽): 오라 불꽃 · 오로라 리본 · 발밑 고리 · 뒤로 도는 정령 꼬리
  back(g, p, x, y) {
    const n = this.stage(p); if (!n) return;
    const [c0, c1] = AWAKEN_PURPLE, t = G.time, rel = this.released(p);
    const a0 = g.globalAlpha;
    if (n >= 4) { // 강화 3: 오라 불꽃 + 오로라 리본
      // 오로라 리본: 등 뒤로 흐르는 빛의 커튼 (도트 2칸 단위 기둥이 물결친다)
      for (let k = -7; k <= 7; k++) {
        const wave = Math.sin(t * 2.2 + k * 0.55) * 0.5 + 0.5, hgt = (rel ? 30 : 22) + wave * (rel ? 14 : 9);
        const bx = Math.round(x + k * 2.4 + Math.sin(t * 1.3 + k * 0.3) * 1.5), fade = 1 - Math.abs(k) / 8;
        for (let j = 0; j < hgt; j += 2) {
          const f = j / hgt; // 아래(0) → 위(1)
          g.globalAlpha = a0 * fade * (1 - f) * (rel ? 0.75 : 0.5) * (0.6 + 0.4 * wave);
          g.fillStyle = f < 0.45 ? c0 : c1;
          g.fillRect(bx, Math.round(y + 6 - j), 3, 2);
        }
      }
      // 오라 불꽃 (에셋 Aura 5장 애니메이션) — 해방 때 더 크고 진하게
      const im = this.tint('auraFx', c0);
      if (im) {
        const fr = Math.floor(t * 10) % 5, s = rel ? 2.1 : 1.6, w = 25 * s, h = 24 * s;
        g.globalAlpha = a0 * (rel ? 0.85 : 0.6);
        g.drawImage(im, fr * 25, 0, 25, 24, Math.round(x - w / 2), Math.round(y + 12 - h), w, h);
      }
    }
    if (n >= 2) {
      // 발밑 오로라 고리: 도트 점이 타원으로 돌고, 밝은 띠가 고리를 따라 흐른다
      const N = 22, rx = rel ? 18 : 16, ry = rel ? 7 : 6;
      for (let i = 0; i < N; i++) {
        const an = i / N * Math.PI * 2 + t * 0.8, glow = Math.max(0, Math.sin(an * 2 - t * 4));
        const dx = Math.round(x + Math.cos(an) * rx) - 1, dy = Math.round(y + 9 + Math.sin(an) * ry) - 1;
        g.globalAlpha = a0 * 0.55; g.fillStyle = '#16181f'; g.fillRect(dx, dy + 1, 3, 3); // 그림자
        g.globalAlpha = a0 * (0.5 + 0.5 * glow);
        g.fillStyle = glow > 0.7 ? c1 : c0;
        g.fillRect(dx, dy, 3, 3);
      }
      if (n >= 3) this.wisps(g, p, x, y, c0, false); // 강화 2: 정령 꼬리
    }
    g.globalAlpha = a0;
  },

  // 캐릭터 그림 다음 (앞쪽): 앞으로 도는 정령 꼬리 · 피어오르는 반짝이
  front(g, p, x, y) {
    const n = this.stage(p); if (!n) return;
    const [c0, c1] = AWAKEN_PURPLE, t = G.time, rel = this.released(p);
    const a0 = g.globalAlpha;
    if (n >= 3) this.wisps(g, p, x, y, c0, true);
    // 반짝이 알갱이: 몸 둘레에서 피어올라 사라진다 (에셋 Spark 7장)
    const cnt = rel ? 9 : n >= 4 ? 6 : 5;
    for (let i = 0; i < cnt; i++) {
      const sp = 0.55 + (i % 3) * 0.12, ph = (t * sp + i / cnt) % 1, cyc = Math.floor(t * sp + i / cnt);
      const px = x + Math.sin(i * 2.4 + cyc * 1.7) * 12, py = y + 6 - ph * 32;
      const fr = [0, 1, 2, 3, 2, 1][(i + Math.floor(t * 8)) % 6]; // 별 모양 칸만 (둥근 덩어리 칸은 빼고)
      g.globalAlpha = a0 * Math.min(1, Math.sin(ph * Math.PI) * 1.4);
      this.outlined(g, 'sparkPx', i % 2 ? (rel && i % 4 === 1 ? AWAKEN_RELEASE_SPARK : c1) : c0, fr * 10, 0, 10, 8, Math.round(px - 7), Math.round(py - 5), 14, 11);
    }
    g.globalAlpha = a0;
  },

  // 정령 꼬리 2개가 몸 둘레를 돈다 (앞쪽 반 · 뒤쪽 반을 나눠 그려서 몸을 감싸는 것처럼)
  wisps(g, p, x, y, color, frontHalf) {
    const im = this.tint('spiritFx', color); if (!im) return;
    const t = G.time, a0 = g.globalAlpha;
    for (let i = 0; i < 2; i++) {
      const an = t * 2.4 + i * Math.PI, depth = Math.sin(an); // depth > 0 = 앞쪽
      if ((depth > 0) !== frontHalf) continue;
      const fr = Math.floor(t * 8 + i * 2) % 5, s = 0.75;
      const wx = x + Math.cos(an) * 17, wy = y - 4 + depth * 6;
      g.globalAlpha = a0 * (0.75 + 0.25 * Math.abs(depth));
      this.outlined(g, 'spiritFx', color, fr * 32, 0, 32, 32, Math.round(wx - 16 * s), Math.round(wy - 16 * s), 32 * s, 32 * s);
    }
    g.globalAlpha = a0;
  },
};
