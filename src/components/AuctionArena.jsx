import React from 'react';
import PlayerCard from './PlayerCard';
import { Gavel, Clock, ArrowUpCircle, Flame, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AuctionArena({
  currentRound,
  totalRounds = 11,
  currentPositionInfo,
  currentTier1Player,
  timeLeft,
  currentBid,
  highestBidder,
  userBudget,
  maxAllowedBid,
  bidHistory = [],
  onBid,
  onPass,
  hasUserPassed,
  isAuctionActive
}) {
  const isUrgent = timeLeft <= 4 && timeLeft > 0;
  const isUserHighest = highestBidder?.isUser;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Round Header */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/40">
            Vòng {currentRound} / {totalRounds}
          </span>
          <h2 className="text-xl font-black text-white mt-1">
            Đấu Giá Vị Trí: <span className="text-emerald-400">{currentPositionInfo?.name} ({currentPositionInfo?.code})</span>
          </h2>
        </div>

        {/* Real-time Countdown Timer */}
        <div className="flex items-center gap-3">
          <div 
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
              isUrgent 
                ? 'bg-red-950/80 border-red-500 text-red-400 timer-urgent shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                : 'bg-slate-950 border-slate-700 text-amber-400'
            }`}
          >
            <Clock className={`w-5 h-5 ${isUrgent ? 'animate-spin' : ''}`} />
            <span className="text-2xl font-black font-mono w-10 text-center">
              {timeLeft}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Arena Content: Card + Live Bid Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-4 items-center">
        {/* Tier 1 Player Card (Left / Center) */}
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[280px]">
            <PlayerCard player={currentTier1Player} highlight={true} />
          </div>
        </div>

        {/* Live Bid Information & Feed (Right) */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {/* Current Highest Bid Banner */}
          <div className="bg-slate-950/80 border-2 border-amber-500/50 rounded-2xl p-4 text-center relative overflow-hidden">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
              Mức Giá Cao Nhất Hiện Tại
            </span>
            <div className="text-5xl font-black text-amber-400 my-1 font-mono tracking-tight drop-shadow-[0_2px_15px_rgba(245,158,11,0.5)]">
              {currentBid} <span className="text-2xl font-bold">Triệu €</span>
            </div>

            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Người đang dẫn đầu:</span>
              <span className={`text-sm font-extrabold px-3 py-0.5 rounded-full flex items-center gap-1.5 ${
                isUserHighest 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-amber-300 border border-slate-700'
              }`}>
                <span>{highestBidder?.avatar || '👤'}</span>
                <span>{highestBidder?.name || 'Chưa có ai đặt'}</span>
                {isUserHighest && <span className="text-[10px] bg-black/30 px-1 rounded font-bold">BẠN</span>}
              </span>
            </div>
          </div>

          {/* Bid Commentary / History Feed */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 h-32 overflow-y-auto flex flex-col-reverse gap-1.5 text-xs">
            {bidHistory.length === 0 ? (
              <div className="text-slate-500 text-center py-8 italic">
                Chưa có lượt đặt giá nào. Hãy là người đầu tiên trả giá!
              </div>
            ) : (
              bidHistory.slice(-6).map((log, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-1.5 rounded ${
                    log.isUser ? 'bg-emerald-950/40 text-emerald-300' : 'text-slate-300 bg-slate-900/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{log.avatar}</span>
                    <strong>{log.name}</strong> vừa đặt giá
                  </span>
                  <span className="font-black font-mono text-amber-400">
                    {log.amount}M €
                  </span>
                </div>
              ))
            )}
          </div>

          {/* User Financial Rule Info */}
          <div className="flex justify-between items-center text-xs bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">
              Ngân sách của bạn: <strong className="text-emerald-400 font-bold">{userBudget}M €</strong>
            </span>
            <span className="text-slate-400">
              Mức đặt tối đa hợp lệ: <strong className="text-amber-400 font-bold">{maxAllowedBid}M €</strong>
            </span>
          </div>
        </div>
      </div>

      {/* User Bidding Controls */}
      <div className="pt-3 border-t border-slate-800">
        {hasUserPassed ? (
          <div className="bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-center">
            <p className="text-amber-300 font-bold text-sm">
              Bạn đã chọn bỏ qua phiên đấu giá này!
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Bạn sẽ nhận ngẫu nhiên <strong className="text-white">1 cầu thủ Tầng 2 (Tầm Trung)</strong> cho vị trí {currentPositionInfo?.name} khi hết giờ.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <BidButton 
                label="+1M" 
                amount={currentBid + 1} 
                maxAllowed={maxAllowedBid} 
                onClick={() => onBid(currentBid + 1)} 
                disabled={!isAuctionActive || currentBid + 1 > maxAllowedBid || isUserHighest}
              />
              <BidButton 
                label="+2M" 
                amount={currentBid + 2} 
                maxAllowed={maxAllowedBid} 
                onClick={() => onBid(currentBid + 2)} 
                disabled={!isAuctionActive || currentBid + 2 > maxAllowedBid || isUserHighest}
              />
              <BidButton 
                label="+5M" 
                amount={currentBid + 5} 
                maxAllowed={maxAllowedBid} 
                onClick={() => onBid(currentBid + 5)} 
                disabled={!isAuctionActive || currentBid + 5 > maxAllowedBid || isUserHighest}
              />
              <button
                onClick={() => onBid(maxAllowedBid)}
                disabled={!isAuctionActive || currentBid >= maxAllowedBid || isUserHighest}
                className="px-3.5 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md flex items-center gap-1"
              >
                <Flame className="w-4 h-4 fill-white" />
                Tất tay ({maxAllowedBid}M)
              </button>
            </div>

            <button
              onClick={onPass}
              disabled={!isAuctionActive || isUserHighest}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Bỏ qua đấu giá siêu sao và nhận ngẫu nhiên cầu thủ tầm trung Tầng 2"
            >
              Bỏ cuộc (Lấy Tầng 2)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BidButton({ label, amount, maxAllowed, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
    >
      <ArrowUpCircle className="w-4 h-4" />
      <span>{label}</span>
      <span className="text-[11px] opacity-75">({amount}M)</span>
    </button>
  );
}
