// The guest views their team on the left. Mirror positions, never change team identity.
export function projectLiveFrame(snapshot, baseTokens, leftTeamNum) {
  const mirrored = leftTeamNum === 2;
  const project = p => ({ x: mirrored ? 100 - p.x : p.x, y: mirrored ? 100 - p.y : p.y });
  const positions = new Map(snapshot.players.map(p => [p.key, p]));
  const goal = snapshot.notice?.type === 'GOAL' && snapshot.phase === 'goal' ? snapshot.notice : null;
  const tokens = baseTokens.map(base => {
    const team = base.side === 'left' ? leftTeamNum : 3 - leftTeamNum;
    const canonicalKey = `${team}-${base.slotId}`;
    const pos = positions.get(canonicalKey);
    const point = pos ? project(pos) : { x: base.kickoffX, y: base.kickoffY };
    return { ...base, ...point, canonicalKey, isCelebrating: Boolean(goal && goal.player?.id === base.player?.id && goal.team === team),
      isStar: Boolean(goal && goal.player?.id === base.player?.id && goal.team === team), diveAngle: 0, isSentOff: false, cardBadge: null, actionBadge: null };
  });
  const ball = project(snapshot.ball);
  const carrier = tokens.find(p => p.canonicalKey === snapshot.carrier);
  const goalSide = goal ? goal.team === leftTeamNum ? 'left' : 'right' : null;
  return { tokens, ballX: ball.x, ballY: ball.y, carrierKey: carrier?.key || null,
    netRippleSide: goalSide ? goalSide === 'left' ? 'right' : 'left' : null,
    goalSweepSide: goalSide, goalBanner: goal ? { side: goalSide, scorerName: goal.player?.name, assistName: goal.assistPlayer?.name, minute: goal.min } : null,
    eventBanner: snapshot.phase === 'kickoff' ? { text: 'HAI ĐỘI VÀO VỊ TRÍ GIAO BÓNG', tone: 'amber' } : null,
    passLine: null, shotLine: null, impactRing: null, cameraStyle: { transform: 'scale(1)' } };
}
export function interpolateLiveFrame(previous, target, dt) {
  if (!previous) return target;
  const blend = 1 - Math.exp(-Math.max(0, dt) * 18);
  const positions = new Map(previous.tokens.map(p => [p.key, p]));
  const move = (from, to, maxSpeed) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d * blend, maxSpeed * dt);
    const k = d > 0.00001 ? step / d : 0;
    return { x: from.x + dx * k, y: from.y + dy * k };
  };
  const ball = move({ x: previous.ballX, y: previous.ballY }, { x: target.ballX, y: target.ballY }, 85);
  return { ...target, tokens: target.tokens.map(p => ({ ...p, ...move(positions.get(p.key) || p, p, 28) })), ballX: ball.x, ballY: ball.y };
}

export function acceptMatchPacket(packet, currentMatchId, lastSequence) {
  return Boolean(packet && packet.version === 1 && typeof packet.matchId === 'string' &&
    (!currentMatchId || packet.matchId === currentMatchId) && Number.isInteger(packet.sequence) && packet.sequence > lastSequence &&
    Array.isArray(packet.players) && packet.players.length === 22 && packet.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
    Number.isFinite(packet.ball?.x) && Number.isFinite(packet.ball?.y) && packet.score && packet.stats && packet.tactics && Array.isArray(packet.events));
}
