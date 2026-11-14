import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Run the actual animation loop with a controlled RAF clock, without a browser or network.
const source = readFileSync(new URL('../src/components/MatchPitch2D.jsx', import.meta.url), 'utf8');
const simulation = source.slice(0, source.indexOf('  const statusText ='))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default function MatchPitch2D', 'function MatchPitch2D') +
  '\nreturn { sim: simRef.current, props: latestPropsRef };\n}\nMatchPitch2D;';
const slots = ['gk', 'lb', 'lcb', 'rcb', 'rb', 'cm1', 'cm2', 'cam', 'lw', 'st', 'rw'];
function squad(prefix) {
  return Object.fromEntries(slots.map(slot => [slot, { id: `${prefix}-${slot}`, name: `${prefix} ${slot}`, ovr: 85 }]));
}
function setup(extra = {}) {
  let nextFrame;
  let now = 0;
  let frame;
  const effects = [];
  const context = vm.createContext({
    useMemo: fn => fn(), useRef: value => ({ current: value }),
    useState: value => [value, next => { frame = next; }], useEffect: fn => effects.push(fn),
    performance: { now: () => now }, requestAnimationFrame: fn => { nextFrame = fn; return 1; },
    cancelAnimationFrame: () => {},
  });
  const component = vm.runInContext(simulation, context);
  const leftSquad = squad('a');
  const rightSquad = squad('b');
  const impacts = [];
  const completed = [];
  const result = component({ leftSquad, rightSquad,
    onHighlightImpact: e => impacts.push(e), onHighlightComplete: e => completed.push(e),
    onPenaltyImpact: e => impacts.push(e), onPenaltyComplete: e => completed.push(e), ...extra });
  effects.forEach(fn => fn());
  const step = (ms = 1000 / 60) => {
    now += ms;
    const before = Object.values(result.sim.players).map(p => [p.key, p.x, p.y]);
    const ballBefore = { ...result.sim.ball };
    nextFrame(now);
    const dt = Math.min(ms, 50) / 1000 * (result.props.current.simSpeed === 2 ? 2 : 1);
    for (const [key, x, y] of before) {
      const p = result.sim.players[key];
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${key} finite position`);
      assert.ok(Math.hypot(p.x - x, p.y - y) <= 9 * dt + 0.001, `${key} teleported at ${now}ms`);
    }
    assert.ok(Math.hypot(result.sim.ball.x - ballBefore.x, result.sim.ball.y - ballBefore.y) <= 34 * dt + 0.001,
      `ball teleported at ${now}ms, phase ${result.sim.highlightState?.phase || result.sim.openPlay.phase}`);
    return frame;
  };
  const untilComplete = (limit = 90000) => {
    while (!completed.length && now < limit) step();
    assert.equal(completed.length, 1, `stuck in ${result.sim.highlightState?.phase || result.sim.penState.phase} after ${now}ms`);
    assert.equal(impacts.length, 1);
  };
  return { ...result, step, untilComplete, impacts, completed, leftSquad, rightSquad };
}

for (const guest of [false, true]) {
  for (const type of ['GOAL', 'SAVE', 'PENALTY_SAVED', 'WOODWORK', 'DEFENSE', 'CARD', 'RED_CARD', 'THROW_IN']) {
    test(`${type} finishes without jumps (${guest ? 'guest' : 'host'} view)`, () => {
      const h = setup({ leftTeamNum: guest ? 2 : 1, rightTeamNum: guest ? 1 : 2 });
      for (let i = 0; i < 300; i++) h.step();
      const eventSquad = guest ? h.rightSquad : h.leftSquad;
      const player = eventSquad[['SAVE', 'PENALTY_SAVED'].includes(type) ? 'gk' : ['CARD', 'RED_CARD', 'DEFENSE'].includes(type) ? 'lcb' : 'st'];
      const ev = { type, team: 1, min: 10, player, assistPlayer: eventSquad.cam };
      h.props.current.activeHighlight = ev;
      h.untilComplete();
      assert.equal(h.impacts[0], ev);
      if (type === 'GOAL') {
        assert.ok(Math.hypot(h.sim.ball.x - 50, h.sim.ball.y - 50) < 0.1);
        const expectedSide = guest ? 'left' : 'right';
        assert.equal(h.sim.players[h.sim.carrierKey].side, expectedSide);
      }
      h.props.current.activeHighlight = null;
      for (let i = 0; i < 180; i++) h.step();
    });
  }
}

test('in-match penalty goal waits for contact and returns to kickoff', () => {
  const h = setup();
  h.props.current.activeHighlight = { type: 'GOAL', isPenalty: true, team: 1, min: 8, player: h.leftSquad.st };
  h.untilComplete();
});

test('shootout uses the nominated shooter and waits for each shot to arrive', () => {
  const h = setup({ matchPhase: 'penalty' });
  const kick = { round: 1, team: 2, shooter: h.rightSquad.lw, scored: true };
  h.props.current.penaltyKick = kick;
  h.step();
  assert.equal(h.sim.carrierKey, 'right-lw');
  assert.equal(h.impacts.length, 0);
  h.untilComplete();
});

test('continuous play at 1x and 2x stays bounded', () => {
  for (const simSpeed of [1, 2]) {
    const h = setup({ simSpeed });
    for (let i = 0; i < 3600; i++) h.step();
  }
});

for (const fps of [30, 144]) {
  test(`movement stays bounded and completes at ${fps} FPS, 2x`, () => {
    const h = setup({ simSpeed: 2 });
    const ev = { type: 'GOAL', team: 1, min: 10, player: h.leftSquad.st, assistPlayer: h.leftSquad.cam };
    h.props.current.activeHighlight = ev;
    for (let i = 0; i < fps * 45 && !h.completed.length; i++) {
      h.step(1000 / fps);
      if (!h.impacts.length) assert.equal(Object.values(h.sim.players).some(p => p.isCelebrating), false);
    }
    assert.equal(h.completed.length, 1);
    assert.equal(h.impacts.length, 1);
  });
}

test('a saved shootout shot completes before the next nominated shooter starts', () => {
  const h = setup({ matchPhase: 'penalty' });
  const miss = { round: 1, team: 1, shooter: h.leftSquad.cm1, scored: false };
  h.props.current.penaltyKick = miss;
  h.untilComplete();
  assert.equal(h.impacts[0], miss);
  const next = { round: 1, team: 2, shooter: h.rightSquad.rb, scored: true };
  h.props.current.penaltyKick = next;
  for (let i = 0; i < 1800 && h.completed.length < 2; i++) h.step();
  assert.equal(h.completed.length, 2);
  assert.equal(h.impacts[1], next);
});

test('a sequence of highlights, halftime and a rebound save can return to open play', () => {
  const h = setup();
  const types = ['RED_CARD', 'SAVE', 'GOAL', 'SAVE', 'WOODWORK', 'THROW_IN', 'DEFENSE'];
  for (const [index, type] of types.entries()) {
    const before = h.completed.length;
    const player = h.leftSquad[type === 'RED_CARD' || type === 'DEFENSE' ? 'lcb' : type === 'SAVE' ? 'gk' : 'st'];
    const ev = { type, team: 1, min: 10 + index * 10, player, assistPlayer: h.leftSquad.cam };
    h.props.current.activeHighlight = ev;
    for (let i = 0; i < 3600 && h.completed.length === before; i++) h.step();
    assert.equal(h.completed.length, before + 1, `${type} stuck in ${h.sim.highlightState?.phase}`);
    h.props.current.activeHighlight = null;
    if (index === 3) {
      h.props.current.isHalfTime = true;
      h.props.current.currentMinute = 45;
      for (let i = 0; i < 180; i++) h.step();
      h.props.current.isHalfTime = false;
      h.props.current.currentMinute = 46;
      h.step();
      assert.equal(h.sim.players[h.sim.carrierKey].side, 'right');
    }
    for (let i = 0; i < 180; i++) h.step();
  }
});
