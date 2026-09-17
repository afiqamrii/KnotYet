import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Sparkles, RefreshCw, Trophy } from 'lucide-react';
import { GuessQuizItem } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import { getContextualMeme } from '../utils/memes';
import { getShuffledGuessQuestions, getGuessQuestionsByIds, markQuestionAsSeen } from '../utils/questionManager';

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

interface Props {
  onEndGame?: () => void;
}

const CoupleGuessGameInner: React.FC<Props> = ({ onEndGame }) => {
  const { t, profile, partner, addHeartPoints, deductHeartPoints, recordAnsweredQuestion } = useGame();
  const { checkLimit, incrementPlayCount } = useAuth();

  const multiplayer = useMultiplayer();
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';

  const [questions, setQuestions] = useState<GuessQuizItem[]>(() => {
    try {
      const stored = sessionStorage.getItem('guess_questions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return getShuffledGuessQuestions(10);
  });

  const [currentIndex, setCurrentIndex] = useState(() => Number(sessionStorage.getItem('guess_currentIndex')) || 0);
  const [stage, setStage] = useState<'secret' | 'handover' | 'guess' | 'reveal'>(() => (sessionStorage.getItem('guess_stage') as any) || 'secret');
  const [actualAnswer, setActualAnswer] = useState<string | null>(() => sessionStorage.getItem('guess_actualAnswer') || null);
  const [guessedAnswer, setGuessedAnswer] = useState<string | null>(() => sessionStorage.getItem('guess_guessedAnswer') || null);
  const [score, setScore] = useState(() => Number(sessionStorage.getItem('guess_score')) || 0);
  const [completed, setCompleted] = useState(() => sessionStorage.getItem('guess_completed') === 'true');
  const [pointsToast, setPointsToast] = useState<{ text: string; positive: boolean; imgUrl: string } | null>(null);
  const [isMySecret, setIsMySecret] = useState<boolean>(() => sessionStorage.getItem('guess_isMySecret') === 'true');

  useEffect(() => {
    sessionStorage.setItem('guess_questions', JSON.stringify(questions));
    sessionStorage.setItem('guess_currentIndex', currentIndex.toString());
    sessionStorage.setItem('guess_stage', stage);
    if (actualAnswer) sessionStorage.setItem('guess_actualAnswer', actualAnswer); else sessionStorage.removeItem('guess_actualAnswer');
    if (guessedAnswer) sessionStorage.setItem('guess_guessedAnswer', guessedAnswer); else sessionStorage.removeItem('guess_guessedAnswer');
    sessionStorage.setItem('guess_score', score.toString());
    sessionStorage.setItem('guess_completed', completed.toString());
    sessionStorage.setItem('guess_isMySecret', isMySecret.toString());
  }, [questions, currentIndex, stage, actualAnswer, guessedAnswer, score, completed, isMySecret]);

  const currentQuiz = questions[currentIndex] || questions[0] || { id: 'gq-0', targetRole: 'Lelaki' as const, question: '', options: [], vibeText: '' };
  const isBoyTarget = currentQuiz.targetRole === 'Lelaki';

  // Host broadcasts the shuffled question deck so both are in sync
  useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && questions.length > 0) {
      multiplayer.sendMessage({
        type: 'SYNC_QUESTION_IDS',
        payload: { game: 'quiz', questionIds: questions.map(q => q.id) }
      });
    }
  }, [multiplayer.status, multiplayer.isHost, questions]);

  const executeNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((p) => p + 1);
      setStage('secret');
      setActualAnswer(null);
      setGuessedAnswer(null);
      setIsMySecret(false);
      setPointsToast(null);
    } else {
      setCompleted(true);
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');
      if (score === questions.length - 1) addHeartPoints(HEART_POINTS.PERFECT_QUIZ, multiplayer.status === 'connected'); 
      confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 }, colors: ['#FF2D9B', '#7C3AED', '#06B6D4', '#10B981', '#FACC15'] });
    }
  }, [currentIndex, score, addHeartPoints, multiplayer.status, incrementPlayCount, questions.length]);

  const handleNext = useCallback(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_NEXT' });
    }
    executeNext();
  }, [multiplayer, executeNext]);

  const handleRestart = useCallback((broadcast: boolean = true, newQList?: GuessQuizItem[]) => {
    const nextQuestions = newQList || getShuffledGuessQuestions(10);
    setQuestions(nextQuestions);
    setCurrentIndex(0); 
    setStage('secret'); 
    setActualAnswer(null);
    setGuessedAnswer(null); 
    setIsMySecret(false);
    setScore(0); 
    setCompleted(false);
    setPointsToast(null);
    
    if (broadcast && multiplayer.status === 'connected') {
      multiplayer.sendMessage({ 
        type: 'QUIZ_RESTART',
        payload: { questionIds: nextQuestions.map(q => q.id) }
      });
    }
  }, [multiplayer]);

  const showToast = (text: string, positive: boolean, imgUrl: string) => {
    setPointsToast({ text, positive, imgUrl });
  };

  const receiveGuess = useCallback(async (option: string) => {
    setGuessedAnswer(option);
    const isMatch = option === actualAnswer;
    
    // Mark question as answered in persistent history so it will not repeat
    if (currentQuiz?.id) {
      markQuestionAsSeen(currentQuiz.id);
      recordAnsweredQuestion(currentQuiz.id);
    }
    
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
  }, [actualAnswer, currentQuiz, t, addHeartPoints, deductHeartPoints, multiplayer.status, recordAnsweredQuestion]);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'QUIZ_ACTUAL') {
          setIsMySecret(false);
          setActualAnswer(msg.payload);
          sounds.playFlip();
          setStage('guess');
        } else if (msg.type === 'QUIZ_GUESS') {
          receiveGuess(msg.payload);
        } else if (msg.type === 'QUIZ_NEXT') {
          executeNext();
        } else if (msg.type === 'QUIZ_RESTART') {
          const synced = msg.payload?.questionIds ? getGuessQuestionsByIds(msg.payload.questionIds) : undefined;
          handleRestart(false, synced);
        } else if (msg.type === 'SYNC_QUESTION_IDS' && msg.payload.game === 'quiz') {
          const synced = getGuessQuestionsByIds(msg.payload.questionIds);
          if (synced.length > 0) setQuestions(synced);
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, executeNext, handleRestart, receiveGuess]);

  const handleSelectActual = (option: string) => {
    if (currentIndex === 0 && multiplayer.status !== 'connected' && !checkLimit('solo')) {
      return;
    }

    if (multiplayer.status === 'connected') {
      setIsMySecret(true);
      multiplayer.sendMessage({ type: 'QUIZ_ACTUAL', payload: option });
      setActualAnswer(option);
      sounds.playFlip();
      setStage('guess');
    } else {
      // Single player: go to handover screen so guesser can't see highlighted selection
      setActualAnswer(option);
      sounds.playFlip();
      setStage('handover');
    }
  };

  const handleHandoverReady = () => {
    sounds.playFlip();
    setStage('guess');
  };

  useEffect(() => {
    // If we need any cleanup for timer etc, we do it here. But auto countdown is removed.
  }, [multiplayer.status, multiplayer.isHost]);

  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    }
  };

  const handleSelectGuess = (option: string) => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'QUIZ_GUESS', payload: option });
    }
    receiveGuess(option);
  };



  const percentage = Math.round((score / questions.length) * 100);

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
      <div className="w-full max-w-sm flex-1 flex flex-col justify-between h-full animate-fade-in">
        {/* Standardized Game Header */}
        <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #3B82F6)' }}>
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Guess My Heart</h2>
              <p className="text-[10px] font-bold text-white/80">Completed!</p>
            </div>
          </div>
          <button onClick={handleEndGame} className="text-xs font-bold text-white/80 hover:text-white transition px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/15 flex items-center gap-1 active:scale-95 shadow-sm">
            End Game
          </button>
        </div>

        <div className="game-card w-full flex-1 flex flex-col justify-between p-6 text-center space-y-4 animate-pop-in overflow-y-auto no-scrollbar">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-btn-pink animate-float mt-2"
            style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 8px 24px rgba(255,45,155,0.4)' }}>
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <div>
            <span className="tag" style={{ background: '#FCE7F3', color: '#FF2D9B', border: '2px solid #FBCFE8' }}>
              {t.quizSummaryTitle}
            </span>
            <h2 className="text-4xl font-black text-ink mt-2">{percentage}%</h2>
            <p className="text-sm text-ink-3 font-semibold">Green Flag!</p>
            <p className="text-xs text-ink-3 mt-1">{t.quizSummaryScore(score, questions.length)}</p>
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
          
          <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white mt-2">
            <img 
              src={percentage >= 50 ? "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif" : "https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif"} 
              alt="Final Score Meme" 
              className="w-full h-36 object-cover" 
            />
          </div>

          <button onClick={() => handleRestart(true)} className="btn-chunky btn-pink w-full text-sm py-3.5">
            <RefreshCw className="w-4 h-4" /> {t.quizRestart}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 sm:space-y-3 mx-auto">
      {/* Standardized Game Header Bar */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #3B82F6)' }}>
            <Heart className="w-4 h-4 fill-white" />
          </div>
          <div>
            <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Guess My Heart</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
              <span>Question {currentIndex + 1} / {questions.length}</span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-pink-500/80 text-white text-[9px] font-black">
                💖 {profile?.heartPoints ?? 0} pts
              </span>
            </div>
          </div>
        </div>
        <button onClick={handleEndGame} className="text-xs font-bold text-white/80 hover:text-white transition px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/15 flex items-center gap-1 active:scale-95 shadow-sm">
          End Game
        </button>
      </div>

      {/* Main Game Card - Full Height Flexible */}
      <div className="game-card w-full flex-1 flex flex-col justify-between p-3.5 sm:p-5 overflow-hidden relative animate-pop-in">
        {/* Full screen meme modal */}
        {pointsToast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-4 sm:p-5 rounded-3xl w-full max-w-xs sm:max-w-sm text-center shadow-2xl animate-pop-in flex flex-col gap-2.5 max-h-[85dvh] overflow-y-auto no-scrollbar">
              <h3 className={`text-xl sm:text-2xl font-black ${pointsToast.positive ? 'text-green-500' : 'text-red-500'}`}>
                {actualAnswer === guessedAnswer ? t.quizMatchTitle : t.quizMissTitle}
              </h3>
              
              <p className={`text-sm sm:text-base font-black ${pointsToast.positive ? 'text-green-600' : 'text-red-600'}`}>
                {pointsToast.text}
              </p>
              
              {/* The answers! */}
              <div className="flex items-center justify-center gap-2">
                <div className="flex-1 p-2 sm:p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-black text-ink-3 uppercase block mb-0.5">Target Answer</span>
                  <span className="text-xs sm:text-sm font-bold text-ink leading-tight line-clamp-2">{actualAnswer}</span>
                </div>
                <div className="flex-1 p-2 sm:p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-black text-ink-3 uppercase block mb-0.5">Guessed</span>
                  <span className="text-xs sm:text-sm font-bold text-ink leading-tight line-clamp-2">{guessedAnswer}</span>
                </div>
              </div>

              {/* The Meme - constrained height so button never cuts off */}
              <div className="rounded-xl overflow-hidden bg-stone-100 border-2 border-stone-200 shadow-inner max-h-36 sm:max-h-40 flex items-center justify-center">
                <img 
                  src={pointsToast.imgUrl} 
                  alt="Reaction Meme" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              <button 
                onClick={() => {
                  handleNext();
                }}
                className="w-full py-2.5 sm:py-3 rounded-2xl font-black text-white text-sm sm:text-base transition shadow-md shadow-brand-500/25 flex items-center justify-center bg-brand hover:bg-brand-dark active:scale-95 shrink-0 mt-1"
              >
                Next Question <span className="ml-2">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Progress Bar inside Card */}
        <div className="w-full shrink-0 mb-1.5">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question Area - Auto-scaled */}
        <div className="text-center space-y-1 shrink-0 my-auto py-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}>
            🎯 {t.quizHeader(currentQuiz.targetRole)}
          </div>
          <h3 className={`font-black text-ink leading-snug px-1 ${
            currentQuiz.question.length > 60 ? 'text-xs sm:text-sm md:text-base' : 'text-sm sm:text-base md:text-lg'
          }`}>
            {currentQuiz.question}
          </h3>
          {currentQuiz.vibeText && (
            <p className="text-[10px] text-ink-3 italic line-clamp-1">{currentQuiz.vibeText}</p>
          )}
        </div>

      {/* STAGE 1: Secret pick */}
      {stage === 'secret' && (
        <div className="space-y-2 animate-slide-up">
          <div className="py-1 px-2.5 rounded-xl text-center"
            style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A' }}>
            <p className="text-[11px] font-black text-amber-800 leading-tight">
              🤫 {t.quizSecretPrompt(currentQuiz.targetRole)}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2.5">
            {currentQuiz.options.map((opt, i) => {
              const s = OPTS[i % OPTS.length];
              return (
                <button key={i} onClick={() => handleSelectActual(opt)}
                  className="option-btn"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; (e.currentTarget as HTMLElement).style.background = s.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}>
                  <span className="font-bold text-xs sm:text-sm leading-tight">{opt}</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                    style={{ background: s.num }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STAGE 1.5: Pass the phone handover (single player only) */}
      {stage === 'handover' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 animate-pop-in px-2 my-auto">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-lg animate-handover-pulse"
            style={{ border: '3px solid rgba(124,58,237,0.3)', boxShadow: '0 8px 24px rgba(124,58,237,0.2)' }}>
            <img src="/icons/pass-phone.jpg" alt="Pass phone" className="w-full h-full object-cover" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base sm:text-lg font-black text-ink leading-tight">
              Chosen! No peeking
            </h3>
            <p className="text-xs text-ink-3 font-semibold leading-snug">
              Hand phone to <span className="text-brand font-black">{isBoyTarget ? 'the Girl' : 'the Boy'}</span>!
            </p>
          </div>
          <button
            onClick={handleHandoverReady}
            className="w-full py-3 rounded-2xl text-white font-black text-sm tracking-tight transition active:scale-95 flex items-center justify-center gap-2 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
              boxShadow: '0 4px 0 #5B21B6, 0 6px 16px rgba(124,58,237,0.4)',
            }}
          >
            I'm Ready to Guess!
          </button>
        </div>
      )}

      {/* STAGE 2: Partner guesses */}
      {stage === 'guess' && (
        multiplayer.status === 'connected' && isMySecret ? (
          <div className="py-4 text-center animate-slide-up space-y-3 bg-purple-50/90 border-2 border-purple-200 rounded-2xl p-4">
            <div className="p-2.5 rounded-xl bg-white border border-purple-100 shadow-sm text-center">
              <span className="text-[10px] font-black uppercase text-purple-400 block mb-0.5">Your Secret Choice</span>
              <span className="text-xs sm:text-sm font-black text-ink leading-tight">{actualAnswer}</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-brand mb-1 flex items-center justify-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-brand animate-ping" />
                Waiting for {partnerName} to guess...
              </p>
              <p className="text-[10px] font-semibold text-ink-3">Can {partnerName} read your heart correctly? 💖</p>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-2 animate-slide-up">
            <div className="py-2 px-3 rounded-xl text-center"
              style={{ background: '#EDE9FE', border: '1.5px solid #DDD6FE' }}>
              <p className="text-[11px] font-black text-brand leading-tight">
                {multiplayer.status === 'connected' ? (
                  <>⚡ {partnerName} has locked in their secret answer! Can you guess it?</>
                ) : (
                  <>👀 {t.quizGuessPrompt(isBoyTarget ? 'Perempuan' : 'Lelaki')}</>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2.5">
              {currentQuiz.options.map((opt, i) => {
                const s = OPTS[i % OPTS.length];
                return (
                  <button key={i} onClick={() => handleSelectGuess(opt)}
                    className="option-btn"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; (e.currentTarget as HTMLElement).style.background = s.bg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}>
                    <span className="font-bold text-xs sm:text-sm leading-tight">{opt}</span>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                      style={{ background: s.num }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* STAGE 3: Reveal is handled by the pointsToast modal above! */}
      {stage === 'reveal' && (
        <div className="flex-1 flex items-center justify-center animate-pulse">
           <p className="text-sm font-bold text-ink-3">Showing results...</p>
        </div>
      )}

      {/* Tip */}
      <div className="text-center text-[9px] sm:text-[10px] text-ink-3 flex items-center justify-center gap-1 font-semibold shrink-0 pt-1">
        <Sparkles className="w-3 h-3 text-amber-500" /> {t.quizTip}
      </div>
    </div>
  </div>
  );
};

export const CoupleGuessGame: React.FC<Props> = (props) => (
  <CoupleGuessErrorBoundary>
    <CoupleGuessGameInner {...props} />
  </CoupleGuessErrorBoundary>
);
