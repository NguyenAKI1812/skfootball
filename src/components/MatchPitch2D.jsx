import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Play } from 'lucide-react';
import { projectLiveFrame, interpolateLiveFrame } from '../utils/matchPresentation';

// Spacious formation anchors:
// kickoffX/Y = strictly inside own half; liveX/Y = staggered neutral shape shifted dynamically by ball position
const LEFT_SLOTS = [
  { id: 'gk', code: 'GK', kickoffX: 5.5, kickoffY: 50, liveX: 5.5, liveY: 50 },
  { id: 'lb', code: 'LB', kickoffX: 19, kickoffY: 13, liveX: 23, liveY: 13 },
  { id: 'lcb', code: 'LCB', kickoffX: 16, kickoffY: 36, liveX: 19, liveY: 36 },
  { id: 'rcb', code: 'RCB', kickoffX: 16, kickoffY: 64, liveX: 19, liveY: 64 },
  { id: 'rb', code: 'RB', kickoffX: 19, kickoffY: 87, liveX: 23, liveY: 87 },
  { id: 'cm1', code: 'CM', kickoffX: 33, kickoffY: 27, liveX: 40, liveY: 27 },
  { id: 'cm2', code: 'CM', kickoffX: 33, kickoffY: 73, liveX: 40, liveY: 73 },
  { id: 'lw', code: 'LW', kickoffX: 44, kickoffY: 16, liveX: 56, liveY: 16 },
  { id: 'st', code: 'ST', kickoffX: 47.5, kickoffY: 50, liveX: 60, liveY: 50 },
  { id: 'rw', code: 'RW', kickoffX: 44, kickoffY: 84, liveX: 56, liveY: 84 }
];

const CAM_SLOT = { id: 'cam', code: 'CAM', kickoffX: 39.5, kickoffY: 50, liveX: 49, liveY: 50 };
const CDM_SLOT = { id: 'cdm', code: 'CDM', kickoffX: 27.5, kickoffY: 50, liveX: 32, liveY: 50 };

function safeNum(v, fallback = 50) {
  return Number.isFinite(v) ? v : fallback;
}

function lerp(a, b, t) {
  const sa = safeNum(a, 50);
  const sb = safeNum(b, sa);
  const st = Math.max(0, Math.min(1, safeNum(t, 0)));
  return sa + (sb - sa) * st;
}

function clampPct(v, min = 3, max = 97) {
  const sv = safeNum(v, (min + max) * 0.5);
  return Math.max(min, Math.min(max, sv));
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Constant-speed physical ball stepper so ball never teleports or outpaces the action unreadably
function moveBallSmoothTo(ball, tx, ty, dtSec, speedPctPerSec = 18) {
  const stx = clampPct(tx, 1.0, 99.0);
  const sty = clampPct(ty, 1.0, 99.0);
  const dx = stx - safeNum(ball.x, stx);
  const dy = sty - safeNum(ball.y, sty);
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) {
    ball.x = stx;
    ball.y = sty;
    return true;
  }
  const step = Math.min(dist, Math.max(0, speedPctPerSec * dtSec));
  ball.x = clampPct(ball.x + (dx / dist) * step, 1.0, 99.0);
  ball.y = clampPct(ball.y + (dy / dist) * step, 1.0, 99.0);
  return dist - step <= 0.001;
}

// Smooth, speed-capped stepper — sole writer to visible tok.x / tok.y (prevents any teleportation)
function movePlayerSmooth(tok, targetX, targetY, dtSec, maxSpeed = 5.2, responsiveness = 3.2) {
  if (!tok) return;
  const tx = clampPct(targetX, 1.5, 98.5);
  const ty = clampPct(targetY, 1.0, 99.0);
  const curX = safeNum(tok.x, tx);
  const curY = safeNum(tok.y, ty);
  if (dtSec <= 0) return;
  const dx = tx - curX;
  const dy = ty - curY;
  const distance = Math.hypot(dx, dy);
  const desiredSpeed = Math.min(maxSpeed, distance * responsiveness);
  const desiredVx = distance > 0.001 ? dx / distance * desiredSpeed : 0;
  const desiredVy = distance > 0.001 ? dy / distance * desiredSpeed : 0;
  let vx = safeNum(tok.vx, 0);
  let vy = safeNum(tok.vy, 0);
  const change = Math.hypot(desiredVx - vx, desiredVy - vy);
  const blend = change > 0 ? Math.min(1, 24 * dtSec / change) : 1;
  vx += (desiredVx - vx) * blend;
  vy += (desiredVy - vy) * blend;
  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) { vx *= maxSpeed / speed; vy *= maxSpeed / speed; }
  tok.vx = vx;
  tok.vy = vy;
  tok.x = clampPct(curX + vx * dtSec, 1.5, 98.5);
  tok.y = clampPct(curY + vy * dtSec, 1.0, 99.0);
}

// Hard safety clamp so neither goalkeeper can ever wander outside their goal / 6-yard area
function enforceGoalkeeperZone(playersArr) {
  playersArr.forEach(tok => {
    if (tok.slotId !== 'gk') return;
    if (tok.side === 'left') {
      tok.x = clampPct(tok.x, 4.0, 10.5);
    } else {
      tok.x = clampPct(tok.x, 89.5, 96.0);
    }
    tok.y = clampPct(tok.y, 40, 60);
  });
}

// Apply separation force to targetX/targetY BEFORE movement so players separate smoothly without snapping
function applyTargetSeparation(playersList, minDist = 5.8, iterations = 2) {
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < playersList.length; i++) {
      const a = playersList[i];
      if (a.isSentOff || a.slotId === 'gk') continue;
      for (let j = i + 1; j < playersList.length; j++) {
        const b = playersList[j];
        if (b.isSentOff || b.slotId === 'gk') continue;
        const dx = b.targetX - a.targetX;
        const dy = b.targetY - a.targetY;
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          const push = (minDist - d) * 0.42;
          const nx = d > 0.01 ? dx / d : (i % 2 === 0 ? 1 : -1);
          const ny = d > 0.01 ? dy / d : 0.4;
          if (!a.isSetPieceTaker && !a.isBallLocked) {
            a.targetX = clampPct(a.targetX - nx * push, 10, 90);
            a.targetY = clampPct(a.targetY - ny * push, 6, 94);
          }
          if (!b.isSetPieceTaker && !b.isBallLocked) {
            b.targetX = clampPct(b.targetX + nx * push, 10, 90);
            b.targetY = clampPct(b.targetY + ny * push, 6, 94);
          }
        }
      }
    }
  }
}

function buildTeamTokens(squad = {}, side = 'left') {
  const hasCdm = Boolean(squad?.cdm) && !squad?.cam;
  const midSlot = hasCdm ? CDM_SLOT : CAM_SLOT;
  const slots = [...LEFT_SLOTS, midSlot];

  return slots.map((slot, idx) => {
    const p = squad?.[slot.id] || null;
    const kickoffX = side === 'left' ? slot.kickoffX : 100 - slot.kickoffX;
    const kickoffY = side === 'left' ? slot.kickoffY : 100 - slot.kickoffY;
    const liveX = side === 'left' ? slot.liveX : 100 - slot.liveX;
    const liveY = side === 'left' ? slot.liveY : 100 - slot.liveY;
    const fullName = p?.name || slot.code;
    const parts = fullName.trim().split(/\s+/);
    const shortName = parts.length > 1 ? parts[parts.length - 1] : fullName;

    return {
      key: `${side}-${slot.id}`,
      slotId: slot.id,
      code: slot.code,
      side,
      idx,
      player: p,
      id: p?.id || `${side}-${slot.id}`,
      name: fullName,
      shortName,
      photo: p?.photo || null,
      ovr: p?.ovr || 80,
      tier: p?.tier || 2,
      kickoffX,
      kickoffY,
      liveX,
      liveY
    };
  });
}

// Strictly isolate GK vs Outfield tokens: an outfield lookup NEVER returns a goalkeeper token
function getLivePlayer(playersMap, baseTokens, targetPlayer, fallbackSlots = ['st', 'cam', 'cdm', 'cm1']) {
  if (!baseTokens || baseTokens.length === 0) return null;
  const wantGk = fallbackSlots.length === 1 && fallbackSlots[0] === 'gk';
  if (wantGk) {
    const gkTok = baseTokens.find(t => t.slotId === 'gk');
    return gkTok ? playersMap[gkTok.key] || null : null;
  }

  const outfieldPool = baseTokens.filter(t => t.slotId !== 'gk' && !playersMap[t.key]?.isSentOff);
  const pool = outfieldPool.length > 0 ? outfieldPool : baseTokens.filter(t => t.slotId !== 'gk');

  let match = null;
  if (targetPlayer) {
    if (targetPlayer.id) {
      match = pool.find(t => t.player?.id === targetPlayer.id) || null;
    }
    if (!match && targetPlayer.name) {
      match = pool.find(t => t.player?.name === targetPlayer.name) || null;
    }
  }
  if (!match) {
    for (const sId of fallbackSlots) {
      if (sId === 'gk') continue;
      match = pool.find(t => t.slotId === sId) || null;
      if (match) break;
    }
  }
  const chosen = match || pool[0] || baseTokens[1] || baseTokens[0];
  return chosen ? playersMap[chosen.key] || null : null;
}

function pickNearestLiveOutfield(playersMap, baseTokens, tx, ty, excludeKeys = []) {
  const candidates = baseTokens
    .filter(t => t.slotId !== 'gk' && !excludeKeys.includes(t.key))
    .map(t => playersMap[t.key])
    .filter(pl => pl && !pl.isSentOff);
  if (candidates.length === 0) {
    return baseTokens
      .filter(t => t.slotId !== 'gk')
      .map(t => playersMap[t.key])
      .find(pl => pl && !pl.isSentOff) || null;
  }
  candidates.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  return candidates[0];
}

// IFAB Law 11: Compute offside line (deepest outfield defender line)
function getOffsideLineX(playersArr, attackingSide) {
  const defenders = playersArr.filter(pl => pl.side !== attackingSide && !pl.isSentOff && pl.slotId !== 'gk');
  if (defenders.length === 0) return attackingSide === 'left' ? 86 : 14;
  if (attackingSide === 'left') {
    const deepestX = defenders.reduce((mx, d) => Math.max(mx, safeNum(d.x, 82)), 50);
    return Math.max(50, Math.min(89, deepestX));
  }
  const deepestX = defenders.reduce((mn, d) => Math.min(mn, safeNum(d.x, 18)), 50);
  return Math.min(50, Math.max(11, deepestX));
}

// Clamp attacking players to stay onside relative to ball & opponent defensive line (IFAB Law 11)
function clampOnsideX(tok, rawTargetX, ballX, offsideLineX) {
  if (tok.slotId === 'gk') return tok.liveX;
  if (tok.side === 'left') {
    const allowedMax = Math.max(50, ballX, offsideLineX - 1.2);
    return Math.min(rawTargetX, allowedMax);
  }
  const allowedMin = Math.min(50, ballX, offsideLineX + 1.2);
  return Math.max(rawTargetX, allowedMin);
}

// Compute natural shifted formation spot while respecting IFAB Law 11 offside line
function getShiftedAnchor(tok, ballX, ballY, possSide, upcomingAtkSide, offsideLineX = null) {
  if (tok.slotId === 'gk') {
    return {
      x: tok.liveX,
      y: clampPct(50 + (safeNum(ballY, 50) - 50) * 0.22, 42, 58)
    };
  }
  const shiftFromBall = (ballX - 50) * 0.32;
  const possPush = tok.side === possSide ? (tok.side === 'left' ? 3.2 : -3.2) : (tok.side === 'left' ? -3.2 : 3.2);
  const buildupPush = upcomingAtkSide === tok.side ? (tok.side === 'left' ? 4.0 : -4.0) : 0;
  let x = clampPct(tok.liveX + shiftFromBall + possPush + buildupPush, 12, 88);
  if (offsideLineX !== null && tok.side === possSide) {
    x = clampPct(clampOnsideX(tok, x, ballX, offsideLineX), 12, 88);
  }
  return {
    x,
    y: clampPct(tok.liveY, 8, 92)
  };
}

// Push opposing defenders away for IFAB set-pieces (Free Kick / Corner Kick >= 9.15m, Throw-in >= 2m)
function enforceSetPieceDistance(tok, spotX, spotY, minDist) {
  if (tok.isSentOff || tok.slotId === 'gk') return;
  const d = Math.hypot(tok.targetX - spotX, tok.targetY - spotY);
  if (d < minDist) {
    const angle = Math.atan2(tok.targetY - spotY, tok.targetX - spotX);
    tok.targetX = clampPct(spotX + Math.cos(angle) * (minDist + 1.5), 12, 88);
    tok.targetY = clampPct(spotY + Math.sin(angle) * (minDist + 1.5), 10, 90);
  }
}

// Select an open teammate with clear passing lane (only active outfield players)
function selectOpenPassTarget(passer, allPlayers, prevPasserKey, preferredSide, buildupTargetKey = null, simTime = 0) {
  if (!passer) return null;
  const attackDir = passer.side === 'left' ? 1 : -1;
  const teammates = allPlayers.filter(
    pl => pl.side === passer.side && pl.slotId !== 'gk' && !pl.isSentOff && pl.key !== passer.key
  );
  const opponents = allPlayers.filter(pl => pl.side !== passer.side && !pl.isSentOff && pl.slotId !== 'gk');

  let best = null;
  let bestScore = -Infinity;

  teammates.forEach(mate => {
    const dist = Math.hypot(mate.x - passer.x, mate.y - passer.y);
    if (dist < 4.5 || dist > 38) return;

    let minOppDist = 99;
    opponents.forEach(opp => {
      const d = distPointToSegment(opp.x, opp.y, passer.x, passer.y, mate.x, mate.y);
      if (d < minOppDist) minOppDist = d;
    });

    const forwardGain = (mate.x - passer.x) * attackDir;
    const laneScore = minOppDist < 4.8 ? -70 + minOppDist * 10 : Math.min(24, minOppDist * 1.6);
    const distScore = 24 - Math.abs(dist - 16);
    const antiBounce = mate.key === prevPasserKey ? -24 : 0;
    const buildupBias = buildupTargetKey && mate.key === buildupTargetKey ? 18 : 0;
    const attackBias = preferredSide === passer.side ? forwardGain * 0.65 : forwardGain * 0.15;
    const jitter = (Math.sin(passer.idx * 7 + mate.idx * 13 + simTime * 0.002) + 1) * 2.5;

    const score = laneScore + distScore + attackBias + antiBounce + buildupBias + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = { mate, minOppDist };
    }
  });

  if (!best && teammates.length > 0) best = { mate: teammates[0], minOppDist: 10 };
  return best;
}

function resetOpenPlayState(sim, carrierTok, leftPoss = 50) {
  const carrier =
    (carrierTok && carrierTok.slotId !== 'gk' ? carrierTok : null) ||
    (sim.players[sim.carrierKey]?.slotId !== 'gk' ? sim.players[sim.carrierKey] : null) ||
    Object.values(sim.players).find(pl => pl.slotId !== 'gk' && !pl.isSentOff);
  if (!carrier) return;
  sim.carrierKey = carrier.key;
  sim.possSide = carrier.side;
  sim.prevCarrierKey = null;
  const teamPoss = carrier.side === 'left' ? leftPoss : (100 - leftPoss);
  sim.openPlay = {
    phase: 'DRIBBLE',
    timerMs: 0,
    durationMs: 900,
    fromX: carrier.x,
    fromY: carrier.y,
    targetX: carrier.x,
    targetY: carrier.y,
    targetKey: carrier.key,
    interceptorKey: null,
    takerKey: null,
    collectorKey: null,
    throwSub: 'run',
    streakCount: 0,
    targetStreak: teamPoss >= 55 ? 5 : 3
  };
}

export default function MatchPitch2D({
  leftSquad = {},
  rightSquad = {},
  leftTeamNum = 1,
  rightTeamNum = 2,
  leftName = 'HLV 1 (Bạn)',
  rightName = 'HLV 2 (Đối thủ)',
  currentMinute = 0,
  matchPhase = 'playing',
  leftPoss = 50,
  activeHighlight = null,
  eventsTimeline = [],
  penaltyKick = null,
  isHalfTime = false,
  simSpeed = 1,
  onToggleSpeed = null,
  onHighlightImpact = null,
  onHighlightComplete = null,
  onPenaltyImpact = null,
  onPenaltyComplete = null,
  liveSnapshot = null
}) {
  const leftBaseTokens = useMemo(() => buildTeamTokens(leftSquad, 'left'), [leftSquad]);
  const rightBaseTokens = useMemo(() => buildTeamTokens(rightSquad, 'right'), [rightSquad]);
  const allBase = useMemo(() => [...leftBaseTokens, ...rightBaseTokens], [leftBaseTokens, rightBaseTokens]);

  const simRef = useRef(null);
  if (!simRef.current && allBase.length > 0) {
    const players = {};
    allBase.forEach(t => {
      players[t.key] = {
        ...t,
        x: t.kickoffX,
        y: t.kickoffY,
        targetX: t.kickoffX,
        targetY: t.kickoffY,
        maxSpd: 4.5,
        resp: 3.0,
        diveAngle: 0,
        isStar: false,
        isCelebrating: false,
        isSetPieceTaker: false,
        isBallLocked: false,
        isSentOff: false,
        cardBadge: null,
        actionBadge: null
      };
    });
    const initCarrier = getLivePlayer(players, leftTeamNum === 1 ? leftBaseTokens : rightBaseTokens, null, ['st', 'cam', 'cm1']);
    simRef.current = {
      simTime: 0,
      players,
      ball: { x: 50, y: 50 },
      possSide: initCarrier?.side || 'left',
      carrierKey: initCarrier?.key || null,
      prevCarrierKey: null,
      turnoverCycle: 0,
      saveCount: 0,
      prevMinute: 0,
      openPlay: {
        phase: 'DRIBBLE',
        timerMs: 0,
        durationMs: 900,
        fromX: 50,
        fromY: 50,
        targetX: 50,
        targetY: 50,
        targetKey: initCarrier?.key || null,
        interceptorKey: null,
        takerKey: null,
        collectorKey: null,
        throwSub: 'run',
        streakCount: 0,
        targetStreak: 4
      },
      highlightState: null,
      penState: { key: null, phase: 'approach', phaseMs: 0, elapsedMs: 0 },
      netRippleSide: null,
      goalSweepSide: null,
      goalBanner: null,
      eventBanner: null,
      passLine: null,
      shotLine: null,
      impactRing: null,
      lastHighlightRef: null
    };
  }

  const latestPropsRef = useRef({
    leftBaseTokens,
    rightBaseTokens,
    leftTeamNum,
    rightTeamNum,
    currentMinute,
    matchPhase,
    leftPoss,
    activeHighlight,
    eventsTimeline,
    penaltyKick,
    isHalfTime,
    simSpeed,
    onHighlightImpact,
    onHighlightComplete,
    onPenaltyImpact,
    onPenaltyComplete,
    liveSnapshot
  });
  latestPropsRef.current = {
    leftBaseTokens,
    rightBaseTokens,
    leftTeamNum,
    rightTeamNum,
    currentMinute,
    matchPhase,
    leftPoss,
    activeHighlight,
    eventsTimeline,
    penaltyKick,
    isHalfTime,
    simSpeed,
    onHighlightImpact,
    onHighlightComplete,
    onPenaltyImpact,
    onPenaltyComplete,
    liveSnapshot
  };

  const [renderFrame, setRenderFrame] = useState({
    tokens: [],
    ballX: 50,
    ballY: 50,
    carrierKey: null,
    netRippleSide: null,
    goalSweepSide: null,
    goalBanner: null,
    eventBanner: null,
    passLine: null,
    shotLine: null,
    impactRing: null,
    cameraStyle: { transform: 'scale(1)' }
  });

  useEffect(() => {
    let rafId = null;
    let lastTs = performance.now();
    let liveDisplay = null;

    const stepSimulation = (now) => {
      const sim = simRef.current;
      if (!sim) {
        rafId = requestAnimationFrame(stepSimulation);
        return;
      }

      const rawDt = Math.min(50, Math.max(0, now - lastTs));
      lastTs = now;
      const props = latestPropsRef.current;
      if (props.liveSnapshot) {
        const target = projectLiveFrame(props.liveSnapshot, [...props.leftBaseTokens, ...props.rightBaseTokens], props.leftTeamNum);
        liveDisplay = interpolateLiveFrame(liveDisplay, target, rawDt / 1000);
        setRenderFrame(liveDisplay);
        rafId = requestAnimationFrame(stepSimulation);
        return;
      }
      const speedMult = props.simSpeed === 2 ? 2 : 1;
      const dtMs = rawDt * speedMult;
      const dtSec = dtMs / 1000;
      sim.simTime += dtMs;

      const players = sim.players;
      const playersArr = Object.values(players);

      // Reset transient per-frame flags
      playersArr.forEach(tok => {
        tok.isStar = false;
        tok.isCelebrating = false;
        tok.isSetPieceTaker = false;
        tok.isBallLocked = false;
        tok.diveAngle = 0;
        tok.cardBadge = null;
        tok.actionBadge = null;
        tok.maxSpd = 4.6;
        tok.resp = 3.0;
      });
      sim.passLine = null;
      sim.shotLine = null;
      sim.impactRing = null;
      sim.netRippleSide = null;
      sim.goalSweepSide = null;
      sim.goalBanner = null;
      sim.eventBanner = null;

      // Team 2 kicks off the second half, independent of the viewer's side.
      if (sim.prevMinute <= 45 && props.currentMinute >= 46 && !props.activeHighlight) {
        const secondHalfTokens = props.leftTeamNum === 2 ? props.leftBaseTokens : props.rightBaseTokens;
        const taker = getLivePlayer(players, secondHalfTokens, null, ['st', 'cam', 'cm1']);
        if (taker) resetOpenPlayState(sim, taker, props.leftPoss);
      }
      sim.prevMinute = props.currentMinute;

      const upcomingEv = !props.activeHighlight
        ? (props.eventsTimeline || []).find(e => e.min > props.currentMinute && e.min - props.currentMinute <= 2)
        : null;
      const upcomingAtkSide = upcomingEv ? (upcomingEv.team === props.leftTeamNum ? 'left' : 'right') : null;
      const upcomingLeftAtk = upcomingAtkSide === 'left';
      const upcomingSlotList = upcomingAtkSide
        ? (upcomingLeftAtk ? props.leftBaseTokens : props.rightBaseTokens)
        : null;
      const upcomingBuildupKey = upcomingEv && upcomingSlotList
        ? getLivePlayer(players, upcomingSlotList, upcomingEv.player, ['st', 'cam', 'lw', 'rw', 'cm1'])?.key
        : null;

      let ballControlledThisFrame = false;

      // =========================================================================
      // MODE 1: COUNTDOWN / HALF-TIME / FINISHED (IFAB Law 8 Kickoff & Halves)
      // =========================================================================
      if (props.matchPhase === 'countdown' || props.isHalfTime || props.matchPhase === 'finished') {
        const kickoffTeam = props.isHalfTime ? 2 : 1;
        const kickoffTokens = props.leftTeamNum === kickoffTeam ? props.leftBaseTokens : props.rightBaseTokens;
        const kickoffTaker = getLivePlayer(players, kickoffTokens, null, ['st', 'cam', 'cm1']);
        playersArr.forEach(tok => {
          if (tok.isSentOff) {
            tok.targetX = 50;
            tok.targetY = 1.2;
            tok.maxSpd = 6.5;
            return;
          }
          if (tok.slotId === 'gk') {
            tok.targetX = tok.kickoffX;
            tok.targetY = tok.kickoffY;
            tok.maxSpd = 5.0;
            return;
          }
          if (props.matchPhase === 'finished') {
            tok.targetX = 50 + (tok.side === 'left' ? -7 : 7);
            tok.targetY = clampPct(16 + tok.idx * 7.2, 14, 86);
          } else {
            tok.targetX = tok.key === kickoffTaker?.key ? 50 : tok.kickoffX;
            tok.targetY = tok.key === kickoffTaker?.key ? 50 : tok.kickoffY;
            if (tok.key === kickoffTaker?.key) tok.isBallLocked = true;
            else if (tok.side !== kickoffTaker?.side && Math.hypot(tok.targetX - 50, tok.targetY - 50) < 10.5) tok.targetX = tok.side === 'left' ? 39 : 61;
          }
          tok.maxSpd = 6.5;
          tok.resp = 3.2;
        });

        applyTargetSeparation(playersArr, 5.0, 2);
        playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
        enforceGoalkeeperZone(playersArr);

        moveBallSmoothTo(sim.ball, 50, 50, dtSec, 20);
        if (kickoffTaker) resetOpenPlayState(sim, kickoffTaker, props.leftPoss);
        sim.highlightState = null;
        ballControlledThisFrame = true;

      // =========================================================================
      // MODE 2: PENALTY SHOOTOUT (Player-gated: shooter stands at ball before kicking!)
      // =========================================================================
      } else if (props.matchPhase === 'penalty') {
        const pk = props.penaltyKick;
        const pkSide = pk ? (pk.team === props.leftTeamNum ? 'left' : 'right') : 'left';
        const isLeftPk = pkSide === 'left';
        const penX = isLeftPk ? 84.5 : 15.5;
        const penGoalX = isLeftPk ? 97.2 : 2.8;
        const penGkX = isLeftPk ? 95.0 : 5.0;
        const shooterTokens = isLeftPk ? props.leftBaseTokens : props.rightBaseTokens;
        const gkTokens = isLeftPk ? props.rightBaseTokens : props.leftBaseTokens;
        const shooter = getLivePlayer(players, shooterTokens, pk?.shooter, ['st', 'cam']);
        const oppGk = getLivePlayer(players, gkTokens, null, ['gk']);
        const pkKey = pk ? `${pk.round}-${pk.team}-${pk.shooter?.name}-${pk.scored}` : 'idle';

        if (sim.penState.key !== pkKey) {
          sim.penState = { key: pkKey, phase: 'approach', phaseMs: 0, elapsedMs: 0 };
        } else {
          sim.penState.elapsedMs += dtMs;
          sim.penState.phaseMs += dtMs;
        }
        const ps = sim.penState;

        playersArr.forEach(tok => {
          if (tok.isSentOff) {
            tok.targetX = 50;
            tok.targetY = 1.2;
            return;
          }
          if (tok.slotId === 'gk') {
            if (!oppGk || tok.key !== oppGk.key) {
              tok.targetX = tok.liveX;
              tok.targetY = 50;
              tok.maxSpd = 4.0;
            }
            return;
          }
          if (shooter && tok.key === shooter.key) return;
          tok.targetX = 50 + (tok.side === 'left' ? -5 : 5);
          tok.targetY = clampPct(18 + tok.idx * 6.5, 16, 84);
          tok.maxSpd = 5.5;
        });

        const pkTargetY = pk?.scored ? 43 : 45;
        if (shooter) {
          shooter.isStar = ps.phase !== 'approach';
          shooter.isBallLocked = true;
          shooter.targetX = ps.phase === 'approach' ? penX - (isLeftPk ? 3.2 : -3.2) : penX - (isLeftPk ? 0.8 : -0.8);
          shooter.targetY = 50;
          shooter.maxSpd = 7.0;
          sim.carrierKey = shooter.key;
        }
        if (oppGk) {
          oppGk.targetX = penGkX;
          oppGk.targetY = ps.phase === 'shot' || ps.phase === 'done' ? (pk?.scored ? 56 : 45) : 50;
          oppGk.maxSpd = 5.8;
          oppGk.resp = 3.8;
          if (ps.phase === 'shot' || ps.phase === 'done') {
            oppGk.diveAngle = pk?.scored ? (isLeftPk ? 26 : -26) : (isLeftPk ? -28 : 28);
            oppGk.actionBadge = ps.phase === 'done' && !pk?.scored ? '🧤 CẢN PHÁ!' : null;
          }
        }

        applyTargetSeparation(playersArr, 5.0, 1);
        playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
        enforceGoalkeeperZone(playersArr);

        if (!pk || ps.phase === 'approach') {
          const ballReady = moveBallSmoothTo(sim.ball, penX, 50, dtSec, 22);
          const shooterReady = !shooter || Math.hypot(shooter.x - penX, shooter.y - 50) < 4.0;
          if (pk && ballReady && shooterReady && ps.phaseMs >= 650) {
            ps.phase = 'runup';
            ps.phaseMs = 0;
          }
        } else if (ps.phase === 'runup') {
          moveBallSmoothTo(sim.ball, penX, 50, dtSec, 22);
          if (shooter && Math.hypot(shooter.x - penX, shooter.y - 50) < 1.8 && ps.phaseMs >= 220) {
            ps.phase = 'shot';
            ps.phaseMs = 0;
            ps.shotFromX = shooter ? shooter.x : penX;
            ps.shotFromY = shooter ? shooter.y : 50;
          }
        } else if (ps.phase === 'shot') {
          const tx = pk.scored ? penGoalX + (isLeftPk ? 1.1 : -1.1) : penGkX;
          const arrived = moveBallSmoothTo(sim.ball, tx, pkTargetY, dtSec, 26);
          sim.shotLine = { x1: ps.shotFromX, y1: ps.shotFromY, x2: sim.ball.x, y2: sim.ball.y, color: '#fbbf24' };
          if (arrived) {
            ps.phase = 'done';
            ps.phaseMs = 0;
            props.onPenaltyImpact?.(pk);
          }
        } else if (pk.scored) {
          moveBallSmoothTo(sim.ball, penGoalX + (isLeftPk ? 1.1 : -1.1), pkTargetY, dtSec, 22);
          sim.netRippleSide = isLeftPk ? 'right' : 'left';
          if (shooter) {
            shooter.isCelebrating = true;
            shooter.actionBadge = '⚽ VÀO 11M!';
          }
        } else {
          moveBallSmoothTo(sim.ball, penGkX + (isLeftPk ? -6 : 6), 36, dtSec, 13);
          sim.impactRing = { x: penGkX, y: 45, color: '#fbbf24' };
        }
        if (ps.phase === 'done' && ps.phaseMs >= 900 && !ps.completed) {
          ps.completed = true;
          props.onPenaltyComplete?.(pk);
        }
        ballControlledThisFrame = true;

      // =========================================================================
      // MODE 3: ACTIVE HIGHLIGHT (Player-Gated + Physical Ball Speed — NEVER empty-air kicks!)
      // =========================================================================
      } else if (props.activeHighlight) {
        const hl = props.activeHighlight;
        const evType = hl.type;
        const actSide = hl.team === props.leftTeamNum ? 'left' : 'right';
        const oppSide = actSide === 'left' ? 'right' : 'left';
        const isLeftEvent = actSide === 'left';
        const dir = isLeftEvent ? 1 : -1;

        const atkTokens = isLeftEvent ? props.leftBaseTokens : props.rightBaseTokens;
        const defTokens = isLeftEvent ? props.rightBaseTokens : props.leftBaseTokens;

        if (!sim.highlightState || sim.lastHighlightRef !== hl) {
          sim.lastHighlightRef = hl;
          const scorer = getLivePlayer(players, atkTokens, hl.player, ['st', 'cam', 'lw', 'rw', 'cm1']);
          const assistLive = hl.assistPlayer ? getLivePlayer(players, atkTokens, hl.assistPlayer, ['cam', 'cm1', 'lw', 'rw']) : null;
          const playmaker =
            assistLive && assistLive.key !== scorer?.key
              ? assistLive
              : pickNearestLiveOutfield(players, atkTokens, sim.ball.x, sim.ball.y, scorer ? [scorer.key] : []);
          const oppGk = getLivePlayer(players, defTokens, null, ['gk']);
          const oppShooter = getLivePlayer(players, defTokens, hl.oppPlayer, ['st', 'lw', 'rw', 'cam']);

          const shootSpot = hl.isPenalty
            ? { x: isLeftEvent ? 84.5 : 15.5, y: 50 }
            : {
                x: isLeftEvent
                  ? clampPct(Math.max(safeNum(scorer?.x, 74) + 8, 76), 72, 87)
                  : clampPct(Math.min(safeNum(scorer?.x, 26) - 8, 24), 13, 28),
                y: clampPct((scorer?.y ?? 50) * 0.45 + 27.5, 34, 66)
              };

          const celebMates = atkTokens
            .filter(t => t.slotId !== 'gk' && t.key !== scorer?.key && !players[t.key]?.isSentOff)
            .slice(0, 3)
            .map(t => t.key);

          // Save / Corner Setup (50% Corner per IFAB Law 17, 50% Rebound collected in play)
          const gk = getLivePlayer(players, atkTokens, null, ['gk']);
          const gkX = isLeftEvent ? 5.8 : 94.2;
          const oppShootSpot = hl.type === 'PENALTY_SAVED'
            ? { x: isLeftEvent ? 15.5 : 84.5, y: 50 }
            : {
                x: isLeftEvent
                  ? clampPct(Math.min(safeNum(oppShooter?.x, 22), 26), 14, 28)
                  : clampPct(Math.max(safeNum(oppShooter?.x, 78), 74), 72, 86),
                y: clampPct(oppShooter?.y ?? 50, 36, 64)
              };
          const gkSaveY = oppShootSpot.y < 50 ? 45 : 55;
          if (hl.type === 'SAVE') sim.saveCount += 1;
          const isCornerRebound = hl.type === 'SAVE' ? sim.saveCount % 2 === 1 : false;

          const topCorner = gkSaveY < 50;
          const cSpot = { x: isLeftEvent ? 3.8 : 96.2, y: topCorner ? 4.8 : 95.2 };
          const cTaker = pickNearestLiveOutfield(players, defTokens, cSpot.x, cSpot.y);
          const cHeader = pickNearestLiveOutfield(players, defTokens, isLeftEvent ? 14 : 86, 50, cTaker ? [cTaker.key] : []);
          const cCollector = pickNearestLiveOutfield(players, atkTokens, isLeftEvent ? 26 : 74, 48);

          const saveReboundSpot = {
            x: clampPct(gkX + dir * 16, 18, 82),
            y: clampPct(gkSaveY + (gkSaveY < 50 ? -14 : 14), 16, 84)
          };
          const saveCollector = pickNearestLiveOutfield(players, atkTokens, saveReboundSpot.x, saveReboundSpot.y);

          // Woodwork Setup
          const woodworkShooter = getLivePlayer(players, atkTokens, hl.player, ['st', 'lw', 'rw', 'cam']);
          const wwLeft = woodworkShooter ? woodworkShooter.side === 'left' : isLeftEvent;
          const wwSpotX = wwLeft
            ? clampPct(Math.max(safeNum(woodworkShooter?.x, 76), 74), 70, 84)
            : clampPct(Math.min(safeNum(woodworkShooter?.x, 24), 26), 16, 30);
          const wwSpotY = woodworkShooter ? clampPct(woodworkShooter.y, 34, 66) : 44;
          const woodworkLoose = {
            x: clampPct(wwLeft ? 81 : 19, 14, 86),
            y: clampPct(wwSpotY < 50 ? 31 : 69, 14, 86)
          };
          const woodworkCollector = pickNearestLiveOutfield(
            players,
            wwLeft ? props.rightBaseTokens : props.leftBaseTokens,
            woodworkLoose.x,
            woodworkLoose.y
          );

          // Defense Tackle Setup anchored near live positions
          const defensePlayer = getLivePlayer(players, atkTokens, hl.player, ['lcb', 'rcb', 'cdm', 'lb', 'rb']);
          const oppAttacker = getLivePlayer(players, defTokens, null, ['st', 'lw', 'rw', 'cam']);
          const tackleX = clampPct(
            lerp(safeNum(defensePlayer?.x, isLeftEvent ? 28 : 72), safeNum(oppAttacker?.x, isLeftEvent ? 32 : 68), 0.5),
            18,
            82
          );
          const tackleY = clampPct(lerp(defensePlayer?.y ?? 50, oppAttacker?.y ?? 50, 0.5), 18, 82);
          const defenseClearSpot = {
            x: clampPct(tackleX + dir * 14, 16, 84),
            y: clampPct(tackleY + (tackleY < 50 ? -10 : 10), 14, 86)
          };
          const defenseCollector = pickNearestLiveOutfield(
            players,
            atkTokens,
            defenseClearSpot.x,
            defenseClearSpot.y,
            defensePlayer ? [defensePlayer.key] : []
          );

          // Card / Foul + Free Kick Setup anchored near offender's live position
          const offender = getLivePlayer(players, atkTokens, hl.player, ['cdm', 'lcb', 'rcb', 'cm1', 'st']);
          const oppTarget = getLivePlayer(players, defTokens, null, ['cam', 'st', 'lw', 'rw']);
          const foulX = clampPct(safeNum(offender?.x, isLeftEvent ? 40 : 60), 22, 78);
          const foulY = clampPct(offender?.y ?? 50, 16, 84);

          // Throw-in Setup anchored near live touchline position
          const thrower = getLivePlayer(players, atkTokens, hl.player, ['lb', 'rb', 'cm1', 'lw', 'rw']);
          const throwTop = (thrower?.y ?? 50) < 50;
          const throwY = throwTop ? 3.2 : 96.8;
          const throwContestY = throwTop ? 9.5 : 90.5;
          const throwX = clampPct(thrower?.x ?? (isLeftEvent ? 48 : 52), 20, 80);
          const throwOpp = pickNearestLiveOutfield(players, defTokens, throwX, throwContestY);
          const throwReceiver = pickNearestLiveOutfield(
            players,
            atkTokens,
            throwX + dir * 10,
            throwTop ? 24 : 76,
            thrower ? [thrower.key] : []
          );

          sim.highlightState = {
            elapsedMs: 0,
            phase: 'init',
            phaseMs: 0,
            shotFromX: sim.ball.x,
            shotFromY: sim.ball.y,
            passFromX: sim.ball.x,
            passFromY: sim.ball.y,
            plan: {
              scorerKey: scorer?.key || null,
              playmakerKey: playmaker?.key || null,
              oppGkKey: oppGk?.key || null,
              oppShooterKey: oppShooter?.key || null,
              shootSpot,
              celebMates,
              gkKey: gk?.key || null,
              gkX,
              gkSaveY,
              oppShootSpot,
              isCornerRebound,
              cSpot,
              cTakerKey: cTaker?.key || null,
              cHeaderKey: cHeader?.key || null,
              cCollectorKey: cCollector?.key || null,
              saveReboundSpot,
              saveCollectorKey: saveCollector?.key || null,
              woodworkShooterKey: woodworkShooter?.key || null,
              wwSpotX,
              wwSpotY,
              woodworkLoose,
              woodworkCollectorKey: woodworkCollector?.key || null,
              defensePlayerKey: defensePlayer?.key || null,
              oppAttackerKey: oppAttacker?.key || null,
              tackleX,
              tackleY,
              defenseClearSpot,
              defenseCollectorKey: defenseCollector?.key || null,
              offenderKey: offender?.key || null,
              oppTargetKey: oppTarget?.key || null,
              foulX,
              foulY,
              throwerKey: thrower?.key || null,
              throwOppKey: throwOpp?.key || null,
              throwReceiverKey: throwReceiver?.key || null,
              throwX,
              throwY,
              throwContestY
            }
          };
        } else {
          sim.highlightState.elapsedMs += dtMs;
          sim.highlightState.phaseMs += dtMs;
        }

        const hs = sim.highlightState;
        const setPhase = (nextPhase) => {
          if (hs.phase !== nextPhase) {
            hs.phase = nextPhase;
            hs.phaseMs = 0;
            hs.shotFromX = sim.ball.x;
            hs.shotFromY = sim.ball.y;
            hs.passFromX = sim.ball.x;
            hs.passFromY = sim.ball.y;
          }
        };

        const reportImpact = () => {
          if (hs.impacted) return;
          hs.impacted = true;
          props.onHighlightImpact?.(hl);
        };
        const reportComplete = () => {
          if (hs.completed) return;
          hs.completed = true;
          props.onHighlightComplete?.(hl);
        };
        const tMs = hs.elapsedMs;
        const plan = hs.plan;

        // -----------------------------------------------------------------------
        // A. GOAL: receive, shoot, celebrate, then walk back to kickoff
        // Shot ALWAYS launches directly from scorer's live feet after ball arrives!
        // -----------------------------------------------------------------------
        if (evType === 'GOAL') {
          const scorer = players[plan.scorerKey];
          const playmaker = players[plan.playmakerKey];
          const oppGk = players[plan.oppGkKey];
          const isPenGoal = Boolean(hl.isPenalty);
          const goalLineX = isLeftEvent ? 97.1 : 2.9;
          const goalY = isPenGoal ? 43.5 : clampPct(lerp(plan.shootSpot.y, 50, 0.35), 42, 58);
          const kickOffTokens = isLeftEvent ? props.rightBaseTokens : props.leftBaseTokens;
          const kickOffTaker = getLivePlayer(players, kickOffTokens, null, ['st', 'cam', 'cm1']);
          const offsideLineX = getOffsideLineX(playersArr, actSide);
          if (hs.phase === 'init') setPhase(isPenGoal ? 'pen_setup' : 'to_playmaker');
          const celebrating = hs.phase === 'in_net';
          const restarting = hs.phase === 'restart';

          playersArr.forEach(tok => {
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (restarting) {
              tok.targetX = tok.key === kickOffTaker?.key ? 50 : tok.kickoffX;
              tok.targetY = tok.key === kickOffTaker?.key ? 50 : tok.kickoffY;
              if (tok.side === actSide && Math.hypot(tok.targetX - 50, tok.targetY - 50) < 10.5) {
                tok.targetX = isLeftEvent ? 39 : 61;
              }
              tok.maxSpd = 7.5;
              return;
            }
            const anchor = getShiftedAnchor(tok, sim.ball.x, sim.ball.y, actSide, null,
              hs.phase === 'to_playmaker' ? offsideLineX : null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            if (celebrating && (tok.key === scorer?.key || plan.celebMates.includes(tok.key))) {
              const idx = Math.max(0, plan.celebMates.indexOf(tok.key) + 1);
              tok.targetX = clampPct((scorer?.x ?? plan.shootSpot.x) - dir * idx * 3, 12, 88);
              tok.targetY = clampPct(plan.shootSpot.y + idx * 3, 12, 88);
              tok.isCelebrating = true;
              tok.maxSpd = 5.0;
            }
          });
          if (!restarting) {
            if (scorer) {
              scorer.isBallLocked = true;
              scorer.targetX = celebrating ? scorer.x : plan.shootSpot.x - (isPenGoal ? dir : 0);
              scorer.targetY = plan.shootSpot.y;
              scorer.maxSpd = 7.5;
              scorer.isStar = celebrating;
              scorer.isCelebrating = celebrating;
              if (celebrating) scorer.actionBadge = '🙌 GOAL!';
            }
            if (!isPenGoal && playmaker) {
              playmaker.isBallLocked = true;
              playmaker.targetX = hs.phase === 'to_playmaker' ? sim.ball.x : playmaker.x;
              playmaker.targetY = hs.phase === 'to_playmaker' ? sim.ball.y : playmaker.y;
              playmaker.maxSpd = 6.5;
            }
            if (oppGk) {
              oppGk.targetX = isLeftEvent ? 94.5 : 5.5;
              oppGk.targetY = hs.phase === 'shot' || celebrating ? (goalY < 50 ? 55 : 45) : 50;
              oppGk.maxSpd = 5.4;
              if (hs.phase === 'shot') oppGk.diveAngle = isLeftEvent ? 26 : -26;
            }
          }
          applyTargetSeparation(playersArr, 4.0, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'pen_setup') {
            const ready = moveBallSmoothTo(sim.ball, plan.shootSpot.x, plan.shootSpot.y, dtSec, 22);
            if (ready && scorer && Math.hypot(scorer.x - sim.ball.x, scorer.y - sim.ball.y) < 1.8 && hs.phaseMs >= 600) setPhase('shot');
          } else if (hs.phase === 'to_playmaker') {
            const arrived = moveBallSmoothTo(sim.ball, playmaker?.x ?? scorer.x, playmaker?.y ?? scorer.y, dtSec, 20);
            sim.carrierKey = null;
            if (arrived) setPhase('to_scorer');
          } else if (hs.phase === 'to_scorer') {
            const arrived = moveBallSmoothTo(sim.ball, scorer.x, scorer.y, dtSec, 20);
            sim.carrierKey = null;
            sim.passLine = { x1: hs.passFromX, y1: hs.passFromY, x2: scorer.x, y2: scorer.y, color: 'rgba(255,255,255,0.45)', dashed: true };
            if (arrived) setPhase('dribble_touch');
          } else if (hs.phase === 'dribble_touch') {
            moveBallSmoothTo(sim.ball, scorer.x + dir * 0.8, scorer.y, dtSec, 18);
            sim.carrierKey = scorer.key;
            if (hs.phaseMs >= 300 && Math.hypot(scorer.x - plan.shootSpot.x, scorer.y - plan.shootSpot.y) < 2 && Math.hypot(scorer.x - sim.ball.x, scorer.y - sim.ball.y) < 1.8) setPhase('shot');
          } else if (hs.phase === 'shot') {
            const arrived = moveBallSmoothTo(sim.ball, goalLineX, goalY, dtSec, 28);
            sim.carrierKey = null;
            sim.shotLine = { x1: hs.shotFromX, y1: hs.shotFromY, x2: sim.ball.x, y2: sim.ball.y, color: '#fbbf24' };
            if (arrived) {
              reportImpact();
              setPhase('in_net');
            }
          } else if (celebrating) {
            moveBallSmoothTo(sim.ball, isLeftEvent ? 98.5 : 1.5, goalY, dtSec, 12);
            sim.carrierKey = null;
            sim.netRippleSide = isLeftEvent ? 'right' : 'left';
            sim.goalSweepSide = actSide;
            sim.goalBanner = { side: actSide, scorerName: scorer.name, assistName: !isPenGoal ? hl.assistPlayer?.name : null, minute: hl.min };
            if (hs.phaseMs >= 1500) setPhase('restart');
          } else if (restarting) {
            sim.eventBanner = { text: 'HAI ĐỘI TRỞ VỀ VỊ TRÍ GIAO BÓNG', tone: 'amber' };
            const ballReady = moveBallSmoothTo(sim.ball, 50, 50, dtSec, 18);
            const teamReady = playersArr.every(tok => tok.isSentOff || Math.hypot(tok.x - tok.targetX, tok.y - tok.targetY) < 1.4);
            sim.carrierKey = null;
            if (ballReady && teamReady && hs.phaseMs >= 600) {
              resetOpenPlayState(sim, kickOffTaker, props.leftPoss);
              reportComplete();
            }
          }
          ballControlledThisFrame = true;

        // -----------------------------------------------------------------------
        // B. SAVE / PENALTY SAVED: shot contact, rebound or corner, recovery
        // -----------------------------------------------------------------------
        } else if (evType === 'SAVE' || evType === 'PENALTY_SAVED') {
          const gk = plan.gkKey ? players[plan.gkKey] : null;
          const oppShooter = plan.oppShooterKey ? players[plan.oppShooterKey] : null;
          const cTaker = plan.cTakerKey ? players[plan.cTakerKey] : null;
          const cHeader = plan.cHeaderKey ? players[plan.cHeaderKey] : null;
          const cCollector = plan.cCollectorKey ? players[plan.cCollectorKey] : null;
          const saveCollector = plan.saveCollectorKey ? players[plan.saveCollectorKey] : null;

          if (hs.phase === 'init') setPhase('approach');

          playersArr.forEach(tok => {
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (tok.slotId === 'gk') {
              if (!gk || tok.key !== gk.key) {
                tok.targetX = tok.liveX;
                tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.2, 42, 58);
                tok.maxSpd = 3.8;
              }
              return;
            }
            if (oppShooter && tok.key === oppShooter.key && ['approach', 'shot'].includes(hs.phase)) return;

            if (plan.isCornerRebound && (hs.phase === 'to_corner' || hs.phase === 'wait_corner_taker' || hs.phase === 'corner_cross' || hs.phase === 'corner_clear' || hs.phase === 'corner_done')) {
              if (cTaker && tok.key === cTaker.key) {
                tok.isSetPieceTaker = true;
                tok.isBallLocked = true;
                tok.targetX = plan.cSpot.x;
                tok.targetY = plan.cSpot.y;
                tok.maxSpd = 9.0;
                tok.resp = 4.0;
                if (hs.phase === 'wait_corner_taker' && Math.hypot(tok.x - plan.cSpot.x, tok.y - plan.cSpot.y) < 3.0) {
                  tok.actionBadge = '🚩 ĐÁ PHẠT GÓC';
                }
                return;
              }
              if (cHeader && tok.key === cHeader.key) {
                tok.targetX = isLeftEvent ? 14 : 86;
                tok.targetY = 48;
                tok.maxSpd = 6.5;
                if (hs.phase === 'corner_cross') tok.actionBadge = 'ĐÁNH ĐẦU!';
                return;
              }
              if (cCollector && tok.key === cCollector.key) {
                tok.isBallLocked = true;
                if (hs.phase === 'corner_done') {
                  tok.targetX = clampPct(tok.x + dir * 12, 14, 86);
                  tok.targetY = tok.y;
                  tok.maxSpd = 4.2;
                  tok.actionBadge = 'THU HỒI BÓNG';
                } else {
                  tok.targetX = hs.phase === 'corner_clear' ? plan.cSpot.x + dir * 20 : isLeftEvent ? 24 : 76;
                  tok.targetY = 47;
                  tok.maxSpd = 6.5;
                }
                return;
              }
              if (tok.side === oppSide) {
                tok.targetX = isLeftEvent ? 14 : 86;
                tok.targetY = clampPct(34 + (tok.idx % 4) * 10, 26, 74);
              } else {
                tok.targetX = isLeftEvent ? 11 : 89;
                tok.targetY = clampPct(36 + (tok.idx % 4) * 9, 28, 72);
              }
              enforceSetPieceDistance(tok, plan.cSpot.x, plan.cSpot.y, 9.0);
              tok.maxSpd = 5.5;
              return;
            }

            if (!plan.isCornerRebound && (hs.phase === 'rebound' || hs.phase === 'rebound_done') && saveCollector && tok.key === saveCollector.key) {
              tok.isBallLocked = true;
              if (hs.phase === 'rebound_done') {
                tok.targetX = clampPct(tok.x + dir * 12, 14, 86);
                tok.targetY = tok.y;
                tok.maxSpd = 4.2;
                tok.actionBadge = 'THU HỒI BÓNG';
              } else {
                tok.targetX = sim.ball.x;
                tok.targetY = sim.ball.y;
                tok.maxSpd = 7.5;
              }
              return;
            }

            const anchor = getShiftedAnchor(tok, sim.ball.x, sim.ball.y, oppSide, null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            tok.maxSpd = 4.6;
          });

          if (oppShooter && ['approach', 'shot'].includes(hs.phase)) {
            oppShooter.targetX = plan.oppShootSpot.x;
            oppShooter.targetY = plan.oppShootSpot.y;
            oppShooter.maxSpd = 7.2;
            oppShooter.isBallLocked = true;
          }
          if (gk) {
            gk.targetX = plan.gkX;
            gk.targetY = hs.phase === 'shot' || hs.phase === 'to_corner' || hs.phase === 'rebound' ? plan.gkSaveY : 50;
            gk.maxSpd = 5.8;
            gk.resp = 3.8;
            if (hs.phase === 'shot' || (hs.impacted && hs.phaseMs < 500)) gk.diveAngle = isLeftEvent ? -28 : 28;
            if (hs.impacted) {
              gk.isStar = true;
              gk.actionBadge = '🧤 CỨU THUA!';
            }
          }

          applyTargetSeparation(playersArr, 5.6, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'approach') {
            const sx = oppShooter ? oppShooter.x - dir * 1.1 : plan.oppShootSpot.x;
            const sy = oppShooter ? oppShooter.y : plan.oppShootSpot.y;
            const ballAtFeet = moveBallSmoothTo(sim.ball, sx, sy, dtSec, 22);
            sim.carrierKey = oppShooter?.key || null;
            if (ballAtFeet && tMs >= 1150) setPhase('shot');
          } else if (hs.phase === 'shot') {
            const shotSpd = 28;
            const arrived = moveBallSmoothTo(sim.ball, plan.gkX, plan.gkSaveY, dtSec, shotSpd);
            sim.carrierKey = null;
            sim.shotLine = { x1: hs.shotFromX, y1: hs.shotFromY, x2: sim.ball.x, y2: sim.ball.y, color: '#fb7185' };
            if (arrived) {
              reportImpact();
              setPhase(plan.isCornerRebound ? 'to_corner' : 'rebound');
            }
          } else if (plan.isCornerRebound) {
            sim.impactRing = { x: plan.gkX, y: plan.gkSaveY, color: '#fbbf24' };
            if (hs.phase === 'to_corner') {
              sim.eventBanner = { text: '🧤 CẢN PHÁ! BÓNG RA PHẠT GÓC', tone: 'amber' };
              const arrived = moveBallSmoothTo(sim.ball, plan.cSpot.x, plan.cSpot.y, dtSec, 17);
              sim.carrierKey = null;
              if (arrived) setPhase('wait_corner_taker');
            } else if (hs.phase === 'wait_corner_taker') {
              sim.eventBanner = { text: '🚩 ĐÁ PHẠT GÓC (CORNER KICK)', tone: 'amber' };
              moveBallSmoothTo(sim.ball, plan.cSpot.x, plan.cSpot.y, dtSec, 22);
              sim.carrierKey = cTaker?.key || null;
              // ONLY kick the corner when cTaker is physically standing at the corner flag!
              const takerAtFlag = !cTaker || Math.hypot(cTaker.x - plan.cSpot.x, cTaker.y - plan.cSpot.y) < 2.6;
              if (takerAtFlag && hs.phaseMs >= 350) setPhase('corner_cross');
            } else if (hs.phase === 'corner_cross') {
              sim.eventBanner = { text: '🚩 ĐÁ PHẠT GÓC (CORNER KICK)', tone: 'amber' };
              const hx = cHeader ? cHeader.x : isLeftEvent ? 14 : 86;
              const hy = cHeader ? cHeader.y : 48;
              const arrived = moveBallSmoothTo(sim.ball, hx, hy, dtSec, 18);
              sim.carrierKey = null;
              sim.passLine = { x1: hs.passFromX, y1: hs.passFromY, x2: hx, y2: hy, color: 'rgba(251,191,36,0.75)', dashed: true };
              if (arrived) setPhase('corner_clear');
            } else if (hs.phase === 'corner_clear') {
              sim.eventBanner = { text: '🚩 PHÁ BÓNG GIẢI NGUY!', tone: 'amber' };
              const cx = cCollector ? cCollector.x : isLeftEvent ? 26 : 74;
              const cy = cCollector ? cCollector.y : 47;
              const arrived = moveBallSmoothTo(sim.ball, cx, cy, dtSec, 15);
              if (arrived && (!cCollector || Math.hypot(cCollector.x - sim.ball.x, cCollector.y - sim.ball.y) < 3.0)) {
                setPhase('corner_done');
                if (cCollector) resetOpenPlayState(sim, cCollector, props.leftPoss);
              }
            } else {
              sim.eventBanner = { text: '🚩 THU HỒI BÓNG', tone: 'amber' };
              moveBallSmoothTo(sim.ball, cCollector ? cCollector.x + dir * 1.0 : sim.ball.x, cCollector ? cCollector.y : sim.ball.y, dtSec, 22);
              sim.carrierKey = cCollector?.key || null;
            }
          } else {
            sim.impactRing = { x: plan.gkX, y: plan.gkSaveY, color: '#fbbf24' };
            sim.eventBanner = { text: '🧤 THỦ MÔN CẢN PHÁ · THU HỒI BÓNG', tone: 'amber' };
            if (hs.phase === 'rebound') {
              const arrived = moveBallSmoothTo(sim.ball, plan.saveReboundSpot.x, plan.saveReboundSpot.y, dtSec, 13);
              const collectorAtBall = !saveCollector || Math.hypot(saveCollector.x - sim.ball.x, saveCollector.y - sim.ball.y) < 2.8;
              if (arrived && collectorAtBall) {
                setPhase('rebound_done');
                if (saveCollector) resetOpenPlayState(sim, saveCollector, props.leftPoss);
              }
            } else {
              moveBallSmoothTo(sim.ball, saveCollector ? saveCollector.x + dir * 1.0 : plan.saveReboundSpot.x, saveCollector ? saveCollector.y : plan.saveReboundSpot.y, dtSec, 22);
              sim.carrierKey = saveCollector?.key || null;
            }
          }
          ballControlledThisFrame = true;

        // -----------------------------------------------------------------------
        // C. WOODWORK: post contact and recovery
        // -----------------------------------------------------------------------
        } else if (evType === 'WOODWORK') {
          const shooter = plan.woodworkShooterKey ? players[plan.woodworkShooterKey] : null;
          const wwLeft = shooter ? shooter.side === 'left' : isLeftEvent;
          const postX = wwLeft ? 97.1 : 2.9;
          const postY = 43.2;
          const collector = plan.woodworkCollectorKey ? players[plan.woodworkCollectorKey] : null;

          if (hs.phase === 'init') setPhase('approach');

          playersArr.forEach(tok => {
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (tok.slotId === 'gk') {
              tok.targetX = tok.liveX;
              tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.25, 42, 58);
              tok.maxSpd = 4.2;
              return;
            }
            if (shooter && tok.key === shooter.key) return;
            if (collector && tok.key === collector.key && (hs.phase === 'rebound' || hs.phase === 'done')) {
              tok.isBallLocked = true;
              if (hs.phase === 'done') {
                tok.targetX = clampPct(tok.x + (wwLeft ? -12 : 12), 14, 86);
                tok.targetY = tok.y;
                tok.maxSpd = 4.2;
                tok.actionBadge = 'THU HỒI BÓNG';
              } else {
                tok.targetX = sim.ball.x;
                tok.targetY = sim.ball.y;
                tok.maxSpd = 7.2;
              }
              return;
            }
            const anchor = getShiftedAnchor(tok, sim.ball.x, sim.ball.y, wwLeft ? 'left' : 'right', null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            tok.maxSpd = 4.5;
          });
          if (shooter) {
            shooter.targetX = plan.wwSpotX;
            shooter.targetY = plan.wwSpotY;
            shooter.maxSpd = 7.2;
            shooter.isBallLocked = true;
            if (hs.impacted) shooter.isStar = true;
          }

          applyTargetSeparation(playersArr, 5.6, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'approach') {
            const sx = shooter ? shooter.x + (wwLeft ? 1.1 : -1.1) : plan.wwSpotX;
            const sy = shooter ? shooter.y : plan.wwSpotY;
            const ballAtFeet = moveBallSmoothTo(sim.ball, sx, sy, dtSec, 22);
            sim.carrierKey = shooter?.key || null;
            if (ballAtFeet && tMs >= 1150) setPhase('shot');
          } else if (hs.phase === 'shot') {
            const shotSpd = 28;
            const arrived = moveBallSmoothTo(sim.ball, postX, postY, dtSec, shotSpd);
            sim.carrierKey = null;
            sim.shotLine = { x1: hs.shotFromX, y1: hs.shotFromY, x2: sim.ball.x, y2: sim.ball.y, color: '#fbbf24' };
            if (arrived) { reportImpact(); setPhase('rebound'); }
          } else if (hs.phase === 'rebound') {
            sim.impactRing = { x: postX, y: postY, color: '#f59e0b' };
            sim.eventBanner = { text: '💥 XÀ NGANG / CỘT DỌC!', tone: 'amber' };
            const arrived = moveBallSmoothTo(sim.ball, plan.woodworkLoose.x, plan.woodworkLoose.y, dtSec, 13);
            const collectorAtBall = !collector || Math.hypot(collector.x - sim.ball.x, collector.y - sim.ball.y) < 2.8;
            if (arrived && collectorAtBall) {
              setPhase('done');
              if (collector) resetOpenPlayState(sim, collector, props.leftPoss);
            }
          } else {
            sim.eventBanner = { text: '💥 XÀ NGANG / CỘT DỌC!', tone: 'amber' };
            moveBallSmoothTo(sim.ball, collector ? collector.x : plan.woodworkLoose.x, collector ? collector.y : plan.woodworkLoose.y, dtSec, 22);
            sim.carrierKey = collector?.key || null;
          }
          ballControlledThisFrame = true;

        // -----------------------------------------------------------------------
        // D. DEFENSE: tackle on contact, then clearance
        // -----------------------------------------------------------------------
        } else if (evType === 'DEFENSE') {
          const defTok = plan.defensePlayerKey ? players[plan.defensePlayerKey] : null;
          const oppTok = plan.oppAttackerKey ? players[plan.oppAttackerKey] : null;
          const collector = plan.defenseCollectorKey ? players[plan.defenseCollectorKey] : null;

          if (hs.phase === 'init') setPhase('approach');

          playersArr.forEach(tok => {
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (tok.slotId === 'gk') {
              tok.targetX = tok.liveX;
              tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.22, 42, 58);
              tok.maxSpd = 3.8;
              return;
            }
            if ((defTok && tok.key === defTok.key) || (oppTok && tok.key === oppTok.key)) return;
            if (collector && tok.key === collector.key && (hs.phase === 'clear' || hs.phase === 'done')) {
              tok.isBallLocked = true;
              if (hs.phase === 'done') {
                tok.targetX = clampPct(tok.x + dir * 12, 14, 86);
                tok.targetY = tok.y;
                tok.maxSpd = 4.2;
                tok.actionBadge = 'THU HỒI BÓNG';
              } else {
                tok.targetX = sim.ball.x;
                tok.targetY = sim.ball.y;
                tok.maxSpd = 7.0;
              }
              return;
            }
            const anchor = getShiftedAnchor(tok, sim.ball.x, sim.ball.y, !hs.impacted ? oppSide : actSide, null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            tok.maxSpd = 4.4;
          });

          if (oppTok) {
            oppTok.isBallLocked = true;
            if (hs.phase === 'approach') {
              oppTok.targetX = plan.tackleX;
              oppTok.targetY = plan.tackleY;
              oppTok.maxSpd = 4.4;
            } else {
              oppTok.targetX = clampPct(oppTok.x + dir * 4.0, 14, 86);
              oppTok.targetY = oppTok.y;
              oppTok.maxSpd = 4.0;
            }
          }
          if (defTok) {
            defTok.isBallLocked = true;
            defTok.targetX = hs.phase === 'approach' && oppTok ? oppTok.x - dir * 0.6 : oppTok ? oppTok.x + dir * 1.2 : plan.tackleX;
            defTok.targetY = oppTok ? oppTok.y : plan.tackleY;
            defTok.maxSpd = 7.5;
            if (hs.impacted) {
              defTok.isStar = true;
              defTok.actionBadge = '🛡️ CẮT BÓNG';
            }
          }

          applyTargetSeparation(playersArr, 5.2, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'approach') {
            const ox = oppTok ? oppTok.x + dir * 0.9 : plan.tackleX;
            const oy = oppTok ? oppTok.y : plan.tackleY;
            moveBallSmoothTo(sim.ball, ox, oy, dtSec, 20);
            sim.carrierKey = oppTok?.key || null;
            if (defTok && oppTok && Math.hypot(defTok.x - sim.ball.x, defTok.y - sim.ball.y) < 2.5 && Math.hypot(oppTok.x - sim.ball.x, oppTok.y - sim.ball.y) < 2.5) { reportImpact(); setPhase('clear'); }
          } else if (hs.phase === 'clear') {
            sim.impactRing = { x: defTok ? defTok.x : plan.tackleX, y: defTok ? defTok.y : plan.tackleY, color: '#34d399' };
            sim.eventBanner = { text: '🛡️ CẢN PHÁ THÀNH CÔNG!', tone: 'amber' };
            const arrived = moveBallSmoothTo(sim.ball, plan.defenseClearSpot.x, plan.defenseClearSpot.y, dtSec, 13);
            const collectorAtBall = !collector || Math.hypot(collector.x - sim.ball.x, collector.y - sim.ball.y) < 2.8;
            if (arrived && collectorAtBall) {
              setPhase('done');
              if (collector) resetOpenPlayState(sim, collector, props.leftPoss);
            }
          } else {
            sim.eventBanner = { text: '🛡️ CẢN PHÁ THÀNH CÔNG!', tone: 'amber' };
            moveBallSmoothTo(sim.ball, collector ? collector.x + dir * 0.9 : plan.defenseClearSpot.x, collector ? collector.y : plan.defenseClearSpot.y, dtSec, 22);
            sim.carrierKey = collector?.key || null;
          }
          ballControlledThisFrame = true;

        // -----------------------------------------------------------------------
        // E. CARD / RED CARD: foul contact, whistle, free kick
        // -----------------------------------------------------------------------
        } else if (evType === 'CARD' || evType === 'RED_CARD') {
          const offender = plan.offenderKey ? players[plan.offenderKey] : null;
          const oppTarget = plan.oppTargetKey ? players[plan.oppTargetKey] : null;

          if (hs.phase === 'init') setPhase('approach');
          if (evType === 'RED_CARD' && offender && hs.impacted) {
            offender.isSentOff = true;
          }

          playersArr.forEach(tok => {
            if (offender && tok.key === offender.key) return;
            if (oppTarget && tok.key === oppTarget.key) return;
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (tok.slotId === 'gk') {
              tok.targetX = tok.liveX;
              tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.2, 42, 58);
              tok.maxSpd = 3.8;
              return;
            }
            const anchor = getShiftedAnchor(tok, plan.foulX, plan.foulY, oppSide, null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            if (hs.impacted && tok.side === actSide) {
              enforceSetPieceDistance(tok, plan.foulX, plan.foulY, 9.2);
            }
            tok.maxSpd = 4.6;
          });

          if (offender) {
            offender.isBallLocked = true;
            if (!hs.impacted || (hs.phase === 'foul_wait' && hs.phaseMs < 800)) {
              offender.targetX = plan.foulX;
              offender.targetY = plan.foulY;
              offender.maxSpd = 6.0;
            } else if (evType === 'RED_CARD') {
              offender.targetX = 50;
              offender.targetY = 1.2;
              offender.maxSpd = 7.0;
              offender.resp = 3.8;
            } else {
              offender.targetX = clampPct(plan.foulX - dir * 10, 14, 86);
              offender.targetY = plan.foulY;
              offender.maxSpd = 5.0;
            }
            if (hs.impacted) {
              offender.isStar = true;
              offender.cardBadge = evType === 'RED_CARD' ? 'RED' : 'YELLOW';
              offender.actionBadge = evType === 'RED_CARD' ? '🟥 TRUẤT QUYỀN' : '🟨 THẺ VÀNG';
            }
          }

          if (oppTarget) {
            oppTarget.isBallLocked = true;
            oppTarget.isSetPieceTaker = hs.impacted;
            oppTarget.targetX = plan.foulX;
            oppTarget.targetY = plan.foulY;
            oppTarget.maxSpd = 6.8;
            if (hs.phase === 'foul_wait') oppTarget.actionBadge = '⚽ ĐÁ PHẠT';
          }

          applyTargetSeparation(playersArr, 5.2, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'approach') {
            const tx = oppTarget ? oppTarget.x : plan.foulX;
            const ty = oppTarget ? oppTarget.y : plan.foulY;
            moveBallSmoothTo(sim.ball, tx, ty, dtSec, 20);
            sim.carrierKey = oppTarget?.key || null;
            if (tMs >= 1000 && offender && oppTarget && Math.hypot(offender.x - oppTarget.x, offender.y - oppTarget.y) < 3 && Math.hypot(sim.ball.x - oppTarget.x, sim.ball.y - oppTarget.y) < 2) { reportImpact(); setPhase('foul_wait'); }
          } else if (hs.phase === 'foul_wait') {
            moveBallSmoothTo(sim.ball, plan.foulX, plan.foulY, dtSec, 14);
            sim.carrierKey = oppTarget?.key || null;
            sim.impactRing = { x: plan.foulX, y: plan.foulY, color: evType === 'RED_CARD' ? '#f43f5e' : '#facc15' };
            sim.eventBanner = {
              text: evType === 'RED_CARD' ? '🟥 THẺ ĐỎ TRỰC TIẾP · ĐÁ PHẠT' : '🟨 THẺ VÀNG CẢNH CÁO · ĐÁ PHẠT',
              tone: evType === 'RED_CARD' ? 'rose' : 'amber'
            };
            const takerReady = !oppTarget || Math.hypot(oppTarget.x - plan.foulX, oppTarget.y - plan.foulY) < 2.6;
            if (takerReady && hs.phaseMs >= 1200 && Math.hypot(sim.ball.x - plan.foulX, sim.ball.y - plan.foulY) < 0.1) setPhase('fk_pass');
          } else {
            if (!plan.fkReceiverKey) plan.fkReceiverKey = pickNearestLiveOutfield(
              players,
              defTokens,
              plan.foulX - dir * 14,
              plan.foulY,
              oppTarget ? [oppTarget.key] : []
            )?.key;
            const fkReceiver = players[plan.fkReceiverKey];
            const fx = fkReceiver ? fkReceiver.x : plan.foulX - dir * 14;
            const fy = fkReceiver ? fkReceiver.y : plan.foulY;
            const arrived = moveBallSmoothTo(sim.ball, fx, fy, dtSec, 17);
            sim.passLine = { x1: hs.passFromX, y1: hs.passFromY, x2: fx, y2: fy, color: 'rgba(255,255,255,0.45)', dashed: true };
            if (arrived && fkReceiver) { resetOpenPlayState(sim, fkReceiver, props.leftPoss); reportComplete(); }
          }
          ballControlledThisFrame = true;

        // -----------------------------------------------------------------------
        // F. THROW-IN: touchline contest, ball out, thrower arrival, pass
        // -----------------------------------------------------------------------
        } else if (evType === 'THROW_IN') {
          const thrower = plan.throwerKey ? players[plan.throwerKey] : null;
          const throwOpp = plan.throwOppKey ? players[plan.throwOppKey] : null;
          const receiver = plan.throwReceiverKey ? players[plan.throwReceiverKey] : null;

          if (hs.phase === 'init') setPhase('contest');

          playersArr.forEach(tok => {
            if (tok.isSentOff) {
              tok.targetX = 50;
              tok.targetY = 1.2;
              return;
            }
            if (tok.slotId === 'gk') {
              tok.targetX = tok.liveX;
              tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.2, 42, 58);
              tok.maxSpd = 3.8;
              return;
            }
            if ((thrower && tok.key === thrower.key) || (throwOpp && tok.key === throwOpp.key) || (receiver && tok.key === receiver.key)) return;
            const anchor = getShiftedAnchor(tok, plan.throwX, plan.throwY, actSide, null);
            tok.targetX = anchor.x;
            tok.targetY = anchor.y;
            if (tMs >= 1800 && tok.side === oppSide) {
              enforceSetPieceDistance(tok, plan.throwX, plan.throwY, 5.5);
            }
            tok.maxSpd = 4.6;
          });

          if (throwOpp) {
            if (tMs < 1800) {
              throwOpp.targetX = plan.throwX;
              throwOpp.targetY = plan.throwContestY;
              throwOpp.maxSpd = 6.5;
            } else {
              throwOpp.targetX = clampPct(plan.throwX - dir * 5, 16, 84);
              throwOpp.targetY = plan.throwY < 50 ? 18 : 82;
              throwOpp.maxSpd = 5.0;
            }
          }

          if (thrower) {
            if (hs.phase === 'contest') {
              thrower.targetX = clampPct(plan.throwX + dir * 1.4, 14, 86);
              thrower.targetY = plan.throwContestY;
              thrower.maxSpd = 7.0;
            } else if (hs.phase !== 'done') {
              thrower.isSetPieceTaker = true;
              thrower.targetX = plan.throwX;
              thrower.targetY = plan.throwY;
              thrower.maxSpd = 8.0;
              if (tMs >= 1800) {
                thrower.isStar = true;
                thrower.actionBadge = '🙌 NÉM BIÊN';
              }
            } else {
              thrower.targetX = plan.throwX;
              thrower.targetY = plan.throwY < 50 ? 12 : 88;
              thrower.maxSpd = 5.0;
            }
          }

          if (receiver) {
            if (hs.phase === 'done') {
              receiver.targetX = clampPct(receiver.x + dir * 10, 16, 84);
              receiver.targetY = receiver.y;
              receiver.maxSpd = 4.2;
              receiver.actionBadge = 'NHẬN BÓNG';
            } else {
              receiver.targetX = clampPct(plan.throwX + dir * 10, 16, 84);
              receiver.targetY = plan.throwY < 50 ? 22 : 78;
              receiver.maxSpd = 5.5;
            }
          }

          applyTargetSeparation(playersArr, 5.0, 1);
          playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
          enforceGoalkeeperZone(playersArr);

          if (hs.phase === 'contest') {
            const tx = throwOpp ? throwOpp.x : plan.throwX;
            const ty = throwOpp ? throwOpp.y : plan.throwContestY;
            moveBallSmoothTo(sim.ball, tx, ty, dtSec, 20);
            sim.carrierKey = throwOpp?.key || null;
            if (tMs >= 1000) setPhase('deflect');
          } else if (hs.phase === 'deflect') {
            const arrived = moveBallSmoothTo(sim.ball, plan.throwX, plan.throwY, dtSec, 13);
            sim.carrierKey = null;
            if (arrived) { reportImpact(); setPhase('wait_thrower'); }
          } else if (hs.phase === 'wait_thrower') {
            moveBallSmoothTo(sim.ball, plan.throwX, plan.throwY, dtSec, 22);
            sim.carrierKey = thrower?.key || null;
            sim.eventBanner = { text: '🙌 NÉM BIÊN (THROW-IN)', tone: 'cyan' };
            const throwerAtLine = !thrower || Math.hypot(thrower.x - plan.throwX, thrower.y - plan.throwY) < 2.5;
            if (throwerAtLine && hs.phaseMs >= 450) setPhase('throw_pass');
          } else if (hs.phase === 'throw_pass') {
            sim.eventBanner = { text: '🙌 NÉM BIÊN (THROW-IN)', tone: 'cyan' };
            const rx = receiver ? receiver.x : plan.throwX + dir * 10;
            const ry = receiver ? receiver.y : plan.throwY < 50 ? 22 : 78;
            const arrived = moveBallSmoothTo(sim.ball, rx, ry, dtSec, 16);
            sim.carrierKey = null;
            sim.passLine = { x1: hs.passFromX, y1: hs.passFromY, x2: rx, y2: ry, color: 'rgba(34,211,238,0.7)', dashed: true };
            if (arrived && (!receiver || Math.hypot(receiver.x - sim.ball.x, receiver.y - sim.ball.y) < 2.8)) {
              setPhase('done');
              if (receiver) resetOpenPlayState(sim, receiver, props.leftPoss);
            }
          } else {
            moveBallSmoothTo(sim.ball, receiver ? receiver.x + dir * 0.9 : plan.throwX + dir * 10, receiver ? receiver.y : 50, dtSec, 22);
            sim.carrierKey = receiver?.key || null;
          }
          ballControlledThisFrame = true;
        }
        if (['corner_done', 'rebound_done', 'done'].includes(hs.phase) && hs.phaseMs >= 500) {
          reportComplete();
        }

      // =========================================================================
      // MODE 4: REALISTIC CONTINUOUS OPEN PLAY (Physical ball speed + player arrival gates)
      // =========================================================================
      } else {
        sim.lastHighlightRef = null;
        sim.highlightState = null;

        let carrier = players[sim.carrierKey];
        if (!carrier || carrier.slotId === 'gk' || carrier.isSentOff) {
          carrier = playersArr.filter(p => p.slotId !== 'gk' && !p.isSentOff).sort((a, b) => Math.hypot(a.x - sim.ball.x, a.y - sim.ball.y) - Math.hypot(b.x - sim.ball.x, b.y - sim.ball.y))[0];
          if (carrier) resetOpenPlayState(sim, carrier, props.leftPoss);
          sim.carrierKey = carrier?.key || null;
        }
        const op = sim.openPlay;
        op.timerMs += dtMs;

        const atkSide = carrier ? carrier.side : 'left';
        const atkDir = atkSide === 'left' ? 1 : -1;
        const leftOffsideX = getOffsideLineX(playersArr, 'left');
        const rightOffsideX = getOffsideLineX(playersArr, 'right');

        if (op.phase === 'DRIBBLE' && op.timerMs >= op.durationMs && carrier && Math.hypot(carrier.x - sim.ball.x, carrier.y - sim.ball.y) < 2) {
          op.timerMs = 0;

          if (op.streakCount >= op.targetStreak) {
            op.streakCount = 0;
            sim.turnoverCycle += 1;

            const defSide = carrier.side === 'left' ? 'right' : 'left';
            const defList = defSide === 'left' ? props.leftBaseTokens : props.rightBaseTokens;
            const presser = pickNearestLiveOutfield(players, defList, carrier.x, carrier.y);
            const nearSideline = carrier.y < 19 || carrier.y > 81;
            const presserDist = presser ? Math.hypot(presser.x - carrier.x, presser.y - carrier.y) : 99;

            if (nearSideline && presser && presserDist < 6.0 && sim.turnoverCycle % 5 === 0) {
              const throwTop = carrier.y < 50;
              op.phase = 'THROW_CONTEST';
              op.durationMs = 900;
              op.fromX = carrier.x;
              op.fromY = carrier.y;
              op.targetX = clampPct(carrier.x, 18, 82);
              op.targetY = throwTop ? 3.2 : 96.8;
              op.takerKey = presser.key;
              op.interceptorKey = carrier.key;
              op.throwSub = 'run';
            } else {
              const interceptor = presser || pickNearestLiveOutfield(players, defList, carrier.x, carrier.y);
              op.phase = 'INTERCEPT_WAIT';
              op.durationMs = 1100;
              op.interceptorKey = interceptor?.key || null;
              op.fromX = carrier.x;
              op.fromY = carrier.y;
              op.targetX = carrier.x;
              op.targetY = carrier.y;
            }
          } else {
            const pick = selectOpenPassTarget(carrier, playersArr, sim.prevCarrierKey, upcomingAtkSide, upcomingBuildupKey, sim.simTime);
            if (pick && pick.mate) {
              const leadX = clampPct(pick.mate.x + atkDir * 2.5, 14, 86);
              const leadY = clampPct(pick.mate.y + ((carrier.idx + op.streakCount) % 2 === 0 ? 1.2 : -1.2), 10, 90);
              op.phase = 'PASS_LEAD';
              op.durationMs = 2200;
              op.fromX = carrier.x;
              op.fromY = carrier.y;
              op.targetX = leadX;
              op.targetY = leadY;
              op.targetKey = pick.mate.key;
              sim.prevCarrierKey = carrier.key;
              op.streakCount += 1;
            } else {
              op.durationMs = 700;
            }
          }
        }

        const leadTargetTok = op.phase === 'PASS_LEAD' ? players[op.targetKey] : null;
        const intTok = op.phase === 'INTERCEPT_WAIT' ? players[op.interceptorKey] : null;
        const throwTaker = (op.phase === 'THROW_CONTEST' || op.phase === 'THROW_TAKE') ? players[op.takerKey] : null;
        const throwRecv = op.phase === 'THROW_TAKE' ? players[op.collectorKey] : null;

        playersArr.forEach(tok => {
          if (tok.isSentOff) {
            tok.targetX = 50;
            tok.targetY = 1.2;
            tok.maxSpd = 6.0;
            return;
          }
          if (tok.slotId === 'gk') {
            tok.targetX = tok.liveX;
            tok.targetY = clampPct(50 + (sim.ball.y - 50) * 0.25, 42, 58);
            tok.maxSpd = 3.8;
            return;
          }
          if (throwTaker && tok.key === throwTaker.key) {
            tok.isSetPieceTaker = true;
            if (op.phase === 'THROW_CONTEST') {
              tok.targetX = op.fromX;
              tok.targetY = op.fromY;
            } else {
              tok.targetX = op.targetX;
              tok.targetY = op.targetY;
              tok.actionBadge = 'NÉM BIÊN';
            }
            tok.maxSpd = 6.5;
            return;
          }
          if (throwRecv && tok.key === throwRecv.key) {
            tok.targetX = clampPct(op.fromX + (tok.side === 'left' ? 8 : -8), 16, 84);
            tok.targetY = op.fromY < 50 ? 22 : 78;
            tok.maxSpd = 5.0;
            return;
          }
          if (leadTargetTok && tok.key === leadTargetTok.key) {
            tok.isBallLocked = true;
            tok.targetX = op.targetX;
            tok.targetY = op.targetY;
            tok.maxSpd = 5.6;
            tok.resp = 3.2;
            return;
          }
          if (intTok && tok.key === intTok.key) {
            tok.isBallLocked = true;
            tok.targetX = carrier ? clampPct(carrier.x + atkDir * 1.4, 14, 86) : op.targetX;
            tok.targetY = carrier ? carrier.y : op.targetY;
            tok.maxSpd = 7.4;
            tok.resp = 3.6;
            return;
          }
          if (carrier && tok.key === carrier.key && (op.phase === 'DRIBBLE' || op.phase === 'INTERCEPT_WAIT')) {
            tok.isBallLocked = true;
            const rawDribbleX = clampPct(carrier.x + atkDir * 2.5, 16, 84);
            const rawDribbleY = clampPct(carrier.y + Math.sin(sim.simTime * 0.002 + carrier.idx) * 2.0, 14, 86);
            tok.targetX = rawDribbleX;
            tok.targetY = rawDribbleY;
            tok.maxSpd = 3.4;
            return;
          }
          if (upcomingAtkSide && upcomingBuildupKey === tok.key) {
            const lineX = tok.side === 'left' ? leftOffsideX : rightOffsideX;
            const rawX = tok.side === 'left' ? Math.max(66, tok.liveX + 12) : Math.min(34, tok.liveX - 12);
            tok.targetX = clampOnsideX(tok, rawX, sim.ball.x, lineX);
            tok.targetY = clampPct(tok.liveY, 20, 80);
            tok.maxSpd = 4.4;
            return;
          }
          const lineX = tok.side === 'left' ? leftOffsideX : rightOffsideX;
          const anchor = getShiftedAnchor(tok, sim.ball.x, sim.ball.y, sim.possSide, upcomingAtkSide, lineX);
          tok.targetX = anchor.x;
          tok.targetY = anchor.y;
          tok.maxSpd = 4.0;
        });

        applyTargetSeparation(playersArr, 5.8, 2);
        playersArr.forEach(tok => movePlayerSmooth(tok, tok.targetX, tok.targetY, dtSec, tok.maxSpd, tok.resp));
        enforceGoalkeeperZone(playersArr);

        if (op.phase === 'DRIBBLE' && carrier) {
          moveBallSmoothTo(sim.ball, clampPct(carrier.x + atkDir * 1.0, 4, 96), carrier.y, dtSec, 22);
        } else if (op.phase === 'PASS_LEAD') {
          const tx = leadTargetTok ? leadTargetTok.x : op.targetX;
          const ty = leadTargetTok ? leadTargetTok.y : op.targetY;
          const ballArrived = moveBallSmoothTo(sim.ball, tx, ty, dtSec, 17);
          const recvAtBall = !leadTargetTok || Math.hypot(leadTargetTok.x - sim.ball.x, leadTargetTok.y - sim.ball.y) < 2.6;
          sim.passLine = { x1: op.fromX, y1: op.fromY, x2: tx, y2: ty, color: 'rgba(255,255,255,0.35)', dashed: true };
          if (ballArrived && recvAtBall) {
            if (leadTargetTok && leadTargetTok.slotId !== 'gk' && !leadTargetTok.isSentOff) {
              sim.carrierKey = leadTargetTok.key;
              sim.possSide = leadTargetTok.side;
            }
            op.phase = 'DRIBBLE';
            op.timerMs = 0;
            op.durationMs = 850;
          }
        } else if (op.phase === 'INTERCEPT_WAIT') {
          if (carrier) {
            moveBallSmoothTo(sim.ball, clampPct(carrier.x + atkDir * 1.0, 4, 96), carrier.y, dtSec, 22);
          }
          const intAtBall = !intTok || Math.hypot(intTok.x - sim.ball.x, intTok.y - sim.ball.y) < 2.6;
          if (!intAtBall && op.timerMs > 3000) {
            op.phase = 'DRIBBLE';
            op.timerMs = 0;
            op.durationMs = 700;
          }
          if (intTok && intAtBall) {
            if (intTok && intTok.slotId !== 'gk' && !intTok.isSentOff) {
              sim.carrierKey = intTok.key;
              sim.possSide = intTok.side;
              sim.prevCarrierKey = null;
            }
            const teamPoss = (intTok?.side || 'left') === 'left' ? props.leftPoss : (100 - props.leftPoss);
            op.phase = 'DRIBBLE';
            op.timerMs = 0;
            op.durationMs = 500;
            op.targetStreak = teamPoss >= 55 ? 5 : 3;
          }
        } else if (op.phase === 'THROW_CONTEST') {
          const arrived = moveBallSmoothTo(sim.ball, op.targetX, op.targetY, dtSec, 13);
          if (arrived) {
            op.phase = 'THROW_TAKE';
            op.timerMs = 0;
            op.durationMs = 2200;
            op.fromX = op.targetX;
            op.fromY = op.targetY;
            op.throwSub = 'wait';
            const taker = players[op.takerKey];
            const takerTeam = taker?.side === 'left' ? props.leftBaseTokens : props.rightBaseTokens;
            const recv = pickNearestLiveOutfield(
              players,
              takerTeam,
              op.fromX + (taker?.side === 'left' ? 8 : -8),
              op.fromY < 50 ? 22 : 78,
              taker ? [taker.key] : []
            );
            op.collectorKey = recv?.key || null;
          }
        } else if (op.phase === 'THROW_TAKE') {
          if (op.throwSub === 'wait') {
            moveBallSmoothTo(sim.ball, op.targetX, op.targetY, dtSec, 22);
            const takerAtLine = !throwTaker || Math.hypot(throwTaker.x - op.targetX, throwTaker.y - op.targetY) < 2.4;
            if (takerAtLine && op.timerMs >= 350) {
              op.throwSub = 'pass';
            }
          } else {
            const rx = throwRecv ? throwRecv.x : op.fromX + 8;
            const ry = throwRecv ? throwRecv.y : op.fromY < 50 ? 22 : 78;
            const arrived = moveBallSmoothTo(sim.ball, rx, ry, dtSec, 15);
            if (arrived && throwRecv && Math.hypot(throwRecv.x - sim.ball.x, throwRecv.y - sim.ball.y) < 2.8) {
              if (throwRecv && throwRecv.slotId !== 'gk' && !throwRecv.isSentOff) {
                sim.carrierKey = throwRecv.key;
                sim.possSide = throwRecv.side;
                sim.prevCarrierKey = null;
              }
              op.phase = 'DRIBBLE';
              op.timerMs = 0;
              op.durationMs = 880;
            }
          }
        }
        ballControlledThisFrame = true;
      }

      if (!ballControlledThisFrame) {
        const c = players[sim.carrierKey];
        if (c) {
          moveBallSmoothTo(sim.ball, c.x, c.y, dtSec, 20);
        }
      }

      // Guard ball against any non-finite numbers
      sim.ball.x = clampPct(sim.ball.x, 1.0, 99.0);
      sim.ball.y = clampPct(sim.ball.y, 1.0, 99.0);

      setRenderFrame({
        tokens: playersArr.map(tok => ({
          key: tok.key,
          side: tok.side,
          name: tok.name,
          shortName: tok.shortName,
          photo: tok.photo,
          ovr: tok.ovr,
          x: tok.x,
          y: tok.y,
          diveAngle: tok.diveAngle,
          isStar: tok.isStar,
          isCelebrating: tok.isCelebrating,
          isSentOff: tok.isSentOff,
          cardBadge: tok.cardBadge,
          actionBadge: tok.actionBadge
        })),
        ballX: sim.ball.x,
        ballY: sim.ball.y,
        carrierKey: sim.carrierKey && Math.hypot(players[sim.carrierKey].x - sim.ball.x, players[sim.carrierKey].y - sim.ball.y) < 2.6 ? sim.carrierKey : null,
        netRippleSide: sim.netRippleSide,
        goalSweepSide: sim.goalSweepSide,
        goalBanner: sim.goalBanner,
        eventBanner: sim.eventBanner,
        passLine: sim.passLine,
        shotLine: sim.shotLine,
        impactRing: sim.impactRing,
        cameraStyle: { transform: 'scale(1)' }
      });

      rafId = requestAnimationFrame(stepSimulation);
    };

    rafId = requestAnimationFrame(stepSimulation);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const statusText = matchPhase === 'countdown'
    ? 'HAI ĐỘI ĐANG VÀO VỊ TRÍ KHAI CUỘC'
    : matchPhase === 'penalty'
    ? 'LOẠT SÚT LUÂN LƯU 11M TRỰC TIẾP'
    : matchPhase === 'finished'
    ? 'TOÀN CẢNH ĐỘI HÌNH SAU 90 PHÚT'
    : isHalfTime
    ? 'NGHỈ GIỮA HIỆP · HALF-TIME (45\')'
    : `${currentMinute <= 45 ? 'HIỆP 1' : 'HIỆP 2'} · PHÚT ${currentMinute}'`;

  return (
    <div className="match-pitch-panel w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-emerald-400 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {leftName}
          </span>
          <span className="text-slate-600 text-xs">vs</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-rose-400 truncate">
            {rightName}
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono-num text-[10px] font-bold text-amber-300 uppercase tracking-wider">
            {statusText}
          </span>
          {matchPhase === 'playing' && onToggleSpeed && (
            <button
              type="button"
              onClick={onToggleSpeed}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border font-mono-num text-[11px] font-extrabold transition-colors cursor-pointer ${
                simSpeed === 2
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
              title="Chuyển tốc độ mô phỏng 1x / 2x"
            >
              {simSpeed === 2 ? <FastForward className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{simSpeed}x</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative w-full flex-1 min-h-[340px] sm:min-h-[400px] md:min-h-[460px] xl:min-h-[500px] soccer-pitch rounded-lg overflow-hidden select-none">
        {renderFrame.goalBanner && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
            <div
              className={`px-6 py-2 rounded-xl border-2 shadow-[0_0_30px_rgba(251,191,36,0.6)] backdrop-blur-md text-center ${
                renderFrame.goalBanner.side === 'left'
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                  : 'bg-rose-950/90 border-rose-400 text-rose-200'
              }`}
            >
              <div className="font-display text-xl sm:text-2xl font-black tracking-widest text-amber-300 drop-shadow">
                ⚽ GOAL! · VÀOOO! ({renderFrame.goalBanner.minute}&apos;)
              </div>
              <div className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                {renderFrame.goalBanner.scorerName}
                {renderFrame.goalBanner.assistName ? ` · Kiến tạo: ${renderFrame.goalBanner.assistName}` : ''}
              </div>
            </div>
          </div>
        )}

        {renderFrame.eventBanner && !renderFrame.goalBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div
              className={`px-4 py-1.5 rounded-lg border text-xs font-display font-extrabold uppercase tracking-wider backdrop-blur-md shadow-xl ${
                renderFrame.eventBanner.tone === 'cyan'
                  ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                  : renderFrame.eventBanner.tone === 'rose'
                  ? 'bg-rose-950/90 border-rose-400 text-rose-200'
                  : 'bg-amber-950/90 border-amber-400 text-amber-200'
              }`}
            >
              {renderFrame.eventBanner.text}
            </div>
          </div>
        )}

        {isHalfTime && (
          <div className="absolute inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <div className="px-5 py-2.5 rounded-xl bg-slate-950/90 border-2 border-amber-400/80 text-center shadow-2xl">
              <div className="font-display text-lg md:text-xl font-extrabold uppercase tracking-widest text-amber-300">
                NGHỈ GIỮA HIỆP · HALF-TIME
              </div>
              <div className="font-mono-num text-xs text-slate-300 mt-0.5">
                Hết Hiệp 1 (45&apos;) · Hai đội trả bóng về giữa sân...
              </div>
            </div>
          </div>
        )}

        {renderFrame.goalSweepSide === 'left' && (
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden pointer-events-none z-20">
            <div className="goal-gold-sweep" />
          </div>
        )}
        {renderFrame.goalSweepSide === 'right' && (
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden pointer-events-none z-20">
            <div className="goal-gold-sweep" />
          </div>
        )}

        <div style={renderFrame.cameraStyle} className="absolute inset-0 w-full h-full">
          <svg viewBox="0 0 100 64" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none opacity-55">
            <rect x="3" y="3" width="94" height="58" fill="none" stroke="white" strokeWidth="0.35" />
            <line x1="50" y1="3" x2="50" y2="61" stroke="white" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="8.5" fill="none" stroke="white" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="0.6" fill="white" />
            <rect x="3" y="14" width="14" height="36" fill="none" stroke="white" strokeWidth="0.35" />
            <rect x="3" y="23" width="5.5" height="18" fill="none" stroke="white" strokeWidth="0.35" />
            <circle cx="13" cy="32" r="0.55" fill="white" />
            <rect x="83" y="14" width="14" height="36" fill="none" stroke="white" strokeWidth="0.35" />
            <rect x="91.5" y="23" width="5.5" height="18" fill="none" stroke="white" strokeWidth="0.35" />
            <circle cx="87" cy="32" r="0.55" fill="white" />

            <rect
              x={renderFrame.netRippleSide === 'left' ? '0.2' : '0.8'}
              y="26"
              width={renderFrame.netRippleSide === 'left' ? '2.8' : '2.2'}
              height="12"
              fill={renderFrame.netRippleSide === 'left' ? 'rgba(251,191,36,0.35)' : 'rgba(16,185,129,0.22)'}
              stroke={renderFrame.netRippleSide === 'left' ? '#fbbf24' : '#34d399'}
              strokeWidth={renderFrame.netRippleSide === 'left' ? '0.65' : '0.45'}
              className={renderFrame.netRippleSide === 'left' ? 'animate-pulse' : ''}
            />
            <rect
              x="97"
              y="26"
              width={renderFrame.netRippleSide === 'right' ? '2.8' : '2.2'}
              height="12"
              fill={renderFrame.netRippleSide === 'right' ? 'rgba(251,191,36,0.35)' : 'rgba(244,63,94,0.22)'}
              stroke={renderFrame.netRippleSide === 'right' ? '#fbbf24' : '#fb7185'}
              strokeWidth={renderFrame.netRippleSide === 'right' ? '0.65' : '0.45'}
              className={renderFrame.netRippleSide === 'right' ? 'animate-pulse' : ''}
            />
          </svg>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {renderFrame.passLine && (
              <line
                x1={renderFrame.passLine.x1}
                y1={renderFrame.passLine.y1}
                x2={renderFrame.passLine.x2}
                y2={renderFrame.passLine.y2}
                stroke={renderFrame.passLine.color}
                strokeWidth="0.7"
                strokeDasharray={renderFrame.passLine.dashed ? '1.8 1.4' : undefined}
                strokeLinecap="round"
              />
            )}
            {renderFrame.shotLine && (
              <line
                x1={renderFrame.shotLine.x1}
                y1={renderFrame.shotLine.y1}
                x2={renderFrame.shotLine.x2}
                y2={renderFrame.shotLine.y2}
                stroke={renderFrame.shotLine.color}
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            )}
            {renderFrame.impactRing && (
              <circle
                cx={renderFrame.impactRing.x}
                cy={renderFrame.impactRing.y}
                r="3.2"
                fill="none"
                stroke={renderFrame.impactRing.color}
                strokeWidth="0.85"
              />
            )}
          </svg>

          {renderFrame.tokens.map(tok => {
            const isLeft = tok.side === 'left';
            const isCarrier = renderFrame.carrierKey === tok.key;
            const borderClass = tok.isCelebrating
              ? 'border-amber-300 ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.95)]'
              : tok.isStar
              ? 'border-amber-300 ring-2 ring-amber-400/75 shadow-[0_0_14px_rgba(251,191,36,0.85)]'
              : isLeft
              ? 'border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';

            return (
              <div
                key={tok.key}
                style={{
                  left: `${tok.x}%`,
                  top: `${tok.y}%`,
                  transform: `translate(-50%, -50%) rotate(${tok.diveAngle || 0}deg)`
                }}
                data-player-key={tok.key}
                className={`absolute w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex flex-col items-center transition-transform duration-150 ease-out pointer-events-none ${
                  tok.isSentOff
                    ? 'opacity-45 scale-90 z-0'
                    : tok.isCelebrating
                    ? 'scale-125 z-30'
                    : tok.isStar
                    ? 'scale-115 z-30'
                    : isCarrier
                    ? 'scale-105 z-20'
                    : 'z-10'
                }`}
              >
                {tok.actionBadge && (
                  <span className="absolute bottom-full mb-1 px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-display text-[8px] font-black uppercase tracking-wider shadow whitespace-nowrap">
                    {tok.actionBadge}
                  </span>
                )}
                {tok.cardBadge && (
                  <span className="absolute -right-2 -top-2 text-xs leading-none drop-shadow">
                    {tok.cardBadge === 'RED' ? '🟥' : '🟨'}
                  </span>
                )}
                <div
                  className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 bg-slate-900 flex items-center justify-center ${borderClass}`}
                >
                  {tok.photo ? (
                    <img
                      src={tok.photo}
                      alt={tok.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span className="font-mono-num text-[9px] font-extrabold text-slate-200">
                      {tok.ovr}
                    </span>
                  )}
                </div>
                <span
                  className={`absolute top-full mt-0.5 px-1 rounded text-[8px] sm:text-[9px] font-bold leading-tight whitespace-nowrap ${
                    tok.isCelebrating || tok.isStar
                      ? 'bg-amber-400 text-slate-950 font-extrabold'
                      : isCarrier
                      ? isLeft
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                      : 'bg-slate-950/85 text-slate-100'
                  }`}
                >
                  {tok.shortName}
                </span>
              </div>
            );
          })}

          <div
            data-match-ball
            style={{ left: `${renderFrame.ballX}%`, top: `${renderFrame.ballY}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-amber-300 shadow-[0_0_16px_rgba(255,255,255,1),0_3px_8px_rgba(0,0,0,0.85)] flex items-center justify-center text-sm sm:text-base leading-none">
              ⚽
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
