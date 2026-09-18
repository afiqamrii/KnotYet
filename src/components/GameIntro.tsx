import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ArrowRight, Dices, Hash, Heart, HeartHandshake, Layers3, Lightbulb, Play, Sparkles, TextCursor, Users, type LucideProps } from 'lucide-react';
import { GameArtwork } from './ArcadeArt';
import { sounds } from '../utils/audio';
import { useMultiplayer } from '../store/MultiplayerContext';

type GameType = 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter';

interface GameIntroConfig {
  title: string;
  eyebrow: string;
  subtitle: string;
  accent: string;
  icon: ComponentType<LucideProps>;
  steps: Array<{ title: string; description: string }>;
  buttonText: string;
  tipText: string;
}

const GAME_CONFIGS: Record<GameType, GameIntroConfig> = {
  swipe: {
    title: 'Icebreaker Cards', eyebrow: 'Conversation', subtitle: 'One card. Two perspectives. A conversation you never saw coming.', accent: '#ff829e', icon: Layers3,
    steps: [
      { title: 'Read together', description: 'Take a moment with the prompt before answering.' },
      { title: 'Swipe right', description: 'Move on when the conversation feels complete.' },
      { title: 'Swipe left', description: 'Skip anything that does not fit the moment.' },
    ],
    buttonText: 'Start with a card', tipText: 'There is no perfect answer. Curiosity matters more than speed.',
  },
  quiz: {
    title: 'Guess My Heart', eyebrow: 'How well do you know me?', subtitle: 'Choose privately, make your guess, then reveal together.', accent: '#a9ddf5', icon: Heart,
    steps: [
      { title: 'Choose in private', description: 'One person quietly picks their answer.' },
      { title: 'Pass the phone', description: 'Give your partner space to make a guess.' },
      { title: 'Reveal together', description: 'Compare answers and talk about the surprise.' },
    ],
    buttonText: 'Make the first guess', tipText: 'The interesting part is why you chose the answer—not the score.',
  },
  wheel: {
    title: 'Anti-Awkward Wheel', eyebrow: 'Let chance choose', subtitle: 'A colorful nudge when neither of you knows what to ask next.', accent: '#f9d77e', icon: Dices,
    steps: [
      { title: 'Spin once', description: 'Let the wheel choose a conversation theme.' },
      { title: 'Read the prompt', description: 'Give each other time to think before answering.' },
      { title: 'Follow the thread', description: 'Stay with the topic if it leads somewhere good.' },
    ],
    buttonText: 'Spin a new topic', tipText: 'Put the phone between you so the wheel feels shared.',
  },
  match: {
    title: 'Couple Match', eyebrow: 'Compatibility', subtitle: 'Answer the same question and see where your instincts meet.', accent: '#c7b4ff', icon: HeartHandshake,
    steps: [
      { title: 'Answer separately', description: 'Pick what feels most true without comparing.' },
      { title: 'Reveal together', description: 'Both answers appear at the same moment.' },
      { title: 'Talk it through', description: 'A mismatch can be more interesting than a match.' },
    ],
    buttonText: 'Start matching', tipText: 'Honest answers make the result much more meaningful.',
  },
  number: {
    title: 'Number Guesser', eyebrow: 'A quick challenge', subtitle: 'A simple back-and-forth game with just enough suspense.', accent: '#d5f578', icon: Hash,
    steps: [
      { title: 'Meet the mystery', description: 'The game hides a number from 1 to 100.' },
      { title: 'Take turns', description: 'Alternate guesses so both players stay involved.' },
      { title: 'Use the hints', description: 'Higher and lower clues lead you to the answer.' },
    ],
    buttonText: 'Let the guessing begin', tipText: 'Every guess gets you both closer. Listen to every clue along the way.',
  },
  letter: {
    title: 'Letter Race', eyebrow: 'Think fast', subtitle: 'Find the first word that fits before your partner does.', accent: '#c7b4ff', icon: TextCursor,
    steps: [
      { title: 'See the letter', description: 'A random starting letter appears.' },
      { title: 'Think of a word', description: 'Say or type the first valid word you find.' },
      { title: 'Claim the round', description: 'The fastest correct answer wins.' },
    ],
    buttonText: 'Begin the race', tipText: 'Keep the phone centered so both players see the letter together.',
  },
};

interface GameIntroProps {
  gameType: GameType;
  onStart: () => void;
  countdownTrigger?: boolean;
}

export const GameIntro = ({ gameType, onStart, countdownTrigger }: GameIntroProps) => {
  const config = GAME_CONFIGS[gameType];
  const Icon = config.icon;
  const multiplayer = useMultiplayer();
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'go'>('intro');
  const [countdownNum, setCountdownNum] = useState(3);
  const isMultiplayer = multiplayer.status === 'connected';

  const startCountdown = useCallback((broadcast = true) => {
    setPhase('countdown');
    setCountdownNum(3);
    sounds.playFlip();

    if (broadcast && isMultiplayer) {
      multiplayer.sendMessage({ type: 'START_COUNTDOWN', payload: { game: gameType } });
    }

    window.setTimeout(() => { setCountdownNum(2); sounds.playFlip(); }, 1000);
    window.setTimeout(() => { setCountdownNum(1); sounds.playFlip(); }, 2000);
    window.setTimeout(() => { setPhase('go'); sounds.playSuccess(); }, 3000);
    window.setTimeout(() => {
      if (broadcast && isMultiplayer) multiplayer.sendMessage({ type: 'START_GAME', payload: { game: gameType } });
      onStart();
    }, 3700);
  }, [gameType, isMultiplayer, multiplayer, onStart]);

  useEffect(() => {
    if (countdownTrigger && phase === 'intro') startCountdown(false);
  }, [countdownTrigger, phase, startCountdown]);

  useEffect(() => {
    if (!isMultiplayer) return;
    const previousListener = multiplayer.messageListener.current;
    multiplayer.messageListener.current = (message) => {
      if (message.type === 'START_COUNTDOWN') startCountdown(false);
      else if (message.type === 'START_GAME') onStart();
      else previousListener?.(message);
    };
    return () => { multiplayer.messageListener.current = previousListener; };
  }, [isMultiplayer, multiplayer, onStart, startCountdown]);

  if (phase !== 'intro') {
    return (
      <div className="game-countdown" style={{ '--game-accent': config.accent } as React.CSSProperties} role="status" aria-live="polite">
        <div className="game-countdown-orb">
          {phase === 'go' ? <Icon aria-hidden="true" /> : <span key={countdownNum}>{countdownNum}</span>}
        </div>
        <strong>{phase === 'go' ? 'Let’s play' : 'Get ready'}</strong>
        <p>{config.title}</p>
      </div>
    );
  }

  const artworkKind = gameType === 'swipe' ? 'cards' : gameType === 'quiz' ? 'heart' : gameType;

  return (
    <section className="game-card game-intro-card arcade-intro" style={{ '--game-accent': config.accent } as React.CSSProperties} aria-labelledby={`intro-${gameType}`}>
      <div className="arcade-intro-scene">
        <div className="arcade-scene-topline">
          <span className="arcade-scene-label"><Icon aria-hidden="true" /> {config.eyebrow}</span>
          <Sparkles aria-hidden="true" className="arcade-scene-sparkle" />
        </div>
        <div className="arcade-intro-art" aria-hidden="true">
          <GameArtwork kind={artworkKind} />
        </div>
        <div className="arcade-scene-caption">
          <span className="arcade-player-chip"><Users aria-hidden="true" /> Made for two</span>
          <span className="arcade-handwritten">{gameType === 'swipe' ? 'Skip the small talk.' : gameType === 'letter' || gameType === 'number' ? 'A little friendly rivalry.' : 'Better with your person.'}</span>
        </div>
      </div>

      <div className="arcade-intro-content">
        <header className="arcade-intro-heading">
          <span className="arcade-eyebrow">YOUR NEXT GOOD TIME</span>
          <h2 id={`intro-${gameType}`}>{config.title}</h2>
          <p>{config.subtitle}</p>
          {isMultiplayer ? <div className="game-intro-live"><i /> With {multiplayer.remoteProfile?.name || 'your partner'}</div> : null}
        </header>

        <div className="game-intro-body">
          <span className="game-intro-section-label">Easy to learn. Hard to stop.</span>
          <ol className="game-intro-steps">
            {config.steps.map((step, index) => (
              <li key={step.title}>
                <span>{index + 1}</span>
                <div><strong>{step.title}</strong><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </div>

        <footer className="game-intro-footer">
          <button type="button" onClick={() => startCountdown(true)} className="game-primary-action">
            <Play aria-hidden="true" fill="currentColor" />
            {isMultiplayer ? 'Start together' : config.buttonText}
            <ArrowRight aria-hidden="true" />
          </button>
          <div className="game-intro-tip"><Lightbulb aria-hidden="true" /><p>{config.tipText}</p></div>
        </footer>
      </div>
    </section>
  );
};
