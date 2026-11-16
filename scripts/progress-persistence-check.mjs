import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/progressPersistence.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const signal = () => new AbortController().signal;
const memory = values => {
  const entries = new Map(Object.entries(values || {}));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) };
};
function fixture(initial) {
  const state = { row: structuredClone(initial), updates: 0, queries: [], failWrite: false, alwaysConflict: false, rpcFail: false, beforeRead: null, afterRead: null };
  const client = {
    from(table) {
      const query = { table, operation: 'read', filters: [], patch: null };
      const builder = {
        select() { return this; }, single() { return this; }, maybeSingle() { return this; },
        update(patch) { query.operation = 'write'; query.patch = patch; return this; },
        eq(field, value) { query.filters.push([field, value]); return this; },
        is(field, value) { query.filters.push([field, value]); return this; },
        abortSignal(value) { query.signal = value; return this; },
        async then(resolve, reject) {
          try {
            query.signal?.throwIfAborted();
            state.queries.push(query);
            if (query.operation === 'read') {
              await state.beforeRead?.();
              const data = structuredClone(state.row);
              await state.afterRead?.();
              return resolve({ data, error: null });
            }
            state.updates += 1;
            if (state.failWrite) return resolve({ data: null, error: new Error('Connection lost after write') });
            if (state.alwaysConflict || !query.filters.every(([field, value]) => (state.row[field] ?? null) === value)) return resolve({ data: null, error: null });
            Object.assign(state.row, query.patch);
            return resolve({ data: structuredClone(state.row), error: null });
          } catch (error) { return reject(error); }
        },
      };
      return builder;
    },
    rpc(_name, { p_question_id }) {
      return { async abortSignal(value) {
        value.throwIfAborted();
        if (state.rpcFail) return { error: new Error('History unavailable') };
        state.row.answered_questions = [...new Set([...(state.row.answered_questions || []), p_question_id])];
        return { data: state.row.answered_questions, error: null };
      } };
    },
  };
  return { client, state };
}

// Force all three devices to read the same initial total before any writes.
const concurrent = fixture({ user_id: 'alice', heart_points: 100 });
let readers = 0, release;
const barrier = new Promise(resolve => { release = resolve; });
concurrent.state.afterRead = async () => { if (++readers <= 3) { if (readers === 3) release(); await barrier; } };
await Promise.all([15, 10, -5].map(delta => api.changeHeartPoints(concurrent.client, 'alice', delta, signal())));
assert.equal(concurrent.state.row.heart_points, 120, 'concurrent rewards and deductions preserve every delta');
assert.ok(concurrent.state.updates > 3, 'conflicting writes actually retry');
await api.changeHeartPoints(concurrent.client, 'alice', -1000, signal());
assert.equal(concurrent.state.row.heart_points, 0, 'deductions never create a negative total');
await assert.rejects(api.changeHeartPoints(concurrent.client, 'alice', NaN, signal()));

const ambiguous = fixture({ user_id: 'alice', heart_points: 0 });
ambiguous.state.failWrite = true;
await assert.rejects(api.changeHeartPoints(ambiguous.client, 'alice', 15, signal()));
assert.equal(ambiguous.state.updates, 1, 'a possibly committed transport failure is never replayed');
const conflicted = fixture({ user_id: 'alice', heart_points: 0 });
conflicted.state.alwaysConflict = true;
await assert.rejects(api.changeHeartPoints(conflicted.client, 'alice', 15, signal()));
assert.equal(conflicted.state.updates, 8, 'permission/continuous-conflict failures have a bounded retry limit');

const aborted = fixture({ user_id: 'alice', heart_points: 10 });
const controller = new AbortController();
aborted.state.afterRead = () => controller.abort();
await assert.rejects(api.changeHeartPoints(aborted.client, 'alice', 10, controller.signal));
assert.equal(aborted.state.updates, 0, 'account cancellation after the read prevents the write');

const midnight = fixture({ user_id: 'alice', heart_points: 50, last_reset_date: '2026-11-15', solo_play_count: 12, play_together_count: 7 });
await Promise.all([
  api.updateDailyPlayCount(midnight.client, 'alice', signal(), 'solo', '2026-11-16'),
  api.updateDailyPlayCount(midnight.client, 'alice', signal(), 'multiplayer', '2026-11-16'),
  api.updateDailyPlayCount(midnight.client, 'alice', signal(), undefined, '2026-11-16'),
]);
assert.equal(midnight.state.row.solo_play_count, 1, 'daily refresh cannot erase a concurrent solo increment');
assert.equal(midnight.state.row.play_together_count, 1, 'daily reset preserves concurrent multiplayer increment');
assert.equal(midnight.state.row.heart_points, 50);
await api.updateDailyPlayCount(midnight.client, 'alice', signal(), 'solo', '2026-11-15');
assert.equal(midnight.state.row.last_reset_date, '2026-11-16', 'a delayed pre-midnight request cannot reset the date backwards');
assert.equal(midnight.state.row.solo_play_count, 2, 'delayed increments preserve the newer day counts');

const storage = memory({ jodohdeck_profile: JSON.stringify({ heartPoints: 20, name: 'Old name' }), jodohdeck_answered: JSON.stringify(['old', 'old', null]) });
const legacy = api.claimLegacyProgress(storage, 'alice');
assert.deepEqual(legacy, { owner: 'alice', points: 20, answered: ['old'] });
assert.equal(api.claimLegacyProgress(storage, 'bob'), null, 'one browser snapshot belongs to only one account');
const migrated = fixture({ user_id: 'alice', heart_points: 100, answered_questions: ['cloud'], name: 'Cloud name' });
await api.migrateLegacyProgress(migrated.client, storage, legacy, signal());
assert.equal(migrated.state.row.heart_points, 100, 'legacy import never lowers an existing cloud total');
assert.equal(migrated.state.row.name, 'Cloud name', 'cloud profile details remain authoritative');
assert.deepEqual(migrated.state.row.answered_questions, ['cloud', 'old'], 'history is merged without overwriting cloud IDs');
assert.equal(storage.getItem('jodohdeck_migrated_to_cloud:alice'), 'true');
assert.equal(api.claimLegacyProgress(storage, 'alice'), null, 'successful import does not run again');

const interruptedStorage = memory({ jodohdeck_profile: JSON.stringify({ heartPoints: 30 }), jodohdeck_answered: '["legacy"]' });
const interrupted = fixture({ user_id: 'alice', heart_points: 10, answered_questions: ['cloud'] });
const snapshot = api.claimLegacyProgress(interruptedStorage, 'alice');
interrupted.state.rpcFail = true;
await assert.rejects(api.migrateLegacyProgress(interrupted.client, interruptedStorage, snapshot, signal()));
assert.equal(interruptedStorage.getItem('jodohdeck_migrated_to_cloud:alice'), null, 'failed imports are not marked complete');
assert.equal(interrupted.state.row.heart_points, 30);
interrupted.state.rpcFail = false;
await api.migrateLegacyProgress(interrupted.client, interruptedStorage, snapshot, signal());
assert.equal(interrupted.state.row.heart_points, 30, 'resuming a partial import does not double the points');
assert.deepEqual(interrupted.state.row.answered_questions, ['cloud', 'legacy']);
// Import writes emit realtime events: overlapping refreshes must share one import.
const runMigration = api.createLegacyMigrationRunner();
const sharedSignal = signal();
const realtimeStorage = memory({ jodohdeck_profile: '{"heartPoints":40}', jodohdeck_answered: '["first","second"]' });
const realtime = fixture({ user_id: 'alice', heart_points: 10, answered_questions: [] });
let rpcCalls = 0;
const originalRpc = realtime.client.rpc;
realtime.client.rpc = (...args) => { rpcCalls += 1; return originalRpc(...args); };
const imports = Array.from({ length: 8 }, () => runMigration(realtime.client, realtimeStorage, 'alice', sharedSignal));
assert.ok(imports.every(operation => operation === imports[0]), 'reentrant refreshes share the same in-flight promise');
await Promise.all(imports);
assert.equal(realtime.state.updates, 1, 'concurrent refreshes perform one legacy points merge');
assert.equal(rpcCalls, 2, 'each legacy question is imported once despite realtime refreshes');
await runMigration(realtime.client, realtimeStorage, 'alice', sharedSignal);
assert.equal(rpcCalls, 2, 'completed imports remain complete after the in-flight cache clears');

const retryStorage = memory({ jodohdeck_profile: '{"heartPoints":40}', jodohdeck_answered: '["retry"]' });
const retry = fixture({ user_id: 'alice', heart_points: 10, answered_questions: [] });
retry.state.rpcFail = true;
await assert.rejects(runMigration(retry.client, retryStorage, 'alice', sharedSignal));
retry.state.rpcFail = false;
await runMigration(retry.client, retryStorage, 'alice', sharedSignal);
assert.deepEqual(retry.state.row.answered_questions, ['retry'], 'a failed import clears the in-flight cache and can resume');
assert.equal(retry.state.row.heart_points, 40, 'retrying the import does not duplicate points');

const cancelledMigration = new AbortController();
cancelledMigration.abort();
const freshStorage = memory({ jodohdeck_profile: '{"heartPoints":8}' });
await assert.rejects(runMigration(realtime.client, freshStorage, 'alice', cancelledMigration.signal));
assert.equal(freshStorage.getItem('knotyet_legacy_progress_snapshot'), null, 'an already-aborted import cannot claim the legacy cache');
const otherAccount = fixture({ user_id: 'bob', heart_points: 0 });
const independent = runMigration(otherAccount.client, freshStorage, 'bob', signal());
await independent;
assert.equal(otherAccount.state.row.heart_points, 8, 'an aborted account import cannot block another account');
console.log('Progress persistence: concurrent deltas, bounded conflicts, ambiguous failures, cancellation, midnight races, resumable migration, and reentrant import deduplication passed.');
