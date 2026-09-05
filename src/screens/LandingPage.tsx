import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { Heart, Layers, Dices, Sparkles, Users, Shield, ChevronDown, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: <Layers className="w-6 h-6" />,
    title: 'Icebreaker Cards',
    desc: 'Swipe through deep questions, fun riddles, and vibe-check prompts that spark real conversations.',
    color: '#FF2D9B',
    bg: 'rgba(255,45,155,0.1)',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Guess My Heart',
    desc: 'Test how well you know each other. Pick secretly, guess your partner\'s answer, and see if your hearts align.',
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.1)',
  },
  {
    icon: <Dices className="w-6 h-6" />,
    title: 'Spin the Wheel',
    desc: 'When the silence gets awkward — spin the anti-awkward wheel and let fate pick the next topic.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Play Together Online',
    desc: 'Create a room, share a code, and play in real-time with your partner — perfect for long-distance couples.',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.1)',
  },
];

export const LandingPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-[#F8F7FF]">

      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-10 top-[-120px] right-[-120px]"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.07] bottom-[-100px] left-[-80px]"
          style={{ background: 'radial-gradient(circle, #FF2D9B 0%, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-5 top-[40%] left-[50%]"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)', animation: 'float 12s ease-in-out infinite' }} />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg mx-auto px-5 flex flex-col min-h-[100dvh]">
        
        {/* Nav */}
        <nav className="flex items-center justify-between pt-6 pb-4"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(-20px)', transition: 'all 0.6s ease 0.1s' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)' }}>
              <Heart className="w-5 h-5 fill-white text-white" />
            </div>
            <span className="text-base font-black text-ink tracking-tight">JodohDeck</span>
          </div>
        </nav>

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center py-8"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(30px)', transition: 'all 0.8s ease 0.3s' }}>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 self-start"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-bold text-violet-700 tracking-wide">Interactive Taaruf Game</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-ink leading-[1.1] mb-4">
            Get to Know{' '}
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #FF2D9B, #F59E0B, #06B6D4)' }}>
              Each Other
            </span>
            <br />Before Saying{' '}
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #7C3AED, #FF2D9B)' }}>
              "I Do"
            </span>
          </h1>

          <p className="text-base text-ink-3 font-medium leading-relaxed mb-8 max-w-md">
            Swipe cards, guess hearts, and spin the wheel — fun games designed for Muslim couples to build understanding, chemistry, and trust.
          </p>

          {/* CTA Buttons */}
          <div className="space-y-3 mb-10">
            <button
              onClick={() => signInWithGoogle().catch(console.error)}
              className="w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(255,45,155,0.3), 0 4px 0 rgba(0,0,0,0.15)',
              }}
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="G" />
              Continue with Google
              <ArrowRight className="w-5 h-5 ml-auto" />
            </button>
            
            <p className="text-center text-xs text-ink-3/70 font-medium flex items-center justify-center gap-1.5">
              <Shield className="w-3 h-3" /> Your data stays private. We only save your game progress.
            </p>
          </div>

          {/* Scroll hint */}
          <div className="flex flex-col items-center gap-1 animate-bounce opacity-40">
            <span className="text-[10px] text-ink font-bold uppercase tracking-widest">Explore Features</span>
            <ChevronDown className="w-4 h-4 text-ink" />
          </div>
        </div>

        {/* Features Section */}
        <section className="py-12 space-y-5"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(40px)', transition: 'all 0.8s ease 0.6s' }}>
          <h2 className="text-xl font-black text-ink mb-6">What You Can Play</h2>
          
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl flex items-start gap-4 transition-all duration-300 cursor-pointer"
              style={{
                background: activeFeature === i ? 'white' : 'transparent',
                border: activeFeature === i ? `1px solid ${feat.bg.replace('0.1', '0.2')}` : '1px solid transparent',
                boxShadow: activeFeature === i ? '0 8px 24px rgba(0,0,0,0.04)' : 'none',
                transform: activeFeature === i ? 'scale(1.02)' : 'scale(1)',
              }}
              onClick={() => setActiveFeature(i)}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: feat.bg, color: feat.color }}>
                {feat.icon}
              </div>
              <div>
                <h3 className="text-base font-black text-ink mb-1">{feat.title}</h3>
                <p className="text-sm text-ink-3 font-medium leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Stats / Trust signals */}
        <section className="py-10 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #FF2D9B, #F59E0B)' }}>200+</p>
            <p className="text-[10px] text-ink-3/60 font-bold uppercase tracking-wider mt-1">Questions</p>
          </div>
          <div>
            <p className="text-2xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>4</p>
            <p className="text-[10px] text-ink-3/60 font-bold uppercase tracking-wider mt-1">Game Modes</p>
          </div>
          <div>
            <p className="text-2xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #06B6D4, #10B981)' }}>Free</p>
            <p className="text-[10px] text-ink-3/60 font-bold uppercase tracking-wider mt-1">Forever</p>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pb-12 pt-4">
          <div className="p-6 rounded-3xl text-center space-y-4 shadow-sm"
            style={{ background: 'white', border: '1px solid #E5E7EB' }}>
            <h3 className="text-lg font-black text-ink">Ready to Start?</h3>
            <p className="text-xs text-ink-3 font-medium">
              Sign in to save your progress, track your answers, and never repeat the same question.
            </p>
            <button
              onClick={() => signInWithGoogle().catch(console.error)}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-white transition active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #FF2D9B)', boxShadow: '0 6px 24px rgba(124,58,237,0.3)' }}
            >
              Get Started — It's Free
            </button>
          </div>
          
          <p className="text-center text-[10px] text-ink-3/40 font-medium mt-6">
            Made with love for Muslim couples everywhere.
          </p>
        </section>
      </div>
    </div>
  );
};
