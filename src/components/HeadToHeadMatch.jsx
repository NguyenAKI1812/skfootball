import React, { useState } from 'react';
import { Trophy, Play, RotateCcw, Flame, Shield, Award, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/sound';

export default function HeadToHeadMatch({ player1, player2, onRestart }) {
  const [matchState, setMatchState] = useState('preview'); // 'preview', 'playing', 'finished'
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [penScore1, setPenScore1] = useState(null);
  const [penScore2, setPenScore2] = useState(null);
  const [matchEvents, setMatchEvents] = useState([]);
  const [winner, setWinner] = useState(null);

  // Helper: compute team OVR & Chemistry
  const calcTeamInfo = (manager) => {
    const squadList = Object.values(manager.squad).filter(Boolean);
    const avgOvr = squadList.length > 0 
      ? Math.round(squadList.reduce((acc, p) => acc + p.ovr, 0) / squadList.length) 
      : 75;

    // Chemistry
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

    return { squadList, avgOvr, chem };
  };

  const t1 = calcTeamInfo(player1);
  const t2 = calcTeamInfo(player2);

  const startMatch = () => {
    sounds.playWhistle();
    setMatchState('playing');

    // Simulate match based on OVR + Chem
    const power1 = t1.avgOvr * 0.7 + t1.chem * 0.3;
    const power2 = t2.avgOvr * 0.7 + t2.chem * 0.3;
    const powerDiff = (power1 - power2) * 0.12;

    let g1 = Math.max(0, Math.round(Math.random() * 3 + powerDiff + (Math.random() > 0.4 ? 1 : 0)));
    let g2 = Math.max(0, Math.round(Math.random() * 3 - powerDiff + (Math.random() > 0.4 ? 1 : 0)));

    const events = [];

    // Generate goal events
    const fw1 = t1.squadList.filter(p => p.position === 'FW' || p.position === 'MF');
    const fw2 = t2.squadList.filter(p => p.position === 'FW' || p.position === 'MF');

    for (let i = 0; i < g1; i++) {
      const min = Math.floor(Math.random() * 85) + 5;
      const scorer = fw1[Math.floor(Math.random() * fw1.length)]?.name || player1.name;
      events.push({ min, text: `⚽ Phút ${min}': [${player1.name}] ${scorer} sút tung nóc lưới đối phương!`, team: 1 });
    }

    for (let i = 0; i < g2; i++) {
      const min = Math.floor(Math.random() * 85) + 5;
      const scorer = fw2[Math.floor(Math.random() * fw2.length)]?.name || player2.name;
      events.push({ min, text: `⚽ Phút ${min}': [${player2.name}] ${scorer} dứt điểm đẳng cấp gỡ điểm!`, team: 2 });
    }

    // Add extra tactical highlight events
    events.push({ min: 18, text: `🧤 Phút 18': Pha bay người cứu thua ngoạn mục của thủ môn!`, team: 0 });
    events.push({ min: 65, text: `🛡️ Phút 65': Hàng phòng ngự bọc lót lăn xả giải nguy kịp thời.`, team: 0 });

    events.sort((a, b) => a.min - b.min);

    let finalWinner = null;
    let pScore1 = null;
    let pScore2 = null;

    if (g1 > g2) {
      finalWinner = player1;
    } else if (g2 > g1) {
      finalWinner = player2;
    } else {
      // Penalty Shootout
      pScore1 = Math.floor(Math.random() * 3) + 3;
      pScore2 = pScore1 === 5 ? 4 : 5;
      finalWinner = pScore1 > pScore2 ? player1 : player2;
      events.push({ 
        min: 120, 
        text: `🎯 LOẠT LUÂN LƯU 11M NGHẸT THỞ: [${player1.name}] ${pScore1} - ${pScore2} [${player2.name}]!`, 
        team: 0 
      });
    }

    setTimeout(() => {
      setScore1(g1);
      setScore2(g2);
      setPenScore1(pScore1);
      setPenScore2(pScore2);
      setMatchEvents(events);
      setWinner(finalWinner);
      setMatchState('finished');
      sounds.playFanfare();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
    }, 1200);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="text-center mb-6">
        <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-4 py-1.5 rounded-full border border-amber-500/40">
          CHUNG KẾT SIÊU KINH ĐIỂN 1V1
        </span>
        <h2 className="text-3xl font-black text-white mt-2 flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-amber-400" />
          {player1.name} VS {player2.name}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Cả 2 HLV đã hoàn thành đấu giá 11 cầu thủ xuất phát. Hãy xem ai là nhà vô địch!
        </p>
      </div>

      {/* Head to Head Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/80 border border-slate-800 rounded-3xl p-6 my-4 shadow-xl">
        {/* Player 1 Summary */}
        <div className="md:col-span-5 text-center flex flex-col items-center">
          <div className="text-4xl mb-1">{player1.avatar}</div>
          <h3 className="text-xl font-black text-emerald-400 uppercase tracking-wide">
            {player1.name}
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              OVR: <strong className="text-amber-400">{t1.avgOvr}</strong>
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              CHEM: <strong className="text-cyan-400">{t1.chem}</strong>
            </span>
          </div>
        </div>

        {/* Big Score in Center */}
        <div className="md:col-span-2 text-center my-4 md:my-0">
          {matchState === 'finished' ? (
            <div className="flex flex-col items-center">
              <div className="text-5xl font-black font-mono text-amber-400 tracking-tight">
                {score1} - {score2}
              </div>
              {penScore1 !== null && (
                <span className="text-xs font-bold text-red-400 mt-1">
                  (Pen: {penScore1} - {penScore2})
                </span>
              )}
            </div>
          ) : matchState === 'playing' ? (
            <div className="text-sm font-black text-amber-400 animate-pulse uppercase tracking-wider">
              Đang thi đấu...
            </div>
          ) : (
            <div className="text-3xl font-black font-mono text-slate-600">
              VS
            </div>
          )}
        </div>

        {/* Player 2 Summary */}
        <div className="md:col-span-5 text-center flex flex-col items-center">
          <div className="text-4xl mb-1">{player2.avatar}</div>
          <h3 className="text-xl font-black text-purple-400 uppercase tracking-wide">
            {player2.name}
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              OVR: <strong className="text-amber-400">{t2.avgOvr}</strong>
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              CHEM: <strong className="text-cyan-400">{t2.chem}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Winner Announcement Banner */}
      {matchState === 'finished' && winner && (
        <div className="my-5 p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60 border-2 border-amber-500/70 text-center shadow-2xl animate-in zoom-in duration-300">
          <div className="inline-flex items-center gap-2 text-2xl font-black text-amber-300">
            <Trophy className="w-8 h-8 text-amber-400" />
            CHÚC MỪNG {winner.name.toUpperCase()} ĐÃ ĐOẠT CÚP VÔ ĐỊCH!
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Đội hình xuất sắc với sự kết hợp đỉnh cao giữa các huyền thoại và chiến thuật thi đấu thông minh!
          </p>
        </div>
      )}

      {/* Live Match Commentary Log */}
      {matchEvents.length > 0 && (
        <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 my-4 max-h-48 overflow-y-auto space-y-2 text-xs font-mono">
          <div className="text-slate-400 font-bold uppercase tracking-wider mb-2">
            DIỄN BIẾN TRẬN CHUNG KẾT:
          </div>
          {matchEvents.map((ev, idx) => (
            <div 
              key={idx} 
              className={`p-2 rounded-lg ${
                ev.team === 1 
                  ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500' 
                  : ev.team === 2 
                  ? 'bg-purple-950/40 text-purple-300 border-l-2 border-purple-500' 
                  : 'bg-slate-900/60 text-slate-400'
              }`}
            >
              {ev.text}
            </div>
          ))}
        </div>
      )}

      {/* Action Controls */}
      <div className="flex justify-center gap-4 mt-6">
        {matchState === 'preview' && (
          <button
            onClick={startMatch}
            className="py-3.5 px-10 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-2xl flex items-center gap-2 transform hover:scale-105 transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            Bắt Đầu Trận Chung Kết 90 Phút!
          </button>
        )}

        {matchState === 'finished' && (
          <button
            onClick={onRestart}
            className="py-3.5 px-8 rounded-2xl font-black text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Tổ Chức Giải Đấu Mới
          </button>
        )}
      </div>
    </div>
  );
}
