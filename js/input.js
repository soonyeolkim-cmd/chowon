'use strict';
// 입력 통합: 키보드 / 터치(가상 조이스틱 + 버튼) / 게임패드
const Input = (() => {
  const keys = new Set();
  const queued = { attack: false, special: false, dash: false, skill: false, start: false, pause: false, confirm: false, back: false, reroll: false, tap: null };
  const state = {
    mx: 0, my: 0,            // 이동 방향 (-1 ~ 1)
    attack: false,           // 이번 프레임에 공격을 눌렀는가
    attackHeld: false,       // 공격 버튼을 누르고 있는가 (연속 공격)
    special: false, dash: false, skill: false, start: false, pause: false, tap: null,
    reroll: false,               // 축복 다시 뽑기 (키보드: 특수 키 · 패드: Y)
    confirm: false, back: false, // 메뉴용: 결정(Enter · 공격 · 패드 A) / 뒤로(Esc · 일시정지 · 패드 B)
    device: 'keyboard',      // 마지막으로 쓴 입력 장치: keyboard | touch | gamepad
  };
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, radius: 60 };
  const buttons = {};        // id -> { x, y, r, visible, pointer, held }
  const pointers = new Map(); // 지금 눌려 있는 손가락·마우스: id -> { x, y }
  const padPrev = [];
  let padHeldAttack = false;
  let lastPad = null;

  // 조작 설정 (설정 화면에서 바꿀 수 있고, 이 기기에 저장된다)
  //  키보드: 방향키 이동 · Z/왼쪽 Ctrl 공격(길게 = 차지) · X/Space 대시 · C/왼쪽 Alt 특수 · Esc/P 일시정지
  //  게임패드 (엑스박스 기준 버튼 위치, 스위치는 같은 위치): X 공격 · A 특수 · RB 대시 · START 일시정지 (이동은 왼쪽 스틱 · 십자키 고정)
  const DEFAULT_BINDS = {
    kb: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
          attack: ['KeyZ', 'ControlLeft'], dash: ['KeyX', 'Space'], special: ['KeyC', 'AltLeft'], pause: ['Escape', 'KeyP'] },
    pad: { attack: [2], dash: [5], special: [0], pause: [9] },
  };
  const copy = o => JSON.parse(JSON.stringify(o));
  const load = (k, def) => { try { const v = JSON.parse(localStorage.getItem('swordsman.' + k)); return v || def; } catch (_) { return def; } };
  const save = (k, v) => { try { localStorage.setItem('swordsman.' + k, JSON.stringify(v)); } catch (_) {} };
  const binds = (() => { const b = load('binds', null), d = copy(DEFAULT_BINDS); if (!b) return d;
    for (const dev of ['kb', 'pad']) for (const a in d[dev]) if (b[dev] && Array.isArray(b[dev][a]) && b[dev][a].length) d[dev][a] = b[dev][a];
    return d; })();
  const settings = Object.assign({ rumble: true, shake: true }, load('settings', {}));
  const kbHas = (action, code) => binds.kb[action].includes(code);
  const isGameKey = code => Object.values(binds.kb).some(list => list.includes(code));

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
      state.device = 'keyboard';
      // 키 설정 중: 누른 키를 그대로 넘긴다
      if (api.capture) { e.preventDefault(); if (!e.repeat) { const f = api.capture; api.capture = null; f('kb', e.code); } return; }
      keys.add(e.code);
      if (!e.repeat) {
        if (kbHas('attack', e.code)) queued.attack = true;
        if (kbHas('dash', e.code)) queued.dash = true;
        if (kbHas('special', e.code)) queued.special = queued.reroll = true;
        if (kbHas('pause', e.code)) queued.pause = true;
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || kbHas('attack', e.code)) queued.confirm = true;
        if (e.code === 'Escape' || e.code === 'Backspace' || kbHas('pause', e.code)) queued.back = true;
        queued.start = true;
      }
      // 게임 키가 브라우저 기능(스크롤, Alt 메뉴 등)을 건드리지 않게 막는다
      if (e.code.startsWith('Arrow') || isGameKey(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { keys.delete(e.code); if (isGameKey(e.code)) e.preventDefault(); });
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
    // 키 설정 중: 처음 누른 버튼을 넘긴다
    if (api.capture) {
      const i = edge.findIndex(Boolean);
      if (i >= 0) { const f = api.capture; api.capture = null; f('pad', i); }
      return { ax: 0, ay: 0 };
    }
    const any = list => list.some(i => edge[i]);
    if (any(binds.pad.attack)) queued.attack = true;
    if (any(binds.pad.special)) queued.special = true;
    if (any(binds.pad.dash)) queued.dash = true;
    if (any(binds.pad.pause)) queued.pause = true;
    if (edge[0] || any(binds.pad.attack)) queued.confirm = true;   // 메뉴 결정: A
    if (edge[1] || any(binds.pad.pause)) queued.back = true;       // 메뉴 뒤로: B
    if (edge[3]) queued.reroll = true;                             // 축복 다시 뽑기: Y
    if (anyButton && edge.some(Boolean)) queued.start = true;
    padHeldAttack = binds.pad.attack.some(i => down(i));
    return { ax, ay };
  }

  function update() {
    const has = c => keys.has(c);
    const held = a => binds.kb[a].some(has);
    let mx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    let my = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);

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
    state.confirm = queued.confirm; state.back = queued.back; state.reroll = queued.reroll;
    queued.tap = null;
    state.attackHeld = binds.kb.attack.some(has) || !!(buttons.attack && buttons.attack.held) || padHeldAttack;
    queued.attack = queued.special = queued.dash = queued.skill = queued.start = queued.pause = queued.confirm = queued.back = queued.reroll = false;
  }

  // 진동: 게임패드는 듀얼 럼블, 휴대폰은 vibrate (안드로이드)
  function rumble(strength, ms) {
    if (!settings.rumble) return;
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

  // 행동 하나에 새 키(버튼)를 지정한다. 다른 행동이 쓰던 키면 서로 맞바꾼다.
  function bind(dev, action, code) {
    const B = binds[dev], old = B[action][0];
    for (const a in B) if (a !== action && B[a].includes(code)) {
      B[a] = B[a].filter(c => c !== code);
      if (!B[a].length) B[a] = [old];
    }
    B[action] = [code];
    save('binds', binds);
  }
  function resetBinds(dev) { binds[dev] = copy(DEFAULT_BINDS[dev]); save('binds', binds); }
  function saveSettings() { save('settings', settings); }

  const api = { init, update, state, joy, buttons, pointers, setButton, rumble, onUi: null, onPadConnect: null,
    rot: false, physW: innerWidth, viewW: innerWidth, wheel: 0,
    binds, settings, bind, resetBinds, saveSettings, capture: null, clearKeys: () => keys.clear() };
  return api;
})();
