import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useGame, type RelationshipType } from './GameContext';
import { supabase } from '../lib/supabase';
import { sounds } from '../utils/audio';
import type { FriendInvite } from '../utils/friendInvites';

export interface Friend { id: string; conversationId?: string; name: string; avatarId: string; relationshipType: RelationshipType | 'friend'; isPartner?: boolean; addedAt: string; lastMessage?: string; lastMessageTime?: number; linked?: boolean; isOnline?: boolean; unreadCount?: number }
export interface DirectMessage { id: string; friendId: string; senderId: string; senderName: string; senderAvatar: string; text: string; timestamp: number; isQuickReaction?: boolean; gameInvite?: { roomCode: string; gameTitle?: string }; status?: 'sending' | 'sent' | 'delivered' | 'failed'; error?: string }
export interface SendResult { ok: boolean; error?: string }
interface ChatState { friends: Friend[]; conversations: Record<string, DirectMessage[]> }
interface FriendsApi { friends: Friend[]; addFriend: (name: string, avatarId: string, rel: RelationshipType | 'friend', isPartner?: boolean) => Friend; removeFriend: (id: string) => Promise<void>; getConversation: (id: string) => DirectMessage[]; sendDirectMessage: (id: string, text: string, quick?: boolean, game?: DirectMessage['gameInvite']) => Promise<SendResult>; retryDirectMessage: (id: string, messageId: string) => Promise<SendResult>; createInviteLink: (rel: FriendInvite['rel']) => Promise<string>; refreshContacts: () => Promise<void>; connectionStatus: 'connecting' | 'online' | 'offline' | 'error'; connectionError: string | null; myChatId: string; unreadTotal: number; activeChatFriendId: string | null; setActiveChatFriendId: (id: string | null) => void }
interface ContactRow { conversation_id: string; friend_id: string; friend_name: string; friend_avatar: string; relationship_type: FriendInvite['rel']; last_read_at: string | null }
interface MessageRow { id: string; conversation_id: string; sender_id: string; body: string; metadata: Record<string, unknown> | null; client_created_at: string; created_at: string }

const FriendsContext = createContext<FriendsApi | null>(null);
export const useFriends = () => { const value = useContext(FriendsContext); if (!value) throw new Error('useFriends must be used within FriendsProvider'); return value; };
const blank = (): ChatState => ({ friends: [], conversations: {} });
const preview = (message: DirectMessage) => message.gameInvite ? `Game invite: Room #${message.gameInvite.roomCode}` : message.text;

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
  const update = useCallback((fn: (value: ChatState) => ChatState) => setChat(current => { const next = fn(current); chatRef.current = next; return next; }), []);
  const convert = useCallback((row: MessageRow, friend: Friend): DirectMessage => { const meta = row.metadata || {}; const game = meta.gameInvite as DirectMessage['gameInvite']; return { id: row.id, friendId: friend.id, senderId: row.sender_id, senderName: row.sender_id === user?.id ? profile?.name || 'You' : friend.name, senderAvatar: row.sender_id === user?.id ? profile?.avatarId || 'sunny' : friend.avatarId, text: row.body, timestamp: Date.parse(row.created_at || row.client_created_at), isQuickReaction: meta.isQuickReaction === true, gameInvite: game?.roomCode ? game : undefined, status: 'delivered' }; }, [profile, user?.id]);

  const refreshContacts = useCallback(async () => {
    if (!user || loading.current) return;
    loading.current = true; setStatus('connecting');
    try {
      const contactsResult = await supabase.rpc('list_chat_contacts');
      if (contactsResult.error) throw contactsResult.error;
      const rows = (contactsResult.data || []) as ContactRow[];
      const friends: Friend[] = rows.map(row => ({ id: row.friend_id, conversationId: row.conversation_id, name: row.friend_name || 'Your friend', avatarId: row.friend_avatar || 'sunny', relationshipType: row.relationship_type || 'friend', isPartner: ['lover', 'spouse'].includes(row.relationship_type), addedAt: new Date().toISOString(), linked: true, isOnline: true, unreadCount: 0 }));
      const ids = friends.map(item => item.conversationId!);
      let messageRows: MessageRow[] = [];
      if (ids.length) { const result = await supabase.from('chat_messages').select('*').in('conversation_id', ids).order('created_at').limit(1000); if (result.error) throw result.error; messageRows = (result.data || []) as MessageRow[]; }
      const conversations: Record<string, DirectMessage[]> = {};
      const hydrated = friends.map(friend => { const messages = messageRows.filter(row => row.conversation_id === friend.conversationId).map(row => convert(row, friend)); conversations[friend.id] = messages; const last = messages[messages.length - 1]; const read = rows.find(row => row.friend_id === friend.id)?.last_read_at; return { ...friend, lastMessage: last && preview(last), lastMessageTime: last?.timestamp, unreadCount: messages.filter(message => message.senderId !== user.id && message.timestamp > (read ? Date.parse(read) : 0)).length }; });
      update(() => ({ friends: hydrated, conversations }));
      const partner = hydrated.find(friend => friend.isPartner);
      if (partner) setPartner({ name: partner.name, avatarId: partner.avatarId, relationshipType: partner.relationshipType as RelationshipType, code: partner.id });
      setStatus('online'); setError(null);
    } catch { setStatus(navigator.onLine ? 'error' : 'offline'); setError('Cloud chat could not sync. Reconnect and try again.'); }
    finally { loading.current = false; }
  }, [convert, setPartner, update, user]);

  useEffect(() => {
    if (!user) { chatRef.current = blank(); setChat(blank()); setStatus('offline'); return; }
    void refreshContacts();
  }, [refreshContacts, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`cloud-chat:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const row = payload.new as MessageRow; const friend = chatRef.current.friends.find(item => item.conversationId === row.conversation_id);
        if (!friend) { void refreshContacts(); return; }
        const message = convert(row, friend);
        update(current => { const old = current.conversations[friend.id] || []; const messages = old.some(item => item.id === message.id) ? old.map(item => item.id === message.id ? message : item) : [...old, message]; return { friends: current.friends.map(item => item.id === friend.id ? { ...item, lastMessage: preview(message), lastMessageTime: message.timestamp, unreadCount: message.senderId !== user.id && activeRef.current !== friend.id ? (item.unreadCount || 0) + 1 : item.unreadCount } : item), conversations: { ...current.conversations, [friend.id]: messages.slice(-500) } }; });
        if (message.senderId !== user.id) sounds.playChatPop();
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') { setStatus('online'); setError(null); } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setStatus('error'); setError('Live updates paused. Messages refresh when you return.'); } });
    const resume = () => { if (document.visibilityState !== 'hidden') void refreshContacts(); };
    const refreshTimer = window.setInterval(resume, 15000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { window.clearInterval(refreshTimer); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); void supabase.removeChannel(channel); };
  }, [convert, refreshContacts, update, user]);

  const addFriend = useCallback((name: string, avatarId: string, relationshipType: FriendInvite['rel'], isPartner = false) => { const friend: Friend = { id: `saved-${crypto.randomUUID()}`, name: name.trim(), avatarId, relationshipType, isPartner, addedAt: new Date().toISOString(), linked: false }; update(current => ({ ...current, friends: [...current.friends, friend] })); return friend; }, [update]);
  const removeFriend = useCallback(async (id: string) => { const friend = chatRef.current.friends.find(item => item.id === id); if (friend?.conversationId) { const result = await supabase.rpc('leave_chat_conversation', { target_conversation: friend.conversationId }); if (result.error) throw result.error; } update(current => { const conversations = { ...current.conversations }; delete conversations[id]; return { friends: current.friends.filter(item => item.id !== id), conversations }; }); if (friend?.isPartner) setPartner(null); }, [setPartner, update]);
  const setActiveChatFriendId = useCallback((id: string | null) => { activeRef.current = id; setActiveId(id); if (!id) return; const friend = chatRef.current.friends.find(item => item.id === id); update(current => ({ ...current, friends: current.friends.map(item => item.id === id ? { ...item, unreadCount: 0 } : item) })); if (user && friend?.conversationId) void supabase.from('chat_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', friend.conversationId).eq('user_id', user.id); }, [update, user]);

  const persist = useCallback(async (friend: Friend, message: DirectMessage) => { if (!user || !friend.conversationId) return new Error('Not connected'); const result = await supabase.from('chat_messages').upsert({ id: message.id, conversation_id: friend.conversationId, sender_id: user.id, body: message.text, message_type: message.gameInvite ? 'game_invite' : message.isQuickReaction ? 'quick_reaction' : 'text', metadata: { isQuickReaction: message.isQuickReaction === true, ...(message.gameInvite ? { gameInvite: message.gameInvite } : {}) }, client_created_at: new Date(message.timestamp).toISOString() }, { onConflict: 'id', ignoreDuplicates: true }); return result.error; }, [user]);
  const sendDirectMessage = useCallback(async (friendId: string, text: string, isQuickReaction = false, gameInvite?: DirectMessage['gameInvite']): Promise<SendResult> => { const friend = chatRef.current.friends.find(item => item.id === friendId); const body = text.trim(); if (!user || !friend?.conversationId) return { ok: false, error: 'Accept a cloud invite before chatting.' }; if (!body) return { ok: false, error: 'Write a message first.' }; if (body.length > 2000) return { ok: false, error: 'Keep messages under 2,000 characters.' }; const message: DirectMessage = { id: crypto.randomUUID(), friendId, senderId: user.id, senderName: profile?.name || 'You', senderAvatar: profile?.avatarId || 'sunny', text: body, timestamp: Date.now(), isQuickReaction, gameInvite, status: 'sending' }; update(current => ({ friends: current.friends.map(item => item.id === friendId ? { ...item, lastMessage: preview(message), lastMessageTime: message.timestamp } : item), conversations: { ...current.conversations, [friendId]: [...(current.conversations[friendId] || []), message] } })); const error = await persist(friend, message); update(current => ({ ...current, conversations: { ...current.conversations, [friendId]: current.conversations[friendId].map(item => item.id === message.id ? { ...item, status: error ? 'failed' : 'delivered', error: error ? 'Not saved to cloud. Tap retry.' : undefined } : item) } })); if (error) return { ok: false, error: navigator.onLine ? 'Message was not saved. Please retry.' : 'Reconnect, then tap retry.' }; sounds.playChatSent(); return { ok: true }; }, [persist, profile, update, user]);
  const retryDirectMessage = useCallback(async (friendId: string, messageId: string): Promise<SendResult> => { const friend = chatRef.current.friends.find(item => item.id === friendId); const message = chatRef.current.conversations[friendId]?.find(item => item.id === messageId); if (!friend || !message) return { ok: false, error: 'Message unavailable.' }; const error = await persist(friend, message); update(current => ({ ...current, conversations: { ...current.conversations, [friendId]: current.conversations[friendId].map(item => item.id === messageId ? { ...item, status: error ? 'failed' : 'delivered' } : item) } })); return error ? { ok: false, error: 'Message was not saved. Please retry.' } : { ok: true }; }, [persist, update]);
  const createInviteLink = useCallback(async (relationship: FriendInvite['rel']) => { if (!user || !profile) throw new Error('Sign in first'); const result = await supabase.rpc('create_chat_invite', { display_name: profile.name, avatar_id: profile.avatarId, relationship }); if (result.error) throw result.error; const token = (result.data as { token: string }[])?.[0]?.token; if (!token) throw new Error('Invite unavailable'); return `${window.location.origin}/invite?${new URLSearchParams({ chat: token, n: profile.name, a: profile.avatarId, r: relationship })}`; }, [profile, user]);
  const value: FriendsApi = { friends: chat.friends, addFriend, removeFriend, getConversation: id => chat.conversations[id] || [], sendDirectMessage, retryDirectMessage, createInviteLink, refreshContacts, connectionStatus, connectionError, myChatId: user?.id || '', unreadTotal: chat.friends.reduce((sum, friend) => sum + (friend.unreadCount || 0), 0), activeChatFriendId, setActiveChatFriendId };
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
};




