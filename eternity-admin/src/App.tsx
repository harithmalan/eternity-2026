import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import SignInScreen from './components/SignInScreen';
import AccessDenied from './components/AccessDenied';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import Posts from './pages/Posts';
import Orders from './pages/Orders';
import Export from './pages/Export';
import Reveals from './pages/Reveals';
import Artists from './pages/Artists';
import Features from './pages/Features';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Emails from './pages/Emails';
import Members from './pages/Members';
import Launch from './pages/Launch';

export default function App() {
  // Defensive cleanup: a stale bookmarked/cached implicit-flow link (or one
  // from before this app switched to PKCE) could still land anywhere with
  // #access_token in the hash. Nothing in this app generates that anymore,
  // so if it shows up, strip it rather than let it sit in the address bar.
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, []);

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function Gate() {
  const { user, loading, accessDenied, isSuperadmin } = useAuth();
  const location = useLocation();

  // Order matters: accessDenied is checked first and unconditionally —
  // once set, nothing else in this component renders, regardless of what
  // `loading`/`user` happen to be mid-sign-out.
  if (accessDenied) return <AccessDenied />;
  if (loading) return null;
  if (!user) return <SignInScreen />;

  // /auth/callback is the fixed URL every OAuth round trip lands on — once
  // authenticated, bounce straight to wherever the admin actually meant to
  // be (validated, path-only) rather than leaving it sitting in the address
  // bar or falling through to the catch-all's plain "/" redirect.
  if (location.pathname === '/auth/callback') {
    return <Navigate to={safeNextPath(new URLSearchParams(location.search).get('next'))} replace />;
  }

  // /launch bypasses the normal Shell entirely — full-bleed, no sidebar
  // distraction, nothing else clickable while someone's about to press it
  // on stage. Checked here, before Shell, rather than as a route inside it.
  if (location.pathname === '/launch') {
    return isSuperadmin ? <Launch /> : <Navigate to="/" replace />;
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/export" element={<Export />} />
        <Route path="/reveals" element={<Reveals />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/features" element={<Features />} />
        <Route path="/products" element={<Products />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/members" element={<MembersRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function MembersRoute() {
  const { isSuperadmin } = useAuth();
  if (!isSuperadmin) return <Navigate to="/" replace />;
  return <Members />;
}
