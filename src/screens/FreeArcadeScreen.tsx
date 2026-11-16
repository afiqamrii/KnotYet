import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3, Heart, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { BrandMark, GameArtwork } from '../components/ArcadeArt';
import { GAME_CATALOG, isLocalGame, rememberGame, type LocalGameId } from '../data/gameCatalog';
import '../styles/free-arcade.css';

const MemoryMatchGame = lazy(() => import('../components/MemoryMatchGame').then(module => ({ default: module.MemoryMatchGame })));
const StoryBuilderGame = lazy(() => import('../components/StoryBuilderGame').then(module => ({ default: module.StoryBuilderGame })));
const freeGames = GAME_CATALOG.filter(game => isLocalGame(game.id));

export const FreeArcadeScreen = () => {
  const [params, setParams] = useSearchParams();
  const selected = params.get('game');
  const game = isLocalGame(selected) ? selected : null;
  const gameTitle = GAME_CATALOG.find(item => item.id === game)?.title;
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const title = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    document.title = `${gameTitle || 'Free games for a little us time'} | KnotYet`;
    if (description) description.content = 'Play Memory Match and Story Builder for free. A little memory, a little imagination, solo or together on one screen. No account needed.';
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
    return () => { document.title = title; if (description && previousDescription !== undefined) description.content = previousDescription; };
  }, [gameTitle]);
  const choose = (id: LocalGameId) => { rememberGame(id); setParams({ game: id }); };
  const returnToArcade = () => setParams({});
  return <div className="free-arcade">
    <a className="skip-link" href="#free-arcade-main">Skip to games</a>
    <header className="free-arcade-nav arcade-width"><Link className="free-arcade-brand" to="/" aria-label="KnotYet home"><BrandMark />KnotYet<span>.</span></Link><nav aria-label="Free arcade navigation"><Link to="/try">Conversation cards</Link><Link to="/">All games <ArrowRight size={15} /></Link></nav></header>
    <main ref={mainRef} tabIndex={-1} id="free-arcade-main" className="arcade-width">
      {game ? <>
        <div className="free-arcade-session"><button type="button" onClick={returnToArcade}><ArrowLeft size={16} /> Free arcade</button><span><Users size={15} /> Solo or one screen</span></div>
        <div className="free-arcade-game"><Suspense fallback={<div className="free-game-loading" role="status"><Sparkles /> Getting your game ready…</div>}>{game === 'memory' ? <MemoryMatchGame onEndGame={returnToArcade} /> : <StoryBuilderGame onEndGame={returnToArcade} />}</Suspense></div>
        <p className="free-arcade-storage"><ShieldCheck size={14} /> Your game stays in this tab. No account needed.</p>
      </> : <>
        <section className="free-arcade-hero"><div><span className="free-arcade-eyebrow"><Sparkles size={15} /> A SMALL BREAK. A GOOD TIME.</span><h1>Put the scrolling<br />on <em>pause.</em></h1><p>A little memory. A little imagination. Something fun to do with your favourite person, or a moment just for you.</p><div className="free-arcade-perks"><span><ShieldCheck size={15} /> No sign-in</span><span><Users size={15} /> Solo or together</span><span><Heart size={15} /> Free to play</span></div></div><div className="free-arcade-hero-art" aria-hidden="true"><GameArtwork kind="memory" /><span>you + a little play</span><i>✦</i></div></section>
        <section aria-labelledby="free-arcade-games"><div className="free-arcade-section-heading"><span className="free-arcade-eyebrow">THE GOOD STUFF STARTS HERE</span><h2 id="free-arcade-games">Pick your little escape.</h2></div><div className="free-arcade-grid">{freeGames.map(item => <article key={item.id} className={`free-arcade-tile free-arcade-${item.id}`}><div className="free-arcade-tile-art"><span className="free-arcade-new">JUST ADDED</span><GameArtwork kind={item.kind} /></div><div className="free-arcade-tile-copy"><span className="free-arcade-eyebrow">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><div className="free-arcade-tile-meta"><span><Clock3 size={14} /> {item.minutes}</span><span><Users size={14} /> {item.players}</span></div><button type="button" onClick={() => choose(item.id as LocalGameId)}>Play {item.title}<ArrowRight size={18} /></button></div></article>)}</div></section>
        <section className="free-arcade-conversation"><div><span className="free-arcade-eyebrow">MORE TALK. LESS SMALL TALK.</span><h2>In the mood to get closer?</h2><p>Try 18 thoughtful conversation cards, with follow-ups worth staying for.</p></div><Link to="/try">Pick a conversation <ArrowRight size={18} /></Link></section>
      </>}
    </main>
    <footer className="free-arcade-footer arcade-width"><span>A little play. A little closer.</span><Link to="/privacy">Privacy Policy</Link></footer>
  </div>;
};
