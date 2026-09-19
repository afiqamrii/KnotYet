import React from 'react';
import { Heart, RefreshCw, Share2, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
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
  const { t } = useGame();
  if (!isOpen) return null;

  const handleShare = () => {
    sounds.playSuccess();
    const text = `We just discussed ${answeredCount} questions in ${categoryLabel} on KnotYet!`;
    if (navigator.share) {
      navigator.share({ title: 'KnotYet', text }).catch(console.error);
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="completion-overlay">
      <section className="completion-sheet" role="dialog" aria-modal="true" aria-labelledby="deck-complete-title">
        <header className="completion-heading">
          <span className="completion-kicker"><Sparkles aria-hidden="true" /> ICEBREAKER CARDS</span>
          <span className="completion-symbol completion-symbol-pink"><Heart aria-hidden="true" /></span>
          <h2 id="deck-complete-title">{t.summaryTitle}</h2>
          <p>{t.summaryCategory} <strong>{categoryLabel}</strong></p>
        </header>

        <div className="completion-stats">
          <div className="completion-stat completion-stat-green">
            <span><CheckCircle2 aria-hidden="true" /> {t.summaryAnswered}</span>
            <strong>{answeredCount}</strong>
          </div>
          <div className="completion-stat completion-stat-purple">
            <span>{t.summarySkipped}</span>
            <strong>{skippedCount}</strong>
          </div>
        </div>

        <p className="completion-note">{t.summaryVibeText}</p>

        <div className="completion-actions">
          <button type="button" onClick={onRestart} className="completion-button completion-button-primary">
            <RefreshCw aria-hidden="true" /> {t.summaryRestart}
          </button>
          <button type="button" onClick={onSelectCategory} className="completion-button completion-button-secondary">
            {t.summaryChangeCategory} <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" onClick={handleShare} className="completion-share">
            <Share2 aria-hidden="true" /> {t.summaryShare}
          </button>
        </div>
      </section>
    </div>
  );
};
