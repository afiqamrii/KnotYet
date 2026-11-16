import type { MultiplayerMessage } from '../store/MultiplayerContext';
import { isChoiceRound } from './choiceGame';
import { validateNumberSnapshot } from './numberSession';
import { validateLetterSnapshot } from './letterSession';
import { validateSecretRaceState } from './secretRaceSession';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.length <= max;
const id = (value: unknown): value is string => text(value, 200) && value.length > 0;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const game = (value: unknown) => ['lobby', 'swipe', 'quiz', 'wheel', 'match', 'number', 'letter', 'secret-race', 'choices'].includes(value as string);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 500 && value.every(id) && new Set(value).size === value.length;
const equation = (value: unknown) => record(value) && integer(value.hostNumber, 1, 20) && integer(value.partnerNumber, 1, 20) && integer(value.answer, -400, 400);

/** Peer packets are runtime input, even when our sender is typed. Reject an
 * incompatible/malformed packet before it reaches state or game subscribers. */
export function isMultiplayerMessage(value: unknown): value is MultiplayerMessage {
  if (!record(value) || typeof value.type !== 'string') return false;
  const p = value.payload;
  switch (value.type) {
    case 'PROFILE_SYNC': return record(p) && text(p.name) && text(p.avatarId) && finite(p.heartPoints) && (p.accountId === undefined || text(p.accountId, 128));
    case 'SET_GAME': return game(p);
    case 'SWIPE_REQUEST': return record(p) && ['left', 'right'].includes(p.direction as string) && id(p.cardId);
    case 'SWIPE_ACTION': return record(p) && ['left', 'right'].includes(p.direction as string) && (p.cardId === undefined || id(p.cardId));
    case 'SWIPE_FLIP': return typeof p === 'boolean';
    case 'CARD_SUBMIT': return text(p) || (record(p) && id(p.cardId) && text(p.answer));
    case 'RIDDLE_REVEAL': return p === undefined || (record(p) && id(p.cardId));
    case 'CHOICES_STATE': return record(p) && ids(p.ids) && isChoiceRound(p, new Set(p.ids));
    case 'CHOICES_PICK': return record(p) && id(p.roundId) && (p.choice === 0 || p.choice === 1);
    case 'QUIZ_ACTUAL': case 'QUIZ_GUESS': case 'MATCH_SELECT': return text(p);
    case 'SPIN_WHEEL': return record(p) && finite(p.rotation) && integer(p.segmentIndex, 0, 100) && integer(p.promptIndex, 0, 500);
    case 'WHEEL_SUBMIT': return record(p) && id(p.spinKey) && text(p.answer);
    case 'WHEEL_DISMISS': return record(p) && id(p.spinKey);
    case 'SYNC_QUESTION_IDS': return record(p) && game(p.game) && ids(p.questionIds) && (p.currentIndex === undefined || integer(p.currentIndex, 0, p.questionIds.length));
    case 'MATCH_RESTART': case 'QUIZ_RESTART': return p === undefined || (record(p) && (p.questionIds === undefined || ids(p.questionIds)));
    case 'NUM_SET_SECRET': return integer(p, 1, 100);
    case 'NUM_GUESS': return integer(p, 1, 100) || (record(p) && integer(p.val, 1, 100) && (p.name === undefined || text(p.name)) && (p.round === undefined || integer(p.round, 1)));
    case 'NUM_STATE': return validateNumberSnapshot(p);
    case 'SECRET_RACE_START': case 'SECRET_RACE_STATE': case 'SECRET_RACE_RESULT': return validateSecretRaceState(p);
    case 'SECRET_RACE_LOCK': return record(p) && id(p.matchId) && integer(p.number, 1, 20);
    case 'SECRET_RACE_GO': return record(p) && id(p.matchId) && equation(p.equation);
    case 'SECRET_RACE_ANSWER': return record(p) && id(p.matchId) && integer(p.answer, Number.MIN_SAFE_INTEGER);
    case 'SECRET_RACE_WRONG': return record(p) && id(p.matchId) && integer(p.delayMs, 0, 60000);
    case 'SECRET_RACE_NEXT': case 'SECRET_RACE_RESTART': return record(p) && id(p.matchId);
    case 'LETTER_START': return (text(p, 1) && /^[A-Z]$/.test(p)) || (record(p) && text(p.letter, 1) && /^[A-Z]$/.test(p.letter) && id(p.roundId));
    case 'LETTER_WORD_SUBMIT': return text(p, 100) || (record(p) && text(p.word, 100) && id(p.roundId));
    case 'LETTER_RESULT': return record(p) && text(p.name) && text(p.word, 100) && id(p.roundId);
    case 'LETTER_STATE': return validateLetterSnapshot(p);
    case 'START_GAME': return record(p) && game(p.game) && (p.questionIds === undefined || ids(p.questionIds));
    case 'START_COUNTDOWN': return record(p) && game(p.game);
    case 'CHAT_MESSAGE': return record(p) && id(p.id) && text(p.senderId, 200) && text(p.senderName) && text(p.senderAvatar) && text(p.text) && !!p.text.trim() && integer(p.timestamp) && p.timestamp <= 8640000000000000 && (p.isQuickReaction === undefined || typeof p.isQuickReaction === 'boolean');
    case 'CHAT_TYPING': return record(p) && typeof p.isTyping === 'boolean';
    case 'CHOICES_REQUEST': case 'QUIZ_NEXT': case 'MATCH_NEXT': case 'NUM_NEXT': case 'NUM_REQUEST': case 'SECRET_RACE_REQUEST': case 'LETTER_NEXT': case 'LETTER_REQUEST': case 'END_GAME': case 'LEAVE_ROOM': return true;
    default: return false;
  }
}
