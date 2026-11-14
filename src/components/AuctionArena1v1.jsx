import React, { useEffect, useState } from 'react';
import PlayerCard from './PlayerCard';

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
  isP2Disabled = false,
  isP1Turn = true,
  isP2Turn = true,
  onStageBid = null,
  isLobby = false,
  p1Ready = false,
  p2Ready = false,
  onP1Ready,
  onP2Ready,
  isTactics = false,
  tacticsTimeLeft = 30,
  p1TacticsReady = false,
  p2TacticsReady = false,
  onP1TacticsReady,
  onP2TacticsReady
}) {
  const [p1StagedBid, setP1StagedBid] = useState(null);
  const [p2StagedBid, setP2StagedBid] = useState(null);

  useEffect(() => {
    setP1StagedBid(null);
    setP2StagedBid(null);
  }, [currentBid, currentRound, isP1Turn, isP2Turn]);

  const stageIncrement = (currentStaged, step, maxAllowed) => {
    const base = currentStaged ?? currentBid;
    const next = Math.min(maxAllowed, base + step);
    if (next > base) {
      onStageBid?.();
    }
    return next;
  };
  const isUrgent = timeLeft <= 4 && timeLeft > 0;
  const isP1Highest = highestBidder?.id === player1.id;
  const isP2Highest = highestBidder?.id === player2.id;

  const p1LastBid = bidHistory.filter(b => b.playerId === player1.id).slice(-1)[0]?.amount || null;
  const p2LastBid = bidHistory.filter(b => b.playerId === player2.id).slice(-1)[0]?.amount || null;

  const categoryNames = {
    GK: 'GOALKEEPER (GK)',
    DF: 'DEFENDER (DF)',
    MF: 'MIDFIELDER (MF)',
    FW: 'FORWARD (FW)'
  };

  const categoryBadgeColors = {
    GK: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    DF: 'bg-sky-950/70 text-sky-300 border-sky-500/40',
    MF: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
    FW: 'bg-rose-950/70 text-rose-300 border-rose-500/40'
  };

  if (isLobby) {
    return (
      <div className="auction-welcome broadcast-panel">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <span className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-sm border border-amber-500/40">
            PHÒNG ĐẤU GIÁ / SẴN SÀNG
          </span>
          <span className="font-mono-num text-xs font-bold text-slate-400">
            {totalRounds} VÒNG · 1000M €
          </span>
        </div>

        <div className="auction-welcome-body">
          <h2 className="auction-headline">
            ĐỘI BÓNG LỚN.
            BẮT ĐẦU TỪ BẠN.
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            11 lượt đấu giá. 1.000 triệu euro. Cân nhắc từng lựa chọn để tạo nên đội hình chiến thắng.
          </p>

          <div className="auction-facts"><span><strong>11</strong> VỊ TRÍ</span><span><strong>1.000</strong> TRIỆU €</span><span><strong>01</strong> NHÀ VÔ ĐỊCH</span></div>
          <div className="ready-managers grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border transition-colors ${
              p1Ready ? 'bg-emerald-950/35 border-emerald-400' : 'bg-slate-950/80 border-emerald-500/35'
            }`}>
              <div className="font-display text-xl font-extrabold text-emerald-400 uppercase truncate">
                {player1.name}
              </div>
              <div className="font-mono-num text-xs text-slate-400 mb-3">
                NGÂN SÁCH: <strong className="text-amber-400">{player1.budget}M</strong>
              </div>
              <button
                onClick={onP1Ready}
                disabled={isP1Disabled}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p1Ready
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${isP1Disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p1Ready ? 'ĐÃ SẴN SÀNG' : 'SẴN SÀNG'}
              </button>
            </div>

            <div className={`p-4 rounded-xl border-2 transition-colors ${
              p2Ready ? 'bg-rose-950/35 border-rose-500' : 'bg-slate-950/80 border-rose-500/65'
            }`}>
              <div className="flex items-center justify-center gap-2">
                <span className="font-display text-xl font-extrabold text-rose-400 uppercase truncate">
                  {player2.name}
                </span>
                <button
                  onClick={onToggleP2Bot}
                  disabled={isP2Disabled}
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm border uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer ${
                    isP2Bot
                      ? 'bg-rose-900/70 border-rose-400 text-rose-200'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {isP2Bot ? 'BOT' : 'P2'}
                </button>
              </div>
              <div className="font-mono-num text-xs text-slate-400 mb-3">
                NGÂN SÁCH: <strong className="text-amber-400">{player2.budget}M</strong>
              </div>
              <button
                onClick={onP2Ready}
                disabled={isP2Disabled || isP2Bot}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p2Ready
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${(isP2Disabled || isP2Bot) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p2Ready ? (isP2Bot ? 'BOT ĐÃ SẴN SÀNG' : 'ĐÃ SẴN SÀNG') : 'SẴN SÀNG'}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 text-center text-[11px] text-slate-500">
          Bạn có thể đổi tên HLV hoặc mở Phòng Online ở thanh trên trước khi bấm Sẵn sàng.
        </div>
      </div>
    );
  }

  if (isTactics) {
    const tacticsUrgent = tacticsTimeLeft <= 5;
    return (
      <div className="broadcast-panel border border-slate-800 rounded-xl p-5 flex flex-col justify-between relative overflow-hidden h-full min-h-[460px]">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <span className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-sm border border-amber-500/40">
            CHUẨN BỊ ĐỘI HÌNH · 11/11
          </span>
          <div
            className={`flex items-center gap-2 px-3 py-0.5 rounded-sm border transition-all ${
              tacticsUrgent
                ? 'bg-rose-950/90 border-rose-500 text-rose-400 timer-urgent shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                : 'bg-slate-950 border-slate-700 text-amber-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${tacticsUrgent ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
            <span className="font-mono-num text-xl font-extrabold tracking-tight w-9 text-center">
              {tacticsTimeLeft}s
            </span>
          </div>
        </div>

        <div className="my-auto py-5 text-center">
          <h2 className="font-display text-3xl font-extrabold text-white uppercase tracking-wide mb-1.5">
            SẮP XẾP LẠI ĐỘI HÌNH
          </h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
            Bấm chọn 2 cầu thủ cùng tuyến trên sân hai bên để đổi vị trí (đặt đúng vị trí gốc để tránh bị trừ <strong className="text-rose-400">-1 OVR / -3 CHEM</strong>). Cả 2 bấm Sẵn sàng sẽ vào trận ngay!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border transition-colors ${
              p1TacticsReady ? 'bg-emerald-950/35 border-emerald-400' : 'bg-slate-950/80 border-emerald-500/35'
            }`}>
              <div className="font-display text-xl font-extrabold text-emerald-400 uppercase truncate mb-3">
                {player1.name}
              </div>
              <button
                onClick={onP1TacticsReady}
                disabled={isP1Disabled}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p1TacticsReady
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${isP1Disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p1TacticsReady ? 'ĐÃ SẴN SÀNG' : 'SẴN SÀNG VÀO TRẬN'}
              </button>
            </div>

            <div className={`p-4 rounded-xl border-2 transition-colors ${
              p2TacticsReady ? 'bg-rose-950/35 border-rose-500' : 'bg-slate-950/80 border-rose-500/65'
            }`}>
              <div className="font-display text-xl font-extrabold text-rose-400 uppercase truncate mb-3">
                {player2.name}
              </div>
              <button
                onClick={onP2TacticsReady}
                disabled={isP2Disabled || isP2Bot}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p2TacticsReady
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${(isP2Disabled || isP2Bot) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p2TacticsReady ? (isP2Bot ? 'BOT ĐÃ SẴN SÀNG' : 'ĐÃ SẴN SÀNG') : 'SẴN SÀNG VÀO TRẬN'}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 text-center text-[11px] text-slate-500">
          Hết 30 giây hệ thống sẽ tự động bắt đầu trận Chung kết Siêu Cúp 1v1.
        </div>
      </div>
    );
  }

  return (
    <div className="broadcast-panel border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
      {/* Seamless Inner Side Glow extending page light into the arena flanks */}
      <div
        className={`absolute inset-y-0 left-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent ${
          isP1Highest ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-y-0 right-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-l from-rose-500/25 via-rose-500/10 to-transparent ${
          isP2Highest ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Broadcast Top Strip: Round, Position, Clock */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-sm border border-amber-500/40">
            ROUND {currentRound}/{totalRounds}
          </span>
          <span
            className={`font-display text-sm font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border ${
              categoryBadgeColors[currentRoundInfo?.category] || 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {categoryNames[currentRoundInfo?.category] || currentRoundInfo?.category}
          </span>
        </div>

        {/* Crisp Digital Broadcast Clock */}
        <div
          className={`flex items-center gap-2 px-3 py-0.5 rounded-sm border transition-all ${
            isUrgent
              ? 'bg-rose-950/90 border-rose-500 text-rose-400 timer-urgent shadow-[0_0_18px_rgba(244,63,94,0.45)]'
              : 'bg-slate-950 border-slate-700 text-amber-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isUrgent ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
            }`}
          />
          <span className="font-mono-num text-xl font-extrabold tracking-tight w-8 text-center">
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Center Duel Stage */}
      <div className="grid grid-cols-12 gap-3 my-3 items-stretch relative z-10">
        {/* Left Flank: P1 Current Bid Stand */}
        <div className="col-span-3 flex flex-col justify-center">
          <div
            className={`w-full rounded-lg p-3 border text-center transition-all relative overflow-hidden ${
              isP1Highest
                ? 'bg-emerald-950/45 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-slate-950/85 border-emerald-500/35'
            }`}
          >
            {/* Top Team Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />

            <div className="font-display text-sm font-extrabold text-emerald-400 uppercase tracking-wide truncate mt-0.5">
              {player1.name}
            </div>

            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.14em] block mt-1">
              CURRENT BID
            </span>

            <div className="font-mono-num text-3xl font-extrabold my-1 tracking-tight text-white">
              {p1Passed ? (
                <span className="font-display text-lg text-slate-500 tracking-wider">PASS</span>
              ) : p1LastBid ? (
                <span className={isP1Highest ? 'text-emerald-400' : 'text-slate-200'}>
                  {p1LastBid}
                  <span className="text-sm font-bold text-slate-400 ml-0.5">M</span>
                </span>
              ) : (
                <span className="text-slate-600 text-2xl">--</span>
              )}
            </div>

            <div className="mt-1 flex justify-center">
              {p1Passed ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400 uppercase tracking-wider">
                  PASSED
                </span>
              ) : isP1Highest ? (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-sm bg-emerald-500 text-slate-950 uppercase tracking-wider">
                  LEADING
                </span>
              ) : p1LastBid ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-amber-950/70 text-amber-400 border border-amber-500/40 uppercase tracking-wider">
                  OUTBID
                </span>
              ) : (
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  WAITING
                </span>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-1 text-xs font-mono-num bg-slate-900/80 px-1.5 py-1 rounded border border-emerald-500/20">
              <span className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">CÒN LẠI</span>
              <strong className="text-amber-300 text-xs whitespace-nowrap">{player1.budget}M €</strong>
            </div>
          </div>
        </div>

        {/* Center Stage: FUT Player Card + TOP BID Plate (spans full center width) */}
        <div className="col-span-6 flex flex-col items-stretch">
          <div className="w-full">
            <PlayerCard player={currentTier1Player} highlight={true} />
          </div>

          {/* TOP BID Broadcast Plate */}
          <div className="top-bid-plate w-full bg-slate-950/95 border border-amber-500/60 rounded-lg p-2.5 text-center shadow-xl mt-2.5 relative overflow-hidden">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              TOP BID
            </div>
            <div className="top-bid-amount font-mono-num text-4xl font-extrabold text-amber-400 my-0.5 tracking-tight">
              {currentBid} <span className="font-display text-xl font-bold text-amber-300/90">M €</span>
            </div>

            <div className="top-bid-meta flex items-center justify-center gap-2 text-xs mt-1 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LEADER:</span>
              <span
                className={`font-display text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-sm ${
                  isP1Highest
                    ? 'bg-emerald-500 text-slate-950'
                    : isP2Highest
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {highestBidder?.name || 'NO BIDS'}
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={`font-display text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                  isP1Turn
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/60'
                }`}
              >
                LƯỢT: {isP1Turn ? player1.name : player2.name}
              </span>
            </div>
          </div>
        </div>

        {/* Right Flank: P2 Current Bid Stand (Opponent - RED BORDER) */}
        <div className="col-span-3 flex flex-col justify-center">
          <div
            className={`w-full rounded-lg p-3 border-2 text-center transition-all relative overflow-hidden ${
              isP2Highest
                ? 'bg-rose-950/55 border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.3)]'
                : 'bg-slate-950/85 border-rose-500/70'
            }`}
          >
            {/* Top Red Team Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />

            <div className="font-display text-sm font-extrabold text-rose-400 uppercase tracking-wide truncate mt-0.5">
              {player2.name}
            </div>

            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.14em] block mt-1">
              CURRENT BID
            </span>

            <div className="font-mono-num text-3xl font-extrabold my-1 tracking-tight text-white">
              {p2Passed ? (
                <span className="font-display text-lg text-slate-500 tracking-wider">PASS</span>
              ) : p2LastBid ? (
                <span className={isP2Highest ? 'text-rose-400' : 'text-slate-200'}>
                  {p2LastBid}
                  <span className="text-sm font-bold text-slate-400 ml-0.5">M</span>
                </span>
              ) : (
                <span className="text-slate-600 text-2xl">--</span>
              )}
            </div>

            <div className="mt-1 flex justify-center">
              {p2Passed ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400 uppercase tracking-wider">
                  PASSED
                </span>
              ) : isP2Highest ? (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-sm bg-rose-600 text-white uppercase tracking-wider">
                  LEADING
                </span>
              ) : p2LastBid ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-amber-950/70 text-amber-400 border border-amber-500/40 uppercase tracking-wider">
                  OUTBID
                </span>
              ) : (
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  WAITING
                </span>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-1 text-xs font-mono-num bg-slate-900/80 px-1.5 py-1 rounded border border-rose-500/25">
              <span className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">CÒN LẠI</span>
              <strong className="text-amber-300 text-xs whitespace-nowrap">{player2.budget}M €</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Dual Tactical Bidding Controllers */}
      <div className="pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {/* P1 Controller (Green) */}
        <div
          className={`p-2.5 rounded-lg border transition-all ${
            isP1Highest
              ? 'bg-emerald-950/30 border-emerald-400'
              : 'bg-slate-950/85 border-emerald-500/35'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1 h-4 bg-emerald-400 rounded-sm shrink-0" />
              <span className="font-display text-sm font-extrabold text-emerald-400 uppercase tracking-wide truncate">
                {player1.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono-num whitespace-nowrap shrink-0">
                MAX <strong className="text-amber-400">{p1MaxBid}M</strong>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isP1Turn ? (
                <span className="text-[9px] font-extrabold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-sm uppercase tracking-wider animate-pulse whitespace-nowrap">
                  ĐẾN LƯỢT
                </span>
              ) : (
                <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wider whitespace-nowrap">
                  CHỜ LƯỢT
                </span>
              )}
              {isP1Highest && (
                <span className="text-[9px] font-extrabold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-sm uppercase tracking-wider whitespace-nowrap">
                  LEADING
                </span>
              )}
            </div>
          </div>

          {p1Passed ? (
            <div className="py-2 px-3 rounded bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 font-bold tracking-wider uppercase">
              PASSED · RECEIVES ROLE PLAYER
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-5 gap-1.5">
                <BidBtn
                  label="+10M"
                  onClick={() => setP1StagedBid(prev => stageIncrement(prev, 10, p1MaxBid))}
                  disabled={!isAuctionActive || !isP1Turn || (p1StagedBid ?? currentBid) >= p1MaxBid || isP1Disabled}
                  variant="green"
                />
                <BidBtn
                  label="+25M"
                  onClick={() => setP1StagedBid(prev => stageIncrement(prev, 25, p1MaxBid))}
                  disabled={!isAuctionActive || !isP1Turn || (p1StagedBid ?? currentBid) >= p1MaxBid || isP1Disabled}
                  variant="green"
                />
                <BidBtn
                  label="+50M"
                  onClick={() => setP1StagedBid(prev => stageIncrement(prev, 50, p1MaxBid))}
                  disabled={!isAuctionActive || !isP1Turn || (p1StagedBid ?? currentBid) >= p1MaxBid || isP1Disabled}
                  variant="green"
                />
                <button
                  onClick={() => {
                    setP1StagedBid(p1MaxBid);
                    onStageBid?.();
                  }}
                  disabled={!isAuctionActive || !isP1Turn || currentBid >= p1MaxBid || isP1Disabled}
                  className="btn-bid-max py-1.5 px-1 rounded font-display font-extrabold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center cursor-pointer"
                >
                  <span className="text-sm leading-none tracking-wider">MAX</span>
                  <span className="font-mono-num text-[9px] font-bold opacity-85 leading-none mt-0.5">{p1MaxBid}M</span>
                </button>
                <button
                  onClick={onP1Pass}
                  disabled={!isAuctionActive || !isP1Turn || isP1Disabled}
                  className="py-1.5 px-1 rounded font-display text-sm font-bold tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 border-b-2 border-b-slate-950 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer active:translate-y-px"
                >
                  PASS
                </button>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/35 rounded px-2.5 py-1.5">
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {p1StagedBid !== null ? 'Mức giá chọn:' : 'Bấm +10 / +25 / +50'}
                  </span>
                  <span className="font-mono-num text-xs font-extrabold text-emerald-300 whitespace-nowrap shrink-0">
                    {p1StagedBid !== null ? `${p1StagedBid}M €` : `${currentBid}M €`}
                  </span>
                </div>
                {p1StagedBid !== null && (
                  <button
                    type="button"
                    onClick={() => setP1StagedBid(null)}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Chọn lại"
                  >
                    ↺
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (p1StagedBid !== null && p1StagedBid > (highestBidder ? currentBid : 0)) {
                      onP1Bid(p1StagedBid);
                      setP1StagedBid(null);
                    }
                  }}
                  disabled={!isAuctionActive || !isP1Turn || isP1Disabled || p1StagedBid === null || p1StagedBid <= (highestBidder ? currentBid : 0) || p1StagedBid > p1MaxBid}
                  className="px-3 py-1 rounded font-display text-xs font-extrabold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                >
                  {p1StagedBid !== null ? `XÁC NHẬN ${p1StagedBid}M` : 'XÁC NHẬN'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* P2 Controller (Opponent - RED BORDER) */}
        <div
          className={`p-2.5 rounded-lg border-2 transition-all ${
            isP2Highest
              ? 'bg-rose-950/35 border-rose-500'
              : 'bg-slate-950/85 border-rose-500/75'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1 h-4 bg-rose-500 rounded-sm shrink-0" />
              <span className="font-display text-sm font-extrabold text-rose-400 uppercase tracking-wide truncate">
                {player2.name}
              </span>
              <button
                onClick={onToggleP2Bot}
                disabled={isP2Disabled}
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm border uppercase tracking-wider whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isP2Bot
                    ? 'bg-rose-900/70 border-rose-400 text-rose-200'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
                title="Chuyển đổi Người chơi / AI Bot"
              >
                {isP2Bot ? 'BOT' : 'P2'}
              </button>
              <span className="text-[10px] text-slate-400 font-mono-num whitespace-nowrap shrink-0">
                MAX <strong className="text-amber-400">{p2MaxBid}M</strong>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isP2Turn ? (
                <span className="text-[9px] font-extrabold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-sm uppercase tracking-wider animate-pulse whitespace-nowrap">
                  ĐẾN LƯỢT
                </span>
              ) : (
                <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wider whitespace-nowrap">
                  CHỜ LƯỢT
                </span>
              )}
              {isP2Highest && (
                <span className="text-[9px] font-extrabold bg-rose-600 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wider whitespace-nowrap">
                  LEADING
                </span>
              )}
            </div>
          </div>

          {p2Passed ? (
            <div className="py-2 px-3 rounded bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 font-bold tracking-wider uppercase">
              PASSED · RECEIVES ROLE PLAYER
            </div>
          ) : isP2Bot ? (
            <div className="py-2 px-3 rounded bg-rose-950/40 border border-rose-500/40 text-center text-xs text-rose-300 font-bold tracking-wider uppercase">
              AI BOT THINKING...
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-5 gap-1.5">
                <BidBtn
                  label="+10M"
                  onClick={() => setP2StagedBid(prev => stageIncrement(prev, 10, p2MaxBid))}
                  disabled={!isAuctionActive || !isP2Turn || (p2StagedBid ?? currentBid) >= p2MaxBid || isP2Disabled}
                  variant="red"
                />
                <BidBtn
                  label="+25M"
                  onClick={() => setP2StagedBid(prev => stageIncrement(prev, 25, p2MaxBid))}
                  disabled={!isAuctionActive || !isP2Turn || (p2StagedBid ?? currentBid) >= p2MaxBid || isP2Disabled}
                  variant="red"
                />
                <BidBtn
                  label="+50M"
                  onClick={() => setP2StagedBid(prev => stageIncrement(prev, 50, p2MaxBid))}
                  disabled={!isAuctionActive || !isP2Turn || (p2StagedBid ?? currentBid) >= p2MaxBid || isP2Disabled}
                  variant="red"
                />
                <button
                  onClick={() => {
                    setP2StagedBid(p2MaxBid);
                    onStageBid?.();
                  }}
                  disabled={!isAuctionActive || !isP2Turn || currentBid >= p2MaxBid || isP2Disabled}
                  className="btn-bid-max py-1.5 px-1 rounded font-display font-extrabold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all flex flex-col items-center justify-center cursor-pointer"
                >
                  <span className="text-sm leading-none tracking-wider">MAX</span>
                  <span className="font-mono-num text-[9px] font-bold opacity-85 leading-none mt-0.5">{p2MaxBid}M</span>
                </button>
                <button
                  onClick={onP2Pass}
                  disabled={!isAuctionActive || !isP2Turn || isP2Disabled}
                  className="py-1.5 px-1 rounded font-display text-sm font-bold tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 border-b-2 border-b-slate-950 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer active:translate-y-px"
                >
                  PASS
                </button>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-rose-500/45 rounded px-2.5 py-1.5">
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {p2StagedBid !== null ? 'Mức giá chọn:' : 'Bấm +10 / +25 / +50'}
                  </span>
                  <span className="font-mono-num text-xs font-extrabold text-rose-300 whitespace-nowrap shrink-0">
                    {p2StagedBid !== null ? `${p2StagedBid}M €` : `${currentBid}M €`}
                  </span>
                </div>
                {p2StagedBid !== null && (
                  <button
                    type="button"
                    onClick={() => setP2StagedBid(null)}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Chọn lại"
                  >
                    ↺
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (p2StagedBid !== null && p2StagedBid > (highestBidder ? currentBid : 0)) {
                      onP2Bid(p2StagedBid);
                      setP2StagedBid(null);
                    }
                  }}
                  disabled={!isAuctionActive || !isP2Turn || isP2Disabled || p2StagedBid === null || p2StagedBid <= (highestBidder ? currentBid : 0) || p2StagedBid > p2MaxBid}
                  className="px-3 py-1 rounded font-display text-xs font-extrabold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                >
                  {p2StagedBid !== null ? `XÁC NHẬN ${p2StagedBid}M` : 'XÁC NHẬN'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BidBtn({ label, onClick, disabled, variant = 'green' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${
        variant === 'green' ? 'btn-bid-green' : 'btn-bid-red'
      } py-2 px-1 rounded font-display font-extrabold transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer`}
    >
      <span className="text-sm leading-none tracking-wider">{label}</span>
    </button>
  );
}
