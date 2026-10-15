'use strict';
// 입력 통합: 키보드 / 터치(가상 조이스틱 + 버튼) / 게임패드
const Input = (() => {
  const keys = new Set();
  const queued = { attack: false, special: false, dash: false, skill: false, start: false, pause: false, tap: null };
  const state = {
    mx: 0, my: 0,            // 이동 방향 (-1 ~ 1)
    attack: false,           // 이번 프레임에 공격을 눌렀는가
    attackHeld: false,       // 공격 버튼을 누르고 있는가 (연속 공격)
    special: false, dash: false, skill: false, start: false, pause: false, tap: null,
    device: 'keyboard',      // 마지막으로 쓴 입력 장치: keyboard | touch | gamepad
  };
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, radius: 60 };
  const buttons = {};        // id -> { x, y, r, visible, pointer, held }
  const pointers = new Map(); // 지금 눌려 있는 손가락·마우스: id -> { x, y }
  const padPrev = [];
  let padHeldAttack = false;
  let lastPad = null;

  // 키보드: 방향키 이동 + 왼손 Z 공격 · X 대시 · C 특수 (Ctrl 공격 · Space 대시 · Alt 특수도 함께 동작)
  // 기본공격을 길게 눌렀다 떼면 회전베기
  const ATTACK_KEYS = ['KeyZ', 'ControlLeft'];
  const SPECIAL_KEYS = ['KeyC', 'AltLeft'];
  const SKILL_KEYS = [];          // 전용스킬: 무기에 생기면 키를 정한다
  const DASH_KEYS = ['KeyX', 'Space'];
  const GAME_KEYS = [...ATTACK_KEYS, ...SPECIAL_KEYS, ...DASH_KEYS];

  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) state.device = 'touch';

  function setButton(id, x, y, r, visible = true) {
    const b = buttons[id] || (buttons[id] = { pointer: null, held: false });
    b.x = x; b.y = y; b.r = r; b.visible = visible;
    if (!visible) { b.pointer = null; b.held = false; }
  }
  // 게임 화면 좌표로 바꾼다 (세로 휴대폰에서 화면을 90도 돌려 그릴 때)
  const toView = e => api.rot ? { x: e.clientY, y: api.physW - e.clientX } : { x: e.clientX, y: e.clientY };
  const hit = (b, x, y, pad) => b && b.visible && Math.hypot(x - b.x, y - b.y) <= b.r * pad;

  function onDown(e) {
    e.preventDefault();
    const { x, y } = toView(e);
    if (e.pointerType !== 'mouse') state.device = 'touch';
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}

    // 화면 위쪽 UI 버튼 (일시정지, 전체화면)
    for (const id of ['skip', 'pause', 'fullscreen']) {
      if (hit(buttons[id], x, y, 1.3)) { api.onUi && api.onUi(id); return; }
    }
    queued.start = true;
    queued.tap = { x, y };
    pointers.set(e.pointerId, { x, y });
    if (e.pointerType === 'mouse') { queued.attack = true; return; }

    // 터치 판정이 겹치면 손가락에 가장 가까운 버튼을 누른다
    let best = null, bestK = Infinity;
    for (const id of ['attack', 'special', 'dash', 'skill']) {
      const b = buttons[id];
      if (!hit(b, x, y, 1.35)) continue;
      const k = Math.hypot(x - b.x, y - b.y) / b.r;
      if (k < bestK) { bestK = k; best = id; }
    }
    if (best) { const b = buttons[best]; b.pointer = e.pointerId; b.held = true; queued[best] = true; return; }
    if (x < api.viewW * 0.5) {
      // 왼쪽 절반: 누른 곳이 조이스틱 중심이 된다
      if (joy.id === null) { joy.id = e.pointerId; joy.ox = joy.x = x; joy.oy = joy.y = y; }
    } else {
      // 오른쪽 빈 곳을 탭해도 공격
      queued.attack = true;
    }
  }

  function onMove(e) {
    const pt = pointers.get(e.pointerId);
    const v = toView(e);
    if (pt) { pt.x = v.x; pt.y = v.y; }
    if (e.pointerId !== joy.id) return;
    e.preventDefault();
    joy.x = v.x; joy.y = v.y;
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, len = Math.hypot(dx, dy);
    if (len > joy.radius) { // 손가락을 따라 조이스틱 중심이 끌려온다
      joy.ox = joy.x - dx / len * joy.radius;
      joy.oy = joy.y - dy / len * joy.radius;
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (e.pointerId === joy.id) joy.id = null;
    for (const id in buttons) {
      const b = buttons[id];
      if (b.pointer === e.pointerId) { b.pointer = null; b.held = false; }
    }
  }

  function init(canvas) {
    addEventListener('keydown', e => {
      keys.add(e.code);
      state.device = 'keyboard';
      if (!e.repeat) {
        if (ATTACK_KEYS.includes(e.code)) queued.attack = true;
        if (DASH_KEYS.includes(e.code)) queued.dash = true;
        if (SKILL_KEYS.includes(e.code)) queued.skill = true;
        if (SPECIAL_KEYS.includes(e.code)) queued.special = true;
        if (e.code === 'Escape' || e.code === 'KeyP') queued.pause = true;
        queued.start = true;
      }
      // 게임 키가 브라우저 기능(스크롤, Alt 메뉴 등)을 건드리지 않게 막는다
      if (e.code.startsWith('Arrow') || GAME_KEYS.includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { keys.delete(e.code); if (GAME_KEYS.includes(e.code)) e.preventDefault(); });
    addEventListener('blur', () => { keys.clear(); joy.id = null; pointers.clear(); });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());

    addEventListener('gamepadconnected', e => api.onPadConnect && api.onPadConnect(e.gamepad));
    canvas.addEventListener('wheel', e => { api.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }

  function pollPad() {
    padHeldAttack = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    lastPad = gp;
    if (!gp) return null;

    const down = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = [];
    let anyButton = false;
    for (let i = 0; i < gp.buttons.length; i++) {
      const now = down(i);
      edge[i] = now && !padPrev[i];
      padPrev[i] = now;
      if (now) anyButton = true;
    }

    let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const l = Math.hypot(ax, ay), DZ = 0.22;
    if (l < DZ) { ax = 0; ay = 0; } else { const m = Math.min(1, (l - DZ) / (1 - DZ)); ax = ax / l * m; ay = ay / l * m; }
    if (down(14)) ax = -1; if (down(15)) ax = 1;   // 십자키
    if (down(12)) ay = -1; if (down(13)) ay = 1;

    if (ax || ay || anyButton) state.device = 'gamepad';
    // 게임패드: A 기본공격(길게 = 회전베기) · X 특수공격 · B 대시
    if (edge[0]) queued.attack = true;                                 // A
    if (edge[2] || edge[3] || edge[4] || edge[7]) queued.special = true; // X, Y, LB, RT
    if (edge[1] || edge[5]) queued.dash = true;                        // B, RB
    if (edge[9]) queued.pause = true;                                   // START
    if (edge[0] || edge[1] || edge[2] || edge[3] || edge[9]) queued.start = true;
    padHeldAttack = down(0);
    return { ax, ay };
  }

  function update() {
    const has = c => keys.has(c);
    let mx = (has('ArrowRight') ? 1 : 0) - (has('ArrowLeft') ? 1 : 0);
    let my = (has('ArrowDown') ? 1 : 0) - (has('ArrowUp') ? 1 : 0);

    if (joy.id !== null) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, len = Math.hypot(dx, dy);
      const m = Math.min(1, len / joy.radius);
      if (m > 0.15) { mx = dx / len * m; my = dy / len * m; }
    }
    const pad = pollPad();
    if (pad && (pad.ax || pad.ay)) { mx = pad.ax; my = pad.ay; }

    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    state.mx = mx; state.my = my;
    state.attack = queued.attack;
    state.dash = queued.dash;
    state.skill = queued.skill;
    state.special = queued.special;
    state.start = queued.start;
    state.pause = queued.pause;
    state.tap = queued.tap;
    queued.tap = null;
    state.attackHeld = ATTACK_KEYS.some(has) || !!(buttons.attack && buttons.attack.held) || padHeldAttack;
    queued.attack = queued.special = queued.dash = queued.skill = queued.start = queued.pause = false;
  }

  // 진동: 게임패드는 듀얼 럼블, 휴대폰은 vibrate (안드로이드)
  function rumble(strength, ms) {
    try {
      if (state.device === 'gamepad' && lastPad && lastPad.vibrationActuator) {
        lastPad.vibrationActuator.playEffect('dual-rumble', {
          duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 0.7),
        }).catch(() => {});
      } else if (state.device === 'touch' && navigator.vibrate) {
        navigator.vibrate(Math.round(ms * strength));
      }
    } catch (_) {}
  }

  const api = { init, update, state, joy, buttons, pointers, setButton, rumble, onUi: null, onPadConnect: null,
    rot: false, physW: innerWidth, viewW: innerWidth, wheel: 0 };
  return api;
})();
