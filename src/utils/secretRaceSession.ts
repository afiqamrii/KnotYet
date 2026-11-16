import type { SecretRaceState } from '../store/MultiplayerContext';

export interface SecretRaceSession {
  version: 1;
  roomCode: string;
  isHost: boolean;
  savedAt: number;
  state: SecretRaceState;
  numbers: { host?: number; partner?: number };
  guestLockedNumber: number | null;
  countdownEndsAt: number | null;
  candidate: { role: 'host' | 'partner'; receivedAt: number } | null;
  cooldowns: { host: number; partner: number };
  rewardedRounds: string[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function validateSecretRaceState(value: unknown): value is SecretRaceState {
  if (!record(value) || !id(value.matchId) || !integer(value.round, 1, 5) ||
    !['+', '−', '×'].includes(value.operation as string) || !['picking', 'countdown', 'answering', 'result', 'complete'].includes(value.phase as string) ||
    typeof value.hostLocked !== 'boolean' || typeof value.partnerLocked !== 'boolean' || !record(value.scores) ||
    !integer(value.scores.host, 0, 5) || !integer(value.scores.partner, 0, 5)) return false;
  const revealed = ['answering', 'result', 'complete'].includes(value.phase as string);
  const finished = value.phase === 'result' || value.phase === 'complete';
  if (value.phase !== 'picking' && (!value.hostLocked || !value.partnerLocked)) return false;
  if (value.scores.host + value.scores.partner > value.round - (finished ? 0 : 1)) return false;
  if (value.phase === 'complete' ? value.round !== 5 : value.phase === 'result' && value.round === 5) return false;
  if (finished ? !['host', 'partner', 'tie'].includes(value.winner as string) : value.winner !== undefined) return false;
  // A saved or replayed setup must never disclose either private pick.
  if (!revealed) return value.equation === undefined;
  if (!record(value.equation)) return false;
  const max = value.operation === '×' ? 12 : 20;
  const { hostNumber, partnerNumber, answer } = value.equation;
  return integer(hostNumber, 1, max) && integer(partnerNumber, 1, max) &&
    answer === (value.operation === '+' ? hostNumber + partnerNumber : value.operation === '−' ? hostNumber - partnerNumber : hostNumber * partnerNumber);
}

export const secretRaceSessionKey = (isHost: boolean) => isHost ? 'secret_race_host_session' : 'secret_race_guest_session';

export function restoreSecretRaceSession(raw: string | null, roomCode: string | null, isHost: boolean, now = Date.now()): SecretRaceSession | null {
  if (!raw || !roomCode) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!record(saved) || saved.version !== 1 || saved.roomCode !== roomCode || saved.isHost !== isHost ||
      !integer(saved.savedAt, 0, now + 60_000) || !validateSecretRaceState(saved.state) || !record(saved.numbers) ||
      !record(saved.cooldowns) || !integer(saved.cooldowns.host, 0, saved.savedAt + 2_000) || !integer(saved.cooldowns.partner, 0, saved.savedAt + 2_000) ||
      !Array.isArray(saved.rewardedRounds) || saved.rewardedRounds.length > 100 || !saved.rewardedRounds.every(id)) return null;
    const { state, numbers } = saved;
    const max = state.operation === '×' ? 12 : 20;
    if (isHost) {
      if (state.hostLocked ? !integer(numbers.host, 1, max) : numbers.host !== undefined) return null;
      if (state.partnerLocked ? !integer(numbers.partner, 1, max) : numbers.partner !== undefined) return null;
      if (saved.guestLockedNumber !== null) return null;
      if (state.equation && (numbers.host !== state.equation.hostNumber || numbers.partner !== state.equation.partnerNumber)) return null;
    } else if (numbers.host !== undefined || numbers.partner !== undefined ||
      (saved.guestLockedNumber !== null && !integer(saved.guestLockedNumber, 1, max))) return null;
    if (state.phase === 'countdown' ? !integer(saved.countdownEndsAt, 0, saved.savedAt + 3_050) : saved.countdownEndsAt !== null) return null;
    if (saved.candidate !== null && (!isHost || state.phase !== 'answering' || !record(saved.candidate) ||
      !['host', 'partner'].includes(saved.candidate.role as string) || !integer(saved.candidate.receivedAt, 0, saved.savedAt))) return null;
    // Rebuild the public snapshot so unexpected fields in browser storage can
    // never be replayed alongside the host's intentionally private picks.
    const publicState: SecretRaceState = {
      matchId: state.matchId, round: state.round, operation: state.operation, phase: state.phase,
      hostLocked: state.hostLocked, partnerLocked: state.partnerLocked,
      scores: { host: state.scores.host, partner: state.scores.partner },
    };
    if (state.equation) publicState.equation = { hostNumber: state.equation.hostNumber, partnerNumber: state.equation.partnerNumber, answer: state.equation.answer };
    if (state.winner) publicState.winner = state.winner;
    return { ...saved, state: publicState } as unknown as SecretRaceSession;
  } catch { return null; }
}
