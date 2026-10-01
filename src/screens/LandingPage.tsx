import { UiSymbol } from '../components/GameCardDesign';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ChevronRight, Gamepad2, Heart, Link2, Play, RefreshCw, Sparkles, Users, Wifi } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { BrandMark, DuoMascot, GameArtwork } from '../components/ArcadeArt';
import '../styles/landing.css';

const GAMES = [
  { id: 'swipe', title: 'Icebreaker Cards', kind: 'cards', mood: 'closer', tag: 'A little deeper', description: 'Take turns drawing a question, answering aloud, and exploring the follow-up together.', color: 'pink', players: 'Solo or together' },
  { id: 'quiz', title: 'Guess My Heart', kind: 'heart', mood: 'closer', tag: 'How well do you know me?', description: 'Guess how your partner answered, then reveal the choice and talk about the surprise.', color: 'purple', players: 'Made for two' },
  { id: 'wheel', title: 'Spin Wheel', kind: 'wheel', mood: 'laughs', tag: 'Let fate decide', description: 'Spin to choose a conversation topic and let a prompt start the next round.', color: 'yellow', players: 'Solo or together' },
  { id: 'number', title: 'Number Guesser', kind: 'number', mood: 'laughs', tag: 'A friendly little rivalry', description: 'Crack a mystery number with higher-or-lower clues. Play solo or take turns.', color: 'blue', players: 'Solo or together' },
  { id: 'letter', title: 'Letter Race', kind: 'letter', mood: 'laughs', tag: 'Ready, set, think!', description: 'Find a word for a surprise letter. Warm up solo or race your partner.', color: 'green', players: 'Solo or together' },
  { id: 'match', title: 'Couple Match', kind: 'match', mood: 'closer', tag: 'Same question. Your own answer.', description: 'Choose separately on one phone or online, then find out where you agree.', color: 'purple', players: 'Made for two' },
  { id: 'choices', title: 'This or That', kind: 'match', mood: 'laughs', tag: 'Pick a side. Tell us why.', description: 'Eight unexpected choices with a follow-up worth sitting with. Reflect solo or compare with your person.', color: 'pink', players: 'Solo or together' },
] as const;
const QUESTIONS = [
  'What is a tiny luxury you would defend as a necessity?',
  'What did you change your mind about after getting to know me?',
  'Which ordinary day would you happily live through again?',
  'What would you like us to make more time for, without making a big plan?',
];
type Mood = 'all' | 'closer' | 'laughs';

export const LandingPage = () => {
  const { signInWithGoogle } = useAuth();
  const [mood, setMood] = useState<Mood>('all');
  const [question, setQuestion] = useState(0);
  const [signInError, setSignInError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const startGame = async (game = 'swipe', joinPartner = false) => {
    localStorage.setItem('knotyet_activeTab', game);
    if (joinPartner) sessionStorage.setItem('knotyet_openRoom', 'true');
    else sessionStorage.removeItem('knotyet_openRoom');
    setSignInError(''); setIsSigningIn(true);
    try { await signInWithGoogle(); }
    catch { setSignInError('Couldn’t connect to Google. Please try signing in again.'); }
    finally { setIsSigningIn(false); }
  };
  return (
    <div className="date-arcade" id="top">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="date-nav page-width">
        <a className="date-brand" href="#top" aria-label="KnotYet home"><BrandMark /><span>KnotYet<span className="brand-period">.</span></span></a>
        <nav className="date-nav-links" aria-label="Main navigation"><Link to="/try">Play free deck</Link><a href="#games">The games</a><a href="#how-it-works">How to play</a><span className="nav-love-note">Made for two <Heart size={13} fill="currentColor" /></span></nav>
        <button className="arcade-button nav-play" disabled={isSigningIn} onClick={() => void startGame()}><Gamepad2 size={18} /> {isSigningIn ? 'Signing in…' : 'Sign in & play'} <ArrowRight size={16} /></button>
      </header>
      <main id="main-content">
        <section className="date-hero page-width" aria-labelledby="hero-title">
          <div className="date-hero-copy">
            <span className="date-eyebrow"><span /> TWO PLAYERS. ENDLESS POSSIBILITIES.</span>
            <h1 id="hero-title">Your next<br />date night.<br /><span>With a twist<svg viewBox="0 0 370 18" aria-hidden="true"><path d="M3 12Q150-4 365 8M32 17Q180 3 336 13" /></svg></span><span className="hero-period">.</span></h1>
            <p>A little playful. A little personal. A whole lot of <strong>you two.</strong> Turn “what should we do?” into your favourite part of the day.</p>
            <div className="date-hero-actions"><Link className="arcade-button button-purple hero-play" to="/try"><Play size={18} fill="currentColor" /> Play free deck <ArrowRight size={19} /></Link><button className="join-link" disabled={isSigningIn} onClick={() => void startGame('swipe', true)}><Link2 size={17} /> Join your partner</button></div>
            {signInError && <p className="signin-error" role="alert">{signInError}</p>}
            <div className="date-perks"><span><Check /> Free to try</span><span><Check /> No downloads</span><span><Check /> Friends stay connected</span></div>
            <div className="hero-footnote"><span className="tiny-players" aria-hidden="true"><span><UiSymbol kind="smile" /></span><span><UiSymbol kind="smile" /></span></span><span>Same sofa or miles apart.<br /><strong>Good company is all you need.</strong></span><svg viewBox="0 0 62 40" aria-hidden="true"><path d="M3 3Q49 4 42 33M34 25L42 34L52 28" /></svg></div>
          </div>
          <div className="date-hero-scene">
            <div className="scene-grid" aria-hidden="true" />
            <span className="scene-star scene-star-top" aria-hidden="true">✦</span><span className="scene-star scene-star-side" aria-hidden="true">✳</span>
            <div className="scene-sticker"><Heart fill="currentColor" /><span>LESS SCROLLING<br /><strong>more us time.</strong></span></div>
            <div className="hero-card-stack">
              <div className="hero-card-back hero-card-back-one" aria-hidden="true" /><div className="hero-card-back hero-card-back-two" aria-hidden="true" />
              <article className="hero-question-card">
                <div className="question-card-top"><span><Sparkles size={14} /> THE CLOSER DECK</span><Heart size={18} /></div>
                <span className="question-number">LET’S START WITH THIS...</span>
                <p className="preview-question" aria-live="polite" aria-atomic="true">{QUESTIONS[question]}</p>
                <div className="question-card-bottom"><span>you + me + a good question</span><button aria-label="Another question" title="Try another question" onClick={() => setQuestion((value) => (value + 1) % QUESTIONS.length)}><RefreshCw size={18} /></button></div>
              </article>
            </div>
            <span className="scene-try-note">go on, give it a try <svg viewBox="0 0 54 39" aria-hidden="true"><path d="M3 6Q18 33 48 20M39 14L49 19L44 29" /></svg></span>
            <div className="scene-mascots"><DuoMascot /></div>
            <div className="scene-player-tag"><span className="player-tag-dot" /><Users size={15} /><span>Better in 2-player mode</span></div>
          </div>
        </section>
        <div className="date-good-stuff" aria-label="Ways to connect"><div className="page-width"><span><Gamepad2 /> Games for one or two</span><i aria-hidden="true">✦</i><span><Heart /> Fresh conversation cards</span><i aria-hidden="true">✦</i><span><Wifi /> Together, anywhere</span><i aria-hidden="true">✦</i><span><Sparkles /> A good place to start</span></div></div>
        <section className="date-games page-width" id="games" aria-labelledby="games-title">
          <div className="date-section-top"><div><span className="section-kicker">PICK YOUR KIND OF FUN</span><h2 id="games-title">Your pace. <span>Your kind of play.</span></h2><p>A solo reset, a shared screen, or a room for two. Pick what fits tonight.</p></div><a href="#game-grid" className="all-games-link">Find your game <ArrowDown size={17} /></a></div>
          <div className="mood-filters" role="group" aria-label="Filter games by mood">{([{ id: 'all', label: 'All games', icon: Gamepad2 }, { id: 'closer', label: 'Get closer', icon: Heart }, { id: 'laughs', label: 'Just for laughs', icon: Sparkles }] as const).map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={mood === id} onClick={() => setMood(id)}><Icon size={15} />{label}<span>{GAMES.filter(game => id === 'all' || game.mood === id).length}</span></button>)}</div>
          <div className="date-game-grid" id="game-grid">{GAMES.filter((game) => mood === 'all' || game.mood === mood).map((game, index) => <button className={`date-game-tile tile-${game.color}`} key={game.id} disabled={isSigningIn} onClick={() => void startGame(game.id)} aria-label={`Sign in to play ${game.title}`}><div className="tile-art"><span className="tile-number">0{GAMES.indexOf(game) + 1}</span>{index === 0 && mood === 'all' && <span className="tile-pick">START HERE</span>}<GameArtwork kind={game.kind} /></div><div className="tile-copy"><span className="tile-tag">{game.tag}</span><h3>{game.title}</h3><p>{game.description}</p><span className="tile-bottom"><span><Users size={13} /> {game.players}</span><span className="tile-arrow"><ArrowRight size={18} /></span></span></div></button>)}</div>
          <p className="games-footnote"><Heart size={14} /> New couple, old flames, or somewhere in between. You’re in the right place.</p>
          <p className="date-games-try"><Link to="/try">Try 18 conversation cards together without signing in <ArrowRight size={16} /></Link></p>
        </section>
        <section className="date-how" id="how-it-works" aria-labelledby="how-title"><div className="page-width"><div className="date-how-heading"><span className="section-kicker">LESS SETUP, MORE QUALITY TIME</span><h2 id="how-title">Your only plan?<br /><span>Press play.</span></h2><DuoMascot /></div><ol className="date-steps"><li><span className="step-number">1</span><div><h3>Pick your vibe</h3><p>Deep chats, silly guesses, or friendly competition. Follow your mood.</p></div><Gamepad2 aria-hidden="true" /></li><li><span className="step-number">2</span><div><h3>Grab your favourite person</h3><p>Share a screen, or send a room code to play from your own devices.</p></div><Link2 aria-hidden="true" /></li><li><span className="step-number">3</span><div><h3>See where the game takes you</h3><p>Learn something new. Laugh at a wrong answer. Make a little time for us.</p></div><Heart aria-hidden="true" /></li></ol></div></section>
        <section className="date-final page-width" aria-labelledby="final-title"><span className="final-spark" aria-hidden="true">✷</span><div><span className="section-kicker">THE BEST THINGS ARE TWO-PLAYER</span><h2 id="final-title">Make a little room<br />for <span>us time.</span></h2><p>No perfect plans needed. Just you, your person, and one more round.</p></div><div className="final-actions"><button className="arcade-button button-lime" disabled={isSigningIn} onClick={() => void startGame()}>{isSigningIn ? 'Opening sign-in…' : 'Sign in & start playing'} <ArrowRight size={19} /></button><span className="save-progress-link">One account keeps your profile, friends, points, and chats together.<ChevronRight size={14} /></span></div></section>
      </main>
      <div className={'footer-legal-link page-width'}><Link to={'/try'}>Free conversation deck</Link><Link to={'/privacy'}>Privacy Policy</Link></div>
      <footer className="date-footer page-width"><a className="date-brand" href="#top"><BrandMark /><span>KnotYet<span className="brand-period">.</span></span></a><p>A little play. A little closer.</p><span>Made with <Heart size={12} fill="currentColor" /> for the two of you. <span>© {new Date().getFullYear()}</span></span></footer>
    </div>
  );
};
