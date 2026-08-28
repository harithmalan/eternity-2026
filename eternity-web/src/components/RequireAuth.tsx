import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import Skeleton from './Skeleton';

/**
 * Guards a route behind sign-in. The guarded route stays mounted at its own
 * URL throughout — the sign-in panel opens as an overlay on top of it and,
 * once auth succeeds, this component swaps straight to rendering children
 * in place. There's no redirect, so "return to wherever they were headed"
 * is automatic: we never left that URL.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, openSignIn } = useAuth();

  useEffect(() => {
    if (!loading && !user) openSignIn();
  }, [loading, user, openSignIn]);

  if (loading) {
    return (
      <div className="locked-panel" aria-hidden="true">
        <Skeleton width={160} height={160} style={{ borderRadius: '50%' }} />
        <Skeleton width={220} height={14} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="locked-panel">
        <img className="locked-panel-mark" src="/img/eternity-logo.png" alt="Eternity" />
        <p className="locked-panel-msg">Sign in to continue.</p>
        <button className="btn btn-gold" onClick={() => openSignIn()}>Sign in</button>
      </div>
    );
  }

  return <>{children}</>;
}
