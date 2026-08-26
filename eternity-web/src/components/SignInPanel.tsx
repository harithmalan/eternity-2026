import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useMagnetic } from '../hooks/usePointerFx';
import { useFocusTrap } from '../hooks/useFocusTrap';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export default function SignInPanel() {
  const { signInPanelOpen, closeSignIn, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const panelRef = useFocusTrap<HTMLDivElement>(signInPanelOpen);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitBtn = useMagnetic<HTMLButtonElement>();

  useEffect(() => {
    if (!signInPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSignIn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signInPanelOpen, closeSignIn]);

  // Reset transient state each time the panel opens fresh.
  useEffect(() => {
    if (signInPanelOpen) {
      setMode('sign-in');
      setPassword('');
      setError(null);
      setNotice(null);
      setBusy(false);
    }
  }, [signInPanelOpen]);

  const runProvider = async (fn: () => Promise<{ error: string | null }>) => {
    setError(null);
    setBusy(true);
    const { error } = await fn();
    if (error) {
      setError(error);
      setBusy(false);
    }
    // On success the page redirects away for OAuth, so no need to clear busy.
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      setBusy(false);
      if (error) setError(error);
      else setNotice('Check your email for a reset link.');
      return;
    }

    if (mode === 'sign-up') {
      const { error, needsConfirmation } = await signUpWithEmail(email, password);
      setBusy(false);
      if (error) {
        setError(error);
      } else if (needsConfirmation) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('sign-in');
      }
      return;
    }

    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) setError(error);
  };

  if (!signInPanelOpen) return null;

  return (
    <div ref={panelRef} tabIndex={-1} className={`auth-panel${signInPanelOpen ? ' show' : ''}`} role="dialog" aria-modal="true" aria-label="Sign in">
      <button className="auth-close" onClick={closeSignIn}>Close</button>
      <div className="auth-card">
        <img className="crest-mark" src="/img/eternity-logo.png" alt="Eternity" />
        <p className="lede">
          {mode === 'forgot' ? 'Reset your password.' : 'Sign in to reserve your merch.'}
        </p>

        {mode !== 'forgot' && (
          <>
            <div className="auth-providers">
              <button className="btn-provider" disabled={busy} onClick={() => runProvider(signInWithGoogle)}>
                Continue with Google
              </button>
              <button className="btn-provider" disabled={busy} onClick={() => runProvider(signInWithFacebook)}>
                Continue with Facebook
              </button>
            </div>
            <div className="auth-divider"><span>or</span></div>
          </>
        )}

        <form className="auth-fields" onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== 'forgot' && (
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'sign-in' && (
                <button type="button" className="auth-forgot" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }}>
                  Forgot password?
                </button>
              )}
            </div>
          )}
          <button ref={submitBtn} type="submit" className="btn btn-gold magnetic" disabled={busy} style={{ marginTop: 4 }}>
            {mode === 'forgot' ? 'Send reset link' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <p className="auth-toggle">
          {mode === 'forgot' ? (
            <button onClick={() => { setMode('sign-in'); setError(null); setNotice(null); }}>Back to sign in</button>
          ) : mode === 'sign-up' ? (
            <>Already have an account? <button onClick={() => { setMode('sign-in'); setError(null); setNotice(null); }}>Sign in</button></>
          ) : (
            <>New here? <button onClick={() => { setMode('sign-up'); setError(null); setNotice(null); }}>Create an account</button></>
          )}
        </p>
      </div>
    </div>
  );
}
