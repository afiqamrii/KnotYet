import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, type MotionStyle, type PanInfo, type TargetAndTransition } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { UiSymbol } from './GameCardDesign';
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

const CATEGORY_COLORS: Record<string, { bg: string; label: string; icon: 'puzzle' | 'heart' | 'together' | 'zap' }> = {
  'teka-teki': { bg: '#ffe5a0', label: 'A LITTLE BRAIN TEASER', icon: 'puzzle' },
  'vibe-check': { bg: '#cbeafa', label: 'ON YOUR WAVELENGTH', icon: 'heart' },
  'taaruf-realiti': { bg: '#ffd2dc', label: 'A LITTLE CLOSER', icon: 'together' },
  'dare-santai': { bg: '#d5f578', label: 'YOUR NEXT LITTLE ADVENTURE', icon: 'zap' },
};

export const SwipeCard: React.FC<SwipeCardProps> = ({ 
  card, cardIndex = 0, stackDepth = 0, onSwipe, isTop,
  isFlipped: controlledIsFlipped, onToggleFlip, 
  myAnswer, partnerAnswer, onSubmitAnswer 
}) => {
  const { t, partner } = useGame();
  const multiplayer = useMultiplayer();
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';
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

  const catColors = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS['vibe-check'];

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
  
  let containerStyle: MotionStyle = {};
  let containerAnimate: TargetAndTransition = {};

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

  const containerClassName = `absolute inset-0 w-full h-full rounded-[32px] perspective-1000 select-none touch-pan-y ${
    isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
  }`;

  return (
    <motion.div style={containerStyle} animate={containerAnimate} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      drag={isTop && canSwipe ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.65}
      onDragEnd={isTop && canSwipe ? handleDragEnd : undefined} className={containerClassName} aria-hidden={!isTop}>
      {isTop && <>
        <motion.div className="card-swipe-stamp stamp-pass" style={{ opacity: passOpacity }}><Check /> {t.passLabel}</motion.div>
        <motion.div className="card-swipe-stamp stamp-skip" style={{ opacity: skipOpacity }}><X /> {t.skipLabel}</motion.div>
      </>}
      <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: .42, ease: [.4, 0, .2, 1] }}
        className="swipe-card conversation-card w-full h-full relative transform-style-3d" style={{ '--card-tint': catColors.bg } as React.CSSProperties}>
        <div className="swipe-card-front conversation-face backface-hidden" aria-hidden={isFlipped}>
          <header className="conversation-top"><span className="conversation-category"><UiSymbol kind={catColors.icon} /> {card.categoryLabel}</span><span className="conversation-turn"><UiSymbol kind="users" />{card.turn === 'Dua-dua Serentak' ? 'You two' : card.turn}</span></header>
          {isMultiplayer && card.category === 'teka-teki' && <p className="conversation-notice">{isMyTurnToAsk ? `Your turn: read to ${partnerName}` : `${partnerName} is asking you`}</p>}
          {isMultiplayer && partnerAnswer && !myAnswer && card.category !== 'teka-teki' && <p className="conversation-notice">{partnerName} has answered. Your turn to reply.</p>}
          <div className="conversation-question">
            <div className="conversation-index"><span>{catColors.label}</span><span>{String(cardIndex + 1).padStart(2, '0')}</span></div>
            <p className={`question-text ${card.question.length > 115 ? 'question-long' : ''}`}>{card.question}</p>
            <div className="conversation-rule"><span /><UiSymbol kind={catColors.icon} /></div>
          </div>
          <footer className="conversation-bottom" onPointerDown={event => event.stopPropagation()}>
            {canFlip ? <button type="button" onClick={toggleFlip} disabled={!isTop || isFlipped} className="card-reveal-button"><UiSymbol kind={card.category === 'teka-teki' ? 'flip' : 'message'} />{card.category === 'teka-teki' ? t.revealAnswer : 'Share your answers'}<UiSymbol kind="next" /></button>
            : <span className="conversation-prompt">No perfect answer. Just your answer.</span>}
            <div className="conversation-directions"><span><UiSymbol kind="back" /> {t.skipLeft}</span><span>{t.passRight} <UiSymbol kind="next" /></span></div>
          </footer>
        </div>
        <div className="swipe-card-back conversation-face conversation-answer backface-hidden rotate-y-180" aria-hidden={!isFlipped}>
          <header className="conversation-top"><span className="conversation-category"><UiSymbol kind="lock" /> THE REVEAL</span><button type="button" className="card-back-button" aria-label="Back to the question" disabled={!isTop || !isFlipped} onClick={toggleFlip}><UiSymbol kind="flip" /></button></header>
          <div className="conversation-answer-body">
            <span className="conversation-answer-label">{card.flipContent.title}</span>
            <p className="question-text answer-text">{card.flipContent.description}</p>
            {isMultiplayer && onSubmitAnswer && card.category !== 'teka-teki' ? <div className="conversation-response">
              {partnerAnswer && !myAnswer && <p className="conversation-notice">{partnerName} has answered. What do you think?</p>}
              {!partnerAnswer && myAnswer && <div className="answer-note"><span>Your answer</span><p>{myAnswer}</p><small>Waiting for {partnerName} to answer...</small></div>}
              {partnerAnswer && myAnswer ? <div className="paired-answers"><div><span>You</span><p>{myAnswer}</p></div><div><span>{partnerName}</span><p>{partnerAnswer}</p></div></div>
              : !myAnswer ? <form onPointerDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('ans') || '').trim(); if (!value) return; onSubmitAnswer(value); sounds.playFlip(); }}>
                <label htmlFor={`card-answer-${card.id}`}>Your answer</label><input id={`card-answer-${card.id}`} name="ans" autoComplete="off" placeholder="Say what is on your mind..." disabled={!isTop || !isFlipped} required />
                <button type="submit" className="card-reveal-button" disabled={!isTop || !isFlipped}>Submit &amp; reveal <UiSymbol kind="next" /></button>
              </form> : null}
            </div> : <>
              {card.flipContent.greenFlag && <div className="answer-note answer-note-green"><span><UiSymbol kind="flag" /> {t.greenFlag}</span><p>{card.flipContent.greenFlag}</p></div>}
              {card.flipContent.redFlag && <div className="answer-note answer-note-pink"><span><UiSymbol kind="flag" /> {t.redFlag}</span><p>{card.flipContent.redFlag}</p></div>}
            </>}
          </div>
          {canFlip && <footer className="conversation-bottom" onPointerDown={event => event.stopPropagation()}><button type="button" onClick={toggleFlip} disabled={!isTop || !isFlipped} className="card-reveal-button"><UiSymbol kind="back" /> {t.flipBack}</button></footer>}
        </div>
      </motion.div>
    </motion.div>
  );
};
