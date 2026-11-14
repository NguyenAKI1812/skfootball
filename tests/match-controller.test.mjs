import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, matchSnapshot, MATCH_STEP, TACTICS } from '../src/utils/matchEngine.js';
import { acceptMatchPacket } from '../src/utils/matchPresentation.js';

const source = readFileSync(new URL('../src/components/HeadToHeadMatch.jsx', import.meta.url), 'utf8');
const controller = source.slice(0, source.lastIndexOf('  return ('))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default function HeadToHeadMatch', 'function HeadToHeadMatch') + `
return {frame, ready, tactics, toggleReady, chooseTactic, setSpeed, waiting, engine: engineRef.current};
}\nHeadToHeadMatch;`;

function mount(options = {}) {
  const hooks = [];
  const timers = new Map();
  let hookIndex = 0, timerId = 0, now = 0, changed = false, state;
  let effects = [];
  const schedule = (fn, delay, repeat = false) => {
    const id = ++timerId; timers.set(id, { fn, delay, due: now + delay, repeat }); return id;
  };
  const messages = [];
  const context = vm.createContext({
    createMatch, stepMatch, matchSnapshot, MATCH_STEP, TACTICS, acceptMatchPacket,
    performance: { now: () => now },
    useState: initial => {
      const i = hookIndex++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => {
        const next = typeof value === 'function' ? value(hooks[i]) : value;
        if (!Object.is(next, hooks[i])) { hooks[i] = next; changed = true; }
      }];
    },
    useRef: initial => { const i = hookIndex++; return hooks[i] ||= { current: initial }; },
    useEffect: (fn, deps) => {
      const i = hookIndex++;
      if (!hooks[i] || deps.some((d, j) => !Object.is(d, hooks[i].deps[j]))) {
        const previous = hooks[i];
        hooks[i] = { deps, cleanup: null };
        effects.push(() => { previous?.cleanup?.(); hooks[i].cleanup = fn(); });
      }
    },
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    sounds: { playTick() {}, playWhistle() {}, playFanfare() {}, playGavel() {} },
    calcSquadStats: squad => ({ avgOvr: 85, chemistry: 80, players: Object.values(squad) }),
  });
  const Component = vm.runInContext(controller, context);
  const manager = id => ({ id, name: id, squad: { gk: { id: `${id}-gk`, position: 'GK', ovr: 85 }, st: { id: `${id}-st`, position: 'FW', ovr: 85 } } });
  const props = { player1: manager('p1'), player2: manager('p2'), onlineState: {}, onSendMatchMessage: msg => messages.push(msg), ...options };
  const render = () => {
    let remaining = 20;
    do {
      changed = false; hookIndex = 0; effects = [];
      state = Component(props);
      effects.forEach(fn => fn());
      assert.ok(remaining-- > 0, 'render loop');
    } while (changed);
    return state;
  };
  const advance = ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.due;
      if (timer.repeat) timer.due += timer.delay; else timers.delete(id);
      timer.fn(); render();
    }
    now = end;
    return state;
  };
  render();
  return { get state() { return state; }, render, advance, timers, messages, receive: msg => { props.matchRemoteMsg = msg; render(); }, disconnect: () => { props.onlineState = { isConnected: false, role: null }; render(); },
    unmount: () => hooks.forEach(h => h?.cleanup?.()) };
}

test('local match advances at 2x and cleans up its timer', () => {
  const h=mount(); h.state.toggleReady(1);h.render();h.state.toggleReady(2);h.render();
  h.advance(4000);assert.ok(h.state.engine);const before=h.state.engine.time;
  h.state.setSpeed(2);h.render();h.advance(1000);
  assert.ok(h.state.engine.time-before>1.9);h.unmount();assert.equal(h.timers.size,0);
});
test('guest never simulates, rejects old packets and requests missed snapshots', () => {
  const host=mount({onlineState:{role:'host',isConnected:true}});
  host.state.toggleReady(1);host.render();host.receive({type:'MATCH_LIVE_READY',team:2,ready:true,tactic:'wide'});
  const guest=mount({onlineState:{role:'guest',isConnected:true}});
  guest.advance(1100);assert.ok(guest.messages.some(m=>m.type==='MATCH_LIVE_REQUEST'));
  const first=host.messages.find(m=>m.type==='MATCH_LIVE_STATE');guest.receive(first);
  assert.equal(guest.state.engine,null);assert.equal(guest.state.frame.sequence,first.state.sequence);
  host.advance(5000);const last=host.messages.at(-1);guest.receive(last);guest.receive({...first});
  assert.equal(guest.state.frame.sequence,last.state.sequence);
  assert.deepEqual(guest.state.frame.score,last.state.score);
  guest.advance(3000);assert.equal(guest.state.waiting,true);
  host.disconnect();const time=host.state.engine.time;host.advance(1000);
  assert.equal(host.state.engine.time,time);assert.equal(host.state.waiting,true);
  host.unmount();guest.unmount();assert.equal(host.timers.size+guest.timers.size,0);
});
test('duplicate ready packets do not restart a running match', () => {
  const h=mount({onlineState:{role:'host',isConnected:true}});
  h.state.toggleReady(1);h.render();h.receive({type:'MATCH_LIVE_READY',team:2,ready:true,tactic:'attack'});
  h.advance(5000);const engine=h.state.engine;
  h.receive({type:'MATCH_LIVE_READY',team:2,ready:true,tactic:'attack'});h.advance(200);
  assert.equal(h.state.engine,engine);h.unmount();
});
