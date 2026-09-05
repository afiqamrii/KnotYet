import React, { useState, useMemo } from 'react';
import { Layers, Dices, Heart, Users, Sparkles, ShoppingBag, CheckCircle, XCircle, RotateCw } from 'lucide-react';
import { SWIPE_CARDS, CardCategory } from './data/questions';
import { SwipeCard } from './components/SwipeCard';
import { CoupleGuessGame } from './components/CoupleGuessGame';
import { SpinWheel } from './components/SpinWheel';
import { RoomModal } from './components/RoomModal';
import { SummaryModal } from './components/SummaryModal';
import { sounds } from './utils/audio';

type ActiveTab = 'swipe' | 'quiz' | 'wheel';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('swipe');
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');
  const [cardIndex, setCardIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Modals & Room state
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    if (selectedCategory === 'all') return SWIPE_CARDS;
    return SWIPE_CARDS.filter((c) => c.category === selectedCategory);
  }, [selectedCategory]);

  const currentCard = filteredCards[cardIndex];
  const nextCard = filteredCards[cardIndex + 1];

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      setAnsweredCount((prev) => prev + 1);
    } else {
      setSkippedCount((prev) => prev + 1);
    }

    if (cardIndex + 1 < filteredCards.length) {
      setCardIndex((prev) => prev + 1);
    } else {
      setIsSummaryOpen(true);
    }
  };

  const handleManualAction = (direction: 'left' | 'right') => {
    sounds.playSwipe();
    handleSwipe(direction);
  };

  const handleRestartDeck = () => {
    setCardIndex(0);
    setAnsweredCount(0);
    setSkippedCount(0);
    setIsSummaryOpen(false);
  };

  const handleCategoryChange = (cat: CardCategory | 'all') => {
    sounds.playFlip();
    setSelectedCategory(cat);
    setCardIndex(0);
    setAnsweredCount(0);
    setSkippedCount(0);
  };

  return (
    <div className="min-h-screen bg-stone-950 flex justify-center items-start sm:py-6 sm:px-4">
      {/* Mobile-First Phone Container Frame */}
      <div className="w-full max-w-md bg-stone-50 min-h-screen sm:min-h-[840px] sm:rounded-[40px] shadow-2xl border border-stone-800/20 flex flex-col justify-between overflow-hidden relative">

        {/* 1. TOP STATUS / NAVIGATION BAR */}
        <header className="px-5 pt-4 pb-3 bg-white/90 backdrop-blur-md border-b border-stone-200/70 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            {/* Logo & Tag */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-rose-200">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-stone-900 leading-none">
                  JodohDeck<span className="text-rose-500 font-extrabold">.my</span>
                </h1>
                <span className="text-[10px] text-stone-400 font-semibold tracking-wide">
                  Taaruf & Couple Game
                </span>
              </div>
            </div>

            {/* Room / Multiplayer Trigger */}
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition border ${
                activeRoomCode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {activeRoomCode ? `Bilik #${activeRoomCode}` : 'Main Berdua'}
            </button>
          </div>

          {/* GAME MODES TABS (Swipe vs Teka Hati vs Roda) */}
          <div className="grid grid-cols-3 gap-1.5 mt-3 p-1 rounded-2xl bg-stone-100 border border-stone-200/80 text-xs font-extrabold text-stone-600">
            <button
              onClick={() => {
                sounds.playFlip();
                setActiveTab('swipe');
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === 'swipe' ? 'bg-white text-rose-600 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Kad Swipe
            </button>

            <button
              onClick={() => {
                sounds.playFlip();
                setActiveTab('quiz');
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === 'quiz' ? 'bg-white text-rose-600 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> Teka Hati
            </button>

            <button
              onClick={() => {
                sounds.playFlip();
                setActiveTab('wheel');
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === 'wheel' ? 'bg-white text-rose-600 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              <Dices className="w-3.5 h-3.5" /> Roda Jodoh
            </button>
          </div>
        </header>

        {/* 2. MAIN CONTENT AREA */}
        <main className="flex-1 p-4 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* TAB 1: SWIPE CARD MODE */}
          {activeTab === 'swipe' && (
            <div className="w-full max-w-sm flex flex-col items-center space-y-4">
              
              {/* Category Filter Pills */}
              <div className="w-full flex items-center justify-start gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
                <button
                  onClick={() => handleCategoryChange('all')}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition border ${
                    selectedCategory === 'all'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  Semua ({SWIPE_CARDS.length})
                </button>
                <button
                  onClick={() => handleCategoryChange('teka-teki')}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition border ${
                    selectedCategory === 'teka-teki'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  🤣 Teki-Teki
                </button>
                <button
                  onClick={() => handleCategoryChange('vibe-check')}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition border ${
                    selectedCategory === 'vibe-check'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  ⚡ Vibe Check
                </button>
                <button
                  onClick={() => handleCategoryChange('taaruf-realiti')}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition border ${
                    selectedCategory === 'taaruf-realiti'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  🌶️ Taaruf Realiti
                </button>
              </div>

              {/* Progress Count */}
              <div className="w-full flex items-center justify-between text-xs text-stone-400 font-semibold px-2">
                <span>Kad {cardIndex + 1} daripada {filteredCards.length}</span>
                <span className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓ {answeredCount}</span>
                  <span className="text-stone-400 font-bold">✕ {skippedCount}</span>
                </span>
              </div>

              {/* Card Container Stack */}
              <div className="relative w-full h-[380px] select-none">
                {nextCard && (
                  <SwipeCard
                    key={nextCard.id}
                    card={nextCard}
                    onSwipe={handleSwipe}
                    isTop={false}
                  />
                )}

                {currentCard ? (
                  <SwipeCard
                    key={currentCard.id}
                    card={currentCard}
                    onSwipe={handleSwipe}
                    isTop={true}
                  />
                ) : (
                  <div className="w-full h-full rounded-3xl bg-white border border-stone-200 flex flex-col items-center justify-center p-6 text-center space-y-3 shadow-md">
                    <Sparkles className="w-10 h-10 text-rose-500 animate-bounce" />
                    <h3 className="font-extrabold text-stone-800 text-lg">Semua Kad Selesai!</h3>
                    <p className="text-xs text-stone-500">
                      Korang dah selesaikan semua kad dalam kategori ini.
                    </p>
                    <button
                      onClick={handleRestartDeck}
                      className="px-4 py-2 bg-stone-900 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Ulang Semula
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Tap Controls (For accessibility / users who don't want to swipe) */}
              <div className="flex items-center justify-center gap-5 pt-1">
                <button
                  onClick={() => handleManualAction('left')}
                  disabled={!currentCard}
                  className="w-13 h-13 rounded-full bg-white text-rose-600 border border-rose-200 shadow-md flex items-center justify-center hover:bg-rose-50 active:scale-90 transition disabled:opacity-40"
                  title="Skip Kiri"
                >
                  <XCircle className="w-7 h-7 stroke-[2]" />
                </button>

                <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-2">
                  Tarik Kad / Butang
                </div>

                <button
                  onClick={() => handleManualAction('right')}
                  disabled={!currentCard}
                  className="w-13 h-13 rounded-full bg-white text-emerald-600 border border-emerald-200 shadow-md flex items-center justify-center hover:bg-emerald-50 active:scale-90 transition disabled:opacity-40"
                  title="Lulus Kanan"
                >
                  <CheckCircle className="w-7 h-7 stroke-[2]" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COUPLE GUESSING QUIZ */}
          {activeTab === 'quiz' && <CoupleGuessGame />}

          {/* TAB 3: DATE NIGHT SPIN WHEEL */}
          {activeTab === 'wheel' && <SpinWheel />}

        </main>

        {/* 3. BOTTOM BANNER & MONETIZATION (Shopee Digital Product Bridge) */}
        <footer className="p-4 bg-gradient-to-r from-rose-100 via-amber-50 to-rose-100 border-t border-rose-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-stone-900 leading-tight">
                  150+ Soalan Taaruf VIP (PDF Dossier)
                </p>
                <p className="text-[10px] text-stone-600">
                  Duit, Mertua, Trauma & Checklist MBKP. Hanya RM9 di Shopee!
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playSuccess();
                alert('Pautan ke Kedai Shopee anda! (Pengguna boleh terus checkout dokumen PDF penuh atau beli token VIP).');
              }}
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-rose-600 text-white font-extrabold text-[11px] whitespace-nowrap transition shadow-xs active:scale-95"
            >
              Dapatkan VIP ✨
            </button>
          </div>
        </footer>

        {/* MODALS */}
        <RoomModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          onStartRoom={(code) => setActiveRoomCode(code)}
        />

        <SummaryModal
          isOpen={isSummaryOpen}
          answeredCount={answeredCount}
          skippedCount={skippedCount}
          categoryLabel={selectedCategory === 'all' ? 'Semua Kategori' : selectedCategory}
          onRestart={handleRestartDeck}
          onSelectCategory={() => {
            setIsSummaryOpen(false);
            setSelectedCategory('all');
          }}
        />

      </div>
    </div>
  );
};
