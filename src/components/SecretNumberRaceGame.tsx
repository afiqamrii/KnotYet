import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, LockKeyhole, Minus, Plus, Sparkles, Trophy, Users, X, Zap } from 'lucide-react';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useMultiplayer, type SecretRaceOperation, type SecretRaceRole, type SecretRaceState } from '../store/MultiplayerContext';
import { sounds } from '../utils/audio';
import { restoreSecretRaceSession, secretRaceSessionKey, type SecretRaceSession } from '../utils/secretRaceSession';
import { writeJson } from '../utils/storage';
import '../styles/secret-race.css';

const MAX_ROUNDS = 5;
const TIE_WINDOW_MS = 350;
const WRONG_DELAY_MS = 2_000;
const SETUP_RETRY_MS = 1_000;
const SETUP_MAX_REQUESTS = 15;
const OPERATIONS: SecretRaceOperation[] = ['+', '−', '×'];

type PrivateNumbers = { host?: number; partner?: number };
type Candidate = { role: 'host' | 'partner'; receivedAt: number };

const rangeFor = (operation: SecretRaceOperation) => operation === '×' ? 12 : 20;
const answerFor = (operation: SecretRaceOperation, host: number, partner: number) => operation === '+' ? host + partner : operation === '−' ? host - partner : host * partner;
const operationName = (operation: SecretRaceOperation) => operation === '+' ? 'addition' : operation === '−' ? 'subtraction' : 'multiplication';
const matchId = () => 'race-' + Date.now() + '-' + Math.random().toString(36).slice(2);

interface Props { onEndGame?: () => void; }

export const SecretNumberRaceGame: React.FC<Props> = ({ onEndGame }) => {
  const multiplayer = useMultiplayer();
  const { partner, addHeartPoints } = useGame();
  const isHost = multiplayer.isHost;
  const roomCode = multiplayer.roomCode;
  const role: 'host' | 'partner' = isHost ? 'host' : 'partner';
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Your person';
  const [restored] = useState(() => {
    try { return restoreSecretRaceSession(sessionStorage.getItem(secretRaceSessionKey(isHost)), roomCode, isHost); }
    catch { return null; }
  });
  // Guests ask for the host's current public state, while retaining their own
  // pending pick and reward markers. A saved guest view is never authoritative.
  const [state, setState] = useState<SecretRaceState | null>(isHost ? restored?.state ?? null : null);
  const stateRef = useRef<SecretRaceState | null>(state);
  const numbersRef = useRef<PrivateNumbers>(restored?.numbers ?? {});
  const guestLockedNumber = useRef<number | null>(restored?.guestLockedNumber ?? null);
  const firstCorrect = useRef<Candidate | null>(restored?.candidate ?? null);
  const countdownEndsAt = useRef<number | null>(restored?.countdownEndsAt ?? null);
  const goTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const cooldowns = useRef(restored?.cooldowns ?? { host: 0, partner: 0 });
  const rewardedRounds = useRef(new Set(restored?.rewardedRounds ?? []));
  const started = useRef(Boolean(isHost && restored));
  const [number, setNumber] = useState(() => String((isHost ? restored?.numbers.host : restored?.guestLockedNumber) ?? ''));
  const [answer, setAnswer] = useState('');
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'GO'>(3);
  const [retryUntil, setRetryUntil] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [setupTimedOut, setSetupTimedOut] = useState(false);
  const [setupAttempt, setSetupAttempt] = useState(0);
  const retrySetup = () => setSetupAttempt(attempt => attempt + 1);

  const persist = useCallback(() => {
    if (!roomCode || !stateRef.current) return;
    const saved: SecretRaceSession = {
      version: 1, roomCode, isHost, savedAt: Date.now(), state: stateRef.current,
      numbers: isHost ? { ...numbersRef.current } : {},
      guestLockedNumber: isHost ? null : guestLockedNumber.current,
      countdownEndsAt: stateRef.current.phase === 'countdown' ? countdownEndsAt.current : null,
      candidate: isHost ? firstCorrect.current : null,
      cooldowns: { ...cooldowns.current }, rewardedRounds: [...rewardedRounds.current].slice(-100),
    };
    writeJson(sessionStorage, secretRaceSessionKey(isHost), saved);
  }, [roomCode, isHost]);

  const publish = useCallback((next: SecretRaceState, type: 'SECRET_RACE_START' | 'SECRET_RACE_STATE' | 'SECRET_RACE_RESULT' = 'SECRET_RACE_STATE') => {
    stateRef.current = next;
    setState(next);
    persist();
    multiplayer.sendMessage({ type, payload: next });
  }, [multiplayer, persist]);

  const newRound = useCallback((id: string, round: number, scores: { host: number; partner: number }) => {
    if (goTimer.current !== null) window.clearTimeout(goTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    goTimer.current = null;
    resultTimer.current = null;
    countdownEndsAt.current = null;
    cooldowns.current = { host: 0, partner: 0 };
    const next: SecretRaceState = { matchId: id, round, operation: OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)], phase: 'picking', hostLocked: false, partnerLocked: false, scores };
    numbersRef.current = {};
    guestLockedNumber.current = null;
    firstCorrect.current = null;
    setNumber('');
    setAnswer('');
    setRetryUntil(0);
    setFeedback('');
    publish(next, 'SECRET_RACE_START');
  }, [publish]);

  const reveal = useCallback((id: string) => {
    const current = stateRef.current;
    const numbers = numbersRef.current;
    if (!isHost || !current || current.matchId !== id || current.phase !== 'countdown' || numbers.host === undefined || numbers.partner === undefined) return;
    const equation = { hostNumber: numbers.host, partnerNumber: numbers.partner, answer: answerFor(current.operation, numbers.host, numbers.partner) };
    const next = { ...current, phase: 'answering' as const, equation };
    countdownEndsAt.current = null;
    stateRef.current = next;
    setState(next);
    persist();
    multiplayer.sendMessage({ type: 'SECRET_RACE_GO', payload: { matchId: id, equation } });
    sounds.playSuccess();
  }, [isHost, multiplayer, persist]);

  const beginCountdown = useCallback((current: SecretRaceState) => {
    if (!isHost || current.phase !== 'picking' || !current.hostLocked || !current.partnerLocked) return;
    countdownEndsAt.current = Date.now() + 3050;
    publish({ ...current, phase: 'countdown' });
  }, [isHost, publish]);

  const wrong = useCallback((delay = WRONG_DELAY_MS) => {
    const until = Date.now() + delay;
    setFeedback('Not quite — take a breath and race again!');
    setAnswer('');
    setRetryUntil(until);
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => setRetryUntil(previous => previous === until ? 0 : previous), delay);
    sounds.playMismatch();
  }, []);

  const finish = useCallback((winner: SecretRaceRole) => {
    const current = stateRef.current;
    if (!isHost || !current || current.phase !== 'answering') return;
    const scores = { host: current.scores.host + (winner === 'host' ? 1 : 0), partner: current.scores.partner + (winner === 'partner' ? 1 : 0) };
    const next = { ...current, phase: current.round === MAX_ROUNDS ? 'complete' as const : 'result' as const, scores, winner };
    firstCorrect.current = null;
    publish(next, 'SECRET_RACE_RESULT');
    sounds.playSuccess();
    if (winner === role) confetti({ particleCount: 80, spread: 80, origin: { y: .64 }, colors: ['#ff829e', '#7c3aed', '#cbeafa', '#d5f578', '#f9d77e'] });
  }, [isHost, publish, role]);

  const judge = useCallback((player: 'host' | 'partner', value: number) => {
    const current = stateRef.current;
    if (!isHost || !current || current.phase !== 'answering' || !current.equation || !Number.isInteger(value) || cooldowns.current[player] > Date.now()) return;
    if (value !== current.equation.answer) {
      cooldowns.current[player] = Date.now() + WRONG_DELAY_MS;
      persist();
      if (player === 'host') wrong();
      else multiplayer.sendMessage({ type: 'SECRET_RACE_WRONG', payload: { matchId: current?.matchId || '', delayMs: WRONG_DELAY_MS } });
      return;
    }
    const now = Date.now();
    const first = firstCorrect.current;
    if (first && first.role !== player && now - first.receivedAt <= TIE_WINDOW_MS) {
      if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
      finish('tie');
    } else if (!first) {
      firstCorrect.current = { role: player, receivedAt: now };
      persist();
      resultTimer.current = window.setTimeout(() => finish(player), TIE_WINDOW_MS);
    }
  }, [finish, isHost, multiplayer, wrong, persist]);

  const lockNumber = () => {
    const current = stateRef.current;
    const value = Number(number);
    if (!current || current.phase !== 'picking' || !Number.isInteger(value) || value < 1 || value > rangeFor(current.operation)) return;
    if (isHost) {
      if (current.hostLocked) return;
      numbersRef.current.host = value;
      const next = { ...current, hostLocked: true };
      publish(next);
      if (next.partnerLocked) beginCountdown(next);
    } else if (!current.partnerLocked) {
      guestLockedNumber.current = value;
      const optimistic = { ...current, partnerLocked: true };
      stateRef.current = optimistic;
      setState(optimistic);
      persist();
      multiplayer.sendMessage({ type: 'SECRET_RACE_LOCK', payload: { matchId: current.matchId, number: value } });
    }
    sounds.playFlip();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const current = stateRef.current;
    const value = Number(answer);
    if (!answer.trim() || !current || current.phase !== 'answering' || retryUntil > Date.now() || !Number.isInteger(value)) return;
    if (isHost) judge('host', value);
    else multiplayer.sendMessage({ type: 'SECRET_RACE_ANSWER', payload: { matchId: current.matchId, answer: value } });
  };

  useEffect(() => {
    if (!isHost || multiplayer.status !== 'connected' || state || started.current) return;
    started.current = true;
    newRound(matchId(), 1, { host: 0, partner: 0 });
  }, [isHost, multiplayer.status, newRound, state]);

  useEffect(() => {
    if (isHost && multiplayer.status === 'connected' && state) multiplayer.sendMessage({ type: 'SECRET_RACE_STATE', payload: state });
  }, [isHost, multiplayer, multiplayer.status, state]);

  useEffect(() => {
    if (!isHost || state?.phase !== 'countdown') return;
    const id = state.matchId;
    goTimer.current = window.setTimeout(() => reveal(id), Math.max(0, (countdownEndsAt.current ?? Date.now()) - Date.now()));
    return () => { if (goTimer.current !== null) window.clearTimeout(goTimer.current); goTimer.current = null; };
  }, [isHost, state?.matchId, state?.phase, reveal]);

  useEffect(() => {
    if (!isHost || state?.phase !== 'answering' || !firstCorrect.current) return;
    const candidate = firstCorrect.current;
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => finish(candidate.role), Math.max(0, candidate.receivedAt + TIE_WINDOW_MS - Date.now()));
    return () => { if (resultTimer.current !== null) window.clearTimeout(resultTimer.current); resultTimer.current = null; };
  }, [isHost, state?.matchId, state?.phase, finish]);

  useEffect(() => {
    if (!state || state.phase !== 'countdown') return;
    setCountdown(3);
    const two = window.setTimeout(() => { setCountdown(2); sounds.playTick(); }, 1000);
    const one = window.setTimeout(() => { setCountdown(1); sounds.playTick(); }, 2000);
    const go = window.setTimeout(() => { setCountdown('GO'); sounds.playSuccess(); }, 3000);
    return () => { window.clearTimeout(two); window.clearTimeout(one); window.clearTimeout(go); };
  }, [state?.matchId, state?.phase]);

  useEffect(() => {
    const value = guestLockedNumber.current;
    if (isHost || !state || state.phase !== 'picking' || state.partnerLocked || value === null) return;
    multiplayer.sendMessage({ type: 'SECRET_RACE_LOCK', payload: { matchId: state.matchId, number: value } });
  }, [isHost, multiplayer, state?.matchId, state?.partnerLocked, state?.phase]);

  useEffect(() => multiplayer.subscribeMessage(message => {
    if (message.type === 'SECRET_RACE_REQUEST') {
      if (isHost && stateRef.current) multiplayer.sendMessage({ type: 'SECRET_RACE_STATE', payload: stateRef.current });
    } else if (message.type === 'SECRET_RACE_START' || message.type === 'SECRET_RACE_STATE' || message.type === 'SECRET_RACE_RESULT') {
      if (isHost) return;
      if ((stateRef.current?.matchId ?? restored?.state.matchId) !== message.payload.matchId) {
        guestLockedNumber.current = null;
        setNumber('');
        setAnswer('');
        setRetryUntil(0);
        setFeedback('');
      }
      // Replaying an already-finished round is recovery, not a new reward.
      if (!stateRef.current && message.type === 'SECRET_RACE_STATE' && ['result', 'complete'].includes(message.payload.phase)) rewardedRounds.current.add(message.payload.matchId);
      if (message.payload.phase === 'countdown' && stateRef.current?.phase !== 'countdown') countdownEndsAt.current = Date.now() + 3050;
      else if (message.payload.phase !== 'countdown') countdownEndsAt.current = null;
      stateRef.current = message.payload;
      setState(message.payload);
      persist();
      if (message.payload.phase !== 'picking') setFeedback('');
    } else if (message.type === 'SECRET_RACE_LOCK' && isHost) {
      const current = stateRef.current;
      if (!current || current.matchId !== message.payload.matchId || current.phase !== 'picking' || current.partnerLocked || !Number.isInteger(message.payload.number) || message.payload.number < 1 || message.payload.number > rangeFor(current.operation)) return;
      numbersRef.current.partner = message.payload.number;
      const next = { ...current, partnerLocked: true };
      publish(next);
      if (next.hostLocked) beginCountdown(next);
    } else if (message.type === 'SECRET_RACE_GO') {
      const current = stateRef.current;
      if (isHost || !current || current.matchId !== message.payload.matchId || current.phase !== 'countdown') return;
      const next = { ...current, phase: 'answering' as const, equation: message.payload.equation };
      countdownEndsAt.current = null;
      stateRef.current = next;
      setState(next);
      persist();
      setAnswer('');
      setFeedback('');
    } else if (message.type === 'SECRET_RACE_ANSWER' && isHost) {
      if (stateRef.current?.matchId === message.payload.matchId) judge('partner', message.payload.answer);
    } else if (message.type === 'SECRET_RACE_WRONG' && stateRef.current?.matchId === message.payload.matchId) {
      if (!isHost && stateRef.current.phase === 'answering') wrong(WRONG_DELAY_MS);
    } else if (message.type === 'SECRET_RACE_NEXT' && isHost && stateRef.current?.matchId === message.payload.matchId && stateRef.current.phase === 'result') {
      const current = stateRef.current;
      newRound(matchId(), current.round + 1, current.scores);
    } else if (message.type === 'SECRET_RACE_RESTART' && isHost && stateRef.current?.matchId === message.payload.matchId && stateRef.current.phase === 'complete') {
      newRound(matchId(), 1, { host: 0, partner: 0 });
    }
  }), [beginCountdown, isHost, judge, multiplayer, newRound, publish, wrong, persist, restored]);

  useEffect(() => {
    if (isHost || multiplayer.status !== 'connected' || state) return;
    setSetupTimedOut(false);
    let attempts = 0;
    const request = () => {
      if (stateRef.current) return;
      attempts += 1;
      multiplayer.sendMessage({ type: 'SECRET_RACE_REQUEST' });
    };
    // Subscribe above before requesting: a fast host can answer immediately.
    request();
    const timer = window.setInterval(() => {
      if (stateRef.current) { window.clearInterval(timer); return; }
      if (attempts >= SETUP_MAX_REQUESTS) {
        window.clearInterval(timer);
        setSetupTimedOut(true);
        return;
      }
      request();
    }, SETUP_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [isHost, multiplayer.status, multiplayer.sendMessage, Boolean(state), setupAttempt]);

  useEffect(() => () => {
    if (goTimer.current !== null) window.clearTimeout(goTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  useEffect(() => {
    if (!state || (state.phase !== 'result' && state.phase !== 'complete') || rewardedRounds.current.has(state.matchId)) return;
    rewardedRounds.current.add(state.matchId);
    persist();
    addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, true, multiplayer.isHost, multiplayer.remoteProfile?.accountId);
  }, [state, addHeartPoints, multiplayer.isHost, multiplayer.remoteProfile?.accountId, persist]);

  if (multiplayer.status !== 'connected') return <section className="secret-race-card secret-race-empty"><span className="secret-race-empty-icon"><Users aria-hidden="true" /></span><span className="secret-race-eyebrow">SECRET NUMBER RACE</span><h2>A little rivalry, for two.</h2><p>Open a Play Together room, then pick this game from your shared lobby.</p></section>;
  if (!state) return <section className="secret-race-card secret-race-empty" aria-busy={!setupTimedOut}><span className="secret-race-empty-icon"><Sparkles aria-hidden="true" /></span><span className="secret-race-eyebrow">SECRET NUMBER RACE</span><div role="status"><h2>{setupTimedOut ? 'Let’s get you back in sync.' : 'Setting up the race…'}</h2><p>{setupTimedOut ? 'The round is taking a little longer to arrive. Try syncing with your partner again.' : 'Getting the same round ready for both of you.'}</p></div>{setupTimedOut && <button type="button" className="secret-race-next" onClick={retrySetup}>Retry round sync <Sparkles size={16} aria-hidden="true" /></button>}</section>;

  const max = rangeFor(state.operation);
  const locked = role === 'host' ? state.hostLocked : state.partnerLocked;
  const otherLocked = role === 'host' ? state.partnerLocked : state.hostLocked;
  const theirScore = role === 'host' ? state.scores.partner : state.scores.host;
  const myScore = state.scores[role];
  const matchWinner = state.scores.host === state.scores.partner ? 'tie' : state.scores.host > state.scores.partner ? 'host' : 'partner';
  const cooldown = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
  const nextRound = () => {
    if (stateRef.current?.phase !== 'result') return;
    if (isHost) newRound(matchId(), state.round + 1, state.scores);
    else multiplayer.sendMessage({ type: 'SECRET_RACE_NEXT', payload: { matchId: state.matchId } });
  };
  const playAgain = () => {
    if (stateRef.current?.phase !== 'complete') return;
    if (isHost) newRound(matchId(), 1, { host: 0, partner: 0 });
    else multiplayer.sendMessage({ type: 'SECRET_RACE_RESTART', payload: { matchId: state.matchId } });
  };

  return <section className="secret-race-card" aria-label="Secret Number Race">
    <header className="secret-race-header">
      <div><span className="secret-race-eyebrow"><Zap size={14} aria-hidden="true" /> SECRET NUMBER RACE</span><h2>Two numbers. One quick mind.</h2></div>
      <div className="secret-race-score" aria-label={`Score: you ${myScore}, ${partnerName} ${theirScore}`} aria-live="polite" aria-atomic="true">
        <div><small>You</small><strong>{myScore}</strong></div><i aria-hidden="true">:</i><div><small title={partnerName}>{partnerName}</small><strong>{theirScore}</strong></div>
      </div>
    </header>
    <div className="secret-race-round">
      <div><span>ROUND {state.round} OF {MAX_ROUNDS}</span><div className="secret-race-round-dots" aria-hidden="true">{Array.from({ length: MAX_ROUNDS }, (_, index) => <i key={index} className={index < state.round ? 'is-active' : ''} />)}</div></div>
      <div className="secret-race-operation"><strong>{state.operation}</strong><b>{operationName(state.operation)}</b></div>
    </div>

    {state.phase === 'picking' && <div className="secret-race-stage secret-race-pick">
      <div className="secret-race-copy">
        <span className="secret-race-eyebrow"><LockKeyhole size={15} aria-hidden="true" /> KEEP IT SECRET</span>
        <h3>{locked ? 'Your number is locked.' : 'Pick a number.'}</h3>
        <p>{locked ? `Waiting for ${partnerName}. Once you’re both ready, the countdown begins.` : `Choose any whole number from 1 to ${max}. Both numbers stay hidden until GO.`}</p>
        <div className="secret-race-ready" role="status">
          <p className={locked ? 'is-ready' : ''}>{locked ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span>{locked ? 'You are locked in' : 'Choose your number'}</span></p>
          <p className={otherLocked ? 'is-ready' : ''}>{otherLocked ? <Check aria-hidden="true" /> : <Users aria-hidden="true" />}<span>{otherLocked ? partnerName + ' is ready' : partnerName + ' is choosing…'}</span></p>
        </div>
      </div>
      <form onSubmit={event => { event.preventDefault(); lockNumber(); }} className="secret-race-number-form">
        <label htmlFor="secret-number-input">Your secret number <span>1–{max}</span></label>
        <div className="secret-race-stepper">
          <button type="button" aria-label="Decrease secret number" disabled={locked || Number(number) <= 1} onClick={() => setNumber(String(Math.max(1, Number(number || 1) - 1)))}><Minus aria-hidden="true" /></button>
          <input id="secret-number-input" type="number" inputMode="numeric" min="1" max={max} value={number} disabled={locked} aria-describedby="secret-number-hint" onChange={event => setNumber(event.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="?" />
          <button type="button" aria-label="Increase secret number" disabled={locked || Number(number) >= max} onClick={() => setNumber(String(Math.min(max, Number(number || 0) + 1)))}><Plus aria-hidden="true" /></button>
        </div>
        <p id="secret-number-hint" className="secret-race-field-hint">{locked ? 'Safe with you until the reveal.' : 'Choose carefully. You can’t change it after locking.'}</p>
        <button type="submit" disabled={locked || !Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > max} className="secret-race-lock">{locked ? <Check size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />} {locked ? 'Number locked' : 'Lock in my number'}</button>
      </form>
    </div>}

    {state.phase === 'countdown' && <div className="secret-race-stage secret-race-countdown" role="status">
      <strong className="secret-race-count" key={countdown}>{countdown}</strong>
      <div className="secret-race-copy"><span className="secret-race-eyebrow"><Check size={15} aria-hidden="true" /> BOTH NUMBERS LOCKED</span><h3>{countdown === 'GO' ? 'Time to solve it.' : 'Ready for the reveal?'}</h3><p>Both numbers appear at GO. The first correct answer takes the round.</p><div className="secret-race-hidden-equation" aria-hidden="true"><span>?</span><b>{state.operation}</b><span>?</span></div></div>
    </div>}

    {state.phase === 'answering' && state.equation && <div className="secret-race-stage secret-race-answer">
      <div className="secret-race-copy"><span className="secret-race-eyebrow"><Zap size={15} aria-hidden="true" /> GO! SOLVE IT</span><h3>Quick thinking starts here.</h3>
        <div className="secret-race-equation" aria-label={`${state.equation.hostNumber} ${operationName(state.operation)} ${state.equation.partnerNumber} equals what?`}><strong>{state.equation.hostNumber}</strong><i>{state.operation}</i><strong>{state.equation.partnerNumber}</strong><b>=</b><em>?</em></div>
        <p className="secret-race-equation-note">Host number first{state.operation === '−' ? ' — negative answers count too.' : '. First correct answer wins.'}</p>
      </div>
      <form onSubmit={submit} className="secret-race-answer-form">
        <label htmlFor="secret-race-answer">Your answer</label><div className="secret-race-answer-input"><input id="secret-race-answer" type="number" inputMode="numeric" autoFocus value={answer} disabled={cooldown > 0} onChange={event => setAnswer(event.target.value)} placeholder="?" aria-describedby="secret-race-answer-hint" />{state.operation === '−' && <button type="button" className="secret-race-sign-toggle" aria-label="Toggle answer sign" aria-pressed={answer.startsWith('-')} title="Make the answer negative or positive" disabled={!answer.trim() || cooldown > 0} onClick={() => setAnswer(previous => previous.startsWith('-') ? previous.slice(1) : `-${previous}`)}>+/−</button>}</div>
        <p id="secret-race-answer-hint" className="secret-race-field-hint">{cooldown ? 'A quick breather. Then try again.' : 'Type your answer and press Enter.'}</p>
        <button type="submit" disabled={!answer.trim() || cooldown > 0}>{cooldown ? 'Try again in ' + cooldown + 's' : 'Submit answer'} <Zap size={17} aria-hidden="true" /></button>
        {feedback && <p className="secret-race-feedback" role="alert"><X size={15} aria-hidden="true" />{feedback}</p>}
      </form>
    </div>}

    {(state.phase === 'result' || state.phase === 'complete') && state.equation && <div className="secret-race-stage secret-race-result">
      <div className="secret-race-reveal"><span className="secret-race-eyebrow"><Check size={15} aria-hidden="true" /> THE ANSWER</span><div className="secret-race-equation is-solved"><strong>{state.equation.hostNumber}</strong><i>{state.operation}</i><strong>{state.equation.partnerNumber}</strong><b>=</b><em>{state.equation.answer}</em></div><p>Two secret picks, one shared reveal.</p></div>
      <div className="secret-race-result-copy"><span className="secret-race-eyebrow"><Trophy size={15} aria-hidden="true" />{state.phase === 'complete' ? 'MATCH COMPLETE' : 'ROUND REVEAL'}</span>
        <div role="status"><h3>{state.winner === 'tie' ? 'Photo finish — it’s a tie!' : state.winner === role ? 'You won this round!' : partnerName + ' took this one!'}</h3>
          <p>{state.phase === 'complete' ? matchWinner === 'tie' ? 'Five rounds, completely even.' : matchWinner === role ? 'You win the best-of-five match!' : partnerName + ' wins the best-of-five match!' : state.winner === 'tie' ? 'A shared moment. No points this round.' : 'One point on the board. Ready for another?'}</p>
        </div>
        {state.phase === 'complete' ? <div className="secret-race-actions"><button type="button" onClick={playAgain}><Sparkles size={17} aria-hidden="true" /> Play again</button><button type="button" onClick={onEndGame}>Back to games</button></div> : <button type="button" className="secret-race-next" onClick={nextRound}>Next round <Check size={17} aria-hidden="true" /></button>}
      </div>
    </div>}
  </section>;
};
