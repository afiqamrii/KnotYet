/** Restore a deck and its progress as one unit, or discard the incomplete save. */
export function restoreQuestionSession<T extends { id: string; options: readonly string[] }>(
  storage: Storage,
  prefix: 'guess' | 'match',
  resolve: (ids: string[]) => T[],
): T[] | null {
  const answerKeys = prefix === 'guess' ? ['actualAnswer', 'guessedAnswer'] : ['myAnswer', 'partnerAnswer'];
  const keys = ['questions', 'currentIndex', 'stage', ...answerKeys, 'score', 'completed', 'isMySecret'];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(`${prefix}_questions`) || 'null');
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(item => item && typeof item.id === 'string')) throw new Error('Missing deck');
    const ids = parsed.map(item => item.id as string);
    const restored = resolve(ids);
    if (restored.length !== ids.length || new Set(ids).size !== ids.length) throw new Error('Outdated deck');
    const index = Number(storage.getItem(`${prefix}_currentIndex`) || 0);
    const score = Number(storage.getItem(`${prefix}_score`) || 0);
    if (!Number.isInteger(index) || index < 0 || index >= restored.length || !Number.isInteger(score) || score < 0 || score > restored.length) throw new Error('Invalid progress');
    const stage = storage.getItem(`${prefix}_stage`) || (prefix === 'guess' ? 'secret' : 'vote');
    const stages = prefix === 'guess' ? ['secret', 'handover', 'guess', 'reveal'] : ['vote', 'reveal'];
    if (!stages.includes(stage)) throw new Error('Invalid stage');
    const answers = answerKeys.map(key => storage.getItem(`${prefix}_${key}`));
    if (answers.some(answer => answer !== null && !restored[index].options.includes(answer))) throw new Error('Outdated answer');
    if (stage === 'reveal' && answers.some(answer => !answer)) throw new Error('Incomplete reveal');
    if (prefix === 'guess' && (stage === 'handover' || stage === 'guess') && !answers[0]) throw new Error('Missing secret');
    if (storage.getItem(`${prefix}_completed`) === 'true' && (index !== restored.length - 1 || stage !== 'reveal')) throw new Error('Incomplete deck');
    return restored;
  } catch {
    // Keeping a completed flag or reveal stage from a broken deck can make the
    // replacement questions impossible to play. Reset them together.
    for (const key of keys) storage.removeItem(`${prefix}_${key}`);
    return null;
  }
}
