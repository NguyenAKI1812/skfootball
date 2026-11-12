import React, { useEffect, useState } from 'react';
import PlayerCard from './PlayerCard';
import { Trophy, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function MysteryBoxModal({
  winnerInfo,
  loserInfo,
  tier1Player,
  tier2Player,
  roundCategoryName,
  p1CandidateSlots = [],
  p2CandidateSlots = [],
  isP2Bot,
  onConfirmPlacement
}) {
  const [opened, setOpened] = useState(false);

  const isWinnerP1 = winnerInfo?.id === 'p1';

  const [p1ChosenSlot, setP1ChosenSlot] = useState(p1CandidateSlots[0]?.id || null);
  const [p2ChosenSlot, setP2ChosenSlot] = useState(p2CandidateSlots[0]?.id || null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpened(true);
    }, 400);
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

  const handleContinue = () => {
    onConfirmPlacement({
      p1SlotId: p1ChosenSlot,
      p2SlotId: p2ChosenSlot
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="broadcast-panel border border-slate-700 rounded-2xl max-w-3xl w-full p-4 md:p-5 text-center shadow-2xl relative overflow-hidden">
        
        {/* Compact Banner Title */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-amber-500/20 border border-amber-500/50 text-amber-300 font-display font-bold text-xs uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            {roundCategoryName?.toUpperCase()}
          </span>
          <h2 className="font-display text-xl font-extrabold text-white uppercase tracking-wide">
            <span className={isWinnerP1 ? 'text-emerald-400' : 'text-rose-400'}>{winnerInfo?.name}</span> · {winnerInfo?.amount}M €
          </h2>
        </div>

        {/* Side-by-Side Result Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5 items-stretch text-left">
          {/* Winner Side */}
          <div className={`flex flex-col items-center bg-slate-950/75 p-3 rounded-xl ${
            isWinnerP1 ? 'border border-emerald-500/50' : 'border-2 border-rose-500/80'
          }`}>
            <div className={`font-display text-sm font-extrabold uppercase tracking-wide mb-2 self-start ${
              isWinnerP1 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {winnerInfo?.name}
            </div>
            
            <div className="w-full max-w-[260px] mb-2.5">
              <PlayerCard player={tier1Player} highlight={true} size="modal" />
            </div>

            {/* Position Picker for Winner */}
            <div className="w-full mt-auto pt-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {(isWinnerP1 ? p1CandidateSlots : p2CandidateSlots).map(slot => {
                  const isSelected = (isWinnerP1 ? p1ChosenSlot : p2ChosenSlot) === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isWinnerP1 ? setP1ChosenSlot(slot.id) : setP2ChosenSlot(slot.id)}
                      className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? (isWinnerP1 ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white')
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

          {/* Loser Side */}
          <div className={`flex flex-col items-center bg-slate-950/75 p-3 rounded-xl ${
            isWinnerP1 ? 'border-2 border-rose-500/80' : 'border border-emerald-500/50'
          }`}>
            <div className={`font-display text-sm font-extrabold uppercase tracking-wide mb-2 self-start ${
              isWinnerP1 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {loserInfo?.name}
            </div>
            
            <div className="w-full max-w-[260px] mb-2.5">
              {opened ? (
                <PlayerCard player={tier2Player} size="modal" />
              ) : (
                <div 
                  onClick={() => setOpened(true)}
                  className="h-40 border border-dashed border-slate-600 rounded-xl bg-slate-950/80 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-all p-3"
                >
                  <span className="font-display text-sm font-bold uppercase tracking-wider text-slate-300">
                    Đang mở thẻ...
                  </span>
                </div>
              )}
            </div>

            {/* Position Picker for Loser */}
            <div className="w-full mt-auto pt-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {(isWinnerP1 ? p2CandidateSlots : p1CandidateSlots).map(slot => {
                  const isSelected = (isWinnerP1 ? p2ChosenSlot : p1ChosenSlot) === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isWinnerP1 ? setP2ChosenSlot(slot.id) : setP1ChosenSlot(slot.id)}
                      className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? (isWinnerP1 ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950') 
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

        {/* Action Button */}
        <button
          onClick={handleContinue}
          className="w-full py-3 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg transition-all flex items-center justify-center gap-2 mt-1"
        >
          <span>CONFIRM & NEXT ROUND</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
