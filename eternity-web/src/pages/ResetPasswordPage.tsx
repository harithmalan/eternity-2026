import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMagnetic } from '../hooks/usePointerFx';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitBtn = useMagnetic<HTMLButtonElement>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div className="locked-panel">
      <img className="locked-panel-mark" src="/img/eternity-logo.png" alt="Eternity" />
      {done ? (
        <>
          <p className="locked-panel-msg">Password updated.</p>
          <Link className="btn btn-gold" to="/">Back to Eternity</Link>
        </>
      ) : (
        <form className="auth-fields" style={{ width: 'min(340px, 100%)' }} onSubmit={submit}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button ref={submitBtn} type="submit" className="btn btn-gold magnetic" disabled={busy}>
            Set new password
          </button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      )}
    </div>
  );
}
