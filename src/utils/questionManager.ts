import { 
  MATCH_QUESTIONS, 
  GUESS_QUIZ_LIST, 
  SWIPE_CARDS, 
  WHEEL_SEGMENTS,
  MatchQuestion, 
  GuessQuizItem, 
  SwipeCardItem, 
  CardCategory,
  WOULD_YOU_RATHER,
  WouldYouRatherQuestion,
} from '../data/questions';
import type { QuestionMood } from '../data/questionMood';
import { rotateQuestions, shuffleQuestions } from './questionRotation';

const STORAGE_KEY_SEEN = 'knotyet_seen_questions';
const STORAGE_KEY_ANSWERED = 'jodohdeck_answered';

/**
 * Fisher-Yates shuffle algorithm for truly random, unbiased array distribution.
 */
export function shuffleArray<T>(array: T[]): T[] {
  return shuffleQuestions(array);
}

const questionMoods = new Map<string, QuestionMood>([
  ...SWIPE_CARDS.map(item => [item.id, item.mood] as const),
  ...GUESS_QUIZ_LIST.map(item => [item.id, item.mood] as const),
  ...MATCH_QUESTIONS.map(item => [item.id, item.mood] as const),
  ...WOULD_YOU_RATHER.map(item => [item.id, item.mood] as const),
  ...WHEEL_SEGMENTS.flatMap(segment => segment.promptIds.map((id, index) => [id, segment.promptMoods[index]] as const)),
]);

function getQuestionMoodHistory(): QuestionMood[] {
  // Only actual local viewing history affects pacing. Cloud exclusions may also
  // include queued cards that have not been shown yet, especially on the wheel.
  return [...getSeenQuestionIds()].flatMap(id => {
    const mood = questionMoods.get(id);
    return mood ? [mood] : [];
  });
}

/**
 * Retrieve the set of all question IDs that the user has already seen/answered.
 */
export function getSeenQuestionIds(additionalSeenIds?: Iterable<string>): Set<string> {
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
  if (additionalSeenIds) {
    for (const id of additionalSeenIds) if (typeof id === 'string') set.add(id);
  }
  return set;
}

/**
 * Mark a single question as seen/answered so it won't repeat in subsequent games.
 */
export function markQuestionAsSeen(id: string): void {
  try {
    const seen = getSeenQuestionIds();
    // Explicitly replayed choice rounds still affect the mood of the next deck.
    seen.delete(id);
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

export function getShuffledMatchQuestions(count: number = 10, additionalSeenIds?: Iterable<string>): MatchQuestion[] {
  const seen = getSeenQuestionIds(additionalSeenIds);
  const available = MATCH_QUESTIONS.filter(question => !seen.has(question.id));
  return rotateQuestions(available, count, getQuestionMoodHistory(), (question, selected) => {
    const kind = selected.length % 2 === 0 ? 'compatibility' : 'spotlight';
    if (question.kind !== kind) return false;
    if (kind === 'compatibility') return true;
    const spotlightCount = selected.filter(item => item.kind === 'spotlight').length;
    const target = spotlightCount % 2 === 0 ? 'host' : 'partner';
    const targetAvailable = available.some(item => item.kind === 'spotlight' && item.targetPlayer === target && !selected.includes(item));
    return !targetAvailable || question.targetPlayer === target;
  });
}

export function getMatchQuestionsByIds(ids: string[]): MatchQuestion[] {
  const map = new Map(MATCH_QUESTIONS.map(q => [q.id, q]));
  const result: MatchQuestion[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) result.push(q);
  }
  return result;
}

// ==========================================
// 2. GUESS MY HEART (QUIZ) QUESTIONS
// ==========================================

export function getShuffledGuessQuestions(count: number = 10, additionalSeenIds?: Iterable<string>): GuessQuizItem[] {
  const seen = getSeenQuestionIds(additionalSeenIds);
  return rotateQuestions(GUESS_QUIZ_LIST.filter(q => !seen.has(q.id)), count, getQuestionMoodHistory());
}

export function getGuessQuestionsByIds(ids: string[]): GuessQuizItem[] {
  const map = new Map(GUESS_QUIZ_LIST.map(q => [q.id, q]));
  const result: GuessQuizItem[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) result.push(q);
  }
  return result;
}

// ==========================================
// 3. ICEBREAKER (SWIPE) CARDS
// ==========================================

export function getShuffledSwipeCards(category: CardCategory | 'all', count: number = 15, additionalSeenIds?: Iterable<string>): SwipeCardItem[] {
  const seen = getSeenQuestionIds(additionalSeenIds);
  
  let matching = SWIPE_CARDS;
  if (category !== 'all') {
    matching = matching.filter(c => c.category === category);
  }

  return rotateQuestions(matching.filter(c => !seen.has(c.id)), count, getQuestionMoodHistory());
}

export function getSwipeCardsByIds(ids: string[]): SwipeCardItem[] {
  const map = new Map(SWIPE_CARDS.map(c => [c.id, c]));
  const result: SwipeCardItem[] = [];
  for (const id of ids) {
    const card = map.get(id);
    if (card) result.push(card);
  }
  return result;
}

// ==========================================
// 4. SPIN WHEEL PROMPTS
// ==========================================

export const getWheelPromptId = (segmentId: string, promptIndex: number) =>
  WHEEL_SEGMENTS.find(segment => segment.id === segmentId)?.promptIds[promptIndex] ?? `wheel:${segmentId}:${promptIndex}`;

export function getRandomUnseenWheelSelection(additionalSeenIds?: Iterable<string>): { segmentIndex: number; promptIndex: number; questionId: string } | null {
  const seen = getSeenQuestionIds(additionalSeenIds);
  const available = WHEEL_SEGMENTS.flatMap((segment, segmentIndex) =>
    segment.prompts.map((_, promptIndex) => ({
      segmentIndex,
      promptIndex,
      questionId: segment.promptIds[promptIndex],
      mood: segment.promptMoods[promptIndex],
    })).filter(item => !seen.has(item.questionId)),
  );

  const selection = rotateQuestions(available, 1, getQuestionMoodHistory())[0];
  if (!selection) return null;
  const { segmentIndex, promptIndex, questionId } = selection;
  return { segmentIndex, promptIndex, questionId };
}

export function getShuffledChoiceQuestions(count: number = 8): WouldYouRatherQuestion[] {
  const seen = getSeenQuestionIds();
  const unseen = WOULD_YOU_RATHER.filter(question => !seen.has(question.id));
  // This game's explicit "Play another round" action can replay a completed pool.
  return rotateQuestions(unseen.length ? unseen : WOULD_YOU_RATHER, count, getQuestionMoodHistory());
}
