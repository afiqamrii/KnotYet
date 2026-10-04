import type { QuestionMood } from '../data/questionMood';

// A little depth, then room to breathe. Start new sessions with a quick answer.
export const QUESTION_MOOD_ROTATION: readonly QuestionMood[] = ['easy', 'fun', 'deep', 'easy', 'fun', 'easy', 'deep'];

export function shuffleQuestions<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Randomise within moods while spacing reflective questions when lighter ones remain. */
export function rotateQuestions<T extends { mood: QuestionMood }>(
  items: readonly T[],
  count: number,
  history: readonly QuestionMood[] = [],
  prefer?: (item: T, selected: readonly T[]) => boolean,
): T[] {
  const remaining = shuffleQuestions(items);
  const selected: T[] = [];
  const moods = [...history];
  const limit = Number.isNaN(count) ? 0 : Math.min(remaining.length, Math.max(0, Math.floor(count)));
  while (selected.length < limit) {
    const desired = QUESTION_MOOD_ROTATION[moods.length % QUESTION_MOOD_ROTATION.length];
    const lastDeep = moods.lastIndexOf('deep');
    const breathingRoom = lastDeep !== -1 && moods.length - lastDeep - 1 < 2;
    const lightRemaining = remaining.some(item => item.mood !== 'deep');
    // Protect the mood spacing even when one match-round type is running low.
    const eligible = remaining.filter(item => !(breathingRoom && lightRemaining && item.mood === 'deep'));
    const preferred = prefer ? eligible.filter(item => prefer(item, selected)) : eligible;
    const candidates = preferred.length ? preferred : eligible;
    const priority: QuestionMood[] = desired === 'deep'
      ? ['deep', 'easy', 'fun']
      : [desired, desired === 'easy' ? 'fun' : 'easy', 'deep'];
    const next = priority.map(mood => candidates.find(item => item.mood === mood)).find(item => item !== undefined)!;
    selected.push(next);
    moods.push(next.mood);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return selected;
}
