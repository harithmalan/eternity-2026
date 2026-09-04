import { useEffect } from 'react';
import GateAvatar from './GateAvatar';
import type { GateResult } from '../../lib/gateResolve';

const ADMITTED_AUTO_DISMISS_MS = 2500;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });
}

/**
 * A full-screen, one-glance verdict — colour carries the meaning
 * deliberately, but every state also gets a large word and a symbol so it
 * still reads correctly for anyone who can't rely on colour alone. Only
 * ADMITTED ever disappears on its own; every problem state needs a
 * deliberate tap, on the theory that a volunteer should never wave someone
 * through on the strength of an overlay clearing itself.
 */
export default function ResultOverlay({ result, onDismiss }: { result: GateResult; onDismiss: () => void }) {
  useEffect(() => {
    if (result.state !== 'admitted') return;
    if (navigator.vibrate) navigator.vibrate(200);
    const t = setTimeout(onDismiss, ADMITTED_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  const dismissible = result.state !== 'admitted';

  return (
    <div
      className={`gate-result gate-result-${result.state}`}
      role="alert"
      onClick={dismissible ? onDismiss : undefined}
    >
      {result.state === 'admitted' && (
        <>
          <GateAvatar passId={result.pass.pass_id} name={result.pass.full_name} size={140} />
          <p className="gate-result-word">✓ Admitted</p>
          <h2 className="gate-result-name">{result.pass.full_name}</h2>
          <p className="gate-result-meta">{result.pass.order_code} · {result.pass.center}</p>
        </>
      )}

      {result.state === 'already' && (
        <>
          <GateAvatar passId={result.pass.pass_id} name={result.pass.full_name} size={110} />
          <p className="gate-result-word">⚠ Already admitted</p>
          <h2 className="gate-result-name">{result.pass.full_name}</h2>
          <p className="gate-result-meta">
            {result.pass.checked_in_at ? formatTime(result.pass.checked_in_at) : '—'}
            {result.pass.checked_in_by_name ? ` · by ${result.pass.checked_in_by_name}` : ''}
          </p>
          <p className="gate-result-tap">Tap to dismiss</p>
        </>
      )}

      {result.state === 'void' && (
        <>
          <p className="gate-result-word">✕ Void pass</p>
          <p className="gate-result-name">{result.pass.full_name}</p>
          <p className="gate-result-meta">{result.pass.void_reason}</p>
          <p className="gate-result-tap">Tap to dismiss</p>
        </>
      )}

      {result.state === 'invalid' && (
        <>
          <p className="gate-result-word">✕ Not a valid pass</p>
          <p className="gate-result-meta">This code isn&apos;t in the downloaded manifest.</p>
          <p className="gate-result-tap">Tap to dismiss</p>
        </>
      )}
    </div>
  );
}
