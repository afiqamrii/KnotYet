import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { UserProfile } from './GameContext';
import { sounds } from '../utils/audio';

export type GameMode = 'lobby' | 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isQuickReaction?: boolean;
}

export type MultiplayerMessage = 
  | { type: 'PROFILE_SYNC'; payload: UserProfile }
  | { type: 'SET_GAME'; payload: GameMode }
  | { type: 'SWIPE_ACTION'; payload: { direction: 'left' | 'right' } }
  | { type: 'SWIPE_FLIP'; payload: boolean }
  | { type: 'CARD_SUBMIT'; payload: string }
  | { type: 'QUIZ_ACTUAL'; payload: string }
  | { type: 'QUIZ_GUESS'; payload: string }
  | { type: 'QUIZ_NEXT' }
  | { type: 'SPIN_WHEEL'; payload: { rotation: number, segmentIndex: number, promptIndex: number } }
  | { type: 'WHEEL_SUBMIT'; payload: string }
  | { type: 'SYNC_QUESTION_IDS'; payload: { game: GameMode; questionIds: string[] } }
  | { type: 'MATCH_SELECT'; payload: string }
  | { type: 'MATCH_NEXT' }
  | { type: 'MATCH_RESTART'; payload?: { questionIds?: string[] } }
  | { type: 'QUIZ_RESTART'; payload?: { questionIds?: string[] } }
  | { type: 'NUM_SET_SECRET'; payload: number }
  | { type: 'NUM_GUESS'; payload: { val: number; name?: string } | number }
  | { type: 'NUM_NEXT' }
  | { type: 'LETTER_START'; payload: string }
  | { type: 'LETTER_WORD_SUBMIT'; payload: string }
  | { type: 'LETTER_NEXT' }
  | { type: 'START_GAME'; payload: { game: GameMode; questionIds?: string[] } }
  | { type: 'START_COUNTDOWN'; payload: { game: GameMode } }
  | { type: 'END_GAME' }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CHAT_TYPING'; payload: { isTyping: boolean } }
  | { type: 'LEAVE_ROOM' };

interface MultiplayerState {
  isConnected: boolean;
  isHost: boolean;
  status: 'disconnected' | 'hosting' | 'joining' | 'connected' | 'error' | 'partner_left';
  roomCode: string | null;
  remoteProfile: UserProfile | null;
  activeGame: GameMode;
  error: string | null;
  chatMessages: ChatMessage[];
  unreadChatCount: number;
  latestIncomingMessage: ChatMessage | null;
}

interface MultiplayerContextType extends MultiplayerState {
  hostRoom: (code: string, profile: UserProfile) => void;
  joinRoom: (code: string, profile: UserProfile) => void;
  leaveRoom: () => void;
  setGame: (game: GameMode) => void;
  sendMessage: (msg: MultiplayerMessage) => void;
  sendChatMessage: (text: string, isQuickReaction?: boolean) => void;
  clearUnreadChatCount: () => void;
  messageListener: React.MutableRefObject<((msg: MultiplayerMessage) => void) | null>;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export const useMultiplayer = () => {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return ctx;
};

const getPeerId = (code: string) => `jodohdeck-v2-${code}`;

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MultiplayerState>({
    isConnected: false,
    isHost: false,
    status: 'disconnected',
    roomCode: null,
    remoteProfile: null,
    activeGame: 'lobby',
    error: null,
    chatMessages: [],
    unreadChatCount: 0,
    latestIncomingMessage: null,
  });

  useEffect(() => {
    if (state.status === 'hosting' || state.status === 'joining' || state.status === 'connected') {
      sessionStorage.setItem('mp_roomCode', state.roomCode || '');
      sessionStorage.setItem('mp_isHost', state.isHost.toString());
      sessionStorage.setItem('mp_activeGame', state.activeGame);
    } else if (state.status === 'disconnected') {
      sessionStorage.removeItem('mp_roomCode');
      sessionStorage.removeItem('mp_isHost');
      sessionStorage.removeItem('mp_activeGame');
    }
  }, [state.status, state.roomCode, state.isHost, state.activeGame]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const localProfileRef = useRef<UserProfile | null>(null);
  const messageListener = useRef<((msg: MultiplayerMessage) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setState({
      isConnected: false,
      isHost: false,
      status: 'disconnected',
      roomCode: null,
      remoteProfile: null,
      activeGame: 'lobby',
      error: null,
      chatMessages: [],
      unreadChatCount: 0,
      latestIncomingMessage: null,
    });
  }, []);

  const handlePartnerLeft = useCallback(() => {
    setState(s => {
      if (s.status === 'connected') {
        return { ...s, status: 'partner_left' };
      }
      return s;
    });
    setTimeout(() => {
      cleanup();
    }, 3000);
  }, [cleanup]);

  const handleConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;
    
    conn.on('open', () => {
      setState(s => ({ ...s, isConnected: true, status: 'connected', error: null }));
      // Send profile to partner
      if (localProfileRef.current) {
        conn.send({ type: 'PROFILE_SYNC', payload: localProfileRef.current });
      }
    });

    conn.on('data', (data: any) => {
      const msg = data as MultiplayerMessage;
      
      if (msg.type === 'PROFILE_SYNC') {
        setState(s => ({ ...s, remoteProfile: msg.payload }));
      } else if (msg.type === 'SET_GAME') {
        setState(s => ({ ...s, activeGame: msg.payload }));
        if (messageListener.current) {
          messageListener.current(msg);
        }
      } else if (msg.type === 'END_GAME') {
        setState(s => ({ ...s, activeGame: 'lobby' }));
        if (messageListener.current) {
          messageListener.current(msg);
        }
      } else if (msg.type === 'CHAT_MESSAGE') {
        setState(s => ({
          ...s,
          chatMessages: [...s.chatMessages, msg.payload],
          unreadChatCount: s.unreadChatCount + 1,
          latestIncomingMessage: msg.payload,
        }));
        sounds.playChatPop();
      } else if (msg.type === 'LEAVE_ROOM') {
        handlePartnerLeft();
      } else {
        // Pass to active game listener
        if (messageListener.current) {
          messageListener.current(msg);
        }
      }
    });

    conn.on('close', () => {
      handlePartnerLeft();
    });
  }, [handlePartnerLeft, cleanup]);

  const hostRoom = useCallback((code: string, profile: UserProfile) => {
    cleanup();
    localProfileRef.current = profile;
    setState(s => ({ ...s, status: 'hosting', isHost: true, roomCode: code, error: null }));

    const peer = new Peer(getPeerId(code), {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', () => {
      // Waiting for connection
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      setState(s => ({ ...s, status: 'error', error: 'Failed to create room. Code might be in use.' }));
      peer.destroy();
    });
  }, [cleanup, handleConnection]);

  const joinRoom = useCallback((code: string, profile: UserProfile) => {
    cleanup();
    localProfileRef.current = profile;
    setState(s => ({ ...s, status: 'joining', isHost: false, roomCode: code, error: null }));

    const peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(getPeerId(code), { reliable: true });
      handleConnection(conn);
    });

    peer.on('error', (err: any) => {
      console.error(err);
      let errorMsg = 'Failed to connect. Make sure host is waiting.';
      if (err.type === 'peer-unavailable') {
        errorMsg = 'Room does not exist. Please check the code.';
      }
      setState(s => ({ ...s, status: 'error', error: errorMsg }));
      peer.destroy();
    });
  }, [cleanup, handleConnection]);

  const leaveRoom = useCallback(() => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'LEAVE_ROOM' });
    }
    setTimeout(cleanup, 100);
  }, [cleanup]);

  const setGame = useCallback((game: GameMode) => {
    setState(s => ({ ...s, activeGame: game }));
    if (connRef.current) {
      connRef.current.send({ type: 'SET_GAME', payload: game });
    }
  }, []);

  const sendMessage = useCallback((msg: MultiplayerMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
  }, []);

  const sendChatMessage = useCallback((text: string, isQuickReaction = false) => {
    if (!connRef.current || !connRef.current.open || !localProfileRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: 'me',
      senderName: localProfileRef.current.name,
      senderAvatar: localProfileRef.current.avatarId,
      text: trimmed,
      timestamp: Date.now(),
      isQuickReaction,
    };

    setState(s => ({
      ...s,
      chatMessages: [...s.chatMessages, newMsg],
    }));

    connRef.current.send({ type: 'CHAT_MESSAGE', payload: newMsg });
    sounds.playChatSent();
  }, []);

  const clearUnreadChatCount = useCallback(() => {
    setState(s => ({ ...s, unreadChatCount: 0, latestIncomingMessage: null }));
  }, []);

  return (
    <MultiplayerContext.Provider value={{
      ...state,
      hostRoom,
      joinRoom,
      leaveRoom,
      setGame,
      sendMessage,
      sendChatMessage,
      clearUnreadChatCount,
      messageListener
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
};
