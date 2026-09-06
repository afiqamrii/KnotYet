import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile, UserProgress, CoupleProgress } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { AdModal } from '../components/AdModal';

const MULTIPLAYER_DAILY_LIMIT = 3;
const SOLO_DAILY_LIMIT = 5;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  progress: UserProgress | null;
  couple: CoupleProgress | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProgress: () => Promise<void>;
  refreshCouple: () => Promise<void>;
  incrementPlayCount: (type: 'solo' | 'multiplayer') => Promise<void>;
  awardBonusPlay: (type: 'solo' | 'multiplayer') => Promise<void>;
  checkLimit: (type: 'solo' | 'multiplayer') => boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  progress: null,
  couple: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProgress: async () => {},
  refreshCouple: async () => {},
  incrementPlayCount: async () => {},
  awardBonusPlay: async () => {},
  checkLimit: () => true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [couple, setCouple] = useState<CoupleProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adLimitType, setAdLimitType] = useState<'solo' | 'multiplayer' | null>(null);

  const checkLimit = (type: 'solo' | 'multiplayer') => {
    const limit = type === 'solo' ? SOLO_DAILY_LIMIT : MULTIPLAYER_DAILY_LIMIT;
    const count = type === 'solo' ? progress?.solo_play_count : progress?.play_together_count;
    if (!progress?.is_premium && (count || 0) >= limit) {
      setAdLimitType(type);
      setIsAdModalOpen(true);
      return false;
    }
    return true;
  };

  const refreshProgress = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();
      
    if (data && !error) {
      const today = new Date().toISOString().split('T')[0];
      if (data.last_reset_date !== today) {
        // Perform daily reset
        const { data: updatedData } = await supabase
          .from('user_progress')
          .update({
             last_reset_date: today,
             play_together_count: 0,
             solo_play_count: 0
          })
          .eq('user_id', user.id)
          .select()
          .single();
          
        if (updatedData) {
          setProgress(updatedData);
          return;
        }
      }
      setProgress(data);
    }
  };

  const refreshCouple = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('couples')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .single();
      
    if (data && !error) {
      setCouple(data);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchUserData() {
      if (!user) {
        setProfile(null);
        setProgress(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      // Fetch Profile
      let { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!ignore) setProfile(prof);

      // --- MIGRATION LOGIC ---
      const hasMigrated = localStorage.getItem('jodohdeck_migrated_to_cloud');
      if (!hasMigrated) {
        try {
          const localProfileStr = localStorage.getItem('jodohdeck_profile');
          const localAnsweredStr = localStorage.getItem('jodohdeck_answered');
          let localPoints = 0;
          let localAnswered: string[] = [];
          let localName = '';
          let localAvatarId = '';
          
          if (localProfileStr) {
            const lp = JSON.parse(localProfileStr);
            if (lp.heartPoints) localPoints = lp.heartPoints;
            if (lp.name) localName = lp.name;
            if (lp.avatarId) localAvatarId = lp.avatarId;
          }
          if (localAnsweredStr) {
            localAnswered = JSON.parse(localAnsweredStr);
          }

          if (localName || localAvatarId) {
             await supabase.from('profiles').update({
               name: localName || prof.name,
               avatar_id: localAvatarId || prof.avatar_id
             }).eq('id', user.id);
             
             // Update local state to reflect the migration instantly
             prof = { ...prof, name: localName || prof.name, avatar_id: localAvatarId || prof.avatar_id };
             if (!ignore) setProfile(prof);
          }

          if (localPoints > 0 || localAnswered.length > 0) {
            // Update Supabase to merge local progress
            await supabase.from('user_progress').update({
              heart_points: localPoints,
              answered_questions: localAnswered
            }).eq('user_id', user.id);
          }
          localStorage.setItem('jodohdeck_migrated_to_cloud', 'true');
        } catch (e) {
          console.error('Failed to migrate local storage to Supabase:', e);
        }
      }

      // Fetch Progress
      await refreshProgress();
      await refreshCouple();
      
      if (!ignore) setIsLoading(false);
    }

    fetchUserData();
    return () => { ignore = true; };
  }, [user]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin.includes('localhost') 
          ? window.location.origin 
          : 'https://knotyetapp.me'
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };
  
  const incrementPlayCount = async (type: 'solo' | 'multiplayer') => {
    if (!user || !progress) return;
    const field = type === 'solo' ? 'solo_play_count' : 'play_together_count';
    const newCount = (progress[field] || 0) + 1;
    
    const { data } = await supabase
      .from('user_progress')
      .update({ [field]: newCount })
      .eq('user_id', user.id)
      .select()
      .single();
      
    if (data) setProgress(data);
  };
  
  const awardBonusPlay = async (type: 'solo' | 'multiplayer') => {
    if (!user || !progress) return;
    const field = type === 'solo' ? 'solo_play_count' : 'play_together_count';
    // By decrementing the count, we give them one "bonus" play that allows them back under the limit
    const newCount = Math.max(0, (progress[field] || 0) - 1);
    
    const { data } = await supabase
      .from('user_progress')
      .update({ [field]: newCount })
      .eq('user_id', user.id)
      .select()
      .single();
      
    if (data) setProgress(data);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, progress, couple, isLoading, signInWithGoogle, signOut, refreshProgress, refreshCouple, incrementPlayCount, awardBonusPlay, checkLimit }}>
      {children}
      {isAdModalOpen && adLimitType && (
        <AdModal 
          title={adLimitType === 'multiplayer' ? "Multiplayer Limit Reached" : "Daily Limit Reached"}
          description={adLimitType === 'multiplayer' 
            ? `You've used your ${MULTIPLAYER_DAILY_LIMIT} free multiplayer sessions for today.`
            : `You've completed ${SOLO_DAILY_LIMIT} solo games today!`}
          rewardText={adLimitType === 'multiplayer' ? "1 Multiplayer Session" : "1 Solo Game"}
          onClose={() => setIsAdModalOpen(false)}
          onRewardEarned={() => {
            awardBonusPlay(adLimitType);
            setIsAdModalOpen(false);
          }}
        />
      )}
    </AuthContext.Provider>
  );
};
