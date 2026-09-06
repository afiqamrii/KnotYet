import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { useGame } from '../store/GameContext';
import { AvatarPicker, Avatar } from '../components/AvatarPicker';
import { Layers, Heart, Dices, Users, ArrowRight, Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  onComplete: () => void;
}

const GAMES_INFO = [
  { icon: <Layers className="w-5 h-5" />, title: 'Icebreaker Cards', desc: 'Swipe through deep questions and fun riddles to break the ice.', color: '#FF2D9B' },
  { icon: <Heart className="w-5 h-5" />, title: 'Guess My Heart', desc: 'Pick an answer secretly, then test if your partner can guess it.', color: '#06B6D4' },
  { icon: <Dices className="w-5 h-5" />, title: 'Spin the Wheel', desc: 'Spin when it gets quiet. The wheel picks your next conversation topic.', color: '#F59E0B' },
  { icon: <Users className="w-5 h-5" />, title: 'Play Online', desc: 'Create a room, invite your partner, and play together in real-time.', color: '#7C3AED' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { setProfile } = useGame();
  const [step, setStep] = useState<'welcome' | 'avatar' | 'name' | 'creating'>('welcome');
  const [name, setName] = useState(user?.user_metadata?.full_name?.split(' ')[0] || '');
  const [avatarId, setAvatarId] = useState('sunny');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, [step]);

  const handleFinish = () => {
    if (!name.trim()) return;
    setIsVisible(false);
    setTimeout(() => {
      setStep('creating');
      setIsVisible(true);
      
      // Delay before actually completing the profile setup
      setTimeout(() => {
        setProfile({
          name: name.trim(),
          avatarId,
          heartPoints: 0,
        });
        onComplete();
      }, 3000);
    }, 300);
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  if (step === 'welcome') {
    return (
      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#F8F7FF]">

        {/* Animated orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-15 top-[-80px] right-[-80px]"
            style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
          <div className="absolute w-[300px] h-[300px] rounded-full opacity-10 bottom-[-60px] left-[-40px]"
            style={{ background: 'radial-gradient(circle, #FF2D9B 0%, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
        </div>

        <div className="relative z-10 max-w-lg mx-auto px-5 flex-1 flex flex-col justify-center py-12"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(30px)', transition: 'all 0.8s ease' }}>
          
          {/* Greeting */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 bg-white border border-stone-200 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 tracking-wide">Signed in successfully</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-ink leading-tight mb-3">
              Welcome,{' '}
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #FF2D9B, #F59E0B)' }}>
                {firstName}
              </span>
            </h1>
            <p className="text-sm text-ink-3 font-medium leading-relaxed">
              Here is what you can do in KnotYet. Have fun exploring these games with your partner.
            </p>
          </div>

          {/* Game cards */}
          <div className="space-y-3 mb-10">
            {GAMES_INFO.map((game, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl flex items-start gap-3.5 bg-white border border-stone-100 shadow-sm"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'none' : 'translateX(-20px)',
                  transition: `all 0.5s ease ${0.3 + i * 0.1}s`,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${game.color}15`, color: game.color }}>
                  {game.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink mb-0.5">{game.title}</h3>
                  <p className="text-xs text-ink-3 font-medium leading-relaxed">{game.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => { setIsVisible(false); setTimeout(() => setStep('avatar'), 300); }}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(255,45,155,0.25)',
            }}
          >
            Set Up Your Profile
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'avatar') {
    return (
      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#F8F7FF]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-15 top-[-80px] right-[-80px]"
            style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-lg mx-auto px-5 flex-1 flex flex-col justify-center py-12"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(30px)', transition: 'all 0.6s ease' }}>
          
          <h2 className="text-2xl font-black text-ink mb-1">Pick Your Character</h2>
          <p className="text-sm text-ink-3 font-medium mb-6">This is how your partner sees you in the game.</p>

          <div className="p-5 rounded-3xl mb-6 bg-white shadow-sm border border-stone-200">
            <AvatarPicker selected={avatarId} onChange={setAvatarId} />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-4 rounded-2xl mb-8 bg-white border border-stone-200 shadow-sm">
            <Avatar avatarId={avatarId} size={52} />
            <div>
              <p className="text-xs text-ink-3 font-semibold">Your character</p>
              <p className="text-base font-black text-ink capitalize">{avatarId}</p>
            </div>
          </div>

          <button
            onClick={() => { setIsVisible(false); setTimeout(() => setStep('name'), 300); }}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(255,45,155,0.25)',
            }}
          >
            Next — Pick Your Name
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#F8F7FF]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-15 top-[-80px] right-[-80px]"
          style={{ background: 'radial-gradient(circle, #FF2D9B 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-5 flex-1 flex flex-col justify-center py-12"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(30px)', transition: 'all 0.6s ease' }}>

        <button
          className="text-xs font-bold text-ink-3 flex items-center gap-1 mb-6 hover:text-ink transition"
          onClick={() => { setIsVisible(false); setTimeout(() => setStep('avatar'), 300); }}
        >
          ← Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <Avatar avatarId={avatarId} size={64} />
          <div>
            <p className="text-xs text-ink-3 font-semibold">Your character</p>
            <p className="text-lg font-black text-ink capitalize">{avatarId}</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-black text-ink">What should we call you?</label>
          <input
            type="text"
            maxLength={20}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Afiq"
            autoFocus
            className="w-full px-4 py-3.5 rounded-2xl text-base font-bold outline-none transition"
            style={{
              background: 'white',
              border: name ? '2px solid #7C3AED' : '2px solid #E5E7EB',
              color: '#1E1B4B',
              boxShadow: name ? '0 0 0 4px rgba(124,58,237,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
            }}
          />
        </div>

        {/* Tip */}
        <div className="flex items-start gap-2 p-3 rounded-2xl mb-8"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-semibold leading-relaxed">
            Start with 0 Heart Points. Play games with your partner to earn points and unlock your compatibility score.
          </p>
        </div>

        <button
          className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]"
          onClick={handleFinish}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? 'linear-gradient(135deg, #FF2D9B, #7C3AED)' : '#E5E7EB',
            color: name.trim() ? 'white' : '#9CA3AF',
            boxShadow: name.trim() ? '0 8px 32px rgba(255,45,155,0.25)' : 'none',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Start Playing
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
    );
  }

  // Step: creating
  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#F8F7FF] items-center justify-center">
      <div className="relative z-10 text-center animate-fade-in flex flex-col items-center">
        
        <div className="w-64 h-32 relative mb-8">
          <div className="fazers-loader-container">
            <div className="fazers-loader">
              <span><span></span><span></span><span></span><span></span></span>
              <div className="fazers-base">
                <span></span>
                <div className="fazers-face"></div>
              </div>
            </div>
            <div className="longfazers">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-black text-ink mb-2 tracking-wide animate-pulse">Creating your account...</h2>
        <p className="text-sm text-ink-3 font-semibold">Almost there! Getting things ready.</p>
      </div>
    </div>
  );
};
