import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './database.types';

export function firstNameFrom(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const given = meta.given_name ?? meta.first_name;
  if (typeof given === 'string' && given.trim()) return given.trim();

  const full = meta.full_name ?? meta.name;
  if (typeof full === 'string' && full.trim()) return full.trim().split(/\s+/)[0];

  return null;
}

export function fullNameFrom(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = meta.full_name ?? meta.name;
  if (typeof full === 'string' && full.trim()) return full.trim();

  const given = meta.given_name ?? meta.first_name;
  if (typeof given === 'string' && given.trim()) return given.trim();

  return null;
}

export function avatarUrlFrom(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.avatar_url === 'string' && meta.avatar_url) return meta.avatar_url;
  if (typeof meta.picture === 'string' && meta.picture) return meta.picture;
  return null;
}

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;

  signInPanelOpen: boolean;
  signInLede: string;
  openSignIn: (lede?: string) => void;
  closeSignIn: () => void;

  /** `nextPath` is a path only (e.g. "/feed") — never a full URL, never location.search/hash. */
  signInWithGoogle: (nextPath?: string) => Promise<AuthResult>;
  signInWithFacebook: (nextPath?: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult & { needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<AuthResult>;

  /** undefined = no greeting pending. null = greeting pending with no name ("Hello there"). string = the first name to greet. */
  pendingGreetName: string | null | undefined;
  dismissGreeting: () => void;
}

const DEFAULT_SIGN_IN_LEDE = 'Sign in to reserve your merch.';

// A path only — never a full URL, and never anything containing
// location.search or location.hash. Guards against an open-redirect via a
// crafted "next" and against the exact bug that caused the URL to grow on
// every OAuth round trip: window.location.href includes whatever the
// previous round trip left behind (implicit-flow tokens, in the old code).
function safeNextPath(path?: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

// Every OAuth attempt must redirect to this exact, fixed URL — building it
// from window.location.href (or anything else that can carry a hash/search)
// is what let the URL grow by a full access+refresh token pair on every
// sign-in attempt until Google started rejecting it as too long.
function oauthRedirectTo(nextPath?: string): string {
  const path = safeNextPath(nextPath) ?? safeNextPath(window.location.pathname);
  const base = `${window.location.origin}/auth/callback`;
  return path && path !== '/' ? `${base}?next=${encodeURIComponent(path)}` : base;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInPanelOpen, setSignInPanelOpen] = useState(false);
  const [signInLede, setSignInLede] = useState(DEFAULT_SIGN_IN_LEDE);
  const [pendingGreetName, setPendingGreetName] = useState<string | null | undefined>(undefined);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    // `INITIAL_SESSION` is always the first event this listener receives —
    // guaranteed to fire before any `SIGNED_IN` from an OAuth redirect
    // being processed on this same page load. Gating on it (via this
    // closure-local flag, not a separate `getSession()` call racing the
    // same stream) is what lets a same-page email/password sign-in AND a
    // full-page OAuth-redirect-back sign-in both greet correctly, while a
    // plain page refresh with a persisted session never does.
    let sawInitial = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!alive) return;
      setSession(newSession);

      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'INITIAL_SESSION') {
        sawInitial = true;
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && sawInitial) {
        setSignInPanelOpen(false);
        setPendingGreetName(newSession ? firstNameFrom(newSession.user) : null);
      }
      if (event === 'SIGNED_OUT') {
        setPendingGreetName(undefined);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const openSignIn = useCallback((lede?: string) => {
    setSignInLede(lede ?? DEFAULT_SIGN_IN_LEDE);
    setSignInPanelOpen(true);
  }, []);
  const closeSignIn = useCallback(() => setSignInPanelOpen(false), []);
  const dismissGreeting = useCallback(() => setPendingGreetName(undefined), []);

  const signInWithGoogle = useCallback(async (nextPath?: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: oauthRedirectTo(nextPath) },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithFacebook = useCallback(async (nextPath?: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: oauthRedirectTo(nextPath) },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult & { needsConfirmation: boolean }> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return { error: error.message, needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    },
    []
  );

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>): Promise<AuthResult> => {
      if (!session) return { error: 'Not signed in.' };
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select('*')
        .single();
      if (error) return { error: error.message };
      setProfile(data);
      return { error: null };
    },
    [session]
  );

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInPanelOpen,
    signInLede,
    openSignIn,
    closeSignIn,
    signInWithGoogle,
    signInWithFacebook,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    refreshProfile,
    saveProfile,
    pendingGreetName,
    dismissGreeting,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
