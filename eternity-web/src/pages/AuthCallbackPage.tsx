import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

// Path only — never a full URL, never location.search/hash. Guards against
// an open-redirect via a crafted "next" query param.
function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

/**
 * The single, fixed URL every OAuth round trip redirects back to. Supabase
 * exchanges the `?code=` for a session automatically as part of the client's
 * own init (detectSessionInUrl) — this page just waits for that to settle
 * via the same INITIAL_SESSION gating AuthProvider already uses, then moves
 * on to wherever the visitor actually meant to be, replacing history so
 * `/auth/callback` (and any leftover query/hash) never sits in the back
 * button or the address bar.
 */
export default function AuthCallbackPage() {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const next = useMemo(() => safeNextPath(new URLSearchParams(window.location.search).get('next')), []);

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    navigate(next, { replace: true });
  }, [loading, next, navigate]);

  return (
    <div className="locked-panel">
      <img className="locked-panel-mark" src="/img/eternity-logo.png" alt="Eternity" />
      <p className="locked-panel-msg">Signing you in…</p>
    </div>
  );
}
