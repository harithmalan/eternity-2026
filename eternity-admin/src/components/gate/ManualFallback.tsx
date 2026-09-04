import { useState, type FormEvent } from 'react';
import GateAvatar from './GateAvatar';
import { searchByNameOrPhone, type CachedPass } from '../../lib/gateDb';
import { resolveCode, resolvePass, type GateResult } from '../../lib/gateResolve';

interface Props {
  admittedByName: string;
  onResult: (result: GateResult) => void;
  onClose: () => void;
}

/** Phones die and screens crack — this has to fully replace the camera, not just supplement it, and work with zero network same as scanning does. */
export default function ManualFallback({ admittedByName, onResult, onClose }: Props) {
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CachedPass[]>([]);
  const [busy, setBusy] = useState(false);

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const result = await resolveCode(code, admittedByName);
    setBusy(false);
    setCode('');
    onResult(result);
  };

  const onQueryChange = async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    setMatches(await searchByNameOrPhone(value));
  };

  const admitMatch = async (m: CachedPass) => {
    if (busy) return;
    setBusy(true);
    const result = await resolvePass(m.pass_id, admittedByName);
    setBusy(false);
    onResult(result);
    if (result.state === 'admitted') {
      setMatches((prev) => prev.map((p) => (p.pass_id === m.pass_id ? result.pass : p)));
    }
  };

  return (
    <div className="gate-manual">
      <div className="gate-manual-head">
        <p className="eyebrow">Manual check-in</p>
        <button type="button" className="gate-manual-close" onClick={onClose}>Close</button>
      </div>

      <form className="gate-manual-code" onSubmit={submitCode}>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ETR-1029-4K7"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn btn-gold" disabled={busy || !code.trim()}>Check</button>
      </form>

      <input
        type="search"
        className="gate-manual-search"
        placeholder="Search by name or phone…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      <div className="gate-manual-results">
        {matches.map((m) => (
          <div key={m.pass_id} className="gate-manual-row">
            <GateAvatar passId={m.pass_id} name={m.full_name} size={44} />
            <div className="gate-manual-row-info">
              <p className="name">{m.full_name}</p>
              <p className="meta">{m.order_code} · {m.center} · {m.phone}</p>
            </div>
            {m.void_reason ? (
              <span className="gate-manual-void-tag">Void</span>
            ) : m.checked_in_at ? (
              <span className="gate-manual-admitted-tag">Admitted</span>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => admitMatch(m)}>
                Admit
              </button>
            )}
          </div>
        ))}
        {query.trim().length >= 2 && matches.length === 0 && <p className="page-note">No matches in the downloaded manifest.</p>}
      </div>
    </div>
  );
}
