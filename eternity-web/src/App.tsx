import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import MyOrdersPage from './pages/MyOrdersPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SectionPlaceholder from './pages/SectionPlaceholder';
import { ToastProvider } from './components/Toast';
import { FeaturesProvider } from './lib/features';
import { AuthProvider, useAuth } from './lib/auth';
import LockedRoute from './components/LockedRoute';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import SignInPanel from './components/SignInPanel';
import Greeting from './components/Greeting';
import Gateway from './components/Gateway';
import { GATE_ENTIRE_SITE } from './config';

function Gated() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wasGated = useRef(false);

  useEffect(() => {
    if (!GATE_ENTIRE_SITE || loading) return;
    if (!user) {
      wasGated.current = true;
      return;
    }
    if (wasGated.current) {
      wasGated.current = false;
      if (location.pathname !== '/') navigate('/', { replace: true });
    }
    // Only re-run when the session or loading state actually changes — a
    // pathname change alone (e.g. after the redirect below fires) must not
    // re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate]);

  if (GATE_ENTIRE_SITE && loading) return null;
  if (GATE_ENTIRE_SITE && !user) return <Gateway />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/my-orders"
        element={
          <RequireAuth>
            <Layout>
              <MyOrdersPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/lineup"
        element={
          <LockedRoute feature="lineup">
            <SectionPlaceholder title="The line-up" />
          </LockedRoute>
        }
      />
      <Route
        path="/gallery"
        element={
          <LockedRoute feature="gallery">
            <SectionPlaceholder title="The gallery" />
          </LockedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <LockedRoute feature="schedule">
            <SectionPlaceholder title="The schedule" />
          </LockedRoute>
        }
      />
      <Route
        path="/afterparty"
        element={
          <LockedRoute feature="afterparty">
            <SectionPlaceholder title="The after party" />
          </LockedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <FeaturesProvider>
        <AuthProvider>
          <Gated />
          <SignInPanel />
          <Greeting />
        </AuthProvider>
      </FeaturesProvider>
    </ToastProvider>
  );
}
