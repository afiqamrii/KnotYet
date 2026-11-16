import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Heart, MessageCircle, RefreshCw, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/ArcadeArt';
import '../styles/public-deck.css';

type DeckId = 'little-things' | 'under-the-surface' | 'what-next';

type ConversationCard = {
  question: string;
  followUp: string;
};

type ConversationDeck = {
  id: DeckId;
  label: string;
  description: string;
  cards: ConversationCard[];
};

// These prompts are written for this free, same-screen experience. Both people
// can use every card without an account, timer, score, or saved answer.
const DECKS: ConversationDeck[] = [
  {
    id: 'little-things',
    label: 'The little things',
    description: 'Start with the moments that make an ordinary day yours.',
    cards: [
      {
        question: 'What small part of a normal day together would you miss most if it disappeared?',
        followUp: 'When did you first notice that moment mattered to you?',
      },
      {
        question: 'What is something I do that makes a difficult day feel a little lighter?',
        followUp: 'Can you remember a recent time it helped?',
      },
      {
        question: 'Which place in our everyday life feels most like “us”?',
        followUp: 'What would a stranger learn about us from seeing us there?',
      },
      {
        question: 'What is a tiny tradition we have made without meaning to?',
        followUp: 'Would you keep it exactly as it is, or give it a new twist?',
      },
      {
        question: 'What did we laugh about recently that still makes you smile?',
        followUp: 'What was the part of that moment I might have missed?',
      },
      {
        question: 'When do you feel most relaxed around me?',
        followUp: 'Is there a way we could make room for more of that feeling?',
      },
    ],
  },
  {
    id: 'under-the-surface',
    label: 'Under the surface',
    description: 'Make space for the things that do not fit into a quick check-in.',
    cards: [
      {
        question: 'What has been taking up more space in your mind than I might realise?',
        followUp: 'Would you like me to listen, help you think it through, or simply stay with you?',
      },
      {
        question: 'When have you felt especially understood by me?',
        followUp: 'What did I do or say that made the difference?',
      },
      {
        question: 'What is one part of yourself you wish people noticed more often?',
        followUp: 'How could I help you feel seen in that way?',
      },
      {
        question: 'What do you find hard to ask for, even from someone close to you?',
        followUp: 'What would make asking feel easier next time?',
      },
      {
        question: 'What is a belief about relationships that you have changed your mind about?',
        followUp: 'Was there a particular experience that changed it?',
      },
      {
        question: 'How can you tell when you need comfort, even before you have the words for it?',
        followUp: 'What kind of response feels supportive to you in that moment?',
      },
    ],
  },
  {
    id: 'what-next',
    label: 'What comes next',
    description: 'Imagine the near future together, one doable idea at a time.',
    cards: [
      {
        question: 'What is one new experience you would love us to try in the next month?',
        followUp: 'What is the smallest step we could take to make it happen?',
      },
      {
        question: 'If we had one completely free afternoon, how would you spend it with me?',
        followUp: 'Which part would you want to plan, and which part should be a surprise?',
      },
      {
        question: 'What would you like us to get better at doing together?',
        followUp: 'What would progress look like in an ordinary week?',
      },
      {
        question: 'What is a shared memory you hope we are making right now?',
        followUp: 'How could we pause long enough to notice it while it is happening?',
      },
      {
        question: 'What is something you want to learn, and how could I cheer you on?',
        followUp: 'What support would be useful, and what should I leave in your hands?',
      },
      {
        question: 'What would make our next date feel unmistakably like us?',
        followUp: 'Can we name one detail we could actually arrange this week?',
      },
    ],
  },
];

const SESSION_KEY = 'knotyet_public_deck_v1';
const SAVED_KEY = 'knotyet_saved_cards_v1';
const cardKey = (id: DeckId, index: number) => `${id}:${index}`;
const validCardKeys = new Set(DECKS.flatMap(deck => deck.cards.map((_, index) => cardKey(deck.id, index))));
type DeckSession = { deckId: DeckId; cardIndex: number; askingPlayer: 1 | 2; showFollowUp: boolean; completed: boolean };
const initialSession: DeckSession = { deckId: 'little-things', cardIndex: 0, askingPlayer: 1, showFollowUp: false, completed: false };

function restoreSession(): DeckSession {
  try {
    if (typeof window === 'undefined') return initialSession;
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    const deck = DECKS.find(item => item.id === value?.deckId);
    if (!deck || !Number.isInteger(value.cardIndex) || value.cardIndex < 0 || value.cardIndex >= deck.cards.length) return initialSession;
    return { deckId: deck.id, cardIndex: value.cardIndex, askingPlayer: value.askingPlayer === 2 ? 2 : 1, showFollowUp: value.showFollowUp === true, completed: value.completed === true && value.cardIndex === deck.cards.length - 1 };
  } catch { return initialSession; }
}

function restoreSaved(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string' && validCardKeys.has(key)))] : [];
  } catch { return []; }
}

export const PublicConversationDeck = () => {
  const [session, setSession] = useState<DeckSession>(restoreSession);
  const { deckId, cardIndex, askingPlayer, showFollowUp, completed } = session;
  const [saved, setSaved] = useState<string[]>(restoreSaved);
  const [savedOnly, setSavedOnly] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');

  const deck = DECKS.find((item) => item.id === deckId)!;
  const card = deck.cards[cardIndex];
  const isSaved = saved.includes(cardKey(deckId, cardIndex));
  const nextDeck = DECKS[(DECKS.indexOf(deck) + 1) % DECKS.length];
  const previousCompletion = useRef(completed);

  useEffect(() => {
    if (previousCompletion.current !== completed) {
      document.getElementById('play-card')?.focus({ preventScroll: true });
      previousCompletion.current = completed;
    }
  }, [completed]);

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    catch { setStorageNotice('Browser storage is unavailable. Your place and saved cards will last for this visit only.'); }
  }, [session]);

  useEffect(() => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); }
    catch { setStorageNotice('Browser storage is unavailable. Your place and saved cards will last for this visit only.'); }
  }, [saved]);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    document.title = 'Free Conversation Cards for Two | KnotYet';
    if (description) {
      description.content = 'Play 18 original conversation cards for two, with thoughtful follow-up questions. Pick a theme and take turns on one screen. No sign-in needed.';
    }
    window.scrollTo(0, 0);
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) description.content = previousDescription;
    };
  }, []);

  const chooseDeck = (nextId: DeckId) => {
    if (nextId === deckId) return;
    setSession({ ...initialSession, deckId: nextId });
  };

  const nextCard = () => {
    setSession(current => current.cardIndex === deck.cards.length - 1
      ? { ...current, completed: true }
      : { ...current, cardIndex: current.cardIndex + 1, askingPlayer: current.askingPlayer === 1 ? 2 : 1, showFollowUp: false });
  };

  const previousCard = () => {
    setSession(current => ({ ...current, cardIndex: Math.max(0, current.cardIndex - 1), askingPlayer: current.askingPlayer === 1 ? 2 : 1, showFollowUp: false, completed: false }));
  };

  const selectCard = (nextDeckId: DeckId, nextCardIndex: number) => {
    setSession({ ...initialSession, deckId: nextDeckId, cardIndex: nextCardIndex, askingPlayer: nextCardIndex % 2 === 0 ? 1 : 2 });
    const player = document.getElementById('play-card');
    player?.focus({ preventScroll: true });
    player?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  const toggleSave = () => {
    const key = cardKey(deckId, cardIndex);
    setSaved(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  };

  return (
    <div className="public-deck-page">
      <a className="public-deck-skip" href="#public-deck-main">Skip to content</a>
      <header className="public-deck-nav">
        <div className="public-deck-width public-deck-nav-inner">
          <Link className="public-deck-brand" to="/" aria-label="KnotYet home"><BrandMark /><span>KnotYet<span>.</span></span></Link>
          <div className="public-deck-nav-actions"><a href="#public-deck-library-title" onClick={() => setSavedOnly(true)}><Bookmark size={16} /> Saved <span>{saved.length}</span></a><Link className="public-deck-home" to="/"><ArrowLeft size={17} /> Home</Link></div>
        </div>
      </header>

      <main id="public-deck-main" className="public-deck-width">
        <section className="public-deck-intro" aria-labelledby="public-deck-title">
          <span className="public-deck-kicker"><Heart size={15} fill="currentColor" /> FREE TWO-PLAYER DECK</span>
          <h1 id="public-deck-title">A good question<br /><em>changes the evening.</em></h1>
          <p>A little curiosity, a little closer. Pick a mood and take turns with 18 thoughtful questions for the two of you.</p>
          <div className="public-deck-facts"><span><Users size={17} /> Two people</span><span><MessageCircle size={17} /> One screen</span><span><Sparkles size={17} /> No account needed</span></div>
        </section>

        <section className="public-deck-play" aria-labelledby="public-deck-play-title">
          <div className="public-deck-heading"><div><span className="public-deck-section-label">MAKE A LITTLE TIME FOR US</span><h2 id="public-deck-play-title">What shall we talk about?</h2></div><a href="#public-deck-guide-title">How to play <ArrowRight size={15} /></a></div>
          <div className="public-deck-workspace">
          <div className="public-deck-themes" role="group" aria-label="Conversation themes">
            {DECKS.map((item, index) => <button key={item.id} type="button" onClick={() => chooseDeck(item.id)} aria-pressed={deckId === item.id}>
              <span className="public-deck-theme-number">0{index + 1} <span>{deckId === item.id ? 'SELECTED' : '6 CARDS'}</span></span><strong>{item.label}</strong><span className="public-deck-theme-description">{item.description}</span>
            </button>)}
            <p className="public-deck-theme-note"><Heart size={16} /> No perfect answers. Just a little space to listen.</p>
          </div>

          <article id="play-card" className="public-deck-card" aria-label="Current conversation card" tabIndex={-1}>
            <div className="public-deck-card-top"><span><Heart size={16} fill="currentColor" /> {deck.label}</span><span>Card {cardIndex + 1} of {deck.cards.length}</span></div>
            <div className="public-deck-progress" role="progressbar" aria-label="Position in deck" aria-valuemin={0} aria-valuemax={deck.cards.length} aria-valuenow={cardIndex + 1}><span style={{ width: `${((cardIndex + 1) / deck.cards.length) * 100}%` }} /></div>
            {completed ? <div className="public-deck-complete" role="status">
              <span className="public-deck-complete-icon"><Check size={30} /></span><span className="public-deck-section-label">A LITTLE CLOSER ALREADY</span><h3>That’s this deck.</h3><p>Stay with the conversation, or find a new place to start. There’s no rush.</p>
              <button className="public-deck-next" type="button" onClick={() => chooseDeck(nextDeck.id)}>Try {nextDeck.label.toLowerCase()} <ArrowRight size={17} /></button>
              <button className="public-deck-reveal" type="button" onClick={() => setSession({ ...initialSession, deckId })}><RefreshCw size={16} /> Play this deck again</button>
            </div> : <>
            <div className="public-deck-card-body" aria-live="polite" aria-atomic="true">
              <p className="public-deck-turn">PLAYER {askingPlayer} ASKS · PLAYER {askingPlayer === 1 ? 2 : 1} ANSWERS</p>
              <h3>{card.question}</h3>
              <button className="public-deck-reveal" type="button" aria-expanded={showFollowUp} aria-controls="card-follow-up" onClick={() => setSession(current => ({ ...current, showFollowUp: !current.showFollowUp }))}>{showFollowUp ? 'Hide follow-up' : 'Reveal a follow-up'} <ArrowRight size={16} /></button>
              {showFollowUp && <div id="card-follow-up" className="public-deck-follow-up"><strong>Go a little further</strong><p>{card.followUp}</p></div>}
            </div>
            <div className="public-deck-card-tools"><button type="button" aria-pressed={isSaved} onClick={toggleSave}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Card saved' : 'Save card'}</button><button type="button" onClick={() => setSession(current => ({ ...current, askingPlayer: current.askingPlayer === 1 ? 2 : 1 }))}><RefreshCw size={16} /> Swap who asks</button></div>
            <div className="public-deck-card-actions">
              <button type="button" className="public-deck-swap" disabled={cardIndex === 0} onClick={previousCard}><ArrowLeft size={17} /> Previous</button>
              <span className="public-deck-card-count" aria-hidden="true">{String(cardIndex + 1).padStart(2, '0')} / 06</span>
              <button type="button" className="public-deck-next" onClick={nextCard}>{cardIndex === deck.cards.length - 1 ? 'Finish deck' : 'Next question'} <ArrowRight size={18} /></button>
            </div>
            </>}
          </article>
          </div>
          <p className="public-deck-play-note" role="status">{storageNotice || 'Your place is kept in this tab. Saved cards stay on this browser. Your answers are yours alone.'}</p>
        </section>

        <section className="public-deck-guide" aria-labelledby="public-deck-guide-title">
          <div><span className="public-deck-section-label">HOW TO PLAY</span><h2 id="public-deck-guide-title">Take turns being curious.</h2></div>
          <ol>
            <li><strong>Choose a theme.</strong> Pick the mood that feels right for you both.</li>
            <li><strong>Ask and listen.</strong> Player 1 reads the card; Player 2 answers without rushing.</li>
            <li><strong>Go a little further.</strong> Reveal the follow-up if you want, then move to the next card and swap roles.</li>
          </ol>
          <p>There are no points or right answers. You can skip any question that does not feel right today.</p>
        </section>

        <section className="public-deck-library" aria-labelledby="public-deck-library-title">
          <span className="public-deck-section-label">KEEP THE CONVERSATION GOING</span>
          <h2 id="public-deck-library-title" tabIndex={-1}>{savedOnly ? 'Your little collection.' : 'Browse all 18 cards.'}</h2>
          <p>{savedOnly ? 'Questions worth coming back to. Pick one to put it back on the table.' : 'Choose a question together. Every prompt and follow-up is here, so you can find one that fits the moment.'}</p>
          <div className="public-deck-library-filters" role="group" aria-label="Filter conversation library"><button type="button" aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}>All cards <span>18</span></button><button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}><Bookmark size={15} /> Saved cards <span>{saved.length}</span></button></div>
          {savedOnly && saved.length === 0 && <div className="public-deck-empty"><Bookmark size={28} /><h3>Keep a good question close.</h3><p>Tap “Save card” while you play. Your favourites will be waiting here.</p><button type="button" onClick={() => { setSavedOnly(false); document.getElementById('public-deck-library-title')?.focus(); }}>Explore all cards <ArrowRight size={16} /></button></div>}
          <div className="public-deck-library-grid">
            {DECKS.filter(item => !savedOnly || item.cards.some((_, index) => saved.includes(cardKey(item.id, index)))).map((item) => <section key={item.id} aria-labelledby={`deck-${item.id}`}>
              <h3 id={`deck-${item.id}`}>{item.label}</h3>
              <p>{item.description}</p>
              <ol>{item.cards.map((libraryCard, index) => (!savedOnly || saved.includes(cardKey(item.id, index))) && <li key={libraryCard.question} value={index + 1}>
                <button type="button" onClick={() => selectCard(item.id, index)} aria-label={`Play ${item.label} card ${index + 1}: ${libraryCard.question}`}>
                  <span>{libraryCard.question}</span><ArrowRight size={15} aria-hidden="true" />
                </button>
                <p><strong>Follow-up:</strong> {libraryCard.followUp}</p>
              </li>)}</ol>
            </section>)}
          </div>
        </section>
        <aside className="public-deck-more"><div><span className="public-deck-section-label">A DIFFERENT KIND OF TOGETHER</span><h2>Keep the good time going.</h2><p>Find matching pairs or write a wonderfully unexpected story. Two new games, free to play.</p></div><Link to="/arcade">Explore the free arcade <ArrowRight size={17} /></Link></aside>
      </main>

      <footer className="public-deck-footer public-deck-width"><span>© {new Date().getFullYear()} KnotYet · A little play. A little closer.</span><nav aria-label="Footer"><Link to="/">Home</Link><Link to="/privacy">Privacy Policy</Link></nav></footer>
    </div>
  );
};
