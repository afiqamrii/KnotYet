import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = async name => {
  const source = await readFile(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8');
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const match of compiled.matchAll(/from ['"]\.\/([^'"]+)['"]/g)) compiled = compiled.replace(match[0], `from '${await moduleUrl(match[1])}'`);
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
};
const { isMultiplayerMessage: valid } = await import(await moduleUrl('multiplayerProtocol'));
const race = { matchId: 'race-1', round: 1, operation: '+', phase: 'picking', hostLocked: false, partnerLocked: false, scores: { host: 0, partner: 0 } };
const equation = { hostNumber: 4, partnerNumber: 6, answer: 10 };
const cases = [
  ['PROFILE_SYNC', { name: 'Alex', avatarId: 'sunny', heartPoints: 20, accountId: 'alice' }],
  ['SET_GAME', 'number'], ['SWIPE_REQUEST', { direction: 'left', cardId: 'one' }], ['SWIPE_ACTION', { direction: 'right', cardId: 'one' }], ['SWIPE_FLIP', true],
  ['CARD_SUBMIT', { cardId: 'one', answer: 'A walk' }], ['CARD_SUBMIT', 'legacy'], ['RIDDLE_REVEAL', { cardId: 'one' }],
  ['CHOICES_STATE', { roundId: 'r', ids: ['one', 'two'], index: 0, picks: [null, 1], matches: 0 }], ['CHOICES_PICK', { roundId: 'r', choice: 1 }],
  ['QUIZ_ACTUAL', 'A'], ['QUIZ_GUESS', 'A'], ['MATCH_SELECT', 'A'],
  ['SPIN_WHEEL', { rotation: 1440, segmentIndex: 1, promptIndex: 3 }], ['WHEEL_SUBMIT', { spinKey: '1440:1:3', answer: 'An adventure' }], ['WHEEL_DISMISS', { spinKey: '1440:1:3' }],
  ['SYNC_QUESTION_IDS', { game: 'quiz', questionIds: ['one', 'two'], currentIndex: 2 }],
  ['MATCH_RESTART', { questionIds: ['one'] }], ['QUIZ_RESTART', { questionIds: ['one'] }],
  ['NUM_SET_SECRET', 42], ['NUM_GUESS', 20], ['NUM_GUESS', { val: 20, name: 'Alex', round: 1 }],
  ['NUM_STATE', { roomCode: '123456', round: 1, secret: 42, guesses: [{ value: 20, hint: 'higher' }], stage: 'guess', winnerName: null }],
  ['SECRET_RACE_START', race], ['SECRET_RACE_STATE', { ...race, phase: 'answering', equation }], ['SECRET_RACE_RESULT', { ...race, phase: 'result', equation, winner: 'host' }],
  ['SECRET_RACE_LOCK', { matchId: 'race-1', number: 4 }], ['SECRET_RACE_GO', { matchId: 'race-1', equation }], ['SECRET_RACE_ANSWER', { matchId: 'race-1', answer: 1000 }],
  ['SECRET_RACE_WRONG', { matchId: 'race-1', delayMs: 2000 }], ['SECRET_RACE_NEXT', { matchId: 'race-1' }], ['SECRET_RACE_RESTART', { matchId: 'race-1' }],
  ['LETTER_START', 'A'], ['LETTER_START', { letter: 'A', roundId: 'r' }], ['LETTER_WORD_SUBMIT', 'APPLE'], ['LETTER_WORD_SUBMIT', { word: 'APPLE', roundId: 'r' }], ['LETTER_RESULT', { name: 'Alex', word: 'APPLE', roundId: 'r' }],
  ['LETTER_STATE', { roomCode: '123456', roundId: 'r', stage: 'race', letter: 'A', winner: null, remainingMs: 0 }],
  ['START_GAME', { game: 'swipe', questionIds: ['one'] }], ['START_COUNTDOWN', { game: 'swipe' }],
  ['CHAT_MESSAGE', { id: 'm1', senderId: 'me', senderName: 'Alex', senderAvatar: 'sunny', text: 'Hello', timestamp: Date.now(), isQuickReaction: false }], ['CHAT_TYPING', { isTyping: true }],
];
for (const [type, payload] of cases) assert.equal(valid({ type, payload }), true, `accept valid ${type}`);
for (const type of ['CHOICES_REQUEST', 'QUIZ_NEXT', 'MATCH_NEXT', 'NUM_NEXT', 'NUM_REQUEST', 'LETTER_NEXT', 'LETTER_REQUEST', 'END_GAME', 'LEAVE_ROOM', 'RIDDLE_REVEAL', 'MATCH_RESTART', 'QUIZ_RESTART']) assert.equal(valid({ type }), true, `accept payload-free ${type}`);
for (const value of [null, [], 'SET_GAME', {}, { type: 'unknown' }, { type: 'SET_GAME', payload: 'story' },
  { type: 'CARD_SUBMIT', payload: { cardId: 'one', answer: null } },
  { type: 'SYNC_QUESTION_IDS', payload: { game: 'swipe', questionIds: ['one'], currentIndex: 2 } },
  { type: 'SYNC_QUESTION_IDS', payload: { game: 'swipe', questionIds: ['one', 'one'] } },
  { type: 'CHOICES_STATE', payload: { roundId: 'r', ids: ['one'], index: 0, picks: [3, null], matches: 0 } },
  { type: 'NUM_GUESS', payload: { val: NaN } }, { type: 'NUM_STATE', payload: { roomCode: '123456', round: 1, secret: 42, guesses: [{ value: 20, hint: 'lower' }], stage: 'guess', winnerName: null } },
  { type: 'SECRET_RACE_STATE', payload: { ...race, scores: null } }, { type: 'SECRET_RACE_STATE', payload: { ...race, phase: 'answering' } },
  { type: 'LETTER_START', payload: { letter: 'too long', roundId: 'r' } }, { type: 'PROFILE_SYNC', payload: { name: 'Alex', avatarId: 'sunny', heartPoints: Infinity } },
  { type: 'CHAT_MESSAGE', payload: { ...cases.find(([type]) => type === 'CHAT_MESSAGE')[1], timestamp: 9000000000000000 } },
]) assert.equal(valid(value), false, `reject malformed ${JSON.stringify(value)}`);
// Every payload-bearing variant must fail closed for null instead of throwing.
for (const [type] of cases) assert.doesNotThrow(() => assert.equal(valid({ type, payload: null }), false));
console.log('Multiplayer protocol: all packet variants, legacy payloads, invalid fields, bounds and missing payload rejection passed.');
