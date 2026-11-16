import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/questionSession.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { restoreQuestionSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const storageSource = await readFile(new URL('../src/utils/storage.ts', import.meta.url), 'utf8');
const storageCompiled = ts.transpileModule(storageSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { GAME_SESSION_KEYS, clearStorageKeys } = await import(`data:text/javascript;base64,${Buffer.from(storageCompiled).toString('base64')}`);
const sessionKeys = new Map([['num_session', 'old number round'], ['letter_session', 'old letter round'], ['unrelated', 'keep']]);
clearStorageKeys({ removeItem: key => sessionKeys.delete(key) }, GAME_SESSION_KEYS);
assert.deepEqual([...sessionKeys], [['unrelated', 'keep']], 'ending a game clears both room snapshots while preserving unrelated settings');
const deck = [{ id: 'one', options: ['A', 'B'] }, { id: 'two', options: ['C', 'D'] }];
const resolve = ids => ids.flatMap(id => deck.find(question => question.id === id) || []);
const storage = values => {
  const entries = new Map(Object.entries(values));
  return { getItem: key => entries.get(key) ?? null, removeItem: key => entries.delete(key) };
};

for (const prefix of ['guess', 'match']) {
  for (const badDeck of [undefined, '{', 'null', '{}', '[]', '[null]', '[{"id":"removed"}]']) {
    const saved = storage({
      ...(badDeck === undefined ? {} : { [`${prefix}_questions`]: badDeck }),
      [`${prefix}_stage`]: 'reveal', [`${prefix}_completed`]: 'true', [`${prefix}_currentIndex`]: '9', unrelated: 'keep',
    });
    assert.equal(restoreQuestionSession(saved, prefix, resolve), null);
    assert.equal(saved.getItem(`${prefix}_stage`), null, 'a broken deck cannot retain a reveal screen');
    assert.equal(saved.getItem(`${prefix}_completed`), null, 'a replacement deck starts playable');
    assert.equal(saved.getItem('unrelated'), 'keep', 'recovery only clears this game');
  }
  for (const index of ['-1', '2', '1.5', 'Infinity', 'NaN']) {
    assert.equal(restoreQuestionSession(storage({ [`${prefix}_questions`]: JSON.stringify(deck), [`${prefix}_currentIndex`]: index }), prefix, resolve), null);
  }
  const firstAnswer = prefix === 'guess' ? 'actualAnswer' : 'myAnswer';
  const secondAnswer = prefix === 'guess' ? 'guessedAnswer' : 'partnerAnswer';
  const valid = { [`${prefix}_questions`]: JSON.stringify(deck), [`${prefix}_currentIndex`]: '1', [`${prefix}_stage`]: 'reveal', [`${prefix}_${firstAnswer}`]: 'C', [`${prefix}_${secondAnswer}`]: 'D', [`${prefix}_completed`]: 'true', [`${prefix}_score`]: '1' };
  const completed = storage(valid);
  assert.deepEqual(restoreQuestionSession(completed, prefix, resolve), deck, 'a valid finished deck survives refresh');
  assert.equal(completed.getItem(`${prefix}_completed`), 'true');
  assert.equal(restoreQuestionSession(storage({ ...valid, [`${prefix}_${firstAnswer}`]: 'removed option' }), prefix, resolve), null, 'changed answer options cannot restore an impossible round');
  const incomplete = { ...valid };
  delete incomplete[`${prefix}_${secondAnswer}`];
  assert.equal(restoreQuestionSession(storage(incomplete), prefix, resolve), null, 'incomplete reveal resets safely');
  const inProgress = storage({ [`${prefix}_questions`]: JSON.stringify(deck), [`${prefix}_stage`]: prefix === 'guess' ? 'handover' : 'vote', [`${prefix}_${firstAnswer}`]: 'A' });
  assert.deepEqual(restoreQuestionSession(inProgress, prefix, resolve), deck, 'a valid private handover survives refresh');
  assert.equal(inProgress.getItem(`${prefix}_${firstAnswer}`), 'A');
}
console.log('Session recovery: corrupt/missing decks, stale indices/options, incomplete reveals, and valid handovers/completions passed.');
