import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import AuthForm from './AuthForm';

export default function SignInPanel() {
  const { signInPanelOpen, closeSignIn } = useAuth();
  const panelRef = useFocusTrap<HTMLDivElement>(signInPanelOpen);

  useEffect(() => {
    if (!signInPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSignIn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signInPanelOpen, closeSignIn]);

  if (!signInPanelOpen) return null;

  return (
    <div ref={panelRef} tabIndex={-1} className={`auth-panel${signInPanelOpen ? ' show' : ''}`} role="dialog" aria-modal="true" aria-label="Sign in">
      <button className="auth-close" onClick={closeSignIn}>Close</button>
      <div className="auth-card">
        <img className="crest-mark" src="/img/eternity-logo.png" alt="Eternity" />
        <AuthForm lede="Sign in to reserve your merch." />
      </div>
    </div>
  );
}
