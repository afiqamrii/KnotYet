import React from 'react';
import { 
  HeartHandshake, 
  Heart, 
  Layers, 
  Hash, 
  Zap, 
  Dices, 
  Sparkles, 
  Play, 
  Crown, 
  Users, 
  Clock 
} from 'lucide-react';
import { useMultiplayer, GameMode } from '../store/MultiplayerContext';
import { useGame } from '../store/GameContext';
import { sounds } from '../utils/audio';
import { getAvatar } from './AvatarPicker';

interface MultiplayerLobbyProps {
  onSelectGame: (game: GameMode) => void;
  onDisconnect: () => void;
}

interface GameCardConfig {
  id: GameMode;
  title: string;
  badge: string;
  badgeColor: string;
  tag: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
}

const GAMES: GameCardConfig[] = [
  {
    id: 'match',
    title: 'Couple Match',
    badge: '💖 Most Popular',
    badgeColor: '#EC4899',
    tag: 'Compatibility Test',
    description: 'Answer identical questions simultaneously to test if your minds are in sync!',
    icon: <HeartHandshake className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    shadowColor: 'rgba(124, 58, 237, 0.35)',
  },
  {
    id: 'quiz',
    title: 'Guess My Heart',
    badge: '🎯 Deep Bonding',
    badgeColor: '#06B6D4',
    tag: 'Secret Quiz',
    description: 'One partner answers secretly while the other tries to guess what they chose!',
    icon: <Heart className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
    shadowColor: 'rgba(6, 182, 212, 0.35)',
  },
  {
    id: 'swipe',
    title: 'Icebreaker Cards',
    badge: '💬 Deep Talk',
    badgeColor: '#F43F5E',
    tag: 'Question Cards',
    description: 'Flip through thought-provoking and spicy prompts together at your own pace.',
    icon: <Layers className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #FF2D9B 0%, #E11D48 100%)',
    shadowColor: 'rgba(255, 45, 155, 0.35)',
  },
  {
    id: 'letter',
    title: 'Letter Race',
    badge: '⚡ Fast Reflexes',
    badgeColor: '#D946EF',
    tag: 'Speed Challenge',
    description: 'A random letter drops! Be the fastest to type or shout a matching word.',
    icon: <Zap className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #D946EF 0%, #A21CAF 100%)',
    shadowColor: 'rgba(217, 70, 239, 0.35)',
  },
  {
    id: 'number',
    title: 'Number Guesser',
    badge: '🔢 Mind Duel',
    badgeColor: '#6366F1',
    tag: 'Higher / Lower',
    description: 'Secret number duel! Use higher and lower hints to crack the secret first.',
    icon: <Hash className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
    shadowColor: 'rgba(99, 102, 241, 0.35)',
  },
  {
    id: 'wheel',
    title: 'Spin Wheel',
    badge: '🎲 Date Ideas',
    badgeColor: '#F59E0B',
    tag: 'Spontaneous',
    description: 'Spin the wheel for fun date challenges, romantic dares, and surprise activities.',
    icon: <Dices className="w-5 h-5 text-white" />,
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    shadowColor: 'rgba(245, 158, 11, 0.35)',
  },
];

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onSelectGame,
  onDisconnect
}) => {
  const multiplayer = useMultiplayer();
  const { profile } = useGame();

  const isHost = multiplayer.isHost;
  const partnerName = multiplayer.remoteProfile?.name || 'Partner';
  const partnerAvatar = getAvatar(multiplayer.remoteProfile?.avatarId || 'default');
  const myAvatar = getAvatar(profile?.avatarId || 'default');

  const handleCardClick = (gameId: GameMode) => {
    if (!isHost) {
      sounds.playFlip();
      return;
    }
    sounds.playSuccess();
    onSelectGame(gameId);
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between h-full animate-fade-in space-y-3 max-w-sm mx-auto overflow-hidden">
      
      {/* ── Partner Connection Status Hero ── */}
      <div 
        className="w-full rounded-3xl p-3.5 sm:p-4 text-white shadow-xl relative overflow-hidden shrink-0 border border-white/20"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.85) 0%, rgba(5, 150, 105, 0.95) 100%)',
          backdropFilter: 'blur(16px)'
        }}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-300 opacity-20 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          {/* Linked Avatars */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center">
              <div className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center text-2xl border-2 border-white z-10">
                {myAvatar?.face}
              </div>
              <div className="w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-2xl border-2 border-white -ml-3 z-0">
                {partnerAvatar?.face}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                <p className="text-xs font-black tracking-wide text-white leading-tight">Room #{multiplayer.roomCode}</p>
              </div>
              <p className="text-sm font-black text-white leading-snug">
                {profile?.name} & {partnerName}
              </p>
            </div>
          </div>

          {/* Role badge */}
          <div className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/20 flex items-center gap-1">
            {isHost ? (
              <>
                <Crown className="w-3 h-3 text-amber-300" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">Host</span>
              </>
            ) : (
              <>
                <Users className="w-3 h-3 text-emerald-200" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Guest</span>
              </>
            )}
          </div>
        </div>

        {/* Status prompt */}
        <div className="mt-2.5 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] font-bold text-white/90">
          {isHost ? (
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span>Tap any game below to start playing together!</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 animate-pulse text-emerald-100">
              <Clock className="w-3.5 h-3.5" />
              <span>Waiting for <strong>{partnerName}</strong> to pick a game...</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Games Scroll Area ── */}
      <div className="w-full flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-0.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black uppercase tracking-widest text-white/80">
            {isHost ? '🎮 Select Game Mode' : '🎮 Available Games'}
          </p>
          <span className="text-[10px] font-bold text-white/60">6 Modes Ready</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {GAMES.map((game) => (
            <div
              key={game.id}
              onClick={() => handleCardClick(game.id)}
              className={`w-full rounded-2xl p-3.5 bg-white/95 backdrop-blur-md border transition-all duration-200 shadow-md relative overflow-hidden text-left flex items-center justify-between group ${
                isHost 
                  ? 'hover:bg-white hover:scale-[1.01] active:scale-[0.98] cursor-pointer border-white/60 hover:shadow-lg' 
                  : 'cursor-default border-white/40'
              }`}
            >
              {/* Left Color Bar */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: game.gradient }}
              />

              <div className="flex items-start gap-3 pl-1 flex-1">
                {/* Icon Container */}
                <div 
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform"
                  style={{ background: game.gradient, boxShadow: `0 4px 14px ${game.shadowColor}` }}
                >
                  {game.icon}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-sm text-ink leading-tight">{game.title}</h3>
                    <span 
                      className="text-[9px] font-black px-2 py-0.5 rounded-full text-white leading-none"
                      style={{ background: game.badgeColor }}
                    >
                      {game.badge}
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-ink-3 font-medium line-clamp-2 mt-0.5 leading-snug">
                    {game.description}
                  </p>
                  
                  <div className="flex items-center gap-1 text-[9px] font-bold text-stone-400 mt-1">
                    <span>✨ {game.tag}</span>
                  </div>
                </div>
              </div>

              {/* Right Action */}
              <div className="shrink-0 pl-2">
                {isHost ? (
                  <button 
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110 shadow-sm"
                    style={{ background: game.gradient, color: 'white' }}
                  >
                    <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                  </button>
                ) : (
                  <span className="text-[10px] font-black text-stone-400 px-2 py-1 bg-stone-100 rounded-lg">
                    Ready
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Disconnect Bar ── */}
      <div className="w-full shrink-0 pt-1">
        <button
          onClick={onDisconnect}
          className="w-full py-2.5 rounded-2xl font-bold text-xs text-white/80 hover:text-white bg-black/20 hover:bg-red-500/80 backdrop-blur-md border border-white/15 transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>Leave Multiplayer Room</span>
        </button>
      </div>

    </div>
  );
};
