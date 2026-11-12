import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function PlayerCard({ player, compact = false, highlight = false }) {
  const [imgError, setImgError] = useState(false);

  if (!player) return null;

  const isTier1 = player.tier === 1;

  if (compact) {
    return (
      <div 
        className={`relative flex items-center gap-2 p-2 rounded-xl border text-xs transition-all ${
          isTier1 
            ? 'bg-amber-950/40 border-amber-500/70 text-amber-200 shadow-md' 
            : 'bg-slate-800/80 border-slate-600 text-slate-200'
        }`}
      >
        {player.photo && !imgError ? (
          <img 
            src={player.photo} 
            alt={player.name} 
            onError={() => setImgError(true)}
            className="w-7 h-7 rounded-full object-cover border border-amber-400/50"
          />
        ) : (
          <span className="text-base">{player.image || '⚽'}</span>
        )}
        <span className="font-black text-sm w-7 text-center text-amber-400">
          {player.ovr}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-black/50 text-emerald-300">
          {player.subPos || player.position}
        </span>
        <span className="font-extrabold truncate flex-1 text-white">{player.name}</span>
        <span className="text-[10px] opacity-75 font-medium">{player.nation}</span>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-2xl p-3.5 text-center select-none transition-all duration-300 ${
        isTier1 ? 'tier1-card' : 'tier2-card'
      } ${highlight ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/20' : ''}`}
    >
      {/* Top Header Badge */}
      <div className="flex justify-between items-center mb-2">
        <span 
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
            isTier1 
              ? 'bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 font-black' 
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          {isTier1 ? <Star className="w-3 h-3 fill-slate-950" /> : null}
          {isTier1 ? (player.era === 'Legend' ? 'LEGEND' : 'STAR') : 'MID-TIER'}
        </span>
        <span className="text-[10px] font-black text-amber-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          {player.badge || 'PRO'}
        </span>
      </div>

      {/* Real Player Photo with OVR & POS overlay */}
      <div className="relative py-1 flex flex-col items-center">
        <div className="relative">
          {player.photo && !imgError ? (
            <div className={`w-28 h-28 rounded-2xl overflow-hidden border-2 shadow-xl ${
              isTier1 ? 'border-amber-400 shadow-amber-500/30' : 'border-slate-500 shadow-slate-900/50'
            }`}>
              <img 
                src={player.photo} 
                alt={player.name} 
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300" 
              />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-slate-800 flex items-center justify-center text-5xl shadow-inner border border-slate-700">
              {player.image || '⚽'}
            </div>
          )}

          {/* OVR Floating Badge */}
          <div className="absolute -bottom-2 -left-2 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 px-2 py-1 rounded-xl font-black text-lg shadow-lg border border-yellow-200 leading-none flex flex-col items-center">
            <span>{player.ovr}</span>
          </div>

          {/* Position Floating Badge */}
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white px-2 py-1 rounded-xl font-black text-xs shadow-lg border border-emerald-400 leading-none flex flex-col items-center">
            <span>{player.subPos || player.position}</span>
          </div>
        </div>

        {/* Name and Nation */}
        <h3 className="text-lg font-black text-white mt-3 tracking-wide uppercase truncate max-w-full">
          {player.name}
        </h3>
        <p className="text-[11px] text-slate-300 font-semibold mt-0.5 flex items-center gap-1.5">
          <span>{player.nation}</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-400">{player.club}</span>
        </p>
      </div>
    </div>
  );
}
