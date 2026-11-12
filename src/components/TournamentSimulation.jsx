import React, { useState, useEffect } from 'react';
import { Trophy, Play, RotateCcw, Award, Shield, Flame } from 'lucide-react';
import { sounds } from '../utils/sound';

export default function TournamentSimulation({ managers, onRestart }) {
  const [stage, setStage] = useState('bracket'); // 'bracket', 'playing_semi', 'semi_done', 'playing_final', 'finished'
  const [semi1, setSemi1] = useState(null);
  const [semi2, setSemi2] = useState(null);
  const [finalMatch, setFinalMatch] = useState(null);
  const [thirdMatch, setThirdMatch] = useState(null);
  const [champion, setChampion] = useState(null);
  const [matchLogs, setMatchLogs] = useState([]);

  // Calculate manager strength (OVR + Chemistry bonus)
  const getTeamStats = (m) => {
    const players = Object.values(m.squad).filter(Boolean);
    const avgOvr = players.length > 0 ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length) : 75;
    return {
      ovr: avgOvr,
      players: players
    };
  };

  const simulateMatch = (teamA, teamB) => {
    const statsA = getTeamStats(teamA);
    const statsB = getTeamStats(teamB);

    // Goal calculation based on OVR difference + randomness
    const diff = (statsA.ovr - statsB.ovr) * 0.15;
    let goalsA = Math.max(0, Math.round(Math.random() * 3 + diff + (Math.random() > 0.5 ? 1 : 0)));
    let goalsB = Math.max(0, Math.round(Math.random() * 3 - diff + (Math.random() > 0.5 ? 1 : 0)));

    // Extra penalty if tie
    let penaltyWinner = null;
    if (goalsA === goalsB) {
      penaltyWinner = Math.random() > 0.5 ? teamA : teamB;
    }

    const winner = goalsA > goalsB ? teamA : goalsB > goalsA ? teamB : penaltyWinner;
    const loser = winner.id === teamA.id ? teamB : teamA;

    // Generate random exciting goal logs
    const scorersA = statsA.players.filter(p => p.position === 'FW' || p.position === 'MF');
    const scorersB = statsB.players.filter(p => p.position === 'FW' || p.position === 'MF');
    const logs = [];

    for (let i = 0; i < goalsA; i++) {
      const min = Math.floor(Math.random() * 85) + 5;
      const scorer = scorersA[Math.floor(Math.random() * scorersA.length)]?.name || teamA.name;
      logs.push(`⚽ Phút ${min}': [${teamA.name}] ${scorer} ghi bàn tuyệt đẹp!`);
    }
    for (let i = 0; i < goalsB; i++) {
      const min = Math.floor(Math.random() * 85) + 5;
      const scorer = scorersB[Math.floor(Math.random() * scorersB.length)]?.name || teamB.name;
      logs.push(`⚽ Phút ${min}': [${teamB.name}] ${scorer} lập công!`);
    }
    logs.sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    return {
      teamA,
      teamB,
      scoreA: goalsA,
      scoreB: goalsB,
      winner,
      loser,
      logs
    };
  };

  const startTournament = () => {
    sounds.playWhistle();
    // Semi 1: User (Manager 0) vs Manager 1
    // Semi 2: Manager 2 vs Manager 3
    const resSemi1 = simulateMatch(managers[0], managers[1]);
    const resSemi2 = simulateMatch(managers[2], managers[3]);

    setSemi1(resSemi1);
    setSemi2(resSemi2);
    setMatchLogs([...resSemi1.logs, ...resSemi2.logs]);
    setStage('semi_done');
  };

  const playFinals = () => {
    sounds.playWhistle();
    const resFinal = simulateMatch(semi1.winner, semi2.winner);
    const resThird = simulateMatch(semi1.loser, semi2.loser);

    setFinalMatch(resFinal);
    setThirdMatch(resThird);
    setChampion(resFinal.winner);
    setMatchLogs(prev => [...prev, "--- CHUNG KẾT ---", ...resFinal.logs]);
    setStage('finished');

    sounds.playFanfare();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40">
          GIAI ĐOẠN 2: THI ĐẤU ĐỐI KHÁNG
        </span>
        <h2 className="text-3xl font-black text-white mt-2 flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-amber-400" />
          CÚP VÔ ĐỊCH BÓNG ĐÁ HUYỀN THOẠI
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Cả 4 đội hình đã đủ 11 cầu thủ. Bước vào giải đấu Mini-Cup tranh cúp vô địch!
        </p>
      </div>

      {/* Bracket View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* Semi Final 1 */}
        <MatchCard 
          title="Bán Kết 1" 
          match={semi1} 
          defaultTeamA={managers[0]} 
          defaultTeamB={managers[1]} 
        />

        {/* Semi Final 2 */}
        <MatchCard 
          title="Bán Kết 2" 
          match={semi2} 
          defaultTeamA={managers[2]} 
          defaultTeamB={managers[3]} 
        />
      </div>

      {/* Finals (if played) */}
      {stage === 'finished' && finalMatch && (
        <div className="my-6 border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-slate-950 rounded-2xl p-5 shadow-2xl">
          <div className="text-center mb-3">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              TRẬN CHUNG KẾT TRONG MƠ
            </span>
            <h3 className="text-xl font-black text-white">
              {finalMatch.teamA.name} VS {finalMatch.teamB.name}
            </h3>
          </div>
          <div className="flex items-center justify-center gap-6 text-4xl font-black font-mono text-amber-400 my-2">
            <span>{finalMatch.scoreA}</span>
            <span className="text-slate-500 text-2xl">-</span>
            <span>{finalMatch.scoreB}</span>
          </div>
          <div className="text-center mt-3">
            <span className="text-sm text-slate-300">ĐỘI VÔ ĐỊCH: </span>
            <strong className="text-lg text-amber-300 font-black ml-1">
              🏆 {champion?.name} {champion?.isUser ? '(BẠN)' : ''}
            </strong>
          </div>
        </div>
      )}

      {/* Match Commentary Log */}
      {matchLogs.length > 0 && (
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 my-4 max-h-40 overflow-y-auto text-xs space-y-1.5 font-mono">
          <div className="text-slate-500 font-bold mb-2">DIỄN BIẾN TRẬN ĐẤU:</div>
          {matchLogs.map((log, idx) => (
            <div key={idx} className="text-emerald-400">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 mt-6">
        {stage === 'bracket' && (
          <button
            onClick={startTournament}
            className="py-3 px-8 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl flex items-center gap-2"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            Bắt Đầu Bán Kết
          </button>
        )}

        {stage === 'semi_done' && (
          <button
            onClick={playFinals}
            className="py-3 px-8 rounded-2xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl flex items-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Thi Đấu Trận Chung Kết!
          </button>
        )}

        {stage === 'finished' && (
          <button
            onClick={onRestart}
            className="py-3 px-6 rounded-2xl font-black text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Chơi Lại Trận Mới
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({ title, match, defaultTeamA, defaultTeamB }) {
  const teamA = match ? match.teamA : defaultTeamA;
  const teamB = match ? match.teamB : defaultTeamB;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
        {title}
      </span>
      <div className="space-y-2">
        <div className={`flex justify-between items-center p-2 rounded-xl ${
          match?.winner?.id === teamA.id ? 'bg-amber-950/40 border border-amber-500/50' : 'bg-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{teamA.avatar}</span>
            <span className="font-extrabold text-sm text-white">{teamA.name}</span>
            {teamA.isUser && <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded">BẠN</span>}
          </div>
          <span className="text-lg font-black font-mono text-white">
            {match ? match.scoreA : '-'}
          </span>
        </div>

        <div className={`flex justify-between items-center p-2 rounded-xl ${
          match?.winner?.id === teamB.id ? 'bg-amber-950/40 border border-amber-500/50' : 'bg-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{teamB.avatar}</span>
            <span className="font-extrabold text-sm text-white">{teamB.name}</span>
            {teamB.isUser && <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded">BẠN</span>}
          </div>
          <span className="text-lg font-black font-mono text-white">
            {match ? match.scoreB : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
