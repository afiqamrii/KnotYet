import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Copy, Download, Feather, RotateCcw, Sparkles, Undo2, User, Users, X } from 'lucide-react';
import { addStoryLine, isStorySession, restoreLocalActivity, STORY_KEY, STORY_PROMPTS, STORY_STARTERS, storySetup, storyText, undoStoryLine } from '../utils/localActivities';
import { useChatDialog } from './useChatDialog';
import '../styles/local-activities.css';

export function StoryBuilderGame({ onEndGame }: { onEndGame?: () => void }) {
  const [session, setSession] = useState(() => restoreLocalActivity(STORY_KEY, isStorySession, storySetup));
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const resetRef = useChatDialog(confirmReset, () => setConfirmReset(false));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const setupRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousPhase = useRef(session.phase);
  const previousLineCount = useRef(session.lines.length);
  const names = session.names.map((name, index) => name.trim() || `Player ${index + 1}`);
  const author = session.mode === 'solo' ? 0 : session.lines.length % 2;
  const starter = STORY_STARTERS[session.starter];

  useEffect(() => {
    try { sessionStorage.setItem(STORY_KEY, JSON.stringify(session)); }
    catch { setStorageError(true); }
  }, [session]);
  useEffect(() => {
    if (session.phase !== previousPhase.current) {
      if (session.phase === 'complete') headingRef.current?.focus();
      if (session.phase === 'writing') inputRef.current?.focus();
      if (session.phase === 'setup') setupRef.current?.focus();
    }
    previousPhase.current = session.phase;
  }, [session.phase]);
  useEffect(() => {
    // New paragraphs grow above the mobile composer. Keep the next writer's
    // input within reach instead of leaving keyboard focus below the screen.
    if (session.phase === 'writing' && previousLineCount.current !== session.lines.length) {
      inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    previousLineCount.current = session.lines.length;
  }, [session.lines.length, session.phase]);

  const setName = (index: 0 | 1, name: string) => setSession(current => {
    const updated: [string, string] = [...current.names]; updated[index] = name;
    return { ...current, names: updated };
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setNotice('');
    setSession(addStoryLine);
    inputRef.current?.focus({ preventScroll: true });
  };
  const undo = () => {
    setNotice(''); setSession(undoStoryLine);
    inputRef.current?.focus({ preventScroll: true });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(storyText(session)); setNotice('Story copied. Ready to keep or share.'); }
    catch { setNotice('Copy is unavailable here. Download your story, or select and copy its text.'); }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([storyText(session)], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'our-knotyet-story.txt';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your story is ready to save as a text file.');
    } catch { setNotice('The download could not start. You can select and copy your story.'); }
  };
  const reset = () => {
    setSession({ ...storySetup(), names: session.names, mode: session.mode, starter: (session.starter + 1) % STORY_STARTERS.length });
    setNotice(''); setConfirmReset(false);
  };
  const nameFields = <div className="story-name-fields"><label>{session.mode === 'solo' ? 'Your name' : 'First storyteller'}<input value={session.names[0]} maxLength={24} onChange={event => setName(0, event.target.value)} placeholder="Player 1" /></label>{session.mode === 'together' && <label>Second storyteller<input value={session.names[1]} maxLength={24} onChange={event => setName(1, event.target.value)} placeholder="Player 2" /></label>}</div>;

  return <section className="local-activity story-game" aria-label="Story Builder game">
    <header className="game-toolbar local-activity-toolbar"><div><span className="local-activity-kicker"><Feather size={14} /> MAKE SOMETHING TOGETHER</span><h2>Story Builder</h2></div>{onEndGame && <button type="button" className="local-quiet-button" onClick={onEndGame} aria-label="Leave Story Builder"><X size={17} /> Leave game</button>}</header>
    {session.phase === 'setup' ? <div className="story-setup">
      <div className="story-setup-heading"><span className="story-illustration" aria-hidden="true"><BookOpen /><Sparkles /></span><div><h3 ref={setupRef} tabIndex={-1}>One line from you.<br /><em>A whole world from us.</em></h3><p>Take turns adding a sentence. Follow the unexpected. In eight turns, you’ll have a story that only you could write.</p></div></div>
      <div className="story-preferences"><fieldset className="local-choice-group"><legend>Your storytellers</legend><div><button type="button" aria-pressed={session.mode === 'solo'} onClick={() => setSession(current => ({ ...current, mode: 'solo' }))}><User size={17} /> Just me</button><button type="button" aria-pressed={session.mode === 'together'} onClick={() => setSession(current => ({ ...current, mode: 'together' }))}><Users size={17} /> Two of us</button></div></fieldset>{nameFields}</div>
      <fieldset className="story-starters"><legend>Choose your opening line</legend><div>{STORY_STARTERS.map((item, index) => <button key={item.title} type="button" aria-pressed={session.starter === index} onClick={() => setSession(current => ({ ...current, starter: index }))}><span>{item.mood}{session.starter === index && <Check size={15} />}</span><strong>{item.title}</strong><p>{item.text}</p></button>)}</div></fieldset>
      <div className="local-game-bottom"><p className="local-help">{session.mode === 'together' ? 'Pass one screen between you. No room code needed.' : 'A small creative break, all to yourself.'}</p><button type="button" className="local-primary-button" onClick={() => setSession(current => ({ ...current, phase: 'writing' }))}>Begin our story <ArrowRight size={17} /></button></div>
    </div> : <>
      {session.phase === 'complete' ? <div className="story-complete-heading"><span className="local-activity-kicker"><Check size={15} /> YOUR STORY, IN YOUR WORDS</span><h3 ref={headingRef} tabIndex={-1}>That’s a story worth keeping.</h3><p>{session.lines.length} little additions. One original adventure.</p><div className="story-export"><button type="button" className="local-primary-button" onClick={() => void copy()}><Copy size={17} /> Copy story</button><button type="button" className="local-secondary-button" onClick={download}><Download size={17} /> Download .txt</button></div></div> : <div className="story-turn-bar" role="status" aria-live="polite" aria-atomic="true"><div><span className="local-activity-kicker">{session.mode === 'together' ? `${names[author]}’S TURN` : 'YOUR NEXT LINE'}</span><strong>{STORY_PROMPTS[session.lines.length]}</strong></div><span>{session.lines.length}/8 <small>lines</small></span></div>}
      <div className="story-workspace" data-complete={session.phase === 'complete'}>
        <article className="story-paper" aria-label="Your story so far"><div className="story-paper-heading"><BookOpen size={19} /><span>{session.mode === 'solo' ? names[0] : names.join(' & ')} present</span></div><label className="story-title-label">Story title<input value={session.title} maxLength={60} onChange={event => setSession(current => ({ ...current, title: event.target.value }))} placeholder={starter.title} /></label><p className="story-opening">{starter.text}</p><ol>{session.lines.map((line, index) => <li key={index}><span className={`story-author story-author-${line.author}`}>{names[line.author]}</span><p>{line.text}</p></li>)}</ol>{session.lines.length === 0 && <div className="story-empty"><Feather size={24} /><span>Your next sentence is where this story becomes yours.</span></div>}</article>
        {session.phase === 'writing' && <div className="story-composer"><form onSubmit={submit}><label htmlFor="story-next-line">{session.mode === 'together' ? `${names[author]}, what happens next?` : 'What happens next?'}</label><p className="local-help">A sentence or two is plenty. There are no wrong turns.</p><textarea ref={inputRef} id="story-next-line" value={session.draft} onChange={event => setSession(current => ({ ...current, draft: event.target.value }))} maxLength={400} rows={5} placeholder="And then…" aria-describedby="story-draft-length" /><div className="story-draft-meta"><button type="button" className="local-quiet-button" disabled={session.lines.length === 0 || Boolean(session.draft.trim())} onClick={undo} title={session.draft.trim() ? 'Clear your draft to undo the previous line' : 'Bring the previous line back to edit'}><Undo2 size={15} /> Undo last line</button><span id="story-draft-length">{session.draft.length}/400</span></div><button className="local-primary-button" type="submit" disabled={!session.draft.trim()}>{session.lines.length === 7 ? 'Add our ending' : 'Add to the story'} <ArrowRight size={17} /></button></form><details className="story-edit-names"><summary>Edit storyteller names</summary>{nameFields}</details><p className="local-help">Your draft stays in this tab. Nothing you write is sent to other players.</p>{session.lines.length >= 2 && <button type="button" className="local-quiet-button story-finish" disabled={Boolean(session.draft.trim())} title={session.draft.trim() ? 'Add or clear your draft before finishing' : 'Keep this story at its current length'} onClick={() => setSession(current => ({ ...current, phase: 'complete' }))}><Check size={16} /> This feels like an ending</button>}</div>}
      </div>
      <p className="local-feedback" role="status">{notice}</p>
      <div className="local-game-bottom">{session.phase === 'complete' ? <button type="button" className="local-quiet-button" onClick={undo}><Undo2 size={16} /> Edit our last line</button> : <span className="local-help">A little imagination. A story you can keep.</span>}<button type="button" className="local-quiet-button" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Start a new story</button></div>
    </>}
    {storageError && <p className="local-storage-note" role="status">Your browser can’t save this draft. Copy or download your finished story before leaving.</p>}
    {confirmReset && <div className="local-confirm-overlay"><div ref={resetRef} className="local-confirm" role="dialog" aria-modal="true" aria-labelledby="story-reset-title" tabIndex={-1}><h3 id="story-reset-title">A new beginning?</h3><p>This replaces your current story. Copy or download it first if you want to keep it.</p><div><button type="button" className="local-quiet-button" onClick={() => setConfirmReset(false)}>Keep this story</button><button type="button" className="local-primary-button" onClick={reset}>Start a new story</button></div></div></div>}
  </section>;
}
