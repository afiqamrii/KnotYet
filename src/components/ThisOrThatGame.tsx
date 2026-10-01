import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, RotateCw, User, Users } from 'lucide-react';
import { WOULD_YOU_RATHER } from '../data/questions';
import { useGame } from '../store/GameContext';
import { useMultiplayer } from '../store/MultiplayerContext';
import { advanceChoice, choose, isChoiceRound, type Choice, type ChoiceRound } from '../utils/choiceGame';
import { readJson, writeJson } from '../utils/storage';
import { RoundLabel, ResultArt } from './GameCardDesign';
import '../styles/choices.css';

const VALID_IDS = new Set(WOULD_YOU_RATHER.map(item => item.id));
const QUESTIONS = new Map(WOULD_YOU_RATHER.map(item => [item.id, item]));
type LocalMode = 'solo' | 'together';
const freshRound = (): ChoiceRound => {
  const ids = [...VALID_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { roundId: crypto.randomUUID(), ids: ids.slice(0, 8), index: 0, picks: [null, null], matches: 0 };
};

export function ThisOrThatGame() {
  const multiplayer = useMultiplayer();
  const { profile, partner } = useGame();
  const connected = multiplayer.status === 'connected';
  const roomCode = multiplayer.roomCode;
  const online = Boolean(roomCode);
  const [mode, setMode] = useState<LocalMode>(() => sessionStorage.getItem('choices_mode') === 'together' ? 'together' : 'solo');
  const solo = !online && mode === 'solo';
  const storageKey = `choices_${online ? (multiplayer.isHost ? 'host' : 'guest') : 'local'}`;
  const [round, setRound] = useState<ChoiceRound | null>(() => {
    const saved = readJson<unknown>(sessionStorage, storageKey, null);
    if (online) {
      const session = saved as { roomCode?: unknown; round?: unknown } | null;
      if (session?.roomCode === roomCode && isChoiceRound(session.round, VALID_IDS)) return session.round;
    } else if (isChoiceRound(saved, VALID_IDS)) return saved;
    return online && !multiplayer.isHost ? null : freshRound();
  });
  const roundRef = useRef(round);
  const [handoverReady, setHandoverReady] = useState(false);
  const [synced, setSynced] = useState(!online || multiplayer.isHost);
  const save = useCallback((next: ChoiceRound, broadcast = false) => {
    roundRef.current = next;
    setRound(next);
    writeJson(sessionStorage, storageKey, online ? { roomCode, round: next } : next);
    if (broadcast && connected) multiplayer.sendMessage({ type: 'CHOICES_STATE', payload: next });
  }, [multiplayer.sendMessage, storageKey, online, roomCode, connected]);

  useEffect(() => {
    if (!online) return;
    if (!connected) { setSynced(false); return; }
    const unsubscribe = multiplayer.subscribeMessage(message => {
      if (message.type === 'CHOICES_REQUEST' && multiplayer.isHost && roundRef.current) {
        multiplayer.sendMessage({ type: 'CHOICES_STATE', payload: roundRef.current });
      } else if (message.type === 'CHOICES_STATE' && !multiplayer.isHost && isChoiceRound(message.payload, VALID_IDS)) {
        save(message.payload);
        setSynced(true);
      } else if (message.type === 'CHOICES_PICK' && multiplayer.isHost && roundRef.current) {
        const next = choose(roundRef.current, 1, message.payload.choice, message.payload.roundId);
        if (next !== roundRef.current) save(next, true);
      }
    });
    if (multiplayer.isHost && roundRef.current) {
      setSynced(true);
      multiplayer.sendMessage({ type: 'CHOICES_STATE', payload: roundRef.current });
    } else {
      setSynced(false);
      multiplayer.sendMessage({ type: 'CHOICES_REQUEST' });
    }
    return unsubscribe;
  }, [online, connected, multiplayer.isHost, multiplayer.subscribeMessage, multiplayer.sendMessage, save]);

  const pick = (choice: Choice) => {
    const current = roundRef.current;
    if (!current || !synced || (online && !connected)) return;
    const player = online ? (multiplayer.isHost ? 0 : 1) : (mode === 'together' && current.picks[0] !== null ? 1 : 0);
    if (!online && player === 1 && !handoverReady) return;
    const next = choose(current, player, choice, current.roundId);
    if (next === current) return;
    save(next, online && multiplayer.isHost);
    if (online && !multiplayer.isHost) multiplayer.sendMessage({ type: 'CHOICES_PICK', payload: { roundId: current.roundId, choice } });
  };

  const restart = (nextMode = mode) => {
    if (online && (!multiplayer.isHost || !connected)) return;
    setMode(nextMode);
    sessionStorage.setItem('choices_mode', nextMode);
    setHandoverReady(false);
    save(freshRound(), online);
  };

  if (!round || !synced) return <section className="choices-game choices-wait" role="status"><LockKeyhole /><h2>This or That</h2><p>{online && !connected ? 'Your round is paused while your partner reconnects.' : 'Getting the shared round ready…'}</p><button className="game-action" disabled={!connected} onClick={() => multiplayer.sendMessage({ type: 'CHOICES_REQUEST' })}>Sync round</button></section>;
  const complete = round.index >= round.ids.length;
  const question = QUESTIONS.get(round.ids[round.index]);
  const revealed = round.picks[0] !== null && (solo || round.picks[1] !== null);
  const localPlayer = online ? (multiplayer.isHost ? 0 : 1) : (mode === 'together' && round.picks[0] !== null ? 1 : 0);
  const names = online ? (multiplayer.isHost ? [profile?.name || 'You', multiplayer.remoteProfile?.name || 'Partner'] : [multiplayer.remoteProfile?.name || 'Partner', profile?.name || 'You']) : [profile?.name || 'Player 1', partner?.name || 'Player 2'];
  const passing = !online && !solo && round.picks[0] !== null && round.picks[1] === null && !handoverReady;
  const waiting = online && round.picks[localPlayer] !== null && !revealed;

  return <section className="choices-game" aria-label="This or That game">
    <RoundLabel title="This or That" detail={complete ? 'Round complete' : `${round.index + 1} / ${round.ids.length}`} kind="together" />
    {!online && <div className="choices-mode" role="group" aria-label="Players">
      <button disabled={!complete && round.picks.some(p => p !== null)} aria-pressed={mode === 'solo'} onClick={() => restart('solo')}><User size={16} /> Solo</button>
      <button disabled={!complete && round.picks.some(p => p !== null)} aria-pressed={mode === 'together'} onClick={() => restart('together')}><Users size={16} /> Pass the phone</button>
    </div>}
    {complete ? <div className="choices-panel choices-finish">
      <ResultArt kind={solo ? 'smile' : 'together'} /><h2>{solo ? 'A little more you.' : 'Eight choices. Plenty to talk about.'}</h2>
      <p>{solo ? 'Which answer surprised you most?' : `You picked the same side ${round.matches} of ${round.ids.length} times. Which difference deserves another conversation?`}</p>
      {(!online || multiplayer.isHost) ? <button className="game-primary-action" onClick={() => restart()}><RotateCw size={18} /> Play another round</button> : <p role="status">Your host can start another round.</p>}
    </div> : passing ? <div className="choices-panel choices-finish" aria-live="polite">
      <LockKeyhole size={36} /><h2>Pass to {names[1]}</h2><p>The first choice is tucked away. Pick your own answer before the reveal.</p>
      <button className="game-primary-action" onClick={() => setHandoverReady(true)}>I’m ready <ArrowRight size={18} /></button>
    </div> : question ? <div className="choices-panel">
      <span className="choices-eyebrow">{solo ? 'Go with your instinct' : revealed ? 'The reveal' : online ? 'Choose before you compare' : `${names[localPlayer]}’s choice`}</span>
      <h2>{question.question}</h2>
      <div className="choices-options">
        {question.options.map((option, index) => <button key={option} disabled={revealed || waiting} className={`choices-option ${revealed && round.picks[0] === index ? 'choice-first' : ''} ${revealed && round.picks[1] === index ? 'choice-second' : ''}`} onClick={() => pick(index as Choice)}>
          <span className="choices-letter">{index === 0 ? 'A' : 'B'}</span><strong>{option}</strong>
          {revealed && <span className="choices-votes">{round.picks[0] === index && <span><Check size={14} /> {solo ? 'Your pick' : names[0]}</span>}{!solo && round.picks[1] === index && <span><Check size={14} /> {names[1]}</span>}</span>}
        </button>)}
      </div>
      {waiting && <p className="choices-note" role="status"><LockKeyhole size={16} /> Choice locked. Waiting for your partner.</p>}
      {revealed && <div className="choices-followup" aria-live="polite"><span>{solo ? 'One more thought' : 'Here’s the interesting part'}</span><p>{question.followUp}</p></div>}
      {revealed && ((!online || multiplayer.isHost) ? <button className="game-primary-action" onClick={() => { if (online && !connected) return; const next = advanceChoice(roundRef.current!, solo); setHandoverReady(false); save(next, online); }}>{round.index + 1 === round.ids.length ? 'Finish round' : 'Next choice'} <ArrowRight size={18} /></button> : <p className="choices-note" role="status">Take your time. Your host can move to the next choice.</p>)}
      {!revealed && !waiting && <p className="choices-note">{solo ? 'No right answer. Just a good question.' : 'Choose separately, then tell each other why.'}</p>}
    </div> : null}
  </section>;
}
