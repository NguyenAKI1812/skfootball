import React, { useState } from 'react';
import { SQUAD_POSITIONS } from '../data/players';
import { Users, ArrowLeftRight } from 'lucide-react';

export default function PitchView({ squad = {}, title = "SQUAD", budget = 100, onSwap }) {
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [swapAlert, setSwapAlert] = useState(null);

  const players = Object.values(squad).filter(Boolean);
  const totalOvr = players.reduce((sum, p) => sum + p.ovr, 0);
  const avgOvr = players.length > 0 ? Math.round(totalOvr / players.length) : 0;

  // Chemistry calculation
  let chemistry = 50;
  const nationCounts = {};
  const clubCounts = {};
  players.forEach(p => {
    nationCounts[p.nation] = (nationCounts[p.nation] || 0) + 1;
    clubCounts[p.club] = (clubCounts[p.club] || 0) + 1;
  });
  Object.values(nationCounts).forEach(cnt => { if (cnt >= 2) chemistry += (cnt - 1) * 8; });
  Object.values(clubCounts).forEach(cnt => { if (cnt >= 2) chemistry += (cnt - 1) * 10; });
  chemistry = Math.min(100, Math.max(30, chemistry));

  // Mutual exclusion rule for CAM and CDM:
  // If squad has CAM, hide CDM. If squad has CDM, hide CAM. If neither, show both!
  const hasCAM = !!squad['cam'];
  const hasCDM = !!squad['cdm'];

  const visiblePositions = SQUAD_POSITIONS.filter(pos => {
    if (pos.id === 'cam' && hasCDM) return false;
    if (pos.id === 'cdm' && hasCAM) return false;
    return true;
  });

  const handleSlotClick = (pos) => {
    if (!onSwap) return;

    if (!selectedSlotId) {
      if (squad[pos.id]) {
        setSelectedSlotId(pos.id);
        setSwapAlert(`Selected ${squad[pos.id].name}. Click another slot in same line to swap/move!`);
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
      setSwapAlert(`⚠️ Invalid: ${prevPos.lineName} can only swap with ${prevPos.lineName}!`);
      setTimeout(() => setSwapAlert(null), 3000);
      return;
    }

    onSwap(selectedSlotId, pos.id);
    setSelectedSlotId(null);
    setSwapAlert(`Positions updated!`);
    setTimeout(() => setSwapAlert(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 flex flex-col justify-between shadow-2xl relative select-none">
      {/* Header Info */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-1.5 uppercase">
            <Users className="w-4 h-4 text-emerald-400" />
            {title}
          </h2>
          <span className="text-[10px] text-slate-400">
            PLAYERS: <strong className="text-emerald-400">{players.length}/11</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-center">
            <span className="text-[8px] text-slate-400 block font-black leading-none">OVR</span>
            <span className="text-xs font-black text-amber-400 leading-tight font-mono">{avgOvr}</span>
          </div>
          <div className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-center">
            <span className="text-[8px] text-slate-400 block font-black leading-none">CHEM</span>
            <span className="text-xs font-black text-cyan-400 leading-tight font-mono">{chemistry}</span>
          </div>
        </div>
      </div>

      {/* Alert / Guidance Toast */}
      {swapAlert && (
        <div className="mb-1.5 px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/50 text-[10px] text-amber-300 flex items-center gap-1 font-bold animate-pulse">
          <ArrowLeftRight className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">{swapAlert}</span>
        </div>
      )}

      {/* Soccer Pitch Graphic - Larger Tokens */}
      <div className="relative soccer-pitch rounded-2xl overflow-hidden h-[480px]">
        {/* Pitch Markings */}
        <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-white/40 -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-24 h-24 border border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-b border-x border-white/40"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-16 border-t border-x border-white/40"></div>

        {/* Player Slots on Pitch - Significantly Larger */}
        {visiblePositions.map(pos => {
          const player = squad[pos.id];
          const isOccupied = !!player;
          const isT1 = player?.tier === 1;
          const isSelected = selectedSlotId === pos.id;

          return (
            <div
              key={pos.id}
              onClick={() => handleSlotClick(pos)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition-transform active:scale-95 z-10"
            >
              {isOccupied ? (
                <div 
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all relative ${
                    isSelected ? 'ring-4 ring-cyan-400 scale-125 z-20 animate-bounce' : 'hover:scale-115'
                  } ${
                    isT1 
                      ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-2 border-amber-300 shadow-amber-500/50' 
                      : 'bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-400 shadow-slate-900/60'
                  }`}
                  title={`${player.name} (${player.ovr}) - ${player.subPos || player.position}`}
                >
                  {/* Photo or Icon - Large and crisp */}
                  {player.photo ? (
                    <img 
                      src={player.photo} 
                      alt="" 
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-sm font-black">{player.ovr}</span>
                  )}
                  {/* Floating OVR pill */}
                  <span className="absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded-md bg-black/95 text-amber-300 border border-amber-500/80 leading-none shadow">
                    {player.ovr}
                  </span>
                </div>
              ) : (
                <div className={`w-11 h-11 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                  selectedSlotId && SQUAD_POSITIONS.find(p => p.id === selectedSlotId)?.category === pos.category
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 scale-115 animate-pulse shadow-lg'
                    : 'border-white/45 bg-black/50 text-white/80 hover:border-amber-400 hover:text-amber-300'
                }`}>
                  <span className="text-[10px] font-black leading-none">{pos.code}</span>
                </div>
              )}

              {/* Tag under slot */}
              <div className="mt-1 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-sm text-[9px] font-extrabold text-white whitespace-nowrap shadow max-w-[85px] truncate text-center leading-tight">
                {isOccupied ? player.name.split(' ').slice(-1)[0] : pos.code}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
