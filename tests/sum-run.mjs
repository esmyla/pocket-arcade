import assert from 'node:assert/strict';
import {makeLevel, solve, createRun, stepRun, makeBot, starsFor, fmt, niceFloor, niceUp, NO_UPGRADES} from '../app/games/sum-core.js';

assert.equal(fmt(9999), '9999');
assert.equal(fmt(12345), '12.3K');
assert.equal(fmt(1500000), '1.5M');
assert.equal(niceFloor(137), 130);
assert.equal(niceUp(137), 140);
assert.equal(niceFloor(640), 600);

const LEVELS = Number(process.env.SUM_LEVELS || 80), verbose = process.env.SUM_VERBOSE;
const table = [];
for (let n = 1; n <= LEVELS; n++) {
  const level = makeLevel(n);
  assert.deepEqual(makeLevel(n).items, level.items, `level ${n} is deterministic`);
  assert.ok(level.boss <= level.max && level.boss > level.start, `level ${n}: boss ${level.boss} must sit between start ${level.start} and max ${level.max}`);
  assert.ok(level.stars[0] <= level.stars[1] && level.stars[1] <= level.stars[2] && level.stars[2] <= level.max, `level ${n}: star thresholds in order`);

  // The solver's best path, driven through the real simulation with arrow-key steering.
  const run = createRun(level, NO_UPGRADES), bot = makeBot(level);
  let steps = 0;
  while (!run.result && steps++ < 60 * 600) { stepRun(run, 1 / 60, bot(run)); run.events.length = 0; }
  assert.ok(run.result?.win, `level ${n}: bot must beat boss ${level.boss} (solver max ${level.max}) but got ${run.value} (${run.result?.reason} ${run.result?.by ?? ''})`);

  // A player who never steers must not win by accident (except the first tutorial levels).
  const idle = createRun(level, NO_UPGRADES);
  steps = 0;
  while (!idle.result && steps++ < 60 * 600) { stepRun(idle, 1 / 60, {}); idle.events.length = 0; }
  if (n > 2) assert.ok(!idle.result.win, `level ${n}: standing still should not beat the boss`);

  const items = level.items.length, secs = level.bossZ / level.speed;
  table.push({n, lanes: level.lanes, start: level.start, boss: fmt(level.boss), max: fmt(level.max), greedy: fmt(level.greedy), 'g/boss': +(level.greedy / level.boss).toFixed(2), bot: fmt(run.value), stars: starsFor(level, run.value), secs: Math.round(secs)});
}
if (verbose) console.table(table);
const avg = table.reduce((s, r) => s + r.secs, 0) / table.length;
console.log(`Sum Run: ${LEVELS} levels generated deterministically and beaten by the solver bot (avg ${Math.round(avg)}s each); idle runs lose from level 3 on.`);
