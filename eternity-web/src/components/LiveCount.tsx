import { useEffect, useState } from 'react';
import { useLiveCount } from '../hooks/useLiveCount';
import { subscribeLaunchVisualPhase } from '../lib/launchVisuals';

/**
 * A quiet, always-on badge showing how many browser tabs are on the site
 * right now — reuses the same presence channel the launch control panel
 * already reads. Hidden until the first real count arrives (never shows
 * "0" or a placeholder), and hidden during the launch cinematic so it
 * doesn't compete with the overlay.
 */
export default function LiveCount() {
  const count = useLiveCount();
  const [launchHidden, setLaunchHidden] = useState(false);

  useEffect(() => subscribeLaunchVisualPhase((phase) => setLaunchHidden(phase !== 'none')), []);

  if (count === null || count < 1 || launchHidden) return null;

  return (
    <div className="live-count" role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <b>{count}</b> {count === 1 ? 'person' : 'people'} here now
    </div>
  );
}
