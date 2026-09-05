import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile, UserProgress } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  progress: UserProgress | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProgress: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  progress: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProgress: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProgress = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data && !error) {
      setProgress(data);
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
      
      if (!ignore) setIsLoading(false);
    }

    fetchUserData();
    return () => { ignore = true; };
  }, [user]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, progress, isLoading, signInWithGoogle, signOut, refreshProgress }}>
      {children}
    </AuthContext.Provider>
  );
};
