export const STORAGE_KEYS = {
  activeTab: 'knotyet_activeTab',
  guestActive: 'knotyet_guest_active',
  guestId: 'knotyet_guest_id',
  introShown: 'knotyet_introShown',
  profileOpen: 'knotyet_isProfileOpen',
  pendingInvite: 'pendingInvite',
  pendingRoomCode: 'pendingRoomCode',
  multiplayerRoomCode: 'mp_roomCode',
  multiplayerIsHost: 'mp_isHost',
  multiplayerActiveGame: 'mp_activeGame',
} as const;

export const GAME_SESSION_KEYS = [
  'num_stage', 'num_secret', 'num_guesses', 'num_round', 'num_p1', 'num_p2',
  'letter_stage', 'letter_letter', 'letter_char', 'letter_winner',
  'guess_stage', 'guess_questions', 'guess_currentIndex', 'guess_actualAnswer',
  'guess_guessedAnswer', 'guess_score', 'guess_completed', 'guess_isMySecret',
  'wheel_spin_state', 'wheel_rotation', 'wheel_selectedIdea',
  'match_currentIndex', 'match_questions', 'match_stage', 'match_myAnswer',
  'match_partnerAnswer', 'match_score', 'match_completed',
] as const;

export const readJson = <T>(storage: Storage, key: string, fallback: T): T => {
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const writeJson = (storage: Storage, key: string, value: unknown): void => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to save ${key}:`, error);
  }
};

export const readStringUnion = <T extends string>(
  storage: Storage,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const value = storage.getItem(key);
  return value !== null && allowed.includes(value as T) ? value as T : fallback;
};

export const clearStorageKeys = (storage: Storage, keys: readonly string[]): void => {
  for (const key of keys) storage.removeItem(key);
};