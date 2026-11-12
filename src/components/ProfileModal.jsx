import React, { useState } from 'react';
import { User, Check, X, Sparkles } from 'lucide-react';

const AVATAR_OPTIONS = ['🟢', '🟣', '⭐', '👑', '🦁', '⚡', '🦅', '🔥', '🏆', '⚽', '🎩', '🎯'];

export default function ProfileModal({
  player1,
  player2,
  onlineRole, // null, 'host' (p1), or 'guest' (p2)
  onSave,
  onClose
}) {
  const [p1Name, setP1Name] = useState(player1.name);
  const [p1Avatar, setP1Avatar] = useState(player1.avatar);
  const [p2Name, setP2Name] = useState(player2.name);
  const [p2Avatar, setP2Avatar] = useState(player2.avatar);

  const canEditP1 = !onlineRole || onlineRole === 'host';
  const canEditP2 = !onlineRole || onlineRole === 'guest';

  const handleSave = (e) => {
    e.preventDefault();
    onSave({
      p1Name: p1Name.trim() || 'HLV 1',
      p1Avatar,
      p2Name: p2Name.trim() || 'HLV 2',
      p2Avatar
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">ĐẶT TÊN HLV & AVATAR</h3>
            <p className="text-xs text-slate-400">Tùy chỉnh danh xưng hiển thị trên sàn đấu giá</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* HLV 1 Profile */}
          <div className={`p-4 rounded-2xl border transition-all ${canEditP1 ? 'bg-slate-950/80 border-emerald-500/50' : 'bg-slate-950/40 border-slate-800 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                HLV 1 {onlineRole === 'host' ? '(BẠN)' : ''}
              </span>
              <span className="text-2xl">{p1Avatar}</span>
            </div>

            <input
              type="text"
              value={p1Name}
              onChange={(e) => setP1Name(e.target.value)}
              disabled={!canEditP1}
              maxLength={18}
              placeholder="Nhập tên HLV 1..."
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />

            {canEditP1 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => setP1Avatar(av)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                      p1Avatar === av ? 'bg-emerald-500 scale-110 shadow' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* HLV 2 Profile */}
          <div className={`p-4 rounded-2xl border transition-all ${canEditP2 ? 'bg-slate-950/80 border-purple-500/50' : 'bg-slate-950/40 border-slate-800 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-purple-400 uppercase tracking-wider">
                HLV 2 {onlineRole === 'guest' ? '(BẠN)' : ''}
              </span>
              <span className="text-2xl">{p2Avatar}</span>
            </div>

            <input
              type="text"
              value={p2Name}
              onChange={(e) => setP2Name(e.target.value)}
              disabled={!canEditP2}
              maxLength={18}
              placeholder="Nhập tên HLV 2..."
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-purple-500 transition-colors"
            />

            {canEditP2 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => setP2Avatar(av)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                      p2Avatar === av ? 'bg-purple-600 scale-110 shadow' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-300 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Lưu Thay Đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
