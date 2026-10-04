import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Load real TypeScript exports; this needs neither a browser nor a running app.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const candidateOnly = process.argv.includes('--candidate');
// Validate all rendered strings too when checking the published English bank.
const requireEnglish = process.argv.includes('--require-english');
try {
  const data = await server.ssrLoadModule('/src/data/englishQuestions.ts');
  const { WOULD_YOU_RATHER } = await server.ssrLoadModule('/src/data/englishChoices.ts');
  const bank = data.englishQuestionBank;
  const questions = [
    ...bank.teka_teki_bodoh.map(item => item.soalan),
    ...data.englishVibes.map(item => item.question),
    ...data.englishMatureGroups.flat().map(item => item.question),
    ...data.englishSensitive.map(item => item.question),
    ...data.englishDeep.map(item => item.question),
    ...data.englishRelationship.map(item => item.question),
    ...data.englishExpectations.map(item => item.question),
    ...data.englishChallenges.map(item => item.question),
    ...data.englishGuesses.map(item => item.question),
    ...data.englishMatches.map(item => item.question),
    ...WOULD_YOU_RATHER.map(item => item.question),
  ];
  const key = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  assert.equal(new Set(questions.map(key)).size, questions.length, 'candidate prompts are distinct');
  for (const question of questions) {
    assert.ok(question.trim().length >= 15, 'prompt must contain a complete thought');
    assert.ok(question.length <= 180, 'prompt must fit a mobile card');
    assert.doesNotMatch(question, /\b(?:awak|saya|soalan|pasangan|bagaimana|korang)\b/i, 'rendered prompt is English');
    assert.doesNotMatch(question, /\[cite:|#\d+|undefined|null/, 'no source markers or generated filler');
  }
  for (const item of [...data.englishGuesses, ...data.englishMatches, ...WOULD_YOU_RATHER]) {
    assert.ok(item.options.length === 2 || item.options.length === 4, 'choice cardinality is supported');
    assert.equal(new Set(item.options.map(key)).size, item.options.length, 'choices within a question differ');
    assert.ok(item.options.every(option => option.length > 1 && option.length <= 70), 'choices are concise and nonempty');
    assert.ok(item.followUp.trim().length > 10, 'choice prompts have a real follow-up');
  }
  for (const item of data.englishChallenges) {
    assert.match(item.followUp, /Together:/, 'every challenge explains shared play');
    // Activities that do not need another player naturally work alone too.
    assert.ok(item.followUp.length <= 230, 'challenge instructions fit the card');
  }
  assert.equal(Object.keys(bank.soalan_matang_prakahwinan).length, 4, 'all existing mature groups retained');
  assert.ok(bank.teka_teki_bodoh.every(item => item.jawapan.length > 4), 'all riddles have explained answers');
  if (!candidateOnly) {
    const { SWIPE_CARDS, GUESS_QUIZ_LIST, MATCH_QUESTIONS, WHEEL_SEGMENTS } = await server.ssrLoadModule('/src/data/questions.ts');
    const pools = [SWIPE_CARDS, GUESS_QUIZ_LIST, MATCH_QUESTIONS, WOULD_YOU_RATHER];
    for (const pool of pools) {
      assert.equal(new Set(pool.map(item => item.id)).size, pool.length, 'pool IDs are unique');
      assert.ok(pool.every(item => ['easy', 'fun', 'deep'].includes(item.mood)), 'every question has an explicit supported mood');
      if (requireEnglish) assert.ok(pool.every(item => item.id.includes('en2')), 'rewritten content uses fresh history IDs');
    }
    const swipeMap = new Map(SWIPE_CARDS.map(item => [item.id, item.question]));
    const guessMap = new Map(GUESS_QUIZ_LIST.map(item => [item.id, item]));
    for (const item of MATCH_QUESTIONS.filter(item => item.kind === 'spotlight')) {
      assert.equal(item.question, guessMap.get(item.id)?.question, 'spotlight history shares the exact guess prompt');
    }
    for (const segment of WHEEL_SEGMENTS) {
      assert.equal(segment.prompts.length, segment.promptIds.length, 'wheel text and IDs align');
      assert.equal(segment.prompts.length, segment.promptMoods.length, 'wheel text and mood metadata align');
      assert.ok(segment.promptMoods.every(mood => ['easy', 'fun', 'deep'].includes(mood)), 'wheel moods are valid');
      for (const [index, id] of segment.promptIds.entries()) {
        if (swipeMap.has(id)) assert.equal(segment.prompts[index], swipeMap.get(id), 'wheel history shares the exact swipe prompt');
      }
    }
    const renderedStrings = [
      ...SWIPE_CARDS.flatMap(item => [item.question, item.categoryLabel, item.flipContent.title, item.flipContent.description]),
      ...GUESS_QUIZ_LIST.flatMap(item => [item.question, ...item.options, item.vibeText]),
      ...MATCH_QUESTIONS.flatMap(item => [item.question, ...item.options, item.vibeText]),
      ...WHEEL_SEGMENTS.flatMap(item => [item.label, item.category, ...item.prompts]),
    ];
    for (const value of renderedStrings) {
      assert.ok(value.trim(), 'every rendered string is nonempty');
      if (requireEnglish) assert.doesNotMatch(value, /\b(?:awak|saya|soalan|pasangan|jawapan|kenangan|kewangan|matang|bincang|lelaki|perempuan)\b/i, 'all playable text is English');
    }
    console.log(JSON.stringify({
      swipe: SWIPE_CARDS.length, guess: GUESS_QUIZ_LIST.length,
      match: MATCH_QUESTIONS.length,
      wheel: WHEEL_SEGMENTS.reduce((total, item) => total + item.prompts.length, 0),
      eitherOr: WOULD_YOU_RATHER.length,
    }));
  }
  console.log('Question content: unique original prompts, concise options, follow-ups, and bank contract passed.');
} finally {
  await server.close();
}
