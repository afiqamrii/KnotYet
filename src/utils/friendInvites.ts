import type { RelationshipType } from '../store/GameContext';

export interface ChatIdentity { id: string; token: string }
export interface FriendInvite { id: string; token: string; name: string; avatar: string; rel: RelationshipType | 'friend' }
const VALID_ID = /^[a-f0-9-]{36}$/i;
const RELATIONSHIPS = ['friend', 'bestfriend', 'crush', 'lover', 'spouse'];
export const ACCEPTED_INVITE_KEY = 'knotyet_accepted_friend_invite';
export const PENDING_INVITE_KEY = 'knotyet_pending_friend_invite';

// A private invitation pairs these two browser profiles. Never use display names as routing IDs.
export function getChatIdentity(ownerId: string): ChatIdentity {
  const key = `knotyet_chat_identity:${ownerId}`;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    if (stored && VALID_ID.test(stored.id) && VALID_ID.test(stored.token)) return stored;
  } catch { /* Replace damaged identity data. */ }
  const identity = { id: crypto.randomUUID(), token: crypto.randomUUID() };
  localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

export function parseFriendInvite(search: string): FriendInvite | null {
  const query = new URLSearchParams(search);
  const cloudToken = query.get('chat');
  const id = query.get('cid') || 'cloud';
  const token = cloudToken || query.get('key');
  const name = query.get('n')?.trim();
  const rel = query.get('r') || 'friend';
  if (!token || (id !== 'cloud' && !VALID_ID.test(id)) || !VALID_ID.test(token) || !name || !RELATIONSHIPS.includes(rel)) return null;
  return { id, token, name: name.slice(0, 60), avatar: (query.get('a') || 'sunny').slice(0, 40), rel: rel as FriendInvite['rel'] };
}

export function makeFriendInvite(identity: ChatIdentity, profile: { name: string; avatarId: string }, rel: FriendInvite['rel']): string {
  const query = new URLSearchParams({ cid: identity.id, key: identity.token, n: profile.name, a: profile.avatarId, r: rel });
  return `${window.location.origin}/invite?${query}`;
}


