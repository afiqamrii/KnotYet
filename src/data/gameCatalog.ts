export type LocalGameId = 'memory' | 'story';
export type OfflineGameId = 'swipe' | 'quiz' | 'wheel' | 'number' | 'letter' | 'match' | 'choices' | LocalGameId;
export type PlayableGameId = OfflineGameId | 'secret-race';
export type GameMood = 'closer' | 'laughs' | 'creative';
export type ArtworkKind = 'cards' | 'heart' | 'wheel' | 'number' | 'letter' | 'match' | 'memory' | 'story';

export interface GameCatalogEntry {
  id: OfflineGameId;
  title: string;
  description: string;
  tag: string;
  kind: ArtworkKind;
  mood: GameMood;
  color: 'pink' | 'purple' | 'yellow' | 'blue' | 'green';
  minutes: string;
  players: string;
  solo: boolean;
  online: boolean;
  isNew?: boolean;
}

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  { id: 'swipe', title: 'Icebreaker Cards', description: 'Good questions, small discoveries. Take turns answering and see where the conversation goes.', tag: 'A little deeper', kind: 'cards', mood: 'closer', color: 'pink', minutes: '5–15 min', players: 'Solo or together', solo: true, online: true },
  { id: 'quiz', title: 'Guess My Heart', description: 'Choose in secret, let your partner guess, and uncover the little things you know about each other.', tag: 'How well do you know me?', kind: 'heart', mood: 'closer', color: 'purple', minutes: '5–10 min', players: 'Made for two', solo: false, online: true },
  { id: 'wheel', title: 'Spin Wheel', description: 'Let chance pick the next conversation. Spin for a playful prompt and follow the thread.', tag: 'Let fate decide', kind: 'wheel', mood: 'laughs', color: 'yellow', minutes: '2–10 min', players: 'Solo or together', solo: true, online: true },
  { id: 'number', title: 'Number Guesser', description: 'Crack the mystery number with higher-or-lower clues. Think it through or race your person.', tag: 'A friendly little rivalry', kind: 'number', mood: 'laughs', color: 'blue', minutes: '2–5 min', players: 'Solo or together', solo: true, online: true },
  { id: 'letter', title: 'Letter Race', description: 'One surprise letter. One real word. Warm up on your own or see who gets there first.', tag: 'Ready, set, think!', kind: 'letter', mood: 'laughs', color: 'green', minutes: '2–5 min', players: 'Solo or together', solo: true, online: true },
  { id: 'match', title: 'Couple Match', description: 'Answer separately, reveal together, and find out where your instincts meet.', tag: 'Same question. Your own answer.', kind: 'match', mood: 'closer', color: 'purple', minutes: '5–10 min', players: 'Made for two', solo: false, online: true },
  { id: 'choices', title: 'This or That', description: 'Eight unexpected choices. Pick your side, compare if you like, and share the story behind it.', tag: 'Go with your instinct', kind: 'match', mood: 'laughs', color: 'pink', minutes: '5–10 min', players: 'Solo or together', solo: true, online: true },
  { id: 'memory', title: 'Memory Match', description: 'Flip, remember, reconnect. Find the matching pairs on your own or take turns on one screen.', tag: 'Two minds. A little magic.', kind: 'memory', mood: 'laughs', color: 'green', minutes: '3–5 min', players: 'Solo or one screen', solo: true, online: false, isNew: true },
  { id: 'story', title: 'Story Builder', description: 'One sentence at a time, make something only you could write. Save the story when you’re done.', tag: 'Let your imagination wander', kind: 'story', mood: 'creative', color: 'yellow', minutes: '5–15 min', players: 'Solo or one screen', solo: true, online: false, isNew: true },
];

export const isOfflineGame = (value: unknown): value is OfflineGameId => typeof value === 'string' && GAME_CATALOG.some(game => game.id === value);
export const isLocalGame = (value: unknown): value is LocalGameId => value === 'memory' || value === 'story';

export function readGameList(key: 'knotyet_favourite_games_v1' | 'knotyet_recent_games_v1'): OfflineGameId[] {
  try {
    if (typeof window === 'undefined') return [];
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(isOfflineGame))].slice(0, GAME_CATALOG.length) : [];
  } catch { return []; }
}

export function rememberGame(id: OfflineGameId) {
  try { localStorage.setItem('knotyet_recent_games_v1', JSON.stringify([id, ...readGameList('knotyet_recent_games_v1').filter(item => item !== id)].slice(0, 4))); }
  catch { /* Picking a game still works when browser storage is unavailable. */ }
}
