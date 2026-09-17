import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, HeartHandshake, RefreshCw, Sparkles } from 'lucide-react';
import { MatchQuestion } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import { getContextualMeme } from '../utils/memes';
import { Avatar } from './AvatarPicker';
import { getShuffledMatchQuestions, getMatchQuestionsByIds, markQuestionAsSeen } from '../utils/questionManager';

interface Props {
  onEndGame?: () => void;
}

class MatchGameErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("MatchGame Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 text-red-900 rounded-xl overflow-auto text-xs font-mono">
          <h2 className="font-bold text-lg">Oops, Crash in Match Game!</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const MatchGameInner: React.FC<Props> = ({ onEndGame }) => {
  const { profile, partner, addHeartPoints, recordAnsweredQuestion } = useGame();
  const multiplayer = useMultiplayer();
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';

  const [questions, setQuestions] = useState<MatchQuestion[]>(() => {
    try {
      const stored = sessionStorage.getItem('match_questions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return getShuffledMatchQuestions(10);
  });

  const [currentIndex, setCurrentIndex] = useState(() => Number(sessionStorage.getItem('match_currentIndex')) || 0);
  const [stage, setStage] = useState<'vote' | 'reveal'>(() => (sessionStorage.getItem('match_stage') as any) || 'vote');
  const [myAnswer, setMyAnswer] = useState<string | null>(() => sessionStorage.getItem('match_myAnswer') || null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(() => sessionStorage.getItem('match_partnerAnswer') || null);
  const [score, setScore] = useState(() => Number(sessionStorage.getItem('match_score')) || 0);
  const [completed, setCompleted] = useState(() => sessionStorage.getItem('match_completed') === 'true');
  const [pointsToast, setPointsToast] = useState<{ text: string; positive: boolean; imgUrl: string } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('match_questions', JSON.stringify(questions));
    sessionStorage.setItem('match_currentIndex', currentIndex.toString());
    sessionStorage.setItem('match_stage', stage);
    if (myAnswer) sessionStorage.setItem('match_myAnswer', myAnswer); else sessionStorage.removeItem('match_myAnswer');
    if (partnerAnswer) sessionStorage.setItem('match_partnerAnswer', partnerAnswer); else sessionStorage.removeItem('match_partnerAnswer');
    sessionStorage.setItem('match_score', score.toString());
    sessionStorage.setItem('match_completed', completed.toString());
  }, [questions, currentIndex, stage, myAnswer, partnerAnswer, score, completed]);

  const currentQuiz = questions[currentIndex] || questions[0] || { id: 'm-0', question: '', options: [], vibeText: '' };

  // Host broadcasts the shuffled question deck to partner so both are 100% in sync
  useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && questions.length > 0) {
      multiplayer.sendMessage({
        type: 'SYNC_QUESTION_IDS',
        payload: { game: 'match', questionIds: questions.map(q => q.id) }
      });
    }
  }, [multiplayer.status, multiplayer.isHost, questions]);

  const executeNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((p) => p + 1);
      setStage('vote');
      setMyAnswer(null);
      setPartnerAnswer(null);
      setPointsToast(null);
    } else {
      setCompleted(true);
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');
      confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 }, colors: ['#FF2D9B', '#7C3AED'] });
    }
  }, [currentIndex, questions.length, addHeartPoints, multiplayer.status]);

  const handleRestart = useCallback((broadcast: boolean = true, newQList?: MatchQuestion[]) => {
    const nextQuestions = newQList || getShuffledMatchQuestions(10);
    setQuestions(nextQuestions);
    setCurrentIndex(0); 
    setStage('vote'); 
    setMyAnswer(null);
    setPartnerAnswer(null); 
    setScore(0); 
    setCompleted(false);
    setPointsToast(null);
    
    if (broadcast && multiplayer.status === 'connected') {
      multiplayer.sendMessage({ 
        type: 'MATCH_RESTART',
        payload: { questionIds: nextQuestions.map(q => q.id) }
      });
    }
  }, [multiplayer]);

  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    }
  };

  const handleNext = useCallback(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'MATCH_NEXT' });
    }
    executeNext();
  }, [multiplayer, executeNext]);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'MATCH_SELECT') {
          setPartnerAnswer(msg.payload);
        } else if (msg.type === 'MATCH_NEXT') {
          executeNext();
        } else if (msg.type === 'MATCH_RESTART') {
          const synced = msg.payload?.questionIds ? getMatchQuestionsByIds(msg.payload.questionIds) : undefined;
          handleRestart(false, synced);
        } else if (msg.type === 'SYNC_QUESTION_IDS' && msg.payload.game === 'match') {
          const synced = getMatchQuestionsByIds(msg.payload.questionIds);
          if (synced.length > 0) setQuestions(synced);
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, executeNext, handleRestart]);

  useEffect(() => {
    if (myAnswer && partnerAnswer && stage === 'vote') {
      setStage('reveal');
      const isMatch = myAnswer === partnerAnswer;
      
      // Mark question as answered in persistent history so it will not repeat
      if (currentQuiz?.id) {
        markQuestionAsSeen(currentQuiz.id);
        recordAnsweredQuestion(currentQuiz.id);
      }
      
      getContextualMeme(currentQuiz.question, isMatch).then((randomMeme) => {
        if (isMatch) {
          setScore((s) => s + 1);
          addHeartPoints(15, multiplayer.status === 'connected');
          showToast("Perfect Match! 💖", true, randomMeme);
          sounds.playSuccess();
          confetti({
            particleCount: 100, spread: 90, origin: { y: 0.6 },
            colors: ['#FF2D9B', '#10B981']
          });
        } else {
          addHeartPoints(5, multiplayer.status === 'connected');
          showToast("Different Tastes! 🌟", false, randomMeme);
          sounds.playMismatch();
        }
      });
    }
  }, [myAnswer, partnerAnswer, stage, addHeartPoints, currentQuiz, multiplayer.status, recordAnsweredQuestion]);

  useEffect(() => {
    // Timer removed, manual next button will handle progression
  }, [multiplayer.status, multiplayer.isHost]);

  const showToast = (text: string, positive: boolean, imgUrl: string) => {
    setPointsToast({ text, positive, imgUrl });
  };

  const handleSelect = (option: string) => {
    if (myAnswer) return;
    sounds.playFlip();
    setMyAnswer(option);
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'MATCH_SELECT', payload: option });
    }
  };



  if (completed) {
    const pointsEarned = (score * 15) + ((questions.length - score) * 5) + HEART_POINTS.COMPLETE_QUIZ;
    return (
      <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 mx-auto">
        {/* Standardized Game Header */}
        <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Couple Match</h2>
              <p className="text-[10px] font-bold text-white/80">Completed!</p>
            </div>
          </div>
          <button onClick={handleEndGame} className="text-xs font-bold text-white/80 hover:text-white transition px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/15 flex items-center gap-1 active:scale-95 shadow-sm">
            End Game
          </button>
        </div>

        <div className="game-card w-full flex-1 flex flex-col justify-between p-6 text-center space-y-4 animate-pop-in overflow-y-auto no-scrollbar">
          <div className="w-20 h-20 bg-brand text-white rounded-full mx-auto flex items-center justify-center animate-bounce-soft" style={{ boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-ink">Match Score: {score}/{questions.length}</h2>
            <div className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-black text-white bg-green-500" style={{ boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
              <Sparkles className="w-3 h-3" /> +{pointsEarned} Points Earned!
            </div>
            <p className="text-sm font-semibold text-ink-3 mt-4 mb-2">
              {score === questions.length ? 'You are a perfect match! 💖' : 'It was so much fun getting to know you better! ✨'}
            </p>
          </div>
          
          {/* Partners display */}
          {profile && partner && (
            <div className="flex items-center justify-center gap-4 p-3 rounded-2xl" style={{ background: '#FFF0F9' }}>
              <div className="text-center">
                <Avatar avatarId={profile.avatarId} size={40} />
                <p className="text-[10px] font-black text-ink mt-1">{profile.heartPoints} pts</p>
              </div>
              <div className="text-2xl">💖</div>
              <div className="text-center">
                <Avatar avatarId={partner.avatarId} size={40} />
                <p className="text-[10px] font-black text-ink-3 mt-1">{partner.name}</p>
              </div>
            </div>
          )}

          <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white mt-2">
            <img 
              src={score > questions.length / 2 ? "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif" : "https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif"} 
              alt="Final Score Meme" 
              className="w-full h-36 object-cover" 
            />
          </div>

          <button onClick={() => handleRestart()} className="btn-chunky btn-pink w-full text-sm py-3.5">
            <RefreshCw className="w-4 h-4" /> Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 mx-auto">
      {/* Standardized Game Header Bar */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Couple Match</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
              <span>Question {currentIndex + 1} / {questions.length}</span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-purple-500/80 text-white text-[9px] font-black">
                ✨ Compatibility
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
      {pointsToast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-4 sm:p-5 rounded-3xl w-full max-w-xs sm:max-w-sm text-center shadow-2xl animate-pop-in flex flex-col gap-2.5 max-h-[85dvh] overflow-y-auto no-scrollbar">
            <h3 className={`text-xl sm:text-2xl font-black ${pointsToast.positive ? 'text-green-500' : 'text-red-500'}`}>
              {pointsToast.text}
            </h3>
            
            {/* The answers! */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex-1 p-2 sm:p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[9px] font-black text-ink-3 uppercase block mb-0.5">You</span>
                <span className="text-xs sm:text-sm font-bold text-ink leading-tight line-clamp-2">{myAnswer}</span>
              </div>
              <div className="flex-1 p-2 sm:p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[9px] font-black text-ink-3 uppercase block mb-0.5">{multiplayer.remoteProfile?.name || 'Partner'}</span>
                <span className="text-xs sm:text-sm font-bold text-ink leading-tight line-clamp-2">{partnerAnswer}</span>
              </div>
            </div>

            {/* The Meme - constrained height so button never cuts off */}
            <div className="rounded-xl overflow-hidden bg-stone-100 border-2 border-stone-200 shadow-inner max-h-36 sm:max-h-40 flex items-center justify-center">
              <img src={pointsToast.imgUrl} alt="Reaction" className="w-full h-28 sm:h-36 object-contain" />
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

      {/* Top Progress Bar */}
      <div className="w-full shrink-0 mb-2">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question - Dynamically Scaled */}
      <div className="flex-1 flex flex-col justify-center my-auto py-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white mx-auto mb-2"
          style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 2px 8px rgba(255,45,155,0.3)' }}>
          <HeartHandshake className="w-3 h-3" /> Compatibility Test
        </div>
        <h3 className={`font-black text-ink leading-snug px-2 ${
          currentQuiz.question.length > 60 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
        }`}>
          {currentQuiz.question}
        </h3>
      </div>

      {/* Options or Reveal */}
      <div className="space-y-2 shrink-0">
        {stage === 'vote' ? (
          <>
            {myAnswer && !partnerAnswer ? (
              <div className="py-4 text-center animate-slide-up space-y-3 bg-purple-50/90 border-2 border-purple-200 rounded-2xl p-4">
                <div className="p-2.5 rounded-xl bg-white border border-purple-100 shadow-sm text-center">
                  <span className="text-[10px] font-black uppercase text-purple-400 block mb-0.5">You Picked</span>
                  <span className="text-xs sm:text-sm font-black text-ink leading-tight">{myAnswer}</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-brand mb-1 flex items-center justify-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-brand animate-ping" />
                    Waiting for {partnerName} to pick...
                  </p>
                  <p className="text-[10px] font-semibold text-ink-3">Hang tight! Both answers will reveal together.</p>
                </div>
                <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin mx-auto" />
              </div>
            ) : (
              <>
                {partnerAnswer && !myAnswer && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-200 text-center animate-bounce-soft mb-2">
                    <p className="text-xs font-black text-amber-800 flex items-center justify-center gap-1.5">
                      <span>⚡</span> {partnerName} has already picked! Waiting for your choice...
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {currentQuiz.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(opt)}
                      className="w-full py-2.5 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl border-2 border-stone-200 bg-stone-50 text-left font-bold text-xs sm:text-sm text-ink hover:border-brand hover:bg-indigo-50 active:scale-[0.98] transition-all flex items-center justify-between"
                    >
                      <span className="leading-snug">{opt}</span>
                      <span className="text-xs text-stone-400 font-bold ml-2 shrink-0"># {i + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="space-y-4 animate-pop-in">
            <div className="grid grid-cols-2 gap-3">
              {/* You */}
              <div className={`p-3 rounded-2xl border-2 text-center ${myAnswer === partnerAnswer ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className="text-[10px] uppercase font-black text-ink-3 mb-1">You</p>
                <p className="text-xs sm:text-sm font-black text-ink leading-tight">{myAnswer}</p>
              </div>
              {/* Partner */}
              <div className={`p-3 rounded-2xl border-2 text-center ${myAnswer === partnerAnswer ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className="text-[10px] uppercase font-black text-ink-3 mb-1">{multiplayer.remoteProfile?.name || 'Partner'}</p>
                <p className="text-xs sm:text-sm font-black text-ink leading-tight">{partnerAnswer}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};
export const MatchGame: React.FC<Props> = (props) => (
  <MatchGameErrorBoundary>
    <MatchGameInner {...props} />
  </MatchGameErrorBoundary>
);
