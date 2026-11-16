import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'from' | 'rpc'>;
type Row = Record<string, unknown>;
const MAX_ATTEMPTS = 8;

export const pendingQuestionKey = (userId: string, questionId: string) => `knotyet_pending_question:${encodeURIComponent(userId)}:${encodeURIComponent(questionId)}`;

export function readPendingQuestions(storage: Storage, userId: string): string[] {
  const prefix = `knotyet_pending_question:${encodeURIComponent(userId)}:`;
  const ids: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) ids.push(decodeURIComponent(key.slice(prefix.length)));
    }
  } catch { /* A blocked browser cache must not stop gameplay. */ }
  return ids;
}

export function validCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Retry only a confirmed conflict. An ambiguous network failure is never replayed. */
export async function compareAndSwapProgress(
  client: Client,
  target: { table: 'user_progress' | 'couples'; key: string; id: string },
  change: (row: Row) => Row,
  signal: AbortSignal,
): Promise<Row> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    signal.throwIfAborted();
    const read = await client.from(target.table).select('*').eq(target.key, target.id).abortSignal(signal).single();
    signal.throwIfAborted();
    if (read.error) throw read.error;
    if (!read.data) throw new Error('Your progress record is not available.');
    const row = read.data as Row;
    const patch = change(row);
    const fields = Object.keys(patch);
    if (!fields.length) return row;
    let write = client.from(target.table).update(patch).eq(target.key, target.id);
    for (const field of fields) {
      const previous = row[field];
      // A NULL needs IS NULL; eq(null) never matches in PostgreSQL.
      write = previous == null ? write.is(field, null) : write.eq(field, previous);
    }
    const result = await write.select('*').abortSignal(signal).maybeSingle();
    signal.throwIfAborted();
    if (result.error) throw result.error;
    if (result.data) return result.data as Row;
    // Another tab/device changed the compared values. Read its committed row
    // and apply our delta again, instead of overwriting that player's change.
    if (attempt < MAX_ATTEMPTS - 1) await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
  }
  throw new Error('Your progress is changing on another device. Please refresh it.');
}

export async function changeHeartPoints(client: Client, userId: string, delta: number, signal: AbortSignal, coupleId?: string): Promise<number> {
  if (!Number.isSafeInteger(delta)) throw new Error('Invalid heart amount.');
  const field = coupleId ? 'couple_points' : 'heart_points';
  const row = await compareAndSwapProgress(client, { table: coupleId ? 'couples' : 'user_progress', key: coupleId ? 'id' : 'user_id', id: coupleId || userId }, current => {
    const next = Math.max(0, validCount(current[field]) + delta);
    if (!Number.isSafeInteger(next)) throw new Error('Heart total is out of range.');
    return next === current[field] ? {} : { [field]: next };
  }, signal);
  return validCount(row[field]);
}

/** The reset and increment are one conditional write, including at midnight. */
export async function updateDailyPlayCount(client: Client, userId: string, signal: AbortSignal, type?: 'solo' | 'multiplayer', today = new Date().toISOString().slice(0, 10)): Promise<Row> {
  return compareAndSwapProgress(client, { table: 'user_progress', key: 'user_id', id: userId }, row => {
    // A request started just before midnight may retry after a newer request
    // has already reset the day. Never reset that newer row back to yesterday.
    const savedDay = typeof row.last_reset_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.last_reset_date) ? row.last_reset_date : '';
    const day = savedDay > today ? savedDay : today;
    const sameDay = row.last_reset_date === day;
    if (sameDay && !type) return {};
    return {
      last_reset_date: day,
      solo_play_count: (sameDay ? validCount(row.solo_play_count) : 0) + (type === 'solo' ? 1 : 0),
      play_together_count: (sameDay ? validCount(row.play_together_count) : 0) + (type === 'multiplayer' ? 1 : 0),
    };
  }, signal);
}

export interface LegacyProgress { owner: string; points: number; answered: string[] }
const LEGACY_SNAPSHOT = 'knotyet_legacy_progress_snapshot';
const LEGACY_DONE = 'jodohdeck_migrated_to_cloud';

/** Claim the old browser snapshot once, so it cannot migrate into two accounts. */
export function claimLegacyProgress(storage: Storage, userId: string): LegacyProgress | null {
  if (storage.getItem(LEGACY_DONE) === 'true' || storage.getItem(`${LEGACY_DONE}:${userId}`) === 'true') return null;
  const existing = storage.getItem(LEGACY_SNAPSHOT);
  if (existing) {
    const saved: unknown = JSON.parse(existing);
    if (!saved || typeof saved !== 'object') return null;
    const snapshot = saved as LegacyProgress;
    if (snapshot.owner !== userId || !Array.isArray(snapshot.answered)) return null;
    return { owner: userId, points: validCount(snapshot.points), answered: snapshot.answered.filter(id => typeof id === 'string') };
  }
  let profile: { heartPoints?: unknown } | null = null;
  let answered: unknown = [];
  try { profile = JSON.parse(storage.getItem('jodohdeck_profile') || 'null'); } catch { /* Invalid legacy data is not migrated. */ }
  try { answered = JSON.parse(storage.getItem('jodohdeck_answered') || '[]'); } catch { /* Keep any valid legacy points. */ }
  const snapshot = { owner: userId, points: validCount(profile?.heartPoints), answered: Array.isArray(answered) ? [...new Set(answered.filter((id): id is string => typeof id === 'string'))] : [] };
  // Persist ownership before any asynchronous cloud write. If storage is not
  // writable, stop rather than risk importing the same cache into another user.
  storage.setItem(LEGACY_SNAPSHOT, JSON.stringify(snapshot));
  return snapshot;
}

export async function migrateLegacyProgress(client: Client, storage: Storage, snapshot: LegacyProgress, signal: AbortSignal): Promise<void> {
  await compareAndSwapProgress(client, { table: 'user_progress', key: 'user_id', id: snapshot.owner }, row => {
    const merged = Math.max(validCount(row.heart_points), snapshot.points);
    return merged === row.heart_points ? {} : { heart_points: merged };
  }, signal);
  // The existing database RPC adds one ID atomically. Replacing the array here
  // would lose questions saved concurrently by another tab or device.
  for (const questionId of snapshot.answered) {
    signal.throwIfAborted();
    const { error } = await client.rpc('record_seen_question', { p_question_id: questionId }).abortSignal(signal);
    signal.throwIfAborted();
    if (error) throw error;
  }
  signal.throwIfAborted();
  storage.setItem(`${LEGACY_DONE}:${snapshot.owner}`, 'true');
  storage.setItem(LEGACY_DONE, 'true');
}

/** Realtime events produced by an import must not start the same import again. */
export function createLegacyMigrationRunner() {
  const inFlight = new WeakMap<AbortSignal, Map<string, Promise<void>>>();
  return (client: Client, storage: Storage, userId: string, signal: AbortSignal): Promise<void> => {
    let accounts = inFlight.get(signal);
    if (!accounts) { accounts = new Map(); inFlight.set(signal, accounts); }
    const existing = accounts.get(userId);
    if (existing) return existing;
    const operation = Promise.resolve().then(async () => {
      signal.throwIfAborted();
      const snapshot = claimLegacyProgress(storage, userId);
      if (snapshot) await migrateLegacyProgress(client, storage, snapshot, signal);
    });
    accounts.set(userId, operation);
    const cache = accounts;
    void operation.finally(() => { if (cache.get(userId) === operation) cache.delete(userId); }).catch(() => {});
    return operation;
  };
}
