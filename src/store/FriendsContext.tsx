import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { useGame, type RelationshipType } from './GameContext';
import { useAuth } from './AuthContext';
import { sounds } from '../utils/audio';
import { ACCEPTED_INVITE_KEY, getChatIdentity, makeFriendInvite, type FriendInvite } from '../utils/friendInvites';

export interface Friend {
  id: string;
  name: string;
  avatarId: string;
  relationshipType: RelationshipType | 'friend';
  isPartner?: boolean;
  addedAt: string;
  lastMessage?: string;
  lastMessageTime?: number;
  linked?: boolean;
  isOnline?: boolean;
  inviteToken?: string;
  unreadCount?: number;
}
export interface DirectMessage {
  id: string;
  friendId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isQuickReaction?: boolean;
  gameInvite?: { roomCode: string; gameTitle?: string };
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
  error?: string;
}
export interface SendResult { ok: boolean; error?: string }
interface FriendsContextType {
  friends: Friend[];
  addFriend: (name: string, avatarId: string, relationshipType: RelationshipType | 'friend', isPartner?: boolean) => Friend;
  removeFriend: (id: string) => void;
  getConversation: (friendId: string) => DirectMessage[];
  sendDirectMessage: (friendId: string, text: string, isQuickReaction?: boolean, gameInvite?: DirectMessage['gameInvite']) => Promise<SendResult>;
  retryDirectMessage: (friendId: string, messageId: string) => Promise<SendResult>;
  createInviteLink: (relationship: FriendInvite['rel']) => string;
  connectionStatus: 'connecting' | 'online' | 'offline' | 'error';
  connectionError: string | null;
  myChatId: string;
  unreadTotal: number;
  activeChatFriendId: string | null;
  setActiveChatFriendId: (id: string | null) => void;
}
const FriendsContext = createContext<FriendsContextType | null>(null);
export const useFriends = () => {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within FriendsProvider');
  return ctx;
};
interface StoredChats { friends: Friend[]; conversations: Record<string, DirectMessage[]>; removedIds?: string[] }
const peerId = (id: string) => `knotyet-chat-${id}`;
const emptyStore = (): StoredChats => ({ friends: [], conversations: {} });
const safeText = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function loadStore(key: string): StoredChats {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(saved?.friends) && saved.conversations && typeof saved.conversations === 'object') {
      return { ...saved, friends: saved.friends.map((friend: Friend) => ({ ...friend, isOnline: false })), conversations: Object.fromEntries(Object.entries(saved.conversations as Record<string, DirectMessage[]>).map(([id, messages]) => [id, messages.map(message => message.status === 'sending' ? { ...message, status: 'sent' } : message)])) };
    }
  } catch { /* A damaged cache must not stop the game. */ }
  return emptyStore();
}

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, partner, setPartner } = useGame();
  const { user } = useAuth();
  const owner = user?.id || 'guest';
  const identity = useMemo(() => getChatIdentity(owner), [owner]);
  const storageKey = `knotyet_chats_v2:${owner}`;
  const [store, setStore] = useState<StoredChats>(() => loadStore(storageKey));
  const storeRef = useRef(store);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [connectionStatus, setConnectionStatus] = useState<FriendsContextType['connectionStatus']>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeChatFriendId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connections = useRef(new Map<string, DataConnection>());
  const ready = useRef(new Set<string>());
  const connectRef = useRef<(friend: Friend) => void>(() => undefined);
  const flushRef = useRef<(friendId: string) => void>(() => undefined);
  const ackTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const updateStore = useCallback((update: (previous: StoredChats) => StoredChats): boolean => {
    const next = update(storeRef.current);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      storeRef.current = next;
      setStore(next);
      return true;
    } catch {
      setConnectionError('This browser could not save your chat. Free some storage and try again.');
      return false;
    }
  }, [storageKey, owner]);

  useEffect(() => {
    const next = loadStore(storageKey);
    // Preserve old manually saved people without pretending their local ID is a reachable account.
    if (!localStorage.getItem(storageKey)) {
      try {
        const legacy = JSON.parse(localStorage.getItem('knotyet_friends_list') || '[]');
        const legacyOwner = localStorage.getItem('knotyet_legacy_friends_owner');
        if (!legacyOwner) localStorage.setItem('knotyet_legacy_friends_owner', owner);
        if (Array.isArray(legacy) && (!legacyOwner || legacyOwner === owner)) next.friends = legacy.map(friend => ({ ...friend, linked: false, isOnline: false, unreadCount: 0 }));
      } catch { /* Ignore damaged legacy data. */ }
    }
    storeRef.current = next;
    setStore(next);
    setActiveId(null);
    activeRef.current = null;
  }, [storageKey, owner]);

  useEffect(() => {
    if (!partner) return;
    updateStore(previous => {
      if (previous.friends.some(friend => friend.isPartner || friend.name.toLowerCase() === partner.name.toLowerCase())) return previous;
      return { ...previous, friends: [{ id: `local-${crypto.randomUUID()}`, name: partner.name, avatarId: partner.avatarId, relationshipType: partner.relationshipType, isPartner: true, addedAt: new Date().toISOString(), linked: false }, ...previous.friends] };
    });
  }, [partner, updateStore]);

  const markMessage = useCallback((friendId: string, messageId: string, status: DirectMessage['status'], error?: string) => {
    updateStore(previous => ({ ...previous, conversations: { ...previous.conversations, [friendId]: (previous.conversations[friendId] || []).map(message => message.id === messageId ? { ...message, status, error } : message) } }));
  }, [updateStore]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connectionTimers = new Set<ReturnType<typeof setTimeout>>();
    const online = (id: string, value: boolean) => updateStore(previous => ({ ...previous, friends: previous.friends.map(friend => friend.id === id ? { ...friend, isOnline: value } : friend) }));

    const flush = (id: string) => {
      const connection = connections.current.get(id);
      if (!connection?.open || !ready.current.has(id)) return;
      for (const message of storeRef.current.conversations[id] || []) {
        if (message.senderId !== identity.id || message.status !== 'sent') continue;
        try {
          connection.send({ type: 'message', message });
          markMessage(id, message.id, 'sending');
          const timer = setTimeout(() => {
            ackTimers.current.delete(message.id);
            markMessage(id, message.id, 'failed', 'Delivery was not confirmed. Tap retry.');
          }, 12000);
          ackTimers.current.set(message.id, timer);
        } catch {
          markMessage(id, message.id, 'failed', 'Connection interrupted. Tap retry.');
        }
      }
    };
    flushRef.current = flush;
    const sendHello = (connection: DataConnection, friend: Friend) => {
      const current = profileRef.current;
      if (!current) return;
      connection.send({ type: 'hello', token: friend.inviteToken, id: identity.id, replyToken: identity.token, name: current.name, avatar: current.avatarId, rel: friend.relationshipType });
    };
    const attach = (connection: DataConnection, expectedFriend?: Friend) => {
      let authenticatedId: string | null = null;
      const timeout = setTimeout(() => { if (!authenticatedId) connection.close(); }, 15000);
      connectionTimers.add(timeout);
      connection.on('open', () => { if (expectedFriend) sendHello(connection, expectedFriend); });
      connection.on('data', raw => {
        if (disposed || !raw || typeof raw !== 'object') return;
        const packet = raw as Record<string, unknown>;
        if (packet.type === 'hello' || packet.type === 'welcome') {
          const id = safeText(packet.id, 36);
          const token = safeText(packet.replyToken, 36);
          const valid = /^[a-f0-9-]{36}$/i.test(id) && /^[a-f0-9-]{36}$/i.test(token) && connection.peer === peerId(id) && id !== identity.id;
          if (!valid || storeRef.current.removedIds?.includes(id) || (packet.type === 'hello' ? packet.token !== identity.token : !expectedFriend || expectedFriend.id !== id || expectedFriend.inviteToken !== token)) { connection.close(); return; }
          const existingConnection = connections.current.get(id);
          if (existingConnection && existingConnection !== connection && existingConnection.open) {
            const preferOutgoing = identity.id < id;
            if (preferOutgoing !== Boolean(expectedFriend)) { connection.close(); return; }
            existingConnection.close();
          }
          authenticatedId = id;
          clearTimeout(timeout);
          connectionTimers.delete(timeout);
          connections.current.set(id, connection);
          ready.current.add(id);
          const relationship = ['friend', 'lover', 'spouse', 'crush', 'bestfriend'].includes(String(packet.rel)) ? packet.rel as FriendInvite['rel'] : 'friend';
          const name = safeText(packet.name, 60) || 'Your friend';
          const avatarId = safeText(packet.avatar, 40) || 'sunny';
          updateStore(previous => {
            const existing = previous.friends.find(friend => friend.id === id);
            const friend: Friend = { ...existing, id, name, avatarId, relationshipType: existing?.relationshipType || relationship, isPartner: relationship === 'lover' || relationship === 'spouse', addedAt: existing?.addedAt || new Date().toISOString(), linked: true, isOnline: true, inviteToken: token };
            return { ...previous, friends: [...previous.friends.filter(item => item.id !== id && !(item.linked !== true && item.name.toLowerCase() === name.toLowerCase())), friend] };
          });
          if (relationship === 'lover' || relationship === 'spouse') setPartner({ name, avatarId, relationshipType: relationship, code: id });
          if (packet.type === 'hello') {
            const current = profileRef.current;
            connection.send({ type: 'welcome', id: identity.id, replyToken: identity.token, name: current?.name || 'Your friend', avatar: current?.avatarId || 'sunny', rel: relationship });
          }
          flush(id);
          return;
        }
        if (!authenticatedId || connections.current.get(authenticatedId) !== connection) return;
        const id = authenticatedId;
        if (packet.type === 'ack' && typeof packet.id === 'string') {
          clearTimeout(ackTimers.current.get(packet.id));
          ackTimers.current.delete(packet.id);
          markMessage(id, packet.id, 'delivered');
        } else if (packet.type === 'message' && packet.message && typeof packet.message === 'object') {
          const incoming = packet.message as Record<string, unknown>;
          const messageId = safeText(incoming.id, 80);
          const text = safeText(incoming.text, 2000);
          if (!messageId || !text) return;
          if ((storeRef.current.conversations[id] || []).some(message => message.id === messageId)) { connection.send({ type: 'ack', id: messageId }); return; }
          const friend = storeRef.current.friends.find(item => item.id === id);
          const invite = incoming.gameInvite as DirectMessage['gameInvite'];
          const gameInvite = invite && /^\d{4,6}$/.test(invite.roomCode) ? { roomCode: invite.roomCode, gameTitle: safeText(invite.gameTitle, 60) } : undefined;
          const message: DirectMessage = { id: messageId, friendId: id, senderId: id, senderName: friend?.name || 'Your friend', senderAvatar: friend?.avatarId || 'sunny', text, timestamp: Date.now(), isQuickReaction: incoming.isQuickReaction === true, gameInvite, status: 'delivered' };
          const saved = updateStore(previous => ({ ...previous, friends: previous.friends.map(item => item.id === id ? { ...item, lastMessage: gameInvite ? `Game invite: Room #${gameInvite.roomCode}` : text, lastMessageTime: message.timestamp, unreadCount: activeRef.current === id ? 0 : (item.unreadCount || 0) + 1 } : item), conversations: { ...previous.conversations, [id]: [...(previous.conversations[id] || []), message].slice(-500) } }));
          if (saved) { connection.send({ type: 'ack', id: messageId }); sounds.playChatPop(); }
        }
      });
      const disconnected = () => {
        clearTimeout(timeout);
        connectionTimers.delete(timeout);
        const id = authenticatedId || expectedFriend?.id;
        if (!id || connections.current.get(id) !== connection) return;
        connections.current.delete(id);
        ready.current.delete(id);
        online(id, false);
        for (const message of storeRef.current.conversations[id] || []) {
          if (message.status === 'sending') {
            clearTimeout(ackTimers.current.get(message.id));
            ackTimers.current.delete(message.id);
            markMessage(id, message.id, 'sent');
          }
        }
      };
      connection.on('close', disconnected);
      connection.on('error', disconnected);
    };
    const connect = (friend: Friend) => {
      if (!friend.linked || !friend.inviteToken || !peerRef.current?.open || connections.current.has(friend.id)) return;
      const connection = peerRef.current.connect(peerId(friend.id), { reliable: true });
      connections.current.set(friend.id, connection);
      attach(connection, friend);
    };
    connectRef.current = connect;
    const start = () => {
      if (disposed) return;
      setConnectionStatus('connecting');
      const peer = new Peer(peerId(identity.id));
      peerRef.current = peer;
      peer.on('open', () => {
        if (disposed) return;
        setConnectionStatus('online');
        setConnectionError(null);
        storeRef.current.friends.forEach(connect);
      });
      peer.on('connection', connection => attach(connection));
      peer.on('disconnected', () => {
        if (disposed) return;
        setConnectionStatus('offline');
        if (!peer.destroyed) peer.reconnect();
      });
      peer.on('error', error => {
        if (disposed) return;
        if (error.type === 'peer-unavailable') {
          // A closed partner app is normal. Keep the saved outbox and retry while this app is open.
          for (const [id, connection] of connections.current) if (!connection.open) { connection.close(); connections.current.delete(id); }
          return;
        }
        setConnectionStatus('error');
        setConnectionError(error.type === 'unavailable-id' ? 'Chat is open in another tab. Keep one KnotYet tab open for messages.' : 'Chat cannot connect right now. Your messages are saved here and will retry.');
        peer.destroy();
        retryTimer = setTimeout(start, 15000);
      });
    };
    start();
    const retry = setInterval(() => storeRef.current.friends.forEach(friend => { connect(friend); flush(friend.id); }), 5000);
    const resume = () => storeRef.current.friends.forEach(connect);
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    return () => {
      disposed = true;
      clearInterval(retry);
      clearTimeout(retryTimer);
      connectionTimers.forEach(clearTimeout);
      ackTimers.current.forEach(clearTimeout);
      ackTimers.current.clear();
      connections.current.forEach(connection => connection.close());
      connections.current.clear();
      ready.current.clear();
      peerRef.current?.destroy();
      peerRef.current = null;
      window.removeEventListener('online', resume);
      window.removeEventListener('focus', resume);
    };
  }, [identity, markMessage, setPartner, updateStore]);

  useEffect(() => {
    if (!profile) return;
    try {
      const invite: FriendInvite | null = JSON.parse(sessionStorage.getItem(ACCEPTED_INVITE_KEY) || 'null');
      if (!invite || invite.id === identity.id) return;
      const friend: Friend = { id: invite.id, name: invite.name, avatarId: invite.avatar, relationshipType: invite.rel, isPartner: invite.rel === 'lover' || invite.rel === 'spouse', addedAt: new Date().toISOString(), linked: true, isOnline: false, inviteToken: invite.token };
      if (updateStore(previous => ({ ...previous, removedIds: previous.removedIds?.filter(id => id !== friend.id), friends: [...previous.friends.filter(item => item.id !== friend.id && !(item.linked !== true && item.name.toLowerCase() === friend.name.toLowerCase())), friend] }))) {
        sessionStorage.removeItem(ACCEPTED_INVITE_KEY);
        connectRef.current(friend);
      }
    } catch { sessionStorage.removeItem(ACCEPTED_INVITE_KEY); }
  }, [profile, identity, updateStore]);

  const addFriend = useCallback((name: string, avatarId: string, relationshipType: FriendInvite['rel'], isPartner = false): Friend => {
    const friend: Friend = { id: `local-${crypto.randomUUID()}`, name: name.trim().slice(0, 60), avatarId, relationshipType, isPartner, addedAt: new Date().toISOString(), linked: false };
    updateStore(previous => ({ ...previous, friends: [...previous.friends, friend] }));
    return friend;
  }, [updateStore]);
  const removeFriend = useCallback((id: string) => {
    const removing = storeRef.current.friends.find(friend => friend.id === id);
    connections.current.get(id)?.close();
    connections.current.delete(id);
    ready.current.delete(id);
    updateStore(previous => {
      const conversations = { ...previous.conversations };
      delete conversations[id];
      return { ...previous, friends: previous.friends.filter(friend => friend.id !== id), conversations, removedIds: [...new Set([...(previous.removedIds || []), id])] };
    });
    if (removing?.isPartner) setPartner(null);
    if (activeRef.current === id) { activeRef.current = null; setActiveId(null); }
  }, [updateStore, setPartner]);
  const setActiveChatFriendId = useCallback((id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    if (id) updateStore(previous => ({ ...previous, friends: previous.friends.map(friend => friend.id === id ? { ...friend, unreadCount: 0 } : friend) }));
  }, [updateStore]);
  const sendDirectMessage = useCallback(async (friendId: string, text: string, isQuickReaction = false, gameInvite?: DirectMessage['gameInvite']): Promise<SendResult> => {
    const friend = storeRef.current.friends.find(item => item.id === friendId);
    if (!friend?.linked) return { ok: false, error: 'Share an invite link to connect this person before chatting.' };
    if (!profile || !text.trim()) return { ok: false, error: 'Write a message first.' };
    if (text.trim().length > 2000) return { ok: false, error: 'Keep messages under 2,000 characters.' };
    const message: DirectMessage = { id: crypto.randomUUID(), friendId, senderId: identity.id, senderName: profile.name, senderAvatar: profile.avatarId, text: text.trim(), timestamp: Date.now(), isQuickReaction, gameInvite, status: 'sent' };
    const saved = updateStore(previous => ({ ...previous, friends: previous.friends.map(item => item.id === friendId ? { ...item, lastMessage: gameInvite ? `Game invite: Room #${gameInvite.roomCode}` : message.text, lastMessageTime: message.timestamp } : item), conversations: { ...previous.conversations, [friendId]: [...(previous.conversations[friendId] || []), message].slice(-500) } }));
    if (!saved) return { ok: false, error: 'Your message could not be saved. Please try again.' };
    connectRef.current(friend);
    flushRef.current(friendId);
    sounds.playChatSent();
    return { ok: true };
  }, [identity, profile, updateStore]);
  const retryDirectMessage = useCallback(async (friendId: string, messageId: string): Promise<SendResult> => {
    const friend = storeRef.current.friends.find(item => item.id === friendId);
    const message = storeRef.current.conversations[friendId]?.find(item => item.id === messageId && item.senderId === identity.id);
    if (!friend?.linked || !message) return { ok: false, error: 'This message is no longer available.' };
    markMessage(friendId, messageId, 'sent');
    connectRef.current(friend);
    flushRef.current(friendId);
    return { ok: true };
  }, [identity, markMessage]);
  const getConversation = useCallback((friendId: string) => store.conversations[friendId] || [], [store.conversations]);
  const createInviteLink = useCallback((relationship: FriendInvite['rel']) => makeFriendInvite(identity, profile || { name: 'Your friend', avatarId: 'sunny' }, relationship), [identity, profile]);

  return <FriendsContext.Provider value={{ friends: store.friends, addFriend, removeFriend, getConversation, sendDirectMessage, retryDirectMessage, createInviteLink, connectionStatus, connectionError, myChatId: identity.id, unreadTotal: store.friends.reduce((total, friend) => total + (friend.unreadCount || 0), 0), activeChatFriendId, setActiveChatFriendId }}>{children}</FriendsContext.Provider>;
};
