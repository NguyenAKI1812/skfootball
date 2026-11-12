import React, { useState } from 'react';
import { SQUAD_POSITIONS, calcSquadStats, isOutOfPosition } from '../data/players';

export default function PitchView({ squad = {}, title = "SQUAD", budget = 100, onSwap, isOpponent = false, allowCamCdmChoice = false }) {
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [swapAlert, setSwapAlert] = useState(null);

  const { avgOvr, chemistry, players } = calcSquadStats(squad);

  // Mutual exclusion rule for CAM and CDM (during tactics phase, show both so manager can swap between CAM & CDM)
  const hasCAM = !!squad['cam'];
  const hasCDM = !!squad['cdm'];

  const visiblePositions = SQUAD_POSITIONS.filter(pos => {
    if (!allowCamCdmChoice) {
      if (pos.id === 'cam' && hasCDM) return false;
      if (pos.id === 'cdm' && hasCAM) return false;
    }
    return true;
  });

  const handleSlotClick = (pos) => {
    if (!onSwap) return;

    if (!selectedSlotId) {
      if (squad[pos.id]) {
        setSelectedSlotId(pos.id);
        setSwapAlert(`${squad[pos.id].name} — Chọn vị trí cùng tuyến để đổi chỗ`);
      }
      return;
    }

    if (selectedSlotId === pos.id) {
      setSelectedSlotId(null);
      setSwapAlert(null);
      return;
    }

    const prevPos = SQUAD_POSITIONS.find(p => p.id === selectedSlotId);
    if (!prevPos) return;

    if (prevPos.category !== pos.category) {
      setSwapAlert(`Chỉ được đổi trong tuyến ${prevPos.lineName}`);
      setTimeout(() => setSwapAlert(null), 2500);
      return;
    }

    onSwap(selectedSlotId, pos.id);
    setSelectedSlotId(null);
    setSwapAlert(`Đã cập nhật đội hình`);
    setTimeout(() => setSwapAlert(null), 1800);
  };

  return (
    <div
      className={`broadcast-panel rounded-xl p-3.5 flex flex-col justify-between relative select-none transition-all ${
        isOpponent
          ? 'border-2 border-rose-500/85 shadow-[0_0_24px_rgba(244,63,94,0.18)]'
          : 'border border-emerald-500/40'
      }`}
    >
      {/* Tactical Squad Header */}
      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Pure CSS Team Kit Accent Bar */}
          <span
            className={`w-1 h-7 rounded-sm shrink-0 ${
              isOpponent ? 'bg-rose-500' : 'bg-emerald-400'
            }`}
          />
          <div className="min-w-0">
            <h2
              className={`font-display text-lg font-extrabold tracking-wide uppercase leading-none truncate ${
                isOpponent ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {title}
            </h2>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
              SQUAD{' '}
              <span className={`font-mono-num font-bold ${isOpponent ? 'text-rose-300' : 'text-emerald-300'}`}>
                {players.length}/11
              </span>
            </div>
          </div>
        </div>

        {/* Budget, OVR & CHEM Stat Blocks */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="bg-slate-950/90 px-2.5 py-1 rounded border border-amber-500/35 text-center min-w-[52px]">
            <span className="text-[9px] text-slate-400 block font-bold tracking-wider leading-none">TIỀN</span>
            <span className="font-mono-num text-sm font-extrabold text-amber-300 leading-tight">{budget}M</span>
          </div>
          <div className="bg-slate-950/90 px-2.5 py-1 rounded border border-slate-800 text-center min-w-[42px]">
            <span className="text-[9px] text-slate-400 block font-bold tracking-wider leading-none">OVR</span>
            <span className="font-display text-base font-extrabold text-amber-400 leading-tight">{avgOvr}</span>
          </div>
          <div className="bg-slate-950/90 px-2.5 py-1 rounded border border-slate-800 text-center min-w-[44px]">
            <span className="text-[9px] text-slate-400 block font-bold tracking-wider leading-none">CHEM</span>
            <span className="font-display text-base font-extrabold text-cyan-400 leading-tight">{chemistry}</span>
          </div>
        </div>
      </div>

      {/* Swap Toast */}
      {swapAlert && (
        <div className="mb-2 px-2.5 py-1 rounded bg-slate-950 border border-amber-500/50 text-[11px] text-amber-300 font-semibold truncate">
          {swapAlert}
        </div>
      )}

      {/* Soccer Pitch Graphic */}
      <div
        className={`relative soccer-pitch rounded-lg overflow-hidden h-[510px] ${
          isOpponent ? 'ring-1 ring-rose-500/35' : ''
        }`}
      >
        {/* Crisp Pitch Chalk Markings */}
        <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-white/35 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 border-[1.5px] border-white/35 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
        {/* Top Penalty Box */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-b-[1.5px] border-x-[1.5px] border-white/35" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 border-b-[1.5px] border-x-[1.5px] border-white/30" />
        {/* Bottom Penalty Box */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-16 border-t-[1.5px] border-x-[1.5px] border-white/35" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-6 border-t-[1.5px] border-x-[1.5px] border-white/30" />

        {/* Empty Slots */}
        {visiblePositions.filter(pos => !squad[pos.id]).map(pos => (
          <div
            key={`empty-${pos.id}`}
            onClick={() => handleSlotClick(pos)}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition-all duration-300 active:scale-95 z-10"
          >
            <div
              className={`w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                selectedSlotId && SQUAD_POSITIONS.find(p => p.id === selectedSlotId)?.category === pos.category
                  ? 'border-cyan-300 bg-cyan-950/80 text-cyan-200 scale-110'
                  : 'border-white/45 bg-black/45 text-white/85 group-hover:border-amber-400 group-hover:text-amber-300'
              }`}
            >
              <span className="font-display text-xs font-bold tracking-wider leading-none">{pos.code}</span>
            </div>
            <div className="mt-1 px-1.5 py-0.5 rounded-sm bg-slate-950/90 border border-white/15 font-display text-[11px] font-bold tracking-wide text-white uppercase whitespace-nowrap shadow max-w-[88px] truncate text-center leading-none">
              {pos.code}
            </div>
          </div>
        ))}

        {/* Occupied Player Tokens (keyed by player.id so swapping smoothly slides across the pitch) */}
        {visiblePositions.filter(pos => !!squad[pos.id]).map(pos => {
          const player = squad[pos.id];
          const isT1 = player?.tier === 1;
          const isSelected = selectedSlotId === pos.id;
          const oop = isOutOfPosition(player, pos.code);
          const effectiveOvr = oop ? Math.max(50, player.ovr - 1) : player.ovr;

          return (
            <div
              key={player.id || pos.id}
              onClick={() => handleSlotClick(pos)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition-all duration-500 ease-out active:scale-95 ${
                isSelected ? 'z-30' : 'z-20'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform duration-200 relative ${
                  isSelected ? 'ring-3 ring-cyan-400 scale-115' : 'group-hover:scale-110'
                } ${
                  isT1
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-amber-200'
                    : 'bg-gradient-to-br from-slate-600 to-slate-800 border-2 border-slate-300'
                }`}
                title={oop ? `${player.name} (${effectiveOvr} OVR · Lệch vị trí ${player.subPos || player.position} → ${pos.code}: -1 OVR, -3 CHEM)` : `${player.name} (${player.ovr}) - ${player.subPos || player.position}`}
              >
                {player.photo ? (
                  <img
                    src={player.photo}
                    alt={player.name}
                    className="w-full h-full object-cover object-top rounded-full"
                  />
                ) : (
                  <span className="font-display text-base font-extrabold text-white">{effectiveOvr}</span>
                )}
                <span className={`absolute -bottom-1 -right-1 font-display text-[11px] font-extrabold px-1.5 py-0 rounded bg-slate-950 border leading-tight shadow ${
                  oop ? 'text-rose-400 border-rose-500/80' : 'text-amber-300 border-amber-500/80'
                }`}>
                  {effectiveOvr}
                </span>
              </div>

              {/* Clean Broadcast Nameplate */}
              <div className="mt-1 px-1.5 py-0.5 rounded-sm bg-slate-950/90 border border-white/15 font-display text-[11px] font-bold tracking-wide text-white uppercase whitespace-nowrap shadow max-w-[88px] truncate text-center leading-none">
                {player.name.split(' ').slice(-1)[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
