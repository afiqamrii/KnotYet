import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowRight, Dices, Hash, Heart, HeartHandshake, Layers3, Lightbulb, Play, Sparkles, TextCursor, Users, type LucideProps } from 'lucide-react';
import { GameArtwork } from './ArcadeArt';
import { sounds } from '../utils/audio';
import { useMultiplayer } from '../store/MultiplayerContext';

type GameType = 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter' | 'secret-race' | 'choices';

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
    title: 'Icebreaker Cards', eyebrow: 'Conversation', subtitle: 'Quick answers, unexpected laughs, and a little room for the deeper stuff.', accent: '#ff829e', icon: Layers3,
    steps: [
      { title: 'Read the prompt', description: 'Answer to yourself or talk it through together.' },
      { title: 'Swipe right', description: 'Move on when the conversation feels complete.' },
      { title: 'Swipe left', description: 'Skip anything that does not fit the moment.' },
    ],
    buttonText: 'Start with a card', tipText: 'The mixed deck keeps things light between deeper questions. Skip any card you like.',
  },
  quiz: {
    title: 'Guess My Heart', eyebrow: 'How well do you know me?', subtitle: 'Choose privately, make your guess, then reveal together.', accent: '#a9ddf5', icon: Heart,
    steps: [
      { title: 'Choose in private', description: 'One person quietly picks their answer.' },
      { title: 'Pass the phone', description: 'Give your partner space to make a guess.' },
      { title: 'Reveal together', description: 'Compare answers and talk about the surprise.' },
    ],
    buttonText: 'Choose the first secret answer', tipText: 'Two players: share a phone or join an online room. Take turns choosing and guessing.',
  },
  wheel: {
    title: 'Anti-Awkward Wheel', eyebrow: 'Let chance choose', subtitle: 'Spin for a fresh question. Reflect on your own or talk together.', accent: '#f9d77e', icon: Dices,
    steps: [
      { title: 'Spin once', description: 'Let the wheel choose a conversation theme.' },
      { title: 'Read the prompt', description: 'Some are quick, some are playful, and some need a moment.' },
      { title: 'Follow the thread', description: 'Stay with the topic if it leads somewhere good.' },
    ],
    buttonText: 'Spin a new topic', tipText: 'Answer, then tap Answered. If a prompt does not fit, skip it and spin again.',
  },
  match: {
    title: 'Couple Match', eyebrow: 'Compatibility', subtitle: 'Answer the same question and see where your instincts meet.', accent: '#c7b4ff', icon: HeartHandshake,
    steps: [
      { title: 'Answer separately', description: 'Pick what feels most true without comparing.' },
      { title: 'Reveal together', description: 'Both answers appear at the same moment.' },
      { title: 'Talk it through', description: 'A mismatch can be more interesting than a match.' },
    ],
    buttonText: 'Start matching', tipText: 'Two players: share a phone or play online. Each person chooses privately before the reveal.',
  },
  number: {
    title: 'Number Guesser', eyebrow: 'A quick challenge', subtitle: 'Find the hidden number on your own, or make it a friendly contest.', accent: '#d5f578', icon: Hash,
    steps: [
      { title: 'Meet the mystery', description: 'The game hides a number from 1 to 100.' },
      { title: 'Choose your pace', description: 'Play solo, share a phone, or take turns in an online room.' },
      { title: 'Use the hints', description: 'Higher and lower clues lead you to the answer.' },
    ],
    buttonText: 'Let the guessing begin', tipText: 'Aim for fewer guesses. Every clue narrows the range.',
  },
  letter: {
    title: 'Letter Race', eyebrow: 'Think fast', subtitle: 'One starting letter. How quickly can you find a word?', accent: '#c7b4ff', icon: TextCursor,
    steps: [
      { title: 'Read the letter', description: 'Every round begins with a fresh starting letter.' },
      { title: 'Find your word', description: 'Type a real word, or say it aloud when sharing a phone.' },
      { title: 'Claim the round', description: 'Practise solo or race your partner. On one phone, tap the winner’s side.' },
    ],
    buttonText: 'Begin the race', tipText: 'Real words only. For a close call, agree together and keep playing.',
  },
  choices: {
    title: 'This or That', eyebrow: 'Go with your instinct', subtitle: 'Two good options. One honest choice. See what your answer says about you.', accent: '#f9d77e', icon: HeartHandshake,
    steps: [
      { title: 'Pick your side', description: 'Choose the option that feels more like you.' },
      { title: 'Compare, if you like', description: 'Play solo, pass the phone, or reveal with your partner online.' },
      { title: 'Keep it flowing', description: 'Quick picks and playful questions give the deeper ones room to land.' },
    ],
    buttonText: 'Make a choice', tipText: 'Different answers are a conversation starter. You do not need to agree.',
  },
  'secret-race': {
    title: 'Secret Number Race', eyebrow: 'Locked in', subtitle: 'Choose privately, reveal together, then race for the answer.', accent: '#b8f1df', icon: Hash,
    steps: [
      { title: 'Pick in secret', description: 'Lock a number without showing your partner.' },
      { title: 'Reveal at GO', description: 'Both numbers appear together after the countdown.' },
      { title: 'Race the answer', description: 'The quickest correct answer earns the round.' },
    ],
    buttonText: 'Start the best of five', tipText: 'For subtraction, the host number always comes first. Negative answers count.',
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

  const timerIds = useRef<number[]>([]);
  const phaseRef = useRef<'intro' | 'countdown' | 'go'>('intro');
  const completed = useRef(false);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const clearCountdown = useCallback(() => {
    timerIds.current.forEach(timer => window.clearTimeout(timer));
    timerIds.current = [];
  }, []);

  const finishCountdown = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    clearCountdown();
    onStartRef.current();
  }, [clearCountdown]);

  useEffect(() => {
    clearCountdown();
    completed.current = false;
    phaseRef.current = 'intro';
    setPhase('intro');
    setCountdownNum(3);
    return clearCountdown;
  }, [gameType, isMultiplayer, clearCountdown]);

  const startCountdown = useCallback((broadcast = true) => {
    if (phaseRef.current !== 'intro' || completed.current) return;
    if (broadcast && isMultiplayer && !multiplayer.isHost) return;
    phaseRef.current = 'countdown';
    setPhase('countdown');
    setCountdownNum(3);
    sounds.playFlip();

    if (broadcast && isMultiplayer) {
      multiplayer.sendMessage({ type: 'START_COUNTDOWN', payload: { game: gameType } });
    }

    timerIds.current = [
      window.setTimeout(() => { setCountdownNum(2); sounds.playFlip(); }, 1000),
      window.setTimeout(() => { setCountdownNum(1); sounds.playFlip(); }, 2000),
      window.setTimeout(() => { phaseRef.current = 'go'; setPhase('go'); sounds.playSuccess(); }, 3000),
      window.setTimeout(() => {
        // The host commits the start, so both devices use the same round.
        if (isMultiplayer && !multiplayer.isHost) return;
        if (broadcast && isMultiplayer) multiplayer.sendMessage({ type: 'START_GAME', payload: { game: gameType } });
        finishCountdown();
      }, 3700),
    ];
  }, [gameType, isMultiplayer, multiplayer.isHost, multiplayer.sendMessage, finishCountdown]);

  useEffect(() => {
    if (countdownTrigger && phase === 'intro') startCountdown(false);
  }, [countdownTrigger, phase, startCountdown]);

  useEffect(() => {
    if (!isMultiplayer || multiplayer.isHost) return;
    return multiplayer.subscribeMessage((message) => {
      if (message.type === 'START_COUNTDOWN' && message.payload.game === gameType) startCountdown(false);
      else if (message.type === 'START_GAME' && message.payload.game === gameType) finishCountdown();
    });
  }, [isMultiplayer, multiplayer.isHost, multiplayer.subscribeMessage, gameType, finishCountdown, startCountdown]);

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

  const artworkKind = gameType === 'swipe' ? 'cards' : gameType === 'quiz' ? 'heart' : gameType === 'secret-race' ? 'number' : gameType === 'choices' ? 'match' : gameType;

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
          <span className="arcade-player-chip"><Users aria-hidden="true" /> {gameType === 'secret-race' ? 'Two devices' : gameType === 'quiz' || gameType === 'match' ? 'Same phone or online' : 'Solo or together'}</span>
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
          <button type="button" onClick={() => startCountdown(true)} disabled={isMultiplayer && !multiplayer.isHost} className="game-primary-action">
            <Play aria-hidden="true" fill="currentColor" />
            {isMultiplayer ? multiplayer.isHost ? 'Start together' : 'Waiting for the host' : config.buttonText}
            <ArrowRight aria-hidden="true" />
          </button>
          <div className="game-intro-tip"><Lightbulb aria-hidden="true" /><p>{config.tipText}</p></div>
        </footer>
      </div>
    </section>
  );
};
