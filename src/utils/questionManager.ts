import { 
  MATCH_QUESTIONS, 
  GUESS_QUIZ_LIST, 
  SWIPE_CARDS, 
  MatchQuestion, 
  GuessQuizItem, 
  SwipeCardItem, 
  CardCategory 
} from '../data/questions';

const STORAGE_KEY_SEEN = 'knotyet_seen_questions';
const STORAGE_KEY_ANSWERED = 'jodohdeck_answered';

/**
 * Fisher-Yates shuffle algorithm for truly random, unbiased array distribution.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Retrieve the set of all question IDs that the user has already seen/answered.
 */
export function getSeenQuestionIds(): Set<string> {
  const set = new Set<string>();
  try {
    const seenStored = localStorage.getItem(STORAGE_KEY_SEEN);
    if (seenStored) {
      JSON.parse(seenStored).forEach((id: string) => set.add(id));
    }
    const answeredStored = localStorage.getItem(STORAGE_KEY_ANSWERED);
    if (answeredStored) {
      JSON.parse(answeredStored).forEach((id: string) => set.add(id));
    }
  } catch (e) {
    console.error('Error reading seen question IDs:', e);
  }
  return set;
}

/**
 * Mark a single question as seen/answered so it won't repeat in subsequent games.
 */
export function markQuestionAsSeen(id: string): void {
  try {
    const seen = getSeenQuestionIds();
    seen.add(id);
    const arr = Array.from(seen);
    localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(arr));
    localStorage.setItem(STORAGE_KEY_ANSWERED, JSON.stringify(arr));
  } catch (e) {
    console.error('Error marking question as seen:', e);
  }
}

/**
 * Mark an array of questions as seen.
 */
export function markQuestionsAsSeen(ids: string[]): void {
  try {
    const seen = getSeenQuestionIds();
    ids.forEach(id => seen.add(id));
    const arr = Array.from(seen);
    localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(arr));
    localStorage.setItem(STORAGE_KEY_ANSWERED, JSON.stringify(arr));
  } catch (e) {
    console.error('Error marking questions as seen:', e);
  }
}

/**
 * Gracefully reset the seen questions for a given prefix when the entire pool has been exhausted.
 */
export function resetSeenQuestionsForPrefix(prefix: string): void {
  try {
    const seen = getSeenQuestionIds();
    const updated = Array.from(seen).filter(id => !id.startsWith(prefix));
    localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_ANSWERED, JSON.stringify(updated));
  } catch (e) {
    console.error('Error resetting seen questions for prefix:', prefix, e);
  }
}

// ==========================================
// 1. COUPLE MATCH QUESTIONS
// ==========================================

export function getShuffledMatchQuestions(count: number = 10): MatchQuestion[] {
  const seen = getSeenQuestionIds();
  let available = MATCH_QUESTIONS.filter(q => !seen.has(q.id));

  // If remaining unseen pool is too small, gracefully recycle the pool
  if (available.length < Math.min(count, 5)) {
    resetSeenQuestionsForPrefix('m-');
    available = [...MATCH_QUESTIONS];
  }

  const shuffled = shuffleArray(available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getMatchQuestionsByIds(ids: string[]): MatchQuestion[] {
  const map = new Map(MATCH_QUESTIONS.map(q => [q.id, q]));
  const result: MatchQuestion[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) result.push(q);
  }
  // Fallback if empty
  return result.length > 0 ? result : getShuffledMatchQuestions(10);
}

// ==========================================
// 2. GUESS MY HEART (QUIZ) QUESTIONS
// ==========================================

export function getShuffledGuessQuestions(count: number = 10): GuessQuizItem[] {
  const seen = getSeenQuestionIds();
  let available = GUESS_QUIZ_LIST.filter(q => !seen.has(q.id));

  // If remaining unseen pool is too small, recycle the pool (from the 80 question dataset)
  if (available.length < Math.min(count, 5)) {
    resetSeenQuestionsForPrefix('gq-');
    available = [...GUESS_QUIZ_LIST];
  }

  const shuffled = shuffleArray(available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getGuessQuestionsByIds(ids: string[]): GuessQuizItem[] {
  const map = new Map(GUESS_QUIZ_LIST.map(q => [q.id, q]));
  const result: GuessQuizItem[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) result.push(q);
  }
  // Fallback if empty
  return result.length > 0 ? result : getShuffledGuessQuestions(10);
}

// ==========================================
// 3. ICEBREAKER (SWIPE) CARDS
// ==========================================

export function getShuffledSwipeCards(category: CardCategory | 'all', count: number = 15): SwipeCardItem[] {
  const seen = getSeenQuestionIds();
  
  let matching = SWIPE_CARDS;
  if (category !== 'all') {
    matching = matching.filter(c => c.category === category);
  }

  let available = matching.filter(c => !seen.has(c.id));

  // If remaining pool is depleted, recycle for this category
  if (available.length < Math.min(count, 5)) {
    const prefixMap: Record<string, string> = {
      'teka-teki': 'tt-',
      'vibe-check': 'vc-',
      'taaruf-realiti': 'sm-',
      'dare-santai': 'bc-',
    };
    if (category !== 'all' && prefixMap[category]) {
      resetSeenQuestionsForPrefix(prefixMap[category]);
    } else {
      ['tt-', 'vc-', 'sm-', 'bc-'].forEach(p => resetSeenQuestionsForPrefix(p));
    }
    available = [...matching];
  }

  const shuffled = shuffleArray(available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getSwipeCardsByIds(ids: string[]): SwipeCardItem[] {
  const map = new Map(SWIPE_CARDS.map(c => [c.id, c]));
  const result: SwipeCardItem[] = [];
  for (const id of ids) {
    const card = map.get(id);
    if (card) result.push(card);
  }
  return result.length > 0 ? result : getShuffledSwipeCards('all', 15);
}

// ==========================================
// 4. SPIN WHEEL PROMPTS
// ==========================================

export function getRandomUnseenWheelPromptIndex(segmentId: string, totalPrompts: number): number {
  const key = `wheel_seen_${segmentId}`;
  try {
    const stored = sessionStorage.getItem(key);
    let seenIndices: number[] = stored ? JSON.parse(stored) : [];

    // If all prompts in this segment have been seen, reset
    if (seenIndices.length >= totalPrompts) {
      seenIndices = [];
    }

    const available = [];
    for (let i = 0; i < totalPrompts; i++) {
      if (!seenIndices.includes(i)) available.push(i);
    }

    const chosen = available[Math.floor(Math.random() * available.length)] ?? 0;
    seenIndices.push(chosen);
    sessionStorage.setItem(key, JSON.stringify(seenIndices));
    return chosen;
  } catch {
    return Math.floor(Math.random() * totalPrompts);
  }
}
