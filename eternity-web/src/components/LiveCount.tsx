import { useEffect, useState } from 'react';
import { useLiveCount } from '../hooks/useLiveCount';
import { subscribeLaunchVisualPhase } from '../lib/launchVisuals';

/**
 * A quiet badge showing how many browser tabs are on the site right now —
 * reuses the same presence channel the launch control panel already reads.
 * Hidden until the first real count arrives (never shows "0" or a
 * placeholder), hidden during the launch cinematic, and hidden until the
 * visitor has scrolled a little: the hero's own CTA buttons and scroll
 * hint sit in that same bottom-right corner on short mobile viewports, so
 * showing it over the fold crowds the actual pre-order button.
 */
export default function LiveCount() {
  const count = useLiveCount();
  const [launchHidden, setLaunchHidden] = useState(false);
  const [pastFold, setPastFold] = useState(false);

  useEffect(() => subscribeLaunchVisualPhase((phase) => setLaunchHidden(phase !== 'none')), []);

  useEffect(() => {
    const onScroll = () => setPastFold(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (count === null || count < 1 || launchHidden || !pastFold) return null;

  return (
    <div className="live-count" role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <b>{count}</b> {count === 1 ? 'person' : 'people'} here now
    </div>
  );
}
