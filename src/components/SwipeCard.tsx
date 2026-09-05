import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { RotateCw, Check, X, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { SwipeCardItem } from '../data/questions';
import { sounds } from '../utils/audio';

interface SwipeCardProps {
  card: SwipeCardItem;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({ card, onSwipe, isTop }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const x = useMotionValue(0);

  // Dynamic rotation and opacity based on swipe drag distance
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.5, 1, 1, 1, 0.5]);
  const passOpacity = useTransform(x, [20, 120], [0, 1]);
  const skipOpacity = useTransform(x, [-20, -120], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      sounds.playSwipe();
      onSwipe('right');
    } else if (info.offset.x < -threshold) {
      sounds.playSwipe();
      onSwipe('left');
    }
  };

  const toggleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playFlip();
    setIsFlipped(!isFlipped);
  };

  if (!isTop) {
    // Background card preview
    return (
      <div className="absolute inset-0 w-full h-full rounded-3xl bg-white/60 border border-stone-200/80 shadow-md scale-95 translate-y-3 pointer-events-none" />
    );
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing perspective-1000 select-none touch-none"
    >
      {/* Visual Swipe Badges */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-6 right-6 z-30 border-4 border-emerald-500 text-emerald-600 font-extrabold px-4 py-1.5 rounded-xl rotate-12 bg-white/90 shadow-lg text-lg uppercase tracking-wider flex items-center gap-1.5"
      >
        <Check className="w-5 h-5 stroke-[3]" /> Jawab Dah!
      </motion.div>

      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute top-6 left-6 z-30 border-4 border-rose-500 text-rose-600 font-extrabold px-4 py-1.5 rounded-xl -rotate-12 bg-white/90 shadow-lg text-lg uppercase tracking-wider flex items-center gap-1.5"
      >
        <X className="w-5 h-5 stroke-[3]" /> Skip Dulu
      </motion.div>

      {/* 3D Card Inner Container */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className="w-full h-full relative rounded-3xl transform-style-3d shadow-xl border border-stone-200 bg-gradient-to-b from-white via-rose-50/30 to-white overflow-hidden"
      >
        {/* FRONT OF CARD */}
        <div className="absolute inset-0 w-full h-full p-6 flex flex-col justify-between backface-hidden bg-white">
          {/* Top Header */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${card.badgeColor}`}>
              {card.categoryLabel}
            </span>

            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-semibold border border-rose-100">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {card.turn === 'Dua-dua Serentak' ? '🤝 Dua-dua' : `🎤 ${card.turn}`}
            </div>
          </div>

          {/* Center Main Question */}
          <div className="my-auto py-4 text-center">
            <p className="text-xl md:text-2xl font-extrabold text-stone-800 leading-snug tracking-tight">
              "{card.question}"
            </p>
          </div>

          {/* Bottom Flip Action Indicator */}
          <div className="space-y-3">
            <button
              onClick={toggleFlip}
              className="w-full py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-600 font-semibold text-xs flex items-center justify-center gap-2 border border-stone-200/80 transition active:scale-98"
            >
              <RotateCw className="w-4 h-4 text-rose-500" />
              {card.category === 'teka-teki' ? 'Tekan untuk Reveal Jawapan' : 'Tekan untuk Soalan Perangkap / Tips'}
            </button>

            <div className="flex items-center justify-between text-[11px] text-stone-400 px-1 font-medium">
              <span>👈 Tarik Kiri: Skip</span>
              <span>Tarik Kanan: Lulus 👉</span>
            </div>
          </div>
        </div>

        {/* BACK OF CARD (Flipped) */}
        <div className="absolute inset-0 w-full h-full p-6 flex flex-col justify-between backface-hidden rotate-y-180 bg-gradient-to-br from-rose-50 via-white to-amber-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 bg-rose-100/80 border border-rose-200 px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {card.flipContent.title}
            </span>

            <button
              onClick={toggleFlip}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-rose-100 text-stone-600 transition"
              title="Pusing Semula"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Flip Details Content */}
          <div className="my-auto py-3 space-y-4">
            <p className="text-stone-800 text-base md:text-lg font-medium leading-relaxed text-center">
              {card.flipContent.description}
            </p>

            {/* Green Flag / Red Flag Badges for Taaruf Cards */}
            {card.flipContent.greenFlag && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-left">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-1">
                  <span className="text-base">🟢</span> Green Flag:
                </div>
                <p className="text-emerald-900 text-xs leading-relaxed">
                  {card.flipContent.greenFlag}
                </p>
              </div>
            )}

            {card.flipContent.redFlag && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-left">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs mb-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600" /> Red Flag:
                </div>
                <p className="text-rose-900 text-xs leading-relaxed">
                  {card.flipContent.redFlag}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={toggleFlip}
            className="w-full py-2.5 rounded-2xl bg-stone-900 text-white font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <HelpCircle className="w-4 h-4" /> Pusing Balik ke Soalan Asal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
