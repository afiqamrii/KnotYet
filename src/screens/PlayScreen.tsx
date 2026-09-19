import React, { lazy, useMemo, useState } from 'react';
import { Layers, Heart, Users, Sparkles, RotateCw, Music, Volume2, VolumeX, Check, MessageCircle, X, Gamepad2, Clock3, ArrowUpRight, MousePointerClick } from 'lucide-react';
import { SWIPE_CARDS, type CardCategory } from '../data/questions';
import { getShuffledSwipeCards, getSwipeCardsByIds, markQuestionAsSeen } from '../utils/questionManager';
import { SwipeCard } from '../components/SwipeCard';
import { RoomModal } from '../components/RoomModal';
import { SummaryModal } from '../components/SummaryModal';
import { getAvatar } from '../components/AvatarPicker';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, type GameMode, type MultiplayerMessage } from '../store/MultiplayerContext';
import { useFriends } from '../store/FriendsContext';
import { InGameChat } from '../components/InGameChat';
import { sounds } from '../utils/audio';
import { EndGameModal } from '../components/EndGameModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { BrandMark } from '../components/ArcadeArt';
import { GameModeNav } from '../components/GameModeNav';
import { MultiplayerWaitingRoom } from '../components/MultiplayerWaitingRoom';
import '../styles/play.css';
import '../styles/play-layout.css';
import { clearStorageKeys, GAME_SESSION_KEYS, readJson, readStringUnion, STORAGE_KEYS, writeJson } from '../utils/storage';

const CoupleGuessGame = lazy(() => import('../components/CoupleGuessGame').then((module) => ({ default: module.CoupleGuessGame })));
const SpinWheel = lazy(() => import('../components/SpinWheel').then((module) => ({ default: module.SpinWheel })));
const MatchGame = lazy(() => import('../components/MatchGame').then((module) => ({ default: module.MatchGame })));
const NumberGuesserGame = lazy(() => import('../components/NumberGuesserGame').then((module) => ({ default: module.NumberGuesserGame })));
const SecretNumberRaceGame = lazy(() => import('../components/SecretNumberRaceGame').then((module) => ({ default: module.SecretNumberRaceGame })));
const LetterRaceGame = lazy(() => import('../components/LetterRaceGame').then((module) => ({ default: module.LetterRaceGame })));
const FriendsModal = lazy(() => import('../components/FriendsModal').then((module) => ({ default: module.FriendsModal })));
const ProfileScreen = lazy(() => import('./ProfileScreen').then((module) => ({ default: module.ProfileScreen })));
const GameIntro = lazy(() => import('../components/GameIntro').then((module) => ({ default: module.GameIntro })));
const MultiplayerLobby = lazy(() => import('../components/MultiplayerLobby').then((module) => ({ default: module.MultiplayerLobby })));

type ActiveTab = Exclude<GameMode, 'lobby'>;
const ACTIVE_TABS: readonly ActiveTab[] = ['swipe', 'quiz', 'wheel', 'match', 'number', 'letter', 'secret-race'];
const isActiveTab = (value: string | null): value is ActiveTab => value !== null && ACTIVE_TABS.includes(value as ActiveTab);
export const PlayScreen: React.FC = () => {
  const { profile, partner, t, addHeartPoints, recordAnsweredQuestion } = useGame();
  const { couple, progress, isLoading, checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const friends = useFriends();
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);

  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    const storedTab = localStorage.getItem('knotyet_activeTab');
    return isActiveTab(storedTab) ? storedTab : 'swipe';
  });

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    localStorage.setItem('knotyet_activeTab', tab);
  };
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>(() =>
    readStringUnion(sessionStorage, 'swipe_category', ['all', 'teka-teki', 'vibe-check', 'taaruf-realiti', 'dare-santai'] as const, 'all')
  );
  const [cardIndex, setCardIndex] = useState(() => Number(sessionStorage.getItem('swipe_index')) || 0);
  const [roundCounter, setRoundCounter] = useState(0);
  // Keep the current deck stable while progress syncs in the background. A new
  // round reads this ref, so previously shown cards are still excluded without
  // removing the card that is already on screen.
  const seenQuestionIdsRef = React.useRef<string[]>(progress?.answered_questions || []);
  React.useEffect(() => {
    seenQuestionIdsRef.current = progress?.answered_questions || [];
  }, [progress?.answered_questions]);
  
  // Multiplayer SwipeCard states
  const [isCardFlipped, setIsCardFlipped] = useState(() => sessionStorage.getItem('swipe_flipped') === 'true');
  const [myCardAnswer, setMyCardAnswer] = useState<string | null>(() => sessionStorage.getItem('swipe_myAnswer'));
  const [partnerCardAnswer, setPartnerCardAnswer] = useState<string | null>(() => sessionStorage.getItem('swipe_partnerAnswer'));
  const [riddleAnswerRevealed, setRiddleAnswerRevealed] = useState(() => sessionStorage.getItem('swipe_riddleRevealed') === 'true');
  React.useEffect(() => {
    sessionStorage.setItem('swipe_category', selectedCategory);
    sessionStorage.setItem('swipe_index', String(cardIndex));
    sessionStorage.setItem('swipe_flipped', String(isCardFlipped));
    sessionStorage.setItem('swipe_riddleRevealed', String(riddleAnswerRevealed));
    if (myCardAnswer) sessionStorage.setItem('swipe_myAnswer', myCardAnswer);
    else sessionStorage.removeItem('swipe_myAnswer');
    if (partnerCardAnswer) sessionStorage.setItem('swipe_partnerAnswer', partnerCardAnswer);
    else sessionStorage.removeItem('swipe_partnerAnswer');
  }, [selectedCategory, cardIndex, isCardFlipped, riddleAnswerRevealed, myCardAnswer, partnerCardAnswer]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(() => sessionStorage.getItem('knotyet_openRoom') === 'true');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpenState] = useState(() => sessionStorage.getItem('knotyet_isProfileOpen') === 'true');
  const setIsProfileOpen = (val: boolean) => {
    setIsProfileOpenState(val);
    sessionStorage.setItem('knotyet_isProfileOpen', String(val));
  };
  const [isMusicMenuOpen, setIsMusicMenuOpen] = useState(false);
  const [effectsMuted, setEffectsMuted] = useState(sounds.effectsMuted);
  const [musicMuted, setMusicMuted] = useState(sounds.musicMuted);
  const [currentTrack, setCurrentTrack] = useState(sounds.currentTrackIndex);
  const [effectVolume, setEffectVolume] = useState(sounds.effectVolume);
  const [musicVolume, setMusicVolume] = useState(sounds.musicVolume);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const sessionRestoredRef = React.useRef(false);

  React.useEffect(() => {
    sessionStorage.removeItem('knotyet_openRoom');
  }, []);

  // Track which game intros have been shown this session (so it only shows once per game per session)
  const [introShown, setIntroShown] = useState<Record<string, boolean>>(() => {
    try {
      return readJson<Record<string, boolean>>(sessionStorage, STORAGE_KEYS.introShown, {});
    } catch { return {}; }
  });

  const markIntroShown = (tab: ActiveTab) => {
    setIntroShown(prev => {
      const next = { ...prev, [tab]: true };
      writeJson(sessionStorage, STORAGE_KEYS.introShown, next);
      return next;
    });
  };

  const markIntroNotShown = (tab: ActiveTab) => {
    setIntroShown(prev => {
      const next = { ...prev, [tab]: false };
      writeJson(sessionStorage, STORAGE_KEYS.introShown, next);
      return next;
    });
  };

  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);

  const handleEndGame = () => {
    setIsEndGameModalOpen(true);
  };

  const confirmEndGame = () => {
    const currentTabToReset = multiplayer.status === 'connected' && multiplayer.activeGame !== 'lobby'
      ? multiplayer.activeGame
      : activeTab;
    const stored = readJson<Record<string, boolean>>(sessionStorage, STORAGE_KEYS.introShown, {});
    stored[currentTabToReset] = false;
    stored[activeTab] = false;
    writeJson(sessionStorage, STORAGE_KEYS.introShown, stored);
    
    // Clear all game-specific session states
    clearStorageKeys(sessionStorage, GAME_SESSION_KEYS);
    setCardIndex(0);
    setRoundCounter(value => value + 1);
    setIsCardFlipped(false);
    setMyCardAnswer(null);
    setPartnerCardAnswer(null);
    setRiddleAnswerRevealed(false);

    setIntroShown(stored);

    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'END_GAME' });
      multiplayer.setGame('lobby');
    }
  };

  const isPlayingGame = multiplayer.status === 'connected'
    ? (multiplayer.activeGame !== 'lobby')
    : (introShown[activeTab] === true);

  const previousTab = React.useRef<ActiveTab | 'lobby'>('lobby');

  // Timer effect
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    // Process pending multiplayer room (from URL invite)
    const pendingRoom = sessionStorage.getItem('pendingRoomCode');
    if (pendingRoom && profile && multiplayer.status === 'disconnected') {
      sessionStorage.removeItem('pendingRoomCode');
      multiplayer.joinRoom(pendingRoom, profile);
      setIsRoomModalOpen(true);
      return; // prevent falling through to restore
    }

    // Process session restoration (auto-reconnect on refresh)
    if (sessionRestoredRef.current) return;
    
    const savedRoomCode = sessionStorage.getItem('mp_roomCode');
    const savedIsHost = sessionStorage.getItem('mp_isHost');
    const savedActiveGame = sessionStorage.getItem('mp_activeGame');
    
    if (savedRoomCode && profile && multiplayer.status === 'disconnected') {
      sessionRestoredRef.current = true;
      if (isActiveTab(savedActiveGame)) previousTab.current = savedActiveGame;
      if (savedIsHost === 'true') {
        multiplayer.hostRoom(savedRoomCode, profile, true);
      } else {
        multiplayer.joinRoom(savedRoomCode, profile, true);
      }
      setIsRoomModalOpen(true);
      if (savedActiveGame) {
        if (isActiveTab(savedActiveGame)) setActiveTab(savedActiveGame);
      }
    }
  }, [profile, multiplayer.joinRoom, multiplayer.hostRoom, multiplayer.status]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync tab with multiplayer game
  const currentTab: ActiveTab = multiplayer.status === 'connected' && multiplayer.activeGame !== 'lobby'
    ? multiplayer.activeGame
    : activeTab;

  // ---- Filtered Cards (Dynamic Shuffle & Non-Repeating) ----
  const localSwipeCards = useMemo(() => {
    // isLoading changing to false creates the first real deck from cloud
    // history. After that, the ref keeps a round steady while answers sync.
    const seenIds = isLoading ? seenQuestionIdsRef.current : (progress?.answered_questions || seenQuestionIdsRef.current);
    const savedDeck = readJson<{ category: string; ids: string[] } | null>(sessionStorage, 'swipe_deck', null);
    if (roundCounter === 0 && savedDeck?.category === selectedCategory && Array.isArray(savedDeck.ids) && savedDeck.ids.length > 0) {
      const restored = getSwipeCardsByIds(savedDeck.ids);
      if (restored.length === savedDeck.ids.length) return restored;
    }
    const fresh = getShuffledSwipeCards(selectedCategory, 15, seenIds);
    writeJson(sessionStorage, 'swipe_deck', { category: selectedCategory, ids: fresh.map(card => card.id) });
    return fresh;
  }, [selectedCategory, roundCounter, isLoading]);
  const filteredCards = useMemo(() => {
    if (multiplayer.status === 'connected' && !multiplayer.isHost) {
      return getSwipeCardsByIds(multiplayer.questionDecks.swipe || []);
    }
    return localSwipeCards;
  }, [localSwipeCards, multiplayer.status, multiplayer.isHost, multiplayer.questionDecks.swipe]);

  // Host broadcasts the card deck to the joining player for synchronized cards
  React.useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && currentTab === 'swipe' && filteredCards.length > 0) {
      multiplayer.sendMessage({
        type: 'SYNC_QUESTION_IDS',
        payload: { game: 'swipe', questionIds: filteredCards.map(c => c.id), currentIndex: cardIndex }
      });
    }
  }, [multiplayer.status, multiplayer.isHost, currentTab, selectedCategory, roundCounter, filteredCards, cardIndex]);
  React.useEffect(() => {
    if (multiplayer.status === 'connected' && !multiplayer.isHost && multiplayer.questionDecks.swipe) {
      setCardIndex(multiplayer.questionIndices.swipe || 0);
    }
  }, [multiplayer.status, multiplayer.isHost, multiplayer.questionDecks.swipe, multiplayer.questionIndices.swipe]);


  // Monitor game start in multiplayer
  React.useEffect(() => {
    if (multiplayer.status === 'connected') {
      setIsRoomModalOpen(false);
      sounds.playBGM();
      
      // Ensure intro screen is shown when transitioning from lobby to a game
      if (multiplayer.activeGame !== 'lobby' && previousTab.current === 'lobby') {
        incrementPlayCount('multiplayer');
        markIntroNotShown(multiplayer.activeGame);
      }
    } else {
      sounds.stopBGM();
    }
    
    // Fallback if Match Game is active but we are offline
    if (multiplayer.status !== 'connected' && !sessionRestoredRef.current && activeTab === 'match') {
      setActiveTab('swipe');
    }
    
    if (multiplayer.status === 'disconnected' && !sessionStorage.getItem('mp_roomCode')) {
      sessionRestoredRef.current = false;
    }
    if (multiplayer.status === 'connected') previousTab.current = multiplayer.activeGame;
    else if (multiplayer.status === 'disconnected' && !sessionRestoredRef.current) previousTab.current = 'lobby';
  }, [multiplayer.status, multiplayer.activeGame, activeTab, incrementPlayCount]);



  const handleTabClick = (tab: ActiveTab) => {
    sounds.playFlip();
    setActiveTab(tab);
    if (multiplayer.status === 'connected') {
      markIntroNotShown(tab);
      multiplayer.setGame(tab);
    }
  };

  const executeSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') setAnsweredCount((p) => p + 1);
    else setSkippedCount((p) => p + 1);

    setIsCardFlipped(false);
    setMyCardAnswer(null);
    setPartnerCardAnswer(null);
    setRiddleAnswerRevealed(false);
    
    const currentCard = filteredCards[cardIndex];
    if (currentCard) {
      recordAnsweredQuestion(currentCard.id);
      markQuestionAsSeen(currentCard.id);
    }

    if (cardIndex + 1 < filteredCards.length) {
      setCardIndex((p) => p + 1);
    } else {
      if (multiplayer.status !== 'connected') incrementPlayCount('solo');
      setIsSummaryOpen(true);
      addHeartPoints(HEART_POINTS.COMPLETE_DECK, multiplayer.status === 'connected');
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (multiplayer.status !== 'connected' && !checkLimit('solo')) {
      return;
    }

    if (multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'SWIPE_ACTION', payload: { direction } });
    }
    executeSwipe(direction);
  };

  React.useEffect(() => {
    if (multiplayer.status === 'connected') {
      return multiplayer.subscribeMessage((msg: MultiplayerMessage) => {
        if (msg.type === 'START_GAME' && isActiveTab(msg.payload.game)) {
          markIntroShown(msg.payload.game);
        } else if (msg.type === 'END_GAME') {
          const currentTabToReset = multiplayer.activeGame !== 'lobby' ? multiplayer.activeGame : activeTab;
          const stored = readJson<Record<string, boolean>>(sessionStorage, STORAGE_KEYS.introShown, {});
          stored[currentTabToReset] = false;
          writeJson(sessionStorage, STORAGE_KEYS.introShown, stored);
          clearStorageKeys(sessionStorage, GAME_SESSION_KEYS);
          setCardIndex(0);
          setRoundCounter(value => value + 1);
          setIsCardFlipped(false);
          setMyCardAnswer(null);
          setPartnerCardAnswer(null);
          setRiddleAnswerRevealed(false);
          setIntroShown(stored);
        } else if (msg.type === 'SWIPE_ACTION' && currentTab === 'swipe') {
          executeSwipe(msg.payload.direction);
        } else if (msg.type === 'RIDDLE_REVEAL' && currentTab === 'swipe') {
          setRiddleAnswerRevealed(true);
        } else if (msg.type === 'CARD_SUBMIT' && currentTab === 'swipe') {
          setPartnerCardAnswer(msg.payload);
        }
      });
    }
  }, [multiplayer.status, currentTab, multiplayer.subscribeMessage, cardIndex, filteredCards, activeTab, multiplayer.activeGame]);

  // A refreshed peer can rejoin after the original answer packet was sent.
  // Re-send the local commitment once the shared deck is available again.
  React.useEffect(() => {
    if (multiplayer.status !== 'connected' || currentTab !== 'swipe' || !filteredCards[cardIndex]) return;
    if (myCardAnswer) multiplayer.sendMessage({ type: 'CARD_SUBMIT', payload: myCardAnswer });
    if (riddleAnswerRevealed && filteredCards[cardIndex].category === 'teka-teki') {
      multiplayer.sendMessage({ type: 'RIDDLE_REVEAL' });
    }
  }, [multiplayer.status, currentTab, filteredCards, cardIndex, myCardAnswer, riddleAnswerRevealed]);

  const currentCard = filteredCards[cardIndex];
  const isRiddleAsker = currentCard?.category === 'teka-teki'
    ? ((cardIndex % 2 === 0) ? !!multiplayer.isHost : !multiplayer.isHost)
    : true;
  const canAdvanceCurrentCard = !currentCard || multiplayer.status !== 'connected'
    ? true
    : currentCard.category === 'teka-teki'
      ? isRiddleAsker && Boolean(partnerCardAnswer) && riddleAnswerRevealed
      : Boolean(myCardAnswer && partnerCardAnswer);

  // A card counts as seen as soon as it is displayed. This avoids resurfacing
  // an abandoned prompt after a refresh or on another device.
  React.useEffect(() => {
    if (currentTab !== 'swipe' || !introShown.swipe || !currentCard || isSummaryOpen) return;
    markQuestionAsSeen(currentCard.id);
    recordAnsweredQuestion(currentCard.id);
  }, [currentTab, introShown.swipe, currentCard?.id, isSummaryOpen, recordAnsweredQuestion]);
  const nextCard = filteredCards[cardIndex + 1];
  const thirdCard = filteredCards[cardIndex + 2];
  const fourthCard = filteredCards[cardIndex + 3];
  const fifthCard = filteredCards[cardIndex + 4];

  const handleManualAction = (direction: 'left' | 'right') => {
    sounds.playSwipe();
    handleSwipe(direction);
  };

  // Desktop keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close open modals on Escape
      if (e.key === 'Escape') {
        if (isEndGameModalOpen) { setIsEndGameModalOpen(false); return; }
        if (isFriendsModalOpen) { setIsFriendsModalOpen(false); return; }
        if (isRoomModalOpen) { setIsRoomModalOpen(false); return; }
        if (isProfileOpen) { setIsProfileOpen(false); return; }
        if (isMusicMenuOpen) { setIsMusicMenuOpen(false); return; }
        if (isDisconnectModalOpen) { setIsDisconnectModalOpen(false); return; }
        if (isSummaryOpen) { setIsSummaryOpen(false); return; }
        return;
      }

      // Preserve native keyboard behavior for controls, editing, and dialogs.
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.altKey || e.ctrlKey || e.metaKey || target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;

      // If any modal is open, don't trigger game hotkeys
      if (isFriendsModalOpen || isRoomModalOpen || isProfileOpen || isMusicMenuOpen || isDisconnectModalOpen || isEndGameModalOpen || isSummaryOpen) {
        return;
      }

      // Mode shortcuts belong to the game picker; active games own their keys.
      if (multiplayer.status !== 'connected' && !isPlayingGame) {
        if (e.key === '1') { handleTabClick('swipe'); return; }
        if (e.key === '2') { handleTabClick('quiz'); return; }
        if (e.key === '3') { handleTabClick('wheel'); return; }
        if (e.key === '4') { handleTabClick('number'); return; }
        if (e.key === '5') { handleTabClick('letter'); return; }
      }

      // In Swipe game:
      if (currentTab === 'swipe' && introShown['swipe']) {
        if (e.key === 'ArrowRight') {
          if (!canAdvanceCurrentCard) return;
          e.preventDefault();
          handleManualAction('right');
        } else if (e.key === 'ArrowLeft') {
          if (!canAdvanceCurrentCard) return;
          e.preventDefault();
          handleManualAction('left');
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          if (currentCard?.category === 'teka-teki' && multiplayer.status === 'connected' && !isRiddleAsker) return;
          e.preventDefault();
          setIsCardFlipped(prev => {
            const next = !prev;
            sounds.playFlip();
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEndGameModalOpen, isFriendsModalOpen, isRoomModalOpen, isProfileOpen, 
    isMusicMenuOpen, isDisconnectModalOpen, isSummaryOpen, multiplayer.status, 
    currentTab, introShown, handleSwipe, handleTabClick, isCardFlipped, isPlayingGame,
    currentCard?.category, isRiddleAsker, canAdvanceCurrentCard
  ]);

  const handleRestartDeck = () => {
    sessionStorage.removeItem('swipe_deck');
    setCardIndex(0);
    setAnsweredCount(0);
    setSkippedCount(0);
    setRoundCounter(prev => prev + 1); // Trigger new cards
    setIsSummaryOpen(false);
  };

  const handleCategoryChange = (cat: CardCategory | 'all') => {
    sounds.playFlip();
    sessionStorage.removeItem('swipe_deck');
    setIsCardFlipped(false);
    setMyCardAnswer(null);
    setPartnerCardAnswer(null);
    setRiddleAnswerRevealed(false);
    setSelectedCategory(cat);
    setCardIndex(0);
    setAnsweredCount(0);
    setSkippedCount(0);
  };

  // Category tab config
  const categories = [
    { key: 'all' as const, label: t.catAll, count: SWIPE_CARDS.length, color: '#7C3AED', bg: '#EDE9FE' },
    { key: 'teka-teki' as const, label: t.catRiddles, count: SWIPE_CARDS.filter(c => c.category === 'teka-teki').length, color: '#F59E0B', bg: '#FEF3C7' },
    { key: 'vibe-check' as const, label: t.catVibeCheck, count: SWIPE_CARDS.filter(c => c.category === 'vibe-check').length, color: '#06B6D4', bg: '#CFFAFE' },
    { key: 'taaruf-realiti' as const, label: t.catTaaruf, count: SWIPE_CARDS.filter(c => c.category === 'taaruf-realiti').length, color: '#FF2D9B', bg: '#FCE7F3' },
  ];

  // Keep every hook above conditional renders so connection-state transitions
  // cannot change React's hook order and crash the play screen.
  // Routes handle redirects; just show loading if AppInner rendered while loading
  if (isLoading) return <LoadingScreen />;

  // ---- Multiplayer Waiting / Connecting Overlay ----
  if (multiplayer.status === 'hosting' || multiplayer.status === 'joining') {
    return <MultiplayerWaitingRoom status={multiplayer.status} roomCode={multiplayer.roomCode} profile={profile} onCancel={() => multiplayer.leaveRoom()} />;
  }

  return (
    <div className="play-shell arcade-play" data-game={currentTab} data-playing={isPlayingGame}>
      <div className="arcade-play-decoration" aria-hidden="true">
        <span className="arcade-decoration-star"><Sparkles /></span>
        <span className="arcade-decoration-heart"><Heart /></span>
      </div>

      <div className="play-console">
        <div className="arcade-brand-strip">
          <div className="arcade-play-brand"><BrandMark />KnotYet</div>
          <span className="arcade-brand-message">A little time. Just for you two.</span>
          <div className="arcade-session-controls">
            {isPlayingGame && <button type="button" className="arcade-icon-button global-sound-toggle" aria-label={musicMuted ? 'Turn music on' : 'Mute music'} title={musicMuted ? 'Turn music on' : 'Mute music'} onClick={() => setMusicMuted(sounds.toggleMusicMute())}>{musicMuted ? <VolumeX aria-hidden="true" /> : <Music aria-hidden="true" />}</button>}
            {isPlayingGame && <button type="button" className="arcade-icon-button global-sound-toggle" aria-label={effectsMuted ? 'Turn tap sounds on' : 'Mute tap sounds'} title={effectsMuted ? 'Turn tap sounds on' : 'Mute tap sounds'} onClick={() => setEffectsMuted(sounds.toggleEffectsMute())}>{effectsMuted ? <VolumeX aria-hidden="true" /> : <MousePointerClick aria-hidden="true" />}</button>}
            {isPlayingGame && <button type="button" className="game-end-button global-end-game" onClick={handleEndGame}><X size={15} aria-hidden="true" /> End Game</button>}
            <span className="arcade-session-clock" aria-label={`Session time ${formatTime(sessionSeconds)}`}><Clock3 aria-hidden="true" /> {formatTime(sessionSeconds)}</span>
          </div>
        </div>

        {!isPlayingGame && (
          <header className="play-header arcade-play-header">
            <div className="arcade-account-row">
              <button onClick={() => { sounds.playFlip(); setIsProfileOpen(true); }} className="arcade-profile-button" aria-label="Open your profile">
                <span className="arcade-profile-avatars" aria-hidden="true">
                  <span>{getAvatar(profile?.avatarId || 'default')?.face}</span>
                  {partner ? <span>{getAvatar(partner.avatarId)?.face}</span> : null}
                </span>
                <span className="arcade-profile-copy">
                  <strong>{partner ? `${profile?.name} & ${partner.name}` : profile?.name || 'Your profile'}</strong>
                  <span><Heart aria-hidden="true" fill="currentColor" /> {profile?.heartPoints || 0} hearts{couple ? ` · ${couple.couple_points} shared` : ''}</span>
                </span>
                <ArrowUpRight className="arcade-profile-arrow" aria-hidden="true" />
              </button>

              <div className="arcade-header-actions">
                <button type="button" onClick={() => { sounds.playFlip(); setIsFriendsModalOpen(true); }} aria-label="Friends and messages" title="Friends and messages" className="arcade-icon-button">
                  <MessageCircle aria-hidden="true" />
                  {friends.unreadTotal > 0 ? <span className="arcade-unread-badge">{friends.unreadTotal}</span> : null}
                </button>
                <div className="arcade-music-control">
                  <button type="button" onClick={() => setIsMusicMenuOpen(!isMusicMenuOpen)} aria-label="Sound settings" aria-expanded={isMusicMenuOpen} title="Set the mood" className="arcade-icon-button">
                    {musicMuted && effectsMuted ? <VolumeX aria-hidden="true" /> : <Music aria-hidden="true" />}
                  </button>
                  {isMusicMenuOpen && (
                    <div className="arcade-music-menu">
                      <div className="arcade-music-heading"><span>Your sound mix</span><small>Set each one your way</small></div>
                      <div className="sound-channel">
                        <div className="sound-channel-head"><label htmlFor="music-volume"><Music aria-hidden="true" /> Music <span>{Math.round(musicVolume * 100)}%</span></label><button type="button" onClick={() => setMusicMuted(sounds.toggleMusicMute())} aria-label={musicMuted ? 'Turn music on' : 'Mute music'} aria-pressed={musicMuted}>{musicMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</button></div>
                        <input id="music-volume" type="range" min="0" max="100" step="5" value={Math.round(musicVolume * 100)} onChange={event => { const value = Number(event.target.value) / 100; sounds.setMusicVolume(value); setMusicVolume(value); }} />
                        <p>{musicMuted ? 'Music is paused.' : 'Background mood while you play.'}</p>
                      </div>
                      <div className="sound-channel">
                        <div className="sound-channel-head"><label htmlFor="effects-volume"><MousePointerClick aria-hidden="true" /> Taps & game sounds <span>{Math.round(effectVolume * 100)}%</span></label><button type="button" onClick={() => setEffectsMuted(sounds.toggleEffectsMute())} aria-label={effectsMuted ? 'Turn tap sounds on' : 'Mute tap sounds'} aria-pressed={effectsMuted}>{effectsMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</button></div>
                        <input id="effects-volume" type="range" min="0" max="100" step="5" value={Math.round(effectVolume * 100)} onChange={event => { const value = Number(event.target.value) / 100; sounds.setEffectVolume(value); setEffectVolume(value); }} onPointerUp={() => sounds.playFlip()} onKeyUp={() => sounds.playFlip()} />
                        <p>{effectsMuted ? 'Tap sounds are muted.' : 'Cheerful taps, flips, and wins.'}</p>
                      </div>
                      {sounds.tracks.map((track, idx) => (
                        <button type="button" key={idx} onClick={() => { sounds.setTrack(idx); setCurrentTrack(idx); }} className="arcade-track-button" aria-pressed={currentTrack === idx}>
                          {track.name}{currentTrack === idx ? <Check aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button"
                  onClick={() => {
                    if (multiplayer.status === 'connected') setIsDisconnectModalOpen(true);
                    else { if (!checkLimit('multiplayer')) return; setIsRoomModalOpen(true); }
                  }}
                  className="play-together-button arcade-invite-button"
                >
                  <Users aria-hidden="true" />
                  <span>{multiplayer.status === 'connected' ? 'Leave room' : t.playTogether}</span>
                  <ArrowUpRight aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="arcade-play-welcome">
              <div>
                <span className="arcade-eyebrow"><Gamepad2 aria-hidden="true" /> YOUR DATE-NIGHT ARCADE</span>
                <h1>Less scrolling.<br className="arcade-mobile-break" /> <span>More us.</span></h1>
                <p>{multiplayer.status === 'connected' ? 'Your person is here. Let the good times begin.' : 'Pick a game, grab your person, and make a little memory.'}</p>
              </div>
              <div className="arcade-together-sticker" aria-hidden="true"><Heart fill="currentColor" /><span>Good times<br />come in twos.</span><Sparkles /></div>
            </div>

            {multiplayer.status !== 'connected' && (
              <GameModeNav currentTab={currentTab} onSelect={handleTabClick}
                labels={{ swipe: t.tabSwipe, quiz: t.tabQuiz, wheel: t.tabWheel, number: t.tabNumber || 'Number Guesser', letter: t.tabLetter || 'Letter Race', 'secret-race': 'Secret Number Race' }}
              />
            )}
          </header>
        )}

        <main className="arcade-play-main">
          {multiplayer.status === 'connected' && multiplayer.activeGame === 'lobby' ? (
            <MultiplayerLobby 
              onSelectGame={(game) => {
                if (!isActiveTab(game)) return;
                markIntroNotShown(game);
                multiplayer.setGame(game);
              }}
              onDisconnect={() => setIsDisconnectModalOpen(true)}
            />
          ) : (
            <>
              {currentTab === 'swipe' && (
                introShown['swipe'] ? (
                  <div className="arcade-card-game w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full space-y-2 sm:space-y-3 animate-fade-in mx-auto">
                    {/* Standardized Game Header */}
                    <div className="game-toolbar w-full flex items-center justify-between px-3 py-2 rounded-2xl shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
                          style={{ background: 'linear-gradient(135deg, #FF2D9B, #EC4899)' }}>
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Icebreaker Cards</h2>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
                            <span>{t.cardCount(cardIndex + 1, filteredCards.length)}</span>
                            <span className="flex items-center gap-1.5 ml-1">
                              <span className="font-black px-1.5 py-0.2 rounded-full text-white text-[9px] bg-emerald-500">✓ {answeredCount}</span>
                              <span className="font-black px-1.5 py-0.2 rounded-full text-white text-[9px] bg-pink-500">✕ {skippedCount}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleEndGame} className="game-end-button text-xs font-bold transition px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95">
                        End Game
                      </button>
                    </div>
                    
                    {/* Category Selector Pills */}
                    <div className="arcade-category-list w-full flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0" aria-label="Card categories">
                      {categories.map(cat => (
                        <button
                          key={cat.key}
                          onClick={() => handleCategoryChange(cat.key as CardCategory | 'all')}
                          aria-pressed={selectedCategory === cat.key}
                          className="game-category-pill px-3 py-1 rounded-full whitespace-nowrap text-xs font-black transition active:scale-95 flex-shrink-0"
                          style={selectedCategory === cat.key ? {
                            background: cat.color,
                            color: 'white',
                            boxShadow: `0 4px 12px ${cat.color}50`,
                          } : {
                            background: 'rgba(255,255,255,0.9)',
                            color: cat.color,
                            border: `1.5px solid ${cat.color}30`,
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Card Stack Area - Full Height Elastic */}
                    <div className="arcade-card-stack relative w-full flex-1 min-h-[300px] sm:min-h-[340px] md:min-h-[390px] lg:min-h-[430px] select-none my-auto flex items-center justify-center py-1 sm:py-2">
                      {fifthCard && <SwipeCard key={fifthCard.id} card={fifthCard} cardIndex={cardIndex + 4} stackDepth={4} onSwipe={handleSwipe} isTop={false} />}
                      {fourthCard && <SwipeCard key={fourthCard.id} card={fourthCard} cardIndex={cardIndex + 3} stackDepth={3} onSwipe={handleSwipe} isTop={false} />}
                      {thirdCard && <SwipeCard key={thirdCard.id} card={thirdCard} cardIndex={cardIndex + 2} stackDepth={2} onSwipe={handleSwipe} isTop={false} />}
                      {nextCard && <SwipeCard key={nextCard.id} card={nextCard} cardIndex={cardIndex + 1} stackDepth={1} onSwipe={handleSwipe} isTop={false} />}
                      {currentCard ? (
                        <SwipeCard 
                          key={currentCard.id} 
                          card={currentCard} 
                          cardIndex={cardIndex}
                          stackDepth={0}
                          onSwipe={handleSwipe} 
                          isTop={true} 
                          isFlipped={isCardFlipped}
                          onToggleFlip={(flipped) => {
                            setIsCardFlipped(flipped);
                          }}
                          myAnswer={myCardAnswer}
                          partnerAnswer={partnerCardAnswer}
                          answerRevealedToPartner={riddleAnswerRevealed}
                          onRevealToPartner={() => {
                            setRiddleAnswerRevealed(true);
                            if (multiplayer.status === 'connected') multiplayer.sendMessage({ type: 'RIDDLE_REVEAL' });
                          }}
                          onSubmitAnswer={(ans) => {
                            setMyCardAnswer(ans);
                            if (multiplayer.status === 'connected') {
                              multiplayer.sendMessage({ type: 'CARD_SUBMIT', payload: ans });
                            }
                          }}
                        />
                      ) : (
                        <div className="game-card w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl animate-float"
                            style={{ background: 'linear-gradient(135deg, #FACC15, #F97316)' }}>
                            <Sparkles className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="font-black text-ink text-xl">{multiplayer.status === 'connected' && !multiplayer.isHost ? 'Getting your shared cards...' : t.allCardsTitle}</h3>
                          <p className="text-sm text-ink-3">{multiplayer.status === 'connected' && !multiplayer.isHost ? 'Your partner’s deck is syncing now.' : t.allCardsSub}</p>
                          {(multiplayer.status !== 'connected' || multiplayer.isHost) && <button onClick={handleRestartDeck} className="btn-chunky btn-pink text-sm px-6">
                            <RotateCw className="w-4 h-4" /> {t.playAgain}
                          </button>}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar: Skip, Flip (if flippable), and Pass */}
                    <div className="w-full shrink-0 pt-1 flex items-center gap-2 sm:gap-3">
                      {/* Skip button */}
                      <button 
                        onClick={() => handleManualAction('left')} 
                        disabled={!currentCard || !canAdvanceCurrentCard}
                        title="Skip Question (Left Arrow ←)"
                        className="game-action game-action-skip flex-1 py-3 sm:py-3.5 px-2 sm:px-4 font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 group"
                      >
                        <X className="w-4 h-4 stroke-[3] group-hover:scale-110 transition-transform text-pink-500" />
                        <span>{t.skipLabel || 'Skip'}</span>
                        <span className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-100 text-pink-600 font-bold">←</span>
                      </button>

                      {/* Pass / Next button */}
                      <button 
                        onClick={() => handleManualAction('right')} 
                        disabled={!currentCard || !canAdvanceCurrentCard}
                        title="Pass / Next Question (Right Arrow →)"
                        className="game-action game-action-next flex-1 py-3 sm:py-3.5 px-2 sm:px-4 font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 group"
                        style={{ boxShadow: '0 4px 0 #059669, 0 6px 16px rgba(16,185,129,0.35)' }}
                      >
                        <Check className="w-4 h-4 stroke-[3] group-hover:scale-110 transition-transform" />
                        <span>{t.passLabel || 'Next'}</span>
                        <span className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold">→</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <GameIntro gameType="swipe" onStart={() => markIntroShown('swipe')} />
                )
              )}

              {currentTab === 'quiz' && (
                introShown['quiz']
                  ? <CoupleGuessGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="quiz" onStart={() => markIntroShown('quiz')} />
              )}
              {currentTab === 'wheel' && (
                introShown['wheel']
                  ? <SpinWheel onEndGame={handleEndGame} reservedQuestionIds={filteredCards.map(card => card.id)} />
                  : <GameIntro gameType="wheel" onStart={() => markIntroShown('wheel')} />
              )}
              {currentTab === 'match' && (
                introShown['match']
                  ? <MatchGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="match" onStart={() => markIntroShown('match')} />
              )}
              {currentTab === 'number' && (
                introShown['number']
                  ? <NumberGuesserGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="number" onStart={() => markIntroShown('number')} />
              )}
              {currentTab === 'secret-race' && (
                introShown['secret-race']
                  ? <SecretNumberRaceGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="secret-race" onStart={() => markIntroShown('secret-race')} />
              )}
              {currentTab === 'letter' && (
                introShown['letter']
                  ? <LetterRaceGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="letter" onStart={() => markIntroShown('letter')} />
              )}
            </>
          )}
        </main>

        <footer className="arcade-play-footer">
          <span><Heart aria-hidden="true" /> A little play goes a long way.</span>
          <span className="arcade-session-status"><i /> {multiplayer.status === 'connected' ? 'Playing together, wherever you are' : 'Same couch? Share a screen. Apart? Play together.'}</span>
        </footer>

        <RoomModal 
          isOpen={isRoomModalOpen} 
          onClose={() => setIsRoomModalOpen(false)} 
        />

        <SummaryModal
          isOpen={isSummaryOpen}
          answeredCount={answeredCount}
          skippedCount={skippedCount}
          categoryLabel={selectedCategory === 'all' ? t.catAll : selectedCategory}
          onRestart={handleRestartDeck}
          onSelectCategory={() => { setIsSummaryOpen(false); setSelectedCategory('all'); }}
        />

        {isProfileOpen && (
          <ProfileScreen
            onClose={() => setIsProfileOpen(false)}
            onOpenFriends={() => setIsFriendsModalOpen(true)}
          />
        )}

        <FriendsModal
          isOpen={isFriendsModalOpen}
          onClose={() => setIsFriendsModalOpen(false)}
          onLaunchMultiplayer={(code) => {
            setIsFriendsModalOpen(false);
            if (profile) {
              multiplayer.hostRoom(code, profile);
              setIsRoomModalOpen(true);
            }
          }}
        />

        <InGameChat />

        {/* In-App End Game Confirmation Modal */}
        <EndGameModal
          isOpen={isEndGameModalOpen}
          onClose={() => setIsEndGameModalOpen(false)}
          onConfirm={confirmEndGame}
          isMultiplayer={multiplayer.status === 'connected'}
          gameTitle={
            currentTab === 'swipe' ? 'Icebreaker Cards' :
            currentTab === 'quiz' ? 'Guess My Heart' :
            currentTab === 'wheel' ? 'Anti-Awkward Wheel' :
            currentTab === 'match' ? 'Couple Match' :
            currentTab === 'number' ? 'Number Guesser' :
            currentTab === 'secret-race' ? 'Secret Number Race' :
            currentTab === 'letter' ? 'Letter Race' : 'Game'
          }
        />
        
        {/* Custom Disconnect Modal for Main App */}
        {isDisconnectModalOpen && multiplayer.status === 'connected' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-pop-in">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-ink mb-2">Disconnect?</h3>
              <p className="text-sm text-ink-3 mb-6">Are you sure you want to leave the room? The game will end for both of you.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsDisconnectModalOpen(false)} className="flex-1 py-3 rounded-2xl font-bold text-ink-3 bg-stone-100 hover:bg-stone-200 transition">
                  Cancel
                </button>
                <button onClick={() => { setIsDisconnectModalOpen(false); multiplayer.leaveRoom(); }} className="flex-1 py-3 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-lg shadow-red-500/30">
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Partner Left Modal */}
        {multiplayer.status === 'partner_left' && (
          <div className="partner-away-overlay" role="presentation">
            <section className="partner-away-card" role="alertdialog" aria-modal="true" aria-labelledby="partner-away-title" aria-describedby="partner-away-description">
              <div className="partner-away-icon" aria-hidden="true"><Users /></div>
              <span className="partner-away-kicker">A LITTLE PAUSE</span>
              <h3 id="partner-away-title">Your partner disconnected</h3>
              <p id="partner-away-description">Keep this room open if they are coming back. Your game can continue when you reconnect.</p>
              <div className="partner-away-status"><span aria-hidden="true" /> Waiting for your person</div>
              <div className="partner-away-actions">
                <button type="button" className="partner-away-leave" onClick={() => multiplayer.leaveRoom()}>Leave room</button>
              </div>
            </section>
          </div>
        )}


      </div>
    </div>
  );
};

