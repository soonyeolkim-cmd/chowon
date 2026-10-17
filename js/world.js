'use strict';
// 타일 맵: 생성, 미리 그려두기, 충돌 판정
const TILE = 32;
const T = { GRASS: 0, WATER: 1, TREE: 2, ROCK: 3, DIRT: 4, FLOWER: 5 };
const SOLID = [false, true, true, true, false, false];

// 스테이지별 색 테마 (4스테이지부터는 반복)
const PALETTES = [
  { name: '초록 들판', bg: '#1d3a1d', trees: [[0, 0], [2, 0]], tint: null, grass: ['#4f9a45', '#4b9442', '#53a049'], blade: '#3f8237',
    tree: ['#2f6b2f', '#2b6430', '#336f2c'], treeHi: '#3f8a3b', trunk: '#6b4423',
    dirt: '#b98d5a', dirtDk: '#a67c4c', water: '#3a78c9', waterHi: '#5b96de', sand: '#e2cf8f',
    flowers: ['#f4e04d', '#ffffff', '#f28cb1', '#9ec9ff'] },
  { name: '단풍 숲', bg: '#2a2414', trees: [[14, 0], [18, 0]], tint: 'rgba(255,196,140,0.45)', grass: ['#8d9a45', '#86933f', '#95a24a'], blade: '#6f7a33',
    tree: ['#c2582b', '#b8481f', '#d0702e'], treeHi: '#e8963c', trunk: '#5a3a1e',
    dirt: '#a8784a', dirtDk: '#946840', water: '#3d6fb0', waterHi: '#5a8cc8', sand: '#d9c287',
    flowers: ['#f4e04d', '#ffb347', '#ffffff'] },
  { name: '어둠의 숲', bg: '#0f1c1a', trees: [[4, 0], [2, 0]], tint: 'rgba(80,90,160,0.55)', grass: ['#2f5a4a', '#2b5444', '#335f4f'], blade: '#244a3c',
    tree: ['#1d3b3a', '#1a3536', '#22423e'], treeHi: '#2f5a52', trunk: '#3a2a20',
    dirt: '#6e5a48', dirtDk: '#5e4c3c', water: '#2c3f7a', waterHi: '#46609e', sand: '#8e8466',
    flowers: ['#b48cff', '#7fe0ff', '#e6e6ff'] },
  // 깊은 숲
  { name: '안개 늪', bg: '#0f2422', trees: [[4, 0], [2, 0]], tint: 'rgba(60,150,140,0.5)', grass: ['#3f7a5a', '#3a7354', '#44805f'], blade: '#2f6448',
    tree: ['#1f4a3a', '#1c4434', '#245040'], treeHi: '#2f6a52', trunk: '#3a2e20',
    dirt: '#6e6a48', dirtDk: '#5e5a3c', water: '#2a6a6a', waterHi: '#3f8a86', sand: '#9a9468',
    flowers: ['#c8f0e0', '#9ad8c8', '#ffffff'] },
  { name: '바위 협곡', bg: '#2a1a12', trees: [[14, 0], [18, 0]], tint: 'rgba(240,140,80,0.42)', grass: ['#b0864a', '#a87e44', '#b88e50'], blade: '#8a6434',
    tree: ['#8a4a2a', '#7a3e22', '#9a5632'], treeHi: '#b86a3a', trunk: '#4a2a18',
    dirt: '#c08a5a', dirtDk: '#a87648', water: '#3a6a9a', waterHi: '#5a8ab8', sand: '#e0b880',
    flowers: ['#f0d8a0', '#ffffff', '#e8a060'], rocks: 0.05 },   // 바위가 많다 (우마왕 돌진 → 바위에 뿔이 박힌다)
  { name: '봉인의 근원', bg: '#150f20', trees: [[4, 0], [2, 0]], tint: 'rgba(120,80,200,0.5)', grass: ['#5a5468', '#544e62', '#605a70'], blade: '#48425a',
    tree: ['#2a2040', '#241c3a', '#30264a'], treeHi: '#40345e', trunk: '#20182a',
    dirt: '#7a6a8a', dirtDk: '#6a5a7a', water: '#3a2a7a', waterHi: '#5a4aa0', sand: '#9a8aa8',
    flowers: ['#ffd24a', '#ff6a5a', '#b48cff'], rocks: 0.025 },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const World = {
  w: 30, h: 20,
  tiles: null,
  layer: null,
  pal: PALETTES[0],
  totemSpots: [],
  startPos: { x: 0, y: 0 },
  get pw() { return this.w * TILE; },
  get ph() { return this.h * TILE; },

  // 아레나: maps.js 의 템플릿 중 하나를 뽑아 뒤집고, 봉인석·출발 위치를 고르고, 장식을 흩뿌린다.
  // opt.boss 이면 보스 전용 아레나.
  lastTemplate: null,
  generate(seed, palIndex = 0, opt = {}) {
    this.pal = PALETTES[palIndex % PALETTES.length];
    const rng = mulberry32(seed);
    // 1) 템플릿 고르기 (가중치, 바로 전 맵과 같은 건 피함)
    let tpl, key = 'boss';
    if (opt.boss) tpl = BOSS_TEMPLATE;
    else {
      const keys = Object.keys(MAP_TEMPLATES).filter(k => k !== this.lastTemplate);
      let r = rng() * keys.reduce((s, k) => s + MAP_TEMPLATES[k].weight, 0);
      key = keys.find(k => (r -= MAP_TEMPLATES[k].weight) <= 0) || keys[0];
      tpl = MAP_TEMPLATES[key];
      this.lastTemplate = key;
    }
    this.templateName = tpl.name;
    // 2) 좌우·상하 무작위 뒤집기
    const h = this.h = tpl.rows.length, w = this.w = tpl.rows[0].length;
    const fx = rng() < 0.5, fy = rng() < 0.5;
    const ch = (x, y) => tpl.rows[fy ? h - 1 - y : y][fx ? w - 1 - x : x];
    const tiles = this.tiles = new Uint8Array(w * h);
    const S = [], P = [];
    const CODE = { '#': T.TREE, '~': T.WATER, '=': T.DIRT, 'R': T.ROCK };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = ch(x, y);
      if (c === 'S') S.push([x, y]); else if (c === 'P') P.push([x, y]);
      tiles[y * w + x] = CODE[c] !== undefined ? CODE[c] : T.GRASS;
    }
    // 3) 봉인석 후보 하나, 출발은 그 봉인석에서 8칸 이상 떨어진 후보 중 하나 (없으면 가장 먼 곳)
    const [sx, sy] = S[(rng() * S.length) | 0];
    const far = P.filter(([x, y]) => Math.hypot(x - sx, y - sy) >= 8);
    const [px, py] = far.length ? far[(rng() * far.length) | 0]
      : P.slice().sort((p1, p2) => Math.hypot(p2[0] - sx, p2[1] - sy) - Math.hypot(p1[0] - sx, p1[1] - sy))[0];
    // 4) 봉인석 주변 흙바닥
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (tiles[y * w + x] === T.GRASS && Math.hypot(x - sx, y - sy) < 2.4) tiles[y * w + x] = T.DIRT;
    }
    // 5) 장식: 봉인석·출발 근처는 비우고, 막히면 장식 없이 다시
    const base = tiles.slice();
    const decorate = withBlocks => {
      tiles.set(base);
      for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
        if (tiles[y * w + x] !== T.GRASS || Math.hypot(x - sx, y - sy) < 3.5 || Math.hypot(x - px, y - py) < 2.5) continue;
        const r = rng();
        const rk = this.pal.rocks || 0.012;
        if (withBlocks && r < rk) tiles[y * w + x] = T.ROCK;
        else if (withBlocks && r < rk + 0.012) tiles[y * w + x] = T.TREE;
        else if (r < 0.09) tiles[y * w + x] = T.FLOWER;
      }
    };
    decorate(true);
    if (!this.computeReach(px, py, sx, sy)) { decorate(false); this.computeReach(px, py, sx, sy); }
    this.totemSpots = [{ x: sx * TILE + TILE / 2, y: sy * TILE + TILE / 2 }];
    this.startPos = { x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 };
    this.render(seed);
  },

  // 출발 지점에서 걸어갈 수 있는 칸 (적 등장 위치 검사용). 봉인석까지 닿으면 true.
  computeReach(px, py, sx, sy) {
    const { w, h } = this, reach = this.reach = new Uint8Array(w * h);
    const q = [[px, py]]; reach[py * w + px] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || reach[ny * w + nx] || SOLID[this.tiles[ny * w + nx]]) continue;
        reach[ny * w + nx] = 1; q.push([nx, ny]);
      }
    }
    return !!reach[sy * w + sx];
  },
  reachable(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    return !!(this.reach && this.reach[ty * this.w + tx]);
  },

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.TREE;
    return this.tiles[ty * this.w + tx];
  },

  solidAt(px, py) { return SOLID[this.tile(Math.floor(px / TILE), Math.floor(py / TILE))]; },
  // 날아가는 것(투사체)을 막는 칸: 나무 · 바위만. 물 위로는 날아간다
  shotBlockedAt(px, py) { const v = this.tile(Math.floor(px / TILE), Math.floor(py / TILE)); return SOLID[v] && v !== T.WATER; },

  // 물을 헤엄쳐 건널 수 있는 몬스터 (갓파): 나무 · 바위만 막힌다
  swimBlocked(x, y, r) {
    const t = (px, py) => { const v = this.tile(Math.floor(px / TILE), Math.floor(py / TILE)); return SOLID[v] && v !== T.WATER; };
    return t(x - r, y - r) || t(x + r, y - r) || t(x - r, y + r) || t(x + r, y + r);
  },
  inWater(px, py) { return this.tile(Math.floor(px / TILE), Math.floor(py / TILE)) === T.WATER; },
  blocked(x, y, r) {
    return this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) ||
           this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r);
  },

  // 축별로 나눠 이동해서 벽을 따라 미끄러지게 한다. 실제로 움직인 거리를 돌려준다.
  move(e, dx, dy) {
    const x0 = e.x, y0 = e.y;
    const step = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8) || 1;
    const sx = dx / step, sy = dy / step;
    for (let i = 0; i < step; i++) {
      if (sx && !this.blocked(e.x + sx, e.y, e.r)) e.x += sx;
      if (sy && !this.blocked(e.x, e.y + sy, e.r)) e.y += sy;
    }
    return Math.hypot(e.x - x0, e.y - y0);
  },

  // 날아다니는 적: 지형 무시, 맵 경계만 지킨다
  fly(e, dx, dy) {
    e.x = Math.max(TILE * 2, Math.min(this.pw - TILE * 2, e.x + dx));
    e.y = Math.max(TILE * 2, Math.min(this.ph - TILE * 2, e.y + dy));
  },

  // avoid: { x, y, d } 이 점에서 d 보다 가까운 자리는 고르지 않는다 (플레이어 바로 옆에 마물이 생기지 않게)
  findSpawn(px, py, minD, maxD, r = 14, avoid) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (x < TILE * 3 || y < TILE * 3 || x > this.pw - TILE * 3 || y > this.ph - TILE * 3) continue;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoid.d) continue;
      if (!this.blocked(x, y, r) && this.reachable(x, y)) return { x, y };
    }
    return null;
  },

  // 맵 전체를 큰 캔버스 하나에 미리 그려둔다 (Ninja Adventure 타일셋)
  render(seed) {
    const P = this.pal;
    const c = this.layer || (this.layer = document.createElement('canvas'));
    c.width = this.pw; c.height = this.ph;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rng = mulberry32(seed * 7 + 3);
    const pick = arr => arr[(rng() * arr.length) | 0];
    const put = (img, col, row, x, y, cw = 1, ch = 1) =>
      g.drawImage(img, col * 16, row * 16, cw * 16, ch * 16, x, y, cw * TILE, ch * TILE);
    const is = (tx, ty, t) => this.tile(tx, ty) === t;
    // 상하좌우 이웃이 같은 종류인지에 따라 테두리 조각을 고른다 (3x3 + 가로줄 + 세로줄 + 단독)
    const edge = (n, so, we, ea) => {
      if (n && so && we && ea) return [1, 1];
      if (!n && so && we && ea) return [1, 0]; if (n && !so && we && ea) return [1, 2];
      if (n && so && !we && ea) return [0, 1]; if (n && so && we && !ea) return [2, 1];
      if (!n && so && !we && ea) return [0, 0]; if (!n && so && we && !ea) return [2, 0];
      if (n && !so && !we && ea) return [0, 2]; if (n && !so && we && !ea) return [2, 2];
      if (!n && !so && !we && ea) return [0, 3]; if (!n && !so && we && ea) return [1, 3];
      if (!n && !so && we && !ea) return [2, 3];
      if (!n && so && !we && !ea) return [3, 0]; if (n && so && !we && !ea) return [3, 1];
      if (n && !so && !we && !ea) return [3, 2];
      return [3, 3];
    };
    const FLOOR = ART.img.floor, WATER = ART.img.water, NATURE = ART.img.nature;
    // 물 타일셋의 안쪽 모서리 조각: 그 대각선 귀퉁이에만 땅이 있는 물 (열, 행)
    const WATER_INNER = { nw: [6, 8], ne: [5, 8], sw: [6, 7], se: [5, 7] };
    const GRASS = [[3, 11], [3, 11], [3, 11], [3, 11], [2, 11], [2, 12], [3, 12], [4, 12]];
    const FLOWERS = [[0, 11], [1, 11], [3, 11], [6, 11], [4, 10], [6, 10]];

    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const t = this.tile(tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.WATER) {
        const [ec, er] = edge(is(tx, ty - 1, T.WATER), is(tx, ty + 1, T.WATER), is(tx - 1, ty, T.WATER), is(tx + 1, ty, T.WATER));
        put(WATER, ec, 6 + er, x, y);
        // 안쪽 모서리: 상하·좌우는 물인데 대각선만 땅이면 그 귀퉁이(1/4칸)에 물가 테두리를 덧그린다
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (!is(tx + ox, ty, T.WATER) || !is(tx, ty + oy, T.WATER) || is(tx + ox, ty + oy, T.WATER)) continue;
          const [ic, ir] = WATER_INNER[(oy < 0 ? 'n' : 's') + (ox < 0 ? 'w' : 'e')], qx = ox < 0 ? 0 : 1, qy = oy < 0 ? 0 : 1;
          g.drawImage(WATER, ic * 16 + qx * 8, ir * 16 + qy * 8, 8, 8, x + qx * TILE / 2, y + qy * TILE / 2, TILE / 2, TILE / 2);
        }
      } else if (t === T.DIRT) {
        const [ec, er] = edge(is(tx, ty - 1, T.DIRT), is(tx, ty + 1, T.DIRT), is(tx - 1, ty, T.DIRT), is(tx + 1, ty, T.DIRT));
        put(FLOOR, ec, 7 + er, x, y);
      } else {
        const [gc, gr] = pick(GRASS);
        put(FLOOR, gc, gr, x, y);
        if (t === T.FLOWER) { const [fc, fr] = pick(FLOWERS); put(NATURE, fc, fr, x, y); }
      }
    }
    // 바위, 덤불, 나무 (2x2 칸이 모두 나무면 큰 나무, 아니면 덤불)
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const t = this.tile(tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.ROCK) put(NATURE, 8, 12, x, y);
      else if (t === T.TREE) {
        const bx = tx & ~1, by = ty & ~1;
        const full = is(bx, by, T.TREE) && is(bx + 1, by, T.TREE) && is(bx, by + 1, T.TREE) && is(bx + 1, by + 1, T.TREE);
        if (!full) put(NATURE, 1, 10, x, y);
        else if (tx === bx && ty === by) { const [tc, tr] = pick(P.trees); put(NATURE, tc, tr, x, y, 2, 2); }
      }
    }
    // 스테이지 분위기 색조
    if (P.tint) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = P.tint; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
  },
};
