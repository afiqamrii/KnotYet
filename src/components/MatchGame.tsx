import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, HeartHandshake, RefreshCw, Sparkles } from 'lucide-react';
import { MATCH_QUESTIONS } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import { getContextualMeme } from '../utils/memes';
import { Avatar } from './AvatarPicker';

export const MatchGame: React.FC = () => {
  const { profile, partner, addHeartPoints } = useGame();
  const multiplayer = useMultiplayer();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<'vote' | 'reveal'>('vote');
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [pointsToast, setPointsToast] = useState<{ text: string; positive: boolean; imgUrl: string } | null>(null);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  const currentQuiz = MATCH_QUESTIONS[currentIndex];

  const executeNext = useCallback(() => {
    setAutoNextCountdown(null);
    if (currentIndex + 1 < MATCH_QUESTIONS.length) {
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
  }, [currentIndex, addHeartPoints]);

  const handleRestart = useCallback((broadcast: boolean = true) => {
    setCurrentIndex(0); 
    setStage('vote'); 
    setMyAnswer(null);
    setPartnerAnswer(null); 
    setScore(0); 
    setCompleted(false);
    setPointsToast(null);
    setAutoNextCountdown(null);
    
    if (broadcast && multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'MATCH_RESTART' });
    }
  }, [multiplayer]);

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
          handleRestart(false);
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, executeNext, handleRestart]);

  useEffect(() => {
    if (myAnswer && partnerAnswer && stage === 'vote') {
      setStage('reveal');
      const isMatch = myAnswer === partnerAnswer;
      
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

        setAutoNextCountdown(6);
      });
    }
  }, [myAnswer, partnerAnswer, stage, addHeartPoints, currentQuiz.question]);

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
    const pointsEarned = (score * 15) + ((MATCH_QUESTIONS.length - score) * 5) + HEART_POINTS.COMPLETE_QUIZ;
    return (
      <div className="game-card w-full max-w-md mx-auto p-8 text-center space-y-6 flex flex-col justify-center min-h-[510px]">
        <div className="w-20 h-20 bg-brand text-white rounded-full mx-auto flex items-center justify-center animate-bounce-soft" style={{ boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
          <Trophy className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-ink">Match Score: {score}/{MATCH_QUESTIONS.length}</h2>
          <div className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-black text-white bg-green-500" style={{ boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
            <Sparkles className="w-3 h-3" /> +{pointsEarned} Points Earned!
          </div>
          <p className="text-sm font-semibold text-ink-3 mt-4 mb-2">
            {score === MATCH_QUESTIONS.length ? 'You are a perfect match! 💖' : 'It was so much fun getting to know you better! ✨'}
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

        <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white mt-4">
          <img 
            src={score > MATCH_QUESTIONS.length / 2 ? "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif" : "https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif"} 
            alt="Final Score Meme" 
            className="w-full h-40 object-cover" 
          />
        </div>

        <button onClick={() => handleRestart()} className="btn-chunky btn-pink w-full text-sm">
          <RefreshCw className="w-4 h-4" /> Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="game-card w-full max-w-md mx-auto p-6 sm:p-8 flex flex-col justify-between min-h-[510px] relative">
      {pointsToast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-pop-in flex flex-col gap-4">
            <h3 className={`text-3xl font-black ${pointsToast.positive ? 'text-green-500' : 'text-red-500'}`}>
              {pointsToast.text}
            </h3>
            
            {/* The answers! */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 p-3 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-black text-ink-3 uppercase block mb-1">You</span>
                  <span className="text-sm font-bold text-ink leading-tight">{myAnswer}</span>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-black text-ink-3 uppercase block mb-1">{multiplayer.remoteProfile?.name || 'Partner'}</span>
                  <span className="text-sm font-bold text-ink leading-tight">{partnerAnswer}</span>
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
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black text-white"
          style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 4px 12px rgba(255,45,155,0.35)' }}>
          <HeartHandshake className="w-3.5 h-3.5" /> Compatibility Test
        </div>
        <div className="text-xs font-bold text-ink-3 tracking-widest uppercase">
          Question {currentIndex + 1} / {MATCH_QUESTIONS.length}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center my-6">
        <h3 className="text-2xl font-black text-ink text-center leading-snug">
          {currentQuiz.question}
        </h3>
      </div>

      {/* Options or Reveal */}
      <div className="space-y-3">
        {stage === 'vote' ? (
          <>
            {myAnswer && !partnerAnswer ? (
              <div className="py-10 text-center animate-pulse">
                <p className="text-sm font-bold text-brand mb-2">Waiting for partner...</p>
                <div className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin mx-auto" />
              </div>
            ) : (
              currentQuiz.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  className="w-full p-4 rounded-2xl border-2 border-stone-200 bg-stone-50 text-left font-bold text-ink hover:border-brand hover:bg-indigo-50 transition-all"
                >
                  {opt}
                </button>
              ))
            )}
          </>
        ) : (
          <div className="space-y-6 animate-pop-in">
            <div className="grid grid-cols-2 gap-4">
              {/* You */}
              <div className={`p-4 rounded-2xl border-2 text-center ${myAnswer === partnerAnswer ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className="text-[10px] uppercase font-black text-ink-3 mb-2">You</p>
                <p className="text-sm font-black text-ink leading-tight">{myAnswer}</p>
              </div>
              {/* Partner */}
              <div className={`p-4 rounded-2xl border-2 text-center ${myAnswer === partnerAnswer ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className="text-[10px] uppercase font-black text-ink-3 mb-2">{multiplayer.remoteProfile?.name}</p>
                <p className="text-sm font-black text-ink leading-tight">{partnerAnswer}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
