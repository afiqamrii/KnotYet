import type { ComponentType } from 'react';
import { Dices, Hash, Heart, HeartHandshake, Layers3, TextCursor, type LucideProps } from 'lucide-react';
import type { GameMode } from '../store/MultiplayerContext';

type PlayableTab = Exclude<GameMode, 'lobby' | 'secret-race'>;
type Labels = Record<PlayableTab, string> & Partial<Record<'secret-race', string>>;

interface GameModeNavProps {
  currentTab: GameMode;
  labels: Labels;
  onSelect: (tab: PlayableTab) => void;
}

const MODES: Array<{ id: PlayableTab; shortLabel: string; description: string; shortcut: string; icon: ComponentType<LucideProps> }> = [
  { id: 'swipe', shortLabel: 'Cards', description: 'A little deeper', shortcut: '1', icon: Layers3 },
  { id: 'quiz', shortLabel: 'Heart', description: 'Two players · take turns', shortcut: '2', icon: Heart },
  { id: 'wheel', shortLabel: 'Wheel', description: 'Leave it to luck', shortcut: '3', icon: Dices },
  { id: 'number', shortLabel: 'Numbers', description: 'Solo or take turns', shortcut: '4', icon: Hash },
  { id: 'letter', shortLabel: 'Letters', description: 'Solo or a quick race', shortcut: '5', icon: TextCursor },
  { id: 'match', shortLabel: 'Match', description: 'Two players · private picks', shortcut: '6', icon: HeartHandshake },
  { id: 'choices', shortLabel: 'This or That', description: 'Solo or compare sides', shortcut: '7', icon: Dices },
];

export const GameModeNav = ({ currentTab, labels, onSelect }: GameModeNavProps) => (
  <nav aria-label="Choose your game" className="game-mode-nav arcade-mode-nav">
    {MODES.map(({ id, shortLabel, description, shortcut, icon: Icon }) => {
      const isActive = currentTab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`game-mode-tab game-mode-${id}`}
          aria-current={isActive ? 'page' : undefined}
          aria-label={`${labels[id]}${isActive ? ', selected' : ''}`}
          title={`${labels[id]} (Key ${shortcut})`}
        >
          <span className="game-mode-icon"><Icon aria-hidden="true" /></span>
          <span className="game-mode-copy">
            <span className="game-mode-label"><span className="sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{labels[id]}</span></span>
            <span className="game-mode-description">{description}</span>
          </span>
          <kbd>{shortcut}</kbd>
        </button>
      );
    })}
  </nav>
);

