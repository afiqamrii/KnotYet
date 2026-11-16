import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { UserProfile } from './GameContext';
import { sounds } from '../utils/audio';
import type { Choice, ChoiceRound } from '../utils/choiceGame';
import type { NumberRoundSnapshot } from '../utils/numberSession';
import { isMultiplayerMessage } from '../utils/multiplayerProtocol';
import type { LetterRoundSnapshot } from '../utils/letterSession';

export type GameMode = 'lobby' | 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter' | 'secret-race' | 'choices';

export type SecretRaceOperation = '+' | '−' | '×';
export type SecretRaceRole = 'host' | 'partner' | 'tie';
export type SecretRacePhase = 'picking' | 'countdown' | 'answering' | 'result' | 'complete';

export interface SecretRaceState {
  matchId: string;
  round: number;
  operation: SecretRaceOperation;
  phase: SecretRacePhase;
  hostLocked: boolean;
  partnerLocked: boolean;
  scores: { host: number; partner: number };
  equation?: { hostNumber: number; partnerNumber: number; answer: number };
  winner?: SecretRaceRole;
}

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
  | { type: 'SWIPE_ACTION'; payload: { direction: 'left' | 'right'; cardId?: string } }
  | { type: 'SWIPE_REQUEST'; payload: { direction: 'left' | 'right'; cardId: string } }
  | { type: 'SWIPE_FLIP'; payload: boolean }
  | { type: 'CARD_SUBMIT'; payload: string | { cardId: string; answer: string } }
  | { type: 'RIDDLE_REVEAL'; payload?: { cardId: string } }
  | { type: 'CHOICES_REQUEST' }
  | { type: 'CHOICES_STATE'; payload: ChoiceRound }
  | { type: 'CHOICES_PICK'; payload: { roundId: string; choice: Choice } }
  | { type: 'QUIZ_ACTUAL'; payload: string }
  | { type: 'QUIZ_GUESS'; payload: string }
  | { type: 'QUIZ_NEXT' }
  | { type: 'SPIN_WHEEL'; payload: { rotation: number, segmentIndex: number, promptIndex: number } }
  | { type: 'WHEEL_SUBMIT'; payload: { spinKey: string; answer: string } }
  | { type: 'WHEEL_DISMISS'; payload: { spinKey: string } }
  | { type: 'SYNC_QUESTION_IDS'; payload: { game: GameMode; questionIds: string[]; currentIndex?: number } }
  | { type: 'MATCH_SELECT'; payload: string }
  | { type: 'MATCH_NEXT' }
  | { type: 'MATCH_RESTART'; payload?: { questionIds?: string[] } }
  | { type: 'QUIZ_RESTART'; payload?: { questionIds?: string[] } }
  | { type: 'NUM_SET_SECRET'; payload: number }
  | { type: 'NUM_GUESS'; payload: { val: number; name?: string; round?: number } | number }
  | { type: 'NUM_REQUEST' }
  | { type: 'NUM_STATE'; payload: NumberRoundSnapshot }
  | { type: 'NUM_NEXT' }
  | { type: 'SECRET_RACE_START'; payload: SecretRaceState }
  | { type: 'SECRET_RACE_STATE'; payload: SecretRaceState }
  | { type: 'SECRET_RACE_LOCK'; payload: { matchId: string; number: number } }
  | { type: 'SECRET_RACE_GO'; payload: { matchId: string; equation: NonNullable<SecretRaceState['equation']> } }
  | { type: 'SECRET_RACE_ANSWER'; payload: { matchId: string; answer: number } }
  | { type: 'SECRET_RACE_WRONG'; payload: { matchId: string; delayMs: number } }
  | { type: 'SECRET_RACE_RESULT'; payload: SecretRaceState }
  | { type: 'SECRET_RACE_NEXT'; payload: { matchId: string } }
  | { type: 'SECRET_RACE_RESTART'; payload: { matchId: string } }
  | { type: 'LETTER_START'; payload: string | { letter: string; roundId: string } }
  | { type: 'LETTER_WORD_SUBMIT'; payload: string | { word: string; roundId: string } }
  | { type: 'LETTER_RESULT'; payload: { name: string; word: string; roundId: string } }
  | { type: 'LETTER_NEXT' }
  | { type: 'LETTER_REQUEST' }
  | { type: 'LETTER_STATE'; payload: LetterRoundSnapshot }
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
  questionDecks: Partial<Record<GameMode, string[]>>;
  questionIndices: Partial<Record<GameMode, number>>;
  numberSecret: number | null;
  wheelSpin: { rotation: number; segmentIndex: number; promptIndex: number } | null;
}

interface MultiplayerContextType extends MultiplayerState {
  hostRoom: (code: string, profile: UserProfile, reconnect?: boolean) => void;
  joinRoom: (code: string, profile: UserProfile, reconnect?: boolean) => void;
  leaveRoom: () => void;
  setGame: (game: GameMode) => void;
  sendMessage: (msg: MultiplayerMessage) => void;
  sendChatMessage: (text: string, isQuickReaction?: boolean) => boolean;
  clearUnreadChatCount: () => void;
  subscribeMessage: (listener: (msg: MultiplayerMessage) => void) => () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export const useMultiplayer = () => {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return ctx;
};

const getPeerId = (code: string) => `jodohdeck-v2-${code}`;
const CONNECTION_TIMEOUT_MS = 15000;
const getRestoredGame = (): GameMode => {
  const savedGame = sessionStorage.getItem('mp_activeGame');
  return savedGame && ['lobby', 'swipe', 'quiz', 'wheel', 'match', 'number', 'letter', 'secret-race', 'choices'].includes(savedGame)
    ? savedGame as GameMode : 'lobby';
};

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MultiplayerState>({
    isConnected: false,
    isHost: sessionStorage.getItem('mp_isHost') === 'true',
    status: 'disconnected',
    roomCode: sessionStorage.getItem('mp_roomCode'),
    remoteProfile: null,
    activeGame: getRestoredGame(),
    error: null,
    chatMessages: [],
    unreadChatCount: 0,
    latestIncomingMessage: null,
    questionDecks: {},
    questionIndices: {},
    numberSecret: null,
    wheelSpin: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.status === 'hosting' || state.status === 'joining' || state.status === 'connected') {
      sessionStorage.setItem('mp_roomCode', state.roomCode || '');
      sessionStorage.setItem('mp_isHost', state.isHost.toString());
      sessionStorage.setItem('mp_activeGame', state.activeGame);
    }
  }, [state.status, state.roomCode, state.isHost, state.activeGame]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const localProfileRef = useRef<UserProfile | null>(null);
  const hasConnectedRef = useRef(false);
  const recoveringRef = useRef(false);
  const connectionDeadlineRef = useRef<number | null>(null);
  const connectionAttemptVersion = useRef(0);
  const remoteLeftRef = useRef(false);
  const receivedChatIds = useRef(new Set<string>());
  const messageSubscribers = useRef(new Set<(msg: MultiplayerMessage) => void>());
  const subscribeMessage = useCallback((listener: (msg: MultiplayerMessage) => void) => {
    messageSubscribers.current.add(listener);
    return () => { messageSubscribers.current.delete(listener); };
  }, []);

  const clearConnectionDeadline = useCallback(() => {
    connectionAttemptVersion.current += 1;
    if (connectionDeadlineRef.current !== null) window.clearTimeout(connectionDeadlineRef.current);
    connectionDeadlineRef.current = null;
  }, []);

  const cleanup = useCallback((preserveSession = false) => {
    clearConnectionDeadline();
    if (!preserveSession) {
      receivedChatIds.current.clear();
      sessionStorage.removeItem('mp_roomCode');
      sessionStorage.removeItem('mp_isHost');
      sessionStorage.removeItem('mp_activeGame');
    }
    const connection = connRef.current;
    connRef.current = null;
    connection?.close();
    const peer = peerRef.current;
    peerRef.current = null;
    peer?.destroy();
    setState(previous => preserveSession ? {
      ...previous,
      isConnected: false,
      status: 'disconnected',
      error: null,
    } : {
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
      questionDecks: {},
      questionIndices: {},
      numberSecret: null,
      wheelSpin: null,
    });
  }, [clearConnectionDeadline]);

  const failConnectionAttempt = useCallback((peer: Peer, message: string) => {
    if (peerRef.current !== peer) return;
    clearConnectionDeadline();
    // Detach before closing: synchronous or delayed close events from this
    // attempt must not affect its replacement or overwrite the error state.
    const connection = connRef.current;
    connRef.current = null;
    peerRef.current = null;
    connection?.close();
    peer.destroy();
    const canRecover = recoveringRef.current || hasConnectedRef.current;
    setState(s => ({ ...s, isConnected: false, status: canRecover ? 'partner_left' : 'error', error: canRecover ? null : message }));
  }, [clearConnectionDeadline]);

  const startConnectionDeadline = useCallback((peer: Peer, message: string) => {
    clearConnectionDeadline();
    const version = connectionAttemptVersion.current;
    connectionDeadlineRef.current = window.setTimeout(() => {
      if (connectionAttemptVersion.current !== version) return;
      failConnectionAttempt(peer, message);
    }, CONNECTION_TIMEOUT_MS);
  }, [clearConnectionDeadline, failConnectionAttempt]);

  const handlePartnerLeft = useCallback(() => {
    setState(s => {
      if (s.status === 'connected' || s.status === 'joining' || s.status === 'hosting') {
        return { ...s, isConnected: false, status: 'partner_left' };
      }
      return s;
    });
  }, []);

  const handleConnection = useCallback((conn: DataConnection) => {
    const previousConnection = connRef.current;
    connRef.current = conn;
    if (previousConnection && previousConnection !== conn) previousConnection.close();
    if (peerRef.current) startConnectionDeadline(peerRef.current, 'Connection timed out. Check your connection and try joining again.');
    
    conn.on('open', () => {
      if (connRef.current !== conn) return;
      clearConnectionDeadline();
      hasConnectedRef.current = true;
      remoteLeftRef.current = false;
      setState(s => ({ ...s, isConnected: true, status: 'connected', error: null }));
      // Send profile to partner
      if (localProfileRef.current) {
        conn.send({ type: 'PROFILE_SYNC', payload: localProfileRef.current });
      }
      if (stateRef.current.isHost && stateRef.current.activeGame !== 'lobby') {
        conn.send({ type: 'SET_GAME', payload: stateRef.current.activeGame });
        const questionIds = stateRef.current.questionDecks[stateRef.current.activeGame];
        if (questionIds?.length) {
          conn.send({ type: 'SYNC_QUESTION_IDS', payload: { game: stateRef.current.activeGame, questionIds, currentIndex: stateRef.current.questionIndices[stateRef.current.activeGame] || 0 } });
        }
        if (stateRef.current.activeGame === 'number' && stateRef.current.numberSecret !== null) {
          conn.send({ type: 'NUM_SET_SECRET', payload: stateRef.current.numberSecret });
        }
        if (stateRef.current.activeGame === 'wheel' && stateRef.current.wheelSpin) {
          conn.send({ type: 'SPIN_WHEEL', payload: stateRef.current.wheelSpin });
        }
      }
    });

    conn.on('data', (data) => {
      if (connRef.current !== conn) return;
      if (!isMultiplayerMessage(data)) return;
      const msg = data;
      
      if (msg.type === 'PROFILE_SYNC') {
        const incoming = msg.payload;
        if (!incoming || typeof incoming.name !== 'string' || typeof incoming.avatarId !== 'string' || !Number.isFinite(incoming.heartPoints)) return;
        const safeProfile: UserProfile = { name: incoming.name.slice(0, 60), avatarId: incoming.avatarId.slice(0, 60), heartPoints: Math.max(0, incoming.heartPoints) };
        if (typeof incoming.accountId === 'string' && incoming.accountId.length <= 128) safeProfile.accountId = incoming.accountId;
        setState(s => ({ ...s, remoteProfile: safeProfile }));
      } else if (msg.type === 'SET_GAME') {
        setState(s => ({
          ...s,
          activeGame: msg.payload,
          questionDecks: { ...s.questionDecks, [msg.payload]: undefined },
          questionIndices: { ...s.questionIndices, [msg.payload]: undefined },
          numberSecret: msg.payload === 'number' ? null : s.numberSecret,
          wheelSpin: msg.payload === 'wheel' ? null : s.wheelSpin,
        }));
        messageSubscribers.current.forEach(listener => listener(msg));
      } else if (msg.type === 'END_GAME') {
        setState(s => ({ ...s, activeGame: 'lobby' }));
        messageSubscribers.current.forEach(listener => listener(msg));
      } else if (msg.type === 'CHAT_MESSAGE') {
        if (receivedChatIds.current.has(msg.payload.id)) return;
        receivedChatIds.current.add(msg.payload.id);
        const incoming = { ...msg.payload, senderId: 'partner', text: msg.payload.text.slice(0, 2000) };
        setState(s => ({
          ...s,
          chatMessages: s.chatMessages.some(item => item.id === incoming.id) ? s.chatMessages : [...s.chatMessages, incoming],
          unreadChatCount: s.unreadChatCount + 1,
          latestIncomingMessage: incoming,
        }));
        sounds.playChatPop();
      } else if (msg.type === 'SYNC_QUESTION_IDS') {
        setState(s => ({
          ...s,
          questionDecks: { ...s.questionDecks, [msg.payload.game]: msg.payload.questionIds },
          questionIndices: { ...s.questionIndices, [msg.payload.game]: msg.payload.currentIndex || 0 },
        }));
        messageSubscribers.current.forEach(listener => listener(msg));
      } else if (msg.type === 'NUM_SET_SECRET') {
        setState(s => ({ ...s, numberSecret: msg.payload }));
        messageSubscribers.current.forEach(listener => listener(msg));
      } else if (msg.type === 'SPIN_WHEEL') {
        setState(s => ({ ...s, wheelSpin: msg.payload }));
        messageSubscribers.current.forEach(listener => listener(msg));
      } else if (msg.type === 'LEAVE_ROOM') {
        remoteLeftRef.current = true;
        handlePartnerLeft();
      } else {
        messageSubscribers.current.forEach(listener => listener(msg));
      }
    });

    conn.on('close', () => {
      if (connRef.current === conn) {
        clearConnectionDeadline();
        connRef.current = null;
        handlePartnerLeft();
      }
    });
    conn.on('error', () => {
      if (connRef.current === conn) {
        clearConnectionDeadline();
        connRef.current = null;
        conn.close();
        handlePartnerLeft();
      }
    });
  }, [handlePartnerLeft, startConnectionDeadline, clearConnectionDeadline]);

  const hostRoom = useCallback((code: string, profile: UserProfile, reconnect = false) => {
    cleanup(reconnect);
    recoveringRef.current = reconnect;
    if (!reconnect) { hasConnectedRef.current = false; remoteLeftRef.current = false; }
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
    startConnectionDeadline(peer, 'Creating the room timed out. Check your connection and try again.');

    peer.on('open', () => {
      if (peerRef.current !== peer) return;
      if (!connRef.current) clearConnectionDeadline(); // A registered host may wait for a partner indefinitely.
    });

    peer.on('connection', (conn) => {
      if (peerRef.current !== peer) { conn.close(); return; }
      if (connRef.current?.open) { conn.close(); return; }
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      if (peerRef.current !== peer) return;
      console.error(err);
      failConnectionAttempt(peer, 'Failed to create room. Code might be in use.');
    });
    peer.on('disconnected', () => { if (peerRef.current === peer && !peer.destroyed) peer.reconnect(); });
  }, [cleanup, handleConnection, startConnectionDeadline, clearConnectionDeadline, failConnectionAttempt]);

  const joinRoom = useCallback((code: string, profile: UserProfile, reconnect = false) => {
    cleanup(reconnect);
    recoveringRef.current = reconnect;
    if (!reconnect) { hasConnectedRef.current = false; remoteLeftRef.current = false; }
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
    startConnectionDeadline(peer, 'Joining timed out. Check the room code and your connection, then try again.');

    peer.on('open', () => {
      if (peerRef.current !== peer) return;
      // Signaling can reconnect while the existing WebRTC channel stays open.
      // Opening another channel here would interrupt a healthy game session.
      if (connRef.current?.open) return;
      const conn = peer.connect(getPeerId(code), { reliable: true });
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      if (peerRef.current !== peer) return;
      console.error(err);
      let errorMsg = 'Failed to connect. Make sure host is waiting.';
      if (err.type === 'peer-unavailable') {
        errorMsg = 'Room does not exist. Please check the code.';
      }
      failConnectionAttempt(peer, errorMsg);
    });
    peer.on('disconnected', () => { if (peerRef.current === peer && !peer.destroyed) peer.reconnect(); });
  }, [cleanup, handleConnection, startConnectionDeadline, failConnectionAttempt]);

  useEffect(() => {
    if (state.status !== 'partner_left' || !state.roomCode || !localProfileRef.current || remoteLeftRef.current) return;
    const retry = () => {
      if (remoteLeftRef.current || document.visibilityState !== 'visible' || !navigator.onLine || !localProfileRef.current || !state.roomCode) return;
      if (state.isHost) {
        if (!peerRef.current?.open) hostRoom(state.roomCode, localProfileRef.current, true);
      }
      else joinRoom(state.roomCode, localProfileRef.current, true);
    };
    const timer = window.setInterval(retry, 4000);
    return () => window.clearInterval(timer);
  }, [state.status, state.isHost, state.roomCode, hostRoom, joinRoom]);

  const leaveRoom = useCallback(() => {
    clearConnectionDeadline();
    remoteLeftRef.current = true;
    hasConnectedRef.current = false;
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'LEAVE_ROOM' });
    }
    const connection = connRef.current;
    const peer = peerRef.current;
    setTimeout(() => {
      // A quick join/create action may already have replaced the room.
      if (connRef.current === connection && peerRef.current === peer) cleanup();
    }, 100);
  }, [cleanup, clearConnectionDeadline]);

  const setGame = useCallback((game: GameMode) => {
    setState(s => ({
      ...s,
      activeGame: game,
      questionDecks: { ...s.questionDecks, [game]: undefined },
      questionIndices: { ...s.questionIndices, [game]: undefined },
      numberSecret: game === 'number' ? null : s.numberSecret,
      wheelSpin: game === 'wheel' ? null : s.wheelSpin,
    }));
    if (connRef.current) {
      connRef.current.send({ type: 'SET_GAME', payload: game });
    }
  }, []);

  const sendMessage = useCallback((msg: MultiplayerMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
    if (msg.type === 'SYNC_QUESTION_IDS') {
      setState(s => ({
        ...s,
        questionDecks: { ...s.questionDecks, [msg.payload.game]: msg.payload.questionIds },
        questionIndices: { ...s.questionIndices, [msg.payload.game]: msg.payload.currentIndex || 0 },
      }));
    } else if (msg.type === 'NUM_SET_SECRET') {
      setState(s => ({ ...s, numberSecret: msg.payload }));
    } else if (msg.type === 'SPIN_WHEEL') {
      setState(s => ({ ...s, wheelSpin: msg.payload }));
    }
  }, []);

  const sendChatMessage = useCallback((text: string, isQuickReaction = false) => {
    if (!connRef.current || !connRef.current.open || !localProfileRef.current) return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000) return false;

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: 'me',
      senderName: localProfileRef.current.name,
      senderAvatar: localProfileRef.current.avatarId,
      text: trimmed,
      timestamp: Date.now(),
      isQuickReaction,
    };

    try {
      connRef.current.send({ type: 'CHAT_MESSAGE', payload: newMsg });
    } catch {
      return false;
    }
    setState(s => ({
      ...s,
      chatMessages: [...s.chatMessages, newMsg],
    }));
    sounds.playChatSent();
    return true;
  }, []);

  useEffect(() => () => {
    clearConnectionDeadline();
    const connection = connRef.current;
    connRef.current = null;
    connection?.close();
    peerRef.current?.destroy();
    peerRef.current = null;
  }, [clearConnectionDeadline]);

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
      subscribeMessage
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
};

