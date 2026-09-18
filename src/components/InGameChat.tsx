import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Smile } from 'lucide-react';
import { useMultiplayer, ChatMessage } from '../store/MultiplayerContext';
import { useGame } from '../store/GameContext';
import { getAvatar } from './AvatarPicker';

const QUICK_REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '🥺', label: 'Aww' },
  { emoji: '🙈', label: 'Shy' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💯', label: '100' },
  { text: 'Cheater! 😜' },
  { text: 'You know me so well! 💕' },
  { text: 'Wait what?! 😳' },
  { text: 'My turn! 😎' },
  { text: 'Good game! 👏' },
  { text: 'Think carefully! 🤔' },
];

export const InGameChat: React.FC = () => {
  const {
    status,
    chatMessages,
    unreadChatCount,
    latestIncomingMessage,
    sendChatMessage,
    clearUnreadChatCount,
    remoteProfile,
  } = useMultiplayer();
  const { profile } = useGame();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [activeToast, setActiveToast] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  // When drawer opens, clear unread count
  const handleOpen = () => {
    setIsOpen(true);
    setShowToast(false);
    clearUnreadChatCount();
  };

  const handleClose = () => {
    setIsOpen(false);
    clearUnreadChatCount();
  };

  // Close on Escape key for desktop
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Show floating toast when a new message arrives and chat is closed
  useEffect(() => {
    if (!isOpen && latestIncomingMessage) {
      setActiveToast(latestIncomingMessage);
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [latestIncomingMessage, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleSendReaction = (item: { emoji?: string; text?: string }) => {
    const content = item.text || item.emoji || '';
    sendChatMessage(content, true);
  };

  // Only render during active multiplayer connection
  if (status !== 'connected') return null;

  const partnerName = remoteProfile?.name || 'Partner';
  const partnerAvatar = getAvatar(remoteProfile?.avatarId || 'default');
  const myAvatar = getAvatar(profile?.avatarId || 'default');

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* ── FLOATING TOAST PREVIEW (when chat is closed) ── */}
      {showToast && activeToast && !isOpen && (
        <div
          onClick={handleOpen}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs animate-pop-in cursor-pointer"
        >
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl border-2 border-pink-300 flex items-center gap-3 active:scale-95 transition-transform">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 border border-pink-200"
              style={{ background: partnerAvatar?.bg || '#FCE7F3' }}
            >
              {partnerAvatar?.face || '💖'}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink">{partnerName}</span>
                <span className="text-[10px] font-semibold text-ink-3">just now</span>
              </div>
              <p className="text-xs font-bold text-pink-600 truncate">
                {activeToast.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CHAT BUTTON (Bottom Right of Game area) ── */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Open in-game chat"
          className="fixed bottom-20 right-4 sm:right-6 z-40 w-13 h-13 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all duration-200 group animate-float border-2 border-white/80"
          style={{
            background: 'linear-gradient(135deg, #FF2D9B 0%, #7C3AED 100%)',
            boxShadow: '0 8px 24px rgba(255, 45, 155, 0.45)',
          }}
        >
          <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          
          {/* Unread Counter Badge */}
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-400 text-stone-900 text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      )}

      {/* ── CHAT DRAWER / SHEET ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose}>
          <div
            className="w-full max-w-md sm:max-w-lg md:max-w-xl h-[85vh] sm:h-[min(680px,88vh)] bg-[#FAF9FF] rounded-t-[32px] sm:rounded-[36px] shadow-2xl flex flex-col overflow-hidden animate-pop-in border-t-2 sm:border-2 border-white/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 flex items-center justify-between text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF2D9B 100%)' }}
            >
              <div className="flex items-center gap-3">
                {/* Partner Avatar Bubble */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border-2 border-white"
                    style={{ background: partnerAvatar?.bg || '#fff' }}
                  >
                    {partnerAvatar?.face}
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-white absolute bottom-0 right-0" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-sm text-white leading-tight">{partnerName}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-white/20 text-white uppercase tracking-wider">
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-white/80">In-Game Chat</p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-ink-3">
                  <div className="w-14 h-14 rounded-2xl bg-pink-100 flex items-center justify-center text-2xl animate-float">
                    💬
                  </div>
                  <p className="text-sm font-black text-ink">No messages yet!</p>
                  <p className="text-xs text-ink-3 max-w-xs">
                    Send a cute reaction or tease your partner while playing together!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === 'me';
                  const avatar = isMe ? myAvatar : partnerAvatar;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMe && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mb-1 border border-stone-200"
                          style={{ background: avatar?.bg || '#fff' }}
                        >
                          {avatar?.face}
                        </div>
                      )}

                      <div
                        className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl shadow-sm text-sm font-bold ${
                            isMe
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-xs'
                              : 'bg-white text-ink border border-stone-200/80 rounded-bl-xs'
                          } ${msg.isQuickReaction && msg.text.length <= 4 ? 'text-2xl py-1.5 px-3' : ''}`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[9px] font-semibold text-ink-3 mt-0.5 px-1">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>

                      {isMe && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mb-1 border border-purple-200"
                          style={{ background: avatar?.bg || '#fff' }}
                        >
                          {avatar?.face}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reactions Bar */}
            <div className="px-3 py-2 bg-white border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[11px] font-black text-ink-3 flex items-center gap-1 shrink-0 pl-1">
                <Smile className="w-3.5 h-3.5 text-pink-500" />
              </span>
              {QUICK_REACTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendReaction(item)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 hover:bg-pink-50 hover:text-pink-600 text-ink-2 border border-stone-200 whitespace-nowrap active:scale-95 transition-all shrink-0"
                >
                  {item.text || item.emoji}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-white border-t border-stone-100 flex items-center gap-2 shrink-0 safe-pb"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${partnerName}...`}
                maxLength={200}
                className="flex-1 px-4 py-3 rounded-full bg-stone-100 text-ink text-sm font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all border border-stone-200"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 disabled:opacity-40 transition-all shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)',
                }}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
