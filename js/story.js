'use strict';
// 스토리 대본, 등장인물, 동행 정령 루미
// 대사 형식: [화자, 대사]

const SPEAKERS = {
  lumi:  { name: '루미', color: '#e8ff9c' },
  rian:  { name: '리안', color: '#9cc4ff' },
  boss1: { name: '슬라임 대왕 말랑', color: '#9fd8ff' },
  boss2: { name: '숲지기 너구리 바루', color: '#e0b070' },
  boss3: { name: '숲의 군주', color: '#b8f08a' },
  system: { name: '', color: '#ffd24a' },
};

const STORY = {
  1: {
    start: [
      ['lumi', '…들려요? 일어나요, 리안!'],
      ['rian', '으윽… 여긴 숲 입구잖아. 마을은? 다들 무사해?'],
      ['lumi', '마물이 마을을 덮쳤어요. 사람들은 피신했지만, 숲의 봉인석이 계속 마물을 불러내고 있어요.'],
      ['lumi', '저는 숲의 정령 루미예요. 봉인석에 힘을 빼앗겨서 지금은 이렇게 작아졌지만요.'],
      ['lumi', '봉인석을 부숴 주면 제 힘이 돌아와요. 그 힘을 당신의 검에 빌려줄게요!'],
      ['rian', '좋아. 마을을 지키는 게 내 일이니까. 앞장서 줘, 루미.'],
      ['lumi', '가운데 봉인석이 보이죠? 봉인석이 불러내는 마물을 모두 쓰러뜨리면 보호막이 깨져요. 그 안에 정령들이 갇혀 있어요!'],
    ],
    totem1: [
      ['lumi', '봉인석이 깨지자 갇혀 있던 정령이 풀려났어요!'],
      ['lumi', '정령이 고맙다며 힘을 빌려주겠대요. 마음에 드는 축복을 하나 골라 봐요!'],
    ],
    totem2: [
      ['lumi', '또 한 명 구했어요! 같은 축복을 다시 고르면 더 강해져요.'],
    ],
    bossIntro: [
      ['boss1', '뿌우우… 봉인석 힘을 먹고 이만큼 커졌는데… 그걸 부숴?!'],
      ['rian', '슬라임이… 집채만 해졌잖아!'],
      ['lumi', '슬라임 대왕 말랑이에요! 뛰어올랐다 내려찍을 땐 빨간 원 밖으로 피해요. 돌진은 벽에 부딪히게 하면 기절해요!'],
    ],
    bossDown: [
      ['boss1', '뿌우… 숲의 군주님이… 힘을 나눠 주셨는데…'],
      ['rian', '숲의 군주? 그게 누구야?'],
      ['lumi', '…이 숲을 지키던 수호신이에요. 그분이 마물에게 힘을 줬을 리가 없는데…'],
      ['lumi', '단풍 숲으로 가 봐요. 그곳 봉인석에서도 같은 기운이 느껴져요.'],
    ],
  },
  2: {
    start: [
      ['lumi', '여기가 단풍 숲이에요. 예전엔 정령들이 노래하던 곳인데… 이렇게 조용하다니.'],
      ['lumi', '그거 알아요? 서로 다른 정령의 힘이 만나면 특별한 축복이 생기기도 한대요.'],
      ['rian', '힘을 섞는다라… 재밌겠는데.'],
    ],
    totem1: [
      ['lumi', '봉인석 안에서… 정령들의 목소리가 들려요. 다들 갇혀 있었던 거예요!'],
      ['lumi', '풀려난 친구가 또 힘을 보태 준대요.'],
    ],
    totem2: [
      ['rian', '봉인석이 땅속 깊은 곳에서 힘을 끌어올리고 있어. 누가 일부러 박아 둔 거야.'],
      ['lumi', '…이 힘의 흐름, 어둠의 숲 쪽으로 이어져 있어요.'],
    ],
    bossIntro: [
      ['boss2', '…돌아가라, 인간. 군주님의 슬픔을 방해하지 마라.'],
      ['lumi', '바루? 숲길을 지키던 너구리 숲지기잖아요! 왜 이런 일을!'],
      ['boss2', '말로는 끝나지 않는다. 이 배로 밀어내 주마!'],
    ],
    bossDown: [
      ['boss2', '인간들이… 숲을 베어 갔다… 군주님은… 그래서 분노하셨다…'],
      ['lumi', '그래서 마을에 마물을 보낸 거였어요…'],
      ['rian', '그래도 사람들이 다치게 둘 순 없어. 직접 만나서 멈추게 하자.'],
      ['lumi', '…네. 어둠의 숲으로 가요. 군주님이 거기 계세요.'],
    ],
  },
  3: {
    start: [
      ['lumi', '어두워요… 제 빛으로 주변을 밝힐게요. 제 곁에서 떨어지지 마세요.'],
      ['rian', '이 숲, 숨이 막힐 만큼 무거워. 이게 군주의 마음인가.'],
    ],
    totem1: [
      ['lumi', '군주님의 마음이 느껴져요. 아주 오래… 혼자 숲을 지키느라 외로우셨던 것 같아요.'],
    ],
    totem2: [
      ['rian', '루미, 군주를 쓰러뜨리면… 숲은 어떻게 되지?'],
      ['lumi', '봉인석이 모두 사라지면 군주님도 제정신을 찾으실 거예요. 분명히요.'],
    ],
    bossIntro: [
      ['boss3', '작은 빛의 정령이… 인간과 함께 오다니.'],
      ['rian', '저게 숲의 군주…? 숲 전체가 살아 움직이는 것 같아.'],
      ['boss3', '인간은 숲을 빼앗았다. 그러니 나도 빼앗을 뿐이다.'],
      ['rian', '마을 사람들도 이 숲을 아껴. 함께 지킬 방법을 찾자!'],
      ['boss3', '그 말이 진심이라면… 힘으로 증명해 보아라!'],
    ],
    bossDown: [
      ['boss3', '…이 따뜻한 빛. 루미, 너였구나.'],
      ['lumi', '군주님, 이제 쉬셔도 돼요. 숲은 저희가 함께 지킬게요.'],
      ['boss3', '인간의 검사여… 너를 믿어 보마. 숲과 마을을… 부탁한다.'],
      ['rian', '약속할게. 마을 사람들과 함께 숲을 돌볼게.'],
    ],
  },
};

const RETRY_LINES = [
  '괜찮아요, 다시 해 봐요! 빨간 표시가 보이면 일단 피하는 게 먼저예요.',
  '포기하지 마요! 방패병은 뒤로 돌아가거나 가드 브레이크 기술로 깨면 돼요.',
  '저도 곁에 있을게요. 무리하지 말고 하나씩 쓰러뜨려요.',
  '보스가 돌진하면 벽을 등지고 피해 보세요. 부딪혀서 기절할 거예요!',
];

// 대화창 초상화 (에셋의 얼굴 그림)
const FACES = { rian: 'heroFace', lumi: 'spiritFace', boss1: 'boss1Face', boss2: 'boss2Face', boss3: 'boss3Face' };
function drawPortrait(g, who, cx, cy, s) {
  g.save();
  g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = { lumi: '#1f3d2c', rian: '#1d2a40', boss1: '#1d3340', boss2: '#3d2a16', boss3: '#22361c' }[who] || '#222';
  g.fillRect(cx - s / 2, cy - s / 2, s, s);
  const face = FACES[who] && ART.img[FACES[who]];
  if (face) { g.imageSmoothingEnabled = false; g.drawImage(face, cx - s * 0.48, cy - s * 0.48, s * 0.96, s * 0.96); }
  g.restore();
  g.strokeStyle = SPEAKERS[who] ? SPEAKERS[who].color : '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); g.stroke();
}

// 동행 정령: 플레이어 뒤를 따라다니며 빛나고, 가끔 말을 건다
class Lumi {
  constructor(x, y) { this.x = x; this.y = y - 20; this.t = 0; this.bubble = null; }
  update(dt, p) {
    this.t += dt;
    const side = Math.cos(p.facing) > 0 ? -1 : 1;
    const tx = p.x + side * 16, ty = p.y - 26 + Math.sin(this.t * 2.5) * 3;
    const k = 1 - Math.pow(0.02, dt);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    if (Math.random() < dt * 6) {
      G.particles.push({ x: this.x + rand(-4, 4), y: this.y + rand(-4, 4), vx: rand(-8, 8), vy: rand(10, 25),
        life: 0.6, max: 0.6, color: '#f6ffb0', size: 1.5, grav: 0 });
    }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
  }
  say(text, t = 2.8) { this.bubble = { text, t }; }
  draw(g) {
    const x = this.x, y = this.y;
    const gr = g.createRadialGradient(x, y, 1, x, y, 16);
    gr.addColorStop(0, 'rgba(255,250,190,0.55)'); gr.addColorStop(1, 'rgba(255,250,190,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill();
    drawCell(g, 'spirit', 0, Math.floor(this.t * 6) % 4, x, y + 8, { scale: 1.25 });
  }
  drawBubble(g) {
    if (!this.bubble) return;
    g.globalAlpha = clamp(this.bubble.t * 2, 0, 1);
    g.font = `bold 9px ${FONT}`;
    const w = g.measureText(this.bubble.text).width + 10, x = this.x, y = this.y - 14;
    g.fillStyle = 'rgba(255,255,240,0.95)';
    g.fillRect(x - w / 2, y - 14, w, 13);
    g.beginPath(); g.moveTo(x - 3, y - 1); g.lineTo(x + 3, y - 1); g.lineTo(x, y + 3); g.fill();
    g.fillStyle = '#2a3a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(this.bubble.text, x, y - 7);
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
}
