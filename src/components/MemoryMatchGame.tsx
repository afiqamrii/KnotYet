import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Coffee, Flower2, Heart, Moon, Music, RotateCcw, Sparkles, Star, Sun, Trophy, User, Users, X } from 'lucide-react';
import { flipMemory, hideMemoryMiss, isMemorySession, MEMORY_KEY, memorySetup, restoreLocalActivity, startMemory } from '../utils/localActivities';
import { useChatDialog } from './useChatDialog';
import '../styles/local-activities.css';

const SYMBOLS = [
  { name: 'Heart', Icon: Heart, color: '#ffd2dc' }, { name: 'Sun', Icon: Sun, color: '#f9d77e' },
  { name: 'Moon', Icon: Moon, color: '#c7b4ff' }, { name: 'Coffee', Icon: Coffee, color: '#e7cdb9' },
  { name: 'Music', Icon: Music, color: '#b8e5f7' }, { name: 'Flower', Icon: Flower2, color: '#d5f578' },
  { name: 'Star', Icon: Star, color: '#ffe5a0' }, { name: 'Sparkles', Icon: Sparkles, color: '#b8f1df' },
];

export function MemoryMatchGame({ onEndGame }: { onEndGame?: () => void }) {
  const [session, setSession] = useState(() => restoreLocalActivity(MEMORY_KEY, isMemorySession, memorySetup));
  const [storageError, setStorageError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetRef = useChatDialog(confirmReset, () => setConfirmReset(false));
  const resultRef = useRef<HTMLHeadingElement>(null);
  const setupRef = useRef<HTMLHeadingElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const previousPhase = useRef(session.phase);
  const previousMatchCount = useRef(session.matched.length);
  const previousOpenCount = useRef(session.open.length);

  useEffect(() => {
    try { sessionStorage.setItem(MEMORY_KEY, JSON.stringify(session)); }
    catch { setStorageError(true); }
  }, [session]);
  useEffect(() => {
    if (session.phase === 'complete' && previousPhase.current !== 'complete') resultRef.current?.focus();
    if (session.phase === 'setup' && previousPhase.current !== 'setup') setupRef.current?.focus();
    if (session.phase === 'playing' && (previousPhase.current === 'setup' || session.matched.length > previousMatchCount.current || (previousOpenCount.current === 2 && session.open.length === 0))) {
      boardRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
    if (session.phase === 'playing' && session.open.length === 2 && previousOpenCount.current !== 2) continueRef.current?.focus();
    previousPhase.current = session.phase;
    previousMatchCount.current = session.matched.length;
    previousOpenCount.current = session.open.length;
  }, [session.phase, session.matched.length, session.open.length]);

  const mismatch = session.open.length === 2;
  const matchedPairs = session.matched.length / 2;
  const reset = () => {
    setSession({ ...memorySetup(), mode: session.mode, pairs: session.pairs });
    setConfirmReset(false);
  };

  return <section className="local-activity memory-game" aria-label="Memory Match game">
    <header className="game-toolbar local-activity-toolbar"><div><span className="local-activity-kicker"><Sparkles size={14} /> A LITTLE TEAMWORK</span><h2>Memory Match</h2></div>{onEndGame && <button type="button" className="local-quiet-button" onClick={onEndGame} aria-label="Leave Memory Match"><X size={17} /> Leave game</button>}</header>
    {session.phase === 'setup' ? <div className="local-setup memory-setup">
      <div className="memory-preview" aria-hidden="true">{[0, 2, 2, 0].map((symbol, index) => { const { Icon, color } = SYMBOLS[symbol]; return <span key={index} style={{ background: color }}><Icon /></span>; })}</div>
      <div className="local-setup-copy"><span className="local-activity-kicker">SMALL CARDS. SHARED VICTORY.</span><h3 ref={setupRef} tabIndex={-1}>A good match starts<br />with a little attention.</h3><p>Turn over two cards and find their partner. Take your time. Every pair is a win.</p>
        <fieldset className="local-choice-group"><legend>Who’s playing?</legend><div><button type="button" aria-pressed={session.mode === 'solo'} onClick={() => setSession(current => ({ ...current, mode: 'solo' }))}><User size={17} /> Just me</button><button type="button" aria-pressed={session.mode === 'together'} onClick={() => setSession(current => ({ ...current, mode: 'together' }))}><Users size={17} /> Two of us</button></div></fieldset>
        <fieldset className="local-choice-group"><legend>Your board</legend><div><button type="button" aria-pressed={session.pairs === 6} onClick={() => setSession(current => ({ ...current, pairs: 6 }))}>6 pairs <small>A quick round</small></button><button type="button" aria-pressed={session.pairs === 8} onClick={() => setSession(current => ({ ...current, pairs: 8 }))}>8 pairs <small>A little challenge</small></button></div></fieldset>
        <p className="local-help">{session.mode === 'together' ? 'Share one screen. Find a pair to keep your turn; miss a pair and pass. You’re on the same team.' : 'Try to find every pair in as few turns as you can. There’s no timer.'}</p>
        <button type="button" className="local-primary-button" onClick={() => setSession(startMemory(session.mode, session.pairs))}>Deal the cards <ArrowRight size={18} /></button>
      </div>
    </div> : session.phase === 'complete' ? <div className="local-result">
      <span className="local-result-icon"><Trophy size={35} /></span><span className="local-activity-kicker">EVERY LITTLE PAIR FOUND</span><h3 tabIndex={-1} ref={resultRef}>{session.mode === 'together' ? 'A perfect little team.' : 'Look at that memory.'}</h3><p>You found all {session.pairs} pairs in {session.moves} turns.</p>
      {session.mode === 'together' && <div className="memory-contributions"><span>Player 1 <strong>{session.finds[0]} pairs</strong></span><span>Player 2 <strong>{session.finds[1]} pairs</strong></span></div>}
      <button type="button" className="local-primary-button" onClick={reset}>Play a fresh board <RotateCcw size={17} /></button><p className="local-help">The cards shuffle every time. See what you remember next.</p>
    </div> : <>
      <div className="memory-status"><div className="memory-turn" aria-live="polite" aria-atomic="true"><span className="local-activity-kicker">{session.mode === 'together' ? `PLAYER ${session.player + 1}’S TURN` : 'ONE PAIR AT A TIME'}</span><strong>{mismatch ? 'Close! Take a good look.' : session.open.length ? 'Now find its partner.' : 'Pick any two cards.'}</strong></div><div className="memory-stats"><span><strong>{matchedPairs}/{session.pairs}</strong> pairs</span><span><strong>{session.moves}</strong> turns</span></div></div>
      <div ref={boardRef} className={`memory-grid memory-grid-${session.pairs}`} role="group" aria-label="Memory cards">{session.deck.map((symbol, index) => {
        const matched = session.matched.includes(index);
        const revealed = matched || session.open.includes(index);
        const { name, Icon, color } = SYMBOLS[symbol];
        return <button type="button" key={index} className="memory-card" data-revealed={revealed} data-matched={matched} style={{ '--memory-color': color } as React.CSSProperties} disabled={matched || session.open.includes(index) || mismatch} aria-label={`Card ${index + 1}: ${revealed ? `${name}${matched ? ', matched' : ''}` : 'face down'}`} onClick={() => setSession(current => flipMemory(current, index))}>
          {revealed ? <><Icon aria-hidden="true" /><span>{name}</span>{matched && <Check className="memory-card-check" aria-hidden="true" />}</> : <><Heart aria-hidden="true" /><span>{String(index + 1).padStart(2, '0')}</span></>}
        </button>;
      })}</div>
      <div className="memory-feedback" role="status" aria-live="polite">{mismatch ? <><span>Not a pair. Remember where they are.</span><button ref={continueRef} type="button" className="local-primary-button" onClick={() => setSession(hideMemoryMiss)}>{session.mode === 'together' ? 'Hide cards & pass' : 'Try another pair'} <ArrowRight size={17} /></button></> : <span>{matchedPairs > 0 && session.open.length === 0 ? 'A match! Keep going.' : 'Flip two cards. Matching pictures stay face up.'}</span>}</div>
      <div className="local-game-bottom"><span>{session.mode === 'together' ? 'One screen. One team.' : 'No timer. Your own pace.'}</span><button type="button" className="local-quiet-button" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> New board</button></div>
    </>}
    {storageError && <p className="local-storage-note" role="status">Your browser can’t save this round. You can keep playing, but refreshing will start again.</p>}
    {confirmReset && <div className="local-confirm-overlay"><div ref={resetRef} className="local-confirm" role="dialog" aria-modal="true" aria-labelledby="memory-reset-title" tabIndex={-1}><h3 id="memory-reset-title">Start a fresh board?</h3><p>Your current pairs and turn count will be cleared.</p><div><button type="button" className="local-quiet-button" onClick={() => setConfirmReset(false)}>Keep playing</button><button type="button" className="local-primary-button" onClick={reset}>New board</button></div></div></div>}
  </section>;
}
