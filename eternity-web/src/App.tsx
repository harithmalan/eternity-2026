import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import FeedPage from './pages/FeedPage';
import MyOrdersPage from './pages/MyOrdersPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SectionPlaceholder from './pages/SectionPlaceholder';
import { ToastProvider } from './components/Toast';
import { FeaturesProvider } from './lib/features';
import { AuthProvider } from './lib/auth';
import { LikesProvider } from './lib/likes';
import LockedRoute from './components/LockedRoute';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import SignInPanel from './components/SignInPanel';
import Greeting from './components/Greeting';
import MerchPopup from './components/MerchPopup';

function Routed() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/feed" element={<FeedPage />} />
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
          <LikesProvider>
            <Routed />
            <SignInPanel />
            <Greeting />
            <MerchPopup />
          </LikesProvider>
        </AuthProvider>
      </FeaturesProvider>
    </ToastProvider>
  );
}
