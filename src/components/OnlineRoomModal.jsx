import React, { useState } from 'react';
import { Globe, Copy, Check, X, Wifi, ArrowRight, Loader2, Radio } from 'lucide-react';
import { isSupabaseConfigured } from '../utils/supabaseClient';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return code;
}

export default function OnlineRoomModal({
  onlineState, // { isConnected, role, roomCode, pendingRole?, pendingRoomCode? }
  onHostRoom,
  onJoinRoom,
  onDisconnect,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [createdCode, setCreatedCode] = useState(() => generateRoomCode(6));

  const activeCode = onlineState.roomCode || onlineState.pendingRoomCode || createdCode;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${activeCode}`
    : `http://localhost:5173/?room=${activeCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    onHostRoom(createdCode);
  };

  const handleRegenerateCode = () => {
    setCreatedCode(generateRoomCode(6));
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onJoinRoom(inputCode.trim().toUpperCase());
    }
  };

  const isWaitingHost = !onlineState.isConnected && onlineState.pendingRole === 'host';
  const isJoiningGuest = !onlineState.isConnected && onlineState.pendingRole === 'guest';

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
        <div className="flex items-center justify-between gap-2.5 mb-5 pr-8">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-wide">ĐẤU GIÁ ONLINE 2 NGƯỜI</h3>
              <p className="text-xs text-slate-400">Tạo phòng & chia sẻ link để đấu giá thời gian thực</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
              isSupabaseConfigured
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
            }`}
          >
            <Radio className="w-3 h-3" />
            {isSupabaseConfigured ? 'Supabase Realtime' : 'P2P / Local Sync'}
          </span>
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
                1. Tạo Phòng (Host)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  activeTab === 'join' ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Vào Phòng (Guest)
              </button>
            </div>

            {/* Tab 1: Create Room */}
            {activeTab === 'create' ? (
              <div className="space-y-4">
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center relative">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Mã Phòng Của Bạn (6 ký tự):
                  </span>
                  <div className="text-3xl font-black font-mono text-amber-400 tracking-[0.2em]">
                    {activeCode}
                  </div>
                  {!isWaitingHost && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="mt-2 text-[11px] font-bold text-slate-400 hover:text-cyan-400 underline"
                    >
                      Đổi mã khác
                    </button>
                  )}
                </div>

                {/* Share Link Box */}
                <div>
                  <span className="text-xs text-slate-300 font-bold block mb-1.5">
                    Link mời bạn bè (Gửi để Người 2 vào thẳng phòng):
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Đã chép' : 'Copy link'}</span>
                    </button>
                  </div>
                </div>

                {isWaitingHost ? (
                  <div className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang mở phòng {onlineState.pendingRoomCode} — Chờ Người 2 vào...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Wifi className="w-4 h-4" />
                    Tạo Phòng & Chờ Đối Thủ
                  </button>
                )}
              </div>
            ) : (
              /* Tab 2: Join Room */
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <span className="text-xs text-slate-300 font-bold block mb-1.5">
                    Nhập mã phòng (4–6 ký tự) từ Người 1:
                  </span>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: SK4829"
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-base font-black font-mono text-amber-400 uppercase tracking-widest focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isJoiningGuest || !inputCode.trim()}
                  className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-60 text-white shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  {isJoiningGuest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang vào phòng {onlineState.pendingRoomCode}...</span>
                    </>
                  ) : (
                    <>
                      <span>Vào Phòng</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
