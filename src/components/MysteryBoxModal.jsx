import React, { useEffect, useState } from 'react';
import PlayerCard from './PlayerCard';
import { Trophy, ArrowRight, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

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
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });

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
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-2xl w-full p-5 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Banner Title */}
        <div className="mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-xs mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            ROUND COMPLETED · {roundCategoryName?.toUpperCase()}
          </div>
          <h2 className="text-xl font-black text-white">
            <span className="text-amber-400">{winnerInfo?.name}</span> WON ({winnerInfo?.amount}M €)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select pitch slots to position your players:
          </p>
        </div>

        {/* Side-by-Side Result Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 items-stretch text-left">
          {/* Winner Side */}
          <div className="flex flex-col items-center bg-slate-950/70 p-3 rounded-2xl border border-amber-500/40">
            <div className="text-xs font-black text-amber-400 mb-1.5 flex items-center gap-1 self-start">
              <span>{winnerInfo?.avatar}</span>
              <span>{winnerInfo?.name} (WON AUCTION)</span>
            </div>
            
            <div className="w-full max-w-[200px] mb-2">
              <PlayerCard player={tier1Player} highlight={true} />
            </div>

            {/* Position Picker for Winner */}
            <div className="w-full mt-auto pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-300 block mb-1">
                Assign Slot:
              </span>
              <div className="flex flex-wrap gap-1">
                {(isWinnerP1 ? p1CandidateSlots : p2CandidateSlots).map(slot => {
                  const isSelected = (isWinnerP1 ? p1ChosenSlot : p2ChosenSlot) === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isWinnerP1 ? setP1ChosenSlot(slot.id) : setP2ChosenSlot(slot.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-amber-500 text-slate-950 shadow ring-1 ring-amber-300' 
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
          <div className="flex flex-col items-center bg-slate-950/70 p-3 rounded-2xl border border-slate-700">
            <div className="text-xs font-black text-slate-300 mb-1.5 flex items-center gap-1 self-start">
              <span>{loserInfo?.avatar}</span>
              <span>{loserInfo?.name} (MID-TIER FALLBACK)</span>
            </div>
            
            <div className="w-full max-w-[200px] mb-2">
              {opened ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <PlayerCard player={tier2Player} />
                </div>
              ) : (
                <div 
                  onClick={() => setOpened(true)}
                  className="h-44 border border-dashed border-cyan-500/60 rounded-2xl bg-slate-950/80 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 transition-all p-3"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-950 flex items-center justify-center text-2xl mb-1 border border-cyan-500/40">
                    🎁
                  </div>
                  <span className="text-xs font-extrabold text-cyan-300">
                    Opening Card...
                  </span>
                </div>
              )}
            </div>

            {/* Position Picker for Loser */}
            <div className="w-full mt-auto pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-300 block mb-1">
                Assign Slot:
              </span>
              <div className="flex flex-wrap gap-1">
                {(isWinnerP1 ? p2CandidateSlots : p1CandidateSlots).map(slot => {
                  const isSelected = (isWinnerP1 ? p2ChosenSlot : p1ChosenSlot) === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isWinnerP1 ? setP2ChosenSlot(slot.id) : setP1ChosenSlot(slot.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                        isSelected 
                          ? (isWinnerP1 ? 'bg-rose-600 text-white shadow ring-1 ring-rose-300' : 'bg-emerald-500 text-slate-950 shadow ring-1 ring-emerald-300') 
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
