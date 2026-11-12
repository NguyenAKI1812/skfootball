import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Play, RotateCcw, Flame, Shield, Award, Users, 
  CheckCircle2, Clock, Volume2, Sparkles, Activity, AlertCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/sound';

export default function HeadToHeadMatch({ 
  player1, 
  player2, 
  isP2Bot = false,
  onlineState = { isConnected: false, role: null },
  matchRemoteMsg = null,
  onSendMatchMessage = null,
  onRestart 
}) {
  // Phase: 'lobby' (waiting ready) -> 'countdown' (3..2..1) -> 'playing' (fast clock + highlights) -> 'penalty' (if tied) -> 'finished'
  const [matchPhase, setMatchPhase] = useState('lobby');
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Live match state
  const [currentMinute, setCurrentMinute] = useState(0);
  const [liveScore1, setLiveScore1] = useState(0);
  const [liveScore2, setLiveScore2] = useState(0);
  const [penScore1, setPenScore1] = useState(null);
  const [penScore2, setPenScore2] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [highlightCountdown, setHighlightCountdown] = useState(3);
  const [eventsTimeline, setEventsTimeline] = useState([]);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [winner, setWinner] = useState(null);
  const [mvp, setMvp] = useState(null);

  // Penalty Shootout sequence state
  const [penaltyKicks, setPenaltyKicks] = useState([]);
  const [currentPenIndex, setCurrentPenIndex] = useState(0);

  // References to keep timer accurate in interval
  const minuteRef = useRef(0);
  minuteRef.current = currentMinute;
  const isPausedRef = useRef(false);

  // 1. Calculate Team Power & Stats
  const calcTeamInfo = (manager) => {
    const squadList = Object.values(manager.squad || {}).filter(Boolean);
    const avgOvr = squadList.length > 0 
      ? Math.round(squadList.reduce((acc, p) => acc + p.ovr, 0) / squadList.length) 
      : 75;

    let chem = 50;
    const nations = {};
    const clubs = {};
    squadList.forEach(p => {
      nations[p.nation] = (nations[p.nation] || 0) + 1;
      clubs[p.club] = (clubs[p.club] || 0) + 1;
    });
    Object.values(nations).forEach(c => { if (c >= 2) chem += (c - 1) * 8; });
    Object.values(clubs).forEach(c => { if (c >= 2) chem += (c - 1) * 10; });
    chem = Math.min(100, Math.max(30, chem));

    const gks = squadList.filter(p => p.position === 'GK');
    const dfs = squadList.filter(p => p.position === 'DF');
    const mfs = squadList.filter(p => p.position === 'MF');
    const fws = squadList.filter(p => p.position === 'FW');

    // Default fallback player if squad is empty
    const dummyPlayer = { name: manager.name, ovr: avgOvr, position: 'FW', club: 'FC All-Stars', nation: 'FIFA' };

    return { 
      squadList: squadList.length > 0 ? squadList : [dummyPlayer], 
      avgOvr, 
      chem, 
      gks: gks.length > 0 ? gks : squadList.slice(0, 1),
      dfs: dfs.length > 0 ? dfs : squadList.slice(1, 5),
      mfs: mfs.length > 0 ? mfs : squadList.slice(5, 8),
      fws: fws.length > 0 ? fws : squadList.slice(8, 11)
    };
  };

  const t1 = calcTeamInfo(player1);
  const t2 = calcTeamInfo(player2);

  // 2. Generate Rich Commentary Match Events
  const generateMatchScript = () => {
    const power1 = t1.avgOvr * 0.7 + t1.chem * 0.3;
    const power2 = t2.avgOvr * 0.7 + t2.chem * 0.3;
    const powerDiff = (power1 - power2) * 0.12;

    let g1 = Math.max(0, Math.round(Math.random() * 2.5 + powerDiff + (Math.random() > 0.45 ? 1 : 0)));
    let g2 = Math.max(0, Math.round(Math.random() * 2.5 - powerDiff + (Math.random() > 0.45 ? 1 : 0)));

    // Ensure at least 1 goal total for entertainment
    if (g1 === 0 && g2 === 0 && Math.random() > 0.4) {
      if (power1 >= power2) g1 = 1; else g2 = 1;
    }

    // Rich commentary pools
    const GOAL_TEMPLATES = [
      "🔥 SIÊU PHẨM NÃ ĐẠI BÁC: Tung cú sút xa sấm sét từ cự ly 28m, bóng cuộn hình lá tre găm thẳng vào góc chữ A, thủ môn chỉ biết chôn chân đứng nhìn!",
      "⚡ SOLO XUYÊN PHÁ NGOẠN MỤC: Đi bóng lắc hông biến ảo loại bỏ 2 hậu vệ đối phương, rồi bình tĩnh chích bóng tinh tế qua người thủ môn làm tung lưới!",
      "💥 ĐÁNH ĐẦU DŨNG MÃNH: Đón quả tạt chuẩn xác từng milimet từ biên, bật cao dũng mãnh đè mặt trung vệ đối phương đánh đầu hiểm hóc vào góc xa!",
      "🎩 CỨA LÒNG NGHỆ THUẬT: Nhận đường nhả bóng tuyến hai, tung cú cứa lòng chân thuận vẽ nên một đường cong hoàn mỹ vào góc chết khung thành!",
      "⚡ BĂNG CẮT CỰC NHANH: Chọn vị trí thông minh đón đường căng ngang dọn cỗ, đệm bóng cận thành một chạm lạnh lùng khai thông thế bế tắc!",
      "💥 VÔ-LÊ NỬA NẢY SẤM SÉT: Bóng bật ra từ quả phạt góc, vung chân bắt vô-lê một chạm căng như kẻ chỉ tung nóc lưới đối phương!",
      "🎯 ĐÁ PHẠT THẦN SẦU: Đứng trước quả đá phạt cự ly 25m, vẽ nên đường cong cầu vồng đưa bóng lượn qua hàng rào găm vào góc cao không thể cản phá!"
    ];

    const SAVE_TEMPLATES = [
      "🧤 PHẢN XẠ ĐẦU NGÓN TAY XUẤT THẦN: Cú sút chìm cực kỳ hiểm hóc nhưng thủ môn đã đổ người siêu nhanh, dùng đầu ngón tay đẩy bóng sượt cột dọc cứu bàn thua mười mươi!",
      "🦅 BAY NGƯỜI CỨU THUA KHÔNG TƯỞNG: Bay người như cánh chim ưng trong không trung, tung tay đẩy quả bóng đang bay vào góc chết vọt xà ngang trong sự thán phục của khán đài!",
      "🧱 BỨC TƯỜNG THÉP TRƯỚC KHUNG THÀNH: Lao ra khép góc cực kỳ dũng cảm trong pha đối mặt một chọi một, cản phá thành công cú dứt điểm hiểm hóc!",
      "⚡ PHẢN XẠ BẰNG CHÂN ĐIỂM 10: Tiền đạo đệm bóng cận thành chỉ cách 5m, nhưng thủ môn phản xạ bằng chân chớp nhoáng chặn đứng bóng ngay trên vạch vôi!"
    ];

    const WOODWORK_TEMPLATES = [
      "💥 BÓNG DỘI XÀ NGANG TRONG GANG TẤC: Pha xoay sở đẳng cấp rồi dứt điểm cực căng, bóng đánh bại thủ môn nhưng lại tìm đến đúng xà ngang bật ra ngoài trong tiếc nuối!",
      "💥 ĐẬP CỘT DỌC NGHẸT THỞ: Cú cứa lòng quá hiểm hóc khiến thủ môn đứng hình, tiếc rằng bóng đập trúng cột dọc bật ngược trở lại sân!"
    ];

    const DEFENSE_TEMPLATES = [
      "🛡️ XOẠC BÓNG GIẢI NGUY HOÀN HẢO: Cú tắc bóng chính xác đến từng milimet ngay trong vòng cấm, tước đi cơ hội mười mươi trước khi tiền đạo kịp vung chân!",
      "🛑 CỨU THUA NGAY TRÊN VẠCH VÔI: Thủ môn đã bị đánh bại nhưng trung vệ bọc lót thần tốc, tung người phá bóng bằng đầu giải nguy ngay trước vạch vôi!",
      "🧱 TRANH CHẤP DŨNG MÃNH: Dùng sức mạnh và phán đoán tuyệt vời phong tỏa hoàn toàn đường đi bóng nguy hiểm của mũi nhọn tấn công đối phương!"
    ];

    const ASSIST_TEMPLATES = [
      "🪄 ĐƯỜNG CHUYỀN XÉ TOẠC HÀNG THỦ: Một pha vẩy má ngoài Trivela điệu nghệ mở toang khoảng trống, đặt đồng đội vào tư thế đối mặt thủ môn!",
      "💫 ĐẢO CHÂN MA THUẬT: Pha xử lý kỹ thuật đỉnh cao qua 2 người bên hành lang cánh rồi tung đường căng ngang dọn cỗ xé toạc phòng tuyến đối phương!"
    ];

    const CARD_TEMPLATES = [
      "🟨 PHẠM LỖI CHIẾN THUẬT: Nhận thấy đối phương đang mở đợt phản công nhanh nguy hiểm, đã chủ động phạm lỗi ngăn cản và phải nhận thẻ vàng cảnh cáo!"
    ];

    const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Create a pool of minutes: pick 7 to 8 highlight minutes between 8' and 89'
    const totalHighlights = Math.min(8, Math.max(6, g1 + g2 + 4));
    const availableMinutes = [];
    for (let m = 8; m <= 88; m += 4) availableMinutes.push(m);
    // Shuffle and pick
    availableMinutes.sort(() => Math.random() - 0.5);
    const chosenMinutes = availableMinutes.slice(0, totalHighlights).sort((a, b) => a - b);

    // Distribution of events
    const rawEvents = [];

    // Goals for P1
    for (let i = 0; i < g1; i++) {
      const scorer = getRandomItem([...t1.fws, ...t1.mfs]) || t1.squadList[0];
      rawEvents.push({
        team: 1,
        type: 'GOAL',
        badgeText: '⚽ VÀOOOOOO! BÀN THẮNG!',
        badgeClass: 'bg-emerald-500 text-slate-950 border-emerald-300',
        player: scorer,
        desc: getRandomItem(GOAL_TEMPLATES)
      });
    }

    // Goals for P2
    for (let i = 0; i < g2; i++) {
      const scorer = getRandomItem([...t2.fws, ...t2.mfs]) || t2.squadList[0];
      rawEvents.push({
        team: 2,
        type: 'GOAL',
        badgeText: '⚽ VÀOOOOOO! BÀN THẮNG!',
        badgeClass: 'bg-rose-600 text-white border-rose-300',
        player: scorer,
        desc: getRandomItem(GOAL_TEMPLATES)
      });
    }

    // Goalkeeper saves
    rawEvents.push({
      team: 1,
      type: 'SAVE',
      badgeText: '🧤 CỨU THUA XUẤT THẦN!',
      badgeClass: 'bg-cyan-500 text-slate-950 border-cyan-300',
      player: getRandomItem(t1.gks) || t1.squadList[0],
      desc: getRandomItem(SAVE_TEMPLATES)
    });

    rawEvents.push({
      team: 2,
      type: 'SAVE',
      badgeText: '🧤 CỨU THUA XUẤT THẦN!',
      badgeClass: 'bg-cyan-500 text-slate-950 border-cyan-300',
      player: getRandomItem(t2.gks) || t2.squadList[0],
      desc: getRandomItem(SAVE_TEMPLATES)
    });

    // Defense highlights
    rawEvents.push({
      team: 1,
      type: 'DEFENSE',
      badgeText: '🛡️ PHÒNG NGỰ ĐỈNH CAO!',
      badgeClass: 'bg-blue-500 text-white border-blue-300',
      player: getRandomItem(t1.dfs) || t1.squadList[0],
      desc: getRandomItem(DEFENSE_TEMPLATES)
    });

    rawEvents.push({
      team: 2,
      type: 'DEFENSE',
      badgeText: '🛡️ PHÒNG NGỰ ĐỈNH CAO!',
      badgeClass: 'bg-blue-500 text-white border-blue-300',
      player: getRandomItem(t2.dfs) || t2.squadList[0],
      desc: getRandomItem(DEFENSE_TEMPLATES)
    });

    // Woodwork chance
    const woodTeam = Math.random() > 0.5 ? 1 : 2;
    const woodPlayer = woodTeam === 1 
      ? (getRandomItem([...t1.fws, ...t1.mfs]) || t1.squadList[0]) 
      : (getRandomItem([...t2.fws, ...t2.mfs]) || t2.squadList[0]);
    rawEvents.push({
      team: woodTeam,
      type: 'WOODWORK',
      badgeText: '💥 BÓNG DỘI XÀ NGANG!',
      badgeClass: 'bg-amber-500 text-slate-950 border-amber-300',
      player: woodPlayer,
      desc: getRandomItem(WOODWORK_TEMPLATES)
    });

    // Assist / Chance
    const assistTeam = Math.random() > 0.5 ? 1 : 2;
    const assistPlayer = assistTeam === 1
      ? (getRandomItem(t1.mfs) || t1.squadList[0])
      : (getRandomItem(t2.mfs) || t2.squadList[0]);
    rawEvents.push({
      team: assistTeam,
      type: 'ASSIST',
      badgeText: '🪄 ĐƯỜNG CHUYỀN THIÊN TÀI!',
      badgeClass: 'bg-indigo-500 text-white border-indigo-300',
      player: assistPlayer,
      desc: getRandomItem(ASSIST_TEMPLATES)
    });

    // Yellow Card
    const cardTeam = Math.random() > 0.5 ? 1 : 2;
    const cardPlayer = cardTeam === 1
      ? (getRandomItem([...t1.dfs, ...t1.mfs]) || t1.squadList[0])
      : (getRandomItem([...t2.dfs, ...t2.mfs]) || t2.squadList[0]);
    rawEvents.push({
      team: cardTeam,
      type: 'CARD',
      badgeText: '🟨 THẺ VÀNG CẢNH CÁO!',
      badgeClass: 'bg-yellow-400 text-slate-950 border-yellow-200',
      player: cardPlayer,
      desc: getRandomItem(CARD_TEMPLATES)
    });

    // Shuffle non-goal events to mix well with goals
    rawEvents.sort(() => Math.random() - 0.5);

    // Take as many events as we have chosen minutes
    const finalEvents = [];
    let runningScore1 = 0;
    let runningScore2 = 0;

    for (let i = 0; i < chosenMinutes.length; i++) {
      const ev = rawEvents[i] || rawEvents[0];
      if (ev.type === 'GOAL') {
        if (ev.team === 1) runningScore1++;
        if (ev.team === 2) runningScore2++;
      }
      finalEvents.push({
        ...ev,
        min: chosenMinutes[i],
        scoreAfter: { s1: runningScore1, s2: runningScore2 }
      });
    }

    finalEvents.sort((a, b) => a.min - b.min);

    // Pick MVP based on performance
    const allPlayersWithGoals = finalEvents.filter(e => e.type === 'GOAL').map(e => e.player);
    const mvpPlayer = allPlayersWithGoals.length > 0 ? allPlayersWithGoals[0] : (t1.squadList[0] || t2.squadList[0]);

    return { 
      events: finalEvents, 
      finalG1: runningScore1, 
      finalG2: runningScore2,
      mvp: mvpPlayer
    };
  };

  // 3. Online & Bot Ready Handling
  useEffect(() => {
    // Auto-ready for AI bot after 600ms
    if (isP2Bot && !p2Ready && matchPhase === 'lobby') {
      const t = setTimeout(() => {
        setP2Ready(true);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [isP2Bot, p2Ready, matchPhase]);

  // Handle incoming remote match messages in Online mode
  useEffect(() => {
    if (!matchRemoteMsg) return;

    if (matchRemoteMsg.type === 'MATCH_READY') {
      if (matchRemoteMsg.playerRole === 'host') setP1Ready(matchRemoteMsg.ready);
      if (matchRemoteMsg.playerRole === 'guest') setP2Ready(matchRemoteMsg.ready);
    } else if (matchRemoteMsg.type === 'MATCH_START_SIM') {
      setEventsTimeline(matchRemoteMsg.script.events);
      setMvp(matchRemoteMsg.script.mvp);
      setMatchPhase('countdown');
    }
  }, [matchRemoteMsg]);

  // Trigger ready status
  const handleToggleP1Ready = () => {
    if (onlineState.isConnected && onlineState.role !== 'host') return;
    const nextVal = !p1Ready;
    setP1Ready(nextVal);
    if (onlineState.isConnected && onSendMatchMessage) {
      onSendMatchMessage({ type: 'MATCH_READY', playerRole: 'host', ready: nextVal });
    }
  };

  const handleToggleP2Ready = () => {
    if (onlineState.isConnected && onlineState.role !== 'guest') return;
    const nextVal = !p2Ready;
    setP2Ready(nextVal);
    if (onlineState.isConnected && onSendMatchMessage) {
      onSendMatchMessage({ type: 'MATCH_READY', playerRole: 'guest', ready: nextVal });
    }
  };

  // When BOTH are ready: Start Countdown!
  useEffect(() => {
    if (p1Ready && p2Ready && matchPhase === 'lobby') {
      // In online mode, Host generates the script and sends it to guest
      if (onlineState.isConnected) {
        if (onlineState.role === 'host') {
          const script = generateMatchScript();
          setEventsTimeline(script.events);
          setMvp(script.mvp);
          if (onSendMatchMessage) {
            onSendMatchMessage({ type: 'MATCH_START_SIM', script });
          }
          setMatchPhase('countdown');
        }
      } else {
        const script = generateMatchScript();
        setEventsTimeline(script.events);
        setMvp(script.mvp);
        setMatchPhase('countdown');
      }
    }
  }, [p1Ready, p2Ready, matchPhase, onlineState]);

  // Countdown 3.. 2.. 1.. before match
  useEffect(() => {
    if (matchPhase !== 'countdown') return;

    sounds.playTick();
    if (countdown > 1) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        sounds.playWhistle();
        setMatchPhase('playing');
        setCurrentMinute(0);
        minuteRef.current = 0;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [matchPhase, countdown]);

  // 4. Fast Match Clock Simulation with Interrupts at Key Moments
  useEffect(() => {
    if (matchPhase !== 'playing') return;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;

      const nextMin = minuteRef.current + 1;

      // Check if there is an event at this minute
      const ev = eventsTimeline.find(e => e.min === nextMin);

      if (ev) {
        // PAUSE CLOCK AND HIGHLIGHT EVENT!
        isPausedRef.current = true;
        setCurrentMinute(nextMin);
        minuteRef.current = nextMin;
        setActiveHighlight(ev);
        setHighlightCountdown(3);

        // Update score immediately if goal
        if (ev.type === 'GOAL') {
          if (ev.team === 1) setLiveScore1(ev.scoreAfter.s1);
          if (ev.team === 2) setLiveScore2(ev.scoreAfter.s2);
          sounds.playFanfare();
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { x: ev.team === 1 ? 0.25 : 0.75, y: 0.6 }
          });
        } else if (ev.type === 'SAVE') {
          sounds.playGavel();
        } else {
          sounds.playTick();
        }

        // Add to completed logs
        setCompletedEvents(prev => [ev, ...prev]);

        // Pause for 3.2 seconds for dramatic effect, then resume fast clock
        let remain = 3;
        const countdownTimer = setInterval(() => {
          remain -= 1;
          setHighlightCountdown(remain);
          if (remain <= 0) {
            clearInterval(countdownTimer);
            setActiveHighlight(null);
            isPausedRef.current = false;
          }
        }, 1000);

      } else if (nextMin >= 90) {
        // Match 90 minutes concluded!
        setCurrentMinute(90);
        minuteRef.current = 90;
        clearInterval(interval);
        sounds.playWhistle();

        // Check if tied or winner
        const lastEv = eventsTimeline[eventsTimeline.length - 1];
        const finalS1 = lastEv ? lastEv.scoreAfter.s1 : liveScore1;
        const finalS2 = lastEv ? lastEv.scoreAfter.s2 : liveScore2;

        setLiveScore1(finalS1);
        setLiveScore2(finalS2);

        if (finalS1 > finalS2) {
          setWinner(player1);
          setMatchPhase('finished');
          sounds.playFanfare();
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
        } else if (finalS2 > finalS1) {
          setWinner(player2);
          setMatchPhase('finished');
          sounds.playFanfare();
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
        } else {
          // Tie -> Enter Penalty Shootout!
          startPenaltyShootout(finalS1, finalS2);
        }
      } else {
        // Fast forward clock
        minuteRef.current = nextMin;
        setCurrentMinute(nextMin);
      }
    }, 55); // Fast clock: 55ms per minute

    return () => clearInterval(interval);
  }, [matchPhase, eventsTimeline]);

  // 5. Penalty Shootout Engine (If 90' Ends In A Draw)
  const startPenaltyShootout = (s1, s2) => {
    setMatchPhase('penalty');
    
    // Generate 5 kicks for each side
    const kicks = [];
    let p1Wins = 0;
    let p2Wins = 0;

    const p1Shooters = [...t1.fws, ...t1.mfs, ...t1.dfs];
    const p2Shooters = [...t2.fws, ...t2.mfs, ...t2.dfs];
    const p1Gk = t1.gks[0] || t1.squadList[0];
    const p2Gk = t2.gks[0] || t2.squadList[0];

    for (let round = 1; round <= 5; round++) {
      const p1Scores = Math.random() > 0.25; // 75% penalty conversion
      if (p1Scores) p1Wins++;
      kicks.push({
        round,
        team: 1,
        shooter: p1Shooters[round % p1Shooters.length],
        gk: p2Gk,
        scored: p1Scores
      });

      const p2Scores = Math.random() > 0.25;
      if (p2Scores) p2Wins++;
      kicks.push({
        round,
        team: 2,
        shooter: p2Shooters[round % p2Shooters.length],
        gk: p1Gk,
        scored: p2Scores
      });
    }

    // Ensure decisive winner if still tied after 5 kicks
    if (p1Wins === p2Wins) {
      p1Wins += 1;
      kicks.push({
        round: 6,
        team: 1,
        shooter: p1Shooters[0],
        gk: p2Gk,
        scored: true
      });
      kicks.push({
        round: 6,
        team: 2,
        shooter: p2Shooters[0],
        gk: p1Gk,
        scored: false
      });
    }

    setPenaltyKicks(kicks);
    setPenScore1(0);
    setPenScore2(0);
    setCurrentPenIndex(0);

    // Play penalty kicks one by one
    let idx = 0;
    let curP1 = 0;
    let curP2 = 0;

    const penInterval = setInterval(() => {
      if (idx < kicks.length) {
        const k = kicks[idx];
        if (k.scored) {
          sounds.playFanfare();
          if (k.team === 1) curP1++;
          if (k.team === 2) curP2++;
        } else {
          sounds.playGavel();
        }
        setPenScore1(curP1);
        setPenScore2(curP2);
        setCurrentPenIndex(idx);
        idx++;
      } else {
        clearInterval(penInterval);
        sounds.playWhistle();
        const penWinner = curP1 > curP2 ? player1 : player2;
        setWinner(penWinner);
        setMatchPhase('finished');
        sounds.playFanfare();
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
      }
    }, 1800);
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 md:p-6 shadow-2xl max-w-6xl mx-auto backdrop-blur-xl">
      {/* Top Header Badge */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest shadow-inner">
          <Trophy className="w-4 h-4 text-amber-400" />
          CHUNG KẾT SIÊU CÚP 1V1 • SUPER CUP FINAL
        </div>
      </div>

      {/* Main Scoreboard Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 mb-6 shadow-xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-0 w-1/3 h-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/3 h-full bg-rose-500/10 blur-3xl pointer-events-none" />

        <div className="grid grid-cols-12 items-center gap-2 md:gap-4 relative z-10">
          {/* Team 1 (Left) */}
          <div className="col-span-4 flex items-center gap-3">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-950 border-2 border-emerald-500/50 flex items-center justify-center text-3xl shadow-lg">
              {player1.avatar || "🧢"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base md:text-xl font-black text-emerald-400 tracking-wide uppercase truncate max-w-[150px] md:max-w-[200px]">
                  {player1.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  OVR: <strong className="text-amber-400">{t1.avgOvr}</strong>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  CHEM: <strong className="text-cyan-400">{t1.chem}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Center Digital Clock & Big Score */}
          <div className="col-span-4 text-center flex flex-col items-center">
            {/* Live Clock Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 mb-2">
              <span className={`w-2 h-2 rounded-full ${matchPhase === 'playing' ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`} />
              <span className="text-xs font-mono font-black tracking-wider text-slate-200">
                {matchPhase === 'lobby' ? 'CHỜ SẴN SÀNG' :
                 matchPhase === 'countdown' ? 'CHUẨN BỊ' :
                 matchPhase === 'penalty' ? 'LOẠT LUÂN LƯU 11M' :
                 matchPhase === 'finished' ? 'HẾT GIỜ (90\')' :
                 activeHighlight ? `⏸️ PHÚT ${currentMinute}'` :
                 `⚡ PHÚT ${currentMinute}'`}
              </span>
            </div>

            {/* Big Score Display */}
            <div className="text-4xl md:text-6xl font-black font-mono tracking-tight text-white flex items-center gap-3">
              <span className={activeHighlight?.team === 1 && activeHighlight?.type === 'GOAL' ? 'text-emerald-400 animate-bounce' : 'text-slate-100'}>
                {liveScore1}
              </span>
              <span className="text-slate-600 text-3xl font-light">-</span>
              <span className={activeHighlight?.team === 2 && activeHighlight?.type === 'GOAL' ? 'text-rose-400 animate-bounce' : 'text-slate-100'}>
                {liveScore2}
              </span>
            </div>

            {/* Penalty Score Subtext */}
            {penScore1 !== null && penScore2 !== null && (
              <span className="text-xs font-black text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40 mt-1">
                (Pen: {penScore1} - {penScore2})
              </span>
            )}

            {/* Match Minute Progress Bar */}
            <div className="w-full max-w-[220px] bg-slate-950 h-1.5 rounded-full mt-2.5 overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 h-full transition-all duration-75"
                style={{ width: `${Math.min(100, (currentMinute / 90) * 100)}%` }}
              />
            </div>
          </div>

          {/* Team 2 (Right - Opponent Red) */}
          <div className="col-span-4 flex items-center justify-end gap-3 text-right">
            <div>
              <div className="flex items-center justify-end gap-2">
                <h3 className="text-base md:text-xl font-black text-rose-400 tracking-wide uppercase truncate max-w-[150px] md:max-w-[200px]">
                  {player2.name}
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <div className="flex items-center justify-end gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  OVR: <strong className="text-amber-400">{t2.avgOvr}</strong>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  CHEM: <strong className="text-cyan-400">{t2.chem}</strong>
                </span>
              </div>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-950 border-2 border-rose-500/60 flex items-center justify-center text-3xl shadow-lg">
              {player2.avatar || "👔"}
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 1: LOBBY READY CHECK ("CẢ 2 BẤM SẴN SÀNG THÌ BẮT ĐẦU") */}
      {matchPhase === 'lobby' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 my-4 text-center shadow-2xl">
          <h2 className="text-2xl font-black text-white mb-2">
            PHÒNG CHỜ TRẬN ĐẤU CHUNG KẾT
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto mb-6">
            Cả 2 HLV cần nhấn nút <strong className="text-amber-400">"Sẵn Sàng"</strong> bên dưới. Khi cả 2 đã xác nhận, đồng hồ trận đấu sẽ bắt đầu đếm nhanh và dừng lại tại các tình huống kịch tính!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Player 1 Ready Stand */}
            <div className={`p-5 rounded-2xl border-2 transition-all ${
              p1Ready 
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-900/30' 
                : 'bg-slate-950/70 border-slate-800'
            }`}>
              <div className="text-4xl mb-2">{player1.avatar || "🧢"}</div>
              <h4 className="font-black text-emerald-400 text-lg">{player1.name}</h4>
              <p className="text-xs text-slate-400 mb-4">11 Cầu thủ • OVR {t1.avgOvr} • CHEM {t1.chem}</p>
              
              <button
                onClick={handleToggleP1Ready}
                disabled={onlineState.isConnected && onlineState.role !== 'host'}
                className={`w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                  p1Ready
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${onlineState.isConnected && onlineState.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-102'}`}
              >
                <CheckCircle2 className={`w-5 h-5 ${p1Ready ? 'fill-slate-950 text-emerald-500' : 'text-slate-400'}`} />
                {p1Ready ? 'HLV 1 ĐÃ SẴN SÀNG ✓' : 'BẤM ĐỂ SẴN SÀNG'}
              </button>
            </div>

            {/* Player 2 Ready Stand (Opponent Red) */}
            <div className={`p-5 rounded-2xl border-2 transition-all ${
              p2Ready 
                ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-900/30' 
                : 'bg-slate-950/70 border-rose-500/50'
            }`}>
              <div className="text-4xl mb-2">{player2.avatar || "👔"}</div>
              <h4 className="font-black text-rose-400 text-lg">{player2.name}</h4>
              <p className="text-xs text-slate-400 mb-4">11 Cầu thủ • OVR {t2.avgOvr} • CHEM {t2.chem}</p>
              
              <button
                onClick={handleToggleP2Ready}
                disabled={onlineState.isConnected && onlineState.role !== 'guest'}
                className={`w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                  p2Ready
                    ? 'bg-rose-600 text-white shadow-rose-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${onlineState.isConnected && onlineState.role !== 'guest' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-102'}`}
              >
                <CheckCircle2 className={`w-5 h-5 ${p2Ready ? 'fill-white text-rose-600' : 'text-slate-400'}`} />
                {p2Ready ? (isP2Bot ? '🤖 BOT ĐÃ SẴN SÀNG ✓' : 'HLV 2 ĐÃ SẴN SÀNG ✓') : 'BẤM ĐỂ SẴN SÀNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: PRE-MATCH COUNTDOWN OVERLAY */}
      {matchPhase === 'countdown' && (
        <div className="py-16 text-center my-4 bg-slate-900/90 border border-slate-800 rounded-3xl animate-in zoom-in duration-300">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-4 py-1 rounded-full border border-amber-500/40">
            CẢ 2 HLV ĐÃ SẴN SÀNG!
          </span>
          <div className="text-8xl font-black font-mono text-amber-400 my-4 animate-pulse">
            {countdown}
          </div>
          <p className="text-sm font-bold text-slate-300">
            Trận chung kết sắp khai cuộc... Chuẩn bị bùng nổ!
          </p>
        </div>
      )}

      {/* STAGE 3: LIVE HIGHLIGHT SHOWCASE & FAST RUNNING CLOCK */}
      {matchPhase === 'playing' && (
        <div className="my-4 min-h-[360px] flex flex-col justify-center">
          {/* WHEN AN EVENT IS TRIGGERED (PAUSED ON LEFT OR RIGHT ACCORDING TO TEAM) */}
          {activeHighlight ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center animate-in zoom-in duration-200">
              {/* Left Side Highlight (if Team 1) */}
              <div className="md:col-span-6">
                {activeHighlight.team === 1 ? (
                  <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-400 rounded-3xl p-6 shadow-2xl shadow-emerald-950/60 flex flex-col items-center text-center relative overflow-hidden">
                    {/* Glowing Accent Top Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-yellow-300 to-emerald-400 animate-pulse" />
                    
                    {/* Event Type Badge */}
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3 border shadow ${activeHighlight.badgeClass}`}>
                      {activeHighlight.badgeText}
                    </div>

                    {/* Player Big Photo */}
                    <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-slate-800 mb-3">
                      {activeHighlight.player.photo ? (
                        <img 
                          src={activeHighlight.player.photo} 
                          alt={activeHighlight.player.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-amber-400">
                          {activeHighlight.player.name?.substring(0, 2)}
                        </div>
                      )}
                      {/* OVR & Position Badges */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/90 text-amber-400 text-xs font-black border border-amber-500/50">
                        {activeHighlight.player.ovr} OVR
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/90 text-cyan-400 text-xs font-black border border-cyan-500/50">
                        {activeHighlight.player.subPos || activeHighlight.player.position}
                      </span>
                    </div>

                    {/* Player Info */}
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                      {activeHighlight.player.name}
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">
                      {activeHighlight.player.club} • {activeHighlight.player.nation}
                    </p>

                    {/* Rich Description Under Player Photo */}
                    <div className="w-full bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 text-emerald-200 text-sm font-semibold leading-relaxed shadow-inner">
                      {activeHighlight.desc}
                    </div>

                    {/* Countdown Progress Bar for Pause Duration */}
                    <div className="w-full mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>⏸️ Tạm dừng: Phút {activeHighlight.min}'</span>
                      <span className="text-amber-400 font-bold">Tiếp tục sau {highlightCountdown}s...</span>
                    </div>
                  </div>
                ) : (
                  // Opponent reaction stand when team 2 has highlight
                  <div className="hidden md:flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-950/40 border border-slate-900 text-slate-500 h-full">
                    <Activity className="w-8 h-8 text-slate-600 animate-pulse mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Hàng thủ [{player1.name}] đang chịu sức ép lớn...</span>
                  </div>
                )}
              </div>

              {/* Right Side Highlight (if Team 2 - Opponent Red) */}
              <div className="md:col-span-6">
                {activeHighlight.team === 2 ? (
                  <div className="bg-gradient-to-bl from-rose-950/80 via-slate-900 to-slate-950 border-2 border-rose-500 rounded-3xl p-6 shadow-2xl shadow-rose-950/60 flex flex-col items-center text-center relative overflow-hidden">
                    {/* Glowing Accent Top Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-400 via-red-500 to-rose-400 animate-pulse" />
                    
                    {/* Event Type Badge */}
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3 border shadow ${activeHighlight.badgeClass}`}>
                      {activeHighlight.badgeText}
                    </div>

                    {/* Player Big Photo */}
                    <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 border-rose-400 shadow-2xl bg-slate-800 mb-3">
                      {activeHighlight.player.photo ? (
                        <img 
                          src={activeHighlight.player.photo} 
                          alt={activeHighlight.player.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-rose-400">
                          {activeHighlight.player.name?.substring(0, 2)}
                        </div>
                      )}
                      {/* OVR & Position Badges */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/90 text-amber-400 text-xs font-black border border-amber-500/50">
                        {activeHighlight.player.ovr} OVR
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/90 text-cyan-400 text-xs font-black border border-cyan-500/50">
                        {activeHighlight.player.subPos || activeHighlight.player.position}
                      </span>
                    </div>

                    {/* Player Info */}
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                      {activeHighlight.player.name}
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">
                      {activeHighlight.player.club} • {activeHighlight.player.nation}
                    </p>

                    {/* Rich Description Under Player Photo */}
                    <div className="w-full bg-slate-950/90 border border-rose-500/40 rounded-2xl p-4 text-rose-200 text-sm font-semibold leading-relaxed shadow-inner">
                      {activeHighlight.desc}
                    </div>

                    {/* Countdown Progress Bar for Pause Duration */}
                    <div className="w-full mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>⏸️ Tạm dừng: Phút {activeHighlight.min}'</span>
                      <span className="text-amber-400 font-bold">Tiếp tục sau {highlightCountdown}s...</span>
                    </div>
                  </div>
                ) : (
                  // Opponent reaction stand when team 1 has highlight
                  <div className="hidden md:flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-950/40 border border-slate-900 text-slate-500 h-full">
                    <Activity className="w-8 h-8 text-slate-600 animate-pulse mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Hàng thủ [{player2.name}] đang chịu sức ép lớn...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // NORMAL FAST CLOCK MATCH VIEW (RACING TOWARDS NEXT EVENT)
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 animate-spin">
                  ⚽
                </div>
              </div>

              <div className="text-lg md:text-xl font-black text-white tracking-wide mb-1 flex items-center gap-2">
                <span>Trận đấu đang diễn ra tốc độ cao...</span>
                <span className="text-amber-400 font-mono">Phút {currentMinute}'</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hai đội giằng co nghẹt thở ở khu trung tuyến. Bộ đếm thời gian sẽ tự động dừng lại khi có cơ hội hoặc bàn thắng nguy hiểm!
              </p>
            </div>
          )}
        </div>
      )}

      {/* STAGE 4: PENALTY SHOOTOUT (IF 90' DRAW) */}
      {matchPhase === 'penalty' && (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl my-4">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-950 px-4 py-1 rounded-full border border-amber-500/40">
            🎯 LOẠT SÚT LUÂN LƯU 11M CÂN NÃO
          </span>
          <h3 className="text-2xl font-black text-white mt-2">
            HÒA {liveScore1} - {liveScore2} SAU 90 PHÚT!
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Ai có bản lĩnh thép trên chấm 11m sẽ nâng cao chiếc cúp vô địch!
          </p>

          {/* Current Kick Card */}
          {penaltyKicks[currentPenIndex] && (
            <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="text-xs font-mono font-bold text-amber-400 mb-2">
                LƯỢT SÚT THỨ {penaltyKicks[currentPenIndex].round} • [{penaltyKicks[currentPenIndex].team === 1 ? player1.name : player2.name}]
              </div>
              
              <div className="flex items-center justify-center gap-4 my-3">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-amber-400 bg-slate-800 mx-auto mb-1">
                    {penaltyKicks[currentPenIndex].shooter?.photo ? (
                      <img src={penaltyKicks[currentPenIndex].shooter.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">⚽</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white block truncate max-w-[100px]">
                    {penaltyKicks[currentPenIndex].shooter?.name}
                  </span>
                  <span className="text-[10px] text-slate-400">(Người sút)</span>
                </div>

                <div className="text-2xl font-black text-slate-600">VS</div>

                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-cyan-400 bg-slate-800 mx-auto mb-1">
                    {penaltyKicks[currentPenIndex].gk?.photo ? (
                      <img src={penaltyKicks[currentPenIndex].gk.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🧤</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white block truncate max-w-[100px]">
                    {penaltyKicks[currentPenIndex].gk?.name}
                  </span>
                  <span className="text-[10px] text-slate-400">(Thủ môn)</span>
                </div>
              </div>

              <div className={`py-2 px-4 rounded-xl font-black text-sm tracking-wide ${
                penaltyKicks[currentPenIndex].scored
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              }`}>
                {penaltyKicks[currentPenIndex].scored 
                  ? '⚽ VÀOOOOOO! CÚ SÚT LẠNH LÙNG VÀO GÓC CHẾT!' 
                  : '🧤 KHÔNG VÀO! THỦ MÔN ĐOÁN ĐÚNG HƯỚNG CẢN PHÁ!'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 5: FINISHED CELEBRATION MODAL */}
      {matchPhase === 'finished' && winner && (
        <div className="my-6 p-6 rounded-3xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-2 border-amber-500 text-center shadow-2xl animate-in zoom-in duration-300">
          <div className="inline-flex items-center gap-2 text-2xl md:text-3xl font-black text-amber-300 mb-2">
            <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            CHÚC MỪNG {winner.name.toUpperCase()} ĐOẠT CÚP VÔ ĐỊCH!
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Chiến thắng hoàn toàn xứng đáng sau những màn đấu thầu nghẹt thở và chiến thuật xây dựng đội hình đẳng cấp!
          </p>

          {/* MVP Card */}
          {mvp && (
            <div className="inline-flex items-center gap-3 bg-slate-950/80 border border-amber-500/40 rounded-2xl px-5 py-2.5 mb-6 shadow-lg text-left">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-amber-400">
                {mvp.photo ? (
                  <img src={mvp.photo} alt={mvp.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-amber-400">★</div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> CẦU THỦ XUẤT SẮC NHẤT TRẬN (MVP)
                </span>
                <div className="text-sm font-black text-white">{mvp.name} ({mvp.ovr} OVR)</div>
                <div className="text-[11px] text-slate-400">{mvp.club} • {mvp.nation}</div>
              </div>
            </div>
          )}

          {/* Restart Button */}
          <div className="flex justify-center">
            <button
              onClick={onRestart}
              className="py-3.5 px-8 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl flex items-center gap-2 transform hover:scale-105 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Tổ Chức Giải Đấu Mới
            </button>
          </div>
        </div>
      )}

      {/* MATCH COMMENTARY LOG (ALWAYS UPDATES AS EVENTS OCCUR) */}
      {completedEvents.length > 0 && (
        <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-800 mt-6 shadow-inner">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            DIỄN BIẾN TRẬN ĐẤU CHI TIẾT (LIVE FEED)
          </div>
          
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {completedEvents.map((ev, idx) => (
              <div 
                key={idx}
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2.5 border transition-all ${
                  ev.team === 1 
                    ? 'bg-emerald-950/30 text-emerald-200 border-emerald-500/30' 
                    : 'bg-rose-950/30 text-rose-200 border-rose-500/30'
                }`}
              >
                <span className="px-2 py-0.5 rounded font-mono font-black text-[11px] bg-black/60 text-amber-400 border border-slate-800 shrink-0">
                  {ev.min}'
                </span>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-black text-white">
                      [{ev.team === 1 ? player1.name : player2.name}] {ev.player?.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/50 text-slate-300 font-bold">
                      {ev.type}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
