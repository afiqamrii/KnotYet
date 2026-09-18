import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  UserPlus,
  MessageCircle,
  Play,
  Share2,
  Copy,
  Check,
  Send,
  ArrowLeft,
  Trash2,
  Sparkles,
  Smile
} from 'lucide-react';
import { useFriends, Friend, DirectMessage } from '../store/FriendsContext';
import { useGame, RelationshipType } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer } from '../store/MultiplayerContext';
import { AvatarPicker, getAvatar } from './AvatarPicker';
import { sounds } from '../utils/audio';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchMultiplayer?: (roomCode: string) => void;
}

const RELATIONSHIP_OPTIONS: { type: RelationshipType | 'friend'; label: string; emoji: string; bg: string }[] = [
  { type: 'lover', label: 'Lover', emoji: '💖', bg: '#FCE7F3' },
  { type: 'spouse', label: 'Spouse', emoji: '💍', bg: '#EDE9FE' },
  { type: 'crush', label: 'Crush', emoji: '🥺', bg: '#FEF3C7' },
  { type: 'bestfriend', label: 'Best Friend', emoji: '🤝', bg: '#CFFAFE' },
  { type: 'friend', label: 'Friend', emoji: '⭐', bg: '#F3F4F6' },
];

const QUICK_DM_REACTIONS = [
  '❤️', '😂', '🥺', '🔥', '🎮 Let\'s play!', 'Thinking of you! 💕', 'Ready when you are! ✨', 'Miss you! 💖'
];

export const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, onLaunchMultiplayer }) => {
  const { friends, addFriend, removeFriend, getConversation, sendDirectMessage, activeChatFriendId, setActiveChatFriendId } = useFriends();
  const { profile } = useGame();
  const { user } = useAuth();
  const multiplayer = useMultiplayer();

  const [view, setView] = useState<'list' | 'add' | 'chat'>('list');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // Add friend form state
  const [friendName, setFriendName] = useState('');
  const [friendAvatar, setFriendAvatar] = useState('sunny');
  const [friendRel, setFriendRel] = useState<RelationshipType | 'friend'>('lover');
  const [copiedLink, setCopiedLink] = useState(false);

  // Chat state
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // If opened with an active chat friend
  useEffect(() => {
    if (activeChatFriendId) {
      const f = friends.find(item => item.id === activeChatFriendId);
      if (f) {
        setSelectedFriend(f);
        setView('chat');
      }
    }
  }, [activeChatFriendId, friends]);

  // Refresh active conversation
  useEffect(() => {
    if (view === 'chat' && selectedFriend) {
      const msgs = getConversation(selectedFriend.id);
      setChatMessages(msgs);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, selectedFriend, getConversation, friends]);

  // Escape key support on desktop
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'chat' || view === 'add') {
          setView('list');
          setActiveChatFriendId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, onClose, setActiveChatFriendId]);

  if (!isOpen || !profile) return null;

  const handleOpenChat = (friend: Friend) => {
    setSelectedFriend(friend);
    setActiveChatFriendId(friend.id);
    setView('chat');
    sounds.playFlip();
  };

  const handleSendDM = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedFriend) return;
    sendDirectMessage(selectedFriend.id, inputText.trim(), false);
    setInputText('');
    setChatMessages(getConversation(selectedFriend.id));
  };

  const handleQuickReaction = (text: string) => {
    if (!selectedFriend) return;
    sendDirectMessage(selectedFriend.id, text, true);
    setChatMessages(getConversation(selectedFriend.id));
  };

  const handleCreateGameInvite = () => {
    if (!selectedFriend) return;
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    sendDirectMessage(
      selectedFriend.id,
      `🎮 Hey! I started a game room #${roomCode}. Tap Join below to play!`,
      false,
      { roomCode, gameTitle: 'KnotYet Room' }
    );
    setChatMessages(getConversation(selectedFriend.id));

    // Also prompt local user to start hosting this room
    if (onLaunchMultiplayer) {
      onLaunchMultiplayer(roomCode);
    } else {
      multiplayer.hostRoom(roomCode, profile);
      onClose();
    }
  };

  const handleJoinFromInvite = (roomCode: string) => {
    sounds.playSuccess();
    multiplayer.joinRoom(roomCode, profile);
    onClose();
  };

  const handleShareInviteLink = () => {
    const url = `https://knotyetapp.me/invite?n=${encodeURIComponent(profile.name)}&a=${profile.avatarId}&r=${friendRel}&uid=${user?.id || ''}`;
    const text = `Let's connect on KnotYet! 💖 Click here to link with me as ${friendRel}: ${url}`;

    if (navigator.share) {
      navigator.share({ title: 'KnotYet Invite', text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      sounds.playSuccess();
    }
  };

  const handleSaveFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;
    const isPartnerRel = friendRel === 'lover' || friendRel === 'spouse';
    const newF = addFriend(friendName.trim(), friendAvatar, friendRel, isPartnerRel);
    setFriendName('');
    setSelectedFriend(newF);
    setView('chat');
  };

  const relOption = (type: string) => {
    return RELATIONSHIP_OPTIONS.find(r => r.type === type) || RELATIONSHIP_OPTIONS[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md sm:max-w-xl md:max-w-2xl h-[min(780px,92vh)] bg-[#FAF9FF] rounded-[28px] sm:rounded-[36px] shadow-2xl flex flex-col overflow-hidden animate-pop-in border-2 border-white/70"
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div
          className="px-5 py-4 flex items-center justify-between text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF2D9B 100%)' }}
        >
          {view === 'list' && (
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">Friends & Loved Ones</h2>
                <p className="text-[11px] text-white/80 font-medium">Chat & play together anytime</p>
              </div>
            </div>
          )}

          {view === 'add' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('list')}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
              <h2 className="text-lg font-black text-white">Add to My Circle</h2>
            </div>
          )}

          {view === 'chat' && selectedFriend && (
            <div className="flex items-center justify-between w-full pr-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setView('list');
                    setActiveChatFriendId(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-white/80 shadow-sm"
                    style={{ background: getAvatar(selectedFriend.avatarId)?.bg || '#fff' }}
                  >
                    {getAvatar(selectedFriend.avatarId)?.face}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white leading-none">{selectedFriend.name}</h3>
                    <span className="text-[10px] font-semibold text-white/80 capitalize">
                      {relOption(selectedFriend.relationshipType).emoji} {relOption(selectedFriend.relationshipType).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Game Launcher in Chat Header */}
              <button
                onClick={handleCreateGameInvite}
                className="px-3 py-1.5 rounded-full bg-white text-pink-600 hover:bg-pink-50 active:scale-95 transition shadow-sm font-black text-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </button>
            </div>
          )}

          {view !== 'chat' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── VIEW: FRIENDS LIST ── */}
        {view === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
            {/* Action Card: Add Friend */}
            <button
              onClick={() => setView('add')}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-2 border-pink-200 hover:border-pink-300 active:scale-[0.98] transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-md">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-ink">Add Partner or Friend</p>
                  <p className="text-[11px] text-ink-3 font-medium">Link via invite link or custom profile</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-pink-500 text-white shadow-sm">
                + Add
              </span>
            </button>

            {/* List of Friends */}
            <div className="flex-1 overflow-y-auto space-y-2.5 no-scrollbar pr-0.5">
              {friends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-3xl animate-float">
                    💌
                  </div>
                  <h3 className="font-black text-ink text-base">Your Circle is Empty</h3>
                  <p className="text-xs text-ink-3 max-w-xs">
                    Add your lover, spouse, crush, or bestie so you can chat together and jump right into games!
                  </p>
                </div>
              ) : (
                friends.map(friend => {
                  const opt = relOption(friend.relationshipType);
                  const av = getAvatar(friend.avatarId);

                  return (
                    <div
                      key={friend.id}
                      className={`p-3.5 rounded-2xl bg-white border transition-all duration-200 shadow-sm flex items-center justify-between ${
                        friend.isPartner
                          ? 'border-pink-300 bg-gradient-to-r from-white to-pink-50/40 shadow-pink-100'
                          : 'border-stone-200/80 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 border-2 border-white shadow-sm relative"
                          style={{ background: av?.bg || '#F3F4F6' }}
                        >
                          {av?.face}
                          {friend.isPartner && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] shadow">
                              💖
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-sm text-ink truncate">{friend.name}</h4>
                            <span
                              className="text-[9px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: opt.bg, color: '#374151' }}
                            >
                              {opt.emoji} {opt.label}
                            </span>
                          </div>

                          <p className="text-[11px] text-ink-3 font-medium truncate mt-0.5">
                            {friend.lastMessage || 'Tap chat to message...'}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <button
                          onClick={() => handleOpenChat(friend)}
                          className="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-600 active:scale-95 transition"
                          title="Chat"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFriend(friend);
                            handleCreateGameInvite();
                          }}
                          className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 active:scale-95 transition"
                          title="Invite to Play"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        {!friend.isPartner && (
                          <button
                            onClick={() => removeFriend(friend.id)}
                            className="p-2 rounded-xl text-stone-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── VIEW: ADD FRIEND ── */}
        {view === 'add' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
            {/* Section 1: Share Invite Link */}
            <div className="p-4 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-pink-600">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-black text-sm text-ink">Share an Invite Link</h3>
              </div>
              <p className="text-xs text-ink-3 font-medium">
                Send a magical link to your partner or friends on WhatsApp, Telegram, or Instagram. When they click, they'll connect with you!
              </p>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 mb-2">Relationship Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {RELATIONSHIP_OPTIONS.map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setFriendRel(opt.type)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                        friendRel === opt.type
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-stone-200 hover:bg-stone-50 text-ink-2'
                      }`}
                    >
                      <span className="text-base">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleShareInviteLink}
                  className="flex-1 btn-chunky btn-green py-3 text-xs flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share Link
                </button>
                <button
                  onClick={() => {
                    const url = `https://knotyetapp.me/invite?n=${encodeURIComponent(profile.name)}&a=${profile.avatarId}&r=${friendRel}&uid=${user?.id || ''}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 transition text-ink-2 text-xs font-bold flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Section 2: Create Manual Contact */}
            <form onSubmit={handleSaveFriend} className="p-4 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-4">
              <h3 className="font-black text-sm text-ink">Or Add Directly</h3>

              <div>
                <label className="block text-xs font-black text-ink mb-1.5">Their Name</label>
                <input
                  type="text"
                  maxLength={25}
                  value={friendName}
                  onChange={e => setFriendName(e.target.value)}
                  placeholder="e.g. Sarah / Alex"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-200 focus:border-pink-500 focus:outline-none text-sm font-bold text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-ink mb-1.5">Pick an Avatar</label>
                <AvatarPicker selected={friendAvatar} onChange={setFriendAvatar} />
              </div>

              <button
                type="submit"
                disabled={!friendName.trim()}
                className="w-full btn-chunky btn-pink py-3 text-sm disabled:opacity-40"
              >
                Save & Start Chatting
              </button>
            </form>
          </div>
        )}

        {/* ── VIEW: DIRECT CHAT ── */}
        {view === 'chat' && selectedFriend && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF9FF]">
            {/* Messages Scroll Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-pink-100 flex items-center justify-center text-2xl animate-float">
                    💬
                  </div>
                  <h4 className="font-black text-ink text-sm">Say hello to {selectedFriend.name}!</h4>
                  <p className="text-xs text-ink-3 max-w-xs">
                    Send a sweet note, a playful reaction, or invite them to play a game together.
                  </p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.senderId === (user?.id || 'me');
                  const av = isMe ? getAvatar(profile.avatarId) : getAvatar(selectedFriend.avatarId);

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMe && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mb-1 border border-stone-200"
                          style={{ background: av?.bg || '#fff' }}
                        >
                          {av?.face}
                        </div>
                      )}

                      <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Game Invite Card */}
                        {msg.gameInvite ? (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md space-y-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🎮</span>
                              <div>
                                <p className="font-black text-xs leading-none">Game Room Invite</p>
                                <p className="text-[10px] text-white/80">Room #{msg.gameInvite.roomCode}</p>
                              </div>
                            </div>
                            <p className="text-xs font-semibold leading-snug">{msg.text}</p>
                            <button
                              onClick={() => handleJoinFromInvite(msg.gameInvite!.roomCode)}
                              className="w-full py-2 rounded-xl bg-white text-pink-600 font-black text-xs shadow-sm hover:bg-pink-50 active:scale-95 transition flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" /> Join Room Now
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`px-3.5 py-2.5 rounded-2xl shadow-sm text-sm font-bold ${
                              isMe
                                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-xs'
                                : 'bg-white text-ink border border-stone-200/80 rounded-bl-xs'
                            } ${msg.isQuickReaction && msg.text.length <= 4 ? 'text-2xl py-1.5 px-3' : ''}`}
                          >
                            {msg.text}
                          </div>
                        )}

                        <span className="text-[9px] font-semibold text-ink-3 mt-0.5 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {isMe && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mb-1 border border-purple-200"
                          style={{ background: av?.bg || '#fff' }}
                        >
                          {av?.face}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reactions */}
            <div className="px-3 py-2 bg-white border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <Smile className="w-3.5 h-3.5 text-pink-500 shrink-0 ml-1" />
              {QUICK_DM_REACTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickReaction(item)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 hover:bg-pink-50 hover:text-pink-600 text-ink-2 border border-stone-200 whitespace-nowrap active:scale-95 transition shrink-0"
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendDM} className="p-3 bg-white border-t border-stone-100 flex items-center gap-2 shrink-0 safe-pb">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={`Message ${selectedFriend.name}...`}
                maxLength={240}
                className="flex-1 px-4 py-3 rounded-full bg-stone-100 text-ink text-sm font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all border border-stone-200"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 disabled:opacity-40 transition-all shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)' }}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
