import React from 'react';
import PlayerCard from './PlayerCard';
import { Clock, ArrowUpCircle, Flame, Bot, User, CheckCircle2, TrendingUp, ShieldAlert } from 'lucide-react';

export default function AuctionArena1v1({
  currentRound,
  totalRounds = 11,
  currentRoundInfo,
  currentTier1Player,
  timeLeft,
  currentBid,
  highestBidder,
  player1,
  player2,
  p1MaxBid,
  p2MaxBid,
  onP1Bid,
  onP1Pass,
  onP2Bid,
  onP2Pass,
  p1Passed,
  p2Passed,
  isP2Bot,
  onToggleP2Bot,
  bidHistory = [],
  isAuctionActive,
  isP1Disabled = false,
  isP2Disabled = false
}) {
  const isUrgent = timeLeft <= 4 && timeLeft > 0;
  const isP1Highest = highestBidder?.id === player1.id;
  const isP2Highest = highestBidder?.id === player2.id;

  // Derive each player's latest bid on this current player
  const p1LastBid = bidHistory.filter(b => b.playerId === player1.id).slice(-1)[0]?.amount || null;
  const p2LastBid = bidHistory.filter(b => b.playerId === player2.id).slice(-1)[0]?.amount || null;

  const categoryNames = {
    GK: 'GOALKEEPER (GK)',
    DF: 'DEFENDER (DF)',
    MF: 'MIDFIELDER (MF)',
    FW: 'FORWARD (FW)'
  };

  const categoryBadgeColors = {
    GK: 'bg-yellow-950/80 text-yellow-300 border-yellow-500/50',
    DF: 'bg-blue-950/80 text-blue-300 border-blue-500/50',
    MF: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
    FW: 'bg-red-950/80 text-red-300 border-red-500/50'
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-2xl relative">
      {/* Top Header: Round + Position + Timer */}
      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-500/40">
            ROUND {currentRound}/{totalRounds}
          </span>
          <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${categoryBadgeColors[currentRoundInfo?.category] || 'bg-slate-800 text-slate-300'}`}>
            {categoryNames[currentRoundInfo?.category] || currentRoundInfo?.category}
          </span>
        </div>

        {/* Real-time Countdown Timer */}
        <div 
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${
            isUrgent 
              ? 'bg-red-950/80 border-red-500 text-red-400 timer-urgent shadow-[0_0_20px_rgba(239,68,68,0.7)]' 
              : 'bg-slate-950 border-slate-700 text-amber-400'
          }`}
        >
          <Clock className={`w-4 h-4 ${isUrgent ? 'animate-spin' : ''}`} />
          <span className="text-xl font-black font-mono w-9 text-center">
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Main Duel Section: P1 Bid Stand (Left) <---> Player Card + Top Bid (Center) <---> P2 Bid Stand (Right) */}
      <div className="grid grid-cols-12 gap-3 my-2 items-center">
        {/* Left Flank: P1's Current Bid Display (Filling Left Empty Red Circle) */}
        <div className="col-span-3 flex flex-col items-center">
          <div className={`w-full rounded-2xl p-3 border text-center transition-all shadow-xl ${
            isP1Highest 
              ? 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/20' 
              : 'bg-slate-950/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-base">{player1.avatar}</span>
              <span className="text-xs font-black text-emerald-400 uppercase truncate">
                {player1.name}
              </span>
            </div>
            
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              CURRENT BID
            </span>

            <div className="text-3xl font-black font-mono my-1 tracking-tight text-white">
              {p1Passed ? (
                <span className="text-sm text-slate-500 font-bold">PASS</span>
              ) : p1LastBid ? (
                <span className={isP1Highest ? 'text-emerald-400' : 'text-slate-300'}>
                  {p1LastBid}<span className="text-base font-bold text-slate-400">M</span>
                </span>
              ) : (
                <span className="text-slate-600 text-xl font-bold">--</span>
              )}
            </div>

            {/* Status Pill */}
            <div className="mt-1 flex justify-center">
              {p1Passed ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  PASSED
                </span>
              ) : isP1Highest ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-0.5 shadow">
                  <CheckCircle2 className="w-2.5 h-2.5" /> LEADING
                </span>
              ) : p1LastBid ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/40">
                  OUTBID
                </span>
              ) : (
                <span className="text-[9px] font-bold text-slate-500">
                  WAITING
                </span>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
              BUDGET: <strong className="text-slate-200">{player1.budget}M</strong>
            </div>
          </div>
        </div>

        {/* Center: Player Card (Photo on Top) + TOP BID (Directly Underneath) */}
        <div className="col-span-6 flex flex-col items-center">
          {/* 1. Player Card */}
          <div className="w-full max-w-[220px]">
            <PlayerCard player={currentTier1Player} highlight={true} />
          </div>

          {/* 2. Top Bid Box (Directly Underneath) */}
          <div className="w-full max-w-[300px] bg-slate-950/95 border-2 border-amber-500/70 rounded-2xl p-2.5 text-center shadow-xl mt-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              TOP BID
            </span>
            <div className="text-4xl font-black text-amber-400 my-0.5 font-mono tracking-tight drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
              {currentBid} <span className="text-xl font-bold">M €</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold">LEADER:</span>
              <span className={`font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                isP1Highest 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : isP2Highest 
                  ? 'bg-rose-600 text-white shadow-md' 
                  : 'bg-slate-800 text-slate-300'
              }`}>
                <span>{highestBidder?.avatar || '⚖️'}</span>
                <span>{highestBidder?.name || 'NO BIDS'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Flank: P2's Current Bid Display (Opponent - RED) */}
        <div className="col-span-3 flex flex-col items-center">
          <div className={`w-full rounded-2xl p-3 border-2 text-center transition-all shadow-xl ${
            isP2Highest 
              ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/50 shadow-rose-500/30' 
              : 'bg-slate-950/90 border-rose-500/50 hover:border-rose-400'
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-base">{player2.avatar}</span>
              <span className="text-xs font-black text-rose-400 uppercase truncate">
                {player2.name}
              </span>
            </div>
            
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              CURRENT BID
            </span>

            <div className="text-3xl font-black font-mono my-1 tracking-tight text-white">
              {p2Passed ? (
                <span className="text-sm text-slate-500 font-bold">PASS</span>
              ) : p2LastBid ? (
                <span className={isP2Highest ? 'text-rose-400' : 'text-slate-300'}>
                  {p2LastBid}<span className="text-base font-bold text-slate-400">M</span>
                </span>
              ) : (
                <span className="text-slate-600 text-xl font-bold">--</span>
              )}
            </div>

            {/* Status Pill */}
            <div className="mt-1 flex justify-center">
              {p2Passed ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  PASSED
                </span>
              ) : isP2Highest ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-0.5 shadow">
                  <CheckCircle2 className="w-2.5 h-2.5" /> LEADING
                </span>
              ) : p2LastBid ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/40">
                  OUTBID
                </span>
              ) : (
                <span className="text-[9px] font-bold text-slate-500">
                  WAITING
                </span>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
              BUDGET: <strong className="text-slate-200">{player2.budget}M</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Dual Bidding Controllers (P1 & P2) */}
      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* P1 Controller (Emerald) */}
        <div className={`p-2.5 rounded-2xl border transition-all ${
          isP1Highest 
            ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40' 
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{player1.avatar}</span>
              <span className="text-xs font-black text-emerald-400 uppercase">
                {player1.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                (MAX: <strong className="text-amber-400">{p1MaxBid}M</strong>)
              </span>
            </div>
            {isP1Highest && (
              <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.2 rounded-full flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> LEADING
              </span>
            )}
          </div>

          {p1Passed ? (
            <div className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-center text-xs text-slate-400 font-bold">
              PASSED · WILL RECEIVE MID-TIER
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              <BidBtn label="+1M" amount={currentBid + 1} maxAllowed={p1MaxBid} onClick={() => onP1Bid(currentBid + 1)} disabled={!isAuctionActive || currentBid + 1 > p1MaxBid || isP1Highest || isP1Disabled} color="emerald" />
              <BidBtn label="+2M" amount={currentBid + 2} maxAllowed={p1MaxBid} onClick={() => onP1Bid(currentBid + 2)} disabled={!isAuctionActive || currentBid + 2 > p1MaxBid || isP1Highest || isP1Disabled} color="emerald" />
              <BidBtn label="+5M" amount={currentBid + 5} maxAllowed={p1MaxBid} onClick={() => onP1Bid(currentBid + 5)} disabled={!isAuctionActive || currentBid + 5 > p1MaxBid || isP1Highest || isP1Disabled} color="emerald" />
              <button
                onClick={() => onP1Bid(p1MaxBid)}
                disabled={!isAuctionActive || currentBid >= p1MaxBid || isP1Highest || isP1Disabled}
                className="py-2 px-1 rounded-xl text-xs font-black bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center shadow active:scale-95"
              >
                <span className="flex items-center gap-0.5 leading-none text-[11px]">
                  <Flame className="w-3 h-3 fill-white" /> MAX
                </span>
                <span className="text-[9px] font-mono opacity-85 leading-none mt-0.5">{p1MaxBid}M</span>
              </button>
              <button
                onClick={onP1Pass}
                disabled={!isAuctionActive || isP1Highest || isP1Disabled}
                className="py-2 px-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center active:scale-95"
              >
                PASS
              </button>
            </div>
          )}
        </div>

        {/* P2 Controller (Opponent - RED) */}
        <div className={`p-2.5 rounded-2xl border-2 transition-all ${
          isP2Highest 
            ? 'bg-rose-950/30 border-rose-500 ring-1 ring-rose-500/40' 
            : 'bg-slate-950/80 border-rose-500/60'
        }`}>
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{player2.avatar}</span>
              <span className="text-xs font-black text-rose-400 uppercase">
                {player2.name}
              </span>
              <button
                onClick={onToggleP2Bot}
                disabled={isP2Disabled}
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border transition-all flex items-center gap-0.5 ${
                  isP2Bot 
                    ? 'bg-rose-900/60 border-rose-500 text-rose-300' 
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
                title="Toggle Human vs AI Bot"
              >
                {isP2Bot ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                <span>{isP2Bot ? 'BOT' : 'P2'}</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                (MAX: <strong className="text-amber-400">{p2MaxBid}M</strong>)
              </span>
            </div>
            {isP2Highest && (
              <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.2 rounded-full flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> LEADING
              </span>
            )}
          </div>

          {p2Passed ? (
            <div className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-center text-xs text-slate-400 font-bold">
              PASSED · WILL RECEIVE MID-TIER
            </div>
          ) : isP2Bot ? (
            <div className="py-2.5 px-3 rounded-xl bg-rose-950/40 border border-rose-800 text-center text-xs text-rose-300 flex items-center justify-center gap-1.5 font-bold">
              <Bot className="w-3.5 h-3.5 animate-bounce text-rose-400" />
              <span>AI BOT BIDDING...</span>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              <BidBtn label="+1M" amount={currentBid + 1} maxAllowed={p2MaxBid} onClick={() => onP2Bid(currentBid + 1)} disabled={!isAuctionActive || currentBid + 1 > p2MaxBid || isP2Highest || isP2Disabled} color="red" />
              <BidBtn label="+2M" amount={currentBid + 2} maxAllowed={p2MaxBid} onClick={() => onP2Bid(currentBid + 2)} disabled={!isAuctionActive || currentBid + 2 > p2MaxBid || isP2Highest || isP2Disabled} color="red" />
              <BidBtn label="+5M" amount={currentBid + 5} maxAllowed={p2MaxBid} onClick={() => onP2Bid(currentBid + 5)} disabled={!isAuctionActive || currentBid + 5 > p2MaxBid || isP2Highest || isP2Disabled} color="red" />
              <button
                onClick={() => onP2Bid(p2MaxBid)}
                disabled={!isAuctionActive || currentBid >= p2MaxBid || isP2Highest || isP2Disabled}
                className="py-2 px-1 rounded-xl text-xs font-black bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center shadow active:scale-95"
              >
                <span className="flex items-center gap-0.5 leading-none text-[11px]">
                  <Flame className="w-3 h-3 fill-white" /> MAX
                </span>
                <span className="text-[9px] font-mono opacity-85 leading-none mt-0.5">{p2MaxBid}M</span>
              </button>
              <button
                onClick={onP2Pass}
                disabled={!isAuctionActive || isP2Highest || isP2Disabled}
                className="py-2 px-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center active:scale-95"
              >
                PASS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BidBtn({ label, amount, maxAllowed, onClick, disabled, color = 'emerald' }) {
  const isEmerald = color === 'emerald';
  const isRed = color === 'red';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-2 px-1 rounded-xl font-black text-xs transition-all active:scale-95 flex flex-col items-center justify-center shadow disabled:opacity-30 disabled:pointer-events-none ${
        isEmerald 
          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950' 
          : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border border-rose-400/40 shadow-rose-900/40'
      }`}
    >
      <span className="flex items-center gap-0.5 leading-none">
        <ArrowUpCircle className="w-3 h-3" />
        {label}
      </span>
      <span className="text-[9px] font-mono opacity-85 leading-none mt-0.5">({amount}M)</span>
    </button>
  );
}
