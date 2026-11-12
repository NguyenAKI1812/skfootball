import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { sounds } from '../utils/sound';
import { calcSquadStats } from '../data/players';

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

  // 1. Calculate Team Power & Stats (including out-of-position penalties)
  const calcTeamInfo = (manager) => {
    const { avgOvr, chemistry: chem, players: squadList } = calcSquadStats(manager.squad || {});
    const safeAvgOvr = squadList.length > 0 ? avgOvr : 75;

    const gks = squadList.filter(p => p.position === 'GK');
    const dfs = squadList.filter(p => p.position === 'DF');
    const mfs = squadList.filter(p => p.position === 'MF');
    const fws = squadList.filter(p => p.position === 'FW');

    const atkOvr = fws.length > 0
      ? Math.round(fws.reduce((acc, p) => acc + p.ovr, 0) / fws.length)
      : safeAvgOvr;

    // Default fallback player if squad is empty
    const dummyPlayer = { name: manager.name, ovr: safeAvgOvr, position: 'FW', club: 'FC All-Stars', nation: 'FIFA' };

    return { 
      squadList: squadList.length > 0 ? squadList : [dummyPlayer], 
      avgOvr: safeAvgOvr, 
      atkOvr,
      chem, 
      gks: gks.length > 0 ? gks : squadList.slice(0, 1),
      dfs: dfs.length > 0 ? dfs : squadList.slice(1, 5),
      mfs: mfs.length > 0 ? mfs : squadList.slice(5, 8),
      fws: fws.length > 0 ? fws : squadList.slice(8, 11)
    };
  };

  const t1 = calcTeamInfo(player1);
  const t2 = calcTeamInfo(player2);

  // 2. Generate Rich Commentary Match Events (with matchday luck variance + attack bonus)
  const generateMatchScript = () => {
    const power1 = t1.avgOvr * 0.7 + t1.chem * 0.3;
    const power2 = t2.avgOvr * 0.7 + t2.chem * 0.3;
    const cappedDiff = Math.max(-0.85, Math.min(0.85, (power1 - power2) * 0.06));
    const atkBonus1 = Math.max(-0.2, Math.min(0.45, (t1.atkOvr - 82) * 0.03));
    const atkBonus2 = Math.max(-0.2, Math.min(0.45, (t2.atkOvr - 82) * 0.03));
    const luck1 = (Math.random() - 0.5) * 1.4;
    const luck2 = (Math.random() - 0.5) * 1.4;

    let g1 = Math.max(0, Math.round(Math.random() * 2.6 + cappedDiff + atkBonus1 + luck1 + (Math.random() > 0.45 ? 1 : 0)));
    let g2 = Math.max(0, Math.round(Math.random() * 2.6 - cappedDiff + atkBonus2 + luck2 + (Math.random() > 0.45 ? 1 : 0)));

    // Ensure at least 1 goal total for entertainment
    if (g1 === 0 && g2 === 0 && Math.random() > 0.4) {
      if (power1 >= power2) g1 = 1; else g2 = 1;
    }

    // Rich commentary pools
    const GOAL_TEMPLATES = [
      "SIÊU PHẨM NÃ ĐẠI BÁC: Tung cú sút xa sấm sét từ cự ly 28m, bóng cuộn hình lá tre găm thẳng vào góc chữ A, thủ môn chỉ biết chôn chân đứng nhìn!",
      "SOLO XUYÊN PHÁ NGOẠN MỤC: Đi bóng lắc hông biến ảo loại bỏ 2 hậu vệ đối phương, rồi bình tĩnh chích bóng tinh tế qua người thủ môn làm tung lưới!",
      "ĐÁNH ĐẦU DŨNG MÃNH: Đón quả tạt chuẩn xác từng milimet từ biên, bật cao dũng mãnh đè mặt trung vệ đối phương đánh đầu hiểm hóc vào góc xa!",
      "CỨA LÒNG NGHỆ THUẬT: Nhận đường nhả bóng tuyến hai, tung cú cứa lòng chân thuận vẽ nên một đường cong hoàn mỹ vào góc chết khung thành!",
      "BĂNG CẮT CỰC NHANH: Chọn vị trí thông minh đón đường căng ngang dọn cỗ, đệm bóng cận thành một chạm lạnh lùng khai thông thế bế tắc!",
      "VÔ-LÊ NỬA NẢY SẤM SÉT: Bóng bật ra từ quả phạt góc, vung chân bắt vô-lê một chạm căng như kẻ chỉ tung nóc lưới đối phương!",
      "ĐÁ PHẠT THẦN SẦU: Đứng trước quả đá phạt cự ly 25m, vẽ nên đường cong cầu vồng đưa bóng lượn qua hàng rào găm vào góc cao không thể cản phá!",
      "XE ĐẠP CHỔNG NGƯỢC ĐỈNH CAO: Đón đường treo bóng bổng trong vòng cấm, ngả người tung cú móc bóng ngoạn mục khiến cả sân vận động vỡ òa!",
      "PHẢN CÔNG CHỚP NHOÁNG: Bứt tốc xé gió vượt qua bẫy việt vị rồi tung cú sút chìm chéo góc lạnh lùng hạ gục thủ môn trong pha đối mặt!"
    ];

    const SAVE_TEMPLATES = [
      "PHẢN XẠ ĐẦU NGÓN TAY XUẤT THẦN: Cú sút chìm cực kỳ hiểm hóc nhưng thủ môn đã đổ người siêu nhanh, dùng đầu ngón tay đẩy bóng sượt cột dọc cứu bàn thua mười mươi!",
      "BAY NGƯỜI CỨU THUA KHÔNG TƯỞNG: Bay người như cánh chim ưng trong không trung, tung tay đẩy quả bóng đang bay vào góc chết vọt xà ngang trong sự thán phục của khán đài!",
      "BỨC TƯỜNG THÉP TRƯỚC KHUNG THÀNH: Lao ra khép góc cực kỳ dũng cảm trong pha đối mặt một chọi một, cản phá thành công cú dứt điểm hiểm hóc!",
      "PHẢN XẠ BẰNG CHÂN ĐIỂM 10: Tiền đạo đệm bóng cận thành chỉ cách 5m, nhưng thủ môn phản xạ bằng chân chớp nhoáng chặn đứng bóng ngay trên vạch vôi!",
      "CỨU THUA KÉP NGOẠN MỤC: Đẩy được cú đá phạt hiểm hóc rồi lập tức bật dậy cản phá nốt pha đá bồi cận thành trong sự ngỡ ngàng của đối thủ!"
    ];

    const WOODWORK_TEMPLATES = [
      "BÓNG DỘI XÀ NGANG TRONG GANG TẤC: Pha xoay sở đẳng cấp rồi dứt điểm cực căng, bóng đánh bại thủ môn nhưng lại tìm đến đúng xà ngang bật ra ngoài trong tiếc nuối!",
      "ĐẬP CỘT DỌC NGHẸT THỞ: Cú cứa lòng quá hiểm hóc khiến thủ môn đứng hình, tiếc rằng bóng đập trúng cột dọc bật ngược trở lại sân!",
      "BÓNG ĐẬP MÉP TRONG CỘT DỌC: Pha bắt vô-lê tuyến hai đưa bóng dội mép trong cột dọc rồi lăn ngang qua vạch vôi ra ngoài trong gang tấc!"
    ];

    const DEFENSE_TEMPLATES = [
      "XOẠC BÓNG GIẢI NGUY HOÀN HẢO: Cú tắc bóng chính xác đến từng milimet ngay trong vòng cấm, tước đi cơ hội mười mươi trước khi tiền đạo kịp vung chân!",
      "CỨU THUA NGAY TRÊN VẠCH VÔI: Thủ môn đã bị đánh bại nhưng trung vệ bọc lót thần tốc, tung người phá bóng bằng đầu giải nguy ngay trước vạch vôi!",
      "TRANH CHẤP DŨNG MÃNH: Dùng sức mạnh và phán đoán tuyệt vời phong tỏa hoàn toàn đường đi bóng nguy hiểm của mũi nhọn tấn công đối phương!",
      "CẮT BÓNG ĐỌC TÌNH HUỐNG XUẤT SẮC: Phán đoán chuẩn xác đường chọc khe xuyên tuyến, lao lên cắt bóng gọn ghẽ và phát động phản công ngay lập tức!"
    ];

    const ASSIST_TEMPLATES = [
      "ĐƯỜNG CHUYỀN XÉ TOẠC HÀNG THỦ: Một pha vẩy má ngoài Trivela điệu nghệ mở toang khoảng trống, đặt đồng đội vào tư thế đối mặt thủ môn!",
      "ĐẢO CHÂN MA THUẬT: Pha xử lý kỹ thuật đỉnh cao qua 2 người bên hành lang cánh rồi tung đường căng ngang dọn cỗ xé toạc phòng tuyến đối phương!",
      "CHỌC KHE SÁT THỦ: Từ khu vực giữa sân, tung đường chuyền xẻ nách tinh tế loại bỏ toàn bộ hàng phòng ngự đang dâng cao!"
    ];

    const CARD_TEMPLATES = [
      "PHẠM LỖI CHIẾN THUẬT: Nhận thấy đối phương đang mở đợt phản công nhanh nguy hiểm, đã chủ động kéo áo ngăn cản và phải nhận thẻ vàng cảnh cáo!",
      "VÀO BÓNG QUYẾT LIỆT QUÁ MỨC: Pha tranh chấp tầm cao khá rát ở khu vực giữa sân khiến trọng tài lập tức rút thẻ vàng nhắc nhở!"
    ];

    const RED_CARD_TEMPLATES = [
      "THẺ ĐỎ TRỰC TIẾP: Pha xoạc bóng bằng cả hai chân cực kỳ nguy hiểm từ phía sau, trọng tài không ngần ngại rút thẻ đỏ truất quyền thi đấu!",
      "PHẠM LỖI NGĂN CẢN BÀN THẮNG RÕ RỆT: Kéo ngã tiền đạo đối phương ngay trước vòng cấm trong tư thế đối mặt thủ môn, nhận thẻ đỏ trực tiếp rời sân!"
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
        badgeText: 'GOAL · BÀN THẮNG',
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
        badgeText: 'GOAL · BÀN THẮNG',
        badgeClass: 'bg-rose-600 text-white border-rose-300',
        player: scorer,
        desc: getRandomItem(GOAL_TEMPLATES)
      });
    }

    // Goalkeeper saves
    rawEvents.push({
      team: 1,
      type: 'SAVE',
      badgeText: 'SUPER SAVE · CỨU THUA',
      badgeClass: 'bg-cyan-500 text-slate-950 border-cyan-300',
      player: getRandomItem(t1.gks) || t1.squadList[0],
      desc: getRandomItem(SAVE_TEMPLATES)
    });

    rawEvents.push({
      team: 2,
      type: 'SAVE',
      badgeText: 'SUPER SAVE · CỨU THUA',
      badgeClass: 'bg-cyan-500 text-slate-950 border-cyan-300',
      player: getRandomItem(t2.gks) || t2.squadList[0],
      desc: getRandomItem(SAVE_TEMPLATES)
    });

    // Defense highlights
    rawEvents.push({
      team: 1,
      type: 'DEFENSE',
      badgeText: 'TACKLE · CẢN PHÁ',
      badgeClass: 'bg-sky-500 text-slate-950 border-sky-300',
      player: getRandomItem(t1.dfs) || t1.squadList[0],
      desc: getRandomItem(DEFENSE_TEMPLATES)
    });

    rawEvents.push({
      team: 2,
      type: 'DEFENSE',
      badgeText: 'TACKLE · CẢN PHÁ',
      badgeClass: 'bg-sky-500 text-slate-950 border-sky-300',
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
      badgeText: 'WOODWORK · XÀ NGANG',
      badgeClass: 'bg-amber-400 text-slate-950 border-amber-200',
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
      badgeText: 'KEY PASS · KIẾN TẠO',
      badgeClass: 'bg-indigo-500 text-white border-indigo-300',
      player: assistPlayer,
      desc: getRandomItem(ASSIST_TEMPLATES)
    });

    // Yellow Card or Red Card
    const cardTeam = Math.random() > 0.5 ? 1 : 2;
    const cardPlayer = cardTeam === 1
      ? (getRandomItem([...t1.dfs, ...t1.mfs]) || t1.squadList[0])
      : (getRandomItem([...t2.dfs, ...t2.mfs]) || t2.squadList[0]);
    const isRedCard = Math.random() < 0.45;
    rawEvents.push({
      team: cardTeam,
      type: isRedCard ? 'RED_CARD' : 'CARD',
      badgeText: isRedCard ? 'RED CARD · THẺ ĐỎ' : 'YELLOW CARD · THẺ VÀNG',
      badgeClass: isRedCard
        ? 'bg-rose-600 text-white border-rose-300'
        : 'bg-yellow-400 text-slate-950 border-yellow-200',
      player: cardPlayer,
      desc: getRandomItem(isRedCard ? RED_CARD_TEMPLATES : CARD_TEMPLATES)
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
        } else if (finalS2 > finalS1) {
          setWinner(player2);
          setMatchPhase('finished');
          sounds.playFanfare();
        } else {
          // Tie -> Enter Penalty Shootout!
          startPenaltyShootout(finalS1, finalS2);
        }
      } else {
        // Fast forward clock
        minuteRef.current = nextMin;
        setCurrentMinute(nextMin);
      }
    }, 200); // Match clock: 200ms per minute (10' = 2s)

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

    // Fair Sudden Death rounds if still tied after 5 kicks
    let sdRound = 6;
    while (p1Wins === p2Wins && sdRound <= 12) {
      const p1Sd = Math.random() > 0.3;
      const p2Sd = sdRound === 12 ? !p1Sd : Math.random() > 0.3;
      if (p1Sd) p1Wins++;
      if (p2Sd) p2Wins++;
      kicks.push({
        round: sdRound,
        team: 1,
        shooter: p1Shooters[(sdRound - 1) % p1Shooters.length],
        gk: p2Gk,
        scored: p1Sd
      });
      kicks.push({
        round: sdRound,
        team: 2,
        shooter: p2Shooters[(sdRound - 1) % p2Shooters.length],
        gk: p1Gk,
        scored: p2Sd
      });
      sdRound++;
    }

    setPenaltyKicks(kicks);
    setPenScore1(0);
    setPenScore2(0);
    setCurrentPenIndex(-1);

    // Play penalty kicks one by one
    let idx = 0;
    let curP1 = 0;
    let curP2 = 0;

    const stepPenalty = () => {
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
        setCompletedEvents(prev => [{
          min: `PEN ${k.round}`,
          team: k.team,
          type: 'PENALTY',
          player: k.shooter,
          desc: k.scored
            ? `SÚT PHẠT ĐỀN THÀNH CÔNG: ${k.shooter?.name} đánh bại ${k.gk?.name} trên chấm 11m! (Tỷ số luân lưu: ${curP1} - ${curP2})`
            : `ĐÁ HỎNG 11M: ${k.gk?.name} đoán đúng hướng cản phá cú sút của ${k.shooter?.name}! (Tỷ số luân lưu: ${curP1} - ${curP2})`
        }, ...prev]);
        idx++;
      } else {
        clearInterval(penInterval);
        sounds.playWhistle();
        const penWinner = curP1 > curP2 ? player1 : player2;
        setWinner(penWinner);
        setMatchPhase('finished');
        sounds.playFanfare();
      }
    };

    const initTimer = setTimeout(stepPenalty, 500);
    const penInterval = setInterval(stepPenalty, 1700);
    return () => {
      clearTimeout(initTimer);
      clearInterval(penInterval);
    };
  };

  const evT1 = completedEvents.filter(e => e.team === 1);
  const evT2 = completedEvents.filter(e => e.team === 2);
  const p1Power = t1.avgOvr * 0.65 + t1.chem * 0.35 + evT1.length * 1.5;
  const p2Power = t2.avgOvr * 0.65 + t2.chem * 0.35 + evT2.length * 1.5;
  const poss1 = Math.min(68, Math.max(32, Math.round((p1Power / (p1Power + p2Power || 1)) * 100)));
  const poss2 = 100 - poss1;
  const shots1 = evT1.filter(e => e.type === 'GOAL' || e.type === 'WOODWORK' || e.type === 'ASSIST').length + (matchPhase === 'lobby' ? 0 : Math.floor(currentMinute / 22));
  const shots2 = evT2.filter(e => e.type === 'GOAL' || e.type === 'WOODWORK' || e.type === 'ASSIST').length + (matchPhase === 'lobby' ? 0 : Math.floor(currentMinute / 22));
  const saves1 = evT1.filter(e => e.type === 'SAVE' || e.type === 'DEFENSE').length;
  const saves2 = evT2.filter(e => e.type === 'SAVE' || e.type === 'DEFENSE').length;
  const cards1 = evT1.filter(e => e.type === 'CARD' || e.type === 'RED_CARD').length;
  const cards2 = evT2.filter(e => e.type === 'CARD' || e.type === 'RED_CARD').length;

  const goalsT1 = completedEvents.filter(e => e.team === 1 && e.type === 'GOAL').slice().reverse();
  const goalsT2 = completedEvents.filter(e => e.team === 2 && e.type === 'GOAL').slice().reverse();

  const EVENT_LABELS = {
    GOAL: 'BÀN THẮNG',
    ASSIST: 'KIẾN TẠO',
    SAVE: 'CỨU THUA',
    DEFENSE: 'CẢN PHÁ',
    WOODWORK: 'CỘT DỌC',
    CARD: 'THẺ VÀNG',
    RED_CARD: 'THẺ ĐỎ',
    PENALTY: 'LUÂN LƯU 11M',
  };

  return (
    <div className="broadcast-panel border border-slate-800 rounded-xl p-4 max-w-6xl mx-auto w-full">
      {/* Compact Broadcast Scoreboard */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-4 py-2.5 mb-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1/3 h-full bg-emerald-500/8 blur-2xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/3 h-full bg-rose-500/10 blur-2xl pointer-events-none" />

        <div className="grid grid-cols-12 items-center gap-2 relative z-10">
          {/* Team 1 (Left - Emerald) */}
          <div className="col-span-4 flex items-center gap-2.5">
            <span className="w-1.5 h-9 bg-emerald-400 rounded-sm shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-lg md:text-xl font-extrabold text-emerald-400 tracking-wide uppercase truncate leading-none">
                {player1.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono-num text-slate-400">
                <span>OVR <strong className="text-amber-400">{t1.avgOvr}</strong></span>
                <span className="text-slate-700">|</span>
                <span>CHEM <strong className="text-cyan-400">{t1.chem}</strong></span>
              </div>
            </div>
          </div>

          {/* Center Clock & Score */}
          <div className="col-span-4 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-slate-900 border border-slate-800 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${matchPhase === 'playing' ? (activeHighlight ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-500'}`} />
              <span className="font-mono-num text-[11px] font-bold tracking-wider text-slate-200 uppercase">
                {matchPhase === 'lobby' ? 'FINAL · READY CHECK' :
                 matchPhase === 'countdown' ? `KICKOFF IN ${countdown}` :
                 matchPhase === 'penalty' ? 'PENALTY SHOOTOUT' :
                 matchPhase === 'finished' ? 'FULL TIME · 90\'' :
                 activeHighlight ? `PHÚT ${currentMinute}' · TẠM DỪNG (${highlightCountdown}s)` :
                 `PHÚT ${currentMinute}'`}
              </span>
            </div>

            <div className="font-mono-num text-4xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3 leading-none">
              <span className={activeHighlight?.team === 1 && activeHighlight?.type === 'GOAL' ? 'text-emerald-400' : 'text-white'}>
                {liveScore1}
              </span>
              <span className="text-slate-600 text-2xl font-normal">-</span>
              <span className={activeHighlight?.team === 2 && activeHighlight?.type === 'GOAL' ? 'text-rose-400' : 'text-white'}>
                {liveScore2}
              </span>
            </div>

            {penScore1 !== null && penScore2 !== null && (
              <span className="font-mono-num text-[11px] font-bold text-amber-400 mt-1">
                PEN: {penScore1} - {penScore2}
              </span>
            )}

            <div className="w-full max-w-[200px] bg-slate-900 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 h-full transition-all duration-75"
                style={{ width: `${Math.min(100, (currentMinute / 90) * 100)}%` }}
              />
            </div>
          </div>

          {/* Team 2 (Right - Opponent Red) */}
          <div className="col-span-4 flex items-center justify-end gap-2.5 text-right">
            <div className="min-w-0">
              <h3 className="font-display text-lg md:text-xl font-extrabold text-rose-400 tracking-wide uppercase truncate leading-none">
                {player2.name}
              </h3>
              <div className="flex items-center justify-end gap-2 mt-1 text-[11px] font-mono-num text-slate-400">
                <span>OVR <strong className="text-amber-400">{t2.avgOvr}</strong></span>
                <span className="text-slate-700">|</span>
                <span>CHEM <strong className="text-cyan-400">{t2.chem}</strong></span>
              </div>
            </div>
            <span className="w-1.5 h-9 bg-rose-500 rounded-sm shrink-0" />
          </div>
        </div>
      </div>

      {/* LIVE MATCH STATS STRIP */}
      {matchPhase !== 'lobby' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between font-mono-num text-xs font-bold mb-1">
              <span className="text-emerald-400">{poss1}%</span>
              <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider">Kiểm soát bóng</span>
              <span className="text-rose-400">{poss2}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400 h-full transition-all duration-300" style={{ width: `${poss1}%` }} />
              <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${poss2}%` }} />
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold">
            <span className="text-emerald-400 text-sm">{shots1}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider">Cơ hội / Dứt điểm</span>
            <span className="text-rose-400 text-sm">{shots2}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold">
            <span className="text-emerald-400 text-sm">{saves1}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider">Cứu thua & Cản phá</span>
            <span className="text-rose-400 text-sm">{saves2}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold">
            <span className="text-emerald-400 text-sm">{cards1}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider">Thẻ phạt</span>
            <span className="text-rose-400 text-sm">{cards2}</span>
          </div>
        </div>
      )}

      {/* STAGE 1: LOBBY READY CHECK */}
      {matchPhase === 'lobby' && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-6 text-center">
          <h2 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide mb-1">
            CHUNG KẾT SIÊU CÚP 1V1
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
            Cả 2 HLV xác nhận sẵn sàng để bắt đầu mô phỏng trận đấu 90 phút.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className={`p-4 rounded-lg border transition-colors ${
              p1Ready ? 'bg-emerald-950/35 border-emerald-400' : 'bg-slate-900/80 border-emerald-500/35'
            }`}>
              <h4 className="font-display text-xl font-extrabold text-emerald-400 uppercase">{player1.name}</h4>
              <p className="font-mono-num text-xs text-slate-400 mb-3">OVR {t1.avgOvr} · CHEM {t1.chem}</p>
              <button
                onClick={handleToggleP1Ready}
                disabled={onlineState.isConnected && onlineState.role !== 'host'}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p1Ready ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${onlineState.isConnected && onlineState.role !== 'host' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p1Ready ? 'ĐÃ SẴN SÀNG' : 'SẴN SÀNG'}
              </button>
            </div>

            <div className={`p-4 rounded-lg border-2 transition-colors ${
              p2Ready ? 'bg-rose-950/35 border-rose-500' : 'bg-slate-900/80 border-rose-500/60'
            }`}>
              <h4 className="font-display text-xl font-extrabold text-rose-400 uppercase">{player2.name}</h4>
              <p className="font-mono-num text-xs text-slate-400 mb-3">OVR {t2.avgOvr} · CHEM {t2.chem}</p>
              <button
                onClick={handleToggleP2Ready}
                disabled={onlineState.isConnected && onlineState.role !== 'guest'}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  p2Ready ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${onlineState.isConnected && onlineState.role !== 'guest' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p2Ready ? (isP2Bot ? 'BOT ĐÃ SẴN SÀNG' : 'ĐÃ SẴN SÀNG') : 'SẴN SÀNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: PRE-MATCH COUNTDOWN */}
      {matchPhase === 'countdown' && (
        <div className="h-[255px] flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-lg mb-3">
          <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-2">
            TRẬN ĐẤU SẮP BẮT ĐẦU
          </span>
          <div className="font-mono-num text-7xl font-extrabold text-white">
            {countdown}
          </div>
        </div>
      )}

      {/* STAGE 3: FIXED-HEIGHT 2-COLUMN EVENT STAGE (NO JUMPING / NO POP-UP) */}
      {matchPhase === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:h-[255px] mb-3">
          {/* LEFT BOX: TEAM 1 */}
          <div
            className={`h-full rounded-lg p-3.5 flex flex-col justify-between transition-colors duration-200 relative overflow-hidden ${
              activeHighlight?.team === 1
                ? 'bg-emerald-950/30 border-2 border-emerald-400'
                : 'bg-slate-950/75 border border-emerald-500/30'
            }`}
          >
            {activeHighlight?.team === 1 ? (
              <>
                <div className="flex items-center gap-3.5">
                  {/* Player Photo */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-amber-400/80 bg-slate-800 shrink-0">
                    {activeHighlight.player.photo ? (
                      <img
                        src={activeHighlight.player.photo}
                        alt={activeHighlight.player.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-display text-2xl font-extrabold text-amber-400">
                        {activeHighlight.player.ovr}
                      </div>
                    )}
                  </div>

                  {/* Player Meta & Event Tag */}
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block font-display text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm border mb-1 ${activeHighlight.badgeClass}`}>
                      {activeHighlight.badgeText}
                    </span>
                    <h4 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide truncate leading-none">
                      {activeHighlight.player.name}
                    </h4>
                    <div className="text-[11px] text-slate-300 font-semibold mt-1 uppercase tracking-wider">
                      <span className="text-amber-400 font-mono-num font-bold">{activeHighlight.player.ovr} OVR</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="text-emerald-400 font-bold">{activeHighlight.player.subPos || activeHighlight.player.position}</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="text-slate-400">{activeHighlight.player.club}</span>
                    </div>
                  </div>
                </div>

                {/* Commentary Directly Under Player Photo */}
                <div className="mt-2.5 bg-slate-900/90 border border-emerald-500/30 rounded p-2.5 text-xs md:text-[13px] text-emerald-100 leading-relaxed flex-1 flex items-center">
                  {activeHighlight.desc}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="font-display text-sm font-bold uppercase tracking-widest text-emerald-400/80 mb-1">
                  {player1.name}
                </div>
                <p className="text-xs text-slate-500">
                  {activeHighlight?.team === 2
                    ? 'Hàng phòng ngự đang tập trung cản phá đợt lên bóng của đối thủ.'
                    : `Phút ${currentMinute}' — Đang kiểm soát bóng và tìm khoảng trống...`}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT BOX: TEAM 2 (OPPONENT RED BORDER) */}
          <div
            className={`h-full rounded-lg p-3.5 flex flex-col justify-between transition-colors duration-200 relative overflow-hidden ${
              activeHighlight?.team === 2
                ? 'bg-rose-950/35 border-2 border-rose-500'
                : 'bg-slate-950/75 border-2 border-rose-500/55'
            }`}
          >
            {activeHighlight?.team === 2 ? (
              <>
                <div className="flex items-center gap-3.5">
                  {/* Player Photo */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-rose-400/80 bg-slate-800 shrink-0">
                    {activeHighlight.player.photo ? (
                      <img
                        src={activeHighlight.player.photo}
                        alt={activeHighlight.player.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-display text-2xl font-extrabold text-rose-400">
                        {activeHighlight.player.ovr}
                      </div>
                    )}
                  </div>

                  {/* Player Meta & Event Tag */}
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block font-display text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm border mb-1 ${activeHighlight.badgeClass}`}>
                      {activeHighlight.badgeText}
                    </span>
                    <h4 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide truncate leading-none">
                      {activeHighlight.player.name}
                    </h4>
                    <div className="text-[11px] text-slate-300 font-semibold mt-1 uppercase tracking-wider">
                      <span className="text-amber-400 font-mono-num font-bold">{activeHighlight.player.ovr} OVR</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="text-rose-400 font-bold">{activeHighlight.player.subPos || activeHighlight.player.position}</span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="text-slate-400">{activeHighlight.player.club}</span>
                    </div>
                  </div>
                </div>

                {/* Commentary Directly Under Player Photo */}
                <div className="mt-2.5 bg-slate-900/90 border border-rose-500/35 rounded p-2.5 text-xs md:text-[13px] text-rose-100 leading-relaxed flex-1 flex items-center">
                  {activeHighlight.desc}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="font-display text-sm font-bold uppercase tracking-widest text-rose-400/80 mb-1">
                  {player2.name}
                </div>
                <p className="text-xs text-slate-500">
                  {activeHighlight?.team === 1
                    ? 'Hàng phòng ngự đang lùi sâu chống đỡ sức ép từ đối phương.'
                    : `Phút ${currentMinute}' — Đang giữ cự ly đội hình và chờ thời cơ phản công...`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 4: PENALTY SHOOTOUT */}
      {matchPhase === 'penalty' && (
        <div className="bg-slate-950/85 border border-amber-500/40 rounded-lg p-3.5 text-center mb-3 md:h-[255px] flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-400">
              LOẠT SÚT LUÂN LƯU 11M (HÒA {liveScore1}-{liveScore2})
            </span>
            <span className="font-mono-num text-sm font-extrabold px-2.5 py-0.5 rounded bg-slate-900 border border-amber-500/50 text-white">
              PEN: <span className="text-emerald-400">{penScore1}</span> - <span className="text-rose-400">{penScore2}</span>
            </span>
          </div>

          {/* Penalty Shootout Round-by-Round Tracker */}
          <div className="grid grid-cols-2 gap-3 my-1.5">
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded px-3 py-1.5 flex items-center justify-between gap-2">
              <span className="font-display text-xs font-extrabold text-emerald-400 uppercase truncate">{player1.name}</span>
              <div className="flex items-center gap-1.5">
                {penaltyKicks.filter(k => k.team === 1).map((k, i) => {
                  const globalIdx = penaltyKicks.indexOf(k);
                  const revealed = globalIdx <= currentPenIndex;
                  return (
                    <span
                      key={i}
                      title={`Lượt ${k.round}: ${k.shooter?.name}`}
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center border ${
                        !revealed
                          ? 'bg-slate-800 border-slate-700 text-slate-500'
                          : k.scored
                          ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                          : 'bg-rose-600 border-rose-400 text-white'
                      }`}
                    >
                      {!revealed ? k.round : k.scored ? '✓' : '✕'}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/90 border-2 border-rose-500/60 rounded px-3 py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {penaltyKicks.filter(k => k.team === 2).map((k, i) => {
                  const globalIdx = penaltyKicks.indexOf(k);
                  const revealed = globalIdx <= currentPenIndex;
                  return (
                    <span
                      key={i}
                      title={`Lượt ${k.round}: ${k.shooter?.name}`}
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center border ${
                        !revealed
                          ? 'bg-slate-800 border-slate-700 text-slate-500'
                          : k.scored
                          ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                          : 'bg-rose-600 border-rose-400 text-white'
                      }`}
                    >
                      {!revealed ? k.round : k.scored ? '✓' : '✕'}
                    </span>
                  );
                })}
              </div>
              <span className="font-display text-xs font-extrabold text-rose-400 uppercase truncate">{player2.name}</span>
            </div>
          </div>

          {currentPenIndex >= 0 && penaltyKicks[currentPenIndex] ? (
            <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-amber-400 bg-slate-800 shrink-0">
                    {penaltyKicks[currentPenIndex].shooter?.photo && (
                      <img src={penaltyKicks[currentPenIndex].shooter.photo} alt="" className="w-full h-full object-cover object-top" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Lượt {penaltyKicks[currentPenIndex].round} · {penaltyKicks[currentPenIndex].team === 1 ? player1.name : player2.name}
                    </div>
                    <div className="text-sm font-extrabold text-white truncate">{penaltyKicks[currentPenIndex].shooter?.name}</div>
                    <div className="text-[10px] text-slate-400">Người sút ({penaltyKicks[currentPenIndex].shooter?.ovr} OVR)</div>
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider shrink-0 ${
                  penaltyKicks[currentPenIndex].scored
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                }`}>
                  {penaltyKicks[currentPenIndex].scored ? 'VÀO! 11M THÀNH CÔNG' : 'KHÔNG VÀO! CẢN PHÁ'}
                </div>

                <div className="flex items-center justify-end gap-2.5 flex-1">
                  <div className="text-right min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Thủ môn</div>
                    <div className="text-sm font-extrabold text-white truncate">{penaltyKicks[currentPenIndex].gk?.name}</div>
                    <div className="text-[10px] text-slate-400">{penaltyKicks[currentPenIndex].gk?.ovr} OVR</div>
                  </div>
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-cyan-400 bg-slate-800 shrink-0">
                    {penaltyKicks[currentPenIndex].gk?.photo && (
                      <img src={penaltyKicks[currentPenIndex].gk.photo} alt="" className="w-full h-full object-cover object-top" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Hai đội đang chuẩn bị bước lên chấm đá phạt đền 11m...
            </div>
          )}
        </div>
      )}

      {/* STAGE 5: FINISHED CELEBRATION */}
      {matchPhase === 'finished' && winner && (
        <div className="mb-3 p-4 rounded-lg bg-gradient-to-r from-amber-950/45 via-slate-900 to-amber-950/45 border border-amber-500/70">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 font-display text-2xl md:text-3xl font-extrabold text-amber-300 uppercase tracking-wide">
              <Trophy className="w-6 h-6 text-amber-400" />
              CHÚC MỪNG {winner.name} VÔ ĐỊCH SIÊU CÚP 1V1
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3 text-xs">
            <div className="bg-slate-950/75 border border-emerald-500/30 rounded px-3 py-2 flex items-center justify-between gap-2">
              <span className="font-display font-bold text-emerald-400 uppercase shrink-0">Ghi bàn ({player1.name})</span>
              <span className="text-slate-200 font-medium text-right">
                {goalsT1.length > 0 ? goalsT1.map(g => `${g.player?.name} (${g.min}')`).join(', ') : 'Không có bàn thắng'}
              </span>
            </div>
            <div className="bg-slate-950/75 border border-rose-500/40 rounded px-3 py-2 flex items-center justify-between gap-2">
              <span className="font-display font-bold text-rose-400 uppercase shrink-0">Ghi bàn ({player2.name})</span>
              <span className="text-slate-200 font-medium text-right">
                {goalsT2.length > 0 ? goalsT2.map(g => `${g.player?.name} (${g.min}')`).join(', ') : 'Không có bàn thắng'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
            {mvp && (
              <div className="inline-flex items-center gap-3 bg-slate-950/90 border border-amber-500/40 rounded-lg px-3.5 py-2 text-left">
                <div className="w-11 h-11 rounded overflow-hidden border border-amber-400 shrink-0">
                  {mvp.photo && (
                    <img src={mvp.photo} alt={mvp.name} className="w-full h-full object-cover object-top" />
                  )}
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block">
                    MAN OF THE MATCH (MVP)
                  </span>
                  <div className="text-xs font-extrabold text-white">
                    {mvp.name} · <span className="text-amber-400">{mvp.ovr} OVR</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{mvp.subPos || mvp.position} · {mvp.club}</div>
                </div>
              </div>
            )}

            <button
              onClick={onRestart}
              className="py-2.5 px-6 rounded font-display text-sm font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Giải Đấu Mới
            </button>
          </div>
        </div>
      )}

      {/* ALWAYS-VISIBLE DETAILED MATCH TIMELINE (NO SCROLL NEEDED) */}
      {matchPhase !== 'lobby' && (
        <div className="bg-slate-950/85 rounded-lg p-3.5 border border-slate-800">
          <div className="flex justify-between items-center mb-2.5">
            <span className="font-display text-xs font-bold text-slate-300 uppercase tracking-widest">
              MATCH TIMELINE · DIỄN BIẾN CHI TIẾT TRẬN ĐẤU
            </span>
            <span className="font-mono-num text-[11px] text-slate-400">
              {completedEvents.length} tình huống
            </span>
          </div>

          <div className="space-y-2 h-[230px] overflow-y-auto pr-1">
            {completedEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Trận đấu đang diễn ra — Các tình huống đáng chú ý sẽ cập nhật trực tiếp tại đây...
              </div>
            ) : (
              completedEvents.map((ev, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded text-xs flex items-start gap-2.5 border ${
                    ev.team === 1
                      ? 'bg-emerald-950/25 text-emerald-100 border-emerald-500/35'
                      : 'bg-rose-950/25 text-rose-100 border-rose-500/45'
                  }`}
                >
                  <span className="px-1.5 py-0.5 rounded-sm font-mono-num font-bold text-[11px] bg-slate-900 text-amber-400 border border-slate-800 shrink-0 mt-0.5">
                    {typeof ev.min === 'number' ? `${ev.min}'` : ev.min}
                  </span>
                  <span className={`font-display text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 mt-0.5 ${
                    ev.type === 'GOAL' ? 'bg-amber-400 text-slate-950' :
                    ev.type === 'RED_CARD' ? 'bg-rose-600 text-white' :
                    ev.type === 'CARD' ? 'bg-yellow-400 text-slate-950' :
                    ev.type === 'PENALTY' ? 'bg-cyan-500 text-slate-950' :
                    'bg-slate-800 text-slate-200'
                  }`}>
                    {EVENT_LABELS[ev.type] || ev.type}
                  </span>
                  <div className="min-w-0 flex-1 leading-snug">
                    <span className="font-bold text-white">{ev.player?.name}</span>
                    {ev.player?.position && (
                      <span className="ml-1.5 font-mono-num text-[10px] text-slate-400">
                        ({ev.player.subPos || ev.player.position})
                      </span>
                    )}
                    <span className="mx-1.5 text-slate-500">—</span>
                    <span className="text-slate-300">{ev.desc}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
