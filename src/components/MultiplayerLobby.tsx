import { ArrowRight, Check, Crown, Heart, LogOut, Users } from 'lucide-react';
import { useMultiplayer, type GameMode } from '../store/MultiplayerContext';
import { useGame } from '../store/GameContext';
import { sounds } from '../utils/audio';
import { getAvatar } from './AvatarPicker';
import { GameArtwork } from './ArcadeArt';
import '../styles/lobby.css';

interface MultiplayerLobbyProps {
  onSelectGame: (game: GameMode) => void;
  onDisconnect: () => void;
}

const GAMES = [
  { id: 'match', title: 'Couple Match', kind: 'match', tag: 'ON THE SAME WAVELENGTH?', description: 'Answer together. See where your minds meet.', color: '#e4d6ff' },
  { id: 'quiz', title: 'Guess My Heart', kind: 'heart', tag: 'YOU KNOW ME SO WELL', description: 'Secret answers. Sweet surprises. Make your guess.', color: '#ffd2dc' },
  { id: 'swipe', title: 'Icebreaker Cards', kind: 'cards', tag: 'LET’S GO A LITTLE DEEPER', description: 'One prompt, two perspectives, a whole new conversation.', color: '#ffe5a0' },
  { id: 'letter', title: 'Letter Race', kind: 'letter', tag: 'READY, SET, THINK', description: 'One letter, two quick minds. Who finds the word first?', color: '#e0f1b5' },
  { id: 'number', title: 'Number Guesser', kind: 'number', tag: 'A FRIENDLY LITTLE RIVALRY', description: 'Follow the clues to crack the mystery number.', color: '#cbeafa' },
  { id: 'wheel', title: 'Spin Wheel', kind: 'wheel', tag: 'LEAVE IT TO LUCK', description: 'Spin up a surprising new conversation topic.', color: '#ffd8b8' },
] as const;

export const MultiplayerLobby = ({ onSelectGame, onDisconnect }: MultiplayerLobbyProps) => {
  const multiplayer = useMultiplayer();
  const { profile } = useGame();
  const isHost = multiplayer.isHost;
  const partnerName = multiplayer.remoteProfile?.name || 'Partner';
  return (
    <section className="couple-lobby" aria-label="Your shared game room">
      <div className="lobby-connection">
        <div className="lobby-avatars" aria-hidden="true"><span>{getAvatar(profile?.avatarId || 'default')?.face}</span><span>{getAvatar(multiplayer.remoteProfile?.avatarId || 'default')?.face}</span></div>
        <div className="lobby-connection-copy"><span><i /> ROOM {multiplayer.roomCode} · CONNECTED</span><h2>{profile?.name} <span>&amp;</span> {partnerName}</h2></div>
        <span className="lobby-role">{isHost ? <Crown /> : <Users />}{isHost ? 'Host' : 'Player two'}</span>
      </div>
      <div className="lobby-heading"><div><span className="lobby-eyebrow">YOUR PERSON IS HERE</span><h3>Let the good times begin<span>.</span></h3><p role="status">{isHost ? 'Pick your next adventure. You’ll both join the same game.' : `Make yourself comfy. ${partnerName} is choosing your game.`}</p></div><Heart aria-hidden="true" /></div>
      <div className="lobby-games">{GAMES.map((game) => <button type="button" key={game.id} className="lobby-game" style={{ '--lobby-color': game.color } as React.CSSProperties} disabled={!isHost} onClick={() => { sounds.playSuccess(); onSelectGame(game.id); }} aria-label={isHost ? `Play ${game.title} together` : `${game.title}, waiting for host`}><div className="lobby-game-art"><GameArtwork kind={game.kind} compact /></div><div className="lobby-game-copy"><span>{game.tag}</span><h4>{game.title}</h4><p>{game.description}</p><span className="lobby-game-action">{isHost ? <>Let’s play <ArrowRight /></> : <>Ready when you are <Check /></>}</span></div></button>)}</div>
      <div className="lobby-bottom"><p><Heart size={14} /> Two players. One good time.</p><button type="button" onClick={onDisconnect}><LogOut size={16} /> Leave room</button></div>
    </section>
  );
};
