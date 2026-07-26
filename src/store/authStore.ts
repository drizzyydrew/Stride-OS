import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { getSupabaseAvailability, supabaseUnavailableMessage } from '../lib/supabase';
import {
  authRedirectUrl,
  completeSupabaseAuthFromUrl,
  hydrateUserData,
} from '../lib/authRedirect';
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
  resendConfirmation: (email: string) => Promise<string | null>;
  updatePassword:  (newPassword: string) => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signInWithGoogle:() => Promise<string | null>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user:    null,
  loading: true,

  initialize: async () => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') {
      set({ session: null, user: null, loading: false });
      return;
    }

    const { client: supabase } = supabaseState;
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, loading: false });

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null });
      if (event === 'SIGNED_IN') {
        hydrateUserData().catch(console.warn);
      }
    });
  },

  signIn: async (email, password) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Sign in');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error) {
      hydrateUserData().catch(console.warn);
    }
    return error?.message ?? null;
  },

  signUp: async (email, password) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Account creation');
    const { client: supabase } = supabaseState;

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    });
    if (error) return error.message;
    // If session is immediately set, email confirmation is disabled — auto-login happened
    if (data.session) set({ session: data.session, user: data.session.user });
    return null;
  },

  resetPassword: async (email) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Password reset');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: authRedirectUrl(),
    });
    return error?.message ?? null;
  },

  resendConfirmation: async (email) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Email confirmation');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    });
    return error?.message ?? null;
  },

  updatePassword: async (newPassword) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Password update');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error?.message ?? null;
  },

  signInWithApple: async () => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Apple sign in');
    const { client: supabase } = supabaseState;

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
      if (!error) hydrateUserData().catch(console.warn);
      return error?.message ?? null;
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return null;
      return e.message ?? 'Apple sign in failed.';
    }
  },

  signInWithGoogle: async () => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Google sign in');
    const { client: supabase } = supabaseState;

    try {
      const redirectTo = authRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error || !data.url) return error?.message ?? 'Google sign in failed.';
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const completion = await completeSupabaseAuthFromUrl(result.url);
        return completion.error;
      }
      return null;
    } catch (e: any) {
      return e.message ?? 'Google sign in failed.';
    }
  },

  signOut: async () => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status === 'available') {
      await supabaseState.client.auth.signOut();
    }
    set({ session: null, user: null });
    useWorkoutStore.setState({ completedWorkouts: [], history: [] });
    useStrengthStore.setState({ completedSessions: [], history: [] });
    useCustomWorkoutStore.setState({ logs: [], overrides: [] });
    useCheckInStore.setState({ todayCheckIn: null, postWorkoutNotes: [] });
  },
}));
