import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './database.types';

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  accessDenied: boolean;
  isSuperadmin: boolean;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithFacebook: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

// A path only — never a full URL, and never anything containing
// location.search or location.hash. Building redirectTo from
// window.location.href let the address bar grow by a full access+refresh
// token pair on every sign-in attempt (the previous round trip's tokens,
// still sitting in the hash) until Google started rejecting it as too long.
function safeNextPath(path?: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

function oauthRedirectTo(): string {
  const path = safeNextPath(window.location.pathname);
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
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let alive = true;

    // Every session — a fresh sign-in AND a restored one on page reload —
    // gets the same role check. A revoked committee member's next reload
    // must lock them out too, not just their next login.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;

      if (!newSession) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      supabase
        .from('profiles')
        .select('*')
        .eq('id', newSession.user.id)
        .single()
        .then(({ data: prof }) => {
          if (!alive) return;

          const isCommittee = prof?.role === 'admin' || prof?.role === 'superadmin';
          if (!isCommittee) {
            // Never render the admin shell for this session, not even for
            // one frame — sign out before `session` state ever holds it.
            setAccessDenied(true);
            supabase.auth.signOut();
            return;
          }

          setAccessDenied(false);
          setSession(newSession);
          setProfile(prof);
          setLoading(false);
        });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: oauthRedirectTo() },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithFacebook = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: oauthRedirectTo() },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    accessDenied,
    isSuperadmin: profile?.role === 'superadmin',
    signInWithGoogle,
    signInWithFacebook,
    signInWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
