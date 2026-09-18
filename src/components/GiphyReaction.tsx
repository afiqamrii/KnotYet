import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play, Smile, Star } from 'lucide-react';
import { getReaction, getReactionCaption, type ReactionMood } from '../utils/memes';
import { ResultArt } from './GameCardDesign';
import '../styles/reactions.css';

export function GiphyReaction({ mood, seed = '', compact = false }: { mood: ReactionMood; seed?: string; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [playOverride, setPlayOverride] = useState<boolean | null>(null);
  const [loadedSrc, setLoadedSrc] = useState('');
  const [failedSrc, setFailedSrc] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const reaction = getReaction(mood, seed);
  const caption = getReactionCaption(mood, seed);
  const playing = playOverride ?? !reduceMotion;
  const baseSrc = `https://media.giphy.com/media/${reaction.id}/${playing ? 'giphy.gif' : 'giphy_s.gif'}`;
  const src = retryNonce ? `${baseSrc}?retry=${retryNonce}` : baseSrc;
  const failed = failedSrc === src;
  const loaded = loadedSrc === src;
  const fallback = mood === 'win' ? 'trophy' : mood === 'match' ? 'together' : mood === 'higher' || mood === 'lower' ? mood : 'smile';
  const sticker = mood === 'match' ? 'SAME BRAIN!' : mood === 'miss' ? 'PLOT TWIST!' : mood === 'win' ? 'BIG WIN!' : mood === 'higher' ? 'GO HIGHER!' : 'GO LOWER!';

  const retry = () => {
    setLoadedSrc('');
    setFailedSrc('');
    setRetryNonce(value => value + 1);
  };

  return (
    <figure className={`giphy-reaction ${compact ? 'giphy-reaction-compact' : ''}`}>
      <div className="giphy-stage" aria-busy={!loaded && !failed}>
        {(!loaded || failed) && <div className="giphy-placeholder"><ResultArt kind={fallback} /></div>}
        {!failed && <img key={src} src={src} alt={reaction.alt} className={loaded ? 'is-loaded' : ''} loading="eager" decoding="async"
          onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} />}
        <span className="giphy-mood-sticker" aria-hidden="true">{sticker}</span>
        {failed && <span className="giphy-unavailable">GIF took a snack break. Local silliness activated.</span>}
      </div>
      <p className="giphy-caption">{caption}</p>
      <figcaption>
        <a href={`https://giphy.com/gifs/${reaction.id}`} target="_blank" rel="noopener noreferrer">GIF via <strong>GIPHY</strong></a>
        {failed ? <button type="button" onClick={retry} aria-label="Retry GIF from GIPHY">Try GIF again</button> : <button type="button" onClick={() => setPlayOverride(!playing)} aria-label={playing ? 'Pause GIF' : 'Play GIF'}>
          {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />} {playing ? 'Pause' : 'Play GIF'}
        </button>}
      </figcaption>
    </figure>
  );
}

export function ReactionDialog({ positive, title, points, children }: { positive: boolean; title: string; points?: string; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[data-result-next]') ?? panel)?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className="game-result-overlay">
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`result-panel reaction-dialog ${positive ? 'reaction-positive' : 'reaction-surprise'}`}>
        <div className="reaction-eyebrow">{positive ? <Star aria-hidden="true" /> : <Smile aria-hidden="true" />} {positive ? 'ON THE SAME WAVELENGTH' : 'A LITTLE PLOT TWIST'}</div>
        <h2 id={titleId}>{title}</h2>
        {points && <p className="reaction-points">{points}</p>}
        {children}
      </section>
    </div>, document.body
  );
}

