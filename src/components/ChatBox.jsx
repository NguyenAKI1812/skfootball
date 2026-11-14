import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';

const MAX_CHAT_CHARS = 60;
const QUICK_CHATS = ['🔥 Hay quá!', '👏 Đỉnh!', '😂 Cay chưa!', 'GG! 🤝'];

export default function ChatBox({
  messages = [],
  selfId = 'p1',
  onSendMessage
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Latest message from self and from opponent (newer replaces older)
  const latestSelfMsg = [...messages].reverse().find((m) => m.senderId === selfId) || null;
  const latestOppMsg = [...messages].reverse().find((m) => m.senderId !== selfId) || null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim().slice(0, MAX_CHAT_CHARS);
    if (!trimmed) return;
    onSendMessage?.(trimmed);
    setInput('');
    setIsOpen(false);
  };

  const handleQuickSend = (phrase) => {
    onSendMessage?.(phrase.slice(0, MAX_CHAT_CHARS));
    setIsOpen(false);
  };

  return (
    <div className="chat-bar w-full max-w-[1700px] mx-auto px-3.5 pt-3 relative z-20">
      <div className="flex flex-wrap items-center justify-between gap-3 min-h-[46px]">
        {/* LEFT SIDE (SELF): Chat Button + Latest Self Message */}
        <div className="flex items-center gap-3 relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-display text-sm font-extrabold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              isOpen
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border-emerald-500/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>CHAT</span>
          </button>

          {/* Latest Self Message Bubble (replaces old message) */}
          {latestSelfMsg ? (
            <div
              key={latestSelfMsg.id}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/65 border border-emerald-500/50 text-sm text-emerald-100 max-w-xl min-w-0 shadow-md"
            >
              <span className="font-bold text-emerald-400 shrink-0 uppercase text-xs">
                {latestSelfMsg.senderName}:
              </span>
              <span className="truncate font-semibold">{latestSelfMsg.text}</span>
            </div>
          ) : (
            <span className="chat-hint text-xs text-slate-500 hidden sm:inline">
              Nhấn CHAT để nhắn tin (tối đa {MAX_CHAT_CHARS} ký tự)
            </span>
          )}

          {/* Compact Input Popover under CHAT button */}
          {isOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 broadcast-panel border border-emerald-500/60 rounded-xl p-3 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Nhắn tin nhanh (tối đa {MAX_CHAT_CHARS} ký tự)
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {QUICK_CHATS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleQuickSend(phrase)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_CHAT_CHARS))}
                    maxLength={MAX_CHAT_CHARS}
                    placeholder="Nhập tin nhắn..."
                    className="w-full pl-3 pr-12 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono-num text-[10px] text-slate-400">
                    {input.length}/{MAX_CHAT_CHARS}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 transition-colors cursor-pointer"
                  title="Gửi"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT SIDE (OPPONENT): Only Latest Opponent Message (NO chat button) */}
        <div className="flex items-center justify-end min-w-0 max-w-xl">
          {latestOppMsg && (
            <div
              key={latestOppMsg.id}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/65 border border-rose-500/50 text-sm text-rose-100 max-w-full min-w-0 shadow-md"
            >
              <span className="font-bold text-rose-400 shrink-0 uppercase text-xs">
                {latestOppMsg.senderName}:
              </span>
              <span className="truncate font-semibold">{latestOppMsg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
