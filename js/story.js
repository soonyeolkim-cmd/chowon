'use strict';
// 스토리 대본, 등장인물, 동행 정령 루미
// 대사 형식: [화자, 대사]

const SPEAKERS = {
  lumi:  { name: '루미', color: '#e8ff9c' },
  rian:  { name: '리안', color: '#9cc4ff' },
  boss1: { name: '슬라임 대왕 말랑', color: '#9fd8ff' },
  boss2: { name: '숲지기 너구리 바루', color: '#e0b070' },
  boss3: { name: '숲의 군주', color: '#b8f08a' },
  boss4: { name: '늪의 왕 개굴대왕', color: '#8af0c8' },
  boss5: { name: '도끼황소 우마왕', color: '#ff9a6a' },
  boss6: { name: '삼룡', color: '#ff8ad0' },
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

// 깊은 숲 (세계 4~6)
STORY[4] = {
  start: [
    ['lumi', '여기가 깊은 숲… 바깥 숲보다 봉인의 기운이 훨씬 짙어요.'],
    ['rian', '군주님이 말했던 "더 깊은 곳의 봉인"이 여기구나. 안개 때문에 앞이 잘 안 보여.'],
    ['lumi', '늪에 사는 마물들은 물속을 헤엄쳐 다녀요. 물가를 조심해요!'],
  ],
  totem1: [
    ['lumi', '이 봉인석… 바깥 숲 것보다 훨씬 오래됐어요. 누가, 왜 이렇게 깊이 봉인을 했을까요?'],
  ],
  totem2: [
    ['rian', '정령들이 풀려날수록 안개가 걷히는 것 같아.'],
    ['lumi', '늪 한가운데서 커다란 울음소리가 들려요. 늪의 주인이에요.'],
  ],
  bossIntro: [
    ['boss4', '개굴… 개굴… 오랜만에 맛있어 보이는 손님이로구나.'],
    ['rian', '혀가… 엄청 길어!'],
    ['boss4', '이 늪 너머엔 아무도 보낼 수 없다. 저 깊은 곳엔 깨어나선 안 될 것들이 잠들어 있으니까!'],
    ['lumi', '혀를 쭉 내밀기 전에 선이 보일 거예요. 옆으로 피해요!'],
  ],
  bossDown: [
    ['boss4', '개굴… 너희라면… 어쩌면 그 세 녀석을…'],
    ['rian', '세 녀석? 무슨 소리야?'],
    ['boss4', '봉인의 근원에서… 세 마리 용이… 눈을 뜨려 하고 있다…'],
    ['lumi', '세 마리 용…! 리안, 이 숲 깊은 곳에 진짜 위험이 있는 것 같아요.'],
  ],
};

STORY[5] = {
  start: [
    ['lumi', '붉은 바위 협곡이에요. 바닥에 커다란 발굽 자국이…'],
    ['rian', '안개는 걷혔는데, 이번엔 사방에서 쿵쿵 울리는 소리가 나.'],
    ['lumi', '하늘에서 떨어지는 공격이 많아요. 땅에 생기는 그림자를 잘 봐요!'],
  ],
  totem1: [
    ['lumi', '여기 마물들은 마치 누군가에게 훈련받은 것 같아요. 투기장 같은 냄새가 나요.'],
  ],
  totem2: [
    ['rian', '바위마다 도끼 자국이 있어. 엄청난 힘이야.'],
    ['lumi', '협곡의 주인은 돌진을 좋아한대요. 바위를 등지고 싸우면 유리할지도 몰라요!'],
  ],
  bossIntro: [
    ['boss5', '음머어어어! 내 투기장에 발을 들인 건 네놈이냐!'],
    ['rian', '황소가… 도끼를 들고 있어?!'],
    ['boss5', '삼룡님의 잠을 깨우려는 자는 이 도끼로 두 동강을 내주마!'],
    ['lumi', '돌진하면 바위 쪽으로 유도해요! 뿔이 박히면 기회예요!'],
  ],
  bossDown: [
    ['boss5', '음머… 이 몸이… 지다니…'],
    ['boss5', '좋다, 인정하마. 하지만 저 너머 봉인의 근원엔… 이 몸보다 훨씬 무서운 것이 있다.'],
    ['rian', '삼룡… 개굴대왕도 그 이야기를 했었지.'],
    ['lumi', '이제 거의 다 왔어요. 숲의 가장 깊은 봉인까지!'],
  ],
};

STORY[6] = {
  start: [
    ['lumi', '여기가… 봉인의 근원. 숲의 모든 봉인이 시작된 곳이에요.'],
    ['rian', '오래된 유적이야. 벽마다 용 그림이 새겨져 있어.'],
    ['lumi', '수호자들이 아직 이곳을 지키고 있어요. 등 뒤를 조심해요, 리안!'],
  ],
  totem1: [
    ['lumi', '봉인석에서 세 가지 기운이 느껴져요. 불, 얼음, 그리고… 독.'],
  ],
  totem2: [
    ['rian', '봉인을 하나씩 풀 때마다 땅이 울려. 뭔가 깨어나고 있어.'],
    ['lumi', '리안… 지금이라도 돌아갈 수 있어요. 하지만… 저는 당신을 믿어요.'],
    ['rian', '여기까지 왔잖아. 끝까지 가자, 루미.'],
  ],
  bossIntro: [
    ['boss6', '…천 년의 잠을 깨운 자가 누구냐.'],
    ['boss6', '불의 숨결, 얼음의 숨결, 독의 숨결. 우리 셋이 이 숲의 근원이다.'],
    ['rian', '숲의 마물들이 날뛴 건 너희가 깨어나려 했기 때문이었구나!'],
    ['boss6', '작은 검사여. 숲을 지키고 싶다면… 우리 셋을 모두 이겨 보아라!'],
    ['lumi', '한 마리씩 와요! 브레스를 피하고, 머리를 숙일 때 공격해요!'],
  ],
  bossDown: [
    ['boss6', '…훌륭하다. 이 숲에 이런 검사가 있을 줄이야.'],
    ['boss6', '우리는 다시 잠들겠다. 숲과 마을을… 네게 맡기마.'],
    ['lumi', '리안! 해냈어요! 숲의 모든 봉인이 제자리를 찾았어요!'],
    ['rian', '루미, 고마워. 네가 없었으면 여기까지 못 왔을 거야.'],
    ['lumi', '헤헤… 이제 마을로 돌아가요. 다들 기다리고 있을 거예요!'],
  ],
};

// (안 씀) 판 시작 무작위 조언 — 상황과 안 맞아서 루미가 그때그때 말하는 방식으로 바꿨다 (2026-10-17)
const RETRY_LINES = [
  '괜찮아요, 다시 해 봐요! 빨간 표시가 보이면 일단 피하는 게 먼저예요.',
  '포기하지 마요! 방패병은 뒤로 돌아가거나 가드 브레이크 기술로 깨면 돼요.',
  '저도 곁에 있을게요. 무리하지 말고 하나씩 쓰러뜨려요.',
  '보스가 돌진하면 벽을 등지고 피해 보세요. 부딪혀서 기절할 거예요!',
];

// 대화창 초상화 (에셋의 얼굴 그림)
const FACES = { rian: 'heroFace', lumi: 'spiritFace', boss1: 'boss1Face', boss2: 'boss2Face', boss3: 'boss3Face', boss4: 'boss4Face', boss5: 'beastFace', boss6: 'dragonFace' };
function drawPortrait(g, who, cx, cy, s) {
  g.save();
  g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = { lumi: '#1f3d2c', rian: '#1d2a40', boss1: '#1d3340', boss2: '#3d2a16', boss3: '#22361c', boss4: '#16362e', boss5: '#3a1a10', boss6: '#2a1030' }[who] || '#222';
  g.fillRect(cx - s / 2, cy - s / 2, s, s);
  const face = FACES[who] && ART.img[FACES[who]];
  if (face) { g.imageSmoothingEnabled = false; g.drawImage(face, cx - s * 0.48, cy - s * 0.48, s * 0.96, s * 0.96); }
  g.restore();
  g.strokeStyle = SPEAKERS[who] ? SPEAKERS[who].color : '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); g.stroke();
}

// 동행 정령: 플레이어 뒤를 따라다니며 빛나고, 가끔 말을 건다
const BUBBLE_W = 150; // 루미 말풍선 한 줄 최대 폭 (월드 픽셀)
class Lumi {
  constructor(x, y) { this.x = x; this.y = y - 20; this.t = 0; this.bubble = null; }
  update(dt, p) {
    this.t += dt;
    const side = Math.cos(p.facing) > 0 ? -1 : 1;
    let tx = p.x + side * 16, ty = p.y - 26 + Math.sin(this.t * 2.5) * 3;
    // 찾아 주기: 정해진 곳으로 날아가 그 위를 빙빙 돈다 (바루 둔갑 등)
    if (this.seekP) {
      this.seekP.t -= dt;
      if (this.seekP.t <= 0) this.seekP = null;
      else {
        tx = this.seekP.x + Math.cos(this.t * 5) * 16; ty = this.seekP.y - 30 + Math.sin(this.t * 5) * 7;
        if (Math.random() < dt * 20) G.particles.push({ x: this.x + rand(-6, 6), y: this.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(10, 40), life: 0.7, max: 0.7, color: '#ffffa0', size: 2, grav: 0 });
      }
    }
    const k = 1 - Math.pow(this.seekP ? 0.0005 : 0.02, dt);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    if (Math.random() < dt * 6) {
      G.particles.push({ x: this.x + rand(-4, 4), y: this.y + rand(-4, 4), vx: rand(-8, 8), vy: rand(10, 25),
        life: 0.6, max: 0.6, color: '#f6ffb0', size: 1.5, grav: 0 });
    }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
  }
  say(text, t = 2.8) { this.bubble = { text, t }; }
  seek(x, y, t) { this.seekP = { x, y, t }; }
  stopSeek() { this.seekP = null; }
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
    // 긴 말은 띄어쓰기 단위로 여러 줄 (한 줄 최대 BUBBLE_W)
    const lines = [];
    let cur = '';
    for (const word of this.bubble.text.split(' ')) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && g.measureText(next).width > BUBBLE_W) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
    const w = Math.max(...lines.map(l => g.measureText(l).width)) + 10, lh = 11, h = lines.length * lh + 3;
    const x = clamp(this.x, G.view ? G.view.x + w / 2 + 4 : -Infinity, G.view ? G.view.x + W / SCALE - w / 2 - 4 : Infinity), y = this.y - 14;
    g.fillStyle = 'rgba(255,255,240,0.95)';
    g.fillRect(x - w / 2, y - h - 1, w, h);
    g.beginPath(); g.moveTo(this.x - 3, y - 1); g.lineTo(this.x + 3, y - 1); g.lineTo(this.x, y + 3); g.fill();
    g.fillStyle = '#2a3a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x, y - h - 1 + 7 + i * lh));
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
}
