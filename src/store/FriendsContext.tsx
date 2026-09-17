import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useGame, RelationshipType } from './GameContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { sounds } from '../utils/audio';

export interface Friend {
  id: string;
  name: string;
  avatarId: string;
  relationshipType: RelationshipType | 'friend';
  isPartner?: boolean;
  addedAt: string;
  lastMessage?: string;
  lastMessageTime?: number;
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
  gameInvite?: {
    roomCode: string;
    gameTitle?: string;
  };
}

interface FriendsContextType {
  friends: Friend[];
  addFriend: (name: string, avatarId: string, relationshipType: RelationshipType | 'friend', isPartner?: boolean) => Friend;
  removeFriend: (id: string) => void;
  getConversation: (friendId: string) => DirectMessage[];
  sendDirectMessage: (friendId: string, text: string, isQuickReaction?: boolean, gameInvite?: { roomCode: string; gameTitle?: string }) => void;
  unreadTotal: number;
  activeChatFriendId: string | null;
  setActiveChatFriendId: (id: string | null) => void;
}

const FriendsContext = createContext<FriendsContextType | null>(null);

const STORAGE_KEY_FRIENDS = 'knotyet_friends_list';
const STORAGE_PREFIX_CHAT = 'knotyet_chat_';

export const useFriends = () => {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within FriendsProvider');
  return ctx;
};

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, partner } = useGame();
  const { user } = useAuth();

  const [friends, setFriends] = useState<Friend[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FRIENDS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeChatFriendId, setActiveChatFriendId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  // Keep partner synced into the friends list
  useEffect(() => {
    if (partner) {
      setFriends(prev => {
        const existingIdx = prev.findIndex(f => f.isPartner || f.name.toLowerCase() === partner.name.toLowerCase());
        const partnerFriend: Friend = {
          id: existingIdx >= 0 ? prev[existingIdx].id : 'partner-main',
          name: partner.name,
          avatarId: partner.avatarId,
          relationshipType: partner.relationshipType,
          isPartner: true,
          addedAt: existingIdx >= 0 ? prev[existingIdx].addedAt : new Date().toISOString(),
          lastMessage: existingIdx >= 0 ? prev[existingIdx].lastMessage : undefined,
          lastMessageTime: existingIdx >= 0 ? prev[existingIdx].lastMessageTime : undefined,
        };

        let updated: Friend[];
        if (existingIdx >= 0) {
          updated = [...prev];
          updated[existingIdx] = partnerFriend;
        } else {
          updated = [partnerFriend, ...prev];
        }

        localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
        return updated;
      });
    }
  }, [partner]);

  const addFriend = useCallback(
    (name: string, avatarId: string, relationshipType: RelationshipType | 'friend', isPartner = false): Friend => {
      const newFriend: Friend = {
        id: `friend-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        avatarId,
        relationshipType,
        isPartner,
        addedAt: new Date().toISOString(),
      };

      setFriends(prev => {
        const filtered = prev.filter(f => f.name.toLowerCase() !== name.trim().toLowerCase());
        const updated = isPartner ? [newFriend, ...filtered] : [...filtered, newFriend];
        localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
        return updated;
      });

      sounds.playSuccess();
      return newFriend;
    },
    []
  );

  const removeFriend = useCallback((id: string) => {
    setFriends(prev => {
      const updated = prev.filter(f => f.id !== id);
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
      return updated;
    });
    localStorage.removeItem(`${STORAGE_PREFIX_CHAT}${id}`);
  }, []);

  const getConversation = useCallback((friendId: string): DirectMessage[] => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX_CHAT}${friendId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const sendDirectMessage = useCallback(
    (
      friendId: string,
      text: string,
      isQuickReaction = false,
      gameInvite?: { roomCode: string; gameTitle?: string }
    ) => {
      if (!profile) return;
      const myId = user?.id || 'me';

      const newMsg: DirectMessage = {
        id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        friendId,
        senderId: myId,
        senderName: profile.name,
        senderAvatar: profile.avatarId,
        text: text.trim(),
        timestamp: Date.now(),
        isQuickReaction,
        gameInvite,
      };

      // Save locally
      try {
        const key = `${STORAGE_PREFIX_CHAT}${friendId}`;
        const existing: DirectMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = [...existing, newMsg];
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save message', e);
      }

      // Update friend last message preview
      setFriends(prev => {
        const updated = prev.map(f => {
          if (f.id === friendId) {
            return {
              ...f,
              lastMessage: gameInvite ? `🎮 Invite: Room #${gameInvite.roomCode}` : text.trim(),
              lastMessageTime: Date.now(),
            };
          }
          return f;
        });
        localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
        return updated;
      });

      // Broadcast via Supabase channel for real-time delivery if both users are online
      try {
        const channelName = `dm_${friendId}`;
        supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'new_direct_message',
          payload: newMsg,
        });
      } catch (err) {
        // offline fallback
      }

      sounds.playChatSent();
    },
    [profile, user]
  );

  // Subscribe to real-time incoming messages
  useEffect(() => {
    const myId = user?.id || profile?.name || 'guest';
    const channelName = `dm_${myId}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_direct_message' }, payload => {
        const msg = payload.payload as DirectMessage;
        if (!msg || !msg.senderId) return;

        // Save into conversation
        const friendId = msg.senderId;
        const key = `${STORAGE_PREFIX_CHAT}${friendId}`;
        try {
          const existing: DirectMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify([...existing, msg]));
        } catch {
          // ignore
        }

        // Update friend preview
        setFriends(prev => {
          const exists = prev.some(f => f.id === friendId);
          let list = prev;
          if (!exists) {
            list = [
              ...prev,
              {
                id: friendId,
                name: msg.senderName,
                avatarId: msg.senderAvatar,
                relationshipType: 'friend',
                addedAt: new Date().toISOString(),
              },
            ];
          }
          const updated = list.map(f => {
            if (f.id === friendId) {
              return {
                ...f,
                lastMessage: msg.text,
                lastMessageTime: msg.timestamp,
              };
            }
            return f;
          });
          localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
          return updated;
        });

        if (activeChatFriendId !== friendId) {
          setUnreadTotal(u => u + 1);
        }
        sounds.playChatPop();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, activeChatFriendId]);

  return (
    <FriendsContext.Provider
      value={{
        friends,
        addFriend,
        removeFriend,
        getConversation,
        sendDirectMessage,
        unreadTotal,
        activeChatFriendId,
        setActiveChatFriendId,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
};
