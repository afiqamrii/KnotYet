import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Bookmark, Clock3, Gamepad2, Heart, Search, Sparkles, Users, Wifi, X } from 'lucide-react';
import { GAME_CATALOG, readGameList, type OfflineGameId } from '../data/gameCatalog';
import { GameArtwork } from './ArcadeArt';
import { useChatDialog } from './useChatDialog';
import '../styles/library.css';

interface Props { onClose: () => void; onSelect: (game: OfflineGameId) => void; currentGame: string; }
type Filter = 'all' | 'closer' | 'laughs' | 'creative' | 'saved';

export const GameLibrary = ({ onClose, onSelect, currentGame }: Props) => {
  const dialogRef = useChatDialog(true, onClose);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [soloOnly, setSoloOnly] = useState(false);
  const [saved, setSaved] = useState(() => readGameList('knotyet_favourite_games_v1'));
  const [recent] = useState(() => readGameList('knotyet_recent_games_v1'));
  const [notice, setNotice] = useState('');
  const emptyFavourites = filter === 'saved' && saved.length === 0;
  const games = useMemo(() => GAME_CATALOG.filter(game =>
    (filter === 'all' || (filter === 'saved' ? saved.includes(game.id) : game.mood === filter)) &&
    (!soloOnly || game.solo) && `${game.title} ${game.description} ${game.tag}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [filter, query, saved, soloOnly]);
  const toggleFavourite = (id: OfflineGameId) => {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    // Removing a filtered favourite also removes its focused bookmark button.
    if (filter === 'saved' && saved.includes(id)) searchRef.current?.focus();
    try { localStorage.setItem('knotyet_favourite_games_v1', JSON.stringify(next)); }
    catch { setNotice('Favourites are available for this visit. Browser storage is unavailable.'); }
  };
  const resetFilters = () => {
    setQuery(''); setFilter('all'); setSoloOnly(false);
    searchRef.current?.focus();
  };
  const select = (id: OfflineGameId) => { onSelect(id); onClose(); };
  return <div className="library-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="game-library" role="dialog" aria-modal="true" aria-labelledby="library-title" tabIndex={-1}>
      <header className="library-heading"><div><span className="library-eyebrow"><Gamepad2 size={15} /> YOUR LITTLE ARCADE</span><h2 id="library-title">What feels good today?</h2><p>Nine ways to play. A little time for you.</p></div><button type="button" className="library-close" onClick={onClose} aria-label="Close game library"><X /></button></header>
      <div className="library-controls"><label className="library-search"><Search size={18} /><span className="sr-only">Search games</span><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find your next favourite…" type="search" /></label><label className="library-solo"><input type="checkbox" checked={soloOnly} onChange={event => setSoloOnly(event.target.checked)} /> Works solo</label></div>
      <div className="library-filters" role="group" aria-label="Game library filters">{([{ id: 'all', label: 'All games', icon: Gamepad2 }, { id: 'closer', label: 'Get closer', icon: Heart }, { id: 'laughs', label: 'Have a laugh', icon: Sparkles }, { id: 'creative', label: 'Make something', icon: Sparkles }, { id: 'saved', label: 'Favourites', icon: Bookmark }] as const).map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><item.icon size={15} />{item.label}{item.id === 'saved' && <span>{saved.length}</span>}</button>)}</div>
      {!query && filter === 'all' && !soloOnly && recent.length > 0 && <div className="library-recent"><span>BACK FOR MORE?</span>{recent.map(id => <button type="button" key={id} onClick={() => select(id)}>{GAME_CATALOG.find(game => game.id === id)!.title}<ArrowRight size={13} /></button>)}</div>}
      <p className="library-result-count" role="status">{games.length} {games.length === 1 ? 'game' : 'games'}{notice ? ` · ${notice}` : ''}</p>
      <div className="library-grid">{games.map(game => <article key={game.id} className={`library-game library-${game.color}`}>
        <div className="library-art"><GameArtwork kind={game.kind} compact />{game.isNew && <span className="library-new">NEW</span>}<button type="button" className="library-save" aria-label={`${saved.includes(game.id) ? 'Unsave' : 'Save'} ${game.title}`} aria-pressed={saved.includes(game.id)} onClick={() => toggleFavourite(game.id)}><Bookmark size={17} fill={saved.includes(game.id) ? 'currentColor' : 'none'} /></button></div>
        <div className="library-game-copy"><div className="library-game-meta"><span><Clock3 size={12} /> {game.minutes}</span><span>{game.online ? <><Wifi size={12} /> Online too</> : 'One screen'}</span></div><h3>{game.title}</h3><p>{game.description}</p><div className="library-game-bottom"><span><Users size={13} /> {game.players}</span><button type="button" onClick={() => select(game.id)} aria-label={`Choose ${game.title}`}>{currentGame === game.id ? 'Selected' : 'Let’s play'}<ArrowRight size={16} /></button></div></div>
      </article>)}</div>
      {games.length === 0 && <div className="library-empty"><Search size={30} /><h3>{emptyFavourites ? 'Your favourites live here.' : 'Nothing here just yet.'}</h3><p>{emptyFavourites ? 'Save a game with the bookmark button and come back whenever you like.' : 'Try a different search or give another mood a go.'}</p><button type="button" onClick={resetFilters}>Explore all games <ArrowRight size={16} /></button></div>}
      <footer className="library-footer"><Heart size={14} /> Same sofa or miles apart. Start with a little play.</footer>
    </section>
  </div>;
};
