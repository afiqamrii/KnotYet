import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Zap } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

class LetterRaceErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('LetterRace error:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-red-500 font-bold mb-2">Oops, something went wrong in Letter Race!</h2>
          <button onClick={() => this.setState({hasError: false})} className="btn-chunky btn-white px-4 py-2">Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  onEndGame?: () => void;
}

const LetterRaceGameInner: React.FC<Props> = ({ onEndGame }) => {
  const { profile, partner, addHeartPoints } = useGame();
  const { checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const isMultiplayer = multiplayer.status === 'connected';
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';

  const [stage, setStage] = useState<'wait' | 'countdown' | 'race' | 'winner'>(() => (sessionStorage.getItem('letter_stage') as any) || 'wait');
  const [letter, setLetter] = useState<string | null>(() => sessionStorage.getItem('letter_char') || null);
  const [winner, setWinner] = useState<{name: string, word: string} | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('letter_winner') || 'null');
    } catch { return null; }
  });
  
  const [countdown, setCountdown] = useState(3);
  const [inputValue, setInputValue] = useState('');
  const [winGif, setWinGif] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem('letter_stage', stage);
    if (letter) sessionStorage.setItem('letter_char', letter); else sessionStorage.removeItem('letter_char');
    if (winner) sessionStorage.setItem('letter_winner', JSON.stringify(winner)); else sessionStorage.removeItem('letter_winner');
  }, [stage, letter, winner]);

  const startRace = () => {
    if (multiplayer.status !== 'connected' && !checkLimit('solo')) return;

    const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'LETTER_START', payload: randomLetter });
    }
    
    beginCountdown(randomLetter);
  };

  const beginCountdown = (char: string) => {
    setLetter(char);
    setStage('countdown');
    setCountdown(3);
    sounds.playFlip();

    setTimeout(() => { setCountdown(2); sounds.playFlip(); }, 1000);
    setTimeout(() => { setCountdown(1); sounds.playFlip(); }, 2000);
    setTimeout(() => { 
      setStage('race'); 
      sounds.playSuccess(); 
    }, 3000);
  };

  const handleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue || !letter) return;
    if (!inputValue.toUpperCase().startsWith(letter)) return; // Must start with letter
    
    const word = inputValue;
    
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'LETTER_WORD_SUBMIT', payload: word });
    }
    
    processWin(profile?.name || 'Player', word);
    setInputValue('');
  };

  const processWin = async (winnerName: string, winningWord: string) => {
    if (stage === 'winner') return; // Prevent double trigger
    
    setWinner({ name: winnerName, word: winningWord });
    setStage('winner');
    sounds.playSuccess();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    
    if (multiplayer.status !== 'connected') incrementPlayCount('solo');
    addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');

    const { getWinMeme } = await import('../utils/memes');
    const gif = await getWinMeme();
    setWinGif(gif);
  };

  // Face to Face (Single Player) Tap logic
  const handleFaceToFaceTap = (player: 'top' | 'bottom') => {
    const winnerName = player === 'bottom' ? (profile?.name || 'Player') : (partner?.name || 'Partner');
    processWin(winnerName, "First to tap!");
  };

  const handleNextRound = () => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'LETTER_NEXT' });
    }
    resetRound();
  };

  const resetRound = useCallback(() => {
    setLetter(null);
    setWinner(null);
    setStage('wait');
    setInputValue('');
    setWinGif(null);
  }, []);

  // Desktop & Keyboard Shortcut Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (stage === 'wait') {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
          e.preventDefault();
          if (!isMultiplayer || multiplayer.isHost) {
            startRace();
          }
        }
      } else if (stage === 'race' && !isMultiplayer) {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
          e.preventDefault();
          handleFaceToFaceTap('top');
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          handleFaceToFaceTap('bottom');
        }
      } else if (stage === 'winner') {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (!isMultiplayer || multiplayer.isHost) {
            handleNextRound();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, isMultiplayer, multiplayer.isHost, multiplayer.status, letter]);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'LETTER_START') {
          beginCountdown(msg.payload);
        } else if (msg.type === 'LETTER_WORD_SUBMIT') {
          // If we receive this, the partner submitted a word first.
          processWin(multiplayer.remoteProfile?.name || 'Partner', msg.payload);
        } else if (msg.type === 'LETTER_NEXT') {
          resetRound();
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, resetRound, stage]);

  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    } else {
      sessionStorage.removeItem('letter_stage');
      sessionStorage.removeItem('letter_letter');
      
      const stored = JSON.parse(sessionStorage.getItem('knotyet_introShown') || '{}');
      stored.letter = false;
      sessionStorage.setItem('knotyet_introShown', JSON.stringify(stored));
      
      window.location.reload();
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 mx-auto">
      {/* Standardized Game Header Bar */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #D946EF, #A855F7)' }}>
            🔤
          </div>
          <div>
            <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Letter Race</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
              <span>{isMultiplayer ? 'Type it fast!' : 'Face-to-Face Tap!'}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleEndGame}
          className="text-xs font-bold text-white/80 hover:text-white transition px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/15 flex items-center gap-1 active:scale-95 shadow-sm"
        >
          End Game
        </button>
      </div>

      {/* Game card fills remaining space */}
      <div className="game-card flex-1 flex flex-col relative overflow-hidden bg-white p-3.5 sm:p-5 animate-pop-in">
        
        {stage === 'wait' && (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 space-y-4 sm:space-y-6 animate-pop-in z-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center animate-float shrink-0"
              style={{ border: '4px solid #FDF4FF' }}>
              <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-fuchsia-500" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-ink">Ready to Race?</h3>
              <p className="text-xs sm:text-sm text-ink-3 font-medium max-w-xs">
                {isMultiplayer 
                  ? "A random letter will appear. Be the first to type a word starting with it!" 
                  : "Put phone between you. When the letter appears, shout a word and be the first to tap your side!"}
              </p>
            </div>
            
            {(!isMultiplayer || multiplayer.isHost) ? (
              <button
                onClick={startRace}
                className="btn-chunky w-full py-3 sm:py-3.5 mt-2 text-sm sm:text-base flex items-center justify-center gap-2 group cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #D946EF, #A855F7)',
                  color: 'white',
                  boxShadow: '0 5px 0 #C026D3, 0 8px 20px rgba(217,70,239,0.35)'
                }}
              >
                <span>Start Race!</span>
                <span className="hidden md:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-white font-bold">Space / Enter</span>
              </button>
            ) : (
              <div className="py-3 text-fuchsia-600 font-bold animate-pulse text-sm">
                Waiting for {partnerName} to start the race...
              </div>
            )}
          </div>
        )}

        {stage === 'countdown' && (
          <div className="flex-1 flex flex-col items-center justify-center animate-pop-in z-10">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-fuchsia-200">
              <span className="text-5xl sm:text-6xl font-black text-fuchsia-600 drop-shadow-md animate-countdown-pop" key={countdown}>
                {countdown}
              </span>
            </div>
            <p className="mt-4 sm:mt-6 text-fuchsia-500 font-bold text-base sm:text-lg animate-pulse">Get ready...</p>
          </div>
        )}

        {stage === 'race' && !isMultiplayer && (
          <div className="absolute inset-0 flex flex-col">
            {/* Top Half - Partner (Rotated 180deg) */}
            <button 
              onClick={() => handleFaceToFaceTap('top')}
              className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 transition-colors flex items-center justify-center relative overflow-hidden group cursor-pointer"
            >
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,white_0%,transparent_70%)] scale-150"></div>
              <div className="rotate-180 text-white text-center">
                <span className="block text-3xl sm:text-4xl font-black drop-shadow-lg mb-1 sm:mb-2">{letter}</span>
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-base md:text-lg font-black bg-black/25 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full backdrop-blur-sm group-active:scale-95 transition-transform">
                  <span>TAP IF YOU GOT IT!</span>
                  <span className="hidden md:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-bold">Press [W] or [↑]</span>
                </span>
              </div>
            </button>
            
            {/* Divider */}
            <div className="h-1.5 bg-slate-900 w-full z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)]"></div>
            
            {/* Bottom Half - Local User */}
            <button 
              onClick={() => handleFaceToFaceTap('bottom')}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 transition-colors flex items-center justify-center relative overflow-hidden group cursor-pointer"
            >
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,white_0%,transparent_70%)] scale-150"></div>
              <div className="text-white text-center">
                <span className="block text-3xl sm:text-4xl font-black drop-shadow-lg mb-1 sm:mb-2">{letter}</span>
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-base md:text-lg font-black bg-black/25 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full backdrop-blur-sm group-active:scale-95 transition-transform">
                  <span>TAP IF YOU GOT IT!</span>
                  <span className="hidden md:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-bold">Press [S], [↓] or [Space]</span>
                </span>
              </div>
            </button>
          </div>
        )}

        {stage === 'race' && isMultiplayer && (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 space-y-4 sm:space-y-6 animate-pop-in z-10">
            <div className="text-center">
              <h2 className="text-6xl sm:text-8xl font-black text-fuchsia-600 drop-shadow-xl mb-1">{letter}</h2>
              <p className="text-fuchsia-500 font-bold text-xs sm:text-sm">Type a word starting with '{letter}'!</p>
            </div>
            
            <form onSubmit={handleWordSubmit} className="w-full max-w-md mx-auto space-y-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                className={`w-full text-center text-2xl sm:text-3xl font-black text-fuchsia-600 bg-white border-3 rounded-2xl py-3 focus:outline-none transition-colors ${
                  inputValue && !inputValue.startsWith(letter!) ? 'border-red-400 focus:border-red-500' : 'border-fuchsia-200 focus:border-fuchsia-400'
                }`}
                placeholder={`${letter}...`}
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputValue || !inputValue.startsWith(letter!)}
                className="btn-chunky w-full py-3 sm:py-3.5 text-sm sm:text-base disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white',
                  boxShadow: '0 5px 0 #047857, 0 6px 18px rgba(16,185,129,0.35)'
                }}
              >
                Submit!
              </button>
            </form>
          </div>
        )}

        {stage === 'winner' && winner && (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 text-center animate-pop-in z-10">
            {winGif ? (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-lg mx-auto mb-3 sm:mb-4 shrink-0" style={{ border: '4px solid #FDE047' }}>
                <img src={winGif} alt="Winner" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center animate-bounce-soft mb-3 sm:mb-4 border-4 border-yellow-200 shrink-0">
                <Trophy className="w-10 h-10 text-yellow-500" />
              </div>
            )}
            
            <h3 className="text-xl sm:text-2xl font-black text-ink mb-1.5">{winner.name} Wins!</h3>
            
            <div className="bg-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-sm border-2 border-fuchsia-100 mb-4 sm:mb-6 inline-block">
              <p className="text-xs text-ink-3 font-semibold mb-0.5">Winning word for '{letter}':</p>
              <p className="text-xl sm:text-2xl font-black text-fuchsia-600">{winner.word}</p>
            </div>
            
            {(!isMultiplayer || multiplayer.isHost) ? (
              <button
                onClick={handleNextRound}
                className="btn-chunky w-full py-3 sm:py-3.5 text-sm sm:text-base flex items-center justify-center gap-2 group cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #D946EF, #A855F7)',
                  color: 'white',
                  boxShadow: '0 5px 0 #C026D3, 0 6px 18px rgba(217,70,239,0.35)'
                }}
              >
                <span>Play Next Round</span>
                <span className="hidden md:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-white font-bold">Space / Enter</span>
              </button>
            ) : (
              <div className="py-3 text-fuchsia-600 font-bold animate-pulse text-sm">
                Waiting for {partnerName} to start the next round...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const LetterRaceGame: React.FC<Props> = (props) => (
  <LetterRaceErrorBoundary>
    <LetterRaceGameInner {...props} />
  </LetterRaceErrorBoundary>
);
