import React, { useState, useEffect } from 'react';
import { X, PlayCircle, Loader2, Sparkles, Clock } from 'lucide-react';
import { sounds } from '../utils/audio';

interface AdModalProps {
  onClose: () => void;
  onRewardEarned: () => void;
  title: string;
  description: string;
  rewardText: string;
}

export const AdModal: React.FC<AdModalProps> = ({ onClose, onRewardEarned, title, description, rewardText }) => {
  const [adState, setAdState] = useState<'idle' | 'loading' | 'playing' | 'rewarded'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const startAd = () => {
    sounds.playFlip();
    setAdState('loading');
    
    // Simulate network delay for ad request
    setTimeout(() => {
      setAdState('playing');
    }, 1500);
  };

  useEffect(() => {
    if (adState === 'playing') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setAdState('rewarded');
        sounds.playSuccess();
        setTimeout(() => {
          onRewardEarned();
        }, 1500);
      }
    }
  }, [adState, countdown, onRewardEarned]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-pop-in border-4 border-purple-200">
        
        {adState === 'idle' && (
          <>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-stone-100 text-stone-400 rounded-full hover:bg-stone-200 hover:text-stone-600 transition">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4 border-2 border-purple-200 shadow-inner">
              <PlayCircle className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-xl font-black text-ink mb-2">{title}</h3>
            <p className="text-sm font-semibold text-ink-3 mb-1">{description}</p>
            <p className="text-[11px] font-bold text-ink-3/70 flex items-center justify-center gap-1 mb-6">
              <Clock className="w-3 h-3" /> Resets in {timeUntilReset}
            </p>
            
            <button
              onClick={startAd}
              className="w-full py-4 rounded-2xl font-black text-white text-lg bg-purple-500 hover:bg-purple-600 transition shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <PlayCircle className="w-6 h-6" />
              Watch Ad for {rewardText}
            </button>
            <p className="text-[10px] font-bold text-ink-3/50 mt-4 uppercase tracking-widest">Sponsored Content</p>
          </>
        )}

        {adState === 'loading' && (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-sm font-bold text-ink-3">Loading Ad...</p>
          </div>
        )}

        {adState === 'playing' && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-full aspect-video bg-stone-900 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden border-2 border-stone-800">
              <p className="text-stone-500 font-bold uppercase tracking-widest text-xs z-10">Simulated Ad Space</p>
              
              {/* Fake ad visual */}
              <div className="absolute inset-0 opacity-20 bg-gradient-to-tr from-purple-500 to-cyan-400" />
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[10px] font-bold text-white border border-white/10">
                Ad
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink-3">Reward in</span>
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-black flex items-center justify-center border border-purple-200">
                {countdown}
              </span>
            </div>
          </div>
        )}

        {adState === 'rewarded' && (
          <div className="py-8 flex flex-col items-center animate-pop-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 border-2 border-emerald-200">
              <Sparkles className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-emerald-600 mb-2">Reward Unlocked!</h3>
            <p className="text-sm font-bold text-ink-3">Enjoy your {rewardText} 💖</p>
          </div>
        )}
        
      </div>
    </div>
  );
};
