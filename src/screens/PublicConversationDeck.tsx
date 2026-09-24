import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Heart, MessageCircle, RefreshCw, Sparkles, Users } from 'lucide-react';
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

export const PublicConversationDeck = () => {
  const [deckId, setDeckId] = useState<DeckId>('little-things');
  const [cardIndex, setCardIndex] = useState(0);
  const [askingPlayer, setAskingPlayer] = useState<1 | 2>(1);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const deck = DECKS.find((item) => item.id === deckId)!;
  const card = deck.cards[cardIndex];

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
    setDeckId(nextId);
    setCardIndex(0);
    setAskingPlayer(1);
    setShowFollowUp(false);
  };

  const nextCard = () => {
    setCardIndex((current) => (current + 1) % deck.cards.length);
    setAskingPlayer((current) => current === 1 ? 2 : 1);
    setShowFollowUp(false);
  };

  const selectCard = (nextDeckId: DeckId, nextCardIndex: number) => {
    setDeckId(nextDeckId);
    setCardIndex(nextCardIndex);
    setShowFollowUp(false);
    document.getElementById('play-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="public-deck-page">
      <a className="public-deck-skip" href="#public-deck-main">Skip to content</a>
      <header className="public-deck-nav">
        <div className="public-deck-width public-deck-nav-inner">
          <Link className="public-deck-brand" to="/" aria-label="KnotYet home"><BrandMark /><span>KnotYet<span>.</span></span></Link>
          <Link className="public-deck-home" to="/"><ArrowLeft size={17} /> Back to home</Link>
        </div>
      </header>

      <main id="public-deck-main" className="public-deck-width">
        <section className="public-deck-intro" aria-labelledby="public-deck-title">
          <span className="public-deck-kicker"><Heart size={15} fill="currentColor" /> FREE TWO-PLAYER DECK</span>
          <h1 id="public-deck-title">A good question<br /><em>changes the evening.</em></h1>
          <p>These 18 conversation cards are yours to play right here. They are for partners who want to learn something new about each other, share a laugh, or simply slow down for a few minutes.</p>
          <div className="public-deck-facts"><span><Users size={17} /> Two people</span><span><MessageCircle size={17} /> One screen</span><span><Sparkles size={17} /> No account needed</span></div>
        </section>

        <section className="public-deck-play" aria-labelledby="public-deck-play-title">
          <div className="public-deck-heading"><span className="public-deck-section-label">PICK YOUR MOOD</span><h2 id="public-deck-play-title">What shall we talk about?</h2></div>
          <div className="public-deck-themes" role="group" aria-label="Conversation themes">
            {DECKS.map((item) => <button key={item.id} type="button" onClick={() => chooseDeck(item.id)} aria-pressed={deckId === item.id}>
              <strong>{item.label}</strong><span>{item.description}</span>
            </button>)}
          </div>

          <article id="play-card" className="public-deck-card" aria-label="Current conversation card">
            <div className="public-deck-card-top"><span><Heart size={16} fill="currentColor" /> {deck.label}</span><span>Card {cardIndex + 1} of {deck.cards.length}</span></div>
            <div className="public-deck-card-body" aria-live="polite" aria-atomic="true">
              <p className="public-deck-turn">PLAYER {askingPlayer} ASKS · PLAYER {askingPlayer === 1 ? 2 : 1} ANSWERS</p>
              <h3>{card.question}</h3>
              {showFollowUp ? <div className="public-deck-follow-up"><strong>Go a little further</strong><p>{card.followUp}</p></div> : <button className="public-deck-reveal" type="button" onClick={() => setShowFollowUp(true)}>Reveal a follow-up <ArrowRight size={16} /></button>}
            </div>
            <div className="public-deck-card-actions">
              <button type="button" className="public-deck-swap" onClick={() => setAskingPlayer((current) => current === 1 ? 2 : 1)}><RefreshCw size={16} /> Swap who asks</button>
              <button type="button" className="public-deck-next" onClick={nextCard}>Next question <ArrowRight size={18} /></button>
            </div>
          </article>
          <p className="public-deck-play-note">After the sixth card, the deck starts again. Pick another theme whenever you like.</p>
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
          <h2 id="public-deck-library-title">Browse all 18 cards.</h2>
          <p>Want to choose a question together? Every prompt and follow-up is here, so you can find one that fits the moment.</p>
          <div className="public-deck-library-grid">
            {DECKS.map((item) => <section key={item.id} aria-labelledby={`deck-${item.id}`}>
              <h3 id={`deck-${item.id}`}>{item.label}</h3>
              <p>{item.description}</p>
              <ol>{item.cards.map((libraryCard, index) => <li key={libraryCard.question}>
                <button type="button" onClick={() => selectCard(item.id, index)} aria-label={`Play ${item.label} card ${index + 1}: ${libraryCard.question}`}>
                  <span>{libraryCard.question}</span><ArrowRight size={15} aria-hidden="true" />
                </button>
                <p><strong>Follow-up:</strong> {libraryCard.followUp}</p>
              </li>)}</ol>
            </section>)}
          </div>
        </section>
      </main>

      <footer className="public-deck-footer public-deck-width"><span>© {new Date().getFullYear()} KnotYet · A little play. A little closer.</span><nav aria-label="Footer"><Link to="/">Home</Link><Link to="/privacy">Privacy Policy</Link></nav></footer>
    </div>
  );
};
