'use strict';
// 그래픽 에셋: Ninja Adventure Asset Pack (pixel-boy, CC0) — assets/NinjaAdventure/
// 원본은 16px 도트라서 월드에는 2배(PIX)로 그린다. 타일 1칸 = 16px × 2 = 32 (TILE)

const PIX = 2;
const ART_DIR = 'assets/NinjaAdventure/';
const ART_FILES = {
  hero:      'Actor/Character/Boy/SpriteSheet.png',
  heroFace:  'Actor/Character/Boy/Faceset.png',
  spirit:    'Actor/Monster/Spirit/SpriteSheet.png',
  spiritFace:'Actor/Monster/Spirit/Faceset.png',
  slime:     'Actor/Monster/Slime/Slime.png',
  bat:       'Actor/Monster/BlueBat/SpriteSheet.png',
  cyclope:   'Actor/Monster/Cyclope/SpriteSheet.png',
  skeleton:  'Actor/Character/Skeleton/SpriteSheet.png',
  mushroom:  'Actor/Monster/Mushroom/mushroom.png',
  mole:      'Actor/Monster/Mole/Mole.png',
  racoon:    'Actor/Monster/Racoon/SpriteSheet.png',
  bear:      'Actor/Monster/Bear/SpriteSheet.png',
  snake:     'Actor/Monster/Snake/Snake.png',
  owl:       'Actor/Monster/Owl/Owl.png',
  skull:     'Actor/Monster/Skull/SpriteSheet.png',
  eye:       'Actor/Monster/Eye/Eye.png',
  flam:      'Actor/Monster/Flam/SpriteSheet.png',
  kappa:     'Actor/Monster/KappaGreen/SpriteSheet.png',
  axolot:    'Actor/Monster/Axolot/SpriteSheet.png',
  spider:    'Actor/Monster/SpiderRed/SpriteSheet.png',
  mollusc:   'Actor/Monster/Mollusc/Mollusc.png',
  fish:      'Actor/Monster/Fish/SpriteSheet.png',      // 늪 물고기 (2026-10-17)
  moth:      'Actor/Monster/Butterfly/SpriteSheet.png', // 나방
  boss4Idle: 'Actor/Boss/GiantFrog/Idle40x40.png',
  boss4Jump: 'Actor/Boss/GiantFrog/Jump.png',
  boss4Attack:'Actor/Boss/GiantFrog/Attack.png',
  boss4Charge:'Actor/Boss/GiantFrog/Charge.png',
  boss4Hit:  'Actor/Boss/GiantFrog/Hit.png',
  boss4Face: 'Actor/Boss/GiantFrog/Faceset.png',
  lion:      'Actor/Character/CaveLion/SpriteSheet.png',
  trex:      'Actor/Monster/TRex/SpriteSheet.png',
  cyclops2:  'Actor/Monster/Cyclope2/SpriteSheet.png',
  lizard:    'Actor/Monster/Lizard/Lizard.png',
  beast:     'Actor/Monster/Beast/Beast.png',
  beastFace: 'Actor/Monster/Beast/Faceset.png',
  axe:       'Items/Weapons/Axe/Sprite.png',
  demon:     'Actor/Character/DemonRed/SpriteSheet.png',
  lantern:   'Actor/Monster/LanternRed/SpriteSheet.png',
  statue:    'Actor/Character/Statue/SpriteSheet.png',
  babydragon:'Actor/Monster/DragonYellow/SpriteSheet.png',
  dragonFace:'Actor/Boss/DragonBlue/Faceset.png',
  dragonGreenHead: 'Actor/Boss/DragonGreen/Head.png',
  dragonGreenBody1: 'Actor/Boss/DragonGreen/Body1.png',
  dragonGreenBody2: 'Actor/Boss/DragonGreen/Body2.png',
  dragonGreenEnd: 'Actor/Boss/DragonGreen/BodyEnd.png',
  dragonGreenWing: 'Actor/Boss/DragonGreen/Wing.png',
  dragonBlueHead: 'Actor/Boss/DragonBlue/Head.png',
  dragonBlueBody1: 'Actor/Boss/DragonBlue/Body1.png',
  dragonBlueBody2: 'Actor/Boss/DragonBlue/Body2.png',
  dragonBlueEnd: 'Actor/Boss/DragonBlue/BodyEnd.png',
  dragonBlueWing: 'Actor/Boss/DragonBlue/Wing.png',
  boss1Idle: 'Actor/Boss/GiantSlime/Idle.png',
  boss1Jump: 'Actor/Boss/GiantSlime/Jump.png',
  boss1Hit:  'Actor/Boss/GiantSlime/Hit.png',
  boss1Face: 'Actor/Boss/GiantSlime/Faceset.png',
  boss2Idle: 'Actor/Boss/GiantRacoon/Idle.png',
  boss2Attack:'Actor/Boss/GiantRacoon/Attack.png',
  boss2Charge:'Actor/Boss/GiantRacoon/Charge.png',
  boss2Jump: 'Actor/Boss/GiantRacoon/Jump.png',
  boss2Face: 'Actor/Boss/GiantRacoon/Faceset.png',
  boss3Idle: 'Actor/Boss/GiantBamboo/Idle.png',
  boss3Walk: 'Actor/Boss/GiantBamboo/Walk.png',
  boss3Attack:'Actor/Boss/GiantBamboo/Attack.png',
  boss3Charge:'Actor/Boss/GiantBamboo/Charge.png',
  boss3Hit:  'Actor/Boss/GiantBamboo/Hit.png',
  boss3Face: 'Actor/Boss/GiantBamboo/Faceset.png',
  sword:     'Items/Weapons/Sword/Sprite.png',
  swordIcon: 'Items/Weapons/Sword2/Sprite.png',     // 가상 패드 공격 버튼용 깔끔한 검 (2026-10-22)
  spear:     'Items/Weapons/Lance/Sprite.png',
  slash:     'FX/Attack/SlashCurved/SpriteSheet.png',
  sai:       'Items/Weapons/Sai/Sprite.png',
  wand:      'Items/Weapons/MagicWand/Sprite.png',
  bow:       'Items/Weapons/Bow/Sprite.png',          // 사냥꾼의 활 (15x7, 2026-10-20)
  arrow:     'Items/Weapons/Bow/Arrow.png',           // 화살 (13x5, 촉이 오른쪽)
  orb:       'FX/Projectile/EnergyBall.png',           // 마력탄 (16x16 4장)
  magicCircle: 'FX/Magic/Circle/SpriteSheetWhite.png', // 마법진 (32x32 4장)
  cutX:      'FX/Attack/CutX/SpriteSheet.png',          // 쌍검 3타째 X자 베기 (32x32 4장)
  circSlash: 'FX/Attack/CircularSlash/SpriteSheet.png', // 쌍검 선풍 베기
  smoke:     'FX/Smoke/Smoke/SpriteSheet.png',
  cut:       'FX/Attack/Cut/SpriteSheet.png',          // 창 찌르기 · 관통 · 일섬 · 던진 창 꼬리 (32x32 4장, 2026-10-18)
  fxBoom:    'FX/Elemental/Explosion/SpriteSheet.png', // 도트 폭발 (40x40 9장)
  fxIce:     'FX/Elemental/Ice/SpriteSheet.png',       // 도트 얼음 (32x32 10장)
  fxThunder: 'FX/Elemental/Thunder/SpriteSheet.png',   // 도트 번개 (20x28 8장)
  fxRingPx:  'FX/Magic/Circle/SpriteSheetSpark.png',   // 도트 고리 (32x32 6장) — 동그란 선 고리 대신 (2026-10-18)
  floor:     'Backgrounds/Tilesets/TilesetFloor.png',
  water:     'Backgrounds/Tilesets/TilesetWater.png',
  nature:    'Backgrounds/Tilesets/TilesetNature.png',
  shield:    '../Things/Shield.png',            // 수호의 방패 (Things by SnoopethDuckDuck, CC0)
  guardFx:   'FX/Magic/Shield/SpriteSheetBlue.png', // 방패 막기 보호막 (24x26 6장)
  titleRay:  'FX/Environment/Raylight.png',   // 시작 화면: 빛줄기 · 안개 · 나뭇잎
  titleFog:  'FX/Environment/Fog.png',
  titleLeaf: 'FX/Particle/Leaf.png',
};
// 피격 시 하얗게, 공격 예고 시 빨갛게 번쩍일 그림들
const ART_FLASH = ['hero', 'spirit', 'slime', 'bat', 'cyclope', 'skeleton',
  'mushroom', 'mole', 'racoon', 'bear', 'snake', 'owl', 'skull', 'eye', 'flam',
  'kappa', 'axolot', 'spider', 'mollusc', 'fish', 'moth', 'boss4Idle', 'boss4Jump', 'boss4Attack', 'boss4Charge', 'boss4Hit',
  'lion', 'trex', 'cyclops2', 'lizard', 'beast',
  'demon', 'lantern', 'statue', 'babydragon',
  'dragonGreenHead', 'dragonGreenBody1', 'dragonGreenBody2', 'dragonGreenEnd', 'dragonGreenWing', 'dragonBlueHead', 'dragonBlueBody1', 'dragonBlueBody2', 'dragonBlueEnd', 'dragonBlueWing', 'dragonRedHead', 'dragonRedBody1', 'dragonRedBody2', 'dragonRedEnd', 'dragonRedWing',
  'boss1Idle', 'boss1Jump', 'boss1Hit', 'boss2Idle', 'boss2Attack', 'boss2Charge', 'boss2Jump',
  'boss3Idle', 'boss3Walk', 'boss3Attack', 'boss3Charge', 'boss3Hit'];

const ART = {
  img: {}, white: {}, red: {}, ready: false,

  load() {
    const jobs = Object.entries(ART_FILES).map(([k, path]) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.img[k] = im; res(); };
      im.onerror = () => rej(new Error('그림을 불러오지 못했어요: ' + path));
      im.src = encodeURI(ART_DIR + path);
    }));
    return Promise.all(jobs).then(() => {
      for (const p of ['Head', 'Body1', 'Body2', 'End', 'Wing']) this.img['dragonRed' + p] = hueShift(this.img['dragonGreen' + p], -72, 0.15, 0.55);
      for (const k of ART_FLASH) { this.white[k] = tinted(this.img[k], '#ffffff'); this.red[k] = tinted(this.img[k], '#ff3a2a'); }
      this.ready = true;
    });
  },
};

// 그림의 색상(hue)만 돌린다 (밝기 · 채도 유지)
// lo~hi 범위(0~1) 색상만 돌린다 → 초록 비늘만 붉게, 뿔 · 얼굴의 베이지색은 그대로
function hueShift(im, deg, lo = 0, hi = 1) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, sh = deg / 360;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    let r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
    if (mx === mn) continue;
    const dd = mx - mn, s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    let h = mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
    h = h / 6; if (h < lo || h > hi) continue;
    h = ((h + sh) % 1 + 1) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    px[i] = f(h + 1 / 3) * 255; px[i + 1] = f(h) * 255; px[i + 2] = f(h - 1 / 3) * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function tinted(im, color) {
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// 각도 → 시트의 방향 열 (0 아래, 1 위, 2 왼쪽, 3 오른쪽)
function dirCol(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) > Math.abs(s)) return c > 0 ? 3 : 2;
  return s > 0 ? 0 : 1;
}

// 16x16 칸 하나를 그린다. (x, y) = 발밑 중앙
function drawCell(g, key, col, row, x, y, opt = {}) {
  const s = (opt.scale || PIX), w = 16 * s * (opt.sx || 1), h = 16 * s * (opt.sy || 1);
  const dx = Math.round(x - w / 2), dy = Math.round(y - h);
  g.drawImage(opt.white ? ART.white[key] : ART.img[key], col * 16, row * 16, 16, 16, dx, dy, w, h);
  if (opt.red) {
    const a = g.globalAlpha; g.globalAlpha = a * opt.red;
    g.drawImage(ART.red[key], col * 16, row * 16, 16, 16, dx, dy, w, h);
    g.globalAlpha = a;
  }
}

// 가로로 프레임이 이어진 시트(보스·이펙트)의 한 프레임. (x, y) = 발밑 중앙
function drawStrip(g, key, fw, frame, x, y, opt = {}) {
  const im = ART.img[key], fh = im.height, n = Math.floor(im.width / fw);
  const f = ((frame % n) + n) % n, s = opt.scale || PIX;
  const w = fw * s, h = fh * s, dx = Math.round(x - w / 2), dy = Math.round(y - h);
  g.drawImage(opt.white ? ART.white[key] : im, f * fw, 0, fw, fh, dx, dy, w, h);
  if (opt.red) {
    const a = g.globalAlpha; g.globalAlpha = a * opt.red;
    g.drawImage(ART.red[key], f * fw, 0, fw, fh, dx, dy, w, h);
    g.globalAlpha = a;
  }
}
const stripFrames = (key, fw) => Math.floor(ART.img[key].width / fw);

// 보스별 애니메이션 구성 (프레임 너비, 상태별 시트)
const BOSS_ART = [
  { fw: 62, idle: 'boss1Idle', move: 'boss1Idle', wind: 'boss1Jump', attack: 'boss1Jump', hit: 'boss1Hit', face: 'boss1Face', foot: 4 },
  { fw: 60, idle: 'boss2Idle', move: 'boss2Idle', wind: 'boss2Charge', attack: 'boss2Attack', hit: 'boss2Jump', face: 'boss2Face', foot: 4 },
  { fw: 62, idle: 'boss3Idle', move: 'boss3Walk', wind: 'boss3Charge', attack: 'boss3Attack', hit: 'boss3Hit', face: 'boss3Face', foot: 2 },
  { fw: 40, idle: 'boss4Idle', move: 'boss4Idle', wind: 'boss4Charge', attack: 'boss4Attack', hit: 'boss4Hit', air: 'boss4Jump', face: 'boss4Face', foot: 2, scale: 1.5 },
  { custom: 'bull', face: 'beastFace' },   // 우마왕: 황소 마귀 그림을 크게 + 도끼
  { custom: 'trio', face: 'dragonFace' },  // 삼룡: 용 셋은 따로 그린다 (Dragon)
];
