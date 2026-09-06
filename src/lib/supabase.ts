/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Game progress will not sync to cloud.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Types for our database
export interface UserProfile {
  id: string;
  name: string;
  avatar_id: string;
  created_at?: string;
}

export interface UserProgress {
  user_id: string;
  heart_points: number;
  answered_questions: string[];
  last_played_at?: string;
}

export interface CoupleProgress {
  id: string; // unique couple ID
  user1_id: string; // the sender/host
  user2_id: string; // the partner
  couple_points: number;
  relationship_type: string;
  created_at?: string;
}
