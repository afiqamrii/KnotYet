export interface NumberGuess { value: number; hint: 'higher' | 'lower'; guesser?: string }
export interface NumberRoundSnapshot {
  roomCode: string;
  round: number;
  secret: number;
  guesses: NumberGuess[];
  stage: 'guess' | 'reveal';
  winnerName: string | null;
}
export interface NumberSession extends Omit<NumberRoundSnapshot, 'roomCode' | 'stage'> {
  roomCode: string | null;
  stage: 'setup' | 'guess' | 'reveal';
}
const validNumber = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100;

export function validateNumberSnapshot(value: unknown): value is NumberRoundSnapshot {
  if (!value || typeof value !== 'object') return false;
  const state = value as NumberRoundSnapshot;
  return typeof state.roomCode === 'string' && state.roomCode.length > 0 && state.roomCode.length <= 64 &&
    Number.isSafeInteger(state.round) && state.round >= 1 && validNumber(state.secret) &&
    (state.stage === 'guess' || state.stage === 'reveal') &&
    (state.stage === 'reveal' ? typeof state.winnerName === 'string' && state.winnerName.trim().length > 0 && state.winnerName.length <= 100 : state.winnerName === null) &&
    Array.isArray(state.guesses) && state.guesses.length <= 99 &&
    new Set(state.guesses.map(guess => guess?.value)).size === state.guesses.length &&
    state.guesses.every(guess => guess && validNumber(guess.value) && guess.value !== state.secret &&
      guess.hint === (guess.value < state.secret ? 'higher' : 'lower') &&
      (guess.guesser === undefined || (typeof guess.guesser === 'string' && guess.guesser.length <= 100)));
}

/** A room can resume only its own valid turn history. Legacy local games remain compatible. */
export function restoreNumberSession(storage: Storage, roomCode: string | null, online: boolean): NumberSession | null {
  try {
    const cached = storage.getItem('num_session');
    let saved: NumberSession;
    if (cached) saved = JSON.parse(cached);
    else {
      if (online) return null;
      saved = {
        roomCode: null,
        stage: (storage.getItem('num_stage') || 'setup') as NumberSession['stage'],
        secret: Number(storage.getItem('num_secret')),
        guesses: JSON.parse(storage.getItem('num_guesses') || '[]'),
        round: Number(storage.getItem('num_round') || 1),
        winnerName: storage.getItem('num_winner'),
      };
    }
    if (!saved || saved.roomCode !== (online ? roomCode : null) || !['setup', 'guess', 'reveal'].includes(saved.stage)) return null;
    if (online && saved.stage === 'setup') return null;
    const candidate = { ...saved, roomCode: saved.roomCode || 'local', stage: saved.stage === 'setup' ? 'guess' : saved.stage };
    return validateNumberSnapshot(candidate) ? saved : null;
  } catch { return null; }
}
