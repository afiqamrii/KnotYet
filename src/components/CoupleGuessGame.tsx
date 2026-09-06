import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Sparkles, RefreshCw, Trophy } from 'lucide-react';
import { GUESS_QUIZ_LIST } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import { getContextualMeme } from '../utils/memes';

// Points to award per correct guess
const EARN = HEART_POINTS.CORRECT_GUESS;
const DEDUCT = Math.abs(HEART_POINTS.WRONG_GUESS);

class CoupleGuessErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CoupleGuessGame Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 text-red-900 rounded-xl overflow-auto text-xs font-mono">
          <h2 className="font-bold text-lg">Oops, Crash in Guess Game!</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const CoupleGuessGameInner: React.FC = () => {
  const { t, profile, partner, addHeartPoints, deductHeartPoints } = useGame();
  const { checkLimit, incrementPlayCount } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<'secret' | 'guess' | 'reveal'>('secret');
  const [actualAnswer, setActualAnswer] = useState<string | null>(null);
  const [guessedAnswer, setGuessedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [pointsToast, setPointsToast] = useState<{ text: string; positive: boolean; imgUrl: string } | null>(null);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const multiplayer = useMultiplayer();

  const currentQuiz = GUESS_QUIZ_LIST[currentIndex];
  const isBoyTarget = currentQuiz.targetRole === 'Lelaki';

  const executeNext = useCallback(() => {
    setAutoNextCountdown(null);
    if (currentIndex + 1 < GUESS_QUIZ_LIST.length) {
      setCurrentIndex((p) => p + 1);
      setStage('secret');
      setActualAnswer(null);
      setGuessedAnswer(null);
      setPointsToast(null);
    } else {
      setCompleted(true);
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');
      if (score === GUESS_QUIZ_LIST.length - 1) addHeartPoints(HEART_POINTS.PERFECT_QUIZ, multiplayer.status === 'connected'); 
      confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 }, colors: ['#FF2D9B', '#7C3AED', '#06B6D4', '#10B981', '#FACC15'] });
    }
  }, [currentIndex, score, addHeartPoints]);

  const handleNext = useCallback(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_NEXT' });
    }
    executeNext();
  }, [multiplayer, executeNext]);

  const handleRestart = useCallback((broadcast: boolean = true) => {
    setCurrentIndex(0); 
    setStage('secret'); 
    setActualAnswer(null);
    setGuessedAnswer(null); 
    setScore(0); 
    setCompleted(false);
    setPointsToast(null);
    setAutoNextCountdown(null);
    
    if (broadcast && multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_RESTART' });
    }
  }, [multiplayer]);

  const showToast = (text: string, positive: boolean, imgUrl: string) => {
    setPointsToast({ text, positive, imgUrl });
  };

  const receiveGuess = useCallback(async (option: string) => {
    setGuessedAnswer(option);
    const isMatch = option === actualAnswer;
    const randomMeme = await getContextualMeme(currentQuiz.question, isMatch);

    if (isMatch) {
      setScore((p) => p + 1);
      addHeartPoints(EARN, multiplayer.status === 'connected');
      showToast(t.earnedPoints(EARN), true, randomMeme);
      sounds.playSuccess();
      confetti({
        particleCount: 80, spread: 90, origin: { y: 0.6 },
        colors: ['#FF2D9B', '#7C3AED', '#06B6D4', '#10B981', '#FACC15'],
      });
    } else {
      deductHeartPoints(DEDUCT);
      showToast(t.deductedPoints(DEDUCT), false, randomMeme);
      sounds.playMismatch();
    }
    setStage('reveal');
    setAutoNextCountdown(6);
  }, [actualAnswer, currentQuiz.question, t, addHeartPoints, deductHeartPoints]);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'QUIZ_ACTUAL') {
          setActualAnswer(msg.payload);
          sounds.playFlip();
          setStage('guess');
        } else if (msg.type === 'QUIZ_GUESS') {
          receiveGuess(msg.payload);
        } else if (msg.type === 'QUIZ_NEXT') {
          executeNext();
        } else if (msg.type === 'QUIZ_RESTART') {
          handleRestart(false);
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, executeNext, handleRestart, receiveGuess]);

  const handleSelectActual = (option: string) => {
    if (currentIndex === 0 && multiplayer.status !== 'connected' && !checkLimit('solo')) {
      return;
    }

    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_ACTUAL', payload: option });
    }
    setActualAnswer(option);
    sounds.playFlip();
    setStage('guess');
  };

  useEffect(() => {
    let timer: any;
    if (autoNextCountdown !== null && autoNextCountdown > 0) {
      timer = setTimeout(() => setAutoNextCountdown(c => c! - 1), 1000);
    } else if (autoNextCountdown === 0) {
      setAutoNextCountdown(null);
      if (multiplayer.status !== 'connected' || multiplayer.isHost) {
        handleNext();
      }
    }
    return () => clearTimeout(timer);
  }, [autoNextCountdown, multiplayer.status, multiplayer.isHost]);

  const handleSelectGuess = (option: string) => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_GUESS', payload: option });
    }
    receiveGuess(option);
  };



  const percentage = Math.round((score / GUESS_QUIZ_LIST.length) * 100);

  // ---- Option button colors (cycling) ----
  const OPTS = [
    { border: '#7C3AED', bg: '#EDE9FE', text: '#5B21B6', num: '#7C3AED' },
    { border: '#06B6D4', bg: '#CFFAFE', text: '#0E7490', num: '#06B6D4' },
    { border: '#F59E0B', bg: '#FEF3C7', text: '#92400E', num: '#F59E0B' },
    { border: '#10B981', bg: '#D1FAE5', text: '#047857', num: '#10B981' },
  ];

  // ---- COMPLETED ----
  if (completed) {
    const compatNote = percentage >= 80 ? t.quizCompatNote80 : percentage >= 50 ? t.quizCompatNote50 : t.quizCompatNote0;
    return (
      <div className="game-card w-full max-w-sm mx-auto p-6 text-center space-y-5 animate-pop-in">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-btn-pink animate-float"
          style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 8px 24px rgba(255,45,155,0.4)' }}>
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <div>
          <span className="tag" style={{ background: '#FCE7F3', color: '#FF2D9B', border: '2px solid #FBCFE8' }}>
            {t.quizSummaryTitle}
          </span>
          <h2 className="text-4xl font-black text-ink mt-2">{percentage}%</h2>
          <p className="text-sm text-ink-3 font-semibold">Green Flag!</p>
          <p className="text-xs text-ink-3 mt-1">{t.quizSummaryScore(score, GUESS_QUIZ_LIST.length)}</p>
        </div>
        <div className="p-4 rounded-2xl text-left text-xs text-ink-2 leading-relaxed space-y-2"
          style={{ background: '#F5F3FF', border: '2px solid #DDD6FE' }}>
          <div className="font-black text-brand flex items-center gap-1.5">
            <Heart className="w-4 h-4 fill-brand text-brand" /> Compatibility Note:
          </div>
          <p className="font-semibold">{compatNote}</p>
        </div>

        {/* Partners display */}
        {profile && partner && (
          <div className="flex items-center justify-center gap-4 p-3 rounded-2xl" style={{ background: '#FFF0F9' }}>
            <div className="text-center">
              <Avatar avatarId={profile.avatarId} size={40} />
              <p className="text-[10px] font-black text-ink mt-1">{profile.heartPoints} pts</p>
            </div>
            <div className="text-2xl">💗</div>
            <div className="text-center">
              <Avatar avatarId={partner.avatarId} size={40} />
              <p className="text-[10px] font-black text-ink-3 mt-1">{partner.name}</p>
            </div>
          </div>
        )}
        
        <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white mt-4">
          <img 
            src={percentage >= 50 ? "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif" : "https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif"} 
            alt="Final Score Meme" 
            className="w-full h-40 object-cover" 
          />
        </div>

        <button onClick={() => handleRestart(true)} className="btn-chunky btn-pink w-full text-sm">
          <RefreshCw className="w-4 h-4" /> {t.quizRestart}
        </button>
      </div>
    );
  }

  return (
    <div className="game-card w-full max-w-sm mx-auto p-5 space-y-4 flex flex-col justify-between min-h-[510px] relative">
      {/* Full screen meme modal */}
      {pointsToast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-pop-in flex flex-col gap-4">
            <h3 className={`text-3xl font-black ${pointsToast.positive ? 'text-green-500' : 'text-red-500'}`}>
              {actualAnswer === guessedAnswer ? t.quizMatchTitle : t.quizMissTitle}
            </h3>
            
            <p className={`text-lg font-black ${pointsToast.positive ? 'text-green-600' : 'text-red-600'}`}>
              {pointsToast.text}
            </p>
            
            {/* The answers! */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 p-3 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-black text-ink-3 uppercase block mb-1">Target Answer</span>
                  <span className="text-sm font-bold text-ink leading-tight">{actualAnswer}</span>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-black text-ink-3 uppercase block mb-1">Guessed</span>
                  <span className="text-sm font-bold text-ink leading-tight">{guessedAnswer}</span>
                </div>
              </div>
            </div>

            {/* The Meme */}
            <div className="rounded-2xl overflow-hidden bg-stone-100 border-4 border-stone-100 shadow-inner">
              <img src={pointsToast.imgUrl} alt="Reaction" className="w-full h-48 object-cover" />
            </div>

            {autoNextCountdown !== null && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm font-black text-brand animate-pulse">Next question in {autoNextCountdown}...</p>
                <button 
                  onClick={() => {
                    handleNext();
                  }}
                  className="px-4 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-black transition-colors"
                >
                  Skip <span className="ml-1">→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-ink-3">Question {currentIndex + 1} / {GUESS_QUIZ_LIST.length}</span>
          <span className="hearts-pill">
            <Heart className="w-3 h-3 fill-current" /> {profile?.heartPoints ?? 0} pts
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((currentIndex + 1) / GUESS_QUIZ_LIST.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black text-white"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
          🎯 {t.quizHeader(currentQuiz.targetRole)}
        </div>
        <h3 className="text-lg font-black text-ink leading-snug">{currentQuiz.question}</h3>
        <p className="text-[11px] text-ink-3 italic">{currentQuiz.vibeText}</p>
      </div>

      {/* STAGE 1: Secret pick */}
      {stage === 'secret' && (
        <div className="space-y-3 animate-slide-up">
          <div className="p-3 rounded-2xl text-center"
            style={{ background: '#FEF3C7', border: '2px solid #FDE68A' }}>
            <p className="text-xs font-black text-amber-800">
              🤫 {t.quizSecretPrompt(currentQuiz.targetRole)}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5 font-medium">{t.quizSecretHint}</p>
          </div>
          <div className="space-y-2">
            {currentQuiz.options.map((opt, i) => {
              const s = OPTS[i % OPTS.length];
              return (
                <button key={i} onClick={() => handleSelectActual(opt)}
                  className="option-btn"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; (e.currentTarget as HTMLElement).style.background = s.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}>
                  <span className="font-bold text-sm">{opt}</span>
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: s.num }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STAGE 2: Partner guesses */}
      {stage === 'guess' && (
        <div className="space-y-3 animate-slide-up">
          <div className="p-3 rounded-2xl text-center"
            style={{ background: '#EDE9FE', border: '2px solid #DDD6FE' }}>
            <p className="text-xs font-black text-brand">
              👀 {t.quizGuessPrompt(isBoyTarget ? 'Perempuan' : 'Lelaki')}
            </p>
            <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">{t.quizGuessHint}</p>
          </div>
          <div className="space-y-2">
            {currentQuiz.options.map((opt, i) => {
              const s = OPTS[i % OPTS.length];
              return (
                <button key={i} onClick={() => handleSelectGuess(opt)}
                  className="option-btn"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; (e.currentTarget as HTMLElement).style.background = s.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}>
                  <span className="font-bold text-sm">{opt}</span>
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: s.num }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STAGE 3: Reveal is handled by the pointsToast modal above! */}
      {stage === 'reveal' && (
        <div className="flex-1 flex items-center justify-center animate-pulse">
           <p className="text-sm font-bold text-ink-3">Showing results...</p>
        </div>
      )}

      {/* Tip */}
      <div className="text-center text-[10px] text-ink-3 flex items-center justify-center gap-1 font-semibold">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {t.quizTip}
      </div>
    </div>
  );
};

export const CoupleGuessGame: React.FC = () => (
  <CoupleGuessErrorBoundary>
    <CoupleGuessGameInner />
  </CoupleGuessErrorBoundary>
);
