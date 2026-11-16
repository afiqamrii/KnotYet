export interface LetterRoundSnapshot {
  roomCode: string;
  roundId: string;
  stage: 'wait' | 'countdown' | 'race' | 'winner';
  letter: string | null;
  winner: { name: string; word: string } | null;
  remainingMs: number;
}
export interface LetterSession extends Omit<LetterRoundSnapshot, 'roomCode'> {
  roomCode: string | null;
  countdownEndsAt: number;
}

export function validateLetterSnapshot(value: unknown): value is LetterRoundSnapshot {
  if (!value || typeof value !== 'object') return false;
  const state = value as LetterRoundSnapshot;
  if (typeof state.roomCode !== 'string' || !state.roomCode || state.roomCode.length > 64 ||
      typeof state.roundId !== 'string' || !state.roundId || state.roundId.length > 160 ||
      !['wait', 'countdown', 'race', 'winner'].includes(state.stage) ||
      !Number.isFinite(state.remainingMs) || state.remainingMs < 0 || state.remainingMs > 3000) return false;
  if (state.stage === 'wait') return state.letter === null && state.winner === null && state.remainingMs === 0;
  if (typeof state.letter !== 'string' || !/^[A-Z]$/.test(state.letter)) return false;
  if (state.stage !== 'countdown' && state.remainingMs !== 0) return false;
  if (state.stage !== 'winner') return state.winner === null;
  return !!state.winner && typeof state.winner.name === 'string' && state.winner.name.trim().length > 0 && state.winner.name.length <= 100 &&
    typeof state.winner.word === 'string' && state.winner.word.length > 0 && state.winner.word.length <= 100;
}

export function restoreLetterSession(storage: Storage, roomCode: string | null, online: boolean, now = Date.now()): LetterSession | null {
  try {
    const cached = storage.getItem('letter_session');
    let saved: LetterSession;
    if (cached) saved = JSON.parse(cached);
    else {
      if (online) return null;
      saved = {
        roomCode: null, roundId: storage.getItem('letter_roundId') || 'local',
        stage: (storage.getItem('letter_stage') || 'wait') as LetterSession['stage'],
        letter: storage.getItem('letter_char'), winner: JSON.parse(storage.getItem('letter_winner') || 'null'),
        remainingMs: 0, countdownEndsAt: 0,
      };
    }
    if (!saved || saved.roomCode !== (online ? roomCode : null)) return null;
    if (saved.stage === 'countdown') {
      if (!Number.isFinite(saved.countdownEndsAt) || saved.countdownEndsAt <= 0) return null;
      saved.remainingMs = Math.max(0, Math.min(3000, saved.countdownEndsAt - now));
      if (!saved.remainingMs) saved.stage = 'race';
    }
    return validateLetterSnapshot({ ...saved, roomCode: saved.roomCode || 'local' }) ? saved : null;
  } catch { return null; }
}
