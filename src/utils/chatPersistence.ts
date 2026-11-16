import type { DirectMessage } from '../store/FriendsContext';

export interface OutboxEntry { conversationId: string; message: DirectMessage }
const legacyOutboxKey = (accountId: string) => `knotyet_chat_outbox:v1:${accountId}`;
const outboxPrefix = (accountId: string) => `knotyet_chat_outbox:v2:${encodeURIComponent(accountId)}:`;
const outboxKey = (accountId: string, messageId: string) => `${outboxPrefix(accountId)}${encodeURIComponent(messageId)}`;
const draftKey = (accountId: string, friendId: string) => `knotyet_chat_draft:v1:${accountId}:${friendId}`;

const validEntry = (entry: unknown, accountId: string): entry is OutboxEntry => {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as OutboxEntry;
  const message = value.message;
  return typeof value.conversationId === 'string' && typeof message?.id === 'string'
        && typeof message.friendId === 'string' && message.senderId === accountId
        && typeof message.text === 'string' && message.text.trim().length > 0 && message.text.length <= 2000
        && typeof message.senderName === 'string' && typeof message.senderAvatar === 'string'
        && typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
        && !Number.isNaN(new Date(message.timestamp).valueOf())
        && (!message.gameInvite || (typeof message.gameInvite.roomCode === 'string' && /^\d{4}$/.test(message.gameInvite.roomCode)));
};

/** Recover the older single-array format before using independent message keys. */
function recoverLegacyOutbox(storage: Storage, accountId: string): OutboxEntry[] {
  let entries: OutboxEntry[] = [];
  try {
    const raw = storage.getItem(legacyOutboxKey(accountId));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    entries = Array.isArray(value) ? value.filter(entry => validEntry(entry, accountId)) : [];
    for (const entry of entries) {
      const key = outboxKey(accountId, entry.message.id);
      if (!storage.getItem(key)) storage.setItem(key, JSON.stringify(entry));
    }
    storage.removeItem(legacyOutboxKey(accountId));
  } catch { /* Keep the original array if storage cannot finish recovery. */ }
  return entries;
}

export function readOutbox(accountId: string): OutboxEntry[] {
  if (!accountId) return [];
  try {
    const storage = localStorage;
    const entries = new Map(recoverLegacyOutbox(storage, accountId).map(entry => [entry.message.id, entry]));
    const prefix = outboxPrefix(accountId);
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        const value: unknown = JSON.parse(storage.getItem(key) || 'null');
        if (validEntry(value, accountId) && key === outboxKey(accountId, value.message.id)) entries.set(value.message.id, value);
      } catch { /* One damaged message must not hide the rest of the outbox. */ }
    }
    return [...entries.values()].map(entry => ({ ...entry, message: { ...entry.message, status: 'failed', error: 'Not confirmed before this page closed. Retry safely using the same message.' } }));
  } catch { return []; }
}

/** Store only unconfirmed outgoing messages, never downloaded transcripts. */
export function saveOutboxMessage(accountId: string, entry: OutboxEntry): boolean {
  if (!accountId || !validEntry(entry, accountId)) return false;
  try {
    const entries = readOutbox(accountId).filter(item => item.message.id !== entry.message.id);
    if (entries.length >= 100) return false;
    // Independent keys prevent one tab's send/ack from overwriting another
    // tab's messages between a read and a write of the former shared array.
    localStorage.setItem(outboxKey(accountId, entry.message.id), JSON.stringify(entry));
    return true;
  } catch { return false; }
}

export function removeOutboxMessage(accountId: string, messageId: string): void {
  if (!accountId) return;
  try {
    recoverLegacyOutbox(localStorage, accountId);
    localStorage.removeItem(outboxKey(accountId, messageId));
  } catch { /* Message still remains retryable if storage is unavailable. */ }
}

export function removeConversationOutbox(accountId: string, friendId: string): void {
  for (const entry of readOutbox(accountId)) {
    if (entry.message.friendId === friendId) removeOutboxMessage(accountId, entry.message.id);
  }
  writeChatDraft(accountId, friendId, '');
}

export function readChatDraft(accountId: string, friendId: string): string {
  if (!accountId || !friendId) return '';
  try { return (localStorage.getItem(draftKey(accountId, friendId)) || '').slice(0, 500); }
  catch { return ''; }
}

export function writeChatDraft(accountId: string, friendId: string, text: string): void {
  if (!accountId || !friendId) return;
  try {
    if (text) localStorage.setItem(draftKey(accountId, friendId), text.slice(0, 500));
    else localStorage.removeItem(draftKey(accountId, friendId));
  } catch { /* Draft stays in component memory when browser storage is blocked. */ }
}
