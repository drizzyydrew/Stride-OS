import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { hydrateFromSupabase } from '../lib/syncService';
import { useWorkoutStore } from './workoutStore';
import { useStrengthStore } from './strengthStore';
import { useCustomWorkoutStore } from './customWorkoutStore';
import { useCheckInStore } from './checkInStore';

type AuthStore = {
  session:         Session | null;
  user:            User | null;
  loading:         boolean;
  initialize:      () => Promise<void>;
  signIn:          (email: string, password: string) => Promise<string | null>;
  signUp:          (email: string, password: string) => Promise<string | null>;
  signOut:         () => Promise<void>;
  resetPassword:   (email: string) => Promise<string | null>;
  updatePassword:  (newPassword: string) => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signInWithGoogle:() => Promise<string | null>;
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

  signInWithApple: async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return 'Apple sign in failed — no token returned.';
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      return error?.message ?? null;
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return null;
      return e.message ?? 'Apple sign in failed.';
    }
  },

  signInWithGoogle: async () => {
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) return error?.message ?? 'Google sign in failed.';
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        return sessionError?.message ?? null;
      }
      return null;
    } catch (e: any) {
      return e.message ?? 'Google sign in failed.';
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
    useWorkoutStore.setState({ completedWorkouts: [], history: [] });
    useStrengthStore.setState({ completedSessions: [], history: [] });
    useCustomWorkoutStore.setState({ logs: [], overrides: [] });
    useCheckInStore.setState({ todayCheckIn: null, postWorkoutNotes: [] });
  },
}));
