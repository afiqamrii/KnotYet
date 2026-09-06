import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Avatar, getAvatar } from '../components/AvatarPicker';
import { Heart, Sparkles, Check, ChevronRight } from 'lucide-react';
import { sounds } from '../utils/audio';

export const InviteScreen: React.FC = () => {
  const { user, signInWithGoogle, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [inviteData, setInviteData] = useState<{name: string, avatar: string, rel: string} | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const n = searchParams.get('n');
    const a = searchParams.get('a');
    const r = searchParams.get('r');
    
    if (n && a && r) {
      const data = { name: n, avatar: a, rel: r };
      setInviteData(data);
      sessionStorage.setItem('pendingInvite', JSON.stringify(data));
    } else {
      const stored = sessionStorage.getItem('pendingInvite');
      if (stored) {
        setInviteData(JSON.parse(stored));
      }
    }
  }, [location]);

  const handleAccept = async () => {
    sounds.playSuccess();
    if (user) {
      navigate('/play');
    } else {
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (isLoading) return <div className="min-h-screen bg-brand-900 flex items-center justify-center text-white font-bold">Loading...</div>;

  if (!inviteData) {
    return <Navigate to="/" replace />;
  }

  const inviterAvatar = getAvatar(inviteData.avatar);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-brand-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-500/20 blur-[100px] rounded-full mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[100px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-sm w-full space-y-8 animate-fade-in text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl animate-float border-4 border-white/20">
            <span className="text-5xl">{inviterAvatar?.emoji || '🥰'}</span>
          </div>
          <Heart className="w-8 h-8 text-pink-400 animate-pulse" fill="currentColor" />
          <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-dashed border-white/30 text-white/50 bg-white/5">
            <span className="text-4xl">?</span>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black">
            {inviteData.name} invited you!
          </h1>
          <p className="text-lg text-white/80 font-medium leading-relaxed">
            They want to link accounts as your <span className="font-bold text-pink-300 capitalize">{inviteData.rel}</span> on KnotYet.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 space-y-4 text-left">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" /> If you accept:
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-white/90">
              <Check className="w-5 h-5 text-green-400 shrink-0" />
              Your avatars will be combined everywhere in the app!
            </li>
            <li className="flex items-start gap-3 text-sm text-white/90">
              <Check className="w-5 h-5 text-green-400 shrink-0" />
              You'll instantly join their multiplayer rooms easily.
            </li>
            <li className="flex items-start gap-3 text-sm text-white/90">
              <Check className="w-5 h-5 text-green-400 shrink-0" />
              Track your relationship compatibility together.
            </li>
          </ul>
        </div>

        <button onClick={handleAccept} className="w-full btn-chunky btn-pink py-4 text-lg group">
          {user ? 'Accept & Continue' : 'Login to Accept'}
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
