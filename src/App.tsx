import React, { useState, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layers, Dices, Heart, Users, Sparkles, RotateCw, HeartHandshake, Music, Volume2, VolumeX, Check } from 'lucide-react';
import { SWIPE_CARDS, CardCategory } from './data/questions';
import { SwipeCard } from './components/SwipeCard';
import { CoupleGuessGame } from './components/CoupleGuessGame';
import { SpinWheel } from './components/SpinWheel';
import { MatchGame } from './components/MatchGame';
import { RoomModal } from './components/RoomModal';
import { SummaryModal } from './components/SummaryModal';
import { getAvatar } from './components/AvatarPicker';
import { GameProvider, useGame, HEART_POINTS } from './store/GameContext';
import { useAuth } from './store/AuthContext';
import { supabase } from './lib/supabase';
import { MultiplayerProvider, useMultiplayer, MultiplayerMessage } from './store/MultiplayerContext';
import { LandingPage } from './screens/LandingPage';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { InviteScreen } from './screens/InviteScreen';
import { sounds } from './utils/audio';

type ActiveTab = 'swipe' | 'quiz' | 'wheel' | 'match';

// ---- Inner App (has access to GameContext) ----
const AppInner: React.FC = () => {
  const { profile, partner, setPartner, t, addHeartPoints, recordAnsweredQuestion } = useGame();
  const { user, couple, refreshCouple, progress, isLoading, checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const [partnerAcceptedToast, setPartnerAcceptedToast] = useState<{name: string, relationshipType: string} | null>(null);

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
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [isMusicMenuOpen, setIsMusicMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.isMuted);
  const [currentTrack, setCurrentTrack] = useState(sounds.currentTrackIndex);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const sessionRestoredRef = React.useRef(false);

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

  // ---- Filtered Cards (must be before any early return!) ----
  const filteredCards = useMemo(() => {
    // 1. Get answered set
    const answeredIds = new Set(progress?.answered_questions || []);
    if (!progress) {
      try {
        const stored = localStorage.getItem('jodohdeck_answered');
        if (stored) JSON.parse(stored).forEach((id: string) => answeredIds.add(id));
      } catch {}
    }
    
    // 2. Filter by category & exclude answered
    let available = SWIPE_CARDS.filter(c => {
       if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
       return !answeredIds.has(c.id);
    });

    // 3. Shuffle
    available.sort(() => Math.random() - 0.5);

    // 4. Return top 15 cards per round
    return available.slice(0, 15);
  }, [selectedCategory, roundCounter]); // Re-compute only on category change or explicit new round

  // Auto-close partner left modal after 5 seconds
  React.useEffect(() => {
    if (multiplayer.status === 'partner_left') {
      const t = setTimeout(() => multiplayer.leaveRoom(), 5000);
      return () => clearTimeout(t);
    }
  }, [multiplayer.status, multiplayer]);


  // Monitor game start for countdown
  React.useEffect(() => {
    if (multiplayer.status === 'connected') {
      setIsRoomModalOpen(false);
      sounds.playBGM();
      
      // Trigger countdown when transitioning from lobby to a game
      if (multiplayer.activeGame !== 'lobby' && previousTab.current === 'lobby') {
        incrementPlayCount('multiplayer');
        startCountdown();
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

  const startCountdown = () => {
    setIsCountingDown(true);
    setCountdownNumber(3);
    sounds.playFlip(); // Ticks
    
    setTimeout(() => { setCountdownNumber(2); sounds.playFlip(); }, 1000);
    setTimeout(() => { setCountdownNumber(1); sounds.playFlip(); }, 2000);
    setTimeout(() => { setCountdownNumber(0); sounds.playSuccess(); }, 3000); // 0 means 'GO!'
    setTimeout(() => {
      setIsCountingDown(false);
      setCountdownNumber(null);
    }, 4000);
  };

  // Sync tab with multiplayer game
  const currentTab = multiplayer.status === 'connected' ? (multiplayer.activeGame as ActiveTab) : activeTab;

  const handleTabClick = (tab: ActiveTab) => {
    sounds.playFlip();
    setActiveTab(tab);
    if (multiplayer.status === 'connected') {
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
    if (multiplayer.status === 'connected' && currentTab === 'swipe') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'SWIPE_ACTION') {
          executeSwipe(msg.payload.direction);
        } else if (msg.type === 'SWIPE_FLIP') {
          setIsCardFlipped(msg.payload);
        } else if (msg.type === 'CARD_SUBMIT') {
          setPartnerCardAnswer(msg.payload);
        }
      };
    }
  }, [multiplayer.status, currentTab, multiplayer.messageListener, cardIndex, filteredCards.length]);

  // Routes handle redirects; just show loading if AppInner rendered while loading
  if (isLoading) return <LoadingSpinner />;

  // ---- Multiplayer Lobby Overlay ----
  if (multiplayer.status === 'hosting' || multiplayer.status === 'joining' || (multiplayer.status === 'connected' && multiplayer.activeGame === 'lobby')) {
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
              {multiplayer.status === 'hosting' ? 'Hosting Room' : multiplayer.status === 'joining' ? 'Joining Room' : 'Room Connected!'}
            </h2>
            {multiplayer.status === 'connected' && (
              <p className="text-sm text-ink-3 mt-1">You are playing with <strong>{multiplayer.remoteProfile?.name}</strong></p>
            )}
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

            {multiplayer.status === 'connected' && multiplayer.isHost && (
              <>
                <p className="text-xs font-bold text-brand uppercase tracking-wider">Choose a Game</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => multiplayer.setGame('swipe')} className="btn-chunky btn-pink w-full text-[11px] px-1 py-3">Icebreaker Cards</button>
                  <button onClick={() => multiplayer.setGame('quiz')} className="btn-chunky btn-teal w-full text-[11px] px-1 py-3">Guess My Heart</button>
                  <button onClick={() => multiplayer.setGame('wheel')} className="btn-chunky btn-amber w-full text-[11px] px-1 py-3">Spin Wheel</button>
                  <button onClick={() => multiplayer.setGame('match')} className="btn-chunky w-full text-[11px] px-1 py-3 text-white" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', boxShadow: '0 6px 0 #5B21B6' }}>Couple Match</button>
                </div>
              </>
            )}
            
            {multiplayer.status === 'connected' && !multiplayer.isHost && (
              <div className="py-4 space-y-3">
                <div className="w-8 h-8 rounded-full border-4 border-brand border-t-transparent animate-spin mx-auto" />
                <p className="text-sm font-bold text-brand mt-4">Waiting for Host to pick a game...</p>
              </div>
            )}
          </div>
          
          <button onClick={() => setIsDisconnectModalOpen(true)} className="text-xs font-bold text-red-500 hover:text-red-600 transition">
            Leave Room
          </button>
        </div>

        {/* Custom Disconnect Modal for Lobby */}
        {isDisconnectModalOpen && (
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
    <div className="min-h-screen flex justify-center items-start"
      style={{ background: 'linear-gradient(160deg, #6D28D9 0%, #7C3AED 40%, #4F46E5 100%)' }}
    >
      {/* Decorative background shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top-right teal blob */}
        <div className="absolute w-64 h-64 rounded-full opacity-40 top-[-60px] right-[-60px]"
          style={{ background: '#06B6D4', filter: 'blur(40px)' }} />
        {/* Bottom-left yellow blob */}
        <div className="absolute w-56 h-56 rounded-full opacity-30 bottom-[15%] left-[-40px]"
          style={{ background: '#FACC15', filter: 'blur(36px)' }} />
        {/* Bottom-right pink blob */}
        <div className="absolute w-48 h-48 rounded-full opacity-35 bottom-[-30px] right-[10%]"
          style={{ background: '#FF2D9B', filter: 'blur(32px)' }} />
        {/* Mid dot pattern */}
        <div className="absolute inset-0 dotted-pattern opacity-20" />
      </div>

      {/* Phone container */}
      <div className="w-full max-w-md min-h-screen sm:min-h-[900px] sm:rounded-[44px] flex flex-col overflow-hidden relative"
        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(0px)' }}
      >
        {/* ====== HEADER ====== */}
        <header className="px-4 pt-4 pb-3 sticky top-0 z-30"
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

            {/* Right side: Room / Disconnect & Music */}
            <div className="flex items-center gap-2 relative">
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

          {/* Game Mode Tabs */}
          <div className={`grid ${multiplayer.status === 'connected' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 mt-3 p-1.5 rounded-2xl`}
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            {/* Swipe tab */}
            <button
              onClick={() => handleTabClick('swipe')}
              className="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] leading-[1.1] font-black transition active:scale-95 text-center"
              style={currentTab === 'swipe' ? {
                background: '#FF2D9B',
                color: 'white',
                boxShadow: '0 4px 0 #C41D77, 0 6px 16px rgba(255,45,155,0.4)',
              } : { color: 'rgba(255,255,255,0.6)' }}
            >
              <Layers className="w-5 h-5 mb-0.5" />
              <span>{t.tabSwipe}</span>
            </button>

            {/* Quiz tab */}
            <button
              onClick={() => handleTabClick('quiz')}
              className="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] leading-[1.1] font-black transition active:scale-95 text-center"
              style={currentTab === 'quiz' ? {
                background: '#06B6D4',
                color: 'white',
                boxShadow: '0 4px 0 #0E7490, 0 6px 16px rgba(6,182,212,0.4)',
              } : { color: 'rgba(255,255,255,0.6)' }}
            >
              <Heart className="w-5 h-5 mb-0.5" />
              <span>{t.tabQuiz}</span>
            </button>

            {/* Wheel tab */}
            <button
              onClick={() => handleTabClick('wheel')}
              className="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] leading-[1.1] font-black transition active:scale-95 text-center"
              style={currentTab === 'wheel' ? {
                background: '#F59E0B',
                color: 'white',
                boxShadow: '0 4px 0 #B45309, 0 6px 16px rgba(245,158,11,0.4)',
              } : { color: 'rgba(255,255,255,0.6)' }}
            >
              <Dices className="w-5 h-5 mb-0.5" />
              <span>{t.tabWheel}</span>
            </button>
            
            {/* Match tab (Online Only) */}
            {multiplayer.status === 'connected' && (
              <button
                onClick={() => handleTabClick('match')}
                className="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] leading-[1.1] font-black transition active:scale-95 text-center"
                style={currentTab === 'match' ? {
                  background: '#7C3AED',
                  color: 'white',
                  boxShadow: '0 4px 0 #5B21B6, 0 6px 16px rgba(124,58,237,0.4)',
                } : { color: 'rgba(255,255,255,0.6)' }}
              >
                <HeartHandshake className="w-5 h-5 mb-0.5" />
                <span>{t.tabMatch}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 flex flex-col items-center relative overflow-hidden">
          {currentTab === 'swipe' && (
            <div className="w-full max-w-sm flex flex-col items-center space-y-3">
              <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryChange(cat.key as CardCategory | 'all')}
                    className="px-3.5 py-1.5 rounded-full whitespace-nowrap text-xs font-black transition active:scale-95 flex-shrink-0"
                    style={selectedCategory === cat.key ? {
                      background: cat.color,
                      color: 'white',
                      boxShadow: `0 4px 12px ${cat.color}50`,
                    } : {
                      background: 'rgba(255,255,255,0.9)',
                      color: cat.color,
                      border: `2px solid ${cat.color}30`,
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="w-full flex items-center justify-between text-xs px-1">
                <span className="text-white/70 font-bold">{t.cardCount(cardIndex + 1, filteredCards.length)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-black px-2 py-0.5 rounded-full text-white text-[11px]"
                    style={{ background: '#10B981' }}>✓ {answeredCount}</span>
                  <span className="font-black px-2 py-0.5 rounded-full text-white text-[11px]"
                    style={{ background: '#FF2D9B' }}>✕ {skippedCount}</span>
                </span>
              </div>

              <div className="relative w-full h-[400px] select-none">
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

              <div className="flex items-center justify-center pt-2">
                <button onClick={() => handleManualAction('right')} disabled={!currentCard}
                  className="btn-chunky btn-white text-xs px-6 py-3"
                  style={{ borderRadius: '16px', color: '#10B981', boxShadow: '0 4px 0 #E5E7EB, 0 4px 12px rgba(0,0,0,0.05)' }}>
                  Next Question
                </button>
              </div>
            </div>
          )}

          {currentTab === 'quiz' && <CoupleGuessGame />}
          {currentTab === 'wheel' && <SpinWheel />}
          {currentTab === 'match' && <MatchGame />}
        </main>

        {/* Clean bottom spacing */}
        <div className="h-4" />

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

        {isProfileOpen && <ProfileScreen onClose={() => setIsProfileOpen(false)} />}
        
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

        {isCountingDown && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-400 to-purple-500 animate-bounce-soft"
                 style={{ WebkitTextStroke: '4px white' }}>
              {countdownNumber === 0 ? 'GO!' : countdownNumber}
            </div>
            {countdownNumber === 0 && (
              <p className="text-2xl font-bold text-white mt-8 animate-pulse">Have Fun!</p>
            )}
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
      <AppRoutes />
    </MultiplayerProvider>
  </GameProvider>
);
