import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFeature } from '../lib/features';

interface LockedRouteProps {
  feature: string;
  children: ReactNode;
}

/** Guards a whole route. While the feature is locked, shows a full-page panel instead of the route's content. */
export default function LockedRoute({ feature, children }: LockedRouteProps) {
  const { isLive, label } = useFeature(feature);

  if (isLive) return <>{children}</>;

  return (
    <div className="locked-panel">
      <img className="locked-panel-mark" src="/img/eternity-logo.png" alt="Eternity" />
      <p className="locked-panel-msg">{label} will be published soon</p>
      <Link className="btn btn-gold" to="/">Back to Eternity</Link>
    </div>
  );
}
