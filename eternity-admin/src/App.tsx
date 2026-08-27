import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import SignInScreen from './components/SignInScreen';
import AccessDenied from './components/AccessDenied';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Export from './pages/Export';
import Reveals from './pages/Reveals';
import Artists from './pages/Artists';
import Features from './pages/Features';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Emails from './pages/Emails';
import Members from './pages/Members';

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { user, loading, accessDenied } = useAuth();

  // Order matters: accessDenied is checked first and unconditionally —
  // once set, nothing else in this component renders, regardless of what
  // `loading`/`user` happen to be mid-sign-out.
  if (accessDenied) return <AccessDenied />;
  if (loading) return null;
  if (!user) return <SignInScreen />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
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
