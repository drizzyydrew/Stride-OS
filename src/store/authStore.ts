import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hydrateFromSupabase } from '../lib/syncService';
import { useWorkoutStore } from './workoutStore';
import { useStrengthStore } from './strengthStore';
import { useCustomWorkoutStore } from './customWorkoutStore';
import { useCheckInStore } from './checkInStore';

type AuthStore = {
  session:       Session | null;
  user:          User | null;
  loading:       boolean;
  initialize:    () => Promise<void>;
  signIn:        (email: string, password: string) => Promise<string | null>;
  signUp:        (email: string, password: string) => Promise<string | null>;
  signOut:        () => Promise<void>;
  resetPassword:  (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user:    null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, loading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      hydrateFromSupabase().then(result => {
        useWorkoutStore.getState().hydrateWorkouts(result.workoutLogs);
        useStrengthStore.getState().hydrateStrength(result.strengthLogs);
        useCustomWorkoutStore.getState().hydrateLogs(result.customLogs);
        useCheckInStore.getState().hydrateCheckIns(result.checkIns);
      }).catch(console.warn);
    }
    return error?.message ?? null;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'strideos://auth/new-password',
    });
    return error?.message ?? null;
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error?.message ?? null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
    // Clear all local store data so the next user starts clean
    useWorkoutStore.setState({ completedWorkouts: [], history: [] });
    useStrengthStore.setState({ completedSessions: [], history: [] });
    useCustomWorkoutStore.setState({ logs: [], overrides: [] });
    useCheckInStore.setState({ todayCheckIn: null, postWorkoutNotes: [] });
  },
}));
