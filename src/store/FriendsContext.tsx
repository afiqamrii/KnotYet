import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useGame, type RelationshipType } from './GameContext';
import { supabase } from '../lib/supabase';
import { sounds } from '../utils/audio';
import type { FriendInvite } from '../utils/friendInvites';
import { readOutbox, saveOutboxMessage, removeOutboxMessage, removeConversationOutbox } from '../utils/chatPersistence';

export interface Friend {
  id: string;
  conversationId?: string;
  name: string;
  avatarId: string;
  relationshipType: RelationshipType | 'friend';
  isPartner?: boolean;
  addedAt: string;
  lastMessage?: string;
  lastMessageTime?: number;
  linked?: boolean;
  isOnline?: boolean;
  unreadCount?: number;
  peerLastReadAt?: string | null;
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
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
}

export interface SendResult { ok: boolean; error?: string; queued?: boolean }
export interface ConversationHistory { hasMore: boolean; loading: boolean; error?: string }
interface ChatState { friends: Friend[]; conversations: Record<string, DirectMessage[]> }
interface FriendsApi {
  friends: Friend[];
  addFriend: (name: string, avatarId: string, rel: RelationshipType | 'friend', isPartner?: boolean) => Friend;
  removeFriend: (id: string) => Promise<void>;
  getConversation: (id: string) => DirectMessage[];
  sendDirectMessage: (id: string, text: string, quick?: boolean, game?: DirectMessage['gameInvite']) => Promise<SendResult>;
  retryDirectMessage: (id: string, messageId: string) => Promise<SendResult>;
  createInviteLink: (rel: FriendInvite['rel']) => Promise<string>;
  refreshContacts: () => Promise<void>;
  contactsLoading: boolean;
  outboxWarning: string | null;
  getHistoryState: (id: string) => ConversationHistory;
  loadOlderMessages: (id: string) => Promise<void>;
  discardFailedMessage: (friendId: string, messageId: string) => void;
  connectionStatus: 'connecting' | 'online' | 'offline' | 'error';
  connectionError: string | null;
  myChatId: string;
  unreadTotal: number;
  activeChatFriendId: string | null;
  setActiveChatFriendId: (id: string | null) => void;
}

interface ContactRow { conversation_id: string; friend_id: string; friend_name: string; friend_avatar: string; relationship_type: FriendInvite['rel']; last_read_at: string | null }
interface MemberRow { conversation_id: string; user_id: string; last_read_at: string | null }
interface MessageRow { id: string; conversation_id: string; sender_id: string; body: string; metadata: Record<string, unknown> | null; client_created_at: string; created_at: string }

const FriendsContext = createContext<FriendsApi | null>(null);
export const useFriends = () => {
  const value = useContext(FriendsContext);
  if (!value) throw new Error('useFriends must be used within FriendsProvider');
  return value;
};

const blank = (): ChatState => ({ friends: [], conversations: {} });
const HISTORY_PAGE_SIZE = 50;
const emptyHistory: ConversationHistory = { hasMore: false, loading: false };
const preview = (message: DirectMessage) => message.gameInvite ? `Game invite: Room #${message.gameInvite.roomCode}` : message.text;
const isReadByPeer = (message: DirectMessage, peerLastReadAt?: string | null) => {
  const readAt = peerLastReadAt ? Date.parse(peerLastReadAt) : Number.NaN;
  return Number.isFinite(readAt) && message.timestamp <= readAt;
};

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { profile, setPartner } = useGame();
  const [chat, setChat] = useState<ChatState>(blank);
  const chatRef = useRef(chat);
  const [connectionStatus, setStatus] = useState<FriendsApi['connectionStatus']>('connecting');
  const [connectionError, setError] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [outboxWarning, setOutboxWarning] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ConversationHistory>>({});
  const cursors = useRef<Record<string, { createdAt: string; id: string; conversationId: string }>>({});
  const latestWindows = useRef<Record<string, { conversationId: string; ids: string[] }>>({});
  const historyRequests = useRef(new Set<string>());
  const sendingIds = useRef(new Set<string>());
  const [activeChatFriendId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const loading = useRef<symbol | null>(null);
  const accountVersion = useRef(0);
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;

  const update = useCallback((fn: (value: ChatState) => ChatState) => {
    setChat(current => {
      const next = fn(current);
      chatRef.current = next;
      return next;
    });
  }, []);

  const convert = useCallback((row: MessageRow, friend: Friend): DirectMessage => {
    const metadata = row.metadata || {};
    const gameInvite = metadata.gameInvite as DirectMessage['gameInvite'];
    const timestamp = Date.parse(row.created_at || row.client_created_at);
    const mine = row.sender_id === user?.id;
    return {
      id: row.id,
      friendId: friend.id,
      senderId: row.sender_id,
      senderName: mine ? profile?.name || 'You' : friend.name,
      senderAvatar: mine ? profile?.avatarId || 'sunny' : friend.avatarId,
      text: row.body,
      timestamp,
      isQuickReaction: metadata.isQuickReaction === true,
      gameInvite: gameInvite?.roomCode ? gameInvite : undefined,
      status: mine && isReadByPeer({ timestamp } as DirectMessage, friend.peerLastReadAt) ? 'read' : mine ? 'sent' : 'delivered',
    };
  }, [profile, user?.id]);

  const markConversationRead = useCallback((friend: Friend) => {
    if (!user || accountRef.current !== user.id || !friend.conversationId || document.visibilityState === 'hidden') return;
    update(current => ({ ...current, friends: current.friends.map(item => item.id === friend.id ? { ...item, unreadCount: 0 } : item) }));
    const readAt = new Date().toISOString();
    void supabase
      .from('chat_members')
      .update({ last_read_at: readAt })
      .eq('conversation_id', friend.conversationId)
      .eq('user_id', user.id)
      .select('last_read_at')
      .maybeSingle()
      .then(({ data, error }) => {
        if (accountRef.current !== user.id) return;
        if (error || !data) {
          setError('Read receipts are reconnecting. Your messages are still safe.');
        }
      });
  }, [update, user]);

  const refreshContacts = useCallback(async (silent = false) => {
    if (!user || loading.current) return;
    const accountId = user.id;
    const version = accountVersion.current;
    const request = Symbol('contacts');
    const isCurrent = () => accountRef.current === accountId && accountVersion.current === version;
    loading.current = request;
    if (!silent) setContactsLoading(true);
    if (!silent) setStatus('connecting');
    try {
      const contactsResult = await supabase.rpc('list_chat_contacts');
      if (!isCurrent()) return;
      if (contactsResult.error) throw contactsResult.error;
      const rows = (contactsResult.data || []) as ContactRow[];
      const baseFriends = rows.map(row => ({
        id: row.friend_id,
        conversationId: row.conversation_id,
        name: row.friend_name || 'Your friend',
        avatarId: row.friend_avatar || 'sunny',
        relationshipType: row.relationship_type || 'friend',
        isPartner: ['lover', 'spouse'].includes(row.relationship_type),
        addedAt: new Date().toISOString(),
        linked: true,
        // A saved contact is not evidence that their browser is online.
        isOnline: undefined,
        unreadCount: 0,
      }));
      const conversationIds = baseFriends.map(friend => friend.conversationId!);
      const membersResult = conversationIds.length
        ? await supabase.from('chat_members').select('conversation_id,user_id,last_read_at').in('conversation_id', conversationIds).neq('user_id', user.id)
        : { data: [], error: null };
      const members = membersResult.error ? [] : (membersResult.data || []) as MemberRow[];
      if (!isCurrent()) return;
      const friends = baseFriends.map(friend => ({
        ...friend,
        peerLastReadAt: members.find(member => member.conversation_id === friend.conversationId && member.user_id === friend.id)?.last_read_at ?? null,
      }));

      const pages = new Map<string, MessageRow[]>();
      const pageHasMore = new Map<string, boolean>();
      const unreadCounts = new Map<string, number>();
      // Each conversation gets its own window, so an active thread cannot hide
      // another person's messages. Bound concurrent requests for larger circles.
      for (let offset = 0; offset < friends.length; offset += 4) {
        await Promise.all(friends.slice(offset, offset + 4).map(async friend => {
          const ownReadAt = rows.find(row => row.friend_id === friend.id)?.last_read_at;
          let unreadQuery = supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', friend.conversationId).neq('sender_id', user.id);
          if (ownReadAt) unreadQuery = unreadQuery.gt('created_at', ownReadAt);
          const [messagesResult, unreadResult] = await Promise.all([
            supabase.from('chat_messages').select('*').eq('conversation_id', friend.conversationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(HISTORY_PAGE_SIZE + 1),
            unreadQuery,
          ]);
          if (!isCurrent()) return;
          if (messagesResult.error) throw messagesResult.error;
          const page = (messagesResult.data || []) as MessageRow[];
          const newest = page.slice(0, HISTORY_PAGE_SIZE).reverse();
          pages.set(friend.id, newest);
          pageHasMore.set(friend.id, page.length > HISTORY_PAGE_SIZE);
          if (!unreadResult.error && typeof unreadResult.count === 'number') unreadCounts.set(friend.id, unreadResult.count);
        }));
        if (!isCurrent()) return;
      }
      const restoredOutbox = readOutbox(accountId);
      const conversations: Record<string, DirectMessage[]> = {};
      const hydrated = friends.map(friend => {
        const page = pages.get(friend.id) || [];
        const previousWindow = latestWindows.current[friend.id];
        const hasGap = pageHasMore.get(friend.id) && previousWindow?.conversationId === friend.conversationId
          && !page.some(message => previousWindow.ids.includes(message.id));
        // A whole page can arrive while this tab sleeps. Re-anchor pagination
        // at the newest window so the missing middle remains reachable.
        if (cursors.current[friend.id]?.conversationId !== friend.conversationId || hasGap) {
          const oldest = page[0];
          if (oldest) cursors.current[friend.id] = { createdAt: oldest.created_at, id: oldest.id, conversationId: friend.conversationId };
          else delete cursors.current[friend.id];
          setHistory(current => ({ ...current, [friend.id]: { hasMore: Boolean(pageHasMore.get(friend.id)), loading: false } }));
        }
        latestWindows.current[friend.id] = { conversationId: friend.conversationId, ids: page.map(message => message.id) };
        const messages = page.map(row => convert(row, friend));
        for (const message of messages) if (message.senderId === accountId) removeOutboxMessage(accountId, message.id);
        conversations[friend.id] = messages;
        const ownReadAt = rows.find(row => row.friend_id === friend.id)?.last_read_at;
        const last = messages[messages.length - 1];
        return {
          ...friend,
          lastMessage: last && preview(last),
          lastMessageTime: last?.timestamp,
          unreadCount: unreadCounts.get(friend.id) ?? messages.filter(message => message.senderId !== user.id && message.timestamp > (ownReadAt ? Date.parse(ownReadAt) : 0)).length,
        };
      });
      update(current => {
        if (!isCurrent()) return current;
        // Polling may finish while a send or realtime INSERT is in flight.
        // Keep those messages (including failed sends and their Retry action)
        // until the server acknowledges the same id.
        for (const friend of hydrated) {
          const cloudMessages = conversations[friend.id];
          const sameConversation = current.friends.some(item => item.id === friend.id && item.conversationId === friend.conversationId);
          const previousMessages = sameConversation ? current.conversations[friend.id] || [] : [];
          const restored = restoredOutbox.filter(entry => entry.conversationId === friend.conversationId && entry.message.friendId === friend.id).map(entry => entry.message);
          const merged = new Map([...restored, ...previousMessages].map(message => [message.id, message]));
          for (const message of cloudMessages) {
            const previous = merged.get(message.id);
            merged.set(message.id, previous?.status === 'read' ? { ...message, status: 'read' } : message);
          }
          conversations[friend.id] = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
          const last = conversations[friend.id][conversations[friend.id].length - 1];
          friend.lastMessage = last && preview(last);
          friend.lastMessageTime = last?.timestamp;
        }
        return { friends: hydrated, conversations };
      });
      const partner = hydrated.find(friend => friend.isPartner);
      if (partner) setPartner({ name: partner.name, avatarId: partner.avatarId, relationshipType: partner.relationshipType as RelationshipType, code: partner.id });
      const openFriend = hydrated.find(friend => friend.id === activeRef.current && friend.unreadCount > 0);
      if (openFriend) markConversationRead(openFriend);
      setStatus('online');
      setError(null);
    } catch {
      if (isCurrent() && !silent) {
        setStatus(navigator.onLine ? 'error' : 'offline');
        setError('Cloud chat could not sync. Reconnect and try again.');
      }
    } finally {
      if (loading.current === request) { loading.current = null; setContactsLoading(false); }
    }
  }, [convert, markConversationRead, setPartner, update, user]);

  useEffect(() => {
    loading.current = null;
    cursors.current = {};
    latestWindows.current = {};
    historyRequests.current = new Set();
    sendingIds.current = new Set();
    setHistory({});
    setOutboxWarning(null);
    setContactsLoading(Boolean(user));
    chatRef.current = blank();
    setChat(blank());
    activeRef.current = null;
    setActiveId(null);
    setError(null);
    setStatus(user ? 'connecting' : 'offline');
    return () => { loading.current = null; accountVersion.current += 1; };
  }, [user?.id]);

  useEffect(() => { void refreshContacts(); }, [refreshContacts]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const channel = supabase.channel(`cloud-chat:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        if (!active || accountRef.current !== user.id) return;
        const row = payload.new as MessageRow;
        const friend = chatRef.current.friends.find(item => item.conversationId === row.conversation_id);
        if (!friend) { void refreshContacts(); return; }
        const message = convert(row, friend);
        if (message.senderId === user.id) removeOutboxMessage(user.id, message.id);
        update(current => {
          const oldMessages = current.conversations[friend.id] || [];
          const duplicate = oldMessages.some(item => item.id === message.id);
          const messages = oldMessages.some(item => item.id === message.id) ? oldMessages.map(item => item.id === message.id ? { ...message, status: item.status === 'read' ? 'read' : message.status } : item) : [...oldMessages, message];
          return {
            friends: current.friends.map(item => item.id === friend.id ? {
              ...item,
              lastMessage: preview(message),
              lastMessageTime: message.timestamp,
              unreadCount: !duplicate && message.senderId !== user.id && (activeRef.current !== friend.id || document.visibilityState === 'hidden') ? (item.unreadCount || 0) + 1 : item.unreadCount,
            } : item),
            conversations: { ...current.conversations, [friend.id]: messages.sort((a, b) => a.timestamp - b.timestamp) },
          };
        });
        if (message.senderId !== user.id) {
          sounds.playChatPop();
          if (activeRef.current === friend.id) markConversationRead(friend);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members' }, payload => {
        if (!active || accountRef.current !== user.id) return;
        const member = payload.new as MemberRow;
        if (member.user_id === user.id) return;
        const friend = chatRef.current.friends.find(item => item.conversationId === member.conversation_id && item.id === member.user_id);
        if (!friend) return;
        update(current => ({
          friends: current.friends.map(item => item.id === friend.id ? { ...item, peerLastReadAt: member.last_read_at } : item),
          conversations: {
            ...current.conversations,
            [friend.id]: (current.conversations[friend.id] || []).map(message => message.senderId === user.id && isReadByPeer(message, member.last_read_at) ? { ...message, status: 'read', error: undefined } : message),
          },
        }));
      })
      .subscribe(status => {
        if (!active || accountRef.current !== user.id) return;
        if (status === 'SUBSCRIBED') { setStatus('online'); setError(null); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { setStatus('error'); setError('Live updates paused. Reconnecting your chat now.'); }
      });
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      const friend = chatRef.current.friends.find(item => item.id === activeRef.current);
      if (friend) markConversationRead(friend);
      void refreshContacts();
    };
    // Realtime remains the primary path. This quiet safety sync keeps a thread
    // current through short laptop sleeps or a dropped WebSocket reconnect.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden' && navigator.onLine) void refreshContacts(true);
    }, 4_000);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      void supabase.removeChannel(channel);
    };
  }, [convert, markConversationRead, refreshContacts, update, user]);

  const addFriend = useCallback((name: string, avatarId: string, relationshipType: FriendInvite['rel'], isPartner = false) => {
    const friend: Friend = { id: `saved-${crypto.randomUUID()}`, name: name.trim(), avatarId, relationshipType, isPartner, addedAt: new Date().toISOString(), linked: false };
    update(current => ({ ...current, friends: [...current.friends, friend] }));
    return friend;
  }, [update]);

  const loadOlderMessages = useCallback(async (friendId: string) => {
    const friend = chatRef.current.friends.find(item => item.id === friendId);
    const cursor = cursors.current[friendId];
    const accountId = user?.id;
    const version = accountVersion.current;
    if (!accountId || !friend?.conversationId || !cursor || cursor.conversationId !== friend.conversationId || historyRequests.current.has(friendId)) return;
    const requests = historyRequests.current;
    const isCurrent = () => accountRef.current === accountId && accountVersion.current === version
      && chatRef.current.friends.some(item => item.id === friendId && item.conversationId === friend.conversationId);
    requests.add(friendId);
    setHistory(current => ({ ...current, [friendId]: { ...current[friendId], hasMore: true, loading: true, error: undefined } }));
    try {
      const result = await supabase.from('chat_messages').select('*').eq('conversation_id', friend.conversationId)
        .or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(HISTORY_PAGE_SIZE + 1);
      if (!isCurrent() || cursors.current[friendId] !== cursor) return;
      if (result.error) throw result.error;
      const page = (result.data || []) as MessageRow[];
      const older = page.slice(0, HISTORY_PAGE_SIZE).reverse();
      if (older.length) cursors.current[friendId] = { createdAt: older[0].created_at, id: older[0].id, conversationId: friend.conversationId };
      update(current => {
        if (!isCurrent()) return current;
        const messages = new Map(older.map(row => { const message = convert(row, friend); return [message.id, message] as const; }));
        for (const message of current.conversations[friendId] || []) messages.set(message.id, message);
        return { ...current, conversations: { ...current.conversations, [friendId]: [...messages.values()].sort((a, b) => a.timestamp - b.timestamp) } };
      });
      setHistory(current => ({ ...current, [friendId]: { hasMore: page.length > HISTORY_PAGE_SIZE, loading: false } }));
    } catch {
      if (isCurrent() && cursors.current[friendId] === cursor) setHistory(current => ({ ...current, [friendId]: { hasMore: true, loading: false, error: 'Older messages could not load. Try again.' } }));
    } finally { requests.delete(friendId); }
  }, [convert, update, user?.id]);

  const discardFailedMessage = useCallback((friendId: string, messageId: string) => {
    const message = chatRef.current.conversations[friendId]?.find(item => item.id === messageId);
    if (!user || message?.senderId !== user.id || message.status !== 'failed') return;
    removeOutboxMessage(user.id, messageId);
    update(current => ({ ...current, conversations: { ...current.conversations, [friendId]: (current.conversations[friendId] || []).filter(item => item.id !== messageId) } }));
  }, [update, user]);

  const removeFriend = useCallback(async (id: string) => {
    const accountId = user?.id;
    const friend = chatRef.current.friends.find(item => item.id === id);
    if (friend?.conversationId) {
      const result = await supabase.rpc('leave_chat_conversation', { target_conversation: friend.conversationId });
      if (result.error) throw result.error;
    }
    if (!accountId || accountRef.current !== accountId) return;
    accountVersion.current += 1;
    loading.current = null;
    setContactsLoading(false);
    delete cursors.current[id];
    delete latestWindows.current[id];
    setHistory(current => { const next = { ...current }; delete next[id]; return next; });
    removeConversationOutbox(accountId, id);
    update(current => {
      const conversations = { ...current.conversations };
      delete conversations[id];
      return { friends: current.friends.filter(item => item.id !== id), conversations };
    });
    if (friend?.isPartner) setPartner(null);
  }, [setPartner, update, user?.id]);

  const setActiveChatFriendId = useCallback((id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    if (!id) return;
    const friend = chatRef.current.friends.find(item => item.id === id);
    if (friend) markConversationRead(friend);
  }, [markConversationRead]);

  const persist = useCallback(async (friend: Friend, message: DirectMessage) => {
    if (!user || accountRef.current !== user.id || !friend.conversationId) return new Error('Not connected');
    // Quick replies are regular text messages with metadata. This keeps them
    // compatible with existing database message-type constraints.
    try {
    const result = await supabase.from('chat_messages').upsert({
      id: message.id,
      conversation_id: friend.conversationId,
      sender_id: user.id,
      body: message.text,
      message_type: message.gameInvite ? 'game_invite' : 'text',
      metadata: { isQuickReaction: message.isQuickReaction === true, ...(message.gameInvite ? { gameInvite: message.gameInvite } : {}) },
      client_created_at: new Date(message.timestamp).toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });
    return result.error;
    } catch {
      return new Error('Message was not saved. Please retry.');
    }
  }, [user]);

  const sendDirectMessage = useCallback(async (friendId: string, text: string, isQuickReaction = false, gameInvite?: DirectMessage['gameInvite']): Promise<SendResult> => {
    const friend = chatRef.current.friends.find(item => item.id === friendId);
    const body = text.trim();
    if (!user || !friend?.conversationId) return { ok: false, error: 'Accept a cloud invite before chatting.' };
    if (!body) return { ok: false, error: 'Write a message first.' };
    if (body.length > 2_000) return { ok: false, error: 'Keep messages under 2,000 characters.' };
    const message: DirectMessage = { id: crypto.randomUUID(), friendId, senderId: user.id, senderName: profile?.name || 'You', senderAvatar: profile?.avatarId || 'sunny', text: body, timestamp: Date.now(), isQuickReaction, gameInvite, status: 'sending' };
    if (!saveOutboxMessage(user.id, { conversationId: friend.conversationId, message })) setOutboxWarning('This browser could not save your outbox. Keep this page open until messages are sent.');
    sendingIds.current.add(message.id);
    update(current => ({
      friends: current.friends.map(item => item.id === friendId ? { ...item, lastMessage: preview(message), lastMessageTime: message.timestamp } : item),
      conversations: { ...current.conversations, [friendId]: [...(current.conversations[friendId] || []), message] },
    }));
    const error = await persist(friend, message);
    sendingIds.current.delete(message.id);
    if (!error) removeOutboxMessage(user.id, message.id);
    if (accountRef.current !== user.id) return { ok: false, error: 'Your account changed. Please reopen the conversation.' };
    update(current => ({
      ...current,
      conversations: {
        ...current.conversations,
        [friendId]: (current.conversations[friendId] || []).map(item => item.id === message.id ? { ...item, status: item.status === 'read' ? 'read' : error ? 'failed' : 'sent', error: error && item.status !== 'read' ? 'Not saved to cloud. Tap retry.' : undefined } : item),
      },
    }));
    if (error) return { ok: false, queued: true, error: navigator.onLine ? 'Message not confirmed. Use Retry beside the message.' : 'Message waiting in your outbox. Reconnect, then tap Retry.' };
    sounds.playChatSent();
    return { ok: true };
  }, [persist, profile, update, user]);

  const retryDirectMessage = useCallback(async (friendId: string, messageId: string): Promise<SendResult> => {
    const accountId = user?.id;
    const friend = chatRef.current.friends.find(item => item.id === friendId);
    const message = chatRef.current.conversations[friendId]?.find(item => item.id === messageId);
    if (!accountId || !friend || !message || message.senderId !== accountId) return { ok: false, error: 'Message unavailable.' };
    if (sendingIds.current.has(messageId)) return { ok: false, error: 'This message is already sending.' };
    if (!friend.conversationId) return { ok: false, error: 'Reconnect with this person before retrying.' };
    sendingIds.current.add(messageId);
    if (!saveOutboxMessage(accountId, { conversationId: friend.conversationId, message })) setOutboxWarning('This browser could not save your outbox. Keep this page open until messages are sent.');
    update(current => ({ ...current, conversations: { ...current.conversations, [friendId]: (current.conversations[friendId] || []).map(item => item.id === messageId ? { ...item, status: 'sending', error: undefined } : item) } }));
    const error = await persist(friend, message);
    sendingIds.current.delete(messageId);
    if (!error) removeOutboxMessage(accountId, messageId);
    if (accountRef.current !== accountId) return { ok: false, error: 'Your account changed. Please reopen the conversation.' };
    update(current => ({
      ...current,
      conversations: { ...current.conversations, [friendId]: (current.conversations[friendId] || []).map(item => item.id === messageId ? { ...item, status: item.status === 'read' ? 'read' : error ? 'failed' : 'sent', error: error && item.status !== 'read' ? 'Not saved to cloud. Tap retry.' : undefined } : item) },
    }));
    return error ? { ok: false, error: 'Message was not saved. Please retry.' } : { ok: true };
  }, [persist, update, user?.id]);

  const createInviteLink = useCallback(async (relationship: FriendInvite['rel']) => {
    if (!user || !profile) throw new Error('Sign in first');
    const result = await supabase.rpc('create_chat_invite', { display_name: profile.name, avatar_id: profile.avatarId, relationship });
    if (result.error) throw result.error;
    const token = (result.data as { token: string }[])?.[0]?.token;
    if (!token) throw new Error('Invite unavailable');
    return `${window.location.origin}/invite?${new URLSearchParams({ chat: token, n: profile.name, a: profile.avatarId, r: relationship })}`;
  }, [profile, user]);

  const value: FriendsApi = {
    friends: chat.friends,
    addFriend,
    removeFriend,
    getConversation: id => chat.conversations[id] || [],
    sendDirectMessage,
    retryDirectMessage,
    createInviteLink,
    refreshContacts,
    contactsLoading,
    outboxWarning,
    getHistoryState: id => history[id] || emptyHistory,
    loadOlderMessages,
    discardFailedMessage,
    connectionStatus,
    connectionError,
    myChatId: user?.id || '',
    unreadTotal: chat.friends.reduce((sum, friend) => sum + (friend.unreadCount || 0), 0),
    activeChatFriendId,
    setActiveChatFriendId,
  };

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
};
