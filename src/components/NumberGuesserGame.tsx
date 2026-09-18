import { RoundLabel } from './GameCardDesign';
import { GiphyReaction } from './GiphyReaction';
import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { readJson } from '../utils/storage';
import confetti from 'canvas-confetti';
import { ArrowDown, ArrowUp, Minus, Plus, Sparkles, Target } from 'lucide-react';
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
      return readJson<Array<{ value: number; hint: 'higher' | 'lower'; guesser?: string }>>(sessionStorage, 'num_guesses', []);
    } catch { return []; }
  });
  const [inputValue, setInputValue] = useState('');
  const [winnerName, setWinnerName] = useState<string | null>(null);
  
  const [localP1Name, setLocalP1Name] = useState(() => sessionStorage.getItem('num_p1') || profile?.name || 'Player 1');
  const [localP2Name, setLocalP2Name] = useState(() => sessionStorage.getItem('num_p2') || partner?.name || 'Player 2');

  const [round, setRound] = useState(() => Number(sessionStorage.getItem('num_round')) || 1);
  const [hintPopup, setHintPopup] = useState<{ hint: 'higher' | 'lower' } | null>(null);

  const isP1Turn = guesses.length % 2 === 0;
  
  const currentTurnName = multiplayer.status === 'connected' 
    ? (isP1Turn ? (multiplayer.isHost ? profile?.name : partner?.name || 'Partner') : (!multiplayer.isHost ? profile?.name : partner?.name || 'Partner'))
    : (isP1Turn ? localP1Name : localP2Name);
    
  const isMyTurn = multiplayer.status === 'connected' 
    ? (isP1Turn ? multiplayer.isHost : !multiplayer.isHost) 
    : true; // In local mode, both players share the screen, so the input is always active.

  const lowerBound = guesses.reduce(
    (bound, guess) => guess.hint === 'higher' ? Math.max(bound, guess.value + 1) : bound,
    MIN_NUM,
  );
  const upperBound = guesses.reduce(
    (bound, guess) => guess.hint === 'lower' ? Math.min(bound, guess.value - 1) : bound,
    MAX_NUM,
  );
  const latestGuess = guesses[0];
  const parsedGuess = Number(inputValue);
  const guessIsValid = Number.isInteger(parsedGuess)
    && parsedGuess >= lowerBound
    && parsedGuess <= upperBound
    && !guesses.some(guess => guess.value === parsedGuess);
  const lowerPercent = ((lowerBound - MIN_NUM) / (MAX_NUM - MIN_NUM)) * 100;
  const upperPercent = ((upperBound - MIN_NUM) / (MAX_NUM - MIN_NUM)) * 100;

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

  const processGuess = (val: number, guesser: string) => {
    if (secretNumber === null) return;
    
    if (val === secretNumber) {
      // Win
      setWinnerName(guesser);
      setStage('reveal');
      sounds.playSuccess();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected');
    } else {
      const hint = val < secretNumber ? 'higher' : 'lower';
      setGuesses(prev => [{ value: val, hint, guesser }, ...prev]);
      sounds.playMismatch();
      
      setHintPopup({ hint });
      
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

  const adjustGuess = (amount: number) => {
    const fallback = Math.round((lowerBound + upperBound) / 2);
    const nextGuess = inputValue !== '' && Number.isInteger(parsedGuess) ? parsedGuess + amount : fallback;
    setInputValue(String(Math.min(upperBound, Math.max(lowerBound, nextGuess))));
    sounds.playTick();
  };

  const handleNextRound = () => {
    sounds.playFlip();
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

  // Desktop keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      // Open dialogs own the keyboard; native controls keep their activation keys.
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"], [role="dialog"], [role="alertdialog"]')) return;

      if (stage === 'reveal') {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextRound();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, handleNextRound]);

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 mx-auto">
      {/* Standardized Game Header Bar */}
      <div className="game-toolbar w-full flex items-center justify-between px-3 py-2 rounded-2xl shrink-0">
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
          className="game-end-button text-xs font-bold transition px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95"
        >
          End Game
        </button>
      </div>

      <div className="game-card activity-card game-board w-full flex-1 flex flex-col justify-between p-3.5 sm:p-5 overflow-hidden relative animate-pop-in">
        <RoundLabel title="THE NUMBER DUEL" detail={`ROUND ${round}`} kind="game" />
        {stage === 'setup' && (
          <div className="w-full flex-1 flex flex-col justify-between items-center animate-slide-up py-1">
            <div className="text-center space-y-1 shrink-0">
              <h3 className="text-xl font-black text-ink">Who is playing?</h3>
              <p className="text-xs text-ink-3">Enter names for Player 1 and Player 2.</p>
            </div>
            <div className="w-full space-y-2.5 my-auto py-2">
              <div>
                <label htmlFor="number-player-one" className="block text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-1">Player 1</label>
                <input
                  type="text"
                  id="number-player-one"
                  value={localP1Name}
                  onChange={(e) => setLocalP1Name(e.target.value)}
                  className="w-full text-center text-lg font-bold text-indigo-600 bg-indigo-50 border-3 border-indigo-100 rounded-xl py-2.5 focus:outline-none focus:border-indigo-300 shadow-sm"
                  placeholder="Player 1 Name"
                />
              </div>
              <div>
                <label htmlFor="number-player-two" className="block text-[11px] font-black uppercase tracking-wider text-pink-700 mb-1">Player 2</label>
                <input
                  type="text"
                  id="number-player-two"
                  value={localP2Name}
                  onChange={(e) => setLocalP2Name(e.target.value)}
                  className="w-full text-center text-lg font-bold text-pink-600 bg-pink-50 border-3 border-pink-100 rounded-xl py-2.5 focus:outline-none focus:border-pink-300 shadow-sm"
                  placeholder="Player 2 Name"
                />
              </div>
            </div>
            <div className="w-full shrink-0">
              <button
                onClick={() => { sounds.playFlip(); setStage('guess'); }}
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
          <div className="number-game-stage w-full flex-1 animate-slide-up">
            <section className="number-play-panel" aria-labelledby="number-turn-heading">
              <div className="number-turn-copy">
                <span className="number-turn-kicker"><Target aria-hidden="true" /> Find the secret number</span>
                <h3 id="number-turn-heading">{isMyTurn ? `${currentTurnName}, take your shot!` : `${partnerName} is choosing…`}</h3>
                <p>{guesses.length === 0 ? 'Start anywhere from 1 to 100. Every clue shrinks the range.' : `${upperBound - lowerBound + 1} possible numbers remain.`}</p>
              </div>

              <div className="number-range-card" aria-label={`Possible range is ${lowerBound} to ${upperBound}`}>
                <div className="number-range-values">
                  <span><small>LOW</small>{lowerBound}</span>
                  <strong>{lowerBound === upperBound ? 'Only one choice!' : 'THE NUMBER IS IN HERE'}</strong>
                  <span><small>HIGH</small>{upperBound}</span>
                </div>
                <div className="number-range-track" aria-hidden="true">
                  <i style={{ left: `${lowerPercent}%`, right: `${100 - upperPercent}%` }} />
                  {latestGuess && <b style={{ left: `${((latestGuess.value - MIN_NUM) / (MAX_NUM - MIN_NUM)) * 100}%` }} />}
                </div>
                <div className="number-range-scale"><span>{MIN_NUM}</span><span>{MAX_NUM}</span></div>
              </div>

              {latestGuess && (
                <div className={`number-latest-clue number-clue-${latestGuess.hint}`} role="status" aria-live="polite">
                  <span className="number-clue-icon">
                    {latestGuess.hint === 'higher' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
                  </span>
                  <div>
                    <small>{latestGuess.guesser || 'Last guess'} tried {latestGuess.value}</small>
                    <strong>Go {latestGuess.hint}!</strong>
                  </div>
                  {hintPopup && <Sparkles className="number-clue-sparkle" aria-hidden="true" />}
                </div>
              )}

              {isMyTurn ? (
                <form onSubmit={handleGuess} className="number-guess-form">
                  <label htmlFor="number-guess-input">Your guess</label>
                  <div className="number-stepper">
                    <button type="button" onClick={() => adjustGuess(-1)} aria-label="Decrease guess" disabled={parsedGuess === lowerBound}>
                      <Minus aria-hidden="true" />
                    </button>
                    <input
                      id="number-guess-input"
                      type="number"
                      inputMode="numeric"
                      min={lowerBound}
                      max={upperBound}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      aria-describedby="number-guess-help"
                      placeholder={String(Math.round((lowerBound + upperBound) / 2))}
                      autoFocus
                    />
                    <button type="button" onClick={() => adjustGuess(1)} aria-label="Increase guess" disabled={parsedGuess === upperBound}>
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <p id="number-guess-help" className="number-guess-help">
                    {inputValue && guesses.some(guess => guess.value === parsedGuess)
                      ? 'That number was already tried — choose a fresh one.'
                      : `Choose from ${lowerBound} to ${upperBound}.`}
                  </p>
                  <button type="submit" disabled={!guessIsValid} className="btn-chunky number-lock-button">
                    Lock in {guessIsValid ? parsedGuess : 'my guess'} <Target aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div className="number-waiting-card" role="status">
                  <span className="number-waiting-dots"><i /><i /><i /></span>
                  <strong>{partnerName} is thinking</strong>
                  <p>You’ll see their guess here instantly.</p>
                </div>
              )}
            </section>

            <aside className="number-history-panel" aria-label="Guess history">
              <div className="number-history-heading">
                <div><span>Guess trail</span><strong>{guesses.length} {guesses.length === 1 ? 'try' : 'tries'}</strong></div>
                {hintPopup && <GiphyReaction mood={hintPopup.hint} seed={`${round}-${guesses.length}`} compact />}
              </div>
              {guesses.length === 0 ? (
                <div className="number-history-empty">
                  <span>?</span>
                  <strong>No guesses yet</strong>
                  <p>Your clues will stack up here.</p>
                </div>
              ) : (
                <ol className="number-history-list">
                  {guesses.map((guess, index) => (
                    <li key={`${guess.value}-${index}`}>
                      <span>{guesses.length - index}</span>
                      <div><strong>{guess.value}</strong><small>{guess.guesser || 'Player'}</small></div>
                      <b className={`number-history-${guess.hint}`}>
                        {guess.hint === 'higher' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
                        {guess.hint}
                      </b>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        )}

        {stage === 'reveal' && (
          <div className="w-full flex-1 flex flex-col justify-between items-center text-center animate-pop-in py-2">
            <div className="my-auto space-y-4 flex flex-col items-center">
              <GiphyReaction mood="win" seed={`number-${round}`} compact />
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
