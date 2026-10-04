import assert from 'node:assert/strict';
import { createServer } from 'vite';

const storage = new Map();
const originalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalRandom = Math.random;
try {
  const { rotateQuestions, QUESTION_MOOD_ROTATION } = await server.ssrLoadModule('/src/utils/questionRotation.ts');
  const api = await server.ssrLoadModule('/src/utils/questionManager.ts');
  const data = await server.ssrLoadModule('/src/data/questions.ts');
  const abundant = ['easy', 'fun', 'deep'].flatMap(mood => Array.from({ length: 100 }, (_, index) => ({ id: `${mood}-${index}`, mood })));
  assert.deepEqual(rotateQuestions(abundant, 21).map(item => item.mood), Array.from({ length: 21 }, (_, index) => QUESTION_MOOD_ROTATION[index % 7]), 'fresh decks follow the intended easy/fun/deep rhythm');
  assert.equal(rotateQuestions(abundant, 1, ['deep'])[0].mood !== 'deep', true, 'a new deck breathes after a deep question');
  assert.equal(rotateQuestions(abundant, 1, ['fun', 'deep'])[0].mood !== 'deep', true, 'history can override a scheduled deep slot');
  assert.deepEqual(rotateQuestions([], 10), [], 'empty categories complete normally');
  assert.deepEqual(rotateQuestions(abundant, -1), [], 'negative deck sizes are empty');
  assert.deepEqual(rotateQuestions(abundant, NaN), [], 'invalid deck sizes are empty');
  const onlyDeep = abundant.filter(item => item.mood === 'deep');
  assert.equal(rotateQuestions(onlyDeep, 15).length, 15, 'a deliberately deep-only or depleted category still works');
  const onlyLight = abundant.filter(item => item.mood !== 'deep');
  assert.ok(rotateQuestions(onlyLight, 15).every(item => item.mood !== 'deep'), 'light categories stay light');

  const hasBreathingRoom = (deck, history = []) => {
    const moods = [...history];
    for (const item of deck) {
      if (item.mood === 'deep') {
        const previousDeep = moods.lastIndexOf('deep');
        assert.ok(previousDeep < 0 || moods.length - previousDeep - 1 >= 2, 'deep prompts have at least two lighter prompts between them');
      }
      moods.push(item.mood);
    }
  };
  const signatures = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    let randomState = seed;
    Math.random = () => ((randomState = (randomState * 1664525 + 1013904223) >>> 0) / 4294967296);
    storage.clear();
    const generators = [
      () => api.getShuffledSwipeCards('all', 15),
      () => api.getShuffledSwipeCards('taaruf-realiti', 15),
      () => api.getShuffledGuessQuestions(10),
      () => api.getShuffledMatchQuestions(10),
      () => api.getShuffledChoiceQuestions(8),
    ];
    for (const generate of generators) {
      const deck = generate();
      assert.equal(deck[0].mood, 'easy', 'a fresh session starts with an easy answer');
      assert.ok(deck.some(item => item.mood === 'fun'), 'normal decks include playfulness');
      assert.ok(deck.some(item => item.mood === 'deep'), 'normal decks include meaningful reflection');
      assert.equal(new Set(deck.map(item => item.id)).size, deck.length, 'a deck contains no duplicate prompts');
      hasBreathingRoom(deck);
    }
    const match = api.getShuffledMatchQuestions(10);
    assert.equal(match.filter(item => item.kind === 'compatibility').length, 5, 'mood rotation keeps five compatibility rounds');
    assert.equal(match.filter(item => item.kind === 'spotlight').length, 5, 'mood rotation keeps five spotlight rounds');
    const spotlight = match.filter(item => item.kind === 'spotlight');
    assert.deepEqual(spotlight.map(item => item.targetPlayer), ['host', 'partner', 'host', 'partner', 'host'], 'both partners retain their turns');
    signatures.add(api.getShuffledSwipeCards('all', 15).map(item => item.id).join(','));
  }
  assert.ok(signatures.size > 90, 'the rhythm does not turn into a fixed deck');

  storage.clear();
  const first = api.getShuffledSwipeCards('all', 3);
  first.forEach(item => api.markQuestionAsSeen(item.id));
  const second = api.getShuffledSwipeCards('all', 15);
  hasBreathingRoom(second, first.map(item => item.mood));
  assert.ok(second.every(item => !first.some(previous => previous.id === item.id)), 'new decks exclude previously shown cards');
  const choiceDeck = api.getShuffledChoiceQuestions(8);
  hasBreathingRoom(choiceDeck, first.map(item => item.mood));

  storage.clear();
  const wheelMoods = new Map(data.WHEEL_SEGMENTS.flatMap(segment => segment.promptIds.map((id, index) => [id, segment.promptMoods[index]])));
  const wheelSequence = [];
  for (let index = 0; index < 21; index++) {
    const selection = api.getRandomUnseenWheelSelection();
    assert.ok(selection);
    wheelSequence.push({ id: selection.questionId, mood: wheelMoods.get(selection.questionId) });
    api.markQuestionAsSeen(selection.questionId);
  }
  hasBreathingRoom(wheelSequence);
  assert.equal(new Set(wheelSequence.map(item => item.id)).size, wheelSequence.length, 'wheel prompts stay unseen while rotating');
  // Reserved cards affect availability, never the actual viewing history.
  storage.clear();
  const deepCard = data.SWIPE_CARDS.find(item => item.mood === 'deep');
  api.markQuestionAsSeen(deepCard.id);
  const reserved = data.SWIPE_CARDS.filter(item => item.id !== deepCard.id).slice(0, 15).map(item => item.id);
  const afterDeep = api.getRandomUnseenWheelSelection(reserved);
  assert.notEqual(wheelMoods.get(afterDeep.questionId), 'deep', 'switching games after a deep card still gives breathing room');
  assert.ok(!reserved.includes(afterDeep.questionId), 'the wheel avoids the host\'s queued swipe cards');

  storage.clear();
  data.GUESS_QUIZ_LIST.forEach(item => api.markQuestionAsSeen(item.id));
  assert.deepEqual(api.getShuffledGuessQuestions(10), [], 'exhausted guess questions are not automatically recycled');
  data.WOULD_YOU_RATHER.forEach(item => api.markQuestionAsSeen(item.id));
  assert.equal(api.getShuffledChoiceQuestions(8).length, 8, 'explicit choice replays work after the whole pool is completed');
  console.log('Question rotation: 100 shuffled sessions, easy/fun/deep balance, saved pacing, partner turns, wheel reservations, and exhaustion passed.');
} finally {
  Math.random = originalRandom;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
  await server.close();
}
