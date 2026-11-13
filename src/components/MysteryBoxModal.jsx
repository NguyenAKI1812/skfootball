import React, { useEffect, useRef, useState } from 'react';
import PlayerCard from './PlayerCard';
import { Trophy, CheckCircle2, Clock } from 'lucide-react';

export default function MysteryBoxModal({
  winnerInfo,
  loserInfo,
  viewerRoleId = 'p1',
  tier1Player,
  tier2Player,
  roundCategoryName,
  p1CandidateSlots = [],
  p2CandidateSlots = [],
  isP2Bot,
  onConfirmPlacement
}) {
  const [opened, setOpened] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const isWinnerSelf = winnerInfo?.id === viewerRoleId;

  const [p1ChosenSlot, setP1ChosenSlot] = useState(p1CandidateSlots[0]?.id || null);
  const [p2ChosenSlot, setP2ChosenSlot] = useState(p2CandidateSlots[0]?.id || null);

  const latestSlotsRef = useRef({ p1SlotId: p1ChosenSlot, p2SlotId: p2ChosenSlot });
  latestSlotsRef.current = { p1SlotId: p1ChosenSlot, p2SlotId: p2ChosenSlot };
  const hasAutoClosedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpened(true);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (p1CandidateSlots.length > 0 && !p1ChosenSlot) {
      setP1ChosenSlot(p1CandidateSlots[0].id);
    }
    if (p2CandidateSlots.length > 0 && !p2ChosenSlot) {
      setP2ChosenSlot(p2CandidateSlots[0].id);
    }
  }, [p1CandidateSlots, p2CandidateSlots]);

  // Auto-close after 5 seconds with countdown
  useEffect(() => {
    if (countdown <= 0) {
      if (!hasAutoClosedRef.current) {
        hasAutoClosedRef.current = true;
        onConfirmPlacement(latestSlotsRef.current);
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onConfirmPlacement]);

  const selfInfo = isWinnerSelf ? winnerInfo : loserInfo;
  const oppInfo = isWinnerSelf ? loserInfo : winnerInfo;
  const selfPlayer = isWinnerSelf ? tier1Player : tier2Player;
  const oppPlayer = isWinnerSelf ? tier2Player : tier1Player;
  const selfIsP1 = viewerRoleId === 'p1';
  const selfSlots = selfIsP1 ? p1CandidateSlots : p2CandidateSlots;
  const oppSlots = selfIsP1 ? p2CandidateSlots : p1CandidateSlots;
  const selfChosenSlot = selfIsP1 ? p1ChosenSlot : p2ChosenSlot;
  const oppChosenSlot = selfIsP1 ? p2ChosenSlot : p1ChosenSlot;
  const setSelfChosenSlot = selfIsP1 ? setP1ChosenSlot : setP2ChosenSlot;
  const setOppChosenSlot = selfIsP1 ? setP2ChosenSlot : setP1ChosenSlot;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="broadcast-panel border border-slate-700 rounded-2xl max-w-4xl w-full p-5 md:p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Left-half green ambient glow to clearly identify your side */}
        <div className="absolute inset-y-0 left-0 w-1/2 pointer-events-none bg-gradient-to-r from-emerald-500/22 via-emerald-500/8 to-transparent" />
        
        {/* Compact Banner Title */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-amber-500/20 border border-amber-500/50 text-amber-300 font-display font-bold text-sm uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-amber-400" />
            {roundCategoryName?.toUpperCase()}
          </span>
          <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide">
            <span className={isWinnerSelf ? 'text-emerald-400' : 'text-rose-400'}>{winnerInfo?.name}</span> · {winnerInfo?.amount}M €
          </h2>
        </div>

        {/* Side-by-Side Result Cards: Left = Self (Green), Right = Opponent (Red) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-stretch text-left relative z-10">
          {/* Left: Self Side (Green) */}
          <div className="flex flex-col items-center bg-gradient-to-br from-emerald-950/60 via-slate-950/85 to-slate-950/80 p-4 rounded-xl border-2 border-emerald-400/70 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
            <div className="font-display text-base font-extrabold uppercase tracking-wide mb-2.5 self-start text-emerald-400">
              {selfInfo?.name}
            </div>
            
            <div className="w-full max-w-[320px] mb-3">
              {isWinnerSelf || opened ? (
                <PlayerCard player={selfPlayer} highlight={isWinnerSelf} size="modal" />
              ) : (
                <div 
                  onClick={() => setOpened(true)}
                  className="h-52 border border-dashed border-slate-600 rounded-xl bg-slate-950/80 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-all p-3"
                >
                  <span className="font-display text-base font-bold uppercase tracking-wider text-slate-300">
                    Đang mở thẻ...
                  </span>
                </div>
              )}
            </div>

            {/* Position Picker for Self */}
            <div className="w-full mt-auto pt-2.5 border-t border-emerald-500/25">
              <p className="text-[11px] text-emerald-300/85 text-center mb-1.5 font-medium">
                Chọn vào vị trí bên dưới để thay đổi chỗ xếp sân
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {selfSlots.map(slot => {
                  const isSelected = selfChosenSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelfChosenSlot(slot.id)}
                      className={`px-3 py-1 rounded text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      <span>{slot.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Opponent Side (Red) */}
          <div className="flex flex-col items-center bg-slate-950/75 p-4 rounded-xl border-2 border-rose-500/80">
            <div className="font-display text-base font-extrabold uppercase tracking-wide mb-2.5 self-start text-rose-400">
              {oppInfo?.name}
            </div>
            
            <div className="w-full max-w-[320px] mb-3">
              {!isWinnerSelf || opened ? (
                <PlayerCard player={oppPlayer} highlight={!isWinnerSelf} size="modal" />
              ) : (
                <div 
                  onClick={() => setOpened(true)}
                  className="h-52 border border-dashed border-slate-600 rounded-xl bg-slate-950/80 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-all p-3"
                >
                  <span className="font-display text-base font-bold uppercase tracking-wider text-slate-300">
                    Đang mở thẻ...
                  </span>
                </div>
              )}
            </div>

            {/* Position Picker for Opponent */}
            <div className="w-full mt-auto pt-2.5 border-t border-slate-800">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {oppSlots.map(slot => {
                  const isSelected = oppChosenSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setOppChosenSlot(slot.id)}
                      className={`px-3 py-1 rounded text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      <span>{slot.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-close Countdown Indicator */}
        <div className="w-full py-2.5 px-5 rounded-xl bg-slate-950/90 border border-slate-700/80 flex items-center justify-center gap-2.5 text-sm font-bold text-slate-200">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Tự động tiếp tục sau</span>
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono-num font-black text-base">
            {countdown}s
          </span>
        </div>
      </div>
    </div>
  );
}
