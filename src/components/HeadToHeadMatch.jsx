import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { sounds } from '../utils/sound';
import { calcSquadStats } from '../data/players';
import MatchPitch2D from './MatchPitch2D';

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
  const [simSpeed, setSimSpeed] = useState(1);
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
  const [preGeneratedPenalties, setPreGeneratedPenalties] = useState(null);
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
  const [isHalfTime, setIsHalfTime] = useState(false);
  const halfTimeDoneRef = useRef(false);
  const [goalImpactActive, setGoalImpactActive] = useState(false);
  const highlightTimersRef = useRef([]);

  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach(t => clearTimeout(t));
      highlightTimersRef.current = [];
    };
  }, []);

  // 1. Calculate Team Power & Stats (strictly group by formation slot so GK never enters outfield event pools)
  const calcTeamInfo = (manager) => {
    const squad = manager.squad || {};
    const { avgOvr, chemistry: chem, players: squadList } = calcSquadStats(squad);
    const safeAvgOvr = squadList.length > 0 ? avgOvr : 75;

    const gks = squad.gk ? [squad.gk] : squadList.filter(p => p.position === 'GK');
    const dfSlots = ['lb', 'lcb', 'rcb', 'rb'].map(k => squad[k]).filter(Boolean);
    const mfSlots = ['cdm', 'cm1', 'cm2', 'cam'].map(k => squad[k]).filter(Boolean);
    const fwSlots = ['lw', 'st', 'rw'].map(k => squad[k]).filter(Boolean);

    const outfieldFallback = squadList.filter(p => p.id !== gks[0]?.id);
    const dfs = dfSlots.length > 0 ? dfSlots : outfieldFallback.slice(0, 4);
    const mfs = mfSlots.length > 0 ? mfSlots : outfieldFallback.slice(4, 7);
    const fws = fwSlots.length > 0 ? fwSlots : outfieldFallback.slice(7, 10);

    const atkOvr = fws.length > 0
      ? Math.round(fws.reduce((acc, p) => acc + p.ovr, 0) / fws.length)
      : safeAvgOvr;

    // Default fallback player if squad is empty
    const dummyPlayer = { name: manager.name, ovr: safeAvgOvr, position: 'FW', club: 'FC All-Stars', nation: 'FIFA' };
    const safeOutfield = outfieldFallback.length > 0 ? outfieldFallback : (squadList.length > 0 ? squadList : [dummyPlayer]);

    return { 
      squadList: squadList.length > 0 ? squadList : [dummyPlayer], 
      avgOvr: safeAvgOvr, 
      atkOvr,
      chem, 
      gks: gks.length > 0 ? gks : [dummyPlayer],
      dfs: dfs.length > 0 ? dfs : safeOutfield,
      mfs: mfs.length > 0 ? mfs : safeOutfield,
      fws: fws.length > 0 ? fws : safeOutfield
    };
  };

  const t1 = calcTeamInfo(player1);
  const t2 = calcTeamInfo(player2);

  // 2. Generate Rich Commentary Match Events (OVR + CHEM heavily drive outcome, with realistic variance)
  const generateMatchScript = () => {
    const power1 = t1.avgOvr * 0.65 + t1.chem * 0.35;
    const power2 = t2.avgOvr * 0.65 + t2.chem * 0.35;
    const powerDiff = power1 - power2;

    // Strong team advantage scales meaningfully with OVR + CHEM gap
    const diffBonus = Math.max(-1.85, Math.min(1.85, powerDiff * 0.14));
    const atkBonus1 = Math.max(-0.3, Math.min(0.5, (t1.atkOvr - 83) * 0.04));
    const atkBonus2 = Math.max(-0.3, Math.min(0.5, (t2.atkOvr - 83) * 0.04));

    // Bell-curve luck (sum of two randoms centered at 0) prevents extreme random blowouts
    const luck1 = ((Math.random() + Math.random()) / 2 - 0.5) * 1.5;
    const luck2 = ((Math.random() + Math.random()) / 2 - 0.5) * 1.5;

    let g1 = Math.max(0, Math.round(1.35 + diffBonus + atkBonus1 + luck1 + (Math.random() > 0.6 ? 1 : 0)));
    let g2 = Math.max(0, Math.round(1.35 - diffBonus + atkBonus2 + luck2 + (Math.random() > 0.6 ? 1 : 0)));

    // Guard against unrealistic heavy losses when one team is clearly superior in OVR & CHEM
    if (powerDiff >= 5) {
      if (g2 > g1 + 1) g2 = g1 + (Math.random() < 0.25 ? 1 : 0);
      if (powerDiff >= 8 && g2 > g1) g2 = g1;
    } else if (powerDiff <= -5) {
      if (g1 > g2 + 1) g1 = g2 + (Math.random() < 0.25 ? 1 : 0);
      if (powerDiff <= -8 && g1 > g2) g1 = g2;
    }

    // Ensure at least 1 goal total for entertainment
    if (g1 === 0 && g2 === 0 && Math.random() > 0.35) {
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
      "PHẢN CÔNG CHỚP NHOÁNG: Bứt tốc xé gió vượt qua bẫy việt vị rồi tung cú sút chìm chéo góc lạnh lùng hạ gục thủ môn trong pha đối mặt!",
      "PHỐI HỢP TIKI-TAKA MẪU MỰC: Bật nhả một-hai xé toạc vòng cấm rồi tung cú sút chân trái gọn gàng vào góc gần không cho thủ môn cơ hội phản xạ!",
      "TRIVELA MÁ NGOÀI ĐẲNG CẤP: Thoát xuống bên hành lang phải rồi vẩy má ngoài cực xoáy đưa bóng găm thẳng vào mép trong cột dọc bay vào lưới!",
      "DỨT ĐIỂM BÙNG NỔ PHÚT QUYẾT ĐỊNH: Đỡ ngực khống chế gọn gàng giữa vòng vây hậu vệ rồi xoay người sút tung nóc lưới trong tiếng hò reo vang dội!",
      "ĐÁNH GÓT NGẪU HỨNG ĐIÊN RỒ: Quay lưng về phía khung thành nhưng vẫn giật gót tinh quái đưa bóng lọt qua khe chân thủ môn đi thẳng vào lưới!",
      "LỐP BÓNG KỸ THUẬT ĐỈNH CAO: Quan sát thấy thủ môn dâng cao, thực hiện cú lốp bóng mềm mại từ rìa vòng cấm vẽ cầu vồng vào góc xa!",
      "SÚT BỒI CHỚP NHOÁNG: Pha dứt điểm đầu tiên bị đẩy ra nhưng đã ập vào cực nhanh đá bồi tung lưới trong sự bất lực của hàng thủ!",
      "CÚ SÚT CHẾT CHÓC GÓC HẸP: Thoát xuống sát đường biên ngang rồi tung cú nã đại bác ở góc cực hẹp đưa bóng dội xà ngang bay vào lưới!"
    ];

    const PENALTY_GOAL_TEMPLATES = [
      "PENALTY 11M · PANENKA ĐẲNG CẤP: Trên chấm phạt đền 11m, bình tĩnh tung cú sục bóng kiểu Panenka điệu nghệ vào chính giữa khung thành khi thủ môn đã đổ người!",
      "PENALTY 11M · SÚT PHẠT ĐỀN LẠNH LÙNG: Trọng tài chỉ tay vào chấm 11m sau pha phạm lỗi trong vòng cấm! Cú sút căng như búa bổ găm thẳng vào góc chữ A không thể cản phá!",
      "PENALTY 11M · ĐÁNH LỪA THỦ MÔN HOÀN HẢO: Chạy đà đầy bản lĩnh, nhử thủ môn đổ người sang trái rồi nhẹ nhàng đặt lòng vào góc phải làm tung lưới!",
      "PENALTY 11M · DỨT ĐIỂM QUYẾT ĐOÁN: Áp lực ngàn cân trên chấm phạt đền nhưng vẫn tung cú sút chìm cực hiểm sát mép cột dọc mang về bàn thắng quý giá!"
    ];

    const PENALTY_SAVED_TEMPLATES = [
      "CẢN PHÁ PENALTY 11M XUẤT THẦN: Đối mặt cú sút phạt đền trên chấm 11m, thủ môn đổ người đoán đúng hướng đẩy bóng dội cột dọc cứu thua ngoạn mục!",
      "NGƯỜI HÙNG TRÊN CHẤM 11M: Bay người hết cỡ từ chối cú sút penalty hiểm hóc vào góc thấp, giữ vững tinh thần cho toàn đội!",
      "BẮT BÀI PHẠT ĐỀN ĐIỂM 10: Không bị đánh lừa bởi nhịp chạy đà, đứng vững rồi tung tay cản phá thành công quả phạt đền 11m!"
    ];

    const SAVE_TEMPLATES = [
      "PHẢN XẠ ĐẦU NGÓN TAY XUẤT THẦN: Cú sút chìm cực kỳ hiểm hóc nhưng thủ môn đã đổ người siêu nhanh, dùng đầu ngón tay đẩy bóng sượt cột dọc cứu bàn thua mười mươi!",
      "BAY NGƯỜI CỨU THUA KHÔNG TƯỞNG: Bay người như cánh chim ưng trong không trung, tung tay đẩy quả bóng đang bay vào góc chết vọt xà ngang trong sự thán phục của khán đài!",
      "BỨC TƯỜNG THÉP TRƯỚC KHUNG THÀNH: Lao ra khép góc cực kỳ dũng cảm trong pha đối mặt một chọi một, cản phá thành công cú dứt điểm hiểm hóc!",
      "PHẢN XẠ BẰNG CHÂN ĐIỂM 10: Tiền đạo đệm bóng cận thành chỉ cách 5m, nhưng thủ môn phản xạ bằng chân chớp nhoáng chặn đứng bóng ngay trên vạch vôi!",
      "CỨU THUA KÉP NGOẠN MỤC: Đẩy được cú đá phạt hiểm hóc rồi lập tức bật dậy cản phá nốt pha đá bồi cận thành trong sự ngỡ ngàng của đối thủ!",
      "BẮT DÍNH BÓNG QUẢ CẢM: Băng ra giữa rừng cầu thủ trong tình huống phạt góc và đấm bóng giải nguy chuẩn xác, giải tỏa hoàn toàn sức ép!",
      "CẢN PHÁ CÚ CỨA LÒNG HIỂM HÓC: Rướn người hết tầm đẩy bóng qua xà ngang sau cú cứa lòng như vẽ vào góc cao khung thành!",
      "KHÉP GÓC THẦN TỐC: Băng ra như tia chớp khép kín mọi khoảng trống khiến tiền đạo đối phương không thể dứt điểm thành công!"
    ];

    const WOODWORK_TEMPLATES = [
      "BÓNG DỘI XÀ NGANG TRONG GANG TẤC: Pha xoay sở đẳng cấp rồi dứt điểm cực căng, bóng đánh bại thủ môn nhưng lại tìm đến đúng xà ngang bật ra ngoài trong tiếc nuối!",
      "ĐẬP CỘT DỌC NGHẸT THỞ: Cú cứa lòng quá hiểm hóc khiến thủ môn đứng hình, tiếc rằng bóng đập trúng cột dọc bật ngược trở lại sân!",
      "BÓNG ĐẬP MÉP TRONG CỘT DỌC: Pha bắt vô-lê tuyến hai đưa bóng dội mép trong cột dọc rồi lăn ngang qua vạch vôi ra ngoài trong gang tấc!",
      "XÀ NGANG TỪ CHỐI SIÊU PHẨM: Cú sút phạt hàng rào cực xoáy đưa bóng liếm mép trên xà ngang bay vọt ra ngoài chỉ vài centimet!",
      "HAI LẦN DỘI KHUNG GỖ: Cú sút xa đập xà ngang bật ra, pha đá bồi ngay sau đó lại tiếp tục tìm trúng cột dọc đầy trớ trêu!"
    ];

    const DEFENSE_TEMPLATES = [
      "XOẠC BÓNG GIẢI NGUY HOÀN HẢO: Cú tắc bóng chính xác đến từng milimet ngay trong vòng cấm, tước đi cơ hội mười mươi trước khi tiền đạo kịp vung chân!",
      "CỨU THUA NGAY TRÊN VẠCH VÔI: Thủ môn đã bị đánh bại nhưng trung vệ bọc lót thần tốc, tung người phá bóng bằng đầu giải nguy ngay trước vạch vôi!",
      "TRANH CHẤP DŨNG MÃNH: Dùng sức mạnh và phán đoán tuyệt vời phong tỏa hoàn toàn đường đi bóng nguy hiểm của mũi nhọn tấn công đối phương!",
      "CẮT BÓNG ĐỌC TÌNH HUỐNG XUẤT SẮC: Phán đoán chuẩn xác đường chọc khe xuyên tuyến, lao lên cắt bóng gọn ghẽ và phát động phản công ngay lập tức!",
      "CHE CHẮN VÀ ĐOẠT BÓNG LẠNH LÙNG: Đọc ý đồ ngoặt bóng của tiền đạo cánh, cài người hợp lệ rồi đoạt bóng sạch sẽ ngay sát đường biên!",
      "ĐEO BÁM KHÔNG BIẾT MỆT MỎI: Bắt bài pha đảo chân kỹ thuật của đối thủ và dùng vai tì đè hợp lệ đoạt lại quyền kiểm soát bóng!"
    ];

    const CARD_TEMPLATES = [
      "PHẠM LỖI CHIẾN THUẬT: Nhận thấy đối phương đang mở đợt phản công nhanh nguy hiểm, đã chủ động kéo áo ngăn cản và phải nhận thẻ vàng cảnh cáo!",
      "VÀO BÓNG QUYẾT LIỆT QUÁ MỨC: Pha tranh chấp tầm cao khá rát ở khu vực giữa sân khiến trọng tài lập tức rút thẻ vàng nhắc nhở!",
      "NGĂN CẢN ĐÁ PHẠT NHANH: Đứng chắn trước bóng làm chậm pha lên bóng của đối thủ và lập tức phải nhận thẻ vàng từ trọng tài chính!",
      "PHẢN ỨNG THÁI QUÁ VỚI TRỌNG TÀI: Không giữ được bình tĩnh sau tình huống tranh cãi và phải nhận ngay thẻ vàng cảnh cáo!"
    ];

    const RED_CARD_TEMPLATES = [
      "THẺ ĐỎ TRỰC TIẾP: Pha xoạc bóng bằng cả hai chân cực kỳ nguy hiểm từ phía sau, trọng tài không ngần ngại rút thẻ đỏ truất quyền thi đấu!",
      "PHẠM LỖI NGĂN CẢN BÀN THẮNG RÕ RỆT: Kéo ngã tiền đạo đối phương ngay trước vòng cấm trong tư thế đối mặt thủ môn, nhận thẻ đỏ trực tiếp rời sân!",
      "THẺ VÀNG THỨ HAI · RỜI SÂN: Pha vào bóng chậm một nhịp ở khu vực trung lộ buộc trọng tài rút thẻ vàng thứ hai, đồng nghĩa với chiếc thẻ đỏ!"
    ];

    const THROW_IN_TEMPLATES = [
      "NÉM BIÊN NHANH TẠO ĐỘT BIẾN: Nhận thấy hàng thủ đối phương chưa kịp ổn định, lập tức thực hiện quả ném biên chuẩn xác dọc hành lang cánh mở ra pha tấn công mới!",
      "NÉM BIÊN CHIẾN THUẬT: Đưa bóng vào sát đường biên dọc sau pha tranh chấp, đồng đội khống chế gọn gàng rồi chuyển hướng tấn công vào trung lộ!",
      "ĐỔI HƯỚNG TỪ TÌNH HUỐNG NÉM BIÊN: Quả ném biên mạnh và chính xác giúp đội nhà giữ vững nhịp kiểm soát bóng bên phần sân đối phương!"
    ];

    const CORNER_TEMPLATES = [
      "PHẠT GÓC NGUY HIỂM: Từ chấm phạt góc, quả tạt xoáy cực khó chịu hướng thẳng vào khu vực 5m50 khiến hàng phòng ngự đối phương phải vất vả giải vây!",
      "TÌNH HUỐNG CỐ ĐỊNH TỪ CỘT CỜ GÓC: Treo bóng chuẩn xác vào vòng cấm địa tạo ra pha không chiến nghẹt thở trước khung thành!",
      "PHẠT GÓC CHIẾN THUẬT: Phối hợp đá phạt góc đầy ý đồ khuấy đảo vòng cấm trước khi bóng bật ra tuyến hai!"
    ];

    const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Create a pool of minutes: pick 7 to 9 highlight minutes spaced >= 7' apart
    const totalHighlights = Math.min(9, Math.max(7, g1 + g2 + 5));
    const availableMinutes = [];
    for (let m = 7; m <= 85; m += 7) availableMinutes.push(m);
    // Shuffle and pick
    availableMinutes.sort(() => Math.random() - 0.5);
    const chosenMinutes = availableMinutes.slice(0, totalHighlights).sort((a, b) => a - b);

    // Distribution of events
    const rawEvents = [];

    const pickAssistPlayer = (teamObj, scorer) => {
      if (Math.random() > 0.78) return null; // ~78% of goals have an assist
      const pool = [...teamObj.mfs, ...teamObj.fws, ...teamObj.dfs].filter(
        (p) => p && p.id !== scorer?.id
      );
      return getRandomItem(pool) || null;
    };

    const pickWeightedScorer = (teamObj) => {
      const candidates = [...teamObj.fws, ...teamObj.mfs].filter(Boolean);
      if (candidates.length === 0) return teamObj.squadList[0];

      // Tier 1 superstars score much more frequently than Tier 2 role players; FW > MF
      const weighted = candidates.map((p) => {
        const isTier1 = p.tier === 1 || (p.ovr && p.ovr >= 88);
        const isFw = p.position === 'FW';
        const weight = isTier1 ? (isFw ? 6 : 4) : (isFw ? 1.4 : 0.8);
        return { p, weight };
      });

      const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const item of weighted) {
        roll -= item.weight;
        if (roll <= 0) return item.p;
      }
      return weighted[0].p;
    };

    // Goals for P1 (including occasional in-match Penalty Goal)
    for (let i = 0; i < g1; i++) {
      const scorer = pickWeightedScorer(t1);
      const isPenGoal = Math.random() < 0.22;
      const assistPlayer = isPenGoal ? null : pickAssistPlayer(t1, scorer);
      rawEvents.push({
        team: 1,
        type: 'GOAL',
        isPenalty: isPenGoal,
        badgeText: isPenGoal ? 'PENALTY 11M · BÀN THẮNG' : 'GOAL · BÀN THẮNG',
        badgeClass: isPenGoal
          ? 'bg-amber-400 text-slate-950 border-amber-200'
          : 'bg-emerald-500 text-slate-950 border-emerald-300',
        player: scorer,
        assistPlayer,
        desc: getRandomItem(isPenGoal ? PENALTY_GOAL_TEMPLATES : GOAL_TEMPLATES)
      });
    }

    // Goals for P2 (including occasional in-match Penalty Goal)
    for (let i = 0; i < g2; i++) {
      const scorer = pickWeightedScorer(t2);
      const isPenGoal = Math.random() < 0.22;
      const assistPlayer = isPenGoal ? null : pickAssistPlayer(t2, scorer);
      rawEvents.push({
        team: 2,
        type: 'GOAL',
        isPenalty: isPenGoal,
        badgeText: isPenGoal ? 'PENALTY 11M · BÀN THẮNG' : 'GOAL · BÀN THẮNG',
        badgeClass: isPenGoal
          ? 'bg-amber-400 text-slate-950 border-amber-200'
          : 'bg-rose-600 text-white border-rose-300',
        player: scorer,
        assistPlayer,
        desc: getRandomItem(isPenGoal ? PENALTY_GOAL_TEMPLATES : GOAL_TEMPLATES)
      });
    }

    // Occasional in-match Penalty Saved event (~45% chance)
    if (Math.random() < 0.45) {
      const penSaveTeam = Math.random() > 0.5 ? 1 : 2;
      const penSaveGk = penSaveTeam === 1
        ? (getRandomItem(t1.gks) || t1.squadList[0])
        : (getRandomItem(t2.gks) || t2.squadList[0]);
      rawEvents.push({
        team: penSaveTeam,
        type: 'PENALTY_SAVED',
        badgeText: 'PENALTY SAVED · CẢN PHÁ 11M',
        badgeClass: 'bg-amber-400 text-slate-950 border-amber-200',
        player: penSaveGk,
        desc: getRandomItem(PENALTY_SAVED_TEMPLATES)
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

    // Rare throw-in event from touchline contest (35% chance, at most 1 per match)
    if (Math.random() < 0.35) {
      const throwInTeam = Math.random() < 0.5 ? 1 : 2;
      const teamPool = throwInTeam === 1 ? t1 : t2;
      const throwInPlayer = getRandomItem([...teamPool.dfs, ...teamPool.mfs]) || teamPool.squadList[0];
      rawEvents.push({
        team: throwInTeam,
        type: 'THROW_IN',
        badgeText: 'THROW-IN · NÉM BIÊN',
        badgeClass: 'bg-cyan-500 text-slate-950 border-cyan-300',
        player: throwInPlayer,
        desc: getRandomItem(THROW_IN_TEMPLATES)
      });
    }

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

    // Always keep ALL generated goals so OVR/CHEM score outcome is never distorted,
    // then fill remaining highlight slots with shuffled non-goal events
    const goalEvents = rawEvents.filter(e => e.type === 'GOAL');
    const nonGoalEvents = rawEvents.filter(e => e.type !== 'GOAL').sort(() => Math.random() - 0.5);
    const neededNonGoals = Math.max(0, chosenMinutes.length - goalEvents.length);
    const selectedEvents = [...goalEvents, ...nonGoalEvents.slice(0, neededNonGoals)].sort(() => Math.random() - 0.5);

    // Ensure chosenMinutes has enough slots if there were many goals
    while (chosenMinutes.length < selectedEvents.length && availableMinutes.length > chosenMinutes.length) {
      const nextUnused = availableMinutes.find(m => !chosenMinutes.includes(m));
      if (nextUnused === undefined) break;
      chosenMinutes.push(nextUnused);
    }
    chosenMinutes.sort((a, b) => a - b);

    // Assign minutes in chronological order and compute running score
    const finalEvents = [];
    let runningScore1 = 0;
    let runningScore2 = 0;

    for (let i = 0; i < Math.min(chosenMinutes.length, selectedEvents.length); i++) {
      const ev = selectedEvents[i];
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

    // Pick MVP: player with most goals (preferring winning side), or highest OVR on winning side
    const goalEventsFinal = finalEvents.filter(e => e.type === 'GOAL' && e.player);
    let mvpPlayer = null;
    if (goalEventsFinal.length > 0) {
      const counts = new Map();
      for (const ge of goalEventsFinal) {
        const key = `${ge.team}-${ge.player.id || ge.player.name}`;
        const cur = counts.get(key) || { player: ge.player, team: ge.team, goals: 0 };
        cur.goals += 1;
        counts.set(key, cur);
      }
      const leadingTeam = runningScore1 > runningScore2 ? 1 : runningScore2 > runningScore1 ? 2 : 0;
      const ranked = Array.from(counts.values()).sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals;
        if (leadingTeam !== 0 && a.team !== b.team) return a.team === leadingTeam ? -1 : 1;
        return (b.player.ovr || 0) - (a.player.ovr || 0);
      });
      mvpPlayer = ranked[0]?.player || goalEventsFinal[0].player;
    } else {
      const pool = runningScore1 >= runningScore2 ? t1.squadList : t2.squadList;
      mvpPlayer = [...pool].sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0] || t1.squadList[0];
    }

    // Pre-generate penalty kicks if 90' ends in a tie so Host & Guest stay 100% synced
    let penaltyKicksScript = null;
    if (runningScore1 === runningScore2) {
      penaltyKicksScript = buildPenaltyKicks();
    }

    return { 
      events: finalEvents, 
      finalG1: runningScore1, 
      finalG2: runningScore2,
      mvp: mvpPlayer,
      penaltyKicks: penaltyKicksScript
    };
  };

  const buildPenaltyKicks = () => {
    const kicks = [];
    let p1Wins = 0;
    let p2Wins = 0;

    const p1Shooters = [...t1.fws, ...t1.mfs, ...t1.dfs];
    const p2Shooters = [...t2.fws, ...t2.mfs, ...t2.dfs];
    const p1Gk = t1.gks[0] || t1.squadList[0];
    const p2Gk = t2.gks[0] || t2.squadList[0];

    for (let round = 1; round <= 5; round++) {
      const p1Scores = Math.random() > 0.25;
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

    return kicks;
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
      setPreGeneratedPenalties(matchRemoteMsg.script.penaltyKicks || null);
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
          setPreGeneratedPenalties(script.penaltyKicks || null);
          if (onSendMatchMessage) {
            onSendMatchMessage({ type: 'MATCH_START_SIM', script });
          }
          setMatchPhase('countdown');
        }
      } else {
        const script = generateMatchScript();
        setEventsTimeline(script.events);
        setMvp(script.mvp);
        setPreGeneratedPenalties(script.penaltyKicks || null);
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
        halfTimeDoneRef.current = false;
        setIsHalfTime(false);
        setMatchPhase('playing');
        setCurrentMinute(0);
        minuteRef.current = 0;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [matchPhase, countdown]);

  // 4. Match Clock Simulation: 1st Half 45'=32.4s (720ms/min), Half-Time 3s, 2nd Half 45'=34.2s (760ms/min)
  useEffect(() => {
    if (matchPhase !== 'playing') return;

    const baseTickMs = halfTimeDoneRef.current ? 760 : 720;
    const tickMs = simSpeed === 2 ? Math.round(baseTickMs / 2) : baseTickMs;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;

      if (minuteRef.current === 45 && !halfTimeDoneRef.current) {
        halfTimeDoneRef.current = true;
        isPausedRef.current = true;
        setIsHalfTime(true);
        sounds.playWhistle();
        setTimeout(() => {
          setIsHalfTime(false);
          isPausedRef.current = false;
          sounds.playWhistle();
        }, 3000);
        return;
      }

      const nextMin = minuteRef.current + 1;

      // Check if there is an event at this minute
      const ev = eventsTimeline.find(e => e.min === nextMin);

      if (ev) {
        // PLAY SYNCHRONIZED CHOREOGRAPHY WITHOUT STOPPING THE CLOCK DURING BUILDUP
        // Clock ONLY pauses AFTER a goal is scored (for celebration + center kick-off reset)
        setCurrentMinute(nextMin);
        minuteRef.current = nextMin;
        setActiveHighlight(ev);
        setGoalImpactActive(false);

        const isGoalEv = ev.type === 'GOAL';
        const impactDelayMs = isGoalEv ? 2200 : 1800;
        const totalDurationMs = isGoalEv ? 6000 : 5400;
        setHighlightCountdown(0);

        // Clear any leftover highlight timers before scheduling new ones
        highlightTimersRef.current.forEach(t => clearTimeout(t));
        highlightTimersRef.current = [];

        // Reveal player card, commentary, completed log, stats & score ONLY after action happens on pitch
        const impactTimer = setTimeout(() => {
          setGoalImpactActive(true);
          setCompletedEvents(prev => [ev, ...prev]);
          if (isGoalEv) {
            isPausedRef.current = true;
            setHighlightCountdown(4);
            for (let s = 1; s < 4; s++) {
              const tickTimer = setTimeout(() => {
                setHighlightCountdown(Math.max(1, 4 - s));
              }, s * 1000);
              highlightTimersRef.current.push(tickTimer);
            }
            if (ev.team === 1) setLiveScore1(ev.scoreAfter.s1);
            if (ev.team === 2) setLiveScore2(ev.scoreAfter.s2);
            sounds.playFanfare();
          } else if (ev.type === 'SAVE' || ev.type === 'PENALTY_SAVED' || ev.type === 'WOODWORK') {
            sounds.playGavel();
          } else {
            sounds.playTick();
          }
        }, impactDelayMs);
        highlightTimersRef.current.push(impactTimer);

        // Clear highlight and (if GOAL) resume match clock after celebration, center reset & >1s kickoff hold
        const endTimer = setTimeout(() => {
          if (isGoalEv) {
            sounds.playWhistle();
            isPausedRef.current = false;
          }
          setHighlightCountdown(0);
          setGoalImpactActive(false);
          setActiveHighlight(null);
        }, totalDurationMs);
        highlightTimersRef.current.push(endTimer);

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
    }, tickMs);

    return () => clearInterval(interval);
  }, [matchPhase, eventsTimeline, simSpeed, isHalfTime]);

  // 5. Penalty Shootout Engine (If 90' Ends In A Draw)
  const startPenaltyShootout = (s1, s2) => {
    setMatchPhase('penalty');

    const kicks = preGeneratedPenalties || buildPenaltyKicks();

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
  const p1Power = t1.avgOvr * 0.65 + t1.chem * 0.35;
  const p2Power = t2.avgOvr * 0.65 + t2.chem * 0.35;
  const powerPossOffset = (p1Power - p2Power) * 0.75;
  const eventMomentum = (evT1.length - evT2.length) * 1.4;
  const liveWave = matchPhase === 'playing'
    ? Math.sin(currentMinute * 0.42) * 5.5 + Math.cos(currentMinute * 0.21) * 3.5
    : 0;
  const highlightBoost = 0;
  const possRamp = (matchPhase === 'finished' || matchPhase === 'penalty')
    ? 1
    : currentMinute <= 0
    ? 0
    : Math.min(1, currentMinute / 6);
  const poss1 = possRamp === 0
    ? 50
    : Math.min(72, Math.max(28, Math.round(50 + (powerPossOffset + eventMomentum + liveWave + highlightBoost) * possRamp)));
  const poss2 = 100 - poss1;
  const shots1 = evT1.filter(e => e.type === 'GOAL' || e.type === 'WOODWORK' || e.type === 'ASSIST').length + evT2.filter(e => e.type === 'PENALTY_SAVED').length + (matchPhase === 'lobby' ? 0 : Math.floor(currentMinute / 22));
  const shots2 = evT2.filter(e => e.type === 'GOAL' || e.type === 'WOODWORK' || e.type === 'ASSIST').length + evT1.filter(e => e.type === 'PENALTY_SAVED').length + (matchPhase === 'lobby' ? 0 : Math.floor(currentMinute / 22));
  const saves1 = evT1.filter(e => e.type === 'SAVE' || e.type === 'DEFENSE' || e.type === 'PENALTY_SAVED').length;
  const saves2 = evT2.filter(e => e.type === 'SAVE' || e.type === 'DEFENSE' || e.type === 'PENALTY_SAVED').length;
  const cards1 = evT1.filter(e => e.type === 'CARD' || e.type === 'RED_CARD').length;
  const cards2 = evT2.filter(e => e.type === 'CARD' || e.type === 'RED_CARD').length;

  const goalsT1 = completedEvents.filter(e => e.team === 1 && e.type === 'GOAL').slice().reverse();
  const goalsT2 = completedEvents.filter(e => e.team === 2 && e.type === 'GOAL').slice().reverse();

  const EVENT_LABELS = {
    GOAL: 'BÀN THẮNG',
    ASSIST: 'KIẾN TẠO',
    THROW_IN: 'NÉM BIÊN',
    CORNER: 'PHẠT GÓC',
    SAVE: 'CỨU THUA',
    PENALTY_SAVED: 'CẢN PHÁ 11M',
    DEFENSE: 'CẢN PHÁ',
    WOODWORK: 'CỘT DỌC',
    CARD: 'THẺ VÀNG',
    RED_CARD: 'THẺ ĐỎ',
    PENALTY: 'LUÂN LƯU 11M',
  };

  const HIGHLIGHT_KEYWORDS_REGEX = /(góc chữ A|góc chết|góc cao|góc xa|góc gần|góc cực hẹp|tung lưới|tung nóc lưới|không thể cản phá|siêu phẩm|cứu thua|cản phá|phản xạ|trên vạch vôi|cứu bàn thua mười mươi|xà ngang|cột dọc|khung gỗ|thẻ vàng|thẻ đỏ|truất quyền thi đấu|chấm phạt đền 11m|chấm phạt đền|chấm 11m|phạt đền 11m|phạt đền|penalty|Panenka|đánh lừa thủ môn|vô-lê|tiki-taka|trivela|xe đạp chổng ngược|cứa lòng|sút xa|đánh đầu|xoạc bóng|chọc khe|đối mặt|bàn thắng|cận thành|ngăn cản bàn thắng|đánh bại|ném biên|đường biên dọc|phạt góc|cột cờ góc)/gi;

  const renderHighlightedText = (text) => {
    if (!text) return null;
    const colonIdx = text.indexOf(':');
    const titlePart = colonIdx !== -1 ? text.slice(0, colonIdx + 1) : '';
    const bodyPart = colonIdx !== -1 ? text.slice(colonIdx + 1) : text;

    const parts = bodyPart.split(HIGHLIGHT_KEYWORDS_REGEX);
    return (
      <>
        {titlePart && (
          <span className="text-amber-300 font-extrabold drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]">
            {titlePart}
          </span>
        )}
        {parts.map((part, idx) =>
          idx % 2 === 1 ? (
            <span
              key={idx}
              className="text-amber-300 font-bold drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]"
            >
              {part}
            </span>
          ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
          )
        )}
      </>
    );
  };

  // Perspective mapping: each online player always sees themselves on the LEFT in GREEN ("Bạn")
  const isGuestView = onlineState.isConnected && onlineState.role === 'guest';
  const formatMatchName = (mgr, isSelf) => {
    if (!onlineState.isConnected || !mgr) return mgr?.name || '';
    const baseName = mgr.name
      .replace(/\s*\(Bạn\)\s*$/i, '')
      .replace(/\s*\(Đối thủ\)\s*$/i, '')
      .trim();
    return `${baseName} (${isSelf ? 'Bạn' : 'Đối thủ'})`;
  };

  const leftTeamNum = isGuestView ? 2 : 1;
  const rightTeamNum = isGuestView ? 1 : 2;
  const leftName = isGuestView ? formatMatchName(player2, true) : formatMatchName(player1, true);
  const rightName = isGuestView ? formatMatchName(player1, false) : formatMatchName(player2, false);
  const leftTeam = isGuestView ? t2 : t1;
  const rightTeam = isGuestView ? t1 : t2;
  const leftScore = isGuestView ? liveScore2 : liveScore1;
  const rightScore = isGuestView ? liveScore1 : liveScore2;
  const leftPen = isGuestView ? penScore2 : penScore1;
  const rightPen = isGuestView ? penScore1 : penScore2;
  const leftPoss = isGuestView ? poss2 : poss1;
  const rightPoss = isGuestView ? poss1 : poss2;
  const leftShots = isGuestView ? shots2 : shots1;
  const rightShots = isGuestView ? shots1 : shots2;
  const leftSaves = isGuestView ? saves2 : saves1;
  const rightSaves = isGuestView ? saves1 : saves2;
  const leftCards = isGuestView ? cards2 : cards1;
  const rightCards = isGuestView ? cards1 : cards2;
  const leftGoals = isGuestView ? goalsT2 : goalsT1;
  const rightGoals = isGuestView ? goalsT1 : goalsT2;
  const leftReady = isGuestView ? p2Ready : p1Ready;
  const rightReady = isGuestView ? p1Ready : p2Ready;
  const onLeftReady = isGuestView ? handleToggleP2Ready : handleToggleP1Ready;
  const onRightReady = isGuestView ? handleToggleP1Ready : handleToggleP2Ready;
  const winnerDisplayName = winner
    ? (winner.id === (isGuestView ? player2.id : player1.id) ? leftName : rightName)
    : '';

  const scoreLead =
    leftScore !== rightScore
      ? (leftScore > rightScore ? 'left' : 'right')
      : (leftPen !== null && rightPen !== null && leftPen !== rightPen)
      ? (leftPen > rightPen ? 'left' : 'right')
      : 'tie';

  const renderHalfGlow = (lead, strong = false) => (
    <>
      <div
        className={`absolute inset-y-0 left-0 w-1/2 pointer-events-none transition-opacity duration-500 bg-gradient-to-r ${
          strong ? 'from-emerald-500/35 via-emerald-500/15 to-transparent' : 'from-emerald-500/30 via-emerald-500/12 to-transparent'
        } ${lead === 'left' ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute inset-y-0 right-0 w-1/2 pointer-events-none transition-opacity duration-500 bg-gradient-to-l ${
          strong ? 'from-rose-500/35 via-rose-500/15 to-transparent' : 'from-rose-500/30 via-rose-500/12 to-transparent'
        } ${lead === 'right' ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );

  const possLead = leftPoss > rightPoss ? 'left' : rightPoss > leftPoss ? 'right' : 'tie';
  const shotsLead = leftShots > rightShots ? 'left' : rightShots > leftShots ? 'right' : 'tie';
  const savesLead = leftSaves > rightSaves ? 'left' : rightSaves > leftSaves ? 'right' : 'tie';
  const cardsLead = leftCards > rightCards ? 'left' : rightCards > leftCards ? 'right' : 'tie';

  return (
    <div className="broadcast-panel border border-slate-800 rounded-xl p-4 max-w-[1660px] mx-auto w-full">
      {/* Compact Broadcast Scoreboard */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-4 py-2.5 mb-3 relative overflow-hidden">
        {renderHalfGlow(scoreLead, true)}
        {goalImpactActive && activeHighlight?.type === 'GOAL' && activeHighlight?.team === leftTeamNum && (
          <div
            key={`sb-gold-left-${activeHighlight.min}`}
            className="absolute inset-y-0 left-0 w-1/2 overflow-hidden pointer-events-none z-20"
          >
            <div className="goal-gold-sweep" />
          </div>
        )}
        {goalImpactActive && activeHighlight?.type === 'GOAL' && activeHighlight?.team === rightTeamNum && (
          <div
            key={`sb-gold-right-${activeHighlight.min}`}
            className="absolute inset-y-0 right-0 w-1/2 overflow-hidden pointer-events-none z-20"
          >
            <div className="goal-gold-sweep" />
          </div>
        )}

        <div className="grid grid-cols-12 items-center gap-2 relative z-10">
          {/* Team Left (Self - Emerald) */}
          <div className="col-span-4 flex items-center gap-2.5">
            <span className="w-1.5 h-9 bg-emerald-400 rounded-sm shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-lg md:text-xl font-extrabold text-emerald-400 tracking-wide uppercase truncate leading-none">
                {leftName}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono-num text-slate-400">
                <span>OVR <strong className="text-amber-400">{leftTeam.avgOvr}</strong></span>
                <span className="text-slate-700">|</span>
                <span>CHEM <strong className="text-cyan-400">{leftTeam.chem}</strong></span>
              </div>
            </div>
          </div>

          {/* Center Clock & Score */}
          <div className="col-span-4 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-slate-900 border border-slate-800 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${matchPhase === 'playing' ? (activeHighlight || isHalfTime ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-500'}`} />
              <span className="font-mono-num text-[11px] font-bold tracking-wider text-slate-200 uppercase">
                {matchPhase === 'lobby' ? 'FINAL · READY CHECK' :
                 matchPhase === 'countdown' ? `KICKOFF IN ${countdown}` :
                 matchPhase === 'penalty' ? 'PENALTY SHOOTOUT' :
                 matchPhase === 'finished' ? 'FULL TIME · 90\'' :
                 isHalfTime ? 'NGHỈ GIỮA HIỆP · 45\' (3s)' :
                 goalImpactActive && activeHighlight?.type === 'GOAL' ? `${currentMinute <= 45 ? 'HIỆP 1' : 'HIỆP 2'} · PHÚT ${currentMinute}' · ⚽ VÀOOO! (${highlightCountdown}s)` :
                 `${currentMinute <= 45 ? 'HIỆP 1' : 'HIỆP 2'} · PHÚT ${currentMinute}'`}
              </span>
            </div>

            <div className="font-mono-num text-4xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3 leading-none">
              <span className={goalImpactActive && activeHighlight?.team === leftTeamNum && activeHighlight?.type === 'GOAL' ? 'text-emerald-400' : 'text-white'}>
                {leftScore}
              </span>
              <span className="text-slate-600 text-2xl font-normal">-</span>
              <span className={goalImpactActive && activeHighlight?.team === rightTeamNum && activeHighlight?.type === 'GOAL' ? 'text-rose-400' : 'text-white'}>
                {rightScore}
              </span>
            </div>

            {leftPen !== null && rightPen !== null && (
              <span className="font-mono-num text-[11px] font-bold text-amber-400 mt-1">
                PEN: {leftPen} - {rightPen}
              </span>
            )}

            <div className="w-full max-w-[200px] bg-slate-900 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 h-full transition-all duration-75"
                style={{ width: `${Math.min(100, (currentMinute / 90) * 100)}%` }}
              />
            </div>
          </div>

          {/* Team Right (Opponent - Red) */}
          <div className="col-span-4 flex items-center justify-end gap-2.5 text-right">
            <div className="min-w-0">
              <h3 className="font-display text-lg md:text-xl font-extrabold text-rose-400 tracking-wide uppercase truncate leading-none">
                {rightName}
              </h3>
              <div className="flex items-center justify-end gap-2 mt-1 text-[11px] font-mono-num text-slate-400">
                <span>OVR <strong className="text-amber-400">{rightTeam.avgOvr}</strong></span>
                <span className="text-slate-700">|</span>
                <span>CHEM <strong className="text-cyan-400">{rightTeam.chem}</strong></span>
              </div>
            </div>
            <span className="w-1.5 h-9 bg-rose-500 rounded-sm shrink-0" />
          </div>
        </div>
      </div>

      {/* LIVE MATCH STATS STRIP */}
      {matchPhase !== 'lobby' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 relative overflow-hidden">
            {renderHalfGlow(possLead)}
            <div className="flex items-center justify-between font-mono-num text-xs font-bold mb-1 relative z-10">
              <span className="text-emerald-400">{leftPoss}%</span>
              <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider">Kiểm soát bóng</span>
              <span className="text-rose-400">{rightPoss}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex relative z-10">
              <div className="bg-emerald-400 h-full transition-all duration-300" style={{ width: `${leftPoss}%` }} />
              <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${rightPoss}%` }} />
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold relative overflow-hidden">
            {renderHalfGlow(shotsLead)}
            <span className="text-emerald-400 text-sm relative z-10">{leftShots}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider relative z-10">Cơ hội / Dứt điểm</span>
            <span className="text-rose-400 text-sm relative z-10">{rightShots}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold relative overflow-hidden">
            {renderHalfGlow(savesLead)}
            <span className="text-emerald-400 text-sm relative z-10">{leftSaves}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider relative z-10">Cứu thua & Cản phá</span>
            <span className="text-rose-400 text-sm relative z-10">{rightSaves}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between font-mono-num text-xs font-bold relative overflow-hidden">
            {renderHalfGlow(cardsLead)}
            <span className="text-emerald-400 text-sm relative z-10">{leftCards}</span>
            <span className="font-display text-[10px] text-slate-400 uppercase tracking-wider relative z-10">Thẻ phạt</span>
            <span className="text-rose-400 text-sm relative z-10">{rightCards}</span>
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
              leftReady ? 'bg-emerald-950/35 border-emerald-400' : 'bg-slate-900/80 border-emerald-500/35'
            }`}>
              <h4 className="font-display text-xl font-extrabold text-emerald-400 uppercase">{leftName}</h4>
              <p className="font-mono-num text-xs text-slate-400 mb-3">OVR {leftTeam.avgOvr} · CHEM {leftTeam.chem}</p>
              <button
                onClick={onLeftReady}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                  leftReady ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {leftReady ? 'ĐÃ SẴN SÀNG' : 'SẴN SÀNG'}
              </button>
            </div>

            <div className={`p-4 rounded-lg border-2 transition-colors ${
              rightReady ? 'bg-rose-950/35 border-rose-500' : 'bg-slate-900/80 border-rose-500/60'
            }`}>
              <h4 className="font-display text-xl font-extrabold text-rose-400 uppercase">{rightName}</h4>
              <p className="font-mono-num text-xs text-slate-400 mb-3">OVR {rightTeam.avgOvr} · CHEM {rightTeam.chem}</p>
              <button
                onClick={onRightReady}
                disabled={onlineState.isConnected}
                className={`w-full py-2.5 px-4 rounded font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                  rightReady ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                } ${onlineState.isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {rightReady ? (isP2Bot ? 'BOT ĐÃ SẴN SÀNG' : 'ĐÃ SẴN SÀNG') : 'SẴN SÀNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 5: FINISHED CELEBRATION (Full Width Above Pitch/Timeline) */}
      {matchPhase === 'finished' && winner && (
        <div className="mb-3 p-4 rounded-lg bg-gradient-to-r from-amber-950/45 via-slate-900 to-amber-950/45 border border-amber-500/70">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 font-display text-2xl md:text-3xl font-extrabold text-amber-300 uppercase tracking-wide">
              <Trophy className="w-6 h-6 text-amber-400" />
              CHÚC MỪNG {winnerDisplayName} VÔ ĐỊCH SIÊU CÚP 1V1
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3 text-xs">
            <div className="bg-slate-950/75 border border-emerald-500/30 rounded px-3 py-2 flex items-center justify-between gap-2">
              <span className="font-display font-bold text-emerald-400 uppercase shrink-0">Ghi bàn ({leftName})</span>
              <span className="text-slate-200 font-medium text-right">
                {leftGoals.length > 0 ? leftGoals.map(g => `${g.player?.name} (${g.min}')`).join(', ') : 'Không có bàn thắng'}
              </span>
            </div>
            <div className="bg-slate-950/75 border border-rose-500/40 rounded px-3 py-2 flex items-center justify-between gap-2">
              <span className="font-display font-bold text-rose-400 uppercase shrink-0">Ghi bàn ({rightName})</span>
              <span className="text-slate-200 font-medium text-right">
                {rightGoals.length > 0 ? rightGoals.map(g => `${g.player?.name} (${g.min}')`).join(', ') : 'Không có bàn thắng'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
            {mvp && (
              <div className="inline-flex items-center gap-3.5 bg-gradient-to-r from-amber-950/75 via-slate-950/95 to-amber-950/60 border-2 border-amber-400/80 rounded-xl px-4 py-2.5 text-left shadow-[0_0_22px_rgba(251,191,36,0.28)]">
                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-amber-400 bg-slate-800 shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
                  {mvp.photo ? (
                    <img src={mvp.photo} alt={mvp.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display text-xl font-extrabold text-amber-300">
                      {mvp.ovr}
                    </div>
                  )}
                </div>
                <div>
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-slate-950 bg-amber-400 px-2 py-0.5 rounded-sm mb-1">
                    ★ MAN OF THE MATCH · MVP
                  </span>
                  <div className="font-display text-base md:text-lg font-extrabold text-white uppercase tracking-wide leading-tight">
                    {mvp.name} · <span className="text-amber-300 font-mono-num">{mvp.ovr} OVR</span>
                  </div>
                  <div className="text-xs text-slate-300 font-semibold mt-0.5">
                    {mvp.subPos || mvp.position} · {mvp.club}
                  </div>
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

      {/* WIDE 2-COLUMN BROADCAST MATCH STAGE */}
      {matchPhase !== 'lobby' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
          {/* LEFT COLUMN: SPACIOUS 2D/2.5D PITCH */}
          <div className="xl:col-span-7 2xl:col-span-8 flex">
            <MatchPitch2D
              leftSquad={isGuestView ? (player2.squad || {}) : (player1.squad || {})}
              rightSquad={isGuestView ? (player1.squad || {}) : (player2.squad || {})}
              leftTeamNum={leftTeamNum}
              rightTeamNum={rightTeamNum}
              leftName={leftName}
              rightName={rightName}
              currentMinute={currentMinute}
              matchPhase={matchPhase}
              leftPoss={leftPoss}
              activeHighlight={activeHighlight}
              eventsTimeline={eventsTimeline}
              penaltyKick={matchPhase === 'penalty' && currentPenIndex >= 0 ? penaltyKicks[currentPenIndex] : null}
              isHalfTime={isHalfTime}
              simSpeed={simSpeed}
              onToggleSpeed={() => setSimSpeed(s => (s === 1 ? 2 : 1))}
            />
          </div>

          {/* RIGHT COLUMN: ACTIVE HIGHLIGHT + MATCH TIMELINE */}
          <div className="xl:col-span-5 2xl:col-span-4 flex flex-col gap-3">
            {/* STAGE 2: PRE-MATCH COUNTDOWN */}
            {matchPhase === 'countdown' && (
              <div className="h-[240px] flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-lg">
                <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-2">
                  TRẬN ĐẤU SẮP BẮT ĐẦU
                </span>
                <div className="font-mono-num text-7xl font-extrabold text-white">
                  {countdown}
                </div>
              </div>
            )}

            {/* STAGE 3: SINGLE FULL-WIDTH TEAM-COLORED EVENT STAGE */}
            {matchPhase === 'playing' && (() => {
              const revealedHighlight = goalImpactActive ? activeHighlight : null;
              const isSelfHighlight = revealedHighlight?.team === leftTeamNum;
              const isOppHighlight = revealedHighlight?.team === rightTeamNum;
              const isGoalHighlight = revealedHighlight?.type === 'GOAL';

              const containerTheme = revealedHighlight
                ? isSelfHighlight
                  ? isGoalHighlight
                    ? 'bg-emerald-950/40 border-2 border-emerald-400 ring-2 ring-amber-400/70 goal-gold-frame'
                    : 'bg-emerald-950/35 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : isGoalHighlight
                  ? 'bg-rose-950/40 border-2 border-rose-500 ring-2 ring-amber-400/70 goal-gold-frame'
                  : 'bg-rose-950/35 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                : activeHighlight
                ? 'bg-slate-950/90 border-2 border-amber-400/55 shadow-[0_0_18px_rgba(251,191,36,0.12)]'
                : leftPoss >= 50
                ? 'bg-slate-950/80 border-2 border-emerald-500/35'
                : 'bg-slate-950/80 border-2 border-rose-500/35';

              return (
                <div className={`min-h-[235px] rounded-xl p-4 flex flex-col justify-between transition-colors duration-200 relative overflow-hidden ${containerTheme}`}>
                  {isGoalHighlight && (
                    <div key={`goal-sweep-${revealedHighlight.min}-${revealedHighlight.team}`} className="goal-gold-sweep" />
                  )}

                  {revealedHighlight ? (
                    <>
                      <div className="flex items-center gap-3.5 relative z-10">
                        {/* Player Photo */}
                        <div className={`w-20 h-20 rounded-lg overflow-hidden border-2 bg-slate-800 shrink-0 ${
                          isSelfHighlight ? 'border-emerald-400' : 'border-rose-400'
                        }`}>
                          {revealedHighlight.player.photo ? (
                            <img
                              src={revealedHighlight.player.photo}
                              alt={revealedHighlight.player.name}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center font-display text-2xl font-extrabold ${
                              isSelfHighlight ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {revealedHighlight.player.ovr}
                            </div>
                          )}
                        </div>

                        {/* Player Meta & Event Tag */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`inline-block font-display text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${revealedHighlight.badgeClass}`}>
                              {revealedHighlight.badgeText}
                            </span>
                            <span className={`text-[11px] font-display font-extrabold uppercase tracking-wider ${
                              isSelfHighlight ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              · {isSelfHighlight ? leftName : rightName}
                            </span>
                          </div>
                          <h4 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide truncate leading-none">
                            {revealedHighlight.player.name}
                          </h4>
                          <div className="text-[11px] text-slate-300 font-semibold mt-1 uppercase tracking-wider">
                            <span className="text-amber-400 font-mono-num font-bold">{revealedHighlight.player.ovr} OVR</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className={`font-bold ${isSelfHighlight ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {revealedHighlight.player.subPos || revealedHighlight.player.position}
                            </span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="text-slate-400">{revealedHighlight.player.club}</span>
                          </div>
                        </div>
                      </div>

                      {/* Full-Width Commentary Box */}
                      <div className={`mt-3 bg-slate-900/90 border rounded-lg p-3 text-xs md:text-sm leading-relaxed flex-1 flex flex-col justify-center gap-1 relative z-10 ${
                        isSelfHighlight ? 'border-emerald-500/35 text-emerald-100' : 'border-rose-500/40 text-rose-100'
                      }`}>
                        <span>{renderHighlightedText(revealedHighlight.desc)}</span>
                        {revealedHighlight.type === 'GOAL' && revealedHighlight.assistPlayer && (
                          <span className="text-xs font-bold text-cyan-300">
                            Kiến tạo: {revealedHighlight.assistPlayer.name} ({revealedHighlight.assistPlayer.subPos || revealedHighlight.assistPlayer.position})
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6">
                      <div className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-widest mb-1.5">
                        <span className="text-emerald-400">{leftName}</span>
                        <span className="text-slate-600">vs</span>
                        <span className="text-rose-400">{rightName}</span>
                      </div>
                      <div className="font-mono-num text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                        {isHalfTime
                          ? 'NGHỈ GIỮA HIỆP · 45\''
                          : activeHighlight
                          ? `⚡ ĐANG TRIỂN KHAI TÌNH HUỐNG · PHÚT ${currentMinute}'`
                          : `${currentMinute <= 45 ? 'HIỆP 1' : 'HIỆP 2'} · PHÚT ${currentMinute}'`}
                      </div>
                      <p className="text-xs text-slate-400 max-w-md">
                        {isHalfTime
                          ? 'Hai đội tạm nghỉ giữa hiệp trước khi bước vào 45 phút hiệp 2.'
                          : activeHighlight
                          ? 'Cầu thủ đang phối hợp áp sát trên sân, chờ xem kết quả pha bóng...'
                          : leftPoss >= 50
                          ? `${leftName} đang kiểm soát thế trận (${leftPoss}%) và tổ chức phối hợp tìm cơ hội dứt điểm...`
                          : `${rightName} đang cầm nhịp (${rightPoss}%) và đẩy cao đội hình gây sức ép...`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* STAGE 4: PENALTY SHOOTOUT */}
            {matchPhase === 'penalty' && (
              <div className="bg-slate-950/85 border border-amber-500/40 rounded-lg p-3.5 text-center md:h-[245px] flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-400">
              LOẠT SÚT LUÂN LƯU 11M (HÒA {leftScore}-{rightScore})
            </span>
            <span className="font-mono-num text-sm font-extrabold px-2.5 py-0.5 rounded bg-slate-900 border border-amber-500/50 text-white">
              PEN: <span className="text-emerald-400">{leftPen}</span> - <span className="text-rose-400">{rightPen}</span>
            </span>
          </div>

          {/* Penalty Shootout Round-by-Round Tracker */}
          <div className="grid grid-cols-2 gap-3 my-1.5">
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded px-3 py-1.5 flex items-center justify-between gap-2">
              <span className="font-display text-xs font-extrabold text-emerald-400 uppercase truncate">{leftName}</span>
              <div className="flex items-center gap-1.5">
                {penaltyKicks.filter(k => k.team === leftTeamNum).map((k, i) => {
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
                {penaltyKicks.filter(k => k.team === rightTeamNum).map((k, i) => {
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
              <span className="font-display text-xs font-extrabold text-rose-400 uppercase truncate">{rightName}</span>
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
                      Lượt {penaltyKicks[currentPenIndex].round} · {penaltyKicks[currentPenIndex].team === leftTeamNum ? leftName : rightName}
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

            {/* ALWAYS-VISIBLE DETAILED MATCH TIMELINE */}
            <div className="bg-slate-950/85 rounded-lg p-3.5 border border-slate-800 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-display text-xs font-bold text-slate-300 uppercase tracking-widest">
                  MATCH TIMELINE · DIỄN BIẾN CHI TIẾT TRẬN ĐẤU
                </span>
                <span className="font-mono-num text-[11px] text-slate-400">
                  {completedEvents.length} tình huống
                </span>
              </div>

              <div className="space-y-2 flex-1 min-h-[220px] max-h-[280px] overflow-y-auto pr-1">
            {completedEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Trận đấu đang diễn ra — Các tình huống đáng chú ý sẽ cập nhật trực tiếp tại đây...
              </div>
            ) : (
              completedEvents.map((ev, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded text-xs flex items-start gap-2.5 border ${
                    ev.team === leftTeamNum
                      ? 'bg-emerald-950/25 text-emerald-100 border-emerald-500/35'
                      : 'bg-rose-950/25 text-rose-100 border-rose-500/45'
                  }`}
                >
                  <span className="px-1.5 py-0.5 rounded-sm font-mono-num font-bold text-[11px] bg-slate-900 text-amber-400 border border-slate-800 shrink-0 mt-0.5">
                    {typeof ev.min === 'number' ? `${ev.min}'` : ev.min}
                  </span>
                  <span className={`font-display text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 mt-0.5 ${
                    ev.type === 'GOAL' ? 'bg-amber-400 text-slate-950' :
                    ev.type === 'PENALTY_SAVED' ? 'bg-amber-400 text-slate-950' :
                    ev.type === 'RED_CARD' ? 'bg-rose-600 text-white' :
                    ev.type === 'CARD' ? 'bg-yellow-400 text-slate-950' :
                    ev.type === 'PENALTY' ? 'bg-cyan-500 text-slate-950' :
                    'bg-slate-800 text-slate-200'
                  }`}>
                    {ev.isPenalty ? 'PENALTY 11M' : (EVENT_LABELS[ev.type] || ev.type)}
                  </span>
                  <div className="min-w-0 flex-1 leading-snug">
                    <span className="font-bold text-white">{ev.player?.name}</span>
                    {ev.player?.position && (
                      <span className="ml-1.5 font-mono-num text-[10px] text-slate-400">
                        ({ev.player.subPos || ev.player.position})
                      </span>
                    )}
                    <span className="mx-1.5 text-slate-500">—</span>
                    <span className="text-slate-300">{renderHighlightedText(ev.desc)}</span>
                    {ev.type === 'GOAL' && ev.assistPlayer && (
                      <div className="text-[11px] font-semibold text-cyan-300 mt-0.5">
                        Kiến tạo: {ev.assistPlayer.name} ({ev.assistPlayer.subPos || ev.assistPlayer.position})
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
          </div>
        </div>
      )}
    </div>
  );
}
