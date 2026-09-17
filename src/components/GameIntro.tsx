import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sounds } from '../utils/audio';
import { useMultiplayer } from '../store/MultiplayerContext';

type GameType = 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter';

interface GameIntroConfig {
  title: string;
  subtitle: string;
  gifSrc: string;
  gradient: string;
  glowColor: string;
  accentColor: string;
  steps: { title: string; description: string }[];
  buttonText: string;
  buttonGradient: string;
  buttonShadow: string;
  buttonShadowActive: string;
  tipText: string;
  countdownBg: string;
}

const GAME_CONFIGS: Record<GameType, GameIntroConfig> = {
  swipe: {
    title: 'Icebreaker Cards',
    subtitle: 'Questions to break the ice between you!',
    gifSrc: '/icons/swipe-cards.gif',
    gradient: 'linear-gradient(160deg, #FF2D9B 0%, #EC4899 55%, #F472B6 100%)',
    glowColor: 'rgba(255,45,155,0.30)',
    accentColor: '#FF2D9B',
    steps: [
      { title: 'Swipe Right', description: 'If you answered the question' },
      { title: 'Swipe Left', description: 'If you want to skip for now' },
      { title: 'Reveal Answers', description: 'Tap the card to see answers & tips!' },
    ],
    buttonText: 'Start Playing!',
    buttonGradient: 'linear-gradient(135deg, #FF2D9B, #EC4899)',
    buttonShadow: '0 6px 0 #C41D77, 0 8px 24px rgba(255,45,155,0.45)',
    buttonShadowActive: '0 2px 0 #C41D77, 0 4px 12px rgba(255,45,155,0.3)',
    tipText: 'Perfect for playing together while chilling at a cafe!',
    countdownBg: 'linear-gradient(160deg, #FF2D9B 0%, #C41D77 100%)',
  },
  quiz: {
    title: 'Guess My Heart',
    subtitle: 'How well do you really know your partner?',
    gifSrc: '/icons/guess-heart.gif',
    gradient: 'linear-gradient(160deg, #06B6D4 0%, #3B82F6 55%, #7C3AED 100%)',
    glowColor: 'rgba(6,182,212,0.30)',
    accentColor: '#3B82F6',
    steps: [
      { title: 'Secret Choice', description: 'One person secretly picks an answer first' },
      { title: 'Pass the Phone', description: 'Pass the phone to your partner' },
      { title: 'Guessing Time', description: 'Partner guesses the chosen answer!' },
    ],
    buttonText: "Let's Guess!",
    buttonGradient: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
    buttonShadow: '0 6px 0 #0E7490, 0 8px 24px rgba(6,182,212,0.45)',
    buttonShadowActive: '0 2px 0 #0E7490, 0 4px 12px rgba(6,182,212,0.3)',
    tipText: 'The more you get right, the better you match!',
    countdownBg: 'linear-gradient(160deg, #06B6D4 0%, #0E7490 100%)',
  },
  wheel: {
    title: 'Anti-Awkward Wheel',
    subtitle: 'Run out of things to talk about?',
    gifSrc: '/icons/spin-wheel.gif',
    gradient: 'linear-gradient(160deg, #F59E0B 0%, #F97316 55%, #EF4444 100%)',
    glowColor: 'rgba(245,158,11,0.30)',
    accentColor: '#F97316',
    steps: [
      { title: 'Spin the Wheel', description: 'Tap the button to spin the wheel!' },
      { title: 'Random Stop', description: 'The wheel will stop randomly' },
      { title: 'Answer Together', description: 'Answer the question together!' },
    ],
    buttonText: 'Spin Now!',
    buttonGradient: 'linear-gradient(135deg, #F59E0B, #F97316)',
    buttonShadow: '0 6px 0 #B45309, 0 8px 24px rgba(245,158,11,0.45)',
    buttonShadowActive: '0 2px 0 #B45309, 0 4px 12px rgba(245,158,11,0.3)',
    tipText: 'Place the phone in the middle and take turns spinning!',
    countdownBg: 'linear-gradient(160deg, #F59E0B 0%, #B45309 100%)',
  },
  match: {
    title: 'Couple Match',
    subtitle: 'Test your compatibility right now!',
    gifSrc: '/icons/couple-match.gif',
    gradient: 'linear-gradient(160deg, #7C3AED 0%, #A855F7 55%, #EC4899 100%)',
    glowColor: 'rgba(124,58,237,0.30)',
    accentColor: '#A855F7',
    steps: [
      { title: 'Answer Questions', description: 'Both answer the exact same question' },
      { title: 'Reveal Together', description: 'Answers are revealed at the same time!' },
      { title: 'Check Match', description: 'See how many answers match!' },
    ],
    buttonText: 'Start Matching!',
    buttonGradient: 'linear-gradient(135deg, #7C3AED, #A855F7)',
    buttonShadow: '0 6px 0 #5B21B6, 0 8px 24px rgba(124,58,237,0.45)',
    buttonShadowActive: '0 2px 0 #5B21B6, 0 4px 12px rgba(124,58,237,0.3)',
    tipText: 'Answer honestly for the most accurate results!',
    countdownBg: 'linear-gradient(160deg, #7C3AED 0%, #5B21B6 100%)',
  },
  number: {
    title: 'Number Guesser',
    subtitle: 'Who can guess the secret number first?',
    gifSrc: '/icons/guess-heart.gif', // Reuse guess-heart for now
    gradient: 'linear-gradient(160deg, #6366F1 0%, #8B5CF6 55%, #A855F7 100%)',
    glowColor: 'rgba(99,102,241,0.30)',
    accentColor: '#6366F1',
    steps: [
      { title: 'Pick a Number', description: 'Secretly pick a number between 1 and 100' },
      { title: 'Take Turns', description: 'Take turns guessing the number' },
      { title: 'Use Hints', description: 'Get Higher/Lower hints until you win!' },
    ],
    buttonText: 'Start Guessing!',
    buttonGradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    buttonShadow: '0 6px 0 #4338CA, 0 8px 24px rgba(99,102,241,0.45)',
    buttonShadowActive: '0 2px 0 #4338CA, 0 4px 12px rgba(99,102,241,0.3)',
    tipText: 'In Single Player, pass the phone back and forth!',
    countdownBg: 'linear-gradient(160deg, #6366F1 0%, #4338CA 100%)',
  },
  letter: {
    title: 'Letter Race',
    subtitle: 'Be the first to think of a word!',
    gifSrc: '/icons/swipe-cards.gif', // Reuse cards for now
    gradient: 'linear-gradient(160deg, #D946EF 0%, #C026D3 55%, #A21CAF 100%)',
    glowColor: 'rgba(217,70,239,0.30)',
    accentColor: '#D946EF',
    steps: [
      { title: 'Letter Appears', description: 'A random letter will appear on screen' },
      { title: 'Think Fast', description: 'Think of a word starting with that letter' },
      { title: 'Race to Win', description: 'First one to tap/type wins the round!' },
    ],
    buttonText: 'Race Now!',
    buttonGradient: 'linear-gradient(135deg, #D946EF, #C026D3)',
    buttonShadow: '0 6px 0 #A21CAF, 0 8px 24px rgba(217,70,239,0.45)',
    buttonShadowActive: '0 2px 0 #A21CAF, 0 4px 12px rgba(217,70,239,0.3)',
    tipText: 'Place the phone between you for a face-to-face tap race!',
    countdownBg: 'linear-gradient(160deg, #D946EF 0%, #A21CAF 100%)',
  },
};

// Stable random positions — computed once per mount so they don't re-randomize on every render
function useStableParticles(count: number) {
  const ref = useRef(
    Array.from({ length: count }, () => ({
      size: 4 + Math.random() * 8,
      left: Math.random() * 100,
      top: Math.random() * 100,
      opacity: 0.12 + Math.random() * 0.18,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 2,
    }))
  );
  return ref.current;
}

interface GameIntroProps {
  gameType: GameType;
  onStart: () => void;
  countdownTrigger?: boolean;
}

export const GameIntro: React.FC<GameIntroProps> = ({ gameType, onStart, countdownTrigger }) => {
  const config = GAME_CONFIGS[gameType];
  const multiplayer = useMultiplayer();
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'go'>('intro');
  const [countdownNum, setCountdownNum] = useState(3);
  const [stepsVisible, setStepsVisible] = useState<number[]>([]);
  const particles = useStableParticles(10);
  const isMultiplayer = multiplayer.status === 'connected';

  // Stagger step reveal on mount
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    config.steps.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setStepsVisible(prev => [...prev, i]);
      }, 150 + i * 150));
    });
    return () => timers.forEach(clearTimeout);
  }, [gameType]); // reset when game type changes

  const startCountdown = useCallback((broadcast = true) => {
    setPhase('countdown');
    setCountdownNum(3);
    sounds.playFlip();

    if (broadcast && isMultiplayer) {
      multiplayer.sendMessage({ type: 'START_COUNTDOWN', payload: { game: gameType } });
    }

    setTimeout(() => { setCountdownNum(2); sounds.playFlip(); }, 1000);
    setTimeout(() => { setCountdownNum(1); sounds.playFlip(); }, 2000);
    setTimeout(() => { setPhase('go'); sounds.playSuccess(); }, 3000);
    setTimeout(() => { 
      if (broadcast && isMultiplayer) {
        multiplayer.sendMessage({ type: 'START_GAME', payload: { game: gameType } });
      }
      onStart(); 
    }, 3700);
  }, [isMultiplayer, multiplayer, gameType, onStart]);

  // Handle external countdown trigger
  useEffect(() => {
    if (countdownTrigger && phase === 'intro') {
      startCountdown(false);
    }
  }, [countdownTrigger, phase, startCountdown]);

  // Listen for multiplayer sync
  useEffect(() => {
    if (isMultiplayer) {
      const prevListener = multiplayer.messageListener.current;
      multiplayer.messageListener.current = (msg) => {
        if (msg.type === 'START_COUNTDOWN') {
          startCountdown(false);
        } else if (msg.type === 'START_GAME') {
          onStart();
        } else if (prevListener) {
          prevListener(msg);
        }
      };
      return () => {
        multiplayer.messageListener.current = prevListener;
      };
    }
  }, [isMultiplayer, multiplayer, startCountdown, onStart]);

  // ── Countdown / GO screen ──────────────────────────────────────
  if (phase === 'countdown' || phase === 'go') {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden animate-fade-in"
        style={{ background: config.countdownBg }}
      >
        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{
              width: p.size, height: p.size,
              left: `${p.left}%`, top: `${p.top}%`,
              opacity: p.opacity,
              animation: `float-particle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }} />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3">
          {phase === 'go' ? (
            <div className="animate-countdown-pop flex flex-col items-center gap-3">
              <img src={config.gifSrc} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl shadow-2xl"
                style={{ border: '4px solid rgba(255,255,255,0.7)' }} />
              <div className="text-6xl sm:text-7xl font-black text-white drop-shadow-lg tracking-tighter">
                GO!
              </div>
              <div className="text-base sm:text-lg font-bold text-white/90 text-center px-4">
                {config.title}
              </div>
            </div>
          ) : (
            <div key={countdownNum} className="animate-countdown-pop flex flex-col items-center gap-3">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(12px)',
                  border: '4px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                }}>
                <span className="text-7xl sm:text-8xl font-black text-white drop-shadow-xl">{countdownNum}</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white/80 animate-pulse">Get ready...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Intro screen ───────────────────────────────────────────────
  return (
    <div className="game-card w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex-1 flex flex-col justify-between overflow-hidden animate-pop-in shadow-xl my-0.5">

      {/* ── Header ── */}
      <div className="relative px-4 pt-4 pb-3 flex flex-col items-center shrink-0" style={{ background: config.gradient }}>
        <div className="absolute inset-0 dotted-pattern opacity-20" />

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.slice(0, 6).map((p, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{
              width: p.size * 0.7, height: p.size * 0.7,
              left: `${p.left}%`, top: `${p.top}%`,
              opacity: p.opacity * 0.8,
              animation: `float-particle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }} />
          ))}
        </div>

        {/* Animated GIF icon */}
        <div
          className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-xl animate-float mb-1.5"
          style={{
            border: '2.5px solid rgba(255,255,255,0.7)',
            boxShadow: `0 8px 24px ${config.glowColor}, 0 2px 8px rgba(0,0,0,0.12)`,
          }}
        >
          <img src={config.gifSrc} alt={config.title} className="w-full h-full object-cover" />
        </div>

        <h2 className="relative z-10 text-lg sm:text-xl font-black text-white text-center tracking-tight drop-shadow leading-tight">
          {config.title}
        </h2>
        
        {isMultiplayer ? (
          <div className="relative z-10 mt-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-[10px] sm:text-[11px] font-bold text-white flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Playing with <strong>{multiplayer.remoteProfile?.name || 'Partner'}</strong></span>
          </div>
        ) : (
          <p className="relative z-10 text-[11px] sm:text-xs font-semibold text-white/85 text-center mt-0.5 leading-snug">
            {config.subtitle}
          </p>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="flex-1 px-4 py-2.5 relative my-auto flex flex-col justify-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          How to Play
        </p>

        {/* Connecting Line */}
        <div 
          className="absolute left-[29px] top-[40px] bottom-[24px] w-px border-l-2 border-dashed border-slate-200"
          style={{ zIndex: 0 }}
        />

        <div className="space-y-2 sm:space-y-2.5 relative z-10">
          {config.steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5"
              style={{
                opacity: stepsVisible.includes(i) ? 1 : 0,
                transform: stepsVisible.includes(i) ? 'translateY(0)' : 'translateY(12px)',
                transition: 'all 0.4s cubic-bezier(0.34,1.2,0.64,1)',
              }}
            >
              {/* Step number badge */}
              <div
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black flex-shrink-0 transition-all duration-300"
                style={{ 
                  background: 'white',
                  color: stepsVisible.includes(i) ? config.accentColor : '#94A3B8',
                  border: `2px solid ${stepsVisible.includes(i) ? config.accentColor : '#E2E8F0'}`,
                  boxShadow: stepsVisible.includes(i) ? `0 0 0 2px ${config.glowColor}` : 'none',
                }}
              >
                {i + 1}
              </div>

              {/* Text */}
              <div className="flex-1 pt-0.5">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight mb-0.5">{step.title}</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 leading-snug">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-3.5 pb-3.5 pt-1 space-y-2 shrink-0">
        {/* Tip pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background: '#FEF9EE', border: '1.5px solid #FDE68A' }}
        >
          <span className="text-xs flex-shrink-0">💡</span>
          <p className="text-[10px] font-bold text-amber-800 leading-snug">{config.tipText}</p>
        </div>

        {/* Start button */}
        <button
          onClick={() => startCountdown(true)}
          className="w-full py-3 sm:py-3.5 rounded-2xl text-white font-black text-sm sm:text-base tracking-tight flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 shadow-lg"
          style={{
            background: config.buttonGradient,
            boxShadow: config.buttonShadow,
          }}
          onMouseDown={e => (e.currentTarget.style.boxShadow = config.buttonShadowActive)}
          onMouseUp={e => (e.currentTarget.style.boxShadow = config.buttonShadow)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = config.buttonShadow)}
        >
          <img src={config.gifSrc} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg object-cover flex-shrink-0" />
          {isMultiplayer ? "Let's Play Together! 🚀" : config.buttonText}
        </button>
      </div>
    </div>
  );
};
