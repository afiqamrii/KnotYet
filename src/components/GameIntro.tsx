import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sounds } from '../utils/audio';

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
}

export const GameIntro: React.FC<GameIntroProps> = ({ gameType, onStart }) => {
  const config = GAME_CONFIGS[gameType];
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'go'>('intro');
  const [countdownNum, setCountdownNum] = useState(3);
  const [stepsVisible, setStepsVisible] = useState<number[]>([]);
  const particles = useStableParticles(10);

  // Stagger step reveal on mount
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    config.steps.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setStepsVisible(prev => [...prev, i]);
      }, 250 + i * 220));
    });
    return () => timers.forEach(clearTimeout);
  }, [gameType]); // reset when game type changes

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdownNum(3);
    sounds.playFlip();
    setTimeout(() => { setCountdownNum(2); sounds.playFlip(); }, 1000);
    setTimeout(() => { setCountdownNum(1); sounds.playFlip(); }, 2000);
    setTimeout(() => { setPhase('go'); sounds.playSuccess(); }, 3000);
    setTimeout(() => { onStart(); }, 3700);
  }, [onStart]);

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

        <div className="relative z-10 flex flex-col items-center gap-4">
          {phase === 'go' ? (
            <div className="animate-countdown-pop flex flex-col items-center gap-3">
              <img src={config.gifSrc} alt="" className="w-24 h-24 rounded-3xl shadow-2xl"
                style={{ border: '4px solid rgba(255,255,255,0.7)' }} />
              <div className="text-7xl font-black text-white drop-shadow-lg tracking-tighter">
                GO!
              </div>
              <div className="text-lg font-bold text-white/90 text-center">
                {config.title}
              </div>
            </div>
          ) : (
            <div key={countdownNum} className="animate-countdown-pop flex flex-col items-center gap-4">
              <div className="w-36 h-36 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(12px)',
                  border: '4px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                }}>
                <span className="text-8xl font-black text-white drop-shadow-xl">{countdownNum}</span>
              </div>
              <p className="text-base font-bold text-white/80 animate-pulse">Get ready...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Intro screen ───────────────────────────────────────────────
  return (
    <div className="game-card w-full max-w-sm mx-auto flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar animate-pop-in shadow-xl my-0.5">

      {/* ── Header ── */}
      <div className="relative px-5 pt-5 pb-4 flex flex-col items-center shrink-0" style={{ background: config.gradient }}>
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
          className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl animate-float mb-2 sm:mb-3"
          style={{
            border: '3px solid rgba(255,255,255,0.65)',
            boxShadow: `0 12px 36px ${config.glowColor}, 0 4px 12px rgba(0,0,0,0.12)`,
          }}
        >
          <img src={config.gifSrc} alt={config.title} className="w-full h-full object-cover" />
        </div>

        <h2 className="relative z-10 text-xl sm:text-2xl font-black text-white text-center tracking-tight drop-shadow leading-tight">
          {config.title}
        </h2>
        <p className="relative z-10 text-xs font-semibold text-white/85 text-center mt-0.5 leading-snug">
          {config.subtitle}
        </p>
      </div>

      {/* ── Steps ── */}
      <div className="flex-1 px-5 pt-3 pb-1 relative my-auto flex flex-col justify-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
          How to Play
        </p>

        {/* Connecting Line */}
        <div 
          className="absolute left-[33px] top-[48px] bottom-[28px] w-px border-l-2 border-dashed border-slate-200"
          style={{ zIndex: 0 }}
        />

        <div className="space-y-2.5 sm:space-y-3.5 relative z-10">
          {config.steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5"
              style={{
                opacity: stepsVisible.includes(i) ? 1 : 0,
                transform: stepsVisible.includes(i) ? 'translateY(0)' : 'translateY(16px)',
                transition: 'all 0.5s cubic-bezier(0.34,1.2,0.64,1)',
              }}
            >
              {/* Step number badge */}
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all duration-300"
                style={{ 
                  background: 'white',
                  color: stepsVisible.includes(i) ? config.accentColor : '#94A3B8',
                  border: `2px solid ${stepsVisible.includes(i) ? config.accentColor : '#E2E8F0'}`,
                  boxShadow: stepsVisible.includes(i) ? `0 0 0 3px ${config.glowColor}` : 'none',
                }}
              >
                {i + 1}
              </div>

              {/* Text */}
              <div className="flex-1 pt-0.5">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-none mb-1">{step.title}</h4>
                <p className="text-[11px] sm:text-xs font-medium text-slate-500 leading-snug">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 pb-4 pt-1.5 space-y-2.5 shrink-0">
        {/* Tip pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: '#FEF9EE', border: '1.5px solid #FDE68A' }}
        >
          <span className="text-sm flex-shrink-0">💡</span>
          <p className="text-[10px] sm:text-[11px] font-bold text-amber-800 leading-snug">{config.tipText}</p>
        </div>

        {/* Start button */}
        <button
          onClick={startCountdown}
          className="w-full py-3.5 rounded-2xl text-white font-black text-sm sm:text-base tracking-tight flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 shadow-lg"
          style={{
            background: config.buttonGradient,
            boxShadow: config.buttonShadow,
          }}
          onMouseDown={e => (e.currentTarget.style.boxShadow = config.buttonShadowActive)}
          onMouseUp={e => (e.currentTarget.style.boxShadow = config.buttonShadow)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = config.buttonShadow)}
        >
          <img src={config.gifSrc} alt="" className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
          {config.buttonText}
        </button>
      </div>
    </div>
  );
};
