import React from 'react';
import { Heart, RefreshCw, Share2, Sparkles, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame } from '../store/GameContext';

interface SummaryModalProps {
  isOpen: boolean;
  answeredCount: number;
  skippedCount: number;
  categoryLabel: string;
  onRestart: () => void;
  onSelectCategory: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen, answeredCount, skippedCount, categoryLabel, onRestart, onSelectCategory
}) => {
  const { t, profile } = useGame();
  if (!isOpen) return null;

  const handleShare = () => {
    sounds.playSuccess();
    const text = encodeURIComponent(`We just discussed ${answeredCount} questions in ${categoryLabel} on KnotYet! Do you dare test your partner's honesty? 🔥`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="modal-overlay centered" onClick={onRestart}>
      <div className="game-card w-full max-w-sm p-6 text-center space-y-5 animate-pop-in"
        onClick={e => e.stopPropagation()}>

        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto animate-float"
          style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 8px 0 #C41D77, 0 12px 24px rgba(255,45,155,0.4)' }}>
          <Heart className="w-8 h-8 fill-white text-white" />
        </div>

        <div>
          <span className="tag" style={{ background: '#FCE7F3', color: '#FF2D9B', border: '2px solid #FBCFE8' }}>
            {t.summaryTitle}
          </span>
          <p className="text-xs text-ink-3 mt-2">
            {t.summaryCategory} <strong className="text-ink">{categoryLabel}</strong>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl text-center" style={{ background: '#D1FAE5', border: '2px solid #6EE7B7' }}>
            <div className="flex items-center justify-center gap-1 text-xs font-black text-green-800 mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t.summaryAnswered}
            </div>
            <div className="text-2xl font-black text-green-900">{answeredCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl text-center" style={{ background: '#F3F4F6', border: '2px solid #E5E7EB' }}>
            <div className="text-xs font-black text-ink-3 mb-0.5">{t.summarySkipped}</div>
            <div className="text-2xl font-black text-ink-2">{skippedCount}</div>
          </div>
        </div>

        {/* Points earned */}
        {profile && (
          <div className="flex items-center justify-between p-3 rounded-2xl"
            style={{ background: '#EDE9FE', border: '2px solid #DDD6FE' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">💗</span>
              <div className="text-left">
                <p className="text-xs font-black text-brand">{t.pointsEarned}</p>
                <p className="text-[10px] text-ink-3">+10 for completing deck</p>
              </div>
            </div>
            <span className="text-2xl font-black text-brand">{profile.heartPoints}</span>
          </div>
        )}

        {/* Vibe text */}
        <div className="p-3 rounded-xl text-xs text-ink-2 text-left space-y-1"
          style={{ background: '#FFFBEB', border: '2px solid #FDE68A' }}>
          <div className="font-black flex items-center gap-1 text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {t.summaryVibe}
          </div>
          <p className="leading-relaxed font-semibold">{t.summaryVibeText}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={handleShare} className="btn-chunky btn-green w-full text-xs">
            <Share2 className="w-4 h-4" /> {t.summaryShare}
          </button>
          <button onClick={onRestart} className="btn-chunky btn-pink w-full text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> {t.summaryRestart}
          </button>
          <button onClick={onSelectCategory}
            className="w-full py-2 text-xs font-semibold text-ink-3 hover:text-ink transition">
            {t.summaryChangeCategory}
          </button>
        </div>
      </div>
    </div>
  );
};
