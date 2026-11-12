// Sum Run: you are a number. Eat smaller numbers, dodge bigger ones, outgrow the boss.
// Rendering, menus, progression and sound. Game rules live in sum-core.js.
import {makeLevel, makeBot, createRun, stepRun, fmt, hurt, goodGate, UPGRADES, TRACK_W, WALL_HW, BOSS_GAP, boundaryX, starsFor, coinsFor} from './sum-core.js';

const WORLDS = [
  {name: 'Paper Trail', sky: ['#f4efe4', '#e3dbc9'], ground: '#d9cfba', post: '#c7baa0', track: '#fcf7ec', track2: '#f3ecdc', skirt: '#cbbd9f', lane: '#e4d9c3', ink: '#2b2825', inkSide: '#0f0e0c', danger: '#e2553f', dangerSide: '#9b2a1b', outline: '#fffaf0', wall: ['#3b3733', '#5a554e'], ui: '#eb7055'},
  {name: 'Mint Park', sky: ['#eaf5eb', '#c8e2cf'], ground: '#b2d4ba', post: '#93bf9f', track: '#f7fbf3', track2: '#ebf3e5', skirt: '#94bba0', lane: '#d6e6d3', ink: '#1f3a32', inkSide: '#0b1a15', danger: '#e2553f', dangerSide: '#9b2a1b', outline: '#fbfff8', wall: ['#2b4a40', '#46695d'], ui: '#3f8f6b'},
  {name: 'Sunset Strip', sky: ['#ffdcbc', '#f3a490'], ground: '#e49a85', post: '#cf7f6c', track: '#fff2e7', track2: '#fbe4d4', skirt: '#d48975', lane: '#f2d4c1', ink: '#3b2235', inkSide: '#1b0d18', danger: '#d63048', dangerSide: '#86142a', outline: '#fff8f0', wall: ['#4a2a3e', '#6c4459'], ui: '#d9675a'},
  {name: 'Tide Pool', sky: ['#e2f1f7', '#acd2e2'], ground: '#8fc0d2', post: '#73a9bd', track: '#f6fbfc', track2: '#e7f2f5', skirt: '#7cadc0', lane: '#d2e5eb', ink: '#15384a', inkSide: '#061923', danger: '#e2553f', dangerSide: '#9b2a1b', outline: '#fbfeff', wall: ['#1f4a5e', '#3a6a80'], ui: '#3a7ca5'},
  {name: 'Candy Lane', sky: ['#fde7f1', '#efbfd6'], ground: '#e0a9c5', post: '#cc8fb0', track: '#fff7fb', track2: '#fcecf4', skirt: '#cf92b2', lane: '#f3d5e4', ink: '#46203c', inkSide: '#200c1b', danger: '#e2553f', dangerSide: '#9b2a1b', outline: '#fffafd', wall: ['#5a2a4e', '#7c466d'], ui: '#c95b8d'},
  {name: 'Midnight', sky: ['#30365a', '#151829'], ground: '#1d2138', post: '#2b3152', track: '#3b4266', track2: '#353c5e', skirt: '#252a47', lane: '#4b5380', ink: '#f6f1e6', inkSide: '#8d88a8', danger: '#ff6b5a', dangerSide: '#a3322a', outline: '#1c1f36', wall: ['#11142a', '#262b4d'], ui: '#ffb36b', dark: true},
];
const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export function worldOf(n) {
  const w = Math.floor((n - 1) / 10), base = WORLDS[w % WORLDS.length], lap = Math.floor(w / WORLDS.length);
  return {...base, index: w, title: base.name + (lap ? ' ' + (ROMAN[lap] || '+') : '')};
}

const SKINS = [
  {id: 'classic', name: 'Classic', cost: 0, face: '#ffffff', side: '#eb7055', line: '#eb7055', trail: null},
  {id: 'tomato', name: 'Tomato', cost: 120, face: '#ff7a5c', side: '#a8321d', line: '#fff6ee', trail: 'dots'},
  {id: 'mint', name: 'Mint', cost: 160, face: '#86e0b9', side: '#2a7e5b', line: '#ffffff', trail: 'dots'},
  {id: 'berry', name: 'Blueberry', cost: 220, face: '#8fc4ff', side: '#2f58a6', line: '#ffffff', trail: 'bubbles'},
  {id: 'ghost', name: 'Ghost', cost: 320, face: 'rgba(255,255,255,.72)', side: 'rgba(150,140,205,.75)', line: 'rgba(255,255,255,.9)', trail: 'wisp'},
  {id: 'gold', name: 'Gold', cost: 380, face: '#ffd45c', side: '#a06a0c', line: '#fff6d8', trail: 'sparkle'},
  {id: 'lava', name: 'Lava', cost: 480, face: '#ffa040', side: '#b8301a', line: '#ffe6a8', trail: 'fire'},
  {id: 'rainbow', name: 'Rainbow', cost: 750, face: 'rainbow', side: '#5b3fa8', line: '#ffffff', trail: 'rainbow'},
];

const FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Trebuchet MS", system-ui, sans-serif';
const BACK = 15, FAR = 105;
const TIPS = [
  'Red numbers are bigger than you. Dark ones are lunch.',
  'Climb lane by lane: eat small ones until the next lane turns dark.',
  '× gates multiply everything you have. They pay most when you’re already big.',
  'A saw takes the same bite however big you are. Get big first, then take the hit.',
  'Upgrades are forever. A bigger appetite makes every bite count.',
  'Walls lock your lane. Read both sides before you commit.',
  'The progress bar shows how close the boss is. The chip turns green when you can win.',
];

// Number sprites: extruded, outlined text rendered once and cached, then scaled into the scene.
const glyphs = new Map();
function glyph(text, face, side, line) {
  const key = text + '|' + face + '|' + side + '|' + line;
  let g = glyphs.get(key);
  if (g) return g;
  if (glyphs.size > 500) glyphs.clear();
  const fs = 110, depth = 13, lw = 10, pad = 8;
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  c.font = `900 ${fs}px ${FONT}`;
  const m = c.measureText(text);
  const left = m.actualBoundingBoxLeft || 0, right = m.actualBoundingBoxRight || m.width;
  const asc = Math.ceil(m.actualBoundingBoxAscent || fs * .74), desc = Math.ceil(Math.max(0, m.actualBoundingBoxDescent || 0));
  cv.width = Math.ceil(left + right) + 2 * pad + lw;
  cv.height = asc + desc + depth + 2 * pad + lw;
  c.font = `900 ${fs}px ${FONT}`;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  const x = pad + lw / 2 + left, y = pad + lw / 2 + asc;
  if (line) {
    c.strokeStyle = line;
    c.lineWidth = lw;
    for (let k = depth; k >= 0; k -= 3) c.strokeText(text, x, y + k);
  }
  c.fillStyle = side;
  for (let k = depth; k > 0; k -= 1.5) c.fillText(text, x, y + k);
  if (face === 'rainbow') {
    const gr = c.createLinearGradient(0, pad, cv.width, cv.height);
    ['#ff6b6b', '#ffb347', '#ffe66d', '#7bd389', '#5ec8ff', '#a78bfa'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
    c.fillStyle = gr;
  } else c.fillStyle = face;
  c.fillText(text, x, y);
  g = {cv, w: cv.width, h: cv.height, base: y + depth + Math.min(desc, 3), vis: asc + depth};
  glyphs.set(key, g);
  return g;
}

export function startSum(root, {read, save}) {
  const data = loadSave();
  root.innerHTML = `<div class="sum-wrap"><canvas class="sum-canvas" role="img" aria-label="Sum Run. Drag or use the arrow keys to steer your number."></canvas>
    <div class="sum-hud" hidden><span class="sum-lv"></span><div class="sum-bar"><i></i></div><span class="sum-boss"></span></div>
    <div class="sum-hint" aria-live="polite"></div><div class="sum-sheet"></div></div>`;
  const wrap = root.firstElementChild, canvas = wrap.querySelector('canvas'), ctx = canvas.getContext('2d');
  const hud = wrap.querySelector('.sum-hud'), lvEl = hud.querySelector('.sum-lv'), barEl = hud.querySelector('.sum-bar i'), bossEl = hud.querySelector('.sum-boss');
  const hintEl = wrap.querySelector('.sum-hint'), sheet = wrap.querySelector('.sum-sheet');

  let W = 1, H = 1, dpr = 1, blend = 0;
  const cam = {x: 0, z: -BACK, f: 1, hy: 0, h: 1, cx: 0};
  let n, level, run, th, lw, skin = SKINS.find(s => s.id === data.skin) || SKINS[0];
  let mode = 'menu', paused = false, raf = 0, last = performance.now(), t = 0, fdt = 0;
  let shake = 0, flash = 0, flashColor = '#fff', hitStop = 0, timeScale = 1, endTimer = 0;
  let pop = 0, streak = 0, lastEat = -9, closeCool = 0, bossReady = false, playerGone = false, bossGone = false, bossHit = 0, dispValue = 1, trailT = 0, tipIndex = 0;
  let parts = [], pops = [], confetti = [];
  const keys = {l: false, r: false};
  let targetX = null, drag = null, primary = null, hintTimer = 0;
  const timers = [];
  const clouds = Array.from({length: 8}, () => ({x: Math.random(), y: .12 + Math.random() * .7, w: .08 + Math.random() * .14, s: .004 + Math.random() * .01}));

  function loadSave() {
    const d = read('sumSave', {}) || {};
    return {level: Math.max(1, d.level | 0 || 1), stars: d.stars || {}, coins: d.coins | 0, up: {appetite: 0, magnet: 0, armor: 0, ...(d.up || {})}, skin: d.skin || 'classic', owned: d.owned || ['classic'], plays: d.plays | 0};
  }
  const persist = () => save('sumSave', data);

  // ---------- Sound ----------
  let ac = null, noiseBuf = null;
  function audio() {
    if (read('muted', false)) return null;
    try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch { return null; }
  }
  function tone(freq, dur, type = 'triangle', vol = .06, slide = 1, delay = 0) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + .03);
  }
  function noise(dur, vol = .08, freq = 1200, q = 1, delay = 0) {
    const a = audio();
    if (!a) return;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * .5), a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f).connect(g).connect(a.destination);
    s.start(t0);
    s.stop(t0 + dur + .02);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const sfx = {
    eat(k, big) { const f = 392 * 2 ** (SCALE[Math.min(k, 10)] / 12); tone(f, .09, 'triangle', .06); if (big) { tone(f * 1.5, .16, 'sine', .045, 1, .03); noise(.06, .04, 3200); } },
    saw() { noise(.22, .12, 2600, 3); tone(180, .2, 'sawtooth', .035, .5); },
    gate(good) { if (good) { tone(520, .22, 'sine', .07, 2); tone(780, .2, 'triangle', .04, 2, .05); } else tone(520, .26, 'sine', .07, .45); },
    jump() { tone(260, .3, 'triangle', .07, 3); noise(.15, .04, 900); },
    land() { noise(.08, .05, 300); },
    close() { tone(1250, .05, 'sine', .03); },
    ready() { tone(660, .12, 'triangle', .06); tone(990, .2, 'triangle', .06, 1, .1); },
    crash() { noise(.35, .18, 260, .8); tone(140, .35, 'square', .05, .4); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, 'triangle', .07, 1, i * .08)); noise(.5, .05, 2000, .5); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, .25, 'triangle', .06, 1, i * .13)); },
    star(i) { tone(880 * 2 ** (i * 4 / 12), .3, 'sine', .07); tone(1760 * 2 ** (i * 4 / 12), .2, 'sine', .03, 1, .02); },
    buy() { tone(880, .08, 'square', .03); tone(1320, .14, 'triangle', .05, 1, .06); },
    start() { tone(392, .1, 'triangle', .05); tone(587, .14, 'triangle', .05, 1, .08); },
  };

  // ---------- Level and run state ----------
  function loadLevel(k) {
    n = k;
    level = makeLevel(n);
    th = worldOf(n);
    lw = TRACK_W / level.lanes;
    wrap.style.background = th.sky[1];
    resetRun();
  }
  function resetRun() {
    run = createRun(level, data.up);
    bot = null;
    parts = []; pops = []; confetti = [];
    shake = flash = hitStop = endTimer = pop = bossHit = 0;
    timeScale = 1; streak = 0; lastEat = -9;
    bossReady = run.value >= level.boss;
    playerGone = bossGone = false;
    dispValue = run.value;
    targetX = null; drag = null;
    cam.z = run.z - BACK; cam.x = 0;
  }
  function startRun() {
    if (mode === 'run') return;
    if (run.t > 0 || run.result) resetRun();
    mode = 'run';
    sheet.innerHTML = '';
    sheet.className = 'sum-sheet';
    hud.hidden = false;
    lvEl.textContent = 'Level ' + n;
    primary = null;
    data.plays++;
    sfx.start();
  }
  const retry = () => { mode = 'ready'; startRun(); };
  const nextLevel = () => { loadLevel(n + 1); mode = 'ready'; startRun(); };

  // ---------- Camera ----------
  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    aim();
  }
  function aim() {
    // In menus the player sits high so the card doesn't cover it; in a run it drops low to show the road ahead.
    const e = blend * blend * (3 - 2 * blend);
    cam.f = Math.min(W * 1.2, H * .95);
    cam.hy = H * (.1 + .07 * e);
    cam.h = (H * (.4 + .35 * e) - cam.hy) * BACK / cam.f;
    cam.cx = W / 2;
  }
  function P(x, y, z) {
    const d = z - cam.z;
    if (d < .6) return null;
    const s = cam.f / d;
    return {x: cam.cx + (x - cam.x) * s, y: cam.hy + (cam.h - y) * s, s};
  }
  const fade = d => d > FAR - 25 ? Math.max(0, (FAR - d) / 25) : 1;

  // ---------- Input ----------
  // ?bot in the page URL hands the controls to the solver's autopilot (for testing and demos).
  const autopilot = /[?&]bot\b/.test(location.search);
  let bot = null;
  function steerInput() {
    if (autopilot) return (bot ??= makeBot(level, data.up))(run);
    const steer = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    if (steer) { targetX = null; return {steer}; }
    return {targetX};
  }
  function onDown(e) {
    if (paused) return;
    audio();
    if (mode === 'menu') startRun();
    if (mode !== 'run') return;
    drag = {id: e.pointerId, x0: e.clientX, base: run.x};
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id || mode !== 'run') return;
    targetX = Math.max(-TRACK_W / 2, Math.min(TRACK_W / 2, drag.base + (e.clientX - drag.x0) * TRACK_W * 1.15 / W));
  }
  const onUp = e => { if (drag && e.pointerId === drag.id) drag = null; };
  function onKey(e, down) {
    if (paused) return;
    const k = e.key;
    const left = k === 'ArrowLeft' || k === 'a' || k === 'A', right = k === 'ArrowRight' || k === 'd' || k === 'D';
    if (left || right) {
      if (left) keys.l = down; else keys.r = down;
      e.preventDefault();
      if (down && mode === 'menu') startRun();
    } else if (down && (k === ' ' || k === 'Enter')) {
      if (e.target?.closest?.('button')) return;
      e.preventDefault();
      if (primary && !e.repeat) primary();
    } else if (down && k === 'Escape' && (mode === 'levels' || mode === 'shop')) showMenu();
  }
  const keydown = e => onKey(e, true), keyup = e => onKey(e, false);

  // ---------- Effects ----------
  function playerScreen(lift = 2.3) { const p = P(run.x, run.y + lift, run.z); return p ? {x: p.x, y: p.y} : {x: W / 2, y: H * .6}; }
  function addPop(text, at, color, size = 22) { pops.push({text, x: at.x, y: at.y, color, size, life: 1}); }
  function shards(x, y, z, colors, count, power = 1, vz = run.speed) {
    for (let i = 0; i < count; i++) parts.push({
      x, y, z, vx: (Math.random() - .5) * 7 * power, vy: 3 + Math.random() * 6 * power, vz: vz + (Math.random() - .2) * 4 * power,
      life: .45 + Math.random() * .35, max: .8, color: colors[i % colors.length], size: .1 + Math.random() * .16 * power, shape: 'rect', rot: Math.random() * 6, spin: (Math.random() - .5) * 18, bounce: true, g: 24,
    });
  }
  function dust(count = 8) {
    for (let i = 0; i < count; i++) parts.push({x: run.x + (Math.random() - .5) * lw * .6, y: .05, z: run.z, vx: (Math.random() - .5) * 3, vy: .6 + Math.random(), vz: run.speed * .5, life: .45, max: .45, color: th.dark ? '#7f86b5' : '#bfb39b', size: .25, shape: 'dot', g: 2, alpha: .6});
  }
  function spawnTrail() {
    const base = {x: run.x + (Math.random() - .5) * lw * .35, y: run.y + .15 + Math.random() * .4, z: run.z - .2, vx: 0, vy: 0, vz: 0, g: 0, life: .55, max: .55, size: .2, shape: 'dot', shrink: true};
    const kind = skin.trail;
    if (kind === 'dots') parts.push({...base, color: skin.face});
    else if (kind === 'bubbles') parts.push({...base, shape: 'ring', color: skin.face, vy: 1.4, size: .18 + Math.random() * .15, shrink: false, life: .7, max: .7});
    else if (kind === 'sparkle') parts.push({...base, shape: 'star', color: Math.random() < .5 ? '#ffe27a' : '#fff6cf', y: run.y + .3 + Math.random() * 1.2, size: .22, vy: .4});
    else if (kind === 'wisp') parts.push({...base, color: '#ffffff', size: .45, alpha: .35, vy: .3, life: .8, max: .8});
    else if (kind === 'fire') parts.push({...base, color: ['#ffd25a', '#ff8a3d', '#e2462b'][Math.floor(Math.random() * 3)], vy: 1.6, size: .26});
    else if (kind === 'rainbow') parts.push({...base, color: `hsl(${(t * 260) % 360} 90% 65%)`, size: .26});
  }
  function burstConfetti() {
    const cols = ['#eb7055', '#f2b632', '#3f8f6b', '#5ea0ef', '#c95b8d', '#ffffff'];
    for (let i = 0; i < 110; i++) confetti.push({x: W / 2 + (Math.random() - .5) * W * .5, y: H * .38, vx: (Math.random() - .5) * 700, vy: -250 - Math.random() * 520, rot: Math.random() * 6, spin: (Math.random() - .5) * 14, color: cols[i % cols.length], life: 2.6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4});
  }
  function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('show'), 4200);
  }

  function handleEvents() {
    for (const e of run.events) {
      const at = playerScreen();
      if (e.type === 'eat') {
        streak = t - lastEat < .9 ? streak + 1 : 0;
        lastEat = t;
        pop = 1;
        const big = e.gain >= run.value * .25;
        shards(e.it.x, .7, e.it.z, [th.ink, th.inkSide, th.track2], big ? 14 : 7, big ? 1.3 : 1);
        addPop('+' + fmt(e.gain), at, th.dark ? '#7be0ae' : '#2f8f62', big ? 30 : 22);
        sfx.eat(streak, big);
        if (big) shake = Math.max(shake, .22);
        if (streak && streak % 10 === 0) addPop(`Yum ×${streak}!`, {x: at.x, y: at.y - 42}, th.ui, 26);
      } else if (e.type === 'saw') {
        shards(run.x, .8, run.z, ['#ffd25a', '#ffffff', '#cfd5dc'], 12, 1.1);
        addPop('−' + fmt(e.dmg), at, '#d2452f', 28);
        shake = .55; flash = .3; flashColor = '#e2553f';
        sfx.saw();
      } else if (e.type === 'gate') {
        const good = run.value >= e.before;
        addPop(e.it.op + fmt(e.it.v), at, good ? '#2f6fd6' : '#d2452f', 34);
        flash = .35; flashColor = good ? '#6fb0ff' : '#ff8a70';
        e.it.flashT = 1;
        sfx.gate(good);
      } else if (e.type === 'jump') { sfx.jump(); dust(10); }
      else if (e.type === 'land') { sfx.land(); dust(12); shake = Math.max(shake, .15); }
      else if (e.type === 'close') {
        if (closeCool <= 0) { addPop('Close!', {x: at.x, y: at.y - 34}, '#c48a12', 18); sfx.close(); closeCool = .9; }
      } else if (e.type === 'hint') showHint(e.text);
      else if (e.type === 'crash' || e.type === 'zeroed') die();
      else if (e.type === 'boss') e.win ? winBoss() : loseBoss();
    }
    run.events.length = 0;
  }
  function die() {
    hitStop = .14; shake = 1; flash = .55; flashColor = '#e2553f';
    playerGone = true;
    shards(run.x, .9, run.z, [skin.side, skin.face === 'rainbow' ? '#ffb347' : skin.face], 26, 1.4, 0);
    sfx.crash();
    navigator.vibrate?.(40);
    mode = 'end'; endTimer = 1.1;
  }
  function winBoss() {
    bossGone = true; pop = 1; shake = .7; flash = .6; flashColor = '#ffffff';
    shards(0, 2.5, level.bossZ, [th.ink, th.inkSide, '#f2b632'], 60, 2.2, 0);
    burstConfetti();
    sfx.win();
    mode = 'end'; endTimer = 1.6;
  }
  function loseBoss() {
    playerGone = true; bossHit = 1; shake = .9; flash = .45; flashColor = '#e2553f';
    shards(run.x, .9, run.z, [skin.side, skin.face === 'rainbow' ? '#ffb347' : skin.face], 26, 1.4, -4);
    sfx.lose();
    mode = 'end'; endTimer = 1.3;
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    closeCool -= dt;
    if (mode === 'run') {
      if (hitStop > 0) hitStop -= dt;
      else {
        const want = run.z > level.finishZ - 2 ? .45 : 1;
        timeScale += (want - timeScale) * Math.min(1, dt * 5);
        let left = dt * timeScale;
        while (left > 1e-6 && !run.result) { const h = Math.min(left, 1 / 90); stepRun(run, h, steerInput()); left -= h; }
        handleEvents();
        const ready = run.value >= level.boss;
        if (ready && !bossReady && !run.result) { addPop('Big enough for the boss!', {x: W / 2, y: H * .3}, th.dark ? '#7be0ae' : '#2f8f62', 20); sfx.ready(); }
        bossReady = ready;
        if (skin.trail && !playerGone && (trailT -= dt) <= 0) { trailT = .035; spawnTrail(); }
      }
    } else if (mode === 'end') {
      if (hitStop > 0) hitStop -= dt;
      if ((endTimer -= dt) <= 0) { mode = 'result'; showResult(); }
    }
    const wantBlend = mode === 'menu' || mode === 'levels' || mode === 'shop' ? 0 : 1;
    blend += (wantBlend - blend) * Math.min(1, dt * 3.2);
    aim();
    cam.z = run.z - BACK;
    cam.x += (run.x * .3 - cam.x) * Math.min(1, dt * 6);
    dispValue += (run.value - dispValue) * Math.min(1, dt * 7);
    pop = Math.max(0, pop - dt * 4);
    shake = Math.max(0, shake - dt * 2.2);
    flash = Math.max(0, flash - dt * 2.2);
    bossHit = Math.max(0, bossHit - dt * .7);
    for (const p of parts) {
      p.life -= dt;
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.bounce && p.y < 0) { p.y = 0; p.vy *= -.35; p.vx *= .6; p.vz *= .6; }
      if (p.spin) p.rot += p.spin * dt;
    }
    parts = parts.filter(p => p.life > 0);
    for (const p of pops) { p.life -= dt * .9; p.y -= 46 * dt; }
    pops = pops.filter(p => p.life > 0);
    for (const c of confetti) { c.life -= dt; c.vy += 900 * dt; c.vx *= 1 - dt * 1.2; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.spin * dt; }
    confetti = confetti.filter(c => c.life > 0 && c.y < H + 30);
    if (!hud.hidden) {
      const w = (Math.max(0, Math.min(1, run.z / (level.bossZ - BOSS_GAP))) * 100).toFixed(1) + '%';
      if (barEl.style.width !== w) barEl.style.width = w;
      const ready = run.value >= level.boss, txt = 'BOSS ' + fmt(level.boss) + (ready ? ' ✓' : '');
      if (bossEl.textContent !== txt) { bossEl.textContent = txt; bossEl.classList.toggle('ready', ready); }
    }
  }

  // ---------- Drawing ----------
  function poly(pts, fill) {
    for (const p of pts) if (!p) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
  function ellipse(x, y, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fit a sprite to a world height, squeezing it sideways (then shrinking) to stay within maxW.
  function fit(g, hWorld, s, maxW) {
    let ky = hWorld * s / g.vis, kx = ky;
    if (maxW && g.w * kx > maxW * s) {
      kx = maxW * s / g.w;
      if (kx < ky * .64) ky = kx / .64;
    }
    return {kx, ky, w: g.w * kx, h: g.vis * ky};
  }
  function blit(g, f, x, y, alpha = 1, sx = 1, sy = 1) {
    ctx.globalAlpha = alpha;
    const dw = g.w * f.kx * sx, dh = g.h * f.ky * sy;
    ctx.drawImage(g.cv, x - dw / 2, y - g.base * f.ky * sy, dw, dh);
    ctx.globalAlpha = 1;
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, cam.hy + 2);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, cam.hy + 32);
    ctx.fillStyle = th.ground;
    ctx.fillRect(-30, cam.hy, W + 60, H - cam.hy + 30);
    for (const c of clouds) {
      const x = (((c.x + t * c.s) % 1.2) - .1) * W, y = c.y * cam.hy;
      if (th.dark) { ctx.globalAlpha = .4 + .4 * Math.sin(t * 2 + c.x * 20); ellipse(x, y, 1.3, 1.3, '#fff8e0'); ctx.globalAlpha = 1; }
      else { ctx.globalAlpha = .5; ellipse(x, y, c.w * W, c.w * W * .26, '#ffffff'); ctx.globalAlpha = 1; }
    }
  }
  function drawTrack() {
    const zn = cam.z + 1.2, zf = cam.z + FAR, hw = TRACK_W / 2;
    poly([P(-hw, 0, zn), P(-hw, 0, zf), P(-hw, -1.4, zf), P(-hw, -1.4, zn)], th.skirt);
    poly([P(hw, 0, zn), P(hw, 0, zf), P(hw, -1.4, zf), P(hw, -1.4, zn)], th.skirt);
    poly([P(-hw, 0, zn), P(hw, 0, zn), P(hw, 0, zf), P(-hw, 0, zf)], th.track);
    const S = 7;
    for (let z = Math.floor(zn / S) * S; z < zf; z += S) {
      if (Math.floor(z / S) % 2) continue;
      const a = Math.max(z, zn), b = Math.min(z + S, zf);
      if (b > a) poly([P(-hw, 0, a), P(hw, 0, a), P(hw, 0, b), P(-hw, 0, b)], th.track2);
    }
    for (let b = 1; b < level.lanes; b++) {
      const x = boundaryX(level.lanes, b);
      for (let z = Math.floor(zn / 5) * 5; z < zf; z += 5) {
        const a = Math.max(z, zn), e = Math.min(z + 2.2, zf);
        if (e > a) poly([P(x - .05, 0, a), P(x + .05, 0, a), P(x + .05, 0, e), P(x - .05, 0, e)], th.lane);
      }
    }
    // Boss arena carpet and checkered finish line.
    const ca = Math.max(level.finishZ, zn), cb = Math.min(level.bossZ + 6, zf);
    if (cb > ca) { ctx.globalAlpha = .16; poly([P(-hw, 0, ca), P(hw, 0, ca), P(hw, 0, cb), P(-hw, 0, cb)], th.ui); ctx.globalAlpha = 1; }
    if (level.finishZ > zn && level.finishZ < zf) {
      const cols = 10, cw = TRACK_W / cols;
      for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
        if ((i + j) % 2) continue;
        const x0 = -hw + i * cw, z0 = level.finishZ + j * .8;
        poly([P(x0, .01, z0), P(x0 + cw, .01, z0), P(x0 + cw, .01, z0 + .8), P(x0, .01, z0 + .8)], th.ink);
      }
    }
    for (let z = Math.ceil((cam.z + 3) / 9) * 9; z < zf; z += 9) {
      for (const side of [-1, 1]) {
        const x = side * (hw + 1.9), a = P(x - .4, 0, z), b = P(x + .4, 1.3, z);
        if (!a || !b) continue;
        ctx.globalAlpha = fade(z - cam.z);
        ctx.fillStyle = th.post;
        ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
        ctx.globalAlpha = 1;
      }
    }
    const fog = ctx.createLinearGradient(0, cam.hy, 0, cam.hy + (H - cam.hy) * .22);
    fog.addColorStop(0, th.sky[1]); fog.addColorStop(1, th.sky[1] + '00');
    ctx.fillStyle = fog;
    ctx.fillRect(-30, cam.hy - 1, W + 60, (H - cam.hy) * .22 + 1);
  }
  function drawWalls() {
    for (const w of level.walls) {
      const z0 = Math.max(w.z0, cam.z + 1.3), z1 = Math.min(w.z1, cam.z + FAR);
      if (z1 <= z0) continue;
      const x = boundaryX(level.lanes, w.b), t2 = WALL_HW, hh = 1.15, side = x > cam.x ? x - t2 : x + t2;
      poly([P(side, 0, z0), P(side, 0, z1), P(side, hh, z1), P(side, hh, z0)], th.wall[0]);
      poly([P(x - t2, hh, z0), P(x + t2, hh, z0), P(x + t2, hh, z1), P(x - t2, hh, z1)], th.wall[1]);
      if (w.z0 >= cam.z + 1.3) poly([P(x - t2, 0, z0), P(x + t2, 0, z0), P(x + t2, hh, z0), P(x - t2, hh, z0)], th.wall[1]);
    }
  }
  function drawNum(it, alpha) {
    const p = P(it.x, 0, it.z);
    if (!p) return;
    const ed = it.v <= run.value;
    if (it.ed !== undefined && it.ed !== ed && mode === 'run') it.flip = 1;
    it.ed = ed;
    if (it.flip > 0) it.flip = Math.max(0, it.flip - fdt * 2.6);
    const g = glyph(fmt(it.v), ed ? th.ink : th.danger, ed ? th.inkSide : th.dangerSide, th.outline);
    const h = 1.55 * Math.min(1.9, Math.max(.5, Math.pow(it.v / Math.max(1, dispValue), .28)));
    const f = fit(g, h, p.s, lw * .94);
    const hop = it.flip ? Math.sin(it.flip * Math.PI) * .55 * p.s : 0;
    const throb = !ed && it.culprit ? 1 + Math.sin(t * 20) * .06 : 1;
    ctx.globalAlpha = alpha;
    ellipse(p.x, p.y, f.w * .44, f.w * .085, 'rgba(0,0,0,.13)');
    blit(g, f, p.x, p.y - hop, alpha, throb, throb);
  }
  function drawSaw(it, alpha) {
    const p = P(it.x, 0, it.z);
    if (!p) return;
    const R = lw * .36 * p.s, cy = p.y - R * .5;
    ctx.globalAlpha = alpha;
    ellipse(p.x, p.y, R * 1.08, R * .2, 'rgba(0,0,0,.28)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x - R * 1.4, cy - R * 1.4, R * 2.8, p.y - (cy - R * 1.4));
    ctx.clip();
    ctx.translate(p.x, cy);
    ctx.rotate(t * 9 + it.id);
    ctx.beginPath();
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rr = i % 2 ? R : R * .8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = it.hitT ? '#e8b2a8' : '#d3d9e0';
    ctx.fill();
    ctx.lineWidth = Math.max(1, R * .06);
    ctx.strokeStyle = '#7d8794';
    ctx.stroke();
    ellipse(0, 0, R * .55, R * .55, '#eef1f4');
    ellipse(0, 0, R * .2, R * .2, th.danger);
    ctx.restore();
    const lab = glyph('−' + fmt(hurt(it.v, data.up)), th.danger, th.dangerSide, th.outline);
    blit(lab, fit(lab, .78, p.s, lw * .92), p.x, cy - R * 1.08, alpha);
    ctx.globalAlpha = 1;
  }
  function drawGate(it, alpha) {
    const a = P(it.x0 + .12, 0, it.z), b = P(it.x1 - .12, 0, it.z);
    if (!a || !b) return;
    const hh = 2.4 * a.s, good = goodGate(it), dim = it.done && !it.taken ? .28 : 1;
    ctx.globalAlpha = alpha * dim;
    ctx.fillStyle = good ? 'rgba(77,150,255,.26)' : 'rgba(240,90,70,.26)';
    ctx.fillRect(a.x, a.y - hh, b.x - a.x, hh);
    const pw = Math.max(2, .17 * a.s);
    ctx.fillStyle = good ? '#3b7be0' : '#d9483a';
    ctx.fillRect(a.x - pw / 2, a.y - hh, pw, hh);
    ctx.fillRect(b.x - pw / 2, b.y - hh, pw, hh);
    ctx.fillRect(a.x - pw / 2, a.y - hh - pw / 2, b.x - a.x + pw, pw);
    if (it.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${it.flashT * .7})`;
      ctx.fillRect(a.x, a.y - hh, b.x - a.x, hh);
      it.flashT = Math.max(0, it.flashT - fdt * 2.5);
    }
    const g = glyph(it.op + fmt(it.v), '#ffffff', good ? '#2756a8' : '#9b2a1b', good ? '#3b7be0' : '#d9483a');
    blit(g, fit(g, 1.3, a.s, (it.x1 - it.x0) * .78), (a.x + b.x) / 2, a.y - hh * .26, alpha * dim);
    ctx.globalAlpha = 1;
  }
  function drawPad(it, alpha) {
    const x0 = it.x - lw * .36, x1 = it.x + lw * .36, z0 = it.z - .9, z1 = it.z + .9, hh = .22;
    ctx.globalAlpha = alpha;
    poly([P(x0, 0, z0), P(x1, 0, z0), P(x1, hh, z0), P(x0, hh, z0)], '#1f2124');
    poly([P(x0, hh, z0), P(x1, hh, z0), P(x1, hh, z1), P(x0, hh, z1)], it.done ? '#4a4e54' : '#2f3236');
    ctx.strokeStyle = it.done ? '#9aa1a8' : '#ffffff';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const zc of [it.z - .4, it.z + .3]) {
      const l = P(x0 + .3, hh, zc - .25), m = P(it.x, hh, zc + .22), r = P(x1 - .3, hh, zc - .25);
      if (!l || !m || !r) continue;
      ctx.lineWidth = Math.max(1.5, .15 * m.s);
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(m.x, m.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawCrown(x, y, w) {
    const h = w * .55;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h);
    ctx.lineTo(x - w / 4, y - h * .45);
    ctx.lineTo(x, y - h * 1.05);
    ctx.lineTo(x + w / 4, y - h * .45);
    ctx.lineTo(x + w / 2, y - h);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fillStyle = '#f2b632';
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * .05);
    ctx.strokeStyle = '#a8750f';
    ctx.stroke();
    for (const [dx, dy] of [[-.5, -1], [0, -1.05], [.5, -1]]) ellipse(x + dx * w, y + dy * h, w * .07, w * .07, '#fff1c2');
  }
  function drawBoss() {
    const p = P(0, 0, level.bossZ);
    if (!p) return;
    const alpha = fade(level.bossZ - cam.z);
    ctx.globalAlpha = alpha;
    ellipse(p.x, p.y, 4.6 * p.s, .75 * p.s, 'rgba(0,0,0,.14)');
    ctx.globalAlpha = 1;
    if (bossGone) return;
    const ready = run.value >= level.boss;
    const g = glyph(fmt(level.boss), ready ? th.ink : th.danger, ready ? th.inkSide : th.dangerSide, th.outline);
    const breathe = 1 + Math.sin(t * 2.6) * .03, laugh = bossHit ? Math.sin(t * 28) * bossHit * .12 : 0;
    const tremble = ready && mode === 'run' ? Math.sin(t * 45) * .06 * p.s : 0;
    const f = fit(g, 4.3 * breathe, p.s, TRACK_W * .92);
    blit(g, f, p.x + tremble, p.y, alpha, 1 - laugh * .5, 1 + laugh);
    ctx.globalAlpha = alpha;
    drawCrown(p.x + tremble, p.y - f.h * (1 + laugh) - .15 * p.s, 1.7 * p.s);
    ctx.globalAlpha = 1;
  }
  function drawPlayer() {
    if (playerGone) return;
    const p = P(run.x, 0, run.z);
    if (!p) return;
    const idle = mode === 'menu' || mode === 'levels' || mode === 'shop';
    const bob = mode === 'run' && !run.air ? Math.abs(Math.sin(t * 13)) * .13 : idle ? Math.abs(Math.sin(t * 3.2)) * .16 : 0;
    const shadow = 1 / (1 + run.y * .45);
    ellipse(p.x, p.y, lw * .4 * p.s * shadow, lw * .08 * p.s * shadow, 'rgba(0,0,0,.2)');
    ctx.strokeStyle = th.ui;
    ctx.globalAlpha = .75;
    ctx.lineWidth = Math.max(1.5, .09 * p.s);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, lw * .5 * p.s * shadow, lw * .12 * p.s * shadow, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const g = glyph(fmt(run.value), skin.face, skin.side, skin.line);
    const f = fit(g, 1.75, p.s, lw * 1.35);
    ctx.save();
    ctx.translate(p.x, p.y - (run.y + bob) * p.s);
    ctx.rotate(Math.max(-.22, Math.min(.22, run.vx * .007)));
    blit(g, f, 0, 0, 1, 1 + pop * .28, 1 - pop * .16);
    ctx.restore();
  }
  function drawScene() {
    const items = run.items, zMin = cam.z + 1.5, zMax = cam.z + FAR;
    if (level.bossZ < zMax) drawBoss();
    let playerDrawn = false;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.z > zMax) continue;
      if (it.z < zMin) break;
      if (!playerDrawn && it.z < run.z) { drawPlayer(); playerDrawn = true; }
      const alpha = fade(it.z - cam.z);
      if (it.type === 'num') { if (!it.eaten) drawNum(it, alpha); }
      else if (it.type === 'saw') drawSaw(it, alpha);
      else if (it.type === 'gate') drawGate(it, alpha);
      else if (it.type === 'pad') drawPad(it, alpha);
    }
    if (!playerDrawn) drawPlayer();
  }
  function drawParts() {
    for (const q of parts) {
      const p = P(q.x, q.y, q.z);
      if (!p) continue;
      const sz = q.size * p.s * (q.shrink ? Math.max(.1, q.life / q.max) : 1);
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6) * (q.alpha ?? 1);
      ctx.fillStyle = q.color;
      if (q.shape === 'rect') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot); ctx.fillRect(-sz / 2, -sz * .35, sz, sz * .7); ctx.restore();
      } else if (q.shape === 'ring') {
        ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, sz * .25);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.stroke();
      } else if (q.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 3, r = i % 2 ? sz * .35 : sz; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawOverlay() {
    for (const p of pops) {
      const grow = Math.min(1, (1 - p.life) * 8), size = p.size * (.6 + .4 * grow);
      ctx.globalAlpha = Math.min(1, p.life * 2.2);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size * .2);
      ctx.strokeStyle = th.dark ? '#151829' : '#ffffff';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    for (const c of confetti) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.fillStyle = c.color; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (flash > 0) { ctx.globalAlpha = Math.min(.5, flash * .6); ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sx = shake && !reduce ? (Math.random() - .5) * shake * 16 : 0, sy = shake && !reduce ? (Math.random() - .5) * shake * 12 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawSky();
    drawTrack();
    drawWalls();
    drawScene();
    drawParts();
    ctx.restore();
    drawOverlay();
  }

  function frame(now) {
    fdt = Math.min(.05, (now - last) / 1000 || 0);
    last = now;
    if (!paused) update(fdt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ---------- Screens ----------
  const coin = v => `<span class="sum-coin">${v}</span>`;
  const starRow = (k, big) => `<div class="sum-stars${big ? ' big' : ''}">${[1, 2, 3].map(i => `<i class="${i <= k ? 'on' : ''}" style="animation-delay:${(.2 + i * .22).toFixed(2)}s">★</i>`).join('')}</div>`;
  const cheapest = () => Math.min(...UPGRADES.map(u => u.costs[data.up[u.id] || 0] ?? Infinity));
  function bind() {
    sheet.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b.dataset));
  }
  function act(a, ds) {
    audio();
    if (a === 'play') startRun();
    else if (a === 'next') nextLevel();
    else if (a === 'retry') retry();
    else if (a === 'menu') showMenu();
    else if (a === 'levels') showLevels();
    else if (a === 'shop') showShop('up');
    else if (a === 'skins') showShop('skins');
    else if (a === 'pick') { loadLevel(+ds.n); showMenu(); }
    else if (a === 'buy') {
      const u = UPGRADES.find(x => x.id === ds.id), l = data.up[u.id] || 0, cost = u.costs[l];
      if (cost != null && data.coins >= cost) { data.coins -= cost; data.up[u.id] = l + 1; persist(); sfx.buy(); }
      showShop('up');
    } else if (a === 'skin') {
      const s = SKINS.find(x => x.id === ds.id);
      if (!data.owned.includes(s.id) && data.coins >= s.cost) { data.coins -= s.cost; data.owned.push(s.id); sfx.buy(); }
      if (data.owned.includes(s.id)) { data.skin = s.id; skin = s; }
      persist();
      showShop('skins');
    }
  }
  function showMenu() {
    mode = 'menu';
    hud.hidden = true;
    hintEl.classList.remove('show');
    resetRun();
    const best = data.stars[n] || 0, first = n === 1 && !best;
    sheet.className = 'sum-sheet';
    sheet.innerHTML = `<div class="sum-card">
      <div class="sum-meta"><span>WORLD ${th.index + 1} · ${th.title.toUpperCase()}</span>${coin(data.coins)}</div>
      <h2>Level ${n}</h2>
      <p>${first ? 'You’re a number. Eat numbers <b>smaller</b> than you, dodge the <b class="sum-red">bigger</b> ones, and grow big enough to beat the boss.' : `Beat the boss: <b>${fmt(level.boss)}</b>`}</p>
      ${first ? '' : `${starRow(best)}<p class="sum-small">★ ${fmt(level.stars[0])} · ★★ ${fmt(level.stars[1])} · ★★★ ${fmt(level.stars[2])}</p>`}
      <button class="pill-button sum-go" data-act="play">Play ▶</button>
      <div class="sum-links"><button data-act="levels">Levels</button><button data-act="shop">Upgrades${data.coins >= cheapest() ? ' •' : ''}</button><button data-act="skins">Skins</button></div>
      <p class="sum-small">Tap the track, press Space, or hit ← →</p>
    </div>`;
    bind();
    primary = startRun;
  }
  function showResult() {
    hud.hidden = true;
    hintEl.classList.remove('show');
    const r = run.result;
    sheet.className = 'sum-sheet';
    if (r.win) {
      const stars = starsFor(level, run.value), prev = data.stars[n] || 0;
      const bonus = stars === 3 && prev < 3 ? 20 : 0, coins = coinsFor(level, stars) + bonus;
      data.stars[n] = Math.max(prev, stars);
      data.coins += coins;
      if (n >= data.level) data.level = n + 1;
      persist();
      const lines = ['A hungry little number. Nicely done.', 'Big number energy.', 'The boss never stood a chance.'];
      sheet.innerHTML = `<div class="sum-card">
        <div class="sum-meta"><span>LEVEL ${n} CLEARED</span>${coin(data.coins)}</div>
        ${starRow(stars, true)}
        <h2>${fmt(run.value)} <small>beats</small> ${fmt(level.boss)}</h2>
        <p>${lines[stars - 1]} <b class="sum-earn">+${coins}</b>${bonus ? ' incl. 3-star bonus' : ''}</p>
        ${stars < 3 ? `<p class="sum-small">Next star at ${fmt(level.stars[stars])}</p>` : ''}
        <button class="pill-button sum-go" data-act="next">Next level →</button>
        <div class="sum-links"><button data-act="retry">Replay</button><button data-act="shop">Upgrades${data.coins >= cheapest() ? ' •' : ''}</button><button data-act="menu">Menu</button></div>
      </div>`;
      for (let i = 0; i < stars; i++) timers.push(setTimeout(() => sfx.star(i), 420 + i * 220));
      primary = nextLevel;
    } else {
      const title = r.reason === 'crash' ? `Crushed by ${fmt(r.by)}.` : r.reason === 'zero' ? 'Chopped to zero.' : `${fmt(level.boss)} was too big.`;
      const detail = r.reason === 'crash' ? `You were ${fmt(run.value)}. Red means bigger than you.`
        : r.reason === 'zero' ? 'Saws and minus gates bite. Grow first, or go around.'
        : run.value >= level.boss * .85 ? `You reached ${fmt(run.value)}. Just ${fmt(level.boss - run.value)} short. So close!` : `You reached ${fmt(run.value)}. The boss needs ${fmt(level.boss)}.`;
      const tip = TIPS[tipIndex++ % TIPS.length];
      sheet.innerHTML = `<div class="sum-card">
        <div class="sum-meta"><span>LEVEL ${n}</span>${coin(data.coins)}</div>
        <h2>${title}</h2>
        <p>${detail}</p>
        <p class="sum-tip">${tip}</p>
        <button class="pill-button sum-go" data-act="retry">Try again ↺</button>
        <div class="sum-links"><button data-act="shop">Upgrades${data.coins >= cheapest() ? ' •' : ''}</button><button data-act="levels">Levels</button><button data-act="menu">Menu</button></div>
      </div>`;
      primary = retry;
    }
    bind();
  }
  const LOCK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z" fill="currentColor"/></svg>';
  function showLevels() {
    mode = 'levels';
    hud.hidden = true;
    const worlds = Math.max(6, Math.ceil(data.level / 10));
    let html = `<div class="sum-panel"><div class="sum-panel-top"><button class="sum-back" data-act="menu" aria-label="Back">←</button><h3>Levels</h3>${coin(data.coins)}</div>`;
    for (let w = 0; w < worlds; w++) {
      const wt = worldOf(w * 10 + 1);
      let earned = 0;
      for (let i = 1; i <= 10; i++) earned += data.stars[w * 10 + i] || 0;
      html += `<div class="sum-world" data-world="${w}"><b style="background:${wt.ui}"></b>${wt.title.toUpperCase()}<span>${earned}/30 ★</span></div><div class="sum-levels">`;
      for (let i = 1; i <= 10; i++) {
        const k = w * 10 + i, locked = k > data.level, s = data.stars[k] || 0;
        html += `<button class="sum-lvl${locked ? ' locked' : ''}${k === n ? ' current' : ''}" data-act="pick" data-n="${k}"${locked ? ' disabled aria-label="Locked"' : ''}>${locked ? LOCK : k}<small>${locked ? '' : '★'.repeat(s) + '<em>' + '★'.repeat(3 - s) + '</em>'}</small></button>`;
      }
      html += '</div>';
    }
    sheet.className = 'sum-sheet full';
    sheet.innerHTML = html + '</div>';
    bind();
    sheet.querySelector(`[data-world="${Math.floor((n - 1) / 10)}"]`)?.scrollIntoView({block: 'center'});
    primary = null;
  }
  function showShop(tab) {
    mode = 'shop';
    hud.hidden = true;
    const skins = tab === 'skins';
    let html = `<div class="sum-panel"><div class="sum-panel-top"><button class="sum-back" data-act="menu" aria-label="Back">←</button><h3>${skins ? 'Skins' : 'Upgrades'}</h3>${coin(data.coins)}</div>
      <div class="sum-tabs"><button data-act="shop" class="${skins ? '' : 'on'}">Upgrades</button><button data-act="skins" class="${skins ? 'on' : ''}">Skins</button></div>`;
    if (!skins) {
      html += UPGRADES.map(u => {
        const l = data.up[u.id] || 0, max = l >= u.costs.length, cost = u.costs[l];
        return `<div class="sum-up"><div><h4>${u.name}</h4><p>${u.blurb}</p><p class="sum-up-now">${u.label(l)}${max ? '' : ` → <b>${u.label(l + 1)}</b>`}</p>
          <div class="sum-pips">${u.costs.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
          <button class="sum-buy" data-act="buy" data-id="${u.id}"${max || data.coins < cost ? ' disabled' : ''}>${max ? 'Maxed' : coin(cost)}</button></div>`;
      }).join('') + '<p class="sum-small">Clear levels to earn coins. More stars, more coins. Replays pay too.</p>';
    } else {
      html += '<div class="sum-skins">' + SKINS.map(s => {
        const owned = data.owned.includes(s.id), on = data.skin === s.id;
        return `<div class="sum-skin${on ? ' equipped' : ''}"><canvas data-skin="${s.id}" width="240" height="132"></canvas><b>${s.name}</b>
          <button class="sum-buy" data-act="skin" data-id="${s.id}"${on || (!owned && data.coins < s.cost) ? ' disabled' : ''}>${on ? 'Equipped' : owned ? 'Equip' : coin(s.cost)}</button></div>`;
      }).join('') + '</div>';
    }
    sheet.className = 'sum-sheet full';
    sheet.innerHTML = html + '</div>';
    bind();
    if (skins) sheet.querySelectorAll('canvas[data-skin]').forEach(cv => {
      const s = SKINS.find(x => x.id === cv.dataset.skin), c = cv.getContext('2d');
      c.fillStyle = th.track; c.fillRect(0, 0, cv.width, cv.height);
      const g = glyph('7', s.face, s.side, s.line), k = 96 / g.vis;
      c.drawImage(g.cv, cv.width / 2 - g.w * k / 2, 112 - g.base * k, g.w * k, g.h * k);
    });
    primary = null;
  }

  // ---------- Lifecycle ----------
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('resize', resize);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(wrap);
  if (autopilot || /[?&]debug\b/.test(location.search)) window.sumDebug = () => ({run, level, mode, blend, data});
  resize();
  loadLevel(Math.min(data.level, 9999));
  showMenu();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
      timers.forEach(clearTimeout);
      clearTimeout(hintTimer);
      persist();
      try { ac?.close(); } catch {}
    },
    pause(v) {
      paused = v;
      keys.l = keys.r = false;
      drag = null;
      wrap.querySelector('.pause-sheet')?.remove();
      if (v) { const p = document.createElement('div'); p.className = 'pause-sheet'; p.textContent = 'Take a breather.'; wrap.append(p); }
    },
  };
}
