import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Lang } from '../data/i18n';
import { i18n } from '../data/i18n';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

// ============================================================
// TYPES
// ============================================================

export type RelationshipType = 'bestfriend' | 'crush' | 'lover' | 'spouse';

export interface UserProfile {
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

export interface GameState {
  // User profile
  profile: UserProfile | null;
  partner: Partner | null;
  // Language
  lang: Lang;
  // Computed
  t: Record<string, any>;
  // Actions
  setProfile: (profile: UserProfile) => void;
  setPartner: (partner: Partner | null) => void;
  setLang: (lang: Lang) => void;
  addHeartPoints: (amount: number) => void;
  deductHeartPoints: (amount: number) => void;
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
  const { user, profile: authProfile, progress, refreshProgress } = useAuth();
  
  const [profile, setProfileState] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  React.useEffect(() => {
    if (user && progress && authProfile) {
       setProfileState({
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
    return (localStorage.getItem(STORAGE_KEY_LANG) as Lang) || 'en';
  });

  const t = i18n[lang];

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(p));
    
    if (user) {
       supabase.from('profiles').upsert({
         id: user.id,
         name: p.name,
         avatar_id: p.avatarId
       }).then();
    }
  }, [user]);

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

  const addHeartPoints = useCallback((amount: number) => {
    setProfileState(prev => {
      if (!prev) return prev;
      const updated = { ...prev, heartPoints: prev.heartPoints + amount };
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
      return updated;
    });

    if (user && progress) {
      supabase.from('user_progress').update({ heart_points: progress.heart_points + amount }).eq('user_id', user.id).then(() => refreshProgress());
    }
  }, [user, progress, refreshProgress]);

  const deductHeartPoints = useCallback((amount: number) => {
    setProfileState(prev => {
      if (!prev) return prev;
      const newPoints = Math.max(0, prev.heartPoints - Math.abs(amount));
      const updated = { ...prev, heartPoints: newPoints };
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
      return updated;
    });

    if (user && progress) {
      const newPoints = Math.max(0, progress.heart_points - Math.abs(amount));
      supabase.from('user_progress').update({ heart_points: newPoints }).eq('user_id', user.id).then(() => refreshProgress());
    }
  }, [user, progress, refreshProgress]);

  const recordAnsweredQuestion = useCallback((questionId: string) => {
    if (user && progress) {
      const answered = new Set(progress.answered_questions);
      if (!answered.has(questionId)) {
        answered.add(questionId);
        supabase.from('user_progress').update({ answered_questions: Array.from(answered) }).eq('user_id', user.id).then(() => refreshProgress());
      }
    } else {
      // Offline fallback: save to localStorage
      const stored = localStorage.getItem('jodohdeck_answered') || '[]';
      try {
        const arr = JSON.parse(stored);
        if (!arr.includes(questionId)) {
          arr.push(questionId);
          localStorage.setItem('jodohdeck_answered', JSON.stringify(arr));
        }
      } catch {
        localStorage.setItem('jodohdeck_answered', JSON.stringify([questionId]));
      }
    }
  }, [user, progress, refreshProgress]);

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
