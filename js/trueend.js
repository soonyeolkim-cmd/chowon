// ── 진엔딩 '루미의 진실' (2026-10-24, 사용자: 따뜻한 결말 · 새벽 시작 화면 · 마을에서 다시 보기) ──
// 봉인 등급 10 을 처음 완주하면 삼룡을 쓰러뜨린 자리에서 시작해, 시작 화면과 같은 숲속 빈터 그림으로 넘어간다.
// 컷: 근원 → 빛이 모임 → 천 년 전 회상 → 고백 → 삼룡의 목소리 → 약속 → 새벽 → 제목.
// 한 번 보면 시작 화면이 새벽(봉인석 대신 어린 나무)으로 바뀌고, 마을 '🌅 진엔딩'에서 다시 볼 수 있다.

const TRUE_END_BEAMS = [[255, 122, 60], [127, 216, 255], [155, 225, 93]]; // 삼룡의 목소리: 불 · 얼음 · 독
// 컷마다: bg 'world'(게임 화면 그대로) | 'title'(숲속 빈터), o 목표 연출 값(TitleArt.scene 옵션), anim 연출이 바뀌는 시간(초, 그 뒤에 대사)
//   lines 대사, at {대사 번호: 그 대사에서 바뀌는 연출}, flash 하얗게 번쩍, card 마지막 제목 화면
const TRUE_END = [
  { bg: 'world', anim: 0.6, lines: [
    ['boss6', '…이번엔 잠들지 않겠다. 그 빛… 기억이 나는구나.'],
    ['boss6', '천 년 전, 우리를 가둔 빛의 정령이여. 다시 돌아왔느냐.'],
    ['rian', '루미…? 무슨 소리야?'],
    ['lumi', '저도… 모르겠어요. 그런데 가슴이… 너무 뜨거워요.'],
  ] },
  { bg: 'title', flash: true, o: { stand: 1 }, anim: 1.2 },
  { bg: 'title', o: { stand: 1, gather: 1, lumiBig: 0.6 }, anim: 3.4, lines: [
    ['lumi', '기억이 돌아와요. 봉인석은… 제 빛으로 만든 거였어요.'],
  ] },
  { bg: 'title', o: { stand: 1, past: 1, split: 1, lumiBig: 0.6 }, anim: 4.2, lines: [
    ['lumi', '천 년 전, 세 용의 힘이 넘쳐서 숲이 죽어 가고 있었어요.'],
    ['lumi', '그래서 제 빛을 쪼개 숲 곳곳에 박았어요. 그게 봉인석이에요.'],
    ['lumi', '쪼개진 만큼 기억도 사라졌어요. 남은 건… 작은 빛 하나뿐이었죠.'],
  ] },
  { bg: 'title', o: { stand: 1, lumiBig: 0.6 }, anim: 1.6, lines: [
    ['rian', '그래서 봉인석을 부술 때마다 네가 강해졌던 거구나.'],
    ['lumi', '군주님이 저를 알아보신 것도… 그래서였어요.'],
    ['lumi', '리안이 쓰러질 때마다 마을로 데려간 것도 저예요. 제 빛을 조금씩 떼어서요.'],
    ['rian', '…그래서 넌 늘 그렇게 작았던 거야?'],
    ['lumi', '헤헤. 괜찮아요. 이제 다 돌려받았으니까요.'],
    ['lumi', '그러니까… 이번엔 제가 다시 봉인이 될게요. 그게 제 일이었으니까.'],
    ['rian', '안 돼. 또 혼자 천 년을 버티겠다고?'],
  ] },
  { bg: 'title', o: { stand: 1, lumiBig: 0.4, beamCycle: 1 }, anim: 1.0, lines: [
    ['boss6', '작은 검사여. 우리는 숲을 해치려던 게 아니다. 태우고, 얼리고, 썩혀야 새싹이 돋는다.'],
    ['boss6', '너무 오래 갇혀 있었기에… 넘쳤을 뿐이다.'],
    ['rian', '그럼 가두지 말고 같이 지키자. 돌 말고, 약속으로.'],
  ] },
  { bg: 'title', o: { stand: 1, lumiBig: 0.4, flies: 6 }, anim: 2.0, lines: [
    ['boss3', '숲의 수호자로서 맹세하마. 다시는 혼자 두지 않겠다.'],
    ['boss2', '…숲길은 내가 지킨다. 인간들도 이제 나무를 함부로 베지 않겠지.'],
    ['boss1', '뿌우! 말랑도! 말랑도 지킬래!'],
    ['lumi', '다들…'],
    ['boss6', '좋다. 우리는 근원에서 깨어 있겠다. 숲이 다시 숨 쉬도록.'],
  ] },
  { bg: 'title', o: { stand: 1, dawn: 1, sprout: 1, lumiBig: 1, flies: 2 }, anim: 5.5, at: { 3: { lumiBig: 0 } }, lines: [
    ['rian', '봐, 루미. 날이 밝는다.'],
    ['lumi', '봉인석이 있던 자리에… 싹이 났어요.'],
    ['rian', '이제 원래 모습으로 있어도 되잖아. 어떻게 할 거야?'],
    ['lumi', '이 모습이 좋아요. 이번엔… 제가 고른 거예요.'],
    ['lumi', '가요, 리안. 마을 사람들이 기다려요!'],
  ] },
  { bg: 'title', o: { stand: 1, dawn: 1, sprout: 1, lumiBig: 0, flies: 1 }, anim: 2.5, card: true },
];
const TRUE_END_LIFT = 0.3; // 대사 중 그림을 화면 높이의 30% 만큼 위로 (아래 대화창에 리안 · 루미가 가리지 않게)
const TRUE_END_KEYS =['stand', 'dawn', 'past', 'split', 'gather', 'lumiBig', 'sprout', 'flies', 'beamCycle'];
const TRUE_END_DEF = { stand: 0, dawn: 0, past: 0, split: 0, gather: 0, lumiBig: 0, sprout: 0, flies: 1, beamCycle: 0 };

// 새벽 시작 화면: 어느 프로필이든 한 번 보면 (시작 화면은 프로필을 고르기 전에 나온다)
const dawnTitle = () => { if (Meta.data && Meta.data.trueEnd) return true; try { return localStorage.getItem('swordsman.dawn') === '1'; } catch (_) { return false; } };
// 시험: 주소에 ?trueend=1 이면 마을에 다시 보기 버튼이 보인다 (저장은 안 바뀜)
const TRUE_END_TEST = /[?&]trueend=1/.test(location.search);

const TrueEnd = {
  i: 0, t: 0, cur: null, from: null, to: null, animT: 1, onDone: null, flash: 0, replay: false,
  start(onDone, replay) {
    this.onDone = onDone; this.replay = !!replay; this.cur = { ...TRUE_END_DEF }; this.lift = TRUE_END_LIFT;
    G.state = 'trueEnd'; G.shake = 0;
    this.go(0);
  },
  go(i) {
    this.i = i; this.t = 0;
    const s = TRUE_END[i];
    this.from = { ...this.cur }; this.to = { ...TRUE_END_DEF, ...(s.o || {}) }; this.animT = s.anim || 0.01;
    if (s.flash) this.flash = 1;
    G.dialog = null; this.lineAt = -1;
  },
  // 대사 중에 연출을 바꾼다 (at)
  retarget(o, t) { this.from = { ...this.cur }; this.to = { ...this.to, ...o }; this.animT = t; this.t = 0; this.lineAnim = true; },
  finish() {
    G.dialog = null;
    if (!this.replay) try { localStorage.setItem('swordsman.dawn', '1'); } catch (_) {} // 다시 보기 · 시험 링크로는 새벽 시작 화면이 열리지 않는다
    const f = this.onDone; this.onDone = null;
    if (f) f();
  },
  update(dt, inp) {
    const s = TRUE_END[this.i];
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 0.9);
    this.lift += ((s.card ? 0 : TRUE_END_LIFT) - this.lift) * Math.min(1, dt * 3); // 제목 화면에서는 그림을 다시 내린다
    const k = clamp(this.t / this.animT, 0, 1), e = k * k * (3 - 2 * k);
    for (const key of TRUE_END_KEYS) this.cur[key] = this.from[key] + (this.to[key] - this.from[key]) * e;
    if (inp.pause) { this.finish(); return; } // 건너뛰기
    const d = G.dialog;
    if (!d) {
      if (k < 1 && !this.lineAnim) { if (inp.start && this.t > 0.4) this.t = this.animT; return; } // 연출 중: 누르면 바로 끝까지
      if (s.lines && this.lineAt < 0) { this.lineAt = 0; G.dialog = { lines: s.lines, i: 0, chars: 0, total: 1 }; return; }
      if (s.card) { if (inp.start && this.t > this.animT + 1) this.finish(); return; }
      if (this.i + 1 < TRUE_END.length) this.go(this.i + 1); else this.finish();
      return;
    }
    d.chars += dt * 32;
    if (!inp.start) return;
    if (d.chars < d.total) { d.chars = d.total; return; }
    d.i++;
    if (d.i >= d.lines.length) { G.dialog = null; this.lineAnim = false; if (this.i + 1 < TRUE_END.length) this.go(this.i + 1); else this.finish(); return; }
    d.chars = 0;
    if (s.at && s.at[d.i]) this.retarget(s.at[d.i], 0.9);
  },
  draw() {
    const s = TRUE_END[this.i], o = { ...this.cur };
    o.stand = o.stand > 0.5; o.lift = this.lift;
    if (o.beamCycle > 0.05) o.beam = TRUE_END_BEAMS[Math.floor(G.time / 1.1) % 3];
    const world = s.bg === 'world' && G.player && !this.replay;
    if (world) overlay(0.15); // 게임 화면 그대로 (render 가 먼저 그린다)
    else TitleArt.scene(G.time, o);
    if (s.card) {
      const k = clamp((this.t - 0.5) / 2, 0, 1);
      ctx.globalAlpha = k;
      overlay(0.35);
      const lb = TitleArt.drawLogo(W / 2, H * 0.16, G.time);
      label('— 루미의 진실 —', W / 2, lb + 22, 20, '#fff6d8', 'center', '800');
      label('숲의 봉인은 풀리고, 약속이 숲을 지킨다.', W / 2, lb + 50, 13, '#e8eef8', 'center', '600');
      if (this.t > this.animT + 1 && Math.sin(G.time * 4) > -0.2) label(Input.state.device === 'touch' ? '화면을 탭해서 계속' : '아무 버튼이나 눌러서 계속', W / 2, H - inset.b - 40, 16, '#ffd24a');
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,252,236,${Math.min(1, this.flash * 1.3)})`; ctx.fillRect(0, 0, W, H); }
    if (G.dialog) drawDialog();
    else if (!s.card) { const b = Input.buttons.skip; if (b && b.visible) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; (rrPath(b.x - 34, b.y - 14, 68, 28, 7), ctx.fill()); label('건너뛰기 ▶', b.x, b.y, 12, '#fff', 'center', '700'); } }
  },
};

// ── 마을의 다시 보기 버튼 (연습실 왼쪽, 진엔딩을 본 뒤에만) ──
const villageTrueEndShown = () => !!((Meta.data && Meta.data.trueEnd) || TRUE_END_TEST);
function villageTrueEnd() { const b = villagePractice(); return { x: b.x - 98, y: b.y, w: 90, h: b.h }; }
function drawTrueEndBtn(r, sel) {
  ctx.fillStyle = sel ? 'rgba(60,70,90,0.95)' : 'rgba(20,26,34,0.85)'; (rrPath(r.x, r.y, r.w, r.h, 7), ctx.fill());
  if (sel) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; (rrPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7), ctx.stroke()); }
  else { ctx.strokeStyle = 'rgba(255,220,160,0.4)'; ctx.lineWidth = 1; (rrPath(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7), ctx.stroke()); }
  label('🌅 진엔딩', r.x + r.w / 2, r.y + r.h / 2 + 1, 12, sel ? '#ffd24a' : '#ffe8c0', 'center', '700');
}
function replayTrueEnd() { Sfx.pickup(); TrueEnd.start(() => G.goVillage(), true); }
