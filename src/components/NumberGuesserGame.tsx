import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import confetti from 'canvas-confetti';
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';

const MIN_NUM = 1;
const MAX_NUM = 100;

class NumberGuesserErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('NumberGuesser error:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-red-500 font-bold mb-2">Oops, something went wrong in Number Guesser!</h2>
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

const NumberGuesserGameInner: React.FC<Props> = ({ onEndGame }) => {
  const { profile, partner, addHeartPoints } = useGame();
  const { checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';

  const [stage, setStage] = useState<'setup' | 'guess' | 'reveal'>(() => {
    if (multiplayer.status === 'connected') return 'guess';
    const s = sessionStorage.getItem('num_stage');
    return (s === 'reveal' || s === 'guess') ? s as 'reveal' | 'guess' : 'setup';
  });
  const [secretNumber, setSecretNumber] = useState<number | null>(() => Number(sessionStorage.getItem('num_secret')) || null);
  const [guesses, setGuesses] = useState<{ value: number; hint: 'higher' | 'lower'; guesser?: string }[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('num_guesses') || '[]');
    } catch { return []; }
  });
  const [inputValue, setInputValue] = useState('');
  const [winGif, setWinGif] = useState<string | null>(null);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  
  const [localP1Name, setLocalP1Name] = useState(() => sessionStorage.getItem('num_p1') || profile?.name || 'Player 1');
  const [localP2Name, setLocalP2Name] = useState(() => sessionStorage.getItem('num_p2') || partner?.name || 'Player 2');

  const [round, setRound] = useState(() => Number(sessionStorage.getItem('num_round')) || 1);
  const [hintPopup, setHintPopup] = useState<{ hint: 'higher' | 'lower'; gif: string } | null>(null);

  const isP1Turn = guesses.length % 2 === 0;
  
  const currentTurnName = multiplayer.status === 'connected' 
    ? (isP1Turn ? (multiplayer.isHost ? profile?.name : partner?.name || 'Partner') : (!multiplayer.isHost ? profile?.name : partner?.name || 'Partner'))
    : (isP1Turn ? localP1Name : localP2Name);
    
  const isMyTurn = multiplayer.status === 'connected' 
    ? (isP1Turn ? multiplayer.isHost : !multiplayer.isHost) 
    : true; // In local mode, both players share the screen, so the input is always active.

  // Generate secret number on mount if missing
  useEffect(() => {
    if (secretNumber === null && (multiplayer.status !== 'connected' || multiplayer.isHost)) {
      const randomSecret = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
      setSecretNumber(randomSecret);
      if (multiplayer.status === 'connected' && multiplayer.isHost) {
        multiplayer.sendMessage({ type: 'NUM_SET_SECRET', payload: randomSecret });
      }
    }
  }, [secretNumber, multiplayer.status, multiplayer.isHost]);

  useEffect(() => {
    sessionStorage.setItem('num_stage', stage);
    if (secretNumber) sessionStorage.setItem('num_secret', secretNumber.toString()); else sessionStorage.removeItem('num_secret');
    sessionStorage.setItem('num_guesses', JSON.stringify(guesses));
    sessionStorage.setItem('num_round', round.toString());
    sessionStorage.setItem('num_p1', localP1Name);
    sessionStorage.setItem('num_p2', localP2Name);
  }, [stage, secretNumber, guesses, round, localP1Name, localP2Name]);

  const processGuess = async (val: number, guesser: string) => {
    if (secretNumber === null) return;
    
    if (val === secretNumber) {
      // Win
      setWinnerName(guesser);
      setStage('reveal');
      sounds.playSuccess();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');
      
      const { getWinMeme } = await import('../utils/memes');
      const gif = await getWinMeme();
      setWinGif(gif);
    } else {
      const hint = val < secretNumber ? 'higher' : 'lower';
      setGuesses(prev => [{ value: val, hint, guesser }, ...prev]);
      sounds.playMismatch();
      
      const { getHintMeme } = await import('../utils/memes');
      const gif = await getHintMeme(hint);
      setHintPopup({ hint, gif });
      
      // Auto-hide hint popup after 2.5 seconds
      setTimeout(() => {
        setHintPopup(null);
      }, 2500);
    }
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(inputValue);
    if (isNaN(val) || val < MIN_NUM || val > MAX_NUM) return;

    if (round === 1 && multiplayer.status !== 'connected' && !checkLimit('solo')) return;

    // Send the turn-based current name
    const guesser = multiplayer.status === 'connected' ? (profile?.name || 'Player') : currentTurnName;

    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'NUM_GUESS', payload: { val, name: guesser } });
    }
    processGuess(val, guesser || 'Player');
    setInputValue('');
  };

  const handleNextRound = () => {
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'NUM_NEXT' });
    }
    executeNextRound();
  };

  const executeNextRound = useCallback(() => {
    setRound(r => r + 1);
    setSecretNumber(null);
    setGuesses([]);
    setStage('guess');
    setInputValue('');
    setWinGif(null);
    setWinnerName(null);
  }, []);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'NUM_SET_SECRET') {
          setSecretNumber(msg.payload);
          sounds.playFlip();
        } else if (msg.type === 'NUM_GUESS') {
          const guessVal = typeof msg.payload === 'object' ? msg.payload.val : msg.payload;
          const guessName = typeof msg.payload === 'object' ? msg.payload.name : undefined;
          processGuess(guessVal, guessName || multiplayer.remoteProfile?.name || 'Partner');
        } else if (msg.type === 'NUM_NEXT') {
          executeNextRound();
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener, executeNextRound, secretNumber, multiplayer.remoteProfile]);


  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    }
  };

  return (
    <div className="w-full max-w-sm flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2">
      {/* Standardized Game Header Bar */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            #
          </div>
          <div>
            <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Number Guesser</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
              <span>Round {round}</span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-indigo-500/80 text-white text-[9px] font-black">
                {multiplayer.status === 'connected' ? (isMyTurn ? 'Your Turn' : `${partnerName}'s Turn`) : `${currentTurnName}'s Turn`}
              </span>
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

      <div className="game-card w-full flex-1 flex flex-col justify-between p-3.5 sm:p-5 overflow-hidden relative animate-pop-in">
        {stage === 'setup' && (
          <div className="w-full flex-1 flex flex-col justify-between items-center animate-slide-up py-1">
            <div className="text-center space-y-1 shrink-0">
              <h3 className="text-xl font-black text-ink">Who is playing?</h3>
              <p className="text-xs text-ink-3">Enter names for Player 1 and Player 2.</p>
            </div>
            <div className="w-full space-y-2.5 my-auto py-2">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-1">Player 1</label>
                <input
                  type="text"
                  value={localP1Name}
                  onChange={(e) => setLocalP1Name(e.target.value)}
                  className="w-full text-center text-lg font-bold text-indigo-600 bg-indigo-50 border-3 border-indigo-100 rounded-xl py-2.5 focus:outline-none focus:border-indigo-300 shadow-sm"
                  placeholder="Player 1 Name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-pink-700 mb-1">Player 2</label>
                <input
                  type="text"
                  value={localP2Name}
                  onChange={(e) => setLocalP2Name(e.target.value)}
                  className="w-full text-center text-lg font-bold text-pink-600 bg-pink-50 border-3 border-pink-100 rounded-xl py-2.5 focus:outline-none focus:border-pink-300 shadow-sm"
                  placeholder="Player 2 Name"
                />
              </div>
            </div>
            <div className="w-full shrink-0">
              <button
                onClick={() => setStage('guess')}
                disabled={!localP1Name.trim() || !localP2Name.trim()}
                className="btn-chunky w-full py-3 text-sm disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: 'white',
                  boxShadow: '0 6px 0 #4338CA, 0 8px 24px rgba(99,102,241,0.4)'
                }}
              >
                Start Game!
              </button>
            </div>
          </div>
        )}

        {stage === 'guess' && (
          <div className="w-full flex-1 flex flex-col justify-between animate-slide-up py-1">
            <div className="text-center shrink-0 space-y-0.5">
              <h3 className="text-lg sm:text-xl font-black text-ink">
                {currentTurnName}'s Turn
              </h3>
              <p className="text-[11px] font-semibold text-ink-3">Guess the number between {MIN_NUM} and {MAX_NUM}.</p>
            </div>

            {/* Guess History */}
            {guesses.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-2 max-h-24 overflow-y-auto space-y-1.5 no-scrollbar border-2 border-slate-100 my-1 shrink-0">
                {guesses.map((g, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1 bg-white rounded-lg shadow-sm border border-slate-100">
                    <span className="font-bold text-xs text-slate-700">
                      <span className="font-black text-ink-3 mr-1">{g.guesser || 'Guessed'}:</span>
                      {g.value}
                    </span>
                    <span className={`font-black text-[11px] flex items-center gap-1 ${g.hint === 'higher' ? 'text-indigo-500' : 'text-pink-500'}`}>
                      {g.hint === 'higher' ? <><ArrowUp className="w-3.5 h-3.5"/> Higher</> : <><ArrowDown className="w-3.5 h-3.5"/> Lower</>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="my-auto py-1 flex flex-col items-center justify-center w-full">
              {hintPopup ? (
                <div className="flex flex-col items-center justify-center p-1 animate-pop-in space-y-2">
                  <h4 className={`text-2xl font-black ${hintPopup.hint === 'higher' ? 'text-indigo-600' : 'text-pink-600'}`}>
                    {hintPopup.hint.toUpperCase()}!
                  </h4>
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-lg" style={{ border: `3px solid ${hintPopup.hint === 'higher' ? '#6366F1' : '#EC4899'}` }}>
                    <img src={hintPopup.gif} alt={hintPopup.hint} className="w-full h-full object-cover" />
                  </div>
                </div>
              ) : (
                isMyTurn ? (
                  <form onSubmit={handleGuess} className="w-full space-y-2.5 animate-fade-in">
                    {multiplayer.status === 'connected' && (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center animate-bounce-soft mb-1">
                        <p className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
                          <span>🎯</span> Your Turn! {partnerName} is waiting for your guess...
                        </p>
                      </div>
                    )}
                    <input
                      type="number"
                      min={MIN_NUM}
                      max={MAX_NUM}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full text-center text-3xl font-black text-indigo-600 bg-indigo-50 border-3 border-indigo-100 rounded-xl py-2.5 focus:outline-none focus:border-indigo-300 shadow-inner"
                      placeholder="?"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!inputValue || parseInt(inputValue) < MIN_NUM || parseInt(inputValue) > MAX_NUM}
                      className="btn-chunky w-full py-3 text-sm disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        color: 'white',
                        boxShadow: '0 4px 0 #047857, 0 6px 16px rgba(16,185,129,0.35)'
                      }}
                    >
                      Submit Guess!
                    </button>
                  </form>
                ) : (
                   <div className="py-4 text-center animate-slide-up space-y-2 bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl p-4 w-full">
                     <p className="text-xs sm:text-sm font-black text-indigo-700 flex items-center justify-center gap-1.5">
                       <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                       Waiting for {partnerName} to make a guess...
                     </p>
                     <p className="text-[10px] font-semibold text-ink-3">Pay attention to the higher / lower clues!</p>
                     <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
                   </div>
                )
              )}
            </div>
          </div>
        )}

        {stage === 'reveal' && (
          <div className="w-full flex-1 flex flex-col justify-between items-center text-center animate-pop-in py-2">
            <div className="my-auto space-y-4 flex flex-col items-center">
              {winGif ? (
                <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-lg mx-auto" style={{ border: '4px solid #10B981' }}>
                  <img src={winGif} alt="Winner" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-bounce-soft mx-auto">
                  <Trophy className="w-10 h-10 text-green-500" />
                </div>
              )}
              <div>
                <h3 className="text-2xl font-black text-ink mb-1">{winnerName ? `${winnerName} Guessed It!` : 'Correct!'}</h3>
                <p className="text-slate-600 font-medium">The secret number was <span className="font-black text-indigo-600 text-xl">{secretNumber}</span>!</p>
                <p className="text-sm text-slate-500 mt-2">Guessed in {guesses.length + 1} tries.</p>
              </div>
            </div>
            <div className="w-full shrink-0">
              <button
                onClick={handleNextRound}
                className="btn-chunky w-full py-4"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: 'white',
                  boxShadow: '0 6px 0 #4338CA, 0 8px 24px rgba(99,102,241,0.4)'
                }}
              >
                Play Next Round
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const NumberGuesserGame: React.FC<Props> = (props) => (
  <NumberGuesserErrorBoundary>
    <NumberGuesserGameInner {...props} />
  </NumberGuesserErrorBoundary>
);
