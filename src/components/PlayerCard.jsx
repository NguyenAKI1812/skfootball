import React, { useState } from 'react';

export default function PlayerCard({ player, compact = false, highlight = false, size = 'normal' }) {
  const [imgError, setImgError] = useState(false);

  if (!player) return null;

  const isTier1 = player.tier === 1;
  const posCode = player.subPos || player.position;

  if (compact) {
    return (
      <div
        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-xs transition-all ${
          isTier1
            ? 'bg-amber-950/35 border-amber-500/60 text-amber-100'
            : 'bg-slate-900/90 border-slate-700 text-slate-200'
        }`}
      >
        {player.photo && !imgError ? (
          <img
            src={player.photo}
            alt={player.name}
            onError={() => setImgError(true)}
            className="w-8 h-8 rounded object-cover object-top border border-amber-400/50 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-display font-bold text-sm text-amber-400 shrink-0">
            {player.ovr}
          </div>
        )}
        <span className="font-display font-extrabold text-base w-6 text-center text-amber-400 leading-none">
          {player.ovr}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-emerald-400 border border-slate-800 tracking-wider">
          {posCode}
        </span>
        <span className="font-bold truncate flex-1 text-white uppercase tracking-tight">
          {player.name}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">{player.nation}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-3.5 select-none transition-all duration-300 ${
        isTier1 ? 'fut-card-gold' : 'fut-card-silver'
      } ${highlight ? 'ring-2 ring-amber-400/80' : ''}`}
    >
      {/* Top Tier Ribbon */}
      <div className="flex justify-between items-center mb-2 relative z-10">
        <span
          className={`font-display text-[11px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm ${
            isTier1
              ? 'bg-amber-400 text-slate-950'
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          {isTier1 ? (player.era === 'Legend' ? 'ICON LEGEND' : 'SUPERSTAR') : 'ROLE PLAYER'}
        </span>
        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-amber-300/90 border border-amber-500/30 bg-black/40 px-2 py-0.5 rounded-sm">
          {player.badge || 'PRO'}
        </span>
      </div>

      {/* FUT-style Rating + Portrait Layout */}
      <div className={`relative flex items-center justify-center ${size === 'modal' ? 'gap-3 py-0.5' : 'gap-4 py-1'} z-10`}>
        {/* Stacked OVR & POS on left like an official FUT card */}
        <div className={`flex flex-col items-center justify-center ${size === 'modal' ? 'pr-2.5' : 'pr-3'} border-r border-amber-500/25`}>
          <span
            className={`font-display ${size === 'modal' ? 'text-4xl' : 'text-5xl'} font-extrabold leading-none tracking-tight ${
              isTier1 ? 'text-amber-300' : 'text-slate-100'
            }`}
          >
            {player.ovr}
          </span>
          <span className={`font-display ${size === 'modal' ? 'text-sm' : 'text-base'} font-bold tracking-widest text-emerald-400 mt-1`}>
            {posCode}
          </span>
        </div>

        {/* Crisp Portrait */}
        <div className="relative">
          {player.photo && !imgError ? (
            <div
              className={`${size === 'modal' ? 'w-24 h-24' : 'w-36 h-36'} rounded-lg overflow-hidden border shadow-lg ${
                isTier1 ? 'border-amber-400/70' : 'border-slate-500/70'
              }`}
            >
              <img
                src={player.photo}
                alt={player.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top"
              />
            </div>
          ) : (
            <div className={`${size === 'modal' ? 'w-24 h-24 text-3xl' : 'w-36 h-36 text-4xl'} rounded-lg bg-slate-800/90 flex items-center justify-center font-display font-extrabold text-amber-400 border border-slate-700`}>
              {player.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Clean Divider & Nameplate */}
      <div className={`${size === 'modal' ? 'mt-2 pt-1.5' : 'mt-3 pt-2'} border-t border-white/10 text-center relative z-10`}>
        <h3 className={`font-display ${size === 'modal' ? 'text-xl' : 'text-2xl'} font-extrabold text-white tracking-wide uppercase truncate leading-none`}>
          {player.name}
        </h3>
        <div className="text-[11px] text-slate-300 font-semibold mt-1 flex items-center justify-center gap-1.5 uppercase tracking-wider truncate">
          <span>{player.nation}</span>
          <span className="text-slate-600">/</span>
          <span className={isTier1 ? 'text-amber-400' : 'text-slate-300'}>{player.club}</span>
        </div>
      </div>
    </div>
  );
}
