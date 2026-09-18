import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useGame, type RelationshipType } from './GameContext';
import { supabase } from '../lib/supabase';
import { sounds } from '../utils/audio';
import type { FriendInvite } from '../utils/friendInvites';

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

export interface SendResult { ok: boolean; error?: string }
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
  const [activeChatFriendId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const loading = useRef(false);

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
    if (!user || !friend.conversationId) return;
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
        if (error || !data) {
          setError('Read receipts are reconnecting. Your messages are still safe.');
        }
      });
  }, [update, user]);

  const refreshContacts = useCallback(async (silent = false) => {
    if (!user || loading.current) return;
    loading.current = true;
    if (!silent) setStatus('connecting');
    try {
      const contactsResult = await supabase.rpc('list_chat_contacts');
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
        isOnline: true,
        unreadCount: 0,
      }));
      const conversationIds = baseFriends.map(friend => friend.conversationId!);
      const membersResult = conversationIds.length
        ? await supabase.from('chat_members').select('conversation_id,user_id,last_read_at').in('conversation_id', conversationIds).neq('user_id', user.id)
        : { data: [], error: null };
      const members = membersResult.error ? [] : (membersResult.data || []) as MemberRow[];
      const friends = baseFriends.map(friend => ({
        ...friend,
        peerLastReadAt: members.find(member => member.conversation_id === friend.conversationId && member.user_id === friend.id)?.last_read_at ?? null,
      }));

      let messageRows: MessageRow[] = [];
      if (conversationIds.length) {
        const messagesResult = await supabase.from('chat_messages').select('*').in('conversation_id', conversationIds).order('created_at').limit(1000);
        if (messagesResult.error) throw messagesResult.error;
        messageRows = (messagesResult.data || []) as MessageRow[];
      }
      const conversations: Record<string, DirectMessage[]> = {};
      const hydrated = friends.map(friend => {
        const messages = messageRows.filter(row => row.conversation_id === friend.conversationId).map(row => convert(row, friend));
        conversations[friend.id] = messages;
        const ownReadAt = rows.find(row => row.friend_id === friend.id)?.last_read_at;
        const last = messages[messages.length - 1];
        return {
          ...friend,
          lastMessage: last && preview(last),
          lastMessageTime: last?.timestamp,
          unreadCount: messages.filter(message => message.senderId !== user.id && message.timestamp > (ownReadAt ? Date.parse(ownReadAt) : 0)).length,
        };
      });
      update(() => ({ friends: hydrated, conversations }));
      const partner = hydrated.find(friend => friend.isPartner);
      if (partner) setPartner({ name: partner.name, avatarId: partner.avatarId, relationshipType: partner.relationshipType as RelationshipType, code: partner.id });
      setStatus('online');
      setError(null);
    } catch {
      if (!silent) {
        setStatus(navigator.onLine ? 'error' : 'offline');
        setError('Cloud chat could not sync. Reconnect and try again.');
      }
    } finally {
      loading.current = false;
    }
  }, [convert, setPartner, update, user]);

  useEffect(() => {
    if (!user) {
      chatRef.current = blank();
      setChat(blank());
      setStatus('offline');
      return;
    }
    void refreshContacts();
  }, [refreshContacts, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`cloud-chat:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const row = payload.new as MessageRow;
        const friend = chatRef.current.friends.find(item => item.conversationId === row.conversation_id);
        if (!friend) { void refreshContacts(); return; }
        const message = convert(row, friend);
        update(current => {
          const oldMessages = current.conversations[friend.id] || [];
          const messages = oldMessages.some(item => item.id === message.id) ? oldMessages.map(item => item.id === message.id ? { ...message, status: item.status === 'read' ? 'read' : message.status } : item) : [...oldMessages, message];
          return {
            friends: current.friends.map(item => item.id === friend.id ? {
              ...item,
              lastMessage: preview(message),
              lastMessageTime: message.timestamp,
              unreadCount: message.senderId !== user.id && activeRef.current !== friend.id ? (item.unreadCount || 0) + 1 : item.unreadCount,
            } : item),
            conversations: { ...current.conversations, [friend.id]: messages.slice(-500) },
          };
        });
        if (message.senderId !== user.id) {
          sounds.playChatPop();
          if (activeRef.current === friend.id) markConversationRead(friend);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members' }, payload => {
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
        if (status === 'SUBSCRIBED') { setStatus('online'); setError(null); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { setStatus('error'); setError('Live updates paused. Reconnecting your chat now.'); }
      });
    const resume = () => { if (document.visibilityState !== 'hidden') void refreshContacts(); };
    // Realtime remains the primary path. This quiet safety sync keeps a thread
    // current through short laptop sleeps or a dropped WebSocket reconnect.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden' && navigator.onLine) void refreshContacts(true);
    }, 4_000);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
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

  const removeFriend = useCallback(async (id: string) => {
    const friend = chatRef.current.friends.find(item => item.id === id);
    if (friend?.conversationId) {
      const result = await supabase.rpc('leave_chat_conversation', { target_conversation: friend.conversationId });
      if (result.error) throw result.error;
    }
    update(current => {
      const conversations = { ...current.conversations };
      delete conversations[id];
      return { friends: current.friends.filter(item => item.id !== id), conversations };
    });
    if (friend?.isPartner) setPartner(null);
  }, [setPartner, update]);

  const setActiveChatFriendId = useCallback((id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    if (!id) return;
    const friend = chatRef.current.friends.find(item => item.id === id);
    if (friend) markConversationRead(friend);
  }, [markConversationRead]);

  const persist = useCallback(async (friend: Friend, message: DirectMessage) => {
    if (!user || !friend.conversationId) return new Error('Not connected');
    // Quick replies are regular text messages with metadata. This keeps them
    // compatible with existing database message-type constraints.
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
  }, [user]);

  const sendDirectMessage = useCallback(async (friendId: string, text: string, isQuickReaction = false, gameInvite?: DirectMessage['gameInvite']): Promise<SendResult> => {
    const friend = chatRef.current.friends.find(item => item.id === friendId);
    const body = text.trim();
    if (!user || !friend?.conversationId) return { ok: false, error: 'Accept a cloud invite before chatting.' };
    if (!body) return { ok: false, error: 'Write a message first.' };
    if (body.length > 2_000) return { ok: false, error: 'Keep messages under 2,000 characters.' };
    const message: DirectMessage = { id: crypto.randomUUID(), friendId, senderId: user.id, senderName: profile?.name || 'You', senderAvatar: profile?.avatarId || 'sunny', text: body, timestamp: Date.now(), isQuickReaction, gameInvite, status: 'sending' };
    update(current => ({
      friends: current.friends.map(item => item.id === friendId ? { ...item, lastMessage: preview(message), lastMessageTime: message.timestamp } : item),
      conversations: { ...current.conversations, [friendId]: [...(current.conversations[friendId] || []), message] },
    }));
    const error = await persist(friend, message);
    update(current => ({
      ...current,
      conversations: {
        ...current.conversations,
        [friendId]: (current.conversations[friendId] || []).map(item => item.id === message.id ? { ...item, status: error ? 'failed' : 'sent', error: error ? 'Not saved to cloud. Tap retry.' : undefined } : item),
      },
    }));
    if (error) return { ok: false, error: navigator.onLine ? 'Message was not saved. Please retry.' : 'Reconnect, then tap retry.' };
    sounds.playChatSent();
    return { ok: true };
  }, [persist, profile, update, user]);

  const retryDirectMessage = useCallback(async (friendId: string, messageId: string): Promise<SendResult> => {
    const friend = chatRef.current.friends.find(item => item.id === friendId);
    const message = chatRef.current.conversations[friendId]?.find(item => item.id === messageId);
    if (!friend || !message) return { ok: false, error: 'Message unavailable.' };
    const error = await persist(friend, message);
    update(current => ({
      ...current,
      conversations: { ...current.conversations, [friendId]: (current.conversations[friendId] || []).map(item => item.id === messageId ? { ...item, status: error ? 'failed' : 'sent', error: error ? 'Not saved to cloud. Tap retry.' : undefined } : item) },
    }));
    return error ? { ok: false, error: 'Message was not saved. Please retry.' } : { ok: true };
  }, [persist, update]);

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
    connectionStatus,
    connectionError,
    myChatId: user?.id || '',
    unreadTotal: chat.friends.reduce((sum, friend) => sum + (friend.unreadCount || 0), 0),
    activeChatFriendId,
    setActiveChatFriendId,
  };

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
};
