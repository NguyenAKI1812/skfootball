import React, { useState, useEffect } from 'react';
import { 
  TIER_1_PLAYERS, 
  TIER_2_PLAYERS, 
  SQUAD_POSITIONS,
  generateDraftSchedule
} from './data/players';
import PitchView from './components/PitchView';
import AuctionArena1v1 from './components/AuctionArena1v1';
import MysteryBoxModal from './components/MysteryBoxModal';
import HeadToHeadMatch from './components/HeadToHeadMatch';
import ProfileModal from './components/ProfileModal';
import OnlineRoomModal from './components/OnlineRoomModal';
import { onlineSync } from './utils/onlineSync';
import { sounds } from './utils/sound';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  Globe,
  Edit3,
  Wifi
} from 'lucide-react';

export default function App() {
  const [isMuted, setIsMuted] = useState(false);
  const [gameState, setGameState] = useState('auction'); // 'auction', 'round_result', 'final_match'

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);

  // Online Multiplayer State
  const [onlineState, setOnlineState] = useState({
    isConnected: false,
    role: null, // 'host' or 'guest'
    roomCode: null
  });

  // 11-Round Fixed Schedule: 1 GK, 4 DF, 3 MF, 3 FW
  const [schedule, setSchedule] = useState(() => generateDraftSchedule());
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);

  // Player 1 & Player 2 Managers (Customizable Names & Avatars)
  const [player1, setPlayer1] = useState({
    id: 'p1',
    name: 'HLV 1 (Xanh)',
    avatar: '🟢',
    budget: 100,
    color: '#10b981',
    squad: {}
  });

  const [player2, setPlayer2] = useState({
    id: 'p2',
    name: 'HLV 2 (Đỏ)',
    avatar: '🔴',
    budget: 100,
    color: '#ef4444',
    squad: {}
  });

  const [isP2Bot, setIsP2Bot] = useState(false);

  // Auction State within current round
  const [currentTier1Player, setCurrentTier1Player] = useState(null);
  const [usedPlayerIds, setUsedPlayerIds] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentBid, setCurrentBid] = useState(5);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [p1Passed, setP1Passed] = useState(false);
  const [p2Passed, setP2Passed] = useState(false);
  const [isAuctionActive, setIsAuctionActive] = useState(true);

  // Round Result State
  const [roundWinnerInfo, setRoundWinnerInfo] = useState(null);
  const [roundLoserInfo, setRoundLoserInfo] = useState(null);
  const [roundTier1, setRoundTier1] = useState(null);
  const [roundTier2, setRoundTier2] = useState(null);
  const [p1Candidates, setP1Candidates] = useState([]);
  const [p2Candidates, setP2Candidates] = useState([]);
  const [matchRemoteMsg, setMatchRemoteMsg] = useState(null);

  const currentRoundInfo = schedule[currentRoundIdx];

  // Solvency check
  const calcMaxBid = (manager) => {
    const filled = Object.keys(manager.squad).length;
    const remainingSlots = 11 - filled;
    const safetyReserve = Math.max(0, remainingSlots - 1) * 1;
    return Math.max(1, manager.budget - safetyReserve);
  };

  const p1MaxBid = calcMaxBid(player1);
  const p2MaxBid = calcMaxBid(player2);

  // Helper: select random player of exact required category
  const selectPlayerForCategory = (pool, category, excludeIds) => {
    const matching = pool.filter(p => !excludeIds.has(p.id) && p.position === category);
    if (matching.length > 0) {
      return matching[Math.floor(Math.random() * matching.length)];
    }
    return pool.find(p => p.position === category) || pool[0];
  };

  // Helper: candidate slots respecting CAM / CDM mutual exclusion
  const getAvailableCandidateSlots = (squad, category) => {
    const hasCAM = !!squad['cam'];
    const hasCDM = !!squad['cdm'];

    return SQUAD_POSITIONS.filter(s => {
      if (s.category !== category) return false;
      if (squad[s.id]) return false;
      if (s.id === 'cam' && hasCDM) return false;
      if (s.id === 'cdm' && hasCAM) return false;
      return true;
    });
  };

  // Initialize first round
  useEffect(() => {
    const cat = schedule[0].category;
    const p = selectPlayerForCategory(TIER_1_PLAYERS, cat, usedPlayerIds);
    setCurrentTier1Player(p);
    setCurrentBid(5);
    setTimeLeft(10);
    setHighestBidder(null);
    setBidHistory([]);
    setP1Passed(false);
    setP2Passed(false);
    setIsAuctionActive(true);

    // Auto-check URL for ?room=ROOM_CODE to join online immediately
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        handleJoinOnlineRoom(roomParam);
      }
      if (params.get('test') === 'match') {
        const p1Sq = {};
        const p2Sq = {};
        SQUAD_POSITIONS.forEach((pos, idx) => {
          if (pos.id === 'cdm') return;
          p1Sq[pos.id] = TIER_1_PLAYERS[idx % TIER_1_PLAYERS.length];
          p2Sq[pos.id] = TIER_2_PLAYERS[idx % TIER_2_PLAYERS.length];
        });
        setPlayer1(p => ({ ...p, squad: p1Sq }));
        setPlayer2(p => ({ ...p, squad: p2Sq }));
        setGameState('final_match');
      }
    }
  }, []);

  // Online message receiver dispatcher
  const handleRemoteMessage = (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'BID') {
      const manager = msg.playerRole === 'p1' ? player1 : player2;
      handleLocalBid(manager, msg.amount, false);
    } else if (msg.type === 'PASS') {
      if (msg.playerRole === 'p1') setP1Passed(true);
      if (msg.playerRole === 'p2') setP2Passed(true);
    } else if (msg.type === 'UPDATE_PROFILE') {
      if (msg.p1Name) setPlayer1(p => ({ ...p, name: msg.p1Name, avatar: msg.p1Avatar || p.avatar }));
      if (msg.p2Name) setPlayer2(p => ({ ...p, name: msg.p2Name, avatar: msg.p2Avatar || p.avatar }));
    } else if (msg.type === 'CONFIRM_PLACEMENT') {
      handleConfirmPlacement(msg.data, false);
    } else if (msg.type.startsWith('MATCH_')) {
      setMatchRemoteMsg(msg);
    } else if (msg.type === 'RESTART') {
      handleRestart(false);
    }
  };

  // Online Room Handlers
  const handleHostOnlineRoom = (code) => {
    onlineSync.createRoom(
      code,
      ({ role, roomCode }) => {
        setOnlineState({ isConnected: true, role, roomCode });
        setIsP2Bot(false); // disable bot in online multiplayer
      },
      handleRemoteMessage,
      () => setOnlineState({ isConnected: false, role: null, roomCode: null })
    );
  };

  const handleJoinOnlineRoom = (code) => {
    onlineSync.joinRoom(
      code,
      ({ role, roomCode }) => {
        setOnlineState({ isConnected: true, role, roomCode });
        setIsP2Bot(false);
      },
      handleRemoteMessage,
      () => setOnlineState({ isConnected: false, role: null, roomCode: null })
    );
  };

  const handleDisconnectOnline = () => {
    onlineSync.disconnect();
    setOnlineState({ isConnected: false, role: null, roomCode: null });
  };

  // Profile Save
  const handleSaveProfile = ({ p1Name, p1Avatar, p2Name, p2Avatar }) => {
    setPlayer1(prev => ({ ...prev, name: p1Name, avatar: p1Avatar }));
    setPlayer2(prev => ({ ...prev, name: p2Name, avatar: p2Avatar }));

    if (onlineState.isConnected) {
      onlineSync.send({
        type: 'UPDATE_PROFILE',
        p1Name,
        p1Avatar,
        p2Name,
        p2Avatar
      });
    }
  };

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'auction' || !isAuctionActive) return;

    if (timeLeft <= 0) {
      handleAuctionEnd();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 4 && prev > 1) {
          sounds.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, gameState, isAuctionActive]);

  // AI Bot logic for Player 2 (only in offline/local mode)
  useEffect(() => {
    if (onlineState.isConnected || !isP2Bot || gameState !== 'auction' || !isAuctionActive || p2Passed || timeLeft <= 0) return;
    if (highestBidder?.id === player2.id) return;

    const botTimer = setTimeout(() => {
      const increment = Math.floor(Math.random() * 3) + 1;
      const desiredBid = currentBid + increment;

      if (desiredBid <= p2MaxBid && Math.random() < 0.75) {
        handleLocalBid(player2, desiredBid, true);
      } else if (currentBid > p2MaxBid * 0.8 && Math.random() < 0.5) {
        setP2Passed(true);
      }
    }, Math.random() * 1500 + 1000);

    return () => clearTimeout(botTimer);
  }, [isP2Bot, onlineState.isConnected, currentBid, highestBidder, timeLeft, p2Passed, gameState, isAuctionActive]);

  // Unified Bid Handler
  const handleLocalBid = (manager, amount, broadcast = true) => {
    if (!isAuctionActive) return;
    if (manager.id === player1.id && p1Passed) return;
    if (manager.id === player2.id && p2Passed) return;

    const maxAllowed = manager.id === player1.id ? p1MaxBid : p2MaxBid;
    if (amount <= currentBid || amount > maxAllowed) return;

    setCurrentBid(amount);
    setHighestBidder(manager);
    sounds.playBid();

    // Anti-snipe: reset to 5s if < 5s
    setTimeLeft(prev => prev < 5 ? 5 : prev);

    setBidHistory(prev => [
      ...prev,
      {
        playerId: manager.id,
        name: manager.name,
        avatar: manager.avatar,
        amount: amount
      }
    ]);

    if (broadcast && onlineState.isConnected) {
      onlineSync.send({
        type: 'BID',
        playerRole: manager.id,
        amount
      });
    }
  };

  const handlePass = (managerId) => {
    if (managerId === 'p1') setP1Passed(true);
    if (managerId === 'p2') setP2Passed(true);

    if (onlineState.isConnected) {
      onlineSync.send({
        type: 'PASS',
        playerRole: managerId
      });
    }
  };

  // Auction Round Resolution
  const handleAuctionEnd = () => {
    setIsAuctionActive(false);
    sounds.playGavel();

    let winner = highestBidder;
    let finalWinningBid = currentBid;

    if (!winner) {
      winner = Math.random() > 0.5 ? player1 : player2;
      finalWinningBid = 5;
    }

    const loser = winner.id === player1.id ? player2 : player1;

    // Pick Tier 2 player of the EXACT SAME category
    const targetCategory = currentRoundInfo.category;
    const newUsed = new Set(usedPlayerIds);
    newUsed.add(currentTier1Player.id);

    const tier2 = selectPlayerForCategory(TIER_2_PLAYERS, targetCategory, newUsed);
    newUsed.add(tier2.id);
    setUsedPlayerIds(newUsed);

    // Compute candidate slots for P1 and P2 respecting CAM/CDM mutual exclusion
    const p1OpenSlots = getAvailableCandidateSlots(player1.squad, targetCategory);
    const p2OpenSlots = getAvailableCandidateSlots(player2.squad, targetCategory);

    setP1Candidates(p1OpenSlots);
    setP2Candidates(p2OpenSlots);

    setRoundWinnerInfo({ ...winner, amount: finalWinningBid });
    setRoundLoserInfo(loser);
    setRoundTier1(currentTier1Player);
    setRoundTier2(tier2);

    setGameState('round_result');
  };

  // Safe Slot Assignment with CAM/CDM mutual exclusion
  const assignSlotToSquad = (prevSquad, slotId, player) => {
    const newSquad = { ...prevSquad, [slotId]: player };
    if (slotId === 'cam') delete newSquad['cdm'];
    if (slotId === 'cdm') delete newSquad['cam'];
    return newSquad;
  };

  // Confirm placement from MysteryBoxModal
  const handleConfirmPlacement = ({ p1SlotId, p2SlotId }, broadcast = true) => {
    const isWinnerP1 = roundWinnerInfo.id === player1.id;
    const finalWinningBid = roundWinnerInfo.amount;

    const assignedP1Slot = p1SlotId || p1Candidates[0]?.id;
    const assignedP2Slot = p2SlotId || p2Candidates[0]?.id;

    if (isWinnerP1) {
      setPlayer1(prev => ({
        ...prev,
        budget: prev.budget - finalWinningBid,
        squad: assignSlotToSquad(prev.squad, assignedP1Slot, roundTier1)
      }));
      setPlayer2(prev => ({
        ...prev,
        squad: assignSlotToSquad(prev.squad, assignedP2Slot, roundTier2)
      }));
    } else {
      setPlayer2(prev => ({
        ...prev,
        budget: prev.budget - finalWinningBid,
        squad: assignSlotToSquad(prev.squad, assignedP2Slot, roundTier1)
      }));
      setPlayer1(prev => ({
        ...prev,
        squad: assignSlotToSquad(prev.squad, assignedP1Slot, roundTier2)
      }));
    }

    if (broadcast && onlineState.isConnected) {
      onlineSync.send({
        type: 'CONFIRM_PLACEMENT',
        data: { p1SlotId, p2SlotId }
      });
    }

    // Go to next round or final match
    const nextIdx = currentRoundIdx + 1;
    if (nextIdx >= schedule.length) {
      setGameState('final_match');
      sounds.playFanfare();
      return;
    }

    setCurrentRoundIdx(nextIdx);
    const nextCat = schedule[nextIdx].category;
    const nextT1 = selectPlayerForCategory(TIER_1_PLAYERS, nextCat, usedPlayerIds);
    setCurrentTier1Player(nextT1);
    setCurrentBid(5);
    setTimeLeft(10);
    setHighestBidder(null);
    setBidHistory([]);
    setP1Passed(false);
    setP2Passed(false);
    setIsAuctionActive(true);
    setGameState('auction');
  };

  // Swap slots inside same category on the pitch
  const handleSwap = (prevSquad, slotA, slotB) => {
    const pA = prevSquad[slotA];
    const pB = prevSquad[slotB];
    const newSquad = { ...prevSquad };
    if (pB) newSquad[slotA] = pB; else delete newSquad[slotA];
    if (pA) newSquad[slotB] = pA; else delete newSquad[slotB];

    if (slotA === 'cam' && !newSquad['cam']) delete newSquad['cam'];
    if (slotA === 'cdm' && !newSquad['cdm']) delete newSquad['cdm'];
    if (slotB === 'cam' && !newSquad['cam']) delete newSquad['cam'];
    if (slotB === 'cdm' && !newSquad['cdm']) delete newSquad['cdm'];

    return newSquad;
  };

  const handleP1Swap = (slotA, slotB) => {
    setPlayer1(prev => ({ ...prev, squad: handleSwap(prev.squad, slotA, slotB) }));
  };

  const handleP2Swap = (slotA, slotB) => {
    setPlayer2(prev => ({ ...prev, squad: handleSwap(prev.squad, slotA, slotB) }));
  };

  // Restart Entire Game
  const handleRestart = (broadcast = true) => {
    const newSchedule = generateDraftSchedule();
    setSchedule(newSchedule);
    setPlayer1(p => ({ ...p, budget: 100, squad: {} }));
    setPlayer2(p => ({ ...p, budget: 100, squad: {} }));
    setUsedPlayerIds(new Set());
    setCurrentRoundIdx(0);
    const firstCat = newSchedule[0].category;
    const firstT1 = selectPlayerForCategory(TIER_1_PLAYERS, firstCat, new Set());
    setCurrentTier1Player(firstT1);
    setCurrentBid(5);
    setTimeLeft(10);
    setHighestBidder(null);
    setBidHistory([]);
    setP1Passed(false);
    setP2Passed(false);
    setIsAuctionActive(true);
    setGameState('auction');

    if (broadcast && onlineState.isConnected) {
      onlineSync.send({ type: 'RESTART' });
    }
  };

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  // In online mode: restrict bidding buttons based on player role
  const isP1Disabled = onlineState.isConnected && onlineState.role !== 'host';
  const isP2Disabled = onlineState.isConnected && onlineState.role !== 'guest';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-6 py-2.5 sticky top-0 z-40 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              FOOTBALL AUCTION 1V1
              {onlineState.isConnected && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 shadow">
                  <Wifi className="w-3 h-3" /> ONLINE ({onlineState.roomCode})
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Global Summary Badge: P1 vs P2 Budgets & Click to Rename */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 px-3 py-1 rounded-xl border border-emerald-500/50 bg-emerald-950/40 text-xs cursor-pointer hover:border-emerald-400 transition-all shadow-sm"
            title="Bấm để đổi tên HLV 1"
          >
            <span>{player1.avatar}</span>
            <span className="font-extrabold text-emerald-300">{player1.name}</span>
            <span className="font-mono font-black text-amber-400">{player1.budget}M €</span>
            <span className="text-[10px] bg-black/40 px-1 rounded text-slate-400 font-bold">
              {Object.keys(player1.squad).length}/11
            </span>
          </div>

          <span className="text-xs font-black text-slate-500">VS</span>

          <div 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 px-3 py-1 rounded-xl border-2 border-rose-500/60 bg-rose-950/40 text-xs cursor-pointer hover:border-rose-400 transition-all shadow-sm"
            title="Bấm để đổi tên HLV 2 (Đối thủ)"
          >
            <span>{player2.avatar}</span>
            <span className="font-extrabold text-rose-400">{player2.name}</span>
            <span className="font-mono font-black text-amber-400">{player2.budget}M €</span>
            <span className="text-[10px] bg-black/40 px-1 rounded text-slate-400 font-bold">
              {Object.keys(player2.squad).length}/11
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Profile / Rename Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Đổi tên & avatar HLV"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Đặt Tên</span>
          </button>

          {/* Online Multiplayer Room Button */}
          <button
            onClick={() => setShowOnlineModal(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all shadow ${
              onlineState.isConnected 
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-400/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{onlineState.isConnected ? 'Phòng Online' : 'Chơi Online'}</span>
          </button>

          <button 
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button 
            onClick={() => handleRestart(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Restart Draft"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area: Centered Vertically on Desktop */}
      <main className="flex-1 p-3.5 max-w-[1700px] mx-auto w-full flex flex-col justify-center">
        {gameState === 'final_match' ? (
          <HeadToHeadMatch 
            player1={player1} 
            player2={player2} 
            isP2Bot={isP2Bot}
            onlineState={onlineState}
            matchRemoteMsg={matchRemoteMsg}
            onSendMatchMessage={(msg) => onlineSync.send(msg)}
            onRestart={() => handleRestart(true)} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Left: P1 Squad Pitch (Green) */}
            <div className="lg:col-span-3">
              <PitchView 
                squad={player1.squad} 
                budget={player1.budget} 
                title={player1.name} 
                isOpponent={false}
                onSwap={onlineState.role === 'guest' ? null : handleP1Swap}
              />
            </div>

            {/* Center: Live 1v1 Auction Stage with Flank Bidding Stands */}
            <div className="lg:col-span-6">
              <AuctionArena1v1 
                currentRound={currentRoundIdx + 1}
                totalRounds={schedule.length}
                currentRoundInfo={currentRoundInfo}
                currentTier1Player={currentTier1Player}
                timeLeft={timeLeft}
                currentBid={currentBid}
                highestBidder={highestBidder}
                player1={player1}
                player2={player2}
                p1MaxBid={p1MaxBid}
                p2MaxBid={p2MaxBid}
                onP1Bid={(amt) => handleLocalBid(player1, amt, true)}
                onP1Pass={() => handlePass('p1')}
                onP2Bid={(amt) => handleLocalBid(player2, amt, true)}
                onP2Pass={() => handlePass('p2')}
                p1Passed={p1Passed}
                p2Passed={p2Passed}
                isP2Bot={isP2Bot}
                onToggleP2Bot={() => setIsP2Bot(!isP2Bot)}
                bidHistory={bidHistory}
                isAuctionActive={isAuctionActive}
                isP1Disabled={isP1Disabled}
                isP2Disabled={isP2Disabled}
              />
            </div>

            {/* Right: P2 Squad Pitch (Opponent - Red with Red Border) */}
            <div className="lg:col-span-3">
              <PitchView 
                squad={player2.squad} 
                budget={player2.budget} 
                title={player2.name} 
                isOpponent={true}
                onSwap={onlineState.role === 'host' ? null : handleP2Swap}
              />
            </div>
          </div>
        )}
      </main>

      {/* Round End Result Modal */}
      {gameState === 'round_result' && (
        <MysteryBoxModal 
          winnerInfo={roundWinnerInfo}
          loserInfo={roundLoserInfo}
          tier1Player={roundTier1}
          tier2Player={roundTier2}
          roundCategoryName={currentRoundInfo?.name}
          p1CandidateSlots={p1Candidates}
          p2CandidateSlots={p2Candidates}
          isP2Bot={isP2Bot}
          onConfirmPlacement={(data) => handleConfirmPlacement(data, true)}
        />
      )}

      {/* Profile / Rename Modal */}
      {showProfileModal && (
        <ProfileModal
          player1={player1}
          player2={player2}
          onlineRole={onlineState.role}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Online Room Modal */}
      {showOnlineModal && (
        <OnlineRoomModal
          onlineState={onlineState}
          onHostRoom={handleHostOnlineRoom}
          onJoinRoom={handleJoinOnlineRoom}
          onDisconnect={handleDisconnectOnline}
          onClose={() => setShowOnlineModal(false)}
        />
      )}
    </div>
  );
}
