import { RoundLabel } from './GameCardDesign';
import { GiphyReaction } from './GiphyReaction';
import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo } from 'react';
import { writeJson } from '../utils/storage';
import { restoreNumberSession, validateNumberSnapshot, type NumberGuess, type NumberRoundSnapshot } from '../utils/numberSession';
import confetti from 'canvas-confetti';
import { ArrowDown, ArrowUp, Minus, Plus, Sparkles, Target } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import '../styles/number-guesser.css';

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
  const [localMode, setLocalMode] = useState<'solo' | 'together'>(() => sessionStorage.getItem('num_mode') === 'together' ? 'together' : 'solo');

  const roomCode = multiplayer.roomCode || null;
  const online = Boolean(roomCode) || multiplayer.status === 'connected';
  const [restored] = useState(() => restoreNumberSession(sessionStorage, roomCode, online));
  const [synced, setSynced] = useState(!online || multiplayer.isHost);
  const [stage, setStage] = useState<'setup' | 'guess' | 'reveal'>(restored?.stage || (online ? 'guess' : 'setup'));
  const [secretNumber, setSecretNumber] = useState<number | null>(restored?.secret ?? (online && !multiplayer.isHost ? multiplayer.numberSecret : null));
  const [guesses, setGuesses] = useState<NumberGuess[]>(restored?.guesses || []);
  const [inputValue, setInputValue] = useState('');
  const [winnerName, setWinnerName] = useState<string | null>(restored?.winnerName || null);
  
  const [localP1Name, setLocalP1Name] = useState(() => sessionStorage.getItem('num_p1') || profile?.name || 'Player 1');
  const [localP2Name, setLocalP2Name] = useState(() => sessionStorage.getItem('num_p2') || partner?.name || 'Player 2');

  const [round, setRound] = useState(restored?.round || 1);
  const [hintPopup, setHintPopup] = useState<{ hint: 'higher' | 'lower' } | null>(null);
  const roundFinished = useRef(stage === 'reveal');
  const turnPending = useRef(false);
  const processedGuesses = useRef(new Set(guesses.map(guess => guess.value)));
  const hintTimer = useRef<number>();
  const snapshotRef = useRef<NumberRoundSnapshot | null>(null);
  const syncedRef = useRef(synced);
  syncedRef.current = synced;
  snapshotRef.current = roomCode && secretNumber !== null && stage !== 'setup' ? { roomCode, round, secret: secretNumber, guesses, stage, winnerName } : null;
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  useEffect(() => { turnPending.current = false; }, [guesses, stage]);

  const isP1Turn = guesses.length % 2 === 0;
  
  const currentTurnName = multiplayer.status === 'connected' 
    ? (isP1Turn ? (multiplayer.isHost ? profile?.name : partnerName) : (!multiplayer.isHost ? profile?.name : partnerName))
    : (localMode === 'solo' || isP1Turn ? localP1Name : localP2Name);
    
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
    if (secretNumber === null && (!online || multiplayer.isHost)) {
      const randomSecret = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
      setSecretNumber(randomSecret);
    }
  }, [secretNumber, online, multiplayer.isHost]);
  useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && secretNumber !== null) {
      multiplayer.sendMessage({ type: 'NUM_SET_SECRET', payload: secretNumber });
    }
  }, [multiplayer.status, multiplayer.isHost, multiplayer.sendMessage, secretNumber]);
  useEffect(() => {
    if (multiplayer.status === 'connected' && !multiplayer.isHost && multiplayer.numberSecret !== null) {
      setSecretNumber(multiplayer.numberSecret);
    }
  }, [multiplayer.status, multiplayer.isHost, multiplayer.numberSecret]);

  useEffect(() => {
    if (online && !synced) return;
    if (secretNumber !== null) writeJson(sessionStorage, 'num_session', { roomCode: online ? roomCode : null, round, secret: secretNumber, guesses, stage, winnerName });
    sessionStorage.setItem('num_stage', stage);
    if (secretNumber) sessionStorage.setItem('num_secret', secretNumber.toString()); else sessionStorage.removeItem('num_secret');
    sessionStorage.setItem('num_guesses', JSON.stringify(guesses));
    sessionStorage.setItem('num_round', round.toString());
    sessionStorage.setItem('num_p1', localP1Name);
    sessionStorage.setItem('num_p2', localP2Name);
    sessionStorage.setItem('num_mode', localMode);
    if (winnerName) sessionStorage.setItem('num_winner', winnerName); else sessionStorage.removeItem('num_winner');
  }, [stage, secretNumber, guesses, round, localP1Name, localP2Name, localMode, winnerName, online, synced, roomCode]);

  const processGuess = (val: number, guesser: string) => {
    if (stage !== 'guess' || roundFinished.current || turnPending.current || secretNumber === null || !Number.isInteger(val) || val < lowerBound || val > upperBound || processedGuesses.current.has(val)) return;
    turnPending.current = true;
    processedGuesses.current.add(val);
    
    if (val === secretNumber) {
      // Win
      roundFinished.current = true;
      if (snapshotRef.current) snapshotRef.current = { ...snapshotRef.current, stage: 'reveal', winnerName: guesser };
      setWinnerName(guesser);
      setStage('reveal');
      sounds.playSuccess();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, multiplayer.status === 'connected', multiplayer.isHost, multiplayer.remoteProfile?.accountId);
    } else {
      const hint = val < secretNumber ? 'higher' : 'lower';
      if (snapshotRef.current) snapshotRef.current = { ...snapshotRef.current, guesses: [{ value: val, hint, guesser }, ...snapshotRef.current.guesses] };
      setGuesses(prev => [{ value: val, hint, guesser }, ...prev]);
      sounds.playMismatch();
      
      setHintPopup({ hint });
      
      // Auto-hide hint popup after 2.5 seconds
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => {
        setHintPopup(null);
      }, 2500);
    }
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(inputValue);
    if (!synced || turnPending.current || (online && multiplayer.status !== 'connected') || !guessIsValid || !isMyTurn || secretNumber === null || stage !== 'guess' || roundFinished.current) return;

    if (multiplayer.status !== 'connected' && !checkLimit('solo')) return;

    // Send the turn-based current name
    const guesser = multiplayer.status === 'connected' ? (profile?.name || 'Player') : currentTurnName;

    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'NUM_GUESS', payload: { val, name: guesser, round } });
    }
    processGuess(val, guesser || 'Player');
    setInputValue('');
  };

  const adjustGuess = (amount: number) => {
    const nextGuess = inputValue !== '' && Number.isInteger(parsedGuess)
      ? parsedGuess + amount
      : amount > 0 ? lowerBound : upperBound;
    setInputValue(String(Math.min(upperBound, Math.max(lowerBound, nextGuess))));
    sounds.playTick();
  };

  const handleNextRound = () => {
    if (!roundFinished.current || (multiplayer.status === 'connected' && !multiplayer.isHost)) return;
    sounds.playFlip();
    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'NUM_NEXT' });
    }
    executeNextRound();
  };

  const executeNextRound = useCallback(() => {
    if (!roundFinished.current) return;
    roundFinished.current = false;
    snapshotRef.current = null;
    processedGuesses.current.clear();
    window.clearTimeout(hintTimer.current);
    setHintPopup(null);
    setRound(r => r + 1);
    setSecretNumber(null);
    setGuesses([]);
    setStage('guess');
    setInputValue('');
    setWinnerName(null);
  }, []);

  useEffect(() => {
    if (multiplayer.status === 'connected') {
      return multiplayer.subscribeMessage((msg: MultiplayerMessage) => {
        if (msg.type === 'NUM_SET_SECRET') {
          if (multiplayer.isHost || !Number.isInteger(msg.payload) || msg.payload < MIN_NUM || msg.payload > MAX_NUM) return;
          setSecretNumber(msg.payload);
          sounds.playFlip();
        } else if (msg.type === 'NUM_GUESS') {
          if (!synced || isMyTurn || (typeof msg.payload === 'object' && msg.payload.round !== undefined && msg.payload.round !== round)) return;
          const guessVal = typeof msg.payload === 'object' ? msg.payload.val : msg.payload;
          const guessName = typeof msg.payload === 'object' ? msg.payload.name : undefined;
          processGuess(guessVal, guessName || multiplayer.remoteProfile?.name || 'Partner');
        } else if (msg.type === 'NUM_NEXT') {
          if (!multiplayer.isHost) executeNextRound();
        }
      });
    }
  }, [multiplayer.status, multiplayer.subscribeMessage, executeNextRound, secretNumber, multiplayer.remoteProfile, stage, lowerBound, upperBound, isMyTurn, round, synced]);


  useEffect(() => {
    if (!online || multiplayer.status !== 'connected') {
      if (online && !multiplayer.isHost) { syncedRef.current = false; setSynced(false); }
      return;
    }
    const unsubscribe = multiplayer.subscribeMessage(message => {
      if (message.type === 'NUM_REQUEST' && multiplayer.isHost && snapshotRef.current) {
        multiplayer.sendMessage({ type: 'NUM_STATE', payload: snapshotRef.current });
      } else if (message.type === 'NUM_STATE' && !multiplayer.isHost && validateNumberSnapshot(message.payload) && message.payload.roomCode === roomCode) {
        const next = message.payload;
        const previous = snapshotRef.current;
        if (syncedRef.current && previous && (next.round < previous.round || (next.round === previous.round && (next.guesses.length < previous.guesses.length || (previous.stage === 'reveal' && next.stage !== 'reveal'))))) return;
        const completedNow = next.stage === 'reveal' && (!previous || previous.round !== next.round || !roundFinished.current);
        snapshotRef.current = next;
        roundFinished.current = next.stage === 'reveal';
        processedGuesses.current = new Set(next.guesses.map(guess => guess.value));
        setSecretNumber(next.secret);
        setRound(next.round);
        setGuesses(next.guesses);
        setStage(next.stage);
        setWinnerName(next.winnerName);
        setInputValue('');
        syncedRef.current = true;
        setSynced(true);
        if (completedNow) addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, true, false, multiplayer.remoteProfile?.accountId);
      }
    });
    if (!multiplayer.isHost) multiplayer.sendMessage({ type: 'NUM_REQUEST' });
    else if (snapshotRef.current) multiplayer.sendMessage({ type: 'NUM_STATE', payload: snapshotRef.current });
    return unsubscribe;
  }, [online, multiplayer.status, multiplayer.isHost, multiplayer.sendMessage, multiplayer.subscribeMessage, roomCode, addHeartPoints, multiplayer.remoteProfile?.accountId]);

  useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && snapshotRef.current) multiplayer.sendMessage({ type: 'NUM_STATE', payload: snapshotRef.current });
  }, [multiplayer.status, multiplayer.isHost, multiplayer.sendMessage, round, secretNumber, guesses, stage, winnerName]);

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

  if (online && (!synced || multiplayer.status !== 'connected')) return (
    <section className="game-card activity-card p-6 text-center space-y-3" role="status">
      <h2 className="font-black text-xl">Restoring your number round…</h2>
      <p>Your guesses and turn will resume together when the host reconnects.</p>
      <button type="button" className="btn-chunky btn-white px-4 py-2" disabled={multiplayer.status !== 'connected'} onClick={() => multiplayer.sendMessage({ type: 'NUM_REQUEST' })}>Sync round</button>
    </section>
  );

  return (
    <div className="number-game animate-fade-in" data-number-stage={stage}>
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

      <div className="game-card activity-card game-board number-board relative animate-pop-in">
        <RoundLabel title={multiplayer.status !== 'connected' && localMode === 'solo' ? 'FIND THE NUMBER' : 'THE NUMBER DUEL'} detail={`ROUND ${round}`} kind="game" />
        {stage === 'setup' && (
          <div className="number-setup-stage w-full flex-1 flex flex-col items-center justify-center animate-slide-up">
            <div className="text-center space-y-1 shrink-0">
              <h3 className="text-xl font-black text-ink">Who is playing?</h3>
              <p className="text-xs text-ink-3">Play a solo puzzle or take turns on one screen.</p>
              <div className="flex gap-2 justify-center pt-2" role="group" aria-label="Number game mode">
                <button type="button" aria-pressed={localMode === 'solo'} className={`btn-chunky ${localMode === 'solo' ? 'btn-pink' : 'btn-white'} text-xs px-3 py-2`} onClick={() => setLocalMode('solo')}>Solo</button>
                <button type="button" aria-pressed={localMode === 'together'} className={`btn-chunky ${localMode === 'together' ? 'btn-pink' : 'btn-white'} text-xs px-3 py-2`} onClick={() => setLocalMode('together')}>Two players</button>
              </div>
            </div>
            <div className="number-setup-fields w-full space-y-2.5">
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
              <div hidden={localMode === 'solo'}>
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
                disabled={!localP1Name.trim() || (localMode === 'together' && !localP2Name.trim())}
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
          <div className="number-game-stage animate-slide-up">
            <section className="number-play-panel" aria-labelledby="number-turn-heading">
              <div className="number-turn-copy">
                <span className="number-turn-kicker"><Target aria-hidden="true" /> Find the secret number</span>
                <h3 id="number-turn-heading">{isMyTurn ? `${currentTurnName}, take your shot!` : `${partnerName} is choosing…`}</h3>
                <p>{guesses.length === 0 ? 'Start anywhere from 1 to 100. Every clue shrinks the range.' : `${upperBound - lowerBound + 1} possible numbers remain.`}</p>
              </div>

              <div className="number-range-card" aria-label={`Possible range is ${lowerBound} to ${upperBound}`}>
                <div className="number-range-values">
                  <span><small>LOW</small>{lowerBound}</span>
                  <strong>{lowerBound === upperBound ? 'Only one choice!' : 'POSSIBLE RANGE'}</strong>
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
                      placeholder="?"
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
              </div>
              {guesses.length === 0 ? (
                <div className="number-history-empty">
                  <span aria-hidden="true"><Target /></span>
                  <strong>No guesses yet</strong>
                  <p>Make your first guess.<br />Follow the clues to narrow it down.</p>
                </div>
              ) : (
                <ol className="number-history-list" tabIndex={0} aria-label="Previous guesses, newest first">
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
          <div className="completion-reveal w-full flex-1 flex flex-col justify-between items-center text-center animate-pop-in py-2">
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
                disabled={multiplayer.status === 'connected' && !multiplayer.isHost}
                className="completion-button completion-button-primary"
              >
                {multiplayer.status === 'connected' && !multiplayer.isHost ? 'Waiting for host…' : 'Play Next Round'}
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
