// ── 시작 화면: 배경 그림 · 제목 글씨 (2026-10-17) ──
// 밤의 숲, 빛기둥 아래 황금 봉인석, 그 앞에 선 리안과 루미. 작은 캔버스(세로 180픽셀)에 그린 뒤 그대로 키워 도트 느낌을 살린다.
// 그림은 모두 에셋 팩(Ninja Adventure)에서: 나무 · 빛줄기 · 안개 · 나뭇잎 · 주인공 · 루미
const TITLE_H = 180;              // 배경을 그리는 작은 캔버스의 세로 픽셀
const TITLE_STAR_N = 70;          // 별 개수
const TITLE_FIREFLY_N = 18;       // 반딧불 개수
const TITLE_LEAF_N = 5;           // 떨어지는 나뭇잎 개수
const TITLE_WALK_T = 4.5;        // 리안이 화면 왼쪽 아래에서 봉인석 앞까지 걸어오는 시간 (초)
const TITLE_GOLD = [255, 206, 74];  // 봉인석 빛 (1세계 황금 봉인석과 같은 색)
// 두 색 섞기 (k = 0 이면 a, 1 이면 b)
const mixCol = (a, b, k) => { if (!k) return a; const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const A = p(a), B = p(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; };
const tRand = i => { const v = Math.sin(i * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };

const TitleArt = {
  buf: null, g: null, tints: {}, logo: null, logoKey: '',
  // 나무 그림(2x2칸)을 한 가지 색으로 칠한 실루엣 (먼 숲용)
  tinted(col, row, color) {
    const k = col + ',' + row + color;
    if (this.tints[k]) return this.tints[k];
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    g.drawImage(ART.img.nature, col * 16, row * 16, 32, 32, 0, 0, 32, 32);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, 32, 32);
    return (this.tints[k] = c);
  },
  // 나무 한 줄: 화면 너비를 채우며 조금씩 겹치게
  treeLine(g, w, baseY, color, gap, seed, drift) {
    const off = ((drift % gap) + gap) % gap;
    for (let i = -1, x = -off; x < w + 32; i++, x += gap) {
      const k = Math.floor(drift / gap) + i, pick = tRand(k + seed) < 0.5 ? [0, 0] : [2, 0];
      const img = this.tinted(pick[0], pick[1], color), dy = Math.floor(tRand(k * 3 + seed) * 8);
      g.drawImage(img, Math.round(x), baseY - 32 + dy);
    }
  },
  // o: 진엔딩 연출 (2026-10-24). 모두 0 이면 원래 시작 화면
  //   stand 걷지 않고 서 있기 · dawn 0~1 새벽 · past 0~1 천 년 전 회상(잿빛) · split 0~1 회상 속 빛이 쪼개져 숲에 박힘
  //   gather 0~1 여섯 조각이 루미에게 모임 · lumiBig 0~1 루미가 커지며 빛남 · beam [r,g,b] 빛기둥 색 · sprout 0~1 봉인석 → 새싹 · flies 반딧불 배수
  scene(t, o = {}) {
    const h = TITLE_H, w = Math.ceil(h * W / H);
    if (!this.buf || this.buf.width !== w) { this.buf = document.createElement('canvas'); this.buf.width = w; this.buf.height = h; this.g = this.buf.getContext('2d'); }
    const g = this.g, cx = Math.round(w / 2);
    const dawn = o.dawn || 0, past = o.past || 0;
    // 리안이 걸어와 봉인석 앞에 선다: 시작 화면을 열 때마다 한 번 (잠깐이라도 안 그렸으면 처음부터)
    if (!(this.lastT > t - 0.5)) this.walk0 = t;
    this.lastT = t;
    const wt = o.stand ? 99 : t - this.walk0, wk = clamp(wt / TITLE_WALK_T, 0, 1);
    const arrive = !o.stand && wt >= TITLE_WALK_T ? clamp(1 - (wt - TITLE_WALK_T) / 1.2, 0, 1) : 0; // 도착하면 봉인석이 한 번 크게 빛난다
    g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // 하늘: 깊은 밤 → 지평선 쪽 보랏빛 (새벽이면 푸른 하늘 → 분홍 → 주황 지평선)
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, mixCol('#080c1c', '#3a5c9c', dawn)); sky.addColorStop(0.5, mixCol('#1a2444', '#8a8cc0', dawn));
    sky.addColorStop(0.75, mixCol('#34365a', '#f0a8a0', dawn)); sky.addColorStop(1, mixCol('#2a2a40', '#ffcf8a', dawn));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // 별 (반짝임) — 새벽이면 사라진다
    for (let i = 0; i < TITLE_STAR_N; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + tRand(i + 3) * 2) + i);
      g.fillStyle = `rgba(255,248,215,${(0.2 + 0.7 * tw) * (0.4 + 0.6 * tRand(i + 7)) * (1 - dawn)})`;
      g.fillRect(Math.floor(tRand(i) * w), Math.floor(tRand(i + 99) * h * 0.5), 1, 1);
    }
    // 달 (새벽이면 옅어진다)
    const mx = Math.round(w * 0.8), my = 30;
    g.globalAlpha = 1 - dawn * 0.85;
    const mg = g.createRadialGradient(mx, my, 4, mx, my, 40);
    mg.addColorStop(0, 'rgba(255,240,190,0.35)'); mg.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = mg; g.fillRect(mx - 40, my - 40, 80, 80);
    g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(mx, my, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9d9a2'; g.fillRect(mx - 4, my - 3, 3, 3); g.fillRect(mx + 3, my + 2, 2, 2); g.fillRect(mx - 1, my + 5, 2, 2);
    g.globalAlpha = 1;
    if (dawn > 0) { // 새벽 해: 왼쪽 지평선에서 번지는 빛
      const sx0 = Math.round(w * 0.22), sg = g.createRadialGradient(sx0, 112, 2, sx0, 112, 90);
      sg.addColorStop(0, `rgba(255,236,170,${0.75 * dawn})`); sg.addColorStop(0.3, `rgba(255,190,120,${0.35 * dawn})`); sg.addColorStop(1, 'rgba(255,170,120,0)');
      g.fillStyle = sg; g.fillRect(0, 20, w, h - 20);
    }
    // 먼 숲 → 가까운 숲 (멀수록 푸르고 어둡다, 천천히 흐른다)
    this.treeLine(g, w, 108, mixCol('#222c52', '#56679a', dawn), 18, 11, t * 1.5);
    if (past > 0) this.dragons(g, w, t, past); // 회상: 먼 숲 위로 솟은 세 용
    this.treeLine(g, w, 120, mixCol('#18294a', '#3c587a', dawn), 21, 37, t * 3);
    this.treeLine(g, w, 132, mixCol('#122a30', '#2c5444', dawn), 24, 71, t * 5);
    // 땅: 숲속 빈터
    const gr = g.createLinearGradient(0, 126, 0, h);
    gr.addColorStop(0, mixCol('#16301f', '#3c6c3a', dawn)); gr.addColorStop(1, mixCol('#0b1a10', '#1e4226', dawn));
    g.fillStyle = gr; g.fillRect(0, 126, w, h - 126);
    // 봉인석 빛이 비친 땅
    const [r0, g0, b0] = o.beam || TITLE_GOLD, pulse = 0.5 + 0.5 * Math.sin(t * 2) + arrive + (o.lumiBig || 0) * 0.5;
    const stoneK = 1 - (o.sprout || 0);
    const lg = g.createRadialGradient(cx, 140, 2, cx, 140, 70);
    lg.addColorStop(0, `rgba(${r0},${g0},${b0},${(0.28 + 0.1 * pulse) * (0.4 + 0.6 * stoneK)})`); lg.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
    g.fillStyle = lg; g.fillRect(cx - 70, 90, 140, 90);
    // 하늘에서 내려오는 빛줄기 (새벽이면 옅게)
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = (0.35 + 0.15 * pulse) * (1 - 0.65 * dawn);
    g.drawImage(o.beam ? this.tintRay(o.beam) : ART.img.titleRay, cx - 60, 40, 120, 104);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 봉인석 (진엔딩 새벽: 사라지고 그 자리에 새싹)
    if (stoneK > 0) { g.globalAlpha = stoneK; this.stone(g, cx, 140, t, pulse, o.beam); g.globalAlpha = 1; }
    if (o.sprout) this.sapling(g, cx, 140, t, o.sprout);
    // 리안과 루미: 봉인석을 올려다본다 (뒷모습). 회상 중에는 없다
    if (arrive > 0) { // 도착 순간 퍼지는 빛 고리
      const rr = 6 + (1 - arrive) * 40; g.strokeStyle = `rgba(${r0},${g0},${b0},${arrive * 0.8})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, 138, rr, rr * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    const sx = cx - 52, sy = h + 18, ex = cx - 16, ey = 154, moving = wk < 1;
    const hx = Math.round(sx + (ex - sx) * wk), hy = Math.round(sy + (ey - sy) * wk);
    const lk = clamp((wt - 0.5) / TITLE_WALK_T, 0, 1); // 루미는 조금 늦게 따라온다
    const big = o.lumiBig || 0;
    const lx = Math.round(sx - 14 + (cx - 30 - sx + 14) * lk), ly = Math.round(sy - 12 + (144 - sy + 12) * lk + Math.sin(t * 2.5) * 2) - Math.round(big * 10);
    g.globalAlpha = 1 - past;
    if (g.globalAlpha > 0) {
      drawCell(g, 'hero', 1, moving ? Math.floor(wt * 8) % 4 : 0, hx, hy, { scale: 1 }); // 화면 아래에서 뒷모습으로 걸어 올라와 봉인석 앞에 선다
      if (big > 0) { // 루미가 본모습의 빛을 되찾는다
        const lr = 6 + 22 * big, lg2 = g.createRadialGradient(lx, ly - 4, 1, lx, ly - 4, lr);
        lg2.addColorStop(0, `rgba(255,252,210,${0.85 * big})`); lg2.addColorStop(1, 'rgba(255,250,190,0)');
        g.fillStyle = lg2; g.fillRect(lx - lr, ly - 4 - lr, lr * 2, lr * 2);
      }
      drawCell(g, 'spirit', 1, Math.floor(t * 4) % 4, lx, ly, { scale: 1 + big * 0.8 });
    }
    g.globalAlpha = 1;
    if (o.gather) this.gather(g, w, t, o.gather, lx, ly - 6);
    if (past > 0) this.splitLight(g, w, cx, t, past, o.split || 0);
    // 가장 가까운 나무: 양옆에서 화면을 감싼다 (어둡게)
    for (const [x, y, s] of [[-12, 150, 1.8], [w - 48, 148, 1.9], [22, 172, 1.4], [w - 66, 174, 1.3]]) {
      g.drawImage(this.tinted(0, 0, dawn ? '#1c3424' : '#0a140e'), Math.round(x), Math.round(y - 32 * s), Math.round(32 * s), Math.round(32 * s));
    }
    // 반딧불 (진엔딩 '약속': 풀려난 정령들이 가득)
    const nf = Math.round(TITLE_FIREFLY_N * (o.flies || 1));
    for (let i = 0; i < nf; i++) {
      const base = i < TITLE_FIREFLY_N;
      const fx = (tRand(i + 50) * w + Math.sin(t * 0.6 + i) * 14 + w) % w, fy = (base ? 80 : 24) + tRand(i + 80) * (base ? 90 : 150) + Math.sin(t * 0.9 + i * 2) * 6;
      const a = (0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.3))) * (1 - dawn * 0.6);
      g.fillStyle = `rgba(200,255,150,${a * 0.35})`; g.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
      g.fillStyle = `rgba(235,255,190,${a})`; g.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    }
    // 떨어지는 나뭇잎 (6장짜리 그림)
    const leaf = ART.img.titleLeaf, lw = leaf.width / 6;
    for (let i = 0; i < TITLE_LEAF_N; i++) {
      const sp = 10 + tRand(i + 5) * 8, y = ((t * sp + tRand(i) * (h + 20)) % (h + 20)) - 10;
      const x = (tRand(i + 9) * w + Math.sin(t * 1.3 + i) * 12 + t * 6) % (w + 10) - 5;
      g.drawImage(leaf, (Math.floor(t * 6 + i) % 6) * lw, 0, lw, leaf.height, Math.round(x), Math.round(y), lw, leaf.height);
    }
    // 안개: 땅 위로 느리게 흐른다
    const fog = ART.img.titleFog, fw = fog.width;
    g.globalAlpha = 0.14 * (1 - dawn * 0.5);
    for (let x = -((t * 4) % fw); x < w; x += fw) g.drawImage(fog, Math.round(x), h - 46);
    g.globalAlpha = 1;
    // 화면 가장자리를 어둡게
    const vg = g.createRadialGradient(cx, h * 0.55, h * 0.35, cx, h * 0.55, w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,8,${0.6 - 0.35 * dawn})`);
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // 회상: 색을 빼고 바랜 갈색으로 (보라는 오로라 전용이라 쓰지 않는다)
    if (past > 0) {
      g.globalCompositeOperation = 'saturation'; g.globalAlpha = past; g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = past * 0.55; g.fillStyle = '#d8b07a'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    // 큰 화면으로 (도트 그대로)
    ctx.imageSmoothingEnabled = false;
    const lift = o.lift || 0; // 진엔딩: 그림을 위로 올려 아래 대화창에 인물이 가리지 않게 (하늘 위쪽이 잘린다)
    if (lift > 0) {
      ctx.drawImage(this.buf, 0, lift * h, w, h * (1 - lift), 0, 0, W, H * (1 - lift));
      ctx.fillStyle = mixCol('#0b1a10', '#1e4226', dawn); ctx.fillRect(0, H * (1 - lift) - 1, W, H * lift + 1);
    } else ctx.drawImage(this.buf, 0, 0, W, H);
  },
  // 빛기둥 그림을 한 색으로 물들인다 (삼룡의 목소리: 불 · 얼음 · 독)
  tintRay(rgb) {
    const k = 'ray' + rgb.join(',');
    if (this.tints[k]) return this.tints[k];
    const src = ART.img.titleRay, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.75; g.fillStyle = `rgb(${rgb.join(',')})`; g.fillRect(0, 0, c.width, c.height);
    return (this.tints[k] = c);
  },
  // 천 년 전: 숲 위를 휘감는 세 용의 그림자 (불 · 얼음 · 독, 눈만 빛난다)
  dragons(g, w, t, a) {
    const eyes = ['#ff7a3c', '#7fd8ff', '#9be15d'];
    for (let k = 0; k < 3; k++) {
      const bx = w * (0.22 + 0.28 * k), by = 68 + k * 5, ph = t * 1.4 + k * 2;
      g.fillStyle = `rgba(16,10,14,${0.9 * a})`;
      for (let i = 14; i >= 0; i--) { // 꼬리 → 머리
        const x = bx - 30 + i * 4, y = by + Math.sin(ph + i * 0.5) * 7 + (14 - i) * 0.8, r = 1.5 + i * 0.28;
        g.beginPath(); g.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); g.fill();
      }
      const hx = Math.round(bx + 26), hy = Math.round(by + Math.sin(ph) * 7);
      g.fillRect(hx - 2, hy - 3, 9, 6); g.fillRect(hx + 6, hy - 1, 3, 3); // 머리 · 주둥이
      g.fillRect(hx, hy - 6, 2, 3); g.fillRect(hx + 3, hy - 5, 2, 2);     // 뿔
      g.fillStyle = eyes[k]; g.globalAlpha = a; g.fillRect(hx + 4, hy - 2, 1, 1); g.globalAlpha = 1;
    }
  },
  // 천 년 전: 하늘의 큰 빛(루미의 본모습)이 여섯 조각으로 쪼개져 숲 곳곳에 박힌다
  splitLight(g, w, cx, t, a, k) {
    const [r0, g0, b0] = TITLE_GOLD, ox = cx, oy = 68; // 진엔딩은 그림을 위로 올려 보여 주므로 하늘 아래쪽에
    const orbR = 12 * (1 - 0.7 * k);
    const og = g.createRadialGradient(ox, oy, 1, ox, oy, orbR * 2.4);
    og.addColorStop(0, `rgba(255,252,220,${a})`); og.addColorStop(0.4, `rgba(${r0},${g0},${b0},${0.6 * a})`); og.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
    g.fillStyle = og; g.fillRect(ox - orbR * 2.4, oy - orbR * 2.4, orbR * 4.8, orbR * 4.8);
    for (let i = 0; i < 6; i++) {
      const tx = w * (0.08 + 0.168 * i), ty = 124 + (i % 2) * 8;
      const q = clamp(k * 1.4 - i * 0.07, 0, 1), e = 1 - Math.pow(1 - q, 2);
      if (q <= 0) continue;
      const path = ee => [ox + (tx - ox) * ee, oy + (ty - oy) * ee - Math.sin(ee * Math.PI) * 14];
      g.fillStyle = `rgba(255,236,160,${a * 0.5})`;
      for (let s = 1; s <= 4; s++) { const [x2, y2] = path(Math.max(0, e - s * 0.05)); g.fillRect(Math.round(x2), Math.round(y2), 1, 1); }
      const [x, y] = path(e);
      g.fillStyle = `rgba(255,248,200,${a})`; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      if (q >= 1) { g.fillStyle = `rgba(${r0},${g0},${b0},${a * (0.6 + 0.4 * Math.sin(t * 3 + i))})`; g.fillRect(Math.round(tx) - 1, Math.round(ty) - 4, 2, 5); } // 박힌 봉인석
    }
  },
  // 지금: 여섯 세계의 조각이 하늘에서 루미에게 돌아온다
  gather(g, w, t, k, lx, ly) {
    for (let i = 0; i < 6; i++) {
      const q = clamp(k * 1.5 - i * 0.09, 0, 1);
      if (q <= 0 || q >= 1) continue;
      const sx = w * (0.08 + 0.168 * i), sy = 58 + (i % 3) * 6, e = q * q;
      for (let s = 0; s < 6; s++) {
        const e2 = Math.max(0, e - s * 0.03), x = sx + (lx - sx) * e2, y = sy + (ly - sy) * e2;
        g.fillStyle = `rgba(255,${236 - s * 10},${160 - s * 15},${1 - s * 0.15})`; g.fillRect(Math.round(x) - (s ? 0 : 1), Math.round(y) - (s ? 0 : 1), s ? 1 : 3, s ? 1 : 3);
      }
    }
  },
  // 진엔딩 새벽: 봉인석이 있던 자리에 돋은 어린 나무
  sapling(g, x, y, t, k) {
    const s = clamp(k, 0, 1), hgt = Math.round(4 + 14 * s), sway = Math.round(Math.sin(t * 1.2) * s);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 1, 4 + 4 * s, 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a4a2a'; g.fillRect(x - 1, y - hgt, 2, hgt);
    const lv = (lx, ly, c) => { g.fillStyle = c; g.fillRect(lx, ly, 3, 2); };
    if (s > 0.2) { lv(x - 4 + sway, y - hgt + 2, '#5ab04a'); lv(x + 1 + sway, y - hgt + 4, '#5ab04a'); }
    if (s > 0.5) { lv(x - 3 + sway, y - hgt - 1, '#7ad05a'); lv(x + 1 + sway, y - hgt, '#7ad05a'); lv(x - 1 + sway, y - hgt - 3, '#9ae070'); }
    if (s > 0.8) { lv(x - 6 + sway, y - hgt + 5, '#4a9a3a'); lv(x + 3 + sway, y - hgt + 7, '#4a9a3a'); }
    for (let i = 0; i < 3; i++) { // 위로 떠오르는 초록 빛
      const q = (t * 0.4 + i / 3) % 1;
      g.fillStyle = `rgba(200,255,160,${(1 - q) * s})`; g.fillRect(Math.round(x + Math.sin(t + i * 2) * 6), Math.round(y - 4 - q * 26), 1, 1);
    }
  },
  // 황금 봉인석 (게임 속 봉인석과 같은 모양을 작은 크기로)
  stone(g, x, y, t, pulse, beam) {
    const [r0, g0, b0] = beam || TITLE_GOLD, glow = a => `rgba(${r0},${g0},${b0},${a})`;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + 1, 9, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a7468';
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 5, y - 20); g.lineTo(x, y - 25); g.lineTo(x + 5, y - 20); g.lineTo(x + 7, y); g.closePath(); g.fill();
    g.fillStyle = '#a29a88';
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 5, y - 20); g.lineTo(x, y - 25); g.lineTo(x - 1, y); g.closePath(); g.fill();
    g.fillStyle = glow(0.6 + 0.4 * pulse);
    g.fillRect(x - 1, y - 18, 2, 10); g.fillRect(x - 3, y - 15, 6, 2);
    // 위로 떠오르는 빛 알갱이
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.5 + tRand(i + 200)) % 1;
      g.fillStyle = glow(1 - k);
      g.fillRect(Math.round(x + (tRand(i + 300) - 0.5) * 14 + Math.sin(t * 2 + i) * 2), Math.round(y - 8 - k * 34), 1, 1);
    }
  },
  // 제목 글씨: 작은 캔버스에 금빛으로 쓰고 도트 그대로 키운다
  logoCanvas() {
    const key = FONT;
    if (this.logo && this.logoKey === key) return this.logo;
    const size = 30, pad = 8, text = '봉인의 숲';
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `900 ${size}px ${FONT}`;
    const tw = Math.ceil(g.measureText(text).width);
    c.width = tw + pad * 2; c.height = size + pad * 2 + 10;
    const gg = c.getContext('2d');
    gg.font = `900 ${size}px ${FONT}`; gg.textAlign = 'left'; gg.textBaseline = 'top';
    const x = pad, y = pad;
    gg.lineJoin = 'round';
    // 바깥 테두리 (짙은 밤색) · 아래로 두께감
    gg.strokeStyle = '#1a0c06'; gg.lineWidth = 6;
    for (let d = 3; d >= 0; d--) gg.strokeText(text, x, y + d);
    gg.fillStyle = '#5a2a0e';
    for (let d = 3; d >= 1; d--) gg.fillText(text, x, y + d);
    // 금빛 글자: 위는 밝고 아래로 갈수록 짙은 주황
    const gd = gg.createLinearGradient(0, y, 0, y + size);
    gd.addColorStop(0, '#fffbe0'); gd.addColorStop(0.35, '#ffe17a'); gd.addColorStop(0.6, '#ffb83a'); gd.addColorStop(1, '#c8641a');
    gg.fillStyle = gd; gg.fillText(text, x, y);
    // 장식: 글자 아래 가는 줄과 가운데 마름모
    const ly = y + size + 6, mid = c.width / 2;
    gg.fillStyle = '#1a0c06'; gg.fillRect(pad + 2, ly - 1, c.width - pad * 2 - 4, 3);
    gg.fillStyle = '#ffcf5a'; gg.fillRect(pad + 3, ly, c.width - pad * 2 - 6, 1);
    gg.fillStyle = '#1a0c06'; gg.beginPath(); gg.moveTo(mid, ly - 4); gg.lineTo(mid + 5, ly + 0.5); gg.lineTo(mid, ly + 5); gg.lineTo(mid - 5, ly + 0.5); gg.closePath(); gg.fill();
    gg.fillStyle = '#7fe0ff'; gg.beginPath(); gg.moveTo(mid, ly - 2); gg.lineTo(mid + 3, ly + 0.5); gg.lineTo(mid, ly + 3); gg.lineTo(mid - 3, ly + 0.5); gg.closePath(); gg.fill();
    this.logoKey = key;
    return (this.logo = c);
  },
  // 제목을 (cx, top) 에 그린다. 화면 크기에 맞춰 정수 배율로, 뒤에 은은한 금빛
  drawLogo(cx, top, t) {
    const c = this.logoCanvas();
    const s = Math.max(1, Math.min(Math.floor(H * 0.25 / c.height * 2) / 2, Math.floor(W * 0.7 / c.width * 2) / 2));
    const w = c.width * s, h = c.height * s, x = Math.round(cx - w / 2), y = Math.round(top);
    const glow = ctx.createRadialGradient(cx, y + h * 0.45, 4, cx, y + h * 0.45, w * 0.6);
    glow.addColorStop(0, `rgba(255,200,90,${0.18 + 0.06 * Math.sin(t * 2)})`); glow.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - w * 0.6, y - h * 0.3, w * 1.2, h * 1.5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x, y + Math.round(Math.sin(t * 1.5) * s), w, h);
    return y + h;
  },
};
