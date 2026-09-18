import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock3, Gift, Loader2, Play, Sparkles, Ticket, X } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useChatDialog } from './useChatDialog';
import '../styles/ad.css';

interface AdModalProps {
  onClose: () => void;
  onRewardEarned: () => void;
  title: string;
  description: string;
  rewardText: string;
}

type AdState = 'idle' | 'loading' | 'playing' | 'rewarded';

export const AdModal: React.FC<AdModalProps> = ({ onClose, onRewardEarned, title, description, rewardText }) => {
  const [adState, setAdState] = useState<AdState>('idle');
  const [countdown, setCountdown] = useState(5);
  const [timeUntilReset, setTimeUntilReset] = useState('');
  const rewardCallback = useRef(onRewardEarned);
  rewardCallback.current = onRewardEarned;
  const closeIfIdle = () => { if (adState === 'idle') onClose(); };
  const dialogRef = useChatDialog(true, closeIfIdle);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adState !== 'loading') return;
    const timer = window.setTimeout(() => setAdState('playing'), 900);
    return () => window.clearTimeout(timer);
  }, [adState]);

  useEffect(() => {
    if (adState !== 'playing') return;
    if (countdown > 0) {
      const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
      return () => window.clearTimeout(timer);
    }
    setAdState('rewarded');
    sounds.playSuccess();
  }, [adState, countdown]);

  useEffect(() => {
    if (adState !== 'rewarded') return;
    const timer = window.setTimeout(() => rewardCallback.current(), 1400);
    return () => window.clearTimeout(timer);
  }, [adState]);

  const startAd = () => {
    sounds.playFlip();
    setCountdown(5);
    setAdState('loading');
  };

  return createPortal(
    <div className="ad-overlay" onMouseDown={closeIfIdle}>
      <section ref={dialogRef} className={`ad-modal is-${adState}`} role="dialog" aria-modal="true" aria-labelledby="ad-title" tabIndex={-1} onMouseDown={event => event.stopPropagation()}>
        <div className="ad-ribbon"><Ticket /> BONUS PLAY</div>
        {adState === 'idle' && <button type="button" onClick={onClose} className="ad-close" aria-label="Close"><X /></button>}

        <div className="ad-layout">
          <div className="ad-art" aria-hidden="true">
            <span className="ad-sponsor-label">SPONSORED BREAK</span>
            <div className="ad-ticket-art"><div><Play fill="currentColor" /></div><strong>5</strong><span>SECONDS</span></div>
            <Sparkles className="ad-spark ad-spark-one" /><Sparkles className="ad-spark ad-spark-two" />
            <p>A tiny pause.<br />More play right after.</p>
          </div>

          <div className="ad-content">
            {adState === 'idle' && <>
              <div className="ad-kicker"><Gift /> KEEP THE GOOD TIME GOING</div>
              <h2 id="ad-title">{title}</h2>
              <p className="ad-description">{description}</p>
              <div className="ad-reward"><span><Gift /></span><div><small>YOUR REWARD</small><strong>{rewardText}</strong></div></div>
              <button type="button" className="ad-watch-button" onClick={startAd}><Play fill="currentColor" /> Watch a short ad <span>→</span></button>
              <p className="ad-reset"><Clock3 /> Free plays refresh in {timeUntilReset}</p>
            </>}

            {adState === 'loading' && <div className="ad-state" aria-live="polite"><div className="ad-loader"><Loader2 /></div><span>GETTING YOUR BONUS READY</span><h2 id="ad-title">One tiny moment...</h2><p>Your game is staying right where you left it.</p></div>}

            {adState === 'playing' && <div className="ad-state" aria-live="polite"><div className="ad-slot"><div className="ad-slot-top"><span>AD</span><small>Reward in {countdown}s</small></div><div className="ad-slot-shapes"><i /><i /><i /></div><strong>Your ad plays here</strong><p>Sponsored content placement</p><div className="ad-progress"><span style={{ width: `${((5 - countdown) / 5) * 100}%` }} /></div></div><p className="ad-stay">Stay on this screen to unlock {rewardText.toLowerCase()}.</p></div>}

            {adState === 'rewarded' && <div className="ad-state ad-success" aria-live="polite"><div className="ad-success-icon"><Check /></div><span>YOU'RE ALL SET</span><h2 id="ad-title">Bonus unlocked!</h2><p>{rewardText} is ready. Taking you back to the fun...</p><div className="ad-confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div></div>}
          </div>
        </div>
      </section>
    </div>, document.body
  );
};
