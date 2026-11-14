// Pure, fixed-step match simulation. Only the room host advances this state online.
export const MATCH_STEP = 1 / 60;
export const TACTICS = {
  balanced: { label: 'Cân bằng', description: 'Giữ cự ly, phối hợp và lên bóng khi có khoảng trống.', push: 0, press: 1, tempo: 1, width: 1 },
  attack: { label: 'Tấn công', description: 'Dâng cao, áp sát nhanh; để lại nhiều khoảng trống phía sau.', push: 7, press: 1.25, tempo: 0.8, width: 1.05 },
  counter: { label: 'Phản công', description: 'Giữ khối thấp, chuyền nhanh lên phía trước sau khi đoạt bóng.', push: -5, press: 0.8, tempo: 0.75, width: 0.9 },
  wide: { label: 'Đánh biên', description: 'Kéo giãn đội hình, đưa bóng ra cánh rồi chuyền vào trong.', push: 2, press: 1, tempo: 1, width: 1.22 },
};
const FORMATION = [
  ['gk', 6, 50], ['lb', 24, 16], ['lcb', 21, 38], ['rcb', 21, 62], ['rb', 24, 84],
  ['cm1', 39, 32], ['cm2', 39, 68], ['cam', 48, 50], ['lw', 57, 18], ['st', 62, 50], ['rw', 57, 82],
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.64);
const direction = team => team === 1 ? 1 : -1;
const ownX = (team, x) => team === 1 ? x : 100 - x;
const skill = (p, key) => clamp(Number(p?.stats?.[key] ?? p?.ovr ?? 75), 35, 99);
const publicPlayer = p => p ? { id: p.id, name: p.name, ovr: p.ovr, photo: p.photo, subPos: p.slot.toUpperCase() } : null;

function random(s) {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function emit(s, type, team, player, text, extra = {}) {
  const event = { id: ++s.eventId, type, team, min: Math.min(90, Math.floor(s.clock / s.duration * 90)), player: publicPlayer(player), text, ...extra };
  s.events.unshift(event);
  s.events.length = Math.min(s.events.length, 60);
  s.notice = event;
  s.noticeUntil = s.time + (type === 'GOAL' ? 4 : 2.5);
  return event;
}
function nearest(s, team, point, exclude, outfield = false) {
  return s.players.filter(p => p.team === team && p.key !== exclude && (!outfield || p.slot !== 'gk'))
    .sort((a, b) => distance(a, point) - distance(b, point))[0];
}
function setCarrier(s, p, received = false) {
  s.carrier = p.key;
  s.possession = p.team;
  s.flight = null;
  s.decisionIn = p.slot === 'gk' ? 0.85 : 0.45 + random(s) * 0.55;
  s.tackleCooldown = 1.4;
  if (!received) s.assist = null;
}
function move(p, tx, ty, dt, speed) {
  const dx = tx - p.x, dy = (ty - p.y) * 0.64;
  const dist = Math.hypot(dx, dy);
  const desired = Math.min(speed, dist * 3);
  const vx = dist > 0.001 ? dx / dist * desired : 0;
  const vy = dist > 0.001 ? dy / dist * desired : 0;
  const change = Math.hypot(vx - (p.vx || 0), vy - (p.vy || 0));
  const blend = change > 0 ? Math.min(1, dt * 20 / change) : 1;
  p.vx = (p.vx || 0) + (vx - (p.vx || 0)) * blend;
  p.vy = (p.vy || 0) + (vy - (p.vy || 0)) * blend;
  p.x = clamp(p.x + p.vx * dt, 2, 98);
  p.y = clamp(p.y + p.vy * dt / 0.64, 5, 95);
}
function moveBall(s, target, speed, dt) {
  const d = distance(s.ball, target);
  const amount = Math.min(1, speed * dt / Math.max(d, 0.00001));
  s.ball.x += (target.x - s.ball.x) * amount;
  s.ball.y += (target.y - s.ball.y) * amount;
  return d <= speed * dt + 0.001;
}
function kickoffTargets(s) {
  const taker = s.players.find(p => p.team === s.kickoffTeam && p.slot === 'st');
  for (const p of s.players) {
    p.tx = ownX(p.team, p.slot === 'gk' ? 6 : Math.min(44, p.homeX * 0.72));
    p.ty = p.homeY;
    if (p === taker) { p.tx = 50 - direction(p.team) * 0.8; p.ty = 50; }
  }
  return taker;
}
function restart(s, team, kind = 'kickoff') {
  s.phase = kind;
  s.phaseTime = 0;
  s.kickoffTeam = team;
  s.carrier = null;
  s.flight = null;
  s.assist = null;
  kickoffTargets(s);
}
export function createMatch({ player1, player2, tactics = {}, seed = 1, duration = 150 }) {
  const players = [];
  [player1, player2].forEach((manager, i) => {
    const team = i + 1;
    for (const [baseSlot, x, y] of FORMATION) {
      const slot = baseSlot === 'cam' && manager.squad?.cdm && !manager.squad?.cam ? 'cdm' : baseSlot;
      const data = manager.squad?.[slot] || {};
      const homeX = slot === 'cdm' ? 32 : x;
      players.push({ key: `${team}-${slot}`, team, slot, id: data.id || `${team}-${slot}`, name: data.name || slot.toUpperCase(),
        photo: data.photo || null, ovr: data.ovr || 75, stats: data.stats || {}, homeX, homeY: team === 1 ? y : 100 - y,
        x: ownX(team, Math.min(homeX, 44)), y: team === 1 ? y : 100 - y, vx: 0, vy: 0,
        tx: ownX(team, homeX), ty: y, rating: 0 });
    }
  });
  const chemistry = manager => {
    const squad = Object.values(manager.squad || {}).filter(Boolean);
    let value = 50;
    for (const key of ['club', 'nation']) {
      const counts = {};
      for (const p of squad) if (p[key]) counts[p[key]] = (counts[p[key]] || 0) + 1;
      value += Object.values(counts).reduce((n, count) => n + Math.max(0, count - 1) * (key === 'club' ? 10 : 8), 0);
    }
    return Math.min(100, value);
  };
  const s = { version: 1, tick: 0, rng: seed >>> 0, duration: Math.max(30, duration), time: 0, clock: 0, half: 1,
    phase: 'kickoff', phaseTime: 0, kickoffTeam: 1, players, ball: { x: 50, y: 50 }, carrier: null, flight: null,
    possession: 1, score: { 1: 0, 2: 0 }, stats: { 1: { shots: 0, saves: 0, tackles: 0, passes: 0, possession: 0 }, 2: { shots: 0, saves: 0, tackles: 0, passes: 0, possession: 0 } },
    tactics: { 1: TACTICS[tactics[1]] ? tactics[1] : 'balanced', 2: TACTICS[tactics[2]] ? tactics[2] : 'balanced' },
    chemistry: { 1: chemistry(player1), 2: chemistry(player2) },
    events: [], eventId: 0, notice: null, noticeUntil: 0, decisionIn: 0, tackleCooldown: 0, assist: null,
    penalties: [], penScore: { 1: 0, 2: 0 }, penalty: null, winner: null, mvp: null };
  kickoffTargets(s);
  // Initial setup is hidden by the pre-match countdown, all later changes use movement.
  for (const p of players) { p.x = p.tx; p.y = p.ty; }
  return s;
}
function finish(s, team) {
  s.phase = 'finished';
  s.winner = team;
  s.carrier = null;
  s.mvp = publicPlayer([...s.players].sort((a, b) => (b.rating + (b.team === team ? 1 : 0)) - (a.rating + (a.team === team ? 1 : 0)))[0]);
}
function endRegulation(s) {
  s.clock = s.duration;
  if (s.score[1] !== s.score[2]) finish(s, s.score[1] > s.score[2] ? 1 : 2);
  else beginPenalty(s);
}
function beginPenalty(s) {
  const n = s.penalties.length;
  const team = n % 2 + 1;
  const order = s.players.filter(p => p.team === team && p.slot !== 'gk').sort((a, b) => skill(b, 'sho') - skill(a, 'sho'));
  const shooter = order[Math.floor(n / 2) % order.length];
  s.phase = 'penalty'; s.phaseTime = 0; s.flight = null; s.carrier = null;
  s.penalty = { team, shooter: shooter.key, stage: 'setup', timer: 0, round: Math.floor(n / 2) + 1 };
}
function resolvePenalty(s, scored) {
  const pk = s.penalty;
  if (!pk || pk.stage === 'result') return;
  const shooter = s.players.find(p => p.key === pk.shooter);
  if (scored) { s.penScore[pk.team]++; shooter.rating += 1; }
  s.penalties.push({ team: pk.team, round: pk.round, shooter: publicPlayer(shooter), scored });
  emit(s, 'PENALTY', pk.team, shooter, scored ? `${shooter.name} sút luân lưu thành công!` : `${shooter.name} không thắng được thủ môn.`, { scored });
  pk.stage = 'result'; pk.timer = 0; s.flight = null;
}
function penaltyWinner(s) {
  const a = s.penalties.filter(k => k.team === 1).length;
  const b = s.penalties.filter(k => k.team === 2).length;
  if (a <= 5 && b <= 5) {
    if (s.penScore[1] > s.penScore[2] + 5 - b) return 1;
    if (s.penScore[2] > s.penScore[1] + 5 - a) return 2;
  }
  if (a >= 5 && a === b && s.penScore[1] !== s.penScore[2]) return s.penScore[1] > s.penScore[2] ? 1 : 2;
  return null;
}
function launchShot(s, shooter, penalty = false) {
  const pressure = nearest(s, 3 - shooter.team, shooter, null, true);
  const close = pressure ? clamp((6 - distance(shooter, pressure)) / 6, 0, 1) : 0;
  const goalX = ownX(shooter.team, 97.3);
  const range = Math.abs(goalX - shooter.x);
  const accuracy = skill(shooter, 'sho');
  const spread = penalty ? 9 : 6 + (100 - accuracy) * 0.13 + range * 0.14 + close * 7;
  const targetY = 50 + (random(s) * 2 - 1) * spread;
  s.flight = { kind: 'shot', team: shooter.team, from: shooter.key, x: goalX, y: targetY,
    speed: penalty ? 29 : 24 + accuracy * 0.075, keeperTried: false, penalty, assist: s.assist };
  s.carrier = null;
  if (!penalty) {
    s.stats[shooter.team].shots++;
    emit(s, 'SHOT', shooter.team, shooter, `${shooter.name} dứt điểm${close > 0.4 ? ' dưới áp lực hậu vệ' : ''}!`);
  }
}
function choosePass(s, p) {
  const dir = direction(p.team), tactic = s.tactics[p.team];
  let best = null, bestValue = -Infinity;
  for (const mate of s.players) {
    if (mate.team !== p.team || mate === p || mate.slot === 'gk') continue;
    const d = distance(p, mate);
    if (d < 4 || d > (tactic === 'counter' ? 46 : 34)) continue;
    const gain = (mate.x - p.x) * dir;
    const defender = nearest(s, 3 - p.team, mate, null, true);
    const space = Math.min(10, distance(mate, defender));
    const lane = s.players.filter(o => o.team !== p.team && o.slot !== 'gk').reduce((min, o) => {
      const dx = mate.x - p.x, dy = (mate.y - p.y) * 0.64;
      const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * 0.64 * dy) / (d * d), 0, 1);
      return Math.min(min, distance(o, { x: p.x + dx * t, y: p.y + (mate.y - p.y) * t }));
    }, 100);
    const value = gain * (tactic === 'counter' ? 1 : 0.55) + space * 1.5 - Math.abs(d - 16) * 0.3
      - Math.max(0, 3 - lane) * 7 + (tactic === 'wide' && ['lw', 'rw'].includes(mate.slot) ? 8 : 0)
      - (s.assist?.from === mate.key ? 5 : 0) + random(s) * 3;
    if (value > bestValue) { bestValue = value; best = mate; }
  }
  return best;
}
function pass(s, p, receiver) {
  const error = (100 - skill(p, 'pas')) * 0.045 + (100 - s.chemistry[p.team]) * 0.018;
  const lead = receiver.slot === 'gk' ? 0 : direction(p.team) * 2;
  s.flight = { kind: 'pass', team: p.team, from: p.key, receiver: receiver.key, age: 0,
    x: clamp(receiver.x + lead + (random(s) * 2 - 1) * error, 8, 92),
    y: clamp(receiver.y + (random(s) * 2 - 1) * error * 1.5, 7, 93), speed: 24 };
  s.carrier = null;
}
function resolveFlight(s, dt) {
  const f = s.flight;
  if (!f) return;
  f.age = (f.age || 0) + dt;
  const arrived = moveBall(s, f, f.speed, dt);
  const shooter = s.players.find(p => p.key === f.from);
  if (f.kind === 'shot') {
    const keeper = s.players.find(p => p.team !== f.team && p.slot === 'gk');
    if (!f.keeperTried && distance(keeper, s.ball) < 3.6) {
      f.keeperTried = true;
      const saveChance = clamp(0.42 + (skill(keeper, 'ref') - skill(shooter, 'sho')) * 0.009 - (f.penalty ? 0.16 : 0), 0.12, 0.78);
      if (random(s) < saveChance) {
        if (f.penalty) { resolvePenalty(s, false); return; }
        s.stats[keeper.team].saves++; keeper.rating += 1.6;
        emit(s, 'SAVE', keeper.team, keeper, `${keeper.name} đổ người cản phá cú sút của ${shooter.name}!`);
        setCarrier(s, keeper);
        return;
      }
    }
    if (arrived) {
      const scored = f.y >= 41 && f.y <= 59;
      if (f.penalty) { resolvePenalty(s, scored); return; }
      if (scored) {
        s.score[f.team]++; shooter.rating += 4;
        const assist = f.assist && f.assist.team === f.team && f.assist.to === shooter.key && s.time - f.assist.time < 10
          ? s.players.find(p => p.key === f.assist.from) : null;
        if (assist) assist.rating += 2;
        emit(s, 'GOAL', f.team, shooter, `${shooter.name} ghi bàn!${assist ? ` Đường chuyền quyết định của ${assist.name}.` : ''}`, { assistPlayer: publicPlayer(assist) });
        s.phase = 'goal'; s.phaseTime = 0; s.kickoffTeam = 3 - f.team; s.flight = null;
      } else {
        emit(s, 'MISS', f.team, shooter, `${shooter.name} sút chệch khung thành.`);
        s.phase = 'goal_kick'; s.phaseTime = 0; s.kickoffTeam = 3 - f.team; s.flight = null;
      }
    }
    return;
  }
  const candidates = s.players.filter(p => p.key !== f.from && (p.team === f.team || f.age > 0.12) && distance(p, s.ball) < 1.3)
    .sort((a, b) => distance(a, s.ball) - distance(b, s.ball));
  const receiver = candidates[0];
  if (receiver) {
    if (receiver.team === f.team) {
      s.stats[f.team].passes++; shooter.rating += 0.08;
      s.assist = { from: shooter.key, to: receiver.key, team: f.team, time: s.time };
      setCarrier(s, receiver, true);
    } else {
      receiver.rating += 0.3; s.stats[receiver.team].tackles++;
      emit(s, 'INTERCEPT', receiver.team, receiver, `${receiver.name} đọc đường chuyền và cắt bóng.`);
      setCarrier(s, receiver);
    }
  } else if (arrived) {
    // A misplaced pass stays loose; nobody owns it until physically reaching it.
    s.flight = null; s.carrier = null;
  }
}
function positionPlayers(s, dt) {
  const carrier = s.players.find(p => p.key === s.carrier);
  const defending = 3 - s.possession;
  const pressers = s.players.filter(p => p.team === defending && p.slot !== 'gk')
    .sort((a, b) => distance(a, s.ball) - distance(b, s.ball)).slice(0, 2);
  for (const p of s.players) {
    const dir = direction(p.team), tactic = TACTICS[s.tactics[p.team]];
    if (p.slot === 'gk') {
      p.tx = ownX(p.team, 6 + (s.possession === p.team ? 2 : 0));
      p.ty = clamp(50 + (s.ball.y - 50) * 0.3, 40, 60);
      if (s.flight?.kind === 'shot' && s.flight.team !== p.team) { p.tx = ownX(p.team, 5); p.ty = clamp(s.flight.y, 40, 60); }
    } else {
      const attack = s.possession === p.team;
      const shift = (ownX(p.team, s.ball.x) - 50) * 0.48 + tactic.push + (attack ? 9 : -5);
      const forward = ['st', 'lw', 'rw', 'cam'].includes(p.slot);
      let x = clamp(p.homeX + shift + (attack && forward ? 7 : 0), 12, 90);
      // Keep support runs behind the last defender until the pass is released.
      const lastDefender = Math.max(...s.players.filter(o => o.team !== p.team && o.slot !== 'gk').map(o => ownX(p.team, o.x)));
      if (attack && s.flight?.receiver !== p.key) x = Math.min(x, Math.max(50, ownX(p.team, s.ball.x), lastDefender - 1));
      p.tx = ownX(p.team, x);
      p.ty = clamp(50 + (p.homeY - 50) * tactic.width + (s.ball.y - 50) * 0.12, 9, 91);
      if (p === carrier) {
        p.tx = clamp(p.x + dir * 10, 9, 91);
        p.ty = clamp(p.y + (50 - p.y) * 0.2, 14, 86);
      } else if (s.flight?.kind === 'pass' && s.flight.receiver === p.key) {
        p.tx = s.flight.x; p.ty = s.flight.y;
      } else if (carrier && p === pressers[0]) {
        p.tx = s.ball.x + direction(carrier.team) * 0.8; p.ty = s.ball.y;
      } else if (carrier && p === pressers[1]) {
        p.tx = s.ball.x + direction(carrier.team) * 6; p.ty = clamp(s.ball.y + (p.homeY < 50 ? -7 : 7), 8, 92);
      } else if (!s.carrier && !s.flight && p === nearest(s, p.team, s.ball, null, true)) {
        p.tx = s.ball.x; p.ty = s.ball.y;
      }
    }
  }
  // Teammates keep space without pushing either contact participant off the ball.
  for (const p of s.players) {
    if (p.key === s.carrier || p.key === s.flight?.receiver || pressers.includes(p) || p.slot === 'gk') continue;
    for (const mate of s.players) {
      if (mate === p || mate.team !== p.team || distance(p, mate) > 3) continue;
      const dy = p.y - mate.y || (p.key < mate.key ? -1 : 1);
      p.ty = clamp(p.ty + Math.sign(dy) * 1.8, 7, 93);
    }
  }
  for (const p of s.players) {
    const pace = p.slot === 'gk' ? skill(p, 'spe') : skill(p, 'pac');
    const fatigue = 1 - s.clock / s.duration * 0.12;
    const pressing = p === pressers[0] || p === pressers[1];
    const speed = (3.7 + pace * 0.038) * fatigue * (p === carrier ? 0.82 : pressing ? TACTICS[s.tactics[p.team]].press : 1);
    move(p, p.tx, p.ty, dt, speed);
  }
}
function stepPenalty(s, dt) {
  const pk = s.penalty; pk.timer += dt;
  const shooter = s.players.find(p => p.key === pk.shooter);
  const keeper = s.players.find(p => p.team !== pk.team && p.slot === 'gk');
  const spot = { x: ownX(pk.team, 85), y: 50 };
  for (const p of s.players) {
    let tx = ownX(p.team, 44), ty = clamp(p.homeY, 15, 85);
    if (p === shooter) { tx = spot.x - direction(pk.team) * (pk.stage === 'setup' ? 3 : 0.8); ty = 50; }
    if (p.slot === 'gk') { tx = ownX(p.team, 5); ty = p === keeper && s.flight ? clamp(s.flight.y, 40, 60) : 50; }
    move(p, tx, ty, dt, 7);
  }
  if (pk.stage === 'setup') {
    const ready = moveBall(s, spot, 20, dt);
    if (ready && distance(shooter, spot) < 3.5 && distance(keeper, { x: ownX(keeper.team, 5), y: 50 }) < 1 && pk.timer > 0.8) { pk.stage = 'runup'; pk.timer = 0; }
  } else if (pk.stage === 'runup') {
    if (distance(shooter, s.ball) < 1.3) { launchShot(s, shooter, true); pk.stage = 'shot'; }
  } else if (pk.stage === 'shot') resolveFlight(s, dt);
  else if (pk.stage === 'result' && pk.timer > 1.2) {
    const winner = penaltyWinner(s);
    if (winner) finish(s, winner); else beginPenalty(s);
  }
}
export function stepMatch(s, dt = MATCH_STEP) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1 || s.phase === 'finished') return s;
  s.time += dt; s.tick++; s.phaseTime += dt;
  if (s.phase === 'penalty') { stepPenalty(s, dt); return s; }
  if (['kickoff', 'halftime'].includes(s.phase)) {
    const taker = kickoffTargets(s);
    for (const p of s.players) move(p, p.tx, p.ty, dt, 7);
    const ballReady = moveBall(s, { x: 50, y: 50 }, 20, dt);
    if (ballReady && s.phaseTime > (s.phase === 'halftime' ? 3 : 0.8) && s.players.every(p => distance(p, { x: p.tx, y: p.ty }) < 1)) {
      s.phase = 'playing'; s.phaseTime = 0; setCarrier(s, taker);
    }
    return s;
  }
  if (s.phase === 'goal') {
    positionPlayers(s, dt);
    if (s.phaseTime > 2) restart(s, s.kickoffTeam);
    return s;
  }
  if (s.phase === 'goal_kick') {
    const keeper = s.players.find(p => p.team === s.kickoffTeam && p.slot === 'gk');
    positionPlayers(s, dt);
    if (moveBall(s, keeper, 16, dt) && s.phaseTime > 0.8) { setCarrier(s, keeper); s.phase = 'playing'; }
    return s;
  }
  // Let a shot finish before halftime/fulltime; never cancel a ball on its way to goal.
  if (s.clock >= s.duration && !s.flight) { endRegulation(s); return s; }
  if (s.half === 1 && s.clock >= s.duration / 2 && !s.flight) { s.half = 2; restart(s, 2, 'halftime'); return s; }
  s.clock = Math.min(s.duration, s.clock + dt);
  s.stats[s.possession].possession += dt;
  s.decisionIn -= dt; s.tackleCooldown -= dt;
  positionPlayers(s, dt);
  if (s.flight) { resolveFlight(s, dt); return s; }
  const p = s.players.find(p => p.key === s.carrier);
  if (!p) {
    const closest = [...s.players].sort((a, b) => distance(a, s.ball) - distance(b, s.ball))[0];
    if (distance(closest, s.ball) < 1.6) setCarrier(s, closest);
    return s;
  }
  const ballReady = moveBall(s, { x: p.x + direction(p.team) * 0.7, y: p.y }, 20, dt);
  if (!ballReady) return s;
  const defender = nearest(s, 3 - p.team, p, null, true);
  if (p.slot !== 'gk' && distance(p, defender) < 2 && s.tackleCooldown <= 0) {
    const chance = clamp(0.32 + (skill(defender, 'def') - skill(p, 'dri')) * 0.012, 0.12, 0.8);
    s.tackleCooldown = 1.4;
    if (random(s) < chance) {
      s.stats[defender.team].tackles++; defender.rating += 0.4;
      emit(s, 'TACKLE', defender.team, defender, `${defender.name} áp sát và đoạt bóng từ ${p.name}.`);
      setCarrier(s, defender); return s;
    }
  }
  if (s.decisionIn <= 0) {
    const progress = ownX(p.team, p.x);
    const goalDistance = distance(p, { x: ownX(p.team, 97), y: 50 });
    const pressure = distance(p, defender);
    if (p.slot !== 'gk' && progress > 69 && goalDistance < 32 && random(s) < (progress > 82 ? 0.9 : 0.45)) {
      launchShot(s, p); return s;
    }
    const receiver = choosePass(s, p);
    if (receiver && (p.slot === 'gk' || pressure < 7 || random(s) < 0.6)) pass(s, p, receiver);
    s.decisionIn = (0.7 + random(s) * 0.5) * TACTICS[s.tactics[p.team]].tempo;
  }
  return s;
}

// Compact snapshots contain no full squads/photos; each client already has that data.
export function matchSnapshot(s) {
  const total = s.stats[1].possession + s.stats[2].possession;
  return { version: 1, tick: s.tick, phase: s.phase, time: s.time, minute: Math.floor(s.clock / s.duration * 90), half: s.half,
    score: { ...s.score }, stats: { 1: { ...s.stats[1] }, 2: { ...s.stats[2] } }, possession: total ? Math.round(s.stats[1].possession / total * 100) : 50,
    players: s.players.map(p => ({ key: p.key, team: p.team, x: p.x, y: p.y })), ball: { ...s.ball }, carrier: s.carrier,
    notice: s.time <= s.noticeUntil ? s.notice : null, events: s.events.slice(0, 40),
    penalties: s.penalties.map(k => ({ ...k })), penScore: { ...s.penScore }, penalty: s.penalty ? { ...s.penalty } : null,
    winner: s.winner, mvp: s.mvp, tactics: { ...s.tactics } };
}
