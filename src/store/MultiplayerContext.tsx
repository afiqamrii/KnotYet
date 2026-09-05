import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { UserProfile } from './GameContext';

export type GameMode = 'lobby' | 'swipe' | 'quiz' | 'wheel' | 'match';

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
  | { type: 'MATCH_SELECT'; payload: string }
  | { type: 'MATCH_NEXT' }
  | { type: 'MATCH_RESTART' }
  | { type: 'QUIZ_RESTART' }
  | { type: 'LEAVE_ROOM' };

interface MultiplayerState {
  isConnected: boolean;
  isHost: boolean;
  status: 'disconnected' | 'hosting' | 'joining' | 'connected' | 'error' | 'partner_left';
  roomCode: string | null;
  remoteProfile: UserProfile | null;
  activeGame: GameMode;
  error: string | null;
}

interface MultiplayerContextType extends MultiplayerState {
  hostRoom: (code: string, profile: UserProfile) => void;
  joinRoom: (code: string, profile: UserProfile) => void;
  leaveRoom: () => void;
  setGame: (game: GameMode) => void;
  sendMessage: (msg: MultiplayerMessage) => void;
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
  });

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

    const peer = new Peer(getPeerId(code));
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

    const peer = new Peer();
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

  return (
    <MultiplayerContext.Provider value={{
      ...state,
      hostRoom,
      joinRoom,
      leaveRoom,
      setGame,
      sendMessage,
      messageListener
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
};
