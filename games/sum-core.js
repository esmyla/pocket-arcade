// Sum Run: pure game logic. Level generation, a lane solver that proves every level can be
// beaten, and the run simulation. No DOM here, so the Node tests can drive all of it.

export const TRACK_W = 10;          // track width in world units
export const P_HW = .3;             // player half-width, as a fraction of a lane
export const I_HW = .38;            // number and saw half-width, as a fraction of a lane
export const DEPTH = .5;            // half-depth of the player and items along the track
export const WALL_HW = .16;
export const KEY_LAT = 15;          // sideways speed with arrow keys (and the test bot)
export const DRAG_LAT = 36;         // sideways speed cap while dragging
export const JUMP_LEN = 11, JUMP_H = 2.8;
export const BOSS_GAP = 2.4;        // the run stops this far in front of the boss
const CLEAR = 1.6;                  // track needed to clear one row before changing lanes

// Level where each mechanic first appears (with a hint banner).
export const MECHANICS = {saws: 4, doors: 5, gates: 7, split: 11, jump: 15, movers: 20};

export const UPGRADES = [
  {id: 'appetite', name: 'Big Appetite', blurb: 'Every bite counts for more.', costs: [60, 130, 220, 350, 520], label: l => l ? `+${l * 8}% per bite` : 'No bonus yet'},
  {id: 'magnet', name: 'Snack Magnet', blurb: 'Pulls nearby smaller numbers into your path.', costs: [50, 110, 190, 300, 450], label: l => ['Off', 'Short reach', 'Medium reach', 'Long reach', 'Huge reach', 'Massive reach'][l]},
  {id: 'armor', name: 'Thick Skin', blurb: 'Saws and minus gates take a smaller bite.', costs: [40, 90, 160, 260, 400], label: l => l ? `−${l * 12}% damage` : 'No armor yet'},
];
export const NO_UPGRADES = {appetite: 0, magnet: 0, armor: 0};
const appetite = up => (up.appetite || 0) * .08;
const armor = up => (up.armor || 0) * .12;
export const magnetReach = up => [0, .8, 1.2, 1.6, 2, 2.4][up.magnet || 0] || 0;

export const bite = (value, v, up) => value + v + Math.floor(v * appetite(up));
export const hurt = (v, up) => Math.max(1, Math.round(v * (1 - armor(up))));
export function gateResult(value, g, up) {
  if (g.op === '×') return value * g.v;
  if (g.op === '+') return value + g.v;
  if (g.op === '−') return value - hurt(g.v, up);
  return Math.max(1, Math.floor(value / g.v));
}
export const goodGate = g => g.op === '×' || g.op === '+';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const range = n => Array.from({length: n}, (_, i) => i);
function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const laneX = (lanes, l) => -TRACK_W / 2 + (l + .5) * TRACK_W / lanes;
export const boundaryX = (lanes, b) => -TRACK_W / 2 + b * TRACK_W / lanes;

// Round to two significant figures so generated numbers look tidy: 7, 25, 140, 650, 1800, 55000.
function niceStep(n) {
  if (n < 20) return 1;
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return n / mag >= 50 ? mag * 5 : mag;
}
export function niceFloor(n) { n = Math.max(1, n); const s = niceStep(n); return Math.max(1, Math.floor(n / s + 1e-9) * s); }
export function niceUp(n) { n = Math.max(1, n); const s = niceStep(n); return Math.ceil(n / s - 1e-9) * s; }

export function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  for (const [u, d] of [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]]) {
    if (n >= d) { const x = n / d; return (x < 100 ? Math.floor(x * 10) / 10 : Math.floor(x)) + u; }
  }
  return String(n);
}

// ---------- Solver ----------
// Items sit in lanes on rows. Every effect (eat, saw, gate) is monotone in the player's value, so
// the best value per (row, lane) dominates and a small dynamic program finds the best path.

export function buildRows(level) {
  const L = level.lanes, map = new Map();
  for (const it of level.items) {
    let row = map.get(it.z);
    if (!row) map.set(it.z, row = {z: it.z, cells: range(L).map(() => [])});
    if (it.type === 'num' && it.move) for (let l = it.move.a; l <= it.move.b; l++) row.cells[l].push({kind: 'block', v: it.v});
    else if (it.type === 'num') row.cells[it.lane].push({kind: 'num', v: it.v});
    else if (it.type === 'saw') row.cells[it.lane].push({kind: 'saw', v: it.v});
    else if (it.type === 'gate') for (let l = it.l0; l <= it.l1; l++) row.cells[l].push({kind: 'gate', op: it.op, v: it.v});
    else if (it.type === 'pad') row.cells[it.lane].push({kind: 'pad', len: it.len});
  }
  return [...map.values()].sort((a, b) => a.z - b.z);
}

function applyCell(v, e, up) {
  if (e.kind === 'num') return v >= e.v ? bite(v, e.v, up) : -1;
  if (e.kind === 'block') return v >= e.v ? v : -1;   // a moving number: only safe if you could eat it
  if (e.kind === 'saw') return v - hurt(e.v, up);
  if (e.kind === 'gate') return gateResult(v, e, up);
  return v;
}

function wallBetween(walls, l, l2, za, zb) {
  const lo = Math.min(l, l2), hi = Math.max(l, l2);
  return walls.some(w => w.b > lo && w.b <= hi && w.z0 < zb && w.z1 > za);
}

export function solve(level, up = NO_UPGRADES) {
  const rows = buildRows(level), L = level.lanes, R = rows.length, lw = TRACK_W / L;
  const arr = range(R + 1).map(() => new Array(L).fill(-1));
  const prev = range(R + 1).map(() => new Array(L).fill(-1));
  const outs = [];
  for (let l = 0; l < L; l++) arr[0][l] = level.start;
  for (let r = 0; r < R; r++) {
    const row = rows[r], out = new Array(L).fill(-1);
    for (let l = 0; l < L; l++) {
      let v = arr[r][l];
      if (v < 0) continue;
      let pad = 0;
      for (const e of row.cells[l]) {
        if (e.kind === 'pad') { pad = e.len; continue; }
        v = applyCell(v, e, up);
        if (v <= 0) break;
      }
      if (v <= 0) continue;
      out[l] = v;
      let t = r + 1;
      if (pad) { const land = row.z + pad; while (t < R && rows[t].z < land + 2 * DEPTH + .5) t++; }
      const zEnd = t < R ? rows[t].z : level.bossZ;
      const reach = Math.floor(KEY_LAT * Math.max(0, zEnd - row.z - CLEAR) / level.speed / lw + 1e-9);
      for (let l2 = Math.max(0, l - reach); l2 <= Math.min(L - 1, l + reach); l2++) {
        if (l2 !== l && wallBetween(level.walls, l, l2, row.z, zEnd)) continue;
        if (v > arr[t][l2]) { arr[t][l2] = v; prev[t][l2] = r * L + l; }
      }
    }
    outs.push(out);
  }
  const final = arr[R];
  let best = -1, bl = 0;
  for (let l = 0; l < L; l++) if (final[l] > best) { best = final[l]; bl = l; }
  const path = new Array(R).fill(-1);
  let idx = prev[R][bl];
  while (idx >= 0) { const r = Math.floor(idx / L), l = idx % L; path[r] = l; idx = prev[r][l]; }
  return {best, final, outs, rows, path};
}

// ---------- Level generation ----------

const RECIPES = {
  1: {lanes: 3, start: 1, hint: 'Drag (or use ← →) to steer. Eat numbers smaller than you!', segs: [['trail', {v: 1, count: 6, lane: 1}], ['ladder', {tiers: [1, 3], rows: 9, flip: false}]]},
  2: {lanes: 3, start: 2, segs: [['trail', {count: 5}], ['ladder', {tiers: [2, 6, 20], rows: 12, hint: 'Red numbers are bigger than you. Steer clear!'}]]},
  3: {lanes: 4, start: 2, boss: 300, segs: [['ladder', {tiers: [1, 5, 30, 150], rows: 18, flip: false, hint: 'Can you get past 300?'}]]},
  4: {lanes: 4, segs: [['trail'], ['saws', {hint: 'Saws chop you down. Dodge them!'}], ['ladder', {main: true}]]},
  5: {segs: [['ladder', {main: true}], ['doors', {hint: 'Only one door is a feast. Pick wisely!'}], ['trail']]},
  6: {segs: [['trail'], ['ladder', {main: true}], ['saws'], ['doors']]},
  7: {segs: [['ladder', {main: true}], ['gates', {hint: 'Gates do math. Pick the better one!'}], ['trail']]},
  8: {segs: [['trail'], ['gates'], ['ladder', {main: true}], ['saws'], ['gates']]},
  9: {segs: [['ladder', {main: true}], ['doors'], ['gates'], ['saws'], ['trail']]},
  10: {segs: [['trail'], ['ladder', {main: true}], ['gates'], ['doors'], ['saws'], ['ladder']]},
  11: {segs: [['ladder', {main: true}], ['split', {hint: 'Walls lock you in. Choose your side!'}], ['trail']]},
  15: {segs: [['trail'], ['ladder', {main: true}], ['jump', {hint: 'Roll over a jump pad to leap the wall!'}], ['gates']]},
  20: {segs: [['ladder', {main: true}], ['movers', {hint: 'Some numbers won’t sit still!'}], ['gates'], ['split']]},
};
const KINDS = ['trail', 'ladder', 'saws', 'doors', 'gates', 'split', 'jump', 'movers'];
const WEIGHT = {trail: 1, ladder: 1.5, saws: 1.2, doors: 1, gates: 1.2, split: 1, jump: .9, movers: 1};
const unlocked = (m, n) => !MECHANICS[m] || n >= MECHANICS[m];

function procedural(n, r) {
  const avail = KINDS.filter(m => unlocked(m, n));
  const count = Math.min(7, 3 + Math.floor(n / 8));
  const segs = [[r() < .5 ? 'trail' : 'saws'], ['ladder', {main: true}]];
  let prev = 'ladder';
  while (segs.length < count) {
    let m;
    do {
      let x = r() * avail.reduce((s, k) => s + WEIGHT[k], 0);
      m = avail.find(k => (x -= WEIGHT[k]) < 0) || avail[0];
    } while (m === prev);
    segs.push([m]);
    prev = m;
  }
  return {segs};
}

const SEGMENTS = {
  // A winding line of snacks, each a little bigger than the last.
  trail(c, o) {
    const {r, lanes: L} = c;
    let {V, lo} = c.state(), lane = o.lane ?? Math.floor(r() * L), cur = lo;
    const count = o.count ?? 7 + Math.floor(r() * 5);
    for (let k = 0; k < count; k++) {
      const v = o.v ?? niceFloor(Math.max(1, cur * (.2 + .12 * r()) * c.k));
      cur += v; V += v;
      c.row(() => {
        c.num(lane, v);
        if (!o.v && c.d > .1 && k % 2 && r() < .45 + .4 * c.d) c.num(c.pick(range(L).filter(l => l !== lane)), niceUp(V * (1.6 + 2 * r())));
      });
      c.z += c.gap;
      if (r() < .55) lane = Math.max(0, Math.min(L - 1, lane + (r() < .5 ? -1 : 1)));
    }
  },
  // The signature pattern: columns of 1 · 5 · 30 · 150. Grow in one lane until the next turns safe.
  ladder(c, o) {
    const {r, lanes: L} = c;
    let tiers = o.tiers;
    if (!tiers) {
      const {lo} = c.state();
      const T = o.main ? L : Math.max(2, Math.min(L - 1, 2 + Math.floor(r() * (L - 1))));
      const ratio = Math.max(o.main ? 2.4 : 2.2, (o.main ? 3.6 + r() * 1.4 : 2.6 + r() * 1.4) * c.k);
      tiers = [niceFloor(Math.max(1, lo * (o.main ? .35 + .3 * r() : .25 + .3 * r())))];
      for (let i = 1; i < T; i++) tiers.push(Math.max(tiers[i - 1] + 1, niceUp(tiers[i - 1] * ratio)));
    }
    const T = tiers.length;
    const rows = o.rows ?? Math.round(3 + (T - 1) * 3.4 + r() * 3);
    const flip = o.flip ?? r() < .5;
    const first = T === L ? 0 : (r() < .5 ? 0 : L - T);
    const spare = range(L).filter(l => l < first || l >= first + T);
    for (let k = 0; k < rows; k++) {
      for (let i = 0; i < T; i++) {
        const lane = first + (flip ? T - 1 - i : i);
        if (k === 0 || i === 0 || r() > .1 + .1 * c.d) c.num(lane, tiers[i]);
      }
      for (const l of spare) {
        if (c.has('saws') && r() < .3) c.saw(l, niceFloor(Math.max(1, tiers[0] * 1.5)));
        else if (r() < .35 + .3 * c.d) c.num(l, niceUp(tiers[T - 1] * 2.5));
      }
      c.z += c.gap;
    }
  },
  // A row of doors: one feast, one safe snack (or a gap), the rest bigger than you.
  doors(c, o) {
    const {r, lanes: L} = c;
    for (let k = 0; k < 2; k++) { const {lo} = c.state(); c.num(Math.floor(r() * L), niceFloor(Math.max(1, lo * .3))); c.z += c.gap; }
    c.z += c.gap * .5;
    const reps = o.reps ?? (c.d > .4 && r() < .5 ? 2 : 1);
    for (let k = 0; k < reps; k++) {
      const {V, lo} = c.state();
      c.row(() => shuffle(range(L), r).forEach((l, i) => {
        if (i === 0) c.num(l, niceFloor(V * (.7 + .25 * r())));
        else if (i === 1) { if (lo >= 4) c.num(l, niceFloor(lo * .25)); }
        else c.num(l, niceUp(V * (1.3 + 1.7 * r())));
      }));
      c.z += c.gap * 1.8;
    }
  },
  // Saws in some lanes, snacks in others, and the odd tempting bigger snack.
  saws(c, o) {
    const {r, lanes: L} = c;
    const rows = o.rows ?? 6 + Math.floor(r() * 4);
    for (let k = 0; k < rows; k++) {
      const {V, lo} = c.state();
      const nSaw = L >= 4 && r() < .4 + .3 * c.d ? 2 : 1;
      c.row(() => shuffle(range(L), r).forEach((l, i) => {
        if (i < nSaw) c.saw(l, niceFloor(Math.max(1, lo * (.2 + .2 * r()))));
        else if (i === nSaw && r() < .35) c.num(l, niceFloor(Math.max(1, V * (.35 + .25 * r()))));
        else if (r() < .7) c.num(l, niceFloor(Math.max(1, lo * (.12 + .2 * r()))));
      }));
      c.z += c.gap;
    }
  },
  // Two gates split the track. Do the math.
  gates(c) {
    const {r, lanes: L} = c;
    { const {lo} = c.state(); c.num(Math.floor(r() * L), niceFloor(Math.max(1, lo * .3))); c.z += c.gap * 1.6; }
    const {V, lo} = c.state();
    const pairs = [
      [['×', 2], ['+', niceFloor(V * (.5 + .9 * r()))]],
      [['+', niceFloor(V * (.6 + .6 * r()))], ['−', niceFloor(Math.max(1, lo * (.2 + .3 * r())))]],
      [['×', 3], ['+', niceFloor(V * (1.4 + 1.4 * r()))]],
      [['×', 2], ['÷', 2]],
    ];
    if (c.d > .3) pairs.push([['−', niceFloor(Math.max(1, lo * (.3 + .3 * r())))], ['÷', 2]], [['÷', 3], ['−', niceFloor(Math.max(1, lo * .5))]]);
    const pair = c.pick(pairs);
    if (r() < .5) pair.reverse();
    const half = Math.floor(L / 2), g = ++c.group;
    c.gate(0, half - 1, pair[0][0], pair[0][1], g);
    c.gate(half, L - 1, pair[1][0], pair[1][1], g);
    c.z += c.gap * 1.6;
  },
  // A wall splits the track: a steady side, and a risky side with saws, big snacks and a ×2 gate.
  split(c, o) {
    const {r, lanes: L} = c;
    const b = L === 3 ? 1 + Math.floor(r() * 2) : L === 5 ? 2 + Math.floor(r() * 2) : 2;
    c.z += c.gap;
    const z0 = c.z - c.gap * .5;
    const left = range(b), right = range(L).slice(b);
    const riskyLeft = r() < .5, risky = riskyLeft ? left : right, safe = riskyLeft ? right : left;
    const rows = o.rows ?? 6 + Math.floor(r() * 3);
    for (let k = 0; k < rows; k++) {
      const {V, lo} = c.state();
      c.row(() => {
        c.num(c.pick(safe), niceFloor(Math.max(1, lo * (.15 + .1 * r()))));
        if (k === rows - 1) c.gate(risky[0], risky[risky.length - 1], '×', 2, ++c.group);
        else if (k % 2 === 0) {
          const sl = c.pick(risky);
          c.saw(sl, niceFloor(Math.max(1, lo * (.25 + .15 * r()))));
          const others = risky.filter(l => l !== sl);
          if (others.length) c.num(c.pick(others), niceFloor(Math.max(1, V * (.25 + .2 * r()))));
        } else for (const l of risky) if (r() < .6) c.num(l, niceFloor(Math.max(1, lo * (.3 + .2 * r()))));
      });
      c.z += c.gap;
    }
    c.walls.push({b, z0, z1: c.z - c.gap * .5});
  },
  // A wall of huge numbers. Jump pads fly you over; sometimes a saw lane lets you squeeze through.
  jump(c) {
    const {r, lanes: L} = c;
    c.z += c.gap * 2.5;
    const pads = shuffle(range(L), r).slice(0, L >= 4 && r() < .5 ? 2 : 1);
    for (const l of pads) c.pad(l);
    const zPad = c.z, {V, lo} = c.state();
    const bypass = r() < .6 ? c.pick(range(L).filter(l => !pads.includes(l))) : -1;
    for (const dz of [3.6, 7.2]) {
      c.z = zPad + dz;
      for (let l = 0; l < L; l++) l === bypass ? c.saw(l, niceFloor(Math.max(1, lo * .3))) : c.num(l, niceUp(V * (2.2 + 2 * r())));
    }
    c.z = zPad + JUMP_LEN + 3.5;
    for (let k = 0; k < 3; k++) {
      const {V: v2} = c.state();
      for (const l of shuffle(range(L), r).slice(0, 2)) c.num(l, niceFloor(Math.max(1, v2 * (.2 + .15 * r()))));
      c.z += c.gap;
    }
  },
  // Numbers that slide across lanes. Big ones are guards; small ones are moving snacks.
  movers(c, o) {
    const {r, lanes: L} = c;
    const rows = o.rows ?? 5 + Math.floor(r() * 3);
    for (let k = 0; k < rows; k++) {
      const {V, lo} = c.state();
      const danger = k % 2 === 0 || r() < .3;
      c.row(() => {
        const span = Math.min(L - 1, 2 + (r() < .4 ? 1 : 0));
        const a = Math.floor(r() * (L - span + 1)), b = a + span - 1;
        const v = danger ? niceUp(V * (1.4 + r())) : niceFloor(Math.max(1, lo * (.3 + .2 * r())));
        c.num(a, v, {move: {a, b, freq: 1.3 + .9 * r() + .6 * c.d, phase: r() * 6.283}});
        const free = range(L).filter(l => l < a || l > b);
        if (free.length && r() < .7) c.num(c.pick(free), niceFloor(Math.max(1, lo * (.15 + .15 * r()))));
      });
      c.z += c.gap * 1.3;
    }
  },
};

function fairTail(c) {
  const s = solve({lanes: c.lanes, speed: c.speed, start: c.start, items: c.items, walls: c.walls, bossZ: c.z + 50});
  const R = s.rows.length;
  if (!R) return true;
  if (!s.outs[R - 1].some(v => v > 0)) return false;
  if (R < 2) return true;
  const prev = s.rows[R - 2], row = s.rows[R - 1], prevOut = s.outs[R - 2], lw = TRACK_W / c.lanes;
  if (prev.cells.some(cell => cell.some(e => e.kind === 'pad'))) return true;
  const reach = Math.floor(KEY_LAT * Math.max(0, row.z - prev.z - CLEAR) / c.speed / lw + 1e-9);
  for (let l = 0; l < c.lanes; l++) {
    if (prevOut[l] <= 0) continue;
    let ok = false;
    for (let l2 = Math.max(0, l - reach); l2 <= Math.min(c.lanes - 1, l + reach) && !ok; l2++) {
      if (l2 !== l && wallBetween(c.walls, l, l2, prev.z, row.z)) continue;
      let v = prevOut[l];
      for (const e of row.cells[l2]) { if (e.kind !== 'pad') v = applyCell(v, e, NO_UPGRADES); if (v <= 0) break; }
      ok = v > 0;
    }
    if (!ok) return false;
  }
  return true;
}

// A myopic player: each row, take whichever reachable lane leaves you biggest right now.
// The boss is tuned against this so early levels reward simple greed and later ones need planning.
export function greedy(level, up = NO_UPGRADES) {
  const rows = buildRows(level), L = level.lanes, lw = TRACK_W / L;
  let lane = -1, v = level.start, z = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const reach = lane < 0 ? L : Math.floor(KEY_LAT * Math.max(0, row.z - z - CLEAR) / level.speed / lw + 1e-9);
    let best = -1, bestLane = -1, pad = 0;
    for (let l2 = 0; l2 < L; l2++) {
      if (lane >= 0 && (Math.abs(l2 - lane) > reach || (l2 !== lane && wallBetween(level.walls, lane, l2, z, row.z)))) continue;
      let x = v, p = 0;
      for (const e of row.cells[l2]) { if (e.kind === 'pad') { p = e.len; continue; } x = applyCell(x, e, up); if (x <= 0) break; }
      const near = lane < 0 ? 0 : Math.abs(l2 - lane) * 1e-9;
      if (x > 0 && x - near > best) { best = x - near; bestLane = l2; pad = p; }
    }
    if (bestLane < 0) return {value: 0, dead: true};
    v = Math.round(best + Math.abs(bestLane - lane) * 1e-9); lane = bestLane; z = row.z;
    if (pad) { const land = row.z + pad; while (i + 1 < rows.length && rows[i + 1].z < land + 2 * DEPTH + .5) i++; }
  }
  return {value: v, dead: false};
}

const target = n => Math.min(9, 1.7 + .075 * n);
export function makeLevel(n) {
  let pick = null;
  for (const k of RECIPES[n] ? [1] : [.7, .85, 1, 1.15]) {
    const level = generate(n, k), miss = Math.abs(Math.log10(level.max) - target(n));
    if (!pick || miss < pick.miss) pick = {level, miss};
  }
  return pick.level;
}

function generate(n, k) {
  const r = rng(n * 7919 + 104729);
  const d = Math.min(1, (n - 1) / 45);
  const rec = RECIPES[n] || procedural(n, r);
  const lanes = rec.lanes || (n >= 24 && r() < .3 ? 5 : 4);
  const speed = Math.round((11 + 5 * d) * 100) / 100;
  const lw = TRACK_W / lanes;
  const c = {
    n, r, d, k, lanes, speed, z: 26, items: [], walls: [], hints: [], group: 0,
    gap: CLEAR + lw * speed / KEY_LAT + .5 + .8 * (1 - d),
    start: rec.start || 1 + Math.floor(r() * 3),
  };
  c.num = (lane, v, extra) => c.items.push({type: 'num', lane, z: c.z, v, ...extra});
  c.saw = (lane, v) => c.items.push({type: 'saw', lane, z: c.z, v});
  c.gate = (l0, l1, op, v, group) => c.items.push({type: 'gate', l0, l1, z: c.z, op, v, group});
  c.pad = lane => c.items.push({type: 'pad', lane, z: c.z, len: JUMP_LEN});
  c.pick = a => a[Math.floor(r() * a.length)];
  c.has = m => unlocked(m, n);
  c.state = () => {
    const s = solve({lanes, speed, start: c.start, items: c.items, walls: c.walls, bossZ: c.z + 50});
    const last = s.outs.length ? s.outs[s.outs.length - 1] : [c.start];
    const alive = last.filter(v => v > 0);
    return alive.length ? {V: Math.max(...alive), lo: Math.min(...alive)} : {V: c.start, lo: c.start};
  };
  // Place one row; reroll it (up to 8 times, then leave it empty) unless every lane that is still
  // alive can steer somewhere it survives. Keeps the track free of dead ends.
  c.row = place => {
    const mark = c.items.length;
    for (let attempt = 0; attempt < 8; attempt++) {
      place();
      if (fairTail(c)) return true;
      c.items.length = mark;
    }
    return false;
  };
  if (rec.hint) c.hints.push({z: 1, text: rec.hint});
  for (const [name, opt = {}] of rec.segs) {
    if (opt.hint) c.hints.push({z: Math.max(1, c.z - 18), text: opt.hint});
    SEGMENTS[name](c, opt);
    c.z += c.gap * 1.2;
  }
  const finishZ = c.z + 12, bossZ = finishZ + 16;
  c.items.sort((a, b) => a.z - b.z);
  c.hints.sort((a, b) => a.z - b.z);
  const level = {n, lanes, speed, start: c.start, items: c.items, walls: c.walls, hints: c.hints, finishZ, bossZ};
  const M = solve(level).best, G = greedy(level);
  const f = (.8 + .4 * d + (n % 10 === 0 ? .05 : 0)) * (1 + (r() - .5) * .06);
  const cap = M * (.72 + .2 * d);
  let boss = rec.boss && rec.boss <= M * .9 ? rec.boss : niceFloor(Math.min(cap, G.dead ? M * (.55 + .25 * d) : G.value * f));
  boss = Math.min(M, Math.max(boss, c.start + 1));
  const s2 = Math.min(M, Math.max(boss + 1, niceFloor(boss + (M - boss) * .45)));
  const s3 = Math.min(M, Math.max(s2 + 1, niceFloor(boss + (M - boss) * .85)));
  return Object.assign(level, {boss, stars: [boss, s2, s3], max: M, greedy: G.value});
}

export const starsFor = (level, value) => value >= level.stars[2] ? 3 : value >= level.stars[1] ? 2 : value >= level.boss ? 1 : 0;
export const coinsFor = (level, stars) => 10 + 8 * stars + 2 * level.n;

// ---------- Simulation ----------

export function createRun(level, up = NO_UPGRADES) {
  const L = level.lanes, lw = TRACK_W / L;
  const items = level.items.map((it, id) => {
    const o = {...it, id, done: false};
    if (it.type === 'gate') { o.x0 = boundaryX(L, it.l0); o.x1 = boundaryX(L, it.l1 + 1); o.x = (o.x0 + o.x1) / 2; }
    else o.x = laneX(L, it.lane);
    if (it.move) {
      const xa = laneX(L, it.move.a), xb = laneX(L, it.move.b);
      o.cx = (xa + xb) / 2; o.amp = (xb - xa) / 2; o.x = o.cx + o.amp * Math.sin(it.move.phase);
    }
    return o;
  });
  return {level, up, items, lw, z: 0, x: 0, y: 0, vx: 0, air: 0, airDur: 0, value: level.start, speed: 0, t: 0, result: null, events: [], hint: 0, eaten: 0, finished: false};
}

export function stepRun(s, dt, input = {}) {
  if (s.result || dt <= 0) return;
  const L = s.level, lw = s.lw, pw = P_HW * lw;
  s.t += dt;
  s.speed = Math.min(L.speed, s.speed + L.speed * 2.2 * dt);
  s.z += s.speed * dt;
  while (s.hint < L.hints.length && s.z >= L.hints[s.hint].z) s.events.push({type: 'hint', text: L.hints[s.hint++].text});
  if (!s.finished && s.z >= L.finishZ) { s.finished = true; s.events.push({type: 'finish'}); }

  const half = TRACK_W / 2 - pw;
  let nx = s.x;
  if (input.targetX != null) { const dd = input.targetX - s.x; nx += Math.sign(dd) * Math.min(Math.abs(dd), (input.lat ?? DRAG_LAT) * dt); }
  else if (input.steer) nx += input.steer * KEY_LAT * dt;
  nx = Math.max(-half, Math.min(half, nx));
  for (const w of L.walls) {
    if (s.z + DEPTH <= w.z0 || s.z - DEPTH >= w.z1) continue;
    const wx = boundaryX(L.lanes, w.b), lim = pw + WALL_HW;
    if (s.x < wx) nx = Math.min(nx, wx - lim); else nx = Math.max(nx, wx + lim);
  }
  s.vx = (nx - s.x) / dt;
  s.x = nx;

  if (s.air > 0) {
    s.air = Math.max(0, s.air - dt);
    const p = 1 - s.air / s.airDur;
    s.y = 4 * JUMP_H * p * (1 - p);
    if (!s.air) { s.y = 0; s.events.push({type: 'land'}); }
  }

  const reach = magnetReach(s.up), hit = (P_HW + I_HW) * lw;
  for (const it of s.items) {
    const dz = it.z - s.z;
    if (dz > 40) break;
    if (it.move) it.x = it.cx + it.amp * Math.sin(it.move.phase + s.t * it.move.freq);
    if (it.done) continue;
    if (dz < -2 * DEPTH) {
      it.done = true;
      if (it.type === 'num' && it.v > s.value && !s.air && Math.abs(it.x - s.x) < hit + .45 * lw) s.events.push({type: 'close', it});
      continue;
    }
    if (reach && it.type === 'num' && !it.move && it.v <= s.value && !s.air && dz < 4) {
      const dx = s.x - it.x;
      if (Math.abs(dx) > .01 && Math.abs(dx) < reach + hit && !L.walls.some(w => w.z0 < it.z && w.z1 > it.z && (boundaryX(L.lanes, w.b) - it.x) * (boundaryX(L.lanes, w.b) - s.x) < 0)) {
        it.x += Math.sign(dx) * Math.min(Math.abs(dx), 10 * dt);
      }
    }
    if (Math.abs(dz) >= 2 * DEPTH || s.air > 0) continue;
    if (it.type === 'num') {
      if (Math.abs(it.x - s.x) >= hit) continue;
      if (s.value >= it.v) {
        const before = s.value;
        s.value = bite(s.value, it.v, s.up);
        it.done = it.eaten = true;
        s.eaten++;
        s.events.push({type: 'eat', it, gain: s.value - before});
      } else {
        it.culprit = true;
        s.result = {win: false, reason: 'crash', by: it.v};
        s.events.push({type: 'crash', it});
        return;
      }
    } else if (it.type === 'saw') {
      if (Math.abs(it.x - s.x) >= hit) continue;
      const dmg = hurt(it.v, s.up);
      s.value -= dmg;
      it.done = true; it.hitT = 1;
      s.events.push({type: 'saw', it, dmg});
      if (s.value <= 0) { s.value = 0; s.result = {win: false, reason: 'zero'}; s.events.push({type: 'zeroed'}); return; }
    } else if (it.type === 'gate') {
      if (s.x < it.x0 || s.x >= it.x1) continue;
      const before = s.value;
      s.value = gateResult(s.value, it, s.up);
      for (const g of s.items) if (g.type === 'gate' && g.group === it.group) g.done = true;
      it.taken = true;
      s.events.push({type: 'gate', it, before});
      if (s.value <= 0) { s.value = 0; s.result = {win: false, reason: 'zero'}; s.events.push({type: 'zeroed'}); return; }
    } else if (it.type === 'pad') {
      if (Math.abs(it.x - s.x) >= .5 * lw) continue;
      it.done = true;
      s.air = s.airDur = it.len / L.speed;
      s.events.push({type: 'jump'});
    }
  }

  if (s.z >= L.bossZ - BOSS_GAP) {
    s.z = L.bossZ - BOSS_GAP;
    const win = s.value >= L.boss;
    s.result = win ? {win: true, stars: starsFor(L, s.value)} : {win: false, reason: 'boss'};
    s.events.push({type: 'boss', win});
  }
}

// Follows the solver's best path the way a player on arrow keys would. Used by the tests to
// prove every level can be beaten without upgrades.
export function makeBot(level, up = NO_UPGRADES) {
  const {rows, path} = solve(level, up);
  for (let i = path.length - 2; i >= 0; i--) if (path[i] < 0) path[i] = path[i + 1];
  let i = 0;
  return s => {
    while (i < rows.length && rows[i].z + 2 * DEPTH < s.z) i++;
    const lane = path[Math.min(i, path.length - 1)] ?? 0;
    return {targetX: laneX(level.lanes, Math.max(0, lane)), lat: KEY_LAT};
  };
}
