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
  boss4Idle: 'Actor/Boss/GiantFrog/Idle40x40.png',
  boss4Jump: 'Actor/Boss/GiantFrog/Jump.png',
  boss4Attack:'Actor/Boss/GiantFrog/Attack.png',
  boss4Charge:'Actor/Boss/GiantFrog/Charge.png',
  boss4Hit:  'Actor/Boss/GiantFrog/Hit.png',
  boss4Face: 'Actor/Boss/GiantFrog/Faceset.png',
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
  spear:     'Items/Weapons/Lance/Sprite.png',
  slash:     'FX/Attack/SlashCurved/SpriteSheet.png',
  smoke:     'FX/Smoke/Smoke/SpriteSheet.png',
  floor:     'Backgrounds/Tilesets/TilesetFloor.png',
  water:     'Backgrounds/Tilesets/TilesetWater.png',
  nature:    'Backgrounds/Tilesets/TilesetNature.png',
};
// 피격 시 하얗게, 공격 예고 시 빨갛게 번쩍일 그림들
const ART_FLASH = ['hero', 'spirit', 'slime', 'bat', 'cyclope', 'skeleton',
  'mushroom', 'mole', 'racoon', 'bear', 'snake', 'owl', 'skull', 'eye', 'flam',
  'kappa', 'axolot', 'spider', 'mollusc', 'boss4Idle', 'boss4Jump', 'boss4Attack', 'boss4Charge', 'boss4Hit',
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
      for (const k of ART_FLASH) { this.white[k] = tinted(this.img[k], '#ffffff'); this.red[k] = tinted(this.img[k], '#ff3a2a'); }
      this.ready = true;
    });
  },
};

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
];
