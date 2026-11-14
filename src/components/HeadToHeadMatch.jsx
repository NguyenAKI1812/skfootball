import React, { useEffect, useRef, useState } from 'react';
import { Trophy, RotateCcw, WifiOff } from 'lucide-react';
import MatchPitch2D from './MatchPitch2D';
import { createMatch, stepMatch, matchSnapshot, MATCH_STEP, TACTICS } from '../utils/matchEngine';
import { calcSquadStats } from '../data/players';
import { sounds } from '../utils/sound';
import { acceptMatchPacket } from '../utils/matchPresentation';

const EMPTY_STATS = { shots: 0, saves: 0, tackles: 0, passes: 0 };
const EVENT_NAMES = { GOAL: 'Bàn thắng', SAVE: 'Cứu thua', MISS: 'Sút chệch', SHOT: 'Dứt điểm', TACKLE: 'Đoạt bóng', INTERCEPT: 'Cắt bóng', PENALTY: 'Luân lưu' };

export default function HeadToHeadMatch({ player1, player2, isP2Bot = false, onlineState = {}, matchRemoteMsg = null, onSendMatchMessage, onRestart }) {
  const [ready, setReady] = useState({ 1: false, 2: false });
  const [tactics, setTactics] = useState({ 1: 'balanced', 2: 'balanced' });
  const [frame, setFrame] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [waiting, setWaiting] = useState(false);
  const engineRef = useRef(null);
  const matchIdRef = useRef(null);
  const sequenceRef = useRef(-1);
  const lastPacketRef = useRef(0);
  const lastSoundRef = useRef(0);
  const publishRef = useRef(null);
  const latest = useRef(null);
  const roleRef = useRef(onlineState.role || onlineState.pendingRole || null);
  if (onlineState.role) roleRef.current = onlineState.role;
  const online = Boolean(roleRef.current);
  const guest = roleRef.current === 'guest';
  const self = guest ? 2 : 1;
  const other = 3 - self;
  const managers = { 1: player1, 2: player2 };
  const phase = frame?.phase || 'lobby';
  const started = phase !== 'lobby';
  latest.current = { online, guest, connected: onlineState.isConnected, send: onSendMatchMessage, speed, player1, player2, tactics };

  const toggleReady = team => {
    if (started || (online && team !== self)) return;
    const value = !ready[team];
    setReady(prev => ({ ...prev, [team]: value }));
    if (online) onSendMatchMessage?.({ type: 'MATCH_LIVE_READY', team, ready: value, tactic: tactics[team] });
  };
  const chooseTactic = (team, tactic) => {
    if (started || ready[team] || (online && team !== self) || !TACTICS[tactic]) return;
    setTactics(prev => ({ ...prev, [team]: tactic }));
    if (online) onSendMatchMessage?.({ type: 'MATCH_LIVE_TACTIC', team, tactic });
  };

  // Only the host simulates; duplicated or out-of-order network packets cannot rewind play.
  useEffect(() => {
    const msg = matchRemoteMsg;
    if (!online || !msg) return;
    if (msg.type === 'MATCH_LIVE_READY' && msg.team === other && !engineRef.current && !matchIdRef.current) {
      setReady(prev => ({ ...prev, [other]: Boolean(msg.ready) }));
      if (TACTICS[msg.tactic]) setTactics(prev => ({ ...prev, [other]: msg.tactic }));
    } else if (msg.type === 'MATCH_LIVE_TACTIC' && msg.team === other && !engineRef.current && !matchIdRef.current && TACTICS[msg.tactic]) {
      setTactics(prev => ({ ...prev, [other]: msg.tactic }));
    } else if (guest && msg.type === 'MATCH_LIVE_STATE' && msg.state?.version === 1) {
      const packet = msg.state;
      if (!acceptMatchPacket(packet, matchIdRef.current, sequenceRef.current)) return;
      matchIdRef.current = packet.matchId;
      sequenceRef.current = packet.sequence;
      lastPacketRef.current = performance.now();
      setWaiting(false);
      setFrame(packet);
      setTactics(packet.tactics);
      setSpeed(msg.speed === 2 ? 2 : 1);
      setCountdown(packet.countdown ?? 0);
    } else if (!guest && msg.type === 'MATCH_LIVE_REQUEST' && engineRef.current) {
      publishRef.current?.();
    }
  }, [matchRemoteMsg, online, guest, other]);

  useEffect(() => {
    if (!isP2Bot || online || started) return;
    const timer = setTimeout(() => setReady(prev => ({ ...prev, 2: true })), 700);
    return () => clearTimeout(timer);
  }, [isP2Bot, online, started]);

  // A monotonic fixed-step accumulator keeps results independent of screen refresh rate.
  useEffect(() => {
    if (guest || !ready[1] || !ready[2] || engineRef.current) return;
    const seed = Math.floor(Math.random() * 0xffffffff);
    matchIdRef.current = `${Date.now()}-${seed}`;
    const sim = createMatch({ player1: latest.current.player1, player2: latest.current.player2, tactics: latest.current.tactics, seed });
    engineRef.current = sim;
    let last = performance.now();
    let accumulator = 0;
    let kickoffCountdown = 3;
    let sendElapsed = 1;
    const sendFrame = () => {
      const next = { ...matchSnapshot(sim), phase: kickoffCountdown > 0 ? 'countdown' : sim.phase,
        countdown: Math.max(0, Math.ceil(kickoffCountdown)), matchId: matchIdRef.current, sequence: ++sequenceRef.current };
      setFrame(next);
      setCountdown(next.countdown);
      if (latest.current.online) latest.current.send?.({ type: 'MATCH_LIVE_STATE', state: next, speed: latest.current.speed });
    };
    publishRef.current = sendFrame;
    sendFrame();
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(0.2, Math.max(0, (now - last) / 1000));
      last = now;
      if (latest.current.online && !latest.current.connected) { setWaiting(true); return; }
      setWaiting(false);
      if (kickoffCountdown > 0) {
        kickoffCountdown = Math.max(0, kickoffCountdown - elapsed);
      } else if (sim.phase !== 'finished') {
        accumulator += elapsed * latest.current.speed;
        while (accumulator >= MATCH_STEP) { stepMatch(sim); accumulator -= MATCH_STEP; }
      }
      sendElapsed += elapsed;
      // Keep a small heartbeat after fulltime so the final result survives a dropped packet.
      if (sendElapsed >= (sim.phase === 'finished' ? 1 : 0.1)) { sendElapsed = 0; sendFrame(); }
    }, 1000 / 30);
    return () => { clearInterval(timer); publishRef.current = null; engineRef.current = null; };
  }, [guest, ready[1], ready[2]]);

  useEffect(() => {
    if (!guest) return;
    const timer = setInterval(() => {
      if (!matchIdRef.current) {
        if (latest.current.connected) latest.current.send?.({ type: 'MATCH_LIVE_REQUEST' });
        return;
      }
      const stale = performance.now() - lastPacketRef.current > 2500;
      setWaiting(stale);
      if (stale && latest.current.connected) latest.current.send?.({ type: 'MATCH_LIVE_REQUEST' });
    }, 1000);
    return () => clearInterval(timer);
  }, [guest]);

  useEffect(() => {
    if (!frame?.notice || frame.notice.id <= lastSoundRef.current) return;
    lastSoundRef.current = frame.notice.id;
    if (frame.notice.type === 'GOAL' || (frame.notice.type === 'PENALTY' && frame.notice.scored)) sounds.playFanfare();
    else if (frame.notice.type === 'SAVE') sounds.playGavel();
  }, [frame?.notice]);

  const left = managers[self], right = managers[other];
  const stats = frame?.stats || { 1: EMPTY_STATS, 2: EMPTY_STATS };
  const score = frame?.score || { 1: 0, 2: 0 };
  const possession = guest ? 100 - (frame?.possession ?? 50) : frame?.possession ?? 50;
  const notice = frame?.notice;
  const minute = frame?.minute || 0;
  const status = phase === 'lobby' ? 'CHỌN CHIẾN THUẬT' : phase === 'countdown' ? `KHAI CUỘC SAU ${countdown}`
    : phase === 'halftime' ? 'NGHỈ GIỮA HIỆP' : phase === 'penalty' ? 'LUÂN LƯU 11M'
    : phase === 'finished' ? 'HẾT TRẬN' : `${frame?.half === 2 ? 'HIỆP 2' : 'HIỆP 1'} · ${minute}'`;
  const hasPenalties = phase === 'penalty' || (frame?.penalties?.length || 0) > 0;

  return (
    <div className="broadcast-panel border border-slate-800 rounded-xl p-3 md:p-4 max-w-[1660px] mx-auto w-full">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-lg p-4 mb-3">
        <div className="min-w-0"><div className="font-display text-lg md:text-2xl font-extrabold text-emerald-400 uppercase truncate">{left.name}</div><p className="text-xs text-slate-400">{TACTICS[tactics[self]].label}</p></div>
        <div className="text-center"><p className="text-[10px] md:text-xs text-amber-300 font-bold mb-1">{status}</p><div className="font-mono-num text-4xl md:text-5xl font-extrabold">{score[self]} <span className="text-slate-600">–</span> {score[other]}</div>{hasPenalties && <p className="text-xs text-amber-300 mt-1">PEN {frame.penScore[self]} – {frame.penScore[other]}</p>}</div>
        <div className="min-w-0 text-right"><div className="font-display text-lg md:text-2xl font-extrabold text-rose-400 uppercase truncate">{right.name}</div><p className="text-xs text-slate-400">{TACTICS[tactics[other]].label}</p></div>
      </div>

      {waiting && <div className="flex gap-2 items-center rounded border border-amber-500/40 bg-amber-950/30 p-3 mb-3 text-sm text-amber-200"><WifiOff size={16} /> Đang chờ kết nối lại để tiếp tục trận đấu…</div>}

      {!started ? (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 text-center">
          <h2 className="font-display text-2xl font-extrabold text-white uppercase">TRẬN ĐẤU SỐNG</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto mt-2 mb-5">Chọn cách chơi cho đội của bạn. Cầu thủ tự tìm khoảng trống, phối hợp và dứt điểm; mỗi pha bóng quyết định kết quả.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {[self, other].map(team => {
              const info = calcSquadStats(managers[team].squad);
              const disabled = (online && team !== self) || ready[team];
              return <div key={team} className={`rounded-xl border p-4 text-left ${team === self ? 'border-emerald-500/40 bg-emerald-950/15' : 'border-rose-500/40 bg-rose-950/15'}`}>
                <h3 className={`font-display text-xl font-bold uppercase ${team === self ? 'text-emerald-400' : 'text-rose-400'}`}>{managers[team].name}</h3>
                <p className="text-xs text-slate-400 mb-3">OVR {info.avgOvr} · CHEM {info.chemistry}</p>
                <div className="grid grid-cols-2 gap-2">{Object.entries(TACTICS).map(([key, tactic]) => <button type="button" key={key} disabled={disabled} aria-pressed={tactics[team] === key} onClick={() => chooseTactic(team, key)} className={`text-left rounded-lg p-3 border transition-colors disabled:cursor-default ${tactics[team] === key ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}><span className="font-bold text-sm block">{tactic.label}</span><span className="text-[11px] text-slate-400 leading-snug block mt-1">{tactic.description}</span></button>)}</div>
                <button type="button" disabled={online && team !== self} onClick={() => toggleReady(team)} className={`w-full mt-4 py-3 rounded-lg font-bold disabled:opacity-50 ${ready[team] ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>{ready[team] ? 'ĐÃ SẴN SÀNG' : 'SẴN SÀNG'}</button>
              </div>;
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {[[`${possession}%`, 'Kiểm soát bóng', `${100 - possession}%`], [stats[self].shots, 'Dứt điểm', stats[other].shots], [stats[self].passes, 'Chuyền thành công', stats[other].passes], [stats[self].saves, 'Cứu thua', stats[other].saves]].map(([a, label, b]) => <div key={label} className="flex justify-between items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2"><strong className="text-emerald-400 font-mono-num">{a}</strong><span className="text-[10px] text-slate-400 uppercase text-center">{label}</span><strong className="text-rose-400 font-mono-num">{b}</strong></div>)}
          </div>
          {phase === 'finished' && <div className="rounded-xl border border-amber-500/60 bg-amber-950/20 p-4 mb-3 text-center"><Trophy className="inline text-amber-300 mr-2" /><strong className="font-display text-xl uppercase text-amber-300">{managers[frame.winner]?.name} giành chiến thắng!</strong>{frame.mvp && <p className="text-sm text-slate-300 mt-2">Cầu thủ xuất sắc: <strong className="text-white">{frame.mvp.name}</strong></p>}<button onClick={onRestart} className="mt-3 mx-auto flex items-center gap-2 px-5 py-2 bg-amber-400 text-slate-950 font-bold rounded"><RotateCcw size={16} /> Chơi trận mới</button></div>}
          <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-3">
            <MatchPitch2D leftSquad={left.squad} rightSquad={right.squad} leftTeamNum={self} rightTeamNum={other} leftName={left.name} rightName={right.name}
              currentMinute={minute} matchPhase={phase === 'halftime' ? 'playing' : phase} isHalfTime={phase === 'halftime'} simSpeed={speed}
              onToggleSpeed={!guest && phase !== 'finished' ? () => setSpeed(v => v === 1 ? 2 : 1) : null} liveSnapshot={frame} />
            <div className="flex flex-col gap-3 min-w-0">
              <div className={`rounded-xl border p-4 min-h-[140px] ${notice?.type === 'GOAL' ? 'border-amber-400 bg-amber-950/30' : 'border-slate-700 bg-slate-950/70'}`}>
                <div className="text-xs uppercase tracking-wider text-amber-300 font-bold mb-2">{phase === 'countdown' ? `Khai cuộc sau ${countdown}` : notice ? EVENT_NAMES[notice.type] : 'Diễn biến trên sân'}</div>
                {notice?.player && <div className="flex items-center gap-3 mb-2">{notice.player.photo && <img src={notice.player.photo} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />}<strong className={notice.team === self ? 'text-emerald-300' : 'text-rose-300'}>{notice.player.name}</strong></div>}
                <p className="text-sm leading-relaxed text-slate-200">{notice?.text || (phase === 'kickoff' ? 'Hai đội vào vị trí giao bóng.' : phase === 'penalty' ? 'Cầu thủ chuẩn bị thực hiện lượt sút tiếp theo.' : phase === 'finished' ? 'Trận đấu đã kết thúc.' : 'Các cầu thủ đang di chuyển tìm khoảng trống và tổ chức lên bóng.')}</p>
              </div>
              {hasPenalties && <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><h3 className="text-xs text-amber-300 font-bold uppercase mb-2">Loạt sút luân lưu</h3>{[self, other].map(team => <div key={team} className="flex gap-2 items-center my-2"><span className={`text-xs truncate w-24 ${team === self ? 'text-emerald-300' : 'text-rose-300'}`}>{managers[team].name}</span><div className="flex gap-1 flex-wrap">{frame.penalties.filter(k => k.team === team).map(k => <span key={k.round} title={k.shooter.name} className={`w-5 h-5 rounded-full text-center text-xs leading-5 ${k.scored ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'}`}>{k.scored ? '✓' : '×'}</span>)}</div></div>)}</div>}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex-1"><h3 className="font-display text-sm uppercase font-bold text-slate-300 border-b border-slate-800 pb-2">Nhật ký trận đấu</h3><div className="max-h-[340px] overflow-y-auto mt-2 space-y-2">{frame.events.length ? frame.events.map(ev => <div key={ev.id} className="flex gap-2 text-xs border-b border-slate-800/70 pb-2"><span className="font-mono-num text-amber-300 shrink-0 w-8">{ev.type === 'PENALTY' ? 'PEN' : `${ev.min}'`}</span><p className={ev.type === 'GOAL' ? 'text-amber-200 font-semibold' : 'text-slate-300'}>{ev.text}</p></div>) : <p className="text-xs text-slate-500">Chờ tình huống đầu tiên…</p>}</div></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
