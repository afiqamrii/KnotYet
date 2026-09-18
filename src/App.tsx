import React, { useState, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layers, Dices, Heart, Users, Sparkles, RotateCw, Music, Volume2, VolumeX, Check, Hash, TextCursor, MessageCircle, X } from 'lucide-react';
import { SWIPE_CARDS, CardCategory } from './data/questions';
import { getShuffledSwipeCards, getSwipeCardsByIds, markQuestionAsSeen } from './utils/questionManager';
import { SwipeCard } from './components/SwipeCard';
import { CoupleGuessGame } from './components/CoupleGuessGame';
import { SpinWheel } from './components/SpinWheel';
import { MatchGame } from './components/MatchGame';
import { NumberGuesserGame } from './components/NumberGuesserGame';
import { LetterRaceGame } from './components/LetterRaceGame';
import { RoomModal } from './components/RoomModal';
import { SummaryModal } from './components/SummaryModal';
import { getAvatar } from './components/AvatarPicker';
import { GameProvider, useGame, HEART_POINTS } from './store/GameContext';
import { useAuth } from './store/AuthContext';
import { supabase } from './lib/supabase';
import { MultiplayerProvider, useMultiplayer, MultiplayerMessage } from './store/MultiplayerContext';
import { FriendsProvider, useFriends } from './store/FriendsContext';
import { InGameChat } from './components/InGameChat';
import { FriendsModal } from './components/FriendsModal';
import { LandingPage } from './screens/LandingPage';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { InviteScreen } from './screens/InviteScreen';
import { sounds } from './utils/audio';
import { GameIntro } from './components/GameIntro';
import { EndGameModal } from './components/EndGameModal';
import { MultiplayerLobby } from './components/MultiplayerLobby';

type ActiveTab = 'swipe' | 'quiz' | 'wheel' | 'match' | 'number' | 'letter';

// ---- Inner App (has access to GameContext) ----
const AppInner: React.FC = () => {
  const { profile, partner, setPartner, t, addHeartPoints, recordAnsweredQuestion } = useGame();
  const { user, couple, refreshCouple, isLoading, checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const friends = useFriends();
  const [partnerAcceptedToast, setPartnerAcceptedToast] = useState<{name: string, relationshipType: string} | null>(null);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);

  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    return (localStorage.getItem('knotyet_activeTab') as ActiveTab) || 'swipe';
  });

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    localStorage.setItem('knotyet_activeTab', tab);
  };
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');
  const [cardIndex, setCardIndex] = useState(0);
  const [roundCounter, setRoundCounter] = useState(0);
  
  // Multiplayer SwipeCard states
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [myCardAnswer, setMyCardAnswer] = useState<string | null>(null);
  const [partnerCardAnswer, setPartnerCardAnswer] = useState<string | null>(null);
  const [syncedSwipeCardIds, setSyncedSwipeCardIds] = useState<string[] | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpenState] = useState(() => sessionStorage.getItem('knotyet_isProfileOpen') === 'true');
  const setIsProfileOpen = (val: boolean) => {
    setIsProfileOpenState(val);
    sessionStorage.setItem('knotyet_isProfileOpen', String(val));
  };
  const [isMusicMenuOpen, setIsMusicMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.isMuted);
  const [currentTrack, setCurrentTrack] = useState(sounds.currentTrackIndex);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const sessionRestoredRef = React.useRef(false);

  // Track which game intros have been shown this session (so it only shows once per game per session)
  const [introShown, setIntroShown] = useState<Record<string, boolean>>(() => {
    try {
      const stored = sessionStorage.getItem('knotyet_introShown');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const markIntroShown = (tab: string, broadcast = true) => {
    setIntroShown(prev => {
      const next = { ...prev, [tab]: true };
      sessionStorage.setItem('knotyet_introShown', JSON.stringify(next));
      return next;
    });
    if (broadcast && multiplayer.status === 'connected') {
      multiplayer.sendMessage({ type: 'START_GAME', payload: { game: tab as any } });
    }
  };

  const markIntroNotShown = (tab: string) => {
    setIntroShown(prev => {
      const next = { ...prev, [tab]: false };
      sessionStorage.setItem('knotyet_introShown', JSON.stringify(next));
      return next;
    });
  };

  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);

  const handleEndGame = () => {
    setIsEndGameModalOpen(true);
  };

  const confirmEndGame = () => {
    const currentTabToReset = multiplayer.status === 'connected' ? (multiplayer.activeGame as ActiveTab) : activeTab;
    const stored = JSON.parse(sessionStorage.getItem('knotyet_introShown') || '{}');
    stored[currentTabToReset] = false;
    stored[activeTab] = false;
    sessionStorage.setItem('knotyet_introShown', JSON.stringify(stored));
    
    // Clear all game-specific session states
    sessionStorage.removeItem('num_stage');
    sessionStorage.removeItem('num_secret');
    sessionStorage.removeItem('num_guesses');
    sessionStorage.removeItem('num_round');
    sessionStorage.removeItem('letter_stage');
    sessionStorage.removeItem('letter_letter');
    sessionStorage.removeItem('guess_stage');
    sessionStorage.removeItem('guess_currentIndex');
    sessionStorage.removeItem('guess_actualAnswer');
    sessionStorage.removeItem('guess_guessedAnswer');
    sessionStorage.removeItem('guess_score');
    sessionStorage.removeItem('guess_completed');
    sessionStorage.removeItem('wheel_spin_state');
    sessionStorage.removeItem('wheel_rotation');
    sessionStorage.removeItem('wheel_selectedIdea');
    sessionStorage.removeItem('match_currentIndex');
    sessionStorage.removeItem('match_stage');
    sessionStorage.removeItem('match_myAnswer');
    sessionStorage.removeItem('match_partnerAnswer');
    sessionStorage.removeItem('match_score');
    sessionStorage.removeItem('match_completed');
    
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

  // Process deep links (invites & room codes)
  React.useEffect(() => {
    // 0. Live Sync for Partner Acceptance
    if (user) {
      const channelName = `partner_link_${user.id}`;
      const channel = supabase.channel(channelName)
        .on('broadcast', { event: 'partner_accepted' }, (payload) => {
           const data = payload.payload;
           setPartner({
             name: data.name,
             avatarId: data.avatarId,
             relationshipType: data.relationshipType,
             code: '1234'
           });
           
           refreshCouple();
           
           sounds.playSuccess();
           setPartnerAcceptedToast(data);
           setTimeout(() => setPartnerAcceptedToast(null), 5000);
        })
        .on('broadcast', { event: 'partner_unlinked' }, () => {
           setPartner(null);
           refreshCouple();
           // Optional toast for unlinking
           setPartnerAcceptedToast({ name: 'Your partner', relationshipType: 'unlinked' });
           setTimeout(() => setPartnerAcceptedToast(null), 5000);
           sounds.playFlip();
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); }
    }
  }, [user, setPartner, refreshCouple]);

  React.useEffect(() => {
    // 1. Process pending partner invite
    const pendingInvite = sessionStorage.getItem('pendingInvite');
    if (pendingInvite && profile && user) {
      const processInvite = async () => {
        try {
          const inviteData = JSON.parse(pendingInvite);
          
          if (inviteData.uid) {
            // INSERT into couples table
            const { error: insertError } = await supabase.from('couples').insert({
              user1_id: inviteData.uid,
              user2_id: user.id,
              relationship_type: inviteData.rel,
              couple_points: 0
            });
            if (insertError) console.error("Failed to insert couple", insertError);
            
            // refresh Couple state in context
            await refreshCouple();

            // Broadcast to host that we accepted!
            supabase.channel(`partner_link_${inviteData.uid}`).send({
               type: 'broadcast',
               event: 'partner_accepted',
               payload: {
                 name: profile.name,
                 avatarId: profile.avatarId,
                 relationshipType: inviteData.rel
               }
            });
          }
          
          setPartner({
            name: inviteData.name,
            avatarId: inviteData.avatar,
            relationshipType: inviteData.rel,
            code: '1234', // dummy local code
          });
          sessionStorage.removeItem('pendingInvite');
          sounds.playSuccess();
        } catch (e) {
          console.error("Failed to parse invite", e);
        }
      };
      processInvite();
    }

    // 2. Process pending multiplayer room (from URL invite)
    const pendingRoom = sessionStorage.getItem('pendingRoomCode');
    if (pendingRoom && profile && multiplayer.status === 'disconnected') {
      sessionStorage.removeItem('pendingRoomCode');
      multiplayer.joinRoom(pendingRoom, profile);
      setIsRoomModalOpen(true);
      return; // prevent falling through to restore
    }

    // 3. Process session restoration (auto-reconnect on refresh)
    if (sessionRestoredRef.current) return;
    
    const savedRoomCode = sessionStorage.getItem('mp_roomCode');
    const savedIsHost = sessionStorage.getItem('mp_isHost');
    const savedActiveGame = sessionStorage.getItem('mp_activeGame');
    
    if (savedRoomCode && profile && multiplayer.status === 'disconnected') {
      sessionRestoredRef.current = true;
      if (savedIsHost === 'true') {
        multiplayer.hostRoom(savedRoomCode, profile);
      } else {
        multiplayer.joinRoom(savedRoomCode, profile);
      }
      setIsRoomModalOpen(true);
      if (savedActiveGame) {
        setActiveTab(savedActiveGame as any);
      }
    }
  }, [profile, multiplayer.joinRoom, multiplayer.hostRoom, multiplayer.status]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync tab with multiplayer game
  const currentTab = multiplayer.status === 'connected' ? (multiplayer.activeGame as ActiveTab) : activeTab;

  // ---- Filtered Cards (Dynamic Shuffle & Non-Repeating) ----
  const filteredCards = useMemo(() => {
    if (multiplayer.status === 'connected' && !multiplayer.isHost && syncedSwipeCardIds && syncedSwipeCardIds.length > 0) {
      return getSwipeCardsByIds(syncedSwipeCardIds);
    }
    return getShuffledSwipeCards(selectedCategory, 15);
  }, [selectedCategory, roundCounter, multiplayer.status, multiplayer.isHost, syncedSwipeCardIds]);

  // Host broadcasts the card deck to guest for synchronized cards
  React.useEffect(() => {
    if (multiplayer.status === 'connected' && multiplayer.isHost && currentTab === 'swipe' && filteredCards.length > 0) {
      multiplayer.sendMessage({
        type: 'SYNC_QUESTION_IDS',
        payload: { game: 'swipe', questionIds: filteredCards.map(c => c.id) }
      });
    }
  }, [multiplayer.status, multiplayer.isHost, currentTab, selectedCategory, roundCounter, filteredCards]);

  // Auto-close partner left modal after 5 seconds
  React.useEffect(() => {
    if (multiplayer.status === 'partner_left') {
      const t = setTimeout(() => multiplayer.leaveRoom(), 5000);
      return () => clearTimeout(t);
    }
  }, [multiplayer.status, multiplayer]);


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
    if (multiplayer.status !== 'connected' && activeTab === 'match') {
      setActiveTab('swipe');
    }
    
    previousTab.current = multiplayer.status === 'connected' ? multiplayer.activeGame : 'lobby';
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
      const prevListener = multiplayer.messageListener.current;
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'START_GAME') {
          markIntroShown(msg.payload.game, false);
        } else if (msg.type === 'END_GAME') {
          const currentTabToReset = (multiplayer.activeGame as ActiveTab) || activeTab;
          const stored = JSON.parse(sessionStorage.getItem('knotyet_introShown') || '{}');
          stored[currentTabToReset] = false;
          sessionStorage.setItem('knotyet_introShown', JSON.stringify(stored));
          setIntroShown(stored);
        } else if (msg.type === 'SWIPE_ACTION' && currentTab === 'swipe') {
          executeSwipe(msg.payload.direction);
        } else if (msg.type === 'SWIPE_FLIP' && currentTab === 'swipe') {
          setIsCardFlipped(msg.payload);
        } else if (msg.type === 'CARD_SUBMIT' && currentTab === 'swipe') {
          setPartnerCardAnswer(msg.payload);
        } else if (msg.type === 'SYNC_QUESTION_IDS' && msg.payload.game === 'swipe') {
          setSyncedSwipeCardIds(msg.payload.questionIds);
        } else if (prevListener) {
          prevListener(msg);
        }
      };
    }
  }, [multiplayer.status, currentTab, multiplayer.messageListener, cardIndex, filteredCards.length, activeTab, multiplayer.activeGame]);

  // Routes handle redirects; just show loading if AppInner rendered while loading
  if (isLoading) return <LoadingSpinner />;

  // ---- Multiplayer Waiting / Connecting Overlay ----
  if (multiplayer.status === 'hosting' || multiplayer.status === 'joining') {
    return (
      <div className="min-h-[100dvh] p-4 sm:p-6 md:p-8 flex items-center justify-center relative overflow-hidden" style={{ background: '#7C3AED' }}>
        <div className="bg-blob w-96 h-96 -top-20 -left-20 bg-pink-500 opacity-20" />
        <div className="bg-blob w-[500px] h-[500px] -bottom-40 -right-20 bg-cyan-400 opacity-20" />
        
        <div className="game-card w-full max-w-sm p-8 text-center space-y-6 relative z-10 animate-pop-in">
          <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-white mb-2"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }}>
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-ink">
              {multiplayer.status === 'hosting' ? 'Hosting Room' : 'Joining Room'}
            </h2>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100 space-y-3">
            {multiplayer.status === 'hosting' && (
              <div className="py-4 space-y-3">
                <div className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin mx-auto" />
                <p className="text-sm font-bold text-brand mt-4">Waiting for partner...</p>
                <div className="my-3">
                  <span className="text-3xl font-black text-ink tracking-widest bg-white py-2 px-4 rounded-xl shadow-sm border border-indigo-100 inline-block">{multiplayer.roomCode}</span>
                </div>
                <p className="text-xs text-ink-3">Share this code with your partner</p>
              </div>
            )}
            
            {multiplayer.status === 'joining' && (
              <div className="py-4 space-y-3">
                <div className="w-8 h-8 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto" />
                <p className="text-sm font-bold text-teal-600 mt-4">Connecting to room...</p>
              </div>
            )}
          </div>
          
          <button onClick={() => multiplayer.leaveRoom()} className="text-xs font-bold text-red-500 hover:text-red-600 transition">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const currentCard = filteredCards[cardIndex];
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
      // Don't intercept if user is typing in an input or textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

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

      // If any modal is open, don't trigger game hotkeys
      if (isFriendsModalOpen || isRoomModalOpen || isProfileOpen || isMusicMenuOpen || isDisconnectModalOpen || isEndGameModalOpen || isSummaryOpen) {
        return;
      }

      // Mode switching (1-5)
      if (multiplayer.status !== 'connected') {
        if (e.key === '1') { handleTabClick('swipe'); return; }
        if (e.key === '2') { handleTabClick('quiz'); return; }
        if (e.key === '3') { handleTabClick('wheel'); return; }
        if (e.key === '4') { handleTabClick('number'); return; }
        if (e.key === '5') { handleTabClick('letter'); return; }
      }

      // In Swipe game:
      if (currentTab === 'swipe' && introShown['swipe']) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleManualAction('right');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleManualAction('left');
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          setIsCardFlipped(prev => {
            const next = !prev;
            if (multiplayer.status === 'connected') {
              multiplayer.sendMessage({ type: 'SWIPE_FLIP', payload: next });
            }
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
    currentTab, introShown, handleSwipe, handleTabClick, isCardFlipped
  ]);

  const handleRestartDeck = () => {
    setCardIndex(0);
    setAnsweredCount(0);
    setSkippedCount(0);
    setRoundCounter(prev => prev + 1); // Trigger new cards
    setIsSummaryOpen(false);
  };

  const handleCategoryChange = (cat: CardCategory | 'all') => {
    sounds.playFlip();
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

  return (
    <div className="min-h-[100dvh] min-h-screen w-full flex justify-center items-stretch md:items-center p-0 sm:p-3 md:p-6 lg:p-8 overflow-x-hidden transition-all duration-300"
      style={{ background: 'linear-gradient(160deg, #6D28D9 0%, #7C3AED 40%, #4F46E5 100%)' }}
    >
      {/* Decorative background shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top-right teal blob */}
        <div className="absolute w-72 md:w-96 h-72 md:h-96 rounded-full opacity-40 top-[-60px] right-[-60px]"
          style={{ background: '#06B6D4', filter: 'blur(60px)' }} />
        {/* Bottom-left yellow blob */}
        <div className="absolute w-64 md:w-80 h-64 md:h-80 rounded-full opacity-30 bottom-[15%] left-[-40px]"
          style={{ background: '#FACC15', filter: 'blur(50px)' }} />
        {/* Bottom-right pink blob */}
        <div className="absolute w-56 md:w-80 h-56 md:h-80 rounded-full opacity-35 bottom-[-30px] right-[10%]"
          style={{ background: '#FF2D9B', filter: 'blur(50px)' }} />
        {/* Mid dot pattern */}
        <div className="absolute inset-0 dotted-pattern opacity-20" />
      </div>

      {/* Main Responsive Game Console */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl min-h-[100dvh] md:min-h-0 md:h-[min(880px,94vh)] rounded-none sm:rounded-[36px] md:rounded-[44px] flex flex-col relative shadow-2xl safe-pt flex-1 md:flex-initial overflow-hidden border-0 sm:border sm:border-white/20 transition-all duration-300 md:my-auto"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
      >
        {/* ====== HEADER ====== */}
        {!isPlayingGame && (
          <header className="px-4 sm:px-6 pt-4 pb-3 sticky top-0 z-30 shrink-0"
            style={multiplayer.status === 'connected' 
              ? { background: 'linear-gradient(180deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.90) 100%)', backdropFilter: 'blur(10px)' }
              : { background: 'linear-gradient(180deg, rgba(109,40,217,0.98) 0%, rgba(109,40,217,0.92) 100%)', backdropFilter: 'blur(10px)' }}
          >
          {/* Top Row: Logo + Partner strip + Mode/Room */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo / Profile */}
            <button onClick={() => { sounds.playFlip(); setIsProfileOpen(true); }} className="flex items-center gap-3 relative shrink-0 active:scale-95 transition text-left">
              {partner ? (
                <div className="flex items-center shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border-2 border-brand-100 z-10 relative">
                    <span className="text-xl">{getAvatar(profile?.avatarId || 'default')?.face}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border-2 border-brand-100 -ml-4 z-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/5" />
                    <span className="text-xl opacity-90">{getAvatar(partner.avatarId)?.face}</span>
                  </div>
                  <div className="absolute -bottom-1 left-3 bg-white rounded-full border border-pink-200 shadow-sm z-20" style={{ padding: '2px' }}>
                    <Heart className="w-3 h-3 text-pink-500" fill="currentColor" />
                  </div>
                </div>
              ) : (
                <div className="avatar-bubble w-10 h-10 text-xl bg-white shadow-sm text-brand-500 border-2 border-brand-100 shrink-0">
                  {getAvatar(profile?.avatarId || 'default')?.face}
                </div>
              )}
              
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-black text-white leading-none">
                    {partner ? `${profile?.name} & ${partner.name}` : profile?.name || 'User'}
                  </p>
                  {multiplayer.status === 'connected' ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-white text-emerald-600 uppercase tracking-wider">Online</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-white/20 text-white uppercase tracking-wider">Local</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-full border border-white/10" style={{ fontSize: '10px' }}>
                    <Heart className="w-2.5 h-2.5 text-white/90 fill-current" />
                    <span className="text-white/90 font-bold">{profile?.heartPoints || 0} Solo</span>
                  </div>
                  {couple && (
                    <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-full shadow-sm" style={{ fontSize: '10px' }}>
                      <Heart className="w-2.5 h-2.5 text-pink-500 fill-current" />
                      <span className="text-pink-600 font-black">{couple.couple_points} Shared</span>
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Partner middle strip (hidden because we combined it above, but keeping it for multiplayer text maybe? No, let's just remove the duplicated strip) */}

            {/* Middle: Timer */}
            <div className="hidden xs:flex flex-col items-center">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{t.playTogether || 'Session'}</span>
              <span className="text-sm font-black text-white tracking-widest font-mono">{formatTime(sessionSeconds)}</span>
            </div>

            {/* Right side: Friends, Music & Room / Disconnect */}
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => {
                  sounds.playFlip();
                  setIsFriendsModalOpen(true);
                }}
                aria-label="Friends & Circle"
                title="Friends & Loved Ones"
                className="w-8 h-8 flex items-center justify-center rounded-full transition active:scale-95 bg-white/20 hover:bg-white/30 border border-white/40 shadow-sm relative"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                {friends.unreadTotal > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center border border-white animate-pulse">
                    {friends.unreadTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsMusicMenuOpen(!isMusicMenuOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-full transition active:scale-95 bg-white/20 hover:bg-white/30 border border-white/40 shadow-sm"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Music className="w-4 h-4 text-white" />}
              </button>
              
              {isMusicMenuOpen && (
                <div className="absolute top-10 right-0 w-48 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden z-50 animate-pop-in">
                  <div className="p-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                    <span className="text-xs font-black text-ink">Background Music</span>
                    <button 
                      onClick={() => {
                        const muted = sounds.toggleMute();
                        setIsMuted(muted);
                      }}
                      className={`p-1.5 rounded-full ${isMuted ? 'bg-red-100 text-red-500' : 'bg-brand/10 text-brand'}`}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-2 space-y-1">
                    {sounds.tracks.map((track, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          sounds.setTrack(idx);
                          setCurrentTrack(idx);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm font-bold transition ${currentTrack === idx ? 'bg-brand/10 text-brand' : 'text-ink-3 hover:bg-stone-100'}`}
                      >
                        {track.name}
                        {currentTrack === idx && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (multiplayer.status === 'connected') {
                    setIsDisconnectModalOpen(true);
                  } else {
                    if (!checkLimit('multiplayer')) return;
                    setIsRoomModalOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition active:scale-95"
                style={multiplayer.status === 'connected' ? {
                  background: 'rgba(255,255,255,0.2)', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  border: '1.5px solid rgba(255,255,255,0.4)' 
                } : { 
                  background: 'linear-gradient(135deg, #FF2D9B, #EC4899)', 
                  boxShadow: '0 4px 12px rgba(255,45,155,0.4)',
                  border: '1.5px solid rgba(255,255,255,0.25)' 
                }}
              >
                <Users className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] font-black text-white whitespace-nowrap tracking-wide">
                  {multiplayer.status === 'connected' ? 'Disconnect' : t.playTogether}
                </span>
              </button>
            </div>
          </div>

          {/* Game Mode Tabs - only visible in solo / local mode */}
          {multiplayer.status !== 'connected' && (
            <nav aria-label="Game Modes" className="flex items-center justify-center gap-1 sm:gap-2 md:gap-2.5 mt-2 sm:mt-3 p-1 sm:p-1.5 md:p-2 rounded-2xl md:rounded-3xl border border-white/10"
              style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(10px)' }}>
              {/* Swipe tab */}
              <button
                onClick={() => handleTabClick('swipe')}
                title="Icebreaker Cards (Key 1)"
                className="flex-1 min-w-0 py-1.5 sm:py-2 md:py-2.5 px-1 sm:px-2 md:px-2.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-[10px] sm:text-xs md:text-xs lg:text-sm font-black transition-all active:scale-95 hover:bg-white/10 text-center select-none"
                style={currentTab === 'swipe' ? {
                  background: '#FF2D9B',
                  color: 'white',
                  boxShadow: '0 4px 0 #C41D77, 0 6px 16px rgba(255,45,155,0.4)',
                } : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{t.tabSwipe}</span>
                <span className="inline xl:hidden whitespace-nowrap">Cards</span>
                <span className="hidden md:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/25 text-white/80 ml-0.5">1</span>
              </button>

              {/* Quiz tab */}
              <button
                onClick={() => handleTabClick('quiz')}
                title="Guess My Heart (Key 2)"
                className="flex-1 min-w-0 py-1.5 sm:py-2 md:py-2.5 px-1 sm:px-2 md:px-2.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-[10px] sm:text-xs md:text-xs lg:text-sm font-black transition-all active:scale-95 hover:bg-white/10 text-center select-none"
                style={currentTab === 'quiz' ? {
                  background: '#06B6D4',
                  color: 'white',
                  boxShadow: '0 4px 0 #0E7490, 0 6px 16px rgba(6,182,212,0.4)',
                } : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{t.tabQuiz}</span>
                <span className="inline xl:hidden whitespace-nowrap">Quiz</span>
                <span className="hidden md:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/25 text-white/80 ml-0.5">2</span>
              </button>

              {/* Wheel tab */}
              <button
                onClick={() => handleTabClick('wheel')}
                title="Spin Wheel (Key 3)"
                className="flex-1 min-w-0 py-1.5 sm:py-2 md:py-2.5 px-1 sm:px-2 md:px-2.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-[10px] sm:text-xs md:text-xs lg:text-sm font-black transition-all active:scale-95 hover:bg-white/10 text-center select-none"
                style={currentTab === 'wheel' ? {
                  background: '#F59E0B',
                  color: 'white',
                  boxShadow: '0 4px 0 #B45309, 0 6px 16px rgba(245,158,11,0.4)',
                } : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{t.tabWheel}</span>
                <span className="inline xl:hidden whitespace-nowrap">Wheel</span>
                <span className="hidden md:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/25 text-white/80 ml-0.5">3</span>
              </button>

              {/* Number tab */}
              <button
                onClick={() => handleTabClick('number')}
                title="Number Guesser (Key 4)"
                className="flex-1 min-w-0 py-1.5 sm:py-2 md:py-2.5 px-1 sm:px-2 md:px-2.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-[10px] sm:text-xs md:text-xs lg:text-sm font-black transition-all active:scale-95 hover:bg-white/10 text-center select-none"
                style={currentTab === 'number' ? {
                  background: '#6366F1',
                  color: 'white',
                  boxShadow: '0 4px 0 #4338CA, 0 6px 16px rgba(99,102,241,0.4)',
                } : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{t.tabNumber || 'Number Guesser'}</span>
                <span className="inline xl:hidden whitespace-nowrap">Number</span>
                <span className="hidden md:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/25 text-white/80 ml-0.5">4</span>
              </button>

              {/* Letter tab */}
              <button
                onClick={() => handleTabClick('letter')}
                title="Letter Race (Key 5)"
                className="flex-1 min-w-0 py-1.5 sm:py-2 md:py-2.5 px-1 sm:px-2 md:px-2.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 text-[10px] sm:text-xs md:text-xs lg:text-sm font-black transition-all active:scale-95 hover:bg-white/10 text-center select-none"
                style={currentTab === 'letter' ? {
                  background: '#D946EF',
                  color: 'white',
                  boxShadow: '0 4px 0 #A21CAF, 0 6px 16px rgba(217,70,239,0.4)',
                } : { color: 'rgba(255,255,255,0.75)' }}
              >
                <TextCursor className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{t.tabLetter || 'Letter Race'}</span>
                <span className="inline xl:hidden whitespace-nowrap">Letter</span>
                <span className="hidden md:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/25 text-white/80 ml-0.5">5</span>
              </button>
            </nav>
          )}
        </header>
        )}

        <main className={`flex-1 flex flex-col items-center justify-between relative overflow-y-auto sm:overflow-hidden w-full p-2 sm:p-3`}>
          {multiplayer.status === 'connected' && multiplayer.activeGame === 'lobby' ? (
            <MultiplayerLobby 
              onSelectGame={(game) => {
                markIntroNotShown(game);
                multiplayer.setGame(game);
              }}
              onDisconnect={() => setIsDisconnectModalOpen(true)}
            />
          ) : (
            <>
              {currentTab === 'swipe' && (
                introShown['swipe'] ? (
                  <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full space-y-2 sm:space-y-3 animate-fade-in mx-auto">
                    {/* Standardized Game Header */}
                    <div className="w-full flex items-center justify-between px-3 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-sm">
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
                      <button onClick={handleEndGame} className="text-xs font-bold text-white/80 hover:text-white transition px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/15 flex items-center gap-1 active:scale-95 shadow-sm">
                        End Game
                      </button>
                    </div>
                    
                    {/* Category Selector Pills */}
                    <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
                      {categories.map(cat => (
                        <button
                          key={cat.key}
                          onClick={() => handleCategoryChange(cat.key as CardCategory | 'all')}
                          className="px-3 py-1 rounded-full whitespace-nowrap text-xs font-black transition active:scale-95 flex-shrink-0"
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
                    <div className="relative w-full flex-1 min-h-[300px] sm:min-h-[340px] md:min-h-[390px] lg:min-h-[430px] select-none my-auto flex items-center justify-center py-1 sm:py-2">
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
                            if (multiplayer.status === 'connected') {
                              multiplayer.sendMessage({ type: 'SWIPE_FLIP', payload: flipped });
                            }
                          }}
                          myAnswer={myCardAnswer}
                          partnerAnswer={partnerCardAnswer}
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
                          <h3 className="font-black text-ink text-xl">{t.allCardsTitle}</h3>
                          <p className="text-sm text-ink-3">{t.allCardsSub}</p>
                          <button onClick={handleRestartDeck} className="btn-chunky btn-pink text-sm px-6">
                            <RotateCw className="w-4 h-4" /> {t.playAgain}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar: Skip, Flip (if flippable), and Pass */}
                    <div className="w-full shrink-0 pt-1 flex items-center gap-2 sm:gap-3">
                      {/* Skip button */}
                      <button 
                        onClick={() => handleManualAction('left')} 
                        disabled={!currentCard}
                        title="Skip Question (Left Arrow ←)"
                        className="flex-1 py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm text-pink-600 bg-white/95 hover:bg-pink-50 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 border border-pink-100 group"
                      >
                        <X className="w-4 h-4 stroke-[3] group-hover:scale-110 transition-transform text-pink-500" />
                        <span>{t.skipLabel || 'Skip'}</span>
                        <span className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-100 text-pink-600 font-bold">←</span>
                      </button>

                      {/* Flip / Reveal button (if card is flippable) */}
                      {currentCard && (multiplayer.status === 'connected' || currentCard.category === 'teka-teki') && (
                        <button
                          onClick={() => {
                            setIsCardFlipped(!isCardFlipped);
                            if (multiplayer.status === 'connected') {
                              multiplayer.sendMessage({ type: 'SWIPE_FLIP', payload: !isCardFlipped });
                            }
                            sounds.playFlip();
                          }}
                          title="Flip Card / Reveal Answer (Spacebar)"
                          className="flex-1 py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm text-violet-700 bg-white/95 hover:bg-violet-50 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 border border-violet-100 group"
                        >
                          <RotateCw className="w-4 h-4 group-hover:rotate-180 transition-transform text-violet-600" />
                          <span>{isCardFlipped ? (t.flipBack || 'Back') : (currentCard.category === 'teka-teki' ? t.revealAnswer : 'Answer')}</span>
                          <span className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-bold">Space</span>
                        </button>
                      )}

                      {/* Pass / Next button */}
                      <button 
                        onClick={() => handleManualAction('right')} 
                        disabled={!currentCard}
                        title="Pass / Next Question (Right Arrow →)"
                        className="flex-1 py-3 sm:py-3.5 px-2 sm:px-4 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 group"
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
                  ? <SpinWheel onEndGame={handleEndGame} />
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
              {currentTab === 'letter' && (
                introShown['letter']
                  ? <LetterRaceGame onEndGame={handleEndGame} />
                  : <GameIntro gameType="letter" onStart={() => markIntroShown('letter')} />
              )}
            </>
          )}
        </main>

        {/* Dedicated Bottom Ad Banner Slot */}
        <div className="w-full px-3 pt-1 safe-pb shrink-0 z-20">
          <div className="w-full h-11 sm:h-12 rounded-2xl border-2 border-dashed border-white/20 bg-black/15 backdrop-blur-md flex items-center justify-between px-3.5 text-white/70 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm">📢</span>
              <div className="text-left">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/50 leading-none">Sponsored</p>
                <p className="text-[11px] font-bold text-white/80 leading-tight">Ad Banner Space Reserved</p>
              </div>
            </div>
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/15 uppercase">
              Ad Space
            </span>
          </div>
        </div>

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

        {/* Partner Accepted Live Toast */}
        {partnerAcceptedToast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce-soft">
            <div className={`bg-white rounded-3xl p-4 shadow-2xl border-4 flex flex-col items-center text-center ${partnerAcceptedToast.relationshipType === 'unlinked' ? 'border-red-400' : 'border-pink-400'}`}>
              <span className="text-4xl mb-2">{partnerAcceptedToast.relationshipType === 'unlinked' ? '💔' : '💘'}</span>
              <h3 className={`text-lg font-black ${partnerAcceptedToast.relationshipType === 'unlinked' ? 'text-red-500' : 'text-pink-500'}`}>
                {partnerAcceptedToast.relationshipType === 'unlinked' ? 'Partner Unlinked' : `Yay! ${partnerAcceptedToast.name} accepted!`}
              </h3>
              <p className="text-sm font-bold text-ink-3">
                {partnerAcceptedToast.relationshipType === 'unlinked' ? 'Your accounts are no longer connected.' : 'Your accounts are now linked.'}
              </p>
            </div>
          </div>
        )}

        {/* Partner Left Modal */}
        {multiplayer.status === 'partner_left' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-pop-in border-4 border-red-500">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-ink mb-2">Partner Disconnected</h3>
              <p className="text-sm font-bold text-red-500 mb-2">Your partner has ended the session or lost connection.</p>
              <p className="text-xs text-ink-3 animate-pulse">You will be automatically returned to the main menu in a few seconds...</p>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#F8F7FF]">
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)' }}>
        <Heart className="w-7 h-7 fill-white text-white animate-pulse" />
      </div>
      <div className="w-32 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <div className="h-full rounded-full animate-pulse" style={{ background: 'linear-gradient(90deg, #FF2D9B, #7C3AED)', width: '60%' }} />
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children, requireProfile = true }: { children: React.ReactNode, requireProfile?: boolean }) => {
  const { user, isLoading } = useAuth();
  const { profile } = useGame();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner />;
  
  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  
  if (requireProfile && !profile) return <Navigate to="/setup" replace />;
  
  if (!requireProfile && profile) return <Navigate to="/play" replace />;
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const { profile } = useGame();

  if (isLoading) return <LoadingSpinner />;
  
  if (user) {
    if (profile) return <Navigate to="/play" replace />;
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    
    const roomCode = searchParams.get('room');
    if (roomCode) {
      sessionStorage.setItem('pendingRoomCode', roomCode);
    }

    const isInvite = searchParams.get('invite');
    if (isInvite) {
      const inviteData = {
        name: searchParams.get('n'),
        avatar: searchParams.get('a'),
        rel: searchParams.get('r')
      };
      sessionStorage.setItem('pendingInvite', JSON.stringify(inviteData));
    }
  }, [location.search]);

  return (
    <Routes>
      <Route path="/" element={
        <PublicRoute>
          <LandingPage />
        </PublicRoute>
      } />
      <Route path="/setup" element={
        <ProtectedRoute requireProfile={false}>
          <WelcomeScreen onComplete={() => {}} />
        </ProtectedRoute>
      } />
      <Route path="/play" element={
        <ProtectedRoute requireProfile={true}>
          <AppInner />
        </ProtectedRoute>
      } />
      <Route path="/invite" element={<InviteScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => (
  <GameProvider>
    <MultiplayerProvider>
      <FriendsProvider>
        <AppRoutes />
      </FriendsProvider>
    </MultiplayerProvider>
  </GameProvider>
);
