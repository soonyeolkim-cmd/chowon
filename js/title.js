// ── 시작 화면: 배경 그림 · 제목 글씨 (2026-10-17) ──
// 밤의 숲, 빛기둥 아래 황금 봉인석, 그 앞에 선 리안과 루미. 작은 캔버스(세로 180픽셀)에 그린 뒤 그대로 키워 도트 느낌을 살린다.
// 그림은 모두 에셋 팩(Ninja Adventure)에서: 나무 · 빛줄기 · 안개 · 나뭇잎 · 주인공 · 루미
const TITLE_H = 180;              // 배경을 그리는 작은 캔버스의 세로 픽셀
const TITLE_STAR_N = 70;          // 별 개수
const TITLE_FIREFLY_N = 18;       // 반딧불 개수
const TITLE_LEAF_N = 5;           // 떨어지는 나뭇잎 개수
const TITLE_WALK_T = 4.5;        // 리안이 화면 왼쪽 아래에서 봉인석 앞까지 걸어오는 시간 (초)
const TITLE_GOLD = [255, 206, 74];  // 봉인석 빛 (1세계 황금 봉인석과 같은 색)
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
  scene(t) {
    const h = TITLE_H, w = Math.ceil(h * W / H);
    if (!this.buf || this.buf.width !== w) { this.buf = document.createElement('canvas'); this.buf.width = w; this.buf.height = h; this.g = this.buf.getContext('2d'); }
    const g = this.g, cx = Math.round(w / 2);
    // 리안이 걸어와 봉인석 앞에 선다: 시작 화면을 열 때마다 한 번 (잠깐이라도 안 그렸으면 처음부터)
    if (!(this.lastT > t - 0.5)) this.walk0 = t;
    this.lastT = t;
    const wt = t - this.walk0, wk = clamp(wt / TITLE_WALK_T, 0, 1);
    const arrive = wt >= TITLE_WALK_T ? clamp(1 - (wt - TITLE_WALK_T) / 1.2, 0, 1) : 0; // 도착하면 봉인석이 한 번 크게 빛난다
    g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // 하늘: 깊은 밤 → 지평선 쪽 보랏빛
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#080c1c'); sky.addColorStop(0.5, '#1a2444'); sky.addColorStop(0.75, '#34365a'); sky.addColorStop(1, '#2a2a40');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // 별 (반짝임)
    for (let i = 0; i < TITLE_STAR_N; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + tRand(i + 3) * 2) + i);
      g.fillStyle = `rgba(255,248,215,${(0.2 + 0.7 * tw) * (0.4 + 0.6 * tRand(i + 7))})`;
      g.fillRect(Math.floor(tRand(i) * w), Math.floor(tRand(i + 99) * h * 0.5), 1, 1);
    }
    // 달
    const mx = Math.round(w * 0.8), my = 30;
    const mg = g.createRadialGradient(mx, my, 4, mx, my, 40);
    mg.addColorStop(0, 'rgba(255,240,190,0.35)'); mg.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = mg; g.fillRect(mx - 40, my - 40, 80, 80);
    g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(mx, my, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9d9a2'; g.fillRect(mx - 4, my - 3, 3, 3); g.fillRect(mx + 3, my + 2, 2, 2); g.fillRect(mx - 1, my + 5, 2, 2);
    // 먼 숲 → 가까운 숲 (멀수록 푸르고 어둡다, 천천히 흐른다)
    this.treeLine(g, w, 108, '#222c52', 18, 11, t * 1.5);
    this.treeLine(g, w, 120, '#18294a', 21, 37, t * 3);
    this.treeLine(g, w, 132, '#122a30', 24, 71, t * 5);
    // 땅: 숲속 빈터
    const gr = g.createLinearGradient(0, 126, 0, h);
    gr.addColorStop(0, '#16301f'); gr.addColorStop(1, '#0b1a10');
    g.fillStyle = gr; g.fillRect(0, 126, w, h - 126);
    // 봉인석 빛이 비친 땅
    const [r0, g0, b0] = TITLE_GOLD, pulse = 0.5 + 0.5 * Math.sin(t * 2) + arrive;
    const lg = g.createRadialGradient(cx, 140, 2, cx, 140, 70);
    lg.addColorStop(0, `rgba(${r0},${g0},${b0},${0.28 + 0.1 * pulse})`); lg.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
    g.fillStyle = lg; g.fillRect(cx - 70, 90, 140, 90);
    // 하늘에서 내려오는 빛줄기
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35 + 0.15 * pulse;
    g.drawImage(ART.img.titleRay, cx - 60, 40, 120, 104);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 봉인석
    this.stone(g, cx, 140, t, pulse);
    // 리안과 루미: 봉인석을 올려다본다 (뒷모습)
    if (arrive > 0) { // 도착 순간 퍼지는 빛 고리
      const rr = 6 + (1 - arrive) * 40; g.strokeStyle = `rgba(${r0},${g0},${b0},${arrive * 0.8})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, 138, rr, rr * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    const sx = cx - 52, sy = h + 18, ex = cx - 16, ey = 154, moving = wk < 1;
    const hx = Math.round(sx + (ex - sx) * wk), hy = Math.round(sy + (ey - sy) * wk);
    drawCell(g, 'hero', 1, moving ? Math.floor(wt * 8) % 4 : 0, hx, hy, { scale: 1 }); // 화면 아래에서 뒷모습으로 걸어 올라와 봉인석 앞에 선다
    const lk = clamp((wt - 0.5) / TITLE_WALK_T, 0, 1); // 루미는 조금 늦게 따라온다
    drawCell(g, 'spirit', 1, Math.floor(t * 4) % 4, Math.round(sx - 14 + (cx - 30 - sx + 14) * lk), Math.round(sy - 12 + (144 - sy + 12) * lk + Math.sin(t * 2.5) * 2), { scale: 1 });
    // 가장 가까운 나무: 양옆에서 화면을 감싼다 (어둡게)
    for (const [x, y, s] of [[-12, 150, 1.8], [w - 48, 148, 1.9], [22, 172, 1.4], [w - 66, 174, 1.3]]) {
      g.drawImage(this.tinted(0, 0, '#0a140e'), Math.round(x), Math.round(y - 32 * s), Math.round(32 * s), Math.round(32 * s));
    }
    // 반딧불
    for (let i = 0; i < TITLE_FIREFLY_N; i++) {
      const fx = (tRand(i + 50) * w + Math.sin(t * 0.6 + i) * 14 + w) % w, fy = 80 + tRand(i + 80) * 90 + Math.sin(t * 0.9 + i * 2) * 6;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.3));
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
    g.globalAlpha = 0.14;
    for (let x = -((t * 4) % fw); x < w; x += fw) g.drawImage(fog, Math.round(x), h - 46);
    g.globalAlpha = 1;
    // 화면 가장자리를 어둡게
    const vg = g.createRadialGradient(cx, h * 0.55, h * 0.35, cx, h * 0.55, w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // 큰 화면으로 (도트 그대로)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, W, H);
  },
  // 황금 봉인석 (게임 속 봉인석과 같은 모양을 작은 크기로)
  stone(g, x, y, t, pulse) {
    const [r0, g0, b0] = TITLE_GOLD, glow = a => `rgba(${r0},${g0},${b0},${a})`;
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
