import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, LockKeyhole, Minus, Plus, Sparkles, Trophy, Users, X, Zap } from 'lucide-react';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useMultiplayer, type SecretRaceOperation, type SecretRaceRole, type SecretRaceState } from '../store/MultiplayerContext';
import { sounds } from '../utils/audio';
import '../styles/secret-race.css';

const MAX_ROUNDS = 5;
const TIE_WINDOW_MS = 350;
const WRONG_DELAY_MS = 2_000;
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
  const role: 'host' | 'partner' = isHost ? 'host' : 'partner';
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Your person';
  const [state, setState] = useState<SecretRaceState | null>(null);
  const stateRef = useRef<SecretRaceState | null>(null);
  const numbersRef = useRef<PrivateNumbers>({});
  const guestLockedNumber = useRef<number | null>(null);
  const firstCorrect = useRef<Candidate | null>(null);
  const goTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);
  const started = useRef(false);
  const [number, setNumber] = useState('');
  const [answer, setAnswer] = useState('');
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'GO'>(3);
  const [retryUntil, setRetryUntil] = useState(0);
  const [feedback, setFeedback] = useState('');

  const publish = useCallback((next: SecretRaceState, type: 'SECRET_RACE_START' | 'SECRET_RACE_STATE' | 'SECRET_RACE_RESULT' = 'SECRET_RACE_STATE') => {
    stateRef.current = next;
    setState(next);
    multiplayer.sendMessage({ type, payload: next });
  }, [multiplayer]);

  const newRound = useCallback((id: string, round: number, scores: { host: number; partner: number }) => {
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
    stateRef.current = next;
    setState(next);
    multiplayer.sendMessage({ type: 'SECRET_RACE_GO', payload: { matchId: id, equation } });
    sounds.playSuccess();
  }, [isHost, multiplayer]);

  const beginCountdown = useCallback((current: SecretRaceState) => {
    if (!isHost || current.phase !== 'picking' || !current.hostLocked || !current.partnerLocked) return;
    publish({ ...current, phase: 'countdown' });
    goTimer.current = window.setTimeout(() => reveal(current.matchId), 3050);
  }, [isHost, publish, reveal]);

  const wrong = useCallback((delay = WRONG_DELAY_MS) => {
    const until = Date.now() + delay;
    setFeedback('Not quite — take a breath and race again!');
    setAnswer('');
    setRetryUntil(until);
    window.setTimeout(() => setRetryUntil(previous => previous === until ? 0 : previous), delay);
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
    addHeartPoints(HEART_POINTS.COMPLETE_QUIZ, true);
  }, [addHeartPoints, isHost, publish, role]);

  const judge = useCallback((player: 'host' | 'partner', value: number) => {
    const current = stateRef.current;
    if (!isHost || !current || current.phase !== 'answering' || !current.equation || value !== current.equation.answer) {
      if (player === 'host') wrong();
      else multiplayer.sendMessage({ type: 'SECRET_RACE_WRONG', payload: { matchId: current?.matchId || '', delayMs: WRONG_DELAY_MS } });
      return;
    }
    const now = performance.now();
    const first = firstCorrect.current;
    if (first && first.role !== player && now - first.receivedAt <= TIE_WINDOW_MS) {
      if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
      finish('tie');
    } else if (!first) {
      firstCorrect.current = { role: player, receivedAt: now };
      resultTimer.current = window.setTimeout(() => finish(player), TIE_WINDOW_MS);
    }
  }, [finish, isHost, multiplayer, wrong]);

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
      multiplayer.sendMessage({ type: 'SECRET_RACE_LOCK', payload: { matchId: current.matchId, number: value } });
    }
    sounds.playFlip();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const current = stateRef.current;
    const value = Number(answer);
    if (!current || current.phase !== 'answering' || retryUntil > Date.now() || !Number.isInteger(value)) return;
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
    if (message.type === 'SECRET_RACE_START' || message.type === 'SECRET_RACE_STATE' || message.type === 'SECRET_RACE_RESULT') {
      if (message.type === 'SECRET_RACE_START') guestLockedNumber.current = null;
      stateRef.current = message.payload;
      setState(message.payload);
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
      if (!current || current.matchId !== message.payload.matchId) return;
      const next = { ...current, phase: 'answering' as const, equation: message.payload.equation };
      stateRef.current = next;
      setState(next);
      setAnswer('');
      setFeedback('');
    } else if (message.type === 'SECRET_RACE_ANSWER' && isHost) {
      if (stateRef.current?.matchId === message.payload.matchId) judge('partner', message.payload.answer);
    } else if (message.type === 'SECRET_RACE_WRONG' && stateRef.current?.matchId === message.payload.matchId) {
      wrong(message.payload.delayMs);
    } else if (message.type === 'SECRET_RACE_NEXT' && isHost && stateRef.current?.matchId === message.payload.matchId && stateRef.current.phase === 'result') {
      const current = stateRef.current;
      newRound(current.matchId, current.round + 1, current.scores);
    } else if (message.type === 'SECRET_RACE_RESTART' && isHost && stateRef.current?.matchId === message.payload.matchId) {
      newRound(matchId(), 1, { host: 0, partner: 0 });
    }
  }), [beginCountdown, isHost, judge, multiplayer, newRound, publish, wrong]);

  useEffect(() => () => {
    if (goTimer.current !== null) window.clearTimeout(goTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
  }, []);

  if (multiplayer.status !== 'connected') return <section className="secret-race-card secret-race-empty"><Users /><h2>Secret Number Race is made for two.</h2><p>Open a Play Together room, then pick this game from your shared lobby.</p></section>;
  if (!state) return <section className="secret-race-card secret-race-empty"><Sparkles /><h2>Setting up the race…</h2><p>Your shared round is loading.</p></section>;

  const max = rangeFor(state.operation);
  const locked = role === 'host' ? state.hostLocked : state.partnerLocked;
  const otherLocked = role === 'host' ? state.partnerLocked : state.hostLocked;
  const theirScore = role === 'host' ? state.scores.partner : state.scores.host;
  const myScore = state.scores[role];
  const matchWinner = state.scores.host === state.scores.partner ? 'tie' : state.scores.host > state.scores.partner ? 'host' : 'partner';
  const cooldown = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
  const nextRound = () => {
    if (isHost) newRound(state.matchId, state.round + 1, state.scores);
    else multiplayer.sendMessage({ type: 'SECRET_RACE_NEXT', payload: { matchId: state.matchId } });
  };
  const playAgain = () => {
    if (isHost) newRound(matchId(), 1, { host: 0, partner: 0 });
    else multiplayer.sendMessage({ type: 'SECRET_RACE_RESTART', payload: { matchId: state.matchId } });
  };

  return <section className="secret-race-card" aria-live="polite">
    <header className="secret-race-header"><div><span><Zap /> SECRET NUMBER RACE</span><h2>First to the answer wins.</h2></div><div className="secret-race-score"><strong>{myScore}</strong><small>YOU</small><i>:</i><strong>{theirScore}</strong><small>{partnerName}</small></div></header>
    <div className="secret-race-round"><span>ROUND {state.round} OF {MAX_ROUNDS}</span><b>{operationName(state.operation)}</b><strong>{state.operation}</strong></div>
    {state.phase === 'picking' && <main className="secret-race-stage secret-race-pick"><div className="secret-race-copy"><span><LockKeyhole /> KEEP IT SECRET</span><h3>Pick a number from 1 to {max}.</h3><p>You both see the <b>{state.operation}</b> first. Numbers reveal only at GO.</p></div><form onSubmit={event => { event.preventDefault(); lockNumber(); }} className="secret-race-number-form"><label htmlFor="secret-number-input">Your secret number</label><div><button type="button" disabled={locked || Number(number) <= 1} onClick={() => setNumber(String(Math.max(1, Number(number || 1) - 1)))}><Minus /></button><input id="secret-number-input" type="number" inputMode="numeric" min="1" max={max} value={number} disabled={locked} onChange={event => setNumber(event.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="?" /><button type="button" disabled={locked || Number(number) >= max} onClick={() => setNumber(String(Math.min(max, Number(number || 0) + 1)))}><Plus /></button></div><button type="submit" disabled={locked || !Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > max} className="secret-race-lock"><LockKeyhole /> {locked ? 'Number locked' : 'Lock in my number'}</button></form><div className="secret-race-ready"><p className={locked ? 'is-ready' : ''}><Check /> {locked ? 'You are locked in' : 'Choose your number'}</p><p className={otherLocked ? 'is-ready' : ''}><Users /> {otherLocked ? partnerName + ' is ready' : partnerName + ' is choosing…'}</p></div></main>}
    {state.phase === 'countdown' && <main className="secret-race-stage secret-race-countdown"><span>NUMBERS LOCKED</span><strong key={countdown}>{countdown}</strong><h3>{countdown === 'GO' ? 'Ready for the equation!' : 'Get ready to race'}</h3><p>Both numbers reveal at GO.</p></main>}
    {state.phase === 'answering' && state.equation && <main className="secret-race-stage secret-race-answer"><span><Sparkles /> GO! SOLVE IT</span><div className="secret-race-equation"><strong>{state.equation.hostNumber}</strong><i>{state.operation}</i><strong>{state.equation.partnerNumber}</strong><b>=</b><em>?</em></div><p>Host number first{state.operation === '−' ? ' — negative answers count too.' : '.'}</p><form onSubmit={submit} className="secret-race-answer-form"><label htmlFor="secret-race-answer">Your answer</label><input id="secret-race-answer" type="number" inputMode="numeric" autoFocus value={answer} disabled={cooldown > 0} onChange={event => setAnswer(event.target.value)} placeholder="?" /><button type="submit" disabled={!answer.trim() || cooldown > 0}>{cooldown ? 'Try again in ' + cooldown + 's' : 'Submit answer'} <Zap /></button></form>{feedback && <p className="secret-race-feedback"><X /> {feedback}</p>}</main>}
    {(state.phase === 'result' || state.phase === 'complete') && state.equation && <main className="secret-race-stage secret-race-result"><span><Trophy /> ROUND REVEAL</span><div className="secret-race-equation is-solved"><strong>{state.equation.hostNumber}</strong><i>{state.operation}</i><strong>{state.equation.partnerNumber}</strong><b>=</b><em>{state.equation.answer}</em></div><h3>{state.winner === 'tie' ? 'Photo finish — it’s a tie!' : state.winner === role ? 'You won this round!' : partnerName + ' took this one!'}</h3>{state.phase === 'complete' ? <><p>{matchWinner === 'tie' ? 'Five rounds, completely even.' : matchWinner === role ? 'You win the best-of-five match!' : partnerName + ' wins the best-of-five match!'}</p><div className="secret-race-actions"><button type="button" onClick={playAgain}><Sparkles /> Play again</button><button type="button" onClick={onEndGame}>Back to games</button></div></> : <button type="button" className="secret-race-next" onClick={nextRound}>Next round <Check /></button>}</main>}
  </section>;
};
