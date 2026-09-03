import { useEffect, useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import LaunchSequence from './LaunchSequence';
import { useLaunchState } from '../hooks/useLaunchState';

const SEEN_KEY = 'eternity:launched-seen';
const PREVIEW_COUNTDOWN_SECS = 5;

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // private mode — worst case this replays once more than it should
  }
}

/**
 * Decides whether the launch sequence should render at all — mounted once,
 * unconditionally, at the app root so it can overlay whatever page happens
 * to be showing. Wrapped in its own silent ErrorBoundary: if the sequence
 * throws, the real site underneath must still be usable, not a stuck overlay.
 */
export default function LaunchGate() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const previewMode = params.get('launch') === 'preview';
  const [previewArmedAt] = useState(() => Date.now());
  const [previewDone, setPreviewDone] = useState(false);

  const { state, loading } = useLaunchState();

  const [dismissed, setDismissed] = useState(false);
  // Once true, stays true regardless of what `state.launch_state` does
  // next — armedAt/countdownSecs are frozen at the moment arming was seen,
  // and the *live* launch_state is passed through separately as
  // `dbLaunched` so the already-running sequence can react to it, rather
  // than this whole component unmounting the sequence the instant the
  // admin's LAUNCH click flips the state out from under it.
  const [sequence, setSequence] = useState<{ armedAt: number; countdownSecs: number } | null>(null);

  // Dev-only utility flag — never affects anything for a real visitor.
  useEffect(() => {
    if (params.get('launch') === 'reset') {
      try {
        localStorage.removeItem(SEEN_KEY);
      } catch {
        // nothing to clear
      }
    }
  }, [params]);

  useEffect(() => {
    if (previewMode || loading || !state || dismissed || sequence) return;
    if (hasSeen()) {
      setDismissed(true);
      return;
    }
    if (state.launch_state === 'armed' && state.launch_armed_at) {
      setSequence({ armedAt: new Date(state.launch_armed_at).getTime(), countdownSecs: state.launch_countdown_secs });
      return;
    }
    // Arriving fresh on an already-'launched' state means later, not live —
    // mark it seen without ever showing the animation.
    if (state.launch_state === 'launched') {
      markSeen();
      setDismissed(true);
    }
  }, [previewMode, loading, state, dismissed, sequence]);

  const onComplete = () => {
    markSeen();
    setDismissed(true);
  };

  if (previewMode) {
    if (previewDone) return null;
    return (
      <ErrorBoundary fallback={null}>
        <LaunchSequence
          armedAt={previewArmedAt}
          countdownSecs={PREVIEW_COUNTDOWN_SECS}
          dbLaunched={false}
          onComplete={() => setPreviewDone(true)}
        />
      </ErrorBoundary>
    );
  }

  if (dismissed || hasSeen()) return null;

  if (sequence) {
    return (
      <ErrorBoundary fallback={null}>
        <LaunchSequence
          armedAt={sequence.armedAt}
          countdownSecs={sequence.countdownSecs}
          dbLaunched={state?.launch_state === 'launched'}
          onComplete={onComplete}
        />
      </ErrorBoundary>
    );
  }

  // idle (or still loading): nothing to show yet, but useLaunchState stays
  // subscribed above so this re-renders the instant it flips to 'armed'.
  return null;
}
