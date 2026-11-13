import React, { useState, useEffect, useRef } from 'react';
import { Globe, Copy, Check, X, Wifi, ArrowRight, Loader2, Radio, UserPlus, LogIn, Edit3, LogOut } from 'lucide-react';
import { isSupabaseConfigured } from '../utils/supabaseClient';
import { registerAccount, loginAccount, updateAccountDisplayName, logoutAccount } from '../utils/accountService';

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
  account, // { id, username, displayName, avatar } | null
  onAccountChange,
  onHostRoom,
  onJoinRoom,
  onDisconnect,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdCode, setCreatedCode] = useState(() => generateRoomCode(6));

  // Auth form state (when account is null)
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Inline rename state (when signed in)
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState(account?.displayName || '');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');

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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const acc = authMode === 'register'
        ? await registerAccount({ username, password, displayName })
        : await loginAccount({ username, password });
      onAccountChange?.(acc);
      setNewNameInput(acc.displayName);
    } catch (err) {
      setAuthError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    if (!account) return;
    setRenameError('');
    setRenameLoading(true);
    try {
      const updated = await updateAccountDisplayName(account, newNameInput);
      onAccountChange?.(updated);
      setIsEditingName(false);
    } catch (err) {
      setRenameError(err.message || 'Không thể đổi tên.');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleLogout = () => {
    if (onlineState.isConnected) {
      onDisconnect();
    }
    logoutAccount();
    onAccountChange?.(null);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setAuthError('');
  };

  const isWaitingHost = !onlineState.isConnected && onlineState.pendingRole === 'host';
  const isJoiningGuest = !onlineState.isConnected && onlineState.pendingRole === 'guest';

  const [justMatched, setJustMatched] = useState(false);
  const prevConnectedRef = useRef(onlineState.isConnected);

  useEffect(() => {
    if (!prevConnectedRef.current && onlineState.isConnected) {
      setJustMatched(true);
      const timer = setTimeout(() => {
        onClose?.();
      }, 1500);
      prevConnectedRef.current = true;
      return () => clearTimeout(timer);
    }
    prevConnectedRef.current = onlineState.isConnected;
  }, [onlineState.isConnected, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
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
              <p className="text-xs text-slate-400">
                {account ? 'Tạo phòng & chia sẻ link để đấu giá thời gian thực' : 'Tạo tài khoản & đặt tên để tham gia chơi Online'}
              </p>
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

        {/* STEP 1: REQUIRE ACCOUNT CREATION / LOGIN */}
        {!account ? (
          <div>
            <div className="flex bg-slate-950 rounded-2xl p-1 mb-4 border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'register' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tạo Tài Khoản</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'login' ? 'bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Tên đăng nhập (không dấu, viết liền)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: hlv_tuan123"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">Tên hiển thị trong game (có thể đổi sau)</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: HLV Tuấn"
                    maxLength={24}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Mật khẩu</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 4 ký tự"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {authError && (
                <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-bold text-rose-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-60 text-slate-950 shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>{authMode === 'register' ? 'Tạo Tài Khoản & Tiếp Tục' : 'Đăng Nhập & Tiếp Tục'}</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            {/* Signed-in Account Bar with Inline Rename */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 mb-4">
              {!isEditingName ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 font-semibold">
                      Tài khoản: <span className="font-mono text-slate-300">@{account.username}</span>
                    </div>
                    <div className="text-sm font-black text-emerald-400 truncate">
                      Tên hiển thị: {account.displayName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setNewNameInput(account.displayName);
                        setRenameError('');
                        setIsEditingName(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 border border-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Đổi tên</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                      title="Đăng xuất"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveRename} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNameInput}
                      onChange={(e) => setNewNameInput(e.target.value)}
                      maxLength={24}
                      placeholder="Nhập tên hiển thị mới..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/50 text-xs font-bold text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={renameLoading}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {renameLoading ? '...' : 'Lưu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                  {renameError && <div className="text-[11px] text-rose-400 font-bold">{renameError}</div>}
                </form>
              )}
            </div>

            {/* Connected Banner if already live */}
            {onlineState.isConnected ? (
              <div className="bg-slate-950/80 border-2 border-emerald-500/60 rounded-2xl p-5 text-center my-3 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black mb-2">
                  <Wifi className="w-3.5 h-3.5" />
                  {justMatched ? 'GHÉP PHÒNG THÀNH CÔNG!' : 'ĐÃ KẾT NỐI ONLINE THÀNH CÔNG!'}
                </div>
                <div className="text-sm font-bold text-slate-300">
                  Mã phòng: <strong className="text-amber-400 font-mono text-base">{onlineState.roomCode}</strong>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Bạn đang điều khiển: <strong className="text-emerald-400 uppercase">{account.displayName} (Bạn - Xanh)</strong>
                </div>
                {justMatched ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang tự động đóng bảng để bắt đầu...
                  </div>
                ) : (
                  <button
                    onClick={onDisconnect}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-red-950/60 text-red-400 border border-red-800 hover:bg-red-900/50 transition-all cursor-pointer"
                  >
                    Rời Phòng / Ngắt Kết Nối
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Tabs: Create vs Join */}
                <div className="flex bg-slate-950 rounded-2xl p-1 mb-5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                      activeTab === 'create' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1. Tạo Phòng (Host)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
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
                          className="mt-2 text-[11px] font-bold text-slate-400 hover:text-cyan-400 underline cursor-pointer"
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
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
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
                        className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                      className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-60 text-white shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
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
        )}
      </div>
    </div>
  );
}
