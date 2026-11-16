export type LocalPlayMode = 'solo' | 'together';
export type MemorySession = {
  version: 1; phase: 'setup' | 'playing' | 'complete'; mode: LocalPlayMode;
  pairs: 6 | 8; deck: number[]; open: number[]; matched: number[];
  moves: number; player: 0 | 1; finds: [number, number];
};
export const MEMORY_KEY = 'knotyet_memory_v1';
export const STORY_KEY = 'knotyet_story_v1';
export const memorySetup = (): MemorySession => ({ version: 1, phase: 'setup', mode: 'solo', pairs: 6, deck: [], open: [], matched: [], moves: 0, player: 0, finds: [0, 0] });

export function startMemory(mode: LocalPlayMode, pairs: 6 | 8): MemorySession {
  const deck = Array.from({ length: pairs * 2 }, (_, index) => index % pairs);
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return { ...memorySetup(), mode, pairs, deck, phase: 'playing' };
}

export function flipMemory(state: MemorySession, index: number): MemorySession {
  if (state.phase !== 'playing' || !Number.isInteger(index) || index < 0 || index >= state.deck.length || state.open.length === 2 || state.open.includes(index) || state.matched.includes(index)) return state;
  if (state.open.length === 0) return { ...state, open: [index] };
  const first = state.open[0];
  if (state.deck[first] !== state.deck[index]) return { ...state, open: [first, index], moves: state.moves + 1 };
  const matched = [...state.matched, first, index];
  const finds: [number, number] = [...state.finds];
  finds[state.player]++;
  return { ...state, open: [], matched, finds, moves: state.moves + 1, phase: matched.length === state.deck.length ? 'complete' : 'playing' };
}

export function hideMemoryMiss(state: MemorySession): MemorySession {
  if (state.phase !== 'playing' || state.open.length !== 2) return state;
  return { ...state, open: [], player: state.mode === 'together' ? (state.player === 0 ? 1 : 0) : 0 };
}

export function isMemorySession(value: unknown): value is MemorySession {
  if (!value || typeof value !== 'object') return false;
  const state = value as MemorySession;
  if (state.version !== 1 || !['setup', 'playing', 'complete'].includes(state.phase) || !['solo', 'together'].includes(state.mode) || ![6, 8].includes(state.pairs) || ![0, 1].includes(state.player)) return false;
  if (!Number.isInteger(state.moves) || state.moves < 0 || !Array.isArray(state.finds) || state.finds.length !== 2 || state.finds.some(n => !Number.isInteger(n) || n < 0)) return false;
  if (!Array.isArray(state.deck) || !Array.isArray(state.open) || !Array.isArray(state.matched)) return false;
  if (state.phase === 'setup') return state.deck.length === 0 && state.open.length === 0 && state.matched.length === 0 && state.moves === 0 && state.finds.every(n => n === 0);
  if (state.deck.length !== state.pairs * 2 || state.deck.some(n => !Number.isInteger(n) || n < 0 || n >= state.pairs)) return false;
  if (Array.from({ length: state.pairs }, (_, symbol) => state.deck.filter(n => n === symbol).length).some(count => count !== 2)) return false;
  const indices = [...state.open, ...state.matched];
  if (state.open.length > 2 || new Set(indices).size !== indices.length || indices.some(n => !Number.isInteger(n) || n < 0 || n >= state.deck.length)) return false;
  if (state.matched.length % 2 !== 0 || state.finds[0] + state.finds[1] !== state.matched.length / 2 || state.moves < state.matched.length / 2) return false;
  if (state.matched.some(index => state.matched.filter(other => state.deck[other] === state.deck[index]).length !== 2)) return false;
  if (state.open.length === 2 && state.deck[state.open[0]] === state.deck[state.open[1]]) return false;
  return state.phase === 'complete' ? state.matched.length === state.deck.length : state.matched.length < state.deck.length;
}

export const STORY_STARTERS = [
  { title: 'The wrong suitcase', mood: 'A little mystery', text: 'At the station, we opened our suitcase and found a handwritten invitation to somewhere that did not exist.' },
  { title: 'A very small dragon', mood: 'Something magical', text: 'The dragon on our kitchen windowsill was no bigger than a teacup, and it looked deeply offended.' },
  { title: 'The best bad plan', mood: 'Make it funny', text: 'We had ten pounds, a borrowed bicycle, and a plan that began with the words, “How hard could it be?”' },
  { title: 'A letter from tomorrow', mood: 'A curious twist', text: 'The letter arrived before breakfast, in our own handwriting, dated exactly one day in the future.' },
  { title: 'The last table', mood: 'A little romance', text: 'The café was closing, but someone had left two cups of tea and a map on the last table.' },
  { title: 'The secret rooftop', mood: 'An everyday adventure', text: 'Behind the door we had walked past a hundred times was a staircase leading to a garden above the city.' },
] as const;
export const STORY_PROMPTS = ['Introduce someone with an unusual wish.', 'Let something unexpected interrupt the moment.', 'Add a detail only your characters would notice.', 'Give them a choice that changes the plan.', 'Bring back something from the beginning.', 'Let one character surprise the other.', 'Give the story one last twist.', 'Find an ending that feels like yours.'] as const;
export type StorySession = {
  version: 1; phase: 'setup' | 'writing' | 'complete'; mode: LocalPlayMode;
  names: [string, string]; starter: number; title: string; draft: string;
  lines: Array<{ text: string; author: 0 | 1 }>;
};
export const storySetup = (): StorySession => ({ version: 1, phase: 'setup', mode: 'together', names: ['Player 1', 'Player 2'], starter: 0, title: '', draft: '', lines: [] });
export function isStorySession(value: unknown): value is StorySession {
  if (!value || typeof value !== 'object') return false;
  const state = value as StorySession;
  return state.version === 1 && ['setup', 'writing', 'complete'].includes(state.phase) && ['solo', 'together'].includes(state.mode)
    && Number.isInteger(state.starter) && state.starter >= 0 && state.starter < STORY_STARTERS.length
    && Array.isArray(state.names) && state.names.length === 2 && state.names.every(name => typeof name === 'string' && name.length <= 24)
    && typeof state.title === 'string' && state.title.length <= 60 && typeof state.draft === 'string' && state.draft.length <= 400
    && Array.isArray(state.lines) && state.lines.length <= 8
    && state.lines.every((line, index) => line && typeof line.text === 'string' && line.text.trim().length > 0 && line.text.length <= 400 && line.author === (state.mode === 'solo' ? 0 : index % 2))
    && (state.phase !== 'setup' || state.lines.length === 0)
    && (state.phase !== 'complete' || state.lines.length >= 2)
    && (state.phase !== 'writing' || state.lines.length < 8);
}

export function addStoryLine(state: StorySession): StorySession {
  const text = state.draft.trim();
  if (state.phase !== 'writing' || !text || text.length > 400 || state.lines.length >= 8) return state;
  const lines = [...state.lines, { text, author: (state.mode === 'solo' ? 0 : state.lines.length % 2) as 0 | 1 }];
  return { ...state, lines, draft: '', phase: lines.length === 8 ? 'complete' : 'writing' };
}

export function undoStoryLine(state: StorySession): StorySession {
  if (state.lines.length === 0 || state.draft.trim()) return state;
  return { ...state, phase: 'writing', lines: state.lines.slice(0, -1), draft: state.lines[state.lines.length - 1].text };
}

export function storyText(state: StorySession): string {
  const names = state.names.map((name, index) => name.trim() || `Player ${index + 1}`);
  return `${state.title.trim() || STORY_STARTERS[state.starter].title}\nBy ${state.mode === 'solo' ? names[0] : names.join(' & ')}\n\n${STORY_STARTERS[state.starter].text}\n\n${state.lines.map(line => line.text).join('\n\n')}\n\nMade together with KnotYet.`;
}

export function restoreLocalActivity<T>(key: string, validate: (value: unknown) => value is T, initial: () => T): T {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null');
    return validate(value) ? value : initial();
  } catch { return initial(); }
}
