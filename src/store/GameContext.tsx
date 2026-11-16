import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Lang } from '../data/i18n';
import { i18n } from '../data/i18n';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { changeHeartPoints, validCount, pendingQuestionKey, readPendingQuestions } from '../utils/progressPersistence';
import { writeJson } from '../utils/storage';

// ============================================================
// TYPES
// ============================================================

export type RelationshipType = 'bestfriend' | 'crush' | 'lover' | 'spouse';

export interface UserProfile {
  accountId?: string;
  name: string;
  avatarId: string; // e.g. 'sunny', 'mochi', etc.
  heartPoints: number;
}

export interface Partner {
  name: string;
  avatarId: string;
  relationshipType: RelationshipType;
  code: string;
}

export interface ProfileSaveResult { ok: boolean; error?: string }

export interface GameState {
  // User profile
  profile: UserProfile | null;
  partner: Partner | null;
  // Language
  lang: Lang;
  // Computed
  t: (typeof i18n)[Lang];
  // Actions
  setProfile: (profile: UserProfile) => Promise<ProfileSaveResult>;
  setPartner: (p: Partner | null) => void;
  setLang: (l: Lang) => void;
  addHeartPoints: (amount: number, isMultiplayer?: boolean, sharedAwardAuthority?: boolean, remoteAccountId?: string) => void;
  deductHeartPoints: (amount: number, isMultiplayer?: boolean, sharedAwardAuthority?: boolean, remoteAccountId?: string) => void;
  progressSaveError: string | null;
  isSavingProgress: boolean;
  clearProgressSaveError: () => void;
  recordAnsweredQuestion: (questionId: string) => void;
}

// ============================================================
// CONSTANTS
// ============================================================

export const HEART_POINTS = {
  CORRECT_GUESS: 15,
  WRONG_GUESS: -5,
  COMPLETE_DECK: 10,
  COMPLETE_WHEEL: 5,
  COMPLETE_QUIZ: 10,
  PERFECT_QUIZ: 30,
} as const;

// ============================================================
// CONTEXT
// ============================================================

const GameContext = createContext<GameState | null>(null);

const STORAGE_KEY_PROFILE = 'jodohdeck_profile';
const STORAGE_KEY_PARTNER = 'jodohdeck_partner';
const STORAGE_KEY_LANG = 'jodohdeck_lang';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile: authProfile, progress, couple, refreshProgress, refreshProfile, refreshCouple } = useAuth();
  const answeredQuestionIds = React.useRef<Set<string>>(new Set());
  const answeredQuestionUserId = React.useRef<string | null>(null);
  const queuedQuestionIds = React.useRef(new Set<string>());
  const questionHistorySaveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const pointsSaveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const pendingPointsSaves = React.useRef(0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressSaveError, setProgressSaveError] = useState<string | null>(null);
  const historyAccount = React.useRef({ userId: user?.id ?? null, controller: new AbortController() });

  const syncHistoryAccount = useCallback((userId: string | null) => {
    const current = historyAccount.current;
    if (current.userId === userId && !current.controller.signal.aborted) return;
    current.controller.abort();
    historyAccount.current = { userId, controller: new AbortController() };
    questionHistorySaveQueue.current = Promise.resolve();
    queuedQuestionIds.current = new Set();
    pointsSaveQueue.current = Promise.resolve();
    pendingPointsSaves.current = 0;
    setIsSavingProgress(false);
    setProgressSaveError(null);
    setProfileState(null);
    setPartnerState(null);
    answeredQuestionIds.current = new Set();
    answeredQuestionUserId.current = userId;
  }, []);

  React.useLayoutEffect(() => {
    syncHistoryAccount(user?.id ?? null);
  }, [user?.id, syncHistoryAccount]);

  React.useEffect(() => {
    // Invalidate at the auth event itself, before React renders the next user.
    // Aborting also prevents a waiting request from acquiring the next token.
    syncHistoryAccount(user?.id ?? null);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncHistoryAccount(session?.user.id ?? null);
    });
    return () => {
      historyAccount.current.controller.abort();
      subscription.unsubscribe();
    };
  }, [syncHistoryAccount]);

  React.useEffect(() => {
    if (!user) {
      answeredQuestionIds.current = new Set();
      answeredQuestionUserId.current = null;
      return;
    }
    if (answeredQuestionUserId.current !== user.id) {
      answeredQuestionIds.current = new Set();
      answeredQuestionUserId.current = user.id;
    }
    answeredQuestionIds.current = new Set([
      ...answeredQuestionIds.current,
      ...(progress?.user_id === user.id ? progress.answered_questions : []),
    ]);
  }, [progress?.answered_questions, user?.id]);
  
  const [profile, setProfileState] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  React.useEffect(() => {
    if (user && progress?.user_id === user.id && authProfile?.id === user.id) {
       setProfileState({
         accountId: user.id,
         name: authProfile.name,
         avatarId: authProfile.avatar_id,
         heartPoints: progress.heart_points
       });
    }
  }, [user, progress, authProfile]);

  const [partner, setPartnerState] = useState<Partner | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PARTNER);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [lang, setLangState] = useState<Lang>(() => {
    return localStorage.getItem(STORAGE_KEY_LANG) === 'my' ? 'my' : 'en';
  });

  const t = i18n[lang];

  const setProfile = useCallback(async (p: UserProfile): Promise<ProfileSaveResult> => {
    const name = p.name.trim();
    if (!name || name.length > 20) return { ok: false, error: 'Choose a name between 1 and 20 characters.' };
    const account = historyAccount.current;
    const isCurrent = () => historyAccount.current === account && account.userId === (user?.id ?? null) && !account.controller.signal.aborted;
    if (!isCurrent()) return { ok: false, error: 'Your account changed. Please reopen your profile.' };
    if (user) {
      try {
        const { data, error } = await supabase.from('profiles').upsert({ id: user.id, name, avatar_id: p.avatarId })
          .select('id,name,avatar_id').abortSignal(account.controller.signal).single();
        if (!isCurrent()) return { ok: false, error: 'Your account changed. Please reopen your profile.' };
        if (error || !data) return { ok: false, error: 'Your profile could not be saved. Your changes are still here; please try again.' };
        // Refresh the canonical auth profile too: later heart/progress updates
        // must not restore its previous name and avatar over this saved edit.
        if (!await refreshProfile()) return { ok: false, error: 'Your profile was saved, but could not be refreshed. Please try again.' };
        if (!isCurrent()) return { ok: false, error: 'Your account changed. Please reopen your profile.' };
      } catch {
        return { ok: false, error: isCurrent() ? 'Your profile could not be confirmed. Check your connection and try again.' : 'Your account changed. Please reopen your profile.' };
      }
    }
    setProfileState(previous => {
      if (!isCurrent()) return previous;
      const ownProfile = { ...p, name, accountId: user?.id, heartPoints: previous?.heartPoints ?? p.heartPoints };
      try { localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(ownProfile)); } catch { /* Confirmed cloud saves do not depend on a browser cache. */ }
      return ownProfile;
    });
    return { ok: true };
  }, [user, refreshProfile]);

  const setPartner = useCallback((p: Partner | null) => {
    setPartnerState(p);
    if (p) {
      localStorage.setItem(STORAGE_KEY_PARTNER, JSON.stringify(p));
    } else {
      localStorage.removeItem(STORAGE_KEY_PARTNER);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY_LANG, l);
  }, []);

  const applyHeartPoints = useCallback((delta: number, isMultiplayer = false, sharedAwardAuthority = true, remoteAccountId?: string) => {
    if (!Number.isSafeInteger(delta) || delta === 0) return;
    const sharedCouple = isMultiplayer && couple && user && remoteAccountId &&
      ((couple.user1_id === user.id && couple.user2_id === remoteAccountId) ||
       (couple.user2_id === user.id && couple.user1_id === remoteAccountId)) ? couple : null;
    // Both clients reveal the same result, but only the host changes their
    // shared total. Unpaired friends still each earn their personal hearts.
    if (sharedCouple && !sharedAwardAuthority) return;
    if (!user) {
      setProfileState(previous => {
        if (!previous) return previous;
        const updated = { ...previous, heartPoints: Math.max(0, validCount(previous.heartPoints) + delta) };
        writeJson(localStorage, STORAGE_KEY_PROFILE, updated);
        return updated;
      });
      return;
    }
    const account = historyAccount.current;
    const isCurrent = () => historyAccount.current === account && account.userId === user.id && !account.controller.signal.aborted;
    if (!isCurrent()) return;
    pendingPointsSaves.current += 1;
    setIsSavingProgress(true);
    pointsSaveQueue.current = pointsSaveQueue.current.then(async () => {
      if (!isCurrent()) return;
      const total = await changeHeartPoints(supabase, user.id, delta, account.controller.signal, sharedCouple?.id);
      if (!isCurrent()) return;
      if (sharedCouple) await refreshCouple();
      else {
        setProfileState(previous => {
          if (!previous) return previous;
          const updated = { ...previous, heartPoints: total };
          writeJson(localStorage, STORAGE_KEY_PROFILE, updated);
          return updated;
        });
        await refreshProgress();
      }
    }).catch(() => {
      if (isCurrent()) setProgressSaveError('We could not confirm your hearts were saved. Refresh your progress before playing again.');
    }).finally(() => {
      if (!isCurrent()) return;
      pendingPointsSaves.current = Math.max(0, pendingPointsSaves.current - 1);
      setIsSavingProgress(pendingPointsSaves.current > 0);
    });
  }, [user, couple, refreshProgress, refreshCouple]);

  const addHeartPoints = useCallback((amount: number, isMultiplayer?: boolean, sharedAwardAuthority?: boolean, remoteAccountId?: string) => {
    if (amount > 0) applyHeartPoints(amount, isMultiplayer, sharedAwardAuthority, remoteAccountId);
  }, [applyHeartPoints]);

  const deductHeartPoints = useCallback((amount: number, isMultiplayer?: boolean, sharedAwardAuthority?: boolean, remoteAccountId?: string) => {
    applyHeartPoints(-Math.abs(amount), isMultiplayer, sharedAwardAuthority, remoteAccountId);
  }, [applyHeartPoints]);

  const recordAnsweredQuestion = useCallback((questionId: string) => {
    if (user && (!progress || progress.user_id !== user.id)) return;
    if (user && progress) {
      const account = historyAccount.current;
      const isCurrent = () => historyAccount.current === account && account.userId === user.id && !account.controller.signal.aborted;
      if (!isCurrent()) return;
      const key = pendingQuestionKey(user.id, questionId);
      if (progress.answered_questions.includes(questionId)) {
        localStorage.removeItem(key);
        return;
      }
      if (queuedQuestionIds.current.has(questionId)) return;
      if (answeredQuestionIds.current.has(questionId) && !localStorage.getItem(key)) return;
      answeredQuestionIds.current.add(questionId);
      const ids = Array.from(answeredQuestionIds.current);
      writeJson(localStorage, 'jodohdeck_answered', ids);
      writeJson(localStorage, 'knotyet_seen_questions', ids);
      try { localStorage.setItem(key, '1'); } catch {
        setProgressSaveError('This browser cannot keep a retry copy of your progress. Keep this page open while it saves.');
      }
      const queued = queuedQuestionIds.current;
      queued.add(questionId);
      questionHistorySaveQueue.current = questionHistorySaveQueue.current.then(async () => {
        if (!isCurrent()) return;
        const { data, error } = await supabase.rpc('record_seen_question', {
          p_question_id: questionId,
        }).abortSignal(account.controller.signal);
        if (!isCurrent()) return;
        if (error) throw error;
        const savedIds = Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : ids;
        answeredQuestionIds.current = new Set([...answeredQuestionIds.current, ...savedIds]);
        const mergedIds = Array.from(answeredQuestionIds.current);
        writeJson(localStorage, 'jodohdeck_answered', mergedIds);
        writeJson(localStorage, 'knotyet_seen_questions', mergedIds);
        localStorage.removeItem(key);
        await refreshProgress();
      }).catch(() => {
        if (isCurrent()) setProgressSaveError('Some question history is waiting to sync. We will retry when you reconnect or return to this page.');
      }).finally(() => queued.delete(questionId));
    } else {
      const stored = localStorage.getItem('jodohdeck_answered') || '[]';
      let ids: string[] = [];
      try { const parsed: unknown = JSON.parse(stored); if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string'); } catch { /* Start a valid history cache. */ }
      if (!ids.includes(questionId)) ids.push(questionId);
      writeJson(localStorage, 'jodohdeck_answered', ids);
      writeJson(localStorage, 'knotyet_seen_questions', ids);
    }
  }, [user, progress, refreshProgress]);

  React.useEffect(() => {
    if (!user || progress?.user_id !== user.id) return;
    const retry = () => readPendingQuestions(localStorage, user.id).forEach(recordAnsweredQuestion);
    retry();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [user?.id, progress?.user_id, recordAnsweredQuestion]);

  return (
    <GameContext.Provider value={{
      profile,
      partner,
      lang,
      t,
      setProfile,
      setPartner,
      setLang,
      addHeartPoints,
      deductHeartPoints,
      recordAnsweredQuestion,
      progressSaveError,
      isSavingProgress,
      clearProgressSaveError: () => setProgressSaveError(null),
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameState => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
