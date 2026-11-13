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
import GuideModal from './components/GuideModal';
import ChatBox from './components/ChatBox';
import { onlineSync } from './utils/onlineSync';
import { getSavedAccount } from './utils/accountService';
import { sounds } from './utils/sound';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  Globe,
  Edit3,
  Wifi,
  HelpCircle
} from 'lucide-react';

const SESSION_STORAGE_KEY = 'skfootball_active_session_v1';

function loadSavedSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room')?.trim().toUpperCase();
    // If user opened a different room invite link, don't restore old room session
    if (urlRoom && parsed.onlineRoomCode && parsed.onlineRoomCode !== urlRoom) {
      return null;
    }
    if (params.get('test') === 'match') return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  const initialSessionRef = useRef(undefined);
  if (initialSessionRef.current === undefined) {
    initialSessionRef.current = loadSavedSession();
  }
  const saved = initialSessionRef.current;

  const [isMuted, setIsMuted] = useState(false);
  const [gameState, setGameState] = useState(() => saved?.gameState || 'lobby'); // 'lobby', 'auction', 'round_result', 'tactics', 'final_match'
  const [p1AuctionReady, setP1AuctionReady] = useState(() => Boolean(saved?.p1AuctionReady));
  const [p2AuctionReady, setP2AuctionReady] = useState(() => Boolean(saved?.p2AuctionReady));
  const [tacticsTimeLeft, setTacticsTimeLeft] = useState(() => typeof saved?.tacticsTimeLeft === 'number' ? saved.tacticsTimeLeft : 30);
  const [p1TacticsReady, setP1TacticsReady] = useState(() => Boolean(saved?.p1TacticsReady));
  const [p2TacticsReady, setP2TacticsReady] = useState(() => Boolean(saved?.p2TacticsReady));

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Online Multiplayer State
  const [onlineState, setOnlineState] = useState({
    isConnected: false,
    role: null, // 'host' or 'guest'
    roomCode: null
  });
  const [onlineAccount, setOnlineAccount] = useState(() => getSavedAccount());

  // 11-Round Fixed Schedule: 1 GK, 4 DF, 3 MF, 3 FW
  const [schedule, setSchedule] = useState(() => saved?.schedule || generateDraftSchedule());
  const [currentRoundIdx, setCurrentRoundIdx] = useState(() => typeof saved?.currentRoundIdx === 'number' ? saved.currentRoundIdx : 0);

  // Player 1 & Player 2 Managers (Customizable Names & Avatars)
  const [player1, setPlayer1] = useState(() => saved?.player1 || {
    id: 'p1',
    name: 'HLV 1 (Bạn)',
    avatar: '🟢',
    budget: 1000,
    color: '#10b981',
    squad: {}
  });

  const [player2, setPlayer2] = useState(() => saved?.player2 || {
    id: 'p2',
    name: 'HLV 2 (Đối thủ)',
    avatar: '🔴',
    budget: 1000,
    color: '#ef4444',
    squad: {}
  });

  const [isP2Bot, setIsP2Bot] = useState(() => Boolean(saved?.isP2Bot));

  // Auction State within current round
  const [currentTier1Player, setCurrentTier1Player] = useState(() => saved?.currentTier1Player || null);
  const [usedPlayerIds, setUsedPlayerIds] = useState(() => new Set(saved?.usedIds || []));
  const usedPlayerIdsRef = useRef(new Set(saved?.usedIds || []));
  const [timeLeft, setTimeLeft] = useState(() =>
    saved?.roundEndsAt ? Math.max(0, Math.ceil((saved.roundEndsAt - Date.now()) / 1000)) : 10
  );
  const [roundEndsAt, setRoundEndsAt] = useState(() => saved?.roundEndsAt || null);
  const roundEndsAtRef = useRef(saved?.roundEndsAt || null);
  const timerPausedUntilRef = useRef(0);
  const lastTickSecondRef = useRef(null);
  const [currentBid, setCurrentBid] = useState(() => typeof saved?.currentBid === 'number' ? saved.currentBid : 0);
  const topBidRef = useRef(typeof saved?.currentBid === 'number' ? saved.currentBid : 0);
  const [highestBidder, setHighestBidder] = useState(() => {
    if (!saved?.highestBidderId) return null;
    return saved.highestBidderId === 'p1' ? (saved.player1 || null) : (saved.player2 || null);
  });
  const leaderIdRef = useRef(saved?.highestBidderId || null);
  const [bidHistory, setBidHistory] = useState(() => saved?.bidHistory || []);
  const [p1Passed, setP1Passed] = useState(() => Boolean(saved?.p1Passed));
  const [p2Passed, setP2Passed] = useState(() => Boolean(saved?.p2Passed));
  const [currentTurn, setCurrentTurn] = useState(() => saved?.currentTurn || 'p1');
  const currentTurnRef = useRef(saved?.currentTurn || 'p1');
  const [isAuctionActive, setIsAuctionActive] = useState(() => typeof saved?.isAuctionActive === 'boolean' ? saved.isAuctionActive : true);

  const setAuctionDeadline = (endsAt) => {
    roundEndsAtRef.current = endsAt;
    setRoundEndsAt(endsAt);
    lastTickSecondRef.current = null;
    if (endsAt) {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    } else {
      setTimeLeft(12);
    }
  };

  topBidRef.current = currentBid;
  leaderIdRef.current = highestBidder?.id || null;
  currentTurnRef.current = currentTurn;

  // Round Result State
  const [roundWinnerInfo, setRoundWinnerInfo] = useState(() => saved?.roundWinnerInfo || null);
  const [roundLoserInfo, setRoundLoserInfo] = useState(() => saved?.roundLoserInfo || null);
  const [roundTier1, setRoundTier1] = useState(() => saved?.roundTier1 || null);
  const [roundTier2, setRoundTier2] = useState(() => saved?.roundTier2 || null);
  const [p1Candidates, setP1Candidates] = useState(() => saved?.p1Candidates || []);
  const [p2Candidates, setP2Candidates] = useState(() => saved?.p2Candidates || []);
  const [matchRemoteMsg, setMatchRemoteMsg] = useState(null);
  const [chatMessages, setChatMessages] = useState(() => saved?.chatMessages || []);

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

  // Persist active session so page reload (F5) keeps match progress and reconnects Online
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const onlineRole = onlineState.role || onlineState.pendingRole || null;
      const onlineRoomCode = onlineState.roomCode || onlineState.pendingRoomCode || null;
      const payload = {
        onlineRole,
        onlineRoomCode,
        gameState,
        isP2Bot,
        schedule,
        currentRoundIdx,
        currentTier1Player,
        usedIds: Array.from(usedPlayerIdsRef.current),
        player1,
        player2,
        p1AuctionReady,
        p2AuctionReady,
        p1TacticsReady,
        p2TacticsReady,
        tacticsTimeLeft,
        currentBid,
        roundEndsAt: roundEndsAtRef.current,
        highestBidderId: highestBidder?.id || null,
        bidHistory,
        p1Passed,
        p2Passed,
        currentTurn: currentTurnRef.current,
        isAuctionActive,
        roundWinnerInfo,
        roundLoserInfo,
        roundTier1,
        roundTier2,
        p1Candidates,
        p2Candidates,
        chatMessages
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota/private mode errors
    }
  }, [
    onlineState.role,
    onlineState.roomCode,
    onlineState.pendingRole,
    onlineState.pendingRoomCode,
    gameState,
    isP2Bot,
    schedule,
    currentRoundIdx,
    currentTier1Player,
    usedPlayerIds,
    player1,
    player2,
    p1AuctionReady,
    p2AuctionReady,
    p1TacticsReady,
    p2TacticsReady,
    tacticsTimeLeft,
    currentBid,
    roundEndsAt,
    highestBidder,
    bidHistory,
    p1Passed,
    p2Passed,
    currentTurn,
    isAuctionActive,
    roundWinnerInfo,
    roundLoserInfo,
    roundTier1,
    roundTier2,
    p1Candidates,
    p2Candidates,
    chatMessages
  ]);

  // Initialize first round or restore & reconnect saved session
  useEffect(() => {
    if (saved && saved.currentTier1Player) {
      // Restored from sessionStorage: keep progress and auto-reconnect if previously in an online room
      if (saved.onlineRole === 'host' && saved.onlineRoomCode) {
        handleHostOnlineRoom(saved.onlineRoomCode, true);
      } else if (saved.onlineRole === 'guest' && saved.onlineRoomCode) {
        handleJoinOnlineRoom(saved.onlineRoomCode, true);
      }
      return;
    }

    const cat = schedule[0].category;
    const excluded = buildExcludedIds();
    const p = selectPlayerForCategory(TIER_1_PLAYERS, cat, excluded);
    markPlayerUsed(p?.id);
    setCurrentTier1Player(p);
    setCurrentBid(0);
    setTimeLeft(12);
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
        if (getSavedAccount()) {
          handleJoinOnlineRoom(roomParam);
        } else {
          setShowOnlineModal(true);
        }
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

  // Online message receiver dispatcher (ref avoids stale closures in PeerJS callback)
  const remoteHandlerRef = useRef(null);
  const sendFullSyncStateRef = useRef(null);

  const sendFullSyncState = () => {
    onlineSync.send({
      type: 'SYNC_STATE',
      schedule,
      currentRoundIdx,
      currentTier1Player,
      usedIds: Array.from(usedPlayerIdsRef.current),
      player1,
      player2,
      gameState,
      p1AuctionReady,
      p2AuctionReady,
      p1TacticsReady,
      p2TacticsReady,
      tacticsTimeLeft,
      currentBid,
      timeLeft,
      roundEndsAt: roundEndsAtRef.current,
      highestBidderId: highestBidder?.id || null,
      bidHistory,
      p1Passed,
      p2Passed,
      currentTurn: currentTurnRef.current,
      isAuctionActive,
      roundWinnerInfo,
      roundLoserInfo,
      roundTier1,
      roundTier2,
      p1Candidates,
      p2Candidates,
      chatMessages
    });
  };

  sendFullSyncStateRef.current = sendFullSyncState;

  const handleRemoteMessage = (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'REQUEST_SYNC') {
      if (onlineState.role === 'host') {
        sendFullSyncState();
      }
    } else if (msg.type === 'SYNC_STATE') {
      if (onlineState.role === 'guest') {
        if (msg.schedule) setSchedule(msg.schedule);
        if (typeof msg.currentRoundIdx === 'number') setCurrentRoundIdx(msg.currentRoundIdx);
        if (msg.currentTier1Player) setCurrentTier1Player(msg.currentTier1Player);
        if (Array.isArray(msg.usedIds)) {
          usedPlayerIdsRef.current = new Set(msg.usedIds);
          setUsedPlayerIds(new Set(msg.usedIds));
        }
        if (msg.player1) setPlayer1(msg.player1);
        if (msg.player2) setPlayer2(msg.player2);
        if (msg.gameState) setGameState(msg.gameState);
        if (typeof msg.p1AuctionReady === 'boolean') setP1AuctionReady(msg.p1AuctionReady);
        if (typeof msg.p2AuctionReady === 'boolean') setP2AuctionReady(msg.p2AuctionReady);
        if (typeof msg.p1TacticsReady === 'boolean') setP1TacticsReady(msg.p1TacticsReady);
        if (typeof msg.p2TacticsReady === 'boolean') setP2TacticsReady(msg.p2TacticsReady);
        if (typeof msg.tacticsTimeLeft === 'number') setTacticsTimeLeft(msg.tacticsTimeLeft);
        if (typeof msg.currentBid === 'number') {
          topBidRef.current = msg.currentBid;
          setCurrentBid(msg.currentBid);
        }
        if (msg.roundEndsAt) {
          setAuctionDeadline(msg.roundEndsAt);
        } else if (typeof msg.timeLeft === 'number') {
          setTimeLeft(msg.timeLeft);
        }
        if (msg.highestBidderId) {
          const hb = msg.highestBidderId === 'p1' ? (msg.player1 || player1) : (msg.player2 || player2);
          leaderIdRef.current = hb.id;
          setHighestBidder(hb);
        } else {
          leaderIdRef.current = null;
          setHighestBidder(null);
        }
        if (Array.isArray(msg.bidHistory)) setBidHistory(msg.bidHistory);
        if (typeof msg.p1Passed === 'boolean') setP1Passed(msg.p1Passed);
        if (typeof msg.p2Passed === 'boolean') setP2Passed(msg.p2Passed);
        if (typeof msg.currentTurn === 'string' && msg.currentTurn) {
          currentTurnRef.current = msg.currentTurn;
          setCurrentTurn(msg.currentTurn);
        }
        if (typeof msg.isAuctionActive === 'boolean') setIsAuctionActive(msg.isAuctionActive);
        if ('roundWinnerInfo' in msg) setRoundWinnerInfo(msg.roundWinnerInfo);
        if ('roundLoserInfo' in msg) setRoundLoserInfo(msg.roundLoserInfo);
        if ('roundTier1' in msg) setRoundTier1(msg.roundTier1);
        if ('roundTier2' in msg) setRoundTier2(msg.roundTier2);
        if (Array.isArray(msg.p1Candidates)) setP1Candidates(msg.p1Candidates);
        if (Array.isArray(msg.p2Candidates)) setP2Candidates(msg.p2Candidates);
        if (Array.isArray(msg.chatMessages)) setChatMessages(msg.chatMessages);
      }
    } else if (msg.type === 'ROUND_START') {
      if (msg.currentTurn) {
        currentTurnRef.current = msg.currentTurn;
        setCurrentTurn(msg.currentTurn);
      }
      if (msg.roundEndsAt) {
        setAuctionDeadline(msg.roundEndsAt);
      }
      sounds.playWhistle();
      setIsAuctionActive(true);
      setGameState('auction');
    } else if (msg.type === 'EXTEND_TIMER') {
      if (msg.roundEndsAt) {
        timerPausedUntilRef.current = Date.now() + 1000;
        roundEndsAtRef.current = msg.roundEndsAt;
        setRoundEndsAt(msg.roundEndsAt);
      }
    } else if (msg.type === 'BID') {
      const manager = msg.playerRole === 'p1' ? player1 : player2;
      handleLocalBid(manager, msg.amount, false, msg.roundEndsAt);
    } else if (msg.type === 'AUCTION_READY') {
      if (msg.playerRole === 'p1') setP1AuctionReady(Boolean(msg.ready));
      if (msg.playerRole === 'p2') setP2AuctionReady(Boolean(msg.ready));
    } else if (msg.type === 'TACTICS_READY') {
      if (msg.playerRole === 'p1') setP1TacticsReady(Boolean(msg.ready));
      if (msg.playerRole === 'p2') setP2TacticsReady(Boolean(msg.ready));
    } else if (msg.type === 'PASS') {
      if (msg.playerRole === 'p1') setP1Passed(true);
      if (msg.playerRole === 'p2') setP2Passed(true);
      if (!onlineState.isConnected || onlineState.role === 'host') {
        handleAuctionEnd(msg.playerRole);
      }
    } else if (msg.type === 'ROUND_RESULT') {
      const winMgr = msg.winnerId === 'p1' ? player1 : player2;
      const loseMgr = msg.winnerId === 'p1' ? player2 : player1;
      setIsAuctionActive(false);
      sounds.playGavel();
      if (msg.tier1?.id) markPlayerUsed(msg.tier1.id);
      if (msg.tier2?.id) markPlayerUsed(msg.tier2.id);
      setP1Candidates(msg.p1OpenSlots || []);
      setP2Candidates(msg.p2OpenSlots || []);
      setRoundWinnerInfo({ ...winMgr, amount: msg.finalWinningBid });
      setRoundLoserInfo(loseMgr);
      setRoundTier1(msg.tier1);
      setRoundTier2(msg.tier2);
      setGameState('round_result');
    } else if (msg.type === 'UPDATE_PROFILE') {
      if (msg.p1Name) setPlayer1(p => ({ ...p, name: msg.p1Name, avatar: msg.p1Avatar || p.avatar }));
      if (msg.p2Name) setPlayer2(p => ({ ...p, name: msg.p2Name, avatar: msg.p2Avatar || p.avatar }));
    } else if (msg.type === 'CONFIRM_PLACEMENT_REQ') {
      if (onlineState.role === 'host') {
        handleConfirmPlacement(msg.data, true, true);
      }
    } else if (msg.type === 'CONFIRM_PLACEMENT') {
      handleConfirmPlacement(msg.data, false, false);
    } else if (msg.type === 'SWAP_SLOT') {
      if (msg.playerRole === 'p1') handleP1Swap(msg.slotA, msg.slotB, false);
      if (msg.playerRole === 'p2') handleP2Swap(msg.slotA, msg.slotB, false);
    } else if (msg.type.startsWith('MATCH_')) {
      setMatchRemoteMsg(msg);
    } else if (msg.type === 'CHAT_MSG') {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, {
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          text: msg.text,
          timestamp: msg.timestamp
        }];
      });
    } else if (msg.type === 'RESTART') {
      handleRestart(false, msg.newSchedule, msg.firstT1);
    }
  };

  remoteHandlerRef.current = handleRemoteMessage;

  const handleOnlineAccountChange = (acc) => {
    setOnlineAccount(acc);
    if (!acc?.displayName) return;

    if (onlineState.isConnected && onlineState.role === 'guest') {
      setPlayer2(p => ({ ...p, name: acc.displayName }));
      onlineSync.send({ type: 'UPDATE_PROFILE', p2Name: acc.displayName });
    } else {
      setPlayer1(p => ({ ...p, name: acc.displayName }));
      if (onlineState.isConnected && onlineState.role === 'host') {
        onlineSync.send({ type: 'UPDATE_PROFILE', p1Name: acc.displayName });
      }
    }
  };

  // Online Room Handlers
  const handleHostOnlineRoom = (code, isReconnect = false) => {
    const cleanCode = code.trim().toUpperCase();
    if (!isReconnect && onlineAccount?.displayName) {
      setPlayer1(p => ({ ...p, name: onlineAccount.displayName }));
    }
    setOnlineState({ isConnected: false, role: null, roomCode: null, pendingRole: 'host', pendingRoomCode: cleanCode });
    onlineSync.createRoom(
      cleanCode,
      ({ role, roomCode }) => {
        setOnlineState({ isConnected: true, role, roomCode, pendingRole: null, pendingRoomCode: null });
        setIsP2Bot(false); // disable bot in online multiplayer
        setTimeout(() => sendFullSyncStateRef.current?.(), 250);
      },
      (msg) => remoteHandlerRef.current?.(msg),
      () => setOnlineState({ isConnected: false, role: null, roomCode: null, pendingRole: null, pendingRoomCode: null })
    );
  };

  const handleJoinOnlineRoom = (code, isReconnect = false) => {
    const cleanCode = code.trim().toUpperCase();
    if (!isReconnect && onlineAccount?.displayName) {
      setPlayer2(p => ({ ...p, name: onlineAccount.displayName }));
    }
    setOnlineState({ isConnected: false, role: null, roomCode: null, pendingRole: 'guest', pendingRoomCode: cleanCode });
    onlineSync.joinRoom(
      cleanCode,
      ({ role, roomCode }) => {
        setOnlineState({ isConnected: true, role, roomCode, pendingRole: null, pendingRoomCode: null });
        setIsP2Bot(false);
        setTimeout(() => {
          onlineSync.send({ type: 'REQUEST_SYNC' });
          if (onlineAccount?.displayName) {
            onlineSync.send({ type: 'UPDATE_PROFILE', p2Name: onlineAccount.displayName });
          }
        }, 200);
      },
      (msg) => remoteHandlerRef.current?.(msg),
      () => setOnlineState({ isConnected: false, role: null, roomCode: null, pendingRole: null, pendingRoomCode: null })
    );
  };

  const handleDisconnectOnline = () => {
    onlineSync.disconnect();
    setOnlineState({ isConnected: false, role: null, roomCode: null, pendingRole: null, pendingRoomCode: null });
    setChatMessages([]);
  };

  // Start Round 1 only when BOTH players are ready
  useEffect(() => {
    if (gameState !== 'lobby') return;
    if (isP2Bot && !p2AuctionReady) {
      setP2AuctionReady(true);
      return;
    }
    if (p1AuctionReady && p2AuctionReady) {
      if (onlineState.isConnected && onlineState.role === 'guest') {
        return; // Guest waits for Host's ROUND_START with authoritative roundEndsAt
      }
      const endsAt = Date.now() + 12000;
      currentTurnRef.current = 'p1';
      setCurrentTurn('p1');
      setAuctionDeadline(endsAt);
      sounds.playWhistle();
      setIsAuctionActive(true);
      setGameState('auction');
      if (onlineState.isConnected && onlineState.role === 'host') {
        onlineSync.send({ type: 'ROUND_START', roundEndsAt: endsAt, currentTurn: 'p1' });
      }
    }
  }, [gameState, p1AuctionReady, p2AuctionReady, isP2Bot, onlineState.isConnected, onlineState.role]);

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

  // Timestamp-based countdown timer (prevents clock drift between 2 online devices)
  useEffect(() => {
    if (gameState !== 'auction' || !isAuctionActive || !roundEndsAt) return;

    const updateRemaining = () => {
      const now = Date.now();
      if (now < timerPausedUntilRef.current) return;
      const remaining = Math.max(0, Math.ceil((roundEndsAt - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 3 && remaining >= 1 && lastTickSecondRef.current !== remaining) {
        lastTickSecondRef.current = remaining;
        sounds.playTick();
      }
      if (remaining <= 0) {
        handleAuctionEnd(currentTurnRef.current);
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 200);

    return () => clearInterval(timer);
  }, [roundEndsAt, gameState, isAuctionActive]);

  // AI Bot logic for Player 2 (only in offline/local mode, and only on P2's turn)
  useEffect(() => {
    if (onlineState.isConnected || !isP2Bot || gameState !== 'auction' || !isAuctionActive || p2Passed || currentTurn !== 'p2' || timeLeft <= 0) return;
    if (highestBidder?.id === player2.id) return;

    const botTimer = setTimeout(() => {
      const steps = [10, 25, 50];
      const increment = steps[Math.floor(Math.random() * steps.length)];
      const desiredBid = (highestBidder ? currentBid : 0) + increment;

      if (desiredBid <= p2MaxBid && Math.random() < 0.78) {
        handleLocalBid(player2, desiredBid, true);
      } else if (currentBid + 10 <= p2MaxBid && Math.random() < 0.5) {
        handleLocalBid(player2, currentBid + 10, true);
      } else {
        handlePass('p2');
      }
    }, Math.random() * 1200 + 800);

    return () => clearTimeout(botTimer);
  }, [isP2Bot, onlineState.isConnected, currentBid, highestBidder, timeLeft, p2Passed, currentTurn, gameState, isAuctionActive]);

  const handleExtendTurnTimer = () => {
    if (gameState !== 'auction' || !isAuctionActive || !roundEndsAtRef.current) return;
    const now = Date.now();
    const newPauseEnd = now + 1000;
    const effectivePrev = Math.max(now, timerPausedUntilRef.current);
    const addedMs = Math.max(0, newPauseEnd - effectivePrev);
    timerPausedUntilRef.current = newPauseEnd;
    const nextEndsAt = roundEndsAtRef.current + addedMs;
    roundEndsAtRef.current = nextEndsAt;
    setRoundEndsAt(nextEndsAt);
    if (onlineState.isConnected) {
      onlineSync.send({ type: 'EXTEND_TIMER', roundEndsAt: nextEndsAt });
    }
  };

  // Unified Turn-Based Bid Handler with Race Condition Guard
  const handleLocalBid = (manager, amount, broadcast = true, incomingRoundEndsAt = null) => {
    if (!isAuctionActive) return;
    if (currentTurnRef.current && manager.id !== currentTurnRef.current) return;
    const now = Date.now();
    if (roundEndsAtRef.current && now >= roundEndsAtRef.current) return;
    if (manager.id === player1.id && p1Passed) return;
    if (manager.id === player2.id && p2Passed) return;

    const maxAllowed = manager.id === player1.id ? p1MaxBid : p2MaxBid;
    const minValid = leaderIdRef.current ? topBidRef.current + 1 : 1;
    if (amount < minValid || amount > maxAllowed) return;

    topBidRef.current = amount;
    leaderIdRef.current = manager.id;
    setCurrentBid(amount);
    setHighestBidder(manager);
    sounds.playBid();

    // Switch turn to the other player and reset turn timer to 12s
    const nextTurn = manager.id === 'p1' ? 'p2' : 'p1';
    currentTurnRef.current = nextTurn;
    setCurrentTurn(nextTurn);

    const nextEndsAt = incomingRoundEndsAt || (now + 12000);
    setAuctionDeadline(nextEndsAt);

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
        amount,
        roundEndsAt: nextEndsAt
      });
    }
  };

  const handlePass = (managerId) => {
    if (!isAuctionActive) return;
    if (currentTurnRef.current && managerId !== currentTurnRef.current) return;
    if (managerId === 'p1') setP1Passed(true);
    if (managerId === 'p2') setP2Passed(true);

    if (onlineState.isConnected) {
      onlineSync.send({
        type: 'PASS',
        playerRole: managerId
      });
    }

    if (!onlineState.isConnected || onlineState.role === 'host') {
      handleAuctionEnd(managerId);
    }
  };

  // Auction Round Resolution (Host-authoritative in online mode)
  const handleAuctionEnd = (passedBy = null) => {
    setIsAuctionActive(false);
    sounds.playGavel();

    if (onlineState.isConnected && onlineState.role === 'guest') {
      // Guest waits for Host's authoritative ROUND_RESULT payload
      return;
    }

    let winner = highestBidder;
    let finalWinningBid = currentBid;

    if (!winner) {
      if (passedBy === 'p1') {
        winner = player2;
      } else if (passedBy === 'p2') {
        winner = player1;
      } else {
        winner = Math.random() > 0.5 ? player1 : player2;
      }
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

    if (onlineState.isConnected && onlineState.role === 'host') {
      onlineSync.send({
        type: 'ROUND_RESULT',
        winnerId: winner.id,
        finalWinningBid,
        tier1: currentTier1Player,
        tier2,
        p1OpenSlots,
        p2OpenSlots
      });
    }
  };

  // Safe Slot Assignment with CAM/CDM mutual exclusion
  const assignSlotToSquad = (prevSquad, slotId, player) => {
    const newSquad = { ...prevSquad, [slotId]: player };
    if (slotId === 'cam') delete newSquad['cdm'];
    if (slotId === 'cdm') delete newSquad['cam'];
    return newSquad;
  };

  // Confirm placement from MysteryBoxModal (Host-authoritative next player in online mode)
  const handleConfirmPlacement = ({ p1SlotId, p2SlotId, nextT1: remoteNextT1, roundEndsAt: remoteRoundEndsAt }, broadcast = true, forceExecute = false) => {
    if (gameState !== 'round_result') return;
    if (onlineState.isConnected && onlineState.role === 'guest' && broadcast && !forceExecute) {
      onlineSync.send({
        type: 'CONFIRM_PLACEMENT_REQ',
        data: { p1SlotId, p2SlotId }
      });
      return;
    }

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

    // Go to 30s tactics rearrangement phase after all 11 players are drafted
    const nextIdx = currentRoundIdx + 1;
    if (nextIdx >= schedule.length) {
      if (broadcast && onlineState.isConnected) {
        onlineSync.send({
          type: 'CONFIRM_PLACEMENT',
          data: { p1SlotId, p2SlotId }
        });
      }
      setTacticsTimeLeft(30);
      setP1TacticsReady(false);
      setP2TacticsReady(isP2Bot);
      setGameState('tactics');
      sounds.playWhistle();
      return;
    }

    const nextCat = schedule[nextIdx].category;
    const excluded = buildExcludedIds();
    const nextT1 = remoteNextT1 || selectPlayerForCategory(TIER_1_PLAYERS, nextCat, excluded);
    markPlayerUsed(nextT1?.id);

    const nextEndsAt = remoteRoundEndsAt || (Date.now() + 12000);
    const nextStarter = nextIdx % 2 === 0 ? 'p1' : 'p2';

    if (broadcast && onlineState.isConnected) {
      onlineSync.send({
        type: 'CONFIRM_PLACEMENT',
        data: { p1SlotId, p2SlotId, nextT1, roundEndsAt: nextEndsAt }
      });
    }

    setCurrentRoundIdx(nextIdx);
    setCurrentTier1Player(nextT1);
    topBidRef.current = 0;
    leaderIdRef.current = null;
    setCurrentBid(0);
    currentTurnRef.current = nextStarter;
    setCurrentTurn(nextStarter);
    setAuctionDeadline(nextEndsAt);
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

  const handleP1Swap = (slotA, slotB, broadcast = true) => {
    setPlayer1(prev => ({ ...prev, squad: handleSwap(prev.squad, slotA, slotB) }));
    if (broadcast && onlineState.isConnected) {
      onlineSync.send({ type: 'SWAP_SLOT', playerRole: 'p1', slotA, slotB });
    }
  };

  const handleP2Swap = (slotA, slotB, broadcast = true) => {
    setPlayer2(prev => ({ ...prev, squad: handleSwap(prev.squad, slotA, slotB) }));
    if (broadcast && onlineState.isConnected) {
      onlineSync.send({ type: 'SWAP_SLOT', playerRole: 'p2', slotA, slotB });
    }
  };

  // Restart Entire Game
  const handleRestart = (broadcast = true, remoteSchedule = null, remoteFirstT1 = null) => {
    const newSchedule = remoteSchedule || generateDraftSchedule();
    setSchedule(newSchedule);
    setPlayer1(p => ({ ...p, budget: 1000, squad: {} }));
    setPlayer2(p => ({ ...p, budget: 1000, squad: {} }));
    usedPlayerIdsRef.current = new Set();
    setUsedPlayerIds(new Set());
    setCurrentRoundIdx(0);
    const firstCat = newSchedule[0].category;
    const firstT1 = remoteFirstT1 || selectPlayerForCategory(TIER_1_PLAYERS, firstCat, usedPlayerIdsRef.current);
    markPlayerUsed(firstT1?.id);
    setCurrentTier1Player(firstT1);
    topBidRef.current = 0;
    leaderIdRef.current = null;
    setCurrentBid(0);
    currentTurnRef.current = 'p1';
    setCurrentTurn('p1');
    setAuctionDeadline(null);
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
    setChatMessages([]);
    setGameState('lobby');

    if (broadcast && onlineState.isConnected) {
      onlineSync.send({ type: 'RESTART', newSchedule, firstT1 });
    }
  };

  const handleSendChatMessage = (text) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    const selfId = onlineState.isConnected && onlineState.role === 'guest' ? 'p2' : 'p1';
    const rawSelfName = selfId === 'p2' ? player2.name : player1.name;
    const cleanName = (rawSelfName || 'HLV')
      .replace(/\s*\(Bạn\)\s*$/i, '')
      .replace(/\s*\(Đối thủ\)\s*$/i, '')
      .trim();

    const chatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: selfId,
      senderName: cleanName,
      text: trimmed,
      timestamp: Date.now()
    };

    setChatMessages((prev) => [...prev, chatMsg]);
    if (onlineState.isConnected) {
      onlineSync.send({ type: 'CHAT_MSG', ...chatMsg });
    }
  };

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  // Perspective mapping: in online mode, each player always sees themselves on the LEFT in GREEN ("Bạn")
  // and their opponent on the RIGHT in RED ("Đối thủ"), while keeping p1/p2 IDs intact for network sync.
  const isGuestView = onlineState.isConnected && onlineState.role === 'guest';

  const formatDisplayPlayer = (mgr, isSelf) => {
    if (!onlineState.isConnected) return mgr;
    const baseName = mgr.name
      .replace(/\s*\(Bạn\)\s*$/i, '')
      .replace(/\s*\(Đối thủ\)\s*$/i, '')
      .trim();
    return {
      ...mgr,
      name: `${baseName} (${isSelf ? 'Bạn' : 'Đối thủ'})`
    };
  };

  const leftPlayer = isGuestView
    ? formatDisplayPlayer(player2, true)
    : formatDisplayPlayer(player1, true);
  const rightPlayer = isGuestView
    ? formatDisplayPlayer(player1, false)
    : formatDisplayPlayer(player2, false);

  const leftMaxBid = isGuestView ? p2MaxBid : p1MaxBid;
  const rightMaxBid = isGuestView ? p1MaxBid : p2MaxBid;
  const leftPassed = isGuestView ? p2Passed : p1Passed;
  const rightPassed = isGuestView ? p1Passed : p2Passed;
  const isLeftDisabled = onlineState.isConnected ? false : false;
  const isRightDisabled = onlineState.isConnected ? true : false;
  const leftReady = isGuestView ? p2AuctionReady : p1AuctionReady;
  const rightReady = isGuestView ? p1AuctionReady : p2AuctionReady;
  const leftTacticsReady = isGuestView ? p2TacticsReady : p1TacticsReady;
  const rightTacticsReady = isGuestView ? p1TacticsReady : p2TacticsReady;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative">
      {/* Full-Web Half-Screen Background Light for Current Highest Bidder */}
      <div
        className={`fixed inset-y-0 left-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-r from-emerald-500/45 via-emerald-500/22 to-transparent ${
          gameState === 'auction' && highestBidder?.id === leftPlayer.id ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`fixed inset-y-0 right-0 w-1/2 pointer-events-none transition-opacity duration-500 z-0 bg-gradient-to-l from-rose-500/45 via-rose-500/22 to-transparent ${
          gameState === 'auction' && highestBidder?.id === rightPlayer.id ? 'opacity-100' : 'opacity-0'
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

        {/* TV Broadcast Scorebug: Self (Green) vs Opponent (Red) */}
        <div className="flex items-stretch rounded overflow-hidden border border-slate-800 bg-slate-900/90 shadow-lg">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 border-l-4 border-l-emerald-400 hover:bg-slate-800/70 transition-colors cursor-pointer text-xs"
            title="Bấm để đổi tên của bạn"
          >
            <span className="font-display text-sm font-extrabold text-emerald-400 uppercase tracking-wide">
              {leftPlayer.name}
            </span>
            <span className="font-mono-num font-bold text-amber-400">{leftPlayer.budget}M</span>
            <span className="font-mono-num text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-sm text-slate-300 border border-slate-800">
              {Object.keys(leftPlayer.squad).length}/11
            </span>
          </button>

          <div className="px-2.5 flex items-center justify-center bg-slate-950 border-x border-slate-800 font-display text-xs font-extrabold text-slate-400 tracking-widest">
            VS
          </div>

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 border-r-4 border-r-rose-500 border-y border-y-rose-500/40 bg-rose-950/20 hover:bg-rose-950/35 transition-colors cursor-pointer text-xs"
            title="Bấm để đổi tên đối thủ"
          >
            <span className="font-mono-num text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-sm text-slate-300 border border-rose-500/30">
              {Object.keys(rightPlayer.squad).length}/11
            </span>
            <span className="font-mono-num font-bold text-amber-400">{rightPlayer.budget}M</span>
            <span className="font-display text-sm font-extrabold text-rose-400 uppercase tracking-wide">
              {rightPlayer.name}
            </span>
          </button>
        </div>

        {/* Minimal Utility Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuideModal(true)}
            className="px-3 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            title="Hướng dẫn cách chơi, CHEM, đổi vị trí & đấu giá"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hướng Dẫn</span>
          </button>

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

      {/* Top Chat Strip: Self Chat Button + Latest Message (Left) | Opponent Latest Message (Right) */}
      <ChatBox
        messages={chatMessages}
        selfId={isGuestView ? 'p2' : 'p1'}
        onSendMessage={handleSendChatMessage}
      />

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
            {/* Left: Self Squad Pitch (Green) */}
            <div className="lg:col-span-3">
              <PitchView 
                squad={leftPlayer.squad} 
                budget={leftPlayer.budget} 
                title={leftPlayer.name} 
                isOpponent={false}
                allowCamCdmChoice={gameState === 'tactics'}
                onSwap={isGuestView ? handleP2Swap : handleP1Swap}
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
                player1={leftPlayer}
                player2={rightPlayer}
                p1MaxBid={leftMaxBid}
                p2MaxBid={rightMaxBid}
                onP1Bid={(amt) => handleLocalBid(isGuestView ? player2 : player1, amt, true)}
                onP1Pass={() => handlePass(isGuestView ? 'p2' : 'p1')}
                onP2Bid={(amt) => handleLocalBid(isGuestView ? player1 : player2, amt, true)}
                onP2Pass={() => handlePass(isGuestView ? 'p1' : 'p2')}
                p1Passed={leftPassed}
                p2Passed={rightPassed}
                isP2Bot={isP2Bot}
                onToggleP2Bot={() => setIsP2Bot(!isP2Bot)}
                bidHistory={bidHistory}
                isAuctionActive={isAuctionActive}
                isP1Disabled={isLeftDisabled}
                isP2Disabled={isRightDisabled}
                isP1Turn={currentTurn === (isGuestView ? 'p2' : 'p1')}
                isP2Turn={currentTurn === (isGuestView ? 'p1' : 'p2')}
                onStageBid={handleExtendTurnTimer}
                isLobby={gameState === 'lobby'}
                p1Ready={leftReady}
                p2Ready={rightReady}
                onP1Ready={() => handleToggleAuctionReady(isGuestView ? 'p2' : 'p1')}
                onP2Ready={() => handleToggleAuctionReady(isGuestView ? 'p1' : 'p2')}
                isTactics={gameState === 'tactics'}
                tacticsTimeLeft={tacticsTimeLeft}
                p1TacticsReady={leftTacticsReady}
                p2TacticsReady={rightTacticsReady}
                onP1TacticsReady={() => handleToggleTacticsReady(isGuestView ? 'p2' : 'p1')}
                onP2TacticsReady={() => handleToggleTacticsReady(isGuestView ? 'p1' : 'p2')}
              />
            </div>

            {/* Right: Opponent Squad Pitch (Red with Red Border) */}
            <div className="lg:col-span-3">
              <PitchView 
                squad={rightPlayer.squad} 
                budget={rightPlayer.budget} 
                title={rightPlayer.name} 
                isOpponent={true}
                allowCamCdmChoice={gameState === 'tactics'}
                onSwap={onlineState.isConnected ? null : handleP2Swap}
              />
            </div>
          </div>
        )}
      </main>

      {/* Round End Result Modal */}
      {gameState === 'round_result' && (
        <MysteryBoxModal 
          winnerInfo={roundWinnerInfo ? formatDisplayPlayer(roundWinnerInfo, roundWinnerInfo.id === (isGuestView ? 'p2' : 'p1')) : null}
          loserInfo={roundLoserInfo ? formatDisplayPlayer(roundLoserInfo, roundLoserInfo.id === (isGuestView ? 'p2' : 'p1')) : null}
          viewerRoleId={isGuestView ? 'p2' : 'p1'}
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
          account={onlineAccount}
          onAccountChange={handleOnlineAccountChange}
          onHostRoom={handleHostOnlineRoom}
          onJoinRoom={handleJoinOnlineRoom}
          onDisconnect={handleDisconnectOnline}
          onClose={() => setShowOnlineModal(false)}
        />
      )}

      {/* Guide / How to Play Modal */}
      {showGuideModal && (
        <GuideModal onClose={() => setShowGuideModal(false)} />
      )}
    </div>
  );
}
