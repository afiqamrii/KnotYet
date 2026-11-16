import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, UserProfile, UserProgress, CoupleProgress } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createLegacyMigrationRunner, updateDailyPlayCount } from '../utils/progressPersistence';

const clearAccountCache = () => {
  [
    'knotyet_guest_active',
    'knotyet_guest_id',
    'jodohdeck_profile',
    'jodohdeck_partner',
    'jodohdeck_answered',
    'knotyet_seen_questions',
  ].forEach(key => {
    try { localStorage.removeItem(key); } catch { /* Optional cache cleanup must never block an account change. */ }
  });
};
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  progress: UserProgress | null;
  couple: CoupleProgress | null;
  isLoading: boolean;
  signInWithGoogle: (returnPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProgress: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  refreshCouple: () => Promise<void>;
  incrementPlayCount: (type: 'solo' | 'multiplayer') => Promise<void>;
  checkLimit: (type: 'solo' | 'multiplayer') => boolean;
  progressError: string | null;
  clearProgressError: () => void;
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
  refreshProfile: async () => false,
  refreshCouple: async () => {},
  incrementPlayCount: async () => {},
  checkLimit: () => true,
  progressError: null,
  clearProgressError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [couple, setCouple] = useState<CoupleProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionResolved, setSessionResolved] = useState(false);
  const accountRef = useRef<string | null>(null);
  const accountVersion = useRef(0);
  const accountAbort = useRef(new AbortController());
  const progressReadVersion = useRef(0);
  const profileReadVersion = useRef(0);
  const coupleReadVersion = useRef(0);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [runLegacyMigration] = useState(createLegacyMigrationRunner);
  
  // Keep game callers working while play remains unrestricted during review.
  const checkLimit: AuthContextType['checkLimit'] = () => true;

  const refreshProfile = async () => {
    if (!user || accountRef.current !== user.id) return false;
    const version = accountVersion.current;
    const request = ++profileReadVersion.current;
    const signal = accountAbort.current.signal;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).abortSignal(signal).single();
      if (accountRef.current !== user.id || accountVersion.current !== version || request !== profileReadVersion.current || signal.aborted) return false;
      if (error || !data) return false;
      setProfile(data);
      return true;
    } catch { return false; }
  };

  const refreshProgress = async () => {
    if (!user || accountRef.current !== user.id) return;
    const version = accountVersion.current;
    const request = ++progressReadVersion.current;
    const signal = accountAbort.current.signal;
    const isCurrent = () => accountRef.current === user.id && accountVersion.current === version && request === progressReadVersion.current;
    let importError: string | null = null;
    try {
      await runLegacyMigration(supabase, localStorage, user.id, signal);
    } catch {
      importError = 'Your earlier progress could not be imported yet. It is still saved on this device. Refresh to try again.';
    }
    if (!isCurrent()) return;
    try {
      const data = await updateDailyPlayCount(supabase, user.id, signal);
      if (isCurrent()) {
        setProgress(data as unknown as UserProgress);
        setProgressError(importError);
      }
    } catch {
      if (isCurrent()) setProgressError('We could not refresh your progress. Check your connection and try again.');
    }
  };

  const refreshCouple = async () => {
    if (!user || accountRef.current !== user.id) return;
    const version = accountVersion.current;
    const request = ++coupleReadVersion.current;
    const { data, error } = await supabase
      .from('couples')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .abortSignal(accountAbort.current.signal).maybeSingle();
      
    if (accountRef.current !== user.id || accountVersion.current !== version || request !== coupleReadVersion.current) return;
    if (!error) {
      setCouple(data);
    }
  };

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    if (accountAbort.current.signal.aborted) accountAbort.current = new AbortController();
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const nextId = nextSession?.user.id ?? null;
      if (accountRef.current !== nextId) {
        if (accountRef.current) clearAccountCache();
        accountAbort.current.abort();
        accountAbort.current = new AbortController();
        accountVersion.current += 1;
        accountRef.current = nextId;
        setProfile(null);
        setProgress(null);
        setCouple(null);
        setIsLoading(Boolean(nextId));
        setProgressError(null);
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionResolved(true);
      if (nextSession) {
        void supabase.realtime.setAuth(nextSession.access_token).catch(() => {});
      } else {
        try {
          localStorage.removeItem('knotyet_guest_active');
          localStorage.removeItem('knotyet_guest_id');
        } catch { /* Authentication still settles when browser storage is blocked. */ }
        setIsLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      // An auth event is newer than the bootstrap snapshot (e.g. sign-out).
      if (!authEventReceived) applySession(session);
    }).catch(() => {
      if (!authEventReceived) applySession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventReceived = true;
      if (event === 'SIGNED_OUT') clearAccountCache();
      applySession(session);
    });

    return () => { active = false; accountAbort.current.abort(); accountVersion.current += 1; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchUserData() {
      if (!user) {
        setProfile(null);
        setProgress(null);
        setCouple(null);
        if (sessionResolved) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      // Fetch Profile
      const profileRequest = ++profileReadVersion.current;
      let { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (ignore || accountRef.current !== user.id) return;
      if (profileRequest === profileReadVersion.current) setProfile(prof);

      // Refresh also retries an unfinished, account-owned legacy import.
      if (ignore || accountRef.current !== user.id) return;
      await Promise.all([refreshProgress(), refreshCouple()]);
      
      if (!ignore) setIsLoading(false);
    }

    void fetchUserData().catch(error => {
      console.error('Could not load account data:', error);
    }).finally(() => {
      if (!ignore && sessionResolved) setIsLoading(false);
    });
    return () => { ignore = true; };
  }, [user, sessionResolved]);

  const signInWithGoogle = async (returnPath?: string) => {
    const safePath = returnPath === '/invite' ? '/invite' : '/';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${safePath}`,
        queryParams: { prompt: 'select_account' },
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearAccountCache();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProgress(null);
    setCouple(null);
  };
  
  const incrementPlayCount = async (type: 'solo' | 'multiplayer') => {
    if (!user || accountRef.current !== user.id) return;
    const version = accountVersion.current;
    try {
      await updateDailyPlayCount(supabase, user.id, accountAbort.current.signal, type);
      if (accountRef.current === user.id && accountVersion.current === version) await refreshProgress();
    } catch {
      if (accountRef.current === user.id && accountVersion.current === version) setProgressError('We could not confirm your play count. Refresh your progress before playing again.');
    }
  };

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void Promise.all([refreshProgress(), refreshCouple()]);
    };
    const channel = supabase.channel(`progress-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_progress', filter: `user_id=eq.${user.id}` }, () => { void refreshProgress(); });
    if (couple?.id) channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${couple.id}` }, () => { void refreshCouple(); });
    channel.subscribe();
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [user?.id, couple?.id]);

  return (
    <AuthContext.Provider value={{ session, user, profile, progress, couple, isLoading, signInWithGoogle, signOut, refreshProgress, refreshProfile, refreshCouple, incrementPlayCount, checkLimit, progressError, clearProgressError: () => setProgressError(null) }}>
      {children}
    </AuthContext.Provider>
  );
};

