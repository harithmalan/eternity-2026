import { lazy, Suspense } from 'react';
import AuthForm from './AuthForm';

const Cosmos = lazy(() => import('../three/Cosmos'));

/**
 * Replaces every route when `GATE_ENTIRE_SITE` is on and no session exists —
 * the entire site behind a single threshold. Nothing else renders: no nav,
 * no footer, no way past it except signing in.
 */
export default function Gateway() {
  return (
    <div className="gate">
      <Suspense fallback={null}>
        <Cosmos />
      </Suspense>
      <div className="auth-card">
        <img className="crest-mark" src="/img/eternity-logo.png" alt="Eternity" />
        <AuthForm lede="Sign in to enter." redirectTo={`${window.location.origin}/`} />
      </div>
    </div>
  );
}
