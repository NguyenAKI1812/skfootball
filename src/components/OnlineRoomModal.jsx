import React, { useState } from 'react';
import { Globe, Copy, Check, X, Users, Wifi, ArrowRight, ShieldCheck } from 'lucide-react';

export default function OnlineRoomModal({
  onlineState, // { isConnected, role, roomCode }
  onHostRoom,
  onJoinRoom,
  onDisconnect,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const localIP = '192.168.1.78';
  const port = '5173';

  // Generate a random 4-digit code if not already set
  const [createdCode] = useState(() => `AUC-${Math.floor(1000 + Math.random() * 9000)}`);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${onlineState.roomCode || createdCode}`
    : `http://localhost:5173/?room=${createdCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    onHostRoom(createdCode);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onJoinRoom(inputCode.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">ĐẤU GIÁ ONLINE 2 NGƯỜI</h3>
            <p className="text-xs text-slate-400">Chơi trên 2 máy tính, điện thoại hoặc 2 tab khác nhau</p>
          </div>
        </div>

        {/* Connected Banner if already live */}
        {onlineState.isConnected ? (
          <div className="bg-slate-950/80 border-2 border-emerald-500/60 rounded-2xl p-5 text-center my-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black mb-2">
              <Wifi className="w-3.5 h-3.5" /> ĐÃ KẾT NỐI ONLINE THÀNH CÔNG!
            </div>
            <div className="text-sm font-bold text-slate-300">
              Mã phòng: <strong className="text-amber-400 font-mono text-base">{onlineState.roomCode}</strong>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Bạn đang điều khiển: <strong className="text-white uppercase">{onlineState.role === 'host' ? 'HLV 1 (Bạn)' : 'HLV 2 (Đối thủ)'}</strong>
            </div>
            <button
              onClick={onDisconnect}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-red-950/60 text-red-400 border border-red-800 hover:bg-red-900/50 transition-all"
            >
              Rời Phòng / Ngắt Kết Nối
            </button>
          </div>
        ) : (
          <div>
            {/* Tabs: Create vs Join */}
            <div className="flex bg-slate-950 rounded-2xl p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  activeTab === 'create' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Tạo Phòng Mới (Host)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  activeTab === 'join' ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Vào Phòng Đã Có (Join)
              </button>
            </div>

            {/* Tab 1: Create Room */}
            {activeTab === 'create' ? (
              <div className="space-y-4">
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Mã Phòng Của Bạn:
                  </span>
                  <div className="text-3xl font-black font-mono text-amber-400 tracking-wider">
                    {onlineState.roomCode || createdCode}
                  </div>
                </div>

                {/* Share Link Box */}
                <div>
                  <span className="text-xs text-slate-300 font-bold block mb-1.5">
                    🔗 Link mời bạn bè (Mở trên máy khác cùng Wifi hoặc tab mới):
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Wifi className="w-4 h-4" />
                  Mở Phòng Chờ & Đợi Bạn Bè Vào
                </button>
              </div>
            ) : (
              /* Tab 2: Join Room */
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <span className="text-xs text-slate-300 font-bold block mb-1.5">
                    Nhập mã phòng do bạn bè chia sẻ:
                  </span>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Ví dụ: AUC-7291"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-base font-black font-mono text-amber-400 uppercase tracking-wider focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <span>Tham Gia Phòng Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
