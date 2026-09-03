import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

const COUNTDOWN_OPTIONS = [3, 5, 10];
const PRESENCE_CHANNEL = 'eternity-launch-presence';

type LaunchState = 'idle' | 'armed' | 'launched';

export default function Launch() {
  const { settings, loading, refetch } = useSettings();
  const { confirm, dialog } = useConfirmDialog();
  const [connected, setConnected] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rehearsal, setRehearsal] = useState(false);
  const [rehearsalArmedAt, setRehearsalArmedAt] = useState<number | null>(null);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL);
    channel.on('presence', { event: 'sync' }, () => {
      setDeviceCount(Object.keys(channel.presenceState()).length);
    });
    channel.subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const state: LaunchState = settings?.launch_state ?? 'idle';
  const countdownSecs = settings?.launch_countdown_secs ?? 5;

  const callRpc = useCallback(
    async (newState: LaunchState) => {
      setBusy(true);
      setActionError(null);
      const { error } = await supabase.rpc('set_launch_state', { new_state: newState });
      setBusy(false);
      if (error) {
        setActionError(error.message);
        return;
      }
      refetch();
    },
    [refetch]
  );

  const setCountdown = async (secs: number) => {
    await supabase.from('settings').update({ launch_countdown_secs: secs }).eq('id', 1);
    refetch();
  };

  const arm = () => {
    if (rehearsal) {
      setRehearsalArmedAt(Date.now());
      return;
    }
    callRpc('armed');
  };

  const launch = () => {
    if (rehearsal) {
      // Skip straight to the launched moment — no need to sit through the
      // full countdown every single time while tuning it.
      setRehearsalArmedAt(Date.now() - countdownSecs * 1000);
      return;
    }
    callRpc('launched');
  };

  const doReset = () => {
    if (rehearsal) {
      setRehearsalArmedAt(null);
      return;
    }
    callRpc('idle');
  };

  const requestReset = () => {
    confirm('Reset launch state back to idle? Do this for rehearsal — never as a way to "undo" the real thing.', doReset, 'Reset');
  };

  if (loading || !settings) return <p className="page-note">Loading…</p>;

  const rehearsalActive = rehearsal && rehearsalArmedAt !== null;
  const canArm = rehearsal ? !rehearsalActive : state === 'idle' && connected;
  const canLaunch = rehearsal ? rehearsalActive : state === 'armed' && connected;
  const displayState: LaunchState = rehearsal ? (rehearsalActive ? 'armed' : 'idle') : state;

  return (
    <div className="launch-page">
      {rehearsalActive && (
        <LaunchRehearsalPreview armedAt={rehearsalArmedAt!} countdownSecs={countdownSecs} onDone={() => setRehearsalArmedAt(null)} />
      )}

      <div className="launch-inner">
        <p className="eyebrow launch-eyebrow">Launch control</p>

        <div className={`launch-pill launch-pill-${displayState}`}>
          {displayState}
          {rehearsal && <span className="launch-pill-tag">rehearsal</span>}
        </div>

        <p className="launch-presence">
          {deviceCount} device{deviceCount === 1 ? '' : 's'} connected
        </p>

        <div className="launch-countdown-select">
          <p className="launch-label">Countdown length</p>
          <div className="launch-countdown-options">
            {COUNTDOWN_OPTIONS.map((secs) => (
              <button key={secs} type="button" aria-pressed={countdownSecs === secs} disabled={state !== 'idle' || busy} onClick={() => setCountdown(secs)}>
                {secs}s
              </button>
            ))}
          </div>
        </div>

        <label className="launch-rehearsal-toggle">
          <input
            type="checkbox"
            checked={rehearsal}
            disabled={state === 'armed' || rehearsalActive}
            onChange={(e) => setRehearsal(e.target.checked)}
          />
          Rehearsal mode — plays locally, never touches the database
        </label>

        <div className="launch-buttons">
          <button type="button" className="btn btn-ghost launch-arm" disabled={!canArm || busy} onClick={arm}>
            {!rehearsal && !connected ? 'Not connected — do not press' : 'Arm'}
          </button>
          <button type="button" className="launch-fire" disabled={!canLaunch || busy} onClick={launch}>
            {!rehearsal && !connected ? 'Not connected — do not press' : 'Launch'}
          </button>
        </div>

        {actionError && <p className="launch-error">{actionError}</p>}

        <button type="button" className="launch-reset" onClick={requestReset} disabled={busy}>
          Reset to idle
        </button>
      </div>

      {dialog}
    </div>
  );
}

/**
 * A committee rehearsal preview, local to this tab only — nowhere near the
 * fidelity of the real eternity-web sequence (that lives in a different
 * app, with its own three.js scene and framer-motion timeline), but enough
 * to feel the actual countdown length and know exactly when zero lands.
 */
function LaunchRehearsalPreview({ armedAt, countdownSecs, onDone }: { armedAt: number; countdownSecs: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(countdownSecs);
  const [phase, setPhase] = useState<'countdown' | 'launched'>('countdown');
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - armedAt) / 1000;
      if (elapsed >= countdownSecs) {
        setPhase('launched');
        return;
      }
      setRemaining(Math.max(0, Math.ceil(countdownSecs - elapsed)));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [armedAt, countdownSecs]);

  useEffect(() => {
    if (phase !== 'launched') return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  return (
    <div className="launch-preview-overlay">
      {phase === 'countdown' ? (
        <div key={remaining} className="launch-preview-number">
          {remaining}
        </div>
      ) : (
        <div className="launch-preview-launched">
          <img src="/img/eternity-logo.png" alt="Eternity" />
          <p>Launched</p>
        </div>
      )}
      <button type="button" className="launch-preview-skip" onClick={onDone}>
        Close preview
      </button>
    </div>
  );
}
