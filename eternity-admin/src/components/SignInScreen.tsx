import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithFacebook, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runProvider = async (fn: () => Promise<{ error: string | null }>) => {
    setError(null);
    setBusy(true);
    const { error } = await fn();
    if (error) {
      setError(error);
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) setError(error);
  };

  return (
    <div className="gate-screen">
      <div className="gate-card">
        <img src="/img/eternity-logo.png" alt="Eternity" />
        <p className="eyebrow" style={{ marginBottom: 6 }}>Committee</p>
        <p className="page-title" style={{ fontSize: 22, marginBottom: 22 }}>Sign in to continue</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-ghost" style={{ justifyContent: 'center' }} disabled={busy} onClick={() => runProvider(signInWithGoogle)}>
            Continue with Google
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'center' }} disabled={busy} onClick={() => runProvider(signInWithFacebook)}>
            Continue with Facebook
          </button>
        </div>

        <div className="gate-divider"><span>or</span></div>

        <form className="gate-fields" onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-gold" style={{ justifyContent: 'center' }} disabled={busy}>Sign in</button>
        </form>

        {error && <p className="gate-error">{error}</p>}
      </div>
    </div>
  );
}
