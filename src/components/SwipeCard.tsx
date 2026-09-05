import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { RotateCw, Check, X, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { SwipeCardItem } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame } from '../store/GameContext';
import { useMultiplayer } from '../store/MultiplayerContext';

interface SwipeCardProps {
  card: SwipeCardItem;
  cardIndex?: number;
  stackDepth?: number;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
  isFlipped?: boolean;
  onToggleFlip?: (flipped: boolean) => void;
  myAnswer?: string | null;
  partnerAnswer?: string | null;
  onSubmitAnswer?: (answer: string) => void;
}

// Category top-band colors
const CATEGORY_COLORS: Record<string, { bg: string; shadow: string }> = {
  'teka-teki': { bg: 'linear-gradient(135deg, #F59E0B, #F97316)', shadow: 'rgba(245,158,11,0.35)' },
  'vibe-check': { bg: 'linear-gradient(135deg, #06B6D4, #3B82F6)', shadow: 'rgba(6,182,212,0.35)' },
  'taaruf-realiti': { bg: 'linear-gradient(135deg, #FF2D9B, #EC4899)', shadow: 'rgba(255,45,155,0.35)' },
};

export const SwipeCard: React.FC<SwipeCardProps> = ({ 
  card, cardIndex = 0, stackDepth = 0, onSwipe, isTop,
  isFlipped: controlledIsFlipped, onToggleFlip, 
  myAnswer, partnerAnswer, onSubmitAnswer 
}) => {
  const { t } = useGame();
  const multiplayer = useMultiplayer();
  const [localIsFlipped, setLocalIsFlipped] = useState(false);
  
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : localIsFlipped;
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.6, 1, 1, 1, 0.6]);
  const passOpacity = useTransform(x, [30, 120], [0, 1]);
  const skipOpacity = useTransform(x, [-30, -120], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) { sounds.playSwipe(); onSwipe('right'); }
    else if (info.offset.x < -100) { sounds.playSwipe(); onSwipe('left'); }
  };

  const toggleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playFlip();
    if (onToggleFlip) onToggleFlip(!isFlipped);
    else setLocalIsFlipped(!isFlipped);
  };

  const catColors = CATEGORY_COLORS[card.category] ?? { bg: 'linear-gradient(135deg, #7C3AED, #A855F7)', shadow: 'rgba(124,58,237,0.35)' };

  // Advanced Game Rules Logic
  const isMultiplayer = multiplayer.status === 'connected';
  let canSwipe = true;
  let canFlip = true;
  let isMyTurnToAsk = true;

  if (isMultiplayer) {
    if (card.category === 'teka-teki') {
      // Turn-based Teka Teki
      isMyTurnToAsk = (cardIndex % 2 === 0) ? !!multiplayer.isHost : !multiplayer.isHost;
      canFlip = isMyTurnToAsk; // Only asker can reveal answer
      canSwipe = isMyTurnToAsk; // Only asker can swipe next
    } else {
      // Taaruf (Simultaneous Typing)
      canSwipe = !!(myAnswer && partnerAnswer); // Must both answer before swiping
      canFlip = true;
    }
  } else {
    // Solo Mode
    if (card.category === 'teka-teki') {
      canFlip = true;
      canSwipe = true;
    } else {
      // Taaruf/Vibe check: No flip, just read and swipe
      canFlip = false;
      canSwipe = true;
    }
  }

  // Styles for the card container depending on stack depth
  // Use card index to generate a pseudo-random rotation between -8 and 8 degrees
  const staticRotate = ((cardIndex * 13.7) % 16) - 8;
  
  let containerStyle: any = {};
  let containerAnimate: any = {};

  if (isTop) {
    containerStyle = { x, rotate, opacity, zIndex: 10 };
    containerAnimate = { scale: 1, y: 0 };
  } else {
    const depth = stackDepth;
    containerStyle = { zIndex: -depth };
    containerAnimate = { 
      scale: Math.max(0.7, 1 - (depth * 0.05)), 
      y: depth * 12, 
      rotate: staticRotate * (1 + depth * 0.2), 
      opacity: Math.max(0, 1 - (depth * 0.15)) 
    };
  }

  const containerClassName = `absolute inset-0 w-full h-full rounded-[32px] perspective-1000 select-none touch-none ${
    isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
  }`;

  return (
    <motion.div
      style={containerStyle}
      animate={containerAnimate}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      drag={isTop && canSwipe ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      onDragEnd={isTop && canSwipe ? handleDragEnd : undefined}
      className={containerClassName}
    >
      {/* PASS Stamp (Only show on top card) */}
      {isTop && (
        <motion.div
          className="absolute top-7 right-5 z-30 px-4 py-2 rounded-2xl rotate-12 text-lg font-black uppercase tracking-wider flex items-center gap-1.5"
          style={{ opacity: passOpacity, border: '4px solid #10B981', color: '#059669', background: 'rgba(255,255,255,0.95)', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' } as any}
        >
          <Check className="w-5 h-5 stroke-[3]" /> {t.passLabel}
        </motion.div>
      )}

      {/* SKIP Stamp */}
      {isTop && (
        <motion.div
          className="absolute top-7 left-5 z-30 px-4 py-2 rounded-2xl -rotate-12 text-lg font-black uppercase tracking-wider flex items-center gap-1.5"
          style={{ opacity: skipOpacity, border: '4px solid #FF2D9B', color: '#FF2D9B', background: 'rgba(255,255,255,0.95)', boxShadow: '0 4px 16px rgba(255,45,155,0.4)' } as any}
        >
          <X className="w-5 h-5 stroke-[3]" /> {t.skipLabel}
        </motion.div>
      )}

      {/* 3D Card */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className="w-full h-full relative rounded-[32px] transform-style-3d"
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)' }}
      >
        {/* ===== FRONT ===== */}
        <div className="absolute inset-0 w-full h-full flex flex-col backface-hidden bg-white rounded-[32px] overflow-hidden">
          {/* Color top band */}
          <div className="w-full p-4 flex items-center justify-between"
            style={{ background: catColors.bg, boxShadow: `0 4px 12px ${catColors.shadow}` }}>
            <span className="px-3 py-1 rounded-full text-xs font-black text-white"
              style={{ background: 'rgba(0,0,0,0.2)' }}>
              {card.categoryLabel}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: 'rgba(0,0,0,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {card.turn === 'Dua-dua Serentak' ? 'Both Players' : card.turn}
            </div>
          </div>
          
          {/* Turn Banner for Multiplayer Teka-Teki */}
          {isMultiplayer && card.category === 'teka-teki' && (
            <div className="w-full px-4 py-2 text-center text-[11px] font-black uppercase tracking-wider text-white"
              style={isMyTurnToAsk ? { background: '#10B981' } : { background: '#F59E0B' }}>
              {isMyTurnToAsk ? 'Your Turn: Read to your partner' : 'Partner is asking you!'}
            </div>
          )}

          {/* Question */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center overflow-y-auto no-scrollbar">
            <div className="text-4xl mb-3 shrink-0"><HelpCircle className="w-10 h-10 text-violet-300 mx-auto" /></div>
            <p className="text-lg sm:text-xl font-black text-ink leading-snug">{card.question}</p>
          </div>

          {/* Bottom actions */}
          <div className="p-5 pt-0 space-y-3">
            {canFlip && (
              <button onClick={toggleFlip}
                className="btn-chunky w-full text-xs"
                style={{ background: catColors.bg, color: 'white', boxShadow: `0 4px 0 rgba(0,0,0,0.15), 0 6px 16px ${catColors.shadow}`, borderRadius: '16px' }}>
                <RotateCw className="w-4 h-4" />
                {card.category === 'teka-teki' ? t.revealAnswer : 'Type Answers'}
              </button>
            )}
            <div className="flex items-center justify-between text-[11px] px-2 font-bold text-ink-3">
              <span>{t.skipLeft}</span>
              <span>{t.passRight}</span>
            </div>
          </div>
        </div>

        {/* ===== BACK ===== */}
        <div className="absolute inset-0 w-full h-full p-5 flex flex-col justify-between backface-hidden rotate-y-180 rounded-[32px] overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #1C1917 0%, #292524 100%)' }}>

          <div className="flex items-center justify-between">
            <span className="tag" style={{ background: 'rgba(234,179,8,0.2)', color: '#FCD34D', border: '1px solid rgba(234,179,8,0.3)' }}>
              <Sparkles className="w-3 h-3 text-yellow-400" /> {card.flipContent.title}
            </span>
            <button onClick={toggleFlip} className="p-2 rounded-full text-white/50 hover:text-white/80 transition"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center py-3 space-y-3 overflow-y-auto no-scrollbar">
            <div className="p-4 rounded-2xl text-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white text-base font-bold leading-relaxed">{card.flipContent.description}</p>
            </div>

            {multiplayer.status === 'connected' && onSubmitAnswer && card.category !== 'teka-teki' ? (
              <div className="mt-4 space-y-3">
                {partnerAnswer && !myAnswer && (
                  <p className="text-xs text-pink-400 font-bold animate-pulse text-center">Partner is ready! Waiting for you...</p>
                )}
                {!partnerAnswer && myAnswer && (
                  <p className="text-xs text-pink-400 font-bold animate-pulse text-center">Waiting for partner...</p>
                )}
                
                {partnerAnswer && myAnswer ? (
                  <div className="grid grid-cols-2 gap-2 text-left mb-2">
                     <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
                       <p className="text-[10px] uppercase font-black text-indigo-300 mb-1">You</p>
                       <p className="text-sm font-bold text-white break-words">{myAnswer}</p>
                     </div>
                     <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
                       <p className="text-[10px] uppercase font-black text-pink-300 mb-1">{multiplayer.remoteProfile?.name}</p>
                       <p className="text-sm font-bold text-white break-words">{partnerAnswer}</p>
                     </div>
                  </div>
                ) : !myAnswer ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const val = new FormData(e.currentTarget).get('ans') as string;
                    if (!val) return;
                    onSubmitAnswer(val);
                    sounds.playSuccess();
                  }}>
                    <input
                      type="text"
                      name="ans"
                      autoComplete="off"
                      placeholder="Type your reaction..."
                      className="w-full bg-white/10 border-2 border-white/20 p-3 rounded-xl text-sm text-white font-semibold focus:border-pink-500 outline-none mb-2 placeholder:text-white/40"
                    />
                    <button type="submit" className="btn-chunky btn-pink w-full text-xs" style={{ borderRadius: '12px' }}>
                      Submit & Reveal
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <>
                {card.flipContent.greenFlag && (
                  <div className="rounded-2xl p-3"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <p className="text-xs font-black mb-1" style={{ color: '#6EE7B7' }}>🟢 {t.greenFlag}</p>
                    <p className="text-xs text-green-100/80 leading-relaxed">{card.flipContent.greenFlag}</p>
                  </div>
                )}

                {card.flipContent.redFlag && (
                  <div className="rounded-2xl p-3"
                    style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.25)' }}>
                    <p className="text-xs font-black mb-1 flex items-center gap-1" style={{ color: '#FB7185' }}>
                      <ShieldAlert className="w-3.5 h-3.5" /> {t.redFlag}
                    </p>
                    <p className="text-xs text-pink-100/80 leading-relaxed">{card.flipContent.redFlag}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {canFlip && (
            <button onClick={toggleFlip}
              className="btn-chunky btn-white w-full text-xs"
              style={{ borderRadius: '16px' }}>
              <HelpCircle className="w-4 h-4 text-brand" /> {t.flipBack}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
