import React, { useState } from 'react';
import { useGame } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { AvatarPicker, Avatar } from '../components/AvatarPicker';
import { Heart, Sparkles, UserCircle2 } from 'lucide-react';

export const OnboardingScreen: React.FC = () => {
  const { setProfile, t } = useGame();
  const { signInWithGoogle, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState('sunny');
  const [step, setStep] = useState<'auth' | 'avatar' | 'name'>('auth');

  const handleFinish = () => {
    if (!name.trim()) return;
    setProfile({
      name: name.trim(),
      avatarId,
      heartPoints: 0,
    });
  };

  return (
    <div className="min-h-screen flex items-end justify-center pb-0"
      style={{ background: 'linear-gradient(160deg, #7C3AED 0%, #4F46E5 50%, #06B6D4 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-48 h-48 rounded-full opacity-30 top-[-40px] right-[-40px]"
          style={{ background: '#FACC15', filter: 'blur(30px)' }} />
        <div className="absolute w-40 h-40 rounded-full opacity-25 top-[30%] left-[-30px]"
          style={{ background: '#FF2D9B', filter: 'blur(24px)' }} />
        <div className="absolute w-56 h-56 rounded-full opacity-20 bottom-[20%] right-[-40px]"
          style={{ background: '#06B6D4', filter: 'blur(36px)' }} />
      </div>

      {/* Top illustration */}
      <div className="fixed top-0 left-0 right-0 flex flex-col items-center justify-center pt-12 pb-6 z-10 pointer-events-none">
        <div className="animate-float">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-xl border-4 border-white/30"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(20px)' }}
          >
            <Heart className="w-10 h-10 fill-white text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white mt-4 text-center leading-tight drop-shadow-lg">
          {t.onboardTitle}
        </h1>
        <p className="text-white/70 text-sm mt-1 text-center">
          {t.onboardSub}
        </p>
      </div>

      {/* Bottom Sheet Card */}
      <div className="w-full max-w-md game-card rounded-b-none rounded-t-[2.5rem] p-6 space-y-5 z-20 relative"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)', marginBottom: 0, minHeight: '66vh' }}
      >
        {step === 'auth' ? (
          <div className="flex flex-col h-full justify-center space-y-4 pt-10">
            <button
              onClick={() => signInWithGoogle().catch(console.error)}
              className="btn-chunky w-full flex items-center justify-center gap-2 bg-white text-ink border-2 border-gray-200"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 opacity-50 my-2">
              <div className="flex-1 h-px bg-current"></div>
              <span className="text-xs font-bold uppercase tracking-widest">OR</span>
              <div className="flex-1 h-px bg-current"></div>
            </div>

            <button
              onClick={() => setStep('avatar')}
              className="btn-chunky btn-white w-full flex items-center justify-center gap-2 opacity-80"
            >
              <UserCircle2 className="w-5 h-5" />
              Play as Guest (Local Only)
            </button>
            <p className="text-xs text-center text-ink-3 font-semibold px-4 mt-2">
              Guest progress will be lost if you clear your browser data.
            </p>
          </div>
        ) : step === 'avatar' ? (
          <>
            <div>
              <h2 className="text-xl font-black text-ink">{t.onboardAvatarLabel}</h2>
              <p className="text-ink-3 text-xs mt-0.5">This is how your partner sees you in the game!</p>
            </div>

            <AvatarPicker selected={avatarId} onChange={setAvatarId} />

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#F5F3FF' }}>
              <Avatar avatarId={avatarId} size={52} />
              <div>
                <p className="text-xs text-ink-3 font-semibold">Your character:</p>
                <p className="text-base font-black text-ink capitalize">{avatarId}</p>
              </div>
            </div>

            <button
              className="btn-chunky btn-pink w-full text-sm"
              onClick={() => setStep('name')}
            >
              Next — Pick Your Name
            </button>
          </>
        ) : (
          <>
            <button
              className="text-xs font-bold text-ink-3 flex items-center gap-1"
              onClick={() => setStep('avatar')}
            >
              ← Back
            </button>

            <div className="flex items-center gap-4">
              <Avatar avatarId={avatarId} size={64} />
              <div>
                <p className="text-xs text-ink-3 font-semibold">Your character</p>
                <p className="text-lg font-black text-ink capitalize">{avatarId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-ink">{t.onboardNameLabel}</label>
              <input
                type="text"
                maxLength={20}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.onboardNamePlaceholder}
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl text-base font-bold text-ink border-[3px] outline-none transition"
                style={{
                  borderColor: name ? '#7C3AED' : '#E5E7EB',
                  background: '#FAFAFA',
                  boxShadow: name ? '0 0 0 4px rgba(124,58,237,0.1)' : 'none',
                }}
                onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.1)'; }}
                onBlur={e => { if (!name) { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; } }}
              />
            </div>

            {/* Tip */}
            <div className="flex items-start gap-2 p-3 rounded-2xl" style={{ background: '#FFF7ED' }}>
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                Start with 0 Heart Points. Play games with your partner to earn points and unlock your compatibility score!
              </p>
            </div>

            <button
              className={`btn-chunky w-full text-sm ${name.trim() ? 'btn-pink' : 'btn-white opacity-60'}`}
              onClick={handleFinish}
              disabled={!name.trim()}
            >
              {t.onboardStart} ✨
            </button>
          </>
        )}
      </div>
    </div>
  );
};
