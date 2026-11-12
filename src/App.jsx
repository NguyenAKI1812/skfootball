import React, { useState, useEffect, useRef } from 'react';
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
  const [gameState, setGameState] = useState('lobby'); // 'lobby', 'auction', 'round_result', 'tactics', 'final_match'
  const [p1AuctionReady, setP1AuctionReady] = useState(false);
  const [p2AuctionReady, setP2AuctionReady] = useState(false);
  const [tacticsTimeLeft, setTacticsTimeLeft] = useState(30);
  const [p1TacticsReady, setP1TacticsReady] = useState(false);
  const [p2TacticsReady, setP2TacticsReady] = useState(false);

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
    name: 'HLV 1 (Bạn)',
    avatar: '🟢',
    budget: 100,
    color: '#10b981',
    squad: {}
  });

  const [player2, setPlayer2] = useState({
    id: 'p2',
    name: 'HLV 2 (Đối thủ)',
    avatar: '🔴',
    budget: 100,
    color: '#ef4444',
    squad: {}
  });

  const [isP2Bot, setIsP2Bot] = useState(false);

  // Auction State within current round
  const [currentTier1Player, setCurrentTier1Player] = useState(null);
  const [usedPlayerIds, setUsedPlayerIds] = useState(new Set());
  const usedPlayerIdsRef = useRef(new Set());
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

  // Helper: build full set of already-used player IDs (ref + both squads)
  const buildExcludedIds = (baseSet = usedPlayerIdsRef.current) => {
    const excluded = new Set(baseSet);
    Object.values(player1.squad || {}).forEach(p => { if (p?.id) excluded.add(p.id); });
    Object.values(player2.squad || {}).forEach(p => { if (p?.id) excluded.add(p.id); });
    return excluded;
  };

  // Helper: select random player of exact required category without duplicates
  const selectPlayerForCategory = (pool, category, excludeIds) => {
    const matching = pool.filter(p => !excludeIds.has(p.id) && p.position === category);
    if (matching.length > 0) {
      return matching[Math.floor(Math.random() * matching.length)];
    }
    const anyUnused = pool.filter(p => !excludeIds.has(p.id));
    if (anyUnused.length > 0) {
      return anyUnused[Math.floor(Math.random() * anyUnused.length)];
    }
    return pool.find(p => p.position === category) || pool[0];
  };

  const markPlayerUsed = (playerId) => {
    if (!playerId) return;
    usedPlayerIdsRef.current.add(playerId);
    setUsedPlayerIds(new Set(usedPlayerIdsRef.current));
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
    const excluded = buildExcludedIds();
    const p = selectPlayerForCategory(TIER_1_PLAYERS, cat, excluded);
    markPlayerUsed(p?.id);
    setCurrentTier1Player(p);
    setCurrentBid(1);
    setTimeLeft(10);
    setHighestBidder(null);
    setBidHistory([]);
    setP1Passed(false);
    setP2Passed(false);
    setIsAuctionActive(false);

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
    } else if (msg.type === 'AUCTION_READY') {
      if (msg.playerRole === 'p1') setP1AuctionReady(Boolean(msg.ready));
      if (msg.playerRole === 'p2') setP2AuctionReady(Boolean(msg.ready));
    } else if (msg.type === 'TACTICS_READY') {
      if (msg.playerRole === 'p1') setP1TacticsReady(Boolean(msg.ready));
      if (msg.playerRole === 'p2') setP2TacticsReady(Boolean(msg.ready));
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

  // Start Round 1 only when BOTH players are ready
  useEffect(() => {
    if (gameState !== 'lobby') return;
    if (isP2Bot && !p2AuctionReady) {
      setP2AuctionReady(true);
      return;
    }
    if (p1AuctionReady && p2AuctionReady) {
      sounds.playWhistle();
      setTimeLeft(10);
      setIsAuctionActive(true);
      setGameState('auction');
    }
  }, [gameState, p1AuctionReady, p2AuctionReady, isP2Bot]);

  const handleToggleAuctionReady = (role) => {
    if (role === 'p1') {
      if (onlineState.isConnected && onlineState.role !== 'host') return;
      const next = !p1AuctionReady;
      setP1AuctionReady(next);
      if (onlineState.isConnected) {
        onlineSync.send({ type: 'AUCTION_READY', playerRole: 'p1', ready: next });
      }
    } else {
      if (onlineState.isConnected && onlineState.role !== 'guest') return;
      if (isP2Bot) return;
      const next = !p2AuctionReady;
      setP2AuctionReady(next);
      if (onlineState.isConnected) {
        onlineSync.send({ type: 'AUCTION_READY', playerRole: 'p2', ready: next });
      }
    }
  };

  // 30s Tactics Squad Arrangement phase after all 11 players are drafted
  useEffect(() => {
    if (gameState !== 'tactics') return;
    if (isP2Bot && !p2TacticsReady) {
      setP2TacticsReady(true);
      return;
    }
    if (p1TacticsReady && p2TacticsReady) {
      sounds.playFanfare();
      setGameState('final_match');
      return;
    }
    if (tacticsTimeLeft <= 0) {
      sounds.playFanfare();
      setGameState('final_match');
      return;
    }
    const timer = setTimeout(() => {
      setTacticsTimeLeft(t => t - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [gameState, tacticsTimeLeft, p1TacticsReady, p2TacticsReady, isP2Bot]);

  const handleToggleTacticsReady = (role) => {
    if (role === 'p1') {
      if (onlineState.isConnected && onlineState.role !== 'host') return;
      const next = !p1TacticsReady;
      setP1TacticsReady(next);
      if (onlineState.isConnected) {
        onlineSync.send({ type: 'TACTICS_READY', playerRole: 'p1', ready: next });
      }
    } else {
      if (onlineState.isConnected && onlineState.role !== 'guest') return;
      if (isP2Bot) return;
      const next = !p2TacticsReady;
      setP2TacticsReady(next);
      if (onlineState.isConnected) {
        onlineSync.send({ type: 'TACTICS_READY', playerRole: 'p2', ready: next });
      }
    }
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
    const minValid = highestBidder ? currentBid + 1 : 1;
    if (amount < minValid || amount > maxAllowed) return;

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
      finalWinningBid = 1;
    }

    const loser = winner.id === player1.id ? player2 : player1;

    // Pick Tier 2 player of the EXACT SAME category
    const targetCategory = currentRoundInfo.category;
    if (currentTier1Player?.id) {
      usedPlayerIdsRef.current.add(currentTier1Player.id);
    }
    const excluded = buildExcludedIds();
    const tier2 = selectPlayerForCategory(TIER_2_PLAYERS, targetCategory, excluded);
    markPlayerUsed(tier2?.id);

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

    // Go to 30s tactics rearrangement phase after all 11 players are drafted
    const nextIdx = currentRoundIdx + 1;
    if (nextIdx >= schedule.length) {
      setTacticsTimeLeft(30);
      setP1TacticsReady(false);
      setP2TacticsReady(isP2Bot);
      setGameState('tactics');
      sounds.playWhistle();
      return;
    }

    setCurrentRoundIdx(nextIdx);
    const nextCat = schedule[nextIdx].category;
    const excluded = buildExcludedIds();
    const nextT1 = selectPlayerForCategory(TIER_1_PLAYERS, nextCat, excluded);
    markPlayerUsed(nextT1?.id);
    setCurrentTier1Player(nextT1);
    setCurrentBid(1);
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
    usedPlayerIdsRef.current = new Set();
    setUsedPlayerIds(new Set());
    setCurrentRoundIdx(0);
    const firstCat = newSchedule[0].category;
    const firstT1 = selectPlayerForCategory(TIER_1_PLAYERS, firstCat, usedPlayerIdsRef.current);
    markPlayerUsed(firstT1?.id);
    setCurrentTier1Player(firstT1);
    setCurrentBid(1);
    setTimeLeft(10);
    setHighestBidder(null);
    setBidHistory([]);
    setP1Passed(false);
    setP2Passed(false);
    setP1AuctionReady(false);
    setP2AuctionReady(isP2Bot);
    setTacticsTimeLeft(30);
    setP1TacticsReady(false);
    setP2TacticsReady(isP2Bot);
    setIsAuctionActive(false);
    setGameState('lobby');

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
    <div className="min-h-screen text-slate-100 flex flex-col relative">
      {/* Full-Web Half-Screen Background Light for Current Highest Bidder */}
      <div
        className={`fixed inset-y-0 left-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-r from-emerald-500/45 via-emerald-500/22 to-transparent ${
          gameState === 'auction' && highestBidder?.id === player1.id ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`fixed inset-y-0 right-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-l from-rose-500/45 via-rose-500/22 to-transparent ${
          gameState === 'auction' && highestBidder?.id === player2.id ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Broadcast Top Bar */}
      <header className="border-b border-white/10 bg-slate-950/85 backdrop-blur-md px-5 py-2.5 sticky top-0 z-40 flex flex-wrap gap-3 justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-7 bg-amber-400 rounded-sm" />
          <div>
            <h1 className="font-display text-xl font-extrabold text-white tracking-wider uppercase leading-none flex items-center gap-2">
              FOOTBALL AUCTION 1V1
              {onlineState.isConnected && (
                <span className="text-[10px] font-sans font-extrabold uppercase px-2 py-0.5 rounded-sm bg-emerald-500 text-slate-950 tracking-wider">
                  ONLINE · {onlineState.roomCode}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* TV Broadcast Scorebug: P1 vs P2 */}
        <div className="flex items-stretch rounded overflow-hidden border border-slate-800 bg-slate-900/90 shadow-lg">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 border-l-4 border-l-emerald-400 hover:bg-slate-800/70 transition-colors cursor-pointer text-xs"
            title="Bấm để đổi tên HLV 1"
          >
            <span className="font-display text-sm font-extrabold text-emerald-400 uppercase tracking-wide">
              {player1.name}
            </span>
            <span className="font-mono-num font-bold text-amber-400">{player1.budget}M</span>
            <span className="font-mono-num text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-sm text-slate-300 border border-slate-800">
              {Object.keys(player1.squad).length}/11
            </span>
          </button>

          <div className="px-2.5 flex items-center justify-center bg-slate-950 border-x border-slate-800 font-display text-xs font-extrabold text-slate-400 tracking-widest">
            VS
          </div>

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 border-r-4 border-r-rose-500 border-y border-y-rose-500/40 bg-rose-950/20 hover:bg-rose-950/35 transition-colors cursor-pointer text-xs"
            title="Bấm để đổi tên HLV 2 (Đối thủ)"
          >
            <span className="font-mono-num text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-sm text-slate-300 border border-rose-500/30">
              {Object.keys(player2.squad).length}/11
            </span>
            <span className="font-mono-num font-bold text-amber-400">{player2.budget}M</span>
            <span className="font-display text-sm font-extrabold text-rose-400 uppercase tracking-wide">
              {player2.name}
            </span>
          </button>
        </div>

        {/* Minimal Utility Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            title="Đổi tên & avatar HLV"
          >
            Đặt Tên
          </button>

          <button
            onClick={() => setShowOnlineModal(true)}
            className={`px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              onlineState.isConnected
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                : 'bg-sky-700 hover:bg-sky-600 text-white border-sky-500/60'
            }`}
          >
            {onlineState.isConnected ? 'Phòng Online' : 'Chơi Online'}
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            onClick={() => handleRestart(true)}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Chơi lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area: Centered Vertically on Desktop */}
      <main className="flex-1 p-3.5 max-w-[1700px] mx-auto w-full flex flex-col justify-center relative z-10">
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
                allowCamCdmChoice={gameState === 'tactics'}
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
                isLobby={gameState === 'lobby'}
                p1Ready={p1AuctionReady}
                p2Ready={p2AuctionReady}
                onP1Ready={() => handleToggleAuctionReady('p1')}
                onP2Ready={() => handleToggleAuctionReady('p2')}
                isTactics={gameState === 'tactics'}
                tacticsTimeLeft={tacticsTimeLeft}
                p1TacticsReady={p1TacticsReady}
                p2TacticsReady={p2TacticsReady}
                onP1TacticsReady={() => handleToggleTacticsReady('p1')}
                onP2TacticsReady={() => handleToggleTacticsReady('p2')}
              />
            </div>

            {/* Right: P2 Squad Pitch (Opponent - Red with Red Border) */}
            <div className="lg:col-span-3">
              <PitchView 
                squad={player2.squad} 
                budget={player2.budget} 
                title={player2.name} 
                isOpponent={true}
                allowCamCdmChoice={gameState === 'tactics'}
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
